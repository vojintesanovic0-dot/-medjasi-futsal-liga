/**
 * Medjaši Futsal Liga - App Bootstrap
 * Final entry point that initializes modules in safe order.
 */

async function initApp() {
  console.log("🚀 Initializing Medjaši app...");

  // 1) Core foundation
  if (!window.initCore) {
    console.error("Missing initCore from core.js");
    return;
  }

  const coreReady = await window.initCore();
  if (!coreReady) {
    console.error("Core initialization failed.");
    return;
  }

  // 2) Auth and session UI
  if (window.initAuth) {
    await window.initAuth();
  }

  // 3) Initial data loading and rendering
  await loadAll();

  if (window.renderTeams) window.renderTeams();
  if (window.renderPlayers) window.renderPlayers();
  if (window.renderMatches) window.renderMatches();
  if (window.renderTable) window.renderTable();
  if (window.renderAdminTeams) window.renderAdminTeams();
  if (window.renderAdminMatches) window.renderAdminMatches();
  if (window.renderChat) window.renderChat();
  if (window.renderGallery) window.renderGallery();
  if (window.renderNews) window.renderNews();
  if (window.renderCommunity) window.renderCommunity();

  // 4) Realtime bindings
  if (window.bindRealtime) {
    window.bindRealtime();
  }

  // 5) PWA install + notifications
  if (window.initPwaInstall) {
    window.initPwaInstall();
  }

  if (window.registerServiceWorker) {
    window.registerServiceWorker();
  }

  if (window.setupPushNotifications) {
    window.setupPushNotifications();
  }

  // 6) Final UI state sync
  if (window.updateAuthUI) {
    window.updateAuthUI();
  }

  console.log("✅ Medjaši app initialized successfully.");
}

window.addEventListener("DOMContentLoaded", async () => {
  await initApp();
});

window.initApp = initApp;
