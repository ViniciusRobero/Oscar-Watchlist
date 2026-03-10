const express = require('express');
const { getUser, createUser, hashPassword, verifyPassword, buildBootstrapAsync } = require('../data/db');
const { generateTokensAsync, verifyRefreshAsync, revokeRefreshTokenAsync } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();
    const edition = req.query.edition || req.body?.edition || '';

    if (!username) return res.status(400).json({ error: 'Nome de usuário é obrigatório.' });
    if (!password) return res.status(400).json({ error: 'Senha é obrigatória.' });

    const existingUser = await getUser(username);

    if (existingUser) {
      if (existingUser.passwordHash) {
        const valid = verifyPassword(password, existingUser.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Senha incorreta.' });
      } else {
        return res.status(401).json({ error: 'Sua conta precisa ser migrada.' });
      }
    } else {
      return res.status(404).json({ error: 'Usuário não encontrado. Use o registro para criar uma conta.' });
    }

    const { accessToken, refreshToken } = await generateTokensAsync(existingUser);
    const bootstrapData = await buildBootstrapAsync(username, edition);

    res.json({
      accessToken,
      refreshToken,
      ...bootstrapData,
    });
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

    res.status(201).json({
      accessToken,
      refreshToken,
      ...bootstrapData,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token é obrigatório.' });
    }

    const payload = await verifyRefreshAsync(refreshToken);
    if (!payload) {
      return res.status(401).json({ error: 'Refresh token inválido ou expirado.' });
    }

    await revokeRefreshTokenAsync(refreshToken);

    const tokens = await generateTokensAsync({
      username: payload.username,
      role: payload.role,
    });

    res.json(tokens);
  } catch (e) {
    console.error('Refresh error:', e);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      await revokeRefreshTokenAsync(refreshToken);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Logout error:', e);
    res.status(500).json({ ok: true }); // even on error, we don't block user
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
