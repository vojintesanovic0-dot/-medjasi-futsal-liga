/**
 * Teams module
 */

function getTeamName(teamId) {
  const team = (window.medjasi.teams || []).find((t) => String(t.id) === String(teamId));
  return team ? team.name : 'Nepoznata ekipa';
}

function renderTeams() {
  const grid = $('teamsGrid');
  if (!grid) return;
  const q = $('teamSearch')?.value.trim().toLowerCase() || '';
  const teams = (window.medjasi.teams || []).filter((team) => !q || team.name.toLowerCase().includes(q));

  grid.innerHTML = teams.map((team) => `
    <div class="card team-card">
      <h3>${escapeHtml(team.name)}</h3>
      <p>${escapeHtml(team.coach || 'Bez trenera')}</p>
      <button onclick="showModal('<div class=\'modal-box-inner\'><h3>${escapeHtml(team.name)}</h3><p>${escapeHtml(team.coach || 'Bez trenera')}</p></div>')">Detalji</button>
    </div>
  `).join('') || '<div class="empty">Nema ekipa.</div>';
}

function renderTable() {
  const tbody = $('tableBody');
  if (!tbody) return;
  const rows = (window.medjasi.teams || []).map((team) => {
    const played = (window.medjasi.matches || []).filter((m) => (m.home_team_id === team.id || m.away_team_id === team.id) && m.status === 'finished');
    let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
    played.forEach((m) => {
      if (m.home_team_id === team.id) {
        gf += Number(m.home_score || 0);
        ga += Number(m.away_score || 0);
        if ((m.home_score || 0) > (m.away_score || 0)) wins++;
        else if ((m.home_score || 0) === (m.away_score || 0)) draws++;
        else losses++;
      } else {
        gf += Number(m.away_score || 0);
        ga += Number(m.home_score || 0);
        if ((m.away_score || 0) > (m.home_score || 0)) wins++;
        else if ((m.away_score || 0) === (m.home_score || 0)) draws++;
        else losses++;
      }
    });
    const pts = wins * 3 + draws;
    const gd = gf - ga;
    return { team, played: played.length, wins, draws, losses, gf, ga, gd, pts };
  }).sort((a, b) => b.pts - a.pts || b.gd - a.gd);

  tbody.innerHTML = rows.map((row, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(row.team.name)}</td>
      <td>${row.played}</td>
      <td>${row.wins}</td>
      <td>${row.draws}</td>
      <td>${row.losses}</td>
      <td>${row.gf}</td>
      <td>${row.ga}</td>
      <td>${row.gd}</td>
      <td>${row.pts}</td>
    </tr>
  `).join('');
}

window.renderTeams = renderTeams;
window.renderTable = renderTable;
window.getTeamName = getTeamName;
