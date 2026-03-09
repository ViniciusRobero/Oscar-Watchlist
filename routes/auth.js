const express = require('express');
const { loadState, saveState, ensureUser, buildBootstrap, hashPassword, verifyPassword } = require('../data/db');

const router = express.Router();

// POST /api/auth/login
// Body: { username, password }
// Creates user on first login; verifies password on subsequent logins
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
    // New user — create with password
    const ph = hashPassword(password);
    ensureUser(state, username, ph);
    saveState(state, edition);
  }

  res.json(buildBootstrap(username, edition));
});

// POST /api/auth/register (alias for login — same endpoint handles both)
router.post('/register', (req, res) => {
  // Redirect to login logic
  req.url = '/login';
  router.handle(req, res);
});

// GET /api/auth/users — list usernames (no passwords) for login hints
router.get('/users', (req, res) => {
  const edition = req.query.edition || '';
  const state = loadState(edition);
  const usernames = Object.keys(state.users).sort((a, b) => a.localeCompare(b));
  res.json({ usernames });
});

module.exports = router;
