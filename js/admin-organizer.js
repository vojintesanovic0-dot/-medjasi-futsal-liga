/* =========================================================
   MEĐASI ADMIN ORGANIZER
   UI-only organization. NEVER removes or duplicates admin tools.
   Every direct admin card gets exactly one category.
========================================================= */
(function(){
  if(window.__MEDJASI_ADMIN_ORGANIZER__) return;
  window.__MEDJASI_ADMIN_ORGANIZER__=true;

  const root=()=>document.getElementById("adminContent");
  const isAdmin=()=>typeof window.isAdmin==="function"&&window.isAdmin();

  const groups=[
    {id:"all",icon:"▦",title:"Sve funkcije",desc:"Prikaži cijeli Admin"},
    {id:"liga",icon:"⚽",title:"Liga",desc:"Ekipe • igrači • utakmice • CRUD"},
    {id:"sadrzaj",icon:"📰",title:"Sadržaj",desc:"Vijesti • galerija • objave"},
    {id:"dizajn",icon:"🎨",title:"Graphic Studio",desc:"Player cards • MVP • grafike"},
    {id:"moderacija",icon:"🛡️",title:"Moderacija",desc:"Community • prijave • pregled"},
    {id:"sistem",icon:"⚙️",title:"Sistem",desc:"Sezone • muzika • push • uloge"}
  ];

  let active="all";

  function classify(el){
    if(!el || el.id==="adminOrganizer") return "ui";

    const id=el.id||"";
    const cls=el.classList||{contains:()=>false};

    // Static Liga block: team/player/match creation forms.
    if(cls.contains("admin-grid")) return "liga";

    // Exact dynamic/static admin cards.
    if(id==="adminMatches" || el.querySelector?.("#adminMatches")) return "liga";
    if(id==="adminCrudV4" || el.querySelector?.("#adminCrudV4")) return "liga";

    if(id==="graphicEngineCard") return "dizajn";

    if(id==="v7NewsAdmin" || el.querySelector?.("#v7NewsAdmin")) return "sadrzaj";
    if(id==="adminGalleryList" || el.querySelector?.("#adminGalleryList")) return "sadrzaj";
    if(id==="communityAlbumAdmin" || el.querySelector?.("#communityAlbumAdmin")) return "sadrzaj";

    if(id==="communityModerationCard" || el.querySelector?.("#communityModerationCard")) return "moderacija";

    if(id==="adminMusicPlaylist" || el.querySelector?.("#adminMusicPlaylist") || cls.contains("admin-music-card")) return "sistem";
    if(id==="v7SeasonCard" || el.querySelector?.("#v7SeasonCard")) return "sistem";
    if(id==="v7PushCard" || el.querySelector?.("#v7PushCard")) return "sistem";
    if(id==="moderatorManagement" || el.querySelector?.("#moderatorManagement")) return "sistem";

    return "other";
  }

  function apply(){
    const host=root();
    if(!host || !isAdmin()) return;

    const children=[...host.children].filter(el=>el.id!=="adminOrganizer");

    children.forEach(el=>{
      const group=classify(el);
      el.dataset.adminOrganizerGroup=group;

      // Important: filtered views use a whitelist, not an exception list.
      // This guarantees that Gallery / Playlist / Push can exist ONLY in Sistem
      // or Sadrzaj, never accidentally inside every category.
      const visible=active==="all" || group===active;
      el.classList.toggle("admin-filter-hidden",!visible);
      el.hidden=!visible;
    });

    const status=document.getElementById("adminOrganizerStatus");
    const label=groups.find(g=>g.id===active)?.title||"Sve funkcije";
    if(status) status.innerHTML='<i></i><span>Prikaz: <strong>'+label+'</strong> · ništa nije uklonjeno, samo je filtrirano.</span>';
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
          '<div><span class="admin-organizer-kicker">BRZI ADMIN MENI</span><strong>Upravljanje na jednom mjestu</strong><p>Odaberi područje koje trenutno radiš. Dugme „Sve funkcije“ vraća kompletan panel.</p></div>'+
        '</div>'+
        '<div class="admin-organizer-tabs">'+
          groups.map(g=>'<button type="button" class="admin-organizer-tab '+(g.id==="all"?"active":"")+'" data-admin-filter="'+g.id+'"><b>'+g.icon+'</b><span>'+g.title+'</span><small>'+g.desc+'</small></button>').join("")+
        '</div>'+
        '<div id="adminOrganizerStatus" class="admin-organizer-status"><i></i><span>Prikaz: <strong>Sve funkcije</strong> · ništa nije uklonjeno, samo je filtrirano.</span></div>';

      host.prepend(box);

      box.querySelectorAll("[data-admin-filter]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          active=btn.dataset.adminFilter||"all";
          box.querySelectorAll(".admin-organizer-tab").forEach(b=>b.classList.toggle("active",b===btn));
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