// REST_UI_BASE=http://localhost:4460/ REST_UI_ENTRY=AshenSpire.html PLAYWRIGHT_MODULE=/path/to/playwright node tests/rest-ui.browser.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.REST_UI_BASE || 'http://127.0.0.1:4460/';
const entry=process.env.REST_UI_ENTRY || 'index.html';
const output=resolve(process.env.REST_UI_OUT || '/tmp/ashen-rest-ui');
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME || '/usr/bin/chromium',args:['--no-sandbox']});
const errors=[];
const hosts={desktop:[1440,900],wide:[1920,1080],tablet:[1024,768],mobile:[390,844]};
async function open(profile='core',host='desktop',extra='') {
 const [width,height]=hosts[host];
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
 page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}${entry}?shot=rest&gameProfile=${profile}&shotRestState=wounded&shotSeed=3${extra}`,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.rest-door').waitFor();return page;
}
async function frame(page) {
 for(const selector of ['.rest-screen','.rest-door','.rest-choices','.rest-consequences','#shrine-leave','.room-header','.polish-scene-painting','.rest-traveler-foreground']) assert.ok(await page.locator(selector).isVisible(),`${selector} visible`);
 const bounds=await page.locator('.rest-door').boundingBox();const viewport=page.viewportSize();
 assert.ok(bounds.x>=-1 && bounds.x+bounds.width<=viewport.width+1,'rest choicebody fits host');
}
async function snapshot(page) {return page.evaluate(()=>window.__restStateForShot());}
function recovered(row) {
 for(const [current,max] of [['hp','maxHp'],['mana','maxMana'],['stamina','maxStamina']]) assert.equal(row[current],row[max],`${current} fully restored`);
 assert.equal(row.flaskCharges.hpCurrent,row.flaskCharges.hp);
 assert.equal(row.flaskCharges.manaCurrent,row.flaskCharges.mana);
}
const optionIds={smith:'smith-opt',levelUp:'level-opt'};
// D10: a committed service spends only itself, heals, and leaves the screen open; only Continue leaves.
async function spent(page,service) {
 try { await page.waitForFunction(value=>window.__restStateForShot().live.visit?.used?.[value]===true,service); } catch(error) {
  console.log('Uncommitted service',service,await snapshot(page),await page.locator('[role=alert]').allTextContents());
  await page.screenshot({path:resolve(output,'failure.png')});throw error;
 }
 const state=await snapshot(page);recovered(state.live);recovered(state.saved);
 assert.deepEqual(state.saved,state.live,'committed state survives actual save/load roundtrip');
 assert.equal(await page.locator(`#${optionIds[service]}`).getAttribute('aria-disabled'),'true',`${service} spent`);
 assert.ok(await page.locator('.rest-door').isVisible(),'no auto-close after a service');
 return state;
}
async function leaveAndReturn(page,state,used) {
 await page.locator('#shrine-leave').click();await page.locator('.mapscreen').waitFor();
 await page.locator(`.map-node[data-node="${state.live.mapNodeId}"]`).click();
 await page.locator('#map-enter').click();await page.locator('.rest-door').waitFor();
 const live=(await snapshot(page)).live;
 for(const service of used) assert.equal(live.visit.used[service],true,`re-entering retains spent ${service}`);
 for(const service of used) assert.equal(await page.locator(`#${optionIds[service]}`).getAttribute('aria-disabled'),'true');
}
async function behavior() {
 const unavailable=await open('core');
 assert.equal(await unavailable.locator('#level-opt').getAttribute('aria-disabled'),'true');
 assert.ok((await unavailable.locator('#level-opt p').innerText()).trim().length>5,'unavailable Level explains its reason');
 await unavailable.close();
 // Core rest: heal on arrival, Smith and Level Up together and free, no Strategize, Continue is the only way out.
 {
  const page=await open('core','desktop','&shotRestPoints=1');const before=await snapshot(page);
  recovered(before.live);
  assert.equal(await page.locator('#strategize-opt').count(),0,'Strategize is gone from Core rests');
  assert.ok(await page.locator('[data-rest-healed]').isVisible(),'the screen reports the heal');
  assert.equal(await page.locator('#smith-opt').getAttribute('aria-disabled'),'false');
  assert.equal(await page.locator('#level-opt').getAttribute('aria-disabled'),'false');
  await page.locator('#smith-opt').click();
  await page.locator('.smith-candidate-card').first().click();
  await page.locator('.smith-back').click();
  assert.deepEqual((await snapshot(page)).live,before.live,'cancelled Smith consumes nothing');
  await page.locator('#smith-opt').click();await page.locator('.smith-candidate-card').first().click();
  await page.locator('.smith-confirm').click();await page.locator('.confirmation-confirm').click();
  const afterSmith=await spent(page,'smith');
  assert.notDeepEqual(afterSmith.live.itemUpgradeLevels,before.live.itemUpgradeLevels,'confirmed equipment tier is persisted');
  assert.equal(await page.locator('#level-opt').getAttribute('aria-disabled'),'false','Smith leaves Level Up open');
  await page.locator('#level-opt').click();
  await page.locator('[data-stat-action="increase"][data-stat-id="constitution"]').click();
  assert.deepEqual((await snapshot(page)).live,afterSmith.live,'attribute draft does not mutate live run');
  await page.locator('[data-stat-cancel]').click();
  await page.locator('#level-opt').click();
  await page.locator('[data-stat-action="increase"][data-stat-id="constitution"]').click();
  await page.locator('[data-stat-done]').click();
  const afterLevel=await spent(page,'levelUp');
  assert.equal(afterLevel.live.attributes.constitution,before.live.attributes.constitution+1,'confirmed attribute is persisted');
  await leaveAndReturn(page,afterLevel,['smith','levelUp']);
  console.log('Rest services passed: smith + levelUp, Continue leaves');await page.close();
 }
 {
  const page=await open('core');const state=await snapshot(page);
  await leaveAndReturn(page,state,[]);console.log('Continue without a service leaves');await page.close();
 }
}
try {
 if(!process.env.REST_UI_CAPTURE_ONLY) await behavior();
 if(!process.env.REST_UI_BEHAVIOR_ONLY) {
 for(const host of Object.keys(hosts).filter(host=>!process.env.REST_UI_CAPTURE_HOSTS || process.env.REST_UI_CAPTURE_HOSTS.split(',').includes(host))) {
  const page=await open('core',host,'&shotRestPoints=1');await frame(page);
  await page.screenshot({path:resolve(output,`${host}-rest.png`)});
  await page.locator('#smith-opt').click();await page.locator('.smith-upgrade-modal').waitFor();
  await page.locator('.smith-candidate-card').first().click();
  await page.locator('.smith-upgrade-modal .rest-recovery').waitFor();
  await page.screenshot({path:resolve(output,`${host}-smith.png`)});
  await page.keyboard.press('Escape');await page.locator('.smith-upgrade-modal').waitFor({state:'detached'});
  await page.locator('#level-opt').click();await page.locator('.cc-stat-modal').waitFor();
  await page.locator('[data-stat-action="increase"][data-stat-id="constitution"]').click();
  await page.screenshot({path:resolve(output,`${host}-level.png`)});
  await page.locator('[data-stat-cancel]').click();await page.close();
 }
 const reference=await open('current');await frame(reference);
 await reference.screenshot({path:resolve(output,'current-desktop-rest.png')});await reference.close();
 const creation=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 creation.on('pageerror',error=>errors.push(error.message));
 await creation.goto(`${base}${entry}?shot=title&gameProfile=core`);
 await creation.locator('#new-game').click();await creation.locator('[data-slot-pick="2"]').click();
 await creation.getByRole('button',{name:'Create character',exact:true}).click();
 await creation.getByRole('button',{name:'Start',exact:true}).click();
 assert.deepEqual(await creation.locator('.cz-class').evaluateAll(nodes=>nodes.map(node=>node.dataset.class)),['reaver','starseer']);
 assert.equal(await creation.locator('.cz-class.locked').getAttribute('data-class'),'starseer');
 await creation.screenshot({path:resolve(output,'desktop-class.png')});
 await creation.locator('#cz-next').click();
 assert.equal(await creation.locator('.cc-starter-deck .card').count(),10);
 await creation.locator('[data-summary-slot="rightHand"] .epc-name').waitFor();
 await creation.waitForFunction(()=>[...document.querySelectorAll('.cc-summary-cards img')].filter(img=>img.getClientRects().length && !img.hidden).every(img=>img.complete && img.naturalWidth>0));
 await creation.locator('[data-summary-slot="rightHand"] img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 await creation.mouse.move(0,0);
 await creation.screenshot({path:resolve(output,'desktop-review.png')});await creation.close();
 }
 assert.deepEqual(errors,[],'no page errors');
 console.log(`Rest UI browser checks passed${process.env.REST_UI_BEHAVIOR_ONLY ? '' : `; captures: ${output}`}`);
} finally {await browser.close();}
