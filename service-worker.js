const CACHE_NAME = "medjasi-futsal-pwa-v23";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/app.css?v=20261005v19",
  "./js/app.js?v=20261005v21",
  "./css/production.css?v=20261005v19",
  "./js/production.js?v=20261005",
  "./images/icon-192.png",
  "./images/icon-512.png"
];

// Instalacija
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Aktivacija i brisanje starih cache verzija
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Učitavanje stranice i fajlova
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Ne diramo Supabase, YouTube, CDN i ostale spoljne servise
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigacija: prvo pokušaj najnoviju verziju sa servera
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put("./index.html", copy);
          });

          return response;
        })
        .catch(() => {
          return caches.match("./index.html");
        })
    );

    return;
  }

  // Ostali lokalni fajlovi
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then(response => {
            if (!response || response.status !== 200) {
              return response;
            }

            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, copy);
            });

            return response;
          });
      })
  );
});


// =====================================================
// PUSH NOTIFIKACIJE
// =====================================================

self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "Medjaši Futsal Liga",
      body: event.data ? event.data.text() : "Nova obavijest"
    };
  }

  const title = data.title || "Medjaši Futsal Liga";

  const options = {
    body: data.body || "Nova obavijest",
    icon: "./images/icon-192.png",
    badge: "./images/icon-192.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "./"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});


// =====================================================
// KLIK NA PUSH NOTIFIKACIJU
// =====================================================

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl =
    event.notification.data &&
    event.notification.data.url
      ? event.notification.data.url
      : "./";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clientList => {

      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
