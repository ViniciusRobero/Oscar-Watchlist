# 🏆 Oscar Watchlist

Uma aplicação web completa para acompanhar filmes indicados, registrar palpites e visualizar resultados de premiações de cinema, música e televisão. Desenvolvida com Node.js + React, autenticação JWT, banco de dados SQLite/Turso e suporte a mobile via Capacitor.

---

## 📌 O que é o Oscar Watchlist?

O Oscar Watchlist nasceu como uma ferramenta pessoal para acompanhar a temporada de premiações com amigos e família. A ideia é simples: você cria um perfil, marca os filmes que já assistiu, escreve notas rápidas, dá uma nota pessoal — e ainda faz seus palpites para cada categoria antes da cerimônia.

Depois, quando os vencedores são anunciados, o app calcula automaticamente quem acertou mais entre os participantes, gerando um ranking e comparações detalhadas.

**É um bolão de premiações + watchlist + diário de cinema, tudo em um só lugar.**

---

## ✨ Funcionalidades

### 🎬 Watchlist
- Lista todos os filmes indicados da edição atual
- Marque filmes como **assistidos** ou **pendentes**
- Adicione uma **nota pessoal** (0–10) e um **comentário rápido** (até 600 caracteres)
- Filtros: Todos / Pendentes / Assistidos
- Busca por título, plataforma ou categoria
- Pôsteres carregados automaticamente via TMDB, OMDB, Wikidata ou Wikipedia

### 🔮 Palpites (Bolão)
- Faça seus palpites para cada categoria antes da cerimônia
- Atualização otimista: a UI responde imediatamente, sem esperar o servidor
- Proteção contra condição de corrida: respostas antigas não sobrescrevem palpites mais recentes

### 🌙 Noite da Premiação
- Visualize as categorias e os indicados em tempo real
- Administradores registram os vencedores oficiais diretamente na tela
- Seu placar (acertos / categorias reveladas) é calculado ao vivo

### 👥 Perfis e Comparações
- Múltiplos perfis por instância da aplicação
- Cada perfil tem sua watchlist, notas e palpites independentes
- Compare dois perfis lado a lado: concordâncias e divergências por categoria
- Veja seu resultado oficial: quantas categorias você acertou

### 🏅 Multi-Premiações
- Suporte a Oscar, Grammy, Emmy e Globo de Ouro (configurável via `data/awards.json`)
- Cada premiação tem suas próprias edições (`data/editions.json`)
- Hub central: quando múltiplas premiações estão ativas, o usuário escolhe qual acessar

### 🔐 Autenticação
- Registro e login com senha (bcrypt, 12 rounds)
- JWT de curta duração (15 min) armazenado em memória React — nunca em localStorage
- Refresh token em cookie HttpOnly (7 dias) — renovação automática transparente
- Bloqueio de brute force: 5 tentativas falhas → lockout de 15 minutos
- Perfis privados ou públicos (perfis privados não aparecem na lista geral)
- Painel de administração para ativar/desativar/deletar usuários

### 📱 Mobile (Capacitor)
- Build para Android via Capacitor (`@capacitor/android`)
- Mesma base de código web compilada para APK nativo
- Viewport configurado para dispositivos móveis (`user-scalable=no, viewport-fit=cover`)

---

## 🛠️ Tecnologias

### Backend
| Tecnologia | Por que foi escolhida |
|---|---|
| **Node.js + Express** | Runtime leve, ecossistema maduro, ideal para APIs REST de médio porte |
| **@libsql/client (Turso/SQLite)** | SQLite para desenvolvimento local; Turso (SQLite na nuvem) para produção sem custo de infraestrutura |
| **jsonwebtoken** | Padrão JWT: stateless, fácil de validar em qualquer middleware |
| **bcryptjs** | Hashing de senhas com custo computacional ajustável (rounds=12) |
| **helmet** | Headers de segurança HTTP com uma linha |
| **cors** | Controle preciso de origens permitidas |
| **express-rate-limit** | Rate limiting nativo sem dependência externa de Redis |
| **cookie-parser** | Leitura de cookies HttpOnly para o refresh token |

### Frontend
| Tecnologia | Por que foi escolhida |
|---|---|
| **React + Vite** | Vite oferece HMR instantâneo e build de produção extremamente rápido |
| **TailwindCSS** | CSS utilitário — sem arquivos CSS separados, design system embutido no markup |
| **Framer Motion** | Animações declarativas com performance nativa (WAAPI) |
| **Lucide React** | Ícones SVG otimizados, tree-shakeable, consistentes |

### Testes
| Tecnologia | Por que foi escolhida |
|---|---|
| **Jest + Supertest** | Testes de integração HTTP reais (sem mocks de rota) para o backend |
| **Vitest + Testing Library** | Vitest compartilha a config do Vite; Testing Library testa comportamento do usuário, não implementação |

### Mobile
| Tecnologia | Por que foi escolhida |
|---|---|
| **Capacitor** | Converte o app web para APK nativo sem React Native; reutiliza 100% do código existente |

---

## 🏗️ Arquitetura

### Backend: Repository + Service Layer

O backend segue o padrão **Repository + Service Layer** — sem over-engineering de Clean Architecture completa, mas com separação clara de responsabilidades:

```
Oscar-Watchlist/
├── server.js                          # Express setup, middlewares, rotas de poster, SPA fallback (~120 linhas)
├── config/
│   └── db.js                          # Criação do cliente Turso (única responsabilidade)
├── data/
│   ├── schema.sql                     # DDL do banco de dados
│   ├── awards.json                    # Definições das premiações (Oscar, Grammy, etc.)
│   ├── editions.json                  # Edições disponíveis com award_id
│   ├── editions/
│   │   └── 2026/
│   │       ├── films.json             # Filmes indicados da edição
│   │       └── categories.json        # Categorias e indicados
│   ├── repositories/                  # Camada de acesso a dados (apenas SQL)
│   │   ├── userRepository.js          # CRUD de usuários
│   │   ├── filmRepository.js          # Estados de filme por usuário
│   │   ├── predictionRepository.js    # Palpites
│   │   ├── resultRepository.js        # Resultados oficiais
│   │   └── tokenRepository.js         # Refresh tokens
│   ├── services/                      # Lógica de negócio e orquestração
│   │   ├── editionService.js          # I/O de JSON, resolução de edição
│   │   └── bootstrapService.js        # Dados iniciais do app
│   └── auth.js                        # Hashing de senhas, migrações de schema
├── lib/
│   ├── bruteForce.js                  # Lockout em memória por username
│   └── poster.js                      # Fetch de pôsteres (TMDB → OMDB → Wikidata → Wikipedia)
├── middleware/
│   └── auth.js                        # JWT: generate, verify, revoke, authenticate
├── routes/                            # Controllers finos (sem lógica de negócio)
│   ├── auth.js                        # Login, register, refresh, logout
│   ├── users.js                       # Film states, settings de perfil
│   ├── predictions.js                 # Salvar/ler palpites
│   ├── results.js                     # Resultados oficiais, comparações
│   └── admin.js                       # Gestão de usuários (admin only)
└── tests/
    ├── auth.test.js                   # 13 testes: registro, login, cookies, brute force
    ├── api.test.js                    # 8 testes: endpoints, JWT, admin
    └── db.test.js                     # 6 testes: CRUD do banco
```

**Por que Repository + Service e não MVC ou Clean Architecture?**
- MVC seria insuficiente — misturaria SQL com lógica de negócio nas rotas
- Clean Architecture seria over-engineering para este porte (5 routes, ~10 entidades)
- O padrão escolhido separa SQL (repositories), I/O de arquivo (services) e regras de negócio (auth) sem criar pastas vazias ou interfaces desnecessárias

### Frontend: Context + Custom Hooks

```
client/src/
├── App.jsx                    # Roteamento entre Hub → Award → páginas
├── api.js                     # Fetch wrapper com auto-refresh de token
├── context/
│   └── AppContext.jsx          # Estado global: state, dispatch, bootstrap, showToast
├── hooks/                     # Lógica de domínio encapsulada
│   ├── useAuth.js              # login, register, logout, restoreSession
│   ├── useFilmState.js         # getFilmState, updateFilm
│   ├── usePredictions.js       # savePrediction, setOfficialWinner
│   └── useEdition.js           # switchEdition
├── components/
│   ├── Layout.jsx              # Header, navegação desktop/mobile, dropdown de usuário
│   ├── MovieCard.jsx           # Card de filme na watchlist
│   ├── MovieModal.jsx          # Modal com detalhes, rating, notas
│   ├── CompareRow.jsx          # Linha de comparação de palpites
│   ├── SkeletonFilmCard.jsx    # Skeleton loading
│   └── Toast.jsx               # Notificações flutuantes
├── pages/
│   ├── HubPage.jsx             # Seleção de premiação (multi-award)
│   ├── WatchlistPage.jsx       # Lista de filmes com filtros e busca
│   ├── PredictionsPage.jsx     # Palpites por categoria
│   ├── OscarNightPage.jsx      # Resultados ao vivo
│   ├── ComparePage.jsx         # Comparação entre perfis
│   └── UsersPage.jsx           # Gestão de perfis e autenticação
├── utils/
│   ├── safeUrl.js              # Sanitização de URLs externas
│   └── compareReport.js        # Lógica de relatório de comparação
└── test/
    ├── helpers/
    │   └── mockAppContext.jsx  # Provider mock para testes
    ├── components/             # Testes de componentes
    ├── pages/                  # Testes de páginas
    ├── context/                # Testes do reducer
    └── utils/                  # Testes de utilitários
```

**Por que Context + Custom Hooks e não Redux ou Zustand?**
- O estado global é simples (um objeto, um reducer): Redux seria boilerplate excessivo
- Custom hooks encapsulam lógica de domínio sem acoplar ao AppContext
- Hooks são testáveis de forma independente via mock do contexto

---

## 🔒 Segurança

| Mecanismo | Implementação |
|---|---|
| Senhas | bcryptjs (rounds=12); fallback para PBKDF2 legado |
| Access Token | JWT em memória React (15 min); **nunca** em localStorage |
| Refresh Token | Cookie HttpOnly, Secure, SameSite (7 dias); rotacionado a cada renovação |
| Brute Force | Lockout de 15 min após 5 tentativas falhas (por username, in-memory) |
| Rate Limiting | Login: 10 req/min; Registro: 5 req/min |
| Headers HTTP | Helmet (X-Frame-Options, CSP, HSTS, etc.) |
| CORS | Origens explicitamente configuradas via `CORS_ORIGIN` |

---

## ⚙️ Como Rodar Localmente

### Pré-requisitos
- Node.js v18 ou superior

### Instalação completa (primeira vez)

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd Oscar-Watchlist

# Instala dependências e compila o frontend
npm run setup
```

### Variáveis de ambiente (opcional)

Crie um arquivo `.env` na raiz do projeto:

```env
# Banco de dados (padrão: arquivo local SQLite)
TURSO_URL=file:data/local.db
TURSO_AUTH_TOKEN=            # Somente para Turso na nuvem

# Pôsteres em alta qualidade (sem chave = Wikipedia, com chave = qualidade superior)
TMDB_API_KEY=3fda102d660d05b1fff1224bfa108edd
OMDB_API_KEY=3fda102d660d05b1fff1224bfa108edd  # Alternativa ao TMDB

# Segurança JWT (mude em produção!)
JWT_SECRET=seu-segredo-aqui
JWT_REFRESH_SECRET=seu-segredo-refresh-aqui

# CORS (para produção com domínio separado)
CORS_ORIGIN=https://seudominio.com

# Porta do servidor
PORT=3000

# Conta admin padrão
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### Iniciar o servidor

```bash
npm start
```

Acesse: **http://localhost:3000**

### Modo desenvolvimento (hot-reload no frontend)

```bash
# Terminal 1 — Backend
npm run dev:server

# Terminal 2 — Frontend (Vite dev server em http://localhost:5173)
npm run dev:client
```

---

## 🧪 Testes

```bash
# Backend (Jest + Supertest) — 30 testes
npm test

# Frontend (Vitest + Testing Library) — 76 testes
cd client && npm test

# Modo watch (frontend)
cd client && npx vitest
```

### O que é testado

**Backend (30 testes):**
- Registro, login, cookie de refresh, renovação de token, logout
- Brute force lockout (após 5 tentativas)
- Hashing bcrypt e fallback PBKDF2 legado
- Proteção JWT em endpoints protegidos
- Permissões de admin
- CRUD completo de usuários, film states, palpites, resultados oficiais

**Frontend (76 testes):**
- Reducer do AppContext (10)
- MovieCard, MovieModal, Toast, CompareRow (20)
- WatchlistPage: filtros, busca, empty state (5)
- PredictionsPage: login prompt, listagem de categorias (4)
- OscarNightPage: score ao vivo, listagem (4)
- ComparePage: seleção de usuários, comparação (8)
- Utilitários: safeUrl, compareReport (25)

---

## 📱 Build para Android (APK)

```bash
cd client

# 1. Compilar o frontend
npm run build

# 2. Sincronizar com Capacitor
npm run cap:sync

# 3. Abrir no Android Studio
npm run cap:open

# Ou executar direto no dispositivo conectado
npm run cap:run
```

---

## 🗂️ Adicionando uma Nova Edição

```bash
# Script interativo
npm run new-edition
```

Ou manualmente:
1. Adicione a entrada em `data/editions.json` com `"current": true`
2. Crie a pasta `data/editions/{id}/`
3. Adicione `films.json` e `categories.json` nessa pasta

### Estrutura de `categories.json`

```json
[
  {
    "id": "melhor-filme",
    "name": "Melhor Filme",
    "highlight": true,
    "nominees": [
      {
        "id": "nom-oppenheimer",
        "filmId": "oppenheimer",
        "nomineeName": null
      }
    ]
  }
]
```

> O campo `nomineeName` é usado em categorias de performance (Melhor Ator, etc.) onde o indicado é uma pessoa, não o filme inteiro.

### Estrutura de `films.json`

```json
[
  {
    "id": "oppenheimer",
    "title": "Oppenheimer",
    "year": 2023,
    "director": "Christopher Nolan",
    "nominations": 13,
    "imdbRating": "8.9",
    "poster": null,
    "availabilityStatus": "available",
    "watchLinks": [
      { "label": "Netflix", "url": "https://netflix.com/..." }
    ]
  }
]
```

---

## 🌐 Deploy em Produção

### Variáveis obrigatórias em produção

```env
NODE_ENV=production
TURSO_URL=libsql://seu-banco.turso.io
TURSO_AUTH_TOKEN=seu-token-turso
JWT_SECRET=segredo-longo-e-aleatorio-min-32-chars
JWT_REFRESH_SECRET=outro-segredo-longo-e-diferente
ADMIN_PASSWORD=senha-forte-do-admin
CORS_ORIGIN=https://seudominio.com
```

### Pôsteres em produção

Os pôsteres são baixados automaticamente na inicialização do servidor e salvos em `client/public/assets/covers/`. Para forçar o re-download:

```bash
npm run posters          # Baixa somente pôsteres faltando
npm run posters:force    # Re-baixa todos os pôsteres
```

Fontes de pôsteres (em ordem de prioridade):
1. **TMDB** (requer `TMDB_API_KEY`) — maior qualidade
2. **OMDB** (requer `OMDB_API_KEY`) — alternativa
3. **Wikidata** — público, sem chave
4. **Wikipedia** — fallback final, sem chave

---

## 📊 Banco de Dados

### Tabelas

| Tabela | Descrição |
|---|---|
| `users` | username, password_hash, role (user/admin), is_active, is_private |
| `user_film_states` | Estado por filme por usuário: watched, personal_rating, personal_notes |
| `user_predictions` | Palpites: user_id + category_id + edition → nominee_id |
| `official_results` | Vencedores oficiais por categoria e edição (somente admin) |
| `refresh_tokens` | Tokens de refresh: hash SHA-256, TTL, flag de revogação |

### Conta admin padrão

Na primeira inicialização, um usuário `admin` é criado automaticamente com a senha definida em `ADMIN_PASSWORD` (padrão: `admin123`). **Troque a senha imediatamente em produção.**

---

## 🏆 Multi-Premiações

O app suporta múltiplas premiações configuradas em `data/awards.json`:

| Premiação | ID | Status padrão |
|---|---|---|
| Oscar (Academy Awards) | `oscar` | ativo |
| Grammy Awards | `grammy` | inativo |
| Emmy Awards | `emmy` | inativo |
| Globo de Ouro | `golden-globes` | inativo |

Para ativar uma premiação, defina `"active": true` no `awards.json` e adicione as edições correspondentes em `editions.json` com o `award_id` correto.

---

## 🔄 Fluxo de Autenticação JWT

```
Usuário faz login
       ↓
Servidor retorna:
  • accessToken (JWT 15min) → armazenado em memória React
  • refreshToken (JWT 7d)   → cookie HttpOnly oscar_refresh
       ↓
Request autenticado:
  Authorization: Bearer <accessToken>
       ↓
Token expira (15min) → api.js intercepta 401
       ↓
POST /api/auth/refresh (cookie enviado automaticamente pelo browser)
       ↓
Novo accessToken + novo refreshToken (rotação automática)
       ↓
Request original é repetido com o novo token
```

---

## 📝 Licença

Projeto pessoal — uso livre para fins educacionais e não comerciais.
