(function(){
  "use strict";
  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  if (standalone) document.documentElement.classList.add("mfl-standalone");

  function toast(message, actionLabel, onAction){
    if (!document.body) return null;
    var old = document.querySelector(".mfl-app-toast");
    if (old) old.remove();
    var box = document.createElement("div");
    box.className = "mfl-app-toast";
    box.setAttribute("role","status");
    var text = document.createElement("span");
    text.textContent = message;
    box.appendChild(text);
    if (actionLabel) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.textContent = actionLabel;
      btn.addEventListener("click",function(){box.remove(); if(onAction) onAction();});
      box.appendChild(btn);
    }
    var close = document.createElement("button");
    close.type = "button"; close.className = "mfl-app-toast-close";
    close.setAttribute("aria-label","Zatvori obavještenje"); close.textContent = "×";
    close.addEventListener("click",function(){box.remove();});
    box.appendChild(close); document.body.appendChild(box);
    window.requestAnimationFrame(function(){box.classList.add("show");});
    return box;
  }

  if ("serviceWorker" in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var updateShown = false;
    navigator.serviceWorker.addEventListener("controllerchange",function(){
      if (!hadController) { hadController = true; return; }
      if (updateShown) return;
      updateShown = true;
      toast("Nova verzija aplikacije je spremna.","Osvježi",function(){window.location.reload();});
    });
  }

  var overlayOpen = false;
  function isOverlayOpen(){
    return document.body.classList.contains("mobile-more-open") ||
      !!document.querySelector("#modal.active, #login.active, #pwaInstallModal.show, #pwaInstallModal.open, .mobile-more-drawer.open");
  }
  function closeOverlays(){
    var modal = document.getElementById("modal");
    if (modal && modal.classList.contains("active")) {
      if (typeof window.hideModal === "function") window.hideModal();
      else modal.classList.remove("active");
    }
    var login = document.getElementById("login");
    if (login && login.classList.contains("active") && typeof window.exitAuthScreen === "function") {
      window.exitAuthScreen();
    }
    if (document.body.classList.contains("mobile-more-open") && typeof window.closeMobileMore === "function") {
      window.closeMobileMore();
    }
    var installModal = document.getElementById("pwaInstallModal");
    if (installModal && (installModal.classList.contains("show") || installModal.classList.contains("open"))) {
      var closeButton = document.getElementById("pwaModalClose");
      if (closeButton) closeButton.click();
      else installModal.classList.remove("show","open");
    }
  }
  function syncOverlay(){
    var now = isOverlayOpen();
    if (now && !overlayOpen) {
      overlayOpen = true;
      try { history.pushState({mflOverlay:true}, "", location.href); } catch(e) {}
    } else if (!now && overlayOpen) overlayOpen = false;
  }
  if (document.body && window.MutationObserver) {
    new MutationObserver(syncOverlay).observe(document.body,{attributes:true,subtree:true,attributeFilter:["class","aria-modal","hidden"]});
  }
  window.addEventListener("popstate",function(){
    if (overlayOpen) { overlayOpen = false; closeOverlays(); }
  });
})();
