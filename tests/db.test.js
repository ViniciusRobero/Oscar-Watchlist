const fs = require('fs');
const path = require('path');

process.env.TURSO_URL = `file:${path.join(__dirname, '..', 'data', 'test_db.db')}`;
const db = require('../data/db');

const TEST_EDITION = '__test_db__';
const TEST_DIR = path.join(__dirname, '..', 'data', 'editions', TEST_EDITION);

beforeAll(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'films.json'), '[]');
    fs.writeFileSync(path.join(TEST_DIR, 'categories.json'), '[]');

    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'data', 'schema.sql'), 'utf8');
    await db.dbClient.executeMultiple(schemaSql);
});

afterAll(async () => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    try {
        fs.unlinkSync(path.join(__dirname, '..', 'data', 'test_db.db'));
    } catch (e) { }
});

beforeEach(async () => {
    await db.dbClient.executeMultiple(`
      DELETE FROM user_predictions;
      DELETE FROM user_film_states;
      DELETE FROM refresh_tokens;
      DELETE FROM official_results;
      DELETE FROM users;
    `);
});

describe('Database Core Async Functions', () => {
    test('User creation and retrieval', async () => {
        const user = await db.createUser('alice', 'hash123', 'admin');
        expect(user.username).toBe('alice');
        expect(user.role).toBe('admin');

        const fetched = await db.getUser('alice');
        expect(fetched.passwordHash).toBe('hash123');
    });

    test('ensureUserAsync fallback logic', async () => {
        const u1 = await db.ensureUserAsync('bob', 'hash_bob');
        expect(u1.username).toBe('bob');
        expect(u1.passwordHash).toBe('hash_bob');

        // Should update password if requested but not exist
        await db.dbClient.execute("UPDATE users SET password_hash = NULL WHERE id = 'bob'");
        const u2 = await db.ensureUserAsync('bob', 'new_hash');
        expect(u2.passwordHash).toBe('new_hash');
    });

    test('Film states CRUD', async () => {
        const user = await db.createUser('charlie', 'hash', 'user');

        // Default
        let state = await db.getFilmState('charlie', 'film1', TEST_EDITION);
        expect(state.watched).toBe(false);

        // Update
        await db.updateFilmState('charlie', 'film1', TEST_EDITION, { watched: true, personalRating: 8 });
        state = await db.getFilmState('charlie', 'film1', TEST_EDITION);
        expect(state.watched).toBe(true);
        expect(state.personalRating).toBe(8);

        // Partial update
        await db.updateFilmState('charlie', 'film1', TEST_EDITION, { personalNotes: 'good' });
        state = await db.getFilmState('charlie', 'film1', TEST_EDITION);
        expect(state.watched).toBe(true);
        expect(state.personalNotes).toBe('good');
    });

    test('Predictions CRUD', async () => {
        await db.createUser('dave', 'hash', 'user');

        await db.updatePrediction('dave', 'cat1', TEST_EDITION, 'nom1');
        await db.updatePrediction('dave', 'cat2', TEST_EDITION, 'nom2');

        const preds = await db.getPredictionsMap('dave', TEST_EDITION);
        expect(preds['cat1']).toBe('nom1');
        expect(preds['cat2']).toBe('nom2');

        // Remove
        await db.updatePrediction('dave', 'cat1', TEST_EDITION, null);
        const predsAfter = await db.getPredictionsMap('dave', TEST_EDITION);
        expect(predsAfter['cat1']).toBeUndefined();
    });

    test('Official Results CRUD', async () => {
        await db.updateOfficialResult('cat1', TEST_EDITION, 'nom1');
        let results = await db.getOfficialResults(TEST_EDITION);
        expect(results['cat1']).toBe('nom1');

        await db.updateOfficialResult('cat1', TEST_EDITION, null);
        results = await db.getOfficialResults(TEST_EDITION);
        expect(results['cat1']).toBeUndefined();
    });

    test('summarizeUsers calculates metrics', async () => {
        await db.createUser('userA', 'hash', 'user');
        await db.createUser('userB', 'hash', 'user');

        await db.updateFilmState('userA', 'film1', TEST_EDITION, { watched: true, personalRating: 10 });
        await db.updateFilmState('userA', 'film2', TEST_EDITION, { watched: true, personalRating: 8 });
        await db.updatePrediction('userB', 'cat1', TEST_EDITION, 'nom1');

        const summaries = await db.summarizeUsers(TEST_EDITION);
        expect(summaries).toHaveLength(2);

        const userA = summaries.find(s => s.username === 'userA');
        expect(userA.watchedCount).toBe(2);
        expect(userA.ratingsCount).toBe(2);
        expect(userA.averageRating).toBe('9.0');
        expect(userA.predictionsCount).toBe(0);

        const userB = summaries.find(s => s.username === 'userB');
        expect(userB.watchedCount).toBe(0);
        expect(userB.predictionsCount).toBe(1);
    });
});
