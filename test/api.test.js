import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDb } from '../server/db.js';
import { createApp } from '../server/app.js';

// Each test gets a fresh in-memory database with the seeded users.
function setup() {
  const app = createApp(createDb(':memory:'), { staticDir: '/nonexistent' });
  const as = async (userId) => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ userId }).expect(200);
    return agent;
  };
  return { app, as };
}

test('requests without a session are rejected', async () => {
  const { app } = setup();
  await request(app).get('/api/documents').expect(401);
  await request(app).post('/api/documents').send({}).expect(401);
});

test('create, rename, edit and reopen a document', async () => {
  const { as } = setup();
  const alice = await as('u_alice');
  const { body } = await alice.post('/api/documents').send({}).expect(201);
  const id = body.document.id;
  assert.equal(body.document.title, 'Untitled document');

  const html = '<h1>Plan</h1><p><strong>Bold</strong> <em>italic</em> <u>underline</u></p><ul><li>One</li></ul>';
  await alice.patch(`/api/documents/${id}`).send({ title: 'Q3 plan', content: html }).expect(200);

  const reopened = await alice.get(`/api/documents/${id}`).expect(200);
  assert.equal(reopened.body.document.title, 'Q3 plan');
  assert.equal(reopened.body.document.content, html);
  assert.equal(reopened.body.document.role, 'owner');
});

test('validation: bad titles and empty updates are rejected', async () => {
  const { as } = setup();
  const alice = await as('u_alice');
  const { body } = await alice.post('/api/documents').send({}).expect(201);
  await alice.patch(`/api/documents/${body.document.id}`).send({ title: '   ' }).expect(400);
  await alice.patch(`/api/documents/${body.document.id}`).send({ title: 'x'.repeat(201) }).expect(400);
  await alice.patch(`/api/documents/${body.document.id}`).send({}).expect(400);
});

test('saved content is sanitized but keeps formatting', async () => {
  const { as } = setup();
  const alice = await as('u_alice');
  const { body } = await alice.post('/api/documents').send({}).expect(201);
  const res = await alice
    .patch(`/api/documents/${body.document.id}`)
    .send({ content: '<p onclick="x()">Hi <strong>there</strong></p><script>alert(1)</script><a href="javascript:x">l</a>' })
    .expect(200);
  assert.equal(res.body.document.content, '<p>Hi <strong>there</strong></p><a>l</a>');
});

test('sharing: access follows owner / editor / viewer / none', async () => {
  const { as } = setup();
  const alice = await as('u_alice');
  const bob = await as('u_bob');
  const carol = await as('u_carol');
  const { body } = await alice.post('/api/documents').send({ title: 'Roadmap' }).expect(201);
  const url = `/api/documents/${body.document.id}`;

  // No access yet: the document is invisible to Bob.
  await bob.get(url).expect(404);
  await bob.patch(url).send({ title: 'Hacked' }).expect(404);

  // Viewer: can read, cannot write.
  await alice.post(`${url}/shares`).send({ email: 'bob@example.com', role: 'viewer' }).expect(201);
  assert.equal((await bob.get(url).expect(200)).body.document.role, 'viewer');
  await bob.patch(url).send({ content: '<p>nope</p>' }).expect(403);

  // It shows up under "shared", not "owned", for Bob; Carol still sees nothing.
  const bobList = (await bob.get('/api/documents').expect(200)).body;
  const shared = bobList.shared.map((d) => [d.title, d.role, d.ownerName]).sort();
  assert.deepEqual(shared, [
    ['Roadmap', 'viewer', 'Alice Chen'],
    ['Welcome to Ajaia Docs', 'editor', 'Alice Chen'],
  ]);
  assert.equal(bobList.owned.length, 0);
  await carol.get(url).expect(404);

  // Editor: can write, but cannot share onward or delete.
  await alice.post(`${url}/shares`).send({ email: 'bob@example.com', role: 'editor' }).expect(201);
  await bob.patch(url).send({ content: '<p>Bob was here</p>' }).expect(200);
  await bob.post(`${url}/shares`).send({ email: 'carol@example.com' }).expect(403);
  await bob.delete(url).expect(403);

  // Revoking removes access immediately.
  await alice.delete(`${url}/shares/u_bob`).expect(200);
  await bob.get(url).expect(404);
});

test('sharing validation', async () => {
  const { as } = setup();
  const alice = await as('u_alice');
  const { body } = await alice.post('/api/documents').send({}).expect(201);
  const url = `/api/documents/${body.document.id}/shares`;
  await alice.post(url).send({ email: 'nobody@example.com' }).expect(404);
  await alice.post(url).send({ email: 'alice@example.com' }).expect(400);
  await alice.post(url).send({ email: 'bob@example.com', role: 'admin' }).expect(400);
  await alice.post(url).send({}).expect(400);
});

test('import: markdown and text become editable documents; other types are refused', async () => {
  const { as } = setup();
  const alice = await as('u_alice');

  const md = await alice
    .post('/api/documents/import')
    .attach('file', Buffer.from('# Notes\n\n- one\n- **two**\n'), 'meeting-notes.md')
    .expect(201);
  assert.equal(md.body.document.title, 'meeting-notes');
  assert.match(md.body.document.content, /<h1>Notes<\/h1>/);
  assert.match(md.body.document.content, /<li><strong>two<\/strong><\/li>/);

  const txt = await alice
    .post('/api/documents/import')
    .attach('file', Buffer.from('First <para>\nsame para\n\nSecond'), 'a.txt')
    .expect(201);
  assert.equal(txt.body.document.content, '<p>First &lt;para&gt;<br />same para</p><p>Second</p>');

  const pdf = await alice.post('/api/documents/import').attach('file', Buffer.from('%PDF'), 'a.pdf').expect(400);
  assert.match(pdf.body.error, /Unsupported file type/);
  await alice.post('/api/documents/import').attach('file', Buffer.alloc(0), 'empty.txt').expect(400);
  await alice.post('/api/documents/import').attach('file', Buffer.from('not a zip'), 'bad.docx').expect(400);
  await alice
    .post('/api/documents/import')
    .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1, 'a'), 'big.txt')
    .expect(413);
});
