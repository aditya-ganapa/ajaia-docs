# Submission contents

| Item | Location |
| --- | --- |
| Source code | this folder (`server/`, `client/`, `test/`) |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| Walkthrough video URL | `VIDEO_URL.txt` |
| Screenshots | `docs/screenshots/` |
| Sample file for import | `samples/meeting-notes.md` |
| Deployment config | `Dockerfile`, `render.yaml` |

**Live URL:** _add your deployed URL here_

**Test accounts** (no passwords; pick one on the sign-in screen): alice@example.com, bob@example.com, carol@example.com

## Status

Working end to end:

- Create, rename, edit, autosave, reopen and delete documents
- Bold, italic, underline, headings, bulleted and numbered lists
- Import `.txt`, `.md`, `.docx` (max 2 MB) as a new document
- Share by email as viewer or editor; change role; revoke; owned and shared documents listed separately
- SQLite persistence
- 7 automated API tests (`npm test`)

Stretch included: role-based sharing (viewer and editor).

Not built: real-time co-editing (last save wins), real authentication, comments, version history, export. Images and tables in `.docx` imports are dropped.

Next 2 to 4 hours: stale-save detection, then version history, then Markdown export.
