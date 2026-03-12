const fs = require('fs');
const path = require('path');

process.env.TURSO_URL = `file:${path.join(process.cwd(), 'data', 'test_db.db')}`;

const { dbClient } = require('../src/config/db');
const { migrateSchema } = require('../src/auth');
const { createUser, getUser, getUserByNick, getUserByEmail, ensureUserAsync } = require('../src/repositories/userRepository');
const { getFilmState, updateFilmState } = require('../src/repositories/filmRepository');
const { updatePrediction, getPredictionsMap } = require('../src/repositories/predictionRepository');
const { getOfficialResults, updateOfficialResult } = require('../src/repositories/resultRepository');
const { summarizeUsers } = require('../src/services/bootstrapService');

const TEST_EDITION = '__test_db__';
const TEST_DIR = path.join(process.cwd(), 'data', 'editions', TEST_EDITION);

beforeAll(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'films.json'), '[]');
    fs.writeFileSync(path.join(TEST_DIR, 'categories.json'), '[]');

    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'data', 'schema.sql'), 'utf8');
    await dbClient.executeMultiple(schemaSql);
    await migrateSchema();
});

afterAll(async () => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    try {
        fs.unlinkSync(path.join(process.cwd(), 'data', 'test_db.db'));
    } catch (e) { }
});

beforeEach(async () => {
    await dbClient.executeMultiple(`
      DELETE FROM user_logs;
      DELETE FROM user_predictions;
      DELETE FROM user_film_states;
      DELETE FROM refresh_tokens;
      DELETE FROM official_results;
      DELETE FROM users;
    `);
});

describe('Database Core Async Functions', () => {
    test('User creation and retrieval (with nick/email)', async () => {
        const user = await createUser('alice', 'hash123', 'admin', {
            nick: 'alice', email: 'alice@example.com', firstName: 'Alice', lastName: 'Test',
        });
        expect(user.username).toBe('alice');
        expect(user.role).toBe('admin');
        expect(user.nick).toBe('alice');
        expect(user.email).toBe('alice@example.com');

        const fetched = await getUser('alice');
        expect(fetched.passwordHash).toBe('hash123');
    });

    test('getUserByNick and getUserByEmail', async () => {
        await createUser('bobuser', 'hash', 'user', {
            nick: 'bobnick', email: 'bob@example.com', firstName: 'Bob', lastName: 'Test',
        });

        const byNick = await getUserByNick('bobnick');
        expect(byNick).not.toBeNull();
        expect(byNick.username).toBe('bobuser');

        const byEmail = await getUserByEmail('bob@example.com');
        expect(byEmail).not.toBeNull();
        expect(byEmail.username).toBe('bobuser');

        const notFound = await getUserByNick('nonexistent');
        expect(notFound).toBeNull();
    });

    test('ensureUserAsync fallback logic', async () => {
        const u1 = await ensureUserAsync('bob', 'hash_bob');
        expect(u1.username).toBe('bob');
        expect(u1.passwordHash).toBe('hash_bob');

        // Should update password if requested but hash is null
        await dbClient.execute({ sql: "UPDATE users SET password_hash = NULL WHERE username = ?", args: ['bob'] });
        const u2 = await ensureUserAsync('bob', 'new_hash');
        expect(u2.passwordHash).toBe('new_hash');
    });

    test('Film states CRUD', async () => {
        await createUser('charlie', 'hash', 'user', { nick: 'charlie', email: 'charlie@example.com', firstName: 'Charlie', lastName: 'Test' });

        // Default
        let state = await getFilmState('charlie', 'film1', TEST_EDITION);
        expect(state.watched).toBe(false);

        // Update
        await updateFilmState('charlie', 'film1', TEST_EDITION, { watched: true, personalRating: 8 });
        state = await getFilmState('charlie', 'film1', TEST_EDITION);
        expect(state.watched).toBe(true);
        expect(state.personalRating).toBe(8);

        // Partial update
        await updateFilmState('charlie', 'film1', TEST_EDITION, { personalNotes: 'good' });
        state = await getFilmState('charlie', 'film1', TEST_EDITION);
        expect(state.watched).toBe(true);
        expect(state.personalNotes).toBe('good');
    });

    test('Predictions CRUD', async () => {
        await createUser('dave', 'hash', 'user', { nick: 'dave', email: 'dave@example.com', firstName: 'Dave', lastName: 'Test' });

        await updatePrediction('dave', 'cat1', TEST_EDITION, 'nom1');
        await updatePrediction('dave', 'cat2', TEST_EDITION, 'nom2');

        const preds = await getPredictionsMap('dave', TEST_EDITION);
        expect(preds['cat1']).toBe('nom1');
        expect(preds['cat2']).toBe('nom2');

        // Remove
        await updatePrediction('dave', 'cat1', TEST_EDITION, null);
        const predsAfter = await getPredictionsMap('dave', TEST_EDITION);
        expect(predsAfter['cat1']).toBeUndefined();
    });

    test('Official Results CRUD', async () => {
        await updateOfficialResult('cat1', TEST_EDITION, 'nom1');
        let results = await getOfficialResults(TEST_EDITION);
        expect(results['cat1']).toBe('nom1');

        await updateOfficialResult('cat1', TEST_EDITION, null);
        results = await getOfficialResults(TEST_EDITION);
        expect(results['cat1']).toBeUndefined();
    });

    test('summarizeUsers calculates metrics', async () => {
        await createUser('userA', 'hash', 'user', { nick: 'usera', email: 'usera@example.com', firstName: 'User', lastName: 'A' });
        await createUser('userB', 'hash', 'user', { nick: 'userb', email: 'userb@example.com', firstName: 'User', lastName: 'B' });

        await updateFilmState('userA', 'film1', TEST_EDITION, { watched: true, personalRating: 10 });
        await updateFilmState('userA', 'film2', TEST_EDITION, { watched: true, personalRating: 8 });
        await updatePrediction('userB', 'cat1', TEST_EDITION, 'nom1');

        const summaries = await summarizeUsers(TEST_EDITION);
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
