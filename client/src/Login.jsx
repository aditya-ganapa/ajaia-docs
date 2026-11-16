import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function Login({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.users().then((r) => setUsers(r.users)).catch((e) => setError(e.message));
  }, []);

  const pick = (id) => api.login(id).then((r) => onLogin(r.user)).catch((e) => setError(e.message));

  return (
    <div className="center">
      <div className="card login">
        <h1 className="brand">Ajaia Docs</h1>
        <p className="muted">
          Demo sign-in: choose one of the seeded accounts. Switch accounts to see sharing from both sides.
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="user-list">
          {users.map((u) => (
            <button key={u.id} className="user-button" onClick={() => pick(u.id)}>
              <span className="avatar">{u.name[0]}</span>
              <span>
                <strong>{u.name}</strong>
                <br />
                <span className="muted">{u.email}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
