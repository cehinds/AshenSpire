import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output=resolve(process.env.SIGIL_QA_OUT || 'docs/qa/combat-card-sigils');
mkdirSync(output,{recursive:true});
const server=await serve({root:process.cwd(),port:0,open:false});
const launched=await launchBrowser({prefix:'sigil-',browser:process.env.CHROME,args:['--disable-background-mode']});
const browser=await chromium.connectOverCDP(launched.wsUrl);
const base=`http://localhost:${server.server.address().port}`;
const report={source:process.env.SIGIL_SOURCE_SHA || null,devices:[]};
async function readyImages(page){
 await page.evaluate(async()=>{
  await Promise.all([...document.images].filter(img=>img.getBoundingClientRect().width>0).map(img=>img.decode().catch(()=>{})));
 });
 const broken=await page.locator('img').evaluateAll(images=>images.filter(img=>img.getBoundingClientRect().width>0&&(!img.complete||img.naturalWidth===0)).map(img=>img.src));
 assert.deepEqual(broken,[],'visible card artwork loaded');
}
try {
 for(const phone of [false,true]){
  const name=phone?'phone':'desktop';
  const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:1000},isMobile:phone,hasTouch:phone});
  const page=await context.newPage();const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400 && new URL(r.url()).origin===base)failed.push(`${r.status()} ${r.url()}`);});
  await page.goto(base+'/index.html?shot=combat',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForSelector('.hand .card [data-primary-sigil]');
  assert.equal(await page.evaluate(()=>window.__combat.combatExpansionVersion),2,'live fixture uses expanded combat');
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(800);
  await readyImages(page);
  await page.screenshot({path:resolve(output,name+'-combat.png')});
  const beforeInspect=await page.evaluate(()=>JSON.stringify({plays:window.__combat.eventLog.filter(e=>e.type==='cardPlayed'),energy:window.__combat.player.energy,mana:window.__combat.player.mana,stamina:window.__combat.player.stamina}));
  const card=page.locator('.hand .card').last(),glyph=card.locator('.combat-sigil-action');
  if(phone)await glyph.tap();else await glyph.click();
  assert.ok(await card.locator('.card-info-button').isVisible(),'sigil tap selects the card');
  if(phone)await card.locator('.card-info-button').tap();else await card.locator('.card-info-button').click();
  await page.locator('.card-inspection-modal .inspection-sigils').waitFor();
  assert.ok((await page.locator('.card-inspection-modal .inspection-sigils').innerText()).length>15);
  await page.screenshot({path:resolve(output,name+'-inspection.png')});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.card-inspection-modal').count(),0);
  assert.ok(await page.evaluate(()=>document.activeElement.matches('.card, .card-info-button')),'focus returned');
  assert.equal(await page.evaluate(()=>JSON.stringify({plays:window.__combat.eventLog.filter(e=>e.type==='cardPlayed'),energy:window.__combat.player.energy,mana:window.__combat.player.mana,stamina:window.__combat.player.stamina})),beforeInspect,'inspection spends no resources and plays no card');
  const refs=await page.evaluate(async()=>{
   const {contentBundle}=await import('/src/content/index.js');
   const {createRegistries,resolveCard}=await import('/src/model/registries.js');
   const {renderCard,scheduleCardFits}=await import('/src/ui/components/card.js');
   const {playingCardModel}=await import('/src/model/playingCard.js');
   const registries=createRegistries(contentBundle);
   const refs=contentBundle.cards.flatMap(c=>[
    {cardId:c.id}, {cardId:c.id,upgraded:true},
    ...(c.gradeProfiles||[]).map((p,abilityRank)=>({cardId:c.id,abilityRank})),
   ]);
   for(const p of registries.equipment.basicCardProfiles||[])refs.push({cardId:p.role==='defend'?'defend':'strike',profileId:p.id});
   const picked=[],actions=new Set(),schools=new Set();let corrupted=false,rankFive=false;
   for(const ref of refs){
    const model=playingCardModel(registries,ref),identity=model.sigils,def=resolveCard(registries,ref);
    if(!actions.has(identity.action)||(identity.school&&!schools.has(identity.school))||(def.corrupted&&!corrupted)||(model.abilityRank===5&&!rankFive)){
     picked.push(ref);actions.add(identity.action);if(identity.school)schools.add(identity.school);
     if(def.corrupted)corrupted=true;if(model.abilityRank===5)rankFive=true;
    }
   }
   const ordered=[...picked,...refs.filter(ref=>!picked.includes(ref))];
   const app=document.querySelector('#app');app.replaceChildren();
   const style=document.createElement('style');style.textContent='.sigil-corpus{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:28px;padding:35px 20px;background:#1d1712;width:100%;box-sizing:border-box}.sigil-corpus .card{width:100%!important;max-width:200px!important;margin:auto}.sigil-corpus:not([data-corpus-expanded]) .card[data-qa-deferred="true"]{display:none!important}@media(max-width:500px){.sigil-corpus{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.append(style);
   const gallery=document.createElement('div');gallery.className='sigil-corpus';app.append(gallery);
   ordered.forEach((ref,index)=>{const card=renderCard(registries,ref,{level:'inspect',inspection:false});card.dataset.qaRef=JSON.stringify(ref);card.dataset.qaDeferred=String(index>=picked.length);gallery.append(card);});
   scheduleCardFits(gallery.querySelectorAll('.card'));
   return refs.length;
  });
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>[...document.querySelectorAll('.sigil-corpus .card')].filter(card=>card.getBoundingClientRect().width>0).every(card=>card.querySelector('[data-card-binding="rules"]').dataset.rulesComplete==='true'));
  await readyImages(page);
  await page.screenshot({path:resolve(output,name+'-sigil-gallery.png'),fullPage:true});
  await page.evaluate(async()=>{const gallery=document.querySelector('.sigil-corpus');gallery.dataset.corpusExpanded='true';const {scheduleCardFits}=await import('/src/ui/components/card.js');scheduleCardFits(gallery.querySelectorAll('.card'));});
  await page.waitForFunction(()=>[...document.querySelectorAll('.sigil-corpus [data-card-binding="rules"]')].every(text=>text.dataset.rulesComplete==='true'));
  const geometry=await page.locator('.sigil-corpus .card').evaluateAll(cards=>cards.map(c=>{
   const text=c.querySelector('[data-card-binding="rules"]'),title=c.querySelector('[data-card-binding="name"]');
   const r=text.getBoundingClientRect(),top=title.getBoundingClientRect();
   return {ref:c.dataset.qaRef,action:c.querySelector('[data-primary-sigil]').dataset.primarySigil,
    school:c.querySelector('.combat-sigil-school')?.dataset.sigil||null,
    clipped:text.scrollHeight>text.parentElement.clientHeight+1||text.scrollWidth>text.clientWidth+1,
    overlapsTitle:r.top<top.bottom-1,font:Number.parseFloat(getComputedStyle(text).fontSize),
    expanded:c.querySelector('.illustrated-card-face').dataset.rulesExpanded==='true',
    accessibleName:c.getAttribute('aria-label'),
    actionName:c.querySelector('.combat-sigil-action').getAttribute('aria-label'),
    schoolName:c.querySelector('.combat-sigil-school')?.getAttribute('aria-label')||null,
    extraTabStops:c.querySelectorAll('.combat-sigil[tabindex],.combat-sigil svg[tabindex]').length};
  }));
  await page.screenshot({path:resolve(output,name+'-cards.png'),clip:{x:0,y:0,width:phone?390:1440,height:phone?844:1000}});
  const bad=geometry.filter(g=>g.clipped||g.overlapsTitle);
  writeFileSync(resolve(output,name+'-geometry.json'),JSON.stringify(geometry,null,2)+'\n');
  assert.equal(bad.length,0,JSON.stringify(bad.slice(0,6)));
  assert.equal(new Set(geometry.map(g=>g.action)).size,10,'all primary actions covered');
  assert.equal(new Set(geometry.map(g=>g.school).filter(Boolean)).size,8,'all spell schools covered');
  assert.ok(geometry.every(g=>g.accessibleName?.includes(g.actionName)&&(!g.schoolName||g.accessibleName.includes(g.schoolName))),'card names expose action and school');
  assert.ok(geometry.every(g=>g.extraTabStops===0),'sigils add no keyboard stops');
  assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(failed.filter(f=>!f.includes('favicon')).length,0,failed.join('\n'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  report.devices.push({name,refs,fullyReadable:geometry.length,expanded:geometry.filter(g=>g.expanded).length,minFont:Math.min(...geometry.map(g=>g.font)),actions:[...new Set(geometry.map(g=>g.action))],schools:[...new Set(geometry.map(g=>g.school).filter(Boolean))],errors,failed});
  console.log(`${name}: ${refs} complete native faces`);
  await context.close();
 }
 writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
}finally{
 try{const session=await browser.newBrowserCDPSession();await session.send('Browser.close');}catch{}
 await browser.close();
 // Edge background children can retain the launcher's output pipes after the
 // debugging endpoint closes. Release this run's pipes before joining it.
 launched.child.stdout?.destroy();launched.child.stderr?.destroy();
 await launched.close();
 server.server.closeAllConnections?.();server.server.close();
}
