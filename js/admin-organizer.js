/* MEĐASI ADMIN ORGANIZER — full admin inventory grouping
   Organizes existing admin functions into exclusive areas.
   No admin feature is deleted, cloned, disabled, or renamed here.
*/
(function(){
  "use strict";
  if(window.__MEDJASI_ADMIN_ORGANIZER_V2__) return;
  window.__MEDJASI_ADMIN_ORGANIZER_V2__ = true;

  const root=()=>document.getElementById("adminContent");
  const isAdmin=()=>typeof window.isAdmin==="function"&&window.isAdmin();

  const groups=[
    {id:"liga",icon:"⚽",title:"Liga",desc:"Ekipe, igrači, utakmice, statistika i sezone"},
    {id:"sadrzaj",icon:"📰",title:"Sadržaj",desc:"Vijesti, galerija, playlist i push"},
    {id:"zajednica",icon:"👥",title:"Zajednica",desc:"Komentari, chat i community moderacija"},
    {id:"korisnici",icon:"🛡️",title:"Korisnici & sistem",desc:"Uloge, administracija i sistemske kontrole"},
    {id:"grafika",icon:"🎨",title:"Graphic Studio",desc:"Grafike, player cards i objave"}
  ];

  let active="liga",syncing=false,observer=null;

  const has=(el,selector)=>!!el?.querySelector?.(selector);

  function classify(el){
    if(!el||el.id==="adminOrganizer"||el.dataset.adminOrganizerGroupContainer)return null;
    const id=String(el.id||"");
    const cls=el.classList||{contains:()=>false};

    if(cls.contains("admin-grid"))return"liga";
    if(id==="adminMatches"||has(el,"#adminMatches"))return"liga";
    if(id==="adminCrudV4"||has(el,"#adminCrudV4"))return"liga";
    if(id==="v7SeasonCard"||has(el,"#v7SeasonCard"))return"liga";

    if(id==="v7NewsAdmin"||has(el,"#v7NewsAdmin"))return"sadrzaj";
    if(id==="adminGalleryList"||has(el,"#adminGalleryList")||has(el,"#galleryImageFile"))return"sadrzaj";
    if(id==="adminMusicPlaylist"||has(el,"#adminMusicPlaylist")||cls.contains("admin-music-card"))return"sadrzaj";
    if(id==="v7PushCard"||id==="v3PushCard"||has(el,"#v7PushCard")||has(el,"#v3PushCard"))return"sadrzaj";
    if(id==="adminCrudContentV4"||has(el,"#adminCrudContentV4"))return"sadrzaj";

    if(id==="communityModerationCard"||has(el,"#communityModerationCard"))return"zajednica";

    if(id==="moderatorManagement"||has(el,"#moderatorManagement"))return"korisnici";

    if(id==="graphicEngineCard"||has(el,"#graphicEngineCard"))return"grafika";

    return null;
  }

  function buildOrganizer(host){
    let organizer=document.getElementById("adminOrganizer");
    if(organizer)return organizer;

    organizer=document.createElement("div");
    organizer.id="adminOrganizer";
    organizer.className="admin-organizer";
    organizer.innerHTML=
      '<div class="admin-organizer-head"><div><span class="admin-organizer-kicker">ADMIN CENTAR</span><strong>Sve administratorske funkcije na jednom mjestu</strong><p>Funkcije su raspoređene prema stvarnoj namjeni. Ništa se ne briše niti kopira.</p></div></div>'+
      '<div class="admin-organizer-tabs"></div>'+
      '<div id="adminOrganizerStatus" class="admin-organizer-status"><i></i><span></span></div>'+
      '<div class="admin-organizer-groups"></div>';

    const tabs=organizer.querySelector(".admin-organizer-tabs");
    const wrap=organizer.querySelector(".admin-organizer-groups");

    groups.forEach((g,i)=>{
      const tab=document.createElement("button");
      tab.type="button";
      tab.className="admin-organizer-tab"+(i===0?" active":"");
      tab.dataset.adminFilter=g.id;
      tab.innerHTML='<b>'+g.icon+'</b><span>'+g.title+'</span><small>'+g.desc+'</small>';
      tab.addEventListener("click",()=>{
        active=g.id;
        organizer.querySelectorAll(".admin-organizer-tab").forEach(b=>b.classList.toggle("active",b===tab));
        render();
      });
      tabs.appendChild(tab);

      const section=document.createElement("section");
      section.className="admin-organizer-group";
      section.dataset.adminOrganizerGroupContainer=g.id;
      section.innerHTML=
        '<div class="admin-organizer-group-head"><div><span>'+g.icon+'</span><div><strong>'+g.title+'</strong><small>'+g.desc+'</small></div></div></div>'+
        '<div class="admin-organizer-group-body" data-admin-group-body="'+g.id+'"></div>';
      wrap.appendChild(section);
    });

    host.prepend(organizer);
    return organizer;
  }

  function getBodies(organizer){
    const bodies={};
    groups.forEach(g=>bodies[g.id]=organizer.querySelector('[data-admin-group-body="'+g.id+'"]'));
    return bodies;
  }

  function moveCards(host,organizer){
    if(!host||syncing)return;
    syncing=true;
    try{
      const bodies=getBodies(organizer);
      [...host.children].forEach(el=>{
        if(el===organizer||el.dataset.adminOrganizerGroupContainer||el.dataset.adminOrganizerManaged==="1")return;
        const group=classify(el);
        if(!group||!bodies[group])return;
        el.dataset.adminOrganizerManaged="1";
        el.dataset.adminOrganizerGroup=group;
        bodies[group].appendChild(el);
      });
    }finally{syncing=false;}
  }

  function moveLegacyAdminCards(adminRoot,host,organizer){
    if(!adminRoot||!host)return;
    const bodies=getBodies(organizer);
    [...adminRoot.children].forEach(el=>{
      if(el===host||el===organizer||el.dataset.adminOrganizerManaged==="1")return;
      if(!el.classList?.contains("card"))return;
      const group=classify(el);
      if(!group||!bodies[group])return;
      el.dataset.adminOrganizerManaged="1";
      el.dataset.adminOrganizerGroup=group;
      bodies[group].appendChild(el);
    });
  }

  function render(){
    const host=root();
    if(!host||!isAdmin())return;
    const organizer=buildOrganizer(host);
    moveCards(host,organizer);
    moveLegacyAdminCards(document.getElementById("admin"),host,organizer);

    organizer.querySelectorAll(".admin-organizer-group").forEach(section=>{
      const activeNow=section.dataset.adminOrganizerGroupContainer===active;
      section.hidden=!activeNow;
      section.style.display=activeNow?"":"none";
    });

    const label=groups.find(g=>g.id===active)?.title||"Liga";
    const body=organizer.querySelector('[data-admin-group-body="'+active+'"]');
    const count=body?body.children.length:0;
    const status=organizer.querySelector("#adminOrganizerStatus span");
    if(status)status.textContent="Prikaz: "+label+" · "+count+" administrativnih cjelina";
  }

  function watch(){
    const adminRoot=document.getElementById("admin");
    if(!adminRoot||observer)return;
    observer=new MutationObserver(()=>{if(!syncing&&isAdmin())render()});
    observer.observe(adminRoot,{childList:true,subtree:true});
  }

  const oldShowSection=window.showSection;
  if(oldShowSection&&!window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH_V2__){
    window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH_V2__=true;
    window.showSection=function(id){
      const result=oldShowSection.apply(this,arguments);
      if(id==="admin")setTimeout(render,80);
      return result;
    };
  }

  window.addEventListener("load",()=>setTimeout(()=>{watch();render()},250));
  document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{watch();render()},150));

  setInterval(()=>{
    if(document.getElementById("admin")?.classList.contains("active")){
      watch();
      render();
    }
  },1200);

  window.__MEDJASI_ADMIN_ORGANIZER_APPLY__=render;
})();