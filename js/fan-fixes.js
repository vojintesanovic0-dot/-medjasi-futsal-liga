/* Fan Game post-finish settlement fix */
(() => {
  'use strict';

  if (window.__MEDJASI_FAN_FIXES__) return;
  window.__MEDJASI_FAN_FIXES__ = true;

  const supabase = () => window.supabaseClient;
  const toast = (m, t) => typeof window.toast === 'function' ? window.toast(m, t) : alert(m);

  async function settleFanMatch(matchId) {
    const client = supabase();
    if (!client || !matchId) return null;

    try {
      const { data, error } = await client.rpc('fan_settle_match', {
        p_match: String(matchId)
      });

      if (error) {
        console.warn('Fan settle:', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.warn('Fan settle:', error);
      return null;
    }
  }

  function wrapFinishHandler() {
    const original = window.finishAndSave;
    if (typeof original !== 'function' || original.__fanSettleWrapped) return;

    const wrapped = async function(matchId) {
      const result = await original.apply(this, arguments);
      const maybeFinished = String(matchId || '');

      if (maybeFinished) {
        const settleResult = await settleFanMatch(maybeFinished);
        if (settleResult) {
          toast('Fan Game poeni su obračunati.');
        }
      }

      return result;
    };

    wrapped.__fanSettleWrapped = true;
    window.finishAndSave = wrapped;

    if (window.medjasiV7 && typeof window.medjasiV7.finishAndSave === 'function') {
      window.medjasiV7.finishAndSave = wrapped;
    }
  }

  window.medjasiFanFixes = {
    settleFanMatch
  };

  wrapFinishHandler();
  window.addEventListener('load', () => setTimeout(wrapFinishHandler, 250), { once: true });
  setTimeout(wrapFinishHandler, 800);
})();
