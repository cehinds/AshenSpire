// Visual delivery evidence from an EXISTING stamped standalone. No rebuild.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {launchBrowser,serveDir} from '../browser.mjs';
const out=resolve('_combat-captures');mkdirSync(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=[];function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())walk(p);else if(entry.name.endsWith('.html'))files.push(p);}}walk(resolve('_stamped-standalone'));
assert.equal(files.length,1,'existing standalone artifact contains one HTML build');
const file=files[0],bytes=readFileSync(file),html=bytes.toString('utf8');
const stamp=name=>html.match(new RegExp(`const ${name} = '([^']*)'`))?.[1];
const report={started:new Date().toISOString(),artifact:{run:38711098039,id:11960154709,commit:'905580a10eedd849255814cc2c4728d2acad5744',htmlSha256:sha(bytes),bytes:bytes.length,source:stamp('SOURCE'),ordinal:stamp('ORDINAL'),edition:stamp('EDITION'),runPath:stamp('RUN_PATH')},
 fixture:'Compiled production screenshot route. Registered legal class/colorless card appended to live hand and host run deck, all original runtime functions/listeners preserved. Supplementary stance rows use enlarged resource pools through existing shot parameters and data-only Stamina=20. Slow animation is a real user setting for inspection. Paid plays use mouse/card/actual figure input. Native canvas samples follow the actual stage clock; no stage seek/play/pose API is invoked. Not earned campaign progress or all card/RNG/reaction combinations.',
 cases:[],errors:[],networkFailures:[],consoleMessages:[],passed:false};
assert.equal(report.artifact.source,'0e644c84d8');assert.equal(report.artifact.ordinal,'1537');assert.equal(report.artifact.edition,'light');assert.equal(report.artifact.runPath,'standalone file');
const {chromium}=createRequire(import.meta.url)('playwright');
let browser,owner,server;
try{
 server=await serveDir(resolve('_stamped-standalone'));const url=server.url(relative(resolve('_stamped-standalone'),file));
 owner=await launchBrowser({prefix:'fc-'});browser=await chromium.connectOverCDP(owner.wsUrl);report.browser=browser.version();
 const classes=['reaver','rogue','starseer','herald'];
 for(const classId of classes){
  const rows=[['attack','strike'],['defend','defend'],['smash','bashingBlow'],['sweep','sweepingBlow'],['counter',classId==='reaver'?'guardCounter':'spikedReprisal'],['evade','dodgeRoll'],['ranged','crawlingShot'],['casting',classId==='starseer'?'starSpark':'emberDart']];
  for(const [maneuver,cardId]of rows){
   const row={classId,maneuver,cardId,fixture: maneuver==='attack'?'canonical shot pools; registered card fixture':'enlarged resource/card fixture',paid:false};report.cases.push(row);
   const dir=resolve(out,classId,maneuver);mkdirSync(dir,{recursive:true});
   const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});const page=await context.newPage();
   page.on('pageerror',e=>report.errors.push({classId,maneuver,message:e.stack}));page.on('console',e=>{if(e.type()==='error'||e.type()==='warning')report.consoleMessages.push({classId,maneuver,type:e.type(),message:e.text()});});page.on('response',r=>{if(r.status()>=400)report.networkFailures.push({classId,maneuver,url:r.url(),status:r.status()});});
   try{
    const params=new URLSearchParams({shot:'combat',shotClass:classId,shotSeed:'B',shotSettings:JSON.stringify({animSpeed:'slow'})});
    if(maneuver!=='attack'){params.set('shotMaxHp','200');params.set('shotMaxMana','200');params.set('shotMana','200');params.set('shotMaxStamina','200');}
    row.url=`${url}?${params}`;await page.goto(row.url,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('.end-turn:not([disabled])').waitFor({timeout:60000});
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.width>0&&b.height>0&&b.bottom>0&&b.top<innerHeight;}).map(i=>i.decode()));const s=document.querySelector('.combatant.player .alternative-card-stage')?.__poseStage;if(s?.ready)await s.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    row.before=await page.evaluate(({classId,cardId,maneuver})=>{
     const c=window.__combat,def=c.registries.cards.get(cardId);if(def.class!=='colorless'&&def.class!==classId)throw Error('illegal class/card fixture');
     window.__captureRuntime=Object.fromEntries(Object.entries(c).filter(([,v])=>typeof v==='function'));
     const native=Object.values(c.piles).flat().find(i=>i.cardId===cardId);const inst={...(native||{}),cardId,instanceId:`capture-${classId}-${maneuver}`,upgraded:false};
     c.piles.hand=[inst,...c.piles.hand.filter(i=>i.instanceId!==native?.instanceId).slice(0,3)];
     for(const pile of ['draw','discard','exhaust'])c.piles[pile]=c.piles[pile].filter(i=>i.instanceId!==native?.instanceId);
     const run=window.__combatRunForShot;if(!native)run.deck.push(inst);else{const index=run.deck.findIndex(i=>i.instanceId===native.instanceId);if(index>=0)run.deck[index]=inst;else run.deck.push(inst);}
     if(maneuver!=='attack'){c.player.energyMax=20;c.player.energy=20;c.player.stamina=20;}
     window.__renderCombatForShot();const stage=document.querySelector('.combatant.player .alternative-card-stage')?.__poseStage;
     return{instanceId:inst.instanceId,eventCount:c.eventLog.length,hp:c.player.hp,stamina:c.player.stamina,mana:c.player.mana,enemies:c.enemies.map(e=>({id:e.id,hp:e.hp})),tags:def.tags,stage:stage?{animationSetId:stage.animationSetId,pose:stage.pose,stance:stage.stance,reactionPoses:stage.reactionPoses}:null};
    },{classId,cardId,maneuver});
    if(maneuver==='attack')await page.screenshot({path:resolve(out,`${classId}-combat.png`)});
    const card=page.locator(`.hand .card[data-instance-id="${row.before.instanceId}"]`);await card.click();
    if(maneuver==='attack')await page.screenshot({path:resolve(dir,'selected.png')});
    await page.evaluate(()=>{
     window.__captureFrames=[];window.__captureOn=true;let last;
     const sample=()=>{const host=document.querySelector('.combatant.player .alternative-card-stage'),stage=host?.__poseStage,canvas=host?.querySelector('canvas');const key=stage?`${stage.pose}/${stage.presentation?.action||''}`:'missing';
      if(key!==last&&window.__captureFrames.length<24){last=key;window.__captureFrames.push({at:performance.now(),pose:stage?.pose,action:stage?.presentation?.action||null,stance:stage?.stance,missing:!stage,png:canvas?.width?canvas.toDataURL('image/png'):null});}
      if(window.__captureOn)requestAnimationFrame(sample);};requestAnimationFrame(sample);
    });
    const point=await page.evaluate(()=>{const frame=document.querySelector('.combatant.enemy[data-eid="e1"]'),b=frame.querySelector('.sprite').getBoundingClientRect();for(let yi=1;yi<10;yi++)for(let xi=1;xi<10;xi++){const x=b.left+b.width*xi/10,y=b.top+b.height*yi/10,hit=document.elementFromPoint(x,y);if(hit?.closest('.combatant.enemy')===frame||hit?.closest('.enemy-target-button')?.dataset.eid==='e1')return{x,y};}return null;});
    const targetVisible=await page.locator('.enemy-target-button:not([disabled]):visible').count();
    if(targetVisible){assert.ok(point,'actual enemy figure reachable');await page.mouse.click(point.x,point.y);}else await page.locator('.combatant.player .player-action-intent').click();
    await page.waitForFunction(id=>window.__combat.eventLog.some(e=>e.type==='cardPlayed'&&e.cardInstanceId===id),row.before.instanceId,{timeout:15000});row.paid=true;
    await page.screenshot({path:resolve(dir,'paid.jpg'),type:'jpeg',quality:86});
    await page.locator('.end-turn:not([disabled])').waitFor({timeout:30000});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const capture=await page.evaluate(({id,start})=>{window.__captureOn=false;const c=window.__combat,stage=document.querySelector('.combatant.player .alternative-card-stage')?.__poseStage;return{frames:window.__captureFrames,events:c.eventLog.slice(start),player:{hp:c.player.hp,stamina:c.player.stamina,mana:c.player.mana,combatStance:c.player.combatStance},enemies:c.enemies.map(e=>({id:e.id,hp:e.hp})),queue:c.queue.length,pending:!!(c.pendingReaction||c.reactionResume||c.pendingAbilityDiscard),runtimePreserved:Object.entries(window.__captureRuntime).every(([k,fn])=>c[k]===fn),stage:stage?{animationSetId:stage.animationSetId,pose:stage.pose,stance:stage.stance,reactionPoses:stage.reactionPoses,poses:stage.poses}:null};},{id:row.before.instanceId,start:row.before.eventCount});
    row.after={...capture};delete row.after.frames;
    assert.equal(capture.events.filter(e=>e.type==='cardPlayed'&&e.cardInstanceId===row.before.instanceId).length,1);assert.equal(capture.pending,false);assert.equal(capture.queue,0);assert.equal(capture.runtimePreserved,true);
    assert.equal(capture.stage.animationSetId,`class-cards-${classId}`,'default class artwork retained');
    row.frames=[];for(let i=0;i<capture.frames.length;i++){const {png,...meta}=capture.frames[i];const name=`frame-${String(i).padStart(2,'0')}.png`;if(png){const data=Buffer.from(png.split(',')[1],'base64');writeFileSync(resolve(dir,name),data);meta.image=`${classId}/${maneuver}/${name}`;meta.sha256=sha(data);}row.frames.push(meta);}
    row.presentation=row.frames.some(f=>f.action)?'sampled actual paid finite playback':'paid held preparation/fallback; no finite action sampled';
    row.unavailableEvade= maneuver==='evade'&&!capture.stage.poses?.includes('stance-evade');
    row.passed=true;
    console.log(JSON.stringify({classId,maneuver,paid:row.paid,frames:row.frames.length,presentation:row.presentation}));
   }catch(error){row.error=error.stack;await page.screenshot({path:resolve(dir,'failure.png')}).catch(()=>{});throw error;}finally{await context.close();}
  }
 }
 assert.equal(sha(readFileSync(file)),report.artifact.htmlSha256,'the existing compiled artifact remains byte-identical');
 assert.equal(report.errors.length,0,'no runtime exceptions');report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}finally{
 if(browser)await browser.close();if(owner)await owner.close();if(server)await server.close();report.finished=new Date().toISOString();writeFileSync(resolve(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
 const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const sections=report.cases.map(r=>`<section><h2>${esc(r.classId)} · ${esc(r.maneuver)}</h2><p>${esc(r.cardId)} · ${esc(r.presentation)}${r.unavailableEvade?' · no authored Evade held frame; actual fallback shown':''}</p><a href="${r.classId}/${r.maneuver}/paid.jpg">Full paid UI capture</a><div>${(r.frames||[]).filter(f=>f.image).map(f=>`<figure><img src="${f.image}"><figcaption>${esc(f.pose)} · ${esc(f.action||'held/rest')} · ${f.at.toFixed(1)}ms</figcaption></figure>`).join('')}</div></section>`).join('');
 writeFileSync(resolve(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>1537 paid combat captures</title><style>body{font:16px system-ui;background:#171b20;color:#eee;margin:24px}section{margin:32px 0}section>div{display:flex;overflow:auto}figure{margin:8px;min-width:260px}img{width:260px}a{color:#e8c16b}</style><h1>Build 0.7.1.1537 · src 0e644c84d8</h1><p>Existing compiled standalone; actual paid input, registered card/resource fixtures, Slow inspection setting. Native stage-clock samples, no staged pose APIs. This is targeted visual evidence, not every card, reaction or RNG combination. <a href="manifest.json">Exact provenance and receipts</a></p>${sections}`);
}
