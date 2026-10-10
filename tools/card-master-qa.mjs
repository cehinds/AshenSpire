import assert from 'node:assert/strict';
import {mkdirSync,existsSync,readdirSync,copyFileSync,cpSync,symlinkSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {serve} from './serve.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve(process.env.CARD_MASTER_OUT||'docs/qa/card-layers/master-evidence'),root=join(output,'workspace'),source=process.cwd();
mkdirSync(join(root,'src'),{recursive:true});
for(const entry of readdirSync(join(source,'src'),{withFileTypes:true})){const from=join(source,'src',entry.name),to=join(root,'src',entry.name);if(entry.name==='content')cpSync(from,to,{recursive:true});else if(!existsSync(to)){if(entry.isDirectory())symlinkSync(from,to,'junction');else copyFileSync(from,to);}}
for(const name of ['docs','styles','.art-cache','assets-display'])if(!existsSync(join(root,name)))symlinkSync(join(source,name),join(root,name),'junction');
for(const name of ['art-release.json','art-manifest.json','index.html'])copyFileSync(join(source,name),join(root,name));
mkdirSync(join(root,'assets/card-components'),{recursive:true});
const image='assets/card-components/qa-master.png';
writeFileSync(join(root,image),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
const server=await serve({root,port:0,open:false,editorWrite:true,quiet:true}),base=server.url;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'docs/qa/card-layers/index.html#editor',{waitUntil:'domcontentloaded'});
 await page.locator('.edit-save').filter({hasText:'Connected to game JSON'}).waitFor({timeout:120000});
 await page.locator('[data-visual-part]').selectOption('action-icon');await page.locator('[data-visual-href]').fill(image);await page.locator('[data-visual-apply]').click();
 assert.equal(await page.locator('.edit-plane[data-edit-part="action-icon"] .combat-sigil-action img').count(),1,'PNG visible in draft');
 const response=page.waitForResponse(r=>r.url().endsWith('/__editor/card-layout')&&r.request().method()==='POST');await page.locator('[data-edit="save-game"]').click();assert.equal((await response).status(),200);await page.waitForEvent('load');
 const file=join(root,'src/content/card-layout.json'),doc=JSON.parse(readFileSync(file,'utf8'));assert.equal(doc.components['action-icon'].href,image);
 // Edit the master on disk: the source server must regenerate it on refresh.
 doc.components.title.style.color='#55ff88';doc.components['footer-trim'].href=image;doc.components['rank-bar'].href=image;doc.components['rank-bar'].style={};
 writeFileSync(file,JSON.stringify(doc,null,2)+'\n');
 await page.goto(base+'index.html?shot=combat',{waitUntil:'domcontentloaded'});try{await page.locator('.hand .card .combat-sigil-action img').first().waitFor({timeout:120000});}catch(error){console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1500)}));await page.screenshot({path:join(output,'failed-game.png')});throw error;}
 const cards=page.locator('.hand .card');assert.ok(await cards.count()>0);
 const live=await cards.evaluateAll(cards=>cards.map(card=>({name:card.querySelector('[data-card-binding="name"]').textContent,color:getComputedStyle(card.querySelector('[data-card-binding="name"]')).color,rules:card.querySelector('[data-card-binding="rules"]').textContent,icon:card.querySelector('.combat-sigil-action img')?.getAttribute('src'),frame:card.querySelector('.card-base-action-frame image')?.getAttribute('href')})));
 assert.ok(live.every(c=>c.name&&c.rules&&c.color==='rgb(85, 255, 136)'&&c.icon.includes('qa-master.png')&&c.frame.includes('qa-master.png')),JSON.stringify(live));
 assert.ok(await cards.first().locator('.combat-sigil-action img').evaluate(async img=>{await img.decode();return img.naturalWidth>0;}));
 console.log('PASS editor PNG change, saved visual configuration, direct master JSON refresh, real combat cards, live text bindings.');
 // Restore the intended template for screenshots: test overrides stay isolated.
 cpSync(join(source,'src/content'),join(root,'src/content'),{recursive:true});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.hand .card [data-rules-complete="true"]').first().waitFor({timeout:120000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().width>0).map(i=>i.decode().catch(()=>{})));});
 await page.screenshot({path:join(output,'game-desktop.png')});
 const last=cards.last(),glyph=await last.locator('.combat-sigil-action').boundingBox();await page.mouse.click(glyph.x+glyph.width/2,glyph.y+glyph.height/2);await last.locator('.card-info-button').click();await page.locator('.card-inspection-modal').waitFor();await page.screenshot({path:join(output,'game-inspection.png')});await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,'game-phone.png')});
 assert.deepEqual(errors,[]);console.log('PASS native in-game desktop, phone and inspection screenshots; no page errors.');
}finally{await browser.close();server.server.closeAllConnections?.();server.server.close();}
