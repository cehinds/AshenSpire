// SPEC §14.3, §14.6 step 5a — the market's smithing stones, armour, inn rest,
// and the sigil inventory.
//
// docs/FINISH.md §14 "Market additions" is the acceptance line. This file holds
// the clauses PR 5a builds (stones, armour and inn rest bought and kept across
// a reload; inn rest through the location visit and refused under a
// `restDenied` relic; a sigil bought goes to `run.sigils` and survives a
// reload). The consumables, companions and the quest event are PR 5b's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { sigils as shippedSigils } from '../src/content/sigils.js';
import { NOTE } from '../src/content/balance.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigRows, configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRng } from '../src/engine/rng.js';
import { buildShopStock } from '../src/engine/encounters.js';
import { buildMarketStock, commitInnRest } from '../src/engine/shopKinds.js';
import { createLocationVisit, arriveAt, previewRest, leaveLocation } from '../src/engine/locations.js';
import { createRunState, RUN_SCHEMA_VERSION, migrateRunSchema, validateRunShape } from '../src/model/state.js';
import { validateContent } from '../src/model/validate.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { ownership, equipPiece } from '../src/model/loadout.js';
import { inventoryRows } from '../src/model/inventoryPresentation.js';
import { innInTown } from '../src/model/locations.js';
import { MARKET_SHELVES, shopStockProblems } from '../src/model/shopKinds.js';
import { MARKET_ADDITIONS, applyShopPriceMult } from '../src/model/marketStock.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountShop } from '../src/ui/screens/shop.js';
import {
  smithStonePurchasePlan, commitSmithStonePurchase,
  armourPurchasePlan, commitArmourPurchase,
  sigilPurchasePlan, commitSigilPurchase,
  innRestPlan,
} from '../src/model/marketAdditions.js';
import { shopCategories } from '../src/ui/models/ShopWorkspaceModel.js';
import { t } from '../src/ui/strings.js';

const REG = createRegistries(contentBundle);
const PREFIX = 'gameConfig.shops.';
const ADDITIONS_5A = ['armour', 'smithStones', 'sigils', 'innRest'];
const registriesWith = (settings) => createRegistries(configuredContentBundle(contentBundle, settings));
// Every 5a addition forced out on the visit, through the Settings rows.
const ALL_OUT = Object.fromEntries(ADDITIONS_5A.map((id) => [`${PREFIX}market.${id}.chance`, 100]));
const OUT = registriesWith(ALL_OUT);

function marketRun(registries = OUT, { seed = 21, cinders = 5000, innHere = false, meta = {} } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries });
  run.cinders = cinders;
  const rng = createRng(seed);
  run.shopStock = buildMarketStock(registries, rng, run, { meta, innInTown: innHere });
  return { run, rng };
}

function reload(run, rng, registries = REG) {
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(run, rng);
  const back = createSaveManager(storage).loadRun(registries);
  assert.ok(back, 'the save loads');
  return back;
}

// ---------------------------------------------------------------------------
// The data: offerings, Settings rows, notes, strings
// ---------------------------------------------------------------------------

test('the market authors armour, smithStones, sigils and innRest as offerings, each number with a [NOTE] and a Settings row', () => {
  const market = shippedShops.market.offerings;
  const ids = market.map((row) => row.id);
  for (const id of ADDITIONS_5A) assert.ok(ids.includes(id), `market offers ${id}`);
  for (const id of ADDITIONS_5A) assert.ok(MARKET_ADDITIONS.includes(id), `${id} is a market addition`);
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  for (const id of ADDITIONS_5A) {
    const row = market.find((offering) => offering.id === id);
    for (const key of ['enabled', 'chance', 'weight']) assert.ok(rows.has(`${PREFIX}market.${id}.${key}`), `${id}.${key} has its row`);
    // A chance below 100 on a new offering, so the existing shelves stay the
    // visit's certainties and the additions are the variety.
    assert.ok(row.chance < 100, `${id} ships at a chance below 100`);
    // The guarantee still fills from the existing shelves first.
    assert.ok(row.weight < 50, `${id} weighs less than remove (50)`);
  }
  // The prices and stock counts are data with rows, never literals in code.
  for (const key of ['smithStones.price', 'smithStones.perVisit', 'armour.stock', 'armour.cost.min', 'armour.cost.max', 'sigils.stock', 'sigils.pricePct', 'innRest.price']) {
    const row = rows.get(`${PREFIX}market.${key}`);
    assert.ok(row, `${key} has a Settings row`);
    assert.ok(row.note && row.note.length > 20, `${key} carries its sentence`);
  }
  // Each new offering is named in uiStrings.csv.
  for (const id of ADDITIONS_5A) {
    const label = t(`settings.shops.offering.${id}`);
    assert.ok(label && !label.startsWith('settings.'), `${id} has a label`);
  }
  assert.deepEqual(validateContent(contentBundle).errors.filter((e) => e.path.startsWith('shops') || e.path.startsWith('sigils')), []);
});

test('an armour cost range whose min is above its max is refused by name', () => {
  const table = structuredClone(shippedShops);
  // structuredClone drops the Symbol notes; the numbers are what is checked here.
  const armour = table.market.offerings.find((row) => row.id === 'armour');
  armour.cost = { min: 500, max: 100 };
  const errors = validateContent({ ...contentBundle, shops: table }).errors.filter((e) => e.path.startsWith('shops.market.armour'));
  assert.ok(errors.some((e) => /min/.test(e.msg) && /max/.test(e.msg)), JSON.stringify(errors));
});

test('with shipped defaults the existing shelves roll byte-identically and the shop stream moves exactly as before', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const run = createRunState({ seed, classId: 'reaver', registries: REG });
    const plainRng = createRng(seed);
    const plain = buildShopStock(REG, plainRng, run);
    const rng = createRng(seed);
    const stock = buildMarketStock(REG, rng, run, { meta: {}, innInTown: seed % 2 === 0 });
    for (const shelf of MARKET_SHELVES) assert.equal(JSON.stringify(stock[shelf]), JSON.stringify(plain[shelf]), `${shelf} seed ${seed}`);
    assert.equal(stock.removeCost, plain.removeCost);
    const { shopOffers: _a, ...before } = plainRng.getCounters();
    const { shopOffers: _b, ...after } = rng.getCounters();
    assert.deepEqual(after, before, `seed ${seed}: no existing stream moves`);
    // Every existing offering still comes up on every visit.
    for (const id of ['cards', 'relics', 'flasks', 'armaments', 'weaponArts', 'remove']) assert.ok(stock.offerings.includes(id), `${id} seed ${seed}`);
  }
});

test('an addition that did not come up has no stock and no rail item; one that did has both', () => {
  const off = registriesWith(Object.fromEntries(ADDITIONS_5A.map((id) => [`${PREFIX}market.${id}.enabled`, false])));
  const { run } = marketRun(off, { innHere: true });
  for (const id of ADDITIONS_5A) {
    assert.ok(!run.shopStock.offerings.includes(id), `${id} disabled: not offered, not even at an inn town`);
    assert.equal(run.shopStock[id], undefined, `${id}: no stock key`);
  }
  const rail = shopCategories({ offered: new Set(run.shopStock.offerings), services: true });
  for (const id of ADDITIONS_5A) assert.ok(!rail.includes(id));
  const out = marketRun(OUT).run;
  const outRail = shopCategories({ offered: new Set(out.shopStock.offerings), services: true });
  for (const id of ADDITIONS_5A) {
    assert.ok(out.shopStock.offerings.includes(id), `${id} forced out`);
    assert.ok(outRail.includes(id), `${id} has a rail item`);
  }
  // A stock saved before shop kinds (no offerings list) shows no addition rail.
  for (const id of ADDITIONS_5A) assert.ok(!shopCategories({ services: true }).includes(id));
  assert.deepEqual(validateRunShape(out), []);
});

test('the addition stock rolls on shopOffers only, after the offering roll', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries: OUT });
  const rng = createRng(4);
  buildMarketStock(OUT, rng, run, { meta: {} });
  const plainRng = createRng(4);
  buildShopStock(OUT, plainRng, run);
  const { shopOffers, ...rest } = rng.getCounters();
  const { shopOffers: none, ...plainRest } = plainRng.getCounters();
  assert.equal(none, 0);
  assert.deepEqual(rest, plainRest, 'only shopOffers moved');
  assert.ok(shopOffers > 0, 'the armour and sigil shelves drew on shopOffers');
});

// ---------------------------------------------------------------------------
// FINISH: stones, armour and inn rest can be bought and persist across a reload
// ---------------------------------------------------------------------------

test('FINISH: Smithing Stones are bought per stone from a per-visit stock, and both survive a reload', () => {
  const { run, rng } = marketRun();
  const { price, left } = run.shopStock.smithStones;
  assert.equal(price, OUT.shops.market.offerings.find((row) => row.id === 'smithStones').price);
  assert.equal(left, OUT.shops.market.offerings.find((row) => row.id === 'smithStones').perVisit);
  const before = { stones: run.smithingStones, cinders: run.cinders };
  const quote = smithStonePurchasePlan(OUT, run, 1);
  assert.equal(quote.ok, true, quote.reason);
  const receipt = commitSmithStonePurchase(OUT, run, quote);
  assert.equal(receipt.count, 1);
  assert.equal(run.smithingStones, before.stones + 1);
  assert.equal(run.cinders, before.cinders - price);
  assert.equal(run.shopStock.smithStones.left, left - 1);
  const back = reload(run, rng);
  assert.equal(back.smithingStones, before.stones + 1);
  assert.equal(back.shopStock.smithStones.left, left - 1, 'the stock sold stays sold');
  // The whole stock sells out, then refuses by name.
  const many = smithStonePurchasePlan(OUT, back, left);
  assert.equal(many.ok, false);
  assert.match(many.reason, /stone/i);
  commitSmithStonePurchase(OUT, back, smithStonePurchasePlan(OUT, back, left - 1));
  assert.equal(back.shopStock.smithStones.left, 0);
  assert.equal(smithStonePurchasePlan(OUT, back, 1).ok, false);
});

test('a stone purchase refuses too few cinders and a stale quote, and changes nothing', () => {
  const { run } = marketRun(OUT, { cinders: 1 });
  const quote = smithStonePurchasePlan(OUT, run, 1);
  assert.equal(quote.ok, false);
  assert.match(quote.reason, /cinders/i);
  assert.throws(() => commitSmithStonePurchase(OUT, run, quote));
  const rich = marketRun().run;
  const stale = smithStonePurchasePlan(OUT, rich, 1);
  commitSmithStonePurchase(OUT, rich, smithStonePurchasePlan(OUT, rich, 1));
  const snapshot = JSON.stringify(rich);
  assert.throws(() => commitSmithStonePurchase(OUT, rich, stale), /changed/i);
  assert.equal(JSON.stringify(rich), snapshot);
});

test('FINISH: armour is sold from the worn slots, becomes the run\'s own, and survives a reload', () => {
  const meta = { unlocked: [] };
  const { run, rng } = marketRun(OUT, { meta });
  const shelf = run.shopStock.armour;
  assert.ok(Array.isArray(shelf) && shelf.length > 0, 'armour for sale');
  const mine = ownership(OUT, { meta, loadout: run.loadout });
  for (const item of shelf) {
    const piece = OUT.equipment.armour.find((row) => row.classId === run.class && row.id === item.id);
    assert.ok(piece, `${item.id} is armour of the run's class`);
    assert.equal(mine.has(piece), false, `${item.id} is not already owned`);
    const range = OUT.shops.market.offerings.find((row) => row.id === 'armour').cost;
    assert.ok(item.cost >= range.min && item.cost <= range.max, `${item.id} priced in range`);
  }
  const item = shelf[0];
  const piece = OUT.equipment.armour.find((row) => row.classId === run.class && row.id === item.id);
  const quote = armourPurchasePlan(OUT, run, item, { meta });
  assert.equal(quote.ok, true, quote.reason);
  const cinders = run.cinders;
  commitArmourPurchase(OUT, run, quote, { meta });
  assert.equal(run.cinders, cinders - item.cost);
  assert.ok(!run.shopStock.armour.includes(item), 'the piece left the shelf');
  assert.ok(ownership(OUT, { meta, loadout: run.loadout }).has(piece), 'owned by the run now');
  assert.ok(inventoryRows(OUT, run, meta).some((row) => row.category === 'Armour' && row.id === item.id), 'listed in the inventory');
  const back = reload(run, rng, OUT);
  const owned = ownership(OUT, { meta, loadout: back.loadout });
  assert.ok(owned.has(piece), 'still owned after a reload');
  assert.equal(back.shopStock.armour.some((row) => row.id === item.id), false, 'still sold after a reload');
  // And it can be worn.
  assert.equal(equipPiece(OUT, back.loadout, 'armor', 0, item.id, owned, { inCombat: false, classId: back.class }), true);
  assert.equal(back.loadout.sets.armor[0], item.id);
  // Another class's run does not own it.
  const other = ownership(OUT, { meta, loadout: { ...back.loadout, creationArmourGrant: null } });
  const starseerPiece = OUT.equipment.armour.find((row) => row.classId === 'starseer' && row.id === item.id);
  if (starseerPiece) assert.equal(other.has(starseerPiece), false);
});

test('an armour purchase refuses a piece already owned and a stale quote', () => {
  const meta = { unlocked: [] };
  const { run } = marketRun(OUT, { meta });
  const item = run.shopStock.armour[0];
  const piece = OUT.equipment.armour.find((row) => row.classId === run.class && row.id === item.id);
  const unlockedMeta = { unlocked: [piece.unlock] };
  const owned = armourPurchasePlan(OUT, run, item, { meta: unlockedMeta });
  assert.equal(owned.ok, false);
  assert.match(owned.reason, /already/i);
  const quote = armourPurchasePlan(OUT, run, item, { meta });
  run.shopStock.tradeRevision = (run.shopStock.tradeRevision || 0) + 1;
  assert.throws(() => commitArmourPurchase(OUT, run, quote, { meta }), /changed/i);
});

test('FINISH: inn rest runs the inn\'s own visit (arrive, rest, leave), is bought once per visit, and survives a reload', () => {
  const { run, rng } = marketRun(OUT, { innHere: true });
  assert.ok(run.shopStock.offerings.includes('innRest'));
  run.hp = 5;
  run.flaskCharges.hpCurrent = 0;
  // What the inn's own bed would do, on a copy.
  const expected = (() => {
    const copy = structuredClone(run);
    const visit = createLocationVisit({ run: copy, registries: OUT, rng: createRng(rng.seed, rng.getCounters()) }, 'inn');
    arriveAt(visit);
    const rest = previewRest(visit);
    leaveLocation(visit);
    return { hp: rest.hp, flasks: copy.flaskCharges.hpCurrent };
  })();
  const cinders = run.cinders;
  const price = run.shopStock.innRest.price;
  const quote = innRestPlan(OUT, run);
  assert.equal(quote.ok, true, quote.reason);
  const receipt = commitInnRest({ run, registries: OUT, rng }, quote);
  assert.equal(run.hp, expected.hp, 'restored exactly as the inn restores');
  assert.equal(run.hp, run.maxHp, 'the inn is a full rest');
  assert.equal(run.flaskCharges.hpCurrent, expected.flasks, 'the inn\'s arrival refilled the flasks');
  assert.ok(receipt.heal > 0);
  assert.equal(run.cinders, cinders - price);
  assert.equal(run.shopStock.innRest.bought, true);
  // Once per visit.
  const again = innRestPlan(OUT, run);
  assert.equal(again.ok, false);
  assert.match(again.reason, /once|already/i);
  const back = reload(run, rng, OUT);
  assert.equal(back.shopStock.innRest.bought, true, 'bought stays bought after a reload');
  assert.equal(innRestPlan(OUT, back).ok, false);
});

test('inn rest is always offered where the town keeps an inn, even at chance 0, and never when disabled', () => {
  assert.equal(innInTown(REG, 'crownfall'), true);
  assert.equal(innInTown(REG, 'no-such-town'), false);
  const zero = registriesWith({ [`${PREFIX}market.innRest.chance`]: 0 });
  const here = marketRun(zero, { innHere: true }).run;
  assert.ok(here.shopStock.offerings.includes('innRest'));
  const away = marketRun(zero, { innHere: false }).run;
  assert.ok(!away.shopStock.offerings.includes('innRest'));
  const off = registriesWith({ [`${PREFIX}market.innRest.enabled`]: false });
  assert.ok(!marketRun(off, { innHere: true }).run.shopStock.offerings.includes('innRest'));
});

test('FINISH: inn rest is refused by name under a restDenied relic, and nothing is spent', () => {
  const relic = { ...structuredClone(contentBundle.relics[0]), id: 'probeInsomnia', name: 'Probe of Sleeplessness', rarity: 'common', passives: { restDenied: true } };
  delete relic.triggers;
  const registries = createRegistries({ ...configuredContentBundle(contentBundle, ALL_OUT), relics: [...contentBundle.relics, relic] });
  const { run, rng } = marketRun(registries, { innHere: true });
  run.relics.push('probeInsomnia');
  run.hp = 5;
  const before = JSON.stringify(run);
  const quote = innRestPlan(registries, run);
  assert.equal(quote.ok, false);
  assert.match(quote.reason, /Probe of Sleeplessness/);
  assert.throws(() => commitInnRest({ run, registries, rng }, quote), /Probe of Sleeplessness/);
  assert.equal(JSON.stringify(run), before, 'nothing spent, nothing healed');
});

// ---------------------------------------------------------------------------
// FINISH: a sigil bought goes to run.sigils and survives a reload
// ---------------------------------------------------------------------------

test('sigils are content: each non-legendary with a rarity, a cost and relic-DSL triggers, refused by name when malformed', () => {
  assert.ok(shippedSigils.length >= 3);
  for (const sigil of shippedSigils) {
    assert.ok(REG.sigils.has(sigil.id), `${sigil.id} registered`);
    assert.notEqual(sigil.rarity, 'legendary', 'legendary sigils arrive with SPEC §15.4');
    assert.ok(Number.isInteger(sigil.cost) && sigil.cost > 0);
    assert.ok(Array.isArray(sigil.triggers) && sigil.triggers.length);
  }
  const bad = [{ ...shippedSigils[0], id: 'probeBadSigil', rarity: 'mythic', cost: -1, triggers: [{ on: 'notAnEvent', do: [] }] }];
  const errors = validateContent({ ...contentBundle, sigils: [...shippedSigils, ...bad] }).errors.filter((e) => e.path.startsWith('sigils.probeBadSigil'));
  assert.ok(errors.some((e) => /rarity/.test(e.path) || /rarity/.test(e.msg)), 'bad rarity named');
  assert.ok(errors.some((e) => /cost/.test(e.path)), 'bad cost named');
  assert.ok(errors.some((e) => /triggers/.test(e.path)), 'bad trigger named');
});

test('FINISH: a sigil bought goes to run.sigils and survives a reload', () => {
  const { run, rng } = marketRun();
  const shelf = run.shopStock.sigils;
  assert.ok(shelf.length > 0, 'sigils for sale');
  const pct = OUT.shops.market.offerings.find((row) => row.id === 'sigils').pricePct;
  for (const item of shelf) {
    const def = OUT.sigils.get(item.id);
    assert.notEqual(def.rarity, 'legendary');
    assert.equal(item.cost, Math.max(1, Math.round(def.cost * pct / 100)));
  }
  assert.deepEqual(run.sigils, []);
  assert.deepEqual(run.sigilSlots, {});
  const item = shelf[0];
  const cinders = run.cinders;
  commitSigilPurchase(OUT, run, sigilPurchasePlan(OUT, run, item));
  assert.deepEqual(run.sigils, [item.id]);
  assert.equal(run.cinders, cinders - item.cost);
  const back = reload(run, rng, OUT);
  assert.deepEqual(back.sigils, [item.id], 'the sigil survives a reload');
  assert.deepEqual(back.sigilSlots, {});
  assert.equal(back.shopStock.sigils.some((row) => row.id === item.id), false);
  // The shelf never offers a sigil the run already owns.
  for (let seed = 1; seed <= 20; seed++) {
    const next = createRunState({ seed, classId: 'reaver', registries: OUT });
    next.sigils = [item.id];
    const stock = buildMarketStock(OUT, createRng(seed), next, { meta: {} });
    assert.ok(!(stock.sigils || []).some((row) => row.id === item.id), `seed ${seed}`);
  }
});

// ---------------------------------------------------------------------------
// The schema bump
// ---------------------------------------------------------------------------

test('sigils and sigilSlots ride schema 15: the bump, the corpus entry, and the migration default', () => {
  assert.equal(RUN_SCHEMA_VERSION, 15);
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const v15 = JSON.parse(corpus.versions['15'].bytes);
  assert.equal(v15.schemaVersion, 15);
  assert.deepEqual(v15.sigils, []);
  assert.deepEqual(v15.sigilSlots, {});
  // A schema-14 save comes forward with an empty inventory.
  const v14 = JSON.parse(corpus.versions['14'].bytes);
  assert.equal(v14.schemaVersion, 14);
  assert.equal('sigils' in v14, false);
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(v14));
  const run = createSaveManager(storage).loadRun(REG);
  assert.ok(run);
  assert.equal(run.schemaVersion, 15);
  assert.deepEqual(run.sigils, []);
  assert.deepEqual(run.sigilSlots, {});
  // A current save must carry both.
  const fresh = createRunState({ seed: 3, classId: 'reaver', registries: REG });
  assert.deepEqual(validateRunShape(fresh), []);
  const missing = structuredClone(fresh);
  delete missing.sigils;
  assert.ok(validateRunShape(missing).some((p) => /sigils/.test(p)));
});

test('a malformed sigil inventory, slot record or bought-armour list is refused by name', () => {
  const fresh = createRunState({ seed: 3, classId: 'reaver', registries: REG });
  const cases = [
    [{ sigils: 'emberSigil' }, /sigils/],
    [{ sigils: [''] }, /sigils\[0\]/],
    [{ sigilSlots: [] }, /sigilSlots/],
    [{ sigilSlots: { 'armament/straightSword': 'x' } }, /sigilSlots/],
    [{ sigilSlots: { 'armament/straightSword': [3] } }, /sigilSlots/],
  ];
  for (const [patch, pattern] of cases) {
    const run = { ...structuredClone(fresh), ...patch };
    assert.ok(validateRunShape(run).some((p) => pattern.test(p)), `${JSON.stringify(patch)} refused`);
  }
  const armour = structuredClone(fresh);
  armour.loadout.boughtArmour = [{ classId: 'reaver' }];
  assert.ok(validateRunShape(armour).some((p) => /boughtArmour/.test(p)));
  // Slots holding a sigil or an empty place are fine.
  const ok = { ...structuredClone(fresh), sigilSlots: { 'armament/straightSword': [null, 'emberSigil'] } };
  assert.deepEqual(validateRunShape(ok), []);
  // A current save round-trips its inventory untouched.
  const back = migrateRunSchema(JSON.parse(JSON.stringify({ ...ok, sigils: ['emberSigil'] })));
  assert.deepEqual(back.sigils, ['emberSigil']);
});

test('a saved sigil id this build does not know archives the save by name', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries: REG });
  run.sigils = ['noSuchSigil'];
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, createRng(3));
  assert.equal(createSaveManager(storage).loadRun(REG), null);
});

test('a saved addition stock is shape-checked by name', () => {
  const { run } = marketRun();
  assert.deepEqual(shopStockProblems(run.shopStock), []);
  const bad = [
    [{ smithStones: { price: 90, left: -1 } }, /smithStones/],
    [{ armour: [{ id: 'vigil' }] }, /armour/],
    [{ sigils: 'x' }, /sigils/],
    [{ innRest: { price: 100, bought: 'no' } }, /innRest/],
  ];
  for (const [patch, pattern] of bad) {
    const problems = shopStockProblems({ ...structuredClone(run.shopStock), ...patch });
    assert.ok(problems.some((p) => pattern.test(p)), `${JSON.stringify(patch)}: ${problems.join(' | ')}`);
  }
});

test('the offering notes are sentences, not placeholders', () => {
  for (const id of ADDITIONS_5A) {
    const row = shippedShops.market.offerings.find((offering) => offering.id === id);
    for (const [key, sentence] of Object.entries(row[NOTE])) assert.ok(typeof sentence === 'string' && sentence.length > 20, `${id}.${key}`);
  }
});

// ---------------------------------------------------------------------------
// Codex on #1374: the screen mounts with every new shelf, and prices scale
// ---------------------------------------------------------------------------

test('DOM: the merchant mounts with every new shelf out and buys one of each through the footer and its review (Codex, on #1374)', () => {
  // The existing shelves are off here (Settings), so the screen draws only the
  // additions and Remove; the shelves' own renderers have their own tests.
  const ONLY = registriesWith({ ...ALL_OUT, ...Object.fromEntries(['cards', 'armaments', 'weaponArts', 'relics', 'flasks'].map((id) => [`${PREFIX}market.${id}.enabled`, false])) });
  withKitDom((dom) => {
    const { run, rng } = marketRun(ONLY, { innHere: true });
    run.hp = 5;
    const app = dom.document.createElement('main');
    dom.document.body.appendChild(app);
    let changed = 0;
    mountShop(app, {
      registries: ONLY, run, meta: { settings: { shopSell: false } },
      onLeave() {}, onChanged() { changed += 1; },
      restAtInn: (quote) => commitInnRest({ run, registries: ONLY, rng }, quote),
    });
    for (const key of ADDITIONS_5A) assert.ok(app.querySelector(`#shop-cat-${key}`), `${key} has its rail item`);
    const before = { stones: run.smithingStones, sigils: run.sigils.length, armour: (run.loadout.boughtArmour || []).length, cinders: run.cinders };
    for (const key of ADDITIONS_5A) {
      app.querySelector(`#shop-cat-${key}`).click();
      const primary = app.querySelector('#shop-primary');
      assert.ok(primary && !primary.disabled, `${key}: the footer offers Buy`);
      primary.click();
      // The shopBuy beat's review, when the table asks for one.
      const confirm = dom.document.body.querySelector('.modal-confirm, [data-confirm="yes"], .as-modal .as-btn-primary');
      if (confirm && !confirm.disabled) confirm.click();
    }
    assert.equal(run.smithingStones, before.stones + 1, 'a stone bought');
    assert.equal(run.sigils.length, before.sigils + 1, 'a sigil bought');
    assert.equal(run.loadout.boughtArmour.length, before.armour + 1, 'an armour set bought');
    assert.equal(run.shopStock.innRest.bought, true, 'the rest bought');
    assert.equal(run.hp, run.maxHp);
    assert.ok(run.cinders < before.cinders);
    assert.ok(changed >= 4, 'each purchase persisted');
  });
});

test('the Greedy Merchants and Hoarder price multiplier reaches every addition\'s price (Codex, on #1374)', () => {
  const { run } = marketRun(OUT, { innHere: true });
  const stock = structuredClone(run.shopStock);
  const scaled = structuredClone(stock);
  applyShopPriceMult(scaled, 1.5);
  const up = (n) => Math.ceil(n * 1.5);
  for (const kind of ['cards', 'relics', 'flasks']) scaled[kind].forEach((item, i) => assert.equal(item.cost, up(stock[kind][i].cost), `${kind}[${i}]`));
  assert.equal(scaled.removeCost, up(stock.removeCost));
  scaled.armour.forEach((item, i) => assert.equal(item.cost, up(stock.armour[i].cost), `armour[${i}]`));
  scaled.sigils.forEach((item, i) => assert.equal(item.cost, up(stock.sigils[i].cost), `sigils[${i}]`));
  assert.equal(scaled.smithStones.price, up(stock.smithStones.price));
  assert.equal(scaled.innRest.price, up(stock.innRest.price));
  // A multiplier of 1 changes nothing, and a shelf that did not come up is left absent.
  const same = structuredClone(stock);
  applyShopPriceMult(same, 1);
  assert.deepEqual(same, stock);
  const bare = { cards: [], relics: [], flasks: [], removeCost: 100 };
  applyShopPriceMult(bare, 2);
  assert.deepEqual(bare, { cards: [], relics: [], flasks: [], removeCost: 200 });
  // The scaled stock still passes the saved-shape check.
  assert.deepEqual(shopStockProblems(scaled), []);
});
