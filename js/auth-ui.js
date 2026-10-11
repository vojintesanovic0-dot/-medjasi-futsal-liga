/* Auth form UX layer — preserves Supabase auth handlers in app.js. */
(function(){
 "use strict";
 const byId=id=>document.getElementById(id);
 const section=()=>byId("login");
 const modeButtons=()=>Array.from(document.querySelectorAll("#login [role='tab'][data-auth-mode]"));
 const modePanels=()=>Array.from(document.querySelectorAll("#login [data-auth-panel]"));
 function setAuthMode(nextMode,focusId){
  const mode=nextMode==="register"?"register":"login";
  const root=section();
  if(!root)return false;
  root.dataset.authMode=mode;
  modeButtons().forEach(button=>{
   const selected=button.dataset.authMode===mode;
   button.setAttribute("aria-selected",String(selected));
   button.tabIndex=selected?0:-1;
   button.classList.toggle("is-active",selected);
  });
  modePanels().forEach(panel=>{panel.hidden=panel.dataset.authPanel!==mode;});
  const title=byId("authPageTitle"),description=byId("authPageDescription");
  if(title)title.textContent=mode==="register"?"Pridruži se Međasi zajednici":"Prijavi se i nastavi";
  if(description)description.textContent=mode==="register"
   ?"Napravi nalog za profil, razgovore, komentare i Fan Game."
   :"Tvoj nalog na jednom mjestu — profil, zajednica i dešavanja u ligi.";
  modePanels().filter(panel=>panel.hidden).forEach(panel=>{
   panel.querySelectorAll("[data-auth-password-toggle]").forEach(button=>{
    const input=byId(button.dataset.authPasswordToggle);
    if(input)input.type="password";
    button.setAttribute("aria-pressed","false");
    button.setAttribute("aria-label","Prikaži lozinku");
    button.title="Prikaži lozinku";
   });
  });
  if(focusId){
   const target=byId(focusId);
   if(target)window.setTimeout(()=>{
    target.focus({preventScroll:true});
    target.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"});
   },0);
  }
  return true;
 }
 window.setAuthMode=setAuthMode;

 function localizeMessage(node){
  if(!node)return;
  const original=String(node.textContent||"").trim(),value=original.toLocaleLowerCase("en");
  if(!value)return;
  const maps=[
   [/invalid login credentials|invalid email or password|email or password is incorrect/,"Email ili lozinka nisu ispravni. Provjeri podatke i pokušaj ponovo."],
   [/user already registered|user already exists|already been registered|email address already in use/,"Nalog s ovom email adresom već postoji. Prijavi se ili iskoristi opciju za obnovu lozinke."],
   [/email not confirmed|email address is not confirmed/,"Email još nije potvrđen. Otvori poruku koju smo ti poslali i potvrdi nalog."],
   [/password should be at least|password must be at least/,"Lozinka mora imati najmanje 6 znakova."],
   [/unable to validate email address|invalid email|email address is invalid/,"Provjeri da li je email adresa pravilno unesena."],
   [/failed to fetch|fetch failed|network request failed|networkerror|timed out|timeout/,"Servis trenutno ne odgovara. Provjeri internet vezu i pokušaj ponovo."],
   [/rate limit|too many requests|too many attempts/,"Previše pokušaja u kratkom vremenu. Sačekaj malo pa pokušaj ponovo."],
   [/signup is disabled|signups not allowed|sign up is disabled/,"Registracija je trenutno isključena. Pokušaj ponovo kasnije."]
  ];
  const match=maps.find(([pattern])=>pattern.test(value));
  if(match&&match[1]!==original)node.textContent=match[1];
 }
 const stateFromMessage=message=>{
  const v=String(message||"").trim().toLocaleLowerCase("bs");
  if(!v)return "";
  if(/uspješn|poslali smo|potvrda je posl|provjeri email|nova potvrda|link za promjenu lozinke je poslat/.test(v))return "success";
  if(/nije uspj|nedostup|grešk|mora imati|ne podudar|unesi |prvo upiši|nije potvrđen|nije potvrđena|pokušaj ponovo kasnije|ne odgovara|previše pokušaja|već postoji|nisu isprav|provjeri da li/.test(v))return "error";
  if(/prijavljivanj|kreiranje naloga|šaljem|slanje linka|šaljem novu potvrdu/.test(v))return "pending";
  return "info";
 };
 ["loginMessage","registerMessage"].forEach(id=>{
  const node=byId(id);
  if(!node)return;
  new MutationObserver(()=>{
   localizeMessage(node);
   const state=stateFromMessage(node.textContent||"");
   if(state)node.dataset.state=state;else delete node.dataset.state;
  }).observe(node,{subtree:true,childList:true,characterData:true});
 });

 document.addEventListener("click",event=>{
  const modeTrigger=event.target.closest("[data-auth-mode]");
  if(modeTrigger){setAuthMode(modeTrigger.dataset.authMode,modeTrigger.dataset.authFocusTarget||"");return;}
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
  const oldFocusTrigger=event.target.closest("[data-auth-focus]");
  if(oldFocusTrigger){
   const focusId=oldFocusTrigger.dataset.authFocus;
   setAuthMode(focusId.startsWith("register")?"register":"login",focusId);
  }
 });
 document.addEventListener("keydown",event=>{
  const tab=event.target.closest("#login .auth-mode-switch [role='tab']");
  if(!tab)return;
  let mode=null;
  if(event.key==="ArrowRight"||event.key==="ArrowLeft"){event.preventDefault();mode=tab.dataset.authMode==="login"?"register":"login";}
  else if(event.key==="Home"){event.preventDefault();mode="login";}
  else if(event.key==="End"){event.preventDefault();mode="register";}
  if(mode){setAuthMode(mode);byId(mode==="register"?"authTabRegister":"authTabLogin")?.focus({preventScroll:true});}
 });

 const registerPassword=byId("registerPassword"),confirmPassword=byId("registerPasswordConfirm"),matchHint=byId("authPasswordMatchHint");
 const syncPasswordMatch=()=>{
  if(!confirmPassword||!registerPassword)return;
  const mismatch=!!confirmPassword.value&&registerPassword.value!==confirmPassword.value;
  confirmPassword.setCustomValidity(mismatch?"Lozinke se ne podudaraju.":"");
  if(matchHint){matchHint.textContent=mismatch?"Lozinke se ne podudaraju.":"Obje lozinke moraju biti iste.";matchHint.classList.toggle("is-mismatch",mismatch);}
 };
 registerPassword?.addEventListener("input",syncPasswordMatch);
 confirmPassword?.addEventListener("input",syncPasswordMatch);

 function bindForm(formId,methodName,buttonId,busyLabel,defaultLabel,messageId){
  const form=byId(formId);
  if(!form||form.dataset.authBound==="1")return;
  form.dataset.authBound="1";
  let pending=false;
  form.addEventListener("submit",async event=>{
   event.preventDefault();
   if(pending)return;
   syncPasswordMatch();
   if(!form.reportValidity())return;
   const method=window[methodName],button=byId(buttonId),message=byId(messageId);
   if(typeof method!=="function"){if(message)message.textContent="Servis prijave nije pravilno učitan. Osvježi stranicu i pokušaj ponovo.";return;}
   pending=true;form.setAttribute("aria-busy","true");
   if(button){button.disabled=true;button.setAttribute("aria-busy","true");button.textContent=busyLabel;}
   try{
    // login() has its own busy guard; let its handler begin, then it disables itself.
    if(buttonId==="loginSubmitButton"&&button)button.disabled=false;
    const result=method();
    await result;
   }catch(error){
    console.error("Greška u formi za "+(methodName==="login"?"prijavu":"registraciju")+":",error);
    if(message)message.textContent=error&&error.message?error.message:"Zahtjev nije uspio zbog greške. Pokušaj ponovo.";
   }finally{
    pending=false;form.removeAttribute("aria-busy");
    if(button){button.disabled=false;button.removeAttribute("aria-busy");button.textContent=defaultLabel;}
   }
  });
 }
 bindForm("loginForm","login","loginSubmitButton","Prijavljivanje…","Prijavi se","loginMessage");
 bindForm("registerForm","register","registerSubmitButton","Kreiranje naloga…","Kreiraj nalog","registerMessage");
 setAuthMode(section()?.dataset.authMode||"login");
})();
