'use strict';
// data/services/resultsImporter.js
// Multi-source auto-sync of official Oscar results
// Sources: Wikipedia wikitext → Wikidata SPARQL → NewsAPI (headlines only)

const { loadFilms, loadCategories, resolveEdition } = require('./editionService');
const { updateOfficialResult } = require('../repositories/resultRepository');

// ── Ceremony number from edition year ─────────────────────────────────────────
// 1st Academy Awards = 1929, so N = year - 1928
function yearToCeremonyNum(year) {
  return parseInt(year, 10) - 1928;
}

function numToOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// 2026 → "98th_Academy_Awards"
function editionToWikiPage(editionId) {
  const year = parseInt(resolveEdition(editionId), 10);
  return `${numToOrdinal(yearToCeremonyNum(year))}_Academy_Awards`;
}

// ── English category name → our category ID ───────────────────────────────────
const WIKI_TO_ID = {
  'best picture': 'melhor-filme',
  'best director': 'direcao',
  'best actor': 'ator-principal',
  'best actor in a leading role': 'ator-principal',
  'best actress': 'atriz-principal',
  'best actress in a leading role': 'atriz-principal',
  'best supporting actor': 'ator-coadjuvante',
  'best supporting actress': 'atriz-coadjuvante',
  'best cinematography': 'fotografia',
  'best costume design': 'figurino',
  'best film editing': 'montagem',
  'best production design': 'direcao-de-arte-production-design',
  'best original score': 'trilha-sonora-original',
  'best original song': 'cancao-original',
  'best makeup and hairstyling': 'maquiagem-e-penteados',
  'best sound': 'som',
  'best visual effects': 'efeitos-visuais',
  'best original screenplay': 'roteiro-original',
  'best adapted screenplay': 'roteiro-adaptado',
  'best animated feature film': 'longa-de-animacao',
  'best animated feature': 'longa-de-animacao',
  'best animated short film': 'curta-de-animacao',
  'best animated short': 'curta-de-animacao',
  'best documentary feature film': 'documentario-longa',
  'best documentary feature': 'documentario-longa',
  'best documentary short film': 'curta-documentario',
  'best documentary short': 'curta-documentario',
  'best live action short film': 'curta-metragem-em-live-action',
  'best live action short': 'curta-metragem-em-live-action',
  'best international feature film': '__international__',
  'best international film': '__international__',
};

// Categories matched by person name; all others matched by film title
const PERSON_CATEGORIES = new Set([
  'ator-principal', 'atriz-principal',
  'ator-coadjuvante', 'atriz-coadjuvante',
  'direcao',
]);

const INTL_CATEGORIES = [
  'filme-internacional-brasil',
  'filme-internacional-espanha',
  'filme-internacional-franca',
  'filme-internacional-noruega',
  'filme-internacional-tunisia',
];

// ── String normalization & similarity ─────────────────────────────────────────
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[''""]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|of|in|at|and|or)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  if (na.startsWith(nb) || nb.startsWith(na)) return 0.92;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wa = new Set(na.split(' ').filter(Boolean));
  const wb = new Set(nb.split(' ').filter(Boolean));
  const common = [...wa].filter(w => wb.has(w)).length;
  const score = common / Math.max(wa.size, wb.size);
  return score;
}

// ── Find best matching nominee in a category ──────────────────────────────────
function findNominee(categories, films, categoryId, winnerName) {
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) return null;

  const isPersonCat = PERSON_CATEGORIES.has(categoryId);
  let best = 0;
  let bestId = null;

  for (const nominee of cat.nominees) {
    const searchStr = isPersonCat
      ? (nominee.nomineeName || '')
      : (films.find(f => f.id === nominee.filmId)?.title || nominee.filmId.replace(/-/g, ' '));
    const score = similarity(winnerName, searchStr);
    if (score > best) { best = score; bestId = nominee.id; }
  }

  return best >= 0.55 ? bestId : null;
}

// For "Best International Feature Film" — only one winner but we have per-country categories
function findInternationalNominee(categories, films, winnerFilmName) {
  for (const catId of INTL_CATEGORIES) {
    const nomineeId = findNominee(categories, films, catId, winnerFilmName);
    if (nomineeId) return { categoryId: catId, nomineeId };
  }
  return null;
}

// ── Source 1: Wikipedia wikitext ──────────────────────────────────────────────
async function fetchFromWikipedia(editionId) {
  const page = editionToWikiPage(editionId);
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(page)}&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'OscarWatchlistApp/1.0 (personal-project)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  const json = await res.json();

  const pages = json.query?.pages;
  if (!pages?.length || pages[0].missing) throw new Error('Wikipedia page not found yet.');
  const wikitext = pages[0].revisions?.[0]?.slots?.main?.content || '';

  return parseWikitext(wikitext);
}

function parseWikitext(wikitext) {
  const results = [];

  // Split on section headings (==Category Name==)
  const sectionRegex = /={2,4}([^=\n]+?)={2,4}/g;
  const sections = [];
  let match;
  while ((match = sectionRegex.exec(wikitext)) !== null) {
    sections.push({ title: match[1].trim(), pos: match.index + match[0].length });
  }

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const normalTitle = normalize(s.title);
    const categoryId = WIKI_TO_ID[normalTitle];
    if (!categoryId) continue;

    const end = sections[i + 1]?.pos ?? wikitext.length;
    const content = wikitext.slice(s.pos, end);

    // First '''bold''' = winner
    const boldMatch = /'{3}([^'\n]+?)'{3}/.exec(content);
    if (!boldMatch) continue;

    // Clean wiki markup from winner name
    const winner = boldMatch[1]
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')   // [[Target|Text]] → Text
      .replace(/\[\[([^\]]+)\]\]/g, '$1')               // [[Link]] → Link
      .replace(/{{[^}]*}}/g, '')                        // {{templates}} → ''
      .replace(/'{2,}/g, '')                            // remaining ''
      .trim();

    if (winner) results.push({ categoryId, winner });
  }

  return results;
}

// ── Source 2: Wikidata SPARQL ──────────────────────────────────────────────────
async function fetchFromWikidata(editionId) {
  const year = parseInt(resolveEdition(editionId), 10);

  // Query: all items that received an Academy Award whose year = our edition year
  const sparql = `
    SELECT DISTINCT ?awardLabel ?recipientLabel ?filmLabel WHERE {
      ?recipient p:P166 ?statement .
      ?statement ps:P166 ?award .
      ?statement pq:P585 ?date .
      FILTER(YEAR(?date) = ${year})
      ?award wdt:P31 wd:Q19020 .
      OPTIONAL {
        ?recipient wdt:P31 wd:Q5 .
        ?statement pq:P1411 ?film .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    LIMIT 150
  `;

  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'OscarWatchlistApp/1.0',
      'Accept': 'application/sparql-results+json',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const json = await res.json();

  const results = [];
  for (const b of (json.results?.bindings || [])) {
    const awardLabel = b.awardLabel?.value || '';
    const recipientLabel = b.recipientLabel?.value || '';
    const filmLabel = b.filmLabel?.value || '';
    if (!awardLabel || !recipientLabel) continue;

    const normalizedAward = normalize(awardLabel);
    const categoryId = WIKI_TO_ID[normalizedAward];
    if (!categoryId) continue;

    // For person categories the recipient IS the person; otherwise the film
    const winner = PERSON_CATEGORIES.has(categoryId) ? recipientLabel : (filmLabel || recipientLabel);
    results.push({ categoryId, winner, film: filmLabel });
  }

  return results;
}

// ── Source 3: NewsAPI (headlines only — no auto-match possible) ────────────────
async function fetchNewsApiHeadlines(editionId) {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];

  const year = resolveEdition(editionId);
  const url = `https://newsapi.org/v2/everything?q=Oscar+${year}+winner+Academy+Awards&language=en&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.articles || []).map(a => ({ title: a.title, url: a.url, publishedAt: a.publishedAt }));
}

// ── In-memory sync log ─────────────────────────────────────────────────────────
let _lastSyncLog = null;
function getSyncLog() { return _lastSyncLog; }

// ── Main sync function ─────────────────────────────────────────────────────────
async function syncResults(editionId) {
  const eid = resolveEdition(editionId);
  const films = loadFilms(eid);
  const categories = loadCategories(eid);

  const log = {
    startedAt: new Date().toISOString(),
    source: null,
    matched: [],
    unmatched: [],
    newsHeadlines: [],
    errors: {},
    completedAt: null,
  };
  _lastSyncLog = log;

  // ── Try sources in order ───────────────────────────────────────────────────
  let rawResults = [];

  try {
    rawResults = await fetchFromWikipedia(eid);
    if (rawResults.length) log.source = 'wikipedia';
  } catch (e) {
    log.errors.wikipedia = e.message;
    console.warn('[sync] Wikipedia failed:', e.message);
  }

  if (!rawResults.length) {
    try {
      rawResults = await fetchFromWikidata(eid);
      if (rawResults.length) log.source = 'wikidata';
    } catch (e) {
      log.errors.wikidata = e.message;
      console.warn('[sync] Wikidata failed:', e.message);
    }
  }

  // NewsAPI always runs (but results are headlines only)
  try {
    log.newsHeadlines = await fetchNewsApiHeadlines(eid);
  } catch { /* ignore */ }

  if (!rawResults.length) {
    log.errors.noResults = 'Nenhum resultado estruturado encontrado. A cerimônia pode ainda não ter acontecido.';
    log.completedAt = new Date().toISOString();
    return log;
  }

  // ── Match raw results to nominees and save ─────────────────────────────────
  const seen = new Set(); // deduplicate categories
  for (const { categoryId, winner, film } of rawResults) {
    if (categoryId === '__international__') {
      const filmName = film || winner;
      const match = findInternationalNominee(categories, films, filmName);
      if (match) {
        if (!seen.has(match.categoryId)) {
          seen.add(match.categoryId);
          await updateOfficialResult(match.categoryId, eid, match.nomineeId);
          log.matched.push({ categoryId: match.categoryId, winner: filmName, nomineeId: match.nomineeId });
        }
      } else {
        log.unmatched.push({ categoryId: 'best-international-feature-film', winner: filmName });
      }
      continue;
    }

    if (seen.has(categoryId)) continue;
    seen.add(categoryId);

    const nomineeId = findNominee(categories, films, categoryId, winner);
    if (nomineeId) {
      await updateOfficialResult(categoryId, eid, nomineeId);
      log.matched.push({ categoryId, winner, nomineeId });
    } else {
      log.unmatched.push({ categoryId, winner });
    }
  }

  log.completedAt = new Date().toISOString();
  return log;
}

module.exports = { syncResults, getSyncLog };
