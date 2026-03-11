const express = require('express');
const { getUser, createUser, hashPassword, verifyPassword, buildBootstrapAsync } = require('../data/db');
const { generateTokensAsync, verifyRefreshAsync, revokeRefreshTokenAsync } = require('../middleware/auth');

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

// ── Brute force lockout (in-memory, per username) ────────────────────────────
const failedAttempts = new Map(); // username -> { count, lockedUntil }

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkBruteForce(username) {
  const rec = failedAttempts.get(username);
  if (!rec) return null;
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    const remaining = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
    return `Conta bloqueada temporariamente. Tente novamente em ${remaining} minuto(s).`;
  }
  return null;
}

function recordFailedAttempt(username) {
  const rec = failedAttempts.get(username) || { count: 0, lockedUntil: null };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
    rec.count = 0; // reset counter, lockout is active
  }
  failedAttempts.set(username, rec);
}

function clearFailedAttempts(username) {
  failedAttempts.delete(username);
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();
    const edition = req.query.edition || req.body?.edition || '';

    if (!username) return res.status(400).json({ error: 'Nome de usuário é obrigatório.' });
    if (!password) return res.status(400).json({ error: 'Senha é obrigatória.' });

    // Brute force check
    const lockMsg = checkBruteForce(username);
    if (lockMsg) return res.status(429).json({ error: lockMsg });

    const existingUser = await getUser(username);

    if (existingUser) {
      if (existingUser.passwordHash) {
        const valid = verifyPassword(password, existingUser.passwordHash);
        if (!valid) {
          recordFailedAttempt(username);
          return res.status(401).json({ error: 'Senha incorreta.' });
        }
      } else {
        return res.status(401).json({ error: 'Sua conta precisa ser migrada.' });
      }
    } else {
      return res.status(404).json({ error: 'Usuário não encontrado. Use o registro para criar uma conta.' });
    }

    clearFailedAttempts(username);

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
    // Read from HttpOnly cookie first, fallback to body for backwards compat
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
    res.json({ ok: true }); // even on error, clear the cookie
  }
});

router.get('/users', async (req, res) => {
  try {
    const { summarizeUsers } = require('../data/db');
    const edition = req.query.edition || '';
    const summaries = await summarizeUsers(edition);
    const usernames = summaries.map(s => s.username);
    res.json({ usernames });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
