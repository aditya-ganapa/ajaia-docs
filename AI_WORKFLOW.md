# AI workflow note

> Draft. Edit this so it describes your own process accurately before submitting; the bracketed part is yours to fill in.

## Tools

Claude (Anthropic), used as a coding agent: it wrote code, ran the tests and drove a headless browser against the running app.

## Where AI materially sped things up

- **Scaffolding the full stack in one pass:** Express routes, SQLite schema and seed, the React client and TipTap toolbar wiring.
- **File import:** choosing and wiring `mammoth` (docx) and `marked` (markdown) behind one sanitizing step.
- **Tests:** a first draft of the access-control test matrix (no access, viewer, editor, owner, revoked).
- **Docs:** first drafts of the README and architecture note.

## What was changed or rejected

- The first test script (`node --test test/`) failed on Node 22 and was replaced with `node --test`.
- An AI-written assertion on the "shared with me" list depended on row order and was hard to read; it was rewritten to sort and compare.
- The share dialog refetched its data on every parent re-render because of an unstable callback prop; fixed with a memoized handler.
- Scope the AI could have added and that was kept out: real-time editing, password auth, export. They are listed as cuts in the architecture note.
- [Add anything you changed or rejected yourself while reviewing the code.]

## How correctness and quality were verified

- **Automated tests:** `npm test` runs 7 API tests on an in-memory database, covering the document lifecycle, validation, HTML sanitizing, every sharing role transition, and import of supported and unsupported files.
- **Browser run:** a scripted pass through the main flow (sign in, create, format, reload, share, import, switch user, open as viewer), checking that formatting survived a reload and that a viewer gets a read-only editor with no toolbar or share button.
- **Screenshots** of each screen were reviewed for layout and clarity (`docs/screenshots/`).
- [Add your own manual testing on the deployed URL.]
