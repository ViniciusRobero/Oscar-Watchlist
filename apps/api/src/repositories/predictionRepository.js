// data/repositories/predictionRepository.js — User predictions CRUD
const { dbClient } = require('../../config/db');
const { resolveEdition } = require('../services/editionService');

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

module.exports = { getPredictionsMap, updatePrediction };
