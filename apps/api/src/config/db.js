// config/db.js — Turso/SQLite database client initialization
require('dotenv').config();
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_URL || 'file:data/local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const dbClient = createClient({ url, authToken });

module.exports = { dbClient };
