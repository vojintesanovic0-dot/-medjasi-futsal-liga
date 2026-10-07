/* Međasi extras v1
   - svijetla/tamna tema
   - strijelci / asistenti / fair play s filterima
   - .ics kalendar i dijeljenje rezultata kao slika (u prozoru utakmice)
   - klijentski limit slanja poruka i komentara
   - pregled admin loga
   Ne mijenja postojeću logiku; sve se vezuje preko javnih funkcija i događaja. */
(()=>{"use strict";

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const G=name=>{try{return (0,eval)(name)}catch{return undefined}};
const list=name=>{const v=G(name);return Array.isArray(v)?v:[]};

/* ======================= TEMA ======================= */
const THEME_KEY="medjasi_theme";
function applyTheme(t){
  document.documentElement.setAttribute("data-theme",t);
  const m=$("metaThemeColor");if(m)m.setAttribute("content",t==="light"?"#eef3f8":"#07111f");
  const b=$("xtThemeBtn");if(b){b.textContent=t==="light"?"🌙":"☀️";b.setAttribute("aria-label",t==="light"?"Tamna tema":"Svijetla tema");b.title=b.getAttribute("aria-label")}
}
function initTheme(){
  let t="dark";try{t=localStorage.getItem(THEME_KEY)||"dark"}catch{}
  applyTheme(t);
  const host=document.querySelector(".header-actions");
  if(host&&!$("xtThemeBtn")){
    const b=document.createElement("button");
    b.id="xtThemeBtn";b.type="button";b.className="xt-theme-btn";
    b.onclick=()=>{const n=document.documentElement.getAttribute("data-theme")==="light"?"dark":"light";try{localStorage.setItem(THEME_KEY,n)}catch{}applyTheme(n)};
    host.prepend(b);applyTheme(t);
  }
}

/* ======================= LIMIT SLANJA (klijent) ======================= */
const LIMITS={messages:{gap:2500,max:8},comments:{gap:4000,max:5}};
const sent={messages:[],comments:[]};
const lastText={messages:new Map(),comments:new Map()};
function checkLimit(table,row){
  const L=LIMITS[table];if(!L)return null;
  const now=Date.now();
  sent[table]=sent[table].filter(t=>now-t<60000);
  const arr=sent[table];
  if(arr.length&&now-arr[arr.length-1]<L.gap)return "Prebrzo šalješ. Pričekaj nekoliko sekundi.";
  if(arr.length>=L.max)return "Previše poruka u kratkom roku. Pokušaj za minut.";
  const r=Array.isArray(row)?row[0]:row;
  const txt=String(r?.content||"").trim().toLowerCase();
  if(txt){
    const prev=lastText[table].get(txt);
    if(prev&&now-prev<60000)return "Ista poruka je već poslana. Pričekaj prije ponovnog slanja.";
    lastText[table].set(txt,now);
    if(lastText[table].size>50){for(const [k,v] of lastText[table])if(now-v>60000)lastText[table].delete(k)}
  }
  arr.push(now);return null;
}
function failedBuilder(message){
  const res={data:null,error:{message,code:"RATE_LIMIT"}};
  const b={select(){return b},single(){return b},maybeSingle(){return b},
    then:(ok,no)=>Promise.resolve(res).then(ok,no),catch:no=>Promise.resolve(res).catch(no)};
  return b;
}
function installRateLimit(){
  const c=window.supabaseClient;if(!c||c.__xtRL)return;
  const orig=c.from.bind(c);
  c.from=function(table){
    const b=orig(table);
    if(LIMITS[table]&&typeof b.insert==="function"){
      const oi=b.insert.bind(b);
      b.insert=function(row,...rest){
        const err=checkLimit(table,row);
        return err?failedBuilder(err):oi(row,...rest);
      };
    }
    return b;
  };
  c.__xtRL=true;
}

/* ======================= STATISTIKA+ ======================= */
const st={tab:"scorers",round:"",team:""};
function isOwn(g){return !!(g.own_goal||g.is_own_goal||g.is_own||String(g.type||g.goal_type||"").toLowerCase().replace(/[\s-]/g,"_")==="own_goal")}
function playerById(id){return list("players").find(p=>String(p.id)===String(id))}
function teamById(id){return list("teams").find(t=>String(t.id)===String(id))}
function matchesInRound(round){
  const ms=list("matches");
  return new Set(ms.filter(m=>!round||String(m.round)===String(round)).map(m=>String(m.id)));
}
function computeTop(kind){
  const ok=matchesInRound(st.round);const map=new Map();
  for(const g of list("goals")){
    if(!ok.has(String(g.match_id)))continue;
    const pid=kind==="assists"?g.assist_player_id:g.player_id;
    if(pid==null||pid==="")continue;
    if(kind==="scorers"&&isOwn(g))continue;
    map.set(String(pid),(map.get(String(pid))||0)+1);
  }
  let rows=[...map].map(([pid,n])=>{const p=playerById(pid);return{p,n}}).filter(r=>r.p);
  if(st.team)rows=rows.filter(r=>String(r.p.team_id)===String(st.team));
  rows.sort((a,b)=>b.n-a.n||String(a.p.name).localeCompare(String(b.p.name)));
  return rows.slice(0,20);
}
function computeFair(){
  const ok=matchesInRound(st.round);const byTeam=new Map(),byPlayer=new Map();
  const bump=(m,k,red)=>{const o=m.get(k)||{y:0,r:0};red?o.r++:o.y++;m.set(k,o)};
  for(const c of list("cards")){
    if(!ok.has(String(c.match_id)))continue;
    const red=String(c.card_type).toLowerCase()==="red";
    const p=playerById(c.player_id);if(!p)continue;
    if(st.team&&String(p.team_id)!==String(st.team))continue;
    bump(byTeam,String(p.team_id),red);bump(byPlayer,String(p.id),red);
  }
  const score=o=>o.y+3*o.r;
  const teams=list("teams").filter(t=>!st.team||String(t.id)===String(st.team)).map(t=>({t,o:byTeam.get(String(t.id))||{y:0,r:0}}));
  teams.sort((a,b)=>score(a.o)-score(b.o)||String(a.t.name).localeCompare(String(b.t.name)));
  const players=[...byPlayer].map(([id,o])=>({p:playerById(id),o})).filter(x=>x.p).sort((a,b)=>score(b.o)-score(a.o)).slice(0,10);
  return{teams,players,score};
}
function renderStatsPlus(){
  const sec=$("stats");if(!sec)return;
  let card=$("xtStatsPlus");
  if(!card){
    card=document.createElement("div");card.id="xtStatsPlus";card.className="card xt-card";sec.appendChild(card);
    card.addEventListener("click",e=>{const b=e.target.closest("[data-xt-tab]");if(b){st.tab=b.dataset.xtTab;renderStatsPlus()}});
    card.addEventListener("change",e=>{
      if(e.target.id==="xtRound")st.round=e.target.value;
      if(e.target.id==="xtTeam")st.team=e.target.value;
      renderStatsPlus();
    });
  }
  const rounds=[...new Set(list("matches").map(m=>m.round).filter(r=>r!=null&&r!==""))].sort((a,b)=>Number(a)-Number(b)||String(a).localeCompare(String(b)));
  const teams=[...list("teams")].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const tabBtn=(k,l)=>'<button type="button" class="xt-tab'+(st.tab===k?" active":"")+'" data-xt-tab="'+k+'">'+l+"</button>";
  let body="";
  if(st.tab==="fair"){
    const f=computeFair();
    body='<div class="table-wrap"><table class="xt-table"><thead><tr><th>#</th><th>Ekipa</th><th>🟨</th><th>🟥</th><th>Bodovi</th></tr></thead><tbody>'+
      (f.teams.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.t.name)+'</td><td>'+r.o.y+'</td><td>'+r.o.r+'</td><td><b>'+f.score(r.o)+'</b></td></tr>').join("")||'<tr><td colspan="5">Nema podataka.</td></tr>')+
      '</tbody></table></div><p class="muted xt-note">Fair play bodovi: žuti = 1, crveni = 3. Manje je bolje.</p>'+
      (f.players.length?'<h4 class="xt-sub">Najviše kartona (igrači)</h4><div class="table-wrap"><table class="xt-table"><tbody>'+f.players.map(r=>'<tr><td>'+esc(r.p.name)+'</td><td>'+esc(teamById(r.p.team_id)?.name||"")+'</td><td>🟨 '+r.o.y+'</td><td>🟥 '+r.o.r+'</td></tr>').join("")+'</tbody></table></div>':"");
  }else{
    const rows=computeTop(st.tab);
    body='<div class="table-wrap"><table class="xt-table"><thead><tr><th>#</th><th>Igrač</th><th>Ekipa</th><th>'+ (st.tab==="assists"?"Asist.":"Golovi")+'</th></tr></thead><tbody>'+
      (rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.p.name)+'</td><td>'+esc(teamById(r.p.team_id)?.name||"")+'</td><td><b>'+r.n+'</b></td></tr>').join("")||'<tr><td colspan="4">Nema podataka za izabrani filter.</td></tr>')+
      '</tbody></table></div>';
  }
  const keepFocus=document.activeElement&&document.activeElement.id;
  card.innerHTML='<h3>Strijelci, asistenti i fair play</h3>'+
  '<div class="xt-filters"><select id="xtRound" aria-label="Kolo"><option value="">Sva kola</option>'+
    rounds.map(r=>'<option value="'+esc(r)+'"'+(String(r)===String(st.round)?" selected":"")+'>'+esc(r)+'. kolo</option>').join("")+
  '</select><select id="xtTeam" aria-label="Ekipa"><option value="">Sve ekipe</option>'+
    teams.map(t=>'<option value="'+esc(t.id)+'"'+(String(t.id)===String(st.team)?" selected":"")+'>'+esc(t.name)+'</option>').join("")+
  '</select></div><div class="xt-tabs">'+tabBtn("scorers","⚽ Strijelci")+tabBtn("assists","🎯 Asistenti")+tabBtn("fair","🟨 Fair play")+'</div>'+body;
  if(keepFocus)$(keepFocus)?.focus?.();
}

/* ======================= KALENDAR + SLIKA REZULTATA ======================= */
function icsEscape(s){return String(s??"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n")}
function icsDate(d){return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")}
function fold(line){const out=[];while(line.length>73){out.push(line.slice(0,73));line=" "+line.slice(73)}out.push(line);return out.join("\r\n")}
function buildICS(m){
  const start=new Date(m.match_date);if(isNaN(start))return null;
  const end=new Date(start.getTime()+70*60000);
  const h=teamById(m.home_team_id)?.name||"Domaćin",a=teamById(m.away_team_id)?.name||"Gost";
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Medjasi Futsal Liga//BS","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
    "UID:match-"+m.id+"@medjasi-futsal","DTSTAMP:"+icsDate(new Date()),"DTSTART:"+icsDate(start),"DTEND:"+icsDate(end),
    "SUMMARY:"+icsEscape(h+" vs "+a),"DESCRIPTION:"+icsEscape("Međasi Futsal Liga"+(m.round?" – "+m.round+". kolo":"")),
    "BEGIN:VALARM","TRIGGER:-PT1H","ACTION:DISPLAY","DESCRIPTION:Utakmica počinje za sat vremena","END:VALARM","END:VEVENT","END:VCALENDAR"];
  return lines.map(fold).join("\r\n")+"\r\n";
}
function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function downloadICS(id){
  const m=list("matches").find(x=>String(x.id)===String(id));if(!m)return;
  const ics=buildICS(m);if(!ics){alert("Utakmica nema ispravan datum.");return}
  download(new Blob([ics],{type:"text/calendar;charset=utf-8"}),"utakmica-"+m.id+".ics");
}
function wrapText(ctx,text,maxW){
  const words=String(text).split(/\s+/),lines=[];let cur="";
  for(const w of words){const t=cur?cur+" "+w:w;if(ctx.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t}
  if(cur)lines.push(cur);return lines.slice(0,3);
}
async function shareResult(id){
  const m=list("matches").find(x=>String(x.id)===String(id));if(!m)return;
  const h=teamById(m.home_team_id)?.name||"Domaćin",a=teamById(m.away_team_id)?.name||"Gost";
  const S=1080,cv=document.createElement("canvas");cv.width=cv.height=S;const c=cv.getContext("2d");
  const g=c.createLinearGradient(0,0,S,S);g.addColorStop(0,"#06101b");g.addColorStop(1,"#0e3b2a");c.fillStyle=g;c.fillRect(0,0,S,S);
  c.fillStyle="rgba(32,212,123,.12)";c.beginPath();c.arc(S-120,140,260,0,7);c.fill();
  c.textAlign="center";c.fillStyle="#20d47b";c.font="700 40px Arial, sans-serif";c.fillText("MEĐASI FUTSAL LIGA",S/2,120);
  c.fillStyle="#91a4b7";c.font="500 32px Arial, sans-serif";
  const status=m.status==="live"?"UŽIVO":m.status==="finished"?"KRAJ":"USKORO";c.fillText((m.round?m.round+". kolo • ":"")+status,S/2,175);
  c.fillStyle="#f4f8fb";c.font="800 56px Arial, sans-serif";
  const hy=380,ay=720;
  wrapText(c,h,860).forEach((l,i,arr)=>c.fillText(l,S/2,hy+(i-(arr.length-1)/2)*64));
  wrapText(c,a,860).forEach((l,i,arr)=>c.fillText(l,S/2,ay+(i-(arr.length-1)/2)*64));
  const hasScore=m.status==="live"||m.status==="finished";
  c.fillStyle="#20d47b";c.font="900 190px Arial, sans-serif";c.fillText(hasScore?((m.home_score??0)+" : "+(m.away_score??0)):"VS",S/2,610);
  const d=new Date(m.match_date);
  if(!isNaN(d)){c.fillStyle="#91a4b7";c.font="500 34px Arial, sans-serif";c.fillText(d.toLocaleString("bs-BA",{dateStyle:"long",timeStyle:"short"}),S/2,960)}
  c.fillStyle="#52667a";c.font="500 28px Arial, sans-serif";c.fillText(location.host||"medjasi futsal",S/2,1030);
  const blob=await new Promise(r=>cv.toBlob(r,"image/png"));if(!blob)return;
  const file=new File([blob],"rezultat-"+m.id+".png",{type:"image/png"});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:h+" vs "+a,text:hasScore?h+" "+(m.home_score??0)+":"+(m.away_score??0)+" "+a:h+" vs "+a});return}}catch(e){if(e&&e.name==="AbortError")return}
  download(blob,file.name);
}
function injectMatchActions(){
  const host=$("modalContent");if(!host)return;
  const sb=host.querySelector(".live-scoreboard");if(!sb||host.querySelector(".xt-match-actions"))return;
  const id=G("currentMatchId");if(id==null||!list("matches").some(m=>String(m.id)===String(id)))return;
  const el=document.createElement("div");el.className="xt-match-actions";
  el.innerHTML='<button type="button" class="btn btn-small" data-xt="ics">📅 Dodaj u kalendar</button><button type="button" class="btn btn-small" data-xt="share">📤 Podijeli rezultat</button>';
  el.addEventListener("click",e=>{const b=e.target.closest("[data-xt]");if(!b)return;if(b.dataset.xt==="ics")downloadICS(id);else shareResult(id)});
  sb.after(el);
}

/* ======================= ADMIN LOG ======================= */
function renderAudit(){
  const sec=$("admin");if(!sec)return;
  const admin=typeof window.isAdmin==="function"&&window.isAdmin();let card=$("xtAudit");
  if(!admin){card?.remove();return}if(card)return;
  card=document.createElement("div");card.id="xtAudit";card.className="card xt-card";
  card.innerHTML='<h3>Admin log izmjena</h3><p class="muted xt-note">Posljednjih 50 izmjena (utakmice, golovi, kartoni, ekipe, igrači, vijesti, galerija).</p><button type="button" class="btn btn-small" id="xtAuditLoad">Učitaj log</button><div id="xtAuditBody"></div>';
  sec.appendChild(card);$("xtAuditLoad").onclick=loadAudit;
}
async function loadAudit(){
  const body=$("xtAuditBody");if(!body)return;
  body.innerHTML='<p class="muted">Učitavanje…</p>';
  const {data,error}=await window.supabaseClient.from("admin_audit_log").select("*").order("created_at",{ascending:false}).limit(50);
  if(error){body.innerHTML='<p class="muted">Log nije dostupan ('+esc(error.message)+'). Pokreni sql/05_rate_limit_and_audit.sql.</p>';return}
  const diff=r=>{if(r.op!=="UPDATE"||!r.old_data||!r.new_data)return "";return Object.keys(r.new_data).filter(k=>JSON.stringify(r.new_data[k])!==JSON.stringify(r.old_data[k])&&k!=="updated_at").slice(0,6).join(", ")};
  body.innerHTML='<div class="table-wrap"><table class="xt-table"><thead><tr><th>Vrijeme</th><th>Tabela</th><th>Akcija</th><th>ID</th><th>Promjena</th><th>Admin</th></tr></thead><tbody>'+
    ((data||[]).map(r=>'<tr><td>'+esc(new Date(r.created_at).toLocaleString("bs-BA"))+'</td><td>'+esc(r.table_name)+'</td><td>'+esc(r.op)+'</td><td>'+esc(r.row_id||"")+'</td><td>'+esc(diff(r))+'</td><td>'+esc(String(r.actor||"").slice(0,8))+'</td></tr>').join("")||'<tr><td colspan="6">Log je prazan.</td></tr>')+
    '</tbody></table></div>';
}

/* ======================= POVEZIVANJE ======================= */
function afterRender(){
  try{renderStatsPlus()}catch(e){console.warn("extras stats",e)}
  try{renderAudit()}catch(e){console.warn("extras audit",e)}
}
function hook(){
  if(typeof window.loadAll==="function"&&!window.loadAll.__xt){
    const o=window.loadAll;
    const w=async function(...a){const r=await o.apply(this,a);afterRender();return r};
    w.__xt=true;window.loadAll=w;
  }
  if(typeof window.showSection==="function"&&!window.showSection.__xt){
    const o=window.showSection;
    const w=function(...a){const r=o.apply(this,a);setTimeout(afterRender,0);return r};
    w.__xt=true;window.showSection=w;
  }
  const mc=$("modalContent");
  if(mc&&!mc.__xtObs){mc.__xtObs=new MutationObserver(injectMatchActions);mc.__xtObs.observe(mc,{childList:true})}
}
function init(){initTheme();installRateLimit();hook();afterRender()}
window.medjasiExtras={downloadICS,shareResult,buildICS,computeTop,computeFair,checkLimit,state:st};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
