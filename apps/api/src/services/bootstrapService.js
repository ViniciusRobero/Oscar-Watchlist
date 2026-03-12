// data/services/bootstrapService.js — Bootstrap assembly and user summaries
const { resolveEdition, loadFilms, loadCategories, loadEditions, loadAwards } = require('./editionService');
const { getUser } = require('../repositories/userRepository');
const { getUserFilmsMap } = require('../repositories/filmRepository');
const { getPredictionsMap } = require('../repositories/predictionRepository');
const { getOfficialResults } = require('../repositories/resultRepository');
const { dbClient } = require('../config/db');

/**
 * @param {string} editionId
 * @param {{ publicOnly?: boolean, activeUser?: string }} opts
 */
async function summarizeUsers(editionId, opts = {}) {
  const eid = resolveEdition(editionId);
  const { publicOnly = false, activeUser = '' } = opts;

  const sql = publicOnly
    ? "SELECT id, username, role, is_active, is_private, created_at FROM users WHERE (is_private = 0 AND is_active = 1)" +
      (activeUser ? " OR username = ?" : "")
    : "SELECT id, username, role, is_active, is_private, created_at FROM users";

  const args = publicOnly && activeUser ? [activeUser] : [];
  const usersRs = await dbClient.execute({ sql, args });
  const users = usersRs.rows;

  const summaries = [];
  for (const u of users) {
    const films = await getUserFilmsMap(u.id, eid);
    const predictions = await getPredictionsMap(u.id, eid);

    const filmEntries = Object.values(films || {});
    const watchedCount = filmEntries.filter(f => f && f.watched).length;
    const ratings = filmEntries
      .map(f => Number(f && f.personalRating))
      .filter(n => Number.isFinite(n) && n > 0);
    const predictionsCount = Object.keys(predictions || {}).length;

    summaries.push({
      username: u.username,
      role: u.role,
      isActive: u.is_active !== 0,
      isPrivate: u.is_private !== 0,
      watchedCount,
      predictionsCount,
      ratingsCount: ratings.length,
      averageRating: ratings.length
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
        : null,
      createdAt: u.created_at || null,
    });
  }

  return summaries.sort((a, b) => a.username.localeCompare(b.username));
}

async function buildBootstrapAsync(username, editionId) {
  const eid = resolveEdition(editionId);
  const films = loadFilms(eid);
  const categories = loadCategories(eid);
  const editions = loadEditions();
  const awards = loadAwards();

  const editionsWithAward = editions.map(e => ({
    ...e,
    award: awards.find(a => a.id === e.award_id) || null,
  }));

  const currentEdition = editionsWithAward.find(e => e.id === eid);

  let profile = { films: {}, predictions: {} };
  const user = await getUser(username);
  if (user) {
    profile.films = await getUserFilmsMap(user.id, eid);
    profile.predictions = await getPredictionsMap(user.id, eid);
  }

  const summaries = await summarizeUsers(eid, { publicOnly: true, activeUser: username || '' });
  const usersList = summaries.map(s => s.username);
  const officialResults = await getOfficialResults(eid);

  return {
    edition: eid,
    editions: editionsWithAward,
    awards,
    currentAward: currentEdition?.award || null,
    films,
    categories,
    users: usersList,
    userSummaries: summaries,
    activeUser: username || '',
    nick: user?.nick || username || '',
    userRole: user?.role || 'user',
    profile,
    officialResults,
  };
}

module.exports = { summarizeUsers, buildBootstrapAsync };
