/**
 * Chat module
 */

function renderChat() {
  const box = $('chatBox');
  if (!box) return;
  const items = window.medjasi.chat || [];
  box.innerHTML = items.map((msg) => `
    <div class="chat-item">
      <strong>${escapeHtml(msg.profile?.username || 'Korisnik')}</strong>
      <p>${escapeHtml(msg.message || '')}</p>
    </div>
  `).join('') || '<div class="empty">Još nema poruka.</div>';
}

async function sendChat() {
  if (!requireAuth()) return;
  const val = $('chatText')?.value.trim();
  if (!val) return toast('Napišite poruku.', 'error');
  window.medjasi.chat.push({
    id: Date.now(),
    message: val,
    profile: { username: window.medjasi.profile?.username || 'Korisnik' },
    created_at: new Date().toISOString()
  });
  $('chatText').value = '';
  renderChat();
  toast('Poruka je poslana.', 'success');
}

window.renderChat = renderChat;
window.sendChat = sendChat;
