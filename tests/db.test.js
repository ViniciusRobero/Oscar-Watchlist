#!/usr/bin/env node
/**
 * Oscar Watchlist — Testes básicos para db.js
 * --------------------------------------------
 * Roda com: node tests/db.test.js
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Setup: create a temp edition for testing
const DATA_DIR = path.join(__dirname, '..', 'data');
const TEST_EDITION = '__test__';
const TEST_DIR = path.join(DATA_DIR, 'editions', TEST_EDITION);

function setup() {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'films.json'), JSON.stringify([
        { id: 'test-film-1', title: 'Test Film 1', poster: '/assets/covers/test.svg' },
        { id: 'test-film-2', title: 'Test Film 2', poster: '/assets/covers/test2.svg' },
    ]));
    fs.writeFileSync(path.join(TEST_DIR, 'categories.json'), JSON.stringify([
        {
            id: 'best-picture', name: 'Best Picture', nominees: [
                { id: 'test-film-1', filmId: 'test-film-1', nomineeName: null },
                { id: 'test-film-2', filmId: 'test-film-2', nomineeName: null },
            ], officialWinner: null, highlight: true
        },
    ]));
    fs.writeFileSync(path.join(TEST_DIR, 'state.json'), JSON.stringify({
        schemaVersion: 2, users: {}, officialResults: {}
    }));
}

function cleanup() {
    try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch { }
}

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ❌ ${name}`);
        console.log(`     ${e.message}`);
        failed++;
    }
}

// Run tests
console.log('\n🧪  Testes db.js\n' + '─'.repeat(40));

setup();

const db = require('../data/db');

test('loadEditions returns array', () => {
    const editions = db.loadEditions();
    assert(Array.isArray(editions), 'Should be an array');
    assert(editions.length > 0, 'Should have at least one edition');
});

test('getCurrentEditionId returns a string', () => {
    const id = db.getCurrentEditionId();
    assert(typeof id === 'string', 'Should be a string');
    assert(id.length > 0, 'Should not be empty');
});

test('resolveEdition returns given ID or current', () => {
    assert.strictEqual(db.resolveEdition('2026'), '2026');
    assert.strictEqual(db.resolveEdition(''), db.getCurrentEditionId());
    assert.strictEqual(db.resolveEdition(null), db.getCurrentEditionId());
});

test('loadFilms loads test edition', () => {
    const films = db.loadFilms(TEST_EDITION);
    assert(Array.isArray(films), 'Should be an array');
    assert.strictEqual(films.length, 2);
    assert.strictEqual(films[0].id, 'test-film-1');
});

test('loadCategories loads test edition', () => {
    const cats = db.loadCategories(TEST_EDITION);
    assert(Array.isArray(cats), 'Should be an array');
    assert.strictEqual(cats.length, 1);
    assert.strictEqual(cats[0].id, 'best-picture');
});

test('loadState loads test edition with defaults', () => {
    const state = db.loadState(TEST_EDITION);
    assert(state.users !== undefined, 'Should have users');
    assert(state.officialResults !== undefined, 'Should have officialResults');
    assert.strictEqual(state.schemaVersion, 2);
});

test('ensureUser creates new user', () => {
    const state = db.loadState(TEST_EDITION);
    const user = db.ensureUser(state, 'alice');
    assert(user !== null, 'Should return user object');
    assert(user.films !== undefined, 'Should have films');
    assert(user.predictions !== undefined, 'Should have predictions');
    assert(user.createdAt !== undefined, 'Should have createdAt');
});

test('ensureUser returns existing user', () => {
    const state = db.loadState(TEST_EDITION);
    db.ensureUser(state, 'bob');
    const user2 = db.ensureUser(state, 'bob');
    assert(user2 !== null, 'Should return existing user');
});

test('ensureUser returns null for empty username', () => {
    const state = db.loadState(TEST_EDITION);
    assert.strictEqual(db.ensureUser(state, ''), null);
    assert.strictEqual(db.ensureUser(state, null), null);
});

test('normalizeFilmState creates default state', () => {
    const user = { films: {}, predictions: {} };
    const fs = db.normalizeFilmState(user, 'test-film-1');
    assert.strictEqual(fs.watched, false);
    assert.strictEqual(fs.personalRating, null);
    assert.strictEqual(fs.personalNotes, '');
});

test('saveState and loadState round-trip', () => {
    const state = db.loadState(TEST_EDITION);
    db.ensureUser(state, 'charlie');
    state.users['charlie'].predictions['best-picture'] = 'test-film-1';
    db.saveState(state, TEST_EDITION);

    const loaded = db.loadState(TEST_EDITION);
    assert.strictEqual(loaded.users['charlie'].predictions['best-picture'], 'test-film-1');
});

test('hashPassword and verifyPassword work', () => {
    const hash = db.hashPassword('test123');
    assert(typeof hash === 'string', 'Hash should be a string');
    assert(hash.includes(':'), 'Hash should contain separator');
    assert(db.verifyPassword('test123', hash), 'Should verify correct password');
    assert(!db.verifyPassword('wrong', hash), 'Should reject wrong password');
});

test('buildBootstrap returns complete data for test edition', () => {
    const data = db.buildBootstrap('charlie', TEST_EDITION);
    assert.strictEqual(data.edition, TEST_EDITION);
    assert(Array.isArray(data.editions), 'Should have editions');
    assert(Array.isArray(data.films), 'Should have films');
    assert(Array.isArray(data.categories), 'Should have categories');
    assert(Array.isArray(data.users), 'Should have users list');
    assert(data.profile !== undefined, 'Should have profile');
    assert(data.officialResults !== undefined, 'Should have officialResults');
});

test('summarizeUsers provides correct stats', () => {
    const state = db.loadState(TEST_EDITION);
    const summaries = db.summarizeUsers(state);
    assert(Array.isArray(summaries), 'Should be an array');
    const charlie = summaries.find(s => s.username === 'charlie');
    assert(charlie !== undefined, 'Should find charlie');
    assert.strictEqual(charlie.predictionsCount, 1);
});

// Cleanup
cleanup();

console.log('─'.repeat(40));
console.log(`\n  Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
