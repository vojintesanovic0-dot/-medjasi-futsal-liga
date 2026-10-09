/* Gallery post-render fixes
   Keeps the V7 media renderer compatible with gallery album UI and admin tools.
*/
(() => {
  'use strict';

  if (window.__MEDJASI_GALLERY_FIXES__) return;
  window.__MEDJASI_GALLERY_FIXES__ = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => typeof window.esc === 'function'
    ? window.esc(v ?? '')
    : String(v ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[c]));

  const supabase = () => window.supabaseClient;
  const isAdmin = () => {
    try {
      return typeof window.isAdmin === 'function' ? window.isAdmin() : false;
    } catch {
      return false;
    }
  };

  async function loadAlbums() {
    const client = supabase();
    if (!client) return [];

    const { data, error } = await client
      .from('gallery_albums')
      .select('id,name,description')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Gallery albums:', error);
      return [];
    }

    return data || [];
  }

  async function applyGalleryUi() {
    const grid = $('galleryGrid');
    if (!grid) return;

    const albums = await loadAlbums();

    let bar = $('communityAlbumBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'communityAlbumBar';
      bar.style.marginBottom = '12px';
      grid.parentElement?.insertBefore(bar, grid);
    }

    bar.innerHTML =
      '<label> Album: <select id="communityAlbumFilter"><option value="">Sve fotografije</option>' +
      albums.map(a => '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>').join('') +
      '</select></label>';

    const filter = $('communityAlbumFilter');
    if (filter) {
      filter.onchange = () => {
        const id = filter.value;
        grid.querySelectorAll('.gallery-item').forEach((el, i) => {
          const g = (window.gallery || [])[i];
          el.hidden = !!id && String(g?.album_id) !== String(id);
        });
      };
    }

    if (isAdmin()) {
      const adminHost = $('adminGalleryList')?.parentElement;
      if (adminHost && !$('galleryAlbumSelect')) {
        const wrap = document.createElement('div');
        wrap.className = 'form-group';
        wrap.innerHTML =
          '<label> Album (opcionalno)</label>' +
          '<select id="galleryAlbumSelect"><option value="">Bez albuma</option>' +
          albums.map(a => '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>').join('') +
          '</select>';

        const btn = adminHost.querySelector('button[onclick*="adminAddGalleryImage"]');
        if (btn?.parentElement) {
          btn.parentElement.insertBefore(wrap, btn);
        }
      }

      let adminCard = $('communityAlbumAdmin');
      if (!adminCard && $('adminGalleryList')) {
        adminCard = document.createElement('div');
        adminCard.id = 'communityAlbumAdmin';
        adminCard.style.marginTop = '12px';
        adminCard.innerHTML =
          '<h4> Albumi galerije</h4>' +
          '<div class="form-group"><input id="newAlbumName" maxlength="120" placeholder="Naziv albuma"></div>' +
          '<div class="form-group"><input id="newAlbumDesc" maxlength="500" placeholder="Opis albuma"></div>' +
          '<button type="button" class="btn btn-blue btn-small" id="createAlbumBtn">＋ Kreiraj album</button>' +
          '<div id="communityAlbumAdminList" class="muted"></div>';
        $('adminGalleryList')?.parentElement?.appendChild(adminCard);
      }

      const createBtn = $('createAlbumBtn');
      if (createBtn && !createBtn.dataset.bound) {
        createBtn.dataset.bound = '1';
        createBtn.onclick = async () => {
          const client = supabase();
          const name = $('newAlbumName')?.value.trim();
          if (!name) return window.toast?.('Upiši naziv albuma.', 'error');
          const { error } = await client.from('gallery_albums').insert({
            name,
            description: $('newAlbumDesc')?.value.trim() || null,
            created_by: window.currentUser?.id || null
          });
          if (error) return window.toast?.(error.message, 'error');
          window.toast?.('Album je kreiran.');
          if (adminCard) adminCard.remove();
          await applyGalleryUi();
        };
      }

      loadAlbums().then(albs => {
        const list = $('communityAlbumAdminList');
        if (list) list.textContent = albs.map(v => v.name).join(' • ') || 'Još nema albuma.';
      });
    }
  }

  async function adminAddGalleryImagePatched() {
    if (!isAdmin()) {
      window.toast?.('Nemaš admin ovlaštenje.', 'error');
      return false;
    }

    const client = supabase();
    const file = $('galleryImageFile')?.files?.[0];
    const title = $('galleryTitle')?.value.trim() || '';
    const description = $('galleryDescription')?.value.trim() || '';
    const albumId = $('galleryAlbumSelect')?.value || null;

    if (!file) {
      window.toast?.('Izaberi sliku ili video.', 'error');
      return false;
    }

    if (file.size > 50 * 1024 * 1024) {
      window.toast?.('Maksimum je 50 MB.', 'error');
      return false;
    }

    try {
      const mediaUrl = await window.uploadFile(file, 'gallery');
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      const payload = {
        image_url: mediaType === 'image' ? mediaUrl : null,
        media_url: mediaUrl,
        media_type: mediaType,
        title: title.slice(0, 100) || 'Medij lige',
        description: description.slice(0, 250),
        created_by: window.currentUser?.id || null,
        album_id: albumId || null
      };

      const { data, error } = await client
        .from('gallery')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      if ($('galleryImageFile')) $('galleryImageFile').value = '';
      if ($('galleryTitle')) $('galleryTitle').value = '';
      if ($('galleryDescription')) $('galleryDescription').value = '';

      await window.loadAll?.();
      await applyGalleryUi();
      window.toast?.('Medij je objavljen.');

      return data?.id || null;
    } catch (error) {
      window.toast?.(error.message || 'Greška pri uploadu.', 'error');
      return false;
    }
  }

  function patchRenderers() {
    const wrap = (name) => {
      const original = window[name];
      if (typeof original !== 'function' || original.__galleryUiPatched) return;
      const patched = function() {
        const result = original.apply(this, arguments);
        setTimeout(() => { void applyGalleryUi(); }, 0);
        return result;
      };
      patched.__galleryUiPatched = true;
      window[name] = patched;
    };

    wrap('renderGallery');
    wrap('renderGalleryV7');
    wrap('renderAdminGallery');
  }

  window.adminAddMedia = adminAddGalleryImagePatched;
  window.adminAddGalleryImage = adminAddGalleryImagePatched;

  patchRenderers();

  window.addEventListener('load', () => setTimeout(() => {
    patchRenderers();
    void applyGalleryUi();
  }, 300));

  setTimeout(() => {
    patchRenderers();
    void applyGalleryUi();
  }, 1200);
})();
