import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const when = (iso) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Dashboard({ user, onLogout }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const load = () => api.listDocs().then(setDocs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const open = (id) => { window.location.hash = `#/d/${id}`; };

  const run = async (action) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const create = () => run(async () => open((await api.createDoc()).document.id));

  const importFile = (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file after an error
    if (file) run(async () => open((await api.importFile(file)).document.id));
  };

  const remove = (doc) => {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    run(async () => { await api.deleteDoc(doc.id); await load(); });
  };

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">Ajaia Docs</span>
        <span className="spacer" />
        <span className="avatar small">{user.name[0]}</span>
        <span>{user.name}</span>
        <button className="link" onClick={onLogout}>Switch user</button>
      </header>

      <main className="container">
        <div className="actions">
          <button className="primary" onClick={create} disabled={busy}>+ New document</button>
          <button onClick={() => fileInput.current.click()} disabled={busy}>Import file</button>
          <input ref={fileInput} type="file" accept=".txt,.md,.docx" hidden onChange={importFile} />
          <span className="muted hint">Import creates a new document from a .txt, .md or .docx file (max 2 MB).</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}

        {!docs ? (
          <p className="muted">Loading documents…</p>
        ) : (
          <>
            <section>
              <h2>My documents</h2>
              {docs.owned.length === 0 ? (
                <p className="muted empty">Nothing here yet. Create a document or import a file to get started.</p>
              ) : (
                <ul className="doc-list">
                  {docs.owned.map((d) => (
                    <li key={d.id}>
                      <button className="doc-row" onClick={() => open(d.id)}>
                        <span className="doc-title">{d.title}</span>
                        <span className="badge owner">Owner</span>
                        {d.shareCount > 0 && (
                          <span className="muted">Shared with {d.shareCount}</span>
                        )}
                        <span className="spacer" />
                        <span className="muted">{when(d.updatedAt)}</span>
                      </button>
                      <button className="link danger" onClick={() => remove(d)} aria-label={`Delete ${d.title}`}>
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2>Shared with me</h2>
              {docs.shared.length === 0 ? (
                <p className="muted empty">Documents other people share with you will appear here.</p>
              ) : (
                <ul className="doc-list">
                  {docs.shared.map((d) => (
                    <li key={d.id}>
                      <button className="doc-row" onClick={() => open(d.id)}>
                        <span className="doc-title">{d.title}</span>
                        <span className={`badge ${d.role}`}>{d.role === 'editor' ? 'Can edit' : 'View only'}</span>
                        <span className="muted">Owner: {d.ownerName}</span>
                        <span className="spacer" />
                        <span className="muted">{when(d.updatedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
