import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
const url = appSource.match(/const SUPABASE_URL\s*=\s*["']([^"']+)["']/)?.[1];
const key = appSource.match(/const SUPABASE_KEY\s*=\s*["']([^"']+)["']/)?.[1];

if (!url || !key) {
  console.error("FAIL live Supabase health: public client configuration could not be read from js/app.js.");
  process.exitCode = 1;
} else {
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json"
  };
  const failures = [];
  const requestJson = async (path, options = {}) => {
    const response = await fetch(new URL(path, url), {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.text();
    let payload = null;
    try { payload = body ? JSON.parse(body) : null; } catch {}
    return { response, body, payload };
  };

  // Exercise the exact REST table fallback used by loadAll(), not only the RPC.
  // The original incident returned PGRST002 for /matches and /goals as well.
  const tableProbes = [
    ["teams", "/rest/v1/teams?select=id&order=name.asc%2Cid.asc&offset=0&limit=1"],
    ["players", "/rest/v1/players?select=id&order=jersey_number.asc%2Cid.asc&offset=0&limit=1"],
    ["matches", "/rest/v1/matches?select=id%2Cmatch_date&order=match_date.asc%2Cid.asc&offset=0&limit=1000"],
    ["goals", "/rest/v1/goals?select=id%2Cminute&order=minute.asc%2Cid.asc&offset=0&limit=1000"],
    ["cards", "/rest/v1/cards?select=id%2Cminute&order=minute.asc%2Cid.asc&offset=0&limit=1000"],
    ["comments", "/rest/v1/comments?select=id%2Ccreated_at&order=created_at.desc%2Cid.desc&limit=300"],
    ["messages", "/rest/v1/messages?select=id%2Ccreated_at&order=created_at.desc%2Cid.desc&limit=300"],
    ["gallery", "/rest/v1/gallery?select=id%2Ccreated_at&order=created_at.desc%2Cid.desc&limit=200"],
    ["match_players", "/rest/v1/match_players?select=match_id%2Cplayer_id&order=match_id.asc%2Cplayer_id.asc&limit=1000"],
    // Public News must remain readable without granting anon EXECUTE on is_admin().
    ["news", "/rest/v1/news?select=id%2Cpublished%2Ccreated_at&order=created_at.desc%2Cid.desc&limit=100"]
  ];

  for (const [name, path] of tableProbes) {
    try {
      const { response, body, payload } = await requestJson(path);
      if (!response.ok) {
        const code = String(payload?.code || "unknown");
        const message = String(payload?.message || body || "No response body").slice(0, 200);
        failures.push(`${name}: HTTP ${response.status}; code=${code}; ${message}`);
        continue;
      }
      if (!Array.isArray(payload)) {
        failures.push(`${name}: HTTP ${response.status}, but the REST payload was not an array.`);
        continue;
      }
      console.log(`PASS REST ${name}: HTTP ${response.status}; rows=${payload.length}`);
    } catch (error) {
      failures.push(`${name}: ${String(error?.message || error).slice(0, 200)}`);
    }
  }

  try {
    const { response, body, payload } = await requestJson("/rest/v1/rpc/get_league_snapshot", {
      method: "POST",
      body: "{}"
    });
    if (!response.ok) {
      const code = String(payload?.code || "unknown");
      const message = String(payload?.message || body || "No response body").slice(0, 240);
      failures.push(`get_league_snapshot: HTTP ${response.status}; code=${code}; ${message}`);
    } else {
      const required = ["teams", "players", "matches", "goals", "cards", "comments", "messages", "gallery", "match_players"];
      const missing = required.filter(name => !Array.isArray(payload?.[name]));
      if (missing.length) {
        failures.push("get_league_snapshot: missing array fields: " + missing.join(", "));
      } else {
        console.log("PASS get_league_snapshot: HTTP 200; valid arrays", JSON.stringify({
          teams: payload.teams.length,
          players: payload.players.length,
          matches: payload.matches.length
        }));
      }
    }
  } catch (error) {
    failures.push(`get_league_snapshot: ${String(error?.message || error).slice(0, 200)}`);
  }

  if (failures.length) {
    console.error("FAIL live Supabase health: " + failures.join(" | "));
    process.exitCode = 1;
  } else {
    console.log("PASS live Supabase health: all core REST routes and the league snapshot are responding.");
  }
}
