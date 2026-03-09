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
// Access token is kept in memory (NOT localStorage) for security.
// Refresh token goes to localStorage (survives refreshes).
let _accessToken = null;

export function getAccessToken() { return _accessToken; }
export function isAuthenticated() { return !!_accessToken; }

export function setTokens(accessToken, refreshToken) {
  _accessToken = accessToken || null;
  if (refreshToken) {
    localStorage.setItem('oscar_refresh_token', refreshToken);
  }
}

export function clearTokens() {
  _accessToken = null;
  localStorage.removeItem('oscar_refresh_token');
  localStorage.removeItem('oscar_active_user');
}

function getRefreshToken() {
  return localStorage.getItem('oscar_refresh_token');
}

// ── HTTP request helper with auto-JWT and auto-refresh ───────────────────────
let _refreshPromise = null; // prevents concurrent refresh requests

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  // Attach JWT if available
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  let res = await fetch(appendEdition(url), { ...options, headers });

  // If 401 and we have a refresh token, try to refresh
  if (res.status === 401 && getRefreshToken() && !options._isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry the original request with new token
      headers['Authorization'] = `Bearer ${_accessToken}`;
      res = await fetch(appendEdition(url), { ...options, headers, _isRetry: true });
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  // Prevent concurrent refresh requests
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
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

  // Login — returns { accessToken, refreshToken, ...bootstrapData }
  login: async (username, password) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.accessToken) {
      setTokens(data.accessToken, data.refreshToken);
    }
    return data;
  },

  // Register — returns { accessToken, refreshToken, ...bootstrapData }
  register: async (username, password) => {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.accessToken) {
      setTokens(data.accessToken, data.refreshToken);
    }
    return data;
  },

  // Logout — revokes refresh token on server
  logout: async () => {
    const refreshToken = getRefreshToken();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch { /* ignore */ }
    clearTokens();
  },

  // Restore session from refresh token (called on app mount)
  restoreSession: async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    const ok = await tryRefresh();
    return ok;
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
