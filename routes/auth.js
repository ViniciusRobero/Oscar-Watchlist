const express = require('express');
const { getUser, getUserByNick, getUserByEmail, createUser } = require('../data/repositories/userRepository');
const { hashPassword, verifyPassword } = require('../data/auth');
const { buildBootstrapAsync, summarizeUsers } = require('../data/services/bootstrapService');
const { generateTokensAsync, verifyRefreshAsync, revokeRefreshTokenAsync } = require('../middleware/auth');
const { checkLockout, recordFail, clearLockout } = require('../lib/bruteForce');
const { sendWelcomeEmail } = require('../data/services/emailService');

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
    // Accept both 'nick' and legacy 'username' for backward compatibility
    const nick = String(req.body.nick || req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const edition = req.query.edition || req.body?.edition || '';

    if (!nick) return res.status(400).json({ error: 'Nick é obrigatório.' });
    if (!password) return res.status(400).json({ error: 'Senha é obrigatória.' });

    // Brute force check
    const lockMsg = checkLockout(nick);
    if (lockMsg) return res.status(429).json({ error: lockMsg });

    const existingUser = await getUserByNick(nick);

    if (!existingUser) {
      recordFail(nick);
      return res.status(404).json({ error: 'Nick não encontrado. Verifique ou crie uma conta.' });
    }

    if (!existingUser.isActive) {
      return res.status(403).json({ error: 'Esta conta foi desativada. Entre em contato com o administrador.' });
    }

    if (existingUser.passwordHash) {
      const valid = verifyPassword(password, existingUser.passwordHash);
      if (!valid) {
        recordFail(nick);
        return res.status(401).json({ error: 'Senha incorreta.' });
      }
    } else {
      return res.status(401).json({ error: 'Sua conta precisa ser migrada.' });
    }

    clearLockout(nick);

    const { accessToken, refreshToken } = await generateTokensAsync(existingUser);
    const bootstrapData = await buildBootstrapAsync(existingUser.username, edition);

    res.cookie(COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTS);
    res.json({ accessToken, ...bootstrapData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const nick = String(req.body.nick || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const birthDate = req.body.birthDate ? String(req.body.birthDate).trim() : null;
    const edition = req.query.edition || req.body?.edition || '';

    // Validations
    if (!nick || nick.length < 3 || nick.length > 20) {
      return res.status(400).json({ error: 'Nick deve ter entre 3 e 20 caracteres.' });
    }
    if (!/^[a-z0-9_.]+$/.test(nick)) {
      return res.status(400).json({ error: 'Nick pode conter apenas letras minúsculas, números, ponto e underscore.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }
    if (!firstName || firstName.length < 1 || firstName.length > 60) {
      return res.status(400).json({ error: 'Nome é obrigatório (máx. 60 caracteres).' });
    }
    if (!lastName || lastName.length < 1 || lastName.length > 60) {
      return res.status(400).json({ error: 'Sobrenome é obrigatório (máx. 60 caracteres).' });
    }
    if (!password || password.length < 6 || password.length > 100) {
      return res.status(400).json({ error: 'Senha inválida (mín. 6 caracteres).' });
    }

    // Uniqueness checks
    const existingByNick = await getUserByNick(nick);
    if (existingByNick) {
      return res.status(409).json({ error: 'Esse nick já está em uso.' });
    }
    const existingByEmail = await getUserByEmail(email);
    if (existingByEmail) {
      return res.status(409).json({ error: 'Esse email já está cadastrado.' });
    }

    const ph = hashPassword(password);
    // username = nick (display name)
    const newUser = await createUser(nick, ph, 'user', { nick, email, firstName, lastName, birthDate });

    const { accessToken, refreshToken } = await generateTokensAsync(newUser);
    const bootstrapData = await buildBootstrapAsync(newUser.username, edition);

    // Send welcome email in background — do not block response
    sendWelcomeEmail(email, { nick, firstName }).catch(() => {});

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

    // Reload user to get latest nick
    const user = await getUser(payload.username);
    const tokens = await generateTokensAsync(user || {
      id: payload.id,
      username: payload.username,
      nick: payload.nick || payload.username,
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
    // Public list: only non-private, active users (no personal data exposed)
    const summaries = await summarizeUsers(edition, { publicOnly: true });
    const usernames = summaries.map(s => s.username);
    res.json({ usernames });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
