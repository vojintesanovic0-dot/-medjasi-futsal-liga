/* =========================================================
   MEĐASI ADMIN ORGANIZER
   Physical grouping: every admin card belongs to ONE group.
   Existing functions/cards are moved, never cloned or deleted.
========================================================= */
(function(){
  if(window.__MEDJASI_ADMIN_ORGANIZER__) return;
  window.__MEDJASI_ADMIN_ORGANIZER__=true;

  const root=()=>document.getElementById("adminContent");
  const isAdmin=()=>typeof window.isAdmin==="function"&&window.isAdmin();

  const groups=[
    {id:"liga",icon:"⚽",title:"Liga",desc:"Ekipe • igrači • utakmice • CRUD"},
    {id:"sadrzaj",icon:"📰",title:"Sadržaj",desc:"Vijesti • galerija • objave"},
    {id:"dizajn",icon:"🎨",title:"Graphic Studio",desc:"Player cards • MVP • grafike"},
    {id:"moderacija",icon:"🛡️",title:"Moderacija",desc:"Community • prijave • pregled"},
    {id:"sistem",icon:"⚙️",title:"Sistem",desc:"Sezone • muzika • push • uloge"}
  ];

  let active="liga";
  let moving=false;

  function classify(el){
    if(!el || el.id==="adminOrganizer" || el.dataset.adminOrganizerGroupContainer) return null;

    const id=el.id||"";
    const cls=el.classList||{contains:()=>false};
    const has=(selector)=>!!el.querySelector?.(selector);

    // LIGA
    if(cls.contains("admin-grid")) return "liga";
    if(id==="adminMatches" || has("#adminMatches")) return "liga";
    if(id==="adminCrudV4" || has("#adminCrudV4")) return "liga";

    // SADRŽAJ — Gallery is ONE card, including its album tools.
    if(id==="v7NewsAdmin" || has("#v7NewsAdmin")) return "sadrzaj";
    if(id==="adminGalleryList" || has("#adminGalleryList")) return "sadrzaj";
    if(id==="communityAlbumAdmin" || has("#communityAlbumAdmin")) return "sadrzaj";

    // DESIGN
    if(id==="graphicEngineCard" || has("#graphicEngineCard")) return "dizajn";

    // MODERATION
    if(id==="communityModerationCard" || has("#communityModerationCard")) return "moderacija";

    // SYSTEM
    if(id==="adminMusicPlaylist" || has("#adminMusicPlaylist") || cls.contains("admin-music-card")) return "sistem";
    if(id==="v7SeasonCard" || has("#v7SeasonCard")) return "sistem";
    if(id==="v7PushCard" || has("#v7PushCard")) return "sistem";
    if(id==="moderatorManagement" || has("#moderatorManagement")) return "sistem";

    return null;
  }

  function buildShell(host){
    let organizer=document.getElementById("adminOrganizer");
    if(organizer) return organizer;

    organizer=document.createElement("div");
    organizer.id="adminOrganizer";
    organizer.className="admin-organizer";
    organizer.innerHTML=
      '<div class="admin-organizer-head">'+
        '<div><span class="admin-organizer-kicker">ADMIN CENTAR</span><strong>Sve funkcije organizovane po područjima</strong><p>Svaka funkcija nalazi se samo u jednoj grupi. Ništa nije uklonjeno.</p></div>'+
      '</div>'+
      '<div class="admin-organizer-tabs">'+
        '<button type="button" class="admin-organizer-tab active" data-admin-filter="all"><b>▦</b><span>Sve funkcije</span><small>Prikaži sve grupe</small></button>'+
        groups.map(g=>'<button type="button" class="admin-organizer-tab" data-admin-filter="'+g.id+'"><b>'+g.icon+'</b><span>'+g.title+'</span><small>'+g.desc+'</small></button>').join("")+
      '</div>'+
      '<div id="adminOrganizerStatus" class="admin-organizer-status"><i></i><span>Prikaz: <strong>Sve funkcije</strong></span></div>'+
      '<div class="admin-organizer-groups"></div>';

    host.prepend(organizer);

    const wrap=organizer.querySelector(".admin-organizer-groups");
    groups.forEach(g=>{
      const section=document.createElement("section");
      section.className="admin-organizer-group";
      section.dataset.adminOrganizerGroupContainer=g.id;
      section.innerHTML=
        '<div class="admin-organizer-group-head"><div><span>'+g.icon+'</span><div><strong>'+g.title+'</strong><small>'+g.desc+'</small></div></div></div>'+
        '<div class="admin-organizer-group-body" data-admin-group-body="'+g.id+'"></div>';
      wrap.appendChild(section);
    });

    organizer.querySelectorAll("[data-admin-filter]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        active=btn.dataset.adminFilter||"all";
        organizer.querySelectorAll(".admin-organizer-tab").forEach(b=>b.classList.toggle("active",b===btn));
        render();
      });
    });

    return organizer;
  }

  function moveCards(host,organizer){
    if(moving) return;
    moving=true;

    try{
      const bodies={};
      groups.forEach(g=>bodies[g.id]=organizer.querySelector('[data-admin-group-body="'+g.id+'"]'));

      // Only direct children are candidates. A card moved into a group is no
      // longer a direct child of adminContent, so it cannot be picked twice.
      [...host.children].forEach(el=>{
        if(el===organizer) return;
        if(el.dataset.adminOrganizerManaged==="1") return;

        const group=classify(el);
        if(!group || !bodies[group]) return;

        el.dataset.adminOrganizerManaged="1";
        el.dataset.adminOrganizerGroup=group;
        bodies[group].appendChild(el);
      });

      // Dynamic tools can sometimes be created inside an already managed card.
      // They stay with their parent; we never create a second copy.
    }finally{
      moving=false;
    }
  }

  function render(){
    const host=root();
    if(!host || !isAdmin()) return;

    const organizer=buildShell(host);
    moveCards(host,organizer);

    const sections=organizer.querySelectorAll(".admin-organizer-group");
    sections.forEach(section=>{
      const show=active==="all" || section.dataset.adminOrganizerGroupContainer===active;
      section.hidden=!show;
    });

    const label=active==="all"?"Sve funkcije":(groups.find(g=>g.id===active)?.title||"Sve funkcije");
    const status=organizer.querySelector("#adminOrganizerStatus");
    if(status) status.innerHTML='<i></i><span>Prikaz: <strong>'+label+'</strong> · svaka funkcija je samo u svojoj grupi.</span>';
  }

  function ensure(){
    if(!root() || !isAdmin()) return;
    render();
  }

  const oldShow=window.showSection;
  if(oldShow&&!window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__){
    window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__=true;
    window.showSection=function(id){
      const result=oldShow.apply(this,arguments);
      if(id==="admin") setTimeout(ensure,100);
      return result;
    };
  }

  window.addEventListener("load",()=>setTimeout(ensure,700));

  let observer=null;
  function watch(){
    const host=root();
    if(!host || observer) return;
    observer=new MutationObserver(()=>{
      if(moving || !isAdmin()) return;
      // Dynamic admin cards (news, push, seasons, graphic engine, moderation)
      // are inserted later. Re-run grouping so each lands in exactly one place.
      render();
    });
    observer.observe(host,{childList:true});
  }

  setInterval(()=>{
    if(document.getElementById("admin")?.classList.contains("active")){
      ensure();
      watch();
    }
  },800);

  window.__MEDJASI_ADMIN_ORGANIZER_APPLY__=render;
})();