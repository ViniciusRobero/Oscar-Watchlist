const express = require('express');
const { getUser, createUser } = require('../data/repositories/userRepository');
const { hashPassword, verifyPassword } = require('../data/auth');
const { buildBootstrapAsync, summarizeUsers } = require('../data/services/bootstrapService');
const { generateTokensAsync, verifyRefreshAsync, revokeRefreshTokenAsync } = require('../middleware/auth');
const { checkLockout, recordFail, clearLockout } = require('../lib/bruteForce');

const router = express.Router();

// ── Cookie config ────────────────────────────────────────────────────────────
const COOKIE_NAME = 'oscar_refresh';
const IS_PROD = process.env.NODE_ENV === 'production';

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'Strict' : 'Lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/auth',
};

// ── Routes ───────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();
    const edition = req.query.edition || req.body?.edition || '';

    if (!username) return res.status(400).json({ error: 'Nome de usuário é obrigatório.' });
    if (!password) return res.status(400).json({ error: 'Senha é obrigatória.' });

    // Brute force check
    const lockMsg = checkLockout(username);
    if (lockMsg) return res.status(429).json({ error: lockMsg });

    const existingUser = await getUser(username);

    if (!existingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado. Use o registro para criar uma conta.' });
    }

    // Inactive account check
    if (!existingUser.isActive) {
      return res.status(403).json({ error: 'Esta conta foi desativada. Entre em contato com o administrador.' });
    }

    if (existingUser.passwordHash) {
      const valid = verifyPassword(password, existingUser.passwordHash);
      if (!valid) {
        recordFail(username);
        return res.status(401).json({ error: 'Senha incorreta.' });
      }
    } else {
      return res.status(401).json({ error: 'Sua conta precisa ser migrada.' });
    }

    clearLockout(username);

    const { accessToken, refreshToken } = await generateTokensAsync(existingUser);
    const bootstrapData = await buildBootstrapAsync(username, edition);

    res.cookie(COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTS);
    res.json({ accessToken, ...bootstrapData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();
    const edition = req.query.edition || req.body?.edition || '';

    if (!username || username.length < 2 || username.length > 40) {
      return res.status(400).json({ error: 'Nome de usuário inválido.' });
    }
    if (!/^[a-zA-Z0-9À-ÿ_ -]+$/.test(username)) {
      return res.status(400).json({ error: 'Nome de usuário contém caracteres inválidos.' });
    }
    if (!password || password.length < 6 || password.length > 100) {
      return res.status(400).json({ error: 'Senha inválida (mín. 6 caracteres).' });
    }

    const existingUser = await getUser(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Esse nome de usuário já existe.' });
    }

    const ph = hashPassword(password);
    const newUser = await createUser(username, ph, 'user');

    const { accessToken, refreshToken } = await generateTokensAsync(newUser);
    const bootstrapData = await buildBootstrapAsync(username, edition);

    res.cookie(COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTS);
    res.status(201).json({ accessToken, ...bootstrapData });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token é obrigatório.' });
    }

    const payload = await verifyRefreshAsync(refreshToken);
    if (!payload) {
      res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
      return res.status(401).json({ error: 'Refresh token inválido ou expirado.' });
    }

    await revokeRefreshTokenAsync(refreshToken);

    const tokens = await generateTokensAsync({
      username: payload.username,
      role: payload.role,
    });

    res.cookie(COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTS);
    res.json({ accessToken: tokens.accessToken });
  } catch (e) {
    console.error('Refresh error:', e);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    if (refreshToken) {
      await revokeRefreshTokenAsync(refreshToken);
    }
    res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Logout error:', e);
    res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
    res.json({ ok: true });
  }
});

router.get('/users', async (req, res) => {
  try {
    const edition = req.query.edition || '';
    // Public list: only non-private, active users
    const summaries = await summarizeUsers(edition, { publicOnly: true });
    const usernames = summaries.map(s => s.username);
    res.json({ usernames });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
