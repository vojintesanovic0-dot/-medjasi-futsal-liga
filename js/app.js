
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

  const email =
    document
      .getElementById("loginEmail")
      ?.value
      .trim();

  const password =
    document
      .getElementById("loginPassword")
      ?.value || "";

  const message =
    document.getElementById("loginMessage");


  if(!email || !password){

    if(message){
      message.textContent =
        "Unesi email i lozinku.";
    }

    return;
  }


  if(message){
    message.textContent =
      "Prijavljivanje...";
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .signInWithPassword({
        email,
        password
      });


  if(error){

    if(message){
      const msg=String(error.message||"");
      message.textContent=/confirm|email/i.test(msg)?"Email još nije potvrđen. Otvori poruku koju smo poslali na email i potvrdi nalog, pa se onda prijavi.":msg;
    }
    return;
  }
  if(data?.user && !data?.session && !data?.user?.email_confirmed_at){
    if(message) message.textContent="Email još nije potvrđen. Otvori poruku koju smo poslali na email i potvrdi nalog, pa se onda prijavi.";
    toast("Potvrdi email prije prijave.","error");
    return;
  }
  currentUser=data.user;


  await checkAuth();
  await loadAll();


  if(message){
    message.textContent =
      "Uspješna prijava.";
  }


  toast("Uspješno si prijavljen.");

  showSection("home");
}


/* =========================================================
   RESET PASSWORD
========================================================= */

async function resetPassword(){
  const email=document.getElementById("loginEmail")?.value.trim() || "";
  const message=document.getElementById("loginMessage");

  if(!email){
    if(message) message.textContent="Prvo upiši email adresu za koju želiš reset lozinke.";
    return;
  }

  if(message) message.textContent="Šaljem link za promjenu lozinke...";

  const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{
    redirectTo:window.location.origin + window.location.pathname
  });

  if(error){
    if(message) message.textContent=error.message;
    return;
  }

  if(message) message.textContent="Ako nalog postoji, link za promjenu lozinke je poslat na email.";
  toast("Provjeri email za promjenu lozinke.");
}


/* =========================================================
   REGISTER
========================================================= */

async function register(){

  const username =
    document
      .getElementById("registerUsername")
      ?.value
      .trim();

  const email =
    document
      .getElementById("registerEmail")
      ?.value
      .trim();

  const password =
    document
      .getElementById("registerPassword")
      ?.value || "";

  const confirmPassword =
    document
      .getElementById("registerPasswordConfirm")
      ?.value || "";

  const message =
    document.getElementById("registerMessage");


  if(!username || username.length < 3){

    message.textContent =
      "Korisničko ime mora imati najmanje 3 znaka.";

    return;
  }


  if(username.length > 30){

    message.textContent =
      "Korisničko ime može imati najviše 30 znakova.";

    return;
  }


  if(!email){

    message.textContent =
      "Unesi email.";

    return;
  }


  if(password.length < 6){

    message.textContent =
      "Lozinka mora imati najmanje 6 znakova.";

    return;
  }


  if(password !== confirmPassword){

    message.textContent =
      "Lozinke se ne podudaraju.";

    return;
  }


  message.textContent =
    "Kreiranje naloga...";


  /*
    Username stavljamo i u user_metadata.
    Ako je email confirmation uključen,
    profil će se napraviti kada se korisnik
    prvi put prijavi nakon potvrde emaila.
  */

  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .signUp({
        email,
        password,
        options:{
          data:{username},
          emailRedirectTo:window.location.origin + window.location.pathname
        }
      });


  if(error){

    message.textContent =
      error.message;

    return;
  }


  /*
    Ako Supabase odmah vrati session,
    email confirmation je vjerovatno isključen.
  */

  if(data.session && data.user){

    currentUser =
      data.user;

    await checkAuth();
    await loadAll();

    message.textContent =
      "Registracija uspješna.";

    toast("Nalog je uspješno kreiran.");

    showSection("home");

    return;
  }


  /*
    Ako nema sessiona,
    vjerovatno je potrebno potvrditi email.
  */

  message.innerHTML =
    "Registracija je uspješna. Poslali smo ti potvrdu na email. Otvori poruku i potvrdi nalog.<br><button type=\"button\" class=\"btn btn-small btn-blue\" style=\"margin-top:10px\" onclick=\"resendConfirmation()\">📩 Pošalji potvrdu ponovo</button>";

  toast("Provjeri email radi potvrde naloga.");
}


async function resendConfirmation(){
  const email=document.getElementById("registerEmail")?.value.trim()||document.getElementById("loginEmail")?.value.trim()||"";
  const message=document.getElementById("registerMessage")||document.getElementById("loginMessage");
  if(!email){
    if(message) message.textContent="Unesi email adresu na koju želiš ponovo poslati potvrdu.";
    return;
  }
  if(message) message.textContent="Šaljem novu potvrdu...";
  const {error}=await supabaseClient.auth.resend({
    type:"signup",
    email,
    options:{emailRedirectTo:window.location.origin+window.location.pathname}
  });
  if(error){
    if(message) message.textContent=error.message;
    return;
  }
  if(message) message.textContent="Nova potvrda je poslana. Provjeri Inbox i Spam/Junk folder.";
  toast("Potvrda je ponovo poslana.");
}
window.resendConfirmation=resendConfirmation;

/* =========================================================
   LOGOUT
========================================================= */

async function logout(){

  const {
    error
  } =
    await supabaseClient
      .auth
      .signOut();


  if(error){

    alert(error.message);

    return;
  }


  currentUser = null;
  currentProfile = null;


  updateAuthUI();


  toast("Odjavljen si.");

  showSection("home");

  await loadAll();
}


/* =========================================================
   AUTH UI
========================================================= */

function updateAuthUI(){const logged=!!currentUser;const username=currentProfile?.username||currentUser?.user_metadata?.username||"Korisnik";const account=document.getElementById("headerAccount");if(account)account.innerHTML=logged?`<button class="account-btn" onclick="openV9Profile('${currentUser.id}')"><span class="account-name">👤 ${esc(username)}</span>${isAdmin()?'<span class="account-admin">Admin</span>':''}</button><button class="account-btn" onclick="logout()">↪</button>`:`<button class="account-btn" onclick="showSection('login')">🔐 Prijava</button>`;document.getElementById("commentForm")?.classList.toggle("hidden",!logged);renderHome();renderTable();renderMatches();renderTeams();renderPlayers();renderStats();renderComments();renderChat();renderAdminMatches();fillTeamSelects();}

/* =========================================================
   LOAD ALL DATA
========================================================= */

async function loadAll(){

  try{

    const results =
      await Promise.all([

        supabaseClient
          .from("teams")
          .select("*")
          .order("name"),

        supabaseClient
          .from("players")
          .select("*")
          .order("jersey_number"),

        supabaseClient
          .from("matches")
          .select("*")
          .order("match_date"),

        supabaseClient
          .from("goals")
          .select("*")
          .order("minute"),

        supabaseClient
          .from("cards")
          .select("*")
          .order("minute"),

        supabaseClient
          .from("comments")
          .select("*")
          .order("created_at",{ascending:false}),

        supabaseClient
          .from("messages")
          .select("*")
          .order("created_at",{ascending:true}),

        supabaseClient
          .from("gallery")
          .select("*")
          .order("created_at",{ascending:false}),

        supabaseClient
          .from("match_players")
          .select("*")

      ]);


    const [
      teamsResult,
      playersResult,
      matchesResult,
      goalsResult,
      cardsResult,
      commentsResult,
      messagesResult,
      galleryResult,
      matchPlayersResult
    ] = results;


    if(teamsResult.error)
      console.error(teamsResult.error);

    if(playersResult.error)
      console.error(playersResult.error);

    if(matchesResult.error)
      console.error(matchesResult.error);

    if(goalsResult.error)
      console.error(goalsResult.error);

    if(cardsResult.error)
      console.error(cardsResult.error);

    if(commentsResult.error)
      console.error(commentsResult.error);

    if(messagesResult.error)
      console.error(messagesResult.error);

    if(galleryResult.error)
      console.error(galleryResult.error);

    if(matchPlayersResult.error)
      console.error(matchPlayersResult.error);


    teams =
      teamsResult.data || [];

    players =
      playersResult.data || [];

    matches =
      matchesResult.data || [];

    goals =
      goalsResult.data || [];

    cards =
      cardsResult.data || [];

    comments =
      commentsResult.data || [];

    messages =
      messagesResult.data || [];

    gallery =
      galleryResult.data || [];

    matchPlayers =
      matchPlayersResult.data || [];


    processLeagueNotifications();


    renderAll();

  }catch(error){

    console.error(
      "Greška pri učitavanju:",
      error
    );
  }
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll(){

  renderAnnouncement();
  initMusic();


  document.getElementById("statTeams").textContent =
    teams.length;

  document.getElementById("statPlayers").textContent =
    players.length;

  document.getElementById("statMatches").textContent =
    matches.length;

  document.getElementById("statGoals").textContent =
    goals.length;


  renderHome();
  renderTable();
  renderMatches();
  renderTeams();
  renderPlayers();
  renderStats();
  renderComments();
  renderChat();
  renderAdminMatches();

  fillTeamSelects();

  updateAuthUI();
}


/* =========================================================
   YOUTUBE MUSIC
========================================================= */

function initMusic(){
  const wrap=document.getElementById("musicPlayerWrap"); const hint=document.getElementById("musicHint"); const btn=document.getElementById("musicUnmute"); if(!wrap)return;
  const enabled=!!musicSettings?.youtube_music_enabled; const ids=musicTracks.map(t=>t.youtube_music_id).filter(Boolean); const signature=ids.join(",")+"|"+enabled;
  if(!enabled||!ids.length){wrap.innerHTML=`<div class="music-placeholder"><div><span style="font-size:28px">🎵</span><br>Trenutno nema aktivne muzike lige.</div></div>`;currentMusicSignature="";musicUserStarted=false;if(hint)hint.textContent="Admin može uključiti playlistu iz Admin panela.";if(btn)btn.style.display="none";return;}
  if(currentMusicSignature!==signature){const first=encodeURIComponent(ids[0]);const playlist=encodeURIComponent(ids.join(","));const src=`https://www.youtube-nocookie.com/embed/${first}?autoplay=1&mute=1&controls=1&rel=0&playsinline=1&modestbranding=1&loop=1&playlist=${playlist}`;wrap.innerHTML=`<iframe id="ytMusic" src="${src}" title="Medjaši Liga playlist" loading="eager" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;currentMusicSignature=signature;musicUserStarted=false;}
  if(hint)hint.innerHTML='<span class="music-live-badge">● MUZIKA LIGE</span> <span class="music-volume-note">Playlist svira redom. Klikni „Uključi zvuk“ ako želiš zvuk.</span>';if(btn){btn.style.display="inline-flex";btn.textContent=musicUserStarted?"🔊 Zvuk uključen":"🔊 Uključi zvuk";}
}

function unmuteMusic(){const frame=document.getElementById("ytMusic");if(!frame||!musicTracks.length)return;const ids=musicTracks.map(t=>t.youtube_music_id).filter(Boolean);const first=encodeURIComponent(ids[0]);const playlist=encodeURIComponent(ids.join(","));frame.src=`https://www.youtube-nocookie.com/embed/${first}?autoplay=1&mute=0&controls=1&rel=0&playsinline=1&modestbranding=1&loop=1&playlist=${playlist}`;musicUserStarted=true;const btn=document.getElementById("musicUnmute");if(btn)btn.textContent="🔊 Zvuk uključen";}


function renderAnnouncement(){

  const el =
    document.getElementById("homeAnnouncement");

  if(!el) return;


  const next =
    [...matches]
      .filter(m => m.status === "scheduled")
      .sort(
        (a,b) =>
          new Date(a.match_date) -
          new Date(b.match_date)
      )[0];


  if(!next){

    el.innerHTML = `
      <div class="empty compact">
        Trenutno nema zakazane naredne utakmice.
        <br>
        <span class="muted">
          Prati chat za nove informacije.
        </span>
      </div>
    `;

    return;
  }


  const home =
    getTeam(next.home_team_id);

  const away =
    getTeam(next.away_team_id);


  el.innerHTML = `

    <div class="announcement-match">

      <div>

        <strong>
          ${esc(home?.name || "Domaćin")}
        </strong>

        <span>vs</span>

        <strong>
          ${esc(away?.name || "Gost")}
        </strong>

      </div>

      <div class="match-meta">
        ${formatDate(next.match_date)}
        ${
          next.round
            ? ` • ${esc(String(next.round))}. kolo`
            : ""
        }
      </div>

    </div>

  `;
}


/* =========================================================
   ANNOUNCEMENT TO CHAT
========================================================= */

async function postNextMatchAnnouncement(){

  if(!isAdmin() || !currentUser){

    alert(
      "Moraš biti prijavljen kao administrator."
    );

    return;
  }


  const next =
    [...matches]
      .filter(m => m.status === "scheduled")
      .sort(
        (a,b) =>
          new Date(a.match_date) -
          new Date(b.match_date)
      )[0];


  if(!next){

    alert(
      "Nema zakazane naredne utakmice."
    );

    return;
  }


  const home =
    getTeam(next.home_team_id);

  const away =
    getTeam(next.away_team_id);


  const content =
    `📣 NAJAVA UTAKMICE: ${
      home?.name || "Domaćin"
    } 🆚 ${
      away?.name || "Gost"
    } — ${
      formatDate(next.match_date)
    }${
      next.round
        ? ` — ${next.round}. kolo`
        : ""
    }`;


  const {
    error
  } =
    await supabaseClient
      .from("messages")
      .insert({
        user_id:currentUser.id,
        content
      });


  if(error){

    alert(error.message);

    return;
  }


  toast(
    "Najava je objavljena u chatu."
  );


  await loadAll();
}


/* =========================================================
   HOME
========================================================= */

function renderHome(){
  const a=document.getElementById("heroTeamsMini");if(a)a.textContent=teams.length;const b=document.getElementById("heroMatchesMini");if(b)b.textContent=matches.length;const c=document.getElementById("heroPlayersMini");if(c)c.textContent=players.length;

  const live =
    matches
      .filter(m => m.status === "live");


  const next =
    matches
      .filter(m => m.status === "scheduled")
      .sort(
        (a,b) =>
          new Date(a.match_date) -
          new Date(b.match_date)
      )
      .slice(0,4);


  const results =
    matches
      .filter(m => m.status === "finished")
      .sort(
        (a,b) =>
          new Date(b.match_date) -
          new Date(a.match_date)
      )
      .slice(0,4);


  document.getElementById("homeLive").innerHTML =
    live.length
      ? live.map(enhancedMatchHTML).join("")
      : `
        <div class="empty">
          <strong>Nema utakmica uživo</strong>
          <br>
          <span>
            Čim utakmica počne, pojaviće se ovdje.
          </span>
        </div>
      `;


  document.getElementById("homeNext").innerHTML =
    next.length
      ? next.map(enhancedMatchHTML).join("")
      : `
        <div class="empty">
          Nema narednih utakmica.
        </div>
      `;


  document.getElementById("homeResults").innerHTML =
    results.length
      ? results.map(enhancedMatchHTML).join("")
      : `
        <div class="empty">
          Još nema završenih utakmica.
        </div>
      `;


  document.getElementById("liveCount").textContent =
    live.length
      ? `${live.length} utakmica uživo`
      : "Trenutno nema live utakmica";


  const rows =
    sortedTableRows();


  const leader =
    rows[0];


  document.getElementById("homeLeader").innerHTML =
    leader
      ? `
        <div class="rank-row"
             onclick="openTeam('${leader.team.id}')"
             style="cursor:pointer">

          <div class="rank-num">
            1.
          </div>

          <div class="rank-avatar">

            <img src="${teamLogo(leader.team)}">

            <div>

              <strong>
                ${esc(leader.team.name)}
              </strong>

              <small>
                ${leader.wins} pobjeda
                •
                ${leader.points} bodova
              </small>

            </div>

          </div>

          <div class="rank-value">
            ${leader.points}
          </div>

        </div>
      `
      : `
        <div class="empty">
          Tabela još nema podataka.
        </div>
      `;


  const counts = {};


  goals.forEach(g => {

    counts[g.player_id] =
      (counts[g.player_id] || 0) + 1;

  });


  const top =
    Object.entries(counts)
      .sort((a,b) => b[1] - a[1])[0];


  const tp =
    top && getPlayer(top[0]);


  document.getElementById("homeTopScorer").innerHTML =
    tp
      ? `
        <div class="rank-row"
             onclick="openPlayer('${tp.id}')"
             style="cursor:pointer">

          <div class="rank-num">
            ⚽
          </div>

          <div class="rank-avatar">

            <img src="${playerPhoto(tp)}">

            <div>

              <strong>
                ${esc(tp.name)}
              </strong>

              <small>
                ${esc(teamName(tp.team_id))}
              </small>

            </div>

          </div>

          <div class="rank-value">
            ${top[1]}
          </div>

        </div>
      `
      : `
        <div class="empty">
          Još nema golova.
        </div>
      `;


  const forms =
    rows
      .slice(0,5)
      .map(
        (r,i) => `
          <div class="rank-row">

            <div class="rank-num">
              ${i+1}
            </div>

            <div style="flex:1">
              <strong>
                ${esc(r.team.name)}
              </strong>
            </div>

            ${formHTML(r.team.id)}

          </div>
        `
      )
      .join("");


  document.getElementById("homeForm").innerHTML =
    forms ||
    `
      <div class="empty">
        Nema podataka o formi.
      </div>
    `;
}


/* =========================================================
   TABLE
========================================================= */

function teamStatsMap(){

  const map = {};


  teams.forEach(team => {

    map[team.id] = {
      team,
      played:0,
      wins:0,
      draws:0,
      losses:0,
      gf:0,
      ga:0,
      points:0,
      form:[]
    };

  });


  matches
    .filter(m => m.status === "finished")
    .forEach(m => {

      const h =
        map[m.home_team_id];

      const a =
        map[m.away_team_id];


      if(!h || !a) return;


      const hs =
        Number(m.home_score || 0);

      const as =
        Number(m.away_score || 0);


      h.played++;
      a.played++;

      h.gf += hs;
      h.ga += as;

      a.gf += as;
      a.ga += hs;


      if(hs > as){

        h.wins++;
        h.points += 3;

        a.losses++;

        h.form.push("W");
        a.form.push("L");

      }else if(as > hs){

        a.wins++;
        a.points += 3;

        h.losses++;

        h.form.push("L");
        a.form.push("W");

      }else{

        h.draws++;
        a.draws++;

        h.points++;
        a.points++;

        h.form.push("D");
        a.form.push("D");
      }

    });


  return map;
}


function sortedTableRows(){

  return Object
    .values(teamStatsMap())
    .sort(
      (a,b) =>
        b.points - a.points ||
        (b.gf-b.ga) -
        (a.gf-a.ga) ||
        b.gf-a.gf ||
        a.team.name.localeCompare(
          b.team.name
        )
    );
}


function getForm(teamId){

  const arr =
    matches
      .filter(
        m =>
          m.status === "finished" &&
          (
            m.home_team_id === teamId ||
            m.away_team_id === teamId
          )
      )
      .sort(
        (a,b) =>
          new Date(a.match_date) -
          new Date(b.match_date)
      );


  return arr
    .slice(-5)
    .map(m => {

      const home =
        m.home_team_id === teamId;

      const my =
        Number(
          home
            ? m.home_score
            : m.away_score
        );

      const op =
        Number(
          home
            ? m.away_score
            : m.home_score
        );


      return my > op
        ? "W"
        : my < op
          ? "L"
          : "D";
    });
}


function formHTML(teamId){

  const f =
    getForm(teamId);


  return `
    <div class="form-dots">

      ${
        [...f]
          .map(
            x =>
              `<span class="form-dot form-${x}">
                ${x}
              </span>`
          )
          .join("")
      }

      ${
        !f.length
          ? `<span class="muted">—</span>`
          : ""
      }

    </div>
  `;
}


function renderTable(){

  const rows =
    sortedTableRows();


  document.getElementById("tableBody").innerHTML =
    rows.length
      ? rows
          .map(
            (s,i) => `
              <tr onclick="openTeam('${s.team.id}')">

                <td>
                  <span class="rank">
                    ${i+1}
                  </span>
                </td>

                <td>

                  <div class="team-cell">

                    <img
                      class="team-mini-logo"
                      src="${teamLogo(s.team)}">

                    ${esc(s.team.name)}

                  </div>

                </td>

                <td>
                  ${formHTML(s.team.id)}
                </td>

                <td>${s.played}</td>
                <td>${s.wins}</td>
                <td>${s.draws}</td>
                <td>${s.losses}</td>
                <td>${s.gf}</td>
                <td>${s.ga}</td>
                <td>${s.gf-s.ga}</td>

                <td>
                  <span class="points">
                    ${s.points}
                  </span>
                </td>

              </tr>
            `
          )
          .join("")
      : `
          <tr>
            <td colspan="11">
              <div class="empty">
                Nema ekipa.
              </div>
            </td>
          </tr>
        `;
}


/* =========================================================
   MATCHES
========================================================= */

function enhancedMatchHTML(m){

  const home =
    getTeam(m.home_team_id);

  const away =
    getTeam(m.away_team_id);

  const live =
    m.status === "live";


  return `

    <div class="match-row"
         onclick="openMatch('${m.id}')">

      <div class="team-side">

        <img
          class="team-logo"
          src="${teamLogo(home)}">

        <div>

          <div class="team-name">
            ${esc(home?.name || "Domaćin")}
          </div>

          ${
            live
              ? `<div class="match-meta">
                   🔴 Utakmica uživo
                 </div>`
              : ""
          }

        </div>

      </div>


      <div class="match-center">

        <div class="status ${live ? "live" : ""}">
          ${
            live
              ? "● UŽIVO"
              : m.status === "finished"
                ? "ZAVRŠENO"
                : "ZAKAZANO"
          }
        </div>

        <div class="score">
          ${m.home_score ?? 0}
          :
          ${m.away_score ?? 0}
        </div>

        <div class="match-meta">

          ${
            live
              ? `${m.current_minute || 0}'`
              : formatDate(m.match_date)
          }

        </div>

        ${
          m.round
            ? `
              <div class="round-badge">
                ${esc(String(m.round))}. kolo
              </div>
            `
            : ""
        }

      </div>


      <div class="team-side away">

        <div>

          <div class="team-name">
            ${esc(away?.name || "Gost")}
          </div>

        </div>

        <img
          class="team-logo"
          src="${teamLogo(away)}">

      </div>

    </div>

  `;
}


function matchHTML(m){
  return enhancedMatchHTML(m);
}


function populateRoundFilter(){

  const el =
    document.getElementById(
      "matchRoundFilter"
    );

  if(!el) return;


  const val =
    el.value;


  const rounds =
    [
      ...new Set(
        matches
          .map(m => m.round)
          .filter(
            x =>
              x !== null &&
              x !== undefined &&
              x !== ""
          )
      )
    ]
    .sort(
      (a,b) =>
        Number(a) - Number(b)
    );


  el.innerHTML =
    `<option value="">
      Sva kola
    </option>` +
    rounds
      .map(
        r =>
          `<option value="${esc(r)}">
            ${esc(r)}. kolo
          </option>`
      )
      .join("");


  el.value = val;
}


function renderMatches(){

  populateRoundFilter();


  const q =
    (
      document
        .getElementById("matchSearch")
        ?.value || ""
    )
    .toLowerCase();


  const round =
    document
      .getElementById("matchRoundFilter")
      ?.value || "";


  const status =
    document
      .getElementById("matchStatusFilter")
      ?.value || "";


  let list =
    [...matches];


  if(q){

    list =
      list.filter(
        m =>
          teamName(
            m.home_team_id
          )
          .toLowerCase()
          .includes(q) ||

          teamName(
            m.away_team_id
          )
          .toLowerCase()
          .includes(q)
      );
  }


  if(round){

    list =
      list.filter(
        m =>
          String(m.round) ===
          String(round)
      );
  }


  if(status){

    list =
      list.filter(
        m =>
          m.status === status
      );
  }


  list.sort(
    (a,b) => {

      if(a.status === "live")
        return -1;

      if(b.status === "live")
        return 1;

      return (
        new Date(a.match_date) -
        new Date(b.match_date)
      );
    }
  );


  document.getElementById(
    "matchesList"
  ).innerHTML =

    list.length
      ? list
          .map(enhancedMatchHTML)
          .join("")
      : `
        <div class="empty">
          <strong>Nema rezultata</strong>
          <br>
          Promijeni filtere i pokušaj ponovo.
        </div>
      `;
}


/* =========================================================
   TEAMS
========================================================= */

function renderTeams(){

  const q =
    (
      document
        .getElementById("teamSearch")
        ?.value || ""
    )
    .toLowerCase();


  const map =
    teamStatsMap();


  const list =
    teams.filter(
      t =>
        t.name
          .toLowerCase()
          .includes(q)
    );


  document.getElementById(
    "teamsGrid"
  ).innerHTML =

    list.length

      ? list
          .map(t => {

            const s =
              map[t.id];

            const captain =
              players.find(
                p =>
                  p.team_id === t.id &&
                  p.is_captain
              );


            const count =
              players.filter(
                p =>
                  p.team_id === t.id
              ).length;


            return `

              <div class="card">

                <div
                  class="team-cover"
                  onclick="openTeam('${t.id}')">

                  <img src="${teamLogo(t)}">

                  <div>

                    <h3>
                      ${esc(t.name)}
                    </h3>

                    <div class="muted">
                      ${count} igrača
                      ${
                        captain
                          ? ` • Kapiten:
                              ${esc(captain.name)}`
                          : ""
                      }
                      ${
                        t.coach
                          ? ` • Trener: ${esc(t.coach)}`
                          : ""
                      }
                    </div>

                  </div>

                </div>


                <div class="team-kpis">

                  <div class="kpi">
                    <strong>
                      ${s?.points || 0}
                    </strong>
                    <span>Bodovi</span>
                  </div>

                  <div class="kpi">
                    <strong>
                      ${s?.gf || 0}:${s?.ga || 0}
                    </strong>
                    <span>Golovi</span>
                  </div>

                  <div class="kpi">
                    <strong>
                      ${s?.played || 0}
                    </strong>
                    <span>Utakmice</span>
                  </div>

                </div>


                <div style="margin-top:13px">
                  ${formHTML(t.id)}
                </div>


                ${
                  isAdmin()
                    ? `
                      <div
                        class="actions"
                        style="margin-top:13px">

                        <button
                          class="btn btn-small"
                          onclick="openTeam('${t.id}')">
                          👁️ Otvori
                        </button>

                        <button
                          class="btn btn-red btn-small"
                          onclick="deleteTeam('${t.id}')">
                          🗑️ Obriši ekipu
                        </button>

                      </div>
                    `
                    : ""
                }

              </div>

            `;
          })
          .join("")

      : `
        <div class="empty">
          Nema ekipa koje odgovaraju pretrazi.
        </div>
      `;
}


/* =========================================================
   PLAYERS
========================================================= */

function populatePlayerFilter(){

  const el =
    document.getElementById(
      "playerTeamFilter"
    );

  if(!el) return;


  const val =
    el.value;


  el.innerHTML =
    `<option value="">
      Sve ekipe
    </option>` +

    teams
      .map(
        t =>
          `<option value="${t.id}">
            ${esc(t.name)}
          </option>`
      )
      .join("");


  el.value = val;
}


function renderPlayers(){

  populatePlayerFilter();


  const q =
    (
      document
        .getElementById("playerSearch")
        ?.value || ""
    )
    .toLowerCase();


  const teamId =
    document
      .getElementById(
        "playerTeamFilter"
      )
      ?.value || "";


  const list =
    players.filter(
      p =>

        (
          !q ||
          String(p.name || "")
            .toLowerCase()
            .includes(q)
        ) &&

        (
          !teamId ||
          p.team_id === teamId
        )
    );


  document.getElementById(
    "playersGrid"
  ).innerHTML =

    list.length

      ? list
          .map(p => {

            const team =
              getTeam(p.team_id);

            const g =
              goals.filter(
                x =>
                  x.player_id === p.id
              ).length;

            const c =
              cards.filter(
                x =>
                  x.player_id === p.id
              ).length;

            const apps =
              new Set(
                matchPlayers
                  .filter(
                    mp =>
                      mp.player_id === p.id
                  )
                  .map(
                    mp => mp.match_id
                  )
              ).size;


            return `

              <div
                class="card player-card"
                onclick="openPlayer('${p.id}')">

                <img
                  class="player-photo"
                  src="${playerPhoto(p)}">

                <div
                  style="min-width:0;flex:1">

                  <h3>
                    ${esc(
                      p.name ||
                      "Bez imena"
                    )}
                  </h3>

                  <div class="muted">
                    ${esc(
                      team?.name || ""
                    )}
                  </div>

                  <div style="margin-top:6px">

                    <span class="player-number">
                      #${p.jersey_number ?? "-"}
                    </span>

                    <span class="badge">
                      ${esc(
                        p.position || "-"
                      )}
                    </span>

                    ${
                      p.is_captain
                        ? `
                          <span class="captain">
                            Kapiten
                          </span>
                        `
                        : ""
                    }

                  </div>

                  <div
                    class="match-meta"
                    style="margin-top:8px">

                    ⚽ ${g}
                    &nbsp;
                    🟨 ${c}
                    &nbsp;
                    👟 ${apps}

                  </div>

                </div>

              </div>

            `;
          })
          .join("")

      : `
        <div class="empty">
          Nema igrača koji odgovaraju filteru.
        </div>
      `;
}


/* =========================================================
   STATS
========================================================= */

function rankList(items,empty){

  return items.length

    ? items
        .map(
          (x,i) => `

            <div
              class="rank-row"
              ${
                x.id
                  ? `
                    onclick="openPlayer('${x.id}')"
                    style="cursor:pointer"
                  `
                  : ""
              }>

              <div class="rank-num">
                ${i+1}
              </div>

              <div class="rank-avatar">

                ${
                  x.id
                    ? `
                      <img
                        src="${playerPhoto(
                          getPlayer(x.id)
                        )}">
                    `
                    : ""
                }

                <div>

                  <strong>
                    ${esc(x.name)}
                  </strong>

                  <small>
                    ${esc(x.sub || "")}
                  </small>

                </div>

              </div>

              <div class="rank-value">
                ${x.value}
              </div>

            </div>

          `
        )
        .join("")

    : empty;
}


function renderStats(){

  const scorer = {};


  goals.forEach(g => {

    scorer[g.player_id] =
      (scorer[g.player_id] || 0) + 1;

  });


  const scorers =
    Object
      .entries(scorer)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
      .map(
        ([id,v]) => ({
          id,
          name:playerName(id),
          sub:teamName(
            getPlayer(id)?.team_id
          ),
          value:v
        })
      );


  document.getElementById(
    "scorersList"
  ).innerHTML =
    rankList(
      scorers,
      `<div class="empty">
        Nema golova.
      </div>`
    );


  const cardMap = {};


  cards.forEach(c => {

    cardMap[c.player_id] =
      (cardMap[c.player_id] || 0) + 1;

  });


  const cr =
    Object
      .entries(cardMap)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
      .map(
        ([id,v]) => ({
          id,
          name:playerName(id),
          sub:teamName(
            getPlayer(id)?.team_id
          ),
          value:`🟨 ${v}`
        })
      );


  document.getElementById(
    "cardsList"
  ).innerHTML =
    rankList(
      cr,
      `<div class="empty">
        Nema kartona.
      </div>`
    );


  const apps = {};


  matchPlayers.forEach(mp => {

    apps[mp.player_id] =
      (apps[mp.player_id] || 0) + 1;

  });


  const ar =
    Object
      .entries(apps)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
      .map(
        ([id,v]) => ({
          id,
          name:playerName(id),
          sub:teamName(
            getPlayer(id)?.team_id
          ),
          value:v
        })
      );


  document.getElementById(
    "appearancesList"
  ).innerHTML =
    rankList(
      ar,
      `<div class="empty">
        Nema podataka o nastupima.
      </div>`
    );


  const assistMap = {};

  goals.forEach(g => {
    if(!g.assist_player_id) return;
    assistMap[g.assist_player_id] =
      (assistMap[g.assist_player_id] || 0) + 1;
  });

  const assistsRank =
    Object
      .entries(assistMap)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
      .map(([id,v]) => ({
        id,
        name:playerName(id),
        sub:teamName(getPlayer(id)?.team_id),
        value:v
      }));

  const assistsList = document.getElementById("assistsList");
  if(assistsList){
    assistsList.innerHTML = rankList(
      assistsRank,
      `<div class="empty">
        Nema evidentiranih asistencija.
      </div>`
    );
  }


  const tr =
    sortedTableRows()
      .slice(0,10)
      .map(
        s => ({
          id:null,
          name:s.team.name,
          sub:
            `${s.wins} P •
             ${s.draws} N •
             ${s.losses} I •
             GR ${s.gf-s.ga}`,
          value:s.points
        })
      );


  document.getElementById(
    "teamStatsList"
  ).innerHTML =
    rankList(
      tr,
      `<div class="empty">
        Nema podataka.
      </div>`
    );
}


/* =========================================================
   COMMENTS
========================================================= */

function renderComments(){

  const container =
    document.getElementById(
      "commentsList"
    );

  if(!container) return;


  container.innerHTML =

    comments.length

      ? comments
          .map(c => {

            /*
              Prvo koristimo username iz komentara.
              Ako stari komentar nema username,
              pokušavamo prikazati profil korisnika.
            */

            const username =
              c.username ||
              (
                currentUser &&
                c.user_id === currentUser.id
                  ? currentProfile?.username
                  : null
              ) ||
              "Korisnik";


            return `

              <div class="comment">

                <div class="comment-top">

                  <div>
                    <span class="comment-author">
                      ${esc(username)}
                    </span>
                  </div>

                  <small class="comment-date">
                    ${formatDate(
                      c.created_at
                    )}
                  </small>

                </div>


                <div class="comment-text">
                  ${esc(c.content)}
                </div>

                ${
                  c.image_url
                    ? `
                      <div class="comment-media">
                        <a href="${esc(c.image_url)}" target="_blank" rel="noopener noreferrer">
                          <img src="${esc(c.image_url)}" alt="Slika uz komentar" loading="lazy">
                        </a>
                      </div>
                    `
                    : ""
                }


                ${
                  currentUser &&
                  (
                    c.user_id ===
                    currentUser.id ||
                    isAdmin()
                  )
                    ? `
                      <button
                        class="btn btn-red btn-small"
                        style="margin-top:8px"
                        onclick="deleteComment('${c.id}')">
                        🗑️ Obriši
                      </button>
                    `
                    : ""
                }

              </div>

            `;
          })
          .join("")

      : `
        <div class="empty">
          Nema komentara.
          <br>
          Budi prvi koji će nešto napisati.
        </div>
      `;


  setupCommentImageUI();

  const counter =
    document.getElementById(
      "commentCounter"
    );


  const input =
    document.getElementById(
      "commentText"
    );


  if(input && counter){

    counter.textContent =
      `${input.value.length} / 1000`;
  }
}


/* =========================================================
   ADD COMMENT
========================================================= */

async function addComment(){

  if(!currentUser){
    alert("Moraš biti prijavljen.");
    return;
  }

  const input=document.getElementById("commentText");
  const fileInput=document.getElementById("commentImageFile");
  const content=input?.value.trim() || "";
  const file=fileInput?.files?.[0] || null;

  if(!content && !file){
    alert("Napiši komentar ili dodaj sliku.");
    return;
  }

  if(content.length>1000){
    alert("Komentar može imati najviše 1000 znakova.");
    return;
  }

  if(file){
    if(!file.type.startsWith("image/")){
      alert("Dozvoljene su samo slike.");
      return;
    }
    if(file.size>5*1024*1024){
      alert("Slika može imati najviše 5 MB.");
      return;
    }
  }

  const username=currentProfile?.username ||
    currentUser.user_metadata?.username ||
    currentUser.email?.split("@")[0] ||
    "Korisnik";

  let image_url=null;

  try{
    if(file){
      image_url=await uploadFile(file,"comments");
    }

    const {error}=await supabaseClient
      .from("comments")
      .insert({
        user_id:currentUser.id,
        username:String(username).slice(0,30),
        content,
        image_url
      });

    if(error) throw error;

    input.value="";
    if(fileInput) fileInput.value="";
    removeCommentImage();

    toast("Komentar je objavljen.");
    await loadAll();

  }catch(error){
    console.error(error);
    alert(error.message || "Greška pri objavljivanju komentara.");
  }
}

/* =========================================================
   DELETE COMMENT
========================================================= */

async function deleteComment(id){

  if(!currentUser){

    alert(
      "Moraš biti prijavljen."
    );

    return;
  }


  const comment =
    comments.find(
      c =>
        String(c.id) ===
        String(id)
    );


  if(!comment) return;


  if(
    comment.user_id !==
      currentUser.id &&
    !isAdmin()
  ){

    alert(
      "Nemaš dozvolu da obrišeš ovaj komentar."
    );

    return;
  }


  if(
    !confirm(
      "Obrisati komentar?"
    )
  ){
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("comments")
      .delete()
      .eq("id",id);


  if(error){

    alert(error.message);

    return;
  }


  toast(
    "Komentar je obrisan."
  );


  await loadAll();
}


/* =========================================================
   CHAT
========================================================= */

function renderChat(){

  const box=document.getElementById("chatBox");
  if(!box) return;

  box.innerHTML = messages.length
    ? messages.map(m => {
        const username = m.username ||
          (currentUser && m.user_id===currentUser.id ? currentProfile?.username : null) ||
          (m.user_id ? String(m.user_id).slice(0,8) : "Korisnik");

        return `
          <div class="chat-message">
            <div class="chat-avatar">💬</div>
            <div class="chat-message-body">
              <div class="chat-message-top">
                <strong>${esc(username)}</strong>
                <small class="muted">${formatDate(m.created_at)}</small>
              </div>
              ${m.content ? `<div class="chat-message-text">${esc(m.content)}</div>` : ""}
              ${m.image_url ? `
                <button class="chat-photo" type="button" onclick="openImagePreview('${esc(m.image_url)}','${esc(username)}')">
                  <img src="${esc(m.image_url)}" alt="Slika u chatu" loading="lazy">
                </button>` : ""}
              ${currentUser && (m.user_id===currentUser.id || isAdmin())
                ? `<button class="btn btn-red btn-small chat-delete" onclick="deleteChat('${m.id}')">🗑️</button>` : ""}
            </div>
          </div>`;
      }).join("")
    : `<div class="empty">Još nema poruka.<br>Budi prvi koji će započeti razgovor.</div>`;

  box.scrollTop=box.scrollHeight;
}

function setupChatImageUI(){
  const input=document.getElementById("chatImageFile");
  if(!input || input.dataset.ready==="1") return;
  input.dataset.ready="1";

  input.addEventListener("change",()=>{
    const file=input.files?.[0];
    const preview=document.getElementById("chatImagePreview");
    const meta=document.getElementById("chatImageMeta");

    if(!file){ clearChatImage(); return; }
    if(!file.type.startsWith("image/") || file.size>5*1024*1024){
      alert("Slika mora biti JPG, PNG, WEBP ili GIF i imati najviše 5 MB.");
      clearChatImage();
      return;
    }

    if(meta) meta.textContent=`Odabrano: ${file.name}`;
    if(preview){
      const url=URL.createObjectURL(file);
      preview.innerHTML=`<img src="${url}" alt="Pregled slike"><button type="button" class="btn btn-red btn-small" onclick="clearChatImage()">✕ Ukloni</button>`;
      preview.classList.remove("hidden");
    }
  });
}

function clearChatImage(){
  const input=document.getElementById("chatImageFile");
  const preview=document.getElementById("chatImagePreview");
  const meta=document.getElementById("chatImageMeta");
  if(input) input.value="";
  if(preview){preview.innerHTML="";preview.classList.add("hidden");}
  if(meta) meta.textContent="Možeš poslati sliku uz poruku.";
}


/* =========================================================
   SEND CHAT
========================================================= */

async function sendChat(){

  if(!currentUser){ alert("Moraš biti prijavljen."); return; }

  const input=document.getElementById("chatText");
  const fileInput=document.getElementById("chatImageFile");
  const content=input?.value.trim() || "";
  const file=fileInput?.files?.[0] || null;

  if(!content && !file){ alert("Napiši poruku ili dodaj sliku."); return; }
  if(content.length>1000){ alert("Poruka može imati najviše 1000 znakova."); return; }
  if(file && (!file.type.startsWith("image/") || file.size>5*1024*1024)){
    alert("Slika mora biti JPG, PNG, WEBP ili GIF i imati najviše 5 MB."); return;
  }

  try{
    let image_url=null;
    if(file) image_url=await uploadFile(file,"chat");

    const username=currentProfile?.username || currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Korisnik";

    const {error}=await supabaseClient.from("messages").insert({
      user_id:currentUser.id,
      username:String(username).slice(0,30),
      content,
      image_url
    });
    if(error) throw error;

    if(input) input.value="";
    clearChatImage();
    await loadAll();
  }catch(error){
    console.error(error);
    alert(error.message || "Greška pri slanju poruke.");
  }
}


/* =========================================================
   DELETE CHAT
========================================================= */

async function deleteChat(id){

  if(!currentUser) return;


  if(!confirm(
    "Obrisati poruku?"
  )){
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("messages")
      .delete()
      .eq("id",id);


  if(error){

    alert(error.message);

    return;
  }


  toast(
    "Poruka je obrisana."
  );


  await loadAll();
}


/* =========================================================
   GALLERY
========================================================= */

function renderGallery(){
  const grid=document.getElementById("galleryGrid");
  const count=document.getElementById("galleryCount");
  if(count) count.textContent=`${gallery.length} fotografija`;
  if(!grid) return;

  if(!gallery.length){
    grid.innerHTML=`<div class="empty gallery-empty">📸 Galerija je trenutno prazna.</div>`;
    return;
  }

  grid.innerHTML=gallery.map(item=>`
    <article class="gallery-item">
      <button class="gallery-photo" type="button" onclick="openImagePreview('${esc(item.image_url)}','${esc(item.title || "Galerija")}')">
        <img src="${esc(item.image_url)}" alt="${esc(item.title || "Fotografija")}" loading="lazy">
        <span class="gallery-overlay">🔍 Pregledaj</span>
      </button>
      <div class="gallery-caption">
        <strong>${esc(item.title || "Fotografija lige")}</strong>
        ${item.description ? `<p>${esc(item.description)}</p>` : ""}
        <small class="muted">${formatDate(item.created_at)}</small>
      </div>
    </article>`).join("");
}

function renderAdminGallery(){
  const box=document.getElementById("adminGalleryList");
  if(!box) return;
  if(!isAdmin()){ box.innerHTML=""; return; }

  box.innerHTML=`
    <div class="admin-gallery-title">Objavljene fotografije (${gallery.length})</div>
    ${gallery.length ? `<div class="admin-gallery-items">
      ${gallery.map(item=>`
        <div class="admin-gallery-item">
          <img src="${esc(item.image_url)}" alt="">
          <div><strong>${esc(item.title || "Bez naslova")}</strong><small class="muted">${formatDate(item.created_at)}</small></div>
          <button class="btn btn-red btn-small" onclick="adminDeleteGalleryImage('${item.id}')">🗑️</button>
        </div>`).join("")}
    </div>` : `<div class="muted">Još nema fotografija.</div>`}`;
}

async function adminAddGalleryImage(){
  if(!isAdmin()){ toast("Nemaš admin ovlaštenje.","error"); return; }

  const file=document.getElementById("galleryImageFile")?.files?.[0];
  const title=document.getElementById("galleryTitle")?.value.trim() || "";
  const description=document.getElementById("galleryDescription")?.value.trim() || "";

  if(!file){ alert("Izaberi fotografiju."); return; }
  if(!file.type.startsWith("image/") || file.size>8*1024*1024){ alert("Dozvoljene su slike do 8 MB."); return; }

  try{
    const image_url=await uploadFile(file,"gallery");
    const {error}=await supabaseClient.from("gallery").insert({
      image_url,
      title:title.slice(0,100) || "Fotografija lige",
      description:description.slice(0,250),
      created_by:currentUser.id
    });
    if(error) throw error;

    document.getElementById("galleryImageFile").value="";
    document.getElementById("galleryTitle").value="";
    document.getElementById("galleryDescription").value="";
    toast("Fotografija je objavljena u galeriji.","success");
    await loadAll();
  }catch(error){
    console.error(error);
    alert(error.message || "Greška pri objavljivanju fotografije.");
  }
}

async function adminDeleteGalleryImage(id){
  if(!isAdmin()) return;
  const item=gallery.find(g=>String(g.id)===String(id));
  if(!item) return;
  if(!confirm(`Obrisati "${item.title || "ovu fotografiju"}" iz galerije?`)) return;

  const {error}=await supabaseClient.from("gallery").delete().eq("id",id);
  if(error){ alert(error.message); return; }
  toast("Fotografija je obrisana.","success");
  await loadAll();
}

function openImagePreview(url,title="Fotografija"){
  if(!url) return;
  showModal(`<div class="image-lightbox"><img src="${esc(url)}" alt="${esc(title)}"><div class="image-lightbox-caption"><strong>${esc(title)}</strong></div></div>`);
}

/* =========================================================
   STORAGE
========================================================= */

async function uploadFile(file,folder){

  if(!file) return null;


  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();


  const filename =
    `${folder}/${crypto.randomUUID()}.${extension}`;


  const {
    error
  } =
    await supabaseClient
      .storage
      .from("liga-images")
      .upload(
        filename,
        file,
        {
          upsert:false
        }
      );


  if(error) throw error;


  const {
    data
  } =
    supabaseClient
      .storage
      .from("liga-images")
      .getPublicUrl(filename);


  return data.publicUrl;
}


/* =========================================================
   ADMIN - TEAM
========================================================= */

async function addTeam(){

  if(!isAdmin()){

    alert(
      "Nemaš admin ovlaštenje."
    );

    return;
  }


  try{

    const name =
      document
        .getElementById("teamName")
        .value
        .trim();


    const file =
      document
        .getElementById("teamLogoFile")
        .files[0];

    const coach =
      document.getElementById("teamCoach")?.value.trim() || null;


    if(!name){

      alert(
        "Unesi naziv ekipe."
      );

      return;
    }


    let logo_url = null;


    if(file){

      logo_url =
        await uploadFile(
          file,
          "teams"
        );
    }


    const {
      error
    } =
      await supabaseClient
        .from("teams")
        .insert({
          name,
          logo_url,
          coach
        });


    if(error) throw error;


    document.getElementById(
      "teamName"
    ).value = "";

    const coachInput = document.getElementById("teamCoach");
    if(coachInput) coachInput.value = "";


    document.getElementById(
      "teamLogoFile"
    ).value = "";


    toast(
      "Ekipa je dodana."
    );


    await loadAll();

  }catch(error){

    alert(error.message);
  }
}


/* =========================================================
   ADMIN - PLAYER
========================================================= */

async function addPlayer(){

  if(!isAdmin()){

    alert(
      "Nemaš admin ovlaštenje."
    );

    return;
  }


  try{

    const name =
      document
        .getElementById("playerName")
        .value
        .trim();


    const teamId =
      document
        .getElementById("playerTeam")
        .value;


    const number =
      document
        .getElementById("playerNumber")
        .value;


    const position =
      document
        .getElementById("playerPosition")
        .value;


    const isCaptain =
      document
        .getElementById("playerCaptain")
        .checked;


    const file =
      document
        .getElementById("playerPhotoFile")
        .files[0];


    if(!name || !teamId){

      alert(
        "Unesi ime i izaberi ekipu."
      );

      return;
    }


    let photo_url = null;


    if(file){

      photo_url =
        await uploadFile(
          file,
          "players"
        );
    }


    /*
      Samo jedan kapiten po ekipi.
    */

    if(isCaptain){

      const {
        error:captainError
      } =
        await supabaseClient
          .from("players")
          .update({
            is_captain:false
          })
          .eq("team_id",teamId);


      if(captainError)
        throw captainError;
    }


    const {
      error
    } =
      await supabaseClient
        .from("players")
        .insert({
          name,
          team_id:teamId,
          jersey_number:
            number || null,
          position,
          photo_url,
          is_captain:isCaptain
        });


    if(error) throw error;


    document.getElementById(
      "playerName"
    ).value = "";


    document.getElementById(
      "playerNumber"
    ).value = "";


    document.getElementById(
      "playerPhotoFile"
    ).value = "";


    document.getElementById(
      "playerCaptain"
    ).checked = false;


    toast(
      "Igrač je dodat."
    );


    await loadAll();

  }catch(error){

    alert(error.message);
  }
}


/* =========================================================
   ADMIN - MATCH
========================================================= */

async function addMatch(){

  if(!isAdmin()){

    alert(
      "Nemaš admin ovlaštenje."
    );

    return;
  }


  const home =
    document
      .getElementById("matchHome")
      .value;


  const away =
    document
      .getElementById("matchAway")
      .value;


  const date =
    document
      .getElementById("matchDate")
      .value;


  const round =
    document
      .getElementById("matchRound")
      .value;


  if(!home || !away || !date){

    alert(
      "Popuni sva polja."
    );

    return;
  }


  if(home === away){

    alert(
      "Domaćin i gost ne mogu biti ista ekipa."
    );

    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("matches")
      .insert({
        home_team_id:home,
        away_team_id:away,
        match_date:
          new Date(date).toISOString(),
        round:
          round || null,
        home_score:0,
        away_score:0,
        status:"scheduled",
        current_minute:0
      });


  if(error){

    alert(error.message);

    return;
  }


  document.getElementById(
    "matchDate"
  ).value = "";


  document.getElementById(
    "matchRound"
  ).value = "";


  toast(
    "Utakmica je dodana."
  );


  await loadAll();
}


/* =========================================================
   ADMIN MATCHES
========================================================= */

function renderAdminMatches(){

  const container =
    document.getElementById(
      "adminMatches"
    );

  if(!container) return;


  if(!isAdmin()){

    container.innerHTML = `
      <div class="empty">
        Admin panel je dostupan samo administratoru.
      </div>
    `;

    return;
  }


  container.innerHTML =

    matches.length

      ? matches
          .map(m => `

            <div class="admin-match">

              <div class="admin-match-top">

                <strong>

                  ${esc(
                    teamName(
                      m.home_team_id
                    )
                  )}

                  ${m.home_score || 0}
                  :
                  ${m.away_score || 0}

                  ${esc(
                    teamName(
                      m.away_team_id
                    )
                  )}

                </strong>

                <span class="muted">
                  ${formatDate(
                    m.match_date
                  )}
                </span>

              </div>


              <div class="admin-controls">

                <select
                  onchange="
                    changeMatchStatus(
                      '${m.id}',
                      this.value
                    )
                  ">

                  <option
                    value="scheduled"
                    ${
                      m.status ===
                      "scheduled"
                        ? "selected"
                        : ""
                    }>
                    Zakazana
                  </option>

                  <option
                    value="live"
                    ${
                      m.status ===
                      "live"
                        ? "selected"
                        : ""
                    }>
                    Uživo
                  </option>

                  <option
                    value="finished"
                    ${
                      m.status ===
                      "finished"
                        ? "selected"
                        : ""
                    }>
                    Završena
                  </option>

                </select>


                <input
                  type="number"
                  min="0"
                  value="${
                    m.current_minute || 0
                  }"
                  onchange="
                    changeMinute(
                      '${m.id}',
                      this.value
                    )
                  "
                  title="Minuta">


                <button
                  class="btn btn-green btn-small"
                  onclick="
                    openGoalControl(
                      '${m.id}'
                    )
                  ">
                  ⚽ Gol
                </button>


                <button
                  class="btn btn-yellow btn-small"
                  onclick="
                    openCardControl(
                      '${m.id}'
                    )
                  ">
                  🟨 Karton
                </button>


                <button
                  class="btn btn-blue btn-small"
                  onclick="
                    openLineupControl(
                      '${m.id}'
                    )
                  ">
                  👥 Postava
                </button>


                ${
                  m.status === "live"
                    ? `
                      <button
                        class="btn btn-small"
                        onclick="
                          openSubstitutionControl(
                            '${m.id}'
                          )
                        ">
                        🔄 Izmjena
                      </button>
                    `
                    : ""
                }


                <button
                  class="btn btn-small"
                  onclick="
                    openMatch(
                      '${m.id}'
                    )
                  ">
                  👁️ Pogledaj
                </button>

              </div>

            </div>

          `)
          .join("")

      : `
        <div class="empty">
          Nema utakmica.
        </div>
      `;
}


/* =========================================================
   MATCH STATUS
========================================================= */

async function changeMatchStatus(
  id,
  status
){

  if(!canManageMatch()) return;


  const existing=getMatch(id);
  const patch={status};
  if(status==="live" && existing?.status!=="live") patch.live_started_at=new Date().toISOString();
  else if(status!=="live" && existing?.status==="live") patch.live_started_at=null;
  const {error}=await supabaseClient.from("matches").update(patch).eq("id",id);


  if(error){

    alert(error.message);

    return;
  }


  await loadAll();
}


/* =========================================================
   MATCH MINUTE
========================================================= */

async function changeMinute(
  id,
  minute
){

  if(!canManageMatch()) return;


  const {
    error
  } =
    await supabaseClient
      .from("matches")
      .update({
        current_minute:
          Number(minute) || 0
      })
      .eq("id",id);


  if(error){

    alert(error.message);

    return;
  }


  await loadAll();
}


/* =========================================================
   LINEUP CONTROL
========================================================= */

async function openLineupControl(
  matchId
){

  if(!canManageMatch()){

    alert(
      "Nemaš admin ovlaštenje."
    );

    return;
  }


  const match =
    getMatch(matchId);


  if(!match) return;


  const homePlayers =
    players.filter(
      p =>
        p.team_id ===
        match.home_team_id
    );


  const awayPlayers =
    players.filter(
      p =>
        p.team_id ===
        match.away_team_id
    );


  const existing =
    matchPlayers.filter(
      mp =>
        String(mp.match_id) ===
        String(matchId)
    );


  function playerRows(list){

    return list
      .map(p => {

        const mp =
          existing.find(
            x =>
              String(x.player_id) ===
              String(p.id)
          );


        return `

          <div class="lineup-player">

            <input
              type="checkbox"
              class="registered-player"
              data-player="${p.id}"
              ${
                mp
                  ? "checked"
                  : ""
              }>


            <div>

              <strong>
                ${esc(p.name)}
                ${
                  p.is_captain
                    ? " ©️"
                    : ""
                }
              </strong>

              <small>
                #${p.jersey_number ?? "-"}
                ·
                ${esc(
                  p.position || "-"
                )}
              </small>

            </div>


            <label>

              <input
                type="checkbox"
                class="starting-player"
                data-player="${p.id}"
                ${
                  mp?.is_starting
                    ? "checked"
                    : ""
                }>

              Početna

            </label>


            <span class="badge">
              ${
                p.position ===
                "Golman"
                  ? "🧤"
                  : "⚽"
              }
            </span>

          </div>

        `;
      })
      .join("");
  }


  showModal(`

    <div class="modal-title">

      <h2>
        👥 Postava utakmice
      </h2>

      <p class="muted"
         style="margin-top:6px">

        ${esc(
          teamName(
            match.home_team_id
          )
        )}

        vs

        ${esc(
          teamName(
            match.away_team_id
          )
        )}

      </p>

    </div>


    <div class="grid grid-2">

      <div class="lineup-team">

        <h3>
          ${esc(
            teamName(
              match.home_team_id
            )
          )}
        </h3>

        ${playerRows(homePlayers)}

      </div>


      <div class="lineup-team">

        <h3>
          ${esc(
            teamName(
              match.away_team_id
            )
          )}
        </h3>

        ${playerRows(awayPlayers)}

      </div>

    </div>


    <div style="margin-top:18px">

      <p class="muted">

        ✓ Prijavljen = igrač može biti na klupi.
        <br>
        ⭐ Početna = jedan od prvih 5.

      </p>

    </div>


    <div class="actions"
         style="margin-top:18px">

      <button
        class="btn btn-green"
        onclick="
          saveLineup(
            '${matchId}'
          )
        ">
        💾 Sačuvaj postavu
      </button>

      <button
        class="btn"
        onclick="hideModal()">
        Odustani
      </button>

    </div>

  `);
}


/* =========================================================
   SAVE LINEUP
========================================================= */

async function saveLineup(
  matchId
){

  if(!canManageMatch()) return;


  const match =
    getMatch(matchId);


  if(!match) return;


  const registered =
    [
      ...document.querySelectorAll(
        ".registered-player:checked"
      )
    ]
    .map(
      x =>
        x.dataset.player
    );


  const starting =
    [
      ...document.querySelectorAll(
        ".starting-player:checked"
      )
    ]
    .map(
      x =>
        x.dataset.player
    );


  const homeStarting =
    starting.filter(
      id =>
        getPlayer(id)?.team_id ===
        match.home_team_id
    );


  const awayStarting =
    starting.filter(
      id =>
        getPlayer(id)?.team_id ===
        match.away_team_id
    );


  const homeRegistered =
    registered.filter(
      id =>
        getPlayer(id)?.team_id ===
        match.home_team_id
    );


  const awayRegistered =
    registered.filter(
      id =>
        getPlayer(id)?.team_id ===
        match.away_team_id
    );


  if(
    homeRegistered.length < 5 ||
    awayRegistered.length < 5
  ){

    alert(
      "Svaka ekipa mora imati najmanje 5 prijavljenih igrača."
    );

    return;
  }


  if(
    homeStarting.length !== 5 ||
    awayStarting.length !== 5
  ){

    alert(
      "Moraš izabrati tačno 5 početnih igrača za svaku ekipu."
    );

    return;
  }


  const homeGoalkeeper =
    homeStarting.some(
      id =>
        getPlayer(id)?.position ===
        "Golman"
    );


  const awayGoalkeeper =
    awayStarting.some(
      id =>
        getPlayer(id)?.position ===
        "Golman"
    );


  if(
    !homeGoalkeeper ||
    !awayGoalkeeper
  ){

    alert(
      "Početna petorka mora sadržati golmana za obje ekipe."
    );

    return;
  }


  /*
    Početni igrači moraju biti registrovani.
  */

  const startingNotRegistered =
    starting.filter(
      id =>
        !registered.includes(id)
    );


  if(startingNotRegistered.length){

    alert(
      "Svaki početni igrač mora biti označen kao prijavljen."
    );

    return;
  }


  const allStarting =
    [
      ...homeStarting,
      ...awayStarting
    ];


  const allRegistered =
    [
      ...new Set([
        ...homeRegistered,
        ...awayRegistered
      ])
    ];


  const rows =
    allRegistered.map(
      player_id => ({
        match_id:matchId,
        player_id,
        is_starting:
          allStarting.includes(
            player_id
          ),
        is_active:
          allStarting.includes(
            player_id
          )
      })
    );


  const {
    error:deleteError
  } =
    await supabaseClient
      .from("match_players")
      .delete()
      .eq("match_id",matchId);


  if(deleteError){

    alert(
      deleteError.message
    );

    return;
  }


  const {
    error:insertError
  } =
    await supabaseClient
      .from("match_players")
      .insert(rows);


  if(insertError){

    alert(
      insertError.message
    );

    return;
  }


  hideModal();


  toast(
    "Postava je sačuvana."
  );


  await loadAll();
}


/* =========================================================
   SUBSTITUTIONS
========================================================= */

async function openSubstitutionControl(
  matchId
){

  if(!canManageMatch()) return;


  const match =
    getMatch(matchId);


  if(!match) return;


  const registered =
    matchPlayers.filter(
      mp =>
        String(mp.match_id) ===
        String(matchId)
    );


  function makeOptions(
    teamId,
    active
  ){

    return registered
      .filter(mp => {

        const p =
          getPlayer(
            mp.player_id
          );


        if(
          !p ||
          p.team_id !== teamId
        ){
          return false;
        }


        return active
          ? mp.is_active
          : !mp.is_active;
      })
      .map(mp => {

        const p =
          getPlayer(
            mp.player_id
          );


        return `
          <option value="${p.id}">
            #${p.jersey_number ?? "-"}
            ${esc(p.name)}
          </option>
        `;
      })
      .join("");
  }


  showModal(`

    <div class="modal-title">

      <h2>
        🔄 Izmjena igrača
      </h2>

      <p class="muted">
        Izaberi igrača koji izlazi
        i igrača koji ulazi.
      </p>

    </div>


    <div class="grid grid-2">

      <div class="card">

        <h3>
          ${esc(
            teamName(
              match.home_team_id
            )
          )}
        </h3>


        <div
          class="form"
          style="margin-top:12px">

          <div class="form-group">

            <label>
              Izlazi
            </label>

            <select id="subHomeOut">

              ${makeOptions(
                match.home_team_id,
                true
              )}

            </select>

          </div>


          <div class="form-group">

            <label>
              Ulazi
            </label>

            <select id="subHomeIn">

              ${makeOptions(
                match.home_team_id,
                false
              )}

            </select>

          </div>


          <button
            class="btn btn-green"
            onclick="
              makeSubstitution(
                '${matchId}',
                'home'
              )
            ">
            🔄 Potvrdi izmjenu
          </button>

        </div>

      </div>


      <div class="card">

        <h3>
          ${esc(
            teamName(
              match.away_team_id
            )
          )}
        </h3>


        <div
          class="form"
          style="margin-top:12px">

          <div class="form-group">

            <label>
              Izlazi
            </label>

            <select id="subAwayOut">

              ${makeOptions(
                match.away_team_id,
                true
              )}

            </select>

          </div>


          <div class="form-group">

            <label>
              Ulazi
            </label>

            <select id="subAwayIn">

              ${makeOptions(
                match.away_team_id,
                false
              )}

            </select>

          </div>


          <button
            class="btn btn-green"
            onclick="
              makeSubstitution(
                '${matchId}',
                'away'
              )
            ">
            🔄 Potvrdi izmjenu
          </button>

        </div>

      </div>

    </div>

  `);
}


/* =========================================================
   MAKE SUBSTITUTION
========================================================= */

async function makeSubstitution(
  matchId,
  side
){

  if(!canManageMatch()) return;


  const outEl =
    document.getElementById(
      side === "home"
        ? "subHomeOut"
        : "subAwayOut"
    );


  const inEl =
    document.getElementById(
      side === "home"
        ? "subHomeIn"
        : "subAwayIn"
    );


  const out =
    outEl?.value;


  const incoming =
    inEl?.value;


  if(!out || !incoming){

    alert(
      "Izaberi oba igrača."
    );

    return;
  }


  if(out === incoming){

    alert(
      "Igrač koji izlazi i igrač koji ulazi moraju biti različiti."
    );

    return;
  }


  const {
    error:outError
  } =
    await supabaseClient
      .from("match_players")
      .update({
        is_active:false
      })
      .eq("match_id",matchId)
      .eq("player_id",out);


  if(outError){

    alert(
      outError.message
    );

    return;
  }


  const {
    error:inError
  } =
    await supabaseClient
      .from("match_players")
      .update({
        is_active:true
      })
      .eq("match_id",matchId)
      .eq("player_id",incoming);


  if(inError){

    alert(
      inError.message
    );

    return;
  }


  hideModal();


  toast(
    "Izmjena je evidentirana."
  );


  await loadAll();


  if(
    String(currentMatchId) ===
    String(matchId)
  ){

    openMatch(matchId);
  }
}


/* =========================================================
   LINEUP / BENCH
========================================================= */

function getMatchLineup(
  matchId,
  teamId
){

  return matchPlayers
    .filter(
      mp =>
        String(mp.match_id) ===
        String(matchId) &&
        mp.is_active
    )
    .map(
      mp =>
        getPlayer(
          mp.player_id
        )
    )
    .filter(Boolean)
    .filter(
      p =>
        p.team_id === teamId
    );
}


function getBench(
  matchId,
  teamId
){

  return matchPlayers
    .filter(
      mp =>
        String(mp.match_id) ===
        String(matchId) &&
        !mp.is_active
    )
    .map(
      mp =>
        getPlayer(
          mp.player_id
        )
    )
    .filter(Boolean)
    .filter(
      p =>
        p.team_id === teamId
    );
}


/* =========================================================
   COURT
========================================================= */

function courtPlayer(
  player,
  left,
  top
){

  const goalkeeper =
    player.position ===
    "Golman";


  return `

    <div
      class="
        player-on-court
        ${goalkeeper ? "goalkeeper" : ""}
      "
      style="
        left:${left}%;
        top:${top}%;
      ">

      <div class="player-circle">
        ${player.jersey_number ?? "?"}
      </div>

      <div class="player-court-name">

        ${esc(player.name)}

        ${
          player.is_captain
            ? " ©️"
            : ""
        }

      </div>

      <div class="player-court-number">
        ${esc(
          player.position || ""
        )}
      </div>

    </div>

  `;
}


function renderCourtPlayers(
  match,
  homePlayers,
  awayPlayers
){

  function arrange(
    list,
    side
  ){

    const goalkeeper =
      list.find(
        p =>
          p.position ===
          "Golman"
      );


    const others =
      list.filter(
        p =>
          p.id !==
          goalkeeper?.id
      );


    const positions =
      side === "home"

        ? [
            [9,50],
            [28,24],
            [28,76],
            [43,37],
            [43,63]
          ]

        : [
            [91,50],
            [72,24],
            [72,76],
            [57,37],
            [57,63]
          ];


    let result = "";


    if(goalkeeper){

      result +=
        courtPlayer(
          goalkeeper,
          positions[0][0],
          positions[0][1]
        );
    }


    others
      .slice(0,4)
      .forEach(
        (p,i) => {

          const pos =
            positions[i+1];


          result +=
            courtPlayer(
              p,
              pos[0],
              pos[1]
            );
        }
      );


    return result;
  }


  return `
    ${arrange(
      homePlayers,
      "home"
    )}

    ${arrange(
      awayPlayers,
      "away"
    )}
  `;
}


function benchHTML(
  matchId,
  teamId
){

  const active =
    getMatchLineup(
      matchId,
      teamId
    );


  const bench =
    getBench(
      matchId,
      teamId
    );


  const all =
    [
      ...active,
      ...bench
    ];


  if(!all.length){

    return `

      <div class="bench">

        <h3>
          ${esc(
            teamName(teamId)
          )}
        </h3>

        <p class="muted">
          Postava još nije unesena.
        </p>

      </div>

    `;
  }


  return `

    <div class="bench">

      <h3>
        ${esc(
          teamName(teamId)
        )}
      </h3>

      <p
        class="muted"
        style="margin-bottom:10px">

        ${active.length}
        trenutno na terenu
        ·
        ${bench.length}
        izmjena

      </p>


      ${
        all
          .map(p => {

            const isActive =
              active.some(
                x =>
                  x.id === p.id
              );


            return `

              <div
                class="
                  bench-player
                  ${isActive ? "active" : ""}
                ">

                <img
                  src="${playerPhoto(p)}">


                <div class="player-info">

                  <strong>

                    #${p.jersey_number ?? "-"}

                    ${esc(p.name)}

                    ${
                      p.is_captain
                        ? " ©️"
                        : ""
                    }

                  </strong>


                  <small>

                    ${esc(
                      p.position || "-"
                    )}

                    ${
                      isActive
                        ? " · 🟢 Igra"
                        : " · Klupa"
                    }

                  </small>

                </div>

              </div>

            `;
          })
          .join("")
      }

    </div>

  `;
}


/* =========================================================
   MATCH EVENTS
========================================================= */

function getMatchEvents(id){

  const events = [];


  goals
    .filter(
      g =>
        String(g.match_id) ===
        String(id)
    )
    .forEach(g => {

      events.push({
        minute:Number(
          g.minute || 0
        ),
        icon:"⚽",
        text:
          `${playerName(
            g.player_id
          )}${g.assist_player_id ? ` · 🎯 asistencija: ${playerName(g.assist_player_id)}` : ""} · Gol`,
        type:"goal"
      });

    });


  cards
    .filter(
      c =>
        String(c.match_id) ===
        String(id)
    )
    .forEach(c => {

      events.push({
        minute:Number(
          c.minute || 0
        ),
        icon:
          c.card_type === "red"
            ? "🟥"
            : "🟨",
        text:
          `${playerName(
            c.player_id
          )} · ${
            c.card_type ||
            "Karton"
          }`,
        type:"card"
      });

    });


  events.sort(
    (a,b) =>
      a.minute - b.minute
  );


  return events;
}


/* =========================================================
   MATCH TABS
========================================================= */

function switchMatchTab(
  name
){

  document
    .querySelectorAll(
      ".match-tab"
    )
    .forEach(
      x =>
        x.classList.toggle(
          "active",
          x.dataset.tab ===
          name
        )
    );


  document
    .querySelectorAll(
      ".match-panel"
    )
    .forEach(
      x =>
        x.classList.toggle(
          "active",
          x.id ===
          `match-panel-${name}`
        )
    );
}


/* =========================================================
   OPEN MATCH
========================================================= */

function getLiveElapsedSeconds(match){
  if(!match || match.status !== "live") return 0;
  if(match.live_started_at){
    const start=Date.parse(match.live_started_at);
    if(Number.isFinite(start)) return Math.max(0,Math.floor((Date.now()-start)/1000));
  }
  return Math.max(0,Number(match.current_minute||0)*60);
}
function formatLiveClock(totalSeconds){
  const s=Math.max(0,Math.floor(Number(totalSeconds)||0));
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return h>0?String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0"):String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");
}
function getLiveMinute(match){return Math.floor(getLiveElapsedSeconds(match)/60);}
function openMatch(id){

  currentMatchId = id;


  const match =
    getMatch(id);


  if(!match) return;


  const home =
    getTeam(
      match.home_team_id
    );


  const away =
    getTeam(
      match.away_team_id
    );


  const hp =
    getMatchLineup(
      id,
      match.home_team_id
    );


  const ap =
    getMatchLineup(
      id,
      match.away_team_id
    );


  const events =
    getMatchEvents(id);


  const hGoals =
    goals.filter(
      g =>
        String(g.match_id) ===
        String(id) &&
        getPlayer(
          g.player_id
        )?.team_id ===
        match.home_team_id
    ).length;


  const aGoals =
    goals.filter(
      g =>
        String(g.match_id) ===
        String(id) &&
        getPlayer(
          g.player_id
        )?.team_id ===
        match.away_team_id
    ).length;


  const hCards =
    cards.filter(
      c =>
        String(c.match_id) ===
        String(id) &&
        getPlayer(
          c.player_id
        )?.team_id ===
        match.home_team_id
    ).length;


  const aCards =
    cards.filter(
      c =>
        String(c.match_id) ===
        String(id) &&
        getPlayer(
          c.player_id
        )?.team_id ===
        match.away_team_id
    ).length;


  const hAssists = goals.filter(g =>
    String(g.match_id) === String(id) &&
    g.assist_player_id &&
    getPlayer(g.assist_player_id)?.team_id === match.home_team_id
  ).length;

  const aAssists = goals.filter(g =>
    String(g.match_id) === String(id) &&
    g.assist_player_id &&
    getPlayer(g.assist_player_id)?.team_id === match.away_team_id
  ).length;

  const hPlayers = matchPlayers.filter(mp =>
    String(mp.match_id) === String(id) &&
    getPlayer(mp.player_id)?.team_id === match.home_team_id
  ).length;

  const aPlayers = matchPlayers.filter(mp =>
    String(mp.match_id) === String(id) &&
    getPlayer(mp.player_id)?.team_id === match.away_team_id
  ).length;


  showModal(`

    <div class="live-header">

      <div class="live-scoreboard">

        <div class="live-team">

          <img
            src="${teamLogo(home)}">

          <div class="live-team-name">
            ${esc(
              home?.name || ""
            )}
          </div>

        </div>


        <div>

          <div
            class="
              status
              ${
                match.status ===
                "live"
                  ? "live"
                  : ""
              }
            ">

            ${
              match.status ===
              "live"

                ? "● UŽIVO"

                : match.status ===
                  "finished"

                  ? "ZAVRŠENO"

                  : "ZAKAZANO"
            }

          </div>


          <div class="live-score">

            ${match.home_score || 0}
            :
            ${match.away_score || 0}

          </div>


          <div class="live-time">

            ${
              match.status ===
              "live"

                ? formatLiveClock(getLiveElapsedSeconds(match))

                : formatDate(
                    match.match_date
                  )
            }

          </div>


          ${
            match.round
              ? `
                <div
                  class="round-badge">
                  ${esc(
                    String(
                      match.round
                    )
                  )}. kolo
                </div>
              `
              : ""
          }

        </div>


        <div class="live-team">

          <img
            src="${teamLogo(away)}">

          <div class="live-team-name">
            ${esc(
              away?.name || ""
            )}
          </div>

        </div>

      </div>

    </div>


    <div class="match-tabs">

      <button
        class="match-tab active"
        data-tab="overview"
        onclick="
          switchMatchTab(
            'overview'
          )
        ">
        Pregled
      </button>


      <button
        class="match-tab"
        data-tab="lineup"
        onclick="
          switchMatchTab(
            'lineup'
          )
        ">
        Postave
      </button>


      <button
        class="match-tab"
        data-tab="events"
        onclick="
          switchMatchTab(
            'events'
          )
        ">
        Događaji
      </button>


      <button
        class="match-tab"
        data-tab="stats"
        onclick="
          switchMatchTab(
            'stats'
          )
        ">
        Statistika
      </button>

    </div>


    <!-- OVERVIEW -->

    <div
      id="match-panel-overview"
      class="match-panel active">

      <div class="grid grid-2">

        <div class="card">

          <div class="muted">
            Rezultat
          </div>

          <div
            style="
              font-size:32px;
              font-weight:950;
              margin-top:5px;
            ">

            ${match.home_score || 0}
            :
            ${match.away_score || 0}

          </div>

          <div
            class="muted"
            style="margin-top:5px">

            ⚽ Golovi:
            ${hGoals}
            —
            ${aGoals}

          </div>

        </div>


        <div class="card">

          <div class="muted">
            Informacije
          </div>

          <div
            style="margin-top:7px">

            📅
            ${formatDate(
              match.match_date
            )}

          </div>

          <div
            class="muted"
            style="margin-top:6px">

            🏆
            ${
              match.round
                ? `${match.round}. kolo`
                : "Kolo nije uneseno"
            }

          </div>

        </div>

      </div>


      <div
        class="timeline">

        <h3 style="margin-bottom:8px">
          📋 Posljednja dešavanja
        </h3>

        ${
          events.length

            ? events
                .slice(-5)
                .reverse()
                .map(
                  e => `

                    <div class="event">

                      <div class="event-minute">
                        ${e.minute}:${String(Number(e.second||0)).padStart(2,"0")}
                      </div>

                      <div class="event-icon">
                        ${e.icon}
                      </div>

                      <div>
                        ${esc(e.text)}
                      </div>

                    </div>

                  `
                )
                .join("")

            : `
              <div class="empty">
                Još nema dešavanja.
              </div>
            `
        }

      </div>

    </div>


    <!-- LINEUP -->

    <div
      id="match-panel-lineup"
      class="match-panel">

      ${
        hp.length >= 5 &&
        ap.length >= 5

          ? `

            <div class="court-wrap">

              <div class="court">

                <div
                  class="court-line center-line">
                </div>

                <div
                  class="center-circle">
                </div>

                <div
                  class="
                    court-line
                    penalty-left
                  ">
                </div>

                <div
                  class="
                    court-line
                    penalty-right
                  ">
                </div>

                <div class="goal-left"></div>
                <div class="goal-right"></div>


                <div
                  class="
                    court-team-label
                    left
                  ">
                  ${esc(
                    home?.name || ""
                  )}
                </div>


                <div
                  class="
                    court-team-label
                    right
                  ">
                  ${esc(
                    away?.name || ""
                  )}
                </div>


                ${renderCourtPlayers(
                  match,
                  hp,
                  ap
                )}

              </div>

            </div>


            <div class="bench-grid">

              ${benchHTML(
                id,
                match.home_team_id
              )}

              ${benchHTML(
                id,
                match.away_team_id
              )}

            </div>

          `

          : `

            <div class="empty">

              <div
                style="
                  font-size:35px;
                  margin-bottom:10px;
                ">
                👥
              </div>

              <strong>
                Postave još nisu unesene.
              </strong>

              <p
                class="muted"
                style="margin-top:6px">

                Administrator može postaviti
                početnih 5 i prijavljene igrače.

              </p>

            </div>

          `
      }

    </div>


    <!-- EVENTS -->

    <div
      id="match-panel-events"
      class="match-panel">

      <div class="timeline">

        ${
          events.length

            ? events
                .map(
                  e => `

                    <div class="event">

                      <div class="event-minute">
                        ${e.minute}:${String(Number(e.second||0)).padStart(2,"0")}
                      </div>

                      <div class="event-icon">
                        ${e.icon}
                      </div>

                      <div>
                        ${esc(e.text)}
                      </div>

                    </div>

                  `
                )
                .join("")

            : `
              <div class="empty">
                Još nema dešavanja.
              </div>
            `
        }

      </div>

    </div>


    <!-- STATS -->

    <div
      id="match-panel-stats"
      class="match-panel">

      <div class="grid grid-2">

        <div class="card">

          <div class="muted">
            Golovi
          </div>

          <div
            style="
              font-size:28px;
              font-weight:950;
              margin:5px 0;
            ">

            ${hGoals}
            —
            ${aGoals}

          </div>

          <div class="muted">

            ${esc(
              home?.name || ""
            )}

            —

            ${esc(
              away?.name || ""
            )}

          </div>

        </div>


        <div class="card">

          <div class="muted">
            Kartoni
          </div>

          <div
            style="
              font-size:28px;
              font-weight:950;
              margin:5px 0;
            ">

            ${hCards}
            —
            ${aCards}

          </div>

          <div class="muted">
            🟨 + 🟥
          </div>

        </div>

      </div>

      <div class="grid grid-3" style="margin-top:15px">

        <div class="card stat">
          <div class="stat-number">${hAssists} — ${aAssists}</div>
          <div class="stat-label">🎯 Asistencije</div>
        </div>

        <div class="card stat">
          <div class="stat-number">${hPlayers} — ${aPlayers}</div>
          <div class="stat-label">👥 Evidentirani igrači</div>
        </div>

        <div class="card stat">
          <div class="stat-number">${events.length}</div>
          <div class="stat-label">📋 Ukupno događaja</div>
        </div>

        </div>

      </div>

    </div>


    ${
      isAdmin()

        ? `

          <div
            class="actions"
            style="margin-top:18px">

            <button
              class="btn btn-blue"
              onclick="
                openLineupControl(
                  '${id}'
                )
              ">
              👥 Uredi postavu
            </button>


            ${
              match.status ===
              "live"

                ? `
                  <button
                    class="btn"
                    onclick="
                      openSubstitutionControl(
                        '${id}'
                      )
                    ">
                    🔄 Izmjena
                  </button>
                `
                : ""
            }


            <button
              class="btn btn-green"
              onclick="
                openGoalControl(
                  '${id}'
                )
              ">
              ⚽ Gol
            </button>


            <button
              class="btn btn-yellow"
              onclick="
                openCardControl(
                  '${id}'
                )
              ">
              🟨 Karton
            </button>

          </div>

        `

        : ""
    }

  `);


  startLiveRefresh(id);
}


/* =========================================================
   LIVE AUTO REFRESH
========================================================= */

function startLiveRefresh(
  matchId
){
  clearInterval(window.__medjasiLiveClock);
  window.__medjasiLiveClock=setInterval(()=>{
    const current=getMatch(matchId);
    if(!current || current.status!=="live"){
      clearInterval(window.__medjasiLiveClock);
      return;
    }
    const el=document.querySelector(".live-time");
    if(el) el.textContent=formatLiveClock(getLiveElapsedSeconds(current));
  },1000);

  clearInterval(
    liveRefreshInterval
  );


  const match =
    getMatch(matchId);


  if(
    !match ||
    match.status !== "live"
  ){
    return;
  }


  liveRefreshInterval =
    setInterval(
      async()=>{

        await loadAll();


        const updated =
          getMatch(matchId);


        if(!updated){

          clearInterval(
            liveRefreshInterval
          );

          return;
        }


        if(
          updated.status !==
          "live"
        ){

          clearInterval(
            liveRefreshInterval
          );

          return;
        }


        /*
          Ponovo otvorimo samo ako je modal
          još uvijek otvoren.
        */

        if(
          document
            .getElementById("modal")
            ?.classList
            .contains("active")
        ){

          openMatch(matchId);
        }

      },
      10000
    );
}


/* =========================================================
   GOAL CONTROL
========================================================= */

function openGoalControl(
  matchId
){

  if(!canManageMatch()) return;


  const match =
    getMatch(matchId);


  if(!match) return;


  const registered =
    matchPlayers
      .filter(
        mp =>
          String(mp.match_id) ===
          String(matchId)
      )
      .map(
        mp =>
          getPlayer(
            mp.player_id
          )
      )
      .filter(Boolean);


  if(!registered.length){

    alert(
      "Prvo unesi postavu utakmice."
    );

    return;
  }


  showModal(`

    <div class="modal-title">

      <h2>
        ⚽ Dodaj gol
      </h2>

    </div>


    <div class="form">

      <div class="form-group">

        <label>
          Strijelac
        </label>

        <select id="goalPlayer">

          ${registered
            .map(
              p => `

                <option value="${p.id}">

                  ${esc(
                    teamName(
                      p.team_id
                    )
                  )}

                  ·

                  #${p.jersey_number ?? "-"}

                  ·

                  ${esc(p.name)}

                </option>

              `
            )
            .join("")}

        </select>

      </div>


      <div class="form-group">

        <label>Vrijeme gola</label>
<div class="goal-time-grid">
<input id="goalMinute" type="number" min="0" value="${match.status==="live" ? getLiveMinute(match) : (match.current_minute || 0)}" aria-label="Minuta gola">
<input id="goalSecond" type="number" min="0" max="59" value="${match.status==="live" ? getLiveElapsedSeconds(match)%60 : 0}" aria-label="Sekunda gola">
</div>


      <button
        class="btn btn-green"
        onclick="
          addGoal(
            '${matchId}'
          )
        ">
        ⚽ Dodaj gol
      </button>

    </div>

  `);
}


/* =========================================================
   ADD GOAL
========================================================= */

async function addGoal(
  matchId
){

  if(!canManageMatch()) return;


  const match =
    getMatch(matchId);


  const player_id =
    document.getElementById(
      "goalPlayer"
    )?.value;


  const minute =
    Number(
      document.getElementById(
        "goalMinute"
      )?.value
    ) || 0;

  const second=Math.max(0,Math.min(59,Number(document.getElementById("goalSecond")?.value)||0));


  const player =
    getPlayer(player_id);


  if(!player){

    alert(
      "Izaberi igrača."
    );

    return;
  }


  if(
    player.team_id !==
      match.home_team_id &&
    player.team_id !==
      match.away_team_id
  ){

    alert(
      "Igrač ne pripada ekipama u ovoj utakmici."
    );

    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("goals")
      .insert({
        match_id:matchId,
        player_id,
         minute,
         second
       });


  if(error){

    alert(error.message);

    return;
  }


  const update = {};


  if(
    player.team_id ===
    match.home_team_id
  ){

    update.home_score =
      Number(
        match.home_score || 0
      ) + 1;

  }else if(
    player.team_id ===
    match.away_team_id
  ){

    update.away_score =
      Number(
        match.away_score || 0
      ) + 1;
  }


  const {
    error:updateError
  } =
    await supabaseClient
      .from("matches")
      .update(update)
      .eq("id",matchId);


  if(updateError){

    alert(
      updateError.message
    );

    return;
  }


  hideModal();


  toast(
    "Gol je evidentiran."
  );


  await loadAll();


  openMatch(matchId);
}


/* =========================================================
   CARD CONTROL
========================================================= */

function openCardControl(
  matchId
){

  if(!canManageMatch()) return;


  const match =
    getMatch(matchId);


  if(!match) return;


  const registered =
    matchPlayers
      .filter(
        mp =>
          String(mp.match_id) ===
          String(matchId)
      )
      .map(
        mp =>
          getPlayer(
            mp.player_id
          )
      )
      .filter(Boolean);


  if(!registered.length){

    alert(
      "Prvo unesi postavu utakmice."
    );

    return;
  }


  showModal(`

    <div class="modal-title">

      <h2>
        🟨 Dodaj karton
      </h2>

    </div>


    <div class="form">

      <div class="form-group">

        <label>
          Igrač
        </label>

        <select id="cardPlayer">

          ${registered
            .map(
              p => `

                <option value="${p.id}">

                  ${esc(
                    teamName(
                      p.team_id
                    )
                  )}

                  ·

                  #${p.jersey_number ?? "-"}

                  ·

                  ${esc(p.name)}

                </option>

              `
            )
            .join("")}

        </select>

      </div>


      <div class="form-group">

        <label>
          Tip kartona
        </label>

        <select id="cardType">

          <option value="yellow">
            🟨 Žuti
          </option>

          <option value="red">
            🟥 Crveni
          </option>

        </select>

      </div>


      <div class="form-group">

        <label>
          Minuta
        </label>

        <input
          id="cardMinute"
          type="number"
          min="0"
          value="${
            match.current_minute || 0
          }">

      </div>


      <button
        class="btn btn-yellow"
        onclick="
          addCard(
            '${matchId}'
          )
        ">
        Dodaj karton
      </button>

    </div>

  `);
}


/* =========================================================
   ADD CARD
========================================================= */

async function addCard(
  matchId
){

  if(!canManageMatch()) return;


  const player_id =
    document.getElementById(
      "cardPlayer"
    )?.value;


  const card_type =
    document.getElementById(
      "cardType"
    )?.value;


  const minute =
    Number(
      document.getElementById(
        "cardMinute"
      )?.value
    ) || 0;


  if(!player_id){

    alert(
      "Izaberi igrača."
    );

    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("cards")
      .insert({
        match_id:matchId,
        player_id,
        card_type,
        minute
      });


  if(error){

    alert(error.message);

    return;
  }


  hideModal();


  toast(
    "Karton je evidentiran."
  );


  await loadAll();


  openMatch(matchId);
}


/* =========================================================
   TEAM MODAL
========================================================= */

function openTeam(
  teamId
){

  const team =
    getTeam(teamId);


  if(!team) return;


  const teamPlayers =
    players.filter(
      p =>
        p.team_id ===
        teamId
    );


  showModal(`

    <div class="modal-title">

      <div class="team-cover">

        <img
          src="${teamLogo(team)}">

        <div>

          <h2>
            ${esc(team.name)}
          </h2>

          <p class="muted">
            ${teamPlayers.length}
            igrača
            ${team.coach ? ` • Trener: ${esc(team.coach)}` : ""}
          </p>

        </div>

      </div>

    </div>


    ${
      teamPlayers.length

        ? `

          <div class="grid grid-2">

            ${teamPlayers
              .map(
                p => `

                  <div
                    class="card player-card"
                    onclick="
                      openPlayer(
                        '${p.id}'
                      )
                    ">

                    <img
                      class="player-photo"
                      src="${playerPhoto(p)}">


                    <div>

                      <strong>

                        #${p.jersey_number ?? "-"}

                        ${esc(p.name)}

                      </strong>


                      <div class="muted">

                        ${esc(
                          p.position || "-"
                        )}

                      </div>


                      ${
                        p.is_captain
                          ? `
                            <div
                              class="captain"
                              style="margin-top:4px">
                              ©️ Kapiten
                            </div>
                          `
                          : ""
                      }

                    </div>

                  </div>

                `
              )
              .join("")}

          </div>

        `

        : `
          <div class="empty">
            Ova ekipa još nema igrača.
          </div>
        `
    }

  `);
}


/* =========================================================
   PLAYER MODAL
========================================================= */

function openPlayer(
  playerId
){

  const p = getPlayer(playerId);
  if(!p) return;

  const team = getTeam(p.team_id);

  const playerGoals = goals.filter(g => g.player_id === playerId);
  const playerCards = cards.filter(c => c.player_id === playerId);
  const playerAssists = goals.filter(g => g.assist_player_id === playerId);

  const playerAppearanceRows = matchPlayers.filter(
    mp => mp.player_id === playerId
  );

  const appearanceIds = new Set(
    playerAppearanceRows.map(mp => mp.match_id)
  );

  const appearances = appearanceIds.size;

  const playerMatches = matches
    .filter(m => appearanceIds.has(m.id))
    .sort((a,b) => new Date(b.match_date || 0) - new Date(a.match_date || 0));

  const lastMatches = playerMatches.slice(0,5);

  const getResultForTeam = match => {
    const home = String(match.home_team_id) === String(p.team_id);
    const gf = Number(home ? match.home_score : match.away_score);
    const ga = Number(home ? match.away_score : match.home_score);
    if(Number.isNaN(gf) || Number.isNaN(ga)) return {label:"—", cls:""};
    if(gf > ga) return {label:"P", cls:"win"};
    if(gf < ga) return {label:"I", cls:"loss"};
    return {label:"N", cls:"draw"};
  };

  const formHTML = lastMatches.length
    ? lastMatches.map(m => {
        const result = getResultForTeam(m);
        const home = String(m.home_team_id) === String(p.team_id);
        const opponentId = home ? m.away_team_id : m.home_team_id;
        const opponent = getTeam(opponentId);
        const gf = Number(home ? m.home_score : m.away_score);
        const ga = Number(home ? m.away_score : m.home_score);
        return `
          <div class="card" style="padding:11px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
              <div style="min-width:0">
                <strong>${esc(opponent?.name || "Nepoznata ekipa")}</strong>
                <div class="muted" style="font-size:12px;margin-top:3px">
                  ${formatDate(m.match_date)}
                </div>
              </div>
              <div style="text-align:right">
                <strong>${Number.isNaN(gf) || Number.isNaN(ga) ? "—" : `${gf}:${ga}`}</strong>
                <div class="muted" style="font-size:12px;margin-top:3px">${result.label === "P" ? "Pobjeda" : result.label === "N" ? "Neriješeno" : result.label === "I" ? "Poraz" : "Nema rezultata"}</div>
              </div>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="empty">Nema evidentiranih nastupa u utakmicama.</div>`;

  const goalRows = playerGoals.length
    ? playerGoals
        .slice()
        .sort((a,b) => Number(a.minute || 0) - Number(b.minute || 0))
        .map(g => {
          const m = getMatch(g.match_id);
          return `
            <div class="rank-row">
              <div class="rank-num">⚽</div>
              <div class="rank-avatar">
                <div>
                  <strong>${m ? `${esc(teamName(m.home_team_id))} – ${esc(teamName(m.away_team_id))}` : "Utakmica"}</strong>
                  <small>${g.minute != null ? `${esc(String(g.minute))}. minut` : "Minut nije unesen"}</small>
                </div>
              </div>
            </div>
          `;
        }).join("")
    : `<div class="empty">Nema evidentiranih golova.</div>`;

  const assistRows = playerAssists.length
    ? playerAssists
        .slice()
        .sort((a,b) => Number(a.minute || 0) - Number(b.minute || 0))
        .map(g => {
          const m = getMatch(g.match_id);
          const scorer = getPlayer(g.player_id);
          return `
            <div class="rank-row">
              <div class="rank-num">🎯</div>
              <div class="rank-avatar">
                <div>
                  <strong>${scorer ? esc(scorer.name) : "Strijelac"}</strong>
                  <small>${m ? `${esc(teamName(m.home_team_id))} – ${esc(teamName(m.away_team_id))}` : "Utakmica"}${g.minute != null ? ` • ${esc(String(g.minute))}. minut` : ""}</small>
                </div>
              </div>
            </div>
          `;
        }).join("")
    : `<div class="empty">Nema evidentiranih asistencija.</div>`;

  const cardRows = playerCards.length
    ? playerCards
        .slice()
        .sort((a,b) => Number(a.minute || 0) - Number(b.minute || 0))
        .map(c => {
          const m = getMatch(c.match_id);
          const icon = c.card_type === "red" ? "🟥" : "🟨";
          return `
            <div class="rank-row">
              <div class="rank-num">${icon}</div>
              <div class="rank-avatar">
                <div>
                  <strong>${c.card_type === "red" ? "Crveni karton" : "Žuti karton"}</strong>
                  <small>${m ? `${esc(teamName(m.home_team_id))} – ${esc(teamName(m.away_team_id))}` : "Utakmica"}${c.minute != null ? ` • ${esc(String(c.minute))}. minut` : ""}</small>
                </div>
              </div>
            </div>
          `;
        }).join("")
    : `<div class="empty">Nema evidentiranih kartona.</div>`;

  showModal(`
    <div class="player-card">
      <img
        class="player-photo"
        style="width:110px;height:110px"
        src="${playerPhoto(p)}">

      <div style="min-width:0;flex:1">
        <h2>${esc(p.name)}</h2>
        <p class="muted">${esc(team?.name || "")}</p>
        <div style="margin-top:7px">
          <span class="player-number">#${p.jersey_number ?? "-"}</span>
          <span class="badge">${esc(p.position || "-")}</span>
          ${p.is_captain ? `<span class="captain">©️ Kapiten</span>` : ""}
        </div>
      </div>
    </div>

    <div class="grid grid-3" style="margin-top:20px">
      <div class="card stat"><div class="stat-number">${playerGoals.length}</div><div class="stat-label">Golova</div></div>
      <div class="card stat"><div class="stat-number">${playerAssists.length}</div><div class="stat-label">Asistencija</div></div>
      <div class="card stat"><div class="stat-number">${appearances}</div><div class="stat-label">Nastupa</div></div>
    </div>

    <div class="grid grid-2" style="margin-top:18px">
      <div class="card">
        <h3 style="margin-bottom:13px">📈 Forma – posljednjih 5 nastupa</h3>
        ${formHTML}
      </div>

      <div class="card">
        <h3 style="margin-bottom:13px">⚽ Golovi</h3>
        <div class="rank-list">${goalRows}</div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:13px">🎯 Asistencije</h3>
        <div class="rank-list">${assistRows}</div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:13px">🟨 Kartoni</h3>
        <div class="rank-list">${cardRows}</div>
      </div>
    </div>
  `);
}

/* =========================================================
   DELETE TEAM
========================================================= */

async function deleteTeam(
  teamId
){

  if(!isAdmin()){

    alert(
      "Nemaš admin ovlaštenje."
    );

    return;
  }


  const team =
    getTeam(teamId);


  if(!team) return;


  if(
    !confirm(
      `Obrisati ekipu "${team.name}" i sve njene igrače i utakmice?`
    )
  ){
    return;
  }


  /*
    Koristi tvoju postojeću RPC funkciju.
  */

  const {
    error
  } =
    await supabaseClient
      .rpc(
        "delete_team_admin",
        {
          team_uuid:teamId
        }
      );


  if(error){

    alert(
      error.message
    );

    return;
  }


  toast(
    "Ekipa je obrisana."
  );


  await loadAll();
}


/* =========================================================
   SELECTS
========================================================= */

function fillTeamSelects(){

  const selects = [
    "playerTeam",
    "matchHome",
    "matchAway"
  ];


  selects.forEach(id => {

    const select =
      document.getElementById(id);


    if(!select) return;


    const old =
      select.value;


    let firstOption =
      "Izaberi ekipu";


    if(id === "playerTeam"){
      firstOption =
        "Izaberi ekipu";
    }


    if(
      id === "matchHome" ||
      id === "matchAway"
    ){
      firstOption =
        "Izaberi ekipu";
    }


    select.innerHTML =
      `<option value="">
        ${firstOption}
      </option>` +

      teams
        .map(
          t =>
            `<option value="${t.id}">
              ${esc(t.name)}
            </option>`
        )
        .join("");


    if(old){
      select.value = old;
    }

  });
}


/* =========================================================
   COMMENT COUNTER
========================================================= */

document.addEventListener(
  "input",
  event => {

    if(
      event.target?.id !==
      "commentText"
    ){
      return;
    }


    const counter =
      document.getElementById(
        "commentCounter"
      );


    if(counter){

      counter.textContent =
        `${event.target.value.length} / 1000`;
    }

  }
);


/* =========================================================
   REALTIME
========================================================= */

function subscribeRealtime(){

  try{

    if(realtimeChannel){

      supabaseClient
        .removeChannel(
          realtimeChannel
        );
    }


    realtimeChannel =
      supabaseClient
        .channel(
          "medjasi-live-v3"
        )


        .on(
          "postgres_changes",
          {
            event:"*",
            schema:"public",
            table:"matches"
          },
          () =>
            loadAll()
        )


        .on(
          "postgres_changes",
          {
            event:"*",
            schema:"public",
            table:"goals"
          },
          () =>
            loadAll()
        )


        .on(
          "postgres_changes",
          {
            event:"*",
            schema:"public",
            table:"cards"
          },
          () =>
            loadAll()
        )


        .on(
          "postgres_changes",
          {
            event:"*",
            schema:"public",
            table:"match_players"
          },
          () =>
            loadAll()
        )


        .on(
          "postgres_changes",
          {
            event:"*",
            schema:"public",
            table:"comments"
          },
          () =>
            loadAll()
        )


        .on(
          "postgres_changes",
          {
            event:"*",
            schema:"public",
            table:"messages"
          },
          () =>
            loadAll()
        )


        .on(
          "postgres_changes",
          {
            event:"*",
            schema:"public",
            table:"gallery"
          },
          () =>
            loadAll()
        )


        .on("postgres_changes",{event:"*",schema:"public",table:"site_settings"},()=>loadMusicSettings())
        .on("postgres_changes",{event:"*",schema:"public",table:"music_tracks"},()=>loadMusicSettings())
        .on("postgres_changes",{event:"*",schema:"public",table:"news"},()=>window.medjasiV7?.loadNews?.())


        .subscribe();

  }catch(error){

    console.warn(
      "Realtime nije aktivan:",
      error
    );
  }
}


/* =========================================================
   INIT
========================================================= */

async function init(){

  await checkAuth();
  await loadMusicSettings();

  await loadAll();

  subscribeRealtime();


  supabaseClient
    .auth
    .onAuthStateChange(
      async () => {

        await checkAuth();

        await loadAll();

        if(currentUser){
          showSection("home");
        }else{
          showSection("home");
        }

      }
    );


  /*
    Rezervno osvježavanje svakih 30 sekundi.
  */

  setInterval(
    async()=>{

      await loadAll();
      await loadMusicSettings();

    },
    30000
  );
}


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if(event.key === "Escape"){

      hideModal();

      clearInterval(
        liveRefreshInterval
      );
    }

  }
);


/* =========================================================
   START
========================================================= */

init();
  /* =========================================
   GLOBALNA YOUTUBE MUZIKA
========================================= */


/* -----------------------------------------
   PRETVARA YOUTUBE LINK U VIDEO ID
----------------------------------------- */

function getYoutubeId(url) {
  if (!url) return null;

  url = url.trim();

  // Ako je direktno unesen YouTube ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
    /youtube\.com\/shorts\/([^?&/]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}


/* -----------------------------------------
   UČITAJ POSTAVKE IZ SUPABASE
----------------------------------------- */

async function loadMusicSettings(){const {data:settings,error:se}=await supabaseClient.from("site_settings").select("youtube_music_enabled").eq("id",1).maybeSingle();if(se)console.error(se);musicSettings=settings||{youtube_music_enabled:false};const {data:tracks,error:te}=await supabaseClient.from("music_tracks").select("id,title,youtube_music_id,sort_order,is_active,created_at").eq("is_active",true).order("sort_order",{ascending:true}).order("created_at",{ascending:true});if(te){console.error(te);musicTracks=[];}else musicTracks=tracks||[];renderMusicAdmin();initMusic();}


/* -----------------------------------------
   PRIKAŽI POSTAVKE U ADMIN PANELU
----------------------------------------- */

function renderMusicAdmin(){const box=document.getElementById("adminMusicPlaylist"),status=document.getElementById("musicAdminStatus");if(!box)return;if(!isAdmin()){box.innerHTML="";return;}if(!musicTracks.length)box.innerHTML='<div class="empty compact">Playlist je prazna. Dodaj prvu YouTube pjesmu.</div>';else box.innerHTML=musicTracks.map((t,i)=>`<div class="playlist-row"><div class="playlist-num">${i+1}</div><div><strong>${esc(t.title||"YouTube pjesma")}</strong><small>${esc(t.youtube_music_id)}</small></div><div class="playlist-actions"><button class="btn btn-small" onclick="moveMusicTrack(${t.id},-1)">↑</button><button class="btn btn-small" onclick="moveMusicTrack(${t.id},1)">↓</button></div><button class="btn btn-red btn-small" onclick="deleteMusicTrack(${t.id})">Obriši</button></div>`).join("");if(status)status.textContent=musicSettings.youtube_music_enabled?`▶️ Playlist aktivna • ${musicTracks.length} pjesama`:`⏸️ Playlist zaustavljena • ${musicTracks.length} pjesama`;}


/* -----------------------------------------
   SAČUVAJ PJESMU
----------------------------------------- */




/* -----------------------------------------
   ADMIN - POKRENI
----------------------------------------- */




/* -----------------------------------------
   ADMIN - ZAUSTAVI
----------------------------------------- */




/* =========================================================
   MODERATOR + COMMENT IMAGES + MOBILE V2
========================================================= */

function toggleMobileMenu(){
  mobileMenuOpen=!mobileMenuOpen;
  const nav=document.getElementById("mainNav");
  const btn=document.getElementById("mobileMenuBtn");
  nav?.classList.toggle("mobile-open",mobileMenuOpen);
  if(btn){btn.textContent=mobileMenuOpen ? "✕" : "☰";btn.setAttribute("aria-expanded",String(mobileMenuOpen));}
}


function openMobileMore(){
  const drawer=document.getElementById("mobileMoreDrawer");
  if(!drawer) return;
  mobileMenuOpen=false;
  document.getElementById("mainNav")?.classList.remove("mobile-open");
  closeMobileMore();
  const topBtn=document.getElementById("mobileMenuBtn");
  if(topBtn){topBtn.textContent="☰";topBtn.setAttribute("aria-expanded","false");}
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden","false");
  document.body.classList.add("mobile-more-open");
}

function closeMobileMore(){
  const drawer=document.getElementById("mobileMoreDrawer");
  if(!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden","true");
  document.body.classList.remove("mobile-more-open");
}

function toggleMobileMore(){
  const drawer=document.getElementById("mobileMoreDrawer");
  if(drawer?.classList.contains("open")) closeMobileMore();
  else openMobileMore();
}

function mobileMoreGo(id){
  closeMobileMore();
  setTimeout(()=>showSection(id),40);
}

function setupCommentImageUI(){
  const textarea=document.getElementById("commentText");
  if(!textarea || textarea.dataset.imageUi==="1") return;

  textarea.dataset.imageUi="1";

  const row=document.createElement("div");
  row.className="comment-image-row";
  row.innerHTML=`
    <label class="btn btn-small comment-image-btn">
      🖼️ Dodaj sliku
      <input id="commentImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
    </label>
    <span id="commentImageName" class="muted">Nije odabrana slika</span>
    <button type="button" id="commentImageRemove" class="btn btn-red btn-small hidden">Ukloni</button>
    <div id="commentImagePreview" class="comment-image-preview hidden"></div>
  `;

  textarea.parentElement.appendChild(row);

  const input=row.querySelector("#commentImageFile");
  const remove=row.querySelector("#commentImageRemove");

  input.addEventListener("change",()=>{
    const file=input.files?.[0];
    if(!file){
      removeCommentImage();
      return;
    }
    if(!file.type.startsWith("image/") || file.size>5*1024*1024){
      alert("Slika mora biti JPG, PNG, WEBP ili GIF i imati najviše 5 MB.");
      input.value="";
      removeCommentImage();
      return;
    }

    row.querySelector("#commentImageName").textContent=file.name;
    remove.classList.remove("hidden");

    const preview=row.querySelector("#commentImagePreview");
    const url=URL.createObjectURL(file);
    preview.innerHTML=`<img src="${url}" alt="Pregled slike">`;
    preview.classList.remove("hidden");
    selectedCommentImage=file;
  });

  remove.addEventListener("click",removeCommentImage);
}

function removeCommentImage(){
  const input=document.getElementById("commentImageFile");
  const name=document.getElementById("commentImageName");
  const preview=document.getElementById("commentImagePreview");
  const remove=document.getElementById("commentImageRemove");

  selectedCommentImage=null;
  if(input) input.value="";
  if(name) name.textContent="Nije odabrana slika";
  if(preview){
    preview.innerHTML="";
    preview.classList.add("hidden");
  }
  remove?.classList.add("hidden");
}

async function addMusicTrack(){if(!isAdmin()){toast("Nemaš admin ovlaštenje.","error");return;}const input=document.getElementById("adminYoutubeUrl"),title=document.getElementById("adminYoutubeTitle"),id=getYoutubeId(input?.value||"");if(!id){toast("Unesi ispravan YouTube link.","error");return;}if(musicTracks.some(t=>t.youtube_music_id===id)){toast("Ta pjesma je već u playlisti.","error");return;}const next=Math.max(0,...musicTracks.map(t=>Number(t.sort_order)||0))+1;const {error}=await supabaseClient.from("music_tracks").insert({youtube_music_id:id,title:(title?.value||"").trim()||"YouTube pjesma",sort_order:next,is_active:true});if(error){toast(error.message,"error");return;}if(input)input.value="";if(title)title.value="";await loadMusicSettings();toast("Pjesma je dodata u playlistu.","success");}
async function deleteMusicTrack(id){if(!isAdmin())return;if(!confirm("Obrisati ovu pjesmu iz playliste?"))return;const {error}=await supabaseClient.from("music_tracks").delete().eq("id",id);if(error){toast(error.message,"error");return;}await loadMusicSettings();toast("Pjesma je obrisana.","success");}
async function moveMusicTrack(id,direction){if(!isAdmin())return;const list=[...musicTracks],idx=list.findIndex(t=>t.id===id),target=idx+direction;if(idx<0||target<0||target>=list.length)return;[list[idx],list[target]]=[list[target],list[idx]];for(let i=0;i<list.length;i++){const {error}=await supabaseClient.from("music_tracks").update({sort_order:i+1}).eq("id",list[i].id);if(error){toast(error.message,"error");return;}}await loadMusicSettings();}
async function toggleMusicPlaylist(enabled){if(!isAdmin()){toast("Nemaš admin ovlaštenje.","error");return;}if(enabled&&!musicTracks.length){toast("Prvo dodaj barem jednu pjesmu.","error");return;}const {error}=await supabaseClient.from("site_settings").update({youtube_music_enabled:enabled}).eq("id",1);if(error){toast(error.message,"error");return;}musicSettings.youtube_music_enabled=enabled;currentMusicSignature="";initMusic();renderMusicAdmin();toast(enabled?"Playlist je uključena.":"Muzika je zaustavljena.","success");}

async function loadModeratorUsers(){
  if(!isAdmin()) return;

  const wrap=document.getElementById("moderatorUsers");
  if(!wrap) return;

  const {data,error}=await supabaseClient
    .from("profiles")
    .select("id,username,role")
    .order("username");

  if(error){
    wrap.innerHTML=`<div class="empty">Greška: ${esc(error.message)}</div>`;
    return;
  }

  wrap.innerHTML=(data||[])
    .filter(u=>u.id!==currentUser?.id)
    .map(u=>`
      <div class="moderator-user">
        <div class="moderator-user-main">
          <strong>${esc(u.username || "Korisnik")}</strong>
          <small>${esc(u.id)}</small>
        </div>
        <select onchange="changeUserRole('${u.id}',this.value)">
          <option value="user" ${u.role==="user"?"selected":""}>Korisnik</option>
          <option value="moderator" ${u.role==="moderator"?"selected":""}>Moderator</option>
          <option value="admin" ${u.role==="admin"?"selected":""}>Admin</option>
        </select>
      </div>
    `).join("") || `<div class="empty">Nema drugih korisnika.</div>`;
}

async function changeUserRole(userId,role){
  if(!isAdmin()){
    alert("Samo administrator može mijenjati uloge.");
    return;
  }

  if(!["user","moderator","admin"].includes(role)) return;

  const {error}=await supabaseClient
    .rpc("admin_set_user_role",{
      target_user_id:userId,
      new_role:role
    });

  if(error){
    alert(error.message);
    return;
  }

  toast("Uloga je promijenjena.");
  loadModeratorUsers();
}

function injectModeratorPanel(){
  if(!isAdmin()) return;
  if(document.getElementById("moderatorManagement")) return;

  const adminContent=document.getElementById("adminContent");
  if(!adminContent) return;

  const card=document.createElement("div");
  card.id="moderatorManagement";
  card.className="card moderator-management";
  card.innerHTML=`
    <div class="moderator-head">
      <div>
        <h3>🛡️ Korisnici i uloge</h3>
        <p class="muted">Administrator može dodijeliti ulogu korisniku. Admin panel i administrativne akcije ostaju zaštićeni.</p>
      </div>
      <button class="btn btn-small" onclick="loadModeratorUsers()">↻ Osvježi</button>
    </div>
    <div id="moderatorUsers" class="moderator-users"></div>
  `;
  adminContent.prepend(card);
  loadModeratorUsers();
}

const _baseUpdateAuthUI = updateAuthUI;
updateAuthUI=function(){
  /* UI must never become unusable because a secondary render function fails. */
  try{ _baseUpdateAuthUI(); }
  catch(error){ console.error("Auth UI render:",error); }

  const account=document.getElementById("headerAccount");
  if(account){
    if(currentUser){
      const username=esc(currentProfile?.username||currentUser?.user_metadata?.username||"Korisnik");
      const admin=isAdmin();
      account.innerHTML=
        '<button class="account-btn account-profile-btn" type="button" onclick="window.openV9Profile(\\''+currentUser.id+'\\')">👤 '+username+'</button>'+
        '<button class="account-btn account-edit-btn" type="button" onclick="window.openV9EditProfile()">✏️ Uredi profil</button>'+
        (admin?'<button class="account-btn account-admin-btn" type="button" onclick="window.showSection(\\'admin\\')">⚙️ Admin</button>':'')+
        '<button class="account-btn account-logout-btn" type="button" onclick="window.logout()">↪ Odjava</button>';
    }else{
      account.innerHTML='<button class="account-btn account-login-btn" type="button" onclick="window.showSection(\\'login\\')">🔐 Prijava / Registracija</button>';
    }
  }

  const nav=document.getElementById("mainNav");
  if(nav){
    let adminBtn=nav.querySelector(".nav-admin-btn");
    if(isAdmin()){
      if(!adminBtn){
        adminBtn=document.createElement("button");
        adminBtn.type="button";
        adminBtn.className="nav-admin-btn";
        adminBtn.innerHTML="<span>⚙️</span><span>Admin</span>";
        adminBtn.addEventListener("click",()=>window.showSection("admin"));
        nav.appendChild(adminBtn);
      }
    }else{
      adminBtn?.remove();
    }

    let authGroup=nav.querySelector(".nav-auth-group");
    if(!authGroup){
      authGroup=document.createElement("div");
      authGroup.className="nav-auth-group";
      nav.appendChild(authGroup);
    }
    authGroup.innerHTML=currentUser
      ? '<button type="button" class="nav-auth-profile" onclick="window.openV9Profile(\\''+currentUser.id+'\\')"><span>👤</span><span>Moj profil</span></button><button type="button" class="nav-auth-logout" onclick="window.logout()"><span>↪</span><span>Odjava</span></button>'
      : '<button type="button" class="nav-auth-login" onclick="window.showSection(\\'login\\')"><span>🔐</span><span>Prijava / Registracija</span></button>';
  }

  if(isAdmin()){
    try{ injectModeratorPanel?.(); }catch(error){ console.error("Moderator panel:",error); }
  }

  try{ setupCommentImageUI(); }catch(error){}
  try{ setupChatImageUI(); }catch(error){}
};

const _baseShowSection=showSection;
showSection=function(id){
  if(id==="admin" && !isAdmin()){
    toast(currentUser ? "Admin panel je dostupan samo administratoru." : "Prijavi se da pristupiš admin panelu.","error");
    id=currentUser ? "home" : "login";
  }
  _baseShowSection(id);
  document.querySelectorAll('#mainNav button[onclick*="showSection"]').forEach(btn=>btn.classList.remove("active"));
  const activeBtn=document.querySelector(`#mainNav button[onclick*="showSection('${id}')"]`);
  if(activeBtn) activeBtn.classList.add("active");
  mobileMenuOpen=false;
  document.getElementById("mainNav")?.classList.remove("mobile-open");
  const btn=document.getElementById("mobileMenuBtn");
  if(btn){btn.textContent="☰";btn.setAttribute("aria-expanded","false");}
  document.querySelectorAll('.mobile-bottom button').forEach(b=>b.classList.remove('active'));
  const bottomBtn=document.querySelector(`.mobile-bottom button[onclick*="showSection('${id}')"]`);
  if(bottomBtn) bottomBtn.classList.add('active');
};

document.addEventListener("DOMContentLoaded",()=>{
  setupCommentImageUI();
});







/* =========================================================
   MEĐASI ADMIN CRUD V4
   Dodaje se na postojeći sistem.
   Ne zamjenjuje postojeće funkcije.
   ========================================================= */

(() => {
  if (window.__MEDJASI_ADMIN_CRUD_V4__) return;
  window.__MEDJASI_ADMIN_CRUD_V4__ = true;

  /* -------------------------------------------------------
     HELPERS
     ------------------------------------------------------- */

  const esc4 = value => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const toast4 = message => {
    if (typeof toast === "function") {
      toast(message);
    } else {
      alert(message);
    }
  };

  const rpc4 = async (name, params = {}) => {
    const { data, error } =
      await supabaseClient.rpc(name, params);

    if (error) {
      console.error(name, error);
      throw error;
    }

    return data;
  };

  const requireAdmin4 = () => {
    if (!currentUser) {
      alert("Moraš biti prijavljen.");
      return false;
    }

    if (!isAdmin()) {
      alert("Nemaš admin ovlaštenje.");
      return false;
    }

    return true;
  };

  /* -------------------------------------------------------
     DELETE MATCH
     ------------------------------------------------------- */

  window.adminDeleteMatch = async function(matchId) {
    if (!requireAdmin4()) return;

    const match = matches.find(
      m => String(m.id) === String(matchId)
    );

    if (!match) return;

    const home = teamName(match.home_team_id);
    const away = teamName(match.away_team_id);

    if (
      !confirm(
        `Obrisati utakmicu "${home} - ${away}"?\n\n` +
        `Biće obrisani i golovi, kartoni i postava te utakmice.`
      )
    ) return;

    try {
      await rpc4("delete_match_admin", {
        match_uuid: matchId
      });

      toast4("Utakmica je obrisana.");
      await loadAll();
    } catch (error) {
      alert(error.message || "Greška pri brisanju utakmice.");
    }
  };


  /* -------------------------------------------------------
     DELETE PLAYER
     ------------------------------------------------------- */

  window.adminDeletePlayer = async function(playerId) {
    if (!requireAdmin4()) return;

    const player = players.find(
      p => String(p.id) === String(playerId)
    );

    if (!player) return;

    if (
      !confirm(
        `Obrisati igrača "${player.name}"?\n\n` +
        `Biće uklonjen i iz golova, kartona i postava.`
      )
    ) return;

    try {
      await rpc4("delete_player_admin", {
        player_uuid: playerId
      });

      toast4("Igrač je obrisan.");
      await loadAll();
    } catch (error) {
      alert(error.message || "Greška pri brisanju igrača.");
    }
  };


  /* -------------------------------------------------------
     DELETE GOAL
     ------------------------------------------------------- */

  window.adminDeleteGoal = async function(goalId) {
    if (!requireAdmin4()) return;

    const goal = goals.find(
      g => String(g.id) === String(goalId)
    );

    if (!goal) return;

    const player = players.find(
      p => String(p.id) === String(goal.player_id)
    );

    const playerName = player
      ? player.name
      : "Nepoznat igrač";

    if (
      !confirm(
        `Obrisati gol igrača "${playerName}"?\n\n` +
        `Rezultat utakmice će se automatski preračunati.`
      )
    ) return;

    try {
      await rpc4("delete_goal_admin", {
        goal_uuid: goalId
      });

      toast4("Gol je obrisan, rezultat je ažuriran.");
      await loadAll();
    } catch (error) {
      alert(error.message || "Greška pri brisanju gola.");
    }
  };


  /* -------------------------------------------------------
     DELETE CARD
     ------------------------------------------------------- */

  window.adminDeleteCard = async function(cardId) {
    if (!requireAdmin4()) return;

    if (!confirm("Obrisati ovaj karton?")) return;

    try {
      await rpc4("delete_card_admin", {
        card_uuid: cardId
      });

      toast4("Karton je obrisan.");
      await loadAll();
    } catch (error) {
      alert(error.message || "Greška pri brisanju kartona.");
    }
  };


  /* -------------------------------------------------------
     DELETE COMMENT
     ------------------------------------------------------- */

  window.adminDeleteCommentV4 = async function(commentId) {
    if (!requireAdmin4()) return;

    if (!confirm("Admin: obrisati ovaj komentar?")) return;

    try {
      await rpc4("delete_comment_admin", {
        comment_uuid: commentId
      });

      toast4("Komentar je obrisan.");
      await loadAll();
    } catch (error) {
      alert(error.message || "Greška pri brisanju komentara.");
    }
  };


  /* -------------------------------------------------------
     DELETE CHAT
     ------------------------------------------------------- */

  window.adminDeleteMessageV4 = async function(messageId) {
    if (!requireAdmin4()) return;

    if (!confirm("Admin: obrisati ovu chat poruku?")) return;

    try {
      await rpc4("delete_message_admin", {
        message_uuid: messageId
      });

      toast4("Poruka je obrisana.");
      await loadAll();
    } catch (error) {
      alert(error.message || "Greška pri brisanju poruke.");
    }
  };


  /* -------------------------------------------------------
     DELETE GALLERY IMAGE
     ------------------------------------------------------- */

  window.adminDeleteGalleryV4 = async function(galleryId) {
    if (!requireAdmin4()) return;

    if (!confirm("Obrisati ovu sliku iz galerije?")) return;

    try {
      await rpc4("delete_gallery_admin", {
        gallery_uuid: galleryId
      });

      toast4("Slika je obrisana.");
      await loadAll();
    } catch (error) {
      alert(error.message || "Greška pri brisanju slike.");
    }
  };


  /* -------------------------------------------------------
     EDIT MATCH
     ------------------------------------------------------- */

  window.openEditMatchV4 = function(matchId) {
    if (!requireAdmin4()) return;

    const match = matches.find(
      m => String(m.id) === String(matchId)
    );

    if (!match) return;

    const date = new Date(match.match_date);

    const localDate =
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0") +
      "T" +
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0");

    const teamOptions = teams.map(team => `
      <option
        value="${esc4(team.id)}"
        ${String(team.id) === String(match.home_team_id) ? "selected" : ""}
      >
        ${esc4(team.name)}
      </option>
    `).join("");

    const awayOptions = teams.map(team => `
      <option
        value="${esc4(team.id)}"
        ${String(team.id) === String(match.away_team_id) ? "selected" : ""}
      >
        ${esc4(team.name)}
      </option>
    `).join("");

    const html = `
      <div class="crud-modal-grid">

        <label>
          Domaća ekipa
          <select id="crudMatchHome">
            ${teamOptions}
          </select>
        </label>

        <label>
          Gostujuća ekipa
          <select id="crudMatchAway">
            ${awayOptions}
          </select>
        </label>

        <label>
          Datum i vrijeme
          <input
            id="crudMatchDate"
            type="datetime-local"
            value="${localDate}"
          >
        </label>

        <label>
          Kolo
          <input
            id="crudMatchRound"
            type="text"
            value="${esc4(match.round || "")}"
            placeholder="npr. 1"
          >
        </label>

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button
            class="btn btn-small"
            onclick="hideModal()"
          >
            Otkaži
          </button>

          <button
            class="btn btn-green btn-small"
            onclick="saveEditMatchV4('${esc4(match.id)}')"
          >
            💾 Sačuvaj
          </button>
        </div>

      </div>
    `;

    if (typeof showModal === "function") {
      showModal(html);
    } else {
      alert("Modal funkcija nije pronađena.");
    }
  };


  window.saveEditMatchV4 = async function(matchId) {
    if (!requireAdmin4()) return;

    const home =
      document.getElementById("crudMatchHome")?.value;

    const away =
      document.getElementById("crudMatchAway")?.value;

    const date =
      document.getElementById("crudMatchDate")?.value;

    const round =
      document.getElementById("crudMatchRound")?.value || null;

    if (!home || !away || !date) {
      alert("Popuni sva obavezna polja.");
      return;
    }

    if (home === away) {
      alert("Domaćin i gost moraju biti različite ekipe.");
      return;
    }

    try {
      await rpc4("update_match_admin", {
        match_uuid: matchId,
        new_home_team_id: home,
        new_away_team_id: away,
        new_match_date: new Date(date).toISOString(),
        new_round: round
      });

      if (typeof hideModal === "function") {
        hideModal();
      }

      toast4("Utakmica je izmijenjena.");
      await loadAll();

    } catch (error) {
      alert(error.message || "Greška pri izmjeni utakmice.");
    }
  };


  /* -------------------------------------------------------
     EDIT PLAYER
     ------------------------------------------------------- */

  window.openEditPlayerV4 = function(playerId) {
    if (!requireAdmin4()) return;

    const player = players.find(p => String(p.id) === String(playerId));
    if (!player) {
      alert("Igrač nije pronađen.");
      return;
    }

    const teamOptions = teams.map(team => `
      <option value="${esc4(team.id)}" ${String(team.id) === String(player.team_id) ? "selected" : ""}>
        ${esc4(team.name)}
      </option>
    `).join("");

    const html = `
      <div class="modal-title">
        <h2 style="margin:0">✏️ Uredi igrača</h2>
        <p class="muted" style="margin-top:5px">Izmijeni podatke igrača i sačuvaj promjene.</p>
      </div>

      <div class="crud-modal-grid" style="margin-top:16px">
        <label>
          Ime i prezime
          <input id="crudPlayerName" type="text" value="${esc4(player.name || "")}" autocomplete="off">
        </label>

        <label>
          Ekipa
          <select id="crudPlayerTeam">${teamOptions}</select>
        </label>

        <label>
          Broj dresa
          <input id="crudPlayerNumber" type="number" min="0" value="${player.jersey_number ?? ""}">
        </label>

        <label>
          Pozicija
          <input id="crudPlayerPosition" type="text" value="${esc4(player.position || "")}" placeholder="npr. Pivot">
        </label>

        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input id="crudPlayerCaptain" type="checkbox" ${player.is_captain ? "checked" : ""} style="width:auto">
          <span>Kapiten</span>
        </label>
      </div>

      <div class="crud-player-photo-editor">
        <div class="crud-player-photo-preview-wrap">
          <img
            id="crudPlayerPhotoPreview"
            class="crud-player-photo-preview"
            src="${playerPhoto(player)}"
            alt="Slika igrača">
        </div>
        <div class="crud-player-photo-controls">
          <strong>🖼️ Slika igrača</strong>
          <span class="muted">Trenutna slika se zadržava ako ne izabereš novu.</span>
          <label class="btn btn-small crud-photo-button">
            📷 Izaberi novu sliku
            <input id="crudPlayerPhoto" type="file" accept="image/png,image/jpeg,image/webp" hidden>
          </label>
          <span id="crudPlayerPhotoName" class="muted">Nije odabrana nova slika</span>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap">
        <button id="crudPlayerCancel" type="button" class="btn btn-small">Otkaži</button>
        <button id="crudPlayerSave" type="button" class="btn btn-green btn-small">💾 Sačuvaj promjene</button>
      </div>
    `;

    showModal(html);

    const saveButton = document.getElementById("crudPlayerSave");
    const cancelButton = document.getElementById("crudPlayerCancel");
    const photoInput = document.getElementById("crudPlayerPhoto");
    const photoPreview = document.getElementById("crudPlayerPhotoPreview");
    const photoName = document.getElementById("crudPlayerPhotoName");

    cancelButton?.addEventListener("click", () => hideModal());
    saveButton?.addEventListener("click", () => saveEditPlayerV4(playerId));

    photoInput?.addEventListener("change", () => {
      const file = photoInput.files?.[0];
      if (!file) return;

      if (!file.type.match(/^image\/(png|jpeg|webp)$/i)) {
        alert("Dozvoljene su JPG, PNG i WEBP slike.");
        photoInput.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("Slika može imati najviše 5 MB.");
        photoInput.value = "";
        return;
      }

      if (photoPreview) {
        const url = URL.createObjectURL(file);
        photoPreview.src = url;
        photoPreview.onload = () => URL.revokeObjectURL(url);
      }
      if (photoName) photoName.textContent = file.name;
    });

    document.getElementById("crudPlayerName")?.focus();
  };


  window.saveEditPlayerV4 = async function(playerId) {
    if (!requireAdmin4()) return;

    const nameEl = document.getElementById("crudPlayerName");
    const teamEl = document.getElementById("crudPlayerTeam");
    const numberEl = document.getElementById("crudPlayerNumber");
    const positionEl = document.getElementById("crudPlayerPosition");
    const captainEl = document.getElementById("crudPlayerCaptain");
    const photoEl = document.getElementById("crudPlayerPhoto");
    const saveButton = document.getElementById("crudPlayerSave");

    const name = nameEl?.value.trim() || "";
    const team = teamEl?.value || "";
    const numberValue = numberEl?.value ?? "";
    const position = positionEl?.value.trim() || "";
    const captain = !!captainEl?.checked;

    if (!name || !team) {
      alert("Ime i ekipa su obavezni.");
      return;
    }

    const jersey = numberValue === "" ? null : Number(numberValue);
    if (jersey !== null && (!Number.isFinite(jersey) || jersey < 0)) {
      alert("Broj dresa nije ispravan.");
      return;
    }

    try {
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "⏳ Čuvam...";
      }

      /* Ako je postavljen kapiten, prvo skini kapiten status ostalima u toj ekipi. */
      if (captain) {
        const { error: captainError } = await supabaseClient
          .from("players")
          .update({ is_captain: false })
          .eq("team_id", team)
          .neq("id", playerId);
        if (captainError) throw captainError;
      }

      let photoUrl = undefined;
      const photoFile = photoEl?.files?.[0];

      if (photoFile) {
        photoUrl = await uploadFile(photoFile, `players/${playerId}`);
      }

      const updatePayload = {
        name,
        team_id: team,
        jersey_number: jersey,
        position,
        is_captain: captain
      };

      if (photoUrl !== undefined) {
        updatePayload.photo_url = photoUrl;
      }

      const { error } = await supabaseClient
        .from("players")
        .update(updatePayload)
        .eq("id", playerId);

      if (error) throw error;

      hideModal();
      toast4(photoUrl !== undefined ? "Igrač i slika su uspješno izmijenjeni." : "Igrač je uspješno izmijenjen.");
      await loadAll();

    } catch (error) {
      console.error("update_player_admin:", error);
      alert(error?.message || "Greška pri izmjeni igrača.");
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "💾 Sačuvaj promjene";
      }
    }
  };


  /* -------------------------------------------------------
     PRETRAGA IGRAČA U ADMIN PANELU
     ------------------------------------------------------- */

  window.filterAdminPlayersV4 = function(value) {
    const query = String(value || "").trim().toLowerCase();
    const items = document.querySelectorAll(
      "#adminCrudV4 .admin-player-item"
    );
    const count = document.getElementById("adminPlayerSearchCount");
    let visible = 0;

    items.forEach(item => {
      const haystack = String(
        item.dataset.search || ""
      ).toLowerCase();

      const match = !query || haystack.includes(query);
      item.classList.toggle("is-hidden", !match);
      if (match) visible += 1;
    });

    if (count) {
      count.textContent = `${visible} / ${items.length}`;
    }
  };


  /* -------------------------------------------------------
     RENDER CRUD PANEL
     ------------------------------------------------------- */

  window.renderAdminCrudV4 = function() {
    const adminContent =
      document.getElementById("adminContent");

    if (!adminContent) return;

    const old =
      document.getElementById("adminCrudV4");

    if (old) old.remove();

    if (!isAdmin()) return;

    const card = document.createElement("div");

    card.id = "adminCrudV4";
    card.className = "card admin-crud-v4";

    const matchesHtml = matches.length
      ? matches.map(m => `
        <div class="crud-item">
          <div class="crud-main">

            <div class="crud-info">
              <div class="crud-name">
                ${esc4(teamName(m.home_team_id))}
                ${Number(m.home_score || 0)}
                :
                ${Number(m.away_score || 0)}
                ${esc4(teamName(m.away_team_id))}
              </div>

              <div class="crud-meta">
                ${esc4(formatDate(m.match_date))}
                ·
                ${esc4(m.status || "scheduled")}
                ·
                ${esc4(m.round ? "Kolo " + m.round : "Bez kola")}
              </div>
            </div>

            <div class="crud-actions">

              <button
                class="btn btn-blue crud-small crud-edit"
                onclick="openEditMatchV4('${esc4(m.id)}')"
              >
                ✏️ Uredi
              </button>

              <button
                class="btn btn-red crud-small crud-danger"
                onclick="adminDeleteMatch('${esc4(m.id)}')"
              >
                🗑️ Obriši
              </button>

            </div>

          </div>
        </div>
      `).join("")
      : `<div class="crud-empty">Nema utakmica.</div>`;


    const playersHtml = players.length
      ? players.map(p => {
          const searchText = [
            p.name || "",
            teamName(p.team_id) || "",
            p.jersey_number != null ? `#${p.jersey_number}` : "",
            p.position || ""
          ].join(" ");

          return `
            <div
              class="crud-item admin-player-item"
              data-search="${esc4(searchText)}">

              <div class="crud-main">

                <div class="crud-info">
                  <div class="crud-name">
                    ${esc4(p.name)}
                    ${p.is_captain ? " 👑" : ""}
                  </div>

                  <div class="crud-meta">
                    ${esc4(teamName(p.team_id))}
                    ·
                    ${p.jersey_number != null
                      ? "#" + esc4(p.jersey_number)
                      : "Bez broja"}
                    ·
                    ${esc4(p.position || "Bez pozicije")}
                  </div>
                </div>

                <div class="crud-actions">

                  <button
                    type="button"
                    class="btn btn-blue crud-small crud-edit"
                    onclick="openEditPlayerV4('${esc4(p.id)}')"
                  >
                    ✏️ Uredi
                  </button>

                  <button
                    type="button"
                    class="btn btn-red crud-small crud-danger"
                    onclick="adminDeletePlayer('${esc4(p.id)}')"
                  >
                    🗑️ Obriši
                  </button>

                </div>

              </div>
            </div>
          `;
        }).join("")
      : `<div class="crud-empty">Nema igrača.</div>`;


    const goalsHtml = goals.length
      ? goals.map(g => {
          const player =
            players.find(
              p => String(p.id) === String(g.player_id)
            );

          const match =
            matches.find(
              m => String(m.id) === String(g.match_id)
            );

          return `
            <div class="crud-item">
              <div class="crud-main">

                <div class="crud-info">

                  <div class="crud-name">
                    ⚽ ${esc4(
                      player?.name || "Nepoznat igrač"
                    )}
                  </div>

                  <div class="crud-meta">
                    ${match
                      ? esc4(teamName(match.home_team_id))
                        + " "
                        + Number(match.home_score || 0)
                        + " : "
                        + Number(match.away_score || 0)
                        + " "
                        + esc4(teamName(match.away_team_id))
                      : "Utakmica nije pronađena"
                    }

                    ${g.minute != null
                      ? " · " + esc4(g.minute) + "'"
                      : ""
                    }
                  </div>

                </div>

                <div class="crud-actions">
                  <button
                    class="btn btn-red crud-small crud-danger"
                    onclick="adminDeleteGoal('${esc4(g.id)}')"
                  >
                    🗑️
                  </button>
                </div>

              </div>
            </div>
          `;
        }).join("")
      : `<div class="crud-empty">Nema golova.</div>`;


    const cardsHtml = cards.length
      ? cards.map(c => {
          const player =
            players.find(
              p => String(p.id) === String(c.player_id)
            );

          return `
            <div class="crud-item">
              <div class="crud-main">

                <div class="crud-info">

                  <div class="crud-name">
                    ${c.card_type === "red" ? "🟥" : "🟨"}
                    ${esc4(
                      player?.name || "Nepoznat igrač"
                    )}
                  </div>

                  <div class="crud-meta">
                    ${esc4(c.card_type || "")}
                    ${c.minute != null
                      ? " · " + esc4(c.minute) + "'"
                      : ""
                    }
                  </div>

                </div>

                <div class="crud-actions">
                  <button
                    class="btn btn-red crud-small crud-danger"
                    onclick="adminDeleteCard('${esc4(c.id)}')"
                  >
                    🗑️
                  </button>
                </div>

              </div>
            </div>
          `;
        }).join("")
      : `<div class="crud-empty">Nema kartona.</div>`;


    const commentsHtml = comments.length
      ? comments.map(c => `
          <div class="crud-item">
            <div class="crud-main">

              <div class="crud-info">
                <div class="crud-name">
                  ${esc4(
                    c.username ||
                    c.user_name ||
                    "Korisnik"
                  )}
                </div>

                <div class="crud-meta">
                  ${esc4(c.content || "")}
                </div>
              </div>

              <div class="crud-actions">
                <button
                  class="btn btn-red crud-small crud-danger"
                  onclick="adminDeleteCommentV4('${esc4(c.id)}')"
                >
                  🗑️
                </button>
              </div>

            </div>
          </div>
        `).join("")
      : `<div class="crud-empty">Nema komentara.</div>`;


    const messagesHtml = messages.length
      ? messages.map(m => `
          <div class="crud-item">
            <div class="crud-main">

              <div class="crud-info">
                <div class="crud-name">
                  ${esc4(
                    m.username ||
                    m.user_name ||
                    "Korisnik"
                  )}
                </div>

                <div class="crud-meta">
                  ${esc4(m.content || "")}
                </div>
              </div>

              <div class="crud-actions">
                <button
                  class="btn btn-red crud-small crud-danger"
                  onclick="adminDeleteMessageV4('${esc4(m.id)}')"
                >
                  🗑️
                </button>
              </div>

            </div>
          </div>
        `).join("")
      : `<div class="crud-empty">Nema chat poruka.</div>`;


    const galleryHtml = gallery.length
      ? gallery.map(g => `
          <div class="crud-item">

            <div class="crud-gallery-row">

              ${
                g.image_url
                  ? `
                    <img
                      class="crud-thumb"
                      src="${esc4(g.image_url)}"
                      alt=""
                    >
                  `
                  : ""
              }

              <div class="crud-info">

                <div class="crud-name">
                  ${esc4(
                    g.title ||
                    "Slika bez naslova"
                  )}
                </div>

                <div class="crud-meta">
                  ${esc4(g.description || "")}
                </div>

              </div>

              <div class="crud-actions">
                <button
                  class="btn btn-red crud-small crud-danger"
                  onclick="adminDeleteGalleryV4('${esc4(g.id)}')"
                >
                  🗑️
                </button>
              </div>

            </div>

          </div>
        `).join("")
      : `<div class="crud-empty">Galerija je prazna.</div>`;


    card.innerHTML = `
      <h3>🛠️ Admin CRUD</h3>

      <div class="muted" style="margin-bottom:16px;">
        Upravljanje utakmicama, igračima, golovima,
        kartonima, komentarima, chatom i galerijom.
      </div>


      <div class="crud-section">
        <div class="crud-title">
          <span>🏟️ Utakmice</span>
          <span class="muted">${matches.length}</span>
        </div>

        <div class="crud-list">
          ${matchesHtml}
        </div>
      </div>


      <div class="crud-section">
        <div class="crud-title">
          <span>👤 Igrači</span>
          <span class="muted">${players.length}</span>
        </div>

        <div class="crud-player-search">
          <input
            id="adminPlayerSearch"
            type="search"
            autocomplete="off"
            placeholder="🔎 Pretraži igrača, ekipu, broj ili poziciju..."
            oninput="filterAdminPlayersV4(this.value)">
          <span
            id="adminPlayerSearchCount"
            class="crud-player-search-count">
            ${players.length} / ${players.length}
          </span>
        </div>

        <div class="crud-list">
          ${playersHtml}
        </div>
      </div>


      <div class="crud-section">
        <div class="crud-title">
          <span>⚽ Golovi</span>
          <span class="muted">${goals.length}</span>
        </div>

        <div class="crud-list">
          ${goalsHtml}
        </div>
      </div>


      <div class="crud-section">
        <div class="crud-title">
          <span>🟨 Kartoni</span>
          <span class="muted">${cards.length}</span>
        </div>

        <div class="crud-list">
          ${cardsHtml}
        </div>
      </div>


      <div class="crud-section">
        <div class="crud-title">
          <span>💬 Komentari</span>
          <span class="muted">${comments.length}</span>
        </div>

        <div class="crud-list">
          ${commentsHtml}
        </div>
      </div>


      <div class="crud-section">
        <div class="crud-title">
          <span>💬 Chat</span>
          <span class="muted">${messages.length}</span>
        </div>

        <div class="crud-list">
          ${messagesHtml}
        </div>
      </div>


      <div class="crud-section">
        <div class="crud-title">
          <span>🖼️ Galerija</span>
          <span class="muted">${gallery.length}</span>
        </div>

        <div class="crud-list">
          ${galleryHtml}
        </div>
      </div>
    `;

    adminContent.appendChild(card);
  };


  /* -------------------------------------------------------
     AUTOMATSKO OSVJEŽAVANJE ADMIN PANELA
     ------------------------------------------------------- */

  const originalUpdateAuthUI =
    window.updateAuthUI;

  if (typeof originalUpdateAuthUI === "function") {
    window.updateAuthUI = function(...args) {
      const result =
        originalUpdateAuthUI.apply(this, args);

      setTimeout(() => {
        try {
          renderAdminCrudV4();
        } catch (error) {
          console.error("Admin CRUD render:", error);
        }
      }, 0);

      return result;
    };
  }


  const originalLoadAll =
    window.loadAll;

  if (typeof originalLoadAll === "function") {
    window.loadAll = async function(...args) {
      const result =
        await originalLoadAll.apply(this, args);

      setTimeout(() => {
        try {
          renderAdminCrudV4();
        } catch (error) {
          console.error("Admin CRUD render:", error);
        }
      }, 0);

      return result;
    };
  }


  /* -------------------------------------------------------
     PRVI RENDER
     ------------------------------------------------------- */

  setTimeout(() => {
    try {
      renderAdminCrudV4();
    } catch (error) {
      console.error("Admin CRUD initial render:", error);
    }
  }, 1200);

})();



if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(registration => {
        console.log("Međasi PWA Service Worker aktivan:", registration.scope);
      })
      .catch(error => {
        console.error("PWA Service Worker greška:", error);
      });
  });
}



(function () {

  const banner = document.getElementById("pwaInstallBanner");
  const installButton = document.getElementById("pwaInstallButton");
  const closeButton = document.getElementById("pwaInstallClose");

  const modal = document.getElementById("pwaInstallModal");
  const modalClose = document.getElementById("pwaModalClose");
  const modalDone = document.getElementById("pwaModalDone");

  let deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function showBanner() {
    if (!banner || isStandalone()) return;

    setTimeout(() => {
      banner.classList.add("show");
    }, 1800);
  }

  function hideBanner() {
    if (banner) {
      banner.classList.remove("show");
    }
  }

  function showModal() {
    if (modal) {
      modal.classList.add("show");
    }
  }

  function hideModal() {
    if (modal) {
      modal.classList.remove("show");
    }
  }

  /*
   * Android / Chrome
   */
  window.addEventListener("beforeinstallprompt", event => {

    event.preventDefault();

    deferredPrompt = event;

    showBanner();
  });

  if (installButton) {

    installButton.addEventListener("click", async () => {

      /*
       * Android has a native installation prompt.
       */
      if (deferredPrompt) {

        deferredPrompt.prompt();

        const result = await deferredPrompt.userChoice;

        console.log(
          "PWA install rezultat:",
          result.outcome
        );

        deferredPrompt = null;

        hideBanner();

        return;
      }

      /*
       * iPhone / Safari
       */
      showModal();
    });

  }

  if (closeButton) {
    closeButton.addEventListener("click", () => {

      hideBanner();

      try {
        localStorage.setItem(
          "medjasi_pwa_banner_closed",
          Date.now().toString()
        );
      } catch (e) {}

    });
  }

  if (modalClose) {
    modalClose.addEventListener("click", hideModal);
  }

  if (modalDone) {
    modalDone.addEventListener("click", hideModal);
  }

  if (modal) {
    modal.addEventListener("click", event => {

      if (event.target === modal) {
        hideModal();
      }

    });
  }

  /*
   * iPhone / Safari doesn't fire beforeinstallprompt,
   * so we show the banner manually.
   */
  const isIOS =
    /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  if (isIOS && !isStandalone()) {

    let closedRecently = false;

    try {

      const closed =
        localStorage.getItem(
          "medjasi_pwa_banner_closed"
        );

      if (closed) {

        const age =
          Date.now() - Number(closed);

        /*
         * Ponovo prikaži nakon 7 dana.
         */
        if (age < 7 * 24 * 60 * 60 * 1000) {
          closedRecently = true;
        }

      }

    } catch (e) {}

    if (!closedRecently) {
      showBanner();
    }

  }

})();



/* =========================================================
   MEDJASI V2 POLISH / MATCH CENTER / PLAYER & STATS ENHANCEMENTS
   Nadogradnja preko postojećeg sistema - bez mijenjanja Supabase šeme.
========================================================= */
(function(){
  const baseRenderHome = window.renderHome;
  const baseRenderStats = window.renderStats;
  const baseOpenPlayer = window.openPlayer;
  const baseOpenTeam = window.openTeam;
  const baseOpenMatch = window.openMatch;

  function n(v){ return Number(v || 0); }
  function esc2(v){
    if(typeof window.esc === "function") return window.esc(v);
    return String(v ?? "").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }
  function team(id){ return typeof getTeam === "function" ? getTeam(id) : null; }
  function player(id){ return typeof getPlayer === "function" ? getPlayer(id) : null; }

  function playerAssists(id){
    return (goals || []).filter(g=>String(g.assist_player_id||"")===String(id)).length;
  }

  function playerGoalMinutes(id){
    return (goals || []).filter(g=>String(g.player_id)===String(id)).map(g=>n(g.minute)).sort((a,b)=>a-b);
  }

  function playerMatchIds(id){
    const set=new Set();
    (matchPlayers||[]).forEach(mp=>{
      if(String(mp.player_id)===String(id)) set.add(String(mp.match_id));
    });
    (goals||[]).forEach(g=>{
      if(String(g.player_id)===String(id)||String(g.assist_player_id||"")===String(id)) set.add(String(g.match_id));
    });
    return set;
  }

  /* ---------------- PLAYER PROFILE ---------------- */
  if(typeof baseOpenPlayer === "function"){
    window.openPlayer = function(playerId){
      const p=player(playerId);
      if(!p){ baseOpenPlayer(playerId); return; }
      const t=team(p.team_id);
      const gs=(goals||[]).filter(g=>String(g.player_id)===String(playerId));
      const cs=(cards||[]).filter(c=>String(c.player_id)===String(playerId));
      const assists=playerAssists(playerId);
      const matchesCount=playerMatchIds(playerId).size;
      const yellows=cs.filter(c=>String(c.card_type||"").toLowerCase()!="red").length;
      const reds=cs.filter(c=>String(c.card_type||"").toLowerCase()==="red").length;
      const minutes=playerGoalMinutes(playerId);
      const recent=Array.from(playerMatchIds(playerId)).map(id=>getMatch(id)).filter(Boolean).sort((a,b)=>new Date(b.match_date)-new Date(a.match_date)).slice(0,5);

      if(typeof showModal !== "function"){ baseOpenPlayer(playerId); return; }
      showModal(`
        <div class="v2-player-hero">
          <img src="${playerPhoto(p)}" alt="${esc2(p.name)}">
          <div class="v2-player-main">
            <div class="hero-kicker">PROFIL IGRAČA</div>
            <h2>${esc2(p.name)}</h2>
            <div class="muted">${esc2(t?.name||"")}</div>
            <div class="v2-player-badges">
              <span class="player-number">#${p.jersey_number ?? "-"}</span>
              <span class="badge">${esc2(p.position||"-" )}</span>
              ${p.is_captain?`<span class="captain">©️ Kapiten</span>`:""}
            </div>
          </div>
        </div>
        <div class="grid grid-3 v2-stat-grid">
          <div class="card stat"><div class="stat-number">${gs.length}</div><div class="stat-label">Golova</div></div>
          <div class="card stat"><div class="stat-number">${assists}</div><div class="stat-label">Asistencija</div></div>
          <div class="card stat"><div class="stat-number">${matchesCount}</div><div class="stat-label">Nastupa</div></div>
          <div class="card stat"><div class="stat-number">${yellows}</div><div class="stat-label">Žutih</div></div>
          <div class="card stat"><div class="stat-number">${reds}</div><div class="stat-label">Crvenih</div></div>
          <div class="card stat"><div class="stat-number">${gs.length+assists}</div><div class="stat-label">Gol + asist.</div></div>
        </div>
        <div class="card v2-detail-card">
          <h3>⚽ Učinak</h3>
          <div class="v2-detail-grid">
            <div><span>Golovi</span><b>${gs.length}</b></div>
            <div><span>Asistencije</span><b>${assists}</b></div>
            <div><span>Učinak po nastupu</span><b>${matchesCount ? ((gs.length+assists)/matchesCount).toFixed(2) : "0.00"}</b></div>
            <div><span>Minute golova</span><b>${minutes.length?minutes.map(x=>x+"'").join(", "):"—"}</b></div>
          </div>
        </div>
        <div class="card v2-detail-card">
          <h3>📈 Forma</h3>
          <div class="v2-form-strip">${recent.length ? recent.map(m=>{
            const home=String(m.home_team_id)===String(p.team_id), my=n(home?m.home_score:m.away_score), op=n(home?m.away_score:m.home_score);
            const result=my>op?'P':my===op?'N':'I';
            return `<span class="v2-form-dot v2-form-${result}">${result}</span>`;
          }).join('') : '<span class="muted">Nema dovoljno utakmica</span>'}</div>
          <small class="muted">Posljednjih ${recent.length} evidentiranih nastupa</small>
        </div>
        <div class="card v2-detail-card">
          <h3>📅 Posljednje utakmice</h3>
          ${recent.length ? recent.map(m=>{
            const h=team(m.home_team_id), a=team(m.away_team_id);
            return `<button class="v2-recent-match" type="button" onclick="openMatch('${m.id}')">
              <span>${esc2(h?.name||"Domaćin")} – ${esc2(a?.name||"Gost")}</span>
              <b>${n(m.home_score)} : ${n(m.away_score)}</b>
              <small>${typeof formatDate==='function'?formatDate(m.match_date):""}</small>
            </button>`;
          }).join(""):`<div class="empty compact">Nema evidentiranih utakmica.</div>`}
        </div>
      `);
    };
  }

  /* ---------------- TEAM PROFILE ---------------- */
  if(typeof baseOpenTeam === "function"){
    window.openTeam = function(teamId){
      const t=team(teamId);
      if(!t){ baseOpenTeam(teamId); return; }
      const list=(players||[]).filter(p=>String(p.team_id)===String(teamId));
      const finished=(matches||[]).filter(m=>m.status==="finished"&&(String(m.home_team_id)===String(teamId)||String(m.away_team_id)===String(teamId)));
      let w=0,d=0,l=0,gf=0,ga=0;
      finished.forEach(m=>{
        const home=String(m.home_team_id)===String(teamId), my=n(home?m.home_score:m.away_score), op=n(home?m.away_score:m.home_score);
        gf+=my; ga+=op; if(my>op)w++; else if(my===op)d++; else l++;
      });
      const teamGoals=(goals||[]).filter(g=>{
        const pl=player(g.player_id); return pl && String(pl.team_id)===String(teamId);
      }).length;
      const teamAssists=(goals||[]).filter(g=>{
        const pl=player(g.assist_player_id); return pl && String(pl.team_id)===String(teamId);
      }).length;

      showModal(`
        <div class="v2-team-hero">
          <img src="${teamLogo(t)}" alt="${esc2(t.name)}">
          <div><div class="hero-kicker">PROFIL EKIPE</div><h2>${esc2(t.name)}</h2><div class="muted">${list.length} igrača • ${finished.length} odigranih utakmica</div></div>
        </div>
        <div class="grid grid-3 v2-stat-grid">
          <div class="card stat"><div class="stat-number">${w}</div><div class="stat-label">Pobjede</div></div>
          <div class="card stat"><div class="stat-number">${d}</div><div class="stat-label">Neriješeno</div></div>
          <div class="card stat"><div class="stat-number">${l}</div><div class="stat-label">Porazi</div></div>
          <div class="card stat"><div class="stat-number">${gf}</div><div class="stat-label">Postignuti golovi</div></div>
          <div class="card stat"><div class="stat-number">${ga}</div><div class="stat-label">Primljeni golovi</div></div>
          <div class="card stat"><div class="stat-number">${teamGoals+teamAssists}</div><div class="stat-label">Gol + asist.</div></div>
        </div>
        <div class="card v2-detail-card">
          <h3>👥 Igrači</h3>
          <div class="v2-roster-grid">${list.length?list.map(p=>`<button type="button" class="v2-roster" onclick="openPlayer('${p.id}')"><img src="${playerPhoto(p)}" alt=""><span><b>#${p.jersey_number??"-"} ${esc2(p.name)}</b><small>${esc2(p.position||"-")}</small></span></button>`).join(""):`<div class="empty compact">Ekipa još nema igrača.</div>`}</div>
        </div>
      `);
    };
  }

  /* ---------------- MATCH CENTER EXTRA ---------------- */
  function calculateMatchMVP(matchId){
    const m=getMatch(matchId); if(!m) return null;
    const ids=new Set();
    (matchPlayers||[]).forEach(mp=>{ if(String(mp.match_id)===String(matchId)) ids.add(String(mp.player_id)); });
    (goals||[]).forEach(g=>{ if(String(g.match_id)===String(matchId)){ ids.add(String(g.player_id)); if(g.assist_player_id) ids.add(String(g.assist_player_id)); }});
    (cards||[]).forEach(c=>{ if(String(c.match_id)===String(matchId)) ids.add(String(c.player_id)); });
    const candidates=Array.from(ids).map(id=>{
      const p=player(id); if(!p) return null;
      const pg=(goals||[]).filter(g=>String(g.match_id)===String(matchId)&&String(g.player_id)===String(id)).length;
      const pa=(goals||[]).filter(g=>String(g.match_id)===String(matchId)&&String(g.assist_player_id||'')===String(id)).length;
      const pc=(cards||[]).filter(c=>String(c.match_id)===String(matchId)&&String(c.player_id)===String(id));
      const red=pc.filter(c=>String(c.card_type||'').toLowerCase()==='red').length;
      const yellow=pc.length-red;
      const registered=(matchPlayers||[]).some(mp=>String(mp.match_id)===String(matchId)&&String(mp.player_id)===String(id));
      const score=pg*3+pa*2-yellow*.5-red*2+(registered?.1:0);
      return {p,pg,pa,yellow,red,score};
    }).filter(Boolean).sort((a,b)=>b.score-a.score || b.pg-a.pg || b.pa-a.pa);
    return candidates[0] && candidates[0].score>0 ? candidates[0] : null;
  }

  function renderMatchMVP(matchId){
    const mvp=calculateMatchMVP(matchId); if(!mvp) return `<div class="empty compact">MVP se još ne može odrediti — nema dovoljno evidentiranih učinaka.</div>`;
    return `<div class="v2-mvp-card"><div class="v2-mvp-crown">🏆</div><img src="${playerPhoto(mvp.p)}" alt=""><div class="v2-mvp-info"><div class="hero-kicker">IGRAČ UTAKMICE</div><button type="button" onclick="openPlayer('${mvp.p.id}')"><b>${esc2(mvp.p.name)}</b></button><small>${esc2(team(mvp.p.team_id)?.name||'')} · #${mvp.p.jersey_number??'-'}</small><div class="v2-mvp-stats"><span>⚽ ${mvp.pg} gol</span><span>🎯 ${mvp.pa} asist.</span><span>🟨 ${mvp.yellow}</span>${mvp.red?`<span>🟥 ${mvp.red}</span>`:''}</div></div></div>`;
  }

  function enhanceCurrentMatch(){
    const panel=document.getElementById("match-panel-stats");
    const m=typeof currentMatchId!=="undefined" ? getMatch(currentMatchId) : null;
    if(!panel||!m) return;
    panel.querySelector(".v2-match-extra")?.remove();
    const hg=(goals||[]).filter(g=>String(g.match_id)===String(m.id)&&player(g.player_id)?.team_id===m.home_team_id);
    const ag=(goals||[]).filter(g=>String(g.match_id)===String(m.id)&&player(g.player_id)?.team_id===m.away_team_id);
    const ha=(goals||[]).filter(g=>String(g.match_id)===String(m.id)&&player(g.assist_player_id)?.team_id===m.home_team_id).length;
    const aa=(goals||[]).filter(g=>String(g.match_id)===String(m.id)&&player(g.assist_player_id)?.team_id===m.away_team_id).length;
    const hc=(cards||[]).filter(c=>String(c.match_id)===String(m.id)&&player(c.player_id)?.team_id===m.home_team_id);
    const ac=(cards||[]).filter(c=>String(c.match_id)===String(m.id)&&player(c.player_id)?.team_id===m.away_team_id);
    const home=team(m.home_team_id), away=team(m.away_team_id);
    const mvpBox=document.createElement("div"); mvpBox.className="v2-match-mvp"; mvpBox.innerHTML=renderMatchMVP(m.id); panel.prepend(mvpBox);
    const card=document.createElement("div"); card.className="card v2-match-extra"; card.innerHTML=`
      <h3>📊 Detaljna statistika</h3>
      <div class="v2-match-stat-table">
        <div><b>${hg.length}</b><span>Golovi</span><b>${ag.length}</b></div>
        <div><b>${ha}</b><span>Asistencije</span><b>${aa}</b></div>
        <div><b>${hc.length}</b><span>Kartoni</span><b>${ac.length}</b></div>
      </div>
      <div class="v2-match-players">
        <div><strong>${esc2(home?.name||"Domaćin")}</strong>${hg.length?hg.map(g=>`<span>⚽ ${esc2(player(g.player_id)?.name||"Igrač")} ${n(g.minute)}'</span>`).join(""):"<small class='muted'>Bez golova</small>"}</div>
        <div><strong>${esc2(away?.name||"Gost")}</strong>${ag.length?ag.map(g=>`<span>⚽ ${esc2(player(g.player_id)?.name||"Igrač")} ${n(g.minute)}'</span>`).join(""):"<small class='muted'>Bez golova</small>"}</div>
      </div>`;
    panel.appendChild(card);
  }
  if(typeof baseOpenMatch === "function"){
    window.openMatch=function(id){ baseOpenMatch(id); setTimeout(enhanceCurrentMatch,30); };
  }

  /* ---------------- ADVANCED LEAGUE STATS ---------------- */
  if(typeof baseRenderStats === "function"){
    window.renderStats=function(){
      baseRenderStats();
      const sec=document.getElementById("stats"); if(!sec) return;
      document.getElementById("v2AdvancedStats")?.remove();
      const gs=goals||[], cs=cards||[], ms=(matches||[]).filter(m=>m.status==="finished");
      const assists={}; gs.forEach(g=>{if(g.assist_player_id) assists[g.assist_player_id]=(assists[g.assist_player_id]||0)+1;});
      const reds=cs.filter(c=>String(c.card_type||"").toLowerCase()==="red").length;
      const yellows=cs.filter(c=>String(c.card_type||"").toLowerCase()!=="red").length;
      const avg=ms.length?(gs.length/ms.length).toFixed(2):"0.00";
      const topAssist=Object.entries(assists).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const teamAttack=(teams||[]).map(t=>{const own=gs.filter(g=>player(g.player_id)?.team_id===t.id).length;return {t,own};}).sort((a,b)=>b.own-a.own).slice(0,5);
      const block=document.createElement("div"); block.id="v2AdvancedStats"; block.className="v2-advanced-stats"; block.innerHTML=`
        <div class="card"><div class="hero-kicker">LIGA PREGLED</div><h3>📈 Napredna statistika</h3><div class="grid grid-2 v2-kpi-grid">
          <div><b>${gs.length}</b><span>Ukupno golova</span></div><div><b>${avg}</b><span>Golova po utakmici</span></div><div><b>${yellows}</b><span>Žutih kartona</span></div><div><b>${reds}</b><span>Crvenih kartona</span></div>
        </div></div>
        <div class="grid grid-2"><div class="card"><h3>🎯 Asistenti</h3>${topAssist.length?topAssist.map(([id,v],i)=>`<button type="button" class="v2-rank-line" onclick="openPlayer('${id}')"><span>${i+1}.</span><strong>${esc2(player(id)?.name||"Igrač")}</strong><b>${v}</b></button>`).join(""):`<div class="empty compact">Još nema asistencija.</div>`}</div>
        <div class="card"><h3>🔥 Napad ekipa</h3>${teamAttack.length?teamAttack.map((x,i)=>`<div class="v2-rank-line"><span>${i+1}.</span><strong>${esc2(x.t.name)}</strong><b>${x.own}</b></div>`).join(""):`<div class="empty compact">Još nema golova.</div>`}</div></div>`;
      sec.appendChild(block);
    };
  }

  /* ---------------- HOME COUNTDOWN / QUICK INSIGHT ---------------- */
  if(typeof baseRenderHome === "function"){
    window.renderHome=function(){
      baseRenderHome();
      const box=document.getElementById("homeAnnouncement");
      if(!box) return;
      const next=(matches||[]).filter(m=>m.status==="scheduled"&&m.match_date).sort((a,b)=>new Date(a.match_date)-new Date(b.match_date))[0];
      box.querySelector(".v2-countdown")?.remove();
      if(!next) return;
      const h=team(next.home_team_id), a=team(next.away_team_id);
      const d=new Date(next.match_date).getTime()-Date.now();
      let countdown="Uskoro";
      if(d>0){const total=Math.floor(d/1000), days=Math.floor(total/86400), hours=Math.floor((total%86400)/3600), mins=Math.floor((total%3600)/60); countdown=days?`${days}d ${hours}h`:hours?`${hours}h ${mins}min`:`${Math.max(1,mins)} min`;}
      const el=document.createElement("div"); el.className="v2-countdown"; el.innerHTML=`<button type="button" onclick="openMatch('${next.id}')"><span>⏱️</span><div><b>${esc2(h?.name||"Domaćin")} – ${esc2(a?.name||"Gost")}</b><small>Sljedeća utakmica • počinje za <strong>${countdown}</strong></small></div><i>→</i></button>`; box.appendChild(el);
    };
  }

  /* live countdown refresh without touching existing 30s data refresh */
  setInterval(()=>{
    if(typeof window.renderHome==='function' && document.getElementById('home')?.classList.contains('active')) window.renderHome();
  },60000);

  /* ---------------- SMALL MOBILE POLISH ---------------- */
  const style=document.createElement("style"); style.textContent=`
    .v2-player-hero,.v2-team-hero{display:flex;align-items:center;gap:18px;padding:18px;border-radius:20px;background:linear-gradient(145deg,rgba(32,212,123,.09),rgba(44,156,255,.06));border:1px solid rgba(255,255,255,.07);margin-bottom:16px}
    .v2-player-hero>img,.v2-team-hero>img{width:96px;height:96px;object-fit:cover;border-radius:20px;background:#081622}.v2-team-hero>img{object-fit:contain;padding:8px}
    .v2-player-main{min-width:0}.v2-player-main h2,.v2-team-hero h2{margin:2px 0 5px}.v2-player-badges{margin-top:8px}.v2-stat-grid{margin-top:14px}.v2-detail-card{margin-top:14px}.v2-detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:10px}.v2-detail-grid>div{padding:11px;border-radius:12px;background:rgba(255,255,255,.035)}.v2-detail-grid span,.v2-detail-grid b{display:block}.v2-detail-grid span{font-size:11px;color:var(--muted)}.v2-detail-grid b{margin-top:3px}.v2-recent-match{display:grid;grid-template-columns:1fr auto;gap:3px 10px;width:100%;text-align:left;padding:11px;margin-top:7px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:rgba(255,255,255,.03);color:#fff;cursor:pointer}.v2-recent-match small{grid-column:1/-1;color:var(--muted)}.v2-roster-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.v2-roster{display:flex;align-items:center;gap:9px;text-align:left;border:1px solid rgba(255,255,255,.06);border-radius:13px;padding:9px;background:rgba(255,255,255,.03);color:#fff}.v2-roster img{width:42px;height:42px;border-radius:11px;object-fit:cover}.v2-roster span{min-width:0}.v2-roster b,.v2-roster small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v2-roster small{color:var(--muted);margin-top:2px}.v2-match-extra{margin-top:14px}.v2-match-stat-table{display:grid;gap:6px;margin-top:10px}.v2-match-stat-table>div{display:grid;grid-template-columns:55px 1fr 55px;align-items:center;text-align:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.035)}.v2-match-stat-table span{color:var(--muted);font-size:11px}.v2-match-players{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px}.v2-match-players>div{display:grid;gap:5px}.v2-match-players span{font-size:12px}.v2-advanced-stats{display:grid;gap:14px;margin-top:16px}.v2-kpi-grid{margin-top:12px}.v2-kpi-grid>div{padding:13px;border-radius:13px;background:rgba(255,255,255,.035)}.v2-kpi-grid b,.v2-kpi-grid span{display:block}.v2-kpi-grid b{font-size:25px}.v2-kpi-grid span{color:var(--muted);font-size:11px;margin-top:2px}.v2-rank-line{width:100%;display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;padding:10px;border:0;border-bottom:1px solid rgba(255,255,255,.05);background:transparent;color:#fff;text-align:left}.v2-rank-line:last-child{border-bottom:0}.v2-countdown{margin-top:10px}.v2-countdown button{width:100%;display:flex;align-items:center;gap:12px;text-align:left;border:1px solid rgba(32,212,123,.22);background:rgba(32,212,123,.055);color:#fff;border-radius:14px;padding:12px}.v2-countdown button>span{font-size:22px}.v2-countdown button>div{flex:1}.v2-countdown b,.v2-countdown small{display:block}.v2-countdown small{color:var(--muted);margin-top:3px}.v2-countdown i{font-style:normal;font-size:20px;color:var(--green)}
    .v2-match-mvp{margin-bottom:14px}.v2-mvp-card{display:flex;align-items:center;gap:14px;padding:16px;border-radius:18px;background:linear-gradient(135deg,rgba(244,197,66,.12),rgba(32,212,123,.06));border:1px solid rgba(244,197,66,.22)}.v2-mvp-card img{width:72px;height:72px;border-radius:16px;object-fit:cover;background:#081622}.v2-mvp-crown{font-size:27px}.v2-mvp-info{min-width:0;flex:1}.v2-mvp-info button{display:block;border:0;background:none;color:#fff;padding:0;text-align:left;font-size:18px}.v2-mvp-info small{display:block;color:var(--muted);margin-top:3px}.v2-mvp-stats{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.v2-mvp-stats span{font-size:10px;padding:4px 7px;border-radius:7px;background:rgba(255,255,255,.055)}.v2-form-strip{display:flex;gap:7px;margin:10px 0}.v2-form-dot{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:11px;font-weight:950}.v2-form-P{background:rgba(32,212,123,.16);color:var(--green)}.v2-form-N{background:rgba(244,197,66,.16);color:var(--yellow)}.v2-form-I{background:rgba(255,77,93,.16);color:#ff7882}
    @media(max-width:600px){.v2-player-hero,.v2-team-hero{padding:13px;gap:12px}.v2-player-hero>img,.v2-team-hero>img{width:74px;height:74px}.v2-roster-grid{grid-template-columns:1fr}.v2-match-players{grid-template-columns:1fr}.v2-detail-grid{grid-template-columns:1fr}.v2-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.live-scoreboard{grid-template-columns:1fr 110px 1fr;padding:12px;gap:7px}.live-team img{width:62px;height:62px}.live-score{font-size:38px}.live-team-name{font-size:12px}.notification-modal-head{align-items:flex-start}.notification-modal-head .btn{white-space:nowrap}}
  `; document.head.appendChild(style);
})();



/* =========================================================
   MEDJASI MATCH CENTER 2.0
   Nadogradnja postojećeg Match Centera bez promjene Supabase šeme.
========================================================= */
(function(){
  const previousOpenMatch = window.openMatch;
  if(typeof previousOpenMatch !== 'function') return;

  const safe = v => typeof esc2 === 'function' ? esc2(v) : String(v ?? '');
  const num = v => Number(v || 0);
  const pget = id => typeof getPlayer === 'function' ? getPlayer(id) : null;
  const tget = id => typeof getTeam === 'function' ? getTeam(id) : null;

  function teamGoals(matchId, teamId){
    return (goals||[]).filter(g => String(g.match_id)===String(matchId) && pget(g.player_id)?.team_id===teamId).sort((a,b)=>num(a.minute)-num(b.minute));
  }
  function teamCards(matchId, teamId){
    return (cards||[]).filter(c => String(c.match_id)===String(matchId) && pget(c.player_id)?.team_id===teamId).sort((a,b)=>num(a.minute)-num(b.minute));
  }
  function teamAssists(matchId, teamId){
    return (goals||[]).filter(g => String(g.match_id)===String(matchId) && g.assist_player_id && pget(g.assist_player_id)?.team_id===teamId).sort((a,b)=>num(a.minute)-num(b.minute));
  }
  function registered(matchId, teamId){
    return (matchPlayers||[]).filter(mp => String(mp.match_id)===String(matchId) && pget(mp.player_id)?.team_id===teamId);
  }
  function playerLine(id, matchId){
    const p=pget(id); if(!p) return '';
    const g=(goals||[]).filter(x=>String(x.match_id)===String(matchId)&&String(x.player_id)===String(id)).length;
    const a=(goals||[]).filter(x=>String(x.match_id)===String(matchId)&&String(x.assist_player_id||'')===String(id)).length;
    const c=(cards||[]).filter(x=>String(x.match_id)===String(matchId)&&String(x.player_id)===String(id));
    const red=c.filter(x=>String(x.card_type||'').toLowerCase()==='red').length;
    const yellow=c.length-red;
    const mp=(matchPlayers||[]).find(x=>String(x.match_id)===String(matchId)&&String(x.player_id)===String(id));
    return `<button type="button" class="mc20-player-row" onclick="openPlayer('${id}')"><img src="${playerPhoto(p)}"><span><b>#${p.jersey_number??'-'} ${safe(p.name)}</b><small>${safe(p.position||'-')} ${mp?.is_active?'· 🟢 na terenu':'· prijavljen'}</small></span><em>${g?'⚽ '+g:''}${a?' 🎯 '+a:''}${yellow?' 🟨 '+yellow:''}${red?' 🟥 '+red:''}</em></button>`;
  }
  function eventText(e){
    const p=pget(e.player_id); const a=e.assist_player_id?pget(e.assist_player_id):null;
    return `<div class="mc20-event"><strong>${num(e.minute)}'</strong><span>⚽</span><div><b>${safe(p?.name||'Igrač')}</b>${a?`<small>🎯 asistencija: ${safe(a.name)}</small>`:''}</div></div>`;
  }
  function cardText(c){
    const p=pget(c.player_id); const icon=String(c.card_type||'').toLowerCase()==='red'?'🟥':'🟨';
    return `<div class="mc20-event"><strong>${num(c.minute)}'</strong><span>${icon}</span><div><b>${safe(p?.name||'Igrač')}</b><small>${String(c.card_type||'Karton')}</small></div></div>`;
  }
  function makeBlock(title, html, cls=''){
    return `<div class="card mc20-block ${cls}"><h3>${title}</h3>${html}</div>`;
  }

  function enhance(){
    const id=currentMatchId, m=getMatch(id); if(!m) return;
    const stats=document.getElementById('match-panel-stats');
    const eventsPanel=document.getElementById('match-panel-events');
    const lineupPanel=document.getElementById('match-panel-lineup');
    if(!stats||!eventsPanel||!lineupPanel) return;
    stats.querySelector('.mc20-extra')?.remove();
    eventsPanel.querySelector('.mc20-extra')?.remove();
    lineupPanel.querySelector('.mc20-extra')?.remove();

    const ht=tget(m.home_team_id), at=tget(m.away_team_id);
    const hg=teamGoals(id,m.home_team_id), ag=teamGoals(id,m.away_team_id);
    const hc=teamCards(id,m.home_team_id), ac=teamCards(id,m.away_team_id);
    const hp=registered(id,m.home_team_id), ap=registered(id,m.away_team_id);
    const hActive=hp.filter(x=>x.is_active).length, aActive=ap.filter(x=>x.is_active).length;
    const hBench=hp.filter(x=>!x.is_active).length, aBench=ap.filter(x=>!x.is_active).length;
    const hAs=teamAssists(id,m.home_team_id), aAs=teamAssists(id,m.away_team_id);
    const totalGoals=hg.length+ag.length, totalCards=hc.length+ac.length;

    const statsExtra=document.createElement('div'); statsExtra.className='mc20-extra'; statsExtra.innerHTML=`
      <div class="grid grid-2 mc20-grid">
        ${makeBlock(`⚽ ${safe(ht?.name||'Domaćin')} — učinak`, hp.length?hp.map(x=>playerLine(x.player_id,id)).join(''):'<div class="empty compact">Nema evidentiranih igrača.</div>','mc20-roster')}
        ${makeBlock(`⚽ ${safe(at?.name||'Gost')} — učinak`, ap.length?ap.map(x=>playerLine(x.player_id,id)).join(''):'<div class="empty compact">Nema evidentiranih igrača.</div>','mc20-roster')}
      </div>
      ${makeBlock('📊 Pregled utakmice',`<div class="mc20-compare"><div><b>${hg.length}</b><span>Golovi</span><b>${ag.length}</b></div><div><b>${hAs.length}</b><span>Asistencije</span><b>${aAs.length}</b></div><div><b>${hc.length}</b><span>Kartoni</span><b>${ac.length}</b></div><div><b>${hActive}</b><span>Trenutno na terenu</span><b>${aActive}</b></div><div><b>${hBench}</b><span>Na klupi</span><b>${aBench}</b></div><div><b>${hp.length}</b><span>Prijavljeni</span><b>${ap.length}</b></div></div>`)}
    `;
    stats.appendChild(statsExtra);

    const allEvents=[...hg.map(g=>({minute:num(g.minute),html:eventText(g),type:'goal'})),...ag.map(g=>({minute:num(g.minute),html:eventText(g),type:'goal'})),...hc.map(c=>({minute:num(c.minute),html:cardText(c),type:'card'})),...ac.map(c=>({minute:num(c.minute),html:cardText(c),type:'card'}))].sort((a,b)=>a.minute-b.minute);
    const ev=document.createElement('div'); ev.className='mc20-extra'; ev.innerHTML=`
      <div class="grid grid-2 mc20-grid">
        ${makeBlock('⚽ Strijelci', `<div>${allEvents.filter(x=>x.type==='goal').length?allEvents.filter(x=>x.type==='goal').map(x=>x.html).join(''):'<div class="empty compact">Nema golova.</div>'}</div>`)}
        ${makeBlock('🟨 Kartoni', `<div>${allEvents.filter(x=>x.type==='card').length?allEvents.filter(x=>x.type==='card').map(x=>x.html).join(''):'<div class="empty compact">Nema kartona.</div>'}</div>`)}
      </div>
      ${makeBlock('🎯 Asistencije', `<div class="mc20-assists">${hAs.concat(aAs).length?hAs.concat(aAs).map(g=>`<div class="mc20-event"><strong>${num(g.minute)}'</strong><span>🎯</span><div><b>${safe(pget(g.assist_player_id)?.name||'Igrač')}</b><small>asistencija za ${safe(pget(g.player_id)?.name||'strijelca')}</small></div></div>`).join(''):'<div class="empty compact">Nema evidentiranih asistencija.</div>'}</div>`)}
      ${makeBlock('📋 Hronologija', `<div>${allEvents.length?allEvents.map(x=>x.html).join(''):'<div class="empty compact">Nema događaja.</div>'}</div>`)}
    `;
    eventsPanel.appendChild(ev);

    const lp=document.createElement('div'); lp.className='mc20-extra'; lp.innerHTML=`
      <div class="grid grid-2 mc20-grid">
        ${makeBlock(`👥 ${safe(ht?.name||'Domaćin')}`, `<div class="mc20-lineup-summary"><b>${hActive}</b><span>na terenu</span><b>${hBench}</b><span>klupa</span></div>${hp.length?hp.map(x=>playerLine(x.player_id,id)).join(''):'<div class="empty compact">Postava nije evidentirana.</div>'}`)}
        ${makeBlock(`👥 ${safe(at?.name||'Gost')}`, `<div class="mc20-lineup-summary"><b>${aActive}</b><span>na terenu</span><b>${aBench}</b><span>klupa</span></div>${ap.length?ap.map(x=>playerLine(x.player_id,id)).join(''):'<div class="empty compact">Postava nije evidentirana.</div>'}`)}
      </div>
      ${makeBlock('🔄 Izmjene', `<div class="muted">Trenutna baza čuva samo stanje igrača (teren/klupa), ne istoriju minuta izmjena. Zato ovdje prikazujemo tačno trenutno stanje bez izmišljanja vremena izmjena.</div><div class="grid grid-2" style="margin-top:10px"><div><b>${safe(ht?.name||'Domaćin')}</b><p class="muted">${hActive} aktivnih · ${hBench} na klupi</p></div><div><b>${safe(at?.name||'Gost')}</b><p class="muted">${aActive} aktivnih · ${aBench} na klupi</p></div></div>`)}
    `;
    lineupPanel.appendChild(lp);
  }

  window.openMatch=function(id){
    previousOpenMatch(id);
    setTimeout(enhance,50);
  };

  const style=document.createElement('style'); style.textContent=`
    .mc20-extra{margin-top:15px}.mc20-grid{margin-top:15px}.mc20-block{overflow:hidden}.mc20-block h3{margin-bottom:12px}.mc20-player-row{width:100%;display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:9px;padding:9px 0;border:0;border-bottom:1px solid var(--border);background:transparent;color:inherit;text-align:left;cursor:pointer}.mc20-player-row:last-child{border-bottom:0}.mc20-player-row img{width:38px;height:38px;border-radius:10px;object-fit:cover}.mc20-player-row span{min-width:0}.mc20-player-row span b,.mc20-player-row span small{display:block}.mc20-player-row small{color:var(--muted);font-size:10px;margin-top:2px}.mc20-player-row em{font-style:normal;font-size:11px;white-space:nowrap}.mc20-event{display:grid;grid-template-columns:38px 28px 1fr;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border)}.mc20-event:last-child{border-bottom:0}.mc20-event>strong{color:var(--green)}.mc20-event span{font-size:17px}.mc20-event small{display:block;color:var(--muted);font-size:10px;margin-top:2px}.mc20-compare>div{display:grid;grid-template-columns:70px 1fr 70px;align-items:center;text-align:center;padding:10px;border-bottom:1px solid var(--border)}.mc20-compare>div:last-child{border-bottom:0}.mc20-compare b:first-child{text-align:right}.mc20-compare b:last-child{text-align:left}.mc20-compare span{color:var(--muted);font-size:11px}.mc20-lineup-summary{display:flex;gap:8px;align-items:baseline;padding:8px 10px;margin-bottom:7px;border-radius:10px;background:rgba(255,255,255,.025)}.mc20-lineup-summary b{font-size:18px}.mc20-lineup-summary span{color:var(--muted);font-size:10px}.mc20-assists{display:grid;gap:0}
    @media(max-width:700px){.mc20-player-row{grid-template-columns:34px 1fr auto}.mc20-player-row img{width:34px;height:34px}.mc20-player-row em{font-size:10px}.mc20-compare>div{grid-template-columns:55px 1fr 55px}}
  `; document.head.appendChild(style);
})();



(function(){
  "use strict";

  window.medjasiV3 = window.medjasiV3 || {};
  const V3 = window.medjasiV3;

  V3.adminIds = V3.adminIds || new Set();
  V3.roleCacheReady = false;

  V3.escape = function(v){
    if(typeof window.esc === "function") return window.esc(v);
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  };

  V3.isAdminMessage = function(item){
    if(!item) return false;
    if(item.role === "admin") return true;
    return !!item.user_id && V3.adminIds.has(String(item.user_id));
  };

  V3.badge = function(){
    return `<span class="v3-admin-badge">Admin</span>`;
  };

  V3.reactionKey = "medjasi_v3_chat_reactions_v1";

  V3.readReactions = function(){
    try{return JSON.parse(localStorage.getItem(V3.reactionKey)||"{}")||{}}
    catch(e){return {}}
  };

  V3.writeReactions = function(data){
    try{localStorage.setItem(V3.reactionKey,JSON.stringify(data))}
    catch(e){}
  };

  V3.toggleReaction = function(id,emoji){
    const all=V3.readReactions();
    all[id]=all[id]||{};
    all[id][emoji]=!all[id][emoji];
    V3.writeReactions(all);
    if(typeof window.renderChat==="function") window.renderChat();
  };
  window.v3ToggleReaction=V3.toggleReaction;

  V3.reactionHTML = function(id){
    const data=V3.readReactions()[id]||{};
    return `<div class="v3-reaction-row">
      ${["❤️","🔥","⚽","👏","😂"].map(e =>
        `<button type="button" class="v3-reaction ${data[e]?"active":""}"
          onclick="v3ToggleReaction('${V3.escape(id)}','${e}')">${e}</button>`
      ).join("")}
    </div>`;
  };

  V3.loadAdminIds = async function(){
    if(!window.supabaseClient) return;
    try{
      const {data,error}=await supabaseClient
        .from("profiles")
        .select("id,role")
        .eq("role","admin");
      if(error){
        console.warn("V3: nije moguće učitati admin profile:",error);
        return;
      }
      V3.adminIds = new Set((data||[]).map(x=>String(x.id)));
      V3.roleCacheReady = true;
    }catch(error){
      console.warn("V3 admin role cache:",error);
    }
  };

  V3.adminName = function(item){
    return V3.isAdminMessage(item) ? "Admin" :
      item?.username ||
      (window.currentUser && item.user_id===window.currentUser.id ? window.currentProfile?.username : null) ||
      (item?.user_id ? String(item.user_id).slice(0,8) : "Korisnik");
  };

  /* ---------------- CHAT ---------------- */
  const originalSendChat = window.sendChat;

  window.renderChat = function(){
    const box=document.getElementById("chatBox");
    if(!box) return;

    const list=Array.isArray(window.messages)?window.messages:[];
    box.innerHTML=list.length ? list.map(m=>{
      const admin=V3.isAdminMessage(m);
      const username=V3.adminName(m);
      const safeId=V3.escape(m.id);

      return `
        <div class="chat-message ${admin?"v3-admin-message":""}">
          <div class="chat-avatar">${admin?"A":"💬"}</div>
          <div class="chat-message-body">
            <div class="chat-message-top">
              <strong class="${admin?"v3-admin-name":""}">
                ${V3.escape(username)}${admin?V3.badge():""}
              </strong>
              <small class="muted">${typeof formatDate==="function"?formatDate(m.created_at):""}</small>
            </div>
            ${m.content ? `<div class="chat-message-text">${V3.escape(m.content)}</div>` : ""}
            ${m.image_url ? `
              <button class="chat-photo" type="button"
                onclick="openImagePreview('${V3.escape(m.image_url)}','${V3.escape(username)}')">
                <img src="${V3.escape(m.image_url)}" alt="Slika u chatu" loading="lazy">
              </button>` : ""}
            ${V3.reactionHTML(safeId)}
            ${window.currentUser && (m.user_id===window.currentUser.id || typeof isAdmin==="function" && isAdmin())
              ? `<button class="btn btn-red btn-small chat-delete" onclick="deleteChat('${safeId}')">🗑️</button>` : ""}
          </div>
        </div>`;
    }).join("") :
      `<div class="empty">Još nema poruka.<br>Budi prvi koji će započeti razgovor.</div>`;

    box.scrollTop=box.scrollHeight;
  };

  window.sendChat = async function(){
    if(!window.currentUser){
      alert("Moraš biti prijavljen.");
      return;
    }

    const input=document.getElementById("chatText");
    const fileInput=document.getElementById("chatImageFile");
    const content=input?.value.trim()||"";
    const file=fileInput?.files?.[0]||null;

    if(!content && !file){alert("Napiši poruku ili dodaj sliku.");return;}
    if(content.length>1000){alert("Poruka može imati najviše 1000 znakova.");return;}
    if(file && (!file.type.startsWith("image/") || file.size>5*1024*1024)){
      alert("Slika mora biti JPG, PNG, WEBP ili GIF i imati najviše 5 MB.");
      return;
    }

    try{
      let image_url=null;
      if(file && typeof uploadFile==="function") image_url=await uploadFile(file,"chat");

      const username=window.currentProfile?.username ||
        window.currentUser.user_metadata?.username ||
        window.currentUser.email?.split("@")[0] || "Korisnik";

      const {error}=await supabaseClient.from("messages").insert({
        user_id:window.currentUser.id,
        username:String(username).slice(0,30),
        content,
        image_url
      });
      if(error) throw error;

      if(input) input.value="";
      if(typeof clearChatImage==="function") clearChatImage();
      if(typeof toast==="function") toast("Poruka je poslata.");
      if(typeof loadAll==="function") await loadAll();
    }catch(error){
      console.error(error);
      alert(error.message||"Greška pri slanju poruke.");
    }
  };

  /* ---------------- COMMENTS ---------------- */
  window.renderComments = function(){
    const container=document.getElementById("commentsList");
    if(!container) return;

    const list=Array.isArray(window.comments)?window.comments:[];
    container.innerHTML=list.length ? list.map(c=>{
      const admin=V3.isAdminMessage(c);
      const username=V3.adminName(c);

      return `
        <div class="comment ${admin?"v3-admin-comment":""}">
          <div class="comment-top">
            <div>
              <span class="comment-author ${admin?"v3-admin-name":""}">
                ${V3.escape(username)}${admin?V3.badge():""}
              </span>
            </div>
            <small class="comment-date">${typeof formatDate==="function"?formatDate(c.created_at):""}</small>
          </div>
          ${c.content ? `<div class="comment-text">${V3.escape(c.content)}</div>` : ""}
          ${c.image_url ? `
            <div class="comment-media">
              <a href="${V3.escape(c.image_url)}" target="_blank" rel="noopener noreferrer">
                <img src="${V3.escape(c.image_url)}" alt="Slika uz komentar" loading="lazy">
              </a>
            </div>` : ""}
          ${window.currentUser && (c.user_id===window.currentUser.id || typeof isAdmin==="function" && isAdmin())
            ? `<button class="btn btn-red btn-small" style="margin-top:8px" onclick="deleteComment('${V3.escape(c.id)}')">🗑️ Obriši</button>` : ""}
        </div>`;
    }).join("") :
      `<div class="empty">Nema komentara.<br>Budi prvi koji će nešto napisati.</div>`;

    if(typeof setupCommentImageUI==="function") setupCommentImageUI();

    const counter=document.getElementById("commentCounter");
    const input=document.getElementById("commentText");
    if(input&&counter) counter.textContent=`${input.value.length} / 1000`;
  };

  /* ---------------- ADMIN COMPOSE LABEL ---------------- */
  V3.addAdminControls=function(){
    if(typeof isAdmin!=="function" || !isAdmin()) return;

    const chatInput=document.getElementById("chatText");
    if(chatInput && !document.getElementById("v3AdminChatNotice")){
      const parent=chatInput.closest(".chat-input-row") || chatInput.parentElement;
      if(parent){
        const notice=document.createElement("div");
        notice.id="v3AdminChatNotice";
        notice.className="v3-admin-compose";
        notice.innerHTML=`<label><input type="checkbox" checked disabled> Poruka će biti objavljena kao <strong>ADMIN</strong></label>`;
        parent.parentElement?.insertBefore(notice,parent);
      }
    }

    const commentsInput=document.getElementById("commentText");
    if(commentsInput && !document.getElementById("v3AdminCommentNotice")){
      const parent=commentsInput.closest(".comment-form") || commentsInput.parentElement;
      if(parent){
        const notice=document.createElement("div");
        notice.id="v3AdminCommentNotice";
        notice.className="v3-admin-compose";
        notice.innerHTML=`<label><input type="checkbox" checked disabled> Komentar će biti objavljen kao <strong>ADMIN</strong></label>`;
        parent.insertBefore(notice,commentsInput);
      }
    }
  };

  /* Admin status header for community areas */
  V3.addAdminNotice=function(){
    if(typeof isAdmin!=="function" || !isAdmin()) return;
    ["chat","comments"].forEach(sectionId=>{
      const section=document.getElementById(sectionId);
      if(!section || section.querySelector(".v3-admin-tools")) return;
      const host=section.querySelector(".card") || section.firstElementChild;
      if(!host) return;
      const notice=document.createElement("div");
      notice.className="v3-admin-tools";
      notice.innerHTML=`<span class="v3-admin-live"><i></i> ADMIN način rada</span><span class="muted">Tvoje objave se prikazuju kao Admin</span>`;
      host.insertBefore(notice,host.firstChild);
    });
  };

  V3.refresh=function(){
    V3.addAdminControls();
    V3.addAdminNotice();
    if(typeof window.renderChat==="function") window.renderChat();
    if(typeof window.renderComments==="function") window.renderComments();
  };

  /* Make role lookup happen before the first useful repaint. */
  V3.start=async function(){
    await V3.loadAdminIds();
    V3.refresh();
  };

  /* Re-run after existing app initialization and auth changes. */
  setTimeout(()=>V3.start(),500);
  setTimeout(()=>V3.refresh(),1800);
  window.addEventListener("load",()=>setTimeout(()=>V3.start(),300));

})();



(function(){
  "use strict";
  const PUBLIC_VAPID_KEY = "BF31f9WUjYLlq_Ze7seoz7PgKgb3bZnFpAbBoQGHSsraWyt1UMcf2f5Bg3t3pnFVVRsF-nGssAlDNw9yyQLQbCI";
  const PUSH_ENDPOINT = "https://mesryrrjnsnhadoahbux.supabase.co/functions/v1/send-push";

  function b64ToUint8Array(base64){
    const pad="=".repeat((4-base64.length%4)%4);
    const raw=atob((base64+pad).replace(/-/g,"+").replace(/_/g,"/"));
    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }

  async function registerSW(){
    if(!("serviceWorker" in navigator)) return null;
    try{return await navigator.serviceWorker.register("./service-worker.js",{scope:"./"});}
    catch(e){console.warn("Service worker nije registrovan:",e);return null;}
  }

  async function subscribePush(){
    if(!window.currentUser){alert("Prvo se prijavi.");return;}
    if(!("Notification" in window) || !("PushManager" in window)){
      alert("Ovaj browser ne podržava push notifikacije.");
      return;
    }
    if(PUBLIC_VAPID_KEY.startsWith("PASTE_")){
      alert("Prvo treba ubaciti VAPID public key u V3 kod. Napravićemo ga u sljedećem koraku u Supabase.");
      return;
    }

    const permission=await Notification.requestPermission();
    if(permission!=="granted"){
      alert("Obavještenja nisu dozvoljena.");
      return;
    }

    const reg=await registerSW();
    if(!reg) return;

    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:b64ToUint8Array(PUBLIC_VAPID_KEY)
      });
    }

    const payload=sub.toJSON();
    const {error}=await supabaseClient.from("push_subscriptions").upsert({
      user_id:window.currentUser.id,
      endpoint:sub.endpoint,
      p256dh:payload.keys?.p256dh||null,
      auth:payload.keys?.auth||null,
      user_agent:navigator.userAgent,
      updated_at:new Date().toISOString()
    },{onConflict:"endpoint"});

    if(error) throw error;
    localStorage.setItem("medjasi_push_enabled","1");
    updatePushUI();
    if(typeof toast==="function") toast("🔔 Push obavještenja su uključena.");
  }

  async function disablePush(){
    try{
      const reg=await navigator.serviceWorker.getRegistration("./");
      const sub=await reg?.pushManager.getSubscription();
      if(sub){
        await supabaseClient.from("push_subscriptions").delete().eq("endpoint",sub.endpoint);
        await sub.unsubscribe();
      }
    }catch(e){console.warn(e)}
    localStorage.removeItem("medjasi_push_enabled");
    updatePushUI();
  }

  function updatePushUI(){
    const status=document.getElementById("v3PushStatus");
    const btn=document.getElementById("v3PushButton");
    if(!status||!btn) return;
    const enabled=localStorage.getItem("medjasi_push_enabled")==="1";
    status.textContent=enabled?"🔔 Push obavještenja su uključena.":"Push obavještenja nisu uključena.";
    status.className="v3-push-status "+(enabled?"ok":"warn");
    btn.textContent=enabled?"🔕 Isključi obavještenja":"🔔 Uključi obavještenja";
    btn.onclick=enabled?disablePush:subscribePush;
  }

  function addPushUI(){
    const admin=document.querySelector("#admin");
    if(!admin || document.getElementById("v3PushCard")) return;
    const card=document.createElement("div");
    card.id="v3PushCard";
    card.className="card v3-push-card";
    card.innerHTML=`<div class="v3-push-row">
      <div><strong>🔔 Push obavještenja</strong><div id="v3PushStatus" class="v3-push-status">Provjera...</div></div>
      <button id="v3PushButton" class="btn btn-blue" type="button">🔔 Uključi obavještenja</button>
    </div>`;
    admin.appendChild(card);
    updatePushUI();
  }

  window.medjasiPush={registerSW,subscribePush,disablePush};
  window.addEventListener("load",async()=>{await registerSW(); setTimeout(addPushUI,1500);});
  setInterval(addPushUI,3000);
})();



(function(){
"use strict";
const V7={
  news:[], stats:[], seasons:[], pushPublicKey:"BF31f9WUjYLlq_Ze7seoz7PgKgb3bZnFpAbBoQGHSsraWyt1UMcf2f5Bg3t3pnFVVRsF-nGssAlDNw9yyQLQbCI",
  pushEndpoint:"https://mesryrrjnsnhadoahbux.supabase.co/functions/v1/send-push"
};
window.medjasiV7=V7;
const $=id=>document.getElementById(id);
const escV=s=>String(s??"").replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const teamV=id=>window.getTeam?.(id)||window.teams?.find(x=>String(x.id)===String(id));
const playerV=id=>window.getPlayer?.(id)||window.players?.find(x=>String(x.id)===String(id));
const isAdm=()=>!!window.isAdmin?.();
const toastV=(m,t)=>window.toast?window.toast(m,t):alert(m);
function formatV(d){try{return window.formatDate?window.formatDate(d):new Date(d).toLocaleString('bs-BA')}catch{return new Date(d).toLocaleString('bs-BA')}}
function mediaHtml(url,type,title=""){if(!url)return "";return type==='video'?`<video controls playsinline preload="metadata" src="${escV(url)}"></video>`:`<img loading="lazy" src="${escV(url)}" alt="${escV(title)}">`}

function ensureNewsUI(){
  if(!$('news')){
    const sec=document.createElement('section');sec.id='news';sec.className='section';
    sec.innerHTML=`<div class="gallery-hero"><div><span class="hero-kicker">ZVANIČNE INFORMACIJE LIGE</span><h2 class="section-title" style="margin:4px 0 6px">📰 Vijesti</h2><p class="muted">Novosti, najave, rezultati i dešavanja iz Medjaši Futsal Lige.</p></div><div class="gallery-count" id="newsCount">0 vijesti</div></div><div id="newsFeature"></div><div id="newsGrid" class="v7-news-grid"></div>`;
    const comments=document.querySelector('#comments');comments?.parentNode.insertBefore(sec,comments);
  }
  document.querySelectorAll('button[onclick*="showSection(\'comments\')"]').forEach(b=>{if(b.innerHTML.includes('Komentari')){b.innerHTML=b.innerHTML.replace('💭','📰').replace('Komentari','Vijesti');b.setAttribute('onclick',"showSection('news')")}});
  document.querySelectorAll('.mobile-more-grid button').forEach(b=>{if(b.innerHTML.includes('Komentari')){b.innerHTML=b.innerHTML.replace('💭','📰').replace('Komentari','Vijesti').replace('Komentari zajednice','Novosti lige');b.setAttribute('onclick',"mobileMoreGo('news')")}});
  const c=$('comments');if(c){const h=c.querySelector('.section-title');if(h)h.textContent='💬 Komentari zajednice';}
  ensureAdminNews();
}
function ensureAdminNews(){
  const admin=$('adminContent');if(!admin||!isAdm()||$('v7NewsAdmin'))return;
  const card=document.createElement('div');card.id='v7NewsAdmin';card.className='card';card.style.marginTop='20px';
  card.innerHTML=`<div class="admin-card-head"><div><span class="hero-kicker">SADRŽAJ LIGE</span><h3>📰 Upravljanje vijestima</h3><p class="muted">Objavi novost, dodaj sliku ili video i podijeli je direktno u chat.</p></div><span class="admin-pill">SAMO ADMIN</span></div><div class="v7-admin-news-form"><div class="form-group"><label>Naslov</label><input id="v7NewsTitle" maxlength="150" placeholder="Naslov vijesti"></div><div class="form-group"><label>Autor / oznaka</label><input id="v7NewsKicker" maxlength="50" placeholder="npr. LIGA, NAJAVA, REZULTAT"></div><div class="form-group wide"><label>Kratki uvod</label><textarea id="v7NewsLead" maxlength="400" style="min-height:80px" placeholder="Kratak uvod koji se vidi na kartici"></textarea></div><div class="form-group wide"><label>Sadržaj vijesti</label><textarea id="v7NewsBody" maxlength="10000" placeholder="Tekst vijesti..."></textarea></div><div class="form-group"><label>Slika ili video</label><input id="v7NewsFile" type="file" accept="image/*,video/mp4,video/webm,video/ogg"></div><div class="form-group"><label>Objavi</label><select id="v7NewsPublished"><option value="true">Odmah javno</option><option value="false">Sačuvaj kao skicu</option></select></div></div><div class="actions" style="margin-top:12px"><button class="btn btn-green" onclick="medjasiV7.publishNews()">📰 Objavi vijest</button></div><div id="v7NewsAdminList" class="v7-admin-news-list"></div>`;
  admin.appendChild(card);renderAdminNews();
}
async function loadNews(){
  ensureNewsUI();
  const query=supabaseClient.from('news').select('*').order('created_at',{ascending:false}).limit(100);
  const {data,error}=isAdm()?await query:await query.eq('published',true);
  if(error){console.warn('News:',error);return}
  V7.news=data||[];
  renderNews();
  renderAdminNews();
}
function renderNews(){
  const publicNews=V7.news.filter(n=>n.published===true);
  ensureNewsUI();const count=$('newsCount');if(count)count.textContent=`${publicNews.length} ${publicNews.length===1?'vijest':'vijesti'}`;
  const feature=$('newsFeature'),grid=$('newsGrid');if(!grid)return;
  if(!publicNews.length){if(feature)feature.innerHTML='';grid.innerHTML='<div class="v7-news-empty" style="grid-column:1/-1">📰 Još nema objavljenih vijesti.</div>';return}
  const f=publicNews[0];
  if(feature)feature.innerHTML=`<article class="v7-news-card card" style="margin-bottom:0"><div class="v7-news-media">${mediaHtml(f.media_url||f.image_url,f.media_type,f.title)}</div><div class="v7-news-body"><div class="v7-news-kicker">${escV(f.kicker||'VIJEST')}</div><div class="v7-news-title">${escV(f.title)}</div><div class="v7-news-lead">${escV(f.lead||'')}</div><div class="v7-news-meta"><span>${formatV(f.created_at)}</span><span>${escV(f.author_name||'Medjaši Futsal Liga')}</span></div><div class="v7-news-actions"><button class="btn btn-green btn-small" onclick="medjasiV7.openNews('${f.id}')">Otvori vijest →</button><button class="btn btn-small" onclick="medjasiV7.shareNews('${f.id}')">↗ Podijeli</button></div></div></article>`;
  grid.innerHTML=publicNews.slice(1).map(n=>`<article class="v7-news-card card"><div class="v7-news-media">${mediaHtml(n.media_url||n.image_url,n.media_type,n.title)}</div><div class="v7-news-body"><div class="v7-news-kicker">${escV(n.kicker||'VIJEST')}</div><div class="v7-news-title">${escV(n.title)}</div><div class="v7-news-lead">${escV(n.lead||'')}</div><div class="v7-news-meta"><span>${formatV(n.created_at)}</span><span>${escV(n.author_name||'Liga')}</span></div><div class="v7-news-actions"><button class="btn btn-green btn-small" onclick="medjasiV7.openNews('${n.id}')">Otvori</button><button class="btn btn-small" onclick="medjasiV7.shareNews('${n.id}')">↗ Chat</button></div></div></article>`).join('');
}
function openNews(id){const n=V7.news.find(x=>String(x.id)===String(id));if(!n)return;showModal(`<div class="modal-title"><span class="hero-kicker">${escV(n.kicker||'VIJEST')}</span><h2>${escV(n.title)}</h2><p class="muted">${formatV(n.created_at)} · ${escV(n.author_name||'Medjaši Futsal Liga')}</p></div><div class="v7-news-media" style="border-radius:16px">${mediaHtml(n.media_url||n.image_url,n.media_type,n.title)}</div><div style="white-space:pre-wrap;line-height:1.75;margin-top:18px">${escV(n.body||n.lead||'')}</div><div class="actions" style="margin-top:18px"><button class="btn btn-green" onclick="medjasiV7.shareNews('${n.id}')">💬 Podijeli u chat</button></div>`)}
async function shareNews(id){const n=V7.news.find(x=>String(x.id)===String(id));if(!n||!currentUser){showSection('login');toastV('Prijavi se da bi podijelio vijest.','error');return}const text=`📰 ${n.title}\n${n.lead||''}`.trim();const {error}=await supabaseClient.from('messages').insert({user_id:currentUser.id,username:currentProfile?.username||currentUser.email?.split('@')[0]||'Korisnik',content:text,image_url:n.media_type==='image'?(n.media_url||n.image_url):null});if(error){toastV(error.message,'error');return}hideModal();showSection('chat');await loadAll();toastV('Vijest je podijeljena u chat.');}
async function publishNews(){if(!isAdm())return toastV('Nemaš admin ovlaštenje.','error');const title=$('v7NewsTitle')?.value.trim(),lead=$('v7NewsLead')?.value.trim(),body=$('v7NewsBody')?.value.trim(),kicker=$('v7NewsKicker')?.value.trim()||'VIJEST',published=$('v7NewsPublished')?.value==='true',file=$('v7NewsFile')?.files?.[0];if(!title||!body){toastV('Unesi naslov i sadržaj vijesti.','error');return}let media_url=null,media_type=null;if(file){if(file.size>50*1024*1024){toastV('Fajl je prevelik. Maksimum je 50 MB.','error');return}media_url=await uploadFile(file,'news');media_type=file.type.startsWith('video/')?'video':'image'}const {error}=await supabaseClient.from('news').insert({title,lead,body,kicker,author_id:currentUser.id,author_name:currentProfile?.username||currentUser.email?.split('@')[0]||'Admin',media_url,media_type,published});if(error){toastV(error.message,'error');return}if(published) await notifyPush('news',`📰 ${title}`,lead||'Nova vijest na sajtu.');['v7NewsTitle','v7NewsLead','v7NewsBody','v7NewsKicker'].forEach(id=>{if($(id))$(id).value=''});if($('v7NewsFile'))$('v7NewsFile').value='';await loadNews();toastV('Vijest je objavljena.');}
async function deleteNews(id){if(!isAdm())return; if(!confirm('Obrisati ovu vijest?'))return;const {error}=await supabaseClient.from('news').delete().eq('id',id);if(error)return toastV(error.message,'error');await loadNews();toastV('Vijest je obrisana.');}
function renderAdminNews(){
  const box=$('v7NewsAdminList');
  if(!box||!isAdm())return;
  box.innerHTML=V7.news.length?V7.news.map(n=>`<div class="v7-admin-news-row">
    <div class="v7-news-row-media">${n.media_url?mediaHtml(n.media_url,n.media_type,n.title):''}</div>
    <div class="v7-news-row-main">
      <strong>${escV(n.title)}</strong>
      <small class="muted">${formatV(n.created_at)} · ${n.published?'JAVNO':'SKICA'}</small>
    </div>
    <div class="v7-news-row-actions">
      <button class="btn btn-small ${n.published?'btn-yellow':'btn-green'}" onclick="medjasiV7.setNewsPublished('${n.id}',${!n.published})">${n.published?'Sakrij':'Objavi'}</button>
      <button class="btn btn-red btn-small" onclick="medjasiV7.deleteNews('${n.id}')">🗑️</button>
    </div>
  </div>`).join(''):'<div class="muted">Nema vijesti.</div>';
}
async function setNewsPublished(id,published){
  if(!isAdm())return toastV('Nemaš admin ovlaštenje.','error');
  const {error}=await supabaseClient.from('news').update({published,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return toastV(error.message,'error');
  await loadNews();
  toastV(published?'Vijest je objavljena.':'Vijest je sklonjena iz javnosti.');
}

function ratingClass(r){return r>=7.5?'good':r>=6?'mid':'low'}
function matchRating(matchId,pid){const p=playerV(pid),m=matches.find(x=>String(x.id)===String(matchId));if(!p||!m)return 6;const gs=goals.filter(g=>String(g.match_id)===String(matchId));const cs=cards.filter(c=>String(c.match_id)===String(matchId));const g=gs.filter(x=>String(x.player_id)===String(pid)).length;const a=gs.filter(x=>String(x.assist_player_id)===String(pid)).length;const yc=cs.filter(x=>String(x.player_id)===String(pid)&&String(x.card_type).toLowerCase().includes('yellow')).length;const rc=cs.filter(x=>String(x.player_id)===String(pid)&&String(x.card_type).toLowerCase().includes('red')).length;const side=p.team_id===m.home_team_id?'home':p.team_id===m.away_team_id?'away':null;let r=6+g*1.0+a*.7-yc*.35-rc*2;if(side){const hs=+m.home_score||0,as=+m.away_score||0;if(hs!==as)r+=(side==='home'?(hs>as?.35:-.2):(as>hs?.35:-.2))}const st=V7.stats.find(x=>String(x.match_id)===String(matchId)&&String(x.player_id)===String(pid));if(st)r+=Math.min(2,(+st.saves||0)*.12);return Math.max(3,Math.min(10,Math.round(r*10)/10))}
function playerRatingLine(matchId,pid){const r=matchRating(matchId,pid);return `<span class="v7-rating ${ratingClass(r)}">${r.toFixed(1)}</span>`}
function ratingRows(matchId,teamId){const ids=matchPlayers.filter(mp=>String(mp.match_id)===String(matchId)&&playerV(mp.player_id)?.team_id===teamId);return ids.map(mp=>{const p=playerV(mp.player_id);return p?`<tr><td>#${escV(p.jersey_number??'-')} ${escV(p.name)}</td><td>${playerRatingLine(matchId,p.id)}</td><td>${goals.filter(g=>String(g.match_id)===String(matchId)&&String(g.player_id)===String(p.id)).length}</td><td>${goals.filter(g=>String(g.match_id)===String(matchId)&&String(g.assist_player_id)===String(p.id)).length}</td><td>${V7.stats.find(s=>String(s.match_id)===String(matchId)&&String(s.player_id)===String(p.id))?.saves||0}</td></tr>`:''}).join('')}
async function loadStats(){const {data,error}=await supabaseClient.from('match_player_stats').select('*');if(!error)V7.stats=data||[]}
async function addSave(matchId,pid){if(!isAdm())return;const existing=V7.stats.find(x=>String(x.match_id)===String(matchId)&&String(x.player_id)===String(pid));const saves=(+existing?.saves||0)+1;const {error}=await supabaseClient.from('match_player_stats').upsert({match_id:matchId,player_id:pid,saves,updated_at:new Date().toISOString()},{onConflict:'match_id,player_id'});if(error)return toastV(error.message,'error');await loadStats();await renderEnhancedLive(matchId);}
function renderEnhancedLive(matchId){const m=matches.find(x=>String(x.id)===String(matchId));if(!m||m.status!=='live')return;const host=$('modalContent');if(!host)return;host.querySelectorAll('.v7-live-rating-table').forEach(x=>x.remove());const h=teamV(m.home_team_id),a=teamV(m.away_team_id);const block=(team,label)=>`<div class="card v7-live-rating-table" style="margin-top:14px"><h3>${label} · ocjene</h3><div class="table-wrap" style="margin-top:10px"><table class="v7-stat-table"><thead><tr><th>Igrač</th><th>Ocjena</th><th>G</th><th>A</th><th>O</th></tr></thead><tbody>${ratingRows(matchId,team.id)||'<tr><td colspan="5">Nema postave.</td></tr>'}</tbody></table></div></div>`;host.insertAdjacentHTML('beforeend',block(h,escV(h?.name||'Domaćin'))+block(a,escV(a?.name||'Gost')))}
async function openFinished(matchId){const m=matches.find(x=>String(x.id)===String(matchId));if(!m)return;const hp=matchPlayers.filter(mp=>String(mp.match_id)===String(matchId)&&playerV(mp.player_id)?.team_id===m.home_team_id);const ap=matchPlayers.filter(mp=>String(mp.match_id)===String(matchId)&&playerV(mp.player_id)?.team_id===m.away_team_id);showModal(`<div class="modal-title"><h2>🏁 Završetak utakmice · statistika</h2><p class="muted">${escV(teamV(m.home_team_id)?.name)} ${m.home_score||0}:${m.away_score||0} ${escV(teamV(m.away_team_id)?.name)}</p></div><div class="v7-finished-grid"><div class="card"><h3>⚽ Golovi i asistencije</h3><p class="muted" style="margin:6px 0 12px">Ako statistiku unosiš naknadno, možeš evidentirati svaki gol i asistenta.</p><div class="actions"><button class="btn btn-green" onclick="medjasiV7.openGoal('${matchId}')">＋ Dodaj gol</button></div><div style="margin-top:12px">${goals.filter(g=>String(g.match_id)===String(matchId)).sort((x,y)=>(+x.minute||0)-(+y.minute||0)).map(g=>`<div class="event"><span class="event-minute">${g.minute||0}'</span><span class="event-icon">⚽</span><div><b>${escV(playerV(g.player_id)?.name||'Igrač')}</b>${g.assist_player_id?` <span class="muted">assist: ${escV(playerV(g.assist_player_id)?.name||'')}</span>`:''}</div></div>`).join('')||'<div class="empty compact">Nema golova.</div>'}</div></div><div class="card"><h3>📊 Ocjene igrača</h3><div class="table-wrap" style="margin-top:10px"><table class="v7-stat-table"><thead><tr><th>Igrač</th><th>Ocjena</th><th>G</th><th>A</th><th>O</th></tr></thead><tbody>${ratingRows(matchId,m.home_team_id)}${ratingRows(matchId,m.away_team_id)}</tbody></table></div></div></div>${renderMvp(matchId)}<div class="actions" style="margin-top:16px"><button class="btn btn-blue" onclick="medjasiV7.finishAndSave('${matchId}')">💾 Sačuvaj statistiku i završi</button></div>`)}
async function finishAndSave(matchId){if(!isAdm())return;const m=matches.find(x=>String(x.id)===String(matchId));if(!m)return;await saveRatings(matchId);const {error}=await supabaseClient.from('matches').update({status:'finished'}).eq('id',matchId);if(error)return toastV(error.message,'error');await notifyPush('finish',`🏁 ${teamV(m.home_team_id)?.name} ${m.home_score||0}:${m.away_score||0} ${teamV(m.away_team_id)?.name}`,'Utakmica je završena.');await loadAll();hideModal();toastV('Utakmica je završena i statistika je sačuvana.');}
async function saveRatings(matchId){const ids=matchPlayers.filter(mp=>String(mp.match_id)===String(matchId)).map(mp=>mp.player_id);for(const pid of ids){const gs=goals.filter(g=>String(g.match_id)===String(matchId)&&String(g.player_id)===String(pid)).length;const as=goals.filter(g=>String(g.match_id)===String(matchId)&&String(g.assist_player_id)===String(pid)).length;const st=V7.stats.find(s=>String(s.match_id)===String(matchId)&&String(s.player_id)===String(pid));const rating=matchRating(matchId,pid);const {error}=await supabaseClient.from('match_player_stats').upsert({match_id:matchId,player_id:pid,goals:gs,assists:as,saves:+st?.saves||0,rating,is_mvp:false,updated_at:new Date().toISOString()},{onConflict:'match_id,player_id'});if(error)console.warn(error)}const all=ids.map(pid=>({pid,r:matchRating(matchId,pid)})).sort((a,b)=>b.r-a.r);if(all[0])await supabaseClient.from('match_player_stats').update({is_mvp:true}).eq('match_id',matchId).eq('player_id',all[0].pid)}
function openGoal(matchId){const m=matches.find(x=>String(x.id)===String(matchId));if(!m)return;const reg=matchPlayers.filter(mp=>String(mp.match_id)===String(matchId)).map(mp=>playerV(mp.player_id)).filter(Boolean);const opts=reg.map(p=>`<option value="${p.id}">${escV(teamV(p.team_id)?.name||'')} · #${p.jersey_number??'-'} · ${escV(p.name)}</option>`).join('');showModal(`<div class="modal-title"><h2>⚽ Dodaj gol</h2><p class="muted">Možeš odmah odabrati asistenta.</p></div><div class="form"><div class="form-group"><label>Strijelac</label><select id="v7GoalPlayer">${opts}</select></div><div class="form-group"><label>Minuta</label><input id="v7GoalMinute" type="number" min="0" value="${m.current_minute||0}"></div><div class="form-group"><label>Asistencija?</label><select id="v7GoalAssist"><option value="">Bez asistencije</option>${opts}</select></div><button class="btn btn-green" onclick="medjasiV7.addGoal('${matchId}')">⚽ Evidentiraj gol</button></div>`)}
async function addGoal(matchId){const m=matches.find(x=>String(x.id)===String(matchId));const pid=$('v7GoalPlayer')?.value,aid=$('v7GoalAssist')?.value||null,min=+($('v7GoalMinute')?.value||0);const p=playerV(pid),a=playerV(aid);if(!p||!m)return;if(aid&&pid===aid)return toastV('Strijelac ne može biti sam sebi asistent.','error');if(aid&&(!a||a.team_id!==p.team_id))return toastV('Asistent mora biti iz iste ekipe.','error');const {error}=await supabaseClient.from('goals').insert({match_id:matchId,player_id:pid,assist_player_id:aid,minute:min});if(error)return toastV(error.message,'error');const update=p.team_id===m.home_team_id?{home_score:(+m.home_score||0)+1}:{away_score:(+m.away_score||0)+1};const {error:e2}=await supabaseClient.from('matches').update(update).eq('id',matchId);if(e2)return toastV(e2.message,'error');await notifyPush('goal',`⚽ GOL! ${teamV(p.team_id)?.name}` ,`${p.name}${a?` · asistencija ${a.name}`:''} · ${min}'`);hideModal();await loadAll();openMatch(matchId)}
function decorateCourtRatings(matchId){document.querySelectorAll('.player-on-court').forEach(el=>{const nameEl=el.querySelector('.player-court-name');if(!nameEl)return;const text=nameEl.textContent.trim();const p=players.find(x=>text.includes(String(x.name||'')));if(!p)return;const old=el.querySelector('.v7-player-rating-bubble');if(old)old.remove();const bubble=document.createElement('span');bubble.className='v7-player-rating-bubble';bubble.textContent=matchRating(matchId,p.id).toFixed(1);el.querySelector('.player-circle')?.parentElement?.classList.add('v7-player-circle-wrap');el.appendChild(bubble)})}
function addSaveButtonToLive(matchId){const m=matches.find(x=>String(x.id)===String(matchId));if(!m)return;const regs=matchPlayers.filter(mp=>String(mp.match_id)===String(matchId)&&mp.is_active).map(mp=>playerV(mp.player_id)).filter(p=>p&&p.position&&String(p.position).toLowerCase().includes('golman'));if(!regs.length)return;const host=$('modalContent');if(!host)return;const old=host.querySelector('.v7-live-actions');if(old)old.remove();const el=document.createElement('div');el.className='v7-live-actions';el.innerHTML=regs.map(p=>`<button class="btn btn-blue btn-small" onclick="medjasiV7.addSave('${matchId}','${p.id}')">🧤 Odbrana · ${escV(p.name)}</button>`).join('')+`<button class="btn btn-green btn-small" onclick="medjasiV7.openGoal('${matchId}')">⚽ Gol + asistencija</button><button class="btn btn-yellow btn-small" onclick="openCardControl('${matchId}')">🟨 Karton</button><button class="btn btn-small" onclick="openSubstitutionControl('${matchId}')">🔄 Izmjena</button>`;host.querySelector('.live-scoreboard')?.after(el)}

async function finishMatchWithStats(id){openFinished(id)}
function openSeasonStats(){const by={};(V7.stats||[]).forEach(s=>{const p=playerV(s.player_id);if(!p)return;(by[p.id]??={p,g:0,a:0,o:0,r:0,n:0}).g+=+s.goals||0;by[p.id].a+=+s.assists||0;by[p.id].o+=+s.saves||0;by[p.id].r+=+s.rating||0;by[p.id].n++});const rows=Object.values(by).sort((a,b)=>(b.g-b.a*0.1)-(a.g-a.a*0.1));showModal(`<div class="modal-title"><h2>📊 Statistika sezone</h2></div><div class="table-wrap"><table class="v7-stat-table"><thead><tr><th>Igrač</th><th>Golovi</th><th>Asist.</th><th>Odbrane</th><th>Prosj. ocjena</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escV(x.p.name)}</td><td>${x.g}</td><td>${x.a}</td><td>${x.o}</td><td>${(x.r/Math.max(1,x.n)).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`)}

async function notifyPush(type,title,body){try{if(!currentUser)return;const sessionResult=await supabaseClient.auth.getSession();const token=sessionResult.data?.session?.access_token;if(!token)return;await fetch(V7.pushEndpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({type,title,body,match_id:currentMatchId||null})})}catch(e){console.warn('Push notify:',e)}}
function b64ToBytes(s){const pad='='.repeat((4-s.length%4)%4),raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function subscribeRealPush(){if(!currentUser)return toastV('Prvo se prijavi.','error');if(!('serviceWorker' in navigator)||!('PushManager' in window))return toastV('Ovaj browser ne podržava push.','error');const perm=await Notification.requestPermission();if(perm!=='granted')return toastV('Dozvola za obavještenja nije odobrena.','error');const reg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(V7.pushPublicKey)});const j=sub.toJSON();const {error}=await supabaseClient.from('push_subscriptions').upsert({user_id:currentUser.id,endpoint:sub.endpoint,p256dh:j.keys?.p256dh,auth:j.keys?.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'});if(error)return toastV(error.message,'error');localStorage.setItem('medjasi_push_enabled','1');renderPushUI();toastV('🔔 Push obavještenja su uključena.')}
async function disableRealPush(){try{const reg=await navigator.serviceWorker.getRegistration('./');const sub=await reg?.pushManager.getSubscription();if(sub){await supabaseClient.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe()}}catch(e){console.warn(e)}localStorage.removeItem('medjasi_push_enabled');renderPushUI()}
function renderPushUI(){if(!$('v7PushStatus')||!$('v7PushButton'))return;const on=localStorage.getItem('medjasi_push_enabled')==='1';$('v7PushStatus').textContent=on?'🔔 Push obavještenja su uključena.':'Push obavještenja nisu uključena.';$('v7PushStatus').className='v7-push-status '+(on?'ok':'');$('v7PushButton').textContent=on?'🔕 Isključi push':'🔔 Uključi push';$('v7PushButton').onclick=on?disableRealPush:subscribeRealPush}
function ensureSeasonAdmin(){if(!$('adminContent')||!isAdm()||$('v7SeasonCard'))return;const c=document.createElement('div');c.id='v7SeasonCard';c.className='card';c.style.marginTop='20px';c.innerHTML=`<div class="admin-card-head"><div><span class="hero-kicker">SEZONE</span><h3>🏆 Upravljanje sezonama</h3><p class="muted">Aktivna sezona se automatski dodjeljuje novim utakmicama.</p></div><span class="admin-pill">SAMO ADMIN</span></div><div class="actions"><input id="v7SeasonName" placeholder="npr. 2026/27" style="max-width:220px"><button class="btn btn-green" onclick="medjasiV7.addSeason()">＋ Nova sezona</button></div><div id="v7SeasonList" style="margin-top:12px"></div>`;$('adminContent').appendChild(c);renderSeasons()}
async function loadSeasons(){const {data,error}=await supabaseClient.from('seasons').select('*').order('created_at',{ascending:false});if(!error)V7.seasons=data||[];renderSeasons()}
function renderSeasons(){const box=$('v7SeasonList');if(!box)return;box.innerHTML=(V7.seasons||[]).map(s=>`<div class="admin-match" style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div><strong>${escV(s.name)}</strong><small class="muted" style="display:block;margin-top:3px">${s.is_active?'AKTIVNA':'Arhiva'}</small></div>${s.is_active?'':'<button class="btn btn-small" onclick="medjasiV7.activateSeason(\''+s.id+'\')">Postavi aktivnu</button>'}</div>`).join('')||'<div class="muted">Nema sezona.</div>'}
async function addSeason(){if(!isAdm())return;const name=$('v7SeasonName')?.value.trim();if(!name)return;const {error}=await supabaseClient.from('seasons').insert({name,is_active:false});if(error)return toastV(error.message,'error');$('v7SeasonName').value='';await loadSeasons()}
async function activateSeason(id){if(!isAdm())return;await supabaseClient.from('seasons').update({is_active:false}).neq('id','00000000-0000-0000-0000-000000000000');const {error}=await supabaseClient.from('seasons').update({is_active:true}).eq('id',id);if(error)return toastV(error.message,'error');await loadSeasons();toastV('Aktivna sezona je promijenjena.')} 
function ensurePushUI(){if(!$('adminContent')||!isAdm()||$('v7PushCard'))return;const c=document.createElement('div');c.id='v7PushCard';c.className='card v7-push-card';c.innerHTML=`<div class="v7-push-row"><div><strong>🔔 Push notifikacije</strong><div id="v7PushStatus" class="v7-push-status">Provjera...</div></div><button id="v7PushButton" class="btn btn-blue">🔔 Uključi push</button></div>`;$('adminContent').appendChild(c);renderPushUI()}

// Gallery: image + video compatibility layer. Existing image_url rows continue to work.
function renderGalleryV7(){const grid=$('galleryGrid'),count=$('galleryCount');if(!grid)return;const arr=gallery||[];if(count)count.textContent=`${arr.length} ${arr.length===1?'medij':'medija'}`;if(!arr.length){grid.innerHTML='<div class="empty gallery-empty">📸 Galerija je trenutno prazna.</div>';return}grid.innerHTML=arr.map(x=>{const url=x.media_url||x.image_url,type=x.media_type||'image';return `<article class="gallery-item"><button class="gallery-photo" type="button" onclick="${type==='video'?`medjasiV7.openMedia('${escV(url)}','video','${escV(x.title||'Video')}')`:`openImagePreview('${escV(url)}','${escV(x.title||'Galerija')}')`}">${type==='video'?`<video muted playsinline preload="metadata" src="${escV(url)}"></video>`:`<img src="${escV(url)}" alt="${escV(x.title||'Fotografija')}" loading="lazy">`}<span class="gallery-overlay">${type==='video'?'▶️ Pusti video':'🔍 Pregledaj'}</span></button><div class="gallery-caption"><strong>${escV(x.title||'Medij lige')}</strong>${x.description?`<p>${escV(x.description)}</p>`:''}<small class="muted">${formatV(x.created_at)}</small></div></article>`}).join('')}
function openMedia(url,type,title){showModal(`<div class="modal-title"><h2>${escV(title)}</h2></div>${type==='video'?`<video controls autoplay playsinline style="display:block;width:100%;max-height:75vh;border-radius:14px;background:#000" src="${escV(url)}"></video>`:`<img src="${escV(url)}" style="display:block;max-width:100%;max-height:75vh;margin:auto;border-radius:14px">`}`)}
async function adminAddMedia(){if(!isAdm())return;const file=$('galleryImageFile')?.files?.[0],title=$('galleryTitle')?.value.trim()||'',description=$('galleryDescription')?.value.trim()||'';if(!file)return toastV('Izaberi sliku ili video.','error');if(file.size>50*1024*1024)return toastV('Maksimum je 50 MB.','error');try{const media_url=await uploadFile(file,'gallery');const media_type=file.type.startsWith('video/')?'video':'image';const {error}=await supabaseClient.from('gallery').insert({image_url:media_type==='image'?media_url:null,media_url,media_type,title:title.slice(0,100)||'Medij lige',description:description.slice(0,250),created_by:currentUser.id});if(error)throw error;$('galleryImageFile').value='';$('galleryTitle').value='';$('galleryDescription').value='';await loadAll();toastV('Medij je objavljen.')}catch(e){toastV(e.message||'Greška pri uploadu.','error')}}
function ensureGalleryVideoUI(){const input=$('galleryImageFile');if(!input)return;input.accept='image/*,video/mp4,video/webm,video/ogg';const label=input.closest('.form-group')?.querySelector('label');if(label)label.textContent='Fotografija ili video'}

// Search: teams, players, matches and news.
function ensureSearch(){if($('v7Search'))return;const actions=document.querySelector('.header-actions');if(!actions)return;const wrap=document.createElement('div');wrap.className='v7-search-wrap';wrap.innerHTML='<input id="v7Search" type="search" placeholder="🔎 Pretraži..." autocomplete="off"><div id="v7SearchResults" class="v7-search-results"></div>';actions.insertBefore(wrap,actions.firstChild);$('v7Search').addEventListener('input',renderSearch);document.addEventListener('click',e=>{if(!wrap.contains(e.target))$('v7SearchResults').classList.remove('open')})}
function renderSearch(){const q=$('v7Search')?.value.trim().toLowerCase(),box=$('v7SearchResults');if(!box)return;if(q.length<2){box.classList.remove('open');return}const res=[];teams.filter(t=>String(t.name||'').toLowerCase().includes(q)).slice(0,5).forEach(t=>res.push({i:'🛡️',t:t.name,s:'Ekipa',fn:`showSection('teams')`}));players.filter(p=>String(p.name||'').toLowerCase().includes(q)).slice(0,5).forEach(p=>res.push({i:'👤',t:p.name,s:`Igrač · ${teamV(p.team_id)?.name||''}`,fn:`showSection('players')`}));V7.news.filter(n=>String(n.title||'').toLowerCase().includes(q)).slice(0,5).forEach(n=>res.push({i:'📰',t:n.title,s:'Vijest',fn:`medjasiV7.openNews('${n.id}')`}));box.innerHTML=res.length?res.map(x=>`<button class="v7-search-item" onclick="${x.fn};$('v7SearchResults').classList.remove('open')"><span>${x.i}</span><span><b>${escV(x.t)}</b><small class="muted" style="display:block;margin-top:2px">${escV(x.s)}</small></span></button>`).join(''):'<div class="v7-news-empty">Nema rezultata.</div>';box.classList.add('open')}

// Load wrappers
const originalLoadAll=window.loadAll;
window.loadAll=async function(...args){const r=await originalLoadAll.apply(this,args);try{await loadStats();await loadNews()}catch(e){console.warn('V7 load:',e)}try{ensureNewsUI();ensureGalleryVideoUI();ensureSearch();ensurePushUI();renderGalleryV7()}catch(e){console.warn(e)}return r};
// Realtime safety wrapper; original subscription remains but news/stats refresh independently.
const originalOpenGoal=window.openGoalControl;window.openGoalControl=V7.openGoal;
V7.openGoal=V7.openGoal.bind(V7); // expose bound function
V7.loadNews=loadNews;V7.setNewsPublished=setNewsPublished;V7.addSeason=addSeason;V7.activateSeason=activateSeason;V7.openNews=openNews;V7.shareNews=shareNews;V7.publishNews=publishNews;V7.deleteNews=deleteNews;V7.renderNews=renderNews;V7.addGoal=addGoal;V7.openGoal=openGoal;V7.addSave=addSave;V7.openFinished=openFinished;V7.finishAndSave=finishAndSave;V7.openMedia=openMedia;V7.adminAddMedia=adminAddMedia;V7.openSeasonStats=openSeasonStats;
window.openGoalControl=function(id){return openGoal(id)};
window.adminAddGalleryImage=adminAddMedia;
window.renderAdminGallery=function(){const box=$('adminGalleryList');if(!box||!isAdm())return;box.innerHTML=`<div class="admin-gallery-title">Objavljeni mediji (${(gallery||[]).length})</div><div class="admin-gallery-items">${(gallery||[]).map(x=>{const url=x.media_url||x.image_url;return `<div class="admin-gallery-item"><div class="v7-news-row-media">${url?mediaHtml(url,x.media_type||'image',x.title):''}</div><div><strong>${escV(x.title||'Bez naslova')}</strong><small class="muted">${formatV(x.created_at)}</small></div><button class="btn btn-red btn-small" onclick="adminDeleteGalleryImage('${x.id}')">🗑️</button></div>`}).join('')||'<div class="muted">Još nema medija.</div>'}</div>`};


// Add finish button to admin match cards without replacing the existing manager.
const oldMakeSubstitution=window.makeSubstitution;window.makeSubstitution=async function(matchId,side){const out=$(side==='home'?'subHomeOut':'subAwayOut')?.value,incoming=$(side==='home'?'subHomeIn':'subAwayIn')?.value;const m=matches.find(x=>String(x.id)===String(matchId));const teamId=side==='home'?m?.home_team_id:m?.away_team_id;const minute=Number(m?.current_minute||0);const result=await oldMakeSubstitution?.(matchId,side);if(out&&incoming&&m&&isAdm()){await supabaseClient.from('match_substitutions').insert({match_id:matchId,team_id:teamId,player_out_id:out,player_in_id:incoming,minute})}return result};
function renderMvp(matchId){const ids=matchPlayers.filter(mp=>String(mp.match_id)===String(matchId)).map(mp=>mp.player_id);const top=ids.map(pid=>({pid,r:matchRating(matchId,pid)})).sort((a,b)=>b.r-a.r)[0];return top?`<div class="v7-mvp" style="margin-top:14px">🏅 <strong>MVP utakmice</strong><div style="margin-top:4px">${escV(playerV(top.pid)?.name||'Igrač')} · <span class="v7-rating good">${top.r.toFixed(1)}</span></div></div>`:''}
const oldRenderAdminMatches=window.renderAdminMatches;window.renderAdminMatches=function(){oldRenderAdminMatches?.();document.querySelectorAll('#adminMatches .admin-match').forEach((el,i)=>{const m=matches[i];if(m&&!el.querySelector('.v7-finish-btn')){const b=document.createElement('button');b.className='btn btn-blue btn-small v7-finish-btn';b.textContent='🏁 Statistika / završi';b.onclick=()=>openFinished(m.id);el.querySelector('.admin-controls')?.appendChild(b)}})};

// Patch openMatch after its definition: add save buttons/rating table for live matches.
const oldOpenMatch=window.openMatch;window.openMatch=async function(id){const r=oldOpenMatch?.(id);setTimeout(async()=>{try{await loadStats();addSaveButtonToLive(id);decorateCourtRatings(id);renderEnhancedLive(id)}catch(e){console.warn(e)}},120);return r};

// News + media + push bootstrap
setTimeout(async()=>{try{ensureNewsUI();ensureGalleryVideoUI();ensureSearch();ensurePushUI();ensureSeasonAdmin();await loadStats();await loadSeasons();await loadNews();renderGalleryV7()}catch(e){console.warn('V7 bootstrap:',e)}},800);
window.addEventListener('load',()=>setTimeout(()=>{ensureNewsUI();ensureGalleryVideoUI();ensureSearch();ensurePushUI();ensureSeasonAdmin();renderPushUI()},600));
})();



(function(){
  document.addEventListener('click',function(e){
    const b=e.target.closest('.btn-green,.btn');
    if(!b)return;
    b.classList.remove('v8-goal-flash'); void b.offsetWidth; b.classList.add('v8-goal-flash');
  });
})();



(function(){
  "use strict";
  const V={posts:[],stories:[],profiles:{},loaded:false};
  const q=id=>document.getElementById(id);
  const escV=v=>typeof esc==='function'?esc(v??''):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fallback='https://via.placeholder.com/160?text=%F0%9F%91%A4';
  const avatar=p=>escV(p?.avatar_url||fallback);
  const fmt=d=>{try{return new Intl.DateTimeFormat('bs-BA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d))}catch{return ''}};
  const logged=()=>typeof currentUser!=='undefined'&&!!currentUser;
  const guard=()=>{if(!logged()){showSection('login');if(typeof toastV==='function')toastV('Prijavi se da bi koristio Community.','error');return false}return true};
  async function loadProfiles(ids){
    const unique=[...new Set((ids||[]).filter(Boolean).map(String))]; if(!unique.length)return;
    const {data,error}=await supabaseClient.from('profiles').select('id,username,avatar_url,bio,role').in('id',unique);
    if(error){console.warn('Community profiles:',error);return}
    (data||[]).forEach(p=>V.profiles[String(p.id)]=p);
  }
  async function load(){
    try{
      const [{data:posts,error:pe},{data:stories,error:se}]=await Promise.all([
        supabaseClient.from('community_posts').select('id,user_id,image_url,caption,created_at').order('created_at',{ascending:false}).limit(50),
        supabaseClient.from('community_stories').select('id,user_id,image_url,caption,created_at,expires_at').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(40)
      ]);
      if(pe)throw pe; V.posts=posts||[];
      if(se)console.warn('Community stories:',se); V.stories=stories||[];
      await loadProfiles([...V.posts,...V.stories].map(x=>x.user_id));
      await render(); V.loaded=true;
    }catch(err){console.warn('Community load:',err); V.posts=[];V.stories=[];render();}
  }
  async function render(){renderStories();await renderFeed();await renderMyProfile()}
  function renderStories(){
    const host=q('v9Stories');if(!host)return;
    const mine=logged()?`<div class="v9-story v9-add-story" onclick="openV9StoryComposer()"><div class="v9-story-avatar">＋</div><span class="v9-story-name">Moja priča</span></div>`:'';
    const seen=new Set();const rows=[];
    V.stories.forEach(s=>{const p=V.profiles[String(s.user_id)]||{};if(seen.has(String(s.user_id)))return;seen.add(String(s.user_id));rows.push(`<div class="v9-story" onclick="openV9Story('${escV(s.id)}')"><div class="v9-story-avatar"><img src="${avatar(p)}" alt=""></div><span class="v9-story-name">${escV(p.username||'Korisnik')}</span></div>`)});
    host.innerHTML=mine+rows.join('')||'<div class="v9-empty" style="width:100%">Još nema aktivnih priča.</div>';
  }
  async function renderFeed(){
    const host=q('v9Feed');if(!host)return;
    if(!V.posts.length){host.innerHTML='<div class="v9-empty">Još nema objava. Budi prvi koji će objaviti fotografiju. 📸</div>';return}
    host.innerHTML=V.posts.map((p,i)=>{const a=V.profiles[String(p.user_id)]||{};const own=logged()&&String(p.user_id)===String(currentUser.id);return `<article class="v9-post" style="animation-delay:${Math.min(i,8)*35}ms"><div class="v9-post-head"><img class="v9-avatar" src="${avatar(a)}" alt="" onclick="openV9Profile('${escV(p.user_id)}')" style="cursor:pointer"><div><div class="v9-post-author" onclick="openV9Profile('${escV(p.user_id)}')" style="cursor:pointer">${escV(a.username||'Korisnik')}${a.role==='admin'?'<span class="v9-admin-badge">Admin</span>':''}</div><div class="v9-post-meta">${fmt(p.created_at)}</div></div>${own||typeof isAdmin==='function'&&isAdmin()?`<button class="btn btn-small v9-post-menu" onclick="deleteV9Post('${escV(p.id)}')">Obriši</button>`:''}</div><img class="v9-post-image" src="${escV(p.image_url)}" alt="${escV(p.caption||'Fotografija')}" loading="lazy" onclick="openV9Lightbox('${escV(p.image_url)}')"><div class="v9-post-body">${p.caption?`<div class="v9-post-caption">${escV(p.caption)}</div>`:''}<div class="v9-post-actions"><button id="v9r-${escV(p.id)}" class="v9-reaction" onclick="toggleV9Reaction('${escV(p.id)}','❤️')">❤️ <span>0</span></button><button class="v9-reaction" onclick="toggleV9Comments('${escV(p.id)}')">💬 <span id="v9cnum-${escV(p.id)}">0</span></button></div><div id="v9comments-${escV(p.id)}" class="v9-comments" hidden></div></div></article>`}).join('');
    await Promise.all(V.posts.map(p=>refreshPostMeta(p.id)));
  }
  async function refreshPostMeta(id){
    const [{data:r,error:re},{data:c,error:ce}]=await Promise.all([supabaseClient.from('community_reactions').select('id,user_id,reaction').eq('post_id',id),supabaseClient.from('community_comments').select('id').eq('post_id',id)]);
    if(re||ce)return;
    const b=q('v9r-'+id);if(b){b.querySelector('span').textContent=(r||[]).length;if(logged()&&r?.some(x=>String(x.user_id)===String(currentUser.id)))b.classList.add('active');else b.classList.remove('active')}
    const cnum=q('v9cnum-'+id);if(cnum)cnum.textContent=(c||[]).length;
  }
  async function renderMyProfile(){
    const host=q('v9MyProfileCard');if(!host)return;
    if(!logged()){host.innerHTML='<div class="v9-profile-top"><img class="v9-profile-avatar" src="'+fallback+'"><h3>Pridruži se zajednici</h3><p class="v9-profile-bio">Prijavi se da objavljuješ fotografije, priče i komentare.</p><button class="btn btn-green" onclick="showSection(\'login\')">Prijava</button></div>';return}
    const p=currentProfile||{};const postCount=V.posts.filter(x=>String(x.user_id)===String(currentUser.id)).length;const storyCount=V.stories.filter(x=>String(x.user_id)===String(currentUser.id)).length;
    host.innerHTML=`<div class="v9-profile-top"><img class="v9-profile-avatar" src="${avatar(p)}" alt=""><h3>${escV(p.username||'Korisnik')}${p.role==='admin'?'<span class="v9-admin-badge">Admin</span>':''}</h3><div class="v9-profile-bio">${escV(p.bio||'Dodaj kratak opis svog profila.')}</div></div><div class="v9-profile-stats"><div class="v9-profile-stat"><b>${postCount}</b><span>Objave</span></div><div class="v9-profile-stat"><b>${storyCount}</b><span>Priče</span></div></div><button class="btn btn-blue" style="width:100%" onclick="openV9Profile('${escV(currentUser.id)}')">Moj profil</button><button class="btn" style="width:100%;margin-top:7px" onclick="openV9EditProfile()">Uredi profil</button>`;
  }
  function filePreview(fileId,imgId){q(fileId)?.addEventListener('change',()=>{const f=q(fileId)?.files?.[0],im=q(imgId);if(f&&im){im.src=URL.createObjectURL(f);im.style.display='block'}})}
  window.openV9PostComposer=function(){if(!guard())return;showModal(`<div class="v9-modal-card"><div class="modal-title"><h2>📸 Nova objava</h2><p class="muted">Dodaj fotografiju i napiši šta želiš podijeliti.</p></div><div class="form"><label class="v9-drop" for="v9PostFile">📷 Izaberi fotografiju<input id="v9PostFile" type="file" accept="image/*" hidden></label><img id="v9PostPreview" class="v9-post-form-preview"><div class="form-group"><label>Opis</label><textarea id="v9PostCaption" maxlength="1000" placeholder="Napiši nešto..."></textarea></div><button class="btn btn-green" onclick="publishV9Post()">Objavi fotografiju</button></div></div>`);filePreview('v9PostFile','v9PostPreview')};
  window.publishV9Post=async function(){if(!guard())return;const f=q('v9PostFile')?.files?.[0];if(!f)return toastV('Izaberi fotografiju.','error');if(!f.type.startsWith('image/'))return toastV('Dozvoljene su samo slike.','error');if(f.size>12*1024*1024)return toastV('Fotografija može imati najviše 12 MB.','error');try{const url=await uploadFile(f,`community/${currentUser.id}`);const {error}=await supabaseClient.from('community_posts').insert({user_id:currentUser.id,image_url:url,caption:q('v9PostCaption')?.value.trim()||null});if(error)throw error;hideModal();await load();toastV('Objava je objavljena.')}catch(err){toastV(err.message||'Greška pri objavi.','error')}};
  window.openV9StoryComposer=function(){if(!guard())return;showModal(`<div class="v9-modal-card"><div class="modal-title"><h2>🔵 Nova priča</h2><p class="muted">Priča traje 24 sata.</p></div><div class="form"><label class="v9-drop" for="v9StoryFile">📷 Izaberi fotografiju<input id="v9StoryFile" type="file" accept="image/*" hidden></label><img id="v9StoryPreview" class="v9-post-form-preview"><div class="form-group"><label>Opis</label><textarea id="v9StoryCaption" maxlength="300" placeholder="Kratak opis..."></textarea></div><button class="btn btn-blue" onclick="publishV9Story()">Objavi priču</button></div></div>`);filePreview('v9StoryFile','v9StoryPreview')};
  window.publishV9Story=async function(){if(!guard())return;const f=q('v9StoryFile')?.files?.[0];if(!f)return toastV('Izaberi fotografiju.','error');if(!f.type.startsWith('image/'))return toastV('Dozvoljene su samo slike.','error');if(f.size>12*1024*1024)return toastV('Fotografija može imati najviše 12 MB.','error');try{const url=await uploadFile(f,`stories/${currentUser.id}`);const {error}=await supabaseClient.from('community_stories').insert({user_id:currentUser.id,image_url:url,caption:q('v9StoryCaption')?.value.trim()||null});if(error)throw error;hideModal();await load();toastV('Priča je objavljena.')}catch(err){toastV(err.message||'Greška pri objavi.','error')}};
  window.openV9Story=function(id){const s=V.stories.find(x=>String(x.id)===String(id));if(!s)return;const p=V.profiles[String(s.user_id)]||{};showModal(`<div class="v9-story-view"><div class="v9-post-head"><img class="v9-avatar" src="${avatar(p)}"><div><b>${escV(p.username||'Korisnik')}</b>${p.role==='admin'?'<span class="v9-admin-badge">Admin</span>':''}<div class="v9-post-meta">${fmt(s.created_at)}</div></div></div><img src="${escV(s.image_url)}" alt=""><div class="v9-story-caption">${escV(s.caption||'')}</div>${logged()&&(String(s.user_id)===String(currentUser.id)||typeof isAdmin==='function'&&isAdmin())?`<button class="btn btn-small" onclick="deleteV9Story('${escV(s.id)}')">Obriši priču</button>`:''}</div>`) };
  window.deleteV9Story=async function(id){if(!guard())return;const s=V.stories.find(x=>String(x.id)===String(id));if(!s)return;if(String(s.user_id)!==String(currentUser.id)&&!(typeof isAdmin==='function'&&isAdmin()))return toastV('Nemaš dozvolu.','error');if(!confirm('Obrisati ovu priču?'))return;const {error}=await supabaseClient.from('community_stories').delete().eq('id',id);if(error)return toastV(error.message,'error');hideModal();await load();toastV('Priča je obrisana.')};
  window.openV9Profile=async function(id){
    const {data:p,error}=await supabaseClient.from('profiles').select('id,username,avatar_url,bio,role').eq('id',id).maybeSingle();if(error||!p)return toastV('Profil nije pronađen.','error');
    const [{data:posts},{data:stories}]=await Promise.all([supabaseClient.from('community_posts').select('id,user_id,image_url,caption,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(30),supabaseClient.from('community_stories').select('id,user_id,image_url,caption,created_at,expires_at').eq('user_id',id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false})]);
    showModal(`<div class="v9-profile-full"><div class="v9-profile-cover"></div><div class="v9-profile-full-inner"><img class="v9-avatar-big" src="${avatar(p)}" alt=""><h2>${escV(p.username||'Korisnik')}${p.role==='admin'?'<span class="v9-admin-badge">Admin</span>':''}</h2><div class="muted">${escV(p.bio||'')}</div><div class="v9-profile-actions">${logged()&&String(id)===String(currentUser.id)?'<button class="btn btn-blue" onclick="openV9EditProfile()">Uredi profil</button>':''}</div><div class="v9-profile-stats"><div class="v9-profile-stat"><b>${posts?.length||0}</b><span>Objave</span></div><div class="v9-profile-stat"><b>${stories?.length||0}</b><span>Aktivne priče</span></div></div><div class="v9-feed">${(posts||[]).map(x=>`<div><img class="v9-post-image" style="border-radius:16px" src="${escV(x.image_url)}" alt="${escV(x.caption||'')}" onclick="openV9Lightbox('${escV(x.image_url)}')">${x.caption?`<div class="v9-post-caption" style="margin:7px 0 14px">${escV(x.caption)}</div>`:''}</div>`).join('')||'<div class="v9-empty">Još nema objava.</div>'}</div></div></div>`)
  };
  window.openV9EditProfile=function(){if(!guard())return;const p=currentProfile||{};showModal(`<div class="v9-modal-card"><div class="modal-title"><h2>👤 Uredi profil</h2></div><div class="form"><div style="text-align:center"><img id="v9AvatarPreview" class="v9-profile-avatar" src="${avatar(p)}"></div><label class="v9-drop" for="v9AvatarFile">📷 Promijeni avatar<input id="v9AvatarFile" type="file" accept="image/*" hidden></label><div class="form-group"><label>Korisničko ime</label><input id="v9Username" maxlength="30" value="${escV(p.username||'')}"></div><div class="form-group"><label>Opis profila</label><textarea id="v9Bio" maxlength="300" placeholder="Napiši nešto o sebi...">${escV(p.bio||'')}</textarea></div><button class="btn btn-green" onclick="saveV9Profile()">Sačuvaj promjene</button></div></div>`);filePreview('v9AvatarFile','v9AvatarPreview')};
  window.saveV9Profile=async function(){if(!guard())return;const username=q('v9Username')?.value.trim().replace(/[^\p{L}\p{N}_\-.]/gu,'').slice(0,30);const bio=q('v9Bio')?.value.trim().slice(0,300)||null;const f=q('v9AvatarFile')?.files?.[0];if(!username)return toastV('Korisničko ime je obavezno.','error');try{let avatar_url=currentProfile?.avatar_url||null;if(f){if(!f.type.startsWith('image/'))throw new Error('Avatar mora biti slika.');if(f.size>5*1024*1024)throw new Error('Avatar može imati najviše 5 MB.');avatar_url=await uploadFile(f,`avatars/${currentUser.id}`)}const {data,error}=await supabaseClient.from('profiles').update({username,bio,avatar_url}).eq('id',currentUser.id).select('*').single();if(error)throw error;currentProfile=data;updateAuthUI();hideModal();await render();toastV('Profil je ažuriran.')}catch(err){toastV(err.message||'Greška pri čuvanju profila.','error')}};
  window.deleteV9Post=async function(id){if(!guard())return;const p=V.posts.find(x=>String(x.id)===String(id));if(!p||String(p.user_id)!==String(currentUser.id)&&!(typeof isAdmin==='function'&&isAdmin()))return toastV('Nemaš dozvolu.','error');if(!confirm('Obrisati ovu objavu?'))return;const {error}=await supabaseClient.from('community_posts').delete().eq('id',id);if(error)return toastV(error.message,'error');await load();toastV('Objava je obrisana.')};
  window.toggleV9Reaction=async function(postId,type){if(!guard())return;const {data:existing,error:ee}=await supabaseClient.from('community_reactions').select('id').eq('post_id',postId).eq('user_id',currentUser.id).eq('reaction',type).maybeSingle();if(ee)return toastV(ee.message,'error');let error;if(existing){({error}=await supabaseClient.from('community_reactions').delete().eq('id',existing.id))}else{({error}=await supabaseClient.from('community_reactions').insert({post_id:postId,user_id:currentUser.id,reaction:type}))}if(error)return toastV(error.message,'error');await refreshPostMeta(postId)};
  window.toggleV9Comments=async function(postId){const box=q('v9comments-'+postId);if(!box)return;if(!box.hidden){box.hidden=true;return}const {data,error}=await supabaseClient.from('community_comments').select('id,user_id,content,created_at').eq('post_id',postId).order('created_at',{ascending:true});if(error)return toastV(error.message,'error');await loadProfiles((data||[]).map(c=>c.user_id));box.innerHTML=(data||[]).map(c=>{const p=V.profiles[String(c.user_id)]||{};return `<div class="v9-comment"><b>${escV(p.username||'Korisnik')}</b>${p.role==='admin'?'<span class="v9-admin-badge">Admin</span>':''}: ${escV(c.content)}</div>`}).join('')+`<div class="v9-comment-form"><input id="v9ci-${escV(postId)}" maxlength="500" placeholder="Napiši komentar..." ${logged()?'':'disabled'}><button class="btn btn-small btn-green" onclick="addV9Comment('${escV(postId)}')">Pošalji</button></div>`;box.hidden=false};
  window.addV9Comment=async function(postId){if(!guard())return;const input=q('v9ci-'+postId);const content=input?.value.trim();if(!content)return;const {error}=await supabaseClient.from('community_comments').insert({post_id:postId,user_id:currentUser.id,content});if(error)return toastV(error.message,'error');input.value='';const box=q('v9comments-'+postId);if(box)box.hidden=true;await toggleV9Comments(postId);await refreshPostMeta(postId)};
  window.openV9Lightbox=function(url){showModal(`<div class="v9-lightbox" onclick="hideModal()"><img src="${escV(url)}" alt="" onclick="event.stopPropagation()"></div>`) };
  function patchAuth(){const old=window.updateAuthUI;if(window.__V10_AUTH_PATCH__)return;window.__V10_AUTH_PATCH__=true;window.updateAuthUI=function(){old?.();const account=q('headerAccount');if(account&&logged()){const name=escV(currentProfile?.username||currentUser.email?.split('@')[0]||'Korisnik');account.innerHTML=`<button class="account-btn" onclick="openV9Profile('${escV(currentUser.id)}')"><span class="account-name">👤 ${name}${currentProfile?.role==='admin'?'<span class="account-admin">Admin</span>':''}</span></button><button class="account-btn" onclick="logout()">↪</button>`}if(q('community'))renderMyProfile()}}
  window.loadV9Community=load;
  const originalShowSection=window.showSection;window.showSection=function(id){originalShowSection?.(id);if(id==='community')setTimeout(load,30)};
  window.addEventListener('load',()=>setTimeout(()=>{patchAuth();load()},450));
  setTimeout(()=>{patchAuth()},900);
})();



(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const esc11=v=>typeof esc==='function'?esc(v??''):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fallback='https://via.placeholder.com/160?text=%F0%9F%91%A4';
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
        b.innerHTML=b.closest('#mainNav')?'<span>📰</span><span>Vijesti</span>':'<span>📰</span><b>Vijesti</b><small>Novosti lige</small>';
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
        b.innerHTML=b.closest('#mainNav')?'<span>📰</span><span>Vijesti</span>':'<span>📰</span><b>Vijesti</b><small>Novosti lige</small>';
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
      host.innerHTML=`<button type="button" class="account-btn v13-login" onclick="showSection('login')">🔐 Prijava</button><button type="button" class="account-btn v13-register" onclick="showSection('login');setTimeout(()=>document.getElementById('registerUsername')?.focus(),80)">Registracija</button>`;
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
  const observer=new MutationObserver(()=>{
    const host=q('headerAccount');
    if(host && !host.dataset.v13Ready) { host.dataset.v13Ready='1'; }
  });
  observer.observe(document.body,{childList:true,subtree:true});

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
