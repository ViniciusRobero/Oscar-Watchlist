require('dotenv').config();
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

const DATA_DIR = path.join(__dirname);
const EDITIONS_DIR = path.join(DATA_DIR, 'editions');
const EDITIONS_PATH = path.join(DATA_DIR, 'editions.json');
const AWARDS_PATH = path.join(DATA_DIR, 'awards.json');

// Legacy paths (kept as fallback for static config data)
const LEGACY_FILMS_PATH = path.join(DATA_DIR, 'films.json');
const LEGACY_CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json');

// ── Database Client ─────────────────────────────────────────────────────────

const url = process.env.TURSO_URL || 'file:data/local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const dbClient = createClient({ url, authToken });

// ── Editions ────────────────────────────────────────────────────────────────

function loadAwards() {
  try {
    return JSON.parse(fs.readFileSync(AWARDS_PATH, 'utf8'));
  } catch {
    return [{ id: 'oscar', name: 'Oscar', fullName: 'Academy Awards', type: 'cinema', icon: '🏆', active: true }];
  }
}

function loadEditions() {
  try {
    return JSON.parse(fs.readFileSync(EDITIONS_PATH, 'utf8'));
  } catch {
    return [{ id: '2026', award_id: 'oscar', label: 'Oscar 2026', year: 2026, current: true }];
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
// New hashes use bcrypt. Legacy PBKDF2 hashes (salt:hash, 128 hex chars) are
// still verified for backwards compatibility.

function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, stored) {
  try {
    if (!stored) return false;
    // Legacy PBKDF2 format: "hexsalt:hexhash" (both 32+ chars, no $ prefix)
    if (!stored.startsWith('$')) {
      const [salt, hash] = stored.split(':');
      if (!salt || !hash) return false;
      const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      return verify === hash;
    }
    // bcrypt format: "$2b$..."
    return bcrypt.compareSync(password, stored);
  } catch {
    return false;
  }
}

// ── JSON helpers (static config only) ───────────────────────────────────────

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadFilms(editionId) {
  const eid = resolveEdition(editionId);
  const edPath = path.join(editionDir(eid), 'films.json');
  if (fs.existsSync(edPath)) return readJson(edPath, []);
  return readJson(LEGACY_FILMS_PATH, []);
}

function loadCategories(editionId) {
  const eid = resolveEdition(editionId);
  const edPath = path.join(editionDir(eid), 'categories.json');
  if (fs.existsSync(edPath)) return readJson(edPath, []);
  return readJson(LEGACY_CATEGORIES_PATH, []);
}

// ── Turso DB Async Layers ───────────────────────────────────────────────────

async function getUser(username) {
  const rs = await dbClient.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [String(username).trim()]
  });
  if (rs.rows.length === 0) return null;
  const row = rs.rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at
  };
}

async function createUser(username, passwordHash, role = 'user') {
  const id = String(username).trim(); // for simplicity in this project (or UUID)
  const uname = String(username).trim();
  await dbClient.execute({
    sql: "INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
    args: [id, uname, passwordHash, role]
  });
  return await getUser(uname);
}

// Ensure wrapper mimicking old behavior but Async
async function ensureUserAsync(username, passwordHash = null) {
  let user = await getUser(username);
  if (!user) {
    user = await createUser(username, passwordHash);
  } else if (passwordHash && !user.passwordHash) {
    await dbClient.execute({
      sql: "UPDATE users SET password_hash = ? WHERE id = ?",
      args: [passwordHash, user.id]
    });
    user.passwordHash = passwordHash;
  }
  return user;
}

// ── Film States ─────────────────────────────────────────────────────────────

async function getFilmState(userId, filmId, editionId) {
  const eid = resolveEdition(editionId);
  const rs = await dbClient.execute({
    sql: "SELECT * FROM user_film_states WHERE user_id = ? AND film_id = ? AND edition_id = ?",
    args: [userId, filmId, eid]
  });
  if (rs.rows.length === 0) return { watched: false, personalRating: null, personalNotes: '' };
  const row = rs.rows[0];
  return {
    watched: Boolean(row.watched),
    personalRating: row.personal_rating,
    personalNotes: row.personal_notes || ''
  };
}

async function updateFilmState(userId, filmId, editionId, updates) {
  const eid = resolveEdition(editionId);
  const current = await getFilmState(userId, filmId, eid);
  const watched = updates.watched !== undefined ? (updates.watched ? 1 : 0) : (current.watched ? 1 : 0);
  const personalRating = updates.personalRating !== undefined ? updates.personalRating : current.personalRating;
  const personalNotes = updates.personalNotes !== undefined ? updates.personalNotes : current.personalNotes;

  const recId = `${userId}_${filmId}_${eid}`;

  await dbClient.execute({
    sql: `INSERT INTO user_film_states (id, user_id, film_id, edition_id, watched, personal_rating, personal_notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, film_id, edition_id) DO UPDATE SET 
            watched = excluded.watched,
            personal_rating = excluded.personal_rating,
            personal_notes = excluded.personal_notes,
            updated_at = CURRENT_TIMESTAMP`,
    args: [recId, userId, filmId, eid, watched, personalRating, personalNotes]
  });

  return { watched: Boolean(watched), personalRating, personalNotes };
}

async function getUserFilmsMap(userId, editionId) {
  const eid = resolveEdition(editionId);
  const rs = await dbClient.execute({
    sql: "SELECT film_id, watched, personal_rating, personal_notes FROM user_film_states WHERE user_id = ? AND edition_id = ?",
    args: [userId, eid]
  });
  const map = {};
  for (const row of rs.rows) {
    map[row.film_id] = {
      watched: Boolean(row.watched),
      personalRating: row.personal_rating,
      personalNotes: row.personal_notes || ''
    };
  }
  return map;
}

// ── Predictions ─────────────────────────────────────────────────────────────

async function getPredictionsMap(userId, editionId) {
  const eid = resolveEdition(editionId);
  const rs = await dbClient.execute({
    sql: "SELECT category_id, nominee_id FROM user_predictions WHERE user_id = ? AND edition_id = ?",
    args: [userId, eid]
  });
  const map = {};
  for (const row of rs.rows) {
    map[row.category_id] = row.nominee_id;
  }
  return map;
}

async function updatePrediction(userId, categoryId, editionId, nomineeId) {
  const eid = resolveEdition(editionId);
  const recId = `${userId}_${categoryId}_${eid}`;

  if (nomineeId === null || nomineeId === undefined) {
    await dbClient.execute({
      sql: "DELETE FROM user_predictions WHERE user_id = ? AND category_id = ? AND edition_id = ?",
      args: [userId, categoryId, eid]
    });
  } else {
    await dbClient.execute({
      sql: `INSERT INTO user_predictions (id, user_id, category_id, edition_id, nominee_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, category_id, edition_id) DO UPDATE SET 
              nominee_id = excluded.nominee_id,
              updated_at = CURRENT_TIMESTAMP`,
      args: [recId, userId, categoryId, eid, nomineeId]
    });
  }
}

// ── Official Results ────────────────────────────────────────────────────────

async function getOfficialResults(editionId) {
  const eid = resolveEdition(editionId);
  const rs = await dbClient.execute({
    sql: "SELECT category_id, winner_nominee_id FROM official_results WHERE edition_id = ?",
    args: [eid]
  });
  const map = {};
  for (const row of rs.rows) {
    map[row.category_id] = row.winner_nominee_id;
  }
  return map;
}

async function updateOfficialResult(categoryId, editionId, winnerNomineeId) {
  const eid = resolveEdition(editionId);
  const recId = `official_${categoryId}_${eid}`;

  if (winnerNomineeId === null || winnerNomineeId === undefined) {
    await dbClient.execute({
      sql: "DELETE FROM official_results WHERE category_id = ? AND edition_id = ?",
      args: [categoryId, eid]
    });
  } else {
    await dbClient.execute({
      sql: `INSERT INTO official_results (id, category_id, edition_id, winner_nominee_id)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(category_id, edition_id) DO UPDATE SET 
              winner_nominee_id = excluded.winner_nominee_id,
              updated_at = CURRENT_TIMESTAMP`,
      args: [recId, categoryId, eid, winnerNomineeId]
    });
  }
}

// ── Refresh Tokens ──────────────────────────────────────────────────────────

async function getRefreshToken(tokenHash) {
  const rs = await dbClient.execute({
    sql: "SELECT * FROM refresh_tokens WHERE token_hash = ?",
    args: [tokenHash]
  });
  if (rs.rows.length === 0) return null;
  return rs.rows[0];
}

async function storeRefreshToken(id, userId, tokenHash, expiresAt) {
  await dbClient.execute({
    sql: "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    args: [id, userId, tokenHash, expiresAt.toISOString()]
  });
}

async function revokeRefreshToken(tokenHash) {
  await dbClient.execute({
    sql: "UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?",
    args: [tokenHash]
  });
}

// ── Summaries & Bootstrap ──────────────────────────────────────────────────

async function summarizeUsers(editionId) {
  const eid = resolveEdition(editionId);
  const usersRs = await dbClient.execute("SELECT id, username, created_at FROM users");
  const users = usersRs.rows;

  const summaries = [];
  for (const u of users) {
    const films = await getUserFilmsMap(u.id, eid);
    const predictions = await getPredictionsMap(u.id, eid);

    const filmEntries = Object.values(films || {});
    const watchedCount = filmEntries.filter((f) => f && f.watched).length;
    const ratings = filmEntries
      .map((f) => Number(f && f.personalRating))
      .filter((n) => Number.isFinite(n) && n > 0);
    const predictionsCount = Object.keys(predictions || {}).length;

    summaries.push({
      username: u.username,
      watchedCount,
      predictionsCount,
      ratingsCount: ratings.length,
      averageRating: ratings.length
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
        : null,
      createdAt: u.created_at || null,
    });
  }

  return summaries.sort((a, b) => a.username.localeCompare(b.username));
}

async function buildBootstrapAsync(username, editionId) {
  const eid = resolveEdition(editionId);
  const films = loadFilms(eid);
  const categories = loadCategories(eid);
  const editions = loadEditions();
  const awards = loadAwards();

  // Attach award info to each edition
  const editionsWithAward = editions.map(e => ({
    ...e,
    award: awards.find(a => a.id === e.award_id) || null,
  }));

  // Current edition's award
  const currentEdition = editionsWithAward.find(e => e.id === eid);

  let profile = { films: {}, predictions: {} };
  const user = await getUser(username);
  if (user) {
    profile.films = await getUserFilmsMap(user.id, eid);
    profile.predictions = await getPredictionsMap(user.id, eid);
  }

  const summaries = await summarizeUsers(eid);
  const usersList = summaries.map(s => s.username);

  const officialResults = await getOfficialResults(eid);

  return {
    edition: eid,
    editions: editionsWithAward,
    awards,
    currentAward: currentEdition?.award || null,
    films,
    categories,
    users: usersList,
    userSummaries: summaries,
    activeUser: username || '',
    profile,
    officialResults,
  };
}

module.exports = {
  dbClient,
  loadAwards,
  loadEditions,
  getCurrentEditionId,
  resolveEdition,
  loadFilms,
  loadCategories,
  hashPassword,
  verifyPassword,

  // Async Turso Exports
  getUser,
  createUser,
  ensureUserAsync,
  getFilmState,
  updateFilmState,
  getPredictionsMap,
  updatePrediction,
  getOfficialResults,
  updateOfficialResult,
  summarizeUsers,
  buildBootstrapAsync,

  // Async token management
  getRefreshToken,
  storeRefreshToken,
  revokeRefreshToken
};
