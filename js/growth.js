/* Medjaši – growth features */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sb=()=>window.supabaseClient;
const user=()=>typeof currentUser!=="undefined"?currentUser:null;
const MT=()=>typeof matches!=="undefined"?matches:[];
const TM=()=>typeof teams!=="undefined"?teams:[];
const team=id=>TM().find(t=>String(t.id)===String(id));
const tname=id=>team(id)?.name||"Ekipa";
const note=(m,t="success")=>typeof toast==="function"?toast(m,t):alert(m);
let follows=new Set(), sponsors=[], seasons=[];
function standings(){
  const m=new Map(TM().map(t=>[String(t.id),{name:t.name,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,pts:0}]));
  MT().filter(x=>x.status==="finished").forEach(x=>{
    const h=m.get(String(x.home_team_id)),a=m.get(String(x.away_team_id)); if(!h||!a)return;
    const hs=Number(x.home_score||0),as=Number(x.away_score||0);
    h.played++;a.played++;h.gf+=hs;h.ga+=as;a.gf+=as;a.ga+=hs;
    if(hs>as){h.wins++;h.pts+=3;a.losses++;}else if(hs<as){a.wins++;a.pts+=3;h.losses++;}else{h.draws++;a.draws++;h.pts++;a.pts++;}
  });
  return [...m.values()].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
}
function buildICS(list){
  const esc=x=>String(x).replace(/[\\,;\n]/g," ");
  const iso=x=>new Date(x).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  const out=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Medjasi Futsal Liga//EN"];
  list.filter(x=>x.match_date).forEach(m=>{
    const s=new Date(m.match_date),e=new Date(s.getTime()+60*60000);
    out.push("BEGIN:VEVENT","UID:medjasi-"+m.id+"@liga","DTSTAMP:"+iso(new Date()),"DTSTART:"+iso(s),"DTEND:"+iso(e),"SUMMARY:"+esc(tname(m.home_team_id)+" - "+tname(m.away_team_id)),"END:VEVENT");
  });
  out.push("END:VCALENDAR"); return out.join("\r\n");
}
function downloadICS(list){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buildICS(list)],{type:"text/calendar;charset=utf-8"}));
  a.download="medjasi-futsal-liga.ics";a.click();
}
async function load(){
  if(!sb())return;
  const f=user()?await sb().from("fan_team_follows").select("team_id").eq("user_id",user().id):{data:[]};
  const s=await sb().from("sponsors").select("*").eq("active",true).order("sort_order");
  const se=await sb().from("seasons").select("*");
  follows=new Set((f.data||[]).map(x=>String(x.team_id))); sponsors=s.data||[]; seasons=se.data||[];
  renderSponsors();
}
function info(){
  const r=$("gxInfoRoot"); if(!r)return;
  const st=standings(),u=user();
  let html='<div class="gx-grid"><div class="card"><h3> Tabela</h3><table class="gx-table"><thead><tr><th>#</th><th>Ekipa</th><th>U</th><th>Gol</th><th>Bod</th></tr></thead><tbody>';
  st.forEach((x,i)=>{html+="<tr><td>"+(i+1)+"</td><td>"+E(x.name)+"</td><td>"+x.played+"</td><td>"+x.gf+":"+x.ga+"</td><td><b>"+x.pts+"</b></td></tr>";});
  html+='</tbody></table></div><div class="card"><h3> Kalendar</h3><button class="btn btn-green" data-gx="ics-all">Dodaj utakmice u kalendar</button></div></div>';
  html+='<div class="card"><h3> Prati ekipe</h3>';
  html+=u?TM().map(t=>'<div class="gx-follow"><span>'+E(t.name)+'</span><button class="gx-switch '+(follows.has(String(t.id))?"on":"")+'" data-gx="follow" data-id="'+E(t.id)+'"></button></div>').join(""):'<button class="btn btn-green" onclick="showSection(\'login\')">Prijavi se</button>';
  html+='</div><div class="gx-grid"><div class="card"><h3> Pravila lige</h3><ol class="gx-rules"><li>Utakmica traje 2 × 30 minuta.</li><li>Pobjeda 3 boda, neriješeno 1.</li><li>Poredak: bodovi, gol-razlika, golovi.</li></ol></div>';
  html+='<div class="card"><h3> Prijava ekipe</h3>';
  html+=u?'<div class="gx-form"><input id="gxTeam" placeholder="Naziv ekipe"><input id="gxCap" placeholder="Ime kapitena"><input id="gxPhone" placeholder="Broj telefona"><textarea id="gxNote" placeholder="Napomena"></textarea><button class="btn btn-green" data-gx="apply">Pošalji prijavu</button></div>':'<button class="btn btn-green" onclick="showSection(\'login\')">Prijavi se za prijavu ekipe</button>';
  html+='</div></div>';
  if(seasons.length){html+='<div class="card"><h3>️ Sezone</h3>';seasons.forEach(s=>html+='<div class="gx-follow">'+E(s.name||s.title||"Sezona")+'</div>');html+='</div>';}
  r.innerHTML=html;
}
function safeSponsorUrl(value){
  const raw=String(value||"").trim();
  if(!raw)return "";
  try{
    const url=new URL(raw,window.location.origin);
    if(url.protocol!=="http:"&&url.protocol!=="https:")return "";
    return url.href;
  }catch{return ""}
}
function renderSponsors(){
  const h=$("gxSponsors");if(!h)return;h.hidden=!sponsors.length;
  h.innerHTML=sponsors.length
    ? '<h3>Partneri lige</h3><div class="gx-sp-row">'+sponsors.map(s=>{
        const url=safeSponsorUrl(s.link_url);
        const name=E(s.name||"Partner lige");
        return url
          ? '<a href="'+E(url)+'" target="_blank" rel="noopener noreferrer">'+name+'</a>'
          : '<span class="gx-sponsor-name">'+name+'</span>';
      }).join("")+'</div>'
    : "";
}
async function click(e){
  const b=e.target.closest("[data-gx]");if(!b)return;
  const a=b.dataset.gx,id=b.dataset.id;
  if(a==="ics-all")downloadICS(MT().filter(m=>m.status==="scheduled"));
  else if(a==="follow"){
    if(!user())return showSection("login");
    const on=follows.has(id);
    const q=on?sb().from("fan_team_follows").delete().eq("user_id",user().id).eq("team_id",id):sb().from("fan_team_follows").insert({user_id:user().id,team_id:id});
    const z=await q;if(z.error)return note(z.error.message,"error");
    on?follows.delete(id):follows.add(id);b.classList.toggle("on",!on);
  }else if(a==="apply"){
    if(!user())return showSection("login");
    const row={user_id:user().id,team_name:$("gxTeam").value.trim(),captain_name:$("gxCap").value.trim(),phone:$("gxPhone").value.trim(),note:$("gxNote").value.trim()||null};
    if(!row.team_name||!row.captain_name||!row.phone)return note("Popuni obavezna polja.","error");
    const z=await sb().from("team_applications").insert(row);if(z.error)return note(z.error.message,"error");
    note("Prijava je poslana. ");
  }
}
function mount(){
  const main=document.querySelector("main");if(!main)return;
  let sec=$("info");
  if(!sec){
    sec=document.createElement("section");sec.className="section";sec.id="info";
    sec.innerHTML='<h2 class="section-title gx-info-title">Liga info</h2><div id="gxInfoRoot"></div>';
    main.appendChild(sec);
  }else if(!$("gxInfoRoot")){
    const root=document.createElement("div");root.id="gxInfoRoot";sec.appendChild(root);
  }
  const h=$("home");if(h&&!$("gxSponsors")){const s=document.createElement("section");s.id="gxSponsors";s.className="gx-sponsors";h.appendChild(s);}
  if(!window.__MEDJASI_GROWTH_CLICK_BOUND__){window.__MEDJASI_GROWTH_CLICK_BOUND__=true;document.addEventListener("click",click);}
}
function boot(){
  if(!window.showSection||!window.supabaseClient)return setTimeout(boot,250);
  mount();const orig=window.showSection;
  window.showSection=function(id){const r=orig.apply(this,arguments);if(id==="info"){info();load().then(info);}return r;};
  load();
}
window.medjasiGrowth={standings,buildICS};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();