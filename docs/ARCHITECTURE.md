# Architecture Overview — Oscar Watchlist

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20+, Express 4 |
| Database | SQLite via `@libsql/client` (local) or Turso (remote) |
| Auth | JWT — access token in React memory, refresh token in HttpOnly cookie |
| Frontend | React 18, Vite, TailwindCSS, Framer Motion, Lucide |
| Email | Resend SDK (optional) |
| Mobile | Capacitor + Android |
| Tests | Jest + Supertest (backend), Vitest + Testing Library (frontend) |

---

## Repository Layout

```
Oscar-Watchlist/
├── apps/
│   ├── api/                     Node/Express backend
│   │   ├── src/
│   │   │   ├── config/db.js     Turso/SQLite client factory
│   │   │   ├── routes/          Express routers (auth, users, predictions, results, admin)
│   │   │   ├── middleware/auth.js  JWT verify + role guards
│   │   │   ├── lib/             bruteForce.js, poster.js
│   │   │   ├── services/        bootstrapService, editionService, emailService, resultsImporter
│   │   │   ├── repositories/    DB CRUD (user, film, prediction, result, token, log)
│   │   │   └── auth.js          bcrypt helpers + schema migrations
│   │   ├── tests/               Jest integration tests
│   │   ├── scripts/             Utility scripts (posters, edition updater, migration)
│   │   └── server.js            Express entry point
│   └── web/                     React frontend (Vite)
│       ├── src/
│       │   ├── api.js           Fetch wrapper with JWT + auto-refresh
│       │   ├── context/         AppContext — global auth/film/prediction state
│       │   ├── hooks/           useAuth, useEdition, useFilmState, usePredictions
│       │   ├── pages/           HubPage, WatchlistPage, PredictionsPage, …
│       │   └── components/      Layout, MovieCard, MovieModal, Toast
│       └── package.json
├── data/                        Static JSON + SQLite database (git-ignored: local.db)
│   ├── awards.json              Award definitions (Oscar, Grammy, Emmy, Golden Globes)
│   ├── editions.json            Edition metadata (year, award_id, current flag)
│   ├── editions/2026/           Edition-specific films.json, categories.json, state.json
│   ├── schema.sql               DB schema reference
│   └── local.db                 SQLite file (local dev only)
├── docs/                        Architecture docs (this file)
├── public/assets/               Extra static assets served by Express
├── .env                         Secrets (git-ignored)
├── .env.example                 Template for setting up .env
├── capacitor.config.json        Capacitor/Android config
└── package.json                 Root — scripts, Jest config, backend deps
```

---

## Authentication Flow

```
Client                     Server
  │                           │
  ├──POST /api/auth/login─────►│ verifies nick + password
  │                           │ generates access token (JWT, 15min)
  │                           │ generates refresh token (JWT, 7d)
  │                           │ stores refresh token hash in DB
  │◄──accessToken + cookie────┤ sets HttpOnly cookie "oscar_refresh"
  │                           │
  │ [stores accessToken       │
  │  in React state only]     │
  │                           │
  ├──GET /api/* (Bearer)──────►│ verifyAccess() → req.user
  │                           │
  │ [15min later, 401]        │
  ├──POST /api/auth/refresh───►│ reads cookie, verifies refresh token
  │                           │ revokes old token, issues new pair
  │◄──new accessToken + cookie┤
```

---

## Predictions & Results Flow

```
User makes prediction          Admin sets official result
        │                               │
PATCH /api/predictions/:user/:cat   PATCH /api/results/official/:cat
        │                               │
  user_predictions table          official_results table
        │                               │
        └──────────────────────────────►│
                                        │
                    GET /api/results/compare/official/:user
                                        │
                              Returns: correct / wrong per category
```

---

## Data Architecture

### Database (SQLite / Turso)
- `users` — id, username, nick (unique), email, password_hash, role, is_active, is_private, profile fields
- `user_film_states` — watched, personal_rating (0–10), personal_notes (per user, film, edition)
- `user_predictions` — nominee_id per category per user per edition
- `official_results` — winner_nominee_id per category per edition
- `refresh_tokens` — token_hash, expires_at, revoked (JWT refresh token revocation)
- `user_logs` — action_type, entity_id, entity_type, metadata (activity audit log)

### File-Based Data (data/)
- `awards.json` — defines award types (Oscar, Grammy, etc.)
- `editions.json` — links editions to awards, marks `current: true`
- `editions/{id}/films.json` — films for that edition
- `editions/{id}/categories.json` — categories with nominees
- Fallback: root `data/films.json` and `data/categories.json` if edition-specific files missing

### Multi-Edition Support
The same backend supports multiple award ceremonies. Each edition links to an award via `award_id`. The `HubPage` shows an award selector when multiple awards are active. Currently only the Oscar 2026 edition is active.

---

## Security Model

| Feature | Implementation |
|---|---|
| Password hashing | bcryptjs (12 rounds) + legacy PBKDF2 fallback |
| JWT access token | In React memory only (never localStorage) |
| JWT refresh token | HttpOnly, Secure, SameSite cookie — hash stored in DB |
| Brute force | In-memory lockout: 5 failures → 15min lockout per nick |
| Rate limiting | express-rate-limit: 10/min login, 5/min register |
| CORS | Configurable via `CORS_ORIGIN` env var |
| Admin access | `role='admin'` in DB — checked by `requireAdmin` middleware |

---

## Poster Fetching

```
Request /api/poster/:filmId
        │
        ├── Check local cache (client/public/assets/covers/{id}.jpg)
        │   └── exists + size > 3KB → return cached
        │
        └── Fetch from sources (in order):
            1. TMDB API (TMDB_API_KEY required)
            2. OMDB API (OMDB_API_KEY required)
            3. Wikidata SPARQL (no key needed)
            4. Wikipedia scraping (no key needed)
                    │
                    └── Download + cache → return URL
```

---

## Results Auto-Sync

On Oscar ceremony night, a cron job runs every 15 minutes (configurable via `RESULTS_SYNC_CRON`) and attempts to fetch official winners from:

1. **Wikipedia** (wikitext API, parsed for bold entries = winners)
2. **Wikidata SPARQL** (structured query, fallback if Wikipedia unavailable)
3. **NewsAPI** (headlines only — no auto-match, shown in admin panel)

Matched winners are saved to `official_results` table. Unmatched entries are shown in the admin panel for manual entry.

Admin can also trigger sync manually via the "Sincronizar Resultados" button in the admin panel.
