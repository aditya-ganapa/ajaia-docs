# Ajaia Docs

A lightweight collaborative document editor: create and format documents in the browser, import files as new documents, and share them with other users as viewer or editor.

**Live URL:** _add your deployed URL here_

## Test accounts

Sign-in is a demo account picker (no passwords). Three users are seeded:

| Name | Email | Starts with |
| --- | --- | --- |
| Alice Chen | alice@example.com | Owns "Welcome to Ajaia Docs" |
| Bob Martinez | bob@example.com | Has edit access to Alice's welcome document |
| Carol Singh | carol@example.com | Nothing |

To review sharing: sign in as Alice, open a document, click **Share**, add `carol@example.com`, then **Switch user** and sign in as Carol.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run build     # build the client into dist/
npm start         # http://localhost:3001
```

For development with hot reload (API on :3001, client on http://localhost:5173):

```bash
npm run dev
```

Run the tests:

```bash
npm test
```

Configuration (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port |
| `DB_PATH` | `./data/app.db` | SQLite file; created and seeded on first start |
| `COOKIE_SECRET` | dev default | Signs the session cookie; set it in production |

To reset the data, stop the server and delete the `data/` folder.

## What works

- **Documents:** create, rename (click the title), edit, autosave, reopen, delete (owner only).
- **Formatting:** bold, italic, underline, headings 1 to 3, bulleted and numbered lists, undo and redo, with the usual keyboard shortcuts.
- **File import:** from the dashboard, **Import file** turns a `.txt`, `.md` or `.docx` file into a new editable document. Limit 2 MB. Other file types are refused with a message. `samples/meeting-notes.md` is there to try.
- **Sharing:** the owner grants access by email as **Can view** or **Can edit**, changes a role, or removes access. The dashboard separates **My documents** from **Shared with me**, with role and owner shown. Viewers get a read-only editor.
- **Persistence:** documents, formatting and shares are stored in SQLite and survive refresh and restart.
- **Validation and errors:** titles, content size, file type and size, share targets and roles are validated on the server; the UI shows the message and offers a retry when a save fails.

## What is not built

- Real-time co-editing. Two people editing the same document at once: the last save wins.
- Real authentication (passwords, sign-up). The picker is a stand-in.
- Images and tables in imported `.docx` files are dropped; text, headings, lists and inline formatting are kept.
- Comments, version history, export.

With another 2 to 4 hours, in order: conflict detection on save (reject a save based on a stale version and offer a reload), then version history, then Markdown export.

## Deploy

The app is one Node process that serves both the API and the built client.

**Render (free):** push the repository to GitHub, then in Render choose **New > Blueprint** and select it. `render.yaml` and the `Dockerfile` do the rest.

Note on the free plan: Render's free web services have no persistent disk, so the SQLite file is recreated (and reseeded) whenever the service restarts or redeploys, and the service sleeps when idle, so the first request can take up to a minute. Data persists across refreshes and sessions while the service is running. For durable hosting, attach a disk and point `DB_PATH` at it, or use any host with a volume (Fly.io, Railway).

**Docker anywhere:**

```bash
docker build -t ajaia-docs .
docker run -p 3001:3001 -e COOKIE_SECRET=change-me -v ajaia-data:/app/data ajaia-docs
```

## Project layout

```
server/   Express API: app.js (routes, access control), db.js (schema, seed), content.js (sanitizing, import)
client/   React + TipTap single-page app
test/     API tests (node:test + supertest, in-memory SQLite)
```

See `ARCHITECTURE.md` for the reasoning and `AI_WORKFLOW.md` for how AI was used.
