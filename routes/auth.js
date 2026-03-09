const express = require('express');
const { loadState, saveState, ensureUser, buildBootstrap, hashPassword, verifyPassword } = require('../data/db');
const { generateTokens, verifyRefresh, revokeRefreshToken } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/login ─────────────────────────────────────────────────────
// Body: { username, password }
// Returns: { accessToken, refreshToken, user: bootstrapData }
router.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();
  const edition = req.query.edition || req.body?.edition || '';

  if (!username) return res.status(400).json({ error: 'Nome de usuário é obrigatório.' });
  if (username.length > 40) return res.status(400).json({ error: 'Nome de usuário muito longo (máx. 40 caracteres).' });
  if (!password) return res.status(400).json({ error: 'Senha é obrigatória.' });
  if (password.length < 3) return res.status(400).json({ error: 'Senha muito curta (mín. 3 caracteres).' });
  if (password.length > 100) return res.status(400).json({ error: 'Senha muito longa.' });

  const state = loadState(edition);
  const existingUser = state.users[username];

  if (existingUser) {
    // User exists — verify password
    if (existingUser.passwordHash) {
      const valid = verifyPassword(password, existingUser.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Senha incorreta.' });
    } else {
      // Legacy user without password — set it now
      existingUser.passwordHash = hashPassword(password);
      saveState(state, edition);
    }
  } else {
    // New user — not allowed via login (use register)
    return res.status(404).json({ error: 'Usuário não encontrado. Use o registro para criar uma conta.' });
  }

  const role = existingUser.role || 'user';
  const { accessToken, refreshToken } = generateTokens({ username, role });
  const bootstrapData = buildBootstrap(username, edition);

  res.json({
    accessToken,
    refreshToken,
    ...bootstrapData,
  });
});

// ── POST /api/auth/register ──────────────────────────────────────────────────
// Body: { username, password }
// Creates a new user account
router.post('/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();
  const edition = req.query.edition || req.body?.edition || '';

  if (!username) return res.status(400).json({ error: 'Nome de usuário é obrigatório.' });
  if (username.length > 40) return res.status(400).json({ error: 'Nome de usuário muito longo (máx. 40 caracteres).' });
  if (username.length < 2) return res.status(400).json({ error: 'Nome de usuário muito curto (mín. 2 caracteres).' });
  if (!/^[a-zA-Z0-9À-ÿ_ -]+$/.test(username)) return res.status(400).json({ error: 'Nome de usuário contém caracteres inválidos.' });
  if (!password) return res.status(400).json({ error: 'Senha é obrigatória.' });
  if (password.length < 6) return res.status(400).json({ error: 'Senha muito curta (mín. 6 caracteres).' });
  if (password.length > 100) return res.status(400).json({ error: 'Senha muito longa.' });

  const state = loadState(edition);

  // Check if user already exists
  if (state.users[username]) {
    return res.status(409).json({ error: 'Esse nome de usuário já existe.' });
  }

  const ph = hashPassword(password);
  ensureUser(state, username, ph);
  saveState(state, edition);

  const { accessToken, refreshToken } = generateTokens({ username, role: 'user' });
  const bootstrapData = buildBootstrap(username, edition);

  res.status(201).json({
    accessToken,
    refreshToken,
    ...bootstrapData,
  });
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
// Body: { refreshToken }
// Returns: { accessToken, refreshToken } (rotated)
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token é obrigatório.' });
  }

  const payload = verifyRefresh(refreshToken);
  if (!payload) {
    return res.status(401).json({ error: 'Refresh token inválido ou expirado.' });
  }

  // Revoke old refresh token (rotation)
  revokeRefreshToken(refreshToken);

  // Issue new pair
  const tokens = generateTokens({
    username: payload.username,
    role: payload.role,
  });

  res.json(tokens);
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
// Body: { refreshToken }
// Revokes the refresh token
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }
  res.json({ ok: true });
});

// ── GET /api/auth/users ──────────────────────────────────────────────────────
// List usernames (no passwords) for public display
router.get('/users', (req, res) => {
  const edition = req.query.edition || '';
  const state = loadState(edition);
  const usernames = Object.keys(state.users).sort((a, b) => a.localeCompare(b));
  res.json({ usernames });
});

module.exports = router;
