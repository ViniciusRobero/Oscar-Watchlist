// data/auth.js — Password hashing and schema migrations
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { dbClient } = require('./config/db');
const { getUser } = require('./repositories/userRepository');

const BCRYPT_ROUNDS = 12;

function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, stored) {
  try {
    if (!stored) return false;
    // Legacy PBKDF2 format: "hexsalt:hexhash" (no $ prefix)
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

// Idempotent schema migrations — adds new columns to existing DBs
async function migrateSchema() {
  const migrations = [
    // Existing columns (kept for DBs created before schema.sql was updated)
    "ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE users ADD COLUMN is_private INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE users ADD COLUMN email TEXT",
    // New profile columns
    "ALTER TABLE users ADD COLUMN first_name TEXT",
    "ALTER TABLE users ADD COLUMN last_name TEXT",
    "ALTER TABLE users ADD COLUMN nick TEXT",
    "ALTER TABLE users ADD COLUMN birth_date TEXT",
    // Unique index for nick (ALTER ADD COLUMN UNIQUE not supported in SQLite)
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nick ON users(nick)",
    // Activity log table
    `CREATE TABLE IF NOT EXISTS user_logs (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      action_type TEXT NOT NULL,
      entity_id   TEXT,
      entity_type TEXT,
      metadata    TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  ];
  for (const sql of migrations) {
    try {
      await dbClient.execute(sql);
    } catch (e) {
      if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
        console.warn('Migration warning:', e.message);
      }
    }
  }
  // Backfill nick for existing users that have none
  try {
    await dbClient.execute("UPDATE users SET nick = username WHERE nick IS NULL");
  } catch (e) {
    console.warn('Migration backfill warning:', e.message);
  }
}

async function ensureDefaultAdmin() {
  const existing = await getUser('admin');
  if (!existing) {
    const ph = hashPassword('admin');
    await dbClient.execute({
      sql: "INSERT OR IGNORE INTO users (id, username, nick, password_hash, role, is_active, is_private) VALUES (?, ?, ?, ?, ?, 1, 0)",
      args: ['admin', 'admin', 'admin', ph, 'admin']
    });
    console.log('  👤  Usuário admin criado (senha: admin) — troque a senha após o primeiro login.');
  } else {
    if (existing.role !== 'admin') {
      await dbClient.execute({ sql: "UPDATE users SET role = 'admin' WHERE id = 'admin'", args: [] });
    }
    // Ensure admin has a nick (backfill for existing installs)
    if (!existing.nick) {
      await dbClient.execute({ sql: "UPDATE users SET nick = 'admin' WHERE id = 'admin'", args: [] });
    }
  }
}

module.exports = { BCRYPT_ROUNDS, hashPassword, verifyPassword, migrateSchema, ensureDefaultAdmin };
