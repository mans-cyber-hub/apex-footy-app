const LEAGUES = {
  NBC: { id: 567, name: "NBC Premier League" },
  CAF: { id: 20, name: "CAF Champions League" }
};

async function fetchAfricaLeagueData(code) {
  const league = LEAGUES[code];
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!league) {
    return { competition: code, table: [], liveMatches: [], fixtures: [], recentFinished: [] };
  }

  if (!apiKey) {
    return {
      competition: league.name,
      table: [],
      liveMatches: [],
      fixtures: [],
      recentFinished: [],
      notice: "Missing API_FOOTBALL_KEY on Render"
    };
  }

  const headers = { "x-apisports-key": apiKey };
  const season = new Date().getFullYear();

  const [standingsRes, liveRes, fixturesRes] = await Promise.all([
    fetch(`https://v3.football.api-sports.io/standings?league=${league.id}&season=${season}`, { headers }),
    fetch(`https://v3.football.api-sports.io/fixtures?league=${league.id}&live=all`, { headers }),
    fetch(`https://v3.football.api-sports.io/fixtures?league=${league.id}&season=${season}&last=10`, { headers })
  ]);

  const standingsJson = standingsRes.ok ? await standingsRes.json() : {};
  const liveJson = liveRes.ok ? await liveRes.json() : {};
  const recentJson = fixturesRes.ok ? await fixturesRes.json() : {};

  const rawTable = standingsJson?.response?.[0]?.league?.standings?.[0] || [];
  const table = rawTable.map((row) => ({
    position: row.rank,
    team: { name: row.team?.name || "", shortName: row.team?.name || "" },
    playedGames: row.all?.played ?? 0,
    won: row.all?.win ?? 0,
    draw: row.all?.draw ?? 0,
    lost: row.all?.lose ?? 0,
    goalDifference: row.goalsDiff ?? 0,
    points: row.points ?? 0
  }));

  const liveMatches = (liveJson?.response || []).map((m) => ({
    utcDate: m.fixture?.date,
    status: m.fixture?.status?.short || "LIVE",
    homeTeam: { name: m.teams?.home?.name || "" },
    awayTeam: { name: m.teams?.away?.name || "" },
    score: { fullTime: { home: m.goals?.home, away: m.goals?.away } }
  }));

  const recentFinished = (recentJson?.response || []).map((m) => ({
    utcDate: m.fixture?.date,
    status: m.fixture?.status?.short || "FT",
    homeTeam: { name: m.teams?.home?.name || "" },
    awayTeam: { name: m.teams?.away?.name || "" },
    score: { fullTime: { home: m.goals?.home, away: m.goals?.away } }
  }));

  return {
    competition: league.name,
    table,
    liveMatches,
    fixtures: [],
    recentFinished
  };
}

module.exports = { fetchAfricaLeagueData };
