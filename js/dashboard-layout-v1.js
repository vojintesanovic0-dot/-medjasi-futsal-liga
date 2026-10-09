/* Dashboard reference layout helpers.
   This layer consumes existing app state/renderers; it does not replace business logic. */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=value=>typeof window.esc==="function"?window.esc(value??""):String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const allMatches=()=>Array.isArray(window.matches)?window.matches:[];
  const allTeams=()=>Array.isArray(window.teams)?window.teams:[];
  const findTeam=id=>allTeams().find(t=>String(t.id)===String(id));
  const safeImage=value=>{
    const s=String(value||"");
    if(/^https?:\/\//i.test(s)||s.startsWith("./")||s.startsWith("../")||s.startsWith("/"))return s;
    return "./images/icon-192.png";
  };
  const teamImage=team=>safeImage(team?.logo_url||"./images/icon-192.png");
  const teamTitle=team=>String(team?.name||"Ekipa");
  const fmt=value=>{
    if(typeof window.formatDate==="function")return window.formatDate(value);
    if(!value)return "Termin nije određen";
    const d=new Date(value);
    return Number.isNaN(d.getTime())?"Termin nije određen":d.toLocaleString("bs-BA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
  };
  const upcoming=()=>allMatches().filter(m=>m.status==="scheduled").sort((a,b)=>new Date(a.match_date||0)-new Date(b.match_date||0));
  const liveMatches=()=>allMatches().filter(m=>m.status==="live").sort((a,b)=>(Number(b.current_minute)||0)-(Number(a.current_minute)||0));
  function fixtureMarkup(m,phone=false){
    const home=findTeam(m.home_team_id),away=findTeam(m.away_team_id);
    const venue=String(m.venue||m.location||"Sportska dvorana Medjaši");
    const meta=fmt(m.match_date)+(m.round?" · "+esc(m.round)+". kolo":"");
    return '<div class="dashboard-upcoming-item"'+(phone?'':' onclick="openMatch(\''+esc(m.id)+'\')"')+'>'+
      '<div class="dashboard-upcoming-meta">'+esc(meta)+'</div>'+
      '<div class="dashboard-upcoming-venue">⌖ '+esc(venue)+'</div>'+
      '<div class="dashboard-upcoming-teams">'+
      '<div><img src="'+esc(teamImage(home))+'" alt=""><strong>'+esc(teamTitle(home))+'</strong></div>'+
      '<span>VS</span>'+
      '<div><img src="'+esc(teamImage(away))+'" alt=""><strong>'+esc(teamTitle(away))+'</strong></div>'+
      '</div>'+
      (phone?'':'<button type="button" onclick="event.stopPropagation();openMatch(\''+esc(m.id)+'\')">Detalji&nbsp; →</button>')+
      '</div>';
  }
  function renderNext(){
    const host=$("dashboardNextMatch");if(!host)return;
    const next=upcoming()[0];
    if(!next){host.innerHTML='<div class="dashboard-empty">Trenutno nema zakazane naredne utakmice.<br>Prati raspored lige za nove termine.</div>';return;}
    const home=findTeam(next.home_team_id),away=findTeam(next.away_team_id);
    host.innerHTML='<div class="dashboard-next-card">'+
      '<div class="dashboard-next-top"><span class="dashboard-lime-chip">Naredna utakmica</span><small>'+esc(next.round?String(next.round)+". KOLO":"RASPORED")+'</small></div>'+
      '<div class="dashboard-next-meta">◷ '+esc(fmt(next.match_date))+'</div>'+
      '<div class="dashboard-next-meta">⌖ '+esc(next.venue||next.location||"Sportska dvorana Medjaši")+'</div>'+
      '<div class="dashboard-fixture-teams">'+
      '<div class="dashboard-fixture-team"><img src="'+esc(teamImage(home))+'" alt=""><span>'+esc(teamTitle(home))+'</span></div>'+
      '<span class="dashboard-fixture-vs">VS</span>'+
      '<div class="dashboard-fixture-team"><img src="'+esc(teamImage(away))+'" alt=""><span>'+esc(teamTitle(away))+'</span></div>'+
      '</div><div class="dashboard-fixture-details"><button type="button" onclick="openMatch(\''+esc(next.id)+'\')">Detalji utakmice&nbsp; →</button></div></div>';
  }
  function renderUpcoming(){
    const host=$("dashboardUpcomingCards");if(!host)return;
    const rows=upcoming().slice(0,3);
    host.innerHTML=rows.length?rows.map(m=>fixtureMarkup(m,false)).join(""):'<div class="dashboard-empty">Nema narednih utakmica.</div>';
    const phone=$("dashboardPhoneNext");
    if(phone)phone.innerHTML=rows.length?fixtureMarkup(rows[0],true):'<div class="dashboard-empty">Nema zakazane utakmice.</div>';
  }
  function renderSidebarLive(){
    const host=$("sidebarLiveMatch");if(!host)return;
    const m=liveMatches()[0];
    if(!m){
      host.innerHTML='<div class="dashboard-empty" style="padding:6px 0!important">Nema aktivne utakmice uživo.</div><button type="button" onclick="showSection(\'matches\')">Pogledaj raspored →</button>';
      return;
    }
    const home=findTeam(m.home_team_id),away=findTeam(m.away_team_id);
    host.innerHTML='<div class="sidebar-live-match" onclick="openMatch(\''+esc(m.id)+'\')">'+
      '<div class="sidebar-live-match-top"><span class="sidebar-live-status">● LIVE</span><span>'+(Number(m.current_minute)||0)+"′ · "+esc(m.round?m.round+". kolo":"Liga")+'</span></div>'+
      '<div class="sidebar-live-match-row">'+
      '<div class="sidebar-live-team"><img src="'+esc(teamImage(home))+'" alt="">'+esc(teamTitle(home))+'</div>'+
      '<div class="sidebar-live-score">'+Number(m.home_score||0)+' : '+Number(m.away_score||0)+'</div>'+
      '<div class="sidebar-live-team"><img src="'+esc(teamImage(away))+'" alt="">'+esc(teamTitle(away))+'</div>'+
      '</div></div><button type="button" onclick="showSection(\'matches\')">Pogledaj detalje →</button>';
  }
  function syncTable(){
    const source=$("tableBody"),target=$("dashboardMiniTableBody");if(!source||!target)return;
    const rows=[...source.querySelectorAll("tr")].slice(0,6);
    target.innerHTML=rows.map(r=>r.outerHTML).join("");
  }
  function syncGallery(){
    const source=$("galleryGrid"),target=$("dashboardGalleryThumbs");if(!source||!target)return;
    const cards=[...source.querySelectorAll(".gallery-item")].slice(0,3);
    if(!cards.length){target.innerHTML='<div class="dashboard-empty">Galerija će se prikazati kad budu objavljene fotografije.</div>';return;}
    target.innerHTML=cards.map((card,i)=>{
      const media=card.querySelector(".gallery-photo img, .gallery-photo video");
      const button=card.querySelector(".gallery-photo");
      if(!media)return "";
      const clone=button?button.cloneNode(true):null;
      if(!clone)return "";
      clone.className="dashboard-gallery-thumb";
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach(el=>el.removeAttribute("id"));
      clone.querySelectorAll("img,video").forEach(el=>{el.removeAttribute("loading");el.setAttribute("alt","Fotografija lige");});
      return clone.outerHTML;
    }).join("");
  }
  function renderNewsMirror(){
    const host=$("dashboardNewsList");if(!host)return;
    const news=$("news");
    if(!news){host.innerHTML='<div class="dashboard-news-empty">Vijesti i objave lige.<br><button type="button" onclick="showSection(\'news\')">Otvori sve vijesti →</button></div>';return;}
    const candidates=[...news.querySelectorAll('[class*="news-row"],[class*="news-card"],[class*="news-item"],article')];
    const cards=candidates.filter(node=>!candidates.some(parent=>parent!==node&&parent.contains(node))).slice(0,3);
    if(!cards.length){host.innerHTML='<div class="dashboard-news-empty">Objave iz lige pojaviće se ovdje kada budu dostupne.<br><button type="button" onclick="showSection(\'news\')">Otvori sve vijesti →</button></div>';return;}
    host.innerHTML=cards.map(card=>{
      const clone=card.cloneNode(true);
      clone.querySelectorAll("[id]").forEach(el=>el.removeAttribute("id"));clone.removeAttribute("id");
      clone.querySelectorAll("button,input,textarea,select").forEach(el=>el.remove());
      const image=clone.querySelector("img,video");
      const title=clone.querySelector("h1,h2,h3,h4,strong,b,[class*='title']");
      const text=(title?.textContent||clone.textContent||"Novosti iz lige").trim().replace(/\s+/g," ").slice(0,110);
      const src=image?(image.currentSrc||image.getAttribute("src")||""):"";
      const date=clone.querySelector("time,small,[class*='date']");
      return '<div class="dashboard-news-card">'+(src?'<img src="'+esc(safeImage(src))+'" alt="">':'<span class="dashboard-news-placeholder">MFL</span>')+'<div><b>'+esc(text)+'</b><small>'+esc(date?.textContent?.trim()||"Vijest lige")+'</small></div></div>';
    }).join("");
  }
  function syncWallet(){
    const host=$("sidebarFanPoints");if(!host)return;
    const source=document.querySelector("#game .fg-head .fg-bal b");
    host.textContent=source?.textContent?.trim()||"—";
  }
  function syncFooter(){
    [["statTeams","footerTeams"],["statPlayers","footerPlayers"],["statMatches","footerMatches"]].forEach(([from,to])=>{
      const a=$(from),b=$(to);if(a&&b)b.textContent=a.textContent||"0";
    });
    const season=$("sidebarSeasonGames");
    if(season)season.textContent=allMatches().length+" utakmica u rasporedu";
  }
  function sync(){
    renderNext();renderUpcoming();renderSidebarLive();syncTable();syncGallery();renderNewsMirror();syncWallet();syncFooter();
  }
  window.toggleDashboardGlow=function(){document.body.classList.toggle("dashboard-low-glow");};
  window.dashboardSettings=function(){
    if(window.currentUser&&typeof window.openV9Profile==="function"){window.openV9Profile(window.currentUser.id);return;}
    if(typeof window.showSection==="function")window.showSection("login");
  };
  function start(){
    sync();
    [400,1000,2200,5000,9000].forEach(delay=>setTimeout(sync,delay));
    window.addEventListener("focus",sync);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)sync();});
    setInterval(sync,12000);
    const watch=id=>{
      const el=$(id);if(!el)return;
      new MutationObserver(()=>setTimeout(sync,40)).observe(el,{childList:true,subtree:true});
    };
    ["tableBody","galleryGrid","news","homeLive","gameRoot"].forEach(watch);
    const main=$("main");
    if(main)new MutationObserver(records=>{
      if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.id==="news"||n.id==="game"||n.id==="info")))){
        ["news","gameRoot"].forEach(watch);setTimeout(sync,100);
      }
    }).observe(main,{childList:true,subtree:false});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
