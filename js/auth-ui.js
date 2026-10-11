/* Authentication form interaction layer.
   Preserve app.js Supabase logic while restoring browser validation,
   consistent Enter-key submission, and duplicate-submit protection. */
(function(){
  "use strict";
  const byId=id=>document.getElementById(id);
  const stateFromMessage=message=>{
    const value=String(message||"").trim().toLocaleLowerCase("bs");
    if(!value)return "";
    if(/uspješn|poslali smo|potvrda je posl|provjeri email|nova potvrda/.test(value))return "success";
    if(/nije uspj|nedostup|grešk|mora imati|ne podudar|unesi |prvo upiši|nije potvrđen|nije potvrđena|pokušaj ponovo kasnije/.test(value))return "error";
    if(/prijavljivanj|kreiranje naloga|šaljem|slanje linka|šaljem novu potvrdu/.test(value))return "pending";
    return "info";
  };
  const updateMessageState=node=>{
    if(!node)return;
    const state=stateFromMessage(node.textContent||"");
    if(state)node.dataset.state=state;
    else delete node.dataset.state;
  };
  ["loginMessage","registerMessage"].forEach(id=>{
    const node=byId(id);
    if(!node)return;
    new MutationObserver(()=>updateMessageState(node)).observe(node,{subtree:true,childList:true,characterData:true});
    updateMessageState(node);
  });
  document.addEventListener("click",event=>{
    const toggle=event.target.closest("[data-auth-password-toggle]");
    if(toggle){
      const input=byId(toggle.dataset.authPasswordToggle);
      if(!input)return;
      const reveal=input.type==="password";
      input.type=reveal?"text":"password";
      toggle.setAttribute("aria-pressed",String(reveal));
      toggle.setAttribute("aria-label",reveal?"Sakrij lozinku":"Prikaži lozinku");
      toggle.title=reveal?"Sakrij lozinku":"Prikaži lozinku";
      input.focus({preventScroll:true});
      return;
    }
    const focusButton=event.target.closest("[data-auth-focus]");
    if(focusButton){
      const target=byId(focusButton.dataset.authFocus);
      if(!target)return;
      target.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
      target.focus({preventScroll:true});
    }
  });
  function bindForm(formId,methodName,buttonId,busyLabel,defaultLabel,messageId){
    const form=byId(formId);
    if(!form||form.dataset.authBound==="1")return;
    form.dataset.authBound="1";
    let pending=false;
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(pending)return;
      if(!form.reportValidity())return;
      const method=window[methodName];
      const button=byId(buttonId);
      const message=byId(messageId);
      if(typeof method!=="function"){
        if(message)message.textContent="Servis prijave nije pravilno učitan. Osvježi stranicu i pokušaj ponovo.";
        return;
      }
      pending=true;
      form.setAttribute("aria-busy","true");
      try{
        // Invoke first: login() manages its own disabled state and ignores
        // calls when the login button is already disabled.
        const result=method();
        if(button){
          button.disabled=true;
          button.setAttribute("aria-busy","true");
          button.textContent=busyLabel;
        }
        await result;
      }catch(error){
        console.error("Greška u formi za "+(methodName==="login"?"prijavu":"registraciju")+":",error);
        if(message)message.textContent=error&&error.message?error.message:"Zahtjev nije uspio zbog greške. Pokušaj ponovo.";
      }finally{
        pending=false;
        form.removeAttribute("aria-busy");
        if(button){
          button.disabled=false;
          button.removeAttribute("aria-busy");
          button.textContent=defaultLabel;
        }
      }
    });
  }
  bindForm("loginForm","login","loginSubmitButton","Prijavljivanje…","Prijavi se","loginMessage");
  bindForm("registerForm","register","registerSubmitButton","Kreiranje naloga…","Registruj se","registerMessage");
})();
