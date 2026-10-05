/**
 * Medjaši Futsal Liga - Community Module
 * Community feed, stories, posts, profile cards
 */

async function loadCommunity() {
  if (!supabaseClient) return;

  try {
    const { data: posts, error: postsError } = await supabaseClient
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: stories, error: storiesError } = await supabaseClient
      .from("community_stories")
      .select("*")
      .order("created_at", { ascending: false });

    if (postsError) throw postsError;
    if (storiesError) throw storiesError;

    window.medjasi.community.posts = posts || [];
    window.medjasi.community.stories = stories || [];

    renderCommunity();
  } catch (error) {
    console.error("Community load error:", error);
    toast("Greška pri učitavanju zajednice", "error");
  }
}

function renderCommunity() {
  const feed = $("#v9Feed");
  const stories = $("#v9Stories");
  const profile = $("#v9MyProfileCard");

  if (feed) {
    const posts = window.medjasi.community.posts || [];
    feed.innerHTML = posts.length
      ? posts
          .map(
            (post) => `
            <article class="v9-post card">
              <div class="v9-post-header">
                <strong>${escape(post.username || "Korisnik")}</strong>
                <span>${formatDate(post.created_at)}</span>
              </div>
              <p>${escape(post.caption || "")}</p>
              ${post.image_url ? `<img src="${escape(post.image_url)}" alt="objava" />` : ""}
            </article>
          `
          )
          .join("")
      : '<div class="empty">Nema objava</div>';
  }

  if (stories) {
    const items = window.medjasi.community.stories || [];
    stories.innerHTML = items.length
      ? items
          .map(
            (story) => `
            <div class="v9-story" onclick="openStory('${story.id}')">
              <img src="${escape(story.image_url || 'images/player-placeholder.png')}" alt="story" />
              <span>${escape(story.username || "Korisnik")}</span>
            </div>
          `
          )
          .join("")
      : '<div class="empty">Nema priča</div>';
  }

  if (profile && window.medjasi.profile) {
    profile.innerHTML = `
      <div class="v9-profile-header">
        <img src="${escape(window.medjasi.profile.avatar_url || 'images/player-placeholder.png')}" alt="profile" />
        <div>
          <strong>${escape(window.medjasi.profile.username || "Korisnik")}</strong>
          <small>${escape(window.medjasi.profile.role || "user")}</small>
        </div>
      </div>
    `;
  }
}

function openStory(id) {
  const story = (window.medjasi.community.stories || []).find((s) => String(s.id) === String(id));
  if (!story) return;

  showModal(`
    <div class="modal-story">
      <img src="${escape(story.image_url || 'images/player-placeholder.png')}" alt="story" />
      <div class="story-meta">
        <strong>${escape(story.username || "Korisnik")}</strong>
        <span>${formatDate(story.created_at)}</span>
      </div>
    </div>
  `);
}

window.loadCommunity = loadCommunity;
window.renderCommunity = renderCommunity;
window.openStory = openStory;
