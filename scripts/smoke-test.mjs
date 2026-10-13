import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { chromium } from "playwright";

const root=resolve(process.cwd());
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon",".woff2":"font/woff2"};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://127.0.0.1");
    let pathname=decodeURIComponent(url.pathname);
    if(pathname==="/")pathname="/index.html";
    const file=resolve(root,"."+pathname);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end("Forbidden");return;}
    const body=await readFile(file);
    res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream","cache-control":"no-store"});
    res.end(body);
  }catch{res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");}
});
await new Promise(done=>server.listen(4173,"127.0.0.1",done));
const base="http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1365,height:900},serviceWorkers:"block"});
const pageErrors=[];
const missingAssets=[];
const browserConsoleErrors=[];
const failedRequests=[];
const failedResponses=[];
let suppressLiveRest=false;
let suppressedLiveRestCount=0;
page.on("pageerror",error=>pageErrors.push(error.stack||error.message));
page.on("console",message=>{if(message.type()==="error")browserConsoleErrors.push(message.text());});
page.on("requestfailed",request=>failedRequests.push(request.url()+" :: "+(request.failure()?.errorText||"request failed")));
page.on("response",response=>{if(/supabase\.co|cdn\.jsdelivr\.net|unpkg\.com/.test(response.url())&&response.status()>=400)failedResponses.push(response.status()+" "+response.url());});
page.on("response",response=>{if(response.url().startsWith(base)&&response.status()>=400)missingAssets.push(response.status()+" "+response.url());});
await page.route(/https:\/\/[^/]+\.supabase\.co\/rest\/v1\//,async route=>{
  if(!suppressLiveRest){await route.continue();return;}
  suppressedLiveRestCount++;
  await route.fulfill({
    status:503,
    contentType:"application/json",
    body:JSON.stringify({code:"PGRST002",details:null,hint:null,message:"Smoke test stopped extra REST traffic after detecting a live API outage."})
  });
});
async function navButton(target){
  const index=await page.locator("#mainNav button").evaluateAll((buttons,id)=>buttons.findIndex(b=>{
    const handler=b.getAttribute("onclick")||"";
    return id==="game" ? (handler.includes("dashboardOpenGameTab('matches')") || handler.includes("showSection('game')") ) : handler.includes("showSection('"+id+"')");
  }),target);
  assert.notEqual(index,-1,"Missing navigation button for "+target);
  const button=page.locator("#mainNav button").nth(index);
  const geometry=await button.evaluate(el=>{
    const r=el.getBoundingClientRect(),nav=document.querySelector("#mainNav"),n=nav?.getBoundingClientRect(),sidebar=document.querySelector(".app-sidebar"),sb=sidebar?.getBoundingClientRect();
    return {button:{x:r.x,y:r.y,width:r.width,height:r.height},nav:n?{x:n.x,y:n.y,width:n.width,height:n.height}:null,sidebar:sb?{x:sb.x,y:sb.y,width:sb.width,height:sb.height}:null,viewport:{width:innerWidth,height:innerHeight},display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility};
  });
  const v=page.viewportSize();
  const b=geometry.button;
  assert.ok(b.width>0&&b.height>0&&b.x+b.width>0&&b.x<v.width&&b.y+b.height>0&&b.y<v.height,"Navigation target "+target+" is outside viewport: "+JSON.stringify(geometry));
  return button;
}
async function clickSection(target){
  await (await navButton(target)).click({timeout:8000});
  await page.waitForFunction(id=>!!document.querySelector("#"+id+".section.active"),target,{timeout:8000});
}
try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#mainNav button").first().waitFor({timeout:10000});
  await page.locator("#game.section").waitFor({state:"attached",timeout:15000});
  try{
    await page.waitForFunction(()=>{
      const teams=Number(document.getElementById("statTeams")?.textContent?.trim()||0);
      const players=Number(document.getElementById("statPlayers")?.textContent?.trim()||0);
      const status=document.getElementById("mflDataStatus");
      return (teams>=3&&players>=12&&(!status||status.hidden))||(!!status&&!status.hidden);
    },null,{timeout:30000});
  }catch(error){
    const snapshot=await page.evaluate(()=>({teams:document.getElementById("statTeams")?.textContent,players:document.getElementById("statPlayers")?.textContent,matches:document.getElementById("statMatches")?.textContent,status:document.getElementById("mflDataStatus")?.textContent,supabaseSdk:typeof window.supabase?.createClient,supabaseClient:!!window.supabaseClient?.from}));
    console.log("LIVE DATA LOAD DIAGNOSTIC:",JSON.stringify({snapshot,browserConsoleErrors,failedRequests,failedResponses}));
    throw error;
  }
  const loadedCounts=await page.evaluate(()=>({teams:Number(document.getElementById("statTeams")?.textContent?.trim()||0),players:Number(document.getElementById("statPlayers")?.textContent?.trim()||0),matches:Number(document.getElementById("statMatches")?.textContent?.trim()||0),dataWarning:!!document.getElementById("mflDataStatus")&&!document.getElementById("mflDataStatus").hidden}));
  console.log("Live league data loaded:",JSON.stringify(loadedCounts));
  const desktopLayout=await page.evaluate(()=>{
    const viewport=innerWidth;
    const visiblePhonePreviews=[...document.querySelectorAll(".dashboard-phone-rail")].filter(el=>{
      const style=getComputedStyle(el),rect=el.getBoundingClientRect();
      return style.display!=="none"&&style.visibility!=="hidden"&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0;
    }).length;
    const sidebar=document.getElementById("appSidebar");
    const sidebarRect=sidebar?.getBoundingClientRect();
    return {
      viewport,
      documentWidth:document.documentElement.scrollWidth,
      bodyWidth:document.body.scrollWidth,
      visiblePhonePreviews,
      sidebarWidth:sidebarRect?.width||0,
      sidebarVisible:!!sidebar&&getComputedStyle(sidebar).display!=="none"&&(sidebarRect?.width||0)>0
    };
  });
  assert.ok(desktopLayout.documentWidth<=desktopLayout.viewport+2&&desktopLayout.bodyWidth<=desktopLayout.viewport+2,"Horizontal overflow on desktop: "+JSON.stringify(desktopLayout));
  assert.equal(desktopLayout.visiblePhonePreviews,0,"The mobile phone mockup must not occupy the desktop layout: "+JSON.stringify(desktopLayout));
  assert.ok(desktopLayout.sidebarVisible&&desktopLayout.sidebarWidth>0,"The desktop navigation sidebar must be visible: "+JSON.stringify(desktopLayout));
  console.log("PASS desktop layout:",JSON.stringify(desktopLayout));
  if(loadedCounts.dataWarning){
    // The initial live bootstrap already established the outage; do not amplify it while exercising UI navigation.
    suppressLiveRest=true;
    const warningText=await page.locator("#mflDataStatus").textContent();
    assert.ok(/Podaci lige|Osvježavanje podataka/i.test(warningText||""),"A data failure must be explained to visitors.");
    assert.ok(await page.locator("#mflDataStatus button").count()>0,"The data warning must provide a retry action.");
    console.log("WARN live Supabase data is unavailable; clear retry state is visible:",JSON.stringify({warning:warningText,browserConsoleErrors,failedResponses:failedResponses.slice(0,8)}));
  }else{
    assert.ok(loadedCounts.teams>=3&&loadedCounts.players>=12,"Live league data should load before the site is considered healthy.");
  }
  for(const id of ["home","matches","table","teams","players","stats","gallery","community","chat","news","game","info"])await clickSection(id);
  await page.locator("#headerAccount button").filter({hasText:"Prijava"}).first().click();
  await page.waitForFunction(()=>!!document.querySelector("#login.section.active"),null,{timeout:5000});
  assert.equal(await page.locator("#loginForm").count(),1,"Login form must be a real HTML form.");
  assert.equal(await page.locator("#registerForm").count(),1,"Registration form must be a real HTML form.");
  assert.equal(await page.locator("#registerPanel").isHidden(),true,"Registration must not clutter the initial login view.");
  assert.equal(await page.locator("#authTabLogin").getAttribute("aria-selected"),"true");
  const loginValidity=await page.locator("#loginForm").evaluate(form=>{
    const email=form.querySelector("#loginEmail");
    return {valid:form.checkValidity(),required:email.required,typeMismatch:email.validity.typeMismatch};
  });
  assert.equal(loginValidity.valid,false,"An empty login form must fail native browser validation.");
  assert.equal(loginValidity.required,true,"Login email must be required.");
  await page.locator("#loginEmail").fill("nije-email");
  assert.equal(await page.locator("#loginEmail").evaluate(input=>input.validity.typeMismatch),true,"A malformed email must fail browser input validation.");
  await page.locator("#loginEmail").fill("");
  const passwordToggle=page.locator('[data-auth-password-toggle="loginPassword"]');
  assert.equal(await page.locator("#loginPassword").getAttribute("type"),"password");
  await passwordToggle.click();
  assert.equal(await page.locator("#loginPassword").getAttribute("type"),"text","Password visibility toggle must reveal the password.");
  assert.equal(await passwordToggle.getAttribute("aria-pressed"),"true");
  await passwordToggle.click();
  assert.equal(await page.locator("#loginPassword").getAttribute("type"),"password","Password visibility toggle must hide the password again.");
  await page.locator("#authTabRegister").click();
  await page.waitForFunction(()=>document.querySelector("#registerPanel")?.hidden===false);
  assert.equal(await page.locator("#authTabRegister").getAttribute("aria-selected"),"true","Register tab must be selected.");
  assert.equal(await page.locator("#loginPanel").isHidden(),true,"Login panel must hide when registration is selected.");
  await page.locator("#registerPassword").fill("abcdef");
  await page.locator("#registerPasswordConfirm").fill("abcdee");
  assert.equal(await page.locator("#registerPasswordConfirm").evaluate(input=>input.validity.customError),true,"Mismatching passwords should be caught before submit.");
  await page.locator("#registerPasswordConfirm").fill("abcdef");
  assert.equal(await page.locator("#registerPasswordConfirm").evaluate(input=>input.validity.customError),false,"Matching passwords should clear the validation error.");
  const registrationToggle=page.locator('[data-auth-password-toggle="registerPassword"]');
  await registrationToggle.click();
  assert.equal(await page.locator("#registerPassword").getAttribute("type"),"text","Registration password visibility toggle must work.");
  await page.locator("#authTabLogin").click();
  assert.equal(await page.locator("#registerPassword").getAttribute("type"),"password","Switching modes must conceal any revealed password.");
  await page.locator("#authTabRegister").click();
  await page.waitForFunction(()=>document.querySelector("#registerPanel")?.hidden===false);
  await page.locator("#registerUsername").fill("Mëđasi_Fan!");
  await page.locator("#registerEmail").fill("signup-smoke@example.com");
  await page.locator("#registerPassword").fill("abcdef");
  await page.locator("#registerPasswordConfirm").fill("abcdef");
  await page.evaluate(async()=>{
    const client=window.supabaseClient;
    if(!client?.auth||typeof client.from!=="function")throw new Error("Supabase client unavailable for isolated signup smoke test");
    window.__signupTestOriginals={
      from:client.from,
      fromOwn:Object.prototype.hasOwnProperty.call(client,"from"),
      signUp:client.auth.signUp,
      signUpOwn:Object.prototype.hasOwnProperty.call(client.auth,"signUp")
    };
    client.from=function(table){
      window.__signupTestLookup={table};
      const builder={
        select(columns){window.__signupTestLookup.columns=columns;return this;},
        ilike(column,pattern){window.__signupTestLookup.column=column;window.__signupTestLookup.pattern=pattern;return this;},
        limit(value){window.__signupTestLookup.limit=value;return this;},
        maybeSingle(){return this;},
        abortSignal(){return this;},
        then(resolve,reject){return Promise.resolve({data:null,error:null}).then(resolve,reject);}
      };
      return builder;
    };
    client.auth.signUp=async options=>{
      window.__signupTestPayload={email:options.email,username:options.options?.data?.username};
      return {data:{user:null,session:null},error:{message:"SMOKE_TEST_SIGNUP_INTERCEPTED"}};
    };
    let result;
    try{
      await window.register();
      result={
        message:document.getElementById("registerMessage")?.textContent||"",
        username:document.getElementById("registerUsername")?.value||"",
        lookup:window.__signupTestLookup,
        payload:window.__signupTestPayload
      };
    }finally{
      if(window.__signupTestOriginals){
        if(window.__signupTestOriginals.fromOwn)client.from=window.__signupTestOriginals.from;
        else delete client.from;
        if(window.__signupTestOriginals.signUpOwn)client.auth.signUp=window.__signupTestOriginals.signUp;
        else delete client.auth.signUp;
      }
      delete window.__signupTestOriginals;
    }
    return result;
  });
  const signupProbe=await page.evaluate(()=>({
    message:document.getElementById("registerMessage")?.textContent||"",
    username:document.getElementById("registerUsername")?.value||"",
    lookup:window.__signupTestLookup,
    payload:window.__signupTestPayload
  }));
  assert.equal(signupProbe.message,"SMOKE_TEST_SIGNUP_INTERCEPTED","The isolated signup test must stop before creating a real account.");
  assert.equal(signupProbe.username,"Mëđasi_Fan","Signup must normalize invalid characters before profile lookup.");
  assert.equal(signupProbe.payload?.username,"Mëđasi_Fan","Supabase Auth must receive the normalized username.");
  assert.equal(signupProbe.lookup?.table,"profiles");
  assert.equal(signupProbe.lookup?.column,"username");
  assert.equal(signupProbe.lookup?.pattern,"Mëđasi\\_Fan","Username lookup must escape underscores as literal characters.");
  console.log("PASS signup username normalization and case-insensitive availability check");
  await page.locator("#authTabLogin").click();
  await page.locator("#loginEmail").fill("reset-smoke@example.com");
  await page.evaluate(async()=>{
    const client=window.supabaseClient;
    if(!client?.auth||typeof client.auth.resetPasswordForEmail!=="function")throw new Error("Password reset API unavailable for isolated smoke test");
    const hadOwn=Object.prototype.hasOwnProperty.call(client.auth,"resetPasswordForEmail");
    const original=client.auth.resetPasswordForEmail;
    client.auth.resetPasswordForEmail=async(email,options)=>{
      window.__resetPasswordProbe={email,redirectTo:options?.redirectTo};
      return {error:null};
    };
    try{
      await window.resetPassword();
    }finally{
      if(hadOwn)client.auth.resetPasswordForEmail=original;
      else delete client.auth.resetPasswordForEmail;
    }
  });
  const resetProbe=await page.evaluate(()=>({
    message:document.getElementById("loginMessage")?.textContent||"",
    request:window.__resetPasswordProbe,
    expectedRedirect:window.location.origin+window.location.pathname
  }));
  assert.equal(resetProbe.request?.email,"reset-smoke@example.com","Password reset must use the email entered by the user.");
  assert.equal(resetProbe.request?.redirectTo,resetProbe.expectedRedirect,"Password reset must return users to this site.");
  assert.equal(resetProbe.message,"Ako nalog postoji, link za promjenu lozinke je poslat na email.","Password reset must confirm the request without revealing whether the account exists.");
  console.log("PASS password reset uses the entered email and safe redirect without sending a real email");
  await page.evaluate(()=>{delete window.__resetPasswordProbe;});
  await page.locator("#loginEmail").fill("login-smoke@example.com");
  await page.locator("#loginPassword").fill("smoke-pass");
  const loginLogoutProbe=await page.evaluate(async()=>{
    const client=window.supabaseClient;
    if(!client?.auth||typeof client.auth.signInWithPassword!=="function"||typeof client.auth.signOut!=="function"||typeof client.auth.getSession!=="function")throw new Error("Supabase Auth unavailable for isolated login smoke test");
    const saved={
      signIn:client.auth.signInWithPassword,
      signInOwn:Object.prototype.hasOwnProperty.call(client.auth,"signInWithPassword"),
      signOut:client.auth.signOut,
      signOutOwn:Object.prototype.hasOwnProperty.call(client.auth,"signOut"),
      getSession:client.auth.getSession,
      getSessionOwn:Object.prototype.hasOwnProperty.call(client.auth,"getSession"),
      from:client.from,
      fromOwn:Object.prototype.hasOwnProperty.call(client,"from"),
      rpc:client.rpc,
      rpcOwn:Object.prototype.hasOwnProperty.call(client,"rpc"),
      game:window.medjasiGame,
      gameRefresh:window.medjasiGame?.refresh
    };
    window.__loginSmoke={email:"login-smoke@example.com",getSessionCalled:false,profileLookupCalled:false,rpcCalls:[],gameRefreshCalled:false};
    const fakeUser={id:"11111111-2222-4333-8444-555555555555",email:"login-smoke@example.com",user_metadata:{username:"SmokeFan"}};
    client.auth.signInWithPassword=async({email,password})=>{
      window.__loginSmoke.email=email;
      window.__loginSmoke.password=password;
      return {data:{user:fakeUser,session:{access_token:"smoke-token",user:fakeUser}},error:null};
    };
    client.auth.getSession=async()=>{
      window.__loginSmoke.getSessionCalled=true;
      return {data:{session:{access_token:"smoke-token",user:fakeUser}},error:null};
    };
    client.auth.signOut=async()=>({error:null});
    client.from=function(table,...args){
      if(table!=="profiles")return saved.from.call(this,table,...args);
      window.__loginSmoke.profileLookupCalled=true;
      const builder={
        select(){return this;},
        eq(){return this;},
        maybeSingle(){return this;},
        abortSignal(){return this;},
        then(resolve,reject){return Promise.resolve({data:{id:fakeUser.id,username:"SmokeFan",role:"user"},error:null}).then(resolve,reject);}
      };
      return builder;
    };
    client.rpc=function(name,...args){
      window.__loginSmoke.rpcCalls.push(name);
      return saved.rpc.call(this,name,...args);
    };
    if(window.medjasiGame)window.medjasiGame.refresh=()=>{window.__loginSmoke.gameRefreshCalled=true;};
    else window.medjasiGame={refresh(){window.__loginSmoke.gameRefreshCalled=true;}};
    try{
      await window.login();
      await new Promise(resolve=>setTimeout(resolve,80));
      const loginState={
        homeActive:!!document.querySelector("#home.section.active"),
        accountText:document.querySelector("#headerAccount .v13-auth-copy strong")?.textContent||"",
        currentUser:window.currentUser?{id:window.currentUser.id,email:window.currentUser.email,username:window.currentUser.user_metadata?.username}:null,
        currentProfile:window.currentProfile?{id:window.currentProfile.id,username:window.currentProfile.username,role:window.currentProfile.role}:null,
        accountHtml:document.getElementById("headerAccount")?.innerHTML||"",
        loginButtonDisabled:document.getElementById("loginSubmitButton")?.disabled,
        ...window.__loginSmoke
      };
      await window.logout();
      await new Promise(resolve=>setTimeout(resolve,80));
      const logoutState={
        homeActive:!!document.querySelector("#home.section.active"),
        loginButtonText:document.querySelector("#headerAccount button")?.textContent||"",
        profileButtonCount:document.querySelectorAll("#headerAccount .v13-auth-main").length
      };
      return {loginState,logoutState};
    }finally{
      if(saved.signInOwn)client.auth.signInWithPassword=saved.signIn;else delete client.auth.signInWithPassword;
      if(saved.signOutOwn)client.auth.signOut=saved.signOut;else delete client.auth.signOut;
      if(saved.getSessionOwn)client.auth.getSession=saved.getSession;else delete client.auth.getSession;
      if(saved.fromOwn)client.from=saved.from;else delete client.from;
      if(saved.rpcOwn)client.rpc=saved.rpc;else delete client.rpc;
      if(saved.game){window.medjasiGame=saved.game;if(saved.gameRefresh)window.medjasiGame.refresh=saved.gameRefresh;else delete window.medjasiGame.refresh;}else delete window.medjasiGame;
      delete window.__loginSmoke;
    }
  });
  assert.equal(loginLogoutProbe.loginState.homeActive,true,"Successful login must return to the homepage.");
  assert.ok(loginLogoutProbe.loginState.accountText.includes("SmokeFan"),"Successful login must visibly update the account header.");
  assert.equal(loginLogoutProbe.loginState.getSessionCalled,true,"Login must validate the active Supabase session.");
  assert.equal(loginLogoutProbe.loginState.profileLookupCalled,true,"Login must load the user's profile.");
  assert.ok(loginLogoutProbe.loginState.rpcCalls.includes("get_league_snapshot"),"Login must request the league snapshot.");
  assert.equal(loginLogoutProbe.loginState.gameRefreshCalled,true,"Login must refresh Fan Game state.");
  assert.equal(loginLogoutProbe.loginState.loginButtonDisabled,false,"Login submit must be re-enabled after success.");
  assert.equal(loginLogoutProbe.logoutState.homeActive,true,"Logout must return to the homepage.");
  assert.ok(loginLogoutProbe.logoutState.loginButtonText.includes("Prijava"),"Logout must restore the logged-out header.");
  assert.equal(loginLogoutProbe.logoutState.profileButtonCount,0,"Logout must remove the authenticated profile button.");
  console.log("PASS isolated login/logout updates the account header and returns home without a real session");
  await page.evaluate(()=>window.showSection("login"));
  await page.waitForFunction(()=>!!document.querySelector("#login.section.active"),null,{timeout:5000});
  await page.locator("#loginEmail").fill("");
  await page.locator("#loginPassword").fill("");
  await page.locator('[data-auth-mode="register"][data-auth-focus-target="registerUsername"]').click();
  await page.waitForFunction(()=>document.activeElement?.id==="registerUsername",null,{timeout:3000});
  await page.locator('[data-auth-mode="login"][data-auth-focus-target="loginEmail"]').click();
  await page.waitForFunction(()=>document.activeElement?.id==="loginEmail",null,{timeout:3000});
  await page.locator(".auth-return-btn").click();
  await page.waitForFunction(()=>!!document.querySelector("#home.section.active"),null,{timeout:5000});
  await page.locator("#headerAccount button").filter({hasText:"Registracija"}).first().click();
  await page.waitForFunction(()=>!!document.querySelector("#login.section.active")&&document.querySelector("#registerPanel")?.hidden===false,null,{timeout:5000});
  await page.locator(".auth-return-btn").click();
  await page.waitForFunction(()=>!!document.querySelector("#home.section.active"),null,{timeout:5000});
  await page.setViewportSize({width:900,height:900});
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  const tabletMenu=page.locator("#mobileMenuBtn");
  await tabletMenu.waitFor({state:"visible",timeout:10000});
  await tabletMenu.click();
  await page.waitForFunction(()=>document.getElementById("mainNav")?.classList.contains("mobile-open"),null,{timeout:3000});
  await tabletMenu.click();
  await page.waitForFunction(()=>!document.getElementById("mainNav")?.classList.contains("mobile-open"),null,{timeout:3000});
  console.log("PASS tablet header menu remains available and opens/closes correctly");

  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#mobileMenuBtn").waitFor({state:"attached",timeout:10000});
  await page.locator("#game.section").waitFor({state:"attached",timeout:15000});
  const mobileWidth=await page.evaluate(()=>({
    viewport:innerWidth,
    document:document.documentElement.scrollWidth,
    body:document.body.scrollWidth,
    topMenuVisible:!!document.querySelector("#mobileMenuBtn")&&getComputedStyle(document.querySelector("#mobileMenuBtn")).display!=="none"
  }));
  assert.ok(mobileWidth.document<=mobileWidth.viewport+2&&mobileWidth.body<=mobileWidth.viewport+2,"Horizontal overflow on mobile: "+JSON.stringify(mobileWidth));
  assert.equal(mobileWidth.topMenuVisible,false,"The duplicate top hamburger must be hidden on mobile; bottom navigation and More drawer are the mobile navigation.");

  // The global modal must have a visible, accessible close control on mobile.
  await page.evaluate(()=>document.getElementById("modal")?.classList.add("active"));
  const modalClose=page.locator("#modal .modal-box > button.close");
  await modalClose.waitFor({state:"visible",timeout:3000});
  assert.equal(await modalClose.getAttribute("aria-label"),"Zatvori prozor","Modal close control must have an accessible label.");
  await modalClose.click();
  await page.waitForFunction(()=>!document.getElementById("modal")?.classList.contains("active"),null,{timeout:3000});
  console.log("PASS mobile modal has a visible accessible close control and dismisses correctly");

  // Exercise the complete More drawer without touching real user data.
  await page.locator("#mobileMoreBtn").click();
  await page.waitForFunction(()=>document.querySelector("#mobileMoreDrawer")?.classList.contains("open"),null,{timeout:5000});
  assert.equal(await page.locator("#mobileMoreBtn").getAttribute("aria-expanded"),"true");
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>!document.querySelector("#mobileMoreDrawer")?.classList.contains("open"),null,{timeout:5000});
  assert.equal(await page.locator("#mobileMoreBtn").getAttribute("aria-expanded"),"false");

  await page.locator("#mobileMoreBtn").click();
  await page.waitForFunction(()=>document.querySelector("#mobileMoreDrawer")?.classList.contains("open"),null,{timeout:5000});
  await page.locator("#mobileMoreDrawer .mobile-more-backdrop").click({position:{x:5,y:5}});
  await page.waitForFunction(()=>!document.querySelector("#mobileMoreDrawer")?.classList.contains("open"),null,{timeout:5000});

  const mobileRoutes=[
    ["home","Početna"],["matches","Utakmice"],["table","Tabela"],["teams","Ekipe"],
    ["players","Igrači"],["stats","Statistika"],["gallery","Galerija"],["community","Community"],
    ["chat","Chat"],["news","Vijesti"],["game","Pogodi"],["info","Liga info"]
  ];
  for(const [sectionId,label] of mobileRoutes){
    await page.locator("#mobileMoreBtn").click();
    await page.locator(".mobile-more-grid button").filter({hasText:label}).first().click();
    await page.waitForFunction((id)=>document.querySelector("#"+id+".section")?.classList.contains("active"),sectionId,{timeout:7000});
    await page.waitForFunction(()=>!document.querySelector("#mobileMoreDrawer")?.classList.contains("open"),null,{timeout:5000});
  }
  console.log("PASS all 12 direct mobile More destinations route to their matching sections");

  await page.setViewportSize({width:320,height:740});
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#mobileMoreBtn").waitFor({state:"visible",timeout:10000});
  const narrowMobile=await page.evaluate(()=>{
    const visibleOverflow=[...document.querySelectorAll("body *")].map(el=>({el,rect:el.getBoundingClientRect()})).filter(({el,rect})=>{
      if(rect.width<=0||rect.height<=0||rect.bottom<=0||rect.top>=innerHeight||el.closest(".fx-bg")||el.closest('[aria-hidden="true"]'))return false;
      for(let node=el;node&&node!==document.documentElement;node=node.parentElement){
        const style=getComputedStyle(node);
        if(style.display==="none"||style.visibility==="hidden"||Number(style.opacity)===0)return false;
      }
      return rect.right>innerWidth+2||rect.left< -2;
    }).slice(0,20).map(({el,rect})=>({tag:el.tagName,id:el.id,classes:typeof el.className==="string"?el.className:"",text:(el.textContent||"").trim().replace(/\\s+/g," ").slice(0,70),right:Math.round(rect.right),left:Math.round(rect.left),width:Math.round(rect.width)}));
    return {viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,visibleOverflow};
  });
  assert.ok(narrowMobile.document<=narrowMobile.viewport+2&&narrowMobile.visibleOverflow.length===0,"Visible horizontal overflow on a narrow 320px phone: "+JSON.stringify(narrowMobile));
  await page.locator("#mobileMoreBtn").click();
  const narrowDrawerColumns=await page.locator(".mobile-more-grid").evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length);
  assert.equal(narrowDrawerColumns,1,"The More drawer must switch to a single column on very narrow phones.");
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>!document.querySelector("#mobileMoreDrawer")?.classList.contains("open"),null,{timeout:5000});
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#mobileMoreBtn").waitFor({state:"visible",timeout:10000});
  console.log("PASS narrow 320px mobile layout and single-column More drawer");

  const dashboardRoutes=[["shop","Fan Shop"],["fanbase","Fan Base"],["mine","Moji tiketi"],["live","Live centar"],["board","Nagrade i poredak"],["collection","Kolekcija"],["club","Moja tribina"],["mvp","MVP"]];
  await page.evaluate(()=>{
    window.__mobileMoreDashboardProbe=null;
    window.dashboardOpenGameTab=(tab)=>{window.__mobileMoreDashboardProbe=tab;};
  });
  for(const [tab,label] of dashboardRoutes){
    await page.locator("#mobileMoreBtn").click();
    await page.waitForFunction(()=>{
      const drawer=document.querySelector("#mobileMoreDrawer");
      const panel=drawer?.querySelector(".mobile-more-panel");
      if(!drawer?.classList.contains("open")||!panel)return false;
      const style=getComputedStyle(panel),rect=panel.getBoundingClientRect();
      return style.display!=="none"&&style.visibility!=="hidden"&&
        rect.height>0&&rect.top<innerHeight-2&&rect.bottom<=innerHeight+2;
    },null,{timeout:7000});
    const shortcut=page.locator(".mobile-more-grid button").filter({hasText:label}).first();
    const shortcutHandle=await shortcut.elementHandle();
    await shortcut.evaluate(el=>{
      const list=el.closest(".mobile-more-grid");
      if(!list)return;
      const listRect=list.getBoundingClientRect(),rect=el.getBoundingClientRect();
      list.scrollTop+=rect.top-listRect.top-(list.clientHeight-rect.height)/2;
    });
    await page.waitForFunction(el=>{
      if(!el)return false;
      const rect=el.getBoundingClientRect();
      return rect.width>0&&rect.height>0&&rect.top>=0&&rect.bottom<=innerHeight&&getComputedStyle(el).visibility!=="hidden";
    },shortcutHandle,{timeout:5000});
    await shortcut.click();
    assert.equal(await page.evaluate(()=>window.__mobileMoreDashboardProbe),tab,tab+" shortcut must call its matching dashboard tab.");
    await page.waitForFunction(()=>!document.querySelector("#mobileMoreDrawer")?.classList.contains("open"),null,{timeout:5000});
  }
  await page.evaluate(()=>{delete window.__mobileMoreDashboardProbe;delete window.dashboardOpenGameTab;});
  console.log("PASS all 8 mobile dashboard shortcuts route to their matching tabs");

  console.log("PASS mobile More drawer: open/close, Escape, backdrop, 12 section routes, 8 dashboard routes, and aria-expanded state");

  assert.equal(missingAssets.length,0,"Missing local assets:\n"+missingAssets.join("\n"));
  assert.equal(pageErrors.length,0,"Uncaught browser JavaScript errors:\n"+pageErrors.join("\n"));
  console.log("PASS browser smoke: navigation, desktop sidebar/no phone mockup/no overflow, auth validation and isolated signup username handling, login cancel, mobile navigation drawer/width, and live bootstrap or explicit retry state; suppressed extra REST requests after outage:",suppressedLiveRestCount,"; no uncaught JS errors or missing local assets");
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}
