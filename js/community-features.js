/* Medjasi Community + Fan utility layer
   Functional-only enhancement. Does not replace the existing visual system.
*/
(()=>{"use strict";
const q=id=>document.getElementById(id);
const escX=v=>typeof window.esc==="function"?window.esc(v??""):String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const uid=()=>window.currentUser?.id||null;
const admin=()=>typeof window.isAdmin==="function"&&window.isAdmin();
const toastX=(m,t)=>typeof window.toast==="function"?window.toast(m,t):alert(m);
const client=()=>window.supabaseClient;

async function reportTarget(kind,id){
  if(!uid())return toastX("Prijavi se da prijaviš sadržaj.","error"),false;
  if(!id||!["post","comment"].includes(kind))return toastX("Sadržaj za prijavu nije pronađen.","error"),false;
  const reason=prompt("Zašto prijavljuješ ovaj sadržaj?\n\nSpam, uvreda, neprikladan sadržaj, lažno predstavljanje ili drugo.");
  if(!reason?.trim())return false;
  const db=client();
  if(!db?.from)return toastX("Servis za prijave trenutno nije dostupan.","error"),false;
  const payload={reporter_id:uid(),reason:reason.trim().slice(0,500)};
  if(kind==="post")payload.post_id=id;else payload.comment_id=id;
  try{
    const {error}=await db.from("community_reports").insert(payload);
    if(error)throw error;
    toastX("Prijava je poslata administratoru.");
    return true;
  }catch(error){
    console.warn("Community report:",error);
    toastX(error?.message||"Prijava nije uspjela. Pokušaj ponovo.","error");
    return false;
  }
}
async function blockUser(id){
  if(!uid())return toastX("Prijavi se da blokiraš korisnika.","error"),false;
  if(!id||String(id)===String(uid()))return false;
  if(!confirm("Blokirati ovog korisnika? Njegove Community objave i komentari više se neće prikazivati tebi."))return false;
  const db=client();
  if(!db?.from)return toastX("Servis za blokiranje trenutno nije dostupan.","error"),false;
  try{
    const {error}=await db.from("community_blocks").upsert({user_id:uid(),blocked_user_id:id});
    if(error)throw error;
    toastX("Korisnik je blokiran.");
    try{await window.loadV9Community?.();}catch(refreshError){console.warn("Community refresh:",refreshError);}
    return true;
  }catch(error){
    console.warn("Community block:",error);
    toastX(error?.message||"Korisnika nije moguće blokirati sada.","error");
    return false;
  }
}
async function unblockUser(id){
  if(!uid()||!id)return false;
  const db=client();
  if(!db?.from)return toastX("Servis za blokiranje trenutno nije dostupan.","error"),false;
  try{
    const {error}=await db.from("community_blocks").delete().eq("user_id",uid()).eq("blocked_user_id",id);
    if(error)throw error;
    toastX("Korisnik više nije blokiran.");
    try{await window.loadV9Community?.();}catch(refreshError){console.warn("Community refresh:",refreshError);}
    return true;
  }catch(error){
    console.warn("Community unblock:",error);
    toastX(error?.message||"Korisnika nije moguće odblokirati sada.","error");
    return false;
  }
}
window.communityReport=reportTarget;
window.communityBlock=blockUser;
window.communityUnblock=unblockUser;

async function getBlocked(){
  if(!uid()||!client()?.from)return [];
  try{
    const {data,error}=await client().from("community_blocks").select("blocked_user_id").eq("user_id",uid());
    if(error)throw error;
    return (data||[]).map(x=>String(x.blocked_user_id));
  }catch(error){
    console.warn("Community blocks:",error);
    return [];
  }
}
function extractUserId(el){
  const attr=el?.getAttribute("onclick")||"";
  const m=attr.match(/openV9Profile\(['"]([^'"]+)['"]\)/);
  return m?.[1]||null;
}
async function enhanceFeed(){
  const feed=q("v9Feed"); if(!feed)return;
  const blocked=new Set(await getBlocked());
  feed.querySelectorAll(".v9-post").forEach(post=>{
    const author=post.querySelector(".v9-post-author");
    const id=extractUserId(author);
    if(id && blocked.has(String(id))){post.remove();return}
    if(id && !post.querySelector(".community-post-tools")){
      const tools=document.createElement("div");
      tools.className="community-post-tools";
      tools.innerHTML=(id!==String(uid())?'<button type="button" class="btn btn-small" data-community-action="block"> Blokiraj</button>':'')+
        '<button type="button" class="btn btn-small" data-community-action="report"> Prijavi</button>';
      tools.querySelector('[data-community-action="block"]')?.addEventListener("click",()=>blockUser(id));
      const reactionBtn=post.querySelector(".v9-reaction");const postMatch=reactionBtn?.getAttribute("onclick")?.match(/toggleV9Reaction\(['"]([^'"]+)/);tools.querySelector('[data-community-action="report"]')?.addEventListener("click",()=>reportTarget("post",postMatch?.[1]));
      post.querySelector(".v9-post-body")?.appendChild(tools);
    }
  });
}
function patchLoad(){
  if(window.__COMMUNITY_SAFETY_PATCH__)return;
  window.__COMMUNITY_SAFETY_PATCH__=true;
  const old=window.loadV9Community;
  if(typeof old==="function"){
    window.loadV9Community=async function(){
      const result=await old.apply(this,arguments);
      // Only enhance a successfully refreshed, visible Community feed. The old
      // version issued extra reads during page startup, even while Home was open.
      if(result===true&&q("community")?.classList.contains("active")){
        setTimeout(async()=>{
          try{await enhanceFeed();await renderPolls()}
          catch(error){console.warn("Community enhancements:",error)}
        },0);
      }
      return result;
    };
  }
}
function patchComposer(){
  if(window.__COMMUNITY_COMPOSER_PATCH__)return;
  window.__COMMUNITY_COMPOSER_PATCH__=true;
  const old=window.openV9PostComposer;
  if(typeof old!=="function")return;
  window.openV9PostComposer=function(){
    old.apply(this,arguments);
    setTimeout(()=>{
      const form=q("v9PostCaption")?.closest(".form"); if(!form||form.querySelector(".community-extra-controls"))return;
      const wrap=document.createElement("div");wrap.className="community-extra-controls";
      wrap.innerHTML='<div class="form-group"><label> Poveži objavu sa ligom (opcionalno)</label><select id="communityPostMatch"><option value="">Bez utakmice</option></select></div>'+
        '<div class="form-group"><select id="communityPostTeam"><option value="">Bez ekipe</option></select></div>'+
        '<div class="form-group"><select id="communityPostPlayer"><option value="">Bez igrača</option></select></div>'+
        '<div class="form-group"><label><input id="communityPostPollEnabled" type="checkbox" style="width:auto;margin-right:7px">  Dodaj anketu</label><input id="communityPollQuestion" maxlength="300" placeholder="Pitanje ankete" disabled><textarea id="communityPollOptions" maxlength="600" rows="3" placeholder="Opcija 1\nOpcija 2\nOpcija 3" disabled></textarea></div>';
      form.insertBefore(wrap,form.querySelector("button.btn-green"));
      const ms=q("communityPostMatch"),ts=q("communityPostTeam"),ps=q("communityPostPlayer"),pe=q("communityPostPollEnabled"),pq=q("communityPollQuestion"),po=q("communityPollOptions");
      (window.matches||[]).slice().sort((a,b)=>new Date(a.match_date)-new Date(b.match_date)).forEach(m=>{const o=document.createElement("option");o.value=m.id;o.textContent=(window.teamName?.(m.home_team_id)||"Domaćin")+" – "+(window.teamName?.(m.away_team_id)||"Gost");ms.appendChild(o)});
      (window.teams||[]).forEach(t=>{const o=document.createElement("option");o.value=t.id;o.textContent=t.name;ts.appendChild(o)});
      (window.players||[]).forEach(p=>{const o=document.createElement("option");o.value=p.id;o.textContent=p.name;ps.appendChild(o)});
      pe.onchange=()=>{pq.disabled=po.disabled=!pe.checked};
    },20);
  };
}
async function publishExtras(postId){
  const match=q("communityPostMatch")?.value||null;
  const team=q("communityPostTeam")?.value||null;
  const player=q("communityPostPlayer")?.value||null;

  if(match||team||player){
    const {error}=await client().from("community_posts")
      .update({match_id:match,team_id:team,player_id:player})
      .eq("id",postId).eq("user_id",uid());
    if(error)throw error;
  }

  if(!q("communityPostPollEnabled")?.checked)return;

  const question=q("communityPollQuestion")?.value.trim()||"";
  const options=(q("communityPollOptions")?.value||"")
    .split("\n").map(value=>value.trim()).filter(Boolean).slice(0,8);

  if(question.length<3||question.length>300){
    throw new Error("Pitanje ankete mora imati između 3 i 300 znakova.");
  }
  if(options.length<2||options.length>8){
    throw new Error("Anketa mora imati najmanje 2, a najviše 8 opcija.");
  }
  if(options.some(label=>label.length>120)){
    throw new Error("Svaka opcija ankete može imati najviše 120 znakova.");
  }

  const {data:poll,error:pollError}=await client()
    .from("community_polls")
    .insert({post_id:postId,question})
    .select("id").single();
  if(pollError)throw pollError;
  if(!poll?.id)throw new Error("Anketa nije vraćena nakon čuvanja.");

  const {error:optionsError}=await client().from("community_poll_options").insert(
    options.map((label,index)=>({poll_id:poll.id,label,sort_order:index}))
  );
  if(optionsError)throw optionsError;
}
function patchPublish(){
  if(window.__COMMUNITY_PUBLISH_PATCH__)return;
  window.__COMMUNITY_PUBLISH_PATCH__=true;
  const old=window.publishV9Post;
  if(typeof old!=="function")return;
  window.publishV9Post=async function(){
    let postId=null;
    try{
      postId=await old.apply(this,arguments);
    }catch(error){
      console.error("Objava nije mogla biti završena:",error);
      toastX(error?.message||"Objava nije sačuvana.","error");
      return null;
    }

    // The base publisher returns the exact inserted ID. Never guess from the
    // newest post: a failed publish could otherwise modify an older post.
    if(typeof postId==="string"&&/^[0-9a-f-]{36}$/i.test(postId)){
      try{
        await publishExtras(postId);
      }catch(error){
        console.error("Dodatni Community podaci nisu sačuvani:",error);
        toastX("Objava je sačuvana, ali povezivanje/anketa nije potpuno završeno.","error");
      }
      window.loadV9Community?.();
      return postId;
    }
    return null;
  };
}
async function renderPolls(){
  const feed=q("v9Feed");
  if(!feed||!client()?.from)return;

  // Read IDs from the post itself, never from the owner/admin-only delete button.
  const postNodes=[...feed.querySelectorAll(".v9-post[data-post-id]")];
  const postById=new Map(
    postNodes.map(post=>[String(post.dataset.postId||""),post]).filter(([id])=>id)
  );
  const postIds=[...postById.keys()];
  if(!postIds.length)return;

  try{
    const {data:pollRows,error:pollError}=await client()
      .from("community_polls")
      .select("id,post_id,question")
      .in("post_id",postIds);
    if(pollError)throw pollError;
    const polls=pollRows||[];
    if(!polls.length)return;

    const pollIds=polls.map(p=>p.id).filter(Boolean);
    const {data:optionRows,error:optionError}=await client()
      .from("community_poll_options")
      .select("id,poll_id,label,sort_order")
      .in("poll_id",pollIds)
      .order("sort_order",{ascending:true});
    if(optionError)throw optionError;

    const optionsByPoll=new Map();
    for(const option of optionRows||[]){
      const key=String(option.poll_id);
      if(!optionsByPoll.has(key))optionsByPoll.set(key,[]);
      optionsByPoll.get(key).push(option);
    }

    for(const poll of polls){
      const post=postById.get(String(poll.post_id));
      const body=post?.querySelector(".v9-post-body");
      if(!body||body.querySelector(":scope > .community-poll"))continue;

      const box=document.createElement("div");
      box.className="community-poll";
      box.dataset.pollId=String(poll.id);
      const question=document.createElement("strong");
      question.textContent=poll.question||"Anketa";
      box.appendChild(question);

      for(const option of optionsByPoll.get(String(poll.id))||[]){
        const button=document.createElement("button");
        button.type="button";
        button.dataset.option=String(option.id);
        button.textContent=option.label||"Opcija";
        button.addEventListener("click",async()=>{
          if(!uid()){
            toastX("Prijavi se da glasaš.","error");
            return;
          }
          if(button.disabled)return;
          box.querySelectorAll("button").forEach(item=>{item.disabled=true;});
          try{
            const {error}=await client().from("community_poll_votes").insert({
              poll_id:poll.id,
              option_id:button.dataset.option,
              user_id:uid()
            });
            if(error?.code==="23505"){
              toastX("Već si glasao na ovoj anketi.","error");
            }else if(error){
              throw error;
            }else{
              toastX("Glas je zabilježen.");
            }
          }catch(error){
            console.warn("Community poll vote:",error);
            toastX(error?.message||"Glasanje nije uspjelo. Pokušaj ponovo.","error");
            if(box.isConnected)box.querySelectorAll("button").forEach(item=>{item.disabled=false;});
          }
        });
        box.appendChild(button);
      }
      body.appendChild(box);
    }
  }catch(error){
    console.warn("Community polls:",error);
  }
}
function boot(){
  patchLoad();patchComposer();patchPublish();
  window.addEventListener("load",()=>{patchLoad();patchComposer();patchPublish();},{once:true});
}
boot();
})();

// Gallery albums + favorites + moderation panel
let albumsInFlight=null;
async function loadAlbums(){
  if(!client()?.from)return [];
  if(albumsInFlight)return albumsInFlight;
  albumsInFlight=(async()=>{
    try{
      const {data,error}=await client().from("gallery_albums")
        .select("id,name,description,cover_url,created_at")
        .order("created_at",{ascending:false});
      if(error)throw error;
      return data||[];
    }catch(error){
      console.warn("Gallery albums:",error);
      return [];
    }
  })();
  try{return await albumsInFlight}
  finally{albumsInFlight=null}
}
async function toggleFavorite(type,id){
  if(!uid())return toastX("Prijavi se da sačuvaš favorite.","error"),undefined;
  if(!["team","player"].includes(type)||!id)return toastX("Favorit nije prepoznat.","error"),undefined;
  const db=client();
  if(!db?.from)return toastX("Servis favorita trenutno nije dostupan.","error"),undefined;
  try{
    const {data,error:readError}=await db.from("fan_favorites").select("entity_type")
      .eq("user_id",uid()).eq("entity_type",type).eq("entity_id",String(id)).maybeSingle();
    if(readError)throw readError;
    if(data){
      const {error}=await db.from("fan_favorites").delete()
        .eq("user_id",uid()).eq("entity_type",type).eq("entity_id",String(id));
      if(error)throw error;
      toastX("Uklonjeno iz favorita.");
      return false;
    }
    const {error}=await db.from("fan_favorites").insert({user_id:uid(),entity_type:type,entity_id:String(id)});
    if(error)throw error;
    toastX("Dodano u favorite.");
    return true;
  }catch(error){
    console.warn("Community favorite:",error);
    toastX(error?.message||"Promjena favorita nije uspjela.","error");
    return undefined;
  }
}
window.toggleFavorite=toggleFavorite;
function decorateFavorite(type,id){
  setTimeout(async()=>{
    if(!uid())return;
    const host=q("modalContent");
    if(!host||host.querySelector(".community-favorite-action"))return;
    const h=host.querySelector("h2,h3");
    if(!h)return;
    let data;
    try{
      const {data:favorite,error}=await client().from("fan_favorites").select("entity_type")
        .eq("user_id",uid()).eq("entity_type",type).eq("entity_id",String(id)).maybeSingle();
      if(error)throw error;
      data=favorite;
    }catch(error){
      console.warn("Community favorite state:",error);
      return;
    }
    const b=document.createElement("button");
    b.type="button";b.className="btn btn-small community-favorite-action";
    b.textContent=data?"⭐ Ukloni iz favorita":" Dodaj u favorite";
    b.onclick=async()=>{
      b.disabled=true;
      try{
        const next=await toggleFavorite(type,id);
        if(typeof next==="boolean")b.textContent=next?"⭐ Ukloni iz favorita":" Dodaj u favorite";
      }finally{
        if(b.isConnected)b.disabled=false;
      }
    };
    h.parentElement?.appendChild(b);
  },60);
}
function patchFavorites(){if(window.__FAVORITES_PATCH__)return;window.__FAVORITES_PATCH__=true;const ot=window.openTeam,op=window.openPlayer;if(typeof ot==="function")window.openTeam=function(id){const r=ot.apply(this,arguments);decorateFavorite("team",id);return r};if(typeof op==="function")window.openPlayer=function(id){const r=op.apply(this,arguments);decorateFavorite("player",id);return r}}
async function injectGalleryAlbums(){
  const host=q("galleryGrid");
  if(!host||!q("gallery")?.classList.contains("active"))return;
  const albums=await loadAlbums();
  if(!q("gallery")?.classList.contains("active"))return;
  let bar=q("communityAlbumBar");
  if(!bar){
    bar=document.createElement("div");
    bar.id="communityAlbumBar";
    bar.style.marginBottom="12px";
    host.parentElement?.insertBefore(bar,host);
  }
  bar.innerHTML='<label> Album: <select id="communityAlbumFilter"><option value="">Sve fotografije</option>'+albums.map(a=>'<option value="'+escX(a.id)+'">'+escX(a.name)+'</option>').join("")+'</select></label>';
  const filter=q("communityAlbumFilter");
  if(filter)filter.onchange=()=>{
    const id=filter.value;
    host.querySelectorAll(".gallery-item").forEach((el,i)=>{
      const g=(window.gallery||[])[i];
      el.hidden=!!id&&String(g?.album_id)!==String(id);
    });
  };
}
let galleryAlbumSelectInFlight=false;
async function ensureGalleryAlbumSelect(){
  if(!admin()||galleryAlbumSelectInFlight)return;
  const host=q("adminGalleryList")?.parentElement;
  if(!host||q("galleryAlbumSelect"))return;
  galleryAlbumSelectInFlight=true;
  try{
    const albums=await loadAlbums();
    if(q("galleryAlbumSelect"))return;
    const wrap=document.createElement("div");
    wrap.className="form-group";
    wrap.innerHTML='<label> Album (opcionalno)</label><select id="galleryAlbumSelect"><option value="">Bez albuma</option>'+albums.map(a=>'<option value="'+escX(a.id)+'">'+escX(a.name)+'</option>').join("")+'</select>';
    const btn=host.querySelector('button[onclick*="adminAddGalleryImage"]');
    btn?.parentElement?.insertBefore(wrap,btn);
  }finally{
    galleryAlbumSelectInFlight=false;
  }
}
function patchGalleryUpload(){
  if(window.__GALLERY_UPLOAD_ALBUM_PATCH__)return;
  const old=window.adminAddGalleryImage;
  if(typeof old!=="function")return;
  window.__GALLERY_UPLOAD_ALBUM_PATCH__=true;
  window.adminAddGalleryImage=async function(){
    // Capture the selected album before the original handler clears its inputs.
    const album=q("galleryAlbumSelect")?.value||null;
    const result=await old.apply(this,arguments);

    // Only the exact inserted row ID is safe. Never guess by querying the newest
    // image: a cancelled/failed upload must not mutate an older gallery item.
    if(typeof result!=="string"||!result||!uid()||!album)return result;

    try{
      const {error}=await client().from("gallery")
        .update({album_id:album})
        .eq("id",result)
        .eq("created_by",uid());
      if(error)throw error;
      const local=window.gallery?.find(item=>String(item.id)===String(result));
      if(local)local.album_id=album;
    }catch(error){
      console.warn("Gallery album:",error);
      toastX("Fotografija je objavljena, ali album nije sačuvan. Uredi album i pokušaj ponovo.","error");
    }
    return result;
  };
}
function patchGallery(){
  if(!window.__GALLERY_ALBUM_PATCH__&&typeof window.renderGallery==="function"){
    window.__GALLERY_ALBUM_PATCH__=true;
    const old=window.renderGallery;
    window.renderGallery=function(){
      const result=old.apply(this,arguments);
      if(q("gallery")?.classList.contains("active"))setTimeout(injectGalleryAlbums,0);
      return result;
    };
  }
  if(!window.__GALLERY_ADMIN_ALBUM_PATCH__&&typeof window.renderAdminGallery==="function"){
    window.__GALLERY_ADMIN_ALBUM_PATCH__=true;
    const old=window.renderAdminGallery;
    window.renderAdminGallery=function(){
      const result=old.apply(this,arguments);
      if(admin()&&q("admin")?.classList.contains("active")){
        setTimeout(()=>{void injectAdminAlbumTools();void ensureGalleryAlbumSelect();void injectAdminReports()},0);
      }
      return result;
    };
  }
}
async function injectAdminReports(){if(!admin())return;const host=q("adminContent");if(!host||q("communityModerationCard"))return;const card=document.createElement("div");card.id="communityModerationCard";card.style.marginTop="20px";card.innerHTML='<h3>️ Community moderacija</h3><div id="communityReportsList" class="muted">Učitavanje prijava…</div>';host.appendChild(card);const {data,error}=await client().from("community_reports").select("id,post_id,comment_id,reason,status,created_at").eq("status","open").order("created_at",{ascending:false}).limit(50);if(error){q("communityReportsList").textContent=error.message;return}q("communityReportsList").innerHTML=(data||[]).map(r=>'<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)"><strong>'+escX(r.post_id?"Objava":"Komentar")+'</strong> · '+escX(r.reason)+'<div class="muted">'+escX(r.created_at)+'</div><button type="button" class="btn btn-small btn-blue" data-report-review="'+r.id+'"> Označi pregledano</button></div>').join("")||"Nema otvorenih prijava.";q("communityReportsList").querySelectorAll("[data-report-review]").forEach(b=>b.onclick=async()=>{const {error}=await client().from("community_reports").update({status:"reviewed",reviewed_by:uid()}).eq("id",b.dataset.reportReview);if(error)return toastX(error.message,"error");b.parentElement.remove();toastX("Prijava je obrađena.")})}
function patchCommentModeration(){
  if(window.__COMMENT_MODERATION_PATCH__)return;
  const old=window.toggleV9Comments;if(typeof old!=="function")return;
  window.__COMMENT_MODERATION_PATCH__=true;
  window.toggleV9Comments=async function(postId){
    const r=await old.apply(this,arguments);const box=q("v9comments-"+postId);if(!box||box.hidden)return r;
    const {data}=await client().from("community_comments").select("id,user_id").eq("post_id",postId).order("created_at",{ascending:true});const blocked=new Set(await getBlocked());
    const rows=[...(data||[])],comments=[...box.querySelectorAll(".v9-comment")];
    comments.forEach((el,i)=>{const row=rows[i];if(row&&blocked.has(String(row.user_id))){el.remove();return}if(!row||el.querySelector(".community-comment-tools"))return;const tools=document.createElement("span");tools.className="community-comment-tools";tools.innerHTML=(String(row.user_id)!==String(uid())?'<button type="button" class="btn btn-small"></button>':'')+'<button type="button" class="btn btn-small"></button>';const bs=tools.querySelectorAll("button");if(bs[0])bs[0].onclick=()=>blockUser(row.user_id);bs[bs.length-1].onclick=()=>reportTarget("comment",row.id);el.appendChild(tools)});
    return r;
  };
}
function boot2(){
  patchFavorites();patchGallery();patchGalleryUpload();patchCommentModeration();
  const initializeVisibleSection=()=>setTimeout(()=>{
    if(q("gallery")?.classList.contains("active"))void injectGalleryAlbums();
    if(admin()&&q("admin")?.classList.contains("active")){
      void injectAdminAlbumTools();
      void ensureGalleryAlbumSelect();
      void injectAdminReports();
    }
  },250);
  if(document.readyState==="complete")initializeVisibleSection();
  else window.addEventListener("load",initializeVisibleSection,{once:true});
}
boot2();
