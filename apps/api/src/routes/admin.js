const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { listAllUsers, getUser, getUserByNick, setUserActive, deleteUser, updateUserSettings } = require('../repositories/userRepository');
const { summarizeUsers } = require('../services/bootstrapService');
const { clearLockout, listLocked } = require('../lib/bruteForce');
const { hashPassword } = require('../auth');
const { syncResults, getSyncLog } = require('../services/resultsImporter');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── List all users (with stats) ───────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const rawEdition = req.query.edition;
    const edition = Array.isArray(rawEdition) ? rawEdition[0] : (rawEdition || '');
    const allUsers = await listAllUsers();
    const summaries = await summarizeUsers(edition, { publicOnly: false });

    const result = allUsers.map(u => {
      const stats = summaries.find(s => s.username === u.username) || {};
      return {
        ...u,
        watchedCount: stats.watchedCount ?? 0,
        predictionsCount: stats.predictionsCount ?? 0,
        averageRating: stats.averageRating ?? null,
      };
    });

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

    // Fetch user to get their id (needed for deleteUser)
    const user = await getUser(target);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    await deleteUser(user.id);
    clearLockout(target);
    res.json({ ok: true, username: target });
  } catch (e) {
    console.error('Admin delete user error:', e);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── Force-change user password (by nick) ──────────────────────────────────────
router.patch('/users/:nick/password', async (req, res) => {
  try {
    const nick = String(req.params.nick || '').trim().toLowerCase();
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6 || String(newPassword).length > 100) {
      return res.status(400).json({ error: 'Nova senha inválida (mín. 6 caracteres).' });
    }

    const user = await getUserByNick(nick);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    if (nick === 'admin' && req.user.nick !== 'admin') {
      return res.status(400).json({ error: 'A senha do admin só pode ser alterada pelo próprio admin.' });
    }

    await updateUserSettings(user.username, { newPasswordHash: hashPassword(String(newPassword)) });
    res.json({ ok: true, nick });
  } catch (e) {
    console.error('Admin change password error:', e);
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

// ── Results sync (Wikipedia / Wikidata / NewsAPI) ─────────────────────────────
let _syncInProgress = false;

router.post('/results/sync', async (req, res) => {
  if (_syncInProgress) {
    return res.status(409).json({ error: 'Sincronização já em andamento.' });
  }
  const rawEdition = req.query.edition;
  const edition = Array.isArray(rawEdition) ? rawEdition[0] : (rawEdition || '');

  _syncInProgress = true;
  try {
    const log = await syncResults(edition);
    res.json({ ok: true, log });
  } catch (e) {
    console.error('Results sync error:', e);
    res.status(500).json({ error: e.message || 'Erro interno.' });
  } finally {
    _syncInProgress = false;
  }
});

router.get('/results/sync/status', (_req, res) => {
  res.json({ inProgress: _syncInProgress, log: getSyncLog() });
});

module.exports = router;
