const http = require('http');
const fs = require('fs');
const path = require('path');
const { fetchAfricaLeagueData } = require('./fetch_africa');

const API_KEY = process.env.FOOTBALL_API_KEY || '9249a2f1f2f74158b812f1b214e9ce87';
const BASE_URL = 'https://api.football-data.org/v4';
const PORT = process.env.PORT || 3000;

const headers = { 'X-Auth-Token': API_KEY };

async function fetchLeagueData(league = 'PL') {
  const safeLeague = encodeURIComponent(league.toUpperCase());
  if (safeLeague === 'NBC' || safeLeague === 'CAF') return await fetchAfricaLeagueData(safeLeague);
  if (safeLeague === "NBC" || safeLeague === "CAF") {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "data/africa-data.json"), "utf8"));
    return raw[safeLeague] || { competition: safeLeague, table: [], liveMatches: [], fixtures: [], recentFinished: [] };
  }
  const [standingsRes, matchesRes] = await Promise.all([
    fetch(`${BASE_URL}/competitions/${safeLeague}/standings`, { headers }),
    fetch(`${BASE_URL}/competitions/${safeLeague}/matches`, { headers })
  ]);

  const standingsData = await standingsRes.json();
  const matchesData = await matchesRes.json();

  if (standingsData.errorCode) throw new Error(standingsData.message || 'Tatizo la standings');
  if (matchesData.errorCode) throw new Error(matchesData.message || 'Tatizo la mechi');

  const standingObj =
    (standingsData.standings && standingsData.standings.find(s => s.type === 'TOTAL')) ||
    (standingsData.standings && standingsData.standings[0]);

  const table = standingObj ? standingObj.table : [];
  const allMatches = matchesData.matches || [];

  return {
    competition: standingsData.competition ? standingsData.competition.name : safeLeague,
    table,
    liveMatches: allMatches.filter(m => ['IN_PLAY', 'LIVE', 'PAUSED'].includes(m.status)),
    fixtures: allMatches.filter(m => ['SCHEDULED', 'TIMED'].includes(m.status)).slice(0, 20),
    recentFinished: allMatches.filter(m => m.status === 'FINISHED').slice(-12).reverse()
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);

  if (urlObj.pathname === '/api/data') {
    const league = urlObj.searchParams.get('league') || 'PL';
    try {
      const data = await fetchLeagueData(league);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  let filePath = path.join(__dirname, 'public', urlObj.pathname === '/' ? 'index.html' : urlObj.pathname);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(content);
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
