// data/repositories/tokenRepository.js — Refresh token management
const { dbClient } = require('../config/db');

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

module.exports = { getRefreshToken, storeRefreshToken, revokeRefreshToken };
