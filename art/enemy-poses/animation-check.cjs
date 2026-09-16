const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage();
  await page.goto((process.env.ENEMY_PREVIEW_ORIGIN||'http://127.0.0.1:4287')+'/art/enemy-poses/index.html');
  await page.evaluate(async()=>{
   const base=document.createElement('base');base.href='/';document.head.append(base);
   const css=document.createElement('link');css.rel='stylesheet';css.href='/styles/combat.css';
   await new Promise(resolve=>{css.onload=resolve;document.head.append(css);});
   const {enemySprite}=await import('/src/ui/assets.js');
   const {entries}=await(await fetch('/assets/enemy-poses/manifest.json')).json();
   document.body.innerHTML='';
   for(const e of entries){
    const host=document.createElement('div');host.className='enemy';
    const sprite=document.createElement('div');sprite.className='sprite';sprite.dataset.actionMotion='lunge';
    sprite.append(enemySprite({...e,size:'medium'}));host.append(sprite);document.body.append(host);
   }
   await Promise.all([...document.images].map(i=>i.decode()));
  });
  for(const duration of [140,280,560]){
   for(const [phase,idle,attack] of [[0.1,'visible','hidden'],[0.55,'hidden','visible'],[0.9,'visible','hidden']]){
    const samples=await page.evaluate(({duration,phase})=>[...document.querySelectorAll('.sprite')].map(el=>{
     el.style.setProperty('--enemy-attack-duration',duration+'ms');el.style.animationDuration=duration+'ms';
     el.classList.add('act-attack','enemy-attack-pose');
     for(const a of el.getAnimations({subtree:true})){a.pause();a.currentTime=duration*phase;}
     return [...el.querySelectorAll('.enemy-pose-idle,.enemy-pose-attack')].map(i=>getComputedStyle(i).visibility);
    }),{duration,phase});
    assert.equal(samples.length,33);
    assert(samples.every(s=>s[0]===idle&&s[1]===attack),`phase ${phase} at ${duration}ms`);
   }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert(await page.evaluate(()=>[...document.querySelectorAll('.sprite')].every(e=>getComputedStyle(e).animationName==='none')));
  assert(await page.evaluate(()=>[...document.querySelectorAll('.sprite')].every(el=>{
   for(const a of el.getAnimations({subtree:true})){a.pause();a.currentTime=560*0.55;}
   return getComputedStyle(el.querySelector('.enemy-pose-attack')).visibility==='visible';
  })),'attack frame remains readable without motion');
  const restored=await page.evaluate(()=>[...document.querySelectorAll('.sprite')].every(el=>{
   el.classList.remove('act-attack','enemy-attack-pose');
   return getComputedStyle(el.querySelector('.enemy-pose-idle')).visibility==='visible'
    &&getComputedStyle(el.querySelector('.enemy-pose-attack')).visibility==='hidden';
  }));
  assert(restored,'cancellation restores idle');
  console.log('PASS: 33 enemies x 3 speeds x wind-up/impact/recovery; reduced motion and cancellation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
