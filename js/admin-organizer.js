/* MEĐASI ADMIN ORGANIZER
   Organizes existing admin UI only.
   Never deletes or disables admin functionality.
*/
(function(){
  "use strict";

  if(window.__MEDJASI_ADMIN_ORGANIZER_SAFE__) return;
  window.__MEDJASI_ADMIN_ORGANIZER_SAFE__=true;

  const adminRoot=()=>document.getElementById("admin");
  const host=()=>document.getElementById("adminContent");
  const isAdmin=()=>typeof window.isAdmin==="function"&&window.isAdmin();

  const groups=[
    {id:"liga",icon:'<span class="m-icon" data-icon="ball" aria-hidden="true"></span>',title:"Liga",desc:"Ekipe • igrači • utakmice • statistika • sezone"},
    {id:"sadrzaj",icon:'<span class="m-icon" data-icon="news" aria-hidden="true"></span>',title:"Sadržaj",desc:"Vijesti • galerija • playlist • push"},
    {id:"zajednica",icon:'<span class="m-icon" data-icon="community" aria-hidden="true"></span>',title:"Zajednica",desc:"Komentari • chat • prijave"},
    {id:"korisnici",icon:'<span class="m-icon" data-icon="shield" aria-hidden="true"></span>',title:"Korisnici & sistem",desc:"Uloge • administrativne kontrole"},
    {id:"grafika",icon:'<span class="m-icon" data-icon="star" aria-hidden="true"></span>',title:"Graphic Studio",desc:"Player cards • MVP • grafike"}
  ];

  let active="liga";
  let syncing=false;
  let observer=null;

  const contains=(el,selector)=>!!el?.querySelector?.(selector);

  function classify(el){
    if(!el || el.id==="adminOrganizer" || el.dataset.adminOrganizerGroupContainer) return null;

    const id=String(el.id||"");
    const cls=el.classList||{contains:()=>false};

    // LIGA
    if(cls.contains("admin-grid")) return "liga";
    if(id==="adminMatches" || contains(el,"#adminMatches")) return "liga";
    if(id==="adminCrudV4") return "liga";
    if(id==="v7SeasonCard" || contains(el,"#v7SeasonCard")) return "liga";

    // SADRŽAJ
    if(id==="v7NewsAdmin" || contains(el,"#v7NewsAdmin")) return "sadrzaj";
    if(id==="adminGalleryList" || contains(el,"#adminGalleryList") || contains(el,"#galleryImageFile")) return "sadrzaj";
    if(id==="adminMusicPlaylist" || contains(el,"#adminMusicPlaylist") || cls.contains("admin-music-card")) return "sadrzaj";
    if(id==="v7PushCard" || id==="v3PushCard" || contains(el,"#v7PushCard") || contains(el,"#v3PushCard")) return "sadrzaj";
    if(id==="adminCrudGallerySafe") return "sadrzaj";

    // ZAJEDNICA
    if(id==="adminCrudCommunitySafe" || id==="communityModerationCard" || contains(el,"#communityModerationCard")) return "zajednica";

    // KORISNICI & SISTEM
    if(id==="moderatorManagement" || contains(el,"#moderatorManagement")) return "korisnici";

    // GRAFIKA
    if(id==="graphicEngineCard" || contains(el,"#graphicEngineCard")) return "grafika";

    return null;
  }

  function build(){
    const h=host();
    if(!h) return null;

    let organizer=document.getElementById("adminOrganizer");
    if(organizer) return organizer;

    organizer=document.createElement("div");
    organizer.id="adminOrganizer";
    organizer.className="admin-organizer";

    const tabsHtml=groups.map((g,i)=>
      '<button type="button" class="admin-organizer-tab '+(i===0?"active":"")+'" data-admin-filter="'+g.id+'">'+
        '<b>'+g.icon+'</b><span>'+g.title+'</span><small>'+g.desc+'</small>'+
      '</button>'
    ).join("");

    const groupsHtml=groups.map(g=>
      '<section class="admin-organizer-group" data-admin-organizer-group-container="'+g.id+'">'+
        '<div class="admin-organizer-group-head">'+g.icon+'<div><strong>'+g.title+'</strong><small>'+g.desc+'</small></div></div>'+
        '<div class="admin-organizer-group-body" data-admin-group-body="'+g.id+'"></div>'+
      '</section>'
    ).join("");

    organizer.innerHTML=
      '<div class="admin-organizer-head">'+
        '<div><span class="admin-organizer-kicker">ADMIN CENTAR</span>'+
        '<strong>Administracija organizovana po namjeni</strong>'+
        '<p>Postojeće funkcije ostaju iste; mijenja se samo njihov prikaz.</p></div>'+
      '</div>'+
      '<div class="admin-organizer-tabs">'+tabsHtml+'</div>'+
      '<div id="adminOrganizerStatus" class="admin-organizer-status"><i></i><span></span></div>'+
      '<div class="admin-organizer-groups">'+groupsHtml+'</div>';

    h.prepend(organizer);

    organizer.querySelectorAll("[data-admin-filter]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        active=btn.dataset.adminFilter||"liga";
        organizer.querySelectorAll(".admin-organizer-tab").forEach(x=>x.classList.toggle("active",x===btn));
        render();
      });
    });

    return organizer;
  }

  function bodies(organizer){
    const result={};
    groups.forEach(g=>result[g.id]=organizer.querySelector('[data-admin-group-body="'+g.id+'"]'));
    return result;
  }

  function cleanupGeneratedCrud(){
    document.querySelectorAll("#adminCrudCommunitySafe,#adminCrudGallerySafe").forEach(el=>el.remove());
  }

  function splitCrud(card,groupBodies){
    if(!card || card.id!=="adminCrudV4") return;

    cleanupGeneratedCrud();

    const sections=[...card.querySelectorAll(".crud-section")];
    const community=sections.filter(s=>{
      const t=(s.querySelector(".crud-title span")?.textContent||"").toLowerCase();
      return t.includes("komentari")||t.includes("chat");
    });
    const gallery=sections.filter(s=>{
      const t=(s.querySelector(".crud-title span")?.textContent||"").toLowerCase();
      return t.includes("galerija");
    });

    if(community.length){
      const wrap=document.createElement("div");
      wrap.id="adminCrudCommunitySafe";
      wrap.className="card admin-crud-safe";
      wrap.innerHTML='<div class="admin-card-head"><div><span class="hero-kicker">ZAJEDNICA</span><h3><span class="m-icon" data-icon="community" aria-hidden="true"></span> Community administracija</h3><p class="muted">Komentari i chat iz postojećeg Admin CRUD-a.</p></div><span class="admin-pill">SAMO ADMIN</span></div>';
      community.forEach(s=>wrap.appendChild(s));
      groupBodies.zajednica?.appendChild(wrap);
    }

    if(gallery.length){
      const wrap=document.createElement("div");
      wrap.id="adminCrudGallerySafe";
      wrap.className="card admin-crud-safe";
      wrap.innerHTML='<div class="admin-card-head"><div><span class="hero-kicker">SADRŽAJ</span><h3><span class="m-icon" data-icon="gallery" aria-hidden="true"></span> Galerija · CRUD</h3><p class="muted">Postojeće upravljanje medijima iz Admin CRUD-a.</p></div><span class="admin-pill">SAMO ADMIN</span></div>';
      gallery.forEach(s=>wrap.appendChild(s));
      groupBodies.sadrzaj?.appendChild(wrap);
    }

    if(community.length||gallery.length){
      card.dataset.adminOrganizerSplit="1";
    }
  }

  function moveFrom(parent,groupBodies,onlyCards){
    [...parent.children].forEach(el=>{
      if(el.id==="adminOrganizer" || el.dataset.adminOrganizerGroupContainer) return;
      if(el.dataset.adminOrganizerManaged==="1") return;
      if(onlyCards && !el.classList?.contains("card")) return;

      const group=classify(el);
      if(!group || !groupBodies[group]) return;

      if(el.id==="adminCrudV4") splitCrud(el,groupBodies);

      el.dataset.adminOrganizerManaged="1";
      el.dataset.adminOrganizerGroup=group;
      groupBodies[group].appendChild(el);
    });
  }

  function render(){
    const h=host();
    const a=adminRoot();
    if(!h || !a || !isAdmin()) return;

    const organizer=build();
    if(!organizer) return;

    const groupBodies=bodies(organizer);

    // Dynamic admin cards inside #adminContent.
    moveFrom(h,groupBodies,false);

    // Legacy push UI is injected directly into #admin, not #adminContent.
    moveFrom(a,groupBodies,true);

    organizer.querySelectorAll(".admin-organizer-group").forEach(section=>{
      const show=section.dataset.adminOrganizerGroupContainer===active;
      section.hidden=!show;
      section.style.display=show?"":"none";
    });

    const body=groupBodies[active];
    const count=body?body.children.length:0;
    const label=groups.find(g=>g.id===active)?.title||"Liga";
    const status=organizer.querySelector("#adminOrganizerStatus span");
    if(status) status.textContent="Prikaz: "+label+" · "+count+" cjelina";
  }

  const previousShowSection=window.showSection;
  if(previousShowSection&&!window.__MEDJASI_ADMIN_ORGANIZER_SHOW_SAFE__){
    window.__MEDJASI_ADMIN_ORGANIZER_SHOW_SAFE__=true;
    window.showSection=function(id){
      const result=previousShowSection.apply(this,arguments);
      if(id==="admin") setTimeout(render,80);
      return result;
    };
  }

  function startObserver(){
    const a=adminRoot();
    if(!a || observer) return;
    observer=new MutationObserver(()=>{
      if(!syncing){
        syncing=true;
        try{render();}finally{syncing=false;}
      }
    });
    observer.observe(a,{childList:true,subtree:true});
  }

  window.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{startObserver();render();},150));
  window.addEventListener("load",()=>setTimeout(()=>{startObserver();render();},600));
  setInterval(()=>{
    if(document.getElementById("admin")?.classList.contains("active")){
      startObserver();
      render();
    }
  },1200);

  window.__MEDJASI_ADMIN_ORGANIZER_APPLY__=render;
})();