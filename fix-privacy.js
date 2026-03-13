// Script de migração única: define todos os usuários como públicos (is_private = 0)
// Rodar no servidor: node fix-privacy.js
require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_URL || 'file:data/local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

db.execute("UPDATE users SET is_private = 0")
  .then((rs) => {
    console.log(`Migração concluída. ${rs.rowsAffected} usuário(s) atualizado(s).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erro na migração:', err);
    process.exit(1);
  });
