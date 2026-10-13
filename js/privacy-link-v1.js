/* Privacy link visibility v1
   Link "Privatnost i uslovi" je prije bio u footeru koji je na aplikaciji skriven (display:none).
   Ovaj modul ga dodaje na vidljiva mjesta: donju traku na desktopu.
   Mobilni meni "Više" i forma za registraciju imaju link direktno u HTML-u. */
(function () {
  "use strict";
  var HREF = "./privatnost.html";
  var LABEL = "Privatnost i uslovi";

  function addDesktopLink() {
    var footer = document.getElementById("dashboardFooter");
    if (!footer || footer.querySelector(".footer-privacy-link")) return;
    var a = document.createElement("a");
    a.href = HREF;
    a.className = "footer-privacy-link";
    a.textContent = LABEL;
    a.style.cssText =
      "position:absolute;right:14px;bottom:5px;z-index:2;font-size:9px;letter-spacing:.12em;" +
      "text-transform:uppercase;color:#42f58b;text-decoration:none;white-space:nowrap";
    footer.appendChild(a);
  }

  function watch() {
    addDesktopLink();
    // Dashboard footer se dodaje dinamički (dashboard-layout-v1.js), pa pratimo body.
    new MutationObserver(addDesktopLink).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
})();
