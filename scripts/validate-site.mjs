import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const failures = [];
const pass = (message) => console.log(`PASS  ${message}`);
const fail = (message) => failures.push(message);
const read = (path) => readFileSync(path, "utf8");
const pathFromRef = (ref) => {
  const clean = ref.replace(/^\.\//, "").split(/[?#]/, 1)[0];
  return clean || "index.html";
};

const html = read("index.html");
const sw = read("service-worker.js");
const app = read("js/app.js");
const game = read("js/game.js");
const dashboard = read("js/dashboard-layout-v1.js");
const growth = read("js/growth.js");

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((m) => m[1]);
const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (duplicates.length) fail(`Duplicate HTML IDs: ${duplicates.join(", ")}`);
else pass(`No duplicate IDs across ${ids.length} HTML IDs`);

const authStart = html.indexOf('<section class="section auth-section" id="login">');
const authEnd = html.indexOf("<!-- ================= LEAGUE INFO ================= -->", authStart);
const authMarkup = authStart >= 0 && authEnd > authStart ? html.slice(authStart, authEnd) : "";
const loginFunctionStart = app.indexOf("async function login()");
const loginFunctionEnd = app.indexOf("/* =========================================================\n   RESET PASSWORD", loginFunctionStart);
const loginFunction = loginFunctionStart >= 0 && loginFunctionEnd > loginFunctionStart ? app.slice(loginFunctionStart, loginFunctionEnd) : "";
const checkAuthStart = app.indexOf("async function checkAuth()");
const checkAuthEnd = app.indexOf("/* =========================================================\n   LOGIN", checkAuthStart);
const checkAuthFunction = checkAuthStart >= 0 && checkAuthEnd > checkAuthStart ? app.slice(checkAuthStart, checkAuthEnd) : "";
const logoutStart = app.indexOf("async function logout()");
const logoutEnd = app.indexOf("/* =========================================================\n   AUTH UI", logoutStart);
const logoutFunction = logoutStart >= 0 && logoutEnd > logoutStart ? app.slice(logoutStart, logoutEnd) : "";

if (
  !checkAuthFunction.includes("if(!supabaseClient?.auth?.getSession)") ||
  !checkAuthFunction.includes("currentProfile=null") ||
  !checkAuthFunction.includes("updateAuthUI()")
) {
  fail("Auth initialization must handle a missing Supabase SDK without leaving stale user state");
} else pass("Auth initialization safely handles an unavailable Supabase SDK");

if (
  !logoutFunction.includes("medjasiAuthInteraction=false") ||
  !logoutFunction.includes("catch(error)") ||
  !logoutFunction.includes("finally")
) {
  fail("Logout failures must reset the auth interaction flag and report network errors");
} else pass("Logout resets auth interaction state on success and failure");

const resetStart = app.indexOf("async function resetPassword()");
const resetEnd = app.indexOf("/* =========================================================\n   REGISTER", resetStart);
const resetFunction = resetStart >= 0 && resetEnd > resetStart ? app.slice(resetStart, resetEnd) : "";
const resendStart = app.indexOf("async function resendConfirmation()");
const resendEnd = app.indexOf("window.resendConfirmation=resendConfirmation;", resendStart);
const resendFunction = resendStart >= 0 && resendEnd > resendStart ? app.slice(resendStart, resendEnd) : "";
if (
  !resetFunction.includes("resetPasswordForEmail") ||
  !resetFunction.includes("catch(error)") ||
  !resetFunction.includes("if(!supabaseClient?.auth?.resetPasswordForEmail)")
) {
  fail("Password reset must handle a missing Auth SDK and rejected network requests");
} else pass("Password reset handles unavailable services and network failures");

if (
  !resendFunction.includes("supabaseClient?.auth?.resend") ||
  !resendFunction.includes("catch(error)") ||
  !resendFunction.includes("if(!supabaseClient?.auth?.resend)")
) {
  fail("Confirmation resend must handle an unavailable Auth SDK and request failures");
} else pass("Confirmation resend handles unavailable services and network failures");

const finishStart = app.indexOf("async function finishAndSave(matchId)");
const saveStart = app.indexOf("async function saveRatings(matchId)", finishStart);
const goalStart = app.indexOf("function openGoal(matchId)", saveStart);
const finishFunction = finishStart >= 0 && saveStart > finishStart ? app.slice(finishStart, saveStart) : "";
const saveFunction = saveStart >= 0 && goalStart > saveStart ? app.slice(saveStart, goalStart) : "";
if (
  !finishFunction.includes("await saveRatings(matchId)") ||
  !finishFunction.includes("if(error)throw error") ||
  !finishFunction.includes("catch(error)") ||
  !saveFunction.includes("if(error)throw error") ||
  !saveFunction.includes("clearMvp.error")
) {
  fail("Match finalization must stop on player-stat/MVP write errors");
} else pass("Match finalization checks player-stat and MVP writes before completing");

if (
  !app.includes("function supportedLeagueMedia(file)") ||
  !app.includes("const media=supportedLeagueMedia(file)") ||
  !app.includes("file.size>media.maxBytes") ||
  !app.includes("async function publishNews()") ||
  !app.includes("async function adminAddMedia()")
) {
  fail("News and gallery uploads must validate media types and sizes before storage");
} else pass("News and gallery uploads validate allowed media formats and sizes");

const seasonFunctionStart = app.indexOf("async function activateSeason(id)");
const seasonFunctionEnd = app.indexOf("function ensurePushUI()", seasonFunctionStart);
const seasonFunction = seasonFunctionStart >= 0 && seasonFunctionEnd > seasonFunctionStart ? app.slice(seasonFunctionStart, seasonFunctionEnd) : "";
if (
  !seasonFunction.includes("deactivateError") ||
  !seasonFunction.includes("activateError") ||
  !seasonFunction.includes("previousActiveIds") ||
  !seasonFunction.includes("rollbackError")
) {
  fail("Changing the active season must handle both update failures and attempt to restore prior state");
} else pass("Active-season updates check failures and attempt recovery");

const uploadStart = app.indexOf("async function uploadFile(file,folder)");
const uploadEnd = app.indexOf("/* =========================================================\n   ADMIN - TEAM", uploadStart);
const uploadFunction = uploadStart >= 0 && uploadEnd > uploadStart ? app.slice(uploadStart, uploadEnd) : "";
if (
  !app.includes("function isAllowedRasterImage(file)") ||
  !app.includes("async function hasExpectedMediaSignature(file,mime)") ||
  !uploadFunction.includes("extensions[mime]") ||
  !uploadFunction.includes("contentType:mime") ||
  !uploadFunction.includes("await hasExpectedMediaSignature(file,mime)") ||
  !uploadFunction.includes("parts.some(part=>!part||!/^[a-z0-9_-]+$/i.test(part))") ||
  !uploadFunction.includes("file.size>maxBytes")
) {
  fail("Storage uploads must validate allowlisted MIME types, file signatures, paths, and size limits");
} else pass("Storage uploads validate MIME, file signatures, safe paths, and size limits");

if (
  app.includes("file.type.startsWith('image/')") ||
  app.includes('file.type.startsWith("image/")') ||
  app.includes("f.type.startsWith('image/')") ||
  app.includes('f.type.startsWith("image/")')
) {
  fail("Image-upload forms must not accept unrestricted image/* MIME types");
} else pass("Image-upload forms use the explicit raster-image allowlist");

const pushStart = app.indexOf("async function notifyPush(");
const pushEnd = app.indexOf("function b64ToBytes", pushStart);
const pushFunction = pushStart >= 0 && pushEnd > pushStart ? app.slice(pushStart, pushEnd) : "";
const publishStart = app.indexOf("async function publishNews()");
const publishEnd = app.indexOf("async function deleteNews(id)", publishStart);
const publishFunction = publishStart >= 0 && publishEnd > publishStart ? app.slice(publishStart, publishEnd) : "";
if (
  !pushFunction.includes("if(!response.ok)") ||
  !pushFunction.includes("return false") ||
  !pushFunction.includes("return true")
) {
  fail("Push helper must surface HTTP delivery failure to callers");
} else pass("Push helper returns explicit delivery success/failure");

if (
  !publishFunction.includes("let pushSent=true") ||
  !publishFunction.includes("Vijest je objavljena, ali push obavještenje nije poslano")
) {
  fail("News publishing must not be reported as failed solely because push delivery failed");
} else pass("News publishing reports storage and push outcomes separately");

const matchStatusStart = app.indexOf("async function changeMatchStatus(");
const matchStatusEnd = app.indexOf("/* =========================================================\n   MATCH MINUTE", matchStatusStart);
const matchStatusFunction = matchStatusStart >= 0 && matchStatusEnd > matchStatusStart ? app.slice(matchStatusStart, matchStatusEnd) : "";
const addCardStart = app.indexOf("async function addCard(matchId)");
const addCardEnd = app.indexOf("/* =========================================================\n   TEAM MODAL", addCardStart);
const addCardFunction = addCardStart >= 0 && addCardEnd > addCardStart ? app.slice(addCardStart, addCardEnd) : "";
if (
  !app.includes("async function notifyLeaguePush(type,title,body,matchId)") ||
  !matchStatusFunction.includes('void notifyLeaguePush("live",title,body,id)') ||
  !matchStatusFunction.includes("changed&&status===\"live\"") ||
  !addCardFunction.includes('    "card",') ||
  !addCardFunction.includes("const {error}=await supabaseClient.from(\"cards\").insert") ||
  !addCardFunction.includes("void notifyLeaguePush(")
) {
  fail("Push events for LIVE kickoff and saved cards must send only after a successful database write");
} else pass("LIVE kickoff and saved-card push notifications are wired after database success");

const v7AssistGoalStart = app.indexOf("async function addGoalWithAssist(matchId)");
const v7AssistGoalEnd = app.indexOf("function decorateCourtRatings(matchId)", v7AssistGoalStart);
const v7AssistGoalFunction = v7AssistGoalStart >= 0 && v7AssistGoalEnd > v7AssistGoalStart ? app.slice(v7AssistGoalStart, v7AssistGoalEnd) : "";
const galleryVideoTestStart = app.indexOf("async function adminAddMedia()");
const galleryVideoTestEnd = app.indexOf("function ensureGalleryVideoUI()", galleryVideoTestStart);
const galleryVideoTestFunction = galleryVideoTestStart >= 0 && galleryVideoTestEnd > galleryVideoTestStart ? app.slice(galleryVideoTestStart, galleryVideoTestEnd) : "";
if (
  !v7AssistGoalFunction.includes('$("v7GoalPlayer")') ||
  !v7AssistGoalFunction.includes('$("v7GoalMinute")') ||
  !v7AssistGoalFunction.includes('assist_player_id:assistId') ||
  !v7AssistGoalFunction.includes("Strijelac mora biti u postavi utakmice") ||
  !app.includes("V7.addGoal=addGoalWithAssist")
) {
  fail("Live goal+assist modal must use its own fields and save the validated scorer/assist");
} else pass("Live goal+assist modal uses matching fields and stores a validated assist");

const loadStatsStart = app.indexOf("async function loadStats()");
const loadStatsEnd = app.indexOf("async function addSave(", loadStatsStart);
const loadStatsFunction = loadStatsStart >= 0 && loadStatsEnd > loadStatsStart ? app.slice(loadStatsStart, loadStatsEnd) : "";
const finishSaveStart = app.indexOf("async function finishAndSave(matchId)");
const finishSaveEnd = app.indexOf("async function saveRatings(matchId)", finishSaveStart);
const finishSaveFunction = finishSaveStart >= 0 && finishSaveEnd > finishSaveStart ? app.slice(finishSaveStart, finishSaveEnd) : "";
if (
  !loadStatsFunction.includes("if(error)throw error") ||
  !loadStatsFunction.includes("return V7.stats") ||
  !finishSaveFunction.includes("await loadStats()") ||
  !finishSaveFunction.includes("await saveRatings(matchId)")
) {
  fail("Match finalization must not overwrite existing player stats when the current stats read fails");
} else pass("Match finalization confirms the existing stats read before writing ratings");


if (
  !galleryVideoTestFunction.includes("image_url:media_url") ||
  !galleryVideoTestFunction.includes("media_url,") ||
  !galleryVideoTestFunction.includes("media_type:media.kind")
) {
  fail("Video gallery upload must preserve required legacy image_url while storing media metadata");
} else pass("Gallery video uploads keep legacy required image_url and media metadata");

const galleryRenderStart = app.indexOf("function renderGalleryV7()");
const galleryRenderEnd = app.indexOf("function openMedia(", galleryRenderStart);
const galleryRenderFunction = galleryRenderStart >= 0 && galleryRenderEnd > galleryRenderStart ? app.slice(galleryRenderStart, galleryRenderEnd) : "";
if (
  !galleryRenderFunction.includes("escJs(url)") ||
  !galleryRenderFunction.includes("escJs(x.title||'Video')") ||
  !galleryRenderFunction.includes("escJs(x.title||'Galerija')") ||
  galleryRenderFunction.includes("openImagePreview('${escV(url)}'")
) {
  fail("Gallery inline event handlers must JavaScript-escape dynamic URLs and titles");
} else pass("Gallery inline event handlers safely escape dynamic URLs and titles");








if (
  !authMarkup.includes('onclick="exitAuthScreen()"') ||
  !authMarkup.includes('class="auth-return-btn"') ||
  !app.includes("window.exitAuthScreen=exitAuthScreen")
) {
  fail("Login/register screen must provide a working return-to-home action");
} else pass("Login/register screen includes a wired return-to-home action");

if (
  !loginFunction.includes("signInWithPassword") ||
  !loginFunction.includes("showSection(\"home\")") ||
  !loginFunction.includes("currentUser=data.user") ||
  !loginFunction.includes("medjasiAuthInteraction=false")
) {
  fail("Successful login must end on the signed-in home screen and clear failed auth intent");
} else pass("Login flow has deterministic signed-in destination and error recovery");

const layoutCss = read("css/medjasi-dashboard-refinements-v2.css");
if (
  !layoutCss.includes("#login.active") ||
  !layoutCss.includes("@media(min-width:1181px)") ||
  !layoutCss.includes("@media(min-width:1025px) and (max-width:1380px)") ||
  !layoutCss.includes(".auth-return-btn")
) {
  fail("Desktop workspace and auth form responsive overrides must remain in the final stylesheet");
} else pass("Desktop workspace and auth screen have explicit responsive layout rules");


// Guard important runtime logic that syntax-only checks cannot detect.
if (
  !app.includes("function updateAuthUI(renderContent=true)") ||
  !app.includes("updateAuthUI(false);") ||
  !app.includes("_baseUpdateAuthUI(...args)")
) {
  fail("Auth-only refresh must pass the renderContent flag through the final compatibility wrapper");
} else pass("Auth-only updates avoid an unnecessary second render pass");

if (game.includes("__MEDJASI_GAME_SECTION_PATCH__")) {
  fail("Fan Game must not wrap showSection a second time and duplicate section refreshes");
} else pass("Fan Game section refresh is not double-bound");

if (app.includes("if(after==='community'&&typeof window.loadV9Community==='function')setTimeout")) {
  fail("Community feed load is duplicated in the history wrapper");
} else pass("Community feed loading has a single navigation trigger");

if (
  !app.includes('if(table==="match_players")') ||
  !app.includes('.order("match_id",{ascending:true}).order("player_id",{ascending:true})')
) {
  fail("Optional match_players pagination must use its natural composite key");
} else pass("Join-table pagination does not assume a synthetic id column");

if (
  !app.includes('minute>60') ||
  !app.includes('if(!["yellow","red"].includes(card_type))') ||
  !app.includes('const isRegistered=matchPlayers.some')
) {
  fail("Goal/card entry must validate event time, card type, and match roster");
} else pass("Goal and card entry validates times and selected match participants");

if (!growth.includes("if(sponsorResult.error)") || !growth.includes("if(seasonResult.error)")) {
  fail("Liga info must preserve the last valid sponsor/season data when a refresh query fails");
} else pass("Liga info keeps the last valid state during partial service failures");

const hasDirectTabRouter =
  dashboard.includes("window.medjasiGame?.openTab?.(key)===true") &&
  dashboard.includes("const retry=()=>{") &&
  dashboard.includes("++attempts>=12") &&
  dashboard.includes("window.setTimeout(retry,100)");
const hasLegacyBoundedTabRouter = dashboard.includes("if(attempts++<25)window.setTimeout(selectTab,100)");
if (!hasDirectTabRouter && !hasLegacyBoundedTabRouter) {
  fail("Fan Game quick links must wait for asynchronously rendered tabs with a bounded retry");
} else pass("Fan Game quick links use validated direct routing or a bounded render retry");

const fixtureStart = dashboard.indexOf("function fixtureMarkup(m,phone=false){");
const fixtureEnd = dashboard.indexOf("function renderNext(){", fixtureStart);
const fixtureSource = fixtureStart >= 0 && fixtureEnd > fixtureStart ? dashboard.slice(fixtureStart, fixtureEnd) : "";
if (
  !fixtureSource.includes("dashboard-upcoming-item") ||
  !fixtureSource.includes('onclick="openMatch') ||
  /\(phone\s*\?\s*['"]['"]\s*:\s*['"]\s*onclick=/.test(fixtureSource)
) {
  fail("Upcoming match cards must open match details on both desktop and phone layouts");
} else pass("Upcoming match cards open the selected match on desktop and phone");

if (
  !dashboard.includes("bindUpcomingCardKeyboard") ||
  !dashboard.includes("dashboard-upcoming-item[role='button']") ||
  !dashboard.includes("card.click()")
) {
  fail("Phone upcoming match cards must support keyboard activation as well as touch");
} else pass("Phone upcoming match cards support keyboard and touch activation");

if (
  !dashboard.includes("window.dashboardOpenGameTab=function(tab)") ||
  !app.includes("function openMatch(id)") ||
  !app.includes("function showSection(id)")
) {
  fail("Dashboard quick links must resolve to globally callable section and match handlers");
} else pass("Dashboard quick links resolve to global navigation and match handlers");

const inlineHandlerSources = [app, dashboard, growth, read("js/community-features.js"), read("js/ui-compat.js"), read("js/extras.js")].join("\n");
const knownInlineHandlers = new Set([
  ...[...app.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]),
  ...[...inlineHandlerSources.matchAll(/(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1])
]);
const inlineCallNames = new Set();
for (const match of html.matchAll(/\bonclick\s*=\s*["']([^"']*)["']/gi)) {
  for (const call of match[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!["if", "for", "while", "switch", "function"].includes(call[1])) inlineCallNames.add(call[1]);
  }
}
const unboundInlineCalls = [...inlineCallNames].filter((name) => !knownInlineHandlers.has(name));
if (unboundInlineCalls.length) fail("HTML inline click handlers have no global target: " + unboundInlineCalls.join(", "));
else pass("All HTML inline click handlers resolve to a global function");

const clickMarkupSources = [
  app, game, dashboard, growth,
  read("js/community-features.js"),
  read("js/ui-compat.js"),
  read("js/admin-organizer.js"),
  read("js/extras.js"),
  read("js/graphic-engine.js"),
  read("js/effects.js"),
  read("js/medjasi-v13-ui.js"),
  read("js/production.js")
];
const clickMarkupSource = clickMarkupSources.join("\n");
const declaredClickTargets = new Set([
  ...[...clickMarkupSource.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]),
  ...[...clickMarkupSource.matchAll(/(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1])
]);
if (app.includes("const $=")) declaredClickTargets.add("$");
const unboundGeneratedCalls = new Set();
let generatedOnclickCount = 0;
for (const source of clickMarkupSources) {
  for (const handler of source.matchAll(/\bonclick\s*=\s*(?:\\?["'])([\s\S]*?)(?:\\?["'])/gi)) {
    generatedOnclickCount++;
    for (const call of handler[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = call[1];
      if (!["if", "for", "while", "switch", "function", "return"].includes(name) && !declaredClickTargets.has(name)) {
        unboundGeneratedCalls.add(name);
      }
    }
  }
}
if (unboundGeneratedCalls.size) {
  fail("Generated inline click handlers have no callable target: " + [...unboundGeneratedCalls].sort().join(", "));
} else {
  pass("Generated inline click targets resolve across application modules (" + generatedOnclickCount + " handlers scanned)");
}

const gameActionValues = [...new Set([...game.matchAll(/data-act\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]))];
const gameClickStart = game.indexOf("async function onClick");
const gameClickSource = gameClickStart >= 0 ? game.slice(gameClickStart) : "";
const gameHandledActions = new Set([...gameClickSource.matchAll(/\ba\s*===\s*["']([^"']+)["']/g)].map((m) => m[1]));
const unhandledGameActions = gameActionValues.filter((action) => !gameHandledActions.has(action));
if (unhandledGameActions.length) fail("Fan Game buttons have no click action: " + unhandledGameActions.join(", "));
else pass("All Fan Game data-act buttons map to click-handler branches");

const growthActionValues = [...new Set([...growth.matchAll(/data-gx\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]))];
const growthHandledActions = new Set([...growth.matchAll(/\ba\s*===\s*["']([^"']+)["']/g)].map((m) => m[1]));
const unhandledGrowthActions = growthActionValues.filter((action) => !growthHandledActions.has(action));
if (unhandledGrowthActions.length) fail("Liga Info buttons have no click action: " + unhandledGrowthActions.join(", "));
else pass("All Liga Info data-gx buttons map to click-handler branches");

const dashboardTabValues = [...new Set([...dashboard.matchAll(/data-dashboard-tab\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]))];
const gameTabValues = new Set([...game.matchAll(/\["([a-z][a-z0-9_-]*)","[^"]+"\]/g)].map((m) => m[1]));
const missingDashboardTabs = dashboardTabValues.filter((tab) => !gameTabValues.has(tab));
if (
  !dashboard.includes("window.dashboardOpenGameTab=function(tab)") ||
  !(
    dashboard.includes("window.medjasiGame?.openTab?.(key)===true") ||
    dashboard.includes('#game [data-act=\'tab\'][data-id]')
  ) ||
  missingDashboardTabs.length
) {
  fail("Dashboard Fan Game shortcuts must select a tab that exists in the Fan Game panel" + (missingDashboardTabs.length ? ": " + missingDashboardTabs.join(", ") : ""));
} else pass("All dashboard Fan Game shortcuts resolve to existing Fan Game tabs");

const communityClickAuditSource = read("js/community-features.js");
if (
  !communityClickAuditSource.includes('data-community-action="block"') ||
  !communityClickAuditSource.includes('addEventListener("click",()=>blockUser(id))') ||
  !communityClickAuditSource.includes('data-community-action="report"') ||
  !communityClickAuditSource.includes('addEventListener("click",()=>reportTarget("post"')
) {
  fail("Community block/report buttons must be bound to the correct post actions");
} else pass("Community block/report buttons are bound to their matching actions");

if (
  !communityClickAuditSource.includes('querySelectorAll("button").forEach(b=>b.addEventListener("click",async()=>') ||
  !communityClickAuditSource.includes('option_id:b.dataset.option')
) {
  fail("Community poll option buttons must submit the selected option");
} else pass("Community poll option buttons submit the selected option");

if (
  !communityClickAuditSource.includes('querySelectorAll("[data-report-review]")') ||
  !communityClickAuditSource.includes('b.onclick=async()=>') ||
  !communityClickAuditSource.includes('eq("id",b.dataset.reportReview)')
) {
  fail("Community moderation review buttons must update the selected report");
} else pass("Community report review buttons update the matching report");

const extrasClickAuditSource = read("js/extras.js");
const extrasActionValues = [...new Set([...extrasClickAuditSource.matchAll(/data-xt\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]))];
if (
  !extrasClickAuditSource.includes('e.target.closest("[data-xt]")') ||
  !extrasClickAuditSource.includes('b.dataset.xt==="ics"') ||
  !extrasClickAuditSource.includes("shareResult(id)") ||
  extrasActionValues.some((action) => !["ics", "share"].includes(action))
) {
  fail("Match extras buttons must resolve to calendar export or result sharing");
} else pass("Match extras buttons resolve to calendar export or result sharing");

if (
  !extrasClickAuditSource.includes('e.target.closest("[data-xt-tab]")') ||
  !extrasClickAuditSource.includes("st.tab=b.dataset.xtTab") ||
  !extrasClickAuditSource.includes("renderStatsPlus()")
) {
  fail("Advanced statistics tabs must update their selection and rerender the displayed panel");
} else pass("Advanced statistics tabs switch their visible content");

const interactionCss = read("css/medjasi-dashboard-refinements-v2.css");
if (
  !interactionCss.includes("#modal.modal") ||
  !interactionCss.includes("z-index:3000!important") ||
  !interactionCss.includes("rgba(0,0,0,.87)") ||
  !interactionCss.includes("#modal .modal-box") ||
  !interactionCss.includes("rgba(0,0,0,.84)") ||
  !interactionCss.includes(".mobile-more-drawer .mobile-more-panel")
) {
  fail("Modal, mobile drawer, and install dialog backgrounds must stay opaque above the home screen");
} else pass("Modal and drawer overlays sufficiently obscure the underlying home screen");

if (
  !html.includes('id="mobileMenuBtn" onclick="toggleMobileMenu()"') ||
  !app.includes('nav?.classList.toggle("mobile-open",mobileMenuOpen)') ||
  !app.includes('btn.setAttribute("aria-expanded",String(mobileMenuOpen))') ||
  !app.includes('document.getElementById("mainNav")?.classList.remove("mobile-open","open")')
) {
  fail("Mobile header menu must open, close, and keep its expanded state synchronized");
} else pass("Mobile header menu opens and closes with synchronized accessibility state");

if (
  !app.includes("function openMobileMore()") ||
  !app.includes("function closeMobileMore()") ||
  !app.includes('drawer.classList.add("open")') ||
  !app.includes('drawer.classList.remove("open")') ||
  !app.includes("function mobileMoreGo(id)") ||
  !app.includes("setTimeout(()=>showSection(id),40")
) {
  fail("Mobile More drawer must open, close, and route a selected item to its requested section");
} else pass("Mobile More drawer items open the selected section and close the drawer");

if (
  !html.includes('id="modal" onclick="closeModal(event)"') ||
  !html.includes('class="modal-box" onclick="event.stopPropagation()"') ||
  !app.includes('function closeModal(event)') ||
  !app.includes('if(event.target.id === "modal")') ||
  !app.includes('function hideModal()') ||
  !app.includes('classList.remove("active")')
) {
  fail("Modal backdrop must close only on outside click and explicit close buttons must dismiss it");
} else pass("Modal backdrop and close buttons dismiss the panel without closing on inner clicks");

if (
  !game.includes("const currentUserKey=()=>user()?.id==null?null:String(user().id)") ||
  !game.includes("resetUserSnapshot(requestedUserKey)") ||
  !game.includes("if(currentUserKey()!==requestedUserKey)") ||
  !app.includes("window.medjasiGame?.refresh?.();")
) {
  fail("Fan Game must clear account-scoped state and reject stale refreshes across auth changes");
} else pass("Fan Game private state is isolated across account changes");



const htmlRefs = [...html.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/gi)]
  .map((m) => m[1])
  .filter((ref) => /\.(?:css|js|html|json|png|svg|webp|jpe?g|woff2?)(?:[?#]|$)/i.test(ref));

const stylesheetTags = [...html.matchAll(/<link\b[^>]+href=["'][^"']+\.css(?:\?[^"']*)?["'][^>]*>/gi)];
const finalLayoutIndex = stylesheetTags.findIndex((m) => m[0].includes("medjasi-dashboard-refinements-v2.css"));
const finalHeaderIndex = stylesheetTags.findIndex((m) => m[0].includes("medjasi-header-fix-v1.css"));
const lastStylesheetIndex = stylesheetTags.length - 1;
if (finalLayoutIndex < 0) {
  fail("The dashboard/sidebar layout stylesheet must be present");
} else if (finalHeaderIndex >= 0) {
  if (finalHeaderIndex !== lastStylesheetIndex || finalLayoutIndex >= finalHeaderIndex) {
    fail("The header fix must load last, after dashboard/sidebar layout refinements");
  } else {
    pass("Header fix and dashboard/sidebar refinements load in the correct order");
  }
} else if (finalLayoutIndex !== lastStylesheetIndex) {
  fail("medjasi-dashboard-refinements-v2.css must remain the last stylesheet when no header fix layer is present");
} else {
  pass("Final dashboard/sidebar layout stylesheet is loaded last");
}

for (const ref of [...new Set(htmlRefs)]) {
  const path = pathFromRef(ref);
  if (!existsSync(path)) fail(`Missing local HTML asset: ${ref}`);
}
if (!failures.some((x) => x.startsWith("Missing local HTML asset:"))) pass("All local HTML assets exist");

const shellMatch = sw.match(/const APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
if (!shellMatch) {
  fail("Could not find APP_SHELL in service-worker.js");
} else {
  const shellRefs = [...shellMatch[1].matchAll(/["'](\.\/[^"']+)["']/g)].map((m) => m[1]);
  for (const ref of shellRefs) {
    const path = pathFromRef(ref);
    if (!existsSync(path)) fail(`Missing service-worker asset: ${ref}`);
  }
  if (!failures.some((x) => x.startsWith("Missing service-worker asset:"))) pass(`All ${shellRefs.length} service-worker shell assets exist`);

  const shellExactRefs = new Set(shellRefs);
  for (const ref of htmlRefs.filter((x) => /\.(?:css|js|html|json)(?:[?#]|$)/i.test(x))) {
    if (!shellExactRefs.has(ref)) fail(`HTML asset URL/version is not in APP_SHELL: ${ref}`);
  }
  if (!failures.some((x) => x.startsWith("HTML asset URL/version is not in APP_SHELL:"))) pass("All local HTML asset URLs and cache versions match APP_SHELL exactly");
}

const htmlAppVersion = html.match(/src=["']\.\/js\/app\.js\?v=([^"']+)/)?.[1];
const swAppVersion = sw.match(/\.\/js\/app\.js\?v=([^"']+)/)?.[1];
if (!htmlAppVersion || htmlAppVersion !== swAppVersion) {
  fail(`app.js cache version mismatch (index=${htmlAppVersion ?? "missing"}, service-worker=${swAppVersion ?? "missing"})`);
} else pass(`app.js cache version synchronized: ${htmlAppVersion}`);

const cacheName = sw.match(/const CACHE_NAME\s*=\s*["']([^"']+)["']/)?.[1];
if (!cacheName || !/\bv\d+$/.test(cacheName)) fail("CACHE_NAME is missing or not versioned");
else pass(`Service-worker cache is versioned: ${cacheName}`);

const navTargets = [...html.matchAll(/showSection\(["']([^"']+)["']\)/g)].map((m) => m[1]);
const staticIds = new Set(ids);
const dynamicSections = new Set();
if (app.includes("sec.id='news'") || app.includes('sec.id="news"')) dynamicSections.add("news");
if (game.includes('sec.id="game"') || game.includes("sec.id='game'")) dynamicSections.add("game");
const missingTargets = [...new Set(navTargets)].filter((id) => !staticIds.has(id) && !dynamicSections.has(id));
if (missingTargets.length) fail(`Navigation targets have no static/dynamic section: ${missingTargets.join(", ")}`);
else pass("All literal HTML showSection targets resolve to static or dynamically mounted sections");

const jsRefs = [...new Set(htmlRefs.filter((ref) => /\.js(?:[?#]|$)/i.test(ref)).map(pathFromRef))];
for (const path of [...jsRefs, "service-worker.js"]) {
  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  if (result.status !== 0) fail(`JavaScript syntax error in ${path}: ${(result.stderr || result.stdout).trim()}`);
}
if (!failures.some((x) => x.startsWith("JavaScript syntax error"))) pass(`JavaScript syntax checks passed for ${jsRefs.length + 1} files`);

const cssPaths = [...new Set(htmlRefs.filter((ref) => /\.css(?:[?#]|$)/i.test(ref)).map(pathFromRef))];
for (const path of cssPaths) {
  const css = read(path);
  const braces = (css.match(/{/g) || []).length - (css.match(/}/g) || []).length;
  const comments = (css.match(/\/\*/g) || []).length - (css.match(/\*\//g) || []).length;
  if (braces !== 0 || comments !== 0) fail(`Unbalanced CSS structure in ${path} (braces=${braces}, comments=${comments})`);
  const imports = [...css.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const ref of imports) {
    if (/^(?:https?:|data:)/i.test(ref)) continue;
    const imported = join(dirname(path), pathFromRef(ref));
    if (!existsSync(imported)) fail(`Missing CSS import in ${path}: ${ref}`);
  }
}
if (!failures.some((x) => x.startsWith("Unbalanced CSS") || x.startsWith("Missing CSS import"))) pass(`CSS structure/import checks passed for ${cssPaths.length} stylesheets`);

const frontendFiles = ["index.html", ...jsRefs];
for (const path of frontendFiles) {
  const source = read(path);
  if (/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(source)) fail(`Possible privileged Supabase key reference in frontend file: ${path}`);
}
if (!failures.some((x) => x.startsWith("Possible privileged Supabase key"))) pass("No service-role key references found in frontend entry files");

// Keep runtime-critical Edge Function RPC contracts aligned with SQL wrappers.
const fanAdminEdgeSource = read("supabase/functions/fan-admin-action/index.ts");
const fanGrantWrapperSource = read("sql/07_admin_rpc_wrapper.sql");
const repricingFixSource = read("sql/14_fix_fan_reprice_match_live_status_alias.sql");
const pushEdgeSource = read("supabase/functions/send-push/index.ts");

const grantRpcCall = fanAdminEdgeSource.split('actor.rpc("fan_admin_grant",')[1]?.split(");")[0] || "";
if (
  !grantRpcCall.includes("p_user:") ||
  !grantRpcCall.includes("p_amount:") ||
  !grantRpcCall.includes("p_reason:") ||
  grantRpcCall.includes("p_note:") ||
  !fanGrantWrapperSource.includes("create or replace function public.fan_admin_grant(p_user uuid, p_amount integer, p_reason text)")
) {
  fail("Fan admin grant Edge RPC arguments must match the SQL wrapper signature");
} else {
  pass("Fan admin grant Edge RPC arguments match the SQL wrapper");
}

if (
  !fanAdminEdgeSource.includes("global: { headers: { Authorization: auth } }") ||
  !fanAdminEdgeSource.includes("admin.auth.getUser(token)") ||
  !fanAdminEdgeSource.includes('if(p?.role!=="admin")')
) {
  fail("Fan admin Edge Function must validate admin role and forward the caller JWT to protected RPCs");
} else {
  pass("Fan admin Edge Function preserves the caller identity for database authorization");
}

if (
  !repricingFixSource.includes("when p.status = ''live'' then") ||
  !repricingFixSource.includes("when mt.status = ''live'' then") ||
  !repricingFixSource.includes("private.fan_reprice_match(text)")
) {
  fail("Live Fan Game repricing regression fix must remain in the numbered SQL migration");
} else {
  pass("Live Fan Game repricing regression fix is documented in SQL migration");
}

if (
  !app.includes("V7.notifyPush=notifyPush") ||
  !app.includes("window.medjasiV7?.notifyPush") ||
  !pushEdgeSource.includes("admin.auth.getUser(token)") ||
  !pushEdgeSource.includes('if (role !== "admin" && role !== "moderator")') ||
  !pushEdgeSource.includes('"Access-Control-Allow-Origin": "https://vojintesanovic0-dot.github.io"') ||
  pushEdgeSource.includes('"Access-Control-Allow-Origin": "*"')
) {
  fail("League event push notifications must use the exported notifier and enforce admin/moderator authorization");
} else {
  pass("League-event push wiring and server-side role gate are present");
}

const musicLoaderStart = app.indexOf("async function loadMusicSettings()");
const musicLoaderEnd = app.indexOf("function renderMusicAdmin()",musicLoaderStart);
const musicLoader = musicLoaderStart >= 0 && musicLoaderEnd > musicLoaderStart
  ? app.slice(musicLoaderStart,musicLoaderEnd) : "";
if (
  !musicLoader.includes('else{\n      musicSettings=settings||{youtube_music_enabled:false};') ||
  !musicLoader.includes('musicTracks=tracks||[];') ||
  !musicLoader.includes('Učitavanje playlist-e nije uspjelo:') ||
  !musicLoader.includes('Učitavanje postavki muzike nije uspjelo:') ||
  (musicLoader.match(/catch\(error\)/g)||[]).length<2 ||
  musicLoader.includes('musicTracks=[];')
) {
  fail("Music/settings refresh must preserve the last working playlist when either Supabase query fails");
} else {
  pass("Music and playlist refreshes retain last known-good data after transient failures");
}

const pushSubscribeStart = app.indexOf("async function subscribeRealPush()");
const pushSubscribeEnd = app.indexOf("async function disableRealPush()",pushSubscribeStart);
const pushSubscribeFunction = pushSubscribeStart >= 0 && pushSubscribeEnd > pushSubscribeStart
  ? app.slice(pushSubscribeStart,pushSubscribeEnd) : "";
const pushDisableStart = app.indexOf("async function disableRealPush()");
const pushDisableEnd = app.indexOf("function renderPushUI()",pushDisableStart);
const pushDisableFunction = pushDisableStart >= 0 && pushDisableEnd > pushDisableStart
  ? app.slice(pushDisableStart,pushDisableEnd) : "";
const pushDisableServerDelete = pushDisableFunction.indexOf(".delete().eq(\"endpoint\",sub.endpoint)");
const pushDisableUnsubscribe = pushDisableFunction.indexOf("await sub.unsubscribe()");
const pushDisableLocalClear = pushDisableFunction.indexOf('localStorage.removeItem("medjasi_push_enabled")');
const pushDisableCatch = pushDisableFunction.indexOf("catch(error)");
if (
  !pushSubscribeFunction.includes("Notification.requestPermission()") ||
  !pushSubscribeFunction.includes("await supabaseClient.from(\"push_subscriptions\").upsert") ||
  !pushSubscribeFunction.includes("if(error)throw error") ||
  !pushSubscribeFunction.includes("catch(error)") ||
  !pushSubscribeFunction.includes("renderPushUI();") ||
  !pushDisableFunction.includes("if(error)throw error") ||
  pushDisableServerDelete < 0 ||
  pushDisableUnsubscribe < pushDisableServerDelete ||
  pushDisableLocalClear < pushDisableUnsubscribe ||
  pushDisableCatch < pushDisableLocalClear ||
  !pushDisableFunction.includes("renderPushUI();") ||
  !pushDisableFunction.includes("return false")
) {
  fail("Push subscription actions must catch failures and only clear enabled state after successful server/browser cleanup");
} else {
  pass("Push subscription enable/disable flows preserve truthful state across failures");
}

const eventIntegritySource = read("sql/15_validate_match_event_integrity.sql");
if (
  !eventIntegritySource.includes("create trigger trg_medjasi_validate_goal_match_participants") ||
  !eventIntegritySource.includes("create trigger trg_medjasi_validate_card_match_participants") ||
  !eventIntegritySource.includes("v_player_team not in (v_home_team, v_away_team)") ||
  !eventIntegritySource.includes("if tg_table_name <> 'goals' then") ||
  !eventIntegritySource.includes("alter column player_id set not null")
) {
  fail("Database event integrity migration must reject missing participants and non-participant goals/cards");
} else {
  pass("Database event integrity migration guards goal/card participants and required references");
}

// Keep numbered SQL upgrade scripts unique and documented in README.
const readme = read("README.md");
const sqlFiles = readdirSync("sql").filter((name) => /^\d{2}_.+\.sql$/i.test(name)).sort();
const sqlPrefixes = sqlFiles.map((name) => name.match(/^(\d{2})_/)[1]);
const duplicatePrefixes = [...new Set(sqlPrefixes.filter((prefix, i) => sqlPrefixes.indexOf(prefix) !== i))];
if (duplicatePrefixes.length) fail(`Duplicate SQL migration prefixes: ${duplicatePrefixes.join(", ")}`);
else pass(`SQL migration numbering is unique across ${sqlFiles.length} scripts`);
for (const name of sqlFiles) {
  if (!readme.includes(`sql/${name}`)) fail(`SQL migration is not documented in README: sql/${name}`);
}
if (!failures.some((x) => x.startsWith("SQL migration is not documented"))) pass("All numbered SQL migrations are documented in README");

if (failures.length) {
  console.error("\nSite validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("\nAll static site checks passed.");
}
