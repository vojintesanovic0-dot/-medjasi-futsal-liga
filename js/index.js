/**
 * Bootstrap / init order
 */

async function initApp() {
  await initCore();
  updateAuthUI();
  populateAdminSelects();
  renderTeams();
  renderPlayers();
  renderMatches();
  renderTable();
  renderGallery();
  renderNews();
  renderCommunity();
  renderChat();
  renderAdmin();
  bindRealtime();
  registerServiceWorker();
  setupPushNotifications();
}

window.addEventListener('DOMContentLoaded', initApp);
window.initApp = initApp;
