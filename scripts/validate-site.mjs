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

if (!dashboard.includes("if(attempts++<25)window.setTimeout(selectTab,100)")) {
  fail("Fan Game quick links must wait for asynchronously rendered tabs with a bounded retry");
} else pass("Fan Game quick links wait for tabs without infinite retries");


const htmlRefs = [...html.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/gi)]
  .map((m) => m[1])
  .filter((ref) => /\.(?:css|js|html|json|png|svg|webp|jpe?g|woff2?)(?:[?#]|$)/i.test(ref));

const stylesheetTags = [...html.matchAll(/<link\b[^>]+href=["'][^"']+\.css(?:\?[^"']*)?["'][^>]*>/gi)];
const finalLayoutIndex = stylesheetTags.findIndex((m) => m[0].includes("medjasi-dashboard-refinements-v2.css"));
const lastStylesheetIndex = stylesheetTags.length - 1;
if (finalLayoutIndex < 0 || finalLayoutIndex !== lastStylesheetIndex) {
  fail("medjasi-dashboard-refinements-v2.css must remain the last stylesheet so sidebar/layout overrides win the cascade");
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
  !pushEdgeSource.includes('if (role !== "admin" && role !== "moderator")')
) {
  fail("League event push notifications must use the exported notifier and enforce admin/moderator authorization");
} else {
  pass("League-event push wiring and server-side role gate are present");
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
