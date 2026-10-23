import{createRequire}from'node:module';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
import{launchBrowser}from'./browser.mjs';
import{classSmashAnimations}from'../src/content/classSmashAnimations.js';
import{auraFilter}from'../src/ui/combatAura.js';
const{chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE||'http://127.0.0.1:4402';
const owner=await launchBrowser({browser:'/usr/bin/chromium',prefix:'class-smash-pixels-'}),browser=await chromium.connectOverCDP(owner.wsUrl);
try{const page=await browser.newPage();await page.goto(base+'/pose-studio/stances/class-smash/review/index.html');
const results=await page.evaluate(async ({catalog,filters})=>{
 const{createAlternativeAuraRenderer}=await import('/src/ui/alternativeAuraRenderer.js');const results=[];
 for(const [actor,entry]of Object.entries(catalog.classes))for(const[key,frame]of Object.entries(entry.frames)){
  const image=new Image();image.src='/'+frame.path;await image.decode();
  const canvases=[document.createElement('canvas'),document.createElement('canvas')];for(const c of canvases){c.width=768;c.height=600;}
  const plain=createAlternativeAuraRenderer({canvasWidth:768,canvasHeight:600}),reuse=createAlternativeAuraRenderer({canvasWidth:768,canvasHeight:600});
  const x=frame.drawOffset[0],y=frame.drawOffset[1]+60,[w,h]=frame.size;
  for(const[index,filter]of filters.entries()){
   const dx=x+(index?5.25:0),dy=y-(index?7.5:0);
   const contexts=canvases.map(c=>c.getContext('2d',{willReadFrequently:true}));
   contexts.forEach(c=>c.clearRect(0,0,768,600));plain.draw(contexts[0],image,filter,dx,dy,w,h,{materialize:true});
   reuse.draw(contexts[1],image,filter,dx,dy,w,h,{reuse:true,materialize:true});contexts[1].clearRect(0,0,768,600);reuse.draw(contexts[1],image,filter,dx,dy,w,h,{reuse:true,materialize:true});
   const bytes=contexts.map(c=>c.getImageData(0,0,768,600).data);let different=0;for(let i=0;i<bytes[0].length;i++)if(bytes[0][i]!==bytes[1][i])different++;
   results.push({actor,key,filter,different});
  }
  plain.dispose();reuse.dispose();
 }
 return results;
},{catalog:classSmashAnimations,filters:[auraFilter('class-smash-impact','smash',['stamina'],true),auraFilter('power2','idle',['stamina','mana'],true)]});for(const r of results)assert.equal(r.different,0,r.actor+' '+r.key+' exact uncached vs cached RGBA');writeFileSync(process.env.QA_PIXEL_RESULT||'/tmp/class-smash-pixel-results.json',JSON.stringify({checks:results.length,results},null,2));console.log(JSON.stringify({checks:results.length,allPixelsEqual:true}));
}finally{await browser.close();await owner.close();}
