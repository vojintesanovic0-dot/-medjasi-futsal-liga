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
    const venue=String(m.venue||m.location||"Sportska dvorana Međasi");
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
      '<div class="dashboard-next-meta">⌖ '+esc(next.venue||next.location||"Sportska dvorana Međasi")+'</div>'+
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
    target.innerHTML=rows.map(r=>{
      const c=[...r.cells];if(c.length<11)return r.outerHTML;
      const click=r.getAttribute("onclick")||"";
      return '<tr'+(click?' onclick="'+click.replace(/"/g,"&quot;")+'"':'')+'><td>'+c[0].innerHTML+'</td><td>'+c[1].innerHTML+'</td><td>'+c[3].innerHTML+'</td><td>'+c[10].innerHTML+'</td><td>'+c[2].innerHTML+'</td></tr>';
    }).join("");
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
  function syncAdminAccess(){
    const admin=window.currentProfile?.role==="admin";
    ["dashboardAdminNav","dashboardMobileAdminLink"].forEach(id=>{
      const el=$(id);if(el)el.hidden=!admin;
    });
    document.querySelectorAll(".dashboard-admin-group").forEach(el=>el.hidden=!admin);
  }

  function sync(){
    syncAdminAccess();
    renderNext();renderUpcoming();renderSidebarLive();syncTable();syncGallery();renderNewsMirror();syncWallet();syncFooter();
  }
window.dashboardOpenGameTab=function(tab){
    if(typeof window.showSection==="function")window.showSection("game");
    setTimeout(()=>{
      const buttons=[...document.querySelectorAll("#game [data-act='tab'][data-id]")];
      buttons.find(button=>button.getAttribute("data-id")===String(tab))?.click();
    },250);
  };
  window.toggleDashboardGlow=function(){document.body.classList.toggle("dashboard-low-glow");};
  window.dashboardSettings=function(){
    if(window.currentUser&&typeof window.openV9Profile==="function"){window.openV9Profile(window.currentUser.id);return;}
    if(typeof window.showSection==="function")window.showSection("login");
  };
  function applyReferenceLayout(){
    if(document.body.dataset.dashboardReferenceApplied==="1")return;
    const main=document.querySelector("main"),home=$("home"),header=document.querySelector(".site-header");
    if(!main||!home||!header)return;
    document.body.dataset.dashboardReferenceApplied="1";

    const savedIds=["statTeams","statPlayers","statMatches","statGoals","homeAnnouncement","homeLive","homeNext","homeResults","homeForm","homeLeader","homeTopScorer","musicPlayerWrap","musicUnmute","musicHint","heroTeamsMini","heroMatchesMini","heroPlayersMini"];
    const saved={};savedIds.forEach(id=>saved[id]=$(id));

    const logo=header.querySelector(".logo.logo-home"),nav=$("mainNav"),headerInner=header.querySelector(".header-inner"),actions=header.querySelector(".header-actions");
    if(logo){
      const ball=logo.querySelector(".logo-ball");
      if(ball)ball.innerHTML='<img src="./images/icon-192.png" alt="">';
    }
    const sidebar=document.createElement("aside");
    sidebar.className="app-sidebar";sidebar.id="appSidebar";
    sidebar.innerHTML='<div class="sidebar-live-panel"><div class="sidebar-panel-title"><span>LIVE / MATCH CENTER</span><span>×</span></div><div id="sidebarLiveMatch"><div class="dashboard-empty">Provjera utakmica uživo…</div></div></div><div class="sidebar-fan-panel"><div class="sidebar-panel-title"><span>FAN NOVČANIK</span></div><div class="sidebar-fan-level"><div class="sidebar-fan-ring" aria-hidden="true">F</div><div class="sidebar-fan-meta"><b><span id="sidebarFanPoints">—</span> poena</b><small>Raspoloživi poeni</small></div></div></div><div class="sidebar-season-panel"><div class="sidebar-panel-title"><span>SEZONA U TOKU</span><b>↗</b></div><div class="sidebar-season-line"><span id="sidebarSeasonGames">Učitavanje rasporeda</span><b>● ONLINE</b></div><div class="sidebar-season-track"><span></span></div></div>';
    if(logo)sidebar.appendChild(logo);
    const scroll=document.createElement("div");scroll.className="sidebar-scroll";
    if(nav)scroll.appendChild(nav);
    if(nav&&!nav.querySelector("[data-dashboard-tab]")){
      nav.insertAdjacentHTML("beforeend",
        '<div class="nav-group-title dashboard-extras-group">FAN SERVISI</div>'+
        '<button type="button" data-dashboard-tab="shop" onclick="dashboardOpenGameTab(\'shop\')"><span></span><span>Fan Shop</span></button>'+
        '<button type="button" data-dashboard-tab="fanbase" onclick="dashboardOpenGameTab(\'fanbase\')"><span></span><span>Fan Base</span></button>'+
        '<button type="button" data-dashboard-tab="mine" onclick="dashboardOpenGameTab(\'mine\')"><span></span><span>Moji tiketi</span></button>'+
        '<button type="button" data-dashboard-tab="live" onclick="dashboardOpenGameTab(\'live\')"><span></span><span>Live centar</span></button>'+
        '<button type="button" data-dashboard-tab="board" onclick="dashboardOpenGameTab(\'board\')"><span></span><span>Nagrade i poredak</span></button>'+
        '<button type="button" data-dashboard-tab="collection" onclick="dashboardOpenGameTab(\'collection\')"><span></span><span>Kolekcija</span></button>'+
        '<button type="button" data-dashboard-tab="club" onclick="dashboardOpenGameTab(\'club\')"><span></span><span>Moja tribina</span></button>'+
        '<button type="button" data-dashboard-tab="mvp" onclick="dashboardOpenGameTab(\'mvp\')"><span></span><span>MVP</span></button>'+
        '<div class="nav-group-title dashboard-admin-group" hidden>ADMINISTRACIJA</div>'+
        '<button type="button" id="dashboardAdminNav" hidden onclick="showSection(\'admin\')"><span></span><span>Admin panel</span></button>'
      );
    }

    // Keep the remaining Fan Zone destinations at the very end of the sidebar,
    // after the appended Fan Services group, without recreating removed legacy items.
    if(nav){
      const fanZoneTitle=[...nav.querySelectorAll(".nav-group-title")].find(el=>/FAN ZONA/i.test(el.textContent||""));
      const finalButtons=[...nav.querySelectorAll("button")].filter(button=>{
        const handler=button.getAttribute("onclick")||"";
        return /showSection\(['"]game['"]\)/.test(handler)||/showSection\(['"]info['"]\)/.test(handler);
      });
      if(fanZoneTitle&&finalButtons.length===2){
        nav.appendChild(fanZoneTitle);
        finalButtons.forEach(button=>nav.appendChild(button));
      }
    }

    const livePanel=sidebar.querySelector(".sidebar-live-panel");
    sidebar.insertBefore(scroll,livePanel);
    const quickPanel=document.createElement("section");
    quickPanel.className="sidebar-quick-panel";
    quickPanel.innerHTML='<div class="sidebar-panel-title"><span>BRZI PRISTUP</span></div>'+
      '<div class="sidebar-quick-grid">'+
      '<button type="button" onclick="dashboardOpenGameTab(\'shop\')"><span class="sidebar-quick-icon">♜</span><span>Fan Shop</span></button>'+
      '<button type="button" onclick="dashboardOpenGameTab(\'fanbase\')"><span class="sidebar-quick-icon">♟</span><span>Fan Base</span></button>'+
      '<button type="button" onclick="dashboardOpenGameTab(\'mine\')"><span class="sidebar-quick-icon">▣</span><span>Tiketi</span></button>'+
      '<button type="button" onclick="dashboardOpenGameTab(\'collection\')"><span class="sidebar-quick-icon">⬡</span><span>Kolekcija</span></button>'+
      '</div>';
    sidebar.insertBefore(quickPanel,livePanel);

    if(logo)sidebar.insertBefore(logo,sidebar.firstChild);
    document.body.insertBefore(sidebar,header);

    if(headerInner&&actions){
      const mobileBrand=document.createElement("div");mobileBrand.className="dashboard-mobile-brand";
      mobileBrand.innerHTML='<img src="./images/icon-192.png" alt=""><div><strong>MEĐASI</strong><span>FUTSAL LIGA</span></div>';
      headerInner.insertBefore(mobileBrand,actions);
    }
    if(actions&&!actions.querySelector(".header-chat-button")){
      const chat=document.createElement("button");chat.type="button";chat.className="header-chat-button";chat.setAttribute("aria-label","Otvori chat");chat.title="Chat";
      chat.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H9l-4 3z"/><path d="M8 9h8M8 12h5"/></svg>';
      const account=$("headerAccount");
      actions.insertBefore(chat,account||null);
    }
    if(actions){
      const mobile=$("mobileMenuBtn");
      const addAction=(className,label,title,icon,onclick)=>{
        if(actions.querySelector("."+className))return;
        const button=document.createElement("button");button.type="button";button.className="topbar-action "+className;
        button.setAttribute("aria-label",label);button.title=title;button.setAttribute("onclick",onclick);
        const icons={
          "dashboard-glow-toggle":'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.4A8.3 8.3 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z"/></svg>',
          "dashboard-table-shortcut":'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l1 5a5 5 0 0 1-10 0l1-5Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 14v5M8 21h8M9 17h6"/></svg>',
          "dashboard-settings-shortcut":'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/></svg>'
        };
        button.innerHTML=icons[className]||'<span aria-hidden="true">'+icon+'</span>';
        actions.insertBefore(button,mobile||null);
      };
      addAction("dashboard-glow-toggle","Smanji svjetlosne efekte","Smanji svjetlosne efekte","☾","toggleDashboardGlow()");
      addAction("dashboard-table-shortcut","Otvori tabelu","Tabela","♜","showSection('table')");
      addAction("dashboard-settings-shortcut","Profil i postavke","Profil i postavke","⚙","dashboardSettings()");
    }

    home.className="section active dashboard-home";
    home.innerHTML=`
      <section class="dashboard-hero dashboard-panel">
        <div class="dashboard-hero-copy">
          <div class="dashboard-brand-mini"><img src="./images/icon-192.png" alt=""><span>MEĐASI FUTSAL LIGA</span></div>
          <span class="dashboard-welcome">DOBRO DOŠLI NA</span>
          <h1>MEĐASI <span>FUTSAL LIGA</span></h1>
          <h2>Strast. Zajednica. Futsal.</h2>
          <p>Prati utakmice, rezultate, statistiku, igrače i budi dio najveće futsal zajednice u regiji.</p>
          <div class="dashboard-hero-actions"><button class="btn btn-green" onclick="showSection('matches')">▶ &nbsp; Pogledaj utakmice</button><button class="btn btn-ghost" onclick="showSection('community')">♟ &nbsp; Pridruži se zajednici</button></div>
        </div>
        <div class="dashboard-hero-mark"><img src="./images/icon-512.png" alt="Međasi Futsal Liga"><span>SEZONA 2026/27</span></div>
      </section>
      <section class="dashboard-kpis" aria-label="Statistika lige">
        <article class="dashboard-kpi"><span class="dashboard-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="3"/><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6M3 11a2.5 2.5 0 0 0 0 5m18-5a2.5 2.5 0 0 1 0 5"/></svg></span><div><small>EKIPE</small><div data-slot="statTeams"></div><em>U ligi</em></div></article>
        <article class="dashboard-kpi"><span class="dashboard-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="3"/><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6"/></svg></span><div><small>IGRAČI</small><div data-slot="statPlayers"></div><em>Registrovani igrači</em></div></article>
        <article class="dashboard-kpi"><span class="dashboard-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M9 14l2 2 4-4"/></svg></span><div><small>UTAKMICE</small><div data-slot="statMatches"></div><em>Raspored lige</em></div></article>
        <article class="dashboard-kpi"><span class="dashboard-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.4"/><path d="m12 7 3 2 0 4-3 2-3-2V9zM8 4l1 3M16 4l-1 3M4 12l5-1M20 12l-5-1M8 19l2-4M16 19l-2-4"/></svg></span><div><small>GOLOVI</small><div data-slot="statGoals"></div><em>Postignuti golovi</em></div></article>
      </section>
      <section class="dashboard-middle-grid">
        <article class="dashboard-panel dashboard-next-panel"><div class="dashboard-section-head"><h2>Naredna utakmica</h2><small>SLJEDEĆA</small></div><div id="dashboardNextMatch"><div class="dashboard-empty">Učitavanje utakmice…</div></div></article>
        <article class="dashboard-panel dashboard-live-panel"><div class="dashboard-section-head"><h2><span style="color:#ff5866">●</span> Live</h2><button onclick="showSection('matches')">Svi mečevi →</button></div><div id="dashboardHomeLive"></div><button class="dashboard-table-link" onclick="showSection('matches')">Pogledaj sve utakmice →</button></article>
        <article class="dashboard-panel dashboard-table-panel"><div class="dashboard-section-head"><h2>Tabela</h2><button onclick="showSection('table')">Pogledaj kompletnu tabelu →</button></div><table class="dashboard-mini-table"><thead><tr><th>#</th><th>EKIPA</th><th>U</th><th>B</th><th>FORMA</th></tr></thead><tbody id="dashboardMiniTableBody"><tr><td colspan="5">Učitavanje tabele…</td></tr></tbody></table><button class="dashboard-table-link" onclick="showSection('table')">Pogledaj kompletnu tabelu →</button></article>
      </section>
      <section class="dashboard-community-row">
        <article class="dashboard-community-panel"><div class="dashboard-community-symbol"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v11H9l-5 3z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg></div><div class="dashboard-community-copy"><h2>Navijački centar</h2><p>Budi dio naše zajednice! Dijeli, komentariši, navijaj i poveži se sa drugim futsal fanovima.</p><button onclick="showSection('community')">Otvori zajednicu →</button></div></article>
        <article class="dashboard-panel dashboard-rank-panel"><div class="dashboard-section-head"><h2>Top strijelac</h2><button onclick="showSection('stats')">Statistika →</button></div><div id="dashboardHomeScorer"></div></article>
        <article class="dashboard-panel dashboard-rank-panel"><div class="dashboard-section-head"><h2>Top forma</h2><button onclick="showSection('table')">Poredak →</button></div><div id="dashboardHomeForm"></div></article>
      </section>
      <section class="dashboard-bottom-grid">
        <article class="dashboard-panel dashboard-bottom-panel"><div class="dashboard-section-head"><h2>Galerija</h2><button onclick="showSection('gallery')">Pogledaj sve →</button></div><div id="dashboardGalleryThumbs" class="dashboard-gallery-strip"><div class="dashboard-empty">Fotografije lige</div></div></article>
        <article id="dashboardMusicPlayer" class="dashboard-panel dashboard-bottom-panel"><div class="dashboard-section-head"><h2>Playlist / YT Music</h2><button onclick="dashboardOpenGameTab('club')">Fan zona →</button></div><p style="font-size:9px;color:#a3b8b0;line-height:1.4;margin:0 0 6px">Soundtrack Međasi Futsal Lige</p><div id="dashboardMusicInner"><div class="music-player" id="musicPlayerWrap"></div></div><div class="dashboardMusicActions"><button class="btn btn-green btn-small" id="musicUnmute" onclick="unmuteMusic()" style="display:none">Uključi zvuk</button><span class="muted" id="musicHint"></span></div></article>
        <article class="dashboard-panel dashboard-bottom-panel"><div class="dashboard-section-head"><h2>Fan Shop</h2><button onclick="dashboardOpenGameTab('shop')">Pogledaj sve →</button></div><div class="dashboard-shop-promo"><div class="dashboard-shop-shirt"><svg viewBox="0 0 64 64" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m19 9 9-4h8l9 4 12 10-8 9-6-5v32H21V23l-6 5-8-9z"/><path d="M28 5c0 7 8 7 8 0M28 23l4 4 4-4M32 27v12M25 34h14"/></svg></div><div class="dashboard-shop-copy"><b>Ekskluzivni dres Međasi</b><small>Premijum kolekcija · Fan Shop</small><button onclick="dashboardOpenGameTab('shop')">Otvori shop →</button></div></div></article>
      </section>
      <div class="dashboard-hidden-mounts" aria-hidden="true"><div id="dashboardHiddenMounts"></div></div>`;

    Object.keys(saved).forEach(id=>{const node=saved[id];if(!node)return;const slot=home.querySelector('[data-slot="'+id+'"]');if(slot){slot.appendChild(node);return;}if(["homeLive","homeTopScorer","homeForm","musicPlayerWrap","musicUnmute","musicHint"].includes(id))return;const hidden=$("dashboardHiddenMounts");if(hidden)hidden.appendChild(node);});
    const replace=(id,targetSelector)=>{
      const node=saved[id],placeholder=home.querySelector("#"+id);
      const target=home.querySelector(targetSelector);
      if(!node||!target)return;
      if(placeholder&&placeholder!==node)placeholder.replaceWith(node);else target.appendChild(node);
    };
    replace("homeLive","#dashboardHomeLive");
    replace("homeTopScorer","#dashboardHomeScorer");
    replace("homeForm","#dashboardHomeForm");
    replace("musicPlayerWrap","#dashboardMusicInner");
    replace("musicUnmute",".dashboardMusicActions");
    replace("musicHint",".dashboardMusicActions");

    const mainRails=`
      <aside class="dashboard-right-rail" id="dashboardRightRail" aria-label="Aktuelnosti lige">
        <section class="dashboard-rail-panel"><div class="dashboard-section-head"><h2>Sljedeće utakmice</h2><button onclick="showSection('matches')">Pogledaj sve →</button></div><div id="dashboardUpcomingCards" class="dashboard-upcoming-list"><div class="dashboard-empty">Učitavanje rasporeda…</div></div></section>
        <section class="dashboard-rail-panel"><div class="dashboard-section-head"><h2>Novosti</h2><button onclick="showSection('news')">Pogledaj sve →</button></div><div id="dashboardNewsList" class="dashboard-news-list"><div class="dashboard-news-empty">Učitavanje vijesti…</div></div></section>
        <section class="dashboard-rail-panel"><div class="dashboard-section-head"><h2>Fan Base</h2><small>ZAJEDNICA</small></div><div class="dashboard-fanbase-content"><div class="dashboard-fanbase-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="3"/><path d="M4 20c.7-4 3.2-6 8-6s7.3 2 8 6"/></svg></div><div><b>Postani dio Fan Base!</b><small>Više nivoa, više pogodnosti i više nagrada.</small><button onclick="dashboardOpenGameTab('fanbase')">Pridruži se →</button></div></div></section>
      </aside>
      `;
    if(!$("dashboardRightRail"))main.insertAdjacentHTML("beforeend",mainRails);
    if(!$("dashboardFooter")){
      const footer=document.createElement("footer");footer.id="dashboardFooter";footer.className="dashboard-footer";
      footer.innerHTML='<div class="dashboard-footer-season"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg><span>SEZONA 2026/27</span></div><div class="dashboard-footer-brand">MEĐASI FUTSAL LIGA &nbsp; • &nbsp; STRAST &nbsp; • &nbsp; ZAJEDNICA &nbsp; • &nbsp; FUTSAL</div><div class="dashboard-footer-stats"><span>♜ <b id="footerTeams">0</b> ekipa</span><span>♟ <b id="footerPlayers">0</b> igrača</span><span>▣ <b id="footerMatches">0</b> utakmica</span></div><div class="dashboard-footer-social"><span aria-hidden="true">▶</span><span aria-hidden="true">◎</span><span aria-hidden="true">♪</span><span aria-hidden="true">f</span></div>';
      document.body.appendChild(footer);
    }
  }

  function bindResponsiveNavigation(){
    const nav=$("mainNav");
    if(!nav||nav.dataset.dashboardCloseBound==="1")return;
    nav.dataset.dashboardCloseBound="1";
    nav.addEventListener("click",event=>{
      const button=event.target.closest("button");
      if(!button||!nav.classList.contains("mobile-open")||window.innerWidth>1024)return;
      window.setTimeout(()=>{if(nav.classList.contains("mobile-open")&&typeof window.toggleMobileMenu==="function")window.toggleMobileMenu();},0);
    });
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"&&nav.classList.contains("mobile-open")&&typeof window.toggleMobileMenu==="function")window.toggleMobileMenu();
    });
    document.addEventListener("click",event=>{
      if(window.innerWidth>1024||!nav.classList.contains("mobile-open"))return;
      if(event.target.closest("#mainNav")||event.target.closest("#mobileMenuBtn"))return;
      if(typeof window.toggleMobileMenu==="function")window.toggleMobileMenu();
    });
  }

  function start(){
    applyReferenceLayout();
    bindResponsiveNavigation();
    sync();
    [400,1000,2200,5000,9000].forEach(delay=>setTimeout(sync,delay));
    window.addEventListener("focus",sync);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)sync();});
    setInterval(sync,12000);
    const watch=id=>{
      const el=$(id);if(!el)return;
      new MutationObserver(()=>setTimeout(sync,40)).observe(el,{childList:true,subtree:true});
    };
    ["tableBody","galleryGrid","news","homeLive","game"].forEach(watch);
    const main=document.querySelector("main");
    if(main)new MutationObserver(records=>{
      if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.id==="news"||n.id==="game"||n.id==="info")))){
        ["news","game"].forEach(watch);setTimeout(sync,100);
      }
    }).observe(main,{childList:true,subtree:false});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
