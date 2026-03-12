const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { listAllUsers, setUserActive, deleteUser } = require('../data/repositories/userRepository');
const { summarizeUsers } = require('../data/services/bootstrapService');
const { resolveEdition } = require('../data/services/editionService');
const { clearLockout, listLocked } = require('../lib/bruteForce');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── List all users (with stats) ───────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const edition = req.query.edition || '';
    // Get base user list with active/private info
    const allUsers = await listAllUsers();
    // Get stats (no filter — admin sees everyone)
    const summaries = await summarizeUsers(edition, { publicOnly: false });

    // Merge stats into user list
    const result = allUsers.map(u => {
      const stats = summaries.find(s => s.username === u.username) || {};
      return {
        ...u,
        watchedCount: stats.watchedCount ?? 0,
        predictionsCount: stats.predictionsCount ?? 0,
        averageRating: stats.averageRating ?? null,
      };
    });

    // Also include which users are currently brute-force locked
    const locked = listLocked();
    const lockedSet = new Set(locked.map(l => l.username));

    res.json({
      users: result.map(u => ({ ...u, isLocked: lockedSet.has(u.username) })),
      locked,
    });
  } catch (e) {
    console.error('Admin list users error:', e);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── Activate / deactivate user ────────────────────────────────────────────────
router.patch('/users/:username/status', async (req, res) => {
  try {
    const target = String(req.params.username || '').trim();
    const { isActive } = req.body;

    if (target === req.user.username) {
      return res.status(400).json({ error: 'Você não pode desativar sua própria conta.' });
    }
    if (target === 'admin') {
      return res.status(400).json({ error: 'A conta admin não pode ser desativada.' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Campo isActive é obrigatório (boolean).' });
    }

    await setUserActive(target, isActive);
    res.json({ ok: true, username: target, isActive });
  } catch (e) {
    console.error('Admin set active error:', e);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── Delete user ───────────────────────────────────────────────────────────────
router.delete('/users/:username', async (req, res) => {
  try {
    const target = String(req.params.username || '').trim();

    if (target === req.user.username) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
    }
    if (target === 'admin') {
      return res.status(400).json({ error: 'A conta admin não pode ser excluída.' });
    }

    await deleteUser(target);
    clearLockout(target); // clear any brute-force state
    res.json({ ok: true, username: target });
  } catch (e) {
    console.error('Admin delete user error:', e);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── Unblock brute-force lockout ───────────────────────────────────────────────
router.post('/users/:username/unblock', (req, res) => {
  try {
    const target = String(req.params.username || '').trim();
    clearLockout(target);
    res.json({ ok: true, username: target });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
