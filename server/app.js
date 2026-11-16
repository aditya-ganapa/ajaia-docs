import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sanitizeContent, importFile, ImportError, MAX_IMPORT_BYTES } from './content.js';

const MAX_TITLE = 200;
const MAX_CONTENT_BYTES = 1024 * 1024;
const ROLES = ['viewer', 'editor'];
const COOKIE = 'uid';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validTitle(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'Title must be text.');
  const title = value.trim();
  if (!title) throw new HttpError(400, 'Title cannot be empty.');
  if (title.length > MAX_TITLE) throw new HttpError(400, `Title must be ${MAX_TITLE} characters or fewer.`);
  return title;
}

export function createApp(db, { cookieSecret = 'dev-secret-change-me', staticDir } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser(cookieSecret));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } });

  const q = {
    user: db.prepare('SELECT id, name, email FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT id, name, email FROM users WHERE email = ?'),
    users: db.prepare('SELECT id, name, email FROM users ORDER BY name'),
    doc: db.prepare(
      `SELECT d.*, u.name AS owner_name FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = ?`
    ),
    share: db.prepare('SELECT role FROM shares WHERE document_id = ? AND user_id = ?'),
    owned: db.prepare(
      `SELECT d.id, d.title, d.updated_at,
              (SELECT COUNT(*) FROM shares s WHERE s.document_id = d.id) AS share_count
       FROM documents d WHERE d.owner_id = ? ORDER BY d.updated_at DESC`
    ),
    shared: db.prepare(
      `SELECT d.id, d.title, d.updated_at, s.role, u.name AS owner_name
       FROM shares s JOIN documents d ON d.id = s.document_id JOIN users u ON u.id = d.owner_id
       WHERE s.user_id = ? ORDER BY d.updated_at DESC`
    ),
    insertDoc: db.prepare(
      'INSERT INTO documents (id, title, content, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ),
    updateDoc: db.prepare('UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE id = ?'),
    deleteDoc: db.prepare('DELETE FROM documents WHERE id = ?'),
    shares: db.prepare(
      `SELECT u.id, u.name, u.email, s.role FROM shares s JOIN users u ON u.id = s.user_id
       WHERE s.document_id = ? ORDER BY u.name`
    ),
    upsertShare: db.prepare(
      `INSERT INTO shares (document_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role`
    ),
    deleteShare: db.prepare('DELETE FROM shares WHERE document_id = ? AND user_id = ?'),
  };

  // ---- access control: the single place that decides who can do what ----

  /** Returns 'owner' | 'editor' | 'viewer' | null for a user on a document row. */
  function roleFor(doc, userId) {
    if (doc.owner_id === userId) return 'owner';
    return q.share.get(doc.id, userId)?.role ?? null;
  }

  /** Loads a document and enforces a minimum role. Unknown and forbidden-to-read
   *  both return 404 so document ids don't leak to people without access. */
  function loadDoc(req, allowed) {
    const doc = q.doc.get(req.params.id);
    const role = doc && roleFor(doc, req.user.id);
    if (!role) throw new HttpError(404, 'Document not found.');
    if (!allowed.includes(role)) {
      throw new HttpError(403, role === 'viewer' ? 'You have view-only access to this document.' : 'Only the owner can do that.');
    }
    return { doc, role };
  }

  function requireUser(req, _res, next) {
    const user = req.signedCookies[COOKIE] && q.user.get(req.signedCookies[COOKIE]);
    if (!user) return next(new HttpError(401, 'Please sign in.'));
    req.user = user;
    next();
  }

  const present = (doc, role) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    owner: { id: doc.owner_id, name: doc.owner_name },
    role,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  });

  function createDoc(ownerId, title, content) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    q.insertDoc.run(id, title, content, ownerId, now, now);
    return present(q.doc.get(id), 'owner');
  }

  // ---- auth (mocked: pick a seeded user) ----

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/users', (_req, res) => res.json({ users: q.users.all() }));

  app.post('/api/login', (req, res) => {
    const user = q.user.get(String(req.body?.userId ?? ''));
    if (!user) throw new HttpError(400, 'Unknown user.');
    res.cookie(COOKIE, user.id, {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000,
    });
    res.json({ user });
  });

  app.post('/api/logout', (_req, res) => {
    res.clearCookie(COOKIE);
    res.status(204).end();
  });

  app.get('/api/me', requireUser, (req, res) => res.json({ user: req.user }));

  // ---- documents ----

  app.get('/api/documents', requireUser, (req, res) => {
    res.json({
      owned: q.owned.all(req.user.id).map((d) => ({
        id: d.id, title: d.title, updatedAt: d.updated_at, shareCount: d.share_count,
      })),
      shared: q.shared.all(req.user.id).map((d) => ({
        id: d.id, title: d.title, updatedAt: d.updated_at, role: d.role, ownerName: d.owner_name,
      })),
    });
  });

  app.post('/api/documents', requireUser, (req, res) => {
    const title = req.body?.title === undefined ? 'Untitled document' : validTitle(req.body.title);
    res.status(201).json({ document: createDoc(req.user.id, title, '') });
  });

  app.post('/api/documents/import', requireUser, upload.single('file'), async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose a file to import.');
    const { title, content } = await importFile(req.file);
    res.status(201).json({ document: createDoc(req.user.id, title, content) });
  });

  app.get('/api/documents/:id', requireUser, (req, res) => {
    const { doc, role } = loadDoc(req, ['owner', 'editor', 'viewer']);
    res.json({ document: present(doc, role) });
  });

  app.patch('/api/documents/:id', requireUser, (req, res) => {
    const { doc, role } = loadDoc(req, ['owner', 'editor']);
    const body = req.body ?? {};
    if (body.title === undefined && body.content === undefined) throw new HttpError(400, 'Nothing to update.');

    const title = body.title === undefined ? doc.title : validTitle(body.title);
    let content = doc.content;
    if (body.content !== undefined) {
      if (typeof body.content !== 'string') throw new HttpError(400, 'Content must be text.');
      if (Buffer.byteLength(body.content) > MAX_CONTENT_BYTES) throw new HttpError(413, 'Document is too large (1 MB limit).');
      content = sanitizeContent(body.content);
    }
    q.updateDoc.run(title, content, new Date().toISOString(), doc.id);
    res.json({ document: present(q.doc.get(doc.id), role) });
  });

  app.delete('/api/documents/:id', requireUser, (req, res) => {
    const { doc } = loadDoc(req, ['owner']);
    q.deleteDoc.run(doc.id);
    res.status(204).end();
  });

  // ---- sharing (owner only) ----

  app.get('/api/documents/:id/shares', requireUser, (req, res) => {
    const { doc } = loadDoc(req, ['owner']);
    res.json({ shares: q.shares.all(doc.id) });
  });

  app.post('/api/documents/:id/shares', requireUser, (req, res) => {
    const { doc } = loadDoc(req, ['owner']);
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const role = req.body?.role ?? 'viewer';
    if (!email) throw new HttpError(400, 'Enter an email address.');
    if (!ROLES.includes(role)) throw new HttpError(400, 'Role must be viewer or editor.');
    const target = q.userByEmail.get(email);
    if (!target) throw new HttpError(404, `No user found with email ${email}.`);
    if (target.id === doc.owner_id) throw new HttpError(400, 'You already own this document.');
    q.upsertShare.run(doc.id, target.id, role, new Date().toISOString());
    res.status(201).json({ shares: q.shares.all(doc.id) });
  });

  app.delete('/api/documents/:id/shares/:userId', requireUser, (req, res) => {
    const { doc } = loadDoc(req, ['owner']);
    q.deleteShare.run(doc.id, req.params.userId);
    res.json({ shares: q.shares.all(doc.id) });
  });

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

  // ---- built client (production) ----
  const dist = staticDir ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
  }

  // ---- errors: always JSON, never a stack trace ----
  app.use((err, _req, res, _next) => {
    if (err instanceof ImportError) return res.status(400).json({ error: err.message });
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'File is too large (2 MB limit).' : 'Upload failed.' });
    }
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
