const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.TURSO_URL = `file:${path.join(process.cwd(), 'data', 'test_api.db')}`;
const app = require('../server');
const { dbClient } = require('../src/config/db');
const { migrateSchema, hashPassword } = require('../src/auth');
const { createUser } = require('../src/repositories/userRepository');
const { generateTokens } = require('../src/middleware/auth');

const TEST_EDITION = '__test_api__';
const TEST_DIR = path.join(process.cwd(), 'data', 'editions', TEST_EDITION);

let userToken = '';
let adminToken = '';

beforeAll(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'films.json'), JSON.stringify([
        { id: 'film1', title: 'Film 1', poster: '/test.jpg' },
        { id: 'film2', title: 'Film 2', poster: '/test2.jpg' }
    ]));
    fs.writeFileSync(path.join(TEST_DIR, 'categories.json'), JSON.stringify([
        { id: 'cat1', name: 'Cat 1', nominees: [{ id: 'nom1', filmId: 'film1' }, { id: 'nom2', filmId: 'film2' }] }
    ]));

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

    await createUser('api_user', hashPassword('123456'), 'user', {
        nick: 'api_user', email: 'apiuser@example.com', firstName: 'API', lastName: 'User',
    });
    await createUser('api_admin', hashPassword('123456'), 'admin', {
        nick: 'api_admin', email: 'apiadmin@example.com', firstName: 'API', lastName: 'Admin',
    });

    userToken = generateTokens({ username: 'api_user', nick: 'api_user', role: 'user' }).accessToken;
    adminToken = generateTokens({ username: 'api_admin', nick: 'api_admin', role: 'admin' }).accessToken;
});

afterAll(async () => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    try { fs.unlinkSync(path.join(process.cwd(), 'data', 'test_api.db')); } catch (e) { }
});

describe('General API Endpoints', () => {
    test('GET /api/bootstrap - retorna awards e editions', async () => {
        const res = await request(app).get(`/api/bootstrap?username=api_user&edition=${TEST_EDITION}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.films).toHaveLength(2);
        expect(res.body.categories).toHaveLength(1);
        expect(res.body.profile).toBeDefined();
        expect(Array.isArray(res.body.awards)).toBe(true);
        expect(Array.isArray(res.body.editions)).toBe(true);
    });

    test('GET /api/awards - lista premiações', async () => {
        const res = await request(app).get('/api/awards');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some(a => a.id === 'oscar')).toBe(true);
    });

    test('PATCH /api/users/:username/films/:filmId - protegido por JWT', async () => {
        const res = await request(app)
            .patch(`/api/users/api_user/films/film1?edition=${TEST_EDITION}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ watched: true, personalRating: 5 });

        expect(res.statusCode).toBe(200);
        expect(res.body.filmState.watched).toBe(true);
        expect(res.body.filmState.personalRating).toBe(5);
    });

    test('PATCH /api/users/:username/films/:filmId - rejeita sem token', async () => {
        const res = await request(app)
            .patch(`/api/users/api_user/films/film1?edition=${TEST_EDITION}`)
            .send({ watched: true });

        expect(res.statusCode).toBe(401);
    });

    test('PATCH /api/predictions/:username/:categoryId - protegido por JWT', async () => {
        const res = await request(app)
            .patch(`/api/predictions/api_user/cat1?edition=${TEST_EDITION}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ nomineeId: 'nom1' });

        expect(res.statusCode).toBe(200);
        expect(res.body.predictions['cat1']).toBe('nom1');
    });

    test('PATCH /api/results/official/:categoryId - rejeita usuário comum', async () => {
        const res = await request(app)
            .patch(`/api/results/official/cat1?edition=${TEST_EDITION}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ nomineeId: 'nom2' });

        expect(res.statusCode).toBe(403);
    });

    test('PATCH /api/results/official/:categoryId - aceita admin', async () => {
        const res = await request(app)
            .patch(`/api/results/official/cat1?edition=${TEST_EDITION}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ nomineeId: 'nom2' });

        expect(res.statusCode).toBe(200);
        expect(res.body.officialResults['cat1']).toBe('nom2');
    });

    test('GET /api/results/compare/users - retorna comparação', async () => {
        const res = await request(app)
            .get(`/api/results/compare/users?left=api_user&right=api_admin&edition=${TEST_EDITION}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.totalCategories).toBe(1);
    });

    test('GET /api/users/:nick/timeline - retorna 403 para usuário privado', async () => {
        // api_user is private by default
        const res = await request(app)
            .get('/api/users/api_user/timeline');
        expect(res.statusCode).toBe(403);
    });

    test('GET /api/users/:nick/timeline - retorna timeline para próprio usuário autenticado', async () => {
        const res = await request(app)
            .get('/api/users/api_user/timeline')
            .set('Authorization', `Bearer ${userToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.timeline)).toBe(true);
    });

    test('PATCH /api/admin/users/:nick/password - admin pode trocar senha', async () => {
        const res = await request(app)
            .patch('/api/admin/users/api_user/password')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ newPassword: 'newsecurepass' });
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('PATCH /api/admin/users/:nick/password - rejeita usuário comum', async () => {
        const res = await request(app)
            .patch('/api/admin/users/api_admin/password')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ newPassword: 'hackpass' });
        expect(res.statusCode).toBe(403);
    });
});
