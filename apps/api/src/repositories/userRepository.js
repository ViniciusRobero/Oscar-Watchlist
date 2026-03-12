// data/repositories/userRepository.js — User CRUD operations
const { dbClient } = require('../config/db');

function rowToUser(row) {
  return {
    id: row.id,
    username: row.username,
    nick: row.nick || null,
    email: row.email || null,
    firstName: row.first_name || null,
    lastName: row.last_name || null,
    birthDate: row.birth_date || null,
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

async function getUserByNick(nick) {
  const rs = await dbClient.execute({
    sql: "SELECT * FROM users WHERE nick = ?",
    args: [String(nick).trim().toLowerCase()]
  });
  if (rs.rows.length === 0) return null;
  return rowToUser(rs.rows[0]);
}

async function getUserByEmail(email) {
  const rs = await dbClient.execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [String(email).trim().toLowerCase()]
  });
  if (rs.rows.length === 0) return null;
  return rowToUser(rs.rows[0]);
}

async function createUser(username, passwordHash, role = 'user', profile = {}) {
  const uname = String(username).trim();
  const { nick = null, email = null, firstName = null, lastName = null, birthDate = null } = profile;
  const nickVal = nick ? String(nick).trim().toLowerCase() : uname.toLowerCase();
  // id = username for backward compat (legacy pattern)
  await dbClient.execute({
    sql: `INSERT INTO users
          (id, username, nick, password_hash, role, is_active, is_private, email, first_name, last_name, birth_date)
          VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)`,
    args: [uname, uname, nickVal, passwordHash, role, email, firstName, lastName, birthDate]
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
    "SELECT id, username, nick, email, first_name, last_name, birth_date, role, is_active, is_private, created_at FROM users ORDER BY username"
  );
  return rs.rows.map(rowToUser);
}

async function setUserActive(username, isActive) {
  await dbClient.execute({
    sql: "UPDATE users SET is_active = ? WHERE username = ?",
    args: [isActive ? 1 : 0, String(username).trim()]
  });
}

async function deleteUser(userId) {
  const id = String(userId).trim();
  // Use parameterized queries to prevent SQL injection
  await dbClient.execute({ sql: "DELETE FROM refresh_tokens WHERE user_id = ?", args: [id] });
  await dbClient.execute({ sql: "DELETE FROM user_film_states WHERE user_id = ?", args: [id] });
  await dbClient.execute({ sql: "DELETE FROM user_predictions WHERE user_id = ?", args: [id] });
  await dbClient.execute({ sql: "DELETE FROM user_logs WHERE user_id = ?", args: [id] });
  await dbClient.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] });
}

async function updateUserSettings(username, patch = {}) {
  const uname = String(username).trim();
  const { isPrivate, newPasswordHash, firstName, lastName, birthDate, email, nick } = patch;

  const sets = [];
  const args = [];

  if (isPrivate !== undefined) { sets.push("is_private = ?"); args.push(isPrivate ? 1 : 0); }
  if (newPasswordHash !== undefined) { sets.push("password_hash = ?"); args.push(newPasswordHash); }
  if (firstName !== undefined) { sets.push("first_name = ?"); args.push(firstName); }
  if (lastName !== undefined) { sets.push("last_name = ?"); args.push(lastName); }
  if (birthDate !== undefined) { sets.push("birth_date = ?"); args.push(birthDate); }
  if (email !== undefined) { sets.push("email = ?"); args.push(email); }
  if (nick !== undefined) { sets.push("nick = ?"); args.push(nick ? String(nick).toLowerCase() : null); }

  if (sets.length === 0) return;
  args.push(uname);
  await dbClient.execute({
    sql: `UPDATE users SET ${sets.join(', ')} WHERE username = ?`,
    args
  });
}

module.exports = {
  rowToUser,
  getUser,
  getUserByNick,
  getUserByEmail,
  createUser,
  ensureUserAsync,
  listAllUsers,
  setUserActive,
  deleteUser,
  updateUserSettings,
};
