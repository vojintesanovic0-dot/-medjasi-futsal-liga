/**
 * Players module
 */

function renderPlayers() {
  const grid = $('playersGrid');
  if (!grid) return;
  const q = $('playerSearch')?.value.trim().toLowerCase() || '';
  const players = (window.medjasi.players || []).filter((player) => {
    const text = `${player.name} ${player.position}`.toLowerCase();
    return !q || text.includes(q);
  });

  grid.innerHTML = players.map((player) => `
    <div class="card player-card">
      <h3>${escapeHtml(player.name)}</h3>
      <p>${escapeHtml(player.position || 'Igrač')} • #${player.number || '-'}</p>
      <small>${escapeHtml(getTeamName(player.team_id))}</small>
    </div>
  `).join('') || '<div class="empty">Nema igrača.</div>';
}

window.renderPlayers = renderPlayers;
