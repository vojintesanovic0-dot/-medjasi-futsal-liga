/* Medjasi production hardening v10 */
(()=>{"use strict";
const q=s=>document.querySelector(s);
let timer=0;

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

window.medjasiProduction={
  version:"2026.10",
  refresh(delay=250){
    clearTimeout(timer);
    timer=setTimeout(()=>window.loadAll?.(),delay);
  }
};

function patchRealtime(){
  try{
    if(window.realtimeChannel&&window.supabaseClient){
      window.supabaseClient.removeChannel(window.realtimeChannel);
    }
    if(!window.supabaseClient)return;
    const channel=window.supabaseClient.channel("medjasi-production-live");
    ["matches","goals","cards","match_players","comments","messages","gallery"].forEach(table=>{
      channel.on("postgres_changes",{event:"*",schema:"public",table},()=>window.medjasiProduction.refresh());
    });
    channel.on("postgres_changes",{event:"*",schema:"public",table:"site_settings"},()=>window.loadMusicSettings?.());
    channel.on("postgres_changes",{event:"*",schema:"public",table:"music_tracks"},()=>window.loadMusicSettings?.());
    channel.on("postgres_changes",{event:"*",schema:"public",table:"news"},()=>window.medjasiV7?.loadNews?.());
    channel.subscribe();
    window.realtimeChannel=channel;
  }catch(e){console.warn("Realtime patch:",e)}
}

function patchNavigation(){
  document.querySelectorAll("#mainNav button").forEach(b=>{
    const oc=b.getAttribute("onclick")||"";
    if(oc.includes("showSection('comments')")){
      b.setAttribute("onclick","showSection('news')");
      b.innerHTML="<span>📰</span><span>Vijesti</span>";
    }
  });
}

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
  patchNavigation();
  patchImages();
  patchAccessibility();
  patchRealtime();
}
window.addEventListener("load",()=>{run();setTimeout(run,800);setTimeout(run,2200)});
window.addEventListener("error",e=>console.error("Medjasi runtime:",e.error||e.message));
window.addEventListener("unhandledrejection",e=>console.error("Medjasi async:",e.reason));
})();