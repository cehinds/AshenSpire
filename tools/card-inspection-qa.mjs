// Browser plugin not available; production UI exercised through Playwright.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve('docs/preview/shared-card-inspection');
mkdirSync(output, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const base = `http://localhost:${server.server.address().port}`;
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
try {
  for (const phone of [false, true]) {
    const context = await browser.newContext({ viewport: phone ? { width:390, height:844 } : { width:1440, height:1000 }, isMobile:phone, hasTouch:phone });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/weapon-cards-preview.html`);
    await page.waitForSelector('body[data-preview-ready=true]');
    await page.locator('.epc-art img').first().evaluate(img => img.decode());
    check(await page.title() === 'Ashen Spire · Every weapon', 'preview identity');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'preview width');
    const geometry = await page.locator('.equipment-poker-card').evaluateAll(cards => cards.map(card => {
      const frame = card.querySelector('.epc-frame');
      const r = card.getBoundingClientRect();
      return { ratio:r.width/r.height, split:card.querySelector('.epc-art').offsetHeight / (frame.clientHeight - 38) };
    }));
    check(geometry.length > 20 && geometry.every(g => Math.abs(g.ratio - 5/7) < .002 && Math.abs(g.split - .6) < .002), 'all canonical weapons: 5:7 and 60:40');
    const card = page.locator('.equipment-poker-card').first();
    if (phone) {
      await card.tap({ position:{x:70,y:90} });
      check(await page.locator('.card-inspection-modal').count() === 0, 'first tap selects only');
      check(await card.evaluate(c => c.classList.contains('inspection-selected') && !c.classList.contains('inspection-info-visible')), 'first tap selected without info');
      await card.tap({ position:{x:70,y:90} });
      check(await card.locator('.card-info-button').isVisible(), 'second tap reveals info');
      await card.locator('.card-info-button').tap();
    } else await card.click({ position:{x:70,y:90} });
    await page.locator('.card-inspection-modal').waitFor();
    check(await page.locator('.card-inspection-details').innerText().then(t => t.includes('Straight Sword') && t.includes('Requirements')), 'complete details');
    check(await page.locator('.card-inspection-art').evaluate(e => e.getBoundingClientRect().width <= 221), 'half size card');
    await page.waitForTimeout(400);
    await page.screenshot({ path:resolve(output, `${phone?'phone':'desktop'}-inspection.png`) });
    await page.keyboard.press('Escape');
    check(await page.locator('.card-inspection-modal').count() === 0, 'escape closes');
    check(await page.evaluate(() => document.activeElement.matches('.equipment-poker-card, .card-info-button')), 'focus restored');
    await card.focus(); await page.keyboard.press('Enter');
    check(await page.locator('.card-inspection-modal').count() === 1, 'keyboard inspection');
    await page.keyboard.press('Escape');
    await page.locator('#weapon-search').fill('no such weapon');
    check(await page.locator('#weapon-empty').isVisible(), 'empty search');
    await page.goto(`${base}/index.html?shot=customize`);
    await page.waitForSelector('.customize');
    await page.evaluate(async () => {
      const {contentBundle} = await import('/src/content/index.js');
      const {createRegistries} = await import('/src/model/registries.js');
      const {mountCustomize} = await import('/src/ui/screens/customize.js');
      mountCustomize(document.querySelector('#app'), { registries:createRegistries(contentBundle), defaultSeedString:'671', onBack(){}, onStart:config => { window.inspectionLoadout = config; } });
    });
    await page.locator('[data-face="equipment"]').click();
    await page.locator('#cz-equipment-fold summary').first().click();
    const choice = page.locator('#cz-armours .equipment-poker-card').last();
    const chosenBefore = await page.locator('#cz-armours .equipment-choose[aria-pressed=true]').count();
    await choice.click({ position:{x:70,y:90} });
    check(await page.locator('#cz-armours .equipment-choose[aria-pressed=true]').count() === chosenBefore, 'browsing creation does not commit');
    check((await page.locator('[data-equipment-section] .cc-equipment-details').first().innerText()).length > 100, 'creation details readable');
    await page.waitForTimeout(400);
    await page.screenshot({ path:resolve(output, `${phone?'phone':'desktop'}-creation.png`) });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'creation no overflow');
    const chosenId = await page.locator('#cz-armours [data-starting-armour-id]').last().getAttribute('data-starting-armour-id');
    await page.locator('#cz-armours .equipment-choose').last().click();
    check(await page.locator('#cz-equipment-fold details[open]').count() === 1 && !await page.locator('#cz-armours').isVisible(), 'valid choice retains auto-advance');
    await page.locator('#cz-start').click();
    check(await page.evaluate(() => window.inspectionLoadout.startingArmourId) === chosenId, 'Begin receives actual selected armour');
    // A disposable real merchant, using the production state and stock factories.
    await page.evaluate(async () => {
      const {contentBundle} = await import('/src/content/index.js');
      const {createRegistries} = await import('/src/model/registries.js');
      const {createRunState} = await import('/src/model/state.js');
      const {createRng} = await import('/src/engine/rng.js');
      const {buildShopStock} = await import('/src/engine/encounters.js');
      const {mountShop} = await import('/src/ui/screens/shop.js');
      const r = createRegistries(contentBundle), run = createRunState({seed:671,classId:'reaver',registries:r});
      run.cinders=0; run.shopStock=buildShopStock(r,createRng(671),run);
      window.inspectionRun = run;
      mountShop(document.querySelector('#app'),{registries:r,run,meta:{settings:{}},onLeave(){},onChanged(){}});
    });
    await page.locator('[data-face="bar:armaments"]').click();
    const merchantBefore = await page.evaluate(() => JSON.stringify(window.inspectionRun));
    const offer = page.locator('.shop-inspect-card').first();
    if (phone) { await offer.tap({position:{x:70,y:90}}); await offer.tap({position:{x:70,y:90}}); await offer.locator('.card-info-button').tap(); }
    else await offer.click({position:{x:70,y:90}});
    check(await page.locator('.modal .card-inspection-layout').count() === 1, 'merchant shared layout');
    check(await page.locator('.modal-foot-actions .primary').isDisabled(), 'unaffordable purchase stays disabled while inspect works');
    check(await page.evaluate(() => JSON.stringify(window.inspectionRun)) === merchantBefore, 'inspection does not buy');
    await page.waitForTimeout(400);
    await page.screenshot({ path:resolve(output, `${phone?'phone':'desktop'}-merchant.png`) });
    await page.keyboard.press('Escape');
    check(await page.evaluate(() => JSON.stringify(window.inspectionRun)) === merchantBefore, 'close does not buy');
    await page.evaluate(async () => {
      const {contentBundle} = await import('/src/content/index.js');
      const {createRegistries} = await import('/src/model/registries.js');
      const {mountEquipment} = await import('/src/ui/screens/equipment.js');
      const r = createRegistries(contentBundle);
      document.querySelector('#app').replaceChildren();
      mountEquipment(document.querySelector('#app'), { registries:r, run:window.inspectionRun,
        meta:{found:r.equipment.armaments.map(item=>item.id),settings:{holdConfirm:'normal'}},inCombat:false,onClose(){},onEquipmentChanged(){} });
    });
    await page.getByRole('tab', {name:'Inventory',exact:true}).click();
    const inventoryCard = page.locator('.poker-inventory-face .equipment-poker-card').first();
    const inventoryBefore = await page.evaluate(() => JSON.stringify(window.inspectionRun));
    if (phone) { await inventoryCard.tap({position:{x:50,y:85}}); await inventoryCard.tap({position:{x:50,y:85}}); }
    await inventoryCard.locator('.card-info-button').click();
    await page.locator('.card-inspection-modal').waitFor();
    check(await page.evaluate(() => JSON.stringify(window.inspectionRun)) === inventoryBefore, 'Inventory information never equips');
    await page.waitForTimeout(400);
    await page.screenshot({path:resolve(output,`${phone?'phone':'desktop'}-inventory.png`)});
    await page.keyboard.press('Escape');
    check(await page.evaluate(() => JSON.stringify(window.inspectionRun)) === inventoryBefore, 'Inventory close never equips');
    await page.evaluate(async () => {
      const {contentBundle}=await import('/src/content/index.js');
      const {createRegistries}=await import('/src/model/registries.js');
      const {smithingPlan}=await import('/src/model/smithing.js');
      const {smithSelectionModel}=await import('/src/ui/models/SmithSelectionModel.js');
      const {mountSmithUpgradeModal}=await import('/src/ui/components/smithUpgradeModal.js');
      const r=createRegistries(contentBundle), plan=smithingPlan(r,window.inspectionRun);
      window.inspectionSmithCommits=0;
      const modal=mountSmithUpgradeModal(document.body,smithSelectionModel(r,plan),{registries:r,meta:{settings:{}},
        onSelect:id=>modal.update(smithSelectionModel(r,plan,id)),onBack(){},onConfirm(){window.inspectionSmithCommits++;}});
    });
    check(await page.locator('.smith-confirm').isDisabled(), 'Smith empty selection cannot upgrade');
    const smithCard=page.locator('.smith-candidate-card').first();
    if (phone) { await smithCard.tap({position:{x:50,y:70}}); await smithCard.tap({position:{x:50,y:70}}); }
    await smithCard.locator('.card-info-button').click();
    await page.locator('.card-inspection-modal').waitFor();
    check(await page.evaluate(() => window.inspectionSmithCommits===0 && JSON.stringify(window.inspectionRun)) === inventoryBefore, 'Smith inspection never upgrades');
    await page.waitForTimeout(400);
    await page.screenshot({path:resolve(output,`${phone?'phone':'desktop'}-smith.png`)});
    await page.keyboard.press('Escape');
    await page.goto(`${base}/index.html?shot=combat`);
    await page.waitForSelector('.hand .card');
    const combatBefore = await page.evaluate(() => JSON.stringify(window.__combat));
    const playing = page.locator('.hand .card').first();
    if (!phone) {
      const rect = await playing.boundingBox();
      await page.mouse.move(rect.x + 35, rect.y + 70);
      await page.mouse.down();
      await page.waitForTimeout(650);
      check(await playing.getAttribute('data-inspect') === 'open', 'existing hold inspection still opens');
      await page.mouse.up();
      check(await page.evaluate(() => JSON.stringify(window.__combat)) === combatBefore, 'hold inspection never plays');
    }
    if (phone) {
      await playing.tap({position:{x:35,y:70}});
      await playing.tap({position:{x:35,y:70}});
      check(await page.evaluate(() => JSON.stringify(window.__combat)) === combatBefore, 'two inspection taps never play');
      await playing.locator('.card-info-button').tap();
    } else await playing.locator('.card-info-button').click();
    await page.locator('.card-inspection-modal').waitFor();
    check(await page.evaluate(() => JSON.stringify(window.__combat)) === combatBefore, 'information never plays a card');
    await page.waitForTimeout(400);
    await page.screenshot({ path:resolve(output, `${phone?'phone':'desktop'}-playing.png`) });
    await page.keyboard.press('Escape');
    check(await page.evaluate(() => JSON.stringify(window.__combat)) === combatBefore, 'closing information never plays');
    if (!phone) {
      const rect=await playing.boundingBox(), enemy=await page.locator('.enemy').first().boundingBox();
      await page.mouse.move(rect.x+35,rect.y+70); await page.mouse.down();
      await page.mouse.move(enemy.x+enemy.width/2,enemy.y+enemy.height/2,{steps:12}); await page.mouse.up();
      await page.waitForTimeout(1500);
      check(await page.evaluate(() => JSON.stringify(window.__combat)) !== combatBefore, 'existing drag play still commits');
    }
    await page.evaluate(async () => {
      const {renderEquipmentCard} = await import('/src/ui/components/equipmentCard.js');
      const {contentBundle} = await import('/src/content/index.js');
      const {createRegistries} = await import('/src/model/registries.js');
      const r=createRegistries(contentBundle), piece=r.equipment.armaments[0];
      const {equipmentCardModel}=await import('/src/model/equipmentCard.js');
      const model={...equipmentCardModel(r,piece),name:'Long weapon name '.repeat(10),flavor:'Complete explanation remains accessible. '.repeat(80)};
      document.querySelector('#app').replaceChildren(renderEquipmentCard(r,piece,{presentation:model}).card);
    });
    await page.locator('#app > .equipment-poker-card .card-info-button').focus();
    await page.keyboard.press('Enter');
    check((await page.locator('.card-inspection-details').innerText()).includes('Complete explanation remains accessible.'), 'long text preserved');
    check(await page.locator('.card-inspection-modal .modal-body').evaluate(e => {e.scrollTop=e.scrollHeight; return e.scrollTop>0;}), 'long inspector scrolls');
    check(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1), 'long text no horizontal overflow');
    await page.keyboard.press('Escape');
    check(errors.length === 0, `no runtime errors: ${errors.join('; ')}`);
    await context.close();
  }
  const shipped = await browser.newPage({viewport:{width:1280,height:900}});
  const shippedErrors=[];
  shipped.on('pageerror',error=>shippedErrors.push(error.message));
  await shipped.goto(`${base}/AshenSpire.html?shot=combat`);
  await shipped.locator('.hand .card .card-info-button').first().click();
  await shipped.locator('.card-inspection-modal').waitFor();
  check(shippedErrors.length===0, 'regenerated standalone boots and opens inspection');
  await shipped.close();
  console.log(`PASS — ${checks}/${checks} checks passed`);
} finally {
  await browser.close(); server.server.close();
}
