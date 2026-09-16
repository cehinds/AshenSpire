const {chromium}=require('playwright');
const {writeFileSync}=require('node:fs');
const assert=require('node:assert/strict');
// Screenshot routes use memory-only saves; force a due spell attack to avoid RNG.
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const reports=[];
 try {
  for(const file of ['index.html','AshenSpire.html'])for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${process.env.ENEMY_PREVIEW_ORIGIN || 'http://127.0.0.1:4287'}/${file}?shot=combat`);
   await page.locator('.end-turn').waitFor();
   await page.evaluate(()=>{
    const c=window.__combat;c.player.hp=1000;c.player.maxHp=1000;
    c.enemies[0].enemyId='marrowOrganist';
    c.enemies[0].pendingMove={moveId:'funeralChord',resolveOnTurn:0};
    c.enemies[0].intent={kind:'attack',moveId:'funeralChord',damage:28};
    window.poseSamples=[];
    const samplePoses=()=>{
     document.querySelectorAll('.enemy .sprite').forEach(e=>{
      if(e.classList.contains('enemy-attack-pose'))window.poseSamples.push({family:e.dataset.actionFamily,pose:e.querySelector('.enemy-pose-stage')?.dataset.pose,visible:getComputedStyle(e.querySelector('.enemy-pose-attack')).visibility,idle:getComputedStyle(e.querySelector('.enemy-pose-idle')).visibility});
     });
     window.poseRaf=requestAnimationFrame(samplePoses);
    };
    window.poseRaf=requestAnimationFrame(samplePoses);
   });
   await page.locator('.end-turn').hover();await page.mouse.down();await page.waitForTimeout(1000);await page.mouse.up();
   await page.waitForFunction(()=>window.__combat.turn>=2&&window.__combat.phase==='player');
   await page.waitForTimeout(3500);
   const result=await page.evaluate(()=>({
    samples:window.poseSamples,
    lingering:document.querySelectorAll('.enemy-attack-pose').length,
    idleRestored:[...document.querySelectorAll('.enemy-pose-idle')].every(e=>getComputedStyle(e).visibility==='visible'),
    broken:[...document.querySelectorAll('.enemy-pose-idle,.enemy-pose-attack')].filter(e=>!e.complete||!e.naturalWidth).length,
    spellExecuted:window.__combat.eventLog.some(e=>e.type==='enemyMoveStarted'&&e.moveId==='funeralChord'&&e.kind==='attack'),
    inline:[...document.querySelectorAll('.enemy-pose-attack')].every(e=>e.src.startsWith('data:image/')),
   }));
   assert(result.spellExecuted,'real spell attack must execute');
   assert(result.samples.some(e=>e.family==='spell'&&(e.visible==='visible'||e.pose==='projectile')&&e.idle==='hidden'),'spell attack frame visible');
   assert(result.samples.some(e=>e.family!=='spell'&&e.visible==='visible'),'melee attack visible');
   assert.equal(result.lingering,0);assert(result.idleRestored);assert.equal(result.broken,0);
   assert.equal(result.inline,file==='AshenSpire.html');assert.deepEqual(errors,[]);
   await page.mouse.move(0,0);await page.screenshot({path:`art/enemy-poses/game-${file==='index.html'?'served':'standalone'}-${width}.png`});
   reports.push({file,width,...result,errors});await page.close();
  }
  writeFileSync('art/enemy-poses/game-checks.json',JSON.stringify(reports,null,2)+'\n');
  console.log('PASS: served + standalone, desktop + phone; real spell/melee attacks and idle restoration');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
