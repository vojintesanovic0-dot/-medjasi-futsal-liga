/* =========================================================
   MEĐASI — oporavak lozinke: forma za novu lozinku
   Otvara se kad korisnik klikne link iz emaila za reset.
   Ne koristi nikakve podatke korisnika u HTML-u (sve je statički tekst).
========================================================= */
(() => {
  "use strict";
  if (window.__MEDJASI_PWD_RECOVERY__) return;
  window.__MEDJASI_PWD_RECOVERY__ = true;

  const MIN_LENGTH = 8;

  function client(){
    return typeof window.sbClient === "function" ? window.sbClient() : null;
  }

  function notify(message){
    if (typeof window.toast === "function") window.toast(message);
  }

  function injectStyles(){
    if (document.getElementById("pwdRecoveryStyles")) return;
    const style = document.createElement("style");
    style.id = "pwdRecoveryStyles";
    style.textContent = `
      #pwdRecoveryOverlay{position:fixed;inset:0;z-index:4000;display:grid;place-items:center;background:rgba(2,6,4,.75);padding:16px}
      #pwdRecoveryOverlay[hidden]{display:none}
      .pwd-recovery-card{width:min(420px,100%);background:#0b1812;color:#e8f3ec;border:1px solid rgba(183,255,85,.22);border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.5);font:15px/1.5 system-ui,Arial,sans-serif}
      .pwd-recovery-card h2{margin:0 0 6px;font-size:20px;color:#b7ff55}
      .pwd-recovery-card label{display:block;margin-top:12px;font-size:14px}
      .pwd-recovery-card input{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:11px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#050b08;color:#e8f3ec;font:inherit}
      .pwd-recovery-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
      .pwd-recovery-actions button{padding:10px 16px;border-radius:10px;border:0;font:inherit;cursor:pointer}
      #pwdRecoverySave{background:#b7ff55;color:#06120a;font-weight:700}
      #pwdRecoverySave:disabled{opacity:.6;cursor:default}
      #pwdRecoveryCancel{background:transparent;color:#e8f3ec;border:1px solid rgba(255,255,255,.2)}
      .pwd-recovery-msg{min-height:1.4em;margin:12px 0 0;font-size:14px;color:#9fb3a6}
      .pwd-recovery-msg.is-error{color:#ff8a8a}
      .pwd-recovery-muted{color:#9fb3a6;font-size:14px;margin:0}
    `;
    document.head.appendChild(style);
  }

  function buildOverlay(){
    const existing = document.getElementById("pwdRecoveryOverlay");
    if (existing) return existing;

    injectStyles();
    const wrap = document.createElement("div");
    wrap.id = "pwdRecoveryOverlay";
    wrap.hidden = true;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "pwdRecoveryTitle");
    wrap.innerHTML = `
      <form class="pwd-recovery-card" id="pwdRecoveryForm" novalidate>
        <h2 id="pwdRecoveryTitle">Nova lozinka</h2>
        <p class="pwd-recovery-muted">Upiši novu lozinku za svoj nalog. Najmanje ${MIN_LENGTH} karaktera.</p>
        <label>Nova lozinka
          <input id="pwdNew" type="password" autocomplete="new-password" minlength="${MIN_LENGTH}" required>
        </label>
        <label>Ponovi lozinku
          <input id="pwdRepeat" type="password" autocomplete="new-password" minlength="${MIN_LENGTH}" required>
        </label>
        <p id="pwdRecoveryMsg" class="pwd-recovery-msg" role="status"></p>
        <div class="pwd-recovery-actions">
          <button type="button" id="pwdRecoveryCancel">Odustani</button>
          <button type="submit" id="pwdRecoverySave">Sačuvaj lozinku</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);

    const form = document.getElementById("pwdRecoveryForm");
    const msg = document.getElementById("pwdRecoveryMsg");
    const save = document.getElementById("pwdRecoverySave");
    const setMsg = (text, isError) => {
      msg.textContent = text;
      msg.classList.toggle("is-error", !!isError);
    };

    document.getElementById("pwdRecoveryCancel").addEventListener("click", close);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const first = document.getElementById("pwdNew").value;
      const second = document.getElementById("pwdRepeat").value;

      if (first.length < MIN_LENGTH) {
        setMsg(`Lozinka mora imati najmanje ${MIN_LENGTH} karaktera.`, true);
        return;
      }
      if (first !== second) {
        setMsg("Lozinke se ne podudaraju.", true);
        return;
      }

      const sb = client();
      if (!sb) {
        setMsg("Servis trenutno nije dostupan. Pokušaj ponovo za nekoliko minuta.", true);
        return;
      }

      save.disabled = true;
      setMsg("Čuvam novu lozinku...");
      try {
        const { error } = await sb.auth.updateUser({ password: first });
        if (error) throw error;
        setMsg("Lozinka je promijenjena.");
        notify("Lozinka je promijenjena.");
        setTimeout(close, 1200);
      } catch (error) {
        console.error("Promjena lozinke nije uspjela:", error);
        setMsg(error?.message || "Lozinka nije promijenjena. Pokušaj ponovo.", true);
      } finally {
        save.disabled = false;
      }
    });

    return wrap;
  }

  function open(){
    const overlay = buildOverlay();
    overlay.hidden = false;
    setTimeout(() => document.getElementById("pwdNew")?.focus(), 0);
  }

  function close(){
    const overlay = document.getElementById("pwdRecoveryOverlay");
    if (overlay) overlay.hidden = true;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }

  function isRecoveryUrl(){
    return /(^|[#&?])type=recovery(&|$)/.test(location.hash) ||
           /(^|[&?])type=recovery(&|$)/.test(location.search);
  }

  function attach(){
    const sb = client();
    if (!sb || !sb.auth || typeof sb.auth.onAuthStateChange !== "function") return false;

    sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") open();
    });

    if (isRecoveryUrl() && typeof sb.auth.getSession === "function") {
      sb.auth.getSession().then(({ data }) => {
        if (data && data.session) open();
      }).catch(error => console.error("Provjera recovery sesije nije uspjela:", error));
    }
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (attach() || tries > 100) clearInterval(timer);
  }, 200);
})();
