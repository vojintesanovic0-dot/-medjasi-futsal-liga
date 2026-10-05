/**
 * Medjaši Futsal Liga - Admin Module
 * Team, player, match, gallery, music, season admin actions
 */

async function addSeason() {
  if (!requireAdmin()) return;

  const name = $("#v7SeasonName")?.value.trim();
  if (!name) {
    toast("Unesite naziv sezone", "error");
    return;
  }

  try {
    const { error } = await supabaseClient.from("seasons").insert({ name, is_active: false });

    if (error) {
      toast(`Greška: ${error.message}`, "error");
      return;
    }

    toast("Sezona dodana ✅", "success");
    $("#v7SeasonName").value = "";
    await loadSeasons();
  } catch (error) {
    console.error("Add season error:", error);
    toast("Greška pri dodavanju sezone", "error");
  }
}

async function activateSeason(id) {
  if (!requireAdmin()) return;

  try {
    await supabaseClient.from("seasons").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await supabaseClient.from("seasons").update({ is_active: true }).eq("id", id);

    if (error) {
      toast(`Greška: ${error.message}`, "error");
      return;
    }

    toast("Sezona aktivirana ✅", "success");
    await loadSeasons();
  } catch (error) {
    console.error("Activate season error:", error);
    toast("Greška pri aktivaciji sezone", "error");
  }
}

async function addMusicTrack() {
  if (!requireAdmin()) return;

  const url = $("#adminYoutubeUrl")?.value.trim();
  const title = $("#adminYoutubeTitle")?.value.trim();

  if (!url) {
    toast("Unesite YouTube link", "error");
    return;
  }

  try {
    const { error } = await supabaseClient.from("music_tracks").insert({
      youtube_music_id: url,
      title: title || "Pjesma",
      enabled: true,
    });

    if (error) {
      toast(`Greška: ${error.message}`, "error");
      return;
    }

    $("#adminYoutubeUrl").value = "";
    $("#adminYoutubeTitle").value = "";
    toast("Pjesma dodana u playlistu ✅", "success");
    await loadMusicSettings();
  } catch (error) {
    console.error("Add music track error:", error);
    toast("Greška pri dodavanju pjesme", "error");
  }
}

function renderSeasons() {
  const box = $("#v7SeasonList");
  if (!box) return;

  const seasons = window.medjasi.seasons || [];
  box.innerHTML = seasons
    .map(
      (season) => `
        <div class="admin-match">
          <span>${escape(season.name)}</span>
          <button onclick="activateSeason('${season.id}')">${season.is_active ? "Aktivna" : "Aktiviraj"}</button>
        </div>
      `
    )
    .join("");
}

async function loadSeasons() {
  try {
    const { data, error } = await supabaseClient.from("seasons").select("*").order("created_at", { ascending: false });
    if (!error) {
      window.medjasi.seasons = data || [];
      renderSeasons();
    }
  } catch (error) {
    console.error("Load seasons error:", error);
  }
}

async function loadMusicSettings() {
  try {
    const { data, error } = await supabaseClient.from("site_settings").select("youtube_music_enabled").eq("id", 1).maybeSingle();
    if (!error) {
      window.medjasi.musicEnabled = data?.youtube_music_enabled ?? false;
    }
  } catch (error) {
    console.error("Load music settings error:", error);
  }
}

async function toggleMusicPlaylist(enabled) {
  if (!requireAdmin()) return;

  try {
    const { error } = await supabaseClient.from("site_settings").update({ youtube_music_enabled: enabled }).eq("id", 1);

    if (error) {
      toast(`Greška: ${error.message}`, "error");
      return;
    }

    window.medjasi.musicEnabled = enabled;
    toast(enabled ? "Playlist aktiviran ✅" : "Playlist deaktiviran", "success");
  } catch (error) {
    console.error("Toggle music error:", error);
    toast("Greška pri izmjeni playlista", "error");
  }
}

window.addSeason = addSeason;
window.activateSeason = activateSeason;
window.addMusicTrack = addMusicTrack;
window.toggleMusicPlaylist = toggleMusicPlaylist;
window.loadSeasons = loadSeasons;
window.renderSeasons = renderSeasons;
window.loadMusicSettings = loadMusicSettings;
