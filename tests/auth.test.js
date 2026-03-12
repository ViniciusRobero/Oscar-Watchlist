const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.TURSO_URL = `file:${path.join(__dirname, '..', 'data', 'test_auth.db')}`;
const app = require('../server');
const { dbClient } = require('../config/db');
const { migrateSchema, hashPassword, verifyPassword } = require('../data/auth');
const { createUser, getUser, setUserActive, updateUserSettings } = require('../data/repositories/userRepository');
const { summarizeUsers } = require('../data/services/bootstrapService');

const TEST_EDITION = '__test_auth__';
const TEST_DIR = path.join(__dirname, '..', 'data', 'editions', TEST_EDITION);

beforeAll(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'films.json'), '[]');
    fs.writeFileSync(path.join(TEST_DIR, 'categories.json'), '[]');

    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'data', 'schema.sql'), 'utf8');
    await dbClient.executeMultiple(schemaSql);
    await migrateSchema();

    await dbClient.executeMultiple(`
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

    test('POST /api/auth/register - Cria novo usuário (privado por padrão)', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'testuser', password: 'password123', edition: TEST_EDITION });

        expect(res.statusCode).toBe(201);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeUndefined();
        expect(res.body.profile).toBeDefined();
        expect(res.body.awards).toBeDefined();

        accessToken = res.body.accessToken;
        const setCookie = res.headers['set-cookie'] || [];
        refreshCookie = setCookie.find(c => c.startsWith('oscar_refresh=')) || '';
        expect(refreshCookie).toBeTruthy();

        // Verify user is created as private
        const user = await getUser('testuser');
        expect(user.isPrivate).toBe(true);
        expect(user.isActive).toBe(true);
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
        expect(res.body.refreshToken).toBeUndefined();
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

    test('POST /api/auth/login - Rejeita conta inativa', async () => {
        await createUser('inactiveuser', hashPassword('pass123'), 'user');
        await setUserActive('inactiveuser', false);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'inactiveuser', password: 'pass123', edition: TEST_EDITION });

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toMatch(/desativada/i);
    });

    test('POST /api/auth/login - Bloqueia após 5 tentativas falhas', async () => {
        const bruteUser = 'brutetest';
        await request(app).post('/api/auth/register')
            .send({ username: bruteUser, password: 'correctpass', edition: TEST_EDITION });

        for (let i = 0; i < 5; i++) {
            await request(app).post('/api/auth/login')
                .send({ username: bruteUser, password: 'wrongpass', edition: TEST_EDITION });
        }

        const res = await request(app).post('/api/auth/login')
            .send({ username: bruteUser, password: 'correctpass', edition: TEST_EDITION });

        expect(res.statusCode).toBe(429);
        expect(res.body.error).toMatch(/bloqueada/i);
    });

    test('POST /api/auth/refresh - Rotaciona tokens via cookie', async () => {
        const cookieValue = refreshCookie.split(';')[0];
        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', cookieValue);

        expect(res.statusCode).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeUndefined();
        const setCookie = res.headers['set-cookie'] || [];
        const newRefreshCookie = setCookie.find(c => c.startsWith('oscar_refresh=')) || '';
        expect(newRefreshCookie).toBeTruthy();
    });

    test('POST /api/auth/refresh - Fallback via body', async () => {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'password123', edition: TEST_EDITION });

        const setCookie = loginRes.headers['set-cookie'] || [];
        const freshCookie = setCookie.find(c => c.startsWith('oscar_refresh=')) || '';
        const tokenValue = freshCookie.split(';')[0].replace('oscar_refresh=', '');
        refreshCookie = freshCookie; // save for subsequent tests

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
    });

    test('GET /api/auth/users - Lista apenas usuários públicos e ativos', async () => {
        // testuser is private by default — should NOT appear
        const res = await request(app).get(`/api/auth/users?edition=${TEST_EDITION}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.usernames)).toBe(true);
        expect(res.body.usernames).not.toContain('testuser'); // private
        expect(res.body.usernames).not.toContain('inactiveuser'); // inactive
    });
});

describe('Auth: Senhas bcrypt', () => {
    test('hashPassword retorna formato bcrypt ($2b$)', () => {
        const hash = hashPassword('minhasenha');
        expect(hash.startsWith('$2b$')).toBe(true);
    });

    test('verifyPassword valida senha bcrypt corretamente', () => {
        const hash = hashPassword('minhasenha');
        expect(verifyPassword('minhasenha', hash)).toBe(true);
        expect(verifyPassword('senhaerrada', hash)).toBe(false);
    });

    test('verifyPassword ainda aceita hash PBKDF2 legado', () => {
        const crypto = require('crypto');
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync('senhaantiga', salt, 100000, 64, 'sha512').toString('hex');
        const stored = `${salt}:${hash}`;
        expect(verifyPassword('senhaantiga', stored)).toBe(true);
        expect(verifyPassword('errada', stored)).toBe(false);
    });
});

describe('User settings', () => {
    test('setUserActive desativa e reativa conta', async () => {
        await createUser('toggleuser', hashPassword('pass'), 'user');

        await setUserActive('toggleuser', false);
        const inactive = await getUser('toggleuser');
        expect(inactive.isActive).toBe(false);

        await setUserActive('toggleuser', true);
        const active = await getUser('toggleuser');
        expect(active.isActive).toBe(true);
    });

    test('updateUserSettings altera privacidade', async () => {
        await createUser('privuser', hashPassword('pass'), 'user');

        await updateUserSettings('privuser', { isPrivate: false });
        const pub = await getUser('privuser');
        expect(pub.isPrivate).toBe(false);

        await updateUserSettings('privuser', { isPrivate: true });
        const priv = await getUser('privuser');
        expect(priv.isPrivate).toBe(true);
    });

    test('summarizeUsers com publicOnly exclui privados', async () => {
        await createUser('pubuser', hashPassword('pass'), 'user');
        await updateUserSettings('pubuser', { isPrivate: false });

        const summaries = await summarizeUsers(TEST_EDITION, { publicOnly: true });
        expect(summaries.some(s => s.username === 'pubuser')).toBe(true);
        expect(summaries.some(s => s.username === 'testuser')).toBe(false);
    });
});
