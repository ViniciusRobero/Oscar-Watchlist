const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname);
const FILMS_PATH = path.join(DATA_DIR, 'films.json');
const CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json');
const STATE_PATH = path.join(DATA_DIR, 'state.json');

const SCHEMA_VERSION = 2;

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

function loadFilms() {
  return readJson(FILMS_PATH, []);
}

function loadCategories() {
  return readJson(CATEGORIES_PATH, []);
}

function loadState() {
  const defaults = { schemaVersion: SCHEMA_VERSION, users: {}, officialResults: {} };
  const state = readJson(STATE_PATH, defaults);
  // Migrate v1 -> v2: ensure schemaVersion exists
  if (!state.schemaVersion) {
    state.schemaVersion = SCHEMA_VERSION;
  }
  if (!state.officialResults) state.officialResults = {};
  if (!state.users) state.users = {};
  return state;
}

function saveState(state) {
  state.schemaVersion = SCHEMA_VERSION;
  writeJson(STATE_PATH, state);
}

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
    // Set password on legacy accounts
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

function buildBootstrap(username) {
  const films = loadFilms();
  const categories = loadCategories();
  const state = loadState();
  const user = ensureUser(state, username || '');
  if (user) saveState(state);
  return {
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
  loadFilms,
  loadCategories,
  loadState,
  saveState,
  ensureUser,
  normalizeFilmState,
  summarizeUsers,
  buildBootstrap,
  hashPassword,
  verifyPassword,
};
