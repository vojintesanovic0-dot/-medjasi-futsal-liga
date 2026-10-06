/* =========================================================
   MEĐASI ADMIN CENTER
   Reorganizes existing admin tools only.
   No public-site navigation, effects or visual system changes.
========================================================= */
(function(){
  if(window.__MEDJASI_ADMIN_CENTER__) return;
  window.__MEDJASI_ADMIN_CENTER__=true;

  var $=function(s){return document.querySelector(s);};
  var isAdmin=function(){return typeof window.isAdmin==="function"&&window.isAdmin();};

  function cardFor(id){
    var el=document.getElementById(id);
    return el && (el.closest(".card")||el);
  }

  function build(){
    var root=$("#adminContent");
    if(!root||!isAdmin()||$("#adminCenterTabs")) return;

    var legacyGrid=root.querySelector(".admin-grid");
    var adminMatches=cardFor("adminMatches");
    var gallery=cardFor("adminGalleryList");
    var music=cardFor("adminMusicPlaylist");
    var crud=document.getElementById("adminCrudV4");
    var news=document.getElementById("v7NewsAdmin");
    var season=document.getElementById("v7SeasonCard");
    var push=document.getElementById("v7PushCard");
    var roles=document.getElementById("moderatorManagement");
    var reports=document.getElementById("communityModerationCard");

    var head=document.createElement("div");
    head.className="admin-center-head";
    head.innerHTML='<div><div class="admin-center-kicker">ADMIN CONTROL CENTER</div><h2>⚙️ Upravljanje ligom</h2><p>Sve admin funkcije na jednom mjestu. Javni dio sajta ostaje nepromijenjen.</p></div><div class="admin-center-tools"><button class="btn btn-green btn-small" type="button" data-admin-go="match">＋ Nova utakmica</button><button class="btn btn-blue btn-small" type="button" data-admin-go="content">＋ Nova objava</button></div>';
    root.prepend(head);

    var stats=document.createElement("div");
    stats.className="admin-center-overview";
    stats.innerHTML='<div class="admin-center-stat"><b>'+(window.teams?.length||0)+'</b><span>EKIPA</span></div><div class="admin-center-stat"><b>'+(window.players?.length||0)+'</b><span>IGRAČA</span></div><div class="admin-center-stat"><b>'+(window.matches?.length||0)+'</b><span>UTAKMICA</span></div><div class="admin-center-stat"><b>'+(window.gallery?.length||0)+'</b><span>MEDIJA</span></div>';
    root.appendChild(stats);

    var tabs=document.createElement("div");
    tabs.id="adminCenterTabs";
    tabs.className="admin-center-tabs";
    tabs.innerHTML='<button type="button" class="active" data-admin-tab="overview">📊 Pregled</button><button type="button" data-admin-tab="league">🏟️ Liga</button><button type="button" data-admin-tab="content">📰 Sadržaj</button><button type="button" data-admin-tab="system">⚙️ Sistem</button>';
    root.appendChild(tabs);

    var overview=document.createElement("div");
    overview.className="admin-center-section active";
    overview.dataset.adminSection="overview";
    overview.innerHTML='<div class="admin-center-quick"><button type="button" data-admin-go="match"><b>⚽</b><span>Utakmice</span><small>Dodaj, uredi i vodi live događaje.</small></button><button type="button" data-admin-go="content"><b>📰</b><span>Community i sadržaj</span><small>Vijesti, galerija, moderacija i grafike.</small></button><button type="button" data-admin-go="system"><b>🛠️</b><span>Sistem</span><small>Sezone, muzika, push i korisničke uloge.</small></button></div><div class="admin-center-note">💡 <strong>Grafike</strong> ćemo držati ovdje u Sadržaju. Figma, Adobe i Canva služe samo za izradu šablona/grafika — posjetioci ih nikada neće vidjeti.</div><div class="card"><h3>⚡ Brze radnje</h3><p class="muted">Najčešće admin radnje ostaju dostupne bez traženja kroz cijeli panel.</p></div>';
    root.appendChild(overview);

    var league=document.createElement("div");
    league.className="admin-center-section";
    league.dataset.adminSection="league";
    root.appendChild(league);

    var content=document.createElement("div");
    content.className="admin-center-section";
    content.dataset.adminSection="content";
    root.appendChild(content);

    var system=document.createElement("div");
    system.className="admin-center-section";
    system.dataset.adminSection="system";
    root.appendChild(system);

    if(legacyGrid) league.appendChild(legacyGrid);
    if(adminMatches) league.appendChild(adminMatches);
    if(crud) league.appendChild(crud);

    if(news) content.appendChild(news);
    if(gallery) content.appendChild(gallery);
    if(reports) content.appendChild(reports);

    if(music) system.appendChild(music);
    if(season) system.appendChild(season);
    if(push) system.appendChild(push);
    if(roles) system.appendChild(roles);

    function classify(){
      var map=[
        ["v7NewsAdmin","content"],["adminGalleryList","content"],["communityModerationCard","content"],
        ["adminMusicPlaylist","system"],["v7SeasonCard","system"],["v7PushCard","system"],["moderatorManagement","system"],
        ["adminCrudV4","league"],["adminMatches","league"]
      ];
      map.forEach(function(pair){
        var el=document.getElementById(pair[0]);
        var target=root.querySelector('[data-admin-section="'+pair[1]+'"]');
        if(el&&target&&!target.contains(el)) target.appendChild(el.closest(".card")||el);
      });
    }

    function activate(id){
      tabs.querySelectorAll("button").forEach(function(b){b.classList.toggle("active",b.dataset.adminTab===id);});
      root.querySelectorAll("[data-admin-section]").forEach(function(s){s.classList.toggle("active",s.dataset.adminSection===id);});
      classify();
    }

    tabs.querySelectorAll("[data-admin-tab]").forEach(function(btn){
      btn.addEventListener("click",function(){activate(btn.dataset.adminTab);});
    });

    root.addEventListener("click",function(e){
      var target=e.target.closest("[data-admin-go]");
      if(!target) return;
      var go=target.dataset.adminGo;
      activate(go==="match"?"league":go);
      if(go==="match") setTimeout(function(){document.getElementById("teamName")?.focus();},100);
    });

    window.__MEDJASI_ADMIN_CENTER_CLASSIFY__=classify;
    window.__MEDJASI_ADMIN_CENTER_ACTIVATE__=activate;
    classify();
  }

  function refresh(){
    if(!isAdmin()) return;
    var root=$("#adminContent");
    if(!root) return;
    if(!$("#adminCenterTabs")) build();
    setTimeout(function(){window.__MEDJASI_ADMIN_CENTER_CLASSIFY__?.();},80);
  }

  var oldShow=window.showSection;
  if(oldShow&&!window.__MEDJASI_ADMIN_CENTER_SHOW_PATCH__){
    window.__MEDJASI_ADMIN_CENTER_SHOW_PATCH__=true;
    window.showSection=function(id){
      var result=oldShow.apply(this,arguments);
      if(id==="admin") setTimeout(refresh,120);
      return result;
    };
  }

  window.addEventListener("load",function(){setTimeout(refresh,1400);});
  setInterval(function(){if(document.querySelector("#admin.active")) refresh();},2500);
})();