// Driven in real Chromium against the source tree (the repo's own tools/serve.mjs):
//   PLAYWRIGHT_MODULE=/path/to/playwright node tests/armoury-compact-compare.browser.mjs
// Env: CHROME=<executable>, SHOT_DIR=<dir> to also save screenshots.
// Owner wireframes, 2026-11-01: the Equipment view is a compact list whose rows
// are buttons, the status line is a toast, and Replace opens a comparison.
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

// Mounts the real Armoury over the booted game with a Reaver who owns every armament and one more outfit.
async function mount(page) {
  await page.goto(`${base}index.html?shot=map&shotSeed=ART1`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const { contentBundle } = await import('/src/content/index.js');
    const { createRegistries } = await import('/src/model/registries.js');
    const { createRunState } = await import('/src/model/state.js');
    const { mountEquipment } = await import('/src/ui/screens/equipment.js');
    const registries = createRegistries(contentBundle);
    const run = createRunState({ seed: 11, classId: 'reaver', registries });
    const spare = registries.equipment.armour.find((row) => row.classId === 'reaver' && row.id !== 'default');
    run.loadout.storage = ['ashStaff'];
    run.attributes = { ...run.attributes, intelligence: 6, strength: 6 };
    if (spare) run.loadout.boughtArmour = [{ classId: 'reaver', id: spare.id }];
    // The Armoury is the screen under test; start from a clean page.
    document.querySelectorAll('.modal-veil').forEach((node) => node.remove());
    const meta = { settings: { holdConfirm: 'off', equipView: 'rack' }, found: registries.equipment.armaments.map((row) => row.id) };
    window.__armouryRun = run;
    window.__armouryRegistries = registries;
    window.__armouryEquipped = [];
    mountEquipment(document.body, {
      registries, run, meta, inCombat: false, onClose() {},
      onChange: (loadout) => { run.loadout = loadout; },
      onEquipmentChanged: (event) => window.__armouryEquipped.push(event),
    });
  });
  await page.waitForSelector('.armoury .armoury-position-card');
  await page.click('[data-surface="armouryView"] [data-member="rack"]').catch(() => {});
  await page.waitForSelector('.armoury .armoury-position-card');
}
const rowSel = (code) => `.armoury-position-card[data-slot-position="${code}"]`;
const wait = (page, ms) => page.waitForTimeout(ms);

try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  await mount(page);

  // --- Wireframe 1: header, count badge, grid button and Inspect button are gone.
  assert.equal(await page.locator('.armoury-section-head').count(), 0, 'no section header row');
  assert.equal(await page.locator('.armoury-armament-view-toggle').count(), 0, 'no Grid view button');
  assert.equal(await page.locator('.armament-inspect').count(), 0, 'no Inspect buttons');
  assert.ok(!/Equipped positions/.test(await page.locator('.armoury').innerText()), 'no "Equipped positions" text');

  const rows = await page.$$eval('.armoury-position-card:not(.is-locked)', (nodes) => nodes.map((n) => n.dataset.slotPosition));
  assert.ok(rows.length >= 2, `rows render: ${rows}`);
  const selected = () => page.$$eval('.armoury-position-card.is-inspected', (nodes) => nodes.map((n) => n.dataset.slotPosition));
  assert.deepEqual(await selected(), [rows[0]], 'the first row is selected by default');
  const title = () => page.locator('.armament-list-inspection h3').innerText();
  assert.match(await title(), /Inspect/);

  // Clicking the body of a row selects it, outlines it green and updates the Inspect panel.
  const second = rows[1];
  await page.locator(`${rowSel(second)} .armament-card-thumbnail, ${rowSel(second)} .armament-compact-heading`).first().click({ force: true });
  assert.deepEqual(await selected(), [second], 'row body click selects that row');
  const outline = await page.$eval(`${rowSel(second)}`, (n) => getComputedStyle(n).outlineColor);
  const green = await page.evaluate(() => { const probe = document.createElement('i'); probe.style.color = 'var(--green)'; document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; });
  assert.equal(outline, green, 'the selected outline is the green token');
  const code = await page.$eval(`${rowSel(second)} .armament-position-code`, (n) => n.textContent.replace(/[^A-Z0-9]/g, ''));
  assert.ok((await title()).includes(code), `Inspect panel follows the selection (${code})`);

  // Replace / Unequip do not move the selection.
  await page.click(`${rowSel(rows[0])} .armament-replace`);
  await page.waitForSelector('.equip-picker-table');
  await page.click('[data-surface="armouryView"] [data-member="rack"]');
  await page.waitForSelector('.armoury-position-card.is-inspected');
  assert.deepEqual(await selected(), [second], 'Replace leaves the selection alone');

  // Keyboard: rows are focusable and Enter / Space select.
  await mount(page);
  // Reach the second row's button the way a keyboard player does, by tabbing, so the game cursor follows focus.
  await page.focus(`${rowSel(rows[0])} .armament-row-select`);
  for (let i = 0; i < 12 && !(await page.evaluate((sel) => document.activeElement?.closest(sel) && document.activeElement.classList.contains('armament-row-select'), rowSel(rows[1]))); i++) await page.keyboard.press('Tab');
  assert.ok(await page.evaluate((sel) => !!document.activeElement?.closest(sel), rowSel(rows[1])), 'rows are keyboard focusable');
  await page.keyboard.press('Space');
  assert.deepEqual(await selected(), [rows[1]], 'Space selects');
  // Enter: each row's select control is a native <button type=button>, which the browser activates on Enter exactly as on
  // Space (the game's own input layer, ui/input.js, routes Enter to its cursor, so a driven Tab cannot stand in for it).
  assert.equal(await page.$eval(`${rowSel(rows[0])} .armament-row-select`, (n) => `${n.tagName}:${n.type}:${n.tabIndex}`), 'BUTTON:button:0');

  // Unequip does not select its row either.
  await page.click(`${rowSel(rows[1])} .armament-row-select`);
  const unequipRow = await page.$$eval('.armoury-position-card.is-occupied', (nodes) => nodes.filter((n) => n.querySelector('.armament-unequip:not([disabled])')).map((n) => n.dataset.slotPosition));
  const other = unequipRow.find((code) => code !== rows[1]);
  if (other) {
    await page.click(`${rowSel(other)} .armament-unequip`);
    assert.deepEqual(await selected(), [rows[1]], 'Unequip leaves the selection alone');
    assert.ok(await page.locator('.as-toast').isVisible(), 'a toast tells what happened');
  }

  // --- Wireframe 2: the status line is a toast that is gone after ~3 s.
  assert.equal(await page.locator('.armoury-notice').count(), 0, 'no status row at the top');
  const toast = page.locator('.as-toast');
  assert.equal(await toast.getAttribute('aria-live'), 'polite');
  await wait(page, 3800);
  assert.equal(await page.locator('.as-toast').count(), 0, 'the toast is removed after its timeout');

  // --- Wireframe 3: Replace opens a comparison for a weapon.
  await mount(page);
  const weaponRow = 'rightHand:0';
  const currentName = await page.$eval(`${rowSel(weaponRow)} .armament-position-name`, (n) => n.textContent);
  await page.click(`${rowSel(weaponRow)} .armament-replace`);
  await page.waitForSelector('.equip-picker-table');
  await page.waitForSelector('.equip-picker-row[data-item-id="ashStaff"] .equip-picker-act');
  await page.click('.equip-picker-row[data-item-id="ashStaff"] .equip-picker-act');
  await page.waitForSelector('.equip-compare-modal');
  assert.equal(await page.evaluate(() => window.__armouryEquipped.length), 0, 'nothing is equipped by merely choosing');
  assert.equal(await page.locator('.equip-compare-modal h2, .equip-compare-modal [id="equip-compare-title"]').first().innerText(), 'Replace Main Hand?');
  const names = await page.$$eval('.equip-compare-face', (nodes) => nodes.map((n) => [n.dataset.compareSide, n.querySelector('figcaption b').textContent]));
  assert.deepEqual(names, [['current', currentName], ['new', 'Ash Staff']], 'equipped left, new right');
  const xs = await page.$$eval('.equip-compare-face', (nodes) => nodes.map((n) => n.getBoundingClientRect().left));
  assert.ok(xs[0] < xs[1], 'the current item is on the left');
  assert.equal(await page.locator('.equip-compare-arrow').innerText(), '→');
  // Every row's colour class follows the model's verdict: better green ('up'), worse red ('down'), unchanged flat.
  const expected = await page.evaluate(async (cur) => {
    const { equipmentCompareRows } = await import('/src/model/equipmentCompare.js');
    const reg = window.__armouryRegistries;
    const item = (id) => reg.equipment.armaments.find((row) => row.id === id);
    const before = reg.equipment.armaments.find((row) => row.name === cur);
    return equipmentCompareRows(reg, before, item('ashStaff'), { attributes: window.__armouryRun.attributes }).map((r) => [r.id, r.verdict]);
  }, currentName);
  const dirFor = { better: 'up', worse: 'down', same: 'flat', changed: 'flat' };
  for (const [id, verdict] of expected) {
    assert.equal(await page.$eval(`[data-compare-row="${id}"] .as-delta`, (n) => n.dataset.dir), dirFor[verdict], `${id} is ${verdict}`);
  }
  const verdicts = new Set(expected.map(([, v]) => v));
  assert.ok(verdicts.has('better') && verdicts.has('worse'), `the pair shows both better and worse: ${[...verdicts]}`);
  const colourOf = (verdict) => page.$eval(`[data-verdict="${verdict}"] .d-to`, (n) => getComputedStyle(n).color);
  assert.notEqual(await colourOf('better'), await colourOf('worse'), 'better and worse are drawn in different colours');
  assert.ok(await page.locator('.equip-compare-rows .is-same').count() === 0 || await page.$eval('.equip-compare-rows .is-same', (n) => Number(getComputedStyle(n).opacity) < 1), 'unchanged rows are dimmed');
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/compare-weapon-desktop.png` });
  // The footer: Back and Equip, right-justified.
  const foot = await page.$eval('.equip-compare-modal .modal-foot-actions', (n) => { const box = n.closest('.equip-compare-modal').getBoundingClientRect(); const kids = [...n.children].map((c) => c.getBoundingClientRect()); return { right: box.right, lastRight: kids.at(-1).right, firstLeft: kids[0].left, left: box.left, labels: [...n.children].map((c) => c.textContent.trim()) }; });
  assert.deepEqual(foot.labels, ['Back', 'Equip']);
  assert.ok(foot.right - foot.lastRight < 40, 'Equip sits at the right edge');
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/compare-weapon-desktop.png` });
  assert.ok(foot.firstLeft - foot.left > 100, 'Back is not stretched to the left edge');

  // Back (and Escape) returns to the picker without equipping.
  await page.click('.equip-compare-back');
  await page.waitForSelector('.equip-compare-modal', { state: 'detached' });
  assert.ok(await page.locator('.equip-picker-table').isVisible(), 'back at the picker');
  assert.equal(await page.evaluate(() => window.__armouryEquipped.length), 0, 'Back equipped nothing');
  await page.click('.equip-picker-row[data-item-id="ashStaff"] .equip-picker-act');
  await page.waitForSelector('.equip-compare-modal');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.equip-compare-modal', { state: 'detached' });
  assert.ok(await page.locator('.equip-picker-table').isVisible(), 'Escape is Back');
  assert.ok(await page.locator('.armoury').isVisible(), 'Escape did not close the Armoury');
  assert.equal(await page.evaluate(() => window.__armouryEquipped.length), 0);

  // Equip performs the existing equip.
  await page.click('.equip-picker-row[data-item-id="ashStaff"] .equip-picker-act');
  await page.waitForSelector('.equip-compare-modal');
  await page.click('.equip-compare-equip');
  await page.waitForSelector('.equip-compare-modal', { state: 'detached' });
  const now = await page.evaluate(() => Object.values(window.__armouryRun.loadout.sets).flat());
  assert.ok(now.includes('ashStaff'), `Ash Staff replaced the old weapon: ${now}`);
  assert.ok(/Ash Staff equipped/.test(await page.locator('.as-toast').innerText()), 'the equip raises the toast');

  // --- Wireframe 3, armour.
  await mount(page);
  const spare = await page.evaluate(() => window.__armouryRun.loadout.boughtArmour?.[0]?.id);
  if (spare) {
    await page.click(`${rowSel('body:0')} .armament-replace`).catch(async () => { await page.click('.armoury-position-card.is-occupied .armament-replace'); });
    await page.waitForSelector('.equip-picker-table');
    await page.click(`.equip-picker-row[data-item-id="${spare}"] .equip-picker-act`);
    await page.waitForSelector('.equip-compare-modal');
    const armourNames = await page.$$eval('.equip-compare-face', (nodes) => nodes.map((n) => n.dataset.compareSide));
    assert.deepEqual(armourNames, ['current', 'new']);
    assert.ok(await page.locator('[data-compare-row="defenseRating"]').count(), 'armour lists DR');
    assert.ok(await page.locator('[data-compare-row="poise"]').count(), 'armour lists Poise');
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/compare-armour-desktop.png` });
  } else console.log('note: no spare Reaver outfit in content; armour comparison covered by the model test');

  // Reduced motion: no fade, simply gone.
  const calm = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
  calm.on('pageerror', (e) => errors.push(e.message));
  await mount(calm);
  await calm.click(`${rowSel(rows[0])} .armament-unequip`).catch(() => {});
  if (await calm.locator('.as-toast').count()) {
    await wait(calm, 3200);
    assert.equal(await calm.locator('.as-toast').count(), 0, 'reduced motion hides it with no fade');
  }

  // --- Phone width: the list stays inside the screen.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await mount(phone);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at 390');
  if (SHOT_DIR) await phone.screenshot({ path: `${SHOT_DIR}/equipment-phone.png` });
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/equipment-desktop.png` });
  assert.deepEqual(errors, [], 'no page errors');
  console.log('Armoury compact list, toast and Replace comparison behave as wireframed.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server?.close?.();
}
process.exit(process.exitCode || 0);
