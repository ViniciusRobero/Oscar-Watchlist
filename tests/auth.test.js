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
    // Create edition folder for films/categories JSONs
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'films.json'), '[]');
    fs.writeFileSync(path.join(TEST_DIR, 'categories.json'), '[]');

    // Initialize DB schema for test DB
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'data', 'schema.sql'), 'utf8');
    await db.dbClient.executeMultiple(schemaSql);

    // Clean tables
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
    // Clean up test DB file
    try {
        fs.unlinkSync(path.join(__dirname, '..', 'data', 'test_auth.db'));
    } catch (e) { }
});

describe('Auth API Endpoints', () => {
    let tokens = { accessToken: '', refreshToken: '' };

    test('POST /api/auth/register - Creates a new user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'testuser', password: 'password123', edition: TEST_EDITION });

        expect(res.statusCode).toBe(201);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
        expect(res.body.profile).toBeDefined();

        tokens = { accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
    });

    test('POST /api/auth/register - Rejects duplicate user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'testuser', password: 'password123', edition: TEST_EDITION });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toMatch(/já existe/i);
    });

    test('POST /api/auth/login - Logs in existing user', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'password123', edition: TEST_EDITION });

        expect(res.statusCode).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
        expect(res.body.profile).toBeDefined();
    });

    test('POST /api/auth/login - Rejects invalid password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'wrongpassword', edition: TEST_EDITION });

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/incorreta/i);
    });

    test('POST /api/auth/refresh - Rotates tokens', async () => {
        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: tokens.refreshToken });

        expect(res.statusCode).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
        expect(res.body.refreshToken).not.toBe(tokens.refreshToken); // newly rotated
    });
});
