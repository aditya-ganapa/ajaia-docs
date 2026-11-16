import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function ShareDialog({ docId, ownerId, onClose }) {
  const [shares, setShares] = useState(null);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.listShares(docId), api.users()])
      .then(([s, u]) => { setShares(s.shares); setUsers(u.users); })
      .catch((e) => setError(e.message));
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docId, onClose]);

  const act = (promise) =>
    promise.then((r) => { setShares(r.shares); setError(''); return true; }).catch((e) => { setError(e.message); return false; });

  const add = async (e) => {
    e.preventDefault();
    if (await act(api.addShare(docId, email, role))) setEmail('');
  };

  // Suggest the demo accounts that don't already have access.
  const suggestions = users.filter((u) => u.id !== ownerId && !shares?.some((s) => s.id === u.id));

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card dialog" role="dialog" aria-modal="true" aria-label="Share document">
        <h2>Share document</h2>
        <form className="share-form" onSubmit={add}>
          <input
            type="email"
            required
            autoFocus
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            list="share-suggestions"
            aria-label="Email address"
          />
          <datalist id="share-suggestions">
            {suggestions.map((u) => <option key={u.id} value={u.email}>{u.name}</option>)}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Access level">
            <option value="viewer">Can view</option>
            <option value="editor">Can edit</option>
          </select>
          <button className="primary" type="submit">Share</button>
        </form>
        {suggestions.length > 0 && (
          <p className="muted hint">Demo accounts: {suggestions.map((u) => u.email).join(', ')}</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}

        <h3>People with access</h3>
        {!shares ? (
          <p className="muted">Loading…</p>
        ) : shares.length === 0 ? (
          <p className="muted">Only you can open this document.</p>
        ) : (
          <ul className="share-list">
            {shares.map((s) => (
              <li key={s.id}>
                <span className="avatar small">{s.name[0]}</span>
                <span>{s.name} <span className="muted">{s.email}</span></span>
                <span className="spacer" />
                <select value={s.role} onChange={(e) => act(api.addShare(docId, s.email, e.target.value))} aria-label={`Access for ${s.name}`}>
                  <option value="viewer">Can view</option>
                  <option value="editor">Can edit</option>
                </select>
                <button className="link danger" onClick={() => act(api.removeShare(docId, s.id))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="dialog-footer"><button onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
