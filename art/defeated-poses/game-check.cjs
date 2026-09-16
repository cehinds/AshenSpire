const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 for(const file of ['index.html','AshenSpire.html'])for(const width of [1440,390]){
  const p=await b.newPage({viewport:{width,height:width===390?844:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:4288/${file}?shot=combat`);await p.locator('.end-turn').waitFor();
  await p.evaluate(()=>{const c=__combat;c.enemies[0].hp=0;c.enemies[0].alive=false;c.player.hp=0;c.player.alive=false;__renderCombatForShot()});
  await p.waitForFunction(()=>document.querySelector('.enemy-pose-stage')?.dataset.pose==='defeated'&&document.querySelector('.player .painted-stage')?.dataset.pose==='defeated');
  const info=await p.evaluate(()=>{const imgs=[...document.querySelectorAll('.enemy-pose-state,.defeated-frame')];return{broken:imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src.slice(0,80)),inline:imgs.every(i=>i.src.startsWith('data:image/'))}});
  assert.deepEqual(info.broken,[]);assert.equal(info.inline,file==='AshenSpire.html');
  if(width===390)assert(await p.locator('.player .defeated-frame').evaluate(e=>e.getBoundingClientRect().left>=0),'phone defeated frame stays inside viewport');
  await p.screenshot({path:`art/defeated-poses/work/game-${file}-${width}.png`});
  await p.evaluate(()=>{const c=__combat;c.enemies[0].hp=10;c.enemies[0].alive=true;c.player.hp=20;c.player.alive=true;__renderCombatForShot()});
  await p.waitForFunction(()=>document.querySelector('.enemy-pose-stage')?.dataset.pose!=='defeated'&&document.querySelector('.player .painted-stage')?.dataset.pose==='idle');
  assert.deepEqual(errors,[]);console.log(`PASS ${file} ${width}: defeated state survives real render; revival restores living poses; assets loaded.`);await p.close();
 }
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
