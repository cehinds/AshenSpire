const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const file of ['index.html','AshenSpire.html'])for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${process.env.ENEMY_PREVIEW_ORIGIN||'http://127.0.0.1:4288'}/${file}?shot=combat`);
   await page.locator('.end-turn').waitFor();
   await page.evaluate(()=>{
    const c=window.__combat;c.player.hp=1000;c.player.maxHp=1000;
    c.enemies[0].statuses={strength:{stacks:2},regen:{stacks:2}};
    c.enemies[0].hp=10;c.enemies[0].maxHp=100;c.enemies[0].block=0;
    window.__renderCombatForShot();
   });
   await page.waitForFunction(()=>document.querySelector('.enemy-pose-stage')?.dataset.pose==='wounded');
   assert.equal(await page.locator('.enemy-pose-stage').first().getAttribute('data-buffs'),'strength regen');
   await page.evaluate(()=>{const e=window.__combat.enemies[0];e.statuses={};e.hp=100;e.block=10;window.__renderCombatForShot();});
   await page.waitForFunction(()=>document.querySelector('.enemy-pose-stage')?.dataset.pose==='guard');
   assert.equal(await page.locator('.enemy-pose-stage').first().getAttribute('data-buffs'),'');
   await page.evaluate(()=>{
    const c=window.__combat;c.enemies[0].block=0;c.enemies[0].enemyId='marrowOrganist';
    c.enemies[0].pendingMove={moveId:'funeralChord',resolveOnTurn:0};c.enemies[0].intent={kind:'attack',moveId:'funeralChord',damage:28};window.__renderCombatForShot();
    window.poseSamples=[];const sample=()=>{document.querySelectorAll('.enemy .sprite').forEach(el=>{if(el.classList.contains('enemy-attack-pose'))window.poseSamples.push({family:el.dataset.actionFamily,pose:el.querySelector('.enemy-pose-stage')?.dataset.pose,attack:getComputedStyle(el.querySelector('.enemy-pose-attack')).visibility});});window.poseRaf=requestAnimationFrame(sample);};window.poseRaf=requestAnimationFrame(sample);
   });
   await page.locator('.end-turn').hover();await page.mouse.down();await page.waitForTimeout(1000);await page.mouse.up();
   await page.waitForFunction(()=>window.__combat.turn>=2&&window.__combat.phase==='player');await page.waitForTimeout(3500);
   const result=await page.evaluate(()=>{cancelAnimationFrame(window.poseRaf);return {samples:window.poseSamples,lingering:document.querySelectorAll('.enemy-attack-pose').length,broken:[...document.querySelectorAll('.enemy-pose-state')].filter(i=>!i.complete||!i.naturalWidth).length,inline:[...document.querySelectorAll('.enemy-pose-state')].every(i=>i.src.startsWith('data:image/')),spell:window.__combat.eventLog.some(e=>e.type==='enemyMoveStarted'&&e.moveId==='funeralChord')};});
   assert(result.spell);assert(result.samples.some(s=>s.family==='spell'&&s.pose==='projectile'),'spell uses projectile drawing');
   assert.equal(result.lingering,0);assert.equal(result.broken,0);assert.equal(result.inline,file==='AshenSpire.html');assert.deepEqual(errors,[]);
   await page.mouse.move(0,0);await page.screenshot({path:`art/enemy-states/frames/review/game-${file==='index.html'?'served':'standalone'}-${width}.png`});
   console.log(`PASS: ${file} ${width}px real spell pose, wounds, guard, buff auras and removal`);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
