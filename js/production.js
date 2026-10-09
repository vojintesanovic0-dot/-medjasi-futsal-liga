/* Medjasi production hardening v10 */
(()=>{"use strict";
const q=s=>document.querySelector(s);
let timer=0;

function loadScriptOnce(src,flag){
  if(document.querySelector(`script[data-${flag}]`)) return;
  const s=document.createElement('script');
  s.src=src;
  s.defer=false;
  s.dataset[flag]='1';
  document.head.appendChild(s);
}

function loadGalleryFixes(){
  loadScriptOnce('./js/gallery-fixes.js?v=20261008v01','medjasiGalleryFixes');
}

function loadFanFixes(){
  loadScriptOnce('./js/fan-fixes.js?v=20261008v01','medjasiFanFixes');
}

window.medjasiProduction={
  version:"2026.10",
  refresh(delay=250){
    clearTimeout(timer);
    timer=setTimeout(()=>window.loadAll?.(),delay);
  },
  loadGalleryFixes,
  loadFanFixes
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
function bootFixes(){
  run();
  loadGalleryFixes();
  loadFanFixes();
  setTimeout(run,800);
  setTimeout(run,2200);
  setTimeout(loadGalleryFixes,1200);
  setTimeout(loadFanFixes,1200);
}
window.addEventListener("DOMContentLoaded",bootFixes,{once:true});
window.addEventListener("load",bootFixes,{once:true});
window.addEventListener("error",e=>console.error("Medjasi runtime:",e.error||e.message));
window.addEventListener("unhandledrejection",e=>console.error("Medjasi async:",e.reason));
})();