/*
 * UI compatibility / normalization layer.
 * Keeps legacy navigation, auth header, avatars and public-feed polish isolated
 * from the core application logic.
 *
 * This layer does not remove core functionality or user content.
 */
(function(){
  "use strict";

  if(window.__MEDJASI_UI_COMPAT__) return;
  window.__MEDJASI_UI_COMPAT__=true;

  const $=id=>document.getElementById(id);

  const escapeHtml=value=>
    typeof window.esc==="function"
      ? window.esc(value??"")
      : String(value??"").replace(/[&<>"']/g,c=>({
          "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
        }[c]));

  const fallbackAvatar=
    'data:image/svg+xml;charset=UTF-8,'+
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">'+
      '<rect width="160" height="160" rx="32" fill="#0b1b2b"/>'+
      '<circle cx="80" cy="61" r="28" fill="#5f7487"/>'+
      '<path d="M31 139c6-31 25-47 49-47s43 16 49 47" fill="#5f7487"/>'+
      '</svg>'
    );

  function normalizeLegacyNavigation(){
    document
      .querySelectorAll("#mainNav button,.mobile-more-grid button")
      .forEach(button=>{
        const onclick=button.getAttribute("onclick")||"";
        const text=(button.textContent||"").trim();

        const isLegacyComments=
          onclick.includes("showSection('comments')") ||
          onclick.includes('showSection("comments")') ||
          onclick.includes("mobileMoreGo('comments')") ||
          onclick.includes('mobileMoreGo("comments")') ||
          /Komentari/.test(text);

        if(!isLegacyComments) return;

        if(button.closest("#mainNav")){
          button.innerHTML="<span></span><span>Vijesti</span>";
          button.setAttribute("onclick","showSection('news')");
        }else{
          button.innerHTML="<span></span><b>Vijesti</b><small>Novosti lige</small>";
          button.setAttribute("onclick","mobileMoreGo('news')");
        }
      });
  }

  function redirectLegacyComments(){
    const original=window.showSection;
    if(typeof original!=="function" || window.__MEDJASI_COMMENTS_ROUTE_PATCH__) return;

    window.__MEDJASI_COMMENTS_ROUTE_PATCH__=true;

    window.showSection=function(id){
      return original.call(this,id==="comments" ? "news" : id);
    };
  }

  function patchAvatarImages(){
    document
      .querySelectorAll(".v9-avatar,.v9-profile-avatar,.v9-avatar-big,.v11-header-avatar")
      .forEach(img=>{
        if(!(img instanceof HTMLImageElement)) return;
        if(img.dataset.medjasiFallbackBound==="1") return;

        img.dataset.medjasiFallbackBound="1";
        img.addEventListener("error",function(){
          if(this.dataset.medjasiFallbackApplied==="1") return;
          this.dataset.medjasiFallbackApplied="1";
          this.src=fallbackAvatar;
        },{once:true});
      });
  }

  function renderHeaderAccount(){
    const host=$("headerAccount");
    if(!host) return;

    const user=window.currentUser;
    const profile=window.currentProfile||{};

    if(!user){
      host.innerHTML=
        '<button type="button" class="account-btn v13-login" '+
        'onclick="window.showSection(\'login\')" '+
        'title="Prijava ili registracija">Prijava</button>'+
        '<button type="button" class="account-btn v13-register" '+
        'onclick="window.showSection(\'login\');setTimeout(()=>document.getElementById(\'registerUsername\')?.focus(),80)" '+
        'title="Registracija">Registracija</button>';
      return;
    }

    const name=escapeHtml(
      profile.username ||
      user.user_metadata?.username ||
      user.email?.split("@")[0] ||
      "Korisnik"
    );

    const avatar=escapeHtml(profile.avatar_url||fallbackAvatar);
    const isAdmin=profile.role==="admin";

    host.innerHTML=
      '<button type="button" class="account-btn v13-auth-main" '+
      'onclick="window.openV9Profile(\''+escapeHtml(user.id)+'\')" '+
      'title="Otvori profil">'+
        '<img class="v13-header-avatar" src="'+avatar+'" alt="Profil">'+
        '<span class="v13-auth-copy">'+
          '<strong>'+name+(isAdmin?'<span class="account-admin">Admin</span>':"")+'</strong>'+
          '<small>Profil</small>'+
        '</span>'+
      '</button>'+
      '<button type="button" class="account-btn v13-logout" '+
      'onclick="window.logout()" title="Odjava" aria-label="Odjava">↪</button>';

    patchAvatarImages();
  }

  function polishNews(){
    const news=$("news");
    if(!news) return;

    news
      .querySelectorAll(
        ".comment,.comment-form,.comments,.news-comments,#commentForm,#commentsList"
      )
      .forEach(node=>node.remove());
  }

  function polishCommunity(){
    const community=$("community");
    if(!community) return;

    community
      .querySelectorAll(".v9-post-author img,.v9-avatar")
      .forEach(img=>{
        if(img instanceof HTMLImageElement && !img.title){
          img.title="Otvori profil";
        }
      });

    patchAvatarImages();
  }

  let observerQueued=false;

  function queueVisualSync(){
    if(observerQueued) return;
    observerQueued=true;

    setTimeout(()=>{
      observerQueued=false;
      normalizeLegacyNavigation();
      polishNews();
      polishCommunity();
      patchAvatarImages();
    },80);
  }

  function run(){
    redirectLegacyComments();
    normalizeLegacyNavigation();
    renderHeaderAccount();
    polishNews();
    polishCommunity();
    patchAvatarImages();
  }

  const originalUpdateAuthUI=window.updateAuthUI;

  if(typeof originalUpdateAuthUI==="function" && !window.__MEDJASI_UPDATE_AUTH_PATCH__){
    window.__MEDJASI_UPDATE_AUTH_PATCH__=true;

    window.updateAuthUI=function(){
      const result=originalUpdateAuthUI.apply(this,arguments);
      queueVisualSync();
      return result;
    };
  }

  window.addEventListener("load",()=>{
    run();
    [250,900,1800,3200].forEach(delay=>setTimeout(queueVisualSync,delay));
  },{once:true});

  if(document.body){
    const observer=new MutationObserver(records=>{
      const relevant=records.some(record=>
        [...record.addedNodes].some(node=>{
          if(node.nodeType!==1) return false;
          return node.matches?.("#mainNav,#headerAccount,#news,#community,.mobile-more-grid") ||
            node.closest?.("#mainNav,#headerAccount,#news,#community,.mobile-more-grid");
        })
      );
      if(relevant) queueVisualSync();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
})();
