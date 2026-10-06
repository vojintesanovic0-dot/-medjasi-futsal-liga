/* =========================================================
   MEĐASI ADMIN CENTER V2
   Organizes existing admin features into collapsible groups.
   Public site untouched.
========================================================= */
(function(){
  if(window.__MEDJASI_ADMIN_CENTER_V2__) return;
  window.__MEDJASI_ADMIN_CENTER_V2__=true;

  const q=s=>document.querySelector(s);
  const isAdm=()=>typeof window.isAdmin==="function"&&window.isAdmin();

  const groups=[
    {id:"liga",icon:"🏟️",title:"Liga",desc:"Ekipe, igrači, utakmice i live upravljanje."},
    {id:"sadrzaj",icon:"📰",title:"Sadržaj",desc:"Community, vijesti, galerija, moderacija i grafike."},
    {id:"fan",icon:"🎯",title:"Fan Game",desc:"Ponude, obračun poena i fan funkcije."},
    {id:"sistem",icon:"⚙️",title:"Sistem",desc:"Sezone, muzika, push, uloge i napredne postavke."}
  ];

  function card(id){
    const el=document.getElementById(id);
    return el?.closest(".card")||el;
  }

  function groupHtml(g,open=false){
    return `
      <details class="admin-v2-group" data-admin-group="${g.id}" ${open?"open":""}>
        <summary>
          <span class="admin-v2-group-icon">${g.icon}</span>
          <span class="admin-v2-group-copy">
            <strong>${g.title}</strong>
            <small>${g.desc}</small>
          </span>
          <span class="admin-v2-chevron">⌄</span>
        </summary>
        <div class="admin-v2-group-body" data-admin-body="${g.id}"></div>
      </details>`;
  }

  function build(){
    const root=q("#adminContent");
    if(!root||!isAdm()||q("#adminV2Root")) return;

    const legacyGrid=root.querySelector(".admin-grid");
    const existing={
      matches:card("adminMatches"),
      gallery:card("adminGalleryList"),
      music:card("adminMusicPlaylist"),
      news:q("#v7NewsAdmin"),
      season:q("#v7SeasonCard"),
      push:q("#v7PushCard"),
      roles:q("#moderatorManagement"),
      reports:q("#communityModerationCard"),
      crud:q("#adminCrudV4")
    };

    const oldChildren=[...root.children].filter(el=>!el.classList.contains("section-title"));

    const shell=document.createElement("div");
    shell.id="adminV2Root";
    shell.innerHTML=`
      <div class="admin-v2-hero">
        <div>
          <span>ADMIN PANEL</span>
          <h2>⚙️ Upravljanje lige</h2>
          <p>Sve funkcije ostaju, samo su složene jednostavnije.</p>
        </div>
        <div class="admin-v2-hero-actions">
          <button type="button" class="btn btn-green btn-small" data-admin-v2-go="new-match">＋ Nova utakmica</button>
          <button type="button" class="btn btn-blue btn-small" data-admin-v2-go="content">＋ Nova objava</button>
        </div>
      </div>

      <div class="admin-v2-stats">
        <div><b>${window.teams?.length||0}</b><small>EKIPE</small></div>
        <div><b>${window.players?.length||0}</b><small>IGRAČI</small></div>
        <div><b>${window.matches?.length||0}</b><small>UTAKMICE</small></div>
        <div><b>${window.gallery?.length||0}</b><small>MEDIJA</small></div>
      </div>

      <div class="admin-v2-groups">
        ${groups.map((g,i)=>groupHtml(g,i===0)).join("")}
      </div>

      <div class="admin-v2-advanced">
        <button type="button" class="admin-v2-advanced-toggle">▸ Napredne / rijetke radnje</button>
        <div class="admin-v2-advanced-body" hidden></div>
      </div>`;

    // Hide only the original root children until they are moved, then restore their display.
    oldChildren.forEach(el=>{el.dataset.adminV2OriginalDisplay=el.style.display||"";el.style.display="none";});

    root.appendChild(shell);

    const body=id=>shell.querySelector('[data-admin-body="'+id+'"]');
    const move=(el,target)=>{
      if(!el||!target)return;
      target.appendChild(el);
      el.style.display=el.dataset.adminV2OriginalDisplay||"";
      delete el.dataset.adminV2OriginalDisplay;
    };

    if(legacyGrid) move(legacyGrid,body("liga"));
    if(existing.matches) move(existing.matches,body("liga"));
    if(existing.crud) move(existing.crud,body("liga"));

    if(existing.news) move(existing.news,body("sadrzaj"));
    if(existing.gallery) move(existing.gallery,body("sadrzaj"));
    if(existing.reports) move(existing.reports,body("sadrzaj"));

    // Fan Game admin is already inside Pogodi. Provide a clean shortcut instead of duplicating its controls.
    body("fan").innerHTML=`
      <div class="admin-v2-shortcut">
        <div><strong>🎯 Fan Game admin</strong><p>Upravljanje ponudama, obračunom poena i dodjelom poena ostaje u postojećem Fan Game admin dijelu.</p></div>
        <button type="button" class="btn btn-blue btn-small" data-admin-v2-open-game>Otvori Fan Game</button>
      </div>`;

    if(existing.music) move(existing.music,body("sistem"));
    if(existing.season) move(existing.season,body("sistem"));
    if(existing.push) move(existing.push,body("sistem"));
    if(existing.roles) move(existing.roles,body("sistem"));

    const advanced=shell.querySelector(".admin-v2-advanced-body");
    if(existing.crud){
      const note=document.createElement("div");
      note.className="admin-v2-note";
      note.textContent="CRUD i administratorske kontrole ostaju dostupne unutar Lige, bez uklanjanja postojećih funkcija.";
      advanced.appendChild(note);
    }
    advanced.appendChild(document.createElement("div")).innerHTML='<div class="admin-v2-note">Grafike će biti unutar Sadržaja. Figma, Adobe i Canva ostaju samo alat za izradu grafika i šablona; korisnici ih neće vidjeti.</div>';

    // Existing cards injected after boot.
    function classify(){
      const map=[
        ["v7NewsAdmin","sadrzaj"],["adminGalleryList","sadrzaj"],["communityModerationCard","sadrzaj"],
        ["adminMusicPlaylist","sistem"],["v7SeasonCard","sistem"],["v7PushCard","sistem"],["moderatorManagement","sistem"],
        ["adminCrudV4","liga"],["adminMatches","liga"]
      ];
      map.forEach(([id,g])=>{
        const el=document.getElementById(id), target=body(g);
        if(el&&target&&!target.contains(el)) move(el.closest(".card")||el,target);
      });
    }

    shell.querySelectorAll(".admin-v2-group").forEach(d=>{
      d.addEventListener("toggle",()=>classify());
    });

    shell.querySelector(".admin-v2-advanced-toggle")?.addEventListener("click",e=>{
      const b=shell.querySelector(".admin-v2-advanced-body");
      const hidden=b.hasAttribute("hidden");
      b.hidden=!hidden;
      e.currentTarget.textContent=(hidden?"▾ ":"▸ ")+"Napredne / rijetke radnje";
    });

    shell.addEventListener("click",e=>{
      if(e.target.closest("[data-admin-v2-go='new-match']")){
        shell.querySelector('[data-admin-group="liga"]')?.setAttribute("open","");
        setTimeout(()=>document.getElementById("teamName")?.focus(),120);
      }
      if(e.target.closest("[data-admin-v2-go='content']")){
        shell.querySelector('[data-admin-group="sadrzaj"]')?.setAttribute("open","");
      }
      if(e.target.closest("[data-admin-v2-open-game]")){
        window.showSection?.("game");
      }
    });

    window.__MEDJASI_ADMIN_V2_CLASSIFY__=classify;
    classify();
  }

  function refresh(){
    if(!isAdm()) return;
    if(!q("#adminV2Root")) build();
    else window.__MEDJASI_ADMIN_V2_CLASSIFY__?.();
  }

  const oldShow=window.showSection;
  if(oldShow&&!window.__MEDJASI_ADMIN_V2_SHOW_PATCH__){
    window.__MEDJASI_ADMIN_V2_SHOW_PATCH__=true;
    window.showSection=function(id){
      const r=oldShow.apply(this,arguments);
      if(id==="admin") setTimeout(refresh,100);
      return r;
    };
  }

  window.addEventListener("load",()=>setTimeout(refresh,1200));
  setInterval(()=>{if(q("#admin.active")) refresh();},2500);
})();