// data/repositories/userRepository.js — User CRUD operations
const { dbClient } = require('../../config/db');

function rowToUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    isActive: row.is_active !== 0,
    isPrivate: row.is_private !== 0,
    createdAt: row.created_at,
  };
}

async function getUser(username) {
  const rs = await dbClient.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [String(username).trim()]
  });
  if (rs.rows.length === 0) return null;
  return rowToUser(rs.rows[0]);
}

async function createUser(username, passwordHash, role = 'user') {
  const id = String(username).trim();
  const uname = String(username).trim();
  await dbClient.execute({
    sql: "INSERT INTO users (id, username, password_hash, role, is_active, is_private) VALUES (?, ?, ?, ?, 1, 1)",
    args: [id, uname, passwordHash, role]
  });
  return await getUser(uname);
}

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

async function listAllUsers() {
  const rs = await dbClient.execute(
    "SELECT id, username, role, is_active, is_private, created_at FROM users ORDER BY username"
  );
  return rs.rows.map(row => ({
    id: row.id,
    username: row.username,
    role: row.role,
    isActive: row.is_active !== 0,
    isPrivate: row.is_private !== 0,
    createdAt: row.created_at,
  }));
}

async function setUserActive(username, isActive) {
  await dbClient.execute({
    sql: "UPDATE users SET is_active = ? WHERE username = ?",
    args: [isActive ? 1 : 0, String(username).trim()]
  });
}

async function deleteUser(username) {
  const uname = String(username).trim();
  await dbClient.executeMultiple(`
    DELETE FROM refresh_tokens WHERE user_id = '${uname}';
    DELETE FROM user_film_states WHERE user_id = '${uname}';
    DELETE FROM user_predictions WHERE user_id = '${uname}';
    DELETE FROM users WHERE id = '${uname}';
  `);
}

async function updateUserSettings(username, { isPrivate, newPasswordHash } = {}) {
  const uname = String(username).trim();
  if (isPrivate !== undefined) {
    await dbClient.execute({
      sql: "UPDATE users SET is_private = ? WHERE username = ?",
      args: [isPrivate ? 1 : 0, uname]
    });
  }
  if (newPasswordHash !== undefined) {
    await dbClient.execute({
      sql: "UPDATE users SET password_hash = ? WHERE username = ?",
      args: [newPasswordHash, uname]
    });
  }
}

module.exports = {
  rowToUser,
  getUser,
  createUser,
  ensureUserAsync,
  listAllUsers,
  setUserActive,
  deleteUser,
  updateUserSettings,
};
