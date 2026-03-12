// data/services/editionService.js — Edition/Award/Film JSON loading
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..');
const EDITIONS_DIR = path.join(DATA_DIR, 'editions');
const EDITIONS_PATH = path.join(DATA_DIR, 'editions.json');
const AWARDS_PATH = path.join(DATA_DIR, 'awards.json');
const LEGACY_FILMS_PATH = path.join(DATA_DIR, 'films.json');
const LEGACY_CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function editionDir(editionId) {
  return path.join(EDITIONS_DIR, editionId);
}

function loadAwards() {
  return readJson(AWARDS_PATH, [
    { id: 'oscar', name: 'Oscar', fullName: 'Academy Awards', type: 'cinema', icon: '🏆', active: true }
  ]);
}

function loadEditions() {
  return readJson(EDITIONS_PATH, [
    { id: '2026', award_id: 'oscar', label: 'Oscar 2026', year: 2026, current: true }
  ]);
}

function getCurrentEditionId() {
  const editions = loadEditions();
  const current = editions.find(e => e.current);
  return current ? current.id : editions[0]?.id || '2026';
}

function resolveEdition(editionId) {
  return editionId || getCurrentEditionId();
}

function loadFilms(editionId) {
  const eid = resolveEdition(editionId);
  const edPath = path.join(editionDir(eid), 'films.json');
  if (fs.existsSync(edPath)) return readJson(edPath, []);
  return readJson(LEGACY_FILMS_PATH, []);
}

function loadCategories(editionId) {
  const eid = resolveEdition(editionId);
  const edPath = path.join(editionDir(eid), 'categories.json');
  if (fs.existsSync(edPath)) return readJson(edPath, []);
  return readJson(LEGACY_CATEGORIES_PATH, []);
}

function saveFilms(films, editionId) {
  const eid = resolveEdition(editionId);
  const dir = editionDir(eid);
  try {
    fs.writeFileSync(path.join(dir, 'films.json'), JSON.stringify(films, null, 2));
  } catch { /* silently ignore */ }
}

module.exports = {
  readJson,
  editionDir,
  loadAwards,
  loadEditions,
  getCurrentEditionId,
  resolveEdition,
  loadFilms,
  loadCategories,
  saveFilms,
};
