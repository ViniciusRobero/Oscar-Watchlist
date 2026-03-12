# 🏆 Oscar Watchlist

> Track every nominated film, register your predictions, and compare results with friends on award night.

A full-stack personal watchlist and prediction tracker built around major award ceremonies — primarily the Academy Awards. Built for personal use, but structured to support multiple users, multiple award shows, and mobile access.

---

## Overview

Oscar Watchlist lets a group of friends:

- **Track** every nominated film — mark as watched, rate it (0–10), add notes
- **Predict** winners for each category before the ceremony
- **Compare** predictions with other users
- **Follow award night live** — see official results and check who got the most right
- **Explore the timeline** of their activity throughout the season

The app supports multiple award shows (Oscars, Grammys, Emmys, Golden Globes) and multiple editions per show, making it reusable year after year.

---

## Features

### Watchlist
- Browse all nominated films for the current edition
- Mark films as watched / unwatched with one click
- Rate films on a 0–10 scale
- Add personal notes (up to 600 characters)

### Predictions
- Pick a winner for each category from the official nominee list
- Predictions saved per user, per category, per edition

### Award Night Mode
- Official results entered by admin → app shows correct/incorrect per category
- Overall accuracy score and per-category breakdown
- Admin can enter results manually or trigger automatic sync from Wikipedia / Wikidata

### User Profiles & Privacy
- Each user has a `@nick`, first/last name, email, and birth date
- Users control whether their profile is available for comparison (`is_private` toggle)
- No public user list — other users are only visible via the predictions comparison feature

### User Comparison
- Compare your predictions with any non-private user side by side

### Activity Timeline
- Tracks film watches, ratings, and predictions made throughout the season
- Visible to the user themselves; visible publicly for non-private users

### Multi-Award Support
- Awards defined in `data/awards.json` (Oscar, Grammy, Emmy, Golden Globes)
- Editions defined in `data/editions.json` and `data/editions/{id}/`
- Hub page shows an award picker when multiple shows are active
- Currently only Oscar 2026 edition is active

### Admin Panel
- View all registered users with stats (watched, predictions, ratings)
- Activate / deactivate users; delete users (cascade)
- Force-change user passwords; unblock brute-force locked accounts
- Trigger manual results sync or view last sync log

### Poster System
- Posters fetched on-demand and cached locally under `apps/web/public/assets/covers/`
- Source priority: TMDB → OMDB → Wikidata → Wikipedia (no API key required for fallbacks)

### Welcome Email
- New registrations receive a styled welcome email via Resend (optional, skipped if key absent)

### PWA (Progressive Web App)
- Installable on Android and iOS from the browser — no app store needed
- Offline support via service worker (watchlist and predictions cached)
- Add to Home Screen from Chrome / Safari for app-like experience

### Mobile (Capacitor)
- Android APK can be built from the React frontend via Capacitor
- APK uses `VITE_API_URL` to point to the backend server on your local network

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full reference.

| Layer | Stack |
|---|---|
| Backend | Node.js 20+, Express 4 — `apps/api/` |
| Frontend | React 18, Vite, TailwindCSS, Framer Motion — `apps/web/` |
| Database | SQLite (local) or Turso (remote) via `@libsql/client` |
| Auth | JWT — access token in React memory, refresh token in HttpOnly cookie |
| Email | Resend SDK (optional) |
| Mobile | Capacitor + Android |

---

## Repository Structure

```
Oscar-Watchlist/
├── apps/
│   ├── api/                     Node/Express backend
│   │   ├── src/
│   │   │   ├── config/          DB client factory
│   │   │   ├── routes/          API routers (auth, users, predictions, results, admin)
│   │   │   ├── middleware/      JWT auth + role guards
│   │   │   ├── lib/             bruteForce, poster fetching
│   │   │   ├── services/        bootstrap, editions, email, results sync
│   │   │   ├── repositories/    DB CRUD (user, film, prediction, result, token, log)
│   │   │   └── auth.js          Password helpers + schema migrations
│   │   ├── tests/               Jest integration tests
│   │   ├── scripts/             Poster download, edition updater, DB migration
│   │   └── server.js            Express entry point
│   └── web/                     React frontend (Vite)
│       ├── src/
│       │   ├── api.js           Fetch wrapper + JWT auto-refresh
│       │   ├── context/         Global state (auth, films, predictions)
│       │   ├── hooks/           useAuth, useEdition, useFilmState, usePredictions
│       │   ├── pages/           HubPage, WatchlistPage, PredictionsPage, …
│       │   └── components/      Layout, MovieCard, MovieModal, Toast
│       ├── android/             Capacitor Android project
│       └── package.json
├── data/                        Static JSON + SQLite DB
│   ├── awards.json              Award show definitions
│   ├── editions.json            Edition metadata (year, award_id, current flag)
│   ├── editions/2026/           Oscar 2026 films, categories, state
│   └── schema.sql               DB schema reference
├── docs/
│   └── ARCHITECTURE.md          Architecture deep-dive
├── .env                         Secrets (git-ignored)
├── .env.example                 Environment variable template
├── capacitor.config.json        Capacitor config (root — webDir: apps/web/dist)
├── package.json                 Root scripts + backend dependencies
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 20+ — `node -v`
- **npm** 9+
- *(Android builds only)* Android Studio + Java 17+

### 1. Clone & Install

```bash
git clone https://github.com/ViniciusRobero/Oscar-Watchlist.git
cd Oscar-Watchlist
npm install           # backend dependencies
npm run build         # installs frontend deps + produces apps/web/dist/
```

### 2. Configure Environment

```bash
cp .env.example .env
# The defaults work for local development with no changes required.
# Add TMDB_API_KEY for better poster quality (optional but recommended).
```

### 3. Run — Production Mode

```bash
npm start
# → http://localhost:3000
```

### 4. Run — Development Mode (hot reload)

```bash
# Terminal 1 — backend
npm run dev:server

# Terminal 2 — frontend (Vite dev server + proxy)
npm run dev:client
# → http://localhost:5173
```

### 5. Default Admin Account

On first startup the server creates:
- **nick / login**: `admin`
- **password**: `admin`

Change the password via the admin panel after first login.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TURSO_URL` | `file:data/local.db` | SQLite / Turso database URL |
| `TURSO_AUTH_TOKEN` | — | Auth token for remote Turso |
| `JWT_SECRET` | dev string | Access token signing key — **change in production** |
| `JWT_REFRESH_SECRET` | dev string | Refresh token signing key — **change in production** |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `development` or `production` |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `TMDB_API_KEY` | — | TMDB key for high-quality posters (optional) |
| `OMDB_API_KEY` | — | OMDB key — poster fallback (optional) |
| `RESEND_API_KEY` | — | Resend key — welcome emails (optional) |
| `EMAIL_FROM` | — | Sender address (requires verified domain in Resend) |
| `RESULTS_SYNC_CRON` | `*/15 22,23,0,1,2,3,4,5 * 3 0,1` | Cron for Oscar night auto-sync (UTC) |
| `NEWS_API_KEY` | — | NewsAPI key — headlines in admin sync panel (optional) |

Full documentation: [.env.example](.env.example)

---

## API Overview

All routes under `/api`. Auth uses `Authorization: Bearer <accessToken>`.

### Authentication — `/api/auth`
| Method | Path | Description |
|---|---|---|
| `POST` | `/login` | Login with nick + password |
| `POST` | `/register` | Register new user |
| `POST` | `/refresh` | Renew access token via HttpOnly cookie |
| `POST` | `/logout` | Revoke session |

### Users — `/api/users`
| Method | Path | Auth |
|---|---|---|
| `GET` | `/:nick/timeline` | Optional |
| `PATCH` | `/:username/films/:filmId` | Required |
| `PATCH` | `/:username/settings` | Required |

### Predictions — `/api/predictions`
| Method | Path | Auth |
|---|---|---|
| `PATCH` | `/:username/:categoryId` | Required |

### Results — `/api/results`
| Method | Path | Auth |
|---|---|---|
| `PATCH` | `/official/:categoryId` | Admin |
| `GET` | `/compare/users?left=&right=` | Public |
| `GET` | `/compare/official/:username` | Public |

### Data — `/api`
| Method | Path |
|---|---|
| `GET` | `/bootstrap?username=&edition=` |
| `GET` | `/awards` |
| `GET` | `/editions` |
| `GET` | `/films?edition=` |
| `GET` | `/categories?edition=` |
| `GET` | `/poster/:filmId?edition=` |

### Admin — `/api/admin` *(admin only)*
| Method | Path |
|---|---|
| `GET` | `/users?edition=` |
| `PATCH` | `/users/:username/status` |
| `DELETE` | `/users/:username` |
| `PATCH` | `/users/:nick/password` |
| `POST` | `/users/:username/unblock` |
| `POST` | `/results/sync` |
| `GET` | `/results/sync/status` |

---

## Data Model

### Database Tables

| Table | Purpose |
|---|---|
| `users` | Accounts — nick (unique), email, role, is_private, profile fields |
| `user_film_states` | Watch status, rating (0–10), notes per user/film/edition |
| `user_predictions` | Category predictions per user/edition |
| `official_results` | Official winners per category/edition |
| `refresh_tokens` | JWT refresh token revocation store |
| `user_logs` | Activity audit log (watches, ratings, predictions) |

### JSON Files

| File | Purpose |
|---|---|
| `data/awards.json` | Award show definitions (id, name, type, active) |
| `data/editions.json` | Editions with `award_id` reference and `current` flag |
| `data/editions/{id}/films.json` | Films with TMDB ID, title, director, poster URL |
| `data/editions/{id}/categories.json` | Categories with nominee arrays |

---

## PWA — Install on Mobile

The app is a full PWA. No APK needed for most use cases.

1. Open the app URL in Chrome (Android) or Safari (iOS)
2. Tap **"Add to Home Screen"** / **"Install App"** from the browser menu
3. The app installs with offline support and a native-like experience

---

## Mobile / Capacitor (APK)

```bash
# From apps/web/
npm run cap:sync     # build React + sync to Android project
npm run cap:open     # open Android Studio
npm run cap:run      # run on connected device / emulator
```

### APK — Connect to Backend

The APK bundles the frontend but must reach the backend server over the network.
Create `apps/web/.env.local` before building:

```env
# Replace with your machine's local network IP
VITE_API_URL=http://192.168.1.100:3000
```

Then rebuild and sync:

```bash
cd apps/web
npm run cap:sync
```

> The server must be running and reachable on your local network.
> Android 9+ requires HTTPS for cleartext HTTP — use the same Wi-Fi network or set up a reverse proxy with HTTPS.

- Config: `apps/web/capacitor.config.json`
- Root `capacitor.config.json` has `webDir: "apps/web/dist"`

---

## Testing

### Backend — Jest + Supertest

```bash
npm test                                      # all 38 tests
npm test -- --testPathPattern=auth            # single suite
```

Each test suite creates its own isolated SQLite DB in `data/`.

### Frontend — Vitest + Testing Library

```bash
cd apps/web
npm test          # watch mode
npm run test:run  # single run
```

Tests live in `apps/web/src/test/` — components, context, pages, helpers.

---

## Troubleshooting

**Port already in use**
```bash
npx kill-port 3000
```

**Blank page / module not found after pulling**
```bash
npm install && npm run build
```

**Posters not loading**
Adding `TMDB_API_KEY` to `.env` gives best results. Run `npm run posters:force` to force re-download all posters.

**Locked out of account**
5 failed logins trigger a 15-minute lockout. Admin can unblock from the admin panel → Users → Unblock.

**JWT errors / unable to login**
Clear browser cookies for `localhost:3000`.

**Email not arriving**
Without a verified Resend domain, use `EMAIL_FROM=onboarding@resend.dev` — emails only go to the Resend account owner's email. No `RESEND_API_KEY` = emails silently skipped.

**CORS error in dev**
Confirm `CORS_ORIGIN=http://localhost:5173` in `.env` and that `npm run dev:client` is running on port 5173.

---

## Security Notes

- Access tokens stored only in React state — never in `localStorage`
- Refresh tokens: HttpOnly + Secure cookie + DB revocation (7-day expiry)
- Passwords: bcryptjs 12 rounds; legacy PBKDF2 hashes supported for backward compatibility
- Brute force: 5 failures → 15-minute lockout per nick (in-memory)
- Rate limiting: 10 req/min login, 5 req/min register
- All DB queries use parameterized statements — no SQL injection
- Always set random 64-char `JWT_SECRET` and `JWT_REFRESH_SECRET` in production

---

## Roadmap

### Short-term
- [ ] Predictions export as CSV
- [ ] Persistent session opt-in (remember me)
- [ ] Better mobile UI polish

### Medium-term
- [ ] Prediction lock deadline — freeze predictions N hours before ceremony
- [ ] Friend groups / private prediction pools
- [ ] Ranking history across editions
- [ ] Email reminders before ceremony
- [ ] PWA support (installable, offline-capable)

### Long-term
- [ ] Grammy, Emmy, Golden Globes editions fully populated
- [ ] Historical archive (pre-2026 editions)
- [ ] Analytics dashboards (accuracy trends, category difficulty)
- [ ] Internationalization (PT/EN)
- [ ] Richer social features (comments, reactions)

---

## Notes for Future Contributors and AI Agents

- Run `npm test` before any commit — all 38 tests must pass
- `data/` at project root is **runtime data**, not source code
- `editionService.js` uses `process.cwd()` to resolve `data/` — keep this as-is
- Backend uses CommonJS (`require`); frontend uses ESM (`import`) — do not mix
- When moving files, always update `require()` paths and verify with `npm test`
- To add a new edition: `npm run new-edition` (interactive CLI script)
- Do not change DB column names or JSON keys without a migration plan

---

*Built with Node.js + React + SQLite. Personal project for Oscar season.*
