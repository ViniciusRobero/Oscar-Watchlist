/**
 * fetch-posters.js — Baixa capas dos filmes usando múltiplas fontes
 *
 * ── Uso rápido (sem chave, grátis via Wikipedia/Wikidata) ─────────────────
 *   node scripts/fetch-posters.js
 *
 * ── Com TMDB (melhor qualidade, chave gratuita) ────────────────────────────
 *   Crie conta em: https://www.themoviedb.org/ → Settings → API → API Key (v3)
 *   TMDB_API_KEY=sua_chave node scripts/fetch-posters.js
 *
 * ── Com OMDB (alternativa, 1000/dia grátis) ───────────────────────────────
 *   OMDB_API_KEY=sua_chave node scripts/fetch-posters.js
 *
 * Ordem de prioridade: TMDB → OMDB → Wikidata → Wikipedia
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;

const FILMS_PATH = path.resolve(process.cwd(), 'data/films.json');
const COVERS_DIR = path.join(__dirname, '../public/assets/covers');

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function fetchRaw(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { headers: { 'User-Agent': 'OscarWatchlist/6 node.js (educational)' } };
    const req = mod.get(url, opts, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return fetchRaw(res.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchJSON(url) {
  const res = await fetchRaw(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.body.toString('utf8'));
}

async function downloadImage(url, dest) {
  const res = await fetchRaw(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers['content-type'] || '';
  if (!ct.includes('image')) throw new Error(`Not an image: ${ct}`);
  if (res.body.length < 5000) throw new Error('File too small');
  fs.writeFileSync(dest, res.body);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Source 1: TMDB ─────────────────────────────────────────────────────────
async function getPosterFromTMDB(imdbId) {
  if (!TMDB_KEY) throw new Error('No TMDB key');
  const data = await fetchJSON(
    `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`
  );
  const item = [...(data.movie_results||[]), ...(data.tv_results||[])][0];
  if (!item?.poster_path) throw new Error('No TMDB poster');
  return `https://image.tmdb.org/t/p/w500${item.poster_path}`;
}

// ── Source 2: OMDB ─────────────────────────────────────────────────────────
async function getPosterFromOMDB(imdbId) {
  if (!OMDB_KEY) throw new Error('No OMDB key');
  const data = await fetchJSON(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_KEY}`);
  if (data.Response === 'False' || !data.Poster || data.Poster === 'N/A') throw new Error('No OMDB poster');
  return data.Poster;
}

// ── Source 3: Wikidata (IMDb → Wikipedia image) ────────────────────────────
async function getPosterFromWikidata(imdbId) {
  const sparql = `SELECT ?article ?image WHERE {
    ?item wdt:P345 "${imdbId}" .
    OPTIONAL { ?item wdt:P18 ?image . }
    OPTIONAL {
      ?article schema:about ?item ;
               schema:isPartOf <https://en.wikipedia.org/> .
    }
  } LIMIT 1`;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  const data = await fetchJSON(url);
  const b = data?.results?.bindings?.[0];
  if (!b) throw new Error('Not in Wikidata');

  // Direct image from Wikidata (P18)
  if (b.image?.value) {
    const raw = b.image.value;
    const filename = decodeURIComponent(raw.split('/').pop()).replace(/ /g, '_');
    const md5 = crypto.createHash('md5').update(filename).digest('hex');
    const enc = encodeURIComponent(filename);
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5[0]}${md5[1]}/${enc}/400px-${enc}`;
  }

  // Wikipedia article thumbnail
  if (b.article?.value) {
    const title = decodeURIComponent(b.article.value.split('/wiki/')[1] || '');
    if (!title) throw new Error('No title');
    const d = await fetchJSON(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=500`
    );
    const page = Object.values(d?.query?.pages || {})[0];
    if (!page?.thumbnail?.source) throw new Error('No Wikipedia thumbnail');
    return page.thumbnail.source;
  }
  throw new Error('No image in Wikidata');
}

// ── Source 4: Wikipedia direct title search ────────────────────────────────
async function getPosterFromWikipedia(title) {
  // REST summary (fast path)
  try {
    const d = await fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (d.thumbnail?.source) return d.thumbnail.source.replace(/\/\d+px-/, '/500px-');
  } catch {}

  // Search API
  const s = await fetchJSON(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title+' film')}&srlimit=1&format=json`
  );
  const pageTitle = s?.query?.search?.[0]?.title;
  if (!pageTitle) throw new Error('Not found');
  const d = await fetchJSON(
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=500`
  );
  const page = Object.values(d?.query?.pages || {})[0];
  if (!page?.thumbnail?.source) throw new Error('No image');
  return page.thumbnail.source;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });

  const films = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf8'));
  let downloaded = 0, skipped = 0, failed = 0;

  const activeSources = [TMDB_KEY && 'TMDB', OMDB_KEY && 'OMDB', 'Wikidata', 'Wikipedia'].filter(Boolean);
  console.log(`\n🎬  Oscar Watchlist — Downloader de Capas`);
  console.log(`   Fontes: ${activeSources.join(' → ')}`);
  if (!TMDB_KEY && !OMDB_KEY) {
    console.log(`   💡 Para capas de maior qualidade, use TMDB_API_KEY (grátis em themoviedb.org)\n`);
  }
  console.log(`\n   Filmes: ${films.length}\n`);

  for (const film of films) {
    const dest = path.join(COVERS_DIR, `${film.id}.jpg`);
    const label = film.title.substring(0, 42).padEnd(42);

    if (fs.existsSync(dest) && fs.statSync(dest).size > 8000) {
      console.log(`  ✓  ${label} [já existe]`);
      film.poster = `/assets/covers/${film.id}.jpg`;
      skipped++;
      continue;
    }

    const imdbId = film.imdbUrl?.match(/tt\d+/)?.[0];
    process.stdout.write(`  ↓  ${label} `);

    let posterUrl = null, usedSource = '';

    for (const [name, fn] of [
      ['TMDB',      () => getPosterFromTMDB(imdbId)],
      ['OMDB',      () => getPosterFromOMDB(imdbId)],
      ['Wikidata',  () => imdbId ? getPosterFromWikidata(imdbId) : Promise.reject('no id')],
      ['Wikipedia', () => getPosterFromWikipedia(film.title)],
    ]) {
      try {
        posterUrl = await fn();
        usedSource = name;
        break;
      } catch { /* try next */ }
      await sleep(200);
    }

    if (posterUrl) {
      try {
        await downloadImage(posterUrl, dest);
        film.poster = `/assets/covers/${film.id}.jpg`;
        downloaded++;
        console.log(`✓ [${usedSource}]`);
      } catch (e) {
        failed++;
        console.log(`✗ download: ${e.message}`);
      }
    } else {
      failed++;
      console.log(`✗ sem imagem`);
    }

    await sleep(400);
  }

  fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2), 'utf8');

  console.log(`\n${'─'.repeat(58)}`);
  console.log(`  Baixados:    ${downloaded}`);
  console.log(`  Já tinham:   ${skipped}`);
  console.log(`  Com erro:    ${failed}`);
  if (failed > 0) {
    console.log(`\n  Para os ${failed} restantes, tente:`);
    console.log(`  TMDB_API_KEY=<chave> node scripts/fetch-posters.js`);
  }
  console.log(`\n  Reinicie o servidor: npm start\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
