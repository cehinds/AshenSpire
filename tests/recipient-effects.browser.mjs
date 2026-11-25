// Public production compositor + actual combat clicks in a read-only local browser sandbox.
// Uses the pinned source art cache described in docs/RECIPIENT-EFFECTS.md.
// Optional PLAYWRIGHT_MODULE, CHROME, RECIPIENT_EFFECTS_QA_OUT.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, relative, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { artPath, packTreeOf } from '../tools/art-source.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..');
const outputRoot = resolve(process.env.RECIPIENT_EFFECTS_QA_OUT || `${root}/scratch/recipient-effects/runtime-browser`);
await mkdir(outputRoot, { recursive: true });
// Read-only source serving: this focused test does not restamp a game build.
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(root, '.' + path);
  if (relative(root, file).startsWith('..' + sep)) { res.writeHead(403).end(); return; }
  try {
    const content = await readFile(packTreeOf(path.slice(1)) ? artPath(path.slice(1), { root }) : file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg' })[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
async function runGallery() {
const out=pathToFileURL(resolve(outputRoot,'gallery') + sep);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME?{executablePath:process.env.CHROME}:{})});const page=await browser.newPage({viewport:{width:1280,height:1000}});
const report={errors:[],failedAssets:[],checks:[],cases:{}};page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.failedAssets.push([r.status(),r.url()])});
async function capture(name,recipe,options={}){const state=await page.evaluate(async ({recipe,options})=>integrationQA.show(recipe,options),{recipe,options:{label:name,...options}});report.cases[name]=state;await page.locator('#viewport').screenshot({path:fileURLToPath(new URL(name+'.png',out))});return state;}
async function layers(action,event){return page.evaluate(({action,event})=>integrationQA.model.RecipientEffectsForEvent(action,event),{action,event});}
async function decoratedLayers(action,event){
  return page.evaluate(async ({action,event})=>{
    const { DecorateRecipientEffects } = await import('/src/ui/recipientEffectEvents.js');
    return DecorateRecipientEffects([{type:'cardPlayed',sourceId:event.sourceId},event],
      {resolveCard:()=>action}).flatMap(row=>row.recipientEffects);
  },{action,event});
}
try{
 await page.goto(baseUrl+'/tools/recipient-effects-runtime-preview.html');await page.waitForFunction(()=>window.integrationQA?.ready&&window.recipientRuntimePreview);
 const settings=await page.evaluate(()=>integrationQA.SETTINGS);assert.equal(settings.behavior.palettes.magic,'#4169E1');assert.equal(settings.layering.opacity.global,.8);assert.equal(settings.layering.opacity.primary,1);assert.equal(settings.layering.opacity.spellCircle,1);
 const physical={tags:['camp:physical','maneuver:attack','range:melee','school:fire'],sourceId:'player'};
 const spell={tags:['camp:spell','maneuver:casting','range:reach'],sourceId:'player'};
 const event={type:'damageDealt',sourceId:'player',targetId:'enemy-1',amount:8,hpRemoved:8};
 const fire=(await layers(physical,event))[0];
 for(const id of ['enemy-1','player']){const s=await capture('fire-slash-'+id,fire,{id});assert.equal(s.effects[0].dataset.renderer,'art');assert.equal(s.effects[0].dataset.rotation,'0');assert.equal(s.effects[0].opacity,settings.layering.opacity.global);assert.ok(s.effects[0].planes.some(p=>p.dataset.shape==='fire'));}
 const circle=await page.evaluate(action=>integrationQA.model.RecipientWindupFor(action,{sourceId:'player'}),spell);const cast=await capture('royal-blue-circle',circle,{id:'player'});assert.equal(circle.color,'#4169E1');assert.equal(cast.effects[0].opacity,settings.layering.opacity.global);
 for(const id of ['player','enemy-1'])for(const kind of ['ward','evade']){
  const e=kind==='ward'?{type:'persistentWardChanged',restored:5}:{type:'combatAvoidanceResolved',avoided:true};
  const recipe=(await layers({...spell,tags:[...spell.tags,'school:alteration']},{...e,sourceId:id,targetId:id}))[0];
  const s=await capture(kind+'-'+id,recipe,{id});const ghost=s.effects[0].planes.find(p=>p.dataset.actualActorMask==='true');assert.ok(ghost?.pixels.count>100,kind+' actual actor silhouette exists');
 }
 for(const [name,e]of [['wisdom',{type:'statusApplied',status:'wisdom',stacks:1}],['stamina',{type:'staminaRecovered',amount:3}],['mana',{type:'manaRestored',amount:3}],['beneficial',{type:'statusApplied',status:'precision',stacks:1}],['debuff',{type:'statusApplied',status:'silenced',stacks:1}]]){
  const recipe=(await layers({}, {...e,sourceId:'player',targetId:'player'}))[0];assert.ok(recipe,'recipe '+name);const s=await capture('buff-'+name,recipe,{id:'player',frame:0});const host=s.effects[0],box=s.actors.player.cardBox;assert.equal(host.dataset.anchor,'card-bottom');assert.ok(Math.abs(host.width-box.width)<.01&&Math.abs(host.height-box.height)<.01);assert.ok(host.planes.some(p=>p.pixels.count>0),'first frame aura visible '+name);
 }
 const heal=await decoratedLayers(spell,{type:'healed',amount:5,sourceId:'player',targetId:'player'});const bleed=await decoratedLayers(physical,{type:'statusApplied',status:'bleed',stacks:2,sourceId:'player',targetId:'enemy-1'});
 for(const [name,list,id]of [['healing',heal,'player'],['bleeding',bleed,'enemy-1']]){const secondary=list.find(r=>r.secondary);assert.ok(secondary,name+' secondary');const [before,after]=await page.evaluate(recipes=>integrationQA.renderer.PlanRecipientEffectLayers(recipes),list);assert.equal(after.recipe.afterPrimaryKey,before.recipe.primaryKey);assert.equal(after.start,before.lastFrameAt);const positions=[];for(let frame=0;frame<3;frame++){const s=await capture(name+'-'+(frame+1),secondary,{id,frame});positions.push(s.effects[0].planes[0].pixels.centerY)}if(name==='healing')assert.ok(positions[0]>positions[1]&&positions[1]>positions[2]);else assert.ok(positions[0]<positions[1]&&positions[1]<positions[2]);report.checks.push(name+' last-frame dependency and visible three-frame vertical motion verified');}
 for(const [shape,e]of [['block-hit',{type:'damageDealt',amount:5,blocked:5}],['poise-hit',{type:'damageDealt',amount:5,poiseAbsorbed:5}],['block-break',{type:'blockBroken'}],['poise-break',{type:'poiseBroken'}],['status-apply',{type:'statusApplied',status:'burn',stacks:1}],['status-tick',{type:'procBurst',status:'burn',amount:3}],['status-clear',{type:'statusRemoved',status:'burn',amount:1}],['status-resist',{type:'procResisted',status:'burn',blocked:1}]]){const recipe=(await layers(physical,{...e,sourceId:'player',targetId:'enemy-1'})).find(r=>r.shape===shape);assert.ok(recipe,shape);await capture(shape,recipe);}
 // Explicit group recipe exercises the runtime's single group drawing contract.
 const sweep={...fire,shape:'sweep',action:'sweep',targetType:'aoe',mount:'group',targetIds:['enemy-1','enemy-2','enemy-3'],groupKey:'qa-sweep',durationMs:1200};
 await page.evaluate(r=>integrationQA.playLayers([r,r]),sweep);await page.locator('.recipient-effect[data-shape="sweep"]').first().waitFor({state:'attached'});assert.equal(await page.locator('.recipient-effect[data-shape="sweep"]').count(),1);await page.locator('#viewport').screenshot({path:fileURLToPath(new URL('one-group-sweep.png',out))});
 const missingBefore=report.failedAssets.length;const absent=await capture('absent-pack-static-fallback',fire,{art:false});assert.equal(absent.effects[0].dataset.renderer,'placeholder');await page.waitForTimeout(250);assert.equal((await page.evaluate(()=>integrationQA.snapshot())).effects[0].dataset.frame,'1');assert.equal(report.failedAssets.length,missingBefore,'missing bundle does not request absent images');
 await page.evaluate(()=>integrationQA.renderer.ClearRecipientEffects(integrationQA.layer));assert.equal(await page.locator('.recipient-effect').count(),0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(r=>integrationQA.show(r),fire);assert.equal(await page.locator('.recipient-effect').count(),0);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(r=>{document.documentElement.dataset.effects='off';return integrationQA.show(r)},fire);assert.equal(await page.locator('.recipient-effect').count(),1);
 await page.evaluate(()=>document.documentElement.dataset.effects='on');await page.setViewportSize({width:390,height:844});await page.evaluate(r=>integrationQA.show(r),fire);assert.equal(await page.locator('.recipient-effect[data-renderer="art"]').count(),1);await page.locator('#viewport').screenshot({path:fileURLToPath(new URL('mobile-impact.png',out))});
 await page.evaluate(()=>integrationQA.renderer.ClearRecipientEffects(integrationQA.layer));assert.equal(await page.locator('.recipient-effect').count(),0);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedAssets,[]);
 report.checks.push('Actual game scene/player/enemy art with production model and compositor; flat fire impacts on either side; royal blue circle at configured opacity; actual Ward/Evade masks; card-sized buff/debuff; four defense and status outcomes; one group Sweep; art absent static fallback without 404s; cleanup.');
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({checks:report.checks,cases:Object.keys(report.cases).length,errors:report.errors,failedAssets:report.failedAssets},null,2));

}

async function runRealCombat() {
const out=pathToFileURL(resolve(outputRoot,'combat') + sep);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME?{executablePath:process.env.CHROME}:{})});const page=await browser.newPage({viewport:{width:1280,height:800}});const report={errors:[],cases:[]};page.on('pageerror',e=>report.errors.push(e.message));
try{
 for(const mode of ['pinned','absent']){
  await page.goto(baseUrl+'/index.html?shot=combat&shotSeed=3&shotHand=4&shotEnemyCount=3&gameProfile=core&shotSettings='+encodeURIComponent(JSON.stringify({effects:true,oneTapPlay:false,animSpeed:'normal'})),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__combat&&window.__renderCombatForShot,null,{timeout:45000});
  console.log('Fixture ready',mode);
  await page.evaluate(async mode=>{const{setHighResSource,setBuiltInSource}=await import('/src/ui/assetmap.js');const{RECIPIENT_EFFECT_ATLAS}=await import('/src/content/recipientEffectAtlas.js');const map=new Map();if(mode==='pinned')for(const e of Object.values(RECIPIENT_EFFECT_ATLAS))map.set(e.asset,'/'+e.asset);setHighResSource(map);setBuiltInSource(new Map([['qa/sentinel','data:,sentinel']]));const{PrewarmRecipientEffect}=await import('/src/ui/recipientEffectSprites.js');if(mode==='pinned')await Promise.all(Object.keys(RECIPIENT_EFFECT_ATLAS).map(shape=>PrewarmRecipientEffect({shape})));window.effectTrace=[];const seen=new WeakSet();window.traceObserver=new MutationObserver(()=>{for(const n of document.querySelectorAll('.recipient-effect, .recipient-delivery'))if(!seen.has(n)){seen.add(n);effectTrace.push({...n.dataset,time:performance.now()})}});traceObserver.observe(document.body,{childList:true,subtree:true});},mode);
  // Fixture card state is seeded; the visible card clicks still dispatch through
  // the real combat engine. No receipt or recipient effect is manually emitted.
  for(const cardId of ['core.strike','holySpark','sweepingBlow','core.ironbreaker']){
   await page.waitForFunction(()=>!document.querySelector('.end-turn')?.disabled,null,{timeout:20000});
   await page.waitForFunction(()=>!document.querySelector('.end-turn')?.disabled,null,{timeout:15000});
   if(cardId==='core.ironbreaker')await page.evaluate(()=>{__combat.enemies.find(e=>e.alive!==false&&e.hp>0).block=6;});
   if(cardId==='core.strike')await page.evaluate(async ()=>{
     const { rangePairKey } = await import('/src/model/combatEngagement.js');
     for(const enemy of __combat.enemies){
       enemy.hp = enemy.maxHp = 100;
       enemy.row = 'back';
       __combat.rangeState.engagements[rangePairKey('player:player','enemy:'+enemy.id)] = 1;
     }
   });
   const before=await page.evaluate(async cardId=>{const {primeAccuracyRolls}=await import('/tests/accuracyFixture.mjs');primeAccuracyRolls(__combat,{count:__combat.enemies.length});__combat.piles.hand=[{instanceId:'qa-'+cardId,cardId,upgraded:false}];__combat.player.energy=10;__combat.player.stamina=20;__combat.player.mana=20;__renderCombatForShot();return{eventIndex:__combat.eventLog.length,traceIndex:effectTrace.length,hp:__combat.enemies.map(e=>({id:e.id,hp:e.hp}))}},cardId);
   const card=page.locator('.hand .card[data-card-id="'+cardId+'"]').first();await card.waitFor({state:'visible'});await card.click();
   const target=await page.evaluate(()=>{const targetId=__combat.enemies.find(e=>e.alive!==false&&e.hp>0)?.id;const a=document.querySelector('.combatant.enemy[data-eid="'+CSS.escape(targetId)+'"] .sprite');if(!a)return null;const b=a.getBoundingClientRect();for(const[fx,fy]of[[.5,.5],[.5,.25],[.25,.5],[.75,.5]]){const x=b.x+b.width*fx,y=b.y+b.height*fy;const hit=document.elementFromPoint(x,y);if(hit?.closest('.combatant.enemy')&&!hit.closest('button'))return{x,y}}const btn=document.querySelector('.enemy-target-button:not(:disabled)');if(btn){const b=btn.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}}return null;});
   if(target)await page.mouse.click(target.x,target.y);
   await page.waitForFunction(({start,cardId})=>__combat.eventLog.slice(start).some(e=>e.type==='cardResolved'&&(e.cardId===cardId||e.cardInstanceId==='qa-'+cardId)),{start:before.eventIndex,cardId},{timeout:15000});
   await page.waitForFunction(start=>effectTrace.length>start,before.traceIndex,{timeout:5000});
   if(cardId==='holySpark')await page.screenshot({path:fileURLToPath(new URL('real-'+mode+'-spell-windup.png',out))});
   await page.waitForFunction(()=>document.querySelector('.recipient-effect[data-phase="contact"]'),null,{timeout:5000});
   await page.screenshot({path:fileURLToPath(new URL('real-'+mode+'-'+cardId+'.png',out))});
   await page.waitForTimeout(900);
   const result=await page.evaluate(before=>({effects:effectTrace.slice(before.traceIndex),events:__combat.eventLog.slice(before.eventIndex),hp:__combat.enemies.map(e=>({id:e.id,hp:e.hp}))}),before);assert.ok(result.events.some(e=>e.type==='damageDealt'));assert.ok(result.effects.some(e=>e.renderer===(mode==='pinned'?'art':'placeholder')));
   if(cardId==='core.strike'){
     assert.ok(result.events.some(e=>e.type==='combatAdvancedChanged'&&e.advanced));
     assert.ok(result.events.filter(e=>e.type==='combatEngagementMoved'&&e.reason==='advance').length>1);
     const movement = result.effects.filter(e=>e.shape==='advance');
     const impact = result.effects.find(e=>e.category==='attackImpacts');
     assert.equal(movement.length,1);
     assert.equal(movement[0].category,'castingMovement');
     assert.ok(impact&&movement[0].time<impact.time,'the real movement sprite precedes contact');
   }
   if(cardId==='holySpark'){const circle=result.effects.find(e=>e.shape==='spell-circle'),impact=result.effects.find(e=>e.shape==='spell');assert.ok(circle&&impact&&circle.time<impact.time);assert.equal(circle.targetType,'self');assert.equal(circle.category,'castingMovement');assert.equal(impact.category,'attackImpacts');assert.ok(result.events.some(e=>e.type==='damageDealt'&&(e.poiseAbsorbed>0||e.hpRemoved>0)));}
   if(cardId==='sweepingBlow'){assert.equal(result.effects.filter(e=>e.shape==='sweep').length,1);assert.ok(result.events.filter(e=>e.type==='damageDealt').length>1);}
   if(cardId==='core.ironbreaker'){assert.ok(result.events.some(e=>e.type==='damageDealt'&&e.blocked>0));const blockShape=result.events.some(e=>e.type==='blockBroken')?'block-break':'block-hit';const impact=result.effects.find(e=>e.category==='attackImpacts'),defense=result.effects.find(e=>e.shape===blockShape&&e.category==='defenseReactions');assert.ok(impact&&defense&&impact.time<defense.time);}
   report.cases.push({mode,cardId,before,...result});
  }
  await page.evaluate(()=>traceObserver.disconnect());
  await page.goto(baseUrl+'/index.html?shot=combat&shotSeed=3&shotHand=4&shotEnemies=fellWarden&gameProfile=core&shotSettings='+encodeURIComponent(JSON.stringify({effects:true,oneTapPlay:false,animSpeed:'normal'})),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__combat&&window.__renderCombatForShot,null,{timeout:45000});
  console.log('Fixture ready',mode);
  await page.evaluate(async mode=>{const{setHighResSource,setBuiltInSource}=await import('/src/ui/assetmap.js');const{RECIPIENT_EFFECT_ATLAS}=await import('/src/content/recipientEffectAtlas.js');const map=new Map();if(mode==='pinned')for(const e of Object.values(RECIPIENT_EFFECT_ATLAS))map.set(e.asset,'/'+e.asset);setHighResSource(map);setBuiltInSource(new Map([['qa/sentinel','data:,sentinel']]));const{PrewarmRecipientEffect}=await import('/src/ui/recipientEffectSprites.js');if(mode==='pinned')await Promise.all(Object.keys(RECIPIENT_EFFECT_ATLAS).map(shape=>PrewarmRecipientEffect({shape})));window.effectTrace=[];const seen=new WeakSet();window.traceObserver=new MutationObserver(()=>{for(const n of document.querySelectorAll('.recipient-effect, .recipient-delivery'))if(!seen.has(n)){seen.add(n);effectTrace.push({...n.dataset,time:performance.now()})}});traceObserver.observe(document.body,{childList:true,subtree:true});},mode);
  await page.waitForFunction(()=>!document.querySelector('.end-turn')?.disabled,null,{timeout:20000});
  const enemyStart=await page.evaluate(async ()=>{
    const { enemyMoveCarrier } = await import('/src/engine/combatCardTactics.js');
    const { primeAccuracyRolls } = await import('/tests/accuracyFixture.mjs');
    const enemy = __combat.enemies[0];
    const moveId = 'hammerToss';
    const move = __combat.registries.enemies.get(enemy.enemyId).moves[moveId];
    const { combatProfile } = enemyMoveCarrier(enemy,move,moveId,__combat);
    enemy.intent = {kind:'attack',moveId,damage:move.damage,hits:move.hits,combatProfile};
    enemy.plannedMoves = [];
    enemy.planDue = false;
    primeAccuracyRolls(__combat,{count:move.hits});
    return __combat.eventLog.length;
  });
  await page.locator('.end-turn').click();
  if(await page.locator('.confirmation-confirm').isVisible().catch(()=>false))await page.locator('.confirmation-confirm').click();
  for(let offer=0;offer<5;offer++){
    await page.waitForFunction(start=>__combat.pendingReaction||__combat.eventLog.slice(start).some(e=>e.type==='damageDealt'&&e.targetId==='player'),enemyStart,{timeout:30000});
    if(!await page.evaluate(()=>!!__combat.pendingReaction))break;
    await page.getByRole('button',{name:'Skip',exact:true}).last().click();
  }
  await page.waitForFunction(()=>effectTrace.some(e=>e.phase==='contact'&&e.facing==='back'),null,{timeout:30000});
  const incoming=await page.evaluate(start=>({effects:effectTrace,events:__combat.eventLog.slice(start).filter(e=>['damageDealt','enemyMoveStarted','combatContactPrepared'].includes(e.type))}),enemyStart);
  assert.ok(incoming.events.some(e=>e.type==='damageDealt'&&e.targetId==='player'));
  assert.ok(incoming.effects.some(e=>e.phase==='contact'&&e.facing==='back'&&e.renderer===(mode==='pinned'?'art':'placeholder')));
  report.cases.push({mode,cardId:'enemy-turn',...incoming});
  assert.ok(incoming.events.some(e=>[e.combatProfile?.range,e.intentPreview?.combatProfile?.range,e.actionPreview?.profile?.range].includes('reach')),'fixture includes a resolved Reach action');
  assert.equal(incoming.effects.some(e=>e.phase==='delivery'),mode==='pinned','prepared enemy Reach keeps its telegraph approach only when art is available');
  await page.screenshot({path:fileURLToPath(new URL('real-'+mode+'-enemy-turn.png',out))});
  await page.evaluate(()=>traceObserver.disconnect());
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure=e.stack;report.state=await page.evaluate(()=>({text:document.body.innerText.slice(-5000),events:window.__combat?.eventLog.slice(-20),trace:window.effectTrace})).catch(()=>null);await page.screenshot({path:fileURLToPath(new URL('real-failure.png',out))});throw e;}
finally{await writeFile(new URL('real-combat-report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log('PASS real combat UI/engine receipts in pinned and absent art modes.');

}

try { await runGallery(); await runRealCombat(); } finally { await new Promise(resolve => server.close(resolve)); }
