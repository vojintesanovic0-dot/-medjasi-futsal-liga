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
  if(!uid()) return toastX("Prijavi se da prijaviš sadržaj.","error");
  const reason=prompt("Zašto prijavljuješ ovaj sadržaj?\n\nSpam, uvreda, neprikladan sadržaj, lažno predstavljanje ili drugo.");
  if(!reason?.trim()) return;
  const payload={reporter_id:uid(),reason:reason.trim().slice(0,500)};
  if(kind==="post") payload.post_id=id;
  else payload.comment_id=id;
  const {error}=await client().from("community_reports").insert(payload);
  if(error) return toastX(error.message,"error");
  toastX("Prijava je poslata administratoru.");
}
async function blockUser(id){
  if(!uid()) return toastX("Prijavi se da blokiraš korisnika.","error");
  if(String(id)===String(uid())) return;
  if(!confirm("Blokirati ovog korisnika? Njegove Community objave i komentari više se neće prikazivati tebi.")) return;
  const {error}=await client().from("community_blocks").upsert({user_id:uid(),blocked_user_id:id});
  if(error) return toastX(error.message,"error");
  toastX("Korisnik je blokiran.");
  window.loadV9Community?.();
}
async function unblockUser(id){
  if(!uid()) return;
  const {error}=await client().from("community_blocks").delete().eq("user_id",uid()).eq("blocked_user_id",id);
  if(error) return toastX(error.message,"error");
  toastX("Korisnik više nije blokiran.");
  window.loadV9Community?.();
}
window.communityReport=reportTarget;
window.communityBlock=blockUser;
window.communityUnblock=unblockUser;

async function getBlocked(){
  if(!uid()) return [];
  const {data,error}=await client().from("community_blocks").select("blocked_user_id").eq("user_id",uid());
  if(error){console.warn("Community blocks:",error);return []}
  return (data||[]).map(x=>String(x.blocked_user_id));
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
    window.loadV9Community=async function(){const r=await old.apply(this,arguments);setTimeout(enhanceFeed,0);return r};
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
  const match=q("communityPostMatch")?.value||null,team=q("communityPostTeam")?.value||null,player=q("communityPostPlayer")?.value||null;
  if(match||team||player){
    const {error}=await client().from("community_posts").update({match_id:match,team_id:team,player_id:player}).eq("id",postId).eq("user_id",uid());
    if(error)console.warn("Community links:",error);
  }
  if(q("communityPostPollEnabled")?.checked){
    const question=q("communityPollQuestion")?.value.trim();
    const options=[...(q("communityPollOptions")?.value||"").split("\n")].map(x=>x.trim()).filter(Boolean).slice(0,8);
    if(question&&options.length>=2){
      const {data:p,error}=await client().from("community_polls").insert({post_id:postId,question}).select("id").single();
      if(error||!p){
        if(error)console.warn("Community poll:",error);
        return;
      }

      const optionResult=await client()
        .from("community_poll_options")
        .insert(options.map((label,i)=>({poll_id:p.id,label,sort_order:i})));

      if(optionResult.error){
        console.warn("Community poll options:",optionResult.error);
        await client().from("community_polls").delete().eq("id",p.id).eq("post_id",postId);
        toastX("Anketa nije mogla biti završena.","error");
      }
    }
  }
}
function patchPublish(){
  if(window.__COMMUNITY_PUBLISH_PATCH__)return;
  window.__COMMUNITY_PUBLISH_PATCH__=true;
  const old=window.publishV9Post;if(typeof old!=="function")return;
  window.publishV9Post=async function(){
    const before=Date.now();
    const r=await old.apply(this,arguments);
    /* The original function closes the modal and reloads. Find the newest own post. */
    if(Date.now()-before<120000&&uid()){
      const postId=(typeof r==="string"&&r)||window.__medjasiLastPublishedPostId||null;
      if(postId){
        await publishExtras(postId);
        window.__medjasiLastPublishedPostId=null;
      }
      window.loadV9Community?.();
    }
    return r;
  };
}
async function renderPolls(){
  const feed=q("v9Feed");if(!feed)return;
  const posts=[...feed.querySelectorAll(".v9-post")];
  for(const post of posts){
    const del=post.querySelector(".v9-post-menu");const oc=del?.getAttribute("onclick")||"";const m=oc.match(/deleteV9Post\(['"]([^'"]+)/);if(!m)continue;
    const postId=m[1];
    const {data:p}=await client().from("community_polls").select("id,question").eq("post_id",postId).maybeSingle();if(!p)continue;
    const {data:o}=await client().from("community_poll_options").select("id,label,sort_order").eq("poll_id",p.id).order("sort_order");
    const box=document.createElement("div");box.className="community-poll";box.innerHTML="<strong> "+escX(p.question)+"</strong>"+(o||[]).map(x=>'<button type="button" data-option="'+x.id+'">'+escX(x.label)+'</button>').join("");
    box.querySelectorAll("button").forEach(b=>b.addEventListener("click",async()=>{if(!uid())return toastX("Prijavi se da glasaš.","error");const {error}=await client().from("community_poll_votes").insert({poll_id:p.id,option_id:b.dataset.option,user_id:uid()});if(error?.code==="23505")return toastX("Već si glasao na ovoj anketi.");if(error)return toastX(error.message,"error");toastX("Glas je zabilježen.");}));
    post.querySelector(".v9-post-body")?.appendChild(box);
  }
}
function boot(){
  patchLoad();patchComposer();patchPublish();
  setTimeout(async()=>{await enhanceFeed();await renderPolls()},700);
  window.addEventListener("load",()=>setTimeout(async()=>{patchLoad();patchComposer();patchPublish();await enhanceFeed();await renderPolls()},900));
}
boot();
})();

// Gallery albums + favorites + moderation panel
async function loadAlbums(){const {data,error}=await client().from("gallery_albums").select("id,name,description,cover_url,created_at").order("created_at",{ascending:false});if(error){console.warn("Gallery albums:",error);return []}return data||[]}
async function toggleFavorite(type,id){if(!uid())return toastX("Prijavi se da sačuvaš favorite.","error");const {data}=await client().from("fan_favorites").select("entity_type").eq("user_id",uid()).eq("entity_type",type).eq("entity_id",String(id)).maybeSingle();const r=data?await client().from("fan_favorites").delete().eq("user_id",uid()).eq("entity_type",type).eq("entity_id",String(id)):await client().from("fan_favorites").insert({user_id:uid(),entity_type:type,entity_id:String(id)});if(r.error)return toastX(r.error.message,"error");toastX(data?"Uklonjeno iz favorita.":"Dodano u favorite.");return !data}
window.toggleFavorite=toggleFavorite;
function decorateFavorite(type,id){setTimeout(async()=>{if(!uid())return;const host=q("modalContent");if(!host||host.querySelector(".community-favorite-action"))return;const h=host.querySelector("h2,h3");if(!h)return;const {data}=await client().from("fan_favorites").select("entity_type").eq("user_id",uid()).eq("entity_type",type).eq("entity_id",String(id)).maybeSingle();const b=document.createElement("button");b.type="button";b.className="btn btn-small community-favorite-action";b.textContent=data?"⭐ Ukloni iz favorita":" Dodaj u favorite";b.onclick=async()=>{await toggleFavorite(type,id);b.textContent=(await client().from("fan_favorites").select("entity_type").eq("user_id",uid()).eq("entity_type",type).eq("entity_id",String(id)).maybeSingle()).data?"⭐ Ukloni iz favorita":" Dodaj u favorite"};h.parentElement?.appendChild(b)},60)}
function patchFavorites(){if(window.__FAVORITES_PATCH__)return;window.__FAVORITES_PATCH__=true;const ot=window.openTeam,op=window.openPlayer;if(typeof ot==="function")window.openTeam=function(id){const r=ot.apply(this,arguments);decorateFavorite("team",id);return r};if(typeof op==="function")window.openPlayer=function(id){const r=op.apply(this,arguments);decorateFavorite("player",id);return r}}
async function injectGalleryAlbums(){const albums=await loadAlbums(),host=q("galleryGrid");if(!host)return;let bar=q("communityAlbumBar");if(!bar){bar=document.createElement("div");bar.id="communityAlbumBar";bar.style.marginBottom="12px";host.parentElement?.insertBefore(bar,host)}bar.innerHTML='<label> Album: <select id="communityAlbumFilter"><option value="">Sve fotografije</option>'+albums.map(a=>'<option value="'+a.id+'">'+escX(a.name)+'</option>').join("")+'</select></label>';q("communityAlbumFilter").onchange=()=>{const id=q("communityAlbumFilter").value;host.querySelectorAll(".gallery-item").forEach((el,i)=>{const g=(window.gallery||[])[i];el.hidden=!!id&&String(g?.album_id)!==String(id)})}}
async function ensureGalleryAlbumSelect(){
  if(!admin())return;
  const host=q("adminGalleryList")?.parentElement;if(!host||q("galleryAlbumSelect"))return;
  const albums=await loadAlbums();const wrap=document.createElement("div");wrap.className="form-group";
  wrap.innerHTML='<label> Album (opcionalno)</label><select id="galleryAlbumSelect"><option value="">Bez albuma</option>'+albums.map(a=>'<option value="'+a.id+'">'+escX(a.name)+'</option>').join("")+'</select>';
  const btn=host.querySelector('button[onclick*="adminAddGalleryImage"]');btn?.parentElement?.insertBefore(wrap,btn);
}
function patchGalleryUpload(){
  if(window.__GALLERY_UPLOAD_ALBUM_PATCH__)return;const old=window.adminAddGalleryImage;if(typeof old!=="function")return;
  window.__GALLERY_UPLOAD_ALBUM_PATCH__=true;window.adminAddGalleryImage=async function(){
    const r=await old.apply(this,arguments);if(r!==false&&uid()){
      const album=q("galleryAlbumSelect")?.value||null;
      if(album){
        const galleryId=typeof r==="string"?r:null;
        if(!galleryId)return;

        const {error}=await client()
          .from("gallery")
          .update({album_id:album})
          .eq("id",galleryId)
          .eq("created_by",uid());

        if(error)console.warn("Gallery album:",error);
        else{
          const local=window.gallery?.find(g=>String(g.id)===String(galleryId));
          if(local)local.album_id=album;
        }
      }
    }
    return r;
  };
}
function injectAdminAlbumTools(){if(!admin())return;const host=q("adminGalleryList");if(!host||q("communityAlbumAdmin"))return;const card=document.createElement("div");card.id="communityAlbumAdmin";card.style.marginTop="12px";card.innerHTML='<h4> Albumi galerije</h4><div class="form-group"><input id="newAlbumName" maxlength="120" placeholder="Naziv albuma"></div><div class="form-group"><input id="newAlbumDesc" maxlength="500" placeholder="Opis albuma"></div><button type="button" class="btn btn-blue btn-small" id="createAlbumBtn">＋ Kreiraj album</button><div id="communityAlbumAdminList" class="muted"></div>';host.parentElement?.appendChild(card);q("createAlbumBtn").onclick=async()=>{const name=q("newAlbumName")?.value.trim();if(!name)return toastX("Upiši naziv albuma.","error");const {error}=await client().from("gallery_albums").insert({name,description:q("newAlbumDesc")?.value.trim()||null,created_by:uid()});if(error)return toastX(error.message,"error");toastX("Album je kreiran.");card.remove();injectAdminAlbumTools()};loadAlbums().then(a=>{const x=q("communityAlbumAdminList");if(x)x.textContent=a.map(v=>v.name).join(" • ")||"Još nema albuma."})}
function patchGallery(){if(!window.__GALLERY_ALBUM_PATCH__&&typeof window.renderGallery==="function"){window.__GALLERY_ALBUM_PATCH__=true;const old=window.renderGallery;window.renderGallery=function(){const r=old.apply(this,arguments);setTimeout(injectGalleryAlbums,0);return r}}if(!window.__GALLERY_ADMIN_ALBUM_PATCH__&&typeof window.renderAdminGallery==="function"){window.__GALLERY_ADMIN_ALBUM_PATCH__=true;const old=window.renderAdminGallery;window.renderAdminGallery=function(){const r=old.apply(this,arguments);setTimeout(injectAdminAlbumTools,0);return r}}}
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
function boot2(){patchFavorites();patchGallery();patchGalleryUpload();patchCommentModeration();setTimeout(()=>{injectGalleryAlbums();injectAdminAlbumTools();ensureGalleryAlbumSelect();injectAdminReports()},1200);window.addEventListener("load",()=>setTimeout(()=>{patchFavorites();patchGallery();patchGalleryUpload();patchCommentModeration();injectGalleryAlbums();injectAdminAlbumTools();injectAdminReports()},1500))}
boot2();
