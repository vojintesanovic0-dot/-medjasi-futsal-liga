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
    teamId: "",
    matchId: "",
    destination: "community",
    title: "",
    caption: "",
    body: "",
    blur: false,
    grain: false,
    duotone: false,
    blurPlayer: false
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
        $("graphicSourceName").textContent = " Fotografija bez pozadine";
      }

      toast("Pozadina je uklonjena. Originalna fotografija ostaje sačuvana.");
    }catch(error){
      console.error("Graphic Engine remove background:", error);
      toast("Uklanjanje pozadine nije uspjelo. Fotografija ostaje netaknuta.","error");
    }finally{
      if(btn){
        btn.disabled = false;
        btn.textContent = " Ukloni pozadinu";
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

  function teamById(id) {
    return (window.teams || []).find(t => String(t.id) === String(id)) || null;
  }

  function matchById(id) {
    return (window.matches || []).find(m => String(m.id) === String(id)) || null;
  }

  function formatMatchDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("bs-BA", {day:"2-digit", month:"long", year:"numeric"});
  }

  function fitText(ctx, text, x, y, maxSize, minSize, maxWidth, weight="800", align="center") {
    let size = maxSize;
    ctx.font = weight + " " + size + "px Arial, sans-serif";
    while (size > minSize && ctx.measureText(String(text || "")).width > maxWidth) {
      size -= 2;
      ctx.font = weight + " " + size + "px Arial, sans-serif";
    }
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(text || ""), x, y);
  }

  function renderTeamOptions() {
    const select = $("graphicTeam");
    if (!select) return;
    const current = select.value;
    const list = (window.teams || []).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
    select.innerHTML = '<option value="">— Izaberi ekipu —</option>' +
      list.map(t => '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>').join("");
    if (current) select.value = current;
  }

  function renderMatchOptions() {
    const select = $("graphicMatch");
    if (!select) return;
    const current = select.value;
    const list = (window.matches || []).slice()
      .sort((a,b)=>String(b.match_date||"").localeCompare(String(a.match_date||"")));
    select.innerHTML = '<option value="">— Izaberi utakmicu —</option>' +
      list.map(m => {
        const home = teamById(m.home_team_id)?.name || "Domaćin";
        const away = teamById(m.away_team_id)?.name || "Gost";
        const score = m.status === "scheduled" ? " vs " :
          " " + Number(m.home_score || 0) + ":" + Number(m.away_score || 0) + " ";
        const date = formatMatchDate(m.match_date);
        const label = home + score + away + (date ? " · " + date : "");
        return '<option value="' + esc(m.id) + '">' + esc(label) + '</option>';
      }).join("");
    if (current) select.value = current;
  }

  async function generate() {
    syncState();

    const template = state.template;
    const isMatchTpl = ["result","preview","live","scorers"].includes(template);
    const isCoachTpl = template === "coach";

    if (!sourceFile && !isMatchTpl && !isCoachTpl) {
      toast("Izaberi fotografiju ili igrača.", "error");
      return;
    }

    const player = (isCoachTpl || isMatchTpl) ? null : currentPlayer();
    const team = isCoachTpl
      ? (teamById(state.teamId) || teamForPlayer(currentPlayer()))
      : teamForPlayer(player);
    const match = isMatchTpl ? matchById(state.matchId) : null;

    if (isMatchTpl && !match) {
      toast("Izaberi utakmicu za ovu vrstu grafike.", "error");
      return;
    }
    if (isCoachTpl && !team) {
      toast("Izaberi ekipu čiji je trener.", "error");
      return;
    }
    if (isCoachTpl && !team.coach) {
      toast("Ova ekipa nema upisanog trenera. Dopuni polje Trener u admin panelu ekipa.", "error");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nije dostupan u ovom pregledniku.");

    drawBackground(ctx, template);

    if (state.blur && sourceFile) {
      const bgSource = await blobToImage(sourceFile);
      ctx.save();
      if ("filter" in ctx) ctx.filter = "blur(36px)";
      fitImage(ctx, bgSource, -60, -60, 1200, 1470, false);
      ctx.restore();
      ctx.fillStyle = "rgba(2,6,4,.45)";
      ctx.fillRect(0, 0, 1080, 1350);
    }

    if (sourceFile) {
      const img = await blobToImage(cutoutBlob || sourceFile);
      ctx.save();
      if (state.blurPlayer && "filter" in ctx) ctx.filter = "blur(18px)";
      if (cutoutBlob) {
        const big = ["mvp","scorer","winner","captain","legend","coach"].includes(template);
        fitImage(ctx, img, big ? 20 : 80, big ? 35 : 120, big ? 1040 : 920, big ? 990 : 900, true);
      } else if (state.blur) {
        fitImage(ctx, img, 80, 120, 920, 900, true);
      } else {
        fitImage(ctx, img, 0, 50, 1080, 980, false);
      }
      ctx.restore();
      if (!cutoutBlob && !state.blur) {
        ctx.fillStyle = "rgba(0,0,0,.20)";
        ctx.fillRect(0, 50, 1080, 980);
      }
    }

    if (state.duotone) {
      ctx.save();
      ctx.globalCompositeOperation = "color";
      ctx.fillStyle = "rgba(183,255,85,.35)";
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.restore();
    }

    const number = player?.jersey_number != null ? "#" + player.jersey_number : "";
    const position = player?.position || "";
    const teamName = team?.name || "Međasi Futsal Liga";
    let headline = "";
    let sub = "";

    if (isMatchTpl) {
      const home = teamById(match.home_team_id);
      const away = teamById(match.away_team_id);
      const homeName = home?.name || "Domaćin";
      const awayName = away?.name || "Gost";
      const scoreText = match.status === "scheduled"
        ? "VS"
        : (Number(match.home_score || 0) + " : " + Number(match.away_score || 0));
      const liveMinute = (() => {
        if(match.live_started_at){
          const s=Date.parse(match.live_started_at);
          if(Number.isFinite(s))return Math.max(0,Math.floor((Date.now()-s)/60000));
        }
        return Number(match.current_minute||0);
      })();
      const statusText = match.status === "live" ? "UŽIVO · " + liveMinute + "'"
        : match.status === "finished" ? "ZAVRŠENO" : "NAJAVA";

      fitText(ctx, homeName.toUpperCase(), 270, 600, 72, 36, 400);
      fitText(ctx, awayName.toUpperCase(), 810, 600, 72, 36, 400);
      fitText(ctx, scoreText, 540, 800, 200, 90, 300);
      drawText(ctx, statusText, 540, 880, 34, "800", "center");
      if(template==="scorers"){
        const goalsOfMatch=(window.goals||[])
          .filter(g=>String(g.match_id)===String(match.id))
          .sort((x,y)=>(Number(x.minute)||0)-(Number(y.minute)||0));
        const rows=goalsOfMatch.map(goal=>{
          const p=(window.players||[]).find(x=>String(x.id)===String(goal.player_id));
          return {name:(p?.name||"Igrač")+"  "+(Number(goal.minute)||0)+"'",team:p?.team_id};
        });
        const homeRows=rows.filter(row=>String(row.team)===String(match.home_team_id));
        const awayRows=rows.filter(row=>String(row.team)!==String(match.home_team_id));
        drawText(ctx,"STRIJELCI",540,230,30,"800","center");
        if(!rows.length)drawText(ctx,"Bez golova",540,300,34,"600","center");
        homeRows.slice(0,6).forEach((row,i)=>drawText(ctx,row.name,500,290+i*46,32,"700","right"));
        awayRows.slice(0,6).forEach((row,i)=>drawText(ctx,row.name,580,290+i*46,32,"700","left"));
      }
      headline = homeName + " – " + awayName;
      sub = formatMatchDate(match.match_date) || "Međasi Futsal Liga";
    } else if (isCoachTpl) {
      if (!sourceFile) fitText(ctx, teamName.toUpperCase(), 540, 640, 120, 50, 960);
      headline = team.coach;
      sub = teamName + " · TRENER";
    } else {
      headline = player?.name || state.title || "MEĐASI IGRAČ";
      sub = teamName + (number ? "  " + number : "");
      if (template === "lineup") sub = teamName + (position ? " · " + position : "") + (number ? " · " + number : "");
      if (template === "transfer") sub = "NOVI IGRAČ · " + teamName;
      if (template === "birthday") sub = "ŽELIMO TI SVE NAJBOLJE · " + teamName;
      if (template === "fan") sub = "MILJENIK NAVIJAČA · " + teamName;
      if (template === "captain") sub = "KAPITEN · " + teamName;
      if (template === "legend") sub = "LEGENDA · " + teamName;
      if (template === "spotlight") sub = "DANAS U FOKUSU · " + teamName;
      if (template === "mvp") sub = "NAJBOLJI IGRAČ · " + teamName + "  ⭐";
      if (template === "scorer") sub = "STRIJELAC · " + teamName + "  ";
      if (template === "winner") sub = "POBJEDNIK · " + teamName + "  ";
      if (template === "matchday") sub = "DAN UTAKMICE · " + teamName + "  ";
    }

    const presets = {
      player:   {kicker:"PLAYER SPOTLIGHT", tag:" IGRAČ"},
      mvp:      {kicker:"MVP LIGE", tag:"⭐ MVP"},
      scorer:   {kicker:"TOP STRIJELAC", tag:" GOAL"},
      matchday: {kicker:"MATCHDAY", tag:" MATCHDAY"},
      winner:   {kicker:"WINNER", tag:" POBJEDNIK"},
      lineup:   {kicker:"STARTING FIVE", tag:" POSTAVA"},
      transfer: {kicker:"PLAYER ANNOUNCEMENT", tag:" NOVO"},
      birthday: {kicker:"SRETAN ROĐENDAN", tag:" BIRTHDAY"},
      spotlight:{kicker:"U FOKUSU", tag:" FOCUS"},
      fan:      {kicker:"IGRAČ TRIBINE", tag:" FAN FAVORITE"},
      captain:  {kicker:"KAPITEN", tag:"© KAPITEN"},
      legend:   {kicker:"LEGENDA LIGE", tag:" LEGENDA"},
      coach:    {kicker:"TRENER EKIPE", tag:"TRENER"},
      result:   {kicker:"REZULTAT UTAKMICE", tag:"FINAL"},
      preview:  {kicker:"NAJAVA UTAKMICE", tag:"UTAKMICA"},
      live:     {kicker:"UTAKMICA UŽIVO", tag:"LIVE"},
      scorers:  {kicker:"STRIJELCI UTAKMICE", tag:"GOLOVI"}
    };
    const preset = {...(presets[template] || presets.player)};
    if(template==="result" && match){
      preset.tag=match.status==="live"?"UŽIVO":match.status==="finished"?"FINAL":"NAJAVA";
    }

    ctx.fillStyle = "rgba(0,0,0,.60)";
    ctx.fillRect(0, 1020, 1080, 330);
    ctx.fillStyle = "#b7ff55";
    ctx.fillRect(60, 1045, 210, 8);
    ctx.fillStyle = "#b7ff55";
    ctx.font = "700 28px Arial";
    ctx.fillText(preset.kicker, 60, 1100);

    fitText(ctx, headline, 60, 1180, 58, 30, 960, "800", "left");
    drawText(ctx, sub, 60, 1230, 30, "600");
    if (position) drawText(ctx, position.toUpperCase(), 1020, 1100, 24, "700", "right");
    if (number) drawText(ctx, number, 1020, 1175, 38, "800", "right");
    drawText(ctx, String(preset.tag||"").trim(), 1020, 1295, 22, "700", "right");
    drawText(ctx, "MEĐASI FUTSAL LIGA", 60, 1295, 22, "700");

    if (state.grain) {
      ctx.save();
      ctx.globalAlpha = .06;
      for (let i = 0; i < 9000; i++) {
        const v = Math.random() > .5 ? 255 : 0;
        ctx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
        ctx.fillRect(Math.random() * 1080, Math.random() * 1350, 2, 2);
      }
      ctx.restore();
    }

    generatedBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG nije napravljen.")), "image/png", .94);
    });
    revoke(generatedPreviewUrl);
    generatedPreviewUrl = URL.createObjectURL(generatedBlob);
    const result = $("graphicResultPreview");
    if (result) { result.src = generatedPreviewUrl; result.hidden = false; }
    const status = $("graphicStatus");
    if (status) status.textContent = "Grafika je spremna za objavu.";
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
      const name=player?.name || "Međasi";
      const templateLabel={
        player:"Player Spotlight",mvp:"MVP Lige",scorer:"Top Strijelac",
        matchday:"Matchday",winner:"Winner",lineup:"Starting Five",
        transfer:"Player Announcement",birthday:"Sretan rođendan",
        spotlight:"U fokusu",fan:"Fan Favorite",captain:"Kapiten",legend:"Legenda lige",
        coach:"Trener",result:"Rezultat utakmice",preview:"Najava utakmice",live:"Utakmica uživo",scorers:"Strijelci utakmice"
      }[state.template] || "Grafika lige";

      const caption=state.caption.trim() || (" "+templateLabel+" · "+name+" · "+(team?.name||"Međasi Futsal Liga"));

      if(state.destination==="community"){
        const {error}=await window.sbClient().from("community_posts").insert({
          user_id:window.currentUser.id,
          image_url,
          caption
        });
        if(error) throw error;
        window.loadV9Community?.();
      }

      if(state.destination==="chat"){
        const username=window.currentProfile?.username ||  "Admin";
        const {error}=await window.sbClient().from("messages").insert({
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
        const {error}=await window.sbClient().from("news").insert({
          title,
          lead:caption.slice(0,400),
          body,
          kicker:templateLabel.toUpperCase(),
          author_id:window.currentUser.id,
          author_name:window.currentProfile?.username ||  "Admin",
          media_url:image_url,
          media_type:"image",
          published:true
        });
        if(error) throw error;
        const pushOk=await window.medjasiV7?.notifyPush?.("news","📰 "+title,caption.slice(0,200),null);
        if(!pushOk)console.warn("Grafika je objavljena kao vijest, ali push nije potvrđen.");
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
      if(btn){btn.disabled=false;btn.textContent=" Objavi grafiku";}
    }
  }

  function syncState() {
    state.playerId = $("graphicPlayer")?.value || "";
    state.teamId = $("graphicTeam")?.value || "";
    state.matchId = $("graphicMatch")?.value || "";
    state.template = $("graphicTemplate")?.value || "player";
    state.destination = $("graphicDestination")?.value || "community";
    state.title = $("graphicNewsTitle")?.value || "";
    state.caption = $("graphicCaption")?.value || "";
    state.body = $("graphicNewsBody")?.value || "";
    state.blur = !!$("graphicBlur")?.checked;
    state.blurPlayer = !!$("graphicBlurPlayer")?.checked;
    state.grain = !!$("graphicGrain")?.checked;
    state.duotone = !!$("graphicDuotone")?.checked;

    const player = currentPlayer();
    const team = teamForPlayer(player);
    const meta = $("graphicPlayerMeta");
    if (meta) {
      meta.textContent = player
        ? (team?.name || "") +
          (player.jersey_number != null ? " · #" + player.jersey_number : "") +
          (player.position ? " · " + player.position : "")
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
          <span class="hero-kicker">MEĐASI GRAPHIC ENGINE</span>
          <h3> Napravi grafiku iz jedne fotografije</h3>
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
            <button id="graphicLoadPlayer" type="button" class="btn btn-blue"> Uzmi sliku igrača</button>
            <button id="graphicRemoveBgBtn" type="button" class="btn btn-green"> Ukloni pozadinu</button>
          </div>

          <div class="form-group">
            <label>Vrsta grafike</label>
            <select id="graphicTemplate">
              <option value="player"> Player Spotlight</option>
              <option value="mvp">⭐ MVP Lige</option>
              <option value="scorer"> Top Strijelac</option>
              <option value="matchday"> Matchday</option>
              <option value="winner"> Winner</option>
              <option value="lineup"> Starting Five</option>
              <option value="transfer"> Player Announcement</option>
              <option value="birthday"> Sretan rođendan</option>
              <option value="spotlight"> U fokusu</option>
              <option value="fan"> Fan Favorite</option>
              <option value="captain">© Kapiten</option>
              <option value="legend"> Legenda lige</option>
              <option value="coach">Trener</option>
              <option value="result">🏁 Rezultat utakmice</option>
              <option value="preview">📅 Najava utakmice</option>
              <option value="live">🔴 Utakmica uživo</option>
              <option value="scorers">⚽ Strijelci utakmice</option>
            </select>
          </div>

          <div class="form-group">
            <label>Ekipa (za trenera)</label>
            <select id="graphicTeam"></select>
          </div>

          <div class="form-group">
            <label>Utakmica (za rezultat i najavu)</label>
            <select id="graphicMatch"></select>
          </div>

          <div class="graphic-engine-effects">
            <label><input type="checkbox" id="graphicBlur"> Zamućena pozadina</label>
            <label><input type="checkbox" id="graphicBlurPlayer"> Zamućen igrač</label>
            <label><input type="checkbox" id="graphicDuotone"> Ton lige (zelena)</label>
            <label><input type="checkbox" id="graphicGrain"> Grain (zrnasta tekstura)</label>
          </div>

          <div class="form-group">
            <label>Objavi u</label>
            <select id="graphicDestination">
              <option value="community"> Community</option>
              <option value="news"> Vijesti</option>
              <option value="chat"> Chat</option>
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
            <button id="graphicGenerateBtn" type="button" class="btn btn-green" disabled> Generiši grafiku</button>
            <button id="graphicPublishBtn" type="button" class="btn btn-blue" disabled> Objavi grafiku</button>
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
    renderTeamOptions();
    renderMatchOptions();

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
    $("graphicTeam")?.addEventListener("focus", renderTeamOptions);
    $("graphicMatch")?.addEventListener("focus", renderMatchOptions);
    $("graphicTeam")?.addEventListener("change", syncState);
    $("graphicMatch")?.addEventListener("change", syncState);
    $("graphicBlur")?.addEventListener("change", syncState);
    $("graphicBlurPlayer")?.addEventListener("change", syncState);
    $("graphicDuotone")?.addEventListener("change", syncState);
    $("graphicGrain")?.addEventListener("change", syncState);
  }

  function init(){
    if(!isAdmin()) return;
    inject();
    renderPlayers();
    renderTeamOptions();
    renderMatchOptions();
  }

  window.initGraphicEngine=init;
  window.renderGraphicEnginePlayers=renderPlayers;

  document.addEventListener("DOMContentLoaded",()=>setTimeout(init,250));
  window.addEventListener("load",()=>setTimeout(init,700));
})();
