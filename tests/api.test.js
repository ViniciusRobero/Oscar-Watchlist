const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.TURSO_URL = `file:${path.join(__dirname, '..', 'data', 'test_api.db')}`;
const app = require('../server');
const { dbClient } = require('../config/db');
const { migrateSchema, hashPassword } = require('../data/auth');
const { createUser } = require('../data/repositories/userRepository');
const { generateTokens } = require('../middleware/auth');

const TEST_EDITION = '__test_api__';
const TEST_DIR = path.join(__dirname, '..', 'data', 'editions', TEST_EDITION);

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

    await createUser('api_user', hashPassword('123456'), 'user');
    await createUser('api_admin', hashPassword('123456'), 'admin');

    userToken = generateTokens({ username: 'api_user', role: 'user' }).accessToken;
    adminToken = generateTokens({ username: 'api_admin', role: 'admin' }).accessToken;
});

afterAll(async () => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    try { fs.unlinkSync(path.join(__dirname, '..', 'data', 'test_api.db')); } catch (e) { }
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
});
