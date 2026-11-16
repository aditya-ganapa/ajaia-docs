# Architecture note

## Shape

One Node process. Express serves a JSON API under `/api` and the built React client. Data lives in a single SQLite file.

```
Browser (React + TipTap)  --fetch /api-->  Express  -->  SQLite (users, documents, shares)
```

## What I prioritized, and why

1. **The editing loop.** Open, type, format, leave, come back and find it as you left it. This is what a reviewer touches first, so it got the most care: autosave with a visible status, a retry when a save fails, a warning before closing a tab with unsaved edits.
2. **Access logic that is correct, not just present.** Sharing is the part most likely to be wrong in a quick build, so every document route goes through one function (`loadDoc` in `server/app.js`) that resolves the caller's role and enforces the minimum required. The tests concentrate here.
3. **One import path done properly** rather than several half-done upload features.
4. **Cheap to run and review.** No external services, no accounts to create, one command to start.

## Key decisions

**TipTap for the editor.** Rich-text editing on raw `contenteditable` is where time disappears. TipTap (ProseMirror) gives a schema, so the document can only contain structures the editor understands, and it would be the base for real-time editing later.

**Content stored as sanitized HTML.** The editor emits HTML; the server runs every save and every import through one allowlist (`sanitizeContent`) before storing it. That gives one stored format for typed and imported content, and means a crafted API call cannot store script. The tradeoff: HTML is harder to diff or merge than ProseMirror JSON, which would matter for version history or co-editing.

**SQLite via better-sqlite3.** Zero setup for reviewers and synchronous queries keep the server code short. The schema is three tables; `shares` has a composite primary key on (document, user), so re-sharing is an upsert that changes the role. Moving to Postgres would be a change to `db.js` and the query block at the top of `app.js`.

**Roles: owner, editor, viewer.** Owner is a column on the document, not a share row, so a document always has exactly one owner. Only the owner can share, change roles, or delete. Viewer and editor cost almost nothing over a single "has access" flag and make the sharing demo more convincing.

**404 for documents you cannot read.** A user without access gets "not found" rather than "forbidden", so document ids do not confirm that a document exists. A viewer attempting to write gets 403 with an explanation.

**Mocked sign-in.** A signed, http-only cookie holding a seeded user id. It is enough to make "who is asking" real on the server, so access control is exercised honestly, without spending the timebox on password flows.

**Import creates a new document.** Chosen over attachments or import-into-draft because it is the most common real need (bring an existing file in and keep working) and has no ambiguous merge behaviour. `.txt` becomes paragraphs, `.md` is parsed with `marked`, `.docx` is converted with `mammoth`.

## Deliberately left out

- **Real-time collaboration.** The largest feature in the space and not possible to do well in the timebox. Concurrent edits are last-write-wins, stated in the README.
- **Real auth, sign-up, share-by-link, notifications.**
- **Frontend tests.** Test effort went to the API, where the access rules live.
- **Pagination and search** on the document list.

## Known limits

- Last-write-wins on concurrent edits. Next step: send a version with each save and reject stale ones.
- Autosave sends the whole document on each save; fine at the 1 MB content limit.
- On a host without a persistent disk the database resets on restart (see README).
