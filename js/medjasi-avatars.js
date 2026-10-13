/* =========================================================
   MEĐASI - avatari za korisnike
   - koristi sigurnu korisničku sliku ako postoji
   - inače generiše SVG sa stabilnim inicijalima i bojom po korisniku
========================================================= */
(() => {
  "use strict";

  const PALETTE = [
    ["#b7ff55", "#0b2a16"],
    ["#55d2ff", "#0b1f2e"],
    ["#ffb84d", "#2e1d08"],
    ["#ff6b8a", "#2e0f18"],
    ["#c08bff", "#1d1230"],
    ["#4de3b5", "#0a2a24"]
  ];

  function hash(str) {
    let h = 2166136261;
    for (const ch of String(str)) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function initials(name) {
    const parts = String(name || "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || "");
    return (first + last).toLocaleUpperCase("bs-BA");
  }

  function svgAvatar(username, seed) {
    const [fg, bg] = PALETTE[hash(seed) % PALETTE.length];
    const text = initials(username);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + bg + '"/>' +
      '<stop offset="1" stop-color="#020604"/></linearGradient></defs>' +
      '<rect width="160" height="160" rx="32" fill="url(#g)"/>' +
      '<circle cx="128" cy="32" r="18" fill="' + fg + '" opacity=".18"/>' +
      '<path d="M0 132 L160 92 L160 160 L0 160Z" fill="' + fg + '" opacity=".12"/>' +
      '<text x="80" y="101" text-anchor="middle" font-family="Arial,sans-serif" ' +
      'font-size="58" font-weight="800" fill="' + fg + '">' + text + '</text>' +
      '</svg>';
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function isSafeImageUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return false;
    try {
      const u = new URL(raw, window.location.href);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch (error) {
      return false;
    }
  }

  window.medjasiUserAvatar = function(profile) {
    try {
      if (profile && isSafeImageUrl(profile.avatar_url)) return profile.avatar_url;
      const name = profile?.username || profile?.name || "";
      const seed = profile?.id || profile?.user_id || name || "anon";
      return svgAvatar(name, seed);
    } catch (error) {
      return "./images/icon-192.png";
    }
  };
})();
