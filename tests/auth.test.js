const fs = require('fs');
const path = require('path');
const request = require('supertest');

// Redirect DB to a test file before requiring the app
process.env.TURSO_URL = `file:${path.join(__dirname, '..', 'data', 'test_auth.db')}`;
const app = require('../server');
const db = require('../data/db');

const TEST_EDITION = '__test_auth__';
const TEST_DIR = path.join(__dirname, '..', 'data', 'editions', TEST_EDITION);

beforeAll(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'films.json'), '[]');
    fs.writeFileSync(path.join(TEST_DIR, 'categories.json'), '[]');

    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'data', 'schema.sql'), 'utf8');
    await db.dbClient.executeMultiple(schemaSql);

    await db.dbClient.executeMultiple(`
    DELETE FROM user_predictions;
    DELETE FROM user_film_states;
    DELETE FROM refresh_tokens;
    DELETE FROM official_results;
    DELETE FROM users;
  `);
});

afterAll(async () => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    try { fs.unlinkSync(path.join(__dirname, '..', 'data', 'test_auth.db')); } catch (e) { }
});

describe('Auth API Endpoints', () => {
    let accessToken = '';
    let refreshCookie = '';

    test('POST /api/auth/register - Cria novo usuário', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'testuser', password: 'password123', edition: TEST_EDITION });

        expect(res.statusCode).toBe(201);
        expect(res.body.accessToken).toBeDefined();
        // Refresh token must NOT be in the body anymore — only in HttpOnly cookie
        expect(res.body.refreshToken).toBeUndefined();
        expect(res.body.profile).toBeDefined();
        expect(res.body.awards).toBeDefined();

        accessToken = res.body.accessToken;
        // Capture Set-Cookie header
        const setCookie = res.headers['set-cookie'] || [];
        refreshCookie = setCookie.find(c => c.startsWith('oscar_refresh=')) || '';
        expect(refreshCookie).toBeTruthy();
    });

    test('POST /api/auth/register - Rejeita usuário duplicado', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'testuser', password: 'password123', edition: TEST_EDITION });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toMatch(/já existe/i);
    });

    test('POST /api/auth/login - Loga usuário existente', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'password123', edition: TEST_EDITION });

        expect(res.statusCode).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeUndefined(); // must not be in body
        expect(res.body.profile).toBeDefined();

        accessToken = res.body.accessToken;
        const setCookie = res.headers['set-cookie'] || [];
        refreshCookie = setCookie.find(c => c.startsWith('oscar_refresh=')) || '';
        expect(refreshCookie).toBeTruthy();
    });

    test('POST /api/auth/login - Rejeita senha errada', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'wrongpassword', edition: TEST_EDITION });

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/incorreta/i);
    });

    test('POST /api/auth/login - Bloqueia após 5 tentativas falhas', async () => {
        const bruteUser = 'brutetest';
        // Register the user first
        await request(app).post('/api/auth/register')
            .send({ username: bruteUser, password: 'correctpass', edition: TEST_EDITION });

        // 5 failed attempts
        for (let i = 0; i < 5; i++) {
            await request(app).post('/api/auth/login')
                .send({ username: bruteUser, password: 'wrongpass', edition: TEST_EDITION });
        }

        // 6th attempt should be blocked (429)
        const res = await request(app).post('/api/auth/login')
            .send({ username: bruteUser, password: 'correctpass', edition: TEST_EDITION });

        expect(res.statusCode).toBe(429);
        expect(res.body.error).toMatch(/bloqueada/i);
    });

    test('POST /api/auth/refresh - Rotaciona tokens via cookie', async () => {
        const cookieValue = refreshCookie.split(';')[0]; // "oscar_refresh=<token>"
        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', cookieValue);

        expect(res.statusCode).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeUndefined(); // new refresh goes to cookie
        const setCookie = res.headers['set-cookie'] || [];
        const newRefreshCookie = setCookie.find(c => c.startsWith('oscar_refresh=')) || '';
        expect(newRefreshCookie).toBeTruthy();
        expect(newRefreshCookie).not.toBe(refreshCookie); // must be rotated
    });

    test('POST /api/auth/refresh - Fallback via body (backwards compat)', async () => {
        // Log in fresh to get a new refresh token via cookie, then extract value for body test
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'password123', edition: TEST_EDITION });

        const setCookie = loginRes.headers['set-cookie'] || [];
        const freshCookie = setCookie.find(c => c.startsWith('oscar_refresh=')) || '';
        const tokenValue = freshCookie.split(';')[0].replace('oscar_refresh=', '');

        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: tokenValue });

        expect(res.statusCode).toBe(200);
        expect(res.body.accessToken).toBeDefined();
    });

    test('POST /api/auth/logout - Limpa cookie', async () => {
        const res = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', refreshCookie.split(';')[0]);

        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
        const setCookie = res.headers['set-cookie'] || [];
        // Should clear the cookie (max-age=0 or expires in past)
        const cleared = setCookie.find(c => c.startsWith('oscar_refresh='));
        expect(cleared).toBeTruthy();
    });

    test('POST /api/auth/refresh - Rejeita token revogado', async () => {
        const cookieValue = refreshCookie.split(';')[0];
        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', cookieValue);

        expect(res.statusCode).toBe(401);
    });

    test('GET /api/auth/users - Lista usernames', async () => {
        const res = await request(app).get(`/api/auth/users?edition=${TEST_EDITION}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.usernames)).toBe(true);
        expect(res.body.usernames).toContain('testuser');
    });
});

describe('Auth: Senhas bcrypt', () => {
    test('hashPassword retorna formato bcrypt ($2b$)', () => {
        const hash = db.hashPassword('minhasenha');
        expect(hash.startsWith('$2b$')).toBe(true);
    });

    test('verifyPassword valida senha bcrypt corretamente', () => {
        const hash = db.hashPassword('minhasenha');
        expect(db.verifyPassword('minhasenha', hash)).toBe(true);
        expect(db.verifyPassword('senhaerrada', hash)).toBe(false);
    });

    test('verifyPassword ainda aceita hash PBKDF2 legado', () => {
        // Simulate a legacy PBKDF2 hash
        const crypto = require('crypto');
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync('senhaantiga', salt, 100000, 64, 'sha512').toString('hex');
        const stored = `${salt}:${hash}`;
        expect(db.verifyPassword('senhaantiga', stored)).toBe(true);
        expect(db.verifyPassword('errada', stored)).toBe(false);
    });
});
