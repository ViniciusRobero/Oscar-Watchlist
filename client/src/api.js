// ── Edition state ────────────────────────────────────────────────────────────
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

// ── JWT Token Management ─────────────────────────────────────────────────────
// Access token: in-memory only (NOT localStorage) — secure against XSS.
// Refresh token: HttpOnly cookie managed by the server — never readable by JS.
let _accessToken = null;

export function getAccessToken() { return _accessToken; }
export function isAuthenticated() { return !!_accessToken; }

export function setTokens(accessToken) {
  _accessToken = accessToken || null;
}

export function clearTokens() {
  _accessToken = null;
  localStorage.removeItem('oscar_active_user');
}

// ── HTTP request helper with auto-JWT and auto-refresh ───────────────────────
let _refreshPromise = null; // prevents concurrent refresh requests

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  // credentials: 'include' sends the HttpOnly refresh cookie automatically
  let res = await fetch(appendEdition(url), { ...options, headers, credentials: 'include' });

  // If 401 and not already retrying, try to refresh via cookie
  if (res.status === 401 && !options._isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${_accessToken}`;
      res = await fetch(appendEdition(url), { ...options, headers, credentials: 'include', _isRetry: true });
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function tryRefresh() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      // The browser sends the HttpOnly cookie automatically via credentials: 'include'
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = await res.json();
      setTokens(data.accessToken);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ── API Methods ──────────────────────────────────────────────────────────────
export const api = {
  bootstrap: (username = '') =>
    request(`/api/bootstrap?username=${encodeURIComponent(username)}`),

  editions: () => request('/api/editions'),

  awards: () => request('/api/awards'),

  // Login — returns { accessToken, ...bootstrapData }
  login: async (username, password) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.accessToken) {
      setTokens(data.accessToken);
    }
    return data;
  },

  // Register — returns { accessToken, ...bootstrapData }
  register: async (username, password) => {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.accessToken) {
      setTokens(data.accessToken);
    }
    return data;
  },

  // Logout — clears cookie on server
  logout: async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch { /* ignore */ }
    clearTokens();
  },

  // Restore session from HttpOnly cookie (called on app mount)
  restoreSession: async () => {
    return await tryRefresh();
  },

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
