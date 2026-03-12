/**
 * Oscar Watchlist v6 — Baixador de Capas
 * ----------------------------------------
 * Baixa as capas de todos os 50 filmes usando múltiplas fontes:
 *   1. TMDB (alta qualidade — set TMDB_API_KEY no .env)
 *   2. OMDB (set OMDB_API_KEY no .env)
 *   3. Wikipedia REST API (gratuita, sem chave)
 *   4. Wikidata SPARQL (gratuita, sem chave)
 *
 * Uso:
 *   node scripts/download-posters.js
 *   node scripts/download-posters.js --force   (rebaixa mesmo que já exista)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env
try {
  const envPath = path.resolve(process.cwd(), '.env');
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
} catch {}

const FORCE = process.argv.includes('--force');
const FILMS_PATH = path.resolve(process.cwd(), 'data', 'films.json');
const COVERS_DIR = path.join(__dirname, '../../web', 'public', 'assets', 'covers');
fs.mkdirSync(COVERS_DIR, { recursive: true });

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function fetchHttp(url, redirects = 0) {
  if (redirects > 6) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'OscarWatchlistBot/6.0 (educational)' }
    }, (r) => {
      if ([301,302,303,307,308].includes(r.statusCode) && r.headers.location)
        return fetchHttp(r.headers.location, redirects + 1).then(resolve).catch(reject);
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
      r.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
async function fetchJson(url) {
  const r = await fetchHttp(url);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  return JSON.parse(r.body.toString('utf8'));
}
async function downloadImage(url, dest) {
  const r = await fetchHttp(url);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  if (r.body.length < 3000) throw new Error('image too small');
  fs.writeFileSync(dest, r.body);
}

// ── Sources ───────────────────────────────────────────────────────────────────
async function fromTMDB(imdbId) {
  const key = process.env.TMDB_API_KEY;
  if (!key || !imdbId) throw new Error('no key');
  const d = await fetchJson(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${key}&external_source=imdb_id`);
  const item = [...(d.movie_results||[]), ...(d.tv_results||[])][0];
  if (!item?.poster_path) throw new Error('no poster');
  return `https://image.tmdb.org/t/p/w500${item.poster_path}`;
}
async function fromOMDB(imdbId) {
  const key = process.env.OMDB_API_KEY;
  if (!key || !imdbId) throw new Error('no key');
  const d = await fetchJson(`https://www.omdbapi.com/?i=${imdbId}&apikey=${key}`);
  if (!d.Poster || d.Poster === 'N/A') throw new Error('no poster');
  return d.Poster;
}
async function fromWikidata(imdbId) {
  if (!imdbId) throw new Error('no id');
  const sparql = `SELECT ?article ?image WHERE {
    ?item wdt:P345 "${imdbId}" .
    OPTIONAL { ?item wdt:P18 ?image . }
    OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  } LIMIT 1`;
  const d = await fetchJson(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`);
  const b = d?.results?.bindings?.[0];
  if (!b) throw new Error('not found');
  if (b.image?.value) {
    const fn = decodeURIComponent(b.image.value.split('/').pop()).replace(/ /g,'_');
    const md5 = crypto.createHash('md5').update(fn).digest('hex');
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5[0]}${md5[1]}/${encodeURIComponent(fn)}/400px-${encodeURIComponent(fn)}`;
  }
  if (b.article?.value) {
    const title = decodeURIComponent(b.article.value.split('/wiki/')[1] || '');
    if (!title) throw new Error('no title');
    return await fromWikipediaTitle(title);
  }
  throw new Error('no image');
}
async function fromWikipediaTitle(title) {
  const d = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=600`);
  const page = Object.values(d?.query?.pages || {})[0];
  if (!page?.thumbnail?.source) throw new Error('no thumbnail');
  return page.thumbnail.source.replace(/\/\d+px-/, '/600px-');
}
async function fromWikipediaSearch(title) {
  try {
    const d = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g,'_'))}`);
    if (d.thumbnail?.source) return d.thumbnail.source.replace(/\/\d+px-/, '/600px-');
  } catch {}
  const s = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title+' film')}&srlimit=3&format=json`);
  for (const r of (s?.query?.search || [])) {
    try { return await fromWikipediaTitle(r.title); } catch {}
  }
  throw new Error('not found');
}
async function fetchPosterUrl(film) {
  const imdbId = film.imdbUrl?.match(/tt\d+/)?.[0];
  for (const [name, fn] of [
    ['TMDB',      () => fromTMDB(imdbId)],
    ['OMDB',      () => fromOMDB(imdbId)],
    ['Wikidata',  () => fromWikidata(imdbId)],
    ['Wikipedia', () => fromWikipediaSearch(film.title)],
  ]) {
    try { const u = await fn(); if(u) return {url:u, source:name}; } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}
function savePosterPath(filmId, posterPath) {
  const films = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf8'));
  const f = films.find(f => f.id === filmId);
  if (f) { f.poster = posterPath; fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2), 'utf8'); }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const films = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf8'));
  console.log('\n🎬  Oscar Watchlist v6 — Download de Capas');
  console.log('─'.repeat(52));
  console.log(`  TMDB: ${process.env.TMDB_API_KEY?'✓ configurada':'✗ sem chave (adicione TMDB_API_KEY no .env)'}`);
  console.log(`  OMDB: ${process.env.OMDB_API_KEY?'✓ configurada':'✗ sem chave (adicione OMDB_API_KEY no .env)'}`);
  console.log(`  Fallback: Wikidata + Wikipedia (sem chave necessária)`);
  console.log('─'.repeat(52));

  let ok=0, skip=0, fail=0;
  const failed = [];

  for (const film of films) {
    const dest = path.join(COVERS_DIR, `${film.id}.jpg`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 5000 && !FORCE) {
      process.stdout.write(`  ⏭  ${film.title.slice(0,44).padEnd(44)} já existe\n`);
      skip++; continue;
    }
    process.stdout.write(`  ⬇  ${film.title.slice(0,44).padEnd(44)} `);
    try {
      const result = await fetchPosterUrl(film);
      if (!result) throw new Error('sem fonte disponível');
      await downloadImage(result.url, dest);
      savePosterPath(film.id, `/assets/covers/${film.id}.jpg`);
      process.stdout.write(`✓ ${result.source}\n`);
      ok++;
    } catch(e) {
      process.stdout.write(`✗ ${String(e.message).slice(0,35)}\n`);
      fail++; failed.push(film.title);
    }
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('─'.repeat(52));
  console.log(`\n  ✅ ${ok} baixadas  ⏭ ${skip} já existiam  ❌ ${fail} com erro`);
  if (failed.length) {
    console.log('\n  Filmes sem capa:');
    failed.forEach(t => console.log(`    • ${t}`));
    console.log('\n  Dica: Adicione TMDB_API_KEY no .env e rode: node scripts/download-posters.js --force');
  }
  if (ok > 0) console.log('\n  Reinicie o servidor para ver as capas: npm start\n');
}
main().catch(console.error);
