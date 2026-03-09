// Centralized edition state — managed by AppContext
let _currentEdition = '';

export function setCurrentEdition(editionId) {
  _currentEdition = editionId || '';
}

function editionParam() {
  return _currentEdition ? `edition=${encodeURIComponent(_currentEdition)}` : '';
}

function appendEdition(url) {
  const sep = url.includes('?') ? '&' : '?';
  const ep = editionParam();
  return ep ? `${url}${sep}${ep}` : url;
}

async function request(url, options = {}) {
  const res = await fetch(appendEdition(url), {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  bootstrap: (username = '') =>
    request(`/api/bootstrap?username=${encodeURIComponent(username)}`),

  editions: () => request('/api/editions'),

  // Login with password (creates user if new, verifies if existing)
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // List usernames for login hints
  listUsers: () => request('/api/auth/users'),

  updateFilm: (username, filmId, patch) =>
    request(`/api/users/${encodeURIComponent(username)}/films/${encodeURIComponent(filmId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  savePrediction: (username, categoryId, nomineeId) =>
    request(`/api/predictions/${encodeURIComponent(username)}/${encodeURIComponent(categoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ nomineeId }),
    }),

  setOfficialWinner: (categoryId, nomineeId) =>
    request(`/api/results/official/${encodeURIComponent(categoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ nomineeId }),
    }),

  compareUsers: (left, right) =>
    request(`/api/results/compare/users?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`),

  compareWithOfficial: (username) =>
    request(`/api/results/compare/official/${encodeURIComponent(username)}`),
};
