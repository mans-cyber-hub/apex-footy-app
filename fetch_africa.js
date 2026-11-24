const fs = require('fs');
const path = require('path');

const AFRICA_LEAGUES = {
  NBC: { id: '4891', name: 'NBC Premier League' },
  CAF: { id: '4416', name: 'CAF Champions League' }
};

function readLocalAfrica(code) {
  try {
    const filePath = path.join(__dirname, 'data/africa-data.json');
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return raw[code] || null;
  } catch (_) {
    return null;
  }
}

function mapEvent(ev) {
  const isLive = ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY', 'P'].includes((ev.strStatus || '').toUpperCase());
  const hasScore = ev.intHomeScore !== null && ev.intHomeScore !== '' && ev.intAwayScore !== null && ev.intAwayScore !== '';
  const isFinished = hasScore && ['FT', 'AET', 'PEN', 'FINISHED', 'MATCH FINISHED'].some(s => (ev.strStatus || '').toUpperCase().includes(s));
  return {
    utcDate: ev.strTimestamp || `${ev.dateEvent || '2026-01-01'}T${ev.strTime || '12:00:00'}Z`,
    status: isLive ? 'IN_PLAY' : (isFinished ? 'FINISHED' : 'SCHEDULED'),
    homeTeam: { name: ev.strHomeTeam || 'Home', shortName: ev.strHomeTeam || 'Home' },
    awayTeam: { name: ev.strAwayTeam || 'Away', shortName: ev.strAwayTeam || 'Away' },
    score: { fullTime: { home: hasScore ? Number(ev.intHomeScore) : null, away: hasScore ? Number(ev.intAwayScore) : null } }
  };
}

async function fetchAfricaLeagueData(code) {
  const cfg = AFRICA_LEAGUES[code];
  const fallback = readLocalAfrica(code) || { competition: cfg ? cfg.name : code, table: [], liveMatches: [], fixtures: [], recentFinished: [] };
  if (!cfg) return fallback;
  try {
    const [eRes, pRes, tRes] = await Promise.all([
      fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=${cfg.id}`),
      fetch(`https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=${cfg.id}`),
      fetch(`https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${cfg.id}&s=2026-2027`)
    ]);
    const nextRaw = (eRes.ok ? (await eRes.json()).events : null) || [];
    const pastRaw = (pRes.ok ? (await pRes.json()).events : null) || [];
    const standingRaw = (tRes.ok ? (await tRes.json()).table : null) || [];
    const mappedNext = nextRaw.map(mapEvent);
    const mappedPast = pastRaw.map(mapEvent);
    return {
      competition: cfg.name,
      table: standingRaw.length ? standingRaw.map((row, i) => ({
        position: Number(row.intRank || i + 1),
        team: { name: row.strTeam || 'Team', shortName: row.strTeam || 'Team' },
        playedGames: Number(row.intPlayed || 0), won: Number(row.intWin || 0),
        draw: Number(row.intDraw || 0), lost: Number(row.intLoss || 0),
        goalDifference: Number(row.intGoalDifference || 0), points: Number(row.intPoints || 0)
      })) : fallback.table,
      liveMatches: [...mappedNext, ...mappedPast].filter(m => m.status === 'IN_PLAY'),
      fixtures: mappedNext.filter(m => m.status !== 'IN_PLAY').slice(0, 20),
      recentFinished: mappedPast.filter(m => m.status === 'FINISHED').slice(-12).reverse()
    };
  } catch (_) {
    return fallback;
  }
}

module.exports = { fetchAfricaLeagueData };
