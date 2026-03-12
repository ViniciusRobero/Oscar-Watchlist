// lib/poster.js — Poster fetching and caching subsystem
// Supports 4 sources: TMDB → OMDB → Wikidata → Wikipedia
const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { resolveEdition, loadFilms, saveFilms } = require('../services/editionService');

const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function fetchHttp(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { headers: { 'User-Agent': 'OscarWatchlist/6 node.js' } };
    const req = mod.get(url, opts, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
        return fetchHttp(r.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      const contentLength = parseInt(r.headers['content-length'] || '0', 10);
      if (contentLength > MAX_DOWNLOAD_BYTES) {
        r.destroy();
        return reject(new Error('Response too large'));
      }
      const chunks = [];
      let totalBytes = 0;
      r.on('data', (c) => {
        totalBytes += c.length;
        if (totalBytes > MAX_DOWNLOAD_BYTES) {
          r.destroy();
          return reject(new Error('Response too large'));
        }
        chunks.push(c);
      });
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
    const film = films.find(f => f.id === filmId);
    if (film) {
      film.poster = posterUrl;
      saveFilms(films, eid);
    }
  } catch { }
}

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

async function prefetchAllPosters(coversDir) {
  const films = loadFilms();
  const missing = films.filter(f => {
    const lf = require('path').join(coversDir, `${f.id}.jpg`);
    return !fs.existsSync(lf) || fs.statSync(lf).size < 3000;
  });
  if (missing.length === 0) return;
  console.log(`  📷  Buscando capas para ${missing.length} filmes em background...`);
  for (const film of missing) {
    try {
      const url = await fetchPosterUrl(film);
      if (url) {
        const dest = require('path').join(coversDir, `${film.id}.jpg`);
        await downloadFile(url, dest);
        updateFilmPosterUrl(film.id, `/assets/covers/${film.id}.jpg`);
        process.stdout.write('.');
      }
    } catch { process.stdout.write('x'); }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('\n  ✓   Capas atualizadas!');
}

module.exports = {
  fetchHttp,
  fetchJson,
  downloadFile,
  updateFilmPosterUrl,
  fetchPosterUrl,
  prefetchAllPosters,
};
