/**
 * Medjaši Futsal Liga - News Module
 * Render news feed and admin publishing
 */

async function loadNews() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from("news")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    window.medjasi.news = data || [];
    renderNews();
  } catch (error) {
    console.error("Load news error:", error);
    toast("Greška pri učitavanju vijesti", "error");
  }
}

function renderNews() {
  const feed = $("#newsFeed");
  if (!feed) return;

  const items = window.medjasi.news || [];

  feed.innerHTML = items.length
    ? items
        .map(
          (item) => `
          <article class="news-card card">
            <div class="news-header">
              <span>${escape(item.kicker || "VIJEST")}</span>
              <small>${formatDate(item.created_at)}</small>
            </div>
            <h3>${escape(item.title || "Naslov")}</h3>
            <p>${escape(item.lead || item.body || "")}</p>
          </article>
        `
        )
        .join("")
    : '<div class="empty">Nema vijesti</div>';
}

async function publishNews() {
  if (!requireAdmin()) return;

  const title = $("#v7NewsTitle")?.value.trim();
  const lead = $("#v7NewsLead")?.value.trim();
  const body = $("#v7NewsBody")?.value.trim();

  if (!title || !body) {
    toast("Naslov i sadržaj su obavezni", "error");
    return;
  }

  try {
    const { error } = await supabaseClient.from("news").insert({
      title,
      lead: lead || null,
      body,
      kicker: "VIJEST",
    });

    if (error) {
      toast(`Greška: ${error.message}`, "error");
      return;
    }

    $("#v7NewsTitle").value = "";
    $("#v7NewsLead").value = "";
    $("#v7NewsBody").value = "";

    toast("Vijest objavljena ✅", "success");
    await loadNews();
  } catch (error) {
    console.error("Publish news error:", error);
    toast("Greška pri objavi vijesti", "error");
  }
}

window.loadNews = loadNews;
window.renderNews = renderNews;
window.publishNews = publishNews;
