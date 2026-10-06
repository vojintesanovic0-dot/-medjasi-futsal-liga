/* =========================================================
   MEĐASI ADMIN ORGANIZER
   Safe UI-only filter: existing DOM and functions stay intact.
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

  function direct(id){
    return document.getElementById(id)?.closest(".card")||document.getElementById(id)||null;
  }

  function classify(el){
    if(!el || !el.id) return "other";
    const id=el.id;
    if(id==="adminContent" || id==="adminOrganizer") return "ui";
    if(id==="adminCrudV4" || id==="adminMatches") return "liga";
    if(id==="graphicEngineCard") return "dizajn";
    if(id==="v7NewsAdmin" || id==="adminGalleryList") return "sadrzaj";
    if(id==="communityModerationCard") return "moderacija";
    if(id==="adminMusicPlaylist" || id==="v7SeasonCard" || id==="v7PushCard" || id==="moderatorManagement") return "sistem";
    return "other";
  }

  function apply(){
    const host=root();
    if(!host || !isAdmin()) return;

    [...host.children].forEach(el=>{
      if(el.id==="adminOrganizer") return;
      // Static creation forms are inside admin-grid.
      let group=el.classList.contains("admin-grid") ? "liga" : classify(el);
      // Some legacy cards have no id; classify them by a stable child/class.
      if(group==="other" && el.querySelector("#adminGalleryList")) group="sadrzaj";
      if(group==="other" && el.classList.contains("admin-music-card")) group="sistem";
      // "other" is intentionally hidden in filtered views so tools never repeat
      // across categories. They remain fully visible under "Sve funkcije".
      el.classList.toggle("admin-filter-hidden",active!=="all" && group!==active);
    });

    const status=document.querySelector("#adminOrganizerStatus");
    const label=groups.find(g=>g.id===active)?.title||"Sve funkcije";
    if(status) status.innerHTML='<i></i><span>Prikaz: <strong>'+label+'</strong> · ništa nije uklonjeno, samo je filtrirano.</span>';
  }

  function ensure(){
    const host=root();
    if(!host || !isAdmin() || document.getElementById("adminOrganizer")) return;

    const box=document.createElement("div");
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

    const observer=new MutationObserver(()=>apply());
    observer.observe(host,{childList:true});
    window.__MEDJASI_ADMIN_ORGANIZER_APPLY__=apply;
  }

  const oldShow=window.showSection;
  if(oldShow&&!window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__){
    window.__MEDJASI_ADMIN_ORGANIZER_SHOW_PATCH__=true;
    window.showSection=function(id){
      const result=oldShow.apply(this,arguments);
      if(id==="admin") setTimeout(()=>{ensure();apply();},80);
      return result;
    };
  }

  window.addEventListener("load",()=>setTimeout(()=>{ensure();apply();},700));
  setInterval(()=>{if(document.getElementById("admin")?.classList.contains("active")){ensure();apply();}},3000);
})();