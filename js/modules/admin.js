/**
 * Admin module
 */

function renderAdmin() {
  const adminSection = $('admin');
  if (!adminSection) return;
  adminSection.style.display = window.medjasi.isAdmin ? 'block' : 'none';
}

async function addTeam() {
  if (!requireAdmin()) return;
  const name = $('teamName')?.value.trim();
  if (!name) return toast('Unesite naziv ekipe.', 'error');
  const team = { id: Date.now(), name, coach: $('teamCoach')?.value.trim() || 'Bez trenera' };
  window.medjasi.teams.push(team);
  $('teamName').value = '';
  $('teamCoach').value = '';
  renderTeams();
  renderTable();
  toast('Ekipa dodana.', 'success');
}

async function addPlayer() {
  if (!requireAdmin()) return;
  const name = $('playerName')?.value.trim();
  const teamId = $('playerTeam')?.value;
  if (!name || !teamId) return toast('Popunite ime i ekipu.', 'error');
  window.medjasi.players.push({
    id: Date.now(),
    name,
    number: Number($('playerNumber')?.value || 0),
    team_id: Number(teamId),
    position: $('playerPosition')?.value || 'Igrač'
  });
  $('playerName').value = '';
  $('playerNumber').value = '';
  renderPlayers();
  toast('Igrač dodan.', 'success');
}

async function addMatch() {
  if (!requireAdmin()) return;
  const home = $('matchHome')?.value;
  const away = $('matchAway')?.value;
  if (!home || !away || home === away) return toast('Izaberite validne ekipe.', 'error');
  window.medjasi.matches.push({
    id: Date.now(),
    home_team_id: Number(home),
    away_team_id: Number(away),
    home_score: 0,
    away_score: 0,
    status: 'scheduled',
    round: Number($('matchRound')?.value || 1),
    match_datetime: $('matchDate')?.value || new Date().toISOString()
  });
  renderMatches();
  renderTable();
  toast('Utakmica dodana.', 'success');
}

function populateAdminSelects() {
  const teamSelects = ['playerTeam', 'matchHome', 'matchAway'];
  teamSelects.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.innerHTML = '<option value="">Izaberi ekipu</option>' + (window.medjasi.teams || []).map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join('');
  });
}

window.addTeam = addTeam;
window.addPlayer = addPlayer;
window.addMatch = addMatch;
window.renderAdmin = renderAdmin;
window.populateAdminSelects = populateAdminSelects;
