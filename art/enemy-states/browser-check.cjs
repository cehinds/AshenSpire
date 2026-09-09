const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdirSync}=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1800,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.ENEMY_PREVIEW_ORIGIN||'http://127.0.0.1:4288')+'/art/enemy-states/index.html');
  await page.waitForSelector('article');assert.equal(await page.locator('article').count(),33);
  mkdirSync('art/enemy-states/frames/review',{recursive:true});
  await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));});
  // Contact strips review every exported pose on a dark background.
  for(let group=0;group<6;group++){
   await page.evaluate(group=>{document.querySelector('header').hidden=true;[...document.querySelectorAll('article')].forEach((a,i)=>{a.hidden=i<group*6||i>=group*6+6;});},group);
   await page.screenshot({path:`art/enemy-states/frames/review/roster-${group}.png`,fullPage:true});
  }
  await page.evaluate(async()=>{
   const {enemySprite}=await import('/src/ui/assets.js'),{stageFor}=await import('/src/ui/services/PoseAnimator.js');
   const {entries}=await(await fetch('/assets/enemy-poses/manifest.json')).json();document.body.innerHTML='';window.stages=[];
   for(const e of entries){const host=document.createElement('div');host.className='enemy';const sprite=document.createElement('div');sprite.className='sprite';sprite.append(enemySprite({...e,size:'medium'}));host.append(sprite);document.body.append(host);window.stages.push(stageFor(sprite));}
   await Promise.all([...document.images].map(i=>i.decode()));
  });
  for(const pose of ['buff','wounded','afflicted','projectile','guard','guardHit','hurt']){
   assert(await page.evaluate(pose=>{window.stages.forEach(s=>s.play(pose,60000));return [...document.querySelectorAll('.enemy-pose-stage')].every(el=>el.dataset.pose===pose&&getComputedStyle(el.querySelector('.enemy-pose-idle')).visibility==='hidden'&&[...el.querySelectorAll('.enemy-pose-state')].filter(i=>getComputedStyle(i).visibility==='visible').length===1);},pose),pose);
  }
  assert(await page.evaluate(()=>{window.stages.forEach(s=>{s.settle();s.setState({hp:20,maxHp:100,statuses:{strength:{stacks:2},regen:{stacks:1}}});});return [...document.querySelectorAll('.enemy-pose-stage')].every(el=>el.dataset.pose==='wounded'&&el.dataset.buffs==='strength regen'&&el.querySelector('.facing').style.filter.includes('drop-shadow'));}),'wounded plus stacked auras');
  assert(await page.evaluate(()=>{window.stages.forEach(s=>s.setState({hp:100,maxHp:100,statuses:{strength:{stacks:0},regen:{stacks:0}}}));return [...document.querySelectorAll('.enemy-pose-stage')].every(el=>el.dataset.pose==='idle'&&el.dataset.buffs===''&&el.querySelector('.facing').style.filter==='none');}),'expiry clears aura and restores idle');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert(await page.evaluate(()=>{window.stages.forEach(s=>s.play('hurt',60000));return [...document.querySelectorAll('.enemy-pose-stage')].every(el=>el.dataset.pose==='hurt');}),'reduced motion retains static reaction');
  assert(await page.evaluate(()=>{window.stages.forEach(s=>s.settle());const el=document.querySelector('.enemy-pose-stage');el.querySelector('.enemy-pose-state').dispatchEvent(new Event('error'));window.stages[0].play('buff',60000);return el.dataset.pose==='idle'&&getComputedStyle(el.querySelector('.enemy-pose-idle')).visibility==='visible';}),'missing state falls back to idle');
  await page.evaluate(()=>window.stages.forEach(s=>s.settle()));
  for(const [blocked,damage,pose] of [[10,0,'guardHit'],[0,8,'hurt'],[4,8,'hurt']]){
   const actual=await page.evaluate(async({blocked,damage})=>{
    const {animateEvents}=await import('/src/ui/fx.js');
    const anchor=document.querySelectorAll('.enemy .sprite')[1];
    const layer=document.createElement('div');document.body.append(layer);
    animateEvents([{type:'damageDealt',targetId:'victim',blocked,amount:damage+blocked}],{layer,combatEl:document.body,anchorFor:()=>anchor});
    return anchor.querySelector('.enemy-pose-stage').dataset.pose;
   },{blocked,damage});
   assert.equal(actual,pose,'damage receipt selects guarded or unguarded reaction');
  }
  assert.deepEqual(errors,[]);
  for(const cause of ['proc:bleed','effect']){
   assert.equal(await page.evaluate(async cause=>{
    const {animateEvents}=await import('/src/ui/fx.js');
    const anchor=document.querySelectorAll('.enemy .sprite')[1];window.stages[1].settle();
    animateEvents([{type:'hpLost',targetId:'victim',amount:5,cause}],{layer:document.body,combatEl:document.body,anchorFor:()=>anchor});
    return anchor.querySelector('.enemy-pose-stage').dataset.pose;
   },cause),'hurt',cause+' reaction');
  }
  console.log('PASS: all 33 stages and 231 pose swaps, stacked auras, expiry, cancellation, reduced motion and missing-frame fallback');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
