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
      '<div class="admin-organizer-head"><div><span class="admin-organizer-kicker">ADMIN CENTAR</span><strong>Sve funkcije organizovane po područjima</strong><p>Četiri kategorije. Ništa nije uklonjeno niti kopirano.</p></div></div>'+
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
    const buckets={moderacija:[]};

    sections.forEach(section=>{
      const title=crudSectionTitle(section);

      // Galerija već ima svoju glavnu karticu u Sadržaj kategoriji.
      // Ne brišemo stari CRUD kod/funkciju; samo skrivamo dupli UI.
      if(title.includes("galerija")){
        section.hidden=true;
        section.dataset.adminOrganizerHiddenDuplicate="gallery";
        return;
      }

      if(title.includes("komentari") || title.includes("chat")){
        buckets.moderacija.push(section);
      }
    });

    const helperKey="moderacija";
    bodies[helperKey]?.querySelectorAll('[data-admin-crud-content="moderacija"]').forEach(x=>x.remove());

    if(buckets.moderacija.length && bodies.moderacija){
      const contentCard=document.createElement("div");
      contentCard.className="card admin-crud-content";
      contentCard.dataset.adminCrudContent="moderacija";
      contentCard.style.marginTop="20px";
      contentCard.innerHTML='<div class="admin-card-head"><div><span class="hero-kicker">MODERACIJA</span><h3>🧰 Upravljanje</h3><p class="muted">Komentari i chat iz postojećeg Admin CRUD-a.</p></div><span class="admin-pill">SAMO ADMIN</span></div>';
      buckets.moderacija.forEach(section=>contentCard.appendChild(section));
      bodies.moderacija.appendChild(contentCard);
    }

    const intro=card.querySelector(":scope > .muted");
    if(intro){
      intro.textContent="Upravljanje utakmicama, igračima, golovima i kartonima.";
    }

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

  function dedupeUniqueContentCards(host,organizer){
    if(!host||!organizer||moving) return;
    const bodies={};
    groups.forEach(g=>bodies[g.id]=organizer.querySelector('[data-admin-group-body="'+g.id+'"]'));

    const directCards=[];
    [...host.children].forEach(el=>{
      if(el!==organizer && el.classList?.contains("card")) directCards.push(el);
    });
    organizer.querySelectorAll(".admin-organizer-group-body").forEach(body=>{
      [...body.children].forEach(el=>{if(el.classList?.contains("card")) directCards.push(el)});
    });

    const headingOf=card=>(
      card.querySelector?.(".admin-card-head h3, .admin-card-head strong, .crud-title span, h3")?.textContent||""
    ).trim().toLowerCase();

    const specs=[
      {
        key:"gallery",
        match:card=>{
          if(card.id==="adminCrudV4")return false;
          const heading=headingOf(card);
          return card.id==="adminGalleryCard" ||
            card.id==="adminGallery" ||
            !!card.querySelector?.("#adminGalleryList,#galleryImageFile") ||
            !!card.classList?.contains("admin-gallery-card") ||
            (heading==="galerija"||heading.startsWith("galerija "));
        }
      },
      {
        key:"playlist",
        match:card=>{
          const heading=headingOf(card);
          return card.id==="adminMusicCard" ||
            !!card.querySelector?.("#adminMusicPlaylist") ||
            !!card.classList?.contains("admin-music-card") ||
            (heading==="playlist"||heading.startsWith("playlist ")||heading==="liga muzika"||heading.startsWith("liga muzika ")||heading==="upravljanje muzikom"||heading.startsWith("upravljanje muzikom "));
        }
      },
      {
        key:"push",
        match:card=>{
          const heading=headingOf(card);
          return card.id==="v7PushCard" ||
            !!card.querySelector?.("#v7PushCard") ||
            (heading==="push obavještenja"||heading.startsWith("push obavještenja ")||heading==="push notifikacije"||heading.startsWith("push notifikacije "));
        }
      }
    ];

    moving=true;
    try{
      for(const spec of specs){
        const seen=[];
        directCards.forEach(card=>{if(spec.match(card)&&!seen.includes(card))seen.push(card)});
        if(!seen.length) continue;

        let canonical=seen.find(card=>card.parentElement===bodies.sadrzaj)||seen[0];
        if(bodies.sadrzaj&&canonical.parentElement!==bodies.sadrzaj){
          bodies.sadrzaj.appendChild(canonical);
        }
        canonical.hidden=false;
        canonical.style.removeProperty("display");
        canonical.dataset.adminOrganizerGroup="sadrzaj";
        canonical.dataset.adminOrganizerManaged="1";
        canonical.dataset.adminOrganizerCanonical=spec.key;

        seen.forEach(card=>{
          if(card===canonical)return;
          card.hidden=true;
          card.style.display="none";
          card.dataset.adminOrganizerHiddenDuplicate=spec.key;
        });
      }
    }finally{moving=false;}
  }

  function render(){
    const host=root(); if(!host||!isAdmin()) return;
    const organizer=buildShell(host);
    moveCards(host,organizer);
    dedupeUniqueContentCards(host,organizer);
    organizer.querySelectorAll(".admin-organizer-group").forEach(section=>{
      const isActive=section.dataset.adminOrganizerGroupContainer===active;
      section.hidden=!isActive;
      section.classList.toggle("is-active",isActive);
      section.dataset.adminOrganizerVisible=isActive?"1":"0";
      if(isActive){
        section.style.removeProperty("display");
      }else{
        section.style.setProperty("display","none","important");
      }
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

  let observer=null;
  let bodyObserver=null;
  let renderQueued=false;

  function scheduleRender(){
    if(renderQueued)return;
    renderQueued=true;
    setTimeout(()=>{
      renderQueued=false;
      if(isAdmin())render();
      watch();
    },60);
  }

  function watch(){
    const host=root();
    if(!host){
      if(!bodyObserver && document.body){
        bodyObserver=new MutationObserver(records=>{
          const appeared=records.some(record=>[...record.addedNodes].some(node=>
            node.nodeType===1 && (node.id==="adminContent" || node.querySelector?.("#adminContent"))
          ));
          if(appeared)scheduleRender();
        });
        bodyObserver.observe(document.body,{childList:true,subtree:true});
      }
      return;
    }
    if(observer)return;
    observer=new MutationObserver(()=>{if(!moving&&isAdmin())scheduleRender();});
    observer.observe(host,{childList:true});
  }

  window.addEventListener("load",()=>{
    scheduleRender();
    watch();
  },{once:true});

  window.__MEDJASI_ADMIN_ORGANIZER_APPLY__=render;
})();