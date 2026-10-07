/* MEĐASI ADMIN ORGANIZER
   Physical grouping: every admin card belongs to ONE group.
   Existing functions/cards are moved, never cloned or deleted.
*/
(function(){
  if(window.__MEDJASI_ADMIN_ORGANIZER__) return;
  window.__MEDJASI_ADMIN_ORGANIZER__=true;

  const root=()=>document.getElementById("adminContent");
  const isAdmin=()=>typeof window.isAdmin==="function"&&window.isAdmin();

  const groups=[
    {id:"liga",icon:"⚽",title:"Liga",desc:"Ekipe • igrači • utakmice • sezone"},
    {id:"sadrzaj",icon:"📰",title:"Sadržaj",desc:"Vijesti • galerija • playlist • push • community"},
    {id:"moderacija",icon:"🛡️",title:"Moderacija",desc:"Chat • komentari • prijave • moderatori"},
    {id:"dizajn",icon:"🎨",title:"Graphic Studio",desc:"Player cards • MVP • grafike"}
  ];

  let active="liga",moving=false;

  function classify(el){
    if(!el || el.id==="adminOrganizer" || el.dataset.adminOrganizerGroupContainer) return null;
    const id=el.id||"", cls=el.classList||{contains:()=>false};
    const has=s=>!!el.querySelector?.(s);

    // SADRŽAJ — ove kartice pripadaju ISKLJUČIVO ovoj kategoriji.
    // Provjera ide prije Lige da sadržaj nikad ne završi u pogrešnoj grupi.
    if(id==="v7NewsAdmin" || has("#v7NewsAdmin")) return "sadrzaj";
    if(id==="adminGalleryList" || has("#adminGalleryList") || has("#galleryImageFile")) return "sadrzaj";
    if(id==="communityAlbumAdmin" || has("#communityAlbumAdmin")) return "sadrzaj";
    if(id==="adminMusicPlaylist" || has("#adminMusicPlaylist") || cls.contains("admin-music-card")) return "sadrzaj";
    if(id==="v7PushCard" || has("#v7PushCard")) return "sadrzaj";
    if(id==="communityModerationCard" || has("#communityModerationCard")) return "moderacija";
    if(id==="moderatorManagement" || has("#moderatorManagement")) return "moderacija";

    // GRAPHIC STUDIO — isključivo ovdje.
    if(id==="graphicEngineCard" || has("#graphicEngineCard")) return "dizajn";

    // LIGA — samo originalne ligaške kartice.
    if(cls.contains("admin-grid") && (has("#teamName") || has("#playerName") || has("#matchHome"))) return "liga";
    if(id==="adminMatches" || has("#adminMatches")) return "liga";
    if(id==="adminCrudV4" || has("#adminCrudV4")) return "liga";
    if(id==="v7SeasonCard" || has("#v7SeasonCard")) return "liga";

    return null;
  }

  function buildShell(host){
    let organizer=document.getElementById("adminOrganizer");
    if(organizer) return organizer;

    organizer=document.createElement("div");
    organizer.id="adminOrganizer";
    organizer.className="admin-organizer";
    organizer.innerHTML=
      '<div class="admin-organizer-head"><div><span class="admin-organizer-kicker">ADMIN CENTAR</span><strong>Sve funkcije organizovane po područjima</strong><p>Tri kategorije. Ništa nije uklonjeno niti kopirano.</p></div></div>'+
      '<div class="admin-organizer-tabs">'+
        groups.map((g,i)=>'<button type="button" class="admin-organizer-tab '+(i===0?"active":"")+'" data-admin-filter="'+g.id+'"><b>'+g.icon+'</b><span>'+g.title+'</span><small>'+g.desc+'</small></button>').join("")+
      '</div>'+
      '<div id="adminOrganizerStatus" class="admin-organizer-status"><i></i><span>Prikaz: <strong>Liga</strong></span></div>'+
      '<div class="admin-organizer-groups"></div>';
    host.prepend(organizer);

    const wrap=organizer.querySelector(".admin-organizer-groups");
    groups.forEach(g=>{
      const section=document.createElement("section");
      section.className="admin-organizer-group";
      section.dataset.adminOrganizerGroupContainer=g.id;
      section.innerHTML='<div class="admin-organizer-group-head"><div><span>'+g.icon+'</span><div><strong>'+g.title+'</strong><small>'+g.desc+'</small></div></div></div><div class="admin-organizer-group-body" data-admin-group-body="'+g.id+'"></div>';
      wrap.appendChild(section);
    });

    organizer.querySelectorAll("[data-admin-filter]").forEach(btn=>{
      btn.addEventListener("click",()=>{active=btn.dataset.adminFilter||"liga";organizer.querySelectorAll(".admin-organizer-tab").forEach(b=>b.classList.toggle("active",b===btn));render();});
    });
    return organizer;
  }

  function crudSectionTitle(section){
    return (section?.querySelector(".crud-title span")?.textContent||"").trim().toLowerCase();
  }

  function splitCrudContent(card,bodies){
    if(!card || card.id!=="adminCrudV4") return;

    const sections=[...card.querySelectorAll(".crud-section")];
    const buckets={sadrzaj:[],moderacija:[]};

    sections.forEach(section=>{
      const title=crudSectionTitle(section);
      if(title.includes("galerija")) buckets.sadrzaj.push(section);
      else if(title.includes("komentari") || title.includes("chat")) buckets.moderacija.push(section);
    });

    const cleanupGroup=group=>{
      bodies[group]?.querySelectorAll('[data-admin-crud-content="'+group+'"]').forEach(x=>x.remove());
    };
    cleanupGroup("sadrzaj");
    cleanupGroup("moderacija");

    const makeHelper=(group,kicker,desc)=>{
      if(!buckets[group].length || !bodies[group]) return;
      const contentCard=document.createElement("div");
      contentCard.className="card admin-crud-content";
      contentCard.dataset.adminCrudContent=group;
      contentCard.style.marginTop="20px";
      contentCard.innerHTML='<div class="admin-card-head"><div><span class="hero-kicker">'+kicker+'</span><h3>🧰 Upravljanje</h3><p class="muted">'+desc+'</p></div><span class="admin-pill">SAMO ADMIN</span></div>';
      buckets[group].forEach(section=>contentCard.appendChild(section));
      bodies[group].appendChild(contentCard);
    };

    makeHelper("sadrzaj","SADRŽAJ","Galerija iz postojećeg Admin CRUD-a.");
    makeHelper("moderacija","MODERACIJA","Komentari i chat iz postojećeg Admin CRUD-a.");
    card.dataset.adminOrganizerCrudSplit="1";
  }

  function moveCards(host,organizer){
    if(moving) return;
    moving=true;
    try{
      const bodies={}; groups.forEach(g=>bodies[g.id]=organizer.querySelector('[data-admin-group-body="'+g.id+'"]'));
      [...host.children].forEach(el=>{
        if(el===organizer || el.dataset.adminOrganizerManaged==="1") return;
        const group=classify(el);
        if(!group || !bodies[group]) return;

        if(el.id==="adminCrudV4"){
          splitCrudContent(el,bodies);
        }

        el.dataset.adminOrganizerManaged="1";
        el.dataset.adminOrganizerGroup=group;
        bodies[group].appendChild(el);
      });
    }finally{moving=false;}
  }

  function render(){
    const host=root(); if(!host||!isAdmin()) return;
    const organizer=buildShell(host);
    moveCards(host,organizer);
    organizer.querySelectorAll(".admin-organizer-group").forEach(section=>{
      const isActive=section.dataset.adminOrganizerGroupContainer===active;
      section.hidden=!isActive;
      section.classList.toggle("is-active",isActive);
      section.style.display=isActive?"":"none";
    });
    const label=groups.find(g=>g.id===active)?.title||"Liga";
    const status=organizer.querySelector("#adminOrganizerStatus");
    if(status) status.innerHTML='<i></i><span>Prikaz: <strong>'+label+'</strong> · svaka funkcija je samo u jednoj grupi.</span>';
  }

  const oldShow=window.showSection;
  if(oldShow&&!window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__){
    window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__=true;
    window.showSection=function(id){const result=oldShow.apply(this,arguments);if(id==="admin")setTimeout(render,100);return result;};
  }

  window.addEventListener("load",()=>setTimeout(render,700));
  let observer=null;
  function watch(){
    const host=root(); if(!host||observer)return;
    observer=new MutationObserver(()=>{if(!moving&&isAdmin())render();});
    observer.observe(host,{childList:true});
  }
  setInterval(()=>{if(document.getElementById("admin")?.classList.contains("active")){render();watch();}},800);
  window.__MEDJASI_ADMIN_ORGANIZER_APPLY__=render;
})();