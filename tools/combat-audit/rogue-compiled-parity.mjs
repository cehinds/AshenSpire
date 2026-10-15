// Two focused UI/paid checks against an existing reviewed standalone artifact.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {launchBrowser,serveDir} from '../browser.mjs';
const expected=JSON.parse(process.env.PARITY_ARTIFACT_IDENTITY||'null');
assert.ok(expected?.source&&expected?.ordinal&&/^[a-f0-9]{64}$/.test(expected?.archiveSha256||''),'fixed archive identity required');
const out=resolve('_rogue-parity');mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const archive=JSON.parse(readFileSync('_archive-identity.json','utf8'));
for(const key of ['run','id','commit','archiveSha256','archiveBytes'])assert.equal(archive[key],expected[key],`verified archive ${key}`);
const files=[];function walk(p){for(const e of readdirSync(p,{withFileTypes:true})){const q=resolve(p,e.name);if(e.isDirectory())walk(q);else if(e.name.endsWith('.html'))files.push(q);}}walk(resolve('_existing-standalone'));
assert.equal(files.length,1);const file=files[0],bytes=readFileSync(file),html=bytes.toString('utf8');
const stamp=n=>html.match(new RegExp(`const ${n} = '([^']*)'`))?.[1];
const identity={...expected,archiveVerified:archive,observedSha256:hash(bytes),bytes:bytes.length,observedSource:stamp('SOURCE'),observedOrdinal:stamp('ORDINAL'),edition:stamp('EDITION'),runPath:stamp('RUN_PATH')};
assert.equal(identity.bytes,expected.htmlBytes);assert.equal(identity.observedSource,expected.source);assert.equal(identity.observedOrdinal,String(expected.ordinal));assert.equal(identity.edition,'light');assert.equal(identity.runPath,'standalone file');
const report={started:new Date().toISOString(),identity,fixture:'Existing compiled screenshot route, Rogue seed B (11), native dagger Strike (rating 2). Mirrors reviewed combat-preview-stance-parity guard test: hand only native Strike, other piles empty; neutral or data-only prior Defend; enemy HP36/Block8/Poise10, Barrier/Ward0, enemy Defend. Accuracy is primed using saved counters of the original seeded RNG, with no replaced functions. Host deck mirrors the fixture instance for normal UI callbacks. Real card select, pointer hover and enemy-figure click; no dispatch/preview helper or forced DOM events called. Not earned campaign progress.',cases:[],pageErrors:[],networkFailures:[],consoleMessages:[],passed:false};

function observedResponseBytes(network,url,timeout=90000){
 return new Promise((resolve,reject)=>{let requestId;const timer=setTimeout(()=>finish(new Error('observed document body timed out')),timeout);const cleanup=()=>{clearTimeout(timer);network.off('Network.responseReceived',response);network.off('Network.loadingFinished',loaded);network.off('Network.loadingFailed',failed);};const finish=(error,bytes)=>{cleanup();error?reject(error):resolve(bytes);};
 const response=e=>{if(e.type==='Document'&&e.response.url===url){if(e.response.status!==200)return finish(new Error(`navigation status ${e.response.status}`));requestId=e.requestId;}};
 const loaded=async e=>{if(e.requestId!==requestId)return;try{const result=await network.send('Network.getResponseBody',{requestId});finish(null,Buffer.from(result.body,result.base64Encoded?'base64':'utf8'));}catch(error){finish(error);}};
 const failed=e=>{if(e.requestId===requestId)finish(new Error(e.errorText));};network.on('Network.responseReceived',response);network.on('Network.loadingFinished',loaded);network.on('Network.loadingFailed',failed);
 });
}

const {chromium}=createRequire(import.meta.url)('playwright');let owner,browser,server;
try{
 server=await serveDir(resolve('_existing-standalone'));const base=server.url(relative(resolve('_existing-standalone'),file));owner=await launchBrowser({prefix:'rp-'});browser=await chromium.connectOverCDP(owner.wsUrl);report.browser=browser.version();
 for(const stance of ['neutral','defend']){
  const dir=resolve(out,stance);mkdirSync(dir,{recursive:true});const row={stance};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});const page=await context.newPage();
  page.on('pageerror',e=>report.pageErrors.push({stance,message:e.stack}));page.on('console',e=>{if(['error','warning'].includes(e.type()))report.consoleMessages.push({stance,type:e.type(),message:e.text()});});page.on('response',r=>{if(r.status()>=400)report.networkFailures.push({stance,url:r.url(),status:r.status()});});
  try{
   row.url=`${base}?${new URLSearchParams({shot:'combat',shotClass:'rogue',shotSeed:'B'})}`;const network=await context.newCDPSession(page);await network.send('Network.enable',{maxResourceBufferSize:128*1024*1024,maxTotalBufferSize:256*1024*1024});const [observed]=await Promise.all([observedResponseBytes(network,row.url),page.goto(row.url,{waitUntil:'domcontentloaded',timeout:90000})]);row.loadedBodySha256=hash(observed);row.loadedBodyBytes=observed.length;assert.equal(row.loadedBodySha256,identity.observedSha256,'executed navigation body matches the extracted verified archive HTML');assert.equal(observed.length,bytes.length);await network.detach();await page.locator('.end-turn:not([disabled])').waitFor({timeout:60000});
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.width>0&&b.height>0&&b.bottom>0&&b.top<innerHeight;}).map(i=>i.decode()));const stage=document.querySelector('.combatant.player .alternative-card-stage')?.__poseStage;if(stage?.ready)await stage.ready;});
   row.before=await page.evaluate(stance=>{
    const c=window.__combat,native=Object.values(c.piles).flat().find(i=>i.cardId==='strike');if(!native)throw Error('native Strike absent');
    if(native.profileId!=='daggerPierceAttack'||native.ratingValue!==2)throw Error('unexpected native dagger profile/rating');
    if(c.rng.seed!==11||c.breakMeterVersion!==2||c.registries.balance.combatRatings.enabled!==true)throw Error('configured seed/ratings/version differ from reviewed fixture');
    if(c.player.hp!==53||c.player.stamina!==3||c.player.mana!==1)throw Error('unexpected canonical Rogue pools');
    window.__parityRuntime=Object.fromEntries(Object.entries(c).filter(([,v])=>typeof v==='function'));window.__parityRng=c.rng;
    const instance={...native,instanceId:'stance-parity',upgraded:false};c.piles.hand=[instance];for(const pile of ['draw','discard','exhaust'])c.piles[pile]=[];
    const run=window.__combatRunForShot;run.deck=run.deck.map(i=>i.instanceId===native.instanceId?instance:i);
    if(stance==='defend')c.player.combatStance={maneuver:'defend',camp:'physical',range:'melee'};else delete c.player.combatStance;
    if(c.enemies.length!==1||c.enemies[0].enemyId!=='wanderingSoldier')throw Error('expected one canonical Wandering Soldier');
    const enemy=c.enemies[0];Object.assign(enemy,{hp:36,maxHp:36,block:8,barrier:0,statuses:{},ratings:{ar:0,dr:0,pr:0,poise:10,ward:0},persistentPoise:{max:10,value:10},persistentWard:{max:0,value:0},damageResistanceFlat:{},damageWeaknessPercent:{},combatStance:{maneuver:'defend',camp:'physical',range:'melee'}});delete enemy.combatCounter;delete enemy.combatEvade;
    const original=c.rng.getCounters();let selected;for(let n=0;n<1000000;n++){const before=c.rng.getCounters().combatAvoidance;if(c.rng.int('combatAvoidance',1,20)===20){selected=before;break;}}if(selected===undefined)throw Error('accuracy fixture not found');c.rng.restoreCounters({...original,combatAvoidance:selected});
    window.__renderCombatForShot();
    window.__paritySnapshot=()=>JSON.stringify({player:c.player,enemies:c.enemies,piles:c.piles,queue:c.queue,pending:c.pendingExpansionActions,serial:c.expansionActionSerial,rng:c.rng.getCounters(),events:c.eventLog});
    window.__parityBefore=window.__paritySnapshot();
    return{instance,player:JSON.parse(JSON.stringify(c.player)),enemy:JSON.parse(JSON.stringify(enemy)),eventCount:c.eventLog.length,rngSeed:c.rng.seed,rngCounters:c.rng.getCounters(),breakMeterVersion:c.breakMeterVersion,ratingsEnabled:c.registries.balance.combatRatings.enabled};
   },stance);
   const card=page.locator('.hand .card[data-instance-id="stance-parity"]');await card.click();row.selectedText=await card.innerText();
   await page.locator('.enemy-target-button:not([disabled]):visible').waitFor();
   row.target=await page.evaluate(()=>{const frame=document.querySelector('.combatant.enemy[data-eid="e1"]');if(!frame)throw Error('target e1 absent');const b=frame.querySelector('.sprite').getBoundingClientRect();for(let yi=1;yi<10;yi++)for(let xi=1;xi<10;xi++){const x=b.left+b.width*xi/10,y=b.top+b.height*yi/10,hit=document.elementFromPoint(x,y);if(hit?.closest('.combatant.enemy')===frame||hit?.closest('.enemy-target-button')?.dataset.eid==='e1')return{x,y,hit:hit.tagName,classes:hit.className};}throw Error('no unobstructed enemy figure point');});
   await page.mouse.move(row.target.x,row.target.y);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));row.aimedText=await card.innerText();
   assert.match(row.aimedText,/(?:Inflict|Deal)\s+1\s+Piercing damage\s*(?:×\s*2|2\s+times)/i,'selected damage reads one per hit, twice');assert.doesNotMatch(row.aimedText,/1\s*\+\s*0|1 total across 2 hits/);
   row.previewPreserved=await page.evaluate(()=>window.__parityBefore===window.__paritySnapshot());assert.equal(row.previewPreserved,true,'UI previews do not mutate state/RNG/events');
   await page.screenshot({path:resolve(dir,'selected.png')});await page.mouse.click(row.target.x,row.target.y);
   await page.waitForFunction(()=>window.__combat.eventLog.some(e=>e.type==='cardPlayed'&&e.cardInstanceId==='stance-parity'),null,{timeout:15000});await page.locator('.end-turn:not([disabled])').waitFor({timeout:30000});
   row.after=await page.evaluate(start=>{const c=window.__combat;return{events:c.eventLog.slice(start),player:JSON.parse(JSON.stringify(c.player)),enemy:JSON.parse(JSON.stringify(c.enemies[0])),queue:c.queue.length,pending:!!(c.pendingReaction||c.reactionResume||c.pendingAbilityDiscard),runtimePreserved:Object.entries(window.__parityRuntime).every(([k,fn])=>c[k]===fn),rngPreserved:c.rng===window.__parityRng,rngCounters:c.rng.getCounters()};},row.before.eventCount);
   const events=row.after.events;assert.equal(events.filter(e=>e.type==='cardPlayed'&&e.cardInstanceId==='stance-parity').length,1);assert.deepEqual(events.filter(e=>e.type==='damageDealt'&&e.targetId==='e1').map(e=>[e.incoming,e.blocked,e.poiseAbsorbed]),[[6,4,1],[6,4,1]]);assert.deepEqual(events.filter(e=>e.type==='hpLost'&&e.targetId==='e1').map(e=>e.amount),[1,1]);assert.equal(events.filter(e=>e.type==='statusApplied'&&e.status==='precision').length,1);assert.equal(row.after.enemy.hp,34);assert.equal(row.after.player.stamina,2);assert.equal(row.after.queue,0);assert.equal(row.after.pending,false);assert.equal(row.after.runtimePreserved,true);assert.equal(row.after.rngPreserved,true);
   await page.screenshot({path:resolve(dir,'paid.png')});row.screenshots=Object.fromEntries(['selected.png','paid.png'].map(n=>[n,hash(readFileSync(resolve(dir,n)))]));row.passed=true;console.log(JSON.stringify({stance,preview:row.aimedText,hp:row.after.enemy.hp,stamina:row.after.player.stamina,passed:true}));
  }catch(error){row.error=error.stack;await page.screenshot({path:resolve(dir,'failure.png')}).catch(()=>{});throw error;}finally{await context.close();}
 }
 assert.equal(hash(readFileSync(file)),identity.observedSha256);assert.equal(report.pageErrors.length,0);report.passed=true;
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1;}finally{
 if(browser)await browser.close();if(owner)await owner.close();if(server)await server.close();report.finished=new Date().toISOString();writeFileSync(resolve(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
 const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');writeFileSync(resolve(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>Focused Rogue compiled parity</title><style>body{background:#171b20;color:#eee;font:16px system-ui;margin:24px}img{max-width:100%}a{color:#e8c16b}</style><h1>Rogue selected-preview / accepted-play parity</h1><p>Source ${esc(expected.source)} · build ${esc(expected.ordinal)} · existing artifact ${esc(expected.id)}. Two labeled data fixtures; actual mouse card selection, hover and paid enemy click. <a href="manifest.json">Identity, exact fixtures and event receipts</a></p>${report.cases.map(r=>`<h2>${esc(r.stance)}</h2><p>${esc(r.aimedText||r.error)}</p><img src="${r.stance}/selected.png"><img src="${r.stance}/paid.png">`).join('')}`);
}
