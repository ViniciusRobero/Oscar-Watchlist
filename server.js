// Load .env if present
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch { }

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { loadFilms, loadCategories, loadEditions, loadAwards } = require('./data/services/editionService');
const { buildBootstrapAsync } = require('./data/services/bootstrapService');
const { migrateSchema, ensureDefaultAdmin } = require('./data/auth');
const { fetchPosterUrl, downloadFile, updateFilmPosterUrl, prefetchAllPosters } = require('./lib/poster');
const { syncResults } = require('./data/services/resultsImporter');

const usersRouter = require('./routes/users');
const predictionsRouter = require('./routes/predictions');
const resultsRouter = require('./routes/results');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const COVERS_DIR = path.join(__dirname, 'client', 'public', 'assets', 'covers');

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.use('/assets', express.static(path.join(__dirname, 'client', 'public', 'assets')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ── Rate limiters ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 60000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas. Tente novamente em 1 minuto.' } });
const registerLimiter = rateLimit({ windowMs: 60000, max: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas de registro. Tente novamente em 1 minuto.' } });

// ── API Routes ───────────────────────────────────────────────────────────────
app.get('/api/bootstrap', async (req, res, next) => {
  try {
    const data = await buildBootstrapAsync(
      String(req.query.username || '').trim(),
      req.query.edition || ''
    );
    res.json(data);
  } catch (e) { next(e); }
});

app.get('/api/awards', (_req, res) => res.json(loadAwards()));
app.get('/api/editions', (_req, res) => res.json(loadEditions()));
app.get('/api/films', (req, res) => res.json(loadFilms(req.query.edition || '')));
app.get('/api/categories', (req, res) => res.json(loadCategories(req.query.edition || '')));

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/results', resultsRouter);
app.use('/api/admin', adminRouter);

// ── Poster proxy (lazy-download, multi-source) ───────────────────────────────
app.get('/api/poster/:filmId', async (req, res) => {
  const filmId = String(req.params.filmId || '').trim();
  const edition = req.query.edition || '';
  if (!filmId) return res.json({ posterUrl: null });

  const localFile = path.join(COVERS_DIR, `${filmId}.jpg`);
  if (fs.existsSync(localFile) && fs.statSync(localFile).size > 3000) {
    return res.json({ posterUrl: `/assets/covers/${filmId}.jpg` });
  }

  const film = loadFilms(edition).find(f => f.id === filmId);
  if (!film) return res.json({ posterUrl: null });

  try {
    const posterUrl = await fetchPosterUrl(film);
    if (!posterUrl) return res.json({ posterUrl: null });
    await downloadFile(posterUrl, localFile);
    updateFilmPosterUrl(filmId, `/assets/covers/${filmId}.jpg`, edition);
    res.json({ posterUrl: `/assets/covers/${filmId}.jpg` });
  } catch {
    res.json({ posterUrl: null });
  }
});

app.post('/api/poster/refresh-all', (_req, res) => {
  prefetchAllPosters(COVERS_DIR).catch(() => {});
  res.json({ ok: true, message: 'Buscando capas em background...' });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// ── Startup ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  migrateSchema()
    .then(() => ensureDefaultAdmin())
    .then(() => {
      app.listen(PORT, () => {
        const editions = loadEditions();
        const current = editions.find(e => e.current) || editions[0];
        console.log(`\n  🎬  Oscar Watchlist v6 -> http://localhost:${PORT}`);
        console.log(`  📅  Edição ativa: ${current?.label || 'N/A'}`);
        if (process.env.TMDB_API_KEY) {
          console.log(`  ✓   TMDB API configurada — capas em alta qualidade\n`);
        } else if (process.env.OMDB_API_KEY) {
          console.log(`  ✓   OMDB API configurada\n`);
        } else {
          console.log(`  📷  Baixando capas via Wikipedia (sem chave de API necessária)...`);
          console.log(`  💡  Para capas de maior qualidade: TMDB_API_KEY=sua_chave npm start\n`);
        }
        prefetchAllPosters(COVERS_DIR).catch(() => {});
        scheduleResultsSync();
      });
    })
    .catch(err => {
      console.error('Falha na inicialização do servidor:', err);
      process.exit(1);
    });
}

// ── Results auto-sync cron ────────────────────────────────────────────────────
// Runs every 15 min on Sundays & Mondays in March (Oscar ceremony window)
// Ceremony typically: 1st/2nd Sunday of March, ~8pm ET = ~01:00 UTC Monday
// Schedule: */15 22,23,0,1,2,3,4,5 * 3 0,1  (UTC)
// Can be overridden with RESULTS_SYNC_CRON env var
function scheduleResultsSync() {
  let cron;
  try { cron = require('node-cron'); } catch { return; }

  const schedule = process.env.RESULTS_SYNC_CRON || '*/15 22,23,0,1,2,3,4,5 * 3 0,1';
  if (!cron.validate(schedule)) {
    console.warn('[cron] RESULTS_SYNC_CRON inválido, ignorando.');
    return;
  }

  cron.schedule(schedule, async () => {
    console.log('[cron] Sincronizando resultados oficiais...');
    try {
      const log = await syncResults('');
      console.log(`[cron] Sync OK — fonte: ${log.source}, matched: ${log.matched.length}, unmatched: ${log.unmatched.length}`);
    } catch (e) {
      console.error('[cron] Sync error:', e.message);
    }
  }, { timezone: 'UTC' });

  console.log(`  ⏰  Auto-sync resultados Oscar: ${schedule} (UTC)`);
}

module.exports = app;
