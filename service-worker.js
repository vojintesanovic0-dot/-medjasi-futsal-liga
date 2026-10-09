const CACHE_NAME = "medjasi-futsal-pwa-v106";
const CDN_CACHE = "medjasi-cdn-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/app.css?v=20261006v21",
  "./js/app.js?v=20261010v20",
  "./js/effects.js?v=1",
  "./css/production.css?v=20261007v23",
  "./css/visual-redesign-v1.css?v=1",
  "./css/effects.css?v=1",
  "./css/game.css?v=20261007v02",
  "./js/production.js?v=20261005",
  "./js/game.js?v=20261009v06",
  "./js/growth.js?v=20261009v06",
  "./js/community-features.js?v=20261007v02",
  "./js/ui-compat.js?v=20261009v01",
  "./css/admin-organizer.css?v=5",
  "./css/graphic-engine.css?v=1",
  "./css/extras.css?v=1",
  "./css/header-final.css?v=9",
  "./js/extras.js?v=1",
  "./offline.html",
  "./css/medjasi-icons-v1.css?v=20261007v02",
  "./css/medjasi-icons-v2.css?v=20261009v02",
  "./css/medjasi-home-v2.css?v=1",
  "./css/medjasi-matches-v2.css?v=1",
  "./css/medjasi-league-data-v2.css?v=1",
  "./css/medjasi-community-media-v2.css?v=1",
  "./css/medjasi-fan-profile-v2.css?v=1",
  "./css/medjasi-mobile-v2.css?v=1",
  "./css/medjasi-admin-v2.css?v=1",
  "./css/medjasi-sitewide-v3.css?v=1",
  "./css/medjasi-dashboard-reference-v1.css?v=1",
  "./css/medjasi-dashboard-refinements-v2.css?v=7",
  "./css/medjasi-header-fix-v1.css?v=1",
  "./js/dashboard-layout-v1.js?v=20261009v7",
  "./css/medjasi-design-v11.css?v=20261007v02",
  "./css/medjasi-design-v13.css?v=20261007v02",
  "./js/admin-organizer.js?v=14",
  "./js/graphic-engine.js?v=1",
  "./js/medjasi-v13-ui.js?v=20261007v01",
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
            .filter(key => key !== CACHE_NAME && key !== CDN_CACHE)
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

  // Supabase biblioteka sa jsDelivr-a: keširamo je za offline/ponovljeno učitavanje.
  if(url.origin !== self.location.origin){
    if(url.hostname === "cdn.jsdelivr.net"){
      event.respondWith(
        caches.open(CDN_CACHE).then(cache =>
          cache.match(request).then(hit => {
            const net=fetch(request)
              .then(response=>{
                if(response&&(response.status===200||response.type==="opaque")){
                  cache.put(request,response.clone());
                }
                return response;
              })
              .catch(()=>hit);
            return hit||net;
          })
        )
      );
    }
    return;
  }

  // Navigacija: prvo pokušaj najnoviju verziju sa servera
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put("./index.html", copy);
          });

          return response;
        })
        .catch(() => {
          return caches.match("./index.html").then(r=>r||caches.match("./offline.html"));
        })
    );

    return;
  }

  // JS/CSS: uvijek prvo uzmi svježu verziju sa servera.
  // Ovo sprečava da stari Service Worker zadrži pokvareni app.js nakon deploya.
  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
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
      title: "Međasi Futsal Liga",
      body: event.data ? event.data.text() : "Nova obavijest"
    };
  }

  const title = data.title || "Međasi Futsal Liga";

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

  const target=new URL(targetUrl,self.registration.scope).href;
  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(async clientList=>{
      for(const client of clientList){
        if(client.url===target&&"focus" in client) return client.focus();
      }
      for(const client of clientList){
        if("focus" in client&&"navigate" in client){
          try{await client.navigate(target)}catch(error){}
          return client.focus();
        }
      }
      if(clients.openWindow) return clients.openWindow(target);
    })
  );
});