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
      tools.innerHTML=(id!==String(uid())?'<button type="button" class="btn btn-small" data-community-action="block">🚫 Blokiraj</button>':'')+
        '<button type="button" class="btn btn-small" data-community-action="report">⚑ Prijavi</button>';
      tools.querySelector('[data-community-action="block"]')?.addEventListener("click",()=>blockUser(id));
      tools.querySelector('[data-community-action="report"]')?.addEventListener("click",()=>reportTarget("post",post.querySelector(".v9-post-menu")?.getAttribute("onclick")?.match(/deleteV9Post\(['"]([^'"]+)/)?.[1]));
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
      wrap.innerHTML='<div class="form-group"><label>🔗 Poveži objavu sa ligom (opcionalno)</label><select id="communityPostMatch"><option value="">Bez utakmice</option></select></div>'+
        '<div class="form-group"><select id="communityPostTeam"><option value="">Bez ekipe</option></select></div>'+
        '<div class="form-group"><select id="communityPostPlayer"><option value="">Bez igrača</option></select></div>'+
        '<div class="form-group"><label><input id="communityPostPollEnabled" type="checkbox" style="width:auto;margin-right:7px"> 📊 Dodaj anketu</label><input id="communityPollQuestion" maxlength="300" placeholder="Pitanje ankete" disabled><textarea id="communityPollOptions" maxlength="600" rows="3" placeholder="Opcija 1\nOpcija 2\nOpcija 3" disabled></textarea></div>';
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
      if(!error&&p) await client().from("community_poll_options").insert(options.map((label,i)=>({poll_id:p.id,label,sort_order:i})));
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
      const {data}=await client().from("community_posts").select("id").eq("user_id",uid()).order("created_at",{ascending:false}).limit(1);
      if(data?.[0]) await publishExtras(data[0].id);
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
    const box=document.createElement("div");box.className="community-poll";box.innerHTML="<strong>📊 "+escX(p.question)+"</strong>"+(o||[]).map(x=>'<button type="button" data-option="'+x.id+'">'+escX(x.label)+'</button>').join("");
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