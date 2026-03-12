const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.TURSO_URL = `file:${path.join(process.cwd(), 'data', 'test_auth.db')}`;
const app = require('../server');
const { dbClient } = require('../src/config/db');
const { migrateSchema, hashPassword, verifyPassword } = require('../src/auth');
const { createUser, getUser, getUserByNick, setUserActive, updateUserSettings } = require('../src/repositories/userRepository');
const { summarizeUsers } = require('../src/services/bootstrapService');

const TEST_EDITION = '__test_auth__';
const TEST_DIR = path.join(process.cwd(), 'data', 'editions', TEST_EDITION);

beforeAll(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'films.json'), '[]');
    fs.writeFileSync(path.join(TEST_DIR, 'categories.json'), '[]');

    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'data', 'schema.sql'), 'utf8');
    await dbClient.executeMultiple(schemaSql);
    await migrateSchema();

    await dbClient.executeMultiple(`
    DELETE FROM user_logs;
    DELETE FROM user_predictions;
    DELETE FROM user_film_states;
    DELETE FROM refresh_tokens;
    DELETE FROM official_results;
    DELETE FROM users;
  `);
});

afterAll(async () => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    try { fs.unlinkSync(path.join(process.cwd(), 'data', 'test_auth.db')); } catch (e) { }
});

describe('Auth API Endpoints', () => {
    let accessToken = '';
    let refreshCookie = '';

    test('POST /api/auth/register - Cria novo usuário com perfil completo', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                nick: 'testuser',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
                edition: TEST_EDITION,
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeUndefined();
        expect(res.body.profile).toBeDefined();
        expect(res.body.awards).toBeDefined();

        accessToken = res.body.accessToken;
        const setCookie = res.headers['set-cookie'] || [];
        refreshCookie = setCookie.find(c => c.startsWith('oscar_refresh=')) || '';
        expect(refreshCookie).toBeTruthy();

        // Verify user is created as private with nick
        const user = await getUserByNick('testuser');
        expect(user).not.toBeNull();
        expect(user.isPrivate).toBe(true);
        expect(user.isActive).toBe(true);
        expect(user.nick).toBe('testuser');
        expect(user.email).toBe('test@example.com');
    });

    test('POST /api/auth/register - Rejeita nick duplicado', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                nick: 'testuser',
                password: 'password123',
                firstName: 'Another',
                lastName: 'User',
                email: 'other@example.com',
                edition: TEST_EDITION,
            });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toMatch(/nick já está em uso/i);
    });

    test('POST /api/auth/register - Rejeita email duplicado', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                nick: 'differentnick',
                password: 'password123',
                firstName: 'Another',
                lastName: 'User',
                email: 'test@example.com', // same email
                edition: TEST_EDITION,
            });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toMatch(/email já está cadastrado/i);
    });

    test('POST /api/auth/register - Rejeita campos obrigatórios faltando', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ nick: 'x', password: 'pass', edition: TEST_EDITION });

        expect(res.statusCode).toBe(400);
    });

    test('POST /api/auth/login - Loga usuário pelo nick', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ nick: 'testuser', password: 'password123', edition: TEST_EDITION });

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
            .send({ nick: 'testuser', password: 'wrongpassword', edition: TEST_EDITION });

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/incorreta/i);
    });

    test('POST /api/auth/login - Rejeita conta inativa', async () => {
        await createUser('inactiveuser', hashPassword('pass123'), 'user', {
            nick: 'inactiveuser', email: 'inactive@example.com', firstName: 'Inactive', lastName: 'User',
        });
        await setUserActive('inactiveuser', false);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ nick: 'inactiveuser', password: 'pass123', edition: TEST_EDITION });

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toMatch(/desativada/i);
    });

    test('POST /api/auth/login - Bloqueia após 5 tentativas falhas', async () => {
        const bruteNick = 'brutetest';
        await request(app).post('/api/auth/register')
            .send({ nick: bruteNick, password: 'correctpass', firstName: 'Brute', lastName: 'Test', email: 'brute@example.com', edition: TEST_EDITION });

        for (let i = 0; i < 5; i++) {
            await request(app).post('/api/auth/login')
                .send({ nick: bruteNick, password: 'wrongpass', edition: TEST_EDITION });
        }

        const res = await request(app).post('/api/auth/login')
            .send({ nick: bruteNick, password: 'correctpass', edition: TEST_EDITION });

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
            .send({ nick: 'testuser', password: 'password123', edition: TEST_EDITION });

        const setCookie = loginRes.headers['set-cookie'] || [];
        const freshCookie = setCookie.find(c => c.startsWith('oscar_refresh=')) || '';
        const tokenValue = freshCookie.split(';')[0].replace('oscar_refresh=', '');
        refreshCookie = freshCookie;

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
        await createUser('toggleuser', hashPassword('pass'), 'user', {
            nick: 'toggleuser', email: 'toggle@example.com', firstName: 'Toggle', lastName: 'User',
        });

        await setUserActive('toggleuser', false);
        const inactive = await getUser('toggleuser');
        expect(inactive.isActive).toBe(false);

        await setUserActive('toggleuser', true);
        const active = await getUser('toggleuser');
        expect(active.isActive).toBe(true);
    });

    test('updateUserSettings altera privacidade', async () => {
        await createUser('privuser', hashPassword('pass'), 'user', {
            nick: 'privuser', email: 'priv@example.com', firstName: 'Priv', lastName: 'User',
        });

        await updateUserSettings('privuser', { isPrivate: false });
        const pub = await getUser('privuser');
        expect(pub.isPrivate).toBe(false);

        await updateUserSettings('privuser', { isPrivate: true });
        const priv = await getUser('privuser');
        expect(priv.isPrivate).toBe(true);
    });

    test('getUserByNick encontra usuário pelo nick', async () => {
        await createUser('nicktest', hashPassword('pass'), 'user', {
            nick: 'nicktestuser', email: 'nicktest@example.com', firstName: 'Nick', lastName: 'Test',
        });
        const user = await getUserByNick('nicktestuser');
        expect(user).not.toBeNull();
        expect(user.username).toBe('nicktest');
        expect(user.nick).toBe('nicktestuser');
    });

    test('summarizeUsers com publicOnly exclui privados', async () => {
        await createUser('pubuser', hashPassword('pass'), 'user', {
            nick: 'pubuser', email: 'pub@example.com', firstName: 'Pub', lastName: 'User',
        });
        await updateUserSettings('pubuser', { isPrivate: false });

        const summaries = await summarizeUsers(TEST_EDITION, { publicOnly: true });
        expect(summaries.some(s => s.username === 'pubuser')).toBe(true);
        expect(summaries.some(s => s.username === 'testuser')).toBe(false);
    });
});
