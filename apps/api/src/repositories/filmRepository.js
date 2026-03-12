// data/repositories/filmRepository.js — Film state CRUD
const { dbClient } = require('../../config/db');
const { resolveEdition } = require('../services/editionService');

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

module.exports = { getFilmState, updateFilmState, getUserFilmsMap };
