const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4288/art/defeated-poses/index.html');await page.waitForFunction(()=>window.reviewStages?.size===49);
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 const hurt=await page.evaluate(async()=>{
  const {animateEvents}=await import('/src/ui/fx.js');
  const result=[];
  for(const [id,{stage,sprite}] of reviewStages){
   animateEvents([{type:'hpLost',targetId:id,amount:2,cause:'effect'}],{layer:document.body,combatEl:document.body,anchorFor:()=>sprite});
   const start=performance.now();await new Promise(resolve=>{function sample(){const t=performance.now()-start;result.push({id,t,pose:stage.enemy?sprite.firstElementChild.dataset.pose:stage.pose,filter:getComputedStyle(sprite.firstElementChild).filter});if(t<330)requestAnimationFrame(sample);else resolve()}sample()});
  }return result;
 });
 for(const id of await page.evaluate(()=>[...reviewStages.keys()])){
  for(const [from,to,red] of [[5,90,false],[110,190,true],[220,285,false]]){
   const frames=hurt.filter(s=>s.id===id&&s.t>=from&&s.t<=to);assert(frames.length,id+' phase samples');
   assert(frames.every(f=>['hit','hurt'].includes(f.pose)),id+' hurt pose');assert(frames.every(f=>red?f.filter.includes('sepia(1)'):f.filter==='none'),id+' red hue phase');
  }
 }
 await page.evaluate(()=>{for(const {stage} of reviewStages.values()){stage.play('hit',100);stage.play('defeated');stage.settle();stage.play('hit',100);}});
 await page.waitForTimeout(400);
 assert(await page.evaluate(()=>[...reviewStages.values()].every(({stage,sprite})=>(stage.enemy?sprite.firstElementChild.dataset.pose:stage.pose)==='defeated')),'defeat latches across cancellation and later hit');
 for(let group=0;group<9;group++){
  await page.evaluate(group=>{[...document.querySelectorAll('article')].forEach((a,i)=>a.hidden=i<group*6||i>=group*6+6)},group);
  await page.screenshot({path:`art/defeated-poses/work/roster-${group}.png`,fullPage:true});
 }
 await page.evaluate(()=>{for(const {stage} of reviewStages.values()){stage.setState?.({hp:100,maxHp:100});stage.setRestPose?.('idle');stage.settle();}});
 assert(await page.evaluate(()=>[...reviewStages.values()].every(({stage,sprite})=>(stage.enemy?sprite.firstElementChild.dataset.pose:stage.pose)==='idle')),'revive restores idle');
 for(const id of ['rogue','graveWisp']){
  await page.evaluate(async id=>{const {animateEvents}=await import('/src/ui/fx.js');const {sprite}=reviewStages.get(id);window.hitAgain=amount=>animateEvents([{type:'damageDealt',targetId:id,amount,blocked:0}],{layer:document.body,combatEl:document.body,anchorFor:()=>sprite});hitAgain(20)},id);
  await page.waitForTimeout(150);await page.evaluate(()=>hitAgain(5));
  assert.equal(await page.evaluate(id=>reviewStages.get(id).sprite.classList.contains('hit-heavy'),id),false,'light hit clears old heavy modifier');
  await page.waitForTimeout(160);
  assert.equal(await page.evaluate(id=>reviewStages.get(id).sprite.classList.contains('hitflash'),id),true,'previous flash timer cannot clear new hit');
  await page.waitForTimeout(100);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{for(const {stage} of reviewStages.values())stage.play('defeated')});
 assert(await page.evaluate(()=>[...reviewStages.values()].every(({stage,sprite})=>(stage.enemy?sprite.firstElementChild.dataset.pose:stage.pose)==='defeated')),'reduced motion retains defeated state');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(async()=>{document.body.classList.add('reduce-flashes');const {animateEvents}=await import('/src/ui/fx.js');const {stage,sprite}=reviewStages.get('rogue');stage.setRestPose('idle');animateEvents([{type:'hpLost',targetId:'rogue',amount:2,cause:'proc:bleed'}],{layer:document.body,anchorFor:()=>sprite});});
 assert.equal(await page.evaluate(()=>reviewStages.get('rogue').sprite.classList.contains('hitflash')),false,'reduce flashes');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{[...document.querySelectorAll('article')].forEach((a,i)=>a.hidden=i!==0)});await page.screenshot({path:'art/defeated-poses/work/phone.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: 49 characters, all three hurt hue phases, defeat persistence, revival, reduced motion/flash preference, desktop and phone.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
