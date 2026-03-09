const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname);
const EDITIONS_DIR = path.join(DATA_DIR, 'editions');
const EDITIONS_PATH = path.join(DATA_DIR, 'editions.json');

// Legacy paths (kept as fallback)
const LEGACY_FILMS_PATH = path.join(DATA_DIR, 'films.json');
const LEGACY_CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json');
const LEGACY_STATE_PATH = path.join(DATA_DIR, 'state.json');

const SCHEMA_VERSION = 2;

// ── Editions ────────────────────────────────────────────────────────────────

function loadEditions() {
  try {
    return JSON.parse(fs.readFileSync(EDITIONS_PATH, 'utf8'));
  } catch {
    return [{ id: '2026', label: 'Oscar 2026', year: 2026, current: true }];
  }
}

function getCurrentEditionId() {
  const editions = loadEditions();
  const current = editions.find(e => e.current);
  return current ? current.id : editions[0]?.id || '2026';
}

function resolveEdition(editionId) {
  return editionId || getCurrentEditionId();
}

function editionDir(editionId) {
  return path.join(EDITIONS_DIR, editionId);
}

// ── Password helpers ────────────────────────────────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return verify === hash;
  } catch {
    return false;
  }
}

// ── JSON helpers ────────────────────────────────────────────────────────────

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

// ── Data loaders (edition-aware) ────────────────────────────────────────────

function loadFilms(editionId) {
  const eid = resolveEdition(editionId);
  const edPath = path.join(editionDir(eid), 'films.json');
  if (fs.existsSync(edPath)) return readJson(edPath, []);
  // Fallback to legacy
  return readJson(LEGACY_FILMS_PATH, []);
}

function loadCategories(editionId) {
  const eid = resolveEdition(editionId);
  const edPath = path.join(editionDir(eid), 'categories.json');
  if (fs.existsSync(edPath)) return readJson(edPath, []);
  return readJson(LEGACY_CATEGORIES_PATH, []);
}

function loadState(editionId) {
  const eid = resolveEdition(editionId);
  const defaults = { schemaVersion: SCHEMA_VERSION, users: {}, officialResults: {} };
  const edPath = path.join(editionDir(eid), 'state.json');
  const state = fs.existsSync(edPath) ? readJson(edPath, defaults) : readJson(LEGACY_STATE_PATH, defaults);
  if (!state.schemaVersion) state.schemaVersion = SCHEMA_VERSION;
  if (!state.officialResults) state.officialResults = {};
  if (!state.users) state.users = {};
  return state;
}

function saveState(state, editionId) {
  const eid = resolveEdition(editionId);
  state.schemaVersion = SCHEMA_VERSION;
  const dir = editionDir(eid);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'state.json'), state);
}

function saveFilms(films, editionId) {
  const eid = resolveEdition(editionId);
  const dir = editionDir(eid);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'films.json'), films);
}

// ── User helpers ────────────────────────────────────────────────────────────

function ensureUser(state, username, passwordHash = null) {
  const key = String(username || '').trim();
  if (!key) return null;
  if (!state.users[key]) {
    state.users[key] = {
      passwordHash,
      films: {},
      predictions: {},
      createdAt: new Date().toISOString(),
    };
  } else if (passwordHash && !state.users[key].passwordHash) {
    state.users[key].passwordHash = passwordHash;
  }
  return state.users[key];
}

function normalizeFilmState(user, filmId) {
  if (!user.films[filmId]) {
    user.films[filmId] = { watched: false, personalRating: null, personalNotes: '' };
  }
  return user.films[filmId];
}

function summarizeUsers(state) {
  return Object.keys(state.users)
    .sort((a, b) => a.localeCompare(b))
    .map((username) => {
      const user = state.users[username] || { films: {}, predictions: {} };
      const filmEntries = Object.values(user.films || {});
      const watchedCount = filmEntries.filter((f) => f && f.watched).length;
      const ratings = filmEntries
        .map((f) => Number(f && f.personalRating))
        .filter((n) => Number.isFinite(n) && n > 0);
      const predictionsCount = Object.values(user.predictions || {}).filter(Boolean).length;
      return {
        username,
        watchedCount,
        predictionsCount,
        ratingsCount: ratings.length,
        averageRating: ratings.length
          ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
          : null,
        createdAt: user.createdAt || null,
      };
    });
}

function buildBootstrap(username, editionId) {
  const eid = resolveEdition(editionId);
  const films = loadFilms(eid);
  const categories = loadCategories(eid);
  const state = loadState(eid);
  const editions = loadEditions();
  const user = ensureUser(state, username || '');
  if (user) saveState(state, eid);
  return {
    edition: eid,
    editions,
    films,
    categories,
    users: Object.keys(state.users).sort((a, b) => a.localeCompare(b)),
    userSummaries: summarizeUsers(state),
    activeUser: username || '',
    profile: user || { films: {}, predictions: {} },
    officialResults: state.officialResults || {},
  };
}

module.exports = {
  loadEditions,
  getCurrentEditionId,
  resolveEdition,
  loadFilms,
  loadCategories,
  loadState,
  saveState,
  saveFilms,
  ensureUser,
  normalizeFilmState,
  summarizeUsers,
  buildBootstrap,
  hashPassword,
  verifyPassword,
};
