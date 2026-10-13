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
    body: "",
    graphicHeadline: "",
    graphicSubtitle: "",
    matchHome: "MEĐASI",
    matchOpponent: "",
    matchScore: "",
    matchDate: "",
    matchVenue: "",
    accentColor: "#b7ff55",
    photoZoom: 1,
    photoFocusY: 0,
    photoShade: 0.2,
    fontFamily: "Arial"
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
    $("graphicPublishBtn")?.setAttribute("disabled","");
    $("graphicExportPngBtn")?.setAttribute("disabled","");
    $("graphicExportJpegBtn")?.setAttribute("disabled","");
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

  function fitImage(ctx, img, x, y, w, h, contain=true, zoom=1, focusY=0){
    const baseRatio = contain
      ? Math.min(w / img.width, h / img.height)
      : Math.max(w / img.width, h / img.height);
    const ratio = baseRatio * (contain ? 1 : Math.max(1, Math.min(1.8, Number(zoom)||1)));
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    const drawX = x + (w-dw)/2;
    const maxShift = Math.max(0, dh-h);
    const shiftY = contain ? 0 : Math.max(-maxShift/2, Math.min(maxShift/2, Number(focusY)||0));
    const drawY = y + (h-dh)/2 + shiftY;
    ctx.save();
    ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    ctx.drawImage(img, drawX, drawY, dw, dh);
    ctx.restore();
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

  function drawBackground(ctx, template, accentColor="#b7ff55"){
    const g = ctx.createLinearGradient(0,0,1080,1350);
    if(template==="mvp"){
      g.addColorStop(0,"#07150f"); g.addColorStop(.55,"#102e1c"); g.addColorStop(1,"#020604");
    }else if(template==="winner"){
      g.addColorStop(0,"#171208"); g.addColorStop(.55,"#3b2a08"); g.addColorStop(1,"#050403");
    }else if(template==="matchday"){
      g.addColorStop(0,"#061018"); g.addColorStop(.5,"#0d2632"); g.addColorStop(1,"#020608");
    }else if(template==="scorer"){
      g.addColorStop(0,"#0d0715"); g.addColorStop(.55,"#29103b"); g.addColorStop(1,"#040205");
    }else if(template==="matchresult"){
      g.addColorStop(0,"#06170f"); g.addColorStop(.5,"#16482b"); g.addColorStop(1,"#020604");
    }else if(template==="upcoming"){
      g.addColorStop(0,"#07111c"); g.addColorStop(.5,"#12334a"); g.addColorStop(1,"#02060a");
    }else{
      g.addColorStop(0,"#07130d"); g.addColorStop(.55,"#0d2b1c"); g.addColorStop(1,"#020604");
    }
    ctx.fillStyle=g; ctx.fillRect(0,0,1080,1350);

    ctx.globalAlpha=.12;
    ctx.strokeStyle=accentColor;
    ctx.lineWidth=2;
    for(let x=-1350;x<1080;x+=90){
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+1350,1350);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  function drawText(ctx, text, x, y, size, weight="700", align="left"){
    const fonts={Arial:"Arial, sans-serif",Impact:"Impact, Haettenschweiler, sans-serif",Georgia:"Georgia, serif"};
    ctx.font = weight + " " + size + "px " + (fonts[state.fontFamily]||fonts.Arial);
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
    state.photoZoom=Math.max(1,Math.min(1.8,Number(state.photoZoom)||1));
    state.photoFocusY=Math.max(-220,Math.min(220,Number(state.photoFocusY)||0));
    state.photoShade=Math.max(0,Math.min(.6,Number(state.photoShade)||0));
    const ctx=canvas.getContext("2d");
    const template=state.template;
    const accentColor=/^#[0-9a-f]{6}$/i.test(state.accentColor) ? state.accentColor : "#b7ff55";

    drawBackground(ctx,template,accentColor);

    const source = cutoutBlob || sourceFile;
    const img = await blobToImage(source);

    const name = player?.name || state.title || "MEĐASI IGRAČ";
    const teamName = team?.name || "Međasi Futsal Liga";
    const number = player?.jersey_number != null ? "#" + player.jersey_number : "";
    const position = player?.position || "";

    const presets = {
      player:   {kicker:"PLAYER SPOTLIGHT", tag:" IGRAČ"},
      mvp:      {kicker:"MVP LIGE", tag:"⭐ MVP"},
      scorer:   {kicker:"TOP STRIJELAC", tag:" GOAL"},
      matchday: {kicker:"MATCHDAY", tag:" MATCHDAY"},
      matchresult:{kicker:"KONAČAN REZULTAT", tag:" REZULTAT"},
      upcoming: {kicker:"NAJAVA UTAKMICE", tag:" NAJAVA"},
      winner:   {kicker:"WINNER", tag:" POBJEDNIK"},
      lineup:   {kicker:"STARTING FIVE", tag:" POSTAVA"},
      transfer: {kicker:"PLAYER ANNOUNCEMENT", tag:" NOVO"},
      birthday: {kicker:"SRETAN ROĐENDAN", tag:" BIRTHDAY"},
      spotlight:{kicker:"U FOKUSU", tag:" FOCUS"},
      fan:      {kicker:"IGRAČ TRIBINE", tag:" FAN FAVORITE"},
      captain:  {kicker:"KAPITEN", tag:"© KAPITEN"},
      legend:   {kicker:"LEGENDA LIGE", tag:" LEGENDA"}
    };
    const preset=presets[template]||presets.player;

    /* Visual composition changes by template. */
    if(cutoutBlob){
      const big=["mvp","scorer","winner","captain","legend","matchresult","upcoming"].includes(template);
      fitImage(ctx,img,big?20:80,big?35:120,big?1040:920,big?990:900,true);
    }else{
      fitImage(ctx,img,0,50,1080,980,false,state.photoZoom,state.photoFocusY);
      ctx.fillStyle="rgba(0,0,0,"+state.photoShade+")";
      ctx.fillRect(0,50,1080,980);
    }

    /* Accent stripe + lower information panel. */
    ctx.fillStyle=accentColor;
    ctx.fillRect(60,1045,210,8);
    ctx.fillStyle="rgba(0,0,0,.60)";
    ctx.fillRect(0,1020,1080,330);

    ctx.fillStyle=accentColor;
    const fonts={Arial:"Arial, sans-serif",Impact:"Impact, Haettenschweiler, sans-serif",Georgia:"Georgia, serif"};
    ctx.font="700 28px "+(fonts[state.fontFamily]||fonts.Arial);
    ctx.fillText(preset.kicker,60,1100);

    const defaultHeadlines={matchresult:"REZULTAT UTAKMICE",upcoming:"SLJEDEĆA UTAKMICA"};
    let headline=state.graphicHeadline.trim() || defaultHeadlines[template] || name;
    let sub=teamName + (number ? "  " + number : "");
    if(template==="lineup") sub=teamName + (position ? " · "+position : "") + (number ? " · "+number : "");
    if(template==="transfer") sub="NOVI IGRAČ · "+teamName;
    if(template==="birthday") sub="ŽELIMO TI SVE NAJBOLJE · "+teamName;
    if(template==="fan") sub="MILJENIK NAVIJAČA · "+teamName;
    if(template==="captain") sub="KAPITEN · "+teamName;
    if(template==="legend") sub="LEGENDA · "+teamName;
    if(template==="spotlight") sub="DANAS U FOKUSU · "+teamName;
    if(template==="mvp") sub="NAJBOLJI IGRAČ · "+teamName+"  ⭐";
    if(template==="scorer") sub="STRIJELAC · "+teamName+"  ";
    if(template==="winner") sub="POBJEDNIK · "+teamName+"  ";
    if(template==="matchday") sub="DAN UTAKMICE · "+teamName+"  ";
    if(template==="matchresult") sub="KONAČAN REZULTAT · "+teamName;
    if(template==="upcoming") sub="SLJEDEĆA UTAKMICA · "+teamName;
    if(state.graphicSubtitle.trim()) sub=state.graphicSubtitle.trim();

    if(template==="matchresult" || template==="upcoming"){
      const home=(state.matchHome.trim()||"MEĐASI").slice(0,20);
      const opponent=(state.matchOpponent.trim()||"PROTIVNIK").slice(0,20);
      const center=template==="matchresult" ? (state.matchScore.trim()||"— : —").slice(0,12) : "VS";
      drawText(ctx,home,60,1180,36,"800","left");
      drawText(ctx,center,540,1180,48,"800","center");
      drawText(ctx,opponent,1020,1180,36,"800","right");
      const matchMeta=[state.matchDate.trim(),state.matchVenue.trim()].filter(Boolean).join(" · ");
      drawText(ctx,(matchMeta||sub).slice(0,62),60,1235,25,"600");
    }else{
      drawText(ctx,headline,60,1180,58,"800");
      drawText(ctx,sub,60,1230,30,"600");
    }

    if(position) drawText(ctx,position.toUpperCase(),1020,1100,24,"700","right");
    if(number) drawText(ctx,number,1020,1175,38,"800","right");
    drawText(ctx,preset.tag,1020,1295,22,"700","right");
    drawText(ctx,"MEĐASI FUTSAL LIGA",60,1295,22,"700");

    generatedBlob = await new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG nije napravljen.")),"image/png",.94);
    });

    revoke(generatedPreviewUrl);
    generatedPreviewUrl=URL.createObjectURL(generatedBlob);
    const result=$("graphicResultPreview");
    if(result){result.src=generatedPreviewUrl;result.hidden=false;}

    const status=$("graphicStatus");
    if(status) status.textContent=" Grafika je spremna za objavu.";

    $("graphicPublishBtn")?.removeAttribute("disabled");
    $("graphicExportPngBtn")?.removeAttribute("disabled");
    $("graphicExportJpegBtn")?.removeAttribute("disabled");
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
        matchday:"Matchday",matchresult:"Rezultat utakmice",upcoming:"Najava utakmice",winner:"Winner",lineup:"Starting Five",
        transfer:"Player Announcement",birthday:"Sretan rođendan",
        spotlight:"U fokusu",fan:"Fan Favorite",captain:"Kapiten",legend:"Legenda lige"
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
        const username=window.currentProfile?.username || window.currentUser.email?.split("@")[0] || "Admin";
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
      if(btn){btn.disabled=false;btn.textContent=" Objavi grafiku";}
    }
  }

  function downloadBlob(blob, filename){
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download=filename;
    link.hidden=true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function exportGraphic(mimeType){
    if(!generatedBlob){toast("Prvo generiši grafiku.","error");return;}
    try{
      let blob=generatedBlob;
      let extension="png";
      if(mimeType==="image/jpeg"){
        const img=await blobToImage(generatedBlob);
        const canvas=document.createElement("canvas");
        canvas.width=img.naturalWidth||1080;
        canvas.height=img.naturalHeight||1350;
        const ctx=canvas.getContext("2d");
        ctx.fillStyle="#ffffff";
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        blob=await new Promise((resolve,reject)=>canvas.toBlob(
          value=>value?resolve(value):reject(new Error("JPG nije napravljen.")),
          "image/jpeg",0.92
        ));
        extension="jpg";
      }
      const safeName=(state.graphicHeadline.trim()||currentPlayer()?.name||"medjasi-grafika")
        .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
        .replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"medjasi-grafika";
      downloadBlob(blob,safeName+"."+extension);
      toast("Grafika je preuzeta kao "+extension.toUpperCase()+".");
    }catch(error){
      console.error("Graphic Engine export:",error);
      toast(error?.message||"Izvoz grafike nije uspio.","error");
    }
  }

  const PRESET_KEY="medjasi-graphic-engine-presets-v1";
  function readPresets(){
    try{
      const value=JSON.parse(localStorage.getItem(PRESET_KEY)||"{}");
      return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
    }catch(_){return {};}
  }

  function savePreset(){
    syncState();
    const presets=readPresets();
    const name=window.prompt("Naziv postavki predloška:","Moj predložak");
    if(name===null)return;
    const clean=name.trim().slice(0,60);
    if(!clean){toast("Unesi naziv postavki.","error");return;}
    if(presets[clean]&&!window.confirm("Postavke s tim nazivom već postoje. Želiš li ih zamijeniti?"))return;
    presets[clean]={
      template:state.template,graphicHeadline:state.graphicHeadline,graphicSubtitle:state.graphicSubtitle,
      matchHome:state.matchHome,matchOpponent:state.matchOpponent,matchScore:state.matchScore,matchDate:state.matchDate,matchVenue:state.matchVenue,accentColor:state.accentColor,
      photoZoom:state.photoZoom,photoFocusY:state.photoFocusY,photoShade:state.photoShade,fontFamily:state.fontFamily,
      destination:state.destination,caption:state.caption,title:state.title,body:state.body
    };
    try{
      localStorage.setItem(PRESET_KEY,JSON.stringify(presets));
      toast("Postavke „"+clean+"“ su sačuvane u ovom pregledniku.");
    }catch(error){
      console.error("Graphic Engine save preset:",error);
      toast("Postavke nije moguće sačuvati u ovom pregledniku.","error");
    }
  }

  function loadPreset(){
    const presets=readPresets();
    const names=Object.keys(presets);
    if(!names.length){toast("Još nema sačuvanih postavki.","info");return;}
    const choice=window.prompt("Upiši naziv postavki za učitavanje:\n"+names.join("\n"),names[0]);
    if(choice===null)return;
    const key=choice.trim(),preset=presets[key];
    if(!preset){toast("Postavke s tim nazivom nisu pronađene.","error");return;}
    if(preset.template&&$("graphicTemplate"))$("graphicTemplate").value=preset.template;
    if(preset.graphicHeadline!==undefined&&$("graphicHeadline"))$("graphicHeadline").value=preset.graphicHeadline;
    if(preset.graphicSubtitle!==undefined&&$("graphicSubtitle"))$("graphicSubtitle").value=preset.graphicSubtitle;
    if(preset.matchHome!==undefined&&$("graphicMatchHome"))$("graphicMatchHome").value=preset.matchHome;
    if(preset.matchOpponent!==undefined&&$("graphicMatchOpponent"))$("graphicMatchOpponent").value=preset.matchOpponent;
    if(preset.matchScore!==undefined&&$("graphicMatchScore"))$("graphicMatchScore").value=preset.matchScore;
    if(preset.matchDate!==undefined&&$("graphicMatchDate"))$("graphicMatchDate").value=preset.matchDate;
    if(preset.matchVenue!==undefined&&$("graphicMatchVenue"))$("graphicMatchVenue").value=preset.matchVenue;
    if(/^#[0-9a-f]{6}$/i.test(preset.accentColor||"")&&$("graphicAccentColor"))$("graphicAccentColor").value=preset.accentColor;
    if(Number.isFinite(Number(preset.photoZoom))&&$("graphicPhotoZoom"))$("graphicPhotoZoom").value=preset.photoZoom;
    if(Number.isFinite(Number(preset.photoFocusY))&&$("graphicPhotoFocusY"))$("graphicPhotoFocusY").value=preset.photoFocusY;
    if(Number.isFinite(Number(preset.photoShade))&&$("graphicPhotoShade"))$("graphicPhotoShade").value=preset.photoShade;
    if(["Arial","Impact","Georgia"].includes(preset.fontFamily)&&$("graphicFontFamily"))$("graphicFontFamily").value=preset.fontFamily;
    if(preset.destination&&$("graphicDestination"))$("graphicDestination").value=preset.destination;
    if(preset.caption!==undefined&&$("graphicCaption"))$("graphicCaption").value=preset.caption;
    if(preset.title!==undefined&&$("graphicNewsTitle"))$("graphicNewsTitle").value=preset.title;
    if(preset.body!==undefined&&$("graphicNewsBody"))$("graphicNewsBody").value=preset.body;
    markDesignDirty();
    if($("graphicNewsFields"))$("graphicNewsFields").hidden=state.destination!=="news";
    toast("Postavke „"+key+"“ su učitane. Ponovo generiši grafiku da primijeniš promjene.");
  }

  function markDesignDirty(){
    syncState();
    generatedBlob=null;
    revoke(generatedPreviewUrl);
    generatedPreviewUrl=null;
    const result=$("graphicResultPreview");
    if(result) result.hidden=true;
    $("graphicPublishBtn")?.setAttribute("disabled","");
    $("graphicExportPngBtn")?.setAttribute("disabled","");
    $("graphicExportJpegBtn")?.setAttribute("disabled","");
    const status=$("graphicStatus");
    if(status) status.textContent="Postavke su promijenjene. Ponovo generiši grafiku prije izvoza ili objave.";
  }

  function syncState(){
    state.playerId=$("graphicPlayer")?.value || "";
    state.template=$("graphicTemplate")?.value || "player";
    state.destination=$("graphicDestination")?.value || "community";
    state.title=$("graphicNewsTitle")?.value || "";
    state.caption=$("graphicCaption")?.value || "";
    state.body=$("graphicNewsBody")?.value || "";
    state.graphicHeadline=$("graphicHeadline")?.value || "";
    state.graphicSubtitle=$("graphicSubtitle")?.value || "";
    state.matchHome=$("graphicMatchHome")?.value || "MEĐASI";
    state.matchOpponent=$("graphicMatchOpponent")?.value || "";
    state.matchScore=$("graphicMatchScore")?.value || "";
    state.matchDate=$("graphicMatchDate")?.value || "";
    state.matchVenue=$("graphicMatchVenue")?.value || "";
    state.accentColor=$("graphicAccentColor")?.value || "#b7ff55";
    state.photoZoom=Number($("graphicPhotoZoom")?.value||1);
    state.photoFocusY=Number($("graphicPhotoFocusY")?.value||0);
    state.photoShade=Number($("graphicPhotoShade")?.value||.2);
    state.fontFamily=$("graphicFontFamily")?.value||"Arial";

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

          <div class="graphic-engine-editor-fields">
            <div class="form-group">
              <label for="graphicHeadline">Glavni naslov</label>
              <input id="graphicHeadline" maxlength="80" placeholder="Prazno = ime igrača ili podrazumijevani naslov">
            </div>
            <div class="form-group">
              <label for="graphicSubtitle">Podnaslov / dodatni tekst</label>
              <input id="graphicSubtitle" maxlength="100" placeholder="Prazno = podaci iz predloška">
            </div>
            <div class="form-group graphic-color-field">
              <label for="graphicAccentColor">Akcentna boja</label>
              <div class="graphic-color-control"><input id="graphicAccentColor" type="color" value="#b7ff55"><span>Boja detalja i naglasaka</span></div>
            </div>
          </div>

          <div class="graphic-engine-adjustments">
            <div class="form-group">
              <label for="graphicPhotoZoom">Uvećanje fotografije <span id="graphicPhotoZoomValue">1.0×</span></label>
              <input id="graphicPhotoZoom" type="range" min="1" max="1.8" step="0.05" value="1">
            </div>
            <div class="form-group">
              <label for="graphicPhotoFocusY">Položaj fotografije <span id="graphicPhotoFocusValue">0</span></label>
              <input id="graphicPhotoFocusY" type="range" min="-220" max="220" step="10" value="0">
            </div>
            <div class="form-group">
              <label for="graphicPhotoShade">Zatamnjenje fotografije <span id="graphicPhotoShadeValue">20%</span></label>
              <input id="graphicPhotoShade" type="range" min="0" max="0.6" step="0.05" value="0.2">
            </div>
            <div class="form-group">
              <label for="graphicFontFamily">Stil teksta</label>
              <select id="graphicFontFamily"><option value="Arial">Moderan</option><option value="Impact">Sportski / snažan</option><option value="Georgia">Klasičan</option></select>
            </div>
          </div>

          <div class="form-group">
            <label>Vrsta grafike</label>
            <select id="graphicTemplate">
              <option value="player"> Player Spotlight</option>
              <option value="mvp">⭐ MVP Lige</option>
              <option value="scorer"> Top Strijelac</option>
              <option value="matchday"> Matchday</option>
              <option value="matchresult"> Rezultat utakmice</option>
              <option value="upcoming"> Najava utakmice</option>
              <option value="winner"> Winner</option>
              <option value="lineup"> Starting Five</option>
              <option value="transfer"> Player Announcement</option>
              <option value="birthday"> Sretan rođendan</option>
              <option value="spotlight"> U fokusu</option>
              <option value="fan"> Fan Favorite</option>
              <option value="captain">© Kapiten</option>
              <option value="legend"> Legenda lige</option>
            </select>
          </div>

          <div class="graphic-engine-match-fields">
            <div class="form-group"><label for="graphicMatchHome">Domaća ekipa</label><input id="graphicMatchHome" maxlength="30" value="MEĐASI" placeholder="MEĐASI"></div>
            <div class="form-group"><label for="graphicMatchOpponent">Protivnik</label><input id="graphicMatchOpponent" maxlength="30" placeholder="Naziv protivnika"></div>
            <div class="form-group"><label for="graphicMatchScore">Rezultat</label><input id="graphicMatchScore" maxlength="12" placeholder="4 : 2"></div>
            <div class="form-group"><label for="graphicMatchDate">Datum / vrijeme</label><input id="graphicMatchDate" maxlength="50" placeholder="13.10.2026. · 20:00"></div>
            <div class="form-group"><label for="graphicMatchVenue">Dvorana / lokacija</label><input id="graphicMatchVenue" maxlength="50" placeholder="Sportska dvorana"></div>
            <p class="graphic-engine-help muted">Ova polja koriste se za „Rezultat utakmice“ i „Najava utakmice“.</p>
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
          <div class="graphic-engine-actions graphic-export-actions">
            <button id="graphicExportPngBtn" type="button" class="btn btn-blue" disabled>Preuzmi PNG</button>
            <button id="graphicExportJpegBtn" type="button" class="btn btn-blue" disabled>Preuzmi JPG</button>
            <button id="graphicSavePresetBtn" type="button" class="btn btn-green">Sačuvaj postavke</button>
            <button id="graphicLoadPresetBtn" type="button" class="btn btn-blue">Učitaj postavke</button>
          </div>
          <p class="graphic-engine-help muted">Postavke predloška čuvaju se lokalno u ovom pregledniku. Originalna fotografija se ne mijenja.</p>

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
    $("graphicExportPngBtn")?.addEventListener("click",()=>exportGraphic("image/png"));
    $("graphicExportJpegBtn")?.addEventListener("click",()=>exportGraphic("image/jpeg"));
    $("graphicSavePresetBtn")?.addEventListener("click",savePreset);
    $("graphicLoadPresetBtn")?.addEventListener("click",loadPreset);
    $("graphicHeadline")?.addEventListener("input",markDesignDirty);
    $("graphicSubtitle")?.addEventListener("input",markDesignDirty);
    ["graphicMatchHome","graphicMatchOpponent","graphicMatchScore","graphicMatchDate","graphicMatchVenue"].forEach(id=>$(id)?.addEventListener("input",markDesignDirty));
    $("graphicAccentColor")?.addEventListener("input",markDesignDirty);
    $("graphicTemplate")?.addEventListener("change",markDesignDirty);
    ["graphicPhotoZoom","graphicPhotoFocusY","graphicPhotoShade","graphicFontFamily"].forEach(id=>$(id)?.addEventListener("input",()=>{
      if($("graphicPhotoZoomValue"))$("graphicPhotoZoomValue").textContent=Number($("graphicPhotoZoom")?.value||1).toFixed(2)+"×";
      if($("graphicPhotoFocusValue"))$("graphicPhotoFocusValue").textContent=$("graphicPhotoFocusY")?.value||"0";
      if($("graphicPhotoShadeValue"))$("graphicPhotoShadeValue").textContent=Math.round(Number($("graphicPhotoShade")?.value||0)*100)+"%";
      markDesignDirty();
    }));
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
