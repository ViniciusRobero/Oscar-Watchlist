# 🎬 Oscar Watchlist v6

Uma aplicação web completa (Node.js + React) para acompanhar, votar e visualizar os indicados e vencedores do Oscar.
O sistema agora utiliza autenticação completa (JWT) e banco de dados Turso/SQLite. Preparada para suportar a conversão Mobile via CapacitorJS.

## 🚀 Novas Funcionalidades e Escopo (v6)

- **Auth e Perfis**: Login e Registro de múltiplos usuários com persistência em banco e testes de e2e criados.
- **Watchlist e Avaliação**: Marque filmes como assistidos e adicione "Stars" e Notas (Reviews Rápidas).
- **Palpites (Bolão do Oscar)**: Faça suas apostas por categoria e acompanhe seu progresso contra o Placar Oficial.
- **Leaderboard (Placar)**: Veja quem acertou mais previsões com o comparativo de perfis (`/compare`).
- **Capas Automáticas**: Download de pôsteres em background usando TMDB/Wikidata.
- **Responsivo**: Layout fluido (Tailwind) com foco nativo em conversão APK mobile.

## 🛠️ Tecnologias

- **Backend**: Node.js, Express, LibSQL Client (Turso/SQLite), JsonWebToken (JWT).
- **Frontend**: React (Vite), TailwindCSS, Framer-Motion.
- **Testes**: Jest e Supertest para a camada de backend da API.

---

## ⚙️ Como Rodar Localmente (Passo a Passo)

1. **Requisitos:** Tenha o `Node.js` v18+ instalado.
2. **Cópia do Projeto:** Baixe ou clone o repositório.
3. **Instalação Geral:**
   ```bash
   # Instala dependências do backend E compila o frontend
   npm run setup
   ```
4. **Variáveis de Ambiente (Opcional):**
   Crie um `.env` na raiz (caso queira capas HQ):
   ```env
   TMDB_API_KEY=sua_chave_aqui
   TURSO_URL=file:data/local.db
   ```
5. **Iniciar o Servidor:**
   ```bash
   # Roda o backend e serve o frontend React na pasta /client/dist
   npm start
   ```
6. **Acesse via Browser:** 
   Abra `http://localhost:3000`

---

## 📂 Estrutura de Banco de Dados (`data/db.js`)
Em vez de JSONs locais para o storage do usuário, migramos os estados dos Filmes e Palpites para SQLite. 
- *`users`*: Guardam o login e senha formatados.
- *`user_film_states`*: Salva `watched`, `rating` e `notes` (Reviews).
- *`user_predictions`*: Salva as escolhas de palpite no Oscar.
- *`official_results`*: Tabela restrita de injeção local onde os Winners finais moram para gerar o "Dia da Premiação".

## 🧪 Como rodar os Testes (QA)
Criamos um arquivo dedicado `tests/api.test.js` que verifica todo o fluxo desde a inicialização SQLite à proteção JWT Endpoints.
```bash
# Executa todos os testes de backend e de banco de dados
npm run test
```
*Para detalhes de simulação de clique UI e execução humana manual, leia o documento gerado `testing_script.md` que cobre o uso de múltiplos perfis como A e B.*
