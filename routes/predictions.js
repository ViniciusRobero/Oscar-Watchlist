const express = require('express');
const { loadState, saveState, ensureUser } = require('../data/db');

const router = express.Router();

// Save a prediction for a category
// body: { nomineeId } — unique nominee ID (may differ from filmId for perf. categories)
router.patch('/:username/:categoryId', (req, res) => {
  const username = String(req.params.username || '').trim();
  const categoryId = String(req.params.categoryId || '').trim();
  // Support nomineeId (new) and filmId (legacy)
  const nomineeId = req.body?.nomineeId
    ? String(req.body.nomineeId)
    : req.body?.filmId
    ? String(req.body.filmId)
    : '';
  const state = loadState();
  const user = ensureUser(state, username);
  if (!user) return res.status(400).json({ error: 'Usuário inválido.' });
  user.predictions[categoryId] = nomineeId || '';
  saveState(state);
  res.json({ ok: true, predictions: user.predictions });
});

module.exports = router;
