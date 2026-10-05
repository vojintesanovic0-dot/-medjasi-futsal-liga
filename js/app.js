
/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
"https://mesryrrjnsnhadoahbux.supabase.co";

const SUPABASE_KEY =
"sb_publishable_MVCdydxN-3CMuHpp8a5Nqg_aw5ZPDjH";



const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let currentProfile = null;

let teams = [];
let players = [];
let matches = [];
let goals = [];
let cards = [];
let comments = [];
let messages = [];
let gallery = [];
let matchPlayers = [];

let currentMatchId = null;
let liveRefreshInterval = null;
let realtimeChannel = null;
let musicInitialized = false;
let selectedCommentImage = null;
let mobileMenuOpen = false;

let musicSettings={youtube_music_enabled:false};
let musicTracks=[];
let currentMusicSignature="";
let musicUserStarted=false;


/* =========================================================
   HELPERS
========================================================= */

function esc(value){

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}


function getTeam(id){
  return teams.find(t => String(t.id) === String(id));
}


function getPlayer(id){
  return players.find(p => String(p.id) === String(id));
}


function getMatch(id){
  return matches.find(m => String(m.id) === String(id));
}


function teamName(id){
  return getTeam(id)?.name || "Nepoznata ekipa";
}


function playerName(id){
  return getPlayer(id)?.name || "Nepoznati igrač";
}


function formatDate(date){

  if(!date) return "-";

  const d = new Date(date);

  if(Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("bs-BA",{
    day:"2-digit",
    month:"2-digit",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}


function isAdmin(){
  return currentProfile?.role === "admin";
}

function isModerator(){
  return currentProfile?.role === "moderator";
}

function canManageMatch(){
  return isAdmin() || isModerator();
}



function teamLogo(team){

  return team?.logo_url ||
    "https://via.placeholder.com/100?text=%E2%9A%BD";
}


function playerPhoto(player){

  return player?.photo_url ||
    "https://via.placeholder.com/100?text=%F0%9F%91%A4";
}


/* =========================================================
   NAVIGATION
========================================================= */

function showSection(id){

  if(id === "admin" && !isAdmin()){
    if(typeof toast === "function") toast("Admin panel je dostupan samo administratoru.","error");
    id = "home";
  }

  document.querySelectorAll(".section")
    .forEach(section =>
      section.classList.remove("active")
    );

  const section =
    document.getElementById(id);

  if(section){
    section.classList.add("active");
  }


  /* DESKTOP / SIDEBAR NAV */

  document.querySelectorAll("#mainNav button")
    .forEach(button =>
      button.classList.remove("active")
    );

  const navButton =
    [...document.querySelectorAll("#mainNav button")]
      .find(button =>
        button.getAttribute("onclick")?.includes(
          `showSection('${id}')`
        )
      );

  navButton?.classList.add("active");

  if(id === "admin" && isAdmin()){
    try{
      renderAdminMatches();
      renderAdminGallery();
      renderAdminNews?.();
      renderMusicAdmin?.();
      fillTeamSelects();
      injectModeratorPanel?.();
    }catch(error){
      console.error("Admin dashboard:",error);
    }
  }

  if(id === "community"){
    setTimeout(()=>window.loadV9Community?.(),30);
  }

  /* MOBILE BOTTOM NAV */

  document.querySelectorAll(".mobile-bottom button")
    .forEach(button =>
      button.classList.remove("active")
    );

  const mobileButton =
    [...document.querySelectorAll(".mobile-bottom button")]
      .find(button =>
        button.getAttribute("onclick")?.includes(
          `showSection('${id}')`
        )
      );

  mobileButton?.classList.add("active");


  /* Ako je otvoren "Više", zatvori ga */

  if(typeof closeMobileMore === "function"){
    closeMobileMore();
  }


  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}


/* =========================================================
   MODAL
========================================================= */

function showModal(html){

  const modal =
    document.getElementById("modal");

  const content =
    document.getElementById("modalContent");

  content.innerHTML = html;

  modal.classList.add("active");
}


function hideModal(){

  document
    .getElementById("modal")
    ?.classList.remove("active");
}


function closeModal(event){

  if(event.target.id === "modal"){
    hideModal();
  }
}



/* =========================================================
   OBAVJEŠTENJA LIGE
   - čuvaju se lokalno po uređaju
   - koriste postojeći Realtime + 30s refresh
   - Browser Notification se aktivira samo nakon korisničke akcije
   - pravi push kada je aplikacija potpuno zatvorena zahtijeva Web Push backend
========================================================= */

const NOTIFICATION_STORE_KEY = "medjasi_league_notifications_v1";
const NOTIFICATION_SNAPSHOT_KEY = "medjasi_league_notification_snapshot_v1";
const NOTIFICATION_MAX = 60;

let leagueNotifications = [];
let notificationSnapshotReady = false;

function readLeagueNotifications(){
  try{
    const raw = localStorage.getItem(NOTIFICATION_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    leagueNotifications = Array.isArray(parsed) ? parsed : [];
  }catch(error){
    console.warn("Obavještenja nisu mogla biti učitana:", error);
    leagueNotifications = [];
  }
}

function saveLeagueNotifications(){
  try{
    leagueNotifications = leagueNotifications.slice(0, NOTIFICATION_MAX);
    localStorage.setItem(
      NOTIFICATION_STORE_KEY,
      JSON.stringify(leagueNotifications)
    );
  }catch(error){
    console.warn("Obavještenja nisu mogla biti sačuvana:", error);
  }
}

function notificationTime(value){
  try{
    return formatDate(value);
  }catch(error){
    return new Date(value || Date.now()).toLocaleString("bs-BA");
  }
}

function addLeagueNotification({
  title,
  text="",
  icon="🔔",
  type="info",
  key="",
  browser=true
}){
  if(key && leagueNotifications.some(n => n.key === key)){
    return;
  }

  const item = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    title: String(title || "Obavještenje"),
    text: String(text || ""),
    icon,
    type,
    key,
    created_at: new Date().toISOString(),
    read: false
  };

  leagueNotifications.unshift(item);
  saveLeagueNotifications();
  updateNotificationBadge();
  renderNotificationsIfOpen();

  if(browser){
    sendBrowserNotification(item.title, {
      body:item.text,
      tag:item.key || item.id
    });
  }
}

function updateNotificationBadge(){
  const badge = document.getElementById("notificationBadge");
  if(!badge) return;

  const unread = leagueNotifications.filter(n => !n.read).length;

  badge.textContent = unread > 99 ? "99+" : String(unread);
  badge.hidden = unread === 0;
}

function markAllNotificationsRead(){
  leagueNotifications.forEach(n => n.read = true);
  saveLeagueNotifications();
  updateNotificationBadge();
  renderNotificationsIfOpen();
}

function clearLeagueNotifications(){
  leagueNotifications = [];
  saveLeagueNotifications();
  updateNotificationBadge();
  renderNotificationsIfOpen();
}

function notificationPermissionText(){
  if(!("Notification" in window)){
    return "Ovaj browser ne podržava browser obavještenja.";
  }

  if(Notification.permission === "granted"){
    return "Browser obavještenja su uključena na ovom uređaju.";
  }

  if(Notification.permission === "denied"){
    return "Browser obavještenja su blokirana. Dozvolu možeš promijeniti u postavkama browsera.";
  }

  return "Browser obavještenja nisu još uključena.";
}

async function enableLeagueNotifications(){
  if(!("Notification" in window)){
    toast("Ovaj browser ne podržava obavještenja.","error");
    return;
  }

  try{
    const permission = await Notification.requestPermission();

    if(permission === "granted"){
      toast("Obavještenja su uključena.");
      renderNotificationsIfOpen();
      updateNotificationBadge();
    }else if(permission === "denied"){
      toast("Obavještenja su blokirana u browseru.","error");
      renderNotificationsIfOpen();
    }else{
      toast("Obavještenja nisu uključena.");
    }
  }catch(error){
    console.error("Notification permission:",error);
    toast("Nije moguće uključiti browser obavještenja.","error");
  }
}

function sendBrowserNotification(title, options={}){
  if(
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ){
    return;
  }

  /*
    Ako je stranica trenutno otvorena, Notification API može
    prikazati sistemsko obavještenje. Ako je aplikacija potpuno
    ugašena, za to je potreban Web Push + backend.
  */
  try{
    new Notification(title,{
      icon:"./images/icon-192.png",
      badge:"./images/icon-192.png",
      body:options.body || "",
      tag:options.tag || "medjasi-liga",
      renotify:true
    });
  }catch(error){
    console.warn("Browser notification:",error);
  }
}

function notificationTeamNames(match){
  return {
    home:teamName(match?.home_team_id) || "Domaćin",
    away:teamName(match?.away_team_id) || "Gost"
  };
}

function notificationMatchLabel(match){
  const names = notificationTeamNames(match);
  return `${names.home} – ${names.away}`;
}

function notificationMatchScore(match){
  return `${Number(match?.home_score || 0)}:${Number(match?.away_score || 0)}`;
}

function processLeagueNotifications(){
  if(!Array.isArray(matches)) return;

  readLeagueNotifications();

  let previous = null;

  try{
    const raw = localStorage.getItem(NOTIFICATION_SNAPSHOT_KEY);
    previous = raw ? JSON.parse(raw) : null;
  }catch(error){
    previous = null;
  }

  const currentSnapshot = {
    matches:matches.map(m => ({
      id:String(m.id),
      status:m.status || "scheduled",
      home_score:Number(m.home_score || 0),
      away_score:Number(m.away_score || 0),
      match_date:m.match_date || null
    })),
    goals:goals.map(g => ({
      id:String(g.id),
      match_id:String(g.match_id),
      player_id:String(g.player_id),
      minute:Number(g.minute || 0)
    })),
    cards:cards.map(c => ({
      id:String(c.id),
      match_id:String(c.match_id),
      player_id:String(c.player_id),
      card_type:c.card_type || "yellow",
      minute:Number(c.minute || 0)
    })),
    messages:messages.map(m => ({
      id:String(m.id),
      content:String(m.content || ""),
      created_at:m.created_at || null
    }))
  };

  /*
    Prvo učitavanje samo postavlja osnovu.
    Ne šaljemo čovjeku 15 starih obavještenja čim prvi put otvori sajt.
  */
  if(!previous){
    try{
      localStorage.setItem(
        NOTIFICATION_SNAPSHOT_KEY,
        JSON.stringify(currentSnapshot)
      );
    }catch(error){}

    notificationSnapshotReady = true;
    updateNotificationBadge();
    return;
  }

  const previousMatches = new Map(
    (previous.matches || []).map(m => [String(m.id),m])
  );

  const previousGoals = new Set(
    (previous.goals || []).map(g => String(g.id))
  );

  const previousCards = new Set(
    (previous.cards || []).map(c => String(c.id))
  );

  const previousMessages = new Set(
    (previous.messages || []).map(m => String(m.id))
  );

  const newGoalMatchIds = new Set();

  /* ---------------- GOL ---------------- */
  currentSnapshot.goals.forEach(g => {
    if(previousGoals.has(String(g.id))) return;

    newGoalMatchIds.add(String(g.match_id));

    const match = matches.find(
      m => String(m.id) === String(g.match_id)
    );

    if(!match) return;

    const player = getPlayer(g.player_id);
    const playerName = player?.name || "Igrač";
    const team = player ? teamName(player.team_id) : "";

    addLeagueNotification({
      title:`⚽ Gol – ${notificationMatchLabel(match)}`,
      text:`${playerName}${team ? ` (${team})` : ""} • ${g.minute || 0}' • rezultat ${notificationMatchScore(match)}`,
      icon:"⚽",
      type:"goal",
      key:`goal:${g.id}`
    });
  });

  /* ---------------- KARTON ---------------- */
  currentSnapshot.cards.forEach(c => {
    if(previousCards.has(String(c.id))) return;

    const match = matches.find(
      m => String(m.id) === String(c.match_id)
    );

    if(!match) return;

    const player = getPlayer(c.player_id);
    const playerName = player?.name || "Igrač";
    const isRed = String(c.card_type).toLowerCase() === "red";

    addLeagueNotification({
      title:`${isRed ? "🟥 Crveni" : "🟨 Žuti"} karton – ${notificationMatchLabel(match)}`,
      text:`${playerName} • ${c.minute || 0}'`,
      icon:isRed ? "🟥" : "🟨",
      type:isRed ? "red-card" : "yellow-card",
      key:`card:${c.id}`
    });
  });

  /* ---------------- STATUS / REZULTAT ---------------- */
  currentSnapshot.matches.forEach(current => {
    const old = previousMatches.get(String(current.id));
    const match = matches.find(
      m => String(m.id) === String(current.id)
    );

    if(!match || !old) return;

    if(
      old.status !== "live" &&
      current.status === "live"
    ){
      addLeagueNotification({
        title:`🔴 Počela utakmica`,
        text:`${notificationMatchLabel(match)} je sada uživo.`,
        icon:"🔴",
        type:"live",
        key:`live:${match.id}:${current.status}`
      });
    }

    if(
      old.status !== "finished" &&
      current.status === "finished"
    ){
      addLeagueNotification({
        title:`🏁 Završena utakmica`,
        text:`${notificationMatchLabel(match)} • rezultat ${notificationMatchScore(match)}`,
        icon:"🏁",
        type:"finished",
        key:`finished:${match.id}`
      });
    }

    const scoreChanged =
      old.home_score !== current.home_score ||
      old.away_score !== current.away_score;

    if(
      scoreChanged &&
      !newGoalMatchIds.has(String(match.id))
    ){
      addLeagueNotification({
        title:`📊 Promjena rezultata`,
        text:`${notificationMatchLabel(match)} • ${notificationMatchScore(match)}`,
        icon:"📊",
        type:"score",
        key:`score:${match.id}:${current.home_score}:${current.away_score}`
      });
    }
  });

  /* ---------------- VAŽNA NAJAVA U CHATU ---------------- */
  currentSnapshot.messages.forEach(message => {
    if(previousMessages.has(String(message.id))) return;

    const content = message.content.trim();

    if(!content.startsWith("📣")) return;

    const clean = content.replace(/^📣\s*/,"").trim();

    addLeagueNotification({
      title:"📣 Nova najava lige",
      text:clean,
      icon:"📣",
      type:"announcement",
      key:`announcement:${message.id}`
    });
  });

  /* ---------------- UTAKMICA USKORO ---------------- */
  const now = Date.now();
  const reminderWindow = 15 * 60 * 1000;

  matches
    .filter(m => m.status === "scheduled" && m.match_date)
    .forEach(match => {
      const start = new Date(match.match_date).getTime();
      const diff = start - now;

      if(diff > 0 && diff <= reminderWindow){
        const reminderKey = `reminder:${match.id}`;

        let alreadyReminded = false;

        try{
          alreadyReminded =
            localStorage.getItem(reminderKey) === "1";
        }catch(error){}

        if(!alreadyReminded){
          addLeagueNotification({
            title:"⏰ Utakmica uskoro počinje",
            text:`${notificationMatchLabel(match)} počinje za manje od 15 minuta.`,
            icon:"⏰",
            type:"reminder",
            key:reminderKey
          });

          try{
            localStorage.setItem(reminderKey,"1");
          }catch(error){}
        }
      }
    });

  try{
    localStorage.setItem(
      NOTIFICATION_SNAPSHOT_KEY,
      JSON.stringify(currentSnapshot)
    );
  }catch(error){
    console.warn("Snapshot obavještenja nije sačuvan:",error);
  }

  notificationSnapshotReady = true;
  updateNotificationBadge();
}

function renderNotifications(){
  readLeagueNotifications();

  const unread =
    leagueNotifications.filter(n => !n.read).length;

  const list = leagueNotifications.length
    ? leagueNotifications.map(n => `
        <button
          type="button"
          class="notification-item ${n.read ? "" : "unread"}"
          onclick="readSingleNotification('${esc(n.id)}')"
          style="text-align:left;color:inherit;width:100%;cursor:pointer">
          <span class="notification-icon">${n.icon || "🔔"}</span>
          <span>
            <span class="notification-title">${esc(n.title)}</span>
            ${n.text ? `<span class="notification-text">${esc(n.text)}</span>` : ""}
          </span>
          <span class="notification-time">${esc(notificationTime(n.created_at))}</span>
        </button>
      `).join("")
    : `<div class="notification-empty">Nema novih obavještenja.</div>`;

  return `
    <div class="notification-modal-head">
      <div>
        <h2 style="margin:0">🔔 Obavještenja</h2>
        <div class="muted" style="margin-top:4px">
          ${unread ? `${unread} nepročitano` : "Sve je pročitano"}
        </div>
      </div>
      <button class="btn btn-small" type="button" onclick="markAllNotificationsRead()">
        ✓ Pročitaj sve
      </button>
    </div>

    <div class="notification-list">
      ${list}
    </div>

    <div class="notification-settings">
      <div class="notification-status">
        ${esc(notificationPermissionText())}
      </div>

      ${
        ("Notification" in window && Notification.permission !== "granted")
          ? `<button class="btn btn-green btn-small notification-setting-btn" type="button" onclick="enableLeagueNotifications()">🔔 Uključi obavještenja</button>`
          : ""
      }

      <button class="btn btn-small notification-setting-btn" type="button" onclick="clearLeagueNotifications()">
        🗑️ Obriši
      </button>
    </div>
  `;
}

function openNotifications(){
  renderNotificationsIfOpen(true);
}

function renderNotificationsIfOpen(open=false){
  if(open){
    showModal(renderNotifications());
    return;
  }

  const content = document.getElementById("modalContent");
  if(!content) return;

  /*
    Ne diramo otvorene druge modale. Obavještenja se osvježavaju
    samo ako je trenutno otvoren njihov sadržaj.
  */
  if(content.querySelector(".notification-list")){
    content.innerHTML = renderNotifications();
  }
}

function readSingleNotification(id){
  const item = leagueNotifications.find(
    n => String(n.id) === String(id)
  );

  if(!item) return;

  item.read = true;
  saveLeagueNotifications();
  updateNotificationBadge();
  renderNotificationsIfOpen(true);
}

readLeagueNotifications();
updateNotificationBadge();

/* =========================================================
   TOAST
========================================================= */

function toast(message,type="success"){

  const wrap =
    document.getElementById("toastWrap");

  if(!wrap) return;

  const el =
    document.createElement("div");

  el.className =
    `toast ${type === "error" ? "error" : ""}`;

  el.textContent = String(message);

  wrap.appendChild(el);

  setTimeout(()=>{
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";

    setTimeout(()=>{
      el.remove();
    },220);

  },2800);
}


/*
  Zadržavamo alert koji koriste admin funkcije,
  ali ga prikazujemo kao lijepi toast.
*/
window.alert = function(message){

  const msg = String(message);

  const isError =
    /error|greška|nije|ne može|ne mogu|moraš|obavezno/i
      .test(msg);

  toast(
    msg,
    isError ? "error" : "success"
  );
};


/* =========================================================
   PROFILE / AUTH
========================================================= */

async function ensureProfile(user){

  if(!user) return null;

  const {
    data:existing,
    error:selectError
  } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id",user.id)
      .maybeSingle();

  if(selectError){
    console.error(
      "Greška pri učitavanju profila:",
      selectError
    );
  }

  if(existing){
    return existing;
  }


  let username =
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    "Korisnik";


  username =
    String(username)
      .trim()
      .replace(/[^\p{L}\p{N}_\-.]/gu,"")
      .slice(0,30);


  if(!username){
    username = "Korisnik";
  }


  let newProfile = {
    id:user.id,
    username
  };


  let {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .insert(newProfile)
      .select("*")
      .maybeSingle();


  /*
    Ako je username već zauzet,
    pokušavamo sa drugim imenom.
  */
  if(
    error &&
    (
      error.code === "23505" ||
      /duplicate|unique/i.test(error.message || "")
    )
  ){

    const suffix =
      "_" + Date.now().toString().slice(-5);

    username =
      username.slice(
        0,
        Math.max(1,30-suffix.length)
      ) + suffix;

    ({
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .insert({
          id:user.id,
          username
        })
        .select("*")
        .maybeSingle());
  }


  if(error){

    console.error(
      "Profil nije kreiran:",
      error
    );

    return null;
  }


  return data;
}


async function checkAuth(){

  const {
    data:{
      session
    }
  } =
    await supabaseClient
      .auth
      .getSession();


  currentUser =
    session?.user || null;


  if(currentUser){

    currentProfile =
      await ensureProfile(currentUser);

  }else{

    currentProfile = null;
  }


  updateAuthUI();

  if(currentUser && document.getElementById("login")?.classList.contains("active")){
    showSection("home");
  }
}


/* =========================================================
   LOGIN
========================================================= */

async function login(){
