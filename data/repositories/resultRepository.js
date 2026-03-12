// data/repositories/resultRepository.js — Official results CRUD
const { dbClient } = require('../../config/db');
const { resolveEdition } = require('../services/editionService');

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

module.exports = { getOfficialResults, updateOfficialResult };
