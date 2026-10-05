/* =========================================================
   MEDJASI STABILITY CORE
   First cleanup pass: controlled data refresh, realtime routing,
   unified goal recording and safe startup repair.
========================================================= */
(() => {
  "use strict";

  const state = {
    initialized: false,
    realtimeReady: false,
    refreshTimer: null,
    lastRefresh: 0
  };

  const tableConfig = {
    teams:    { key: "teams", order: { column: "name", ascending: true } },
    players:  { key: "players", order: { column: "jersey_number", ascending: true } },
    matches:  { key: "matches", order: { column: "match_date", ascending: true } },
    goals:    { key: "goals", order: { column: "minute", ascending: true } },
    cards:    { key: "cards", order: { column: "minute", ascending: true } },
    comments: { key: "comments", order: { column: "created_at", ascending: false } },
    messages: { key: "messages", order: { column: "created_at", ascending: true } },
    gallery:  { key: "gallery", order: { column: "created_at", ascending: false } },
    match_players: { key: "matchPlayers", order: null }
  };

  async function fetchTable(table) {
    const cfg = tableConfig[table];
    if (!cfg) return false;

    let query = supabaseClient.from(table).select("*");
    if (cfg.order) {
      query = query.order(cfg.order.column, { ascending: cfg.order.ascending });
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Medjasi] " + table + " refresh:", error);
      return false;
    }

    window[cfg.key] = data || [];
    return true;
  }

  async function refreshTables(tables, render = true) {
    const unique = [...new Set(tables)].filter(t => tableConfig[t]);
    if (!unique.length) return;

    const results = await Promise.all(unique.map(fetchTable));
    state.lastRefresh = Date.now();

    if (render && typeof renderAll === "function") {
      try { renderAll(); }
      catch (error) { console.error("[Medjasi] renderAll:", error); }
    }

    if (typeof processLeagueNotifications === "function") {
      try { processLeagueNotifications(); } catch (error) {}
    }

    return results.every(Boolean);
  }

  async function stableLoadAll() {
    return refreshTables(
      ["teams","players","matches","goals","cards","comments","messages","gallery","match_players"],
      true
    );
  }

  /*
    Replaces the old "reload everything for every event" behaviour.
    Data is still refreshed, but only the affected table(s).
  */
  async function refreshForTable(table) {
    const map = {
      teams: ["teams","players"],
      players: ["players"],
      matches: ["matches"],
      goals: ["goals","matches"],
      cards: ["cards"],
      match_players: ["match_players"],
      comments: ["comments"],
      messages: ["messages"],
      gallery: ["gallery"]
    };

    return refreshTables(map[table] || [], true);
  }

  function subscribeStableRealtime() {
    try {
      if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
      }

      realtimeChannel = supabaseClient
        .channel("medjasi-live-stable-v1")
        .on("postgres_changes",
          { event: "*", schema: "public", table: "teams" },
          () => refreshForTable("teams"))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "players" },
          () => refreshForTable("players"))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "matches" },
          () => refreshForTable("matches"))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "goals" },
          () => refreshForTable("goals"))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "cards" },
          () => refreshForTable("cards"))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "match_players" },
          () => refreshForTable("match_players"))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "comments" },
          () => refreshForTable("comments"))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          () => refreshForTable("messages"))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "gallery" },
          () => refreshForTable("gallery"))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "site_settings" },
          () => window.loadMusicSettings?.())
        .on("postgres_changes",
          { event: "*", schema: "public", table: "music_tracks" },
          () => window.loadMusicSettings?.())
        .on("postgres_changes",
          { event: "*", schema: "public", table: "news" },
          () => window.medjasiV7?.loadNews?.())
        .subscribe();

      state.realtimeReady = true;
    } catch (error) {
      state.realtimeReady = false;
      console.warn("[Medjasi] Realtime:", error);
    }
  }

  /*
    One goal path. It accepts both the old goal form and the newer
    V7 assist fields, so duplicate addGoal implementations stop fighting.
  */
  async function stableAddGoal(matchId) {
    if (typeof canManageMatch === "function" && !canManageMatch()) return;

    const match = getMatch(matchId);
    if (!match) return;

    const playerId =
      document.getElementById("v7GoalPlayer")?.value ||
      document.getElementById("goalPlayer")?.value || "";

    const assistId =
      document.getElementById("v7GoalAssist")?.value || "";

    const minute = Math.max(
      0,
      Number(
        document.getElementById("v7GoalMinute")?.value ??
        document.getElementById("goalMinute")?.value ?? 0
      ) || 0
    );

    const second = Math.max(
      0,
      Math.min(59,
        Number(document.getElementById("goalSecond")?.value || 0) || 0
      )
    );

    const player = getPlayer(playerId);
    if (!player) {
      alert("Izaberi igrača.");
      return;
    }

    const homeId = String(match.home_team_id);
    const awayId = String(match.away_team_id);
    const playerTeam = String(player.team_id);

    if (playerTeam !== homeId && playerTeam !== awayId) {
      alert("Igrač ne pripada ekipama u ovoj utakmici.");
      return;
    }

    let assistPlayer = null;
    if (assistId) {
      assistPlayer = getPlayer(assistId);

      if (!assistPlayer) {
        alert("Izabrani asistent ne postoji.");
        return;
      }

      if (String(assistPlayer.id) === String(player.id)) {
        alert("Strijelac ne može biti sam sebi asistent.");
        return;
      }

      if (String(assistPlayer.team_id) !== playerTeam) {
        alert("Asistent mora biti iz iste ekipe kao strijelac.");
        return;
      }
    }

    const goalRow = {
      match_id: matchId,
      player_id: playerId,
      minute,
      second
    };

    if (assistPlayer) goalRow.assist_player_id = assistPlayer.id;

    const { error } = await supabaseClient.from("goals").insert(goalRow);
    if (error) {
      alert(error.message);
      return;
    }

    const update = {};
    if (playerTeam === homeId) {
      update.home_score = Number(match.home_score || 0) + 1;
    } else {
      update.away_score = Number(match.away_score || 0) + 1;
    }

    const { error: updateError } = await supabaseClient
      .from("matches")
      .update(update)
      .eq("id", matchId);

    if (updateError) {
      console.error("[Medjasi] score update:", updateError);
      alert(updateError.message);
      return;
    }

    try { await window.notifyPush?.("goal", { matchId, playerId }); }
    catch (error) {}

    window.hideModal?.();
    window.toast?.("Gol je evidentiran.");

    await refreshTables(["goals","matches"], true);
    window.openMatch?.(matchId);
  }

  /*
    Do not let the 30-second timer create overlapping requests.
  */
  function scheduleStableRefresh() {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(async () => {
      state.refreshTimer = null;
      try { await stableLoadAll(); }
      catch (error) { console.error("[Medjasi] scheduled refresh:", error); }
    }, 250);
  }

  async function boot() {
    if (state.initialized) return;
    state.initialized = true;

    /*
      The original init has already performed its first load by the time
      this script executes. From this point onward, replace its global
      loaders/realtime handlers with the controlled versions.
    */
    window.loadAll = stableLoadAll;
    window.subscribeRealtime = subscribeStableRealtime;
    window.addGoal = stableAddGoal;

    subscribeStableRealtime();

    setInterval(scheduleStableRefresh, 30000);

    /*
      One controlled reconciliation after the replacement is installed.
    */
    await stableLoadAll();
  }

  window.medjasiStability = {
    version: "2026.10.05-r1",
    loadAll: stableLoadAll,
    refreshTables,
    refreshForTable,
    subscribeRealtime: subscribeStableRealtime,
    addGoal: stableAddGoal
  };

  /*
    app.js is deferred and executes before this file. Run immediately,
    after its own initial bootstrap, without creating a second DOMContentLoaded
    race.
  */
  boot().catch(error => console.error("[Medjasi] stability boot:", error));
})();
