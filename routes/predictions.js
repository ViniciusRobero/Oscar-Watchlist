const express = require('express');
const { updatePrediction, getPredictionsMap } = require('../data/db');
const { authenticate, requireSameUserOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Save a prediction for a category (protected)
// body: { nomineeId } — unique nominee ID (may differ from filmId for perf. categories)
router.patch('/:username/:categoryId', authenticate, requireSameUserOrAdmin, async (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    const categoryId = String(req.params.categoryId || '').trim();
    const edition = req.query.edition || req.body?.edition || '';

    // Support nomineeId (new) and filmId (legacy)
    const nomineeId = req.body?.nomineeId
      ? String(req.body.nomineeId)
      : req.body?.filmId
        ? String(req.body.filmId)
        : null;

    if (!username) return res.status(400).json({ error: 'Usuário inválido.' });

    await updatePrediction(username, categoryId, edition, nomineeId);

    // Return the updated predictions map
    const predictions = await getPredictionsMap(username, edition);
    res.json({ ok: true, predictions });
  } catch (err) {
    console.error('Save prediction error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;
