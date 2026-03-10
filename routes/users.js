const express = require('express');
const { updateFilmState, buildBootstrapAsync, getUser } = require('../data/db');
const { authenticate, requireSameUserOrAdmin } = require('../middleware/auth');

const router = express.Router();

// List all users or fetch bootstrap (legacy fallback, now mostly /api/bootstrap)
router.get('/', async (req, res) => {
  try {
    const username = String(req.query.active || '').trim();
    const edition = req.query.edition || '';
    const data = await buildBootstrapAsync(username, edition);
    res.json(data);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Update film state for a user (protected)
router.patch('/:username/films/:filmId', authenticate, requireSameUserOrAdmin, async (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    const filmId = String(req.params.filmId || '').trim();
    const edition = req.query.edition || req.body?.edition || '';

    const user = await getUser(username);
    if (!user) return res.status(400).json({ error: 'Usuário inválido.' });

    const updates = {};
    if (typeof req.body.watched === 'boolean') updates.watched = req.body.watched;

    if (req.body.personalRating !== undefined) {
      const r = req.body.personalRating === null || req.body.personalRating === '' ? null : Number(req.body.personalRating);
      updates.personalRating = r !== null && Number.isFinite(r) && r >= 0 && r <= 10 ? r : null;
    }

    if (req.body.personalNotes !== undefined) {
      updates.personalNotes = String(req.body.personalNotes).slice(0, 600);
    }

    const fs = await updateFilmState(username, filmId, edition, updates);
    res.json({ ok: true, filmState: fs });
  } catch (err) {
    console.error('Update film error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;
