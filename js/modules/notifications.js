/**
 * Medjaši Futsal Liga - Notifications Module
 * PWA install, service worker registration, push support
 */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker unsupported");
    return null;
  }

  return navigator.serviceWorker
    .register("./service-worker.js")
    .then((registration) => {
      console.log("Service Worker registered", registration);
      return registration;
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
      return null;
    });
}

async function setupPushNotifications() {
  if (!window.medjasi.isLoggedIn) return;

  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return;
  }

  if (Notification.permission === "granted") {
    console.log("Push notifications already granted");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      toast("Push obavještenja omogućena ✅", "success");
    }
  } catch (error) {
    console.error("Notification permission error:", error);
  }
}

function initPwaInstall() {
  const banner = $("#pwaInstallBanner");
  const installButton = $("#pwaInstallButton");
  const closeButton = $("#pwaInstallClose");

  if (!banner || !installButton || !closeButton) return;

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    banner.classList.add("visible");
  });

  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) {
      toast("PWA instalacija trenutno nije dostupna", "info");
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    banner.classList.remove("visible");
    deferredPrompt = null;
  });

  closeButton.addEventListener("click", () => {
    banner.classList.remove("visible");
  });
}

window.registerServiceWorker = registerServiceWorker;
window.setupPushNotifications = setupPushNotifications;
window.initPwaInstall = initPwaInstall;
