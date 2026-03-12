const express = require('express');
const { getUser, getUserByNick, getUserByEmail, updateUserSettings } = require('../repositories/userRepository');
const { updateFilmState } = require('../repositories/filmRepository');
const { getUserTimeline } = require('../repositories/logRepository');
const { hashPassword, verifyPassword } = require('../auth');
const { buildBootstrapAsync } = require('../services/bootstrapService');
const { authenticate, optionalAuth, requireSameUserOrAdmin, requireSameNickOrAdmin } = require('../middleware/auth');

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

// ── User timeline (public for non-private users) ──────────────────────────────
router.get('/:nick/timeline', optionalAuth, async (req, res) => {
  try {
    const nick = String(req.params.nick || '').trim().toLowerCase();
    const user = await getUserByNick(nick);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Private profiles: only the user themselves or admin can see
    const requesterNick = req.user?.nick;
    const requesterRole = req.user?.role;
    if (user.isPrivate && requesterNick !== nick && requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Este perfil é privado.' });
    }

    const timeline = await getUserTimeline(user.id);
    res.json({ nick: user.nick, username: user.username, timeline });
  } catch (err) {
    console.error('Timeline error:', err);
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

    // Log film activity (fire-and-forget)
    const { logAction } = require('../repositories/logRepository');
    if (updates.watched === true) {
      logAction(user.id, 'film_watch', filmId, 'film', { edition }).catch(() => {});
    }
    if (updates.personalRating !== undefined && updates.personalRating !== null) {
      logAction(user.id, 'film_rate', filmId, 'film', { rating: updates.personalRating, edition }).catch(() => {});
    }

    res.json({ ok: true, filmState: fs });
  } catch (err) {
    console.error('Update film error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// ── User self-service settings ─────────────────────────────────────────────
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

    // Profile fields
    if (req.body.firstName !== undefined) {
      const v = String(req.body.firstName || '').trim();
      if (v.length > 60) return res.status(400).json({ error: 'Nome muito longo (máx. 60 caracteres).' });
      changes.firstName = v || null;
    }
    if (req.body.lastName !== undefined) {
      const v = String(req.body.lastName || '').trim();
      if (v.length > 60) return res.status(400).json({ error: 'Sobrenome muito longo (máx. 60 caracteres).' });
      changes.lastName = v || null;
    }
    if (req.body.birthDate !== undefined) {
      changes.birthDate = req.body.birthDate ? String(req.body.birthDate).trim() : null;
    }
    if (req.body.email !== undefined) {
      const newEmail = String(req.body.email || '').trim().toLowerCase();
      if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return res.status(400).json({ error: 'Email inválido.' });
      }
      if (newEmail && newEmail !== user.email) {
        const taken = await getUserByEmail(newEmail);
        if (taken) return res.status(409).json({ error: 'Esse email já está em uso.' });
      }
      changes.email = newEmail || null;
    }

    // Password change: requires current password (unless requester is admin)
    if (req.body.newPassword !== undefined) {
      const newPw = String(req.body.newPassword || '');
      if (newPw.length < 6 || newPw.length > 100) {
        return res.status(400).json({ error: 'Nova senha inválida (mín. 6 caracteres).' });
      }
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
