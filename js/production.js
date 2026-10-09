/* Medjasi production hardening v10 */
(()=>{"use strict";
const q=s=>document.querySelector(s);
let timer=0;

window.medjasiProduction={
  version:"2026.10",
  refresh(delay=250){
    clearTimeout(timer);
    timer=setTimeout(()=>window.loadAll?.(),delay);
  }
};

function patchImages(){
  document.querySelectorAll("img").forEach(img=>{
    if(img.dataset.prodBound)return;
    img.dataset.prodBound="1";
    img.addEventListener("error",()=>{
      if(img.dataset.prodFailed)return;
      img.dataset.prodFailed="1";
      img.style.opacity=".55";
    },{once:true});
    if(!img.loading && img.width>120)img.loading="lazy";
  });
}

function patchAccessibility(){
  document.querySelectorAll("button").forEach(b=>{
    if(!b.getAttribute("aria-label")&&!b.textContent.trim()&&b.title)b.setAttribute("aria-label",b.title);
  });
}

function run(){
  patchImages();
  patchAccessibility();
}
function registerServiceWorker(){
  if(!("serviceWorker" in navigator)) return;
  const swUrl = new URL("./service-worker.js", document.baseURI);
  navigator.serviceWorker.register(swUrl.href)
    .then(registration => registration.update().catch(error => {
      console.warn("Medjasi PWA update check:", error);
    }))
    .catch(error => console.warn("Medjasi PWA registration:", error));
}
window.addEventListener("load",()=>{
  run();
  registerServiceWorker();
  setTimeout(run,800);
  setTimeout(run,2200);
});
window.addEventListener("error",e=>console.error("Medjasi runtime:",e.error||e.message));
window.addEventListener("unhandledrejection",e=>console.error("Medjasi async:",e.reason));
})();