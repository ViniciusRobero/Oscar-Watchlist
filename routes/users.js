const express = require('express');
const { loadState, saveState, ensureUser, buildBootstrap } = require('../data/db');

const router = express.Router();

// Login / create user
router.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const edition = req.query.edition || req.body?.edition || '';
  if (!username) return res.status(400).json({ error: 'Nome de usuário é obrigatório.' });
  if (username.length > 40) return res.status(400).json({ error: 'Nome de usuário muito longo.' });
  const state = loadState(edition);
  ensureUser(state, username);
  saveState(state, edition);
  res.json(buildBootstrap(username, edition));
});

// List all users (for bootstrap)
router.get('/', (req, res) => {
  const username = String(req.query.active || '').trim();
  const edition = req.query.edition || '';
  res.json(buildBootstrap(username, edition));
});

// Update film state for a user
router.patch('/:username/films/:filmId', (req, res) => {
  const username = String(req.params.username || '').trim();
  const filmId = String(req.params.filmId || '').trim();
  const edition = req.query.edition || req.body?.edition || '';
  const state = loadState(edition);
  const user = ensureUser(state, username);
  if (!user) return res.status(400).json({ error: 'Usuário inválido.' });

  if (!user.films[filmId]) {
    user.films[filmId] = { watched: false, personalRating: null, personalNotes: '' };
  }
  const fs = user.films[filmId];
  const { watched, personalRating, personalNotes } = req.body || {};
  if (typeof watched === 'boolean') fs.watched = watched;
  if (personalRating !== undefined) {
    const r = personalRating === null || personalRating === '' ? null : Number(personalRating);
    fs.personalRating = r !== null && Number.isFinite(r) && r >= 0 && r <= 10 ? r : null;
  }
  if (personalNotes !== undefined) fs.personalNotes = String(personalNotes).slice(0, 600);

  saveState(state, edition);
  res.json({ ok: true, filmState: fs });
});

module.exports = router;
