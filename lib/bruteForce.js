// ── Brute-force lockout (in-memory, per username) ────────────────────────────
// Tracks failed login attempts and enforces a temporary lockout.

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/** @type {Map<string, {count: number, lockedUntil: number|null}>} */
const failedAttempts = new Map();

/**
 * Returns an error message string if the user is locked out, or null if not.
 */
function checkLockout(username) {
  const rec = failedAttempts.get(username);
  if (!rec) return null;
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    const remaining = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
    return `Conta bloqueada temporariamente. Tente novamente em ${remaining} minuto(s).`;
  }
  return null;
}

/**
 * Records a failed login attempt. Activates lockout after MAX_ATTEMPTS.
 */
function recordFail(username) {
  const rec = failedAttempts.get(username) || { count: 0, lockedUntil: null };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
    rec.count = 0;
  }
  failedAttempts.set(username, rec);
}

/**
 * Clears the lockout / fail count for a username (on successful login or admin unblock).
 */
function clearLockout(username) {
  failedAttempts.delete(username);
}

/**
 * Returns true if the username is currently locked out.
 */
function isLocked(username) {
  const rec = failedAttempts.get(username);
  if (!rec) return false;
  return rec.lockedUntil != null && Date.now() < rec.lockedUntil;
}

/**
 * Lists all currently locked usernames (useful for admin panel).
 */
function listLocked() {
  const locked = [];
  for (const [username, rec] of failedAttempts.entries()) {
    if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
      locked.push({ username, lockedUntil: new Date(rec.lockedUntil).toISOString() });
    }
  }
  return locked;
}

// Periodic cleanup: remove expired lockout entries every 30 minutes to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [username, rec] of failedAttempts.entries()) {
    if (!rec.lockedUntil || rec.lockedUntil < now) {
      failedAttempts.delete(username);
    }
  }
}, 30 * 60 * 1000).unref(); // .unref() so this timer doesn't keep the process alive

module.exports = { checkLockout, recordFail, clearLockout, isLocked, listLocked };
