/**
 * JWT Authentication & Authorization Middleware
 *
 * Exports:
 *   authenticate   — Requires a valid JWT. Populates req.user.
 *   optionalAuth   — Populates req.user if a valid token is present, but doesn't block.
 *   requireAdmin   — Must be used AFTER authenticate. Requires role === 'admin'.
 *   generateTokens — Creates { accessToken, refreshToken } for a user.
 *   verifyRefresh   — Verifies a refresh token string; returns payload or null.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ── Secrets ──────────────────────────────────────────────────────────────────
// In production, set JWT_SECRET and JWT_REFRESH_SECRET via env vars.
const JWT_SECRET = process.env.JWT_SECRET || 'oscar-watchlist-dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'oscar-watchlist-refresh-dev-secret';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ── In-memory revocation set (replaced by DB in Turso phase) ─────────────────
// Stores SHA-256 hashes of revoked refresh tokens
const revokedTokens = new Set();

// ── Token Generation ─────────────────────────────────────────────────────────

function generateTokens(user) {
    const payload = {
        id: user.id || user.username,
        username: user.username,
        role: user.role || 'user',
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'oscar-watchlist',
    });

    const refreshPayload = { ...payload, type: 'refresh' };
    const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: 'oscar-watchlist',
    });

    return { accessToken, refreshToken };
}

// ── Token Verification ───────────────────────────────────────────────────────

function verifyAccess(token) {
    try {
        return jwt.verify(token, JWT_SECRET, { issuer: 'oscar-watchlist' });
    } catch {
        return null;
    }
}

function verifyRefresh(token) {
    try {
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        if (revokedTokens.has(hash)) return null;
        const payload = jwt.verify(token, JWT_REFRESH_SECRET, { issuer: 'oscar-watchlist' });
        if (payload.type !== 'refresh') return null;
        return payload;
    } catch {
        return null;
    }
}

function revokeRefreshToken(token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    revokedTokens.add(hash);
}

// ── Express Middleware ────────────────────────────────────────────────────────

function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}

/**
 * authenticate — Requires a valid access token.
 * Sets req.user = { id, username, role }.
 */
function authenticate(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    }

    const payload = verifyAccess(token);
    if (!payload) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    req.user = payload;
    next();
}

/**
 * optionalAuth — Populates req.user if a valid token exists, but doesn't block.
 */
function optionalAuth(req, _res, next) {
    const token = extractToken(req);
    if (token) {
        const payload = verifyAccess(token);
        if (payload) req.user = payload;
    }
    next();
}

/**
 * requireAdmin — Must be used AFTER authenticate.
 * Blocks requests from non-admin users.
 */
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }
    next();
}

/**
 * requireSameUserOrAdmin — Blocks requests where the authenticated user
 * doesn't match the :username param (unless admin).
 */
function requireSameUserOrAdmin(req, res, next) {
    const paramUser = req.params.username;
    if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado.' });
    }
    if (req.user.username !== paramUser && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Você não pode alterar dados de outro usuário.' });
    }
    next();
}

module.exports = {
    generateTokens,
    verifyAccess,
    verifyRefresh,
    revokeRefreshToken,
    authenticate,
    optionalAuth,
    requireAdmin,
    requireSameUserOrAdmin,
    JWT_SECRET,
};
