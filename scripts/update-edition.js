#!/usr/bin/env node
/**
 * Oscar Watchlist — Criar nova edição
 * ------------------------------------
 * Cria uma nova edição do Oscar com a estrutura de dados
 * necessária (films.json, categories.json, state.json).
 *
 * Uso:
 *   node scripts/update-edition.js 2027
 *   node scripts/update-edition.js 2027 --from 2026   (copia dados da edição 2026)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EDITIONS_DIR = path.join(DATA_DIR, 'editions');
const EDITIONS_PATH = path.join(DATA_DIR, 'editions.json');

function readJson(filePath, fallback) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Parse args
const args = process.argv.slice(2);
const newId = args[0];
const fromIdx = args.indexOf('--from');
const fromId = fromIdx >= 0 ? args[fromIdx + 1] : null;

if (!newId) {
    console.log('Uso: node scripts/update-edition.js <ano> [--from <ano_base>]');
    console.log('');
    console.log('Exemplos:');
    console.log('  node scripts/update-edition.js 2027');
    console.log('  node scripts/update-edition.js 2027 --from 2026');
    process.exit(1);
}

const newDir = path.join(EDITIONS_DIR, newId);

if (fs.existsSync(newDir) && fs.readdirSync(newDir).length > 0) {
    console.log(`❌ A edição ${newId} já existe em ${newDir}`);
    console.log('   Use --from para copiar dados de outra edição para uma pasta vazia.');
    process.exit(1);
}

// Create directory
fs.mkdirSync(newDir, { recursive: true });

if (fromId) {
    // Copy from existing edition
    const fromDir = path.join(EDITIONS_DIR, fromId);
    if (!fs.existsSync(fromDir)) {
        console.log(`❌ Edição base "${fromId}" não encontrada em ${fromDir}`);
        process.exit(1);
    }

    // Copy films and categories (reset state)
    const films = readJson(path.join(fromDir, 'films.json'), []);
    const categories = readJson(path.join(fromDir, 'categories.json'), []);

    // Reset nominations data for new year
    const resetFilms = films.map(f => ({
        ...f,
        year: parseInt(newId) - 1, // Films are from the year before the ceremony
        awardsWon: [],
        poster: f.poster, // Keep poster paths
    }));

    // Reset winners
    const resetCategories = categories.map(c => ({
        ...c,
        officialWinner: null,
    }));

    writeJson(path.join(newDir, 'films.json'), resetFilms);
    writeJson(path.join(newDir, 'categories.json'), resetCategories);
    writeJson(path.join(newDir, 'state.json'), { schemaVersion: 2, users: {}, officialResults: {} });

    console.log(`✅ Edição ${newId} criada a partir de ${fromId}`);
    console.log(`   📁 ${newDir}`);
    console.log(`   🎬 ${resetFilms.length} filmes copiados`);
    console.log(`   📋 ${resetCategories.length} categorias copiadas`);
    console.log('');
    console.log('   Próximos passos:');
    console.log(`   1. Edite data/editions/${newId}/films.json com os novos indicados`);
    console.log(`   2. Edite data/editions/${newId}/categories.json com as novas categorias`);
    console.log(`   3. Rode: node scripts/download-posters.js para baixar as capas`);
} else {
    // Create empty edition
    writeJson(path.join(newDir, 'films.json'), []);
    writeJson(path.join(newDir, 'categories.json'), []);
    writeJson(path.join(newDir, 'state.json'), { schemaVersion: 2, users: {}, officialResults: {} });

    console.log(`✅ Edição ${newId} criada (vazia)`);
    console.log(`   📁 ${newDir}`);
    console.log('');
    console.log('   Próximos passos:');
    console.log(`   1. Adicione filmes em data/editions/${newId}/films.json`);
    console.log(`   2. Adicione categorias em data/editions/${newId}/categories.json`);
}

// Update editions.json
const editions = readJson(EDITIONS_PATH, []);
const ceremonyNum = 70 + (parseInt(newId) - 1998); // Approximate ceremony number
if (!editions.find(e => e.id === newId)) {
    editions.push({
        id: newId,
        label: `Oscar ${newId} (${ceremonyNum}ª Cerimônia)`,
        year: parseInt(newId),
        current: false,
    });
    writeJson(EDITIONS_PATH, editions);
    console.log(`\n   📝 Adicionado ao editions.json`);
    console.log(`   💡 Para tornar esta a edição ativa, edite editions.json e mude "current": true`);
}

console.log('');
