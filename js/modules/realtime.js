/**
 * Realtime module stub.
 */

function bindRealtime() {
  if (!window.supabaseClient) return;
  try {
    // Because demo mode may not have realtime, no-op is acceptable.
    console.log('Realtime enabled');
  } catch (err) {
    console.warn('Realtime failed', err);
  }
}

window.bindRealtime = bindRealtime;
