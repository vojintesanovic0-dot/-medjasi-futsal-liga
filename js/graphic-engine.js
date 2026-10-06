/* =========================================================
   MEDJASI GRAPHIC ENGINE
   - admin-only visual generator
   - original photo is never overwritten
   - browser-side background removal on demand
   - publishes generated PNG to News / Community / Chat
========================================================= */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  let sourceFile = null;
  let sourceObjectUrl = null;
  let cutoutBlob = null;
  let generatedBlob = null;
  let generatedPreviewUrl = null;

  const state = {
    template: "player",
    playerId: "",
    destination: "community",
    title: "",
    caption: "",
    body: ""
  };

  function isAdmin(){
    return typeof window.isAdmin === "function" && window.isAdmin();
  }

  function toast(message, type="info"){
    if(typeof window.toast === "function") return window.toast(message, type);
    alert(message);
  }

  function currentPlayer(){
    return (window.players || []).find(p => String(p.id) === String(state.playerId)) || null;
  }

  function teamForPlayer(player){
    return (window.teams || []).find(t => String(t.id) === String(player?.team_id)) || null;
  }

  function fileFromUrl(url){
    return fetch(url, {mode:"cors"}).then(r => {
      if(!r.ok) throw new Error("Fotografija igrača nije dostupna za obradu.");
      return r.blob();
    });
  }

  function revoke(url){
    if(url) URL.revokeObjectURL(url);
  }

  function setSource(file, label){
    sourceFile = file || null;
    cutoutBlob = null;
    generatedBlob = null;
    revoke(sourceObjectUrl);
    revoke(generatedPreviewUrl);
    sourceObjectUrl = file ? URL.createObjectURL(file) : null;
    generatedPreviewUrl = null;

    const img = $("graphicSourcePreview");
    const name = $("graphicSourceName");
    const result = $("graphicResultPreview");

    if(img){
      img.src = sourceObjectUrl || "";
      img.hidden = !sourceObjectUrl;
    }
    if(result) result.hidden = true;
    if(name) name.textContent = label || file?.name || "Nije odabrana fotografija";
    $("graphicGenerateBtn")?.removeAttribute("disabled");
  }

  async function loadPlayerPhoto(){
    const player = currentPlayer();
    if(!player?.photo_url){
      toast("Ovaj igrač nema spremljenu fotografiju.","error");
      return;
    }

    try{
      toast("Učitavam fotografiju igrača...");
      const blob = await fileFromUrl(player.photo_url);
      const ext = blob.type.split("/")[1] || "jpeg";
      setSource(new File([blob], "player-photo." + ext, {type:blob.type}), player.name);
      toast("Fotografija je spremna.");
    }catch(error){
      console.error("Graphic Engine player photo:", error);
      toast("Ne mogu preuzeti postojeću fotografiju. Ubaci je ručno.","error");
    }
  }

  async function removeBackground(){
    if(!sourceFile){
      toast("Prvo izaberi fotografiju.","error");
      return;
    }

    const btn = $("graphicRemoveBgBtn");
    if(btn){
      btn.disabled = true;
      btn.textContent = "⏳ Uklanjam pozadinu...";
    }

    try{
      /*
       * Model se učitava samo kada admin prvi put traži uklanjanje pozadine.
       * Ne ulazi u početni bundle aplikacije.
       */
      const mod = await import("https://esm.sh/@imgly/background-removal@1.7.0");
      const removeBackground = mod.removeBackground;
      if(typeof removeBackground !== "function"){
        throw new Error("AI alat za uklanjanje pozadine nije dostupan.");
      }

      cutoutBlob = await removeBackground(sourceFile, {
        model: "isnet_quint8",
        device: "gpu",
        proxyToWorker: false,
        output: {format:"image/png"}
      });

      const previewUrl = URL.createObjectURL(cutoutBlob);
      const img = $("graphicSourcePreview");
      revoke(sourceObjectUrl);
      sourceObjectUrl = previewUrl;

      if(img){
        img.src = previewUrl;
        img.hidden = false;
      }

      if($("graphicSourceName")){
        $("graphicSourceName").textContent = "✓ Fotografija bez pozadine";
      }

      toast("Pozadina je uklonjena. Originalna fotografija ostaje sačuvana.");
    }catch(error){
      console.error("Graphic Engine remove background:", error);
      toast("Uklanjanje pozadine nije uspjelo. Fotografija ostaje netaknuta.","error");
    }finally{
      if(btn){
        btn.disabled = false;
        btn.textContent = "✨ Ukloni pozadinu";
      }
    }
  }

  function fitImage(ctx, img, x, y, w, h, contain=true){
    const ratio = contain
      ? Math.min(w / img.width, h / img.height)
      : Math.max(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    ctx.drawImage(img, x + (w-dw)/2, y + (h-dh)/2, dw, dh);
  }

  async function blobToImage(blob){
    const url = URL.createObjectURL(blob);
    try{
      return await new Promise((resolve,reject)=>{
        const img = new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error("Fotografija se ne može učitati."));
        img.src=url;
      });
    }finally{
      setTimeout(()=>URL.revokeObjectURL(url),0);
    }
  }

  function drawBackground(ctx, template){
    const g = ctx.createLinearGradient(0,0,1080,1350);
    if(template==="mvp"){
      g.addColorStop(0,"#07150f"); g.addColorStop(.55,"#102e1c"); g.addColorStop(1,"#020604");
    }else if(template==="winner"){
      g.addColorStop(0,"#171208"); g.addColorStop(.55,"#3b2a08"); g.addColorStop(1,"#050403");
    }else if(template==="matchday"){
      g.addColorStop(0,"#061018"); g.addColorStop(.5,"#0d2632"); g.addColorStop(1,"#020608");
    }else if(template==="scorer"){
      g.addColorStop(0,"#0d0715"); g.addColorStop(.55,"#29103b"); g.addColorStop(1,"#040205");
    }else{
      g.addColorStop(0,"#07130d"); g.addColorStop(.55,"#0d2b1c"); g.addColorStop(1,"#020604");
    }
    ctx.fillStyle=g; ctx.fillRect(0,0,1080,1350);

    ctx.globalAlpha=.12;
    ctx.strokeStyle="#b7ff55";
    ctx.lineWidth=2;
    for(let x=-1350;x<1080;x+=90){
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+1350,1350);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  function drawText(ctx, text, x, y, size, weight="700", align="left"){
    ctx.font = weight + " " + size + "px Arial, sans-serif";
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
  }

  async function generate(){
    if(!sourceFile){
      toast("Izaberi fotografiju ili igrača.","error");
      return;
    }

    const player = currentPlayer();
    const team = teamForPlayer(player);
    const canvas = document.createElement("canvas");
    canvas.width=1080; canvas.height=1350;
    const ctx=canvas.getContext("2d");
    const template=state.template;

    drawBackground(ctx,template);

    const source = cutoutBlob || sourceFile;
    const img = await blobToImage(source);

    /* Bottom information panel */
    ctx.fillStyle="rgba(0,0,0,.55)";
    ctx.fillRect(0,1030,1080,320);

    if(cutoutBlob){
      fitImage(ctx,img,60,110,960,960,true);
    }else{
      fitImage(ctx,img,0,80,1080,950,false);
      ctx.fillStyle="rgba(0,0,0,.18)";
      ctx.fillRect(0,80,1080,950);
    }

    ctx.fillStyle="#b7ff55";
    ctx.fillRect(60,1060,170,8);

    const name = player?.name || state.title || "MEDJAŠI IGRAČ";
    const teamName = team?.name || "Medjaši Futsal Liga";
    const number = player?.jersey_number != null ? "#" + player.jersey_number : "";
    const position = player?.position || "";

    let kicker="PLAYER SPOTLIGHT";
    let headline=name;
    let sub=teamName + (number ? "  " + number : "");
    if(template==="mvp"){ kicker="MVP LIGE"; sub=teamName + "  ⭐"; }
    if(template==="scorer"){ kicker="TOP STRIJELAC"; sub=teamName + (number ? "  " + number : ""); }
    if(template==="matchday"){ kicker="MATCHDAY"; headline=name; sub=teamName + "  ⚽"; }
    if(template==="winner"){ kicker="WINNER"; sub=teamName + "  🏆"; }

    ctx.fillStyle="#b7ff55";
    ctx.font="700 28px Arial";
    ctx.fillText(kicker,60,1115);
    drawText(ctx,headline,60,1190,58,"800");
    drawText(ctx,sub,60,1240,30,"600");

    if(position) drawText(ctx,position.toUpperCase(),1020,1115,24,"700","right");
    drawText(ctx,"MEDJAŠI FUTSAL LIGA",1020,1295,22,"700","right");

    generatedBlob = await new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG nije napravljen.")),"image/png",.94);
    });

    revoke(generatedPreviewUrl);
    generatedPreviewUrl=URL.createObjectURL(generatedBlob);
    const result=$("graphicResultPreview");
    if(result){result.src=generatedPreviewUrl;result.hidden=false;}

    const status=$("graphicStatus");
    if(status) status.textContent="✓ Grafika je spremna za objavu.";

    $("graphicPublishBtn")?.removeAttribute("disabled");
  }

  async function publish(){
    if(!generatedBlob){
      toast("Prvo generiši grafiku.","error");
      return;
    }
    if(!window.currentUser){
      toast("Moraš biti prijavljen.","error");
      return;
    }

    const btn=$("graphicPublishBtn");
    if(btn){btn.disabled=true;btn.textContent="⏳ Objavljujem...";}

    try{
      const filename="graphic-engine/"+window.currentUser.id+"/"+crypto.randomUUID()+".png";
      const {error:uploadError}=await window.supabaseClient
        .storage.from("liga-images")
        .upload(filename,generatedBlob,{contentType:"image/png",upsert:false});
      if(uploadError) throw uploadError;

      const {data:urlData}=window.supabaseClient
        .storage.from("liga-images").getPublicUrl(filename);
      const image_url=urlData.publicUrl;

      const player=currentPlayer();
      const team=teamForPlayer(player);
      const name=player?.name || "Medjaši";
      const templateLabel={
        player:"Player Spotlight",mvp:"MVP Lige",scorer:"Top Strijelac",
        matchday:"Matchday",winner:"Winner"
      }[state.template] || "Grafika lige";

      const caption=state.caption.trim() || ("🔥 "+templateLabel+" · "+name+" · "+(team?.name||"Medjaši Futsal Liga"));

      if(state.destination==="community"){
        const {error}=await window.supabaseClient.from("community_posts").insert({
          user_id:window.currentUser.id,
          image_url,
          caption
        });
        if(error) throw error;
        window.loadV9Community?.();
      }

      if(state.destination==="chat"){
        const username=window.currentProfile?.username || window.currentUser.email?.split("@")[0] || "Admin";
        const {error}=await window.supabaseClient.from("messages").insert({
          user_id:window.currentUser.id,
          username,
          content:caption,
          image_url
        });
        if(error) throw error;
        window.loadAll?.();
      }

      if(state.destination==="news"){
        const title=state.title.trim() || caption.slice(0,150);
        const body=state.body.trim() || caption;
        const {error}=await window.supabaseClient.from("news").insert({
          title,
          lead:caption.slice(0,400),
          body,
          kicker:templateLabel.toUpperCase(),
          author_id:window.currentUser.id,
          author_name:window.currentProfile?.username || window.currentUser.email?.split("@")[0] || "Admin",
          media_url:image_url,
          media_type:"image",
          published:true
        });
        if(error) throw error;
        window.loadNews?.();
      }

      toast("Grafika je objavljena u "+({
        community:"Community",chat:"Chatu",news:"Vijestima"
      }[state.destination] || "sistemu")+".");

      if(state.destination==="community") window.showSection?.("community");
      if(state.destination==="chat") window.showSection?.("chat");
      if(state.destination==="news") window.showSection?.("news");
    }catch(error){
      console.error("Graphic Engine publish:",error);
      toast(error?.message || "Greška pri objavi grafike.","error");
    }finally{
      if(btn){btn.disabled=false;btn.textContent="🚀 Objavi grafiku";}
    }
  }

  function syncState(){
    state.playerId=$("graphicPlayer")?.value || "";
    state.template=$("graphicTemplate")?.value || "player";
    state.destination=$("graphicDestination")?.value || "community";
    state.title=$("graphicNewsTitle")?.value || "";
    state.caption=$("graphicCaption")?.value || "";
    state.body=$("graphicNewsBody")?.value || "";

    const player=currentPlayer();
    const team=teamForPlayer(player);
    const meta=$("graphicPlayerMeta");
    if(meta){
      meta.textContent=player
        ? (team?.name||"") + (player.jersey_number!=null ? " · #"+player.jersey_number : "") + (player.position ? " · "+player.position : "")
        : "Izaberi igrača ili ubaci fotografiju";
    }
  }

  function renderPlayers(){
    const select=$("graphicPlayer");
    if(!select) return;
    const list=(window.players||[]).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
    select.innerHTML='<option value="">— Izaberi igrača —</option>'+
      list.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc((teamForPlayer(p)?.name)||"Bez ekipe")+'</option>').join("");
  }

  function inject(){
    const admin=document.getElementById("adminContent");
    if(!admin || document.getElementById("graphicEngineCard")) return;
    const card=document.createElement("div");
    card.id="graphicEngineCard";
    card.className="card graphic-engine-card";
    card.innerHTML=`
      <div class="graphic-engine-head">
        <div>
          <span class="hero-kicker">MEDJAŠI GRAPHIC ENGINE</span>
          <h3>🎨 Napravi grafiku iz jedne fotografije</h3>
          <p class="muted">Original ostaje netaknut. Napravi PNG bez pozadine i objavi ga direktno u Community, Chat ili Vijesti.</p>
        </div>
        <span class="admin-pill">SAMO ADMIN</span>
      </div>

      <div class="graphic-engine-grid">
        <div class="graphic-engine-controls">
          <div class="form-group">
            <label>Igrač</label>
            <select id="graphicPlayer"></select>
            <div id="graphicPlayerMeta" class="muted" style="margin-top:6px">Izaberi igrača ili ubaci fotografiju</div>
          </div>

          <div class="form-group">
            <label>Fotografija</label>
            <input id="graphicFile" type="file" accept="image/png,image/jpeg,image/webp">
            <div id="graphicSourceName" class="muted" style="margin-top:6px">Nije odabrana fotografija</div>
          </div>

          <div class="graphic-engine-actions">
            <button id="graphicLoadPlayer" type="button" class="btn btn-blue">📸 Uzmi sliku igrača</button>
            <button id="graphicRemoveBgBtn" type="button" class="btn btn-green">✨ Ukloni pozadinu</button>
          </div>

          <div class="form-group">
            <label>Vrsta grafike</label>
            <select id="graphicTemplate">
              <option value="player">👤 Player Spotlight</option>
              <option value="mvp">⭐ MVP Lige</option>
              <option value="scorer">⚽ Top Strijelac</option>
              <option value="matchday">🔥 Matchday</option>
              <option value="winner">🏆 Winner</option>
            </select>
          </div>

          <div class="form-group">
            <label>Objavi u</label>
            <select id="graphicDestination">
              <option value="community">✨ Community</option>
              <option value="news">📰 Vijesti</option>
              <option value="chat">💬 Chat</option>
            </select>
          </div>

          <div class="form-group">
            <label>Opis objave</label>
            <textarea id="graphicCaption" maxlength="1000" placeholder="Tekst koji ide uz grafiku..."></textarea>
          </div>

          <div id="graphicNewsFields" class="graphic-news-fields">
            <div class="form-group">
              <label>Naslov vijesti</label>
              <input id="graphicNewsTitle" maxlength="150" placeholder="Naslov vijesti">
            </div>
            <div class="form-group">
              <label>Sadržaj vijesti</label>
              <textarea id="graphicNewsBody" maxlength="10000" placeholder="Sadržaj vijesti..."></textarea>
            </div>
          </div>

          <div class="graphic-engine-actions">
            <button id="graphicGenerateBtn" type="button" class="btn btn-green" disabled>🎨 Generiši grafiku</button>
            <button id="graphicPublishBtn" type="button" class="btn btn-blue" disabled>🚀 Objavi grafiku</button>
          </div>

          <div id="graphicStatus" class="muted" aria-live="polite"></div>
        </div>

        <div class="graphic-engine-preview">
          <div class="graphic-preview-label">IZVOR</div>
          <div class="graphic-preview-frame">
            <img id="graphicSourcePreview" alt="Izvorna fotografija" hidden>
          </div>
          <div class="graphic-preview-label">REZULTAT</div>
          <div class="graphic-result-frame">
            <img id="graphicResultPreview" alt="Generisana grafika" hidden>
          </div>
        </div>
      </div>
    `;
    admin.appendChild(card);

    renderPlayers();

    $("graphicPlayer")?.addEventListener("change", async ()=>{
      syncState();
      if($("graphicPlayer").value) await loadPlayerPhoto();
    });
    $("graphicFile")?.addEventListener("change",()=>{
      const f=$("graphicFile").files?.[0];
      if(!f) return;
      if(!/^image\/(png|jpeg|webp)$/i.test(f.type) || f.size>12*1024*1024){
        toast("Dozvoljene su JPG, PNG i WEBP slike do 12 MB.","error");
        $("graphicFile").value="";
        return;
      }
      setSource(f,f.name);
    });
    $("graphicLoadPlayer")?.addEventListener("click",loadPlayerPhoto);
    $("graphicRemoveBgBtn")?.addEventListener("click",removeBackground);
    $("graphicGenerateBtn")?.addEventListener("click",async()=>{syncState();try{await generate()}catch(e){console.error(e);toast(e.message||"Greška pri generisanju.","error")}});
    $("graphicPublishBtn")?.addEventListener("click",async()=>{syncState();await publish()});
    $("graphicTemplate")?.addEventListener("change",syncState);
    $("graphicDestination")?.addEventListener("change",()=>{
      syncState();
      $("graphicNewsFields").hidden=$("graphicDestination").value!=="news";
    });
    $("graphicCaption")?.addEventListener("input",syncState);
    $("graphicNewsTitle")?.addEventListener("input",syncState);
    $("graphicNewsBody")?.addEventListener("input",syncState);
    $("graphicNewsFields").hidden=true;
  }

  function init(){
    if(!isAdmin()) return;
    inject();
    renderPlayers();
  }

  window.initGraphicEngine=init;
  window.renderGraphicEnginePlayers=renderPlayers;

  document.addEventListener("DOMContentLoaded",()=>setTimeout(init,250));
  window.addEventListener("load",()=>setTimeout(init,700));
})();
