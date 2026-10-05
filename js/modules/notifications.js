/**
 * Notifications / PWA module
 */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./service-worker.js').catch((err) => console.warn('SW registration failed:', err));
}

function setupPushNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

window.registerServiceWorker = registerServiceWorker;
window.setupPushNotifications = setupPushNotifications;
