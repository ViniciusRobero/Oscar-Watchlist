const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getRefreshToken, storeRefreshToken, revokeRefreshToken } = require('../repositories/tokenRepository');

const JWT_SECRET = process.env.JWT_SECRET || 'oscar-watchlist-dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'oscar-watchlist-refresh-dev-secret';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d'; // used by jwt.sign, string format

// Return tokens and store refresh in DB
async function generateTokensAsync(user) {
    const payload = {
        id: user.id || user.username,
        username: user.username,
        nick: user.nick || user.username,
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

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days approximation
    const tokenId = `${user.username}_${Date.now()}`;

    await storeRefreshToken(tokenId, user.username, hash, expiresAt);

    return { accessToken, refreshToken };
}

function verifyAccess(token) {
    try {
        return jwt.verify(token, JWT_SECRET, { issuer: 'oscar-watchlist' });
    } catch {
        return null;
    }
}

async function verifyRefreshAsync(token) {
    try {
        const payload = jwt.verify(token, JWT_REFRESH_SECRET, { issuer: 'oscar-watchlist' });
        if (payload.type !== 'refresh') return null;

        const hash = crypto.createHash('sha256').update(token).digest('hex');
        const dbToken = await getRefreshToken(hash);
        if (!dbToken || dbToken.revoked) return null;

        return payload;
    } catch {
        return null;
    }
}

async function revokeRefreshTokenAsync(token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await revokeRefreshToken(hash);
}

function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}

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

function optionalAuth(req, _res, next) {
    const token = extractToken(req);
    if (token) {
        const payload = verifyAccess(token);
        if (payload) req.user = payload;
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }
    next();
}

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

function requireSameNickOrAdmin(req, res, next) {
    const paramNick = req.params.nick;
    if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado.' });
    }
    if (req.user.nick !== paramNick && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Você não pode alterar dados de outro usuário.' });
    }
    next();
}

// Temporary synchronous fallback for tests that manually construct tokens
function generateTokens(user) {
    const payload = {
        id: user.id || user.username,
        username: user.username,
        nick: user.nick || user.username,
        role: user.role || 'user',
    };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY, issuer: 'oscar-watchlist' });
    const refreshPayload = { ...payload, type: 'refresh' };
    const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY, issuer: 'oscar-watchlist' });
    return { accessToken, refreshToken };
}

module.exports = {
    generateTokensAsync,
    generateTokens,
    verifyAccess,
    verifyRefreshAsync,
    revokeRefreshTokenAsync,
    authenticate,
    optionalAuth,
    requireAdmin,
    requireSameUserOrAdmin,
    requireSameNickOrAdmin,
    JWT_SECRET,
};
