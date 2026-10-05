/**
 * Community module
 */

function renderCommunity() {
  const feed = $('communityFeed');
  if (!feed) return;
  const posts = window.medjasi.community.posts || [];
  feed.innerHTML = posts.map((post) => `
    <div class="card community-post">
      <h4>${escapeHtml(post.username || 'Korisnik')}</h4>
      <p>${escapeHtml(post.caption || '')}</p>
      ${post.image_url ? `<img src="${post.image_url}" alt="community" />` : ''}
    </div>
  `).join('') || '<div class="empty">Nema objava.</div>';
}

window.renderCommunity = renderCommunity;
