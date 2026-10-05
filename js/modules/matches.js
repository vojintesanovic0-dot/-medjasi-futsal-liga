/**
 * Matches module
 */

function renderMatches() {
  const list = $('matchesList');
  if (!list) return;
  const query = $('matchSearch')?.value.trim().toLowerCase() || '';
  const roundFilter = $('matchRoundFilter')?.value || '';
  const statusFilter = $('matchStatusFilter')?.value || '';

  const matches = (window.medjasi.matches || []).filter((m) => {
    const home = getTeamName(m.home_team_id);
    const away = getTeamName(m.away_team_id);
    const text = `${home} ${away}`.toLowerCase();
    const byQuery = !query || text.includes(query);
    const byRound = !roundFilter || String(m.round) === String(roundFilter);
    const byStatus = !statusFilter || String(m.status) === String(statusFilter);
    return byQuery && byRound && byStatus;
  });

  list.innerHTML = matches.map((m) => `
    <div class="card match-card">
      <div class="match-header">
        <span class="badge ${m.status || 'scheduled'}">${(m.status || 'scheduled').toUpperCase()}</span>
        <span>Kolo ${m.round || 1}</span>
      </div>
      <div class="match-score">
        <strong>${escapeHtml(getTeamName(m.home_team_id))}</strong>
        <span>${m.home_score ?? 0} : ${m.away_score ?? 0}</span>
        <strong>${escapeHtml(getTeamName(m.away_team_id))}</strong>
      </div>
      <small>${formatDate(m.match_datetime)}</small>
    </div>
  `).join('') || '<div class="empty">Nema utakmica.</div>';
}

window.renderMatches = renderMatches;
