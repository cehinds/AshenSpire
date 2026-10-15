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
 await page.goto(`${base}${entry}?shot=rest&gameProfile=${profile}&shotRestState=wounded&shotSeed=3${extra}`);
 await page.locator('.rest-door').waitFor();return page;
}
async function frame(page) {
 for(const selector of ['.rest-screen','.rest-door','.rest-choices','.rest-consequences','#shrine-leave']) assert.ok(await page.locator(selector).isVisible(),`${selector} visible`);
 const bounds=await page.locator('.rest-door').boundingBox();const viewport=page.viewportSize();
 assert.ok(bounds.x>=-1 && bounds.x+bounds.width<=viewport.width+1,'rest choicebody fits host');
}
async function snapshot(page) {return page.evaluate(()=>window.__restStateForShot());}
function recovered(row) {
 for(const [current,max] of [['hp','maxHp'],['mana','maxMana'],['stamina','maxStamina']]) assert.equal(row[current],row[max],`${current} fully restored`);
 assert.equal(row.flaskCharges.hpCurrent,row.flaskCharges.hp);
 assert.equal(row.flaskCharges.manaCurrent,row.flaskCharges.mana);
}
async function spent(page,service) {
 await page.waitForFunction(value=>window.__restStateForShot().live.visit?.service===value,service);
 const state=await snapshot(page);recovered(state.live);recovered(state.saved);
 assert.deepEqual(state.saved,state.live,'committed state survives actual save/load roundtrip');
 for(const id of ['strategize-opt','smith-opt','level-opt']) assert.equal(await page.locator(`#${id}`).getAttribute('aria-disabled'),'true');
 await page.locator('#shrine-leave').click();await page.locator('.mapscreen').waitFor();
 await page.locator(`.map-node[data-node="${state.live.mapNodeId}"]`).click();
 await page.locator('#map-enter').click();await page.locator('.rest-door').waitFor();
 assert.equal((await snapshot(page)).live.visit.service,service,'re-entering retains spent service');
 for(const id of ['strategize-opt','smith-opt','level-opt']) assert.equal(await page.locator(`#${id}`).getAttribute('aria-disabled'),'true');
 return state;
}
async function behavior() {
 const unavailable=await open('core');
 assert.equal(await unavailable.locator('#level-opt').getAttribute('aria-disabled'),'true');
 assert.ok((await unavailable.locator('#level-opt p').innerText()).trim().length>5,'unavailable Level explains its reason');
 await unavailable.close();
 for(const service of ['strategize','smith','levelUp']) {
  const page=await open('core','desktop','&shotRestPoints=1');const before=await snapshot(page);
  assert.ok(before.live.hp<before.live.maxHp);assert.equal(before.live.flaskCharges.hpCurrent,0);
  if(service==='strategize') {
   await page.locator('#strategize-opt').click();await page.locator('#deck-editor-done').waitFor();
   await page.locator('.deck-editor-step[data-action="add"][aria-disabled="false"]').first().click();
   assert.deepEqual((await snapshot(page)).live,before.live,'deck draft does not mutate live run');
   await page.locator('#deck-editor-cancel').click();
   assert.deepEqual((await snapshot(page)).live,before.live,'cancelled Strategize consumes nothing');
   await page.locator('#strategize-opt').click();
   await page.locator('.deck-editor-step[data-action="add"][aria-disabled="false"]').first().click();
   await page.locator('#deck-editor-done').click();
  } else if(service==='smith') {
   await page.locator('#smith-opt').click();
   await page.locator('.smith-candidate-card').first().click();
   await page.locator('.smith-back').click();
   assert.deepEqual((await snapshot(page)).live,before.live,'cancelled Smith consumes nothing');
   await page.locator('#smith-opt').click();await page.locator('.smith-candidate-card').first().click();
   await page.locator('.smith-confirm').click();await page.locator('.confirmation-confirm').click();
  } else {
   await page.locator('#level-opt').click();
   await page.locator('[data-stat-action="increase"][data-stat-id="constitution"]').click();
   assert.deepEqual((await snapshot(page)).live,before.live,'attribute draft does not mutate live run');
   await page.locator('[data-stat-cancel]').click();
   assert.deepEqual((await snapshot(page)).live,before.live,'cancelled Level consumes nothing');
   await page.locator('#level-opt').click();
   await page.locator('[data-stat-action="increase"][data-stat-id="constitution"]').click();
   await page.locator('[data-stat-done]').click();
  }
  const after=await spent(page,service);
  if(service==='strategize') assert.equal(after.live.deck.length,before.live.deck.length+1,'confirmed deck draft is persisted');
  if(service==='smith') assert.notDeepEqual(after.live.itemUpgradeLevels,before.live.itemUpgradeLevels,'confirmed equipment tier is persisted');
  if(service==='levelUp') assert.equal(after.live.attributes.constitution,before.live.attributes.constitution+1,'confirmed attribute is persisted');
  console.log(`Rest service passed: ${service}`);await page.close();
 }
}
try {
 if(!process.env.REST_UI_CAPTURE_ONLY) await behavior();
 for(const host of Object.keys(hosts)) {
  const page=await open('core',host,'&shotRestPoints=1');await frame(page);
  await page.screenshot({path:resolve(output,`${host}-rest.png`)});
  await page.locator('#smith-opt').click();await page.locator('.smith-upgrade-modal').waitFor();
  await page.screenshot({path:resolve(output,`${host}-smith.png`)});
  await page.keyboard.press('Escape');await page.locator('.smith-upgrade-modal').waitFor({state:'detached'});
  await page.locator('#level-opt').click();await page.locator('.cc-stat-modal').waitFor();
  await page.locator('[data-stat-action="increase"][data-stat-id="constitution"]').click();
  await page.screenshot({path:resolve(output,`${host}-level.png`)});
  await page.locator('[data-stat-cancel]').click();await page.close();
 }
 const reference=await open('current');await frame(reference);
 await reference.screenshot({path:resolve(output,'current-desktop-rest.png')});await reference.close();
 assert.deepEqual(errors,[],'no page errors');
 console.log(`Rest shared-frame browser captures passed: ${output}`);
} finally {await browser.close();}
