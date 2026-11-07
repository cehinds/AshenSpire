// A Core Blacksmith offers only CORE_BLACKSMITH_OFFERINGS (an allow-list: upgrade, card upgrade, rank-up, armaments, weapon arts); every legacy service is
// withheld from the stock, refused by its plan and commit, and (screen side) hidden even for an old saved stock.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { BLACKSMITH_SERVICES, CORE_BLACKSMITH_OFFERINGS, blacksmithWithholds, blacksmithOffers, blacksmithUpgradePlan } from '../src/model/blacksmith.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountBlacksmith } from '../src/ui/screens/blacksmith.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const coreOut = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);

function smithRun(registries) {
  const run = createRunState({ seed: 41, classId: 'reaver', registries, runId: 'bs-core-offers' });
  run.smithingStones = 12;
  run.cinders = 2000;
  run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(41), run);
  return run;
}

test('Core Blacksmith stock offers the five Core offerings and no Smithing Stone shelf', () => {
  const run = smithRun(coreOut);
  assert.deepEqual([...run.shopStock.offerings].sort(), [...CORE_BLACKSMITH_OFFERINGS].sort());
  assert.deepEqual([...CORE_BLACKSMITH_OFFERINGS], ['upgrade', 'upgradeArt', 'rankUp', 'armaments', 'weaponArts']);
  assert.equal(run.shopStock.armaments.length, 6);
  assert.ok(run.shopStock.weaponArts.length >= 1);
  assert.equal(run.shopStock.smithStones, undefined);
});

// What a legacy Blacksmith used to lay out; the code that sold them is gone, an old saved stock may still name them.
const RETIRED_OFFERINGS = ['refineStones', 'sigilSlots', 'sigils', 'extractArt', 'installArt', 'stackCopy', 'smithStones'];

test('Core withholds every retired offering, even when an old saved stock lists it', () => {
  const run = smithRun(coreOut);
  run.shopStock.offerings = [...RETIRED_OFFERINGS, ...CORE_BLACKSMITH_OFFERINGS];
  for (const id of RETIRED_OFFERINGS) { assert.equal(blacksmithWithholds(run, id), true, id); assert.equal(blacksmithOffers(run, id), false, id); }
  assert.equal(blacksmithWithholds(run, 'armaments'), false, 'the tiered rack is a Core offering');
  for (const id of CORE_BLACKSMITH_OFFERINGS) assert.equal(blacksmithOffers(run, id), true, id);
  for (const id of BLACKSMITH_SERVICES) assert.equal(blacksmithWithholds(run, id), false, id);
});

test('Core Blacksmith upgrade has no refined purse', () => {
  const run = smithRun(coreOut);
  assert.equal(blacksmithUpgradePlan(coreOut, run, 'armament/greatsword', { purse: 'refined' }).ok, false);
  assert.equal(blacksmithUpgradePlan(coreOut, run, 'armament/greatsword').ok, true);
});

test('Core Blacksmith screen draws only the Core services, even for an old saved stock, and no raw ids', () => {
  const run = smithRun(coreOut);
  run.sigils = [];
  run.shopStock.offerings = [...RETIRED_OFFERINGS, ...BLACKSMITH_SERVICES, 'armaments', 'weaponArts'];
  run.shopStock.smithStones = { price: 10, left: 3 };
  withKitDom((dom) => {
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    mountBlacksmith(app, { registries: coreOut, run, meta: { settings: {} }, onChanged() {}, onLeave() {} });
    const keys = [...app.querySelectorAll('.shop-switch [data-shop-category]')].map((el) => el.dataset.shopCategory);
    assert.deepEqual(keys.sort(), ['armaments', 'rankUp', 'upgrade', 'upgradeArt', 'weaponArts']);
    assert.equal(app.querySelector('.shop-rail'), null);
    const text = app.textContent;
    assert.doesNotMatch(text, /sigil|stack a copy|\(s\)|default/i);
    assert.doesNotMatch(text, /refined/i, 'Core has no refined stones to show');
    // (the fixture DOM does not parse innerHTML text, so the tier is read from the tile's data attribute)
    const tiers = [...app.querySelectorAll('[data-shop-shelf="armaments"] [data-armament-tier]')].map((el) => Number(el.getAttribute('data-armament-tier')));
    assert.equal(tiers.length, 6, 'the rack shows six pieces, each with its tier');
    assert.ok(tiers.every((tier) => tier >= 0 && tier <= 3));
  });
});
