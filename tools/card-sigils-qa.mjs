import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { ACTION_SIGILS, SCHOOL_SIGILS } from '../src/content/combatSigils.js';
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
 const r=text.getBoundingClientRect(),top=title.getBoundingClientRect(),face=c.querySelector('.illustrated-card-face').getBoundingClientRect(),panel=c.querySelector('[data-component="panel"]')?.getBoundingClientRect(),rail=c.querySelector('.card-tag-rail')?.getBoundingClientRect();
 const band=c.querySelector('[data-primary-sigil]'),mark=band?.querySelector('.combat-sigil-action'),label=band?.querySelector('.card-type-name'),b=band?.getBoundingClientRect();
 const m=mark?.getBoundingClientRect(),l=label?.getBoundingClientRect();
 const fade=c.querySelector('.card-title-fade')?.getBoundingClientRect();
 const rankNode=c.querySelector('.card-rank'),rank=rankNode?.getBoundingClientRect(),trim=c.querySelector('[data-component="panel-trim"]')?.getBoundingClientRect();
 const within=(a,z)=>!!a&&!!z&&a.left>=z.left-1&&a.right<=z.right+1&&a.top>=z.top-1&&a.bottom<=z.bottom+1;
 const horizontal=(a,z)=>!!a&&!!z&&a.left>=z.left-1&&a.right<=z.right+1;
 const bounds=a=>a?{left:a.left,top:a.top,right:a.right,bottom:a.bottom,width:a.width,height:a.height}:null;
 const accessibleName=c.getAttribute('aria-label'),damageWords=accessibleName?.match(/(?:^|, )Damage: (.*?)(?=, (?:rank |Cantrip(?:,|$)|Technique(?:,|$)|Combat Maneuver(?:,|$)|Weapon Art(?:,|$)|Spell(?:,|$))|\. Enter|$)/)?.[1]?.split(', ')||[];
 const expectedDamageWords=JSON.parse(c.dataset.qaDamageWords||'[]');
 return {ref:c.dataset.qaRef||c.dataset.cardId,action:c.querySelector('[data-primary-sigil]').dataset.primarySigil,
  school:c.dataset.combatSchool||null,schoolName:accessibleName?.match(/(?:^|, )([^,]+) school(?:,|$)/)?.[1]||null,
  titleCovered:!!fade&&fade.left<=top.left+1&&fade.right>=top.right-1&&fade.top<=top.top+1&&fade.top+fade.height*.48>=top.bottom-1,
  rankLabel:rankNode?.textContent||null,
  rankInvalid:!!rank&&(!/^Rank [1-9]\d*$/.test(rankNode.textContent)||rank.bottom>(panel?.top??r.top)+1||rank.top<top.bottom-1||(rail&&rank.top<rail.bottom-1&&rank.right>rail.left+1&&rank.left<rail.right-1)||Math.abs((rank.left+rank.right-face.left-face.right)/2)>1),
  trimDetached:!!trim&&!!panel&&(Math.abs(trim.top-panel.top)>1||Math.abs(trim.height-panel.height)>1),
  sideTags:c.querySelectorAll('.card-tag-symbol').length,
  railOverlap:!!rail && rail.bottom>Math.min(r.top,panel?.top??r.top)+1,
  footerLabel:c.querySelector('.card-type-name')?.textContent,
  clipped:text.scrollHeight>text.parentElement.clientHeight+1||text.scrollWidth>text.clientWidth+1,
  overlapsTitle:Math.min(r.top,panel?.top??r.top)<top.bottom-1,font:Number.parseFloat(getComputedStyle(text).fontSize),ruleTop:r.top-face.top,titleBottom:top.bottom-face.top,panelTop:panel?.top-face.top,
  // The authored 40/360 band is shorter than its centered 12cqw mark.
  // Measure the actual mark/label boxes against the face and rules, while
  // keeping their horizontal placement inside the nominal band.
  primaryBandOutside:!within(b,face)||!within(m,face)||!within(l,face)||!horizontal(m,b)||!horizontal(l,b)||Math.min(m?.top??-Infinity,l?.top??-Infinity)<r.bottom-1,
  bounds:{face:bounds(face),rules:bounds(r),band:bounds(b),mark:bounds(m),label:bounds(l)},
  primaryLabel:label?.textContent,primaryMarks:band?.querySelectorAll('.combat-sigil').length,
  secondaryFaceChips:c.querySelectorAll('.illustrated-card-face .combat-sigil-school,.illustrated-card-face .card-damage-types').length,
  rules:text.textContent,damageWords,expectedDamageWords,
  damageWordsComplete:expectedDamageWords.every(word=>text.textContent.includes(word)&&accessibleName?.includes(word)),
  numbersComplete:! /\{[\w.]+\}/.test(text.textContent)&&(!c.dataset.qaRuleNumbers||JSON.stringify(text.textContent.match(/\d+(?:\.\d+)?/g)||[])===c.dataset.qaRuleNumbers),
  expanded:c.querySelector('.illustrated-card-face').dataset.rulesExpanded==='true',
  accessibleName,actionName:mark?.getAttribute('aria-label'),
  extraTabStops:c.querySelectorAll('.combat-sigil[tabindex],.combat-sigil svg[tabindex]').length};
 });}
const badGeometry=geometry=>geometry.filter(g=>g.rankInvalid||g.trimDetached||!g.titleCovered||g.railOverlap||g.sideTags>3||!g.footerLabel||g.clipped||g.overlapsTitle||g.primaryBandOutside||g.secondaryFaceChips||g.primaryMarks!==1||g.primaryLabel!==g.actionName||!g.damageWordsComplete||!g.numbersComplete);
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
   assert.deepEqual(badGeometry(geometry),[],'standalone primary band and complete effects');
   assert.ok(geometry.every(g=>g.accessibleName?.includes(g.actionName)&&(!g.schoolName||g.accessibleName.includes(g.schoolName))),'standalone action and school names remain accessible');
   // Inherited damage tags can describe a non-HP support card. The full
   // source corpus checks typed HP contacts against resolved effects/previews.
   assert.ok(geometry.every(g=>g.damageWords.every(word=>g.accessibleName.includes(word))),'standalone authored damage metadata remains accessible');
   assert.equal(errors.length,0,errors.join('\n'));
   assert.equal(requiredFailures(failed).length,0,failed.join('\n'));
   report.devices.push({name,hand:geometry,typedDamageCoverage:'full source corpus; standalone hand retains authored accessibility metadata',errors,failed});await context.close();continue;
  }
  const refs=await page.evaluate(async()=>{
   const {contentBundle}=await import('/src/content/index.js');
   const {createRegistries,resolveCard}=await import('/src/model/registries.js');
   const {renderCard,scheduleCardFits}=await import('/src/ui/components/card.js');
   const {playingCardModel,combatCardDamageLabel}=await import('/src/model/playingCard.js');
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
    const savedHand=combat.piles.hand;
    try{combat.piles.hand=[{...ref,instanceId:'sigil-corpus-preview'}];
     return previewCard(combat,'sigil-corpus-preview',combat.enemies.find(e=>e.alive)?.id);
    }finally{combat.piles.hand=savedHand;}
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
   ordered.forEach((ref,index)=>{const preview=previewFor(ref),def=preview?.resolvedDefinition||resolveCard(registries,ref),card=renderCard(registries,ref,{level:'inspect',inspection:false,preview});card.dataset.qaRef=JSON.stringify(ref);card.dataset.qaDeferred=String(index>=picked.length);
    const hasContact=def.effects?.some(effect=>effect.op==='damage')||def.counterPayload?.hp;
    card.dataset.qaDamageWords=JSON.stringify((preview?.combatExpansionVersion===2||def.minCombatExpansionVersion===2)&&hasContact?combatCardDamageLabel(def,preview,registries).split('/').map(word=>word.trim()).filter(Boolean):[]);
    card.dataset.qaRuleNumbers=JSON.stringify(card.querySelector('[data-card-binding="rules"]').textContent.match(/\d+(?:\.\d+)?/g)||[]);gallery.append(card);});
   // Keep the authored refs/previews for eight real read-only Information doors.
   window.__sigilInspectionCorpus={registries,renderCard,previewFor,originalHand};
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
  const bad=badGeometry(geometry);
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
   assert.equal(badGeometry(resized).length,0,JSON.stringify({width,bad:badGeometry(resized).slice(0,6)}));
   if(width)widths.push({width,complete:resized.length,minFont:Math.min(...resized.map(g=>g.font))});
   else assert.ok(resized.every((g,i)=>Math.abs(g.ruleTop-geometry[i].ruleTop)<1&&Math.abs(g.font-geometry[i].font)<.1),'resize restores the original geometry');
  }
  assert.equal(refs,2186,'the complete authored/upgraded/ranked/profile and expanded face inventory');
  assert.equal(geometry.length,refs,'every inventory face measured');
  assert.deepEqual([...new Set(geometry.map(g=>g.action))].sort(),Object.keys(ACTION_SIGILS).sort(),'all ten exact primary actions covered');
  assert.deepEqual([...new Set(geometry.map(g=>g.school).filter(Boolean))].sort(),Object.keys(SCHOOL_SIGILS).sort(),'all eight exact spell schools covered');
  assert.ok(geometry.every(g=>!g.school||g.schoolName===SCHOOL_SIGILS[g.school].label),'painted school data matches the actual accessible school label');
  assert.ok(geometry.every(g=>g.accessibleName?.includes(g.actionName)&&(!g.schoolName||g.accessibleName.includes(g.schoolName))),'card names expose action and school');
  assert.ok(geometry.every(g=>g.damageWordsComplete),'actual damage words remain written and accessible without school inference');
  assert.ok(geometry.every(g=>g.extraTabStops===0),'sigils add no keyboard stops');
  // Coverage comes from the painted cards' school data and accessible names.
  // Open the production reading door for one actual face from each school;
  // model identity alone is not evidence that the explanation is reachable.
  const inspectionState=()=>page.evaluate(()=>JSON.stringify({events:window.__combat.eventLog,player:window.__combat.player,hand:window.__combat.piles.hand,rng:window.__combat.rng.getCounters()}));
  const beforeDoors=await inspectionState();
  const representatives=await page.evaluate(()=>{
   const bySchool=new Map();
   const faces=[...document.querySelectorAll('.sigil-corpus .card')];
   for(const card of [...faces.filter(c=>c.classList.contains('expanded-combat-card')),...faces]){
    if(card.dataset.combatSchool&&!bySchool.has(card.dataset.combatSchool))bySchool.set(card.dataset.combatSchool,card);
   }
   const corpus=window.__sigilInspectionCorpus,container=document.createElement('div');container.className='sigil-corpus';
   const representatives=[];
   try{for(const [school,source] of bySchool){
    const ref=JSON.parse(source.dataset.qaRef),card=corpus.renderCard(corpus.registries,ref,{level:'inspect',inspectReadOnly:true,preview:corpus.previewFor(ref)});
    card.dataset.qaInspectionSchool=school;container.append(card);
    representatives.push({school,ref,action:source.querySelector('[data-primary-sigil]').dataset.primarySigil,schoolName:source.getAttribute('aria-label').match(/(?:^|, )([^,]+) school(?:,|$)/)?.[1]});
   }}finally{window.__combat.piles.hand=corpus.originalHand;}
   document.querySelector('#app').replaceChildren(container);return representatives;
  });
  assert.equal(representatives.length,8,'eight actual school Information representatives');
  assert.equal(await inspectionState(),beforeDoors,'rendering read-only representatives restores the hand and all resources');
  const informationDoors=[];
  for(const representative of representatives){
   const face=page.locator('[data-qa-inspection-school="'+representative.school+'"]');
   await face.scrollIntoViewIfNeeded();
   // Read-only desktop click opens directly; touch first selects. Both then
   // use the real Information control, followed by the native Enter door.
   if(phone)await face.tap();else{
    await face.click();await page.locator('.card-inspection-modal').waitFor();await page.keyboard.press('Escape');
   }
   const info=face.locator('.card-info-button');
   await info.waitFor({state:'visible'});
   if(phone)await info.tap();else await info.click();
   for(const door of ['Information','Enter']){
    if(door==='Enter'){await face.focus();await face.press('Enter');}
    const modal=page.locator('.card-inspection-modal');await modal.waitFor();
    const schoolMark=modal.locator('.inspection-sigils .combat-sigil-school');
    assert.equal(await schoolMark.getAttribute('data-sigil'),representative.school);
    assert.equal(await schoolMark.getAttribute('aria-label'),representative.schoolName);
    assert.equal(await modal.locator('.inspection-sigils .combat-sigil-action').getAttribute('data-sigil'),representative.action);
    assert.ok((await modal.locator('.inspection-sigils').innerText()).includes(representative.schoolName),'school explanation is rendered in Information');
    if(door==='Information')await page.screenshot({path:resolve(output,name+'-school-'+representative.school+'-information.png')});
    await page.keyboard.press('Escape');assert.equal(await page.locator('.card-inspection-modal').count(),0);
    assert.ok(await (door==='Information'?info:face).evaluate(node=>document.activeElement===node),'Escape restores the actual opener');
    assert.equal(await inspectionState(),beforeDoors,'read-only Information/Enter spends nothing and preserves the run');
    informationDoors.push({...representative,door,focusRestored:true,resourcesUnchanged:true});
   }
  }
  assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(requiredFailures(failed).length,0,failed.join('\n'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  report.devices.push({name,refs,fullyReadable:geometry.length,expanded:geometry.filter(g=>g.expanded).length,minFont:Math.min(...geometry.map(g=>g.font)),widths,actions:[...new Set(geometry.map(g=>g.action))],schools:[...new Set(geometry.map(g=>g.school).filter(Boolean))],informationDoors,errors,failed});
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
