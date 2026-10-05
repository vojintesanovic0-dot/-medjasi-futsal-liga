/**
 * Medjaši Futsal Liga - Realtime Module
 * Supabase subscriptions and live update callbacks
 */

function bindRealtime() {
  if (!supabaseClient) return;

  // Teams realtime
  supabaseClient
    .channel("public:teams")
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, async () => {
      await loadAll();
      renderTeams();
      renderTable();
      renderPlayerFilters();
    })
    .subscribe();

  // Players realtime
  supabaseClient
    .channel("public:players")
    .on("postgres_changes", { event: "*", schema: "public", table: "players" }, async () => {
      await loadAll();
      renderPlayers();
      renderPlayerFilters();
    })
    .subscribe();

  // Matches realtime
  supabaseClient
    .channel("public:matches")
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, async () => {
      await loadAll();
      renderMatches();
      renderAdminMatches();
      renderTable();
    })
    .subscribe();

  // Chat realtime
  supabaseClient
    .channel("public:chat_messages")
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, async () => {
      await loadAll();
      renderChat();
    })
    .subscribe();

  // Gallery realtime
  supabaseClient
    .channel("public:gallery")
    .on("postgres_changes", { event: "*", schema: "public", table: "gallery" }, async () => {
      await loadAll();
      renderGallery();
    })
    .subscribe();

  // News realtime
  supabaseClient
    .channel("public:news")
    .on("postgres_changes", { event: "*", schema: "public", table: "news" }, async () => {
      await loadAll();
      renderNews();
    })
    .subscribe();
}

window.bindRealtime = bindRealtime;
