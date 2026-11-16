import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Seeded accounts stand in for real sign-up; see ARCHITECTURE.md.
export const SEED_USERS = [
  { id: 'u_alice', name: 'Alice Chen', email: 'alice@example.com' },
  { id: 'u_bob', name: 'Bob Martinez', email: 'bob@example.com' },
  { id: 'u_carol', name: 'Carol Singh', email: 'carol@example.com' },
];

const WELCOME = `<h1>Welcome to Ajaia Docs</h1>
<p>This document is owned by <strong>Alice</strong> and shared with <strong>Bob</strong> as an editor.</p>
<h2>Things to try</h2>
<ul><li>Format text with <strong>bold</strong>, <em>italic</em> and <u>underline</u></li>
<li>Import a .txt, .md or .docx file from the dashboard</li>
<li>Share a document, then switch user to see it under "Shared with me"</li></ul>`;

export function createDb(file = ':memory:') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      owner_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shares (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
      created_at TEXT NOT NULL,
      PRIMARY KEY (document_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);
  `);

  // Seed only an empty database, so restarts never duplicate or overwrite data.
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    const now = new Date().toISOString();
    const addUser = db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)');
    db.transaction(() => {
      for (const u of SEED_USERS) addUser.run(u.id, u.name, u.email);
      db.prepare(
        'INSERT INTO documents (id, title, content, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('welcome', 'Welcome to Ajaia Docs', WELCOME, 'u_alice', now, now);
      db.prepare('INSERT INTO shares (document_id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
        'welcome', 'u_bob', 'editor', now
      );
    })();
  }
  return db;
}
