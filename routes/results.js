const express = require('express');
const { loadCategories } = require('../data/services/editionService');
const { getOfficialResults, updateOfficialResult } = require('../data/repositories/resultRepository');
const { getUser } = require('../data/repositories/userRepository');
const { getPredictionsMap } = require('../data/repositories/predictionRepository');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function resolveFilmId(cats, categoryId, nomineeId) {
  if (!nomineeId) return null;
  const cat = cats.find((c) => c.id === categoryId);
  if (!cat) return null;
  const nominee = cat.nominees?.find((n) => n.id === nomineeId);
  return nominee?.filmId || null;
}

// Set official winner for a category (ADMIN ONLY)
router.patch('/official/:categoryId', authenticate, requireAdmin, async (req, res) => {
  try {
    const categoryId = String(req.params.categoryId || '').trim();
    const edition = req.query.edition || req.body?.edition || '';
    const nomineeId = req.body?.nomineeId
      ? String(req.body.nomineeId)
      : req.body?.filmId
        ? String(req.body.filmId)
        : null;

    await updateOfficialResult(categoryId, edition, nomineeId);
    const officialResults = await getOfficialResults(edition);
    res.json({ ok: true, officialResults });
  } catch (err) {
    console.error('Official result error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Compare two users' predictions
router.get('/compare/users', async (req, res) => {
  try {
    const leftName = String(req.query.left || '').trim();
    const rightName = String(req.query.right || '').trim();
    const edition = req.query.edition || '';

    const cats = loadCategories(edition);
    const leftUser = await getUser(leftName);
    const rightUser = await getUser(rightName);

    if (!leftUser || !rightUser) return res.status(404).json({ error: 'Um ou mais usuários não encontrados.' });

    const leftPredictions = await getPredictionsMap(leftUser.id, edition);
    const rightPredictions = await getPredictionsMap(rightUser.id, edition);

    const matches = [];
    const diffs = [];
    let compared = 0;

    for (const cat of cats) {
      const lNomineeId = leftPredictions[cat.id] || null;
      const rNomineeId = rightPredictions[cat.id] || null;
      const lFilmId = resolveFilmId(cats, cat.id, lNomineeId);
      const rFilmId = resolveFilmId(cats, cat.id, rNomineeId);

      // Fix for BUG-006: only count as comparable if both have voted
      if (lNomineeId && rNomineeId) compared++;

      if (lNomineeId && rNomineeId && lNomineeId === rNomineeId) {
        matches.push({
          categoryId: cat.id,
          categoryName: cat.name,
          nomineeId: lNomineeId,
          filmId: lFilmId,
          leftFilmId: lFilmId,
          rightFilmId: rFilmId,
        });
      } else {
        diffs.push({
          categoryId: cat.id,
          categoryName: cat.name,
          leftNomineeId: lNomineeId,
          rightNomineeId: rNomineeId,
          leftFilmId: lFilmId,
          rightFilmId: rFilmId,
        });
      }
    }

    res.json({
      totalCategories: cats.length,
      comparedCategories: compared,
      matchesCount: matches.length,
      matches,
      diffs,
    });
  } catch (err) {
    console.error('Compare users error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Compare user predictions vs official results
router.get('/compare/official/:username', async (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    const edition = req.query.edition || '';

    const cats = loadCategories(edition);
    const user = await getUser(username);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const predictions = await getPredictionsMap(user.id, edition);
    const officialResults = await getOfficialResults(edition);

    let correct = 0;
    let comparable = 0;

    const results = cats.map((cat) => {
      const predictedNomineeId = predictions[cat.id] || null;
      const officialNomineeId = officialResults[cat.id] || null;
      const predictedFilmId = resolveFilmId(cats, cat.id, predictedNomineeId);
      const officialFilmId = resolveFilmId(cats, cat.id, officialNomineeId);
      const isCorrect = !!predictedNomineeId && !!officialNomineeId && predictedNomineeId === officialNomineeId;

      if (officialNomineeId) comparable++;
      if (isCorrect) correct++;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        predictedNomineeId,
        officialNomineeId,
        predictedFilmId,
        officialFilmId,
        isCorrect,
        highlight: cat.highlight || false,
      };
    });

    res.json({
      totalCategories: cats.length,
      comparableCategories: comparable,
      correctCount: correct,
      results,
    });
  } catch (err) {
    console.error('Compare official error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;
