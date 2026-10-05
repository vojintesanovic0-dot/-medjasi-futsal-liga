/**
 * Authentication module
 */

async function login() {
  const email = $('loginEmail')?.value.trim();
  const password = $('loginPassword')?.value.trim();

  if (!email || !password) {
    toast('Unesite email i lozinku.', 'error');
    return;
  }

  window.medjasi.user = { id: 'demo-user', email, username: email.split('@')[0] };
  window.medjasi.profile = { username: email.split('@')[0], role: 'user' };
  window.medjasi.isLoggedIn = true;
  window.medjasi.isAdmin = false;
  updateAuthUI();
  toast('Uspješno ste prijavljeni.', 'success');
  showSection('home');
}

async function register() {
  const username = $('registerUsername')?.value.trim();
  const email = $('registerEmail')?.value.trim();
  const password = $('registerPassword')?.value.trim();
  const confirm = $('registerPasswordConfirm')?.value.trim();

  if (!username || !email || !password) {
    toast('Popunite sva polja.', 'error');
    return;
  }

  if (password.length < 6) {
    toast('Lozinka mora imati najmanje 6 znakova.', 'error');
    return;
  }

  if (password !== confirm) {
    toast('Lozinke se ne podudaraju.', 'error');
    return;
  }

  window.medjasi.user = { id: 'demo-user', email, username };
  window.medjasi.profile = { username, role: 'user' };
  window.medjasi.isLoggedIn = true;
  window.medjasi.isAdmin = false;
  updateAuthUI();
  toast('Registracija je uspješna.', 'success');
  showSection('login');
}

async function logout() {
  window.medjasi.user = null;
  window.medjasi.profile = null;
  window.medjasi.isLoggedIn = false;
  window.medjasi.isAdmin = false;
  updateAuthUI();
  toast('Odjavili ste se.', 'info');
  showSection('home');
}

async function resetPassword() {
  const email = $('loginEmail')?.value.trim();
  if (!email) {
    toast('Unesite email prvo.', 'error');
    return;
  }
  toast('Link za reset lozinke je poslan.', 'success');
}

function updateAuthUI() {
  const header = $('headerAccount');
  if (!header) return;

  if (window.medjasi.isLoggedIn) {
    const username = window.medjasi.profile?.username || 'Korisnik';
    header.innerHTML = `<button class="auth-btn" onclick="logout()">👤 ${escapeHtml(username)} | Odjava</button>`;
  } else {
    header.innerHTML = `<button class="auth-btn" onclick="showSection('login')">🔐 Prijava</button>`;
  }

  const adminPanel = $('admin');
  if (adminPanel) adminPanel.style.display = window.medjasi.isAdmin ? 'block' : 'none';
}

window.login = login;
window.register = register;
window.logout = logout;
window.resetPassword = resetPassword;
window.updateAuthUI = updateAuthUI;
