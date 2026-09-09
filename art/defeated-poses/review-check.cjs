const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
 const page = await browser.newPage();
 await page.route('**/src/main.js', async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace('if (stub._h && stub._h.onMessage)', 'window.__reviewStub = stub; if (stub._h && stub._h.onMessage)');
  await route.fulfill({response,body});
 });
 await page.goto('http://127.0.0.1:4288/index.html?shot=coop');
 await page.waitForFunction(() => window.__coopSnapshot && window.__reviewStub);
 const styles = await page.evaluate(async () => {
  const {classSprite} = await import('/src/ui/assets.js');
  const {stageFor} = await import('/src/ui/services/PoseAnimator.js');
  const {PAINTED_OUTFITS} = await import('/src/content/paintedOutfits.js');
  return Object.keys(PAINTED_OUTFITS).map(id => {
   const [classId, armourId='default'] = id.split('-');
   const host = classSprite(classId, null, null, null, 'rendered', null, armourId);
   document.body.append(host);
   const stage = stageFor(host), presentation = host.querySelector('.painted-presentation');
   const staticIdle = !host.classList.contains('animated') && presentation.src.endsWith(PAINTED_OUTFITS[id].menu.stand) && stage.play('attack',100) === false;
   stage.setRestPose('defeated');
   const down = stage.pose === 'defeated' && presentation.style.visibility === 'hidden' && !host.querySelector('.painted-stage').hidden;
   stage.setRestPose('idle');
   const revived = presentation.style.visibility === 'visible' && host.querySelector('.painted-stage').hidden;
   stage.dispose(); host.remove(); return {id,staticIdle,down,revived};
  });
 });
 assert.equal(styles.length,16); assert(styles.every(s=>s.staticIdle&&s.down&&s.revived),JSON.stringify(styles));
 for (const amount of [15,3]) {
  const result = await page.evaluate(amount => {
   const snapshot = structuredClone(window.__coopSnapshot);
   snapshot.scene.receiptSeq = (snapshot.scene.receiptSeq||0)+1;
   snapshot.scene.events = [{type:'hpLost',targetId:'e2',amount,cause:'effect'}];
   snapshot.scene.enemies[1].hp -= amount;
   window.__reviewStub._h.onMessage({t:'state',snapshot});
   const box = document.querySelector('[data-eid="e2"] .sprite');
   return {duration:box.style.getPropertyValue('--hurt-duration'),flash:box.classList.contains('hitflash'),css:getComputedStyle(box.firstElementChild).animationDuration};
  },amount);
  assert.deepEqual(result,{duration:`${amount>=12?380:220}ms`,flash:true,css:amount>=12?'0.38s':'0.22s'});
 }
 console.log('PASS: all 16 Rendered outfits retain static artwork, defeat and revive; actual co-op heavy/light receipts synchronize CSS flash duration.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

