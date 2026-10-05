/**
 * News module
 */

function renderNews() {
  const feed = $('newsFeed');
  if (!feed) return;
  const items = window.medjasi.news || [];
  feed.innerHTML = items.map((item) => `
    <div class="card news-item">
      <small>${escapeHtml(item.kicker || 'VIJEST')}</small>
      <h3>${escapeHtml(item.title || 'Naslov')}</h3>
      <p>${escapeHtml(item.lead || item.body || '')}</p>
    </div>
  `).join('') || '<div class="empty">Nema vijesti.</div>';
}

window.renderNews = renderNews;
