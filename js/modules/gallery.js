/**
 * Gallery module
 */

function renderGallery() {
  const grid = $('galleryGrid');
  if (!grid) return;
  const items = window.medjasi.gallery || [];
  grid.innerHTML = items.map((item) => `
    <div class="card gallery-item">
      <img src="${item.image_url || ''}" alt="${escapeHtml(item.title || 'Galerija')}" />
      <h4>${escapeHtml(item.title || 'Galerija')}</h4>
    </div>
  `).join('') || '<div class="empty">Nema slika.</div>';
}

window.renderGallery = renderGallery;
