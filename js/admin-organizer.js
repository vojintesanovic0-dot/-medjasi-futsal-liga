/* MEĐASI ADMIN ORGANIZER
   UI-only organization. NEVER removes admin tools.
   Exactly one category per existing admin card/function.
*/
(function(){
  if(window.__MEDJASI_ADMIN_ORGANIZER__) return;
  window.__MEDJASI_ADMIN_ORGANIZER__=true;

  const root=()=>document.getElementById("adminContent");
  const isAdmin=()=>typeof window.isAdmin==="function"&&window.isAdmin();

  const groups=[
    {id:"liga",icon:"⚽",title:"Liga",desc:"Ekipe • igrači • utakmice • sezone"},
    {id:"sadrzaj",icon:"📰",title:"Sadržaj",desc:"Vijesti • galerija • playlist • push • community"},
    {id:"dizajn",icon:"🎨",title:"Graphic Studio",desc:"Player cards • MVP • grafike"}
  ];

  let active="liga";

  function classify(el){
    if(!el || el.id==="adminOrganizer") return "ui";
    const id=el.id||"";
    const has=s=>!!el.querySelector?.(s);
    const cls=el.classList||{contains:()=>false};

    // Liga — postojeći CRUD i upravljanje utakmicama/sezonama.
    if(cls.contains("admin-grid")) return "liga";
    if(id==="adminMatches" || has("#adminMatches")) return "liga";
    if(id==="adminCrudV4" || has("#adminCrudV4")) return "liga";
    if(id==="v7SeasonCard" || has("#v7SeasonCard")) return "liga";

    // Sadržaj — svaka od ovih funkcija ostaje aktivna i pojavljuje se samo ovdje.
    if(id==="v7NewsAdmin" || has("#v7NewsAdmin")) return "sadrzaj";
    if(id==="adminGalleryList" || has("#adminGalleryList")) return "sadrzaj";
    if(id==="galleryAdmin" || has("#galleryImageFile")) return "sadrzaj";
    if(cls.contains("admin-music-card") || id==="adminMusicPlaylist" || has("#adminMusicPlaylist")) return "sadrzaj";
    if(id==="v7PushCard" || has("#v7PushCard")) return "sadrzaj";
    if(id==="communityAlbumAdmin" || has("#communityAlbumAdmin")) return "sadrzaj";
    if(id==="communityModerationCard" || has("#communityModerationCard")) return "sadrzaj";
    if(id==="moderatorManagement" || has("#moderatorManagement")) return "sadrzaj";

    // Graphic Studio.
    if(id==="graphicEngineCard" || has("#graphicEngineCard")) return "dizajn";

    return null;
  }

  function apply(){
    const host=root();
    if(!host || !isAdmin()) return;

    const children=[...host.children].filter(el=>el.id!=="adminOrganizer");

    children.forEach(el=>{
      const group=classify(el);
      // Nepoznate elemente ne diramo — postojeći sistem ostaje netaknut.
      if(!group){
        el.hidden=false;
        return;
      }
      el.dataset.adminOrganizerGroup=group;
      const visible=group===active;
      el.classList.toggle("admin-filter-hidden",!visible);
      el.hidden=!visible;
    });

    const status=document.getElementById("adminOrganizerStatus");
    const label=groups.find(g=>g.id===active)?.title||"Liga";
    if(status) status.innerHTML='<i></i><span>Prikaz: <strong>'+label+'</strong> · postojeće funkcije nisu uklonjene.</span>';

    document.querySelectorAll("#adminOrganizer .admin-organizer-tab").forEach(btn=>{
      btn.classList.toggle("active",btn.dataset.adminFilter===active);
    });
  }

  function ensure(){
    const host=root();
    if(!host || !isAdmin()) return;

    let box=document.getElementById("adminOrganizer");
    if(!box){
      box=document.createElement("div");
      box.id="adminOrganizer";
      box.className="admin-organizer";
      box.innerHTML=
        '<div class="admin-organizer-head">'+
          '<div><span class="admin-organizer-kicker">ADMIN CENTAR</span><strong>Upravljanje ligom</strong><p>Tri kategorije. Svaka postojeća funkcija nalazi se samo u jednoj odgovarajućoj kategoriji.</p></div>'+
        '</div>'+
        '<div class="admin-organizer-tabs">'+
          groups.map((g,i)=>'<button type="button" class="admin-organizer-tab '+(i===0?"active":"")+'" data-admin-filter="'+g.id+'"><b>'+g.icon+'</b><span>'+g.title+'</span><small>'+g.desc+'</small></button>').join("")+
        '</div>'+
        '<div id="adminOrganizerStatus" class="admin-organizer-status"><i></i><span>Prikaz: <strong>Liga</strong> · postojeće funkcije nisu uklonjene.</span></div>';

      host.prepend(box);

      box.querySelectorAll("[data-admin-filter]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          active=btn.dataset.adminFilter||"liga";
          apply();
        });
      });
    }

    apply();
  }

  const oldShow=window.showSection;
  if(oldShow&&!window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__){
    window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__=true;
    window.showSection=function(id){
      const result=oldShow.apply(this,arguments);
      if(id==="admin") setTimeout(ensure,80);
      return result;
    };
  }

  window.addEventListener("load",()=>setTimeout(ensure,700));

  let observer;
  function watch(){
    const host=root();
    if(!host || observer) return;
    observer=new MutationObserver(()=>{ if(isAdmin()) apply(); });
    observer.observe(host,{childList:true});
  }

  setInterval(()=>{
    if(document.getElementById("admin")?.classList.contains("active")){
      ensure();
      watch();
    }
  },1000);

  window.__MEDJASI_ADMIN_ORGANIZER_APPLY__=apply;
})();