/**
 * Core module
 * Global state, generic helpers, demo data fallback, init sequence.
 */

window.medjasi = Object.assign(window.medjasi || {}, {
  user: null,
  profile: null,
  teams: [],
  players: [],
  matches: [],
  goals: [],
  chat: [],
  comments: [],
  gallery: [],
  news: [],
  community: { posts: [], stories: [], profiles: {} },
  stats: [],
  seasons: [],
  musicTracks: [],
  currentSection: 'home',
  isLoggedIn: false,
  isAdmin: false,
  demo: {
    teams: [
      { id: 1, name: 'Medjaši A', coach: 'Niko Kovač' },
      { id: 2, name: 'Medjaši B', coach: 'Mirza Hasanović' },
      { id: 3, name: 'Kovači', coach: 'Adnan Dedić' },
      { id: 4, name: 'Pobjeda', coach: 'Elmir Smajlović' }
    ],
    players: [
      { id: 1, name: 'Aldin Beganović', team_id: 1, number: 10, position: 'Krilo' },
      { id: 2, name: 'Amar Kovačević', team_id: 1, number: 9, position: 'Napadač' },
      { id: 3, name: 'Dino Latić', team_id: 2, number: 8, position: 'Bek' },
      { id: 4, name: 'Tarik Salkić', team_id: 2, number: 7, position: 'Pivot' },
      { id: 5, name: 'Milan Mekić', team_id: 3, number: 11, position: 'Krilo' },
      { id: 6, name: 'Nedim Vražalić', team_id: 4, number: 5, position: 'Golman' }
    ],
    matches: [
      { id: 1, home_team_id: 1, away_team_id: 2, home_score: 3, away_score: 2, status: 'finished', round: 1, match_datetime: '2026-10-05T18:00:00' },
      { id: 2, home_team_id: 3, away_team_id: 4, home_score: 1, away_score: 1, status: 'live', round: 1, match_datetime: '2026-10-05T20:30:00' },
      { id: 3, home_team_id: 2, away_team_id: 4, home_score: 0, away_score: 0, status: 'scheduled', round: 2, match_datetime: '2026-10-08T19:00:00' }
    ],
    gallery: [
      { id: 1, title: 'Liga', image_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=900&q=80' },
      { id: 2, title: 'Trening', image_url: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=900&q=80' }
    ],
    news: [
      { id: 1, title: 'Nova sezona je počela', kicker: 'VIJEST', lead: 'Liga je u punom jeku.', body: 'Prvo kolo je završeno, a atmosfera je vrhunska.' },
      { id: 2, title: 'Naredna utakmica u petak', kicker: 'UTAKMICA', lead: 'Velika derbi večer', body: 'Pratite live score i sve najnovije informacije.' }
    ],
    chat: [
      { id: 1, message: 'Jako dobra atmosfera danas!', user_id: 'u1', profile: { username: 'Fan1' }, created_at: new Date().toISOString() },
      { id: 2, message: 'Pobjeda je bila zaslužena!', user_id: 'u2', profile: { username: 'Fan2' }, created_at: new Date().toISOString() }
    ],
    community: { posts: [
      { id: 1, username: 'Fan1', created_at: new Date().toISOString(), caption: 'Danas je bila fantastična atmosfera!', image_url: 'https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=900&q=80' },
      { id: 2, username: 'Fan2', created_at: new Date().toISOString(), caption: 'Naredna utakmica će biti velika!', image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80' }
    ], stories: [
      { id: 1, username: 'Fan1', image_url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=900&q=80', created_at: new Date().toISOString() }
    ] }
  }
});

if (!window.medjasi.teams.length) {
  window.medjasi.teams = window.medjasi.demo.teams;
  window.medjasi.players = window.medjasi.demo.players;
  window.medjasi.matches = window.medjasi.demo.matches;
  window.medjasi.gallery = window.medjasi.demo.gallery;
  window.medjasi.news = window.medjasi.demo.news;
  window.medjasi.chat = window.medjasi.demo.chat;
  window.medjasi.community.posts = window.medjasi.demo.community.posts;
  window.medjasi.community.stories = window.medjasi.demo.community.stories;
}

window.supabaseClient = null;

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const $ = (id) => document.getElementById(id);

const formatDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const showSection = (sectionId) => {
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');
  window.medjasi.currentSection = sectionId;
};

const toast = (message, type = 'info') => {
  const wrap = $('toastWrap');
  if (!wrap) {
    alert(message);
    return;
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3000);
};

const showModal = (content) => {
  const modal = $('modal');
  const box = $('modalContent');
  if (!modal || !box) return;
  box.innerHTML = content;
  modal.classList.add('visible');
};

const hideModal = () => {
  const modal = $('modal');
  if (modal) modal.classList.remove('visible');
};

const closeModal = (event) => {
  if (event && event.target && event.target.id === 'modal') hideModal();
};

const requireAuth = () => {
  if (!window.medjasi.isLoggedIn) {
    toast('Prijavite se da biste nastavili.', 'error');
    showSection('login');
    return false;
  }
  return true;
};

const requireAdmin = () => {
  if (!window.medjasi.isAdmin) {
    toast('Nemaš admin ovlaštenje.', 'error');
    return false;
  }
  return true;
};

async function initSupabase() {
  if (window.supabase && window.supabase.createClient) {
    window.supabaseClient = window.supabase.createClient('https://example.supabase.co', 'demo-key');
    return true;
  }
  return false;
}

async function loadAll() {
  if (window.supabaseClient && window.supabaseClient.from) {
    try {
      const { data: teams } = await window.supabaseClient.from('teams').select('*');
      if (Array.isArray(teams) && teams.length) window.medjasi.teams = teams;
      const { data: players } = await window.supabaseClient.from('players').select('*');
      if (Array.isArray(players) && players.length) window.medjasi.players = players;
      const { data: matches } = await window.supabaseClient.from('matches').select('*');
      if (Array.isArray(matches) && matches.length) window.medjasi.matches = matches;
      const { data: gallery } = await window.supabaseClient.from('gallery').select('*');
      if (Array.isArray(gallery) && gallery.length) window.medjasi.gallery = gallery;
      const { data: news } = await window.supabaseClient.from('news').select('*');
      if (Array.isArray(news) && news.length) window.medjasi.news = news;
    } catch (error) {
      console.warn('Supabase unavailable, using demo data.', error);
    }
  }

  if (!window.medjasi.teams.length) {
    window.medjasi.teams = window.medjasi.demo.teams;
  }
  if (!window.medjasi.players.length) {
    window.medjasi.players = window.medjasi.demo.players;
  }
  if (!window.medjasi.matches.length) {
    window.medjasi.matches = window.medjasi.demo.matches;
  }
  if (!window.medjasi.gallery.length) {
    window.medjasi.gallery = window.medjasi.demo.gallery;
  }
  if (!window.medjasi.news.length) {
    window.medjasi.news = window.medjasi.demo.news;
  }
  if (!window.medjasi.chat.length) {
    window.medjasi.chat = window.medjasi.demo.chat;
  }
  if (!window.medjasi.community.posts.length) {
    window.medjasi.community.posts = window.medjasi.demo.community.posts;
  }
  if (!window.medjasi.community.stories.length) {
    window.medjasi.community.stories = window.medjasi.demo.community.stories;
  }

  if (typeof renderTeams === 'function') renderTeams();
  if (typeof renderPlayers === 'function') renderPlayers();
  if (typeof renderMatches === 'function') renderMatches();
  if (typeof renderGallery === 'function') renderGallery();
  if (typeof renderNews === 'function') renderNews();
  if (typeof renderCommunity === 'function') renderCommunity();
  if (typeof renderChat === 'function') renderChat();
}

async function initCore() {
  await initSupabase();
  await loadAll();
  return true;
}

window.escapeHtml = escapeHtml;
window.escape = escapeHtml;
window.formatDate = formatDate;
window.showSection = showSection;
window.toast = toast;
window.showModal = showModal;
window.hideModal = hideModal;
window.closeModal = closeModal;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.loadAll = loadAll;
window.initCore = initCore;
window.supabaseClient = window.supabaseClient;
