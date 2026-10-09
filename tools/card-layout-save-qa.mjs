import assert from 'node:assert/strict';
import {mkdirSync,existsSync,readdirSync,copyFileSync,cpSync,symlinkSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {serve} from './serve.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve(process.env.CARD_EDITOR_OUT||'docs/qa/card-layers/save-evidence'),root=join(output,'workspace'),source=process.cwd();
mkdirSync(join(root,'src'),{recursive:true});
for(const entry of readdirSync(join(source,'src'),{withFileTypes:true})){const from=join(source,'src',entry.name),to=join(root,'src',entry.name);if(entry.name==='content')cpSync(from,to,{recursive:true});else if(!existsSync(to)){if(entry.isDirectory())symlinkSync(from,to,'junction');else copyFileSync(from,to);}}
for(const name of ['docs','styles','.art-cache'])if(!existsSync(join(root,name)))symlinkSync(join(source,name),join(root,name),'junction');
for(const name of ['art-release.json','art-manifest.json','index.html'])copyFileSync(join(source,name),join(root,name));
const server=await serve({root,port:0,open:false,editorWrite:true,quiet:true}),base=server.url;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME});
try{
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('response',async r=>{if(r.url().endsWith('/__editor/card-layout')&&r.status()>=400)console.log('SAVE RESPONSE',r.status(),await r.text());});
 await page.goto(base+'docs/qa/card-layers/index.html',{waitUntil:'networkidle'});await page.locator('.edit-plane[data-edit-part="rank-bar"]').waitFor();await page.locator('.edit-save').filter({hasText:'Connected to game JSON'}).waitFor();
 const ids=['panel','panel-trim','rules','rank-bar','rank-text'];
 const geometry=()=>page.evaluate(ids=>{const canvas=document.querySelector('.edit-canvas').getBoundingClientRect(),unit=canvas.width/360;return Object.fromEntries(ids.map(id=>{const r=document.querySelector(`.edit-plane[data-edit-part="${id}"] [data-explorer-part="${id}"]`).getBoundingClientRect();return [id,{x:(r.x-canvas.x)/unit,y:(r.y-canvas.y)/unit,w:r.width/unit,h:r.height/unit}];}));},ids);
 await page.locator('[data-select-part="panel"]').click();assert.equal(await page.locator('[data-select-part][aria-pressed="true"]').count(),5,'selecting textbox selects rank, trim and rules');
 await page.locator('#edit-snap').uncheck();await page.locator('.edit-canvas').scrollIntoViewIfNeeded();
 const before=await geometry(),canvas=await page.locator('.edit-canvas').boundingBox(),unit=canvas.width/360;
 await page.mouse.move(canvas.x+(before.panel.x+before.panel.w/2)*unit,canvas.y+(before.panel.y+before.panel.h/2)*unit);await page.mouse.down();await page.mouse.move(canvas.x+(before.panel.x+before.panel.w/2+8)*unit,canvas.y+(before.panel.y+before.panel.h/2-14)*unit,{steps:5});await page.mouse.up();
 const moved=await geometry();for(const id of ids){assert.ok(Math.abs(moved[id].x-before[id].x-8)<1,id+' follows X');assert.ok(Math.abs(moved[id].y-before[id].y+14)<1,id+' follows Y');}
 const h=await page.locator('.handle-se').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2-24*unit,h.y+h.height/2-10*unit,{steps:5});await page.mouse.up();
 const scaled=await geometry();for(const id of ids){assert.ok(Math.abs((scaled[id].x-scaled.panel.x)/scaled.panel.w-(moved[id].x-moved.panel.x)/moved.panel.w)<.005,id+' horizontal anchor');assert.ok(Math.abs((scaled[id].y-scaled.panel.y)/scaled.panel.h-(moved[id].y-moved.panel.y)/moved.panel.h)<.005,id+' vertical anchor');}
 const oldRevision=(await (await fetch(base+'__editor/card-layout')).json()).revision;
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/__editor/card-layout')&&r.request().method()==='POST');await page.locator('[data-edit="save-game"]').click();const response=await responsePromise;assert.equal(response.status(),200);await page.waitForEvent('load');await page.locator('.edit-plane[data-edit-part="rank-bar"]').waitFor();
 const saved=JSON.parse(readFileSync(join(root,'src/content/card-layout.json'),'utf8'));assert.ok(saved.layouts.shared.panel);assert.deepEqual(saved.order,[9,8,7,5,6,4,3,2,1]);
 assert.match(readFileSync(join(root,'src/content/cardComponents.generated.js'),'utf8'),/"groups":/);
 const after=await geometry();for(const id of ids)for(const key of ['x','y','w','h'])assert.ok(Math.abs(after[id][key]-scaled[id][key])<2,`${id} ${key} round trip: ${after[id][key]} vs ${scaled[id][key]}`);
 // A fresh native game gallery reads the saved master, without editor storage.
 await page.goto(base+'docs/qa/card-rank-layers/preview.html',{waitUntil:'networkidle'});
 const checks=await page.locator('.sample .card').evaluateAll(cards=>cards.map(c=>{const rank=c.querySelector('.card-rank'),panel=c.querySelector('[data-component="panel"]'),rules=c.querySelector('[data-card-binding="rules"]'),r=rank?.getBoundingClientRect(),p=panel.getBoundingClientRect(),t=rules.getBoundingClientRect();return {rank:Number(c.dataset.exampleRank),label:rank?.textContent||null,anchor:r?(r.y-p.y)/p.width:null,overlap:r?r.bottom>t.top+1:false,clipped:rules.scrollHeight>rules.parentElement.clientHeight+1};}));
 assert.equal(checks[0].label,null);assert.ok(checks.slice(1).every(c=>c.label==='Rank '+c.rank&&!c.overlap&&!c.clipped),JSON.stringify(checks));assert.ok(Math.max(...checks.slice(1).map(c=>c.anchor))-Math.min(...checks.slice(1).map(c=>c.anchor))<.01,'expanded panels preserve rank top-edge anchor');
 await page.screenshot({path:join(output,'saved-native-cards.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{const {scheduleCardFits}=await import('/src/ui/components/card.js');scheduleCardFits(document.querySelectorAll('.card'));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});await page.screenshot({path:join(output,'saved-native-phone.png'),fullPage:true});
 const stale=await fetch(base+'__editor/card-layout',{method:'POST',headers:{Origin:base.slice(0,-1),'Content-Type':'application/json'},body:JSON.stringify({revision:oldRevision,document:saved})});assert.equal(stale.status,400,'stale writes rejected');
 const disallowed=await fetch(base+'__editor/card-layout',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'});assert.equal(disallowed.status,403);
 await page.goto(base+'docs/qa/card-layers/index.html',{waitUntil:'networkidle'});const exportedSave=page.waitForResponse(r=>r.url().endsWith('/__editor/card-layout')&&r.request().method()==='POST');const download=page.waitForEvent('download');await page.locator('[data-edit="export"]').click();const file=await download;assert.equal((await exportedSave).status(),200);await file.saveAs(join(output,'exported-game-layout.json'));assert.deepEqual(JSON.parse(readFileSync(join(output,'exported-game-layout.json'),'utf8')),JSON.parse(readFileSync(join(root,'src/content/card-layout.json'),'utf8')));
 assert.deepEqual(errors,[]);console.log('PASS grouped move/scale, exact game-JSON save + regeneration + reload, fresh native cards, expanded-panel anchors, desktop/phone, stale/origin protection, export saves game.');
}finally{await browser.close();server.server.closeAllConnections?.();server.server.close();}
