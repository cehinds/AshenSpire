// Driven in real Chromium against the source tree (the repo's own tools/serve.mjs):
//   PLAYWRIGHT_MODULE=/path/to/playwright node tests/armoury-modal-flows.browser.mjs
// Env: CHROME=<executable>, SHOT_DIR=<dir> to also save screenshots.
// Owner, 2026-11-05: Inspect and Equip on an Inventory item are modals, not
// inline sections. Inspect opens the card inspection modal (no aside in the
// DOM); Equip asks "Choose a slot" only when the item fits more than one open
// position, then compares (occupied) or confirms (empty) before equipping.
// Owner, 2026-11-06: the Armory tab is the equipped-slot rows only. Items arrive through
// a slot's picker (Choose item / Replace -> Equip) or through showArmoury({ equipItemId })
// (a reward's or purchase's Equip: slot choice, then the item equips into that slot).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SHOT_DIR = process.env.SHOT_DIR || '';
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = process.env.BASE_URL || server.url;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const errors = [];

async function mount(page, emptyOffHand = true, combat = false, extra = {}) {
  await page.goto(`${base}index.html?shot=map&shotSeed=ART1`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async ({ emptyOffHand, combat, extra }) => {
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
      destination: extra.destination || '',
      equipItemId: extra.equipItemId || '',
      onEditDeck: extra.deck ? () => { window.__deckOpened = true; } : null,
      // In combat an equip is priced by the host: a refusal string is the notice (here: always refused).
      onEquip: combat ? () => 'Not enough Poise to change gear.' : undefined,
      onChange: (loadout) => { run.loadout = loadout; },
      onEquipmentChanged: (event) => window.__armouryEquipped.push(event),
    });
  }, { emptyOffHand, combat, extra });
  if (extra.deck) return; // the Deck door closes the Armoury onto the editor
  await page.waitForSelector('.armoury .armoury-position-card');
  // The Armory page is the equipped-slot rows only (owner 2026-11-06); items come through a slot's picker.
  await page.waitForSelector('.armoury .armoury-position-card');
}

const slotModal = (page) => page.locator('.equip-slot-choice');
const confirmModal = (page) => page.locator('.equip-confirm-modal');
const compareModal = (page) => page.locator('.equip-compare-modal');
const sets = (page) => page.evaluate(() => structuredClone(window.__armouryRun.loadout.sets));
/** A slot's picker: Choose item / Replace on the row, then the named item's Equip in the picker. */
const pickEquip = async (page, position, name) => {
  await page.locator(`.armoury-position-card[data-slot-position="${position}"] .armament-replace`).click();
  await page.locator('.equip-picker-row', { hasText: name }).locator('.equip-picker-act').click();
};

try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  await mount(page);
  assert.equal(await page.locator('.armament-list-inspection, .armament-destinations, .armament-destination').count(), 0, 'no inline aside or destination section');

  // The Armory tab is the slot rows only: no item collection, no detail pane, and no scrolling at 1365x900.
  assert.equal(await page.locator('.armoury-item-collection, .armoury-item-detail, .armoury-detail-prompt, .armoury .disc-face').count(), 0, 'the item grid and its detail pane are gone');
  assert.equal(await page.evaluate(() => { const b = document.querySelector('.armoury-body'); return b.scrollHeight <= b.clientHeight + 1; }), true, 'the slot rows fit without a scrollbar');
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/armoury-rows-desktop.png` });

  // A slot's picker -> Equip on an occupied slot goes straight to the compare modal (the slot is already chosen).
  await pickEquip(page, 'rightHand:0', 'Ash Staff');
  await compareModal(page).waitFor();
  assert.equal(await slotModal(page).count(), 0, 'a picked slot skips the slot modal');
  assert.equal(await confirmModal(page).count(), 0, 'an occupied destination compares, it does not confirm');
  await page.keyboard.press('Escape');
  await compareModal(page).waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.__armouryEquipped.length), 0, 'Back equips nothing');
  await pickEquip(page, 'rightHand:0', 'Ash Staff');
  await compareModal(page).waitFor();
  await page.locator('.equip-compare-equip').click();
  await compareModal(page).waitFor({ state: 'detached' });
  assert.equal((await sets(page)).rightHand[0], 'ashStaff', 'compare Equip changed run.loadout');

  // An empty slot's picker -> Equip equips at once (the slot is chosen and nothing is replaced): no confirm, no compare.
  await mount(page);
  await pickEquip(page, 'leftHand:0', 'Round Shield');
  await page.waitForFunction(() => window.__armouryRun.loadout.sets.leftHand[0] === 'roundShield');
  assert.equal(await confirmModal(page).count() + await compareModal(page).count(), 0, 'an empty slot equips straight from its picker');

  // REWARD / PURCHASE EQUIP: showArmoury({ equipItemId }) asks for a slot only (the item fits two), then equips THAT item
  // into the chosen slot with no second picker. Before: the plain Armory (rows only). After: the slot choice.
  await mount(page);
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/reward-equip-before-desktop.png` });
  await mount(page, true, false, { equipItemId: 'ashStaff' });
  await slotModal(page).waitFor();
  const rows = await slotModal(page).locator('.option-row').evaluateAll((nodes) => nodes.map((n) => [n.querySelector('.option-row-name').textContent, n.querySelector('.option-row-status').textContent.trim(), n.disabled]));
  assert.deepEqual(rows.map(([label]) => label), ['Main Hand · 1', 'Off Hand · 1']);
  assert.match(rows[0][1], /^Active · Straight Sword$/);
  assert.match(rows[1][1], /^Active · Empty$/);
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/reward-equip-after-desktop.png` });
  await slotModal(page).locator('button', { hasText: 'Back' }).click();
  await slotModal(page).waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.__armouryEquipped.length), 0, 'Back equips nothing');
  assert.equal(await page.locator('.equip-picker-row').count(), 0, 'the slot picker never opened');
  // Choose Main Hand: the compare modal (occupied) then Equip puts the offered item in that slot.
  await mount(page, true, false, { equipItemId: 'ashStaff' });
  await slotModal(page).waitFor();
  await slotModal(page).locator('.option-row', { hasText: 'Main Hand · 1' }).click();
  await compareModal(page).waitFor();
  assert.equal(await slotModal(page).count(), 0, 'the slot modal closed');
  assert.equal(await page.locator('.equip-picker-row').count(), 0, 'no second item picker after the slot choice');
  await page.locator('.equip-compare-equip').click();
  await compareModal(page).waitFor({ state: 'detached' });
  assert.equal((await sets(page)).rightHand[0], 'ashStaff', 'the offered item equipped into the chosen slot');
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/reward-equip-done-desktop.png` });
  // An empty slot: confirm, then the item is in the Off Hand.
  await mount(page, true, false, { equipItemId: 'roundShield' });
  await slotModal(page).waitFor();
  await slotModal(page).locator('.option-row', { hasText: 'Off Hand · 1' }).click();
  await confirmModal(page).waitFor();
  await confirmModal(page).locator('.equip-confirm-equip').click();
  await confirmModal(page).waitFor({ state: 'detached' });
  assert.equal((await sets(page)).leftHand[0], 'roundShield', 'the offered shield equipped into the chosen Off Hand');

  // The Deck door (key D) names the `cards` destination: it opens the Deck tab's editor.
  await mount(page, true, false, { destination: 'cards', deck: true });
  await page.waitForFunction(() => window.__deckOpened === true);
  // Without a deck editor the destination lands on the Armory page with the tab's refusal toast.
  await mount(page, true, false, { destination: 'cards', deck: false });
  await page.locator('.as-toast').waitFor();
  assert.match(await page.locator('.as-toast').innerText(), /Deck editing is unavailable/);

  // In combat the equip is still priced by the host: its refusal is the notice and nothing changes.
  await mount(page, true, true);
  await pickEquip(page, 'leftHand:0', 'Round Shield');
  await page.locator('.as-toast').waitFor();
  assert.match(await page.locator('.as-toast').innerText(), /Not enough Poise/);
  assert.equal((await sets(page)).leftHand[0], null, 'a refused combat equip changed nothing');

  // Inspect from the Equipment view is a modal, never an aside.
  await mount(page);
  await page.locator('.armoury-position-card[data-slot-position="rightHand:0"] .armament-row-select').click();
  await page.locator('.card-inspection-modal').waitFor();
  assert.equal(await page.locator('.armament-list-inspection').count(), 0, 'no inline Inspect aside');
  const inspectText = await page.locator('.card-inspection-modal').innerText();
  assert.ok(/Smithing tier/.test(inspectText), 'the Inspect modal keeps the smithing tier row');
  await page.keyboard.press('Escape');

  // Phone width: the slot modal fits the screen, and the rows stay readable with little scrolling.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await mount(phone);
  assert.equal(await phone.locator('.armoury-item-collection, .armoury-item-detail').count(), 0, 'no item grid on a phone either');
  if (SHOT_DIR) await phone.screenshot({ path: `${SHOT_DIR}/reward-equip-before-phone.png` });
  await mount(phone, true, false, { equipItemId: 'ashStaff' });
  await phone.locator('.equip-slot-choice').waitFor();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at 390');
  if (SHOT_DIR) await phone.screenshot({ path: `${SHOT_DIR}/reward-equip-after-phone.png` });
  await phone.keyboard.press('Escape');
  await phone.locator('.equip-slot-choice').waitFor({ state: 'detached' });
  assert.deepEqual(errors, [], 'no page errors');
  console.log('Armory rows, slot pickers and the reward Equip flow pass.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server?.close?.();
}
process.exit(process.exitCode || 0);
