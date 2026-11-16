import { useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import EditorPage from './EditorPage.jsx';

// Two screens only, so a hash route is enough: "#/" and "#/d/<id>".
function useRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const match = hash.match(/^#\/d\/([\w-]+)$/);
  return match ? { page: 'doc', id: match[1] } : { page: 'home' };
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const route = useRoute();

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="center muted">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;

  const logout = async () => {
    await api.logout().catch(() => {});
    window.location.hash = '#/';
    setUser(null);
  };

  return route.page === 'doc' ? (
    <EditorPage key={route.id} id={route.id} user={user} />
  ) : (
    <Dashboard user={user} onLogout={logout} />
  );
}
