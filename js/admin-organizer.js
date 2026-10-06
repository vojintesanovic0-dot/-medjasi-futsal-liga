/* MEĐASI ADMIN ORGANIZER — samo 3 kategorije, bez dupliciranja */
(function(){
  if(window.__MEDJASI_ADMIN_ORGANIZER__) return;
  window.__MEDJASI_ADMIN_ORGANIZER__=true;
  const root=()=>document.getElementById("adminContent");
  const isAdmin=()=>typeof window.isAdmin==="function"&&window.isAdmin();
  const groups=[
    {id:"liga",icon:"⚽",title:"Liga",desc:"Ekipe • igrači • utakmice • sezone"},
    {id:"sadrzaj",icon:"📰",title:"Sadržaj",desc:"Vijesti • objave"},
    {id:"dizajn",icon:"🎨",title:"Graphic Studio",desc:"Player cards • MVP • grafike"}
  ];
  let active="liga",moving=false;

  function classify(el){
    if(!el||el.id==="adminOrganizer"||el.dataset.adminOrganizerGroupContainer) return null;
    const id=el.id||"", has=s=>!!el.querySelector?.(s);
    const cls=el.classList||{contains:()=>false};
    if(cls.contains("admin-grid")||id==="adminMatches"||has("#adminMatches")||id==="adminCrudV4"||has("#adminCrudV4")||id==="v7SeasonCard"||has("#v7SeasonCard")) return "liga";
    if(id==="v7NewsAdmin"||has("#v7NewsAdmin")) return "sadrzaj";
    if(id==="graphicEngineCard"||has("#graphicEngineCard")) return "dizajn";
    return null;
  }

  function removeUnwanted(){
    const selectors=["#adminGalleryList","#adminMusicPlaylist",".admin-music-card","#v7PushCard","#communityModerationCard","#moderatorManagement"];
    selectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{
      const card=el.closest(".card")||el;
      if(card.id!=="adminOrganizer") card.remove();
    }));
  }

  function build(host){
    let o=document.getElementById("adminOrganizer");
    if(o) return o;
    o=document.createElement("div");
    o.id="adminOrganizer"; o.className="admin-organizer";
    o.innerHTML='<div class="admin-organizer-head"><div><span class="admin-organizer-kicker">ADMIN CENTAR</span><strong>Upravljanje ligom</strong><p>Tri jasne kategorije. Svaka funkcija prikazana je samo jednom.</p></div></div><div class="admin-organizer-tabs">'+groups.map((g,i)=>'<button type="button" class="admin-organizer-tab '+(i===0?"active":"")+'" data-admin-filter="'+g.id+'"><b>'+g.icon+'</b><span>'+g.title+'</span><small>'+g.desc+'</small></button>').join("")+'</div><div id="adminOrganizerStatus" class="admin-organizer-status"><i></i><span>Prikaz: <strong>Liga</strong></span></div><div class="admin-organizer-groups"></div>';
    host.prepend(o);
    const wrap=o.querySelector(".admin-organizer-groups");
    groups.forEach(g=>{const s=document.createElement("section");s.className="admin-organizer-group";s.dataset.adminOrganizerGroupContainer=g.id;s.innerHTML='<div class="admin-organizer-group-head"><div><span>'+g.icon+'</span><div><strong>'+g.title+'</strong><small>'+g.desc+'</small></div></div></div><div class="admin-organizer-group-body" data-admin-group-body="'+g.id+'"></div>';wrap.appendChild(s);});
    o.querySelectorAll("[data-admin-filter]").forEach(btn=>btn.addEventListener("click",()=>{active=btn.dataset.adminFilter;render();}));
    return o;
  }

  function render(){
    const host=root(); if(!host||!isAdmin()) return;
    removeUnwanted();
    const o=build(host);
    if(moving) return; moving=true;
    try{
      const bodies={}; groups.forEach(g=>bodies[g.id]=o.querySelector('[data-admin-group-body="'+g.id+'"]'));
      [...host.children].forEach(el=>{
        if(el===o||el.dataset.adminOrganizerManaged==="1") return;
        const group=classify(el); if(!group) return;
        el.dataset.adminOrganizerManaged="1"; el.dataset.adminOrganizerGroup=group; bodies[group]?.appendChild(el);
      });
      o.querySelectorAll(".admin-organizer-group").forEach(s=>s.hidden=s.dataset.adminOrganizerGroupContainer!==active);
      const label=groups.find(g=>g.id===active)?.title||"Liga";
      const status=o.querySelector("#adminOrganizerStatus"); if(status) status.innerHTML='<i></i><span>Prikaz: <strong>'+label+'</strong></span>';
      o.querySelectorAll(".admin-organizer-tab").forEach(b=>b.classList.toggle("active",b.dataset.adminFilter===active));
    }finally{moving=false;}
  }
  const oldShow=window.showSection;
  if(oldShow&&!window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__){window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__=true;window.showSection=function(id){const r=oldShow.apply(this,arguments);if(id==="admin")setTimeout(render,100);return r;};}
  window.addEventListener("load",()=>setTimeout(render,700));
  setInterval(()=>{if(document.getElementById("admin")?.classList.contains("active"))render();},800);
  window.__MEDJASI_ADMIN_ORGANIZER_APPLY__=render;
})();