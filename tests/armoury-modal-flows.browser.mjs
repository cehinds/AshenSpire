// Driven in real Chromium against the source tree (the repo's own tools/serve.mjs):
//   PLAYWRIGHT_MODULE=/path/to/playwright node tests/armoury-modal-flows.browser.mjs
// Env: CHROME=<executable>, SHOT_DIR=<dir> to also save screenshots.
// Owner, 2026-11-05: Inspect and Equip on an Inventory item are modals, not
// inline sections. Inspect opens the card inspection modal (no aside in the
// DOM); Equip asks "Choose a slot" only when the item fits more than one open
// position, then compares (occupied) or confirms (empty) before equipping.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SHOT_DIR = process.env.SHOT_DIR || '';
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = process.env.BASE_URL || server.url;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const errors = [];

async function mount(page, view = 'rack', emptyOffHand = true, combat = false) {
  await page.goto(`${base}index.html?shot=map&shotSeed=ART1`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async ({ emptyOffHand, combat }) => {
    const { contentBundle } = await import('/src/content/index.js');
    const { createRegistries } = await import('/src/model/registries.js');
    const { createRunState } = await import('/src/model/state.js');
    const { mountEquipment } = await import('/src/ui/screens/equipment.js');
    const registries = createRegistries(contentBundle);
    const run = createRunState({ seed: 11, classId: 'reaver', registries });
    const spare = registries.equipment.armour.find((row) => row.classId === 'reaver' && row.id !== 'default');
    run.loadout.storage = ['ashStaff'];
    // The Off Hand starts empty so one run shows both an occupied and an empty destination.
    if (emptyOffHand) { run.loadout.sets.leftHand = [null]; run.loadout.storage.push('roundShield'); }
    run.attributes = { ...run.attributes, intelligence: 6, strength: 6 };
    if (spare) run.loadout.boughtArmour = [{ classId: 'reaver', id: spare.id }];
    // The Armoury is the screen under test; start from a clean page.
    document.querySelectorAll('.modal-veil').forEach((node) => node.remove());
    const meta = { settings: { holdConfirm: 'off', equipView: 'rack' }, found: registries.equipment.armaments.map((row) => row.id) };
    window.__armouryRun = run;
    window.__armouryRegistries = registries;
    window.__armouryEquipped = [];
    mountEquipment(document.body, {
      registries, run, meta, inCombat: combat, onClose() {},
      // In combat an equip is priced by the host: a refusal string is the notice (here: always refused).
      onEquip: combat ? () => 'Not enough Poise to change gear.' : undefined,
      onChange: (loadout) => { run.loadout = loadout; },
      onEquipmentChanged: (event) => window.__armouryEquipped.push(event),
    });
  }, { emptyOffHand, combat });
  await page.waitForSelector('.armoury .armoury-position-card');
  // The phone shows the views as a dropdown; a DOM click reaches the member whether or not the list is open.
  await page.evaluate((v) => document.querySelector(`[data-surface="armouryView"] [data-member="${v}"]`)?.click(), view);
  await page.waitForSelector(view === 'rack' ? '.armoury .armoury-position-card' : '.armoury .disc-face');
}

const wait = (page, ms) => page.waitForTimeout(ms);
const face = (page, name) => page.locator('.armoury .disc-face', { hasText: name }).first();

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  await mount(page, 'hybrid');
  const equipBtn = () => page.locator('.armoury-item-detail .ep-equip[data-act="equip"]:visible').first();
  const sets = () => page.evaluate(() => structuredClone(window.__armouryRun.loadout.sets));
  const open = async (name) => { await face(page, name).click(); await equipBtn().waitFor(); };
  assert.equal(await page.locator('.armament-list-inspection, .armament-destinations, .armament-destination').count(), 0, 'no inline aside or destination section');

  // One destination (armour has one slot) and it is occupied: straight to the compare modal, no slot modal.
  const slotModal = page.locator('.equip-slot-choice');
  const confirm = page.locator('.equip-confirm-modal');
  const compare = page.locator('.equip-compare-modal');
  const spare = await page.evaluate(() => window.__armouryRun.loadout.boughtArmour?.[0]?.id);
  assert.ok(spare, 'the fixture owns a spare outfit');
  await open(await page.evaluate((id) => window.__armouryRegistries.equipment.armour.find((row) => row.classId === 'reaver' && row.id === id).name, spare));
  await equipBtn().click();
  await compare.waitFor();
  assert.equal(await slotModal.count(), 0, 'one destination skips the slot modal');
  assert.equal(await confirm.count(), 0, 'an occupied destination compares, it does not confirm');
  await page.keyboard.press('Escape');
  await compare.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.__armouryEquipped.length), 0, 'Back equips nothing');
  assert.equal(await page.evaluate(() => document.activeElement?.className.includes('ep-equip')), true, 'focus returns to Equip after Back');

  // Two destinations (either hand): the slot modal first.
  await open('Ash Staff');
  await equipBtn().click();
  await slotModal.waitFor();
  const rows = await slotModal.locator('.option-row').evaluateAll((nodes) => nodes.map((n) => [n.querySelector('.option-row-name').textContent, n.querySelector('.option-row-status').textContent.trim(), n.disabled]));
  assert.deepEqual(rows.map(([label]) => label), ['Main Hand · 1', 'Off Hand · 1']);
  assert.match(rows[0][1], /^Active · Straight Sword$/);
  assert.match(rows[1][1], /^Active · empty$/);
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/armoury-slot-desktop.png` });
  await slotModal.locator('button', { hasText: 'Back' }).click();
  await slotModal.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.__armouryEquipped.length), 0, 'Back equips nothing');

  // Occupied destination: the compare modal; Equip changes run.loadout.
  await equipBtn().click();
  await slotModal.waitFor();
  await slotModal.locator('.option-row', { hasText: 'Main Hand · 1' }).click();
  await compare.waitFor();
  assert.equal(await slotModal.count(), 0, 'the slot modal closed');
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/armoury-compare-desktop.png` });
  await page.locator('.equip-compare-equip').click();
  await compare.waitFor({ state: 'detached' });
  assert.equal((await sets()).rightHand[0], 'ashStaff', 'compare Equip changed run.loadout');

  // Empty destination: the confirm modal with the item's card; Back changes nothing, Equip changes run.loadout.
  await mount(page, 'hybrid');
  await open('Round Shield');
  await equipBtn().click();
  await slotModal.waitFor();
  await slotModal.locator('.option-row', { hasText: 'Off Hand · 1' }).click();
  await confirm.waitFor();
  assert.match(await confirm.locator('[id^="modal-title"]').first().innerText(), /^Equip Round Shield to Off Hand · 1\?$/);
  assert.ok(await confirm.locator('.equipment-poker-card').count(), 'the confirm modal shows the item card');
  assert.equal(await compare.count(), 0, 'an empty destination confirms, it does not compare');
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/armoury-confirm-desktop.png` });
  await confirm.locator('button', { hasText: 'Back' }).click();
  await confirm.waitFor({ state: 'detached' });
  assert.equal((await sets()).leftHand[0], null, 'Back left the Off Hand empty');
  await equipBtn().click();
  await slotModal.waitFor();
  await slotModal.locator('.option-row', { hasText: 'Off Hand · 1' }).click();
  await confirm.waitFor();
  await confirm.locator('.equip-confirm-equip').click();
  await confirm.waitFor({ state: 'detached' });
  assert.equal((await sets()).leftHand[0], 'roundShield', 'Equip from the confirm modal changed run.loadout');

  // In combat the equip is still priced by the host: its refusal is the notice and nothing changes.
  await mount(page, 'hybrid', true, true);
  await open('Round Shield');
  await equipBtn().click();
  await slotModal.waitFor();
  await slotModal.locator('.option-row', { hasText: 'Off Hand · 1' }).click();
  await confirm.waitFor();
  await confirm.locator('.equip-confirm-equip').click();
  await confirm.waitFor({ state: 'detached' });
  assert.match(await page.locator('.as-toast').innerText(), /Not enough Poise/);
  assert.equal((await sets()).leftHand[0], null, 'a refused combat equip changed nothing');

  // Inspect from the Equipment view is a modal, never an aside.
  await mount(page, 'rack');
  await page.locator('.armoury-position-card.is-occupied .armament-row-select').first().click();
  await page.locator('.card-inspection-modal').waitFor();
  assert.equal(await page.locator('.armament-list-inspection').count(), 0, 'no inline Inspect aside');
  await page.keyboard.press('Escape');

  // Phone width: the slot modal fits the screen.
  const phone = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await mount(phone, 'hybrid');
  await phone.locator('.armoury .disc-face', { hasText: 'Ash Staff' }).first().click();
  await phone.locator('.armoury-item-detail .ep-equip[data-act="equip"]:visible').first().click();
  await phone.locator('.equip-slot-choice').waitFor();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at 360');
  if (SHOT_DIR) await phone.screenshot({ path: `${SHOT_DIR}/armoury-slot-phone.png` });
  assert.deepEqual(errors, [], 'no page errors');
  console.log('Inventory Inspect and Equip are modal flows.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server?.close?.();
}
process.exit(process.exitCode || 0);
