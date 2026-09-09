import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';
import {SHEETS,POSES,countAnchors} from './anchors.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
for(const [cls,s]of Object.entries(SHEETS))for(const [i,f]of s.frames.entries()){
 assert.equal(s.frames.length,7);assert.equal(countAnchors(f),cls==='rogue'?8:cls==='herald'?4:6);
 const box=[i%4*s.size[0]/4,Math.floor(i/4)*s.size[1]/2,s.size[0]/4,s.size[1]/2];
 for(const p of [...f.weapons.flatMap(w=>[w.handle,w.tip]),...Object.values(f.hands).flatMap(h=>[h.left,h.right])])assert.ok(p[0]>=box[0]&&p[0]<box[0]+box[2]&&p[1]>=box[1]&&p[1]<box[1]+box[3],`${cls}/${i} anchor outside cell`);
}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1380,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('art/combined-reference/inspection',{recursive:true});
try{
 await page.goto('http://127.0.0.1:4291/combined-reference-preview.html');
 for(const cls of Object.keys(SHEETS)){
  await page.locator(`[data-class="${cls}"]`).click();await page.waitForLoadState('networkidle');
  for(const pose of POSES){await page.locator('#pose').selectOption(pose);assert.equal(await page.locator('#combined circle').count(),cls==='rogue'?8:cls==='herald'?4:6);}
  await page.locator('#pose').selectOption('attack3');await page.screenshot({path:`art/combined-reference/inspection/${cls}.png`,fullPage:true});
 }
 await page.locator('#anchors').uncheck();assert.equal(await page.locator('#combined circle').count(),0);
 await page.locator('#axis').uncheck();assert.equal(await page.locator('#combined line').count(),0);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'art/combined-reference/inspection/phone.png',fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);assert.deepEqual(errors,[]);
 await writeFile('art/combined-reference/inspection/check.json',JSON.stringify({poses:28,anchorCounts:true,toggles:true,phoneOverflow:overflow,errors},null,2));console.log('28 poses checked; anchor counts, cell bounds, toggles and phone layout pass.');
}finally{await browser.close()}
