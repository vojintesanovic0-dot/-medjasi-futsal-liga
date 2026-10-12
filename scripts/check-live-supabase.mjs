import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
const url = appSource.match(/const SUPABASE_URL\s*=\s*["']([^"']+)["']/)?.[1];
const key = appSource.match(/const SUPABASE_KEY\s*=\s*["']([^"']+)["']/)?.[1];

if (!url || !key) {
  console.error("FAIL live Supabase health: public client configuration could not be read from js/app.js.");
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(new URL("/rest/v1/rpc/get_league_snapshot", url), {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json"
      },
      body: "{}",
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.text();
    let payload = null;
    try { payload = body ? JSON.parse(body) : null; } catch {}

    if (!response.ok) {
      const code = String(payload?.code || "unknown");
      const message = String(payload?.message || body || "No response body").slice(0, 240);
      console.error(`FAIL live Supabase health: HTTP ${response.status}; code=${code}; ${message}`);
      process.exitCode = 1;
    } else {
      const keys = ["teams", "players", "matches", "goals", "cards", "comments", "messages", "gallery", "match_players"];
      const missing = keys.filter(name => !Array.isArray(payload?.[name]));
      if (missing.length) {
        console.error("FAIL live Supabase health: snapshot is missing array fields: " + missing.join(", "));
        process.exitCode = 1;
      } else {
        console.log("PASS live Supabase health: snapshot returned valid arrays", JSON.stringify({
          teams: payload.teams.length,
          players: payload.players.length,
          matches: payload.matches.length
        }));
      }
    }
  } catch (error) {
    console.error("FAIL live Supabase health: request did not complete:", String(error?.message || error).slice(0, 240));
    process.exitCode = 1;
  }
}
