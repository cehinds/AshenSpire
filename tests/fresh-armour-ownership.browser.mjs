// Source-tree Chromium regression: fresh armour inventory and a real purchase.
// SHOT_DIR saves fresh/purchased desktop and phone screenshots.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const shotDir = process.env.SHOT_DIR;
if (shotDir) mkdirSync(shotDir, { recursive: true });

async function fixture(page, classId, alternate = false) {
  return page.evaluate(async ({ classId, alternate }) => {
    const { contentBundle } = await import('/src/content/index.js');
    const { createRegistries } = await import('/src/model/registries.js');
    const { createRunState } = await import('/src/model/state.js');
    const { createRng } = await import('/src/engine/rng.js');
    const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('/src/model/gameProfile.js');
    const { startingArmourViews } = await import('/src/model/startingKits.js');
    const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
    const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    const startingArmourId = startingArmourViews(registries, classId, {})[alternate ? 1 : 0].id;
    const run = createRunState({ seed: 31, classId, registries, startingArmourId,
      profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } } });
    // A veteran profile must not add any of its wardrobe to a new run.
    const meta = { settings: { holdConfirm: 'off', equipView: 'rack' },
      unlocked: registries.equipment.armour.map(piece => piece.unlock).filter(Boolean),
      found: registries.equipment.armour.map(piece => piece.id) };
    window.__freshArmour = { registries, run, meta, rng: createRng(31) };
    return startingArmourId;
  }, { classId, alternate });
}

async function openPicker(page) {
  await page.evaluate(async () => {
    const { mountEquipment } = await import('/src/ui/screens/equipment.js');
    window.__freshArmourScreen?.close();
    document.querySelectorAll('.modal-veil').forEach(node => node.remove());
    const { registries, run, meta } = window.__freshArmour;
    window.__freshArmourScreen = mountEquipment(document.body, {
      registries, run, meta, inCombat: false, onClose() {}, onChange(loadout) { run.loadout = loadout; },
    });
  });
  await page.locator('[data-slot-position="armor:0"] .armament-replace').click();
  await page.locator('.equip-item-choice .equip-picker').waitFor();
}

const armourIds = page => page.locator('.equip-picker-row[data-row-key^="armour:"]').evaluateAll(rows => rows.map(row => row.dataset.itemId));
async function capture(page, name) {
  if (!shotDir) return;
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.equip-picker-thumb').evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode().catch(() => {})));
  });
  await page.screenshot({ path: resolve(shotDir, name) });
}

try {
  for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (process.argv.includes('--plant-free-armour')) {
      await page.route('**/src/model/loadout/ownership.js', async route => {
        const response = await route.fetch();
        const source = await response.text();
        const gate = "if (piece.kind === 'armor' && !profileWardrobe) {";
        assert(source.includes(gate), 'the planted regression must reach the real armour gate');
        await route.fulfill({ response, body: source.replace(gate,
          "if (piece.kind === 'armor' && !profileWardrobe && piece.unlock !== '' && piece.unlock != null) {") });
      });
    }
    await page.goto(`${server.url}index.html?shot=map&shotSeed=31`, { waitUntil: 'load', timeout: 90000 });
    await page.locator('.modal-veil').first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
    for (const classId of ['reaver', 'starseer', 'herald', 'rogue']) {
      for (const alternate of [false, true]) {
        const starter = await fixture(page, classId, alternate);
        await openPicker(page);
        assert.deepEqual(await armourIds(page), [starter], `${viewport.name}/${classId}/${starter}: only the chosen starting armour`);
        await page.locator('.equip-picker-filter').click();
        assert.deepEqual(await armourIds(page), [starter], 'showing items that do not fit cannot reveal unowned armour');
        await page.locator('.equip-picker-filter').click();
        if (classId === 'reaver' && !alternate) await capture(page, `fresh-armour-${viewport.name}.png`);
      }
    }

    await fixture(page, 'reaver');
    const bought = await page.evaluate(async () => {
      const { gameProfileShopStock, purchaseGameProfileShopOffer } = await import('/src/model/gameProfileRewards.js');
      const { registries, run, rng } = window.__freshArmour;
      run.cinders = 100000;
      const stock = gameProfileShopStock(registries, run, rng, { shopId: 'market' });
      const index = stock.options.findIndex(option => option.kind === 'armor');
      // Exercise the reported shared-set item through the real transaction.
      stock.options[index] = { kind: 'armor', id: 'nightweave', price: 100 };
      const receipt = purchaseGameProfileShopOffer(registries, run, 'market', index, rng);
      const piece = registries.equipment.armour.find(row => row.classId === run.class && row.id === receipt.id);
      Object.assign(run.attributes, piece.requirements.attributes);
      return receipt.id;
    });
    await openPicker(page);
    assert.deepEqual(await armourIds(page), ['default', bought], 'a purchase adds only that armour');
    await capture(page, `purchased-armour-${viewport.name}.png`);
    await page.locator(`.equip-picker-row[data-item-id="${bought}"] .equip-picker-act`).click();
    await page.locator('.equip-compare-equip').click();
    assert.equal(await page.evaluate(() => window.__freshArmour.run.loadout.sets.armor[0]), bought, 'purchased armour equips');
    await openPicker(page);
    await page.locator('.equip-picker-row[data-item-id="default"] .equip-picker-act').click();
    await page.locator('.equip-compare-equip').click();
    assert.equal(await page.evaluate(() => window.__freshArmour.run.loadout.sets.armor[0]), 'default', 'starting armour remains available');
    assert.deepEqual(errors, [], 'no browser errors');
    console.log(`PASS ${viewport.name}: all four classes, both starters, purchase, equip and return to starter`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((done, reject) => server.server.close(error => error ? reject(error) : done()));
}
