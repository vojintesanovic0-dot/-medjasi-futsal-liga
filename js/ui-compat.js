/*
 * UI compatibility layer extracted from app.js.
 * Keeps legacy/community/profile patches isolated from core application logic.
 */

(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const esc11=v=>typeof esc==='function'?esc(v??''):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fallback='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#0b1b2b"/><circle cx="80" cy="61" r="28" fill="#5f7487"/><path d="M31 139c6-31 25-47 49-47s43 16 49 47" fill="#5f7487"/></svg>');
  const getAvatar=()=>currentProfile?.avatar_url||currentUser?.user_metadata?.avatar_url||fallback;

  function patchHeader(){
    const account=q('headerAccount');
    if(!account || typeof currentUser==='undefined' || !currentUser) return;
    const name=esc11(currentProfile?.username||currentUser.user_metadata?.username||currentUser.email?.split('@')[0]||'Korisnik');
    const avatar=esc11(getAvatar());
    const admin=currentProfile?.role==='admin';
    account.innerHTML=`<button class="account-btn v11-profile-chip" onclick="openV9Profile('${esc11(currentUser.id)}')" title="Otvori profil"><img class="v11-header-avatar" src="${avatar}" alt=""><span><strong>${name}${admin?'<span class="account-admin">Admin</span>':''}</strong><small>Otvori profil</small></span></button><button class="account-btn" onclick="logout()" title="Odjava">↪</button>`;
  }

  async function refreshProfileEverywhere(){
    patchHeader();
    if(typeof renderMyProfile==='function') try{await renderMyProfile()}catch(e){}
  }

  // If the older updater fires later, restore the profile presentation immediately.
  const oldUpdate=window.updateAuthUI;
  if(!window.__V11_UPDATE_PATCH__){
    window.__V11_UPDATE_PATCH__=true;
    window.updateAuthUI=function(){
      try{oldUpdate?.apply(this,arguments)}catch(e){}
      setTimeout(refreshProfileEverywhere,0);
    };
  }

  // Retire the legacy comments navigation even if an older bootstrap recreates it.
  function normalizeNewsNav(){
    document.querySelectorAll('#mainNav button,.mobile-more-grid button').forEach(b=>{
      if((b.getAttribute('onclick')||'').includes("showSection('comments')") || (b.getAttribute('onclick')||'').includes("mobileMoreGo('comments')") || /Komentari/.test(b.textContent||'')){
        b.innerHTML=b.closest('#mainNav')?'<span></span><span>Vijesti</span>':'<span></span><b>Vijesti</b><small>Novosti lige</small>';
        b.setAttribute('onclick',b.closest('#mainNav')?"showSection('news')":"mobileMoreGo('news')");
      }
    });
  }

  // News is intentionally shareable to chat, but never has a comment control.
  function polishNews(){
    const n=q('news');if(!n)return;
    n.querySelectorAll('.comment,.comment-form,.comments,.news-comments').forEach(x=>x.remove());
  }

  window.addEventListener('load',()=>{
    setTimeout(()=>{normalizeNewsNav();patchHeader();polishNews()},250);
    setTimeout(()=>{normalizeNewsNav();patchHeader();polishNews()},1200);
    setTimeout(()=>{normalizeNewsNav();polishNews()},2600);
  });
  const observer=new MutationObserver(()=>{normalizeNewsNav();});
  observer.observe(document.body,{childList:true,subtree:true});
})();



(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const esc12=v=>typeof esc==='function'?esc(v??''):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  /* Local SVG fallback: no dependency on an external placeholder service. */
  const fallback='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#0b1b2b"/><circle cx="80" cy="61" r="28" fill="#5f7487"/><path d="M31 139c6-31 25-47 49-47s43 16 49 47" fill="#5f7487"/></svg>');
  const avatarFor=p=>p?.avatar_url||fallback;

  function normalizeNav(){
    document.querySelectorAll('#mainNav button,.mobile-more-grid button').forEach(b=>{
      const oc=b.getAttribute('onclick')||'';
      const txt=(b.textContent||'').trim();
      if(oc.includes("showSection('comments')")||oc.includes("mobileMoreGo('comments')")||/Komentari/.test(txt)){
        b.innerHTML=b.closest('#mainNav')?'<span></span><span>Vijesti</span>':'<span></span><b>Vijesti</b><small>Novosti lige</small>';
        b.setAttribute('onclick',b.closest('#mainNav')?"showSection('news')":"mobileMoreGo('news')");
      }
    });
  }

  function redirectLegacyComments(){
    const original=window.showSection;
    if(!original||window.__V12_SHOW_PATCH__)return;
    window.__V12_SHOW_PATCH__=true;
    window.showSection=function(id){
      if(id==='comments')id='news';
      return original.call(this,id);
    };
  }

  function patchAvatarImages(){
    document.querySelectorAll('.v9-avatar,.v9-profile-avatar,.v9-avatar-big,.v11-header-avatar').forEach(img=>{
      if(img.dataset.v12Fallback==='1')return;
      img.dataset.v12Fallback='1';
      img.addEventListener('error',function(){this.src=fallback;},{once:true});
    });
  }

  function patchHeader(){
    const account=q('headerAccount');
    if(!account||!window.currentUser)return;
    const p=currentProfile||{};
    const name=esc12(p.username||window.currentUser.user_metadata?.username||window.currentUser.email?.split('@')[0]||'Korisnik');
    const av=esc12(avatarFor(p));
    const admin=p.role==='admin';
    account.innerHTML=`<button class="account-btn v11-profile-chip" onclick="openV9Profile('${esc12(window.currentUser.id)}')" title="Otvori profil"><img class="v11-header-avatar" src="${av}" alt="Profil"><span><strong>${name}${admin?'<span class="account-admin">Admin</span>':''}</strong><small>Otvori profil</small></span></button><button class="account-btn" onclick="logout()" title="Odjava">↪</button>`;
    patchAvatarImages();
  }

  function polishNews(){
    const n=q('news');if(!n)return;
    /* Vijesti are editorial. Remove any accidental legacy comment UI, but keep Chat sharing. */
    n.querySelectorAll('.comment,.comment-form,.comments,.news-comments,#commentForm,#commentsList').forEach(x=>x.remove());
  }

  function polishCommunity(){
    const c=q('community');if(!c)return;
    c.querySelectorAll('.v9-post-author,.v9-avatar').forEach(el=>{
      if(el.tagName==='IMG')el.title='Otvori profil';
    });
    patchAvatarImages();
  }

  function run(){
    redirectLegacyComments();
    normalizeNav();
    patchHeader();
    polishNews();
    polishCommunity();
  }

  window.addEventListener('load',()=>{
    run();
    [300,900,1800,3200].forEach(ms=>setTimeout(run,ms));
  });
  const observer=new MutationObserver(()=>{
    normalizeNav();
    polishNews();
    patchAvatarImages();
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();



(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const esc13=v=>typeof esc==='function'?esc(v??''):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fallback='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#0b1b2b"/><circle cx="80" cy="61" r="28" fill="#5f7487"/><path d="M31 139c6-31 25-47 49-47s43 16 49 47" fill="#5f7487"/></svg>');

  function renderHeaderAccount(){
    const host=q('headerAccount');
    if(!host)return;
    const u=currentUser;
    const p=window.currentProfile||{};
    if(!u){
      host.innerHTML=`<button type="button" class="account-btn v13-login" onclick="showSection('login')"> Prijava</button><button type="button" class="account-btn v13-register" onclick="showSection('login');setTimeout(()=>document.getElementById('registerUsername')?.focus(),80)">Registracija</button>`;
      return;
    }
    const name=esc13(p.username||u.user_metadata?.username||u.email?.split('@')[0]||'Korisnik');
    const av=esc13(p.avatar_url||fallback);
    const admin=p.role==='admin';
    host.innerHTML=`<button type="button" class="account-btn v13-auth-main" onclick="openV9Profile('${esc13(u.id)}')" title="Otvori profil"><img src="${av}" alt="Profil" onerror="this.src='${fallback}'"><span class="v13-auth-copy"><strong>${name}${admin?'<span class="account-admin">Admin</span>':''}</strong><small>Profil</small></span></button><button type="button" class="account-btn v13-logout" onclick="logout()" title="Odjava" aria-label="Odjava">↪</button>`;
  }

  function patch(){renderHeaderAccount();}
  window.addEventListener('load',()=>{
    patch();
    [250,800,1600,3000].forEach(ms=>setTimeout(patch,ms));
  });
  /* Re-render immediately whenever the existing auth UI finishes. */
  const old=window.updateAuthUI;
  if(old && !window.__V13_AUTH_WRAPPED__){
    window.__V13_AUTH_WRAPPED__=true;
    window.updateAuthUI=function(){
      const r=old.apply(this,arguments);
      setTimeout(renderHeaderAccount,0);
      return r;
    };
  }
})();
