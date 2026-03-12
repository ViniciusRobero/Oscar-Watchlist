// data/repositories/logRepository.js — User activity log operations
const { dbClient } = require('../config/db');
const crypto = require('crypto');

async function logAction(userId, actionType, entityId, entityType, metadata = {}) {
  const id = crypto.randomUUID();
  await dbClient.execute({
    sql: `INSERT INTO user_logs (id, user_id, action_type, entity_id, entity_type, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    args: [id, userId, actionType, entityId || null, entityType || null, JSON.stringify(metadata)]
  });
}

async function getUserTimeline(userId, limit = 50) {
  const rs = await dbClient.execute({
    sql: "SELECT * FROM user_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [userId, limit]
  });
  return rs.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    actionType: row.action_type,
    entityId: row.entity_id,
    entityType: row.entity_type,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    createdAt: row.created_at,
  }));
}

module.exports = { logAction, getUserTimeline };
