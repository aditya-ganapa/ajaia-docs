async function request(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  users: () => request('/users'),
  me: () => request('/me'),
  login: (userId) => request('/login', { method: 'POST', body: { userId } }),
  logout: () => request('/logout', { method: 'POST' }),
  listDocs: () => request('/documents'),
  createDoc: () => request('/documents', { method: 'POST', body: {} }),
  getDoc: (id) => request(`/documents/${id}`),
  updateDoc: (id, patch) => request(`/documents/${id}`, { method: 'PATCH', body: patch }),
  deleteDoc: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  importFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/documents/import', { method: 'POST', body: form });
  },
  listShares: (id) => request(`/documents/${id}/shares`),
  addShare: (id, email, role) => request(`/documents/${id}/shares`, { method: 'POST', body: { email, role } }),
  removeShare: (id, userId) => request(`/documents/${id}/shares/${userId}`, { method: 'DELETE' }),
};
