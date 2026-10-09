import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output=resolve(process.env.SIGIL_QA_OUT || 'docs/qa/combat-card-sigils');
mkdirSync(output,{recursive:true});
const server=await serve({root:process.cwd(),port:0,open:false});
const launched=await launchBrowser({prefix:'sigil-',browser:process.env.CHROME,args:['--disable-background-mode']});
const browser=await chromium.connectOverCDP(launched.wsUrl);
const base=`http://localhost:${server.server.address().port}`;
const standalone=process.argv.includes('--standalone');
const report={source:process.env.SIGIL_SOURCE_SHA || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),uncommittedChanges:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),build:process.env.SIGIL_BUILD_VERSION || null,surface:standalone?'standalone':'source',devices:[]};
// audio.js deliberately probes optional SFX samples and synthesizes missing
// cues. Retain these requests in the report; required art and code must load.
const requiredFailures=failed=>failed.filter(f=>!f.includes('favicon')&&!/^404 .*\/assets\/sfx\/[^/]+\.ogg$/.test(f));
function cardGeometry(cards){return cards.map(c=>{
 const text=c.querySelector('[data-card-binding="rules"]'),title=c.querySelector('[data-card-binding="name"]');
 const r=text.getBoundingClientRect(),top=title.getBoundingClientRect(),face=c.querySelector('.illustrated-card-face').getBoundingClientRect(),panel=c.querySelector('[data-component="panel"]')?.getBoundingClientRect(),damage=c.querySelector('.card-damage-types'),words=c.querySelector('.card-sigil-band')?.getBoundingClientRect(),rail=c.querySelector('.card-tag-rail')?.getBoundingClientRect();
 const fade=c.querySelector('.card-title-fade')?.getBoundingClientRect();
 const rankNode=c.querySelector('.card-rank'),rank=rankNode?.getBoundingClientRect(),trim=c.querySelector('[data-component="panel-trim"]')?.getBoundingClientRect();
 return {ref:c.dataset.qaRef||c.dataset.cardId,action:c.querySelector('[data-primary-sigil]').dataset.primarySigil,
  titleCovered:!!fade&&fade.left<=top.left+1&&fade.right>=top.right-1&&fade.top<=top.top+1&&fade.top+fade.height*.48>=top.bottom-1,
  school:c.dataset.combatSchool||null,
  rankLabel:rankNode?.textContent||null,
  rankInvalid:!!rank&&(!/^Rank [1-9]\d*$/.test(rankNode.textContent)||rank.bottom>r.top+1||rank.top<top.bottom-1||(rail&&rank.top<rail.bottom-1&&rank.right>rail.left+1&&rank.left<rail.right-1)||Math.abs((rank.left+rank.right-face.left-face.right)/2)>1),
  trimDetached:!!trim&&!!panel&&(Math.abs(trim.top-panel.top)>1||Math.abs(trim.height-panel.height)>1),
  sideTags:c.querySelectorAll('.card-tag-symbol').length,
  railOverlap:!!rail && rail.bottom>Math.min(r.top,panel?.top??r.top)+1,
  footerLabel:c.querySelector('.card-type-name')?.textContent,
  clipped:text.scrollHeight>text.parentElement.clientHeight+1||text.scrollWidth>text.clientWidth+1,
  overlapsTitle:Math.min(r.top,panel?.top??r.top)<top.bottom-1,font:Number.parseFloat(getComputedStyle(text).fontSize),ruleTop:r.top-face.top,titleBottom:top.bottom-face.top,panelTop:panel?.top-face.top,
  damageTypes:damage?.textContent.split(' · ')||[],
  footerOutside:!!words&&(words.bottom>face.bottom+1||words.left<face.left-1||words.right>face.right+1||words.top<r.bottom-1),
  expanded:c.querySelector('.illustrated-card-face').dataset.rulesExpanded==='true',
  accessibleName:c.getAttribute('aria-label'),actionName:c.querySelector('.combat-sigil-action').getAttribute('aria-label'),
  schoolName:c.querySelector('.combat-sigil-school')?.getAttribute('aria-label')||null,
  extraTabStops:c.querySelectorAll('.combat-sigil[tabindex],.combat-sigil svg[tabindex]').length};
 });}
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
  await page.goto(base+(standalone?'/AshenSpire.html':'/index.html')+'?shot=combat',{waitUntil:'commit',timeout:120000});
  console.log(`${name}: page connected`);
  page.on('console', msg=>{if(msg.type()==='error')console.error(msg.text());});
  try { await page.waitForSelector('.hand .card [data-primary-sigil]',{timeout:120000}); }
  catch(error){
   await page.screenshot({path:resolve(output,name+'-failure.png')});
   console.error(JSON.stringify({url:page.url(),errors,failed,body:(await page.locator('body').innerText()).slice(0,2000)}));
   throw error;
  }
  console.log(`${name}: hand ready`);
  assert.equal(await page.evaluate(()=>window.__combat.combatExpansionVersion),2,'live fixture uses expanded combat');
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(800);
  await readyImages(page);
  await page.screenshot({path:resolve(output,name+'-combat.png')});
  const beforeInspect=await page.evaluate(()=>JSON.stringify({plays:window.__combat.eventLog.filter(e=>e.type==='cardPlayed'),energy:window.__combat.player.energy,mana:window.__combat.player.mana,stamina:window.__combat.player.stamina}));
  const card=page.locator('.hand .card').last(),glyph=card.locator('.combat-sigil-action');
  // The native hand hit lane intentionally owns pointer events over the face.
  // Tap the mark's screen position through that lane, as a player does.
  const mark = await glyph.boundingBox(), point={x:mark.x+mark.width/2,y:mark.y+mark.height/2};
  if(phone)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  assert.ok(await card.locator('.card-info-button').isVisible(),'sigil tap selects the card');
  if(phone)await card.locator('.card-info-button').tap();else await card.locator('.card-info-button').click();
  await page.locator('.card-inspection-modal .inspection-sigils').waitFor();
  assert.ok((await page.locator('.card-inspection-modal .inspection-sigils').innerText()).length>15);
  // The modal can exist while its entrance fade is still painting. Capture
  // the stable face after finite animations on it and its ancestors finish.
  await page.locator('.card-inspection-modal').evaluate(async modal=>{
   const animations=[];
   for(let node=modal;node;node=node.parentElement)animations.push(...node.getAnimations());
   await Promise.all(animations.filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));
  });
  await page.screenshot({path:resolve(output,name+'-inspection.png')});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.card-inspection-modal').count(),0);
  assert.ok(await page.evaluate(()=>document.activeElement.matches('.card, .card-info-button')),'focus returned');
  assert.equal(await page.evaluate(()=>JSON.stringify({plays:window.__combat.eventLog.filter(e=>e.type==='cardPlayed'),energy:window.__combat.player.energy,mana:window.__combat.player.mana,stamina:window.__combat.player.stamina})),beforeInspect,'inspection spends no resources and plays no card');
  if(standalone){
   const geometry=await page.locator('.hand .card').evaluateAll(cardGeometry);
   assert.ok(geometry.every(g=>!g.rankInvalid&&!g.trimDetached&&!g.clipped&&!g.overlapsTitle&&!g.footerOutside&&g.titleCovered&&!g.railOverlap&&g.sideTags<=3&&g.footerLabel),'standalone hand effects and damage words remain complete');
   assert.ok(geometry.every(g=>g.accessibleName?.includes(g.actionName)&&(!g.schoolName||g.accessibleName.includes(g.schoolName))),'standalone action and school names remain accessible');
   assert.ok(geometry.every(g=>g.damageTypes.every(word=>g.accessibleName?.includes(word))),'standalone damage words remain accessible');
   assert.equal(errors.length,0,errors.join('\n'));
   assert.equal(requiredFailures(failed).length,0,failed.join('\n'));
   report.devices.push({name,hand:geometry,errors,failed});await context.close();continue;
  }
  const refs=await page.evaluate(async()=>{
   const {contentBundle}=await import('/src/content/index.js');
   const {createRegistries,resolveCard}=await import('/src/model/registries.js');
   const {renderCard,scheduleCardFits}=await import('/src/ui/components/card.js');
   const {playingCardModel}=await import('/src/model/playingCard.js');
   const {previewCard}=await import('/src/engine/combat.js');
   const registries=createRegistries(contentBundle);
   const refs=contentBundle.cards.flatMap(c=>[
    {cardId:c.id}, {cardId:c.id,upgraded:true},
    ...(c.gradeProfiles||[]).map((p,abilityRank)=>({cardId:c.id,abilityRank})),
   ]);
   for(const p of registries.equipment.basicCardProfiles||[])refs.push({cardId:p.role==='defend'?'defend':'strike',profileId:p.id});
   for(const cardId of ['strike','gorefireSlash'])for(const rank of [1,2,5])refs.push({cardId,rank});
   refs.push(...refs.map(ref=>({...ref,qaExpanded:true})));
   const combat=window.__combat,originalHand=combat.piles.hand;
   const previewFor=ref=>{
    if(!ref.qaExpanded)return null;
    combat.piles.hand=[{...ref,instanceId:'sigil-corpus-preview'}];
    return previewCard(combat,'sigil-corpus-preview',combat.enemies.find(e=>e.alive)?.id);
   };
   const picked=[],actions=new Set(),schools=new Set();let corrupted=false,rankFive=false;
   for(const ref of refs){
    const preview=previewFor(ref),model=playingCardModel(registries,ref,{preview}),identity=model.sigils,def=preview?.resolvedDefinition||resolveCard(registries,ref);
    if(!actions.has(identity.action)||(identity.school&&!schools.has(identity.school))||(def.corrupted&&!corrupted)||(model.abilityRank===5&&!rankFive)){
     picked.push(ref);actions.add(identity.action);if(identity.school)schools.add(identity.school);
     if(def.corrupted)corrupted=true;if(model.abilityRank===5)rankFive=true;
    }
   }
   const ordered=[...picked,...refs.filter(ref=>!picked.includes(ref))];
   const app=document.querySelector('#app');app.replaceChildren();
   const style=document.createElement('style');style.textContent='html,body,#app{height:auto!important;overflow:visible!important;min-height:100vh}body{background:#1d1712}.sigil-corpus{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:28px;padding:35px 20px;background:#1d1712;width:100%;box-sizing:border-box}.sigil-corpus .card{width:100%!important;max-width:200px!important;margin:auto}.sigil-corpus:not([data-corpus-expanded]) .card[data-qa-deferred="true"]{display:none!important}@media(max-width:500px){.sigil-corpus{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.append(style);
   const gallery=document.createElement('div');gallery.className='sigil-corpus';app.append(gallery);
   ordered.forEach((ref,index)=>{const card=renderCard(registries,ref,{level:'inspect',inspection:false,preview:previewFor(ref)});card.dataset.qaRef=JSON.stringify(ref);card.dataset.qaDeferred=String(index>=picked.length);gallery.append(card);});
   combat.piles.hand=originalHand;
   scheduleCardFits(gallery.querySelectorAll('.card'));
   return refs.length;
  });
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>[...document.querySelectorAll('.sigil-corpus .card')].filter(card=>card.getBoundingClientRect().width>0).every(card=>card.querySelector('[data-card-binding="rules"]').dataset.rulesComplete==='true'));
  await readyImages(page);
  await page.screenshot({path:resolve(output,name+'-sigil-gallery.png'),fullPage:true});
  await page.evaluate(async()=>{const gallery=document.querySelector('.sigil-corpus');gallery.dataset.corpusExpanded='true';const {scheduleCardFits}=await import('/src/ui/components/card.js');scheduleCardFits(gallery.querySelectorAll('.card'));});
  await page.waitForFunction(()=>[...document.querySelectorAll('.sigil-corpus [data-card-binding="rules"]')].every(text=>text.dataset.rulesComplete==='true'));
  const geometry=await page.locator('.sigil-corpus .card').evaluateAll(cardGeometry);
  await page.screenshot({path:resolve(output,name+'-cards.png'),clip:{x:0,y:0,width:phone?390:1440,height:phone?844:1000}});
  const bad=geometry.filter(g=>g.rankInvalid||g.trimDetached||!g.titleCovered||g.clipped||g.overlapsTitle||g.footerOutside||g.railOverlap||g.sideTags>3||!g.footerLabel);
  writeFileSync(resolve(output,name+'-geometry.json'),JSON.stringify(geometry,null,2)+'\n');
  assert.equal(bad.length,0,JSON.stringify(bad.slice(0,6)));
  const widths=[];
  for(const width of [120,124,144,200,null]){
   await page.evaluate(async width=>{
    const cards=[...document.querySelectorAll('.sigil-corpus .card')];
    for(const card of cards)card.style.setProperty('width',width?width+'px':'100%','important');
    const {scheduleCardFits}=await import('/src/ui/components/card.js');scheduleCardFits(cards);
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
   },width);
   const resized=await page.locator('.sigil-corpus .card').evaluateAll(cardGeometry);
   assert.equal(resized.filter(g=>g.rankInvalid||g.trimDetached||!g.titleCovered||g.clipped||g.overlapsTitle||g.footerOutside||g.railOverlap||g.sideTags>3||!g.footerLabel).length,0,JSON.stringify({width,bad:resized.filter(g=>g.rankInvalid||g.trimDetached||!g.titleCovered||g.clipped||g.overlapsTitle||g.footerOutside||g.railOverlap||g.sideTags>3||!g.footerLabel).slice(0,6)}));
   if(width)widths.push({width,complete:resized.length,minFont:Math.min(...resized.map(g=>g.font))});
   else assert.ok(resized.every((g,i)=>Math.abs(g.ruleTop-geometry[i].ruleTop)<1&&Math.abs(g.font-geometry[i].font)<.1),'resize restores the original geometry');
  }
  assert.equal(new Set(geometry.map(g=>g.action)).size,10,'all primary actions covered');
  assert.equal(new Set(geometry.map(g=>g.school).filter(Boolean)).size,8,'all spell schools covered');
  assert.ok(geometry.every(g=>g.accessibleName?.includes(g.actionName)&&(!g.schoolName||g.accessibleName.includes(g.schoolName))),'card names expose action and school');
  assert.ok(geometry.every(g=>g.damageTypes.every(word=>g.accessibleName?.includes(word))),'card names expose damage words');
  assert.ok(geometry.every(g=>g.extraTabStops===0),'sigils add no keyboard stops');
  assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(requiredFailures(failed).length,0,failed.join('\n'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  report.devices.push({name,refs,fullyReadable:geometry.length,expanded:geometry.filter(g=>g.expanded).length,minFont:Math.min(...geometry.map(g=>g.font)),widths,actions:[...new Set(geometry.map(g=>g.action))],schools:[...new Set(geometry.map(g=>g.school).filter(Boolean))],errors,failed});
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
