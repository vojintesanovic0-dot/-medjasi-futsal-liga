(function(){
  const paths={
    home:'<path d="M4 10.5 12 4l8 6.5V20h-5v-5H9v5H4z"/>',
    ball:'<circle cx="12" cy="12" r="8"/><path d="m12 4 2.2 3.2-1.1 3.4h-3L9 7.2zM4.8 15l3.5-1.2 2.8 2-.9 3.5M19.2 15l-3.5-1.2-2.8 2 .9 3.5M14.2 7.2 18 8.8M9 7.2 6 8.8"/>',
    trophy:'<path d="M8 4h8v3a4 4 0 0 1-3 3.87V14h3v3H8v-3h3v-3.13A4 4 0 0 1 8 7z"/><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3"/>',
    shield:'<path d="M12 3 19 6v5c0 4.2-2.7 7.4-7 10-4.3-2.6-7-5.8-7-10V6z"/><path d="M9 11.5 11 13l4-4"/>',
    player:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6"/>',
    stats:'<path d="M5 19V9M11 19V5M17 19v-7M3 20h16"/>',
    gallery:'<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4-4 3 3 2-2 5 4"/>',
    community:'<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M7 9h10M7 12h7"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5"/>',
    bell:'<path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5z"/><path d="M10 20h4"/>',
    settings:'<path d="m12 3 1 2.1 2.2.6 1.9-1.2 1.4 1.4-1.2 1.9.6 2.2 2.1 1v2l-2.1 1-.6 2.2 1.2 1.9-1.4 1.4-1.9-1.2-2.2.6-1 2.1h-2l-1-2.1-2.2-.6-1.9 1.2-1.4-1.4 1.2-1.9-.6-2.2-2.1-1v-2l2.1-1 .6-2.2-1.2-1.9L4.8 4.5l1.9 1.2L8.9 5 10 3z"/><circle cx="12" cy="12" r="3"/>',
    goal:'<path d="M5 7h14v11H5z"/><path d="M8 7v11M11 7v11M14 7v11M17 7v11M5 10h14M5 13h14M5 16h14"/>',
    yellow:'<rect x="7" y="4" width="10" height="16" rx="1.5"/>',
    red:'<rect x="7" y="4" width="10" height="16" rx="1.5"/>',
    mvp:'<path d="m12 3 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z"/><path d="M9 19h6"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16M8 13h2M12 13h2M8 16h2M12 16h2"/>',
    result:'<path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h3M13 13h3M8 17h8"/>',
    live:'<circle cx="12" cy="12" r="8"/><path d="M9 12h6M12 9v6"/>',
    search:'<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
    camera:'<path d="M4 8h4l1.5-2h5L16 8h4v10H4z"/><circle cx="12" cy="13" r="3.5"/>',
    upload:'<path d="M12 16V4M8 8l4-4 4 4M5 14v5h14v-5"/>',
    chat:'<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
    news:'<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    music:'<path d="M9 18V5l9-2v13"/><circle cx="6.5" cy="18" r="3.5"/><circle cx="15.5" cy="16" r="3.5"/>',
    shop:'<path d="M4 9h16l-1 11H5z"/><path d="M7 9a5 5 0 0 1 10 0M8 13h8"/>',
    coin:'<circle cx="12" cy="12" r="8"/><path d="M9 9h5a2 2 0 1 1 0 4h-4a2 2 0 1 0 0 4h5M12 7v10"/>',
    gift:'<path d="M4 10h16v10H4zM3 7h18v3H3z"/><path d="M12 7v13M12 7H8.5a2.5 2.5 0 1 1 0-5c2 0 3.5 2.5 3.5 5ZM12 7h3.5a2.5 2.5 0 1 0 0-5C13.5 2 12 4.5 12 7Z"/>',
    star:'<path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>',
    admin:'<path d="M5 5h14v14H5z"/><path d="M8 9h8M8 12h5M8 15h7"/>'
  };
  const map={'⌂':'home','⚽':'ball','🏆':'trophy','🛡':'shield','👟':'player','👤':'player','📊':'stats','📸':'gallery','✨':'star','💬':'community','📰':'news','🎯':'target','🔔':'bell','☰':'settings','🔥':'live','📣':'news','🔴':'live','🏁':'result','📈':'stats','🎵':'music','🔊':'music','🔎':'search','🔍':'search','🟨':'yellow','🟥':'red','🔒':'shield','📷':'camera','🔐':'shield','🔑':'shield','⚙':'settings','🎛':'settings','📤':'upload','🔵':'live','📋':'result','🖼':'gallery','✏':'settings','👑':'mvp','🛠':'settings','🏟':'shield','🏅':'mvp','🎟':'gift','📁':'gallery','🔗':'result','🚫':'shield','⚑':'result','📜':'result','📝':'news','🗂':'gallery','🔄':'live','💾':'result','👁':'player','🧤':'player'};
  function hydrate(root=document){
    root.querySelectorAll?.('.m-icon[data-icon]').forEach(el=>{
      if(el.dataset.hydrated==='1') return;
      const key=el.dataset.icon, path=paths[key]||paths.star;
      const size=el.dataset.size||'1em';
      el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+path+'</svg>';
      el.dataset.hydrated='1';
      el.style.setProperty('--mi-size',size);
    });
  }
  function html(emoji,size="1em"){
    const key=map[emoji]||"star";
    return '<span class="m-icon" data-icon="'+key+'" data-size="'+size+'" aria-hidden="true"></span>';
  }
  window.medjasiIcon={map,html,hydrate};
  const mo=new MutationObserver(()=>hydrate(document));
  function boot(){hydrate(document);mo.observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();