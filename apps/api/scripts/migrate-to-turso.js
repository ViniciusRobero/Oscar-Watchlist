const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = process.env.TURSO_URL || 'file:data/local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function migrate() {
    console.log(`🚀 Iniciando migração para Turso/SQLite em: ${url}`);

    // 1. Criar as tabelas
    console.log(`📦 Aplicando schema...`);
    const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'data', 'schema.sql'), 'utf8');

    // Split schema statements (libsql client execution doesn't like multi-statement strings generically in execute())
    // Let's use executeMultiple if available or split manually
    try {
        await client.executeMultiple(schemaSql);
        console.log(`✅ Schema aplicado com sucesso.`);
    } catch (e) {
        console.error("Erro ao aplicar schema:", e.message);
        return;
    }

    // 2. Ler state.json
    const statePath = path.resolve(process.cwd(), 'data', 'editions', '2026', 'state.json');
    if (!fs.existsSync(statePath)) {
        console.log(`⚠️ state.json não encontrado. Banco criado apenas com schema vazio.`);
        process.exit(0);
    }

    console.log(`🔄 Lendo state.json (Edição 2026)...`);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

    // Begin transaction for data migration
    const transaction = [];

    // 3. Migrar usuários
    for (const [username, userData] of Object.entries(state.users)) {
        // Assume username as simple lowercase string as id for this script or use crypto randomUUID
        const userId = username;

        transaction.push({
            sql: `INSERT OR IGNORE INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)`,
            args: [userId, username, userData.passwordHash || null, userData.role || 'user']
        });

        // 4. Migrar states de filmes
        if (userData.films) {
            for (const [filmId, filmData] of Object.entries(userData.films)) {
                if (!filmData) continue;
                const recId = `${userId}_${filmId}_2026`;
                transaction.push({
                    sql: `INSERT OR IGNORE INTO user_film_states (id, user_id, film_id, edition_id, watched, personal_rating, personal_notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        recId,
                        userId,
                        filmId,
                        '2026',
                        filmData.watched ? 1 : 0,
                        filmData.personalRating || null,
                        filmData.personalNotes || ''
                    ]
                });
            }
        }

        // 5. Migrar palpites
        if (userData.predictions) {
            for (const [categoryId, nomineeId] of Object.entries(userData.predictions)) {
                if (!nomineeId) continue;
                const recId = `${userId}_${categoryId}_2026`;
                transaction.push({
                    sql: `INSERT OR IGNORE INTO user_predictions (id, user_id, category_id, edition_id, nominee_id) VALUES (?, ?, ?, ?, ?)`,
                    args: [
                        recId,
                        userId,
                        categoryId,
                        '2026',
                        nomineeId
                    ]
                });
            }
        }
    }

    // 6. Migrar official results
    if (state.officialResults) {
        for (const [categoryId, nomineeId] of Object.entries(state.officialResults)) {
            if (!nomineeId) continue;
            const recId = `official_${categoryId}_2026`;
            transaction.push({
                sql: `INSERT OR IGNORE INTO official_results (id, category_id, edition_id, winner_nominee_id) VALUES (?, ?, ?, ?)`,
                args: [recId, categoryId, '2026', nomineeId]
            });
        }
    }

    console.log(`💾 Salvando ${transaction.length} registros no banco de dados...`);
    try {
        await client.batch(transaction, "write");
        console.log(`✅ Migração concluída com sucesso!`);
    } catch (e) {
        console.error("❌ Erro ao inserir dados:", e.message);
    }

    process.exit(0);
}

migrate();
