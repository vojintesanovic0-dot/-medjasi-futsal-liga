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
page.on("pageerror",error=>pageErrors.push(error.stack||error.message));
page.on("response",response=>{if(response.url().startsWith(base)&&response.status()>=400)missingAssets.push(response.status()+" "+response.url());});
async function navButton(target){
  const index=await page.locator("#mainNav button").evaluateAll((buttons,id)=>buttons.findIndex(b=>(b.getAttribute("onclick")||"").includes("showSection('"+id+"')")),target);
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
  for(const id of ["home","matches","table","teams","players","stats","gallery","community","chat","news","game","info"])await clickSection(id);
  await page.locator("#headerAccount button").filter({hasText:"Prijava"}).first().click();
  await page.waitForFunction(()=>!!document.querySelector("#login.section.active"),null,{timeout:5000});
  await page.locator(".auth-return-btn").click();
  await page.waitForFunction(()=>!!document.querySelector("#home.section.active"),null,{timeout:5000});
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#mobileMenuBtn").waitFor({timeout:10000});
  await page.locator("#game.section").waitFor({state:"attached",timeout:15000});
  await page.locator("#mobileMenuBtn").click();
  await page.waitForFunction(()=>document.querySelector("#mainNav")?.classList.contains("mobile-open"),null,{timeout:5000});
  await clickSection("matches");
  await page.waitForFunction(()=>!document.querySelector("#mainNav")?.classList.contains("mobile-open"),null,{timeout:5000});
  assert.equal(missingAssets.length,0,"Missing local assets:\n"+missingAssets.join("\n"));
  assert.equal(pageErrors.length,0,"Uncaught browser JavaScript errors:\n"+pageErrors.join("\n"));
  console.log("PASS browser smoke: 12 desktop navigation targets, login cancel, mobile drawer open/close, no uncaught JS errors, no missing local assets");
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}
