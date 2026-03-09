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
const https = require('https');
const http = require('http');
const fs = require('fs');
const { buildBootstrap, loadFilms, loadCategories, loadEditions, resolveEdition, saveFilms } = require('./data/db');

const usersRouter = require('./routes/users');
const predictionsRouter = require('./routes/predictions');
const resultsRouter = require('./routes/results');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const COVERS_DIR = path.join(__dirname, 'client', 'public', 'assets', 'covers');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.use('/assets', express.static(path.join(__dirname, 'client', 'public', 'assets')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ── API ──────────────────────────────────────────────────────
app.get('/api/bootstrap', (req, res) => {
  const username = String(req.query.username || '').trim();
  const edition = req.query.edition || '';
  res.json(buildBootstrap(username, edition));
});

app.get('/api/editions', (_req, res) => res.json(loadEditions()));

app.get('/api/films', (req, res) => {
  const edition = req.query.edition || '';
  res.json(loadFilms(edition));
});

app.get('/api/categories', (req, res) => {
  const edition = req.query.edition || '';
  res.json(loadCategories(edition));
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/results', resultsRouter);

// ── HTTP helpers ────────────────────────────────────────────────────────────
function fetchHttp(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { headers: { 'User-Agent': 'OscarWatchlist/6 node.js' } };
    const req = mod.get(url, opts, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
        return fetchHttp(r.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchJson(url) {
  const r = await fetchHttp(url);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  return JSON.parse(r.body.toString('utf8'));
}

async function downloadFile(url, dest) {
  const r = await fetchHttp(url);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  if (r.body.length < 3000) throw new Error('Too small');
  fs.writeFileSync(dest, r.body);
}

function updateFilmPosterUrl(filmId, posterUrl, editionId) {
  try {
    const eid = resolveEdition(editionId);
    const films = loadFilms(eid);
    const film = films.find((f) => f.id === filmId);
    if (film) {
      film.poster = posterUrl;
      saveFilms(films, eid);
    }
  } catch { }
}

// ── Poster sources ───────────────────────────────────────────────────────────
async function getPosterFromTMDB(imdbId) {
  const key = process.env.TMDB_API_KEY;
  if (!key || !imdbId) throw new Error('no tmdb');
  const d = await fetchJson(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${key}&external_source=imdb_id`);
  const item = [...(d.movie_results || []), ...(d.tv_results || [])][0];
  if (!item?.poster_path) throw new Error('no poster');
  return `https://image.tmdb.org/t/p/w500${item.poster_path}`;
}

async function getPosterFromOMDB(imdbId) {
  const key = process.env.OMDB_API_KEY;
  if (!key || !imdbId) throw new Error('no omdb');
  const d = await fetchJson(`https://www.omdbapi.com/?i=${imdbId}&apikey=${key}`);
  if (!d.Poster || d.Poster === 'N/A') throw new Error('no poster');
  return d.Poster;
}

async function getPosterFromWikidata(imdbId) {
  if (!imdbId) throw new Error('no id');
  const crypto = require('crypto');
  const sparql = `SELECT ?article ?image WHERE {
    ?item wdt:P345 "${imdbId}" .
    OPTIONAL { ?item wdt:P18 ?image . }
    OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  } LIMIT 1`;
  const d = await fetchJson(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`);
  const b = d?.results?.bindings?.[0];
  if (!b) throw new Error('not found');
  if (b.image?.value) {
    const fn = decodeURIComponent(b.image.value.split('/').pop()).replace(/ /g, '_');
    const md5 = crypto.createHash('md5').update(fn).digest('hex');
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5[0]}${md5[1]}/${encodeURIComponent(fn)}/400px-${encodeURIComponent(fn)}`;
  }
  if (b.article?.value) {
    const title = decodeURIComponent(b.article.value.split('/wiki/')[1] || '');
    if (!title) throw new Error('no title');
    const img = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=500`);
    const page = Object.values(img?.query?.pages || {})[0];
    if (!page?.thumbnail?.source) throw new Error('no img');
    return page.thumbnail.source;
  }
  throw new Error('no data');
}

async function getPosterFromWikipedia(title) {
  try {
    const d = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (d.thumbnail?.source) return d.thumbnail.source.replace(/\/\d+px-/, '/500px-');
  } catch { }
  const s = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title + ' film')}&srlimit=1&format=json`);
  const pt = s?.query?.search?.[0]?.title;
  if (!pt) throw new Error('not found');
  const d = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pt)}&prop=pageimages&format=json&pithumbsize=500`);
  const page = Object.values(d?.query?.pages || {})[0];
  if (!page?.thumbnail?.source) throw new Error('no img');
  return page.thumbnail.source;
}

async function fetchPosterUrl(film) {
  const imdbId = film.imdbUrl?.match(/tt\d+/)?.[0];
  const sources = [
    () => getPosterFromTMDB(imdbId),
    () => getPosterFromOMDB(imdbId),
    () => getPosterFromWikidata(imdbId),
    () => getPosterFromWikipedia(film.title),
  ];
  for (const fn of sources) {
    try { return await fn(); } catch { }
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

// ── Poster proxy (lazy-download, multi-source) ──────────────────────────────
app.get('/api/poster/:filmId', async (req, res) => {
  const filmId = String(req.params.filmId || '').trim();
  const edition = req.query.edition || '';
  if (!filmId) return res.json({ posterUrl: null });

  const localFile = path.join(COVERS_DIR, `${filmId}.jpg`);
  if (fs.existsSync(localFile) && fs.statSync(localFile).size > 3000) {
    return res.json({ posterUrl: `/assets/covers/${filmId}.jpg` });
  }

  const films = loadFilms(edition);
  const film = films.find((f) => f.id === filmId);
  if (!film) return res.json({ posterUrl: null });

  try {
    const posterUrl = await fetchPosterUrl(film);
    if (!posterUrl) return res.json({ posterUrl: null });
    await downloadFile(posterUrl, localFile);
    updateFilmPosterUrl(filmId, `/assets/covers/${filmId}.jpg`, edition);
    res.json({ posterUrl: `/assets/covers/${filmId}.jpg` });
  } catch (e) {
    res.json({ posterUrl: null });
  }
});

// Prefetch all posters in background on startup
async function prefetchAllPosters() {
  const films = loadFilms();
  const missing = films.filter((f) => {
    const lf = path.join(COVERS_DIR, `${f.id}.jpg`);
    return !fs.existsSync(lf) || fs.statSync(lf).size < 3000;
  });
  if (missing.length === 0) return;
  console.log(`  📷  Buscando capas para ${missing.length} filmes em background...`);
  for (const film of missing) {
    try {
      const url = await fetchPosterUrl(film);
      if (url) {
        const dest = path.join(COVERS_DIR, `${film.id}.jpg`);
        await downloadFile(url, dest);
        updateFilmPosterUrl(film.id, `/assets/covers/${film.id}.jpg`);
        process.stdout.write('.');
      }
    } catch { process.stdout.write('x'); }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('\n  ✓   Capas atualizadas!');
}

// Bulk poster refresh
app.post('/api/poster/refresh-all', (_req, res) => {
  prefetchAllPosters().catch(() => { });
  res.json({ ok: true, message: 'Buscando capas em background...' });
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  const editions = loadEditions();
  const current = editions.find(e => e.current) || editions[0];
  console.log(`\n  🎬  Oscar Watchlist v6 → http://localhost:${PORT}`);
  console.log(`  📅  Edição ativa: ${current?.label || 'N/A'}`);
  if (process.env.TMDB_API_KEY) {
    console.log(`  ✓   TMDB API configurada — capas em alta qualidade\n`);
  } else if (process.env.OMDB_API_KEY) {
    console.log(`  ✓   OMDB API configurada\n`);
  } else {
    console.log(`  📷  Baixando capas via Wikipedia em background (sem chave necessária)...`);
    console.log(`  💡  Para capas de maior qualidade: TMDB_API_KEY=sua_chave npm start\n`);
  }
  // Always try to prefetch missing posters using available sources
  prefetchAllPosters().catch(() => { });
});
