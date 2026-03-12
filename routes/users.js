const express = require('express');
const { getUser, updateUserSettings } = require('../data/repositories/userRepository');
const { updateFilmState } = require('../data/repositories/filmRepository');
const { hashPassword, verifyPassword } = require('../data/auth');
const { buildBootstrapAsync } = require('../data/services/bootstrapService');
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

// ── User self-service settings ─────────────────────────────────────────────
// Allows users to change their own password and toggle privacy.
router.patch('/:username/settings', authenticate, requireSameUserOrAdmin, async (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    const user = await getUser(username);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const changes = {};

    // Privacy toggle
    if (req.body.isPrivate !== undefined) {
      changes.isPrivate = Boolean(req.body.isPrivate);
    }

    // Password change: requires current password (unless requester is admin)
    if (req.body.newPassword !== undefined) {
      const newPw = String(req.body.newPassword || '');
      if (newPw.length < 6 || newPw.length > 100) {
        return res.status(400).json({ error: 'Nova senha inválida (mín. 6 caracteres).' });
      }

      // Non-admins must provide current password
      if (req.user.role !== 'admin') {
        const currentPw = String(req.body.currentPassword || '');
        if (!currentPw) return res.status(400).json({ error: 'Senha atual é obrigatória.' });
        if (!verifyPassword(currentPw, user.passwordHash)) {
          return res.status(401).json({ error: 'Senha atual incorreta.' });
        }
      }

      changes.newPasswordHash = hashPassword(newPw);
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'Nenhuma alteração enviada.' });
    }

    await updateUserSettings(username, changes);
    res.json({ ok: true });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;
