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
import { advancedConfigRows, configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { createRng } from '../src/engine/rng.js';
import { buildShopStock } from '../src/engine/encounters.js';
import { buildMarketStock, commitInnRest, marketVisitStock } from '../src/engine/shopKinds.js';
import { createLocationVisit, arriveAt, previewRest, leaveLocation } from '../src/engine/locations.js';
import { createRunState, RUN_SCHEMA_VERSION, migrateRunSchema, validateRunShape } from '../src/model/state.js';
import { validateContent } from '../src/model/validate.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { ownership, equipPiece } from '../src/model/loadout.js';
import { inventoryRows } from '../src/model/inventoryPresentation.js';
import { innInTown } from '../src/model/locations.js';
import { MARKET_SHELVES, SHOP_KIND_SCREENS, shopStockProblems, shopSettingsProblems } from '../src/model/shopKinds.js';
import { MARKET_ADDITIONS, applyShopPriceMult } from '../src/model/marketStock.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountShop } from '../src/ui/screens/shop.js';
import { shopRowLabel } from '../src/ui/screens/settings.js';
import {
  smithStonePurchasePlan, commitSmithStonePurchase,
  armourPurchasePlan, commitArmourPurchase,
  sigilPurchasePlan, commitSigilPurchase,
  innRestPlan,
} from '../src/model/marketAdditions.js';
import { shopCategories } from '../src/ui/models/ShopWorkspaceModel.js';
import { t } from '../src/ui/strings.js';
import { beatFor } from '../src/model/secondbeat.js';
import { flaskKindOf } from '../src/model/gracerefill.js';

const REG = createRegistries(contentBundle);
const PREFIX = 'gameConfig.shops.';
const ADDITIONS_5A = ['armour', 'smithStones', 'sigils', 'innRest'];
const registriesWith = (settings) => createRegistries(configuredContentBundle(contentBundle, settings));
// Every 5a addition forced out on the visit, through the Settings rows.
const ALL_OUT = Object.fromEntries(ADDITIONS_5A.map((id) => [`${PREFIX}market.${id}.chance`, 100]));
const OUT = registriesWith(ALL_OUT);
// Every market chance at 0: only the guarantee lays anything out.
const allMarketChancesZero = () => Object.fromEntries(shippedShops.market.offerings.map((row) => [`${PREFIX}market.${row.id}.chance`, 0]));

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

// Step 6 (SPEC §14.4, #1378) moved each sigil's rule onto its tagging row: a
// sigil now authors no triggers, and one that does is refused by name.
test('sigils are content: each non-legendary with a rarity, a cost and a property from its tagging row, refused by name when malformed', () => {
  assert.ok(shippedSigils.length >= 3);
  // SPEC §15.4's legendaries have no cost; tests/legendary-sigils.test.mjs holds them.
  for (const sigil of shippedSigils.filter((row) => row.rarity !== 'legendary')) {
    assert.ok(REG.sigils.has(sigil.id), `${sigil.id} registered`);
    assert.ok(Number.isInteger(sigil.cost) && sigil.cost > 0);
    assert.equal(sigil.triggers, undefined, 'no inline triggers since step 6');
    assert.ok(REG.sigils.get(sigil.id).propertyTags.length, `${sigil.id} derives its property`);
  }
  const bad = [{ ...shippedSigils[0], id: 'probeBadSigil', rarity: 'mythic', cost: -1, triggers: [{ on: 'notAnEvent', do: [] }] }];
  const errors = validateContent({ ...contentBundle, sigils: [...shippedSigils, ...bad] }).errors.filter((e) => e.path.startsWith('sigils.probeBadSigil'));
  assert.ok(errors.some((e) => /rarity/.test(e.path) || /rarity/.test(e.msg)), 'bad rarity named');
  assert.ok(errors.some((e) => /cost/.test(e.path)), 'bad cost named');
  assert.ok(errors.some((e) => /triggers/.test(e.path)), 'inline triggers named');
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
  // Schema 15 added them; 16 (5b) came after, so a current build is 15 or later.
  assert.ok(RUN_SCHEMA_VERSION >= 15);
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
  assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION);
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

test('DOM: with every shelf on, the rail lays the additions after the flasks, each shelf holds its stock, one click buys each, and a remount shows them sold (review, #1374)', () => {
  // The Buy in the footer is the shopBuy beat, which the second-beat table
  // gives no review ("tempo", refilled by a faucet): one click commits, and no
  // dialog opens. Asserted, not guessed.
  assert.equal(beatFor('shopBuy').form, 'none');
  withKitDom((dom) => {
    const { run, rng } = marketRun(OUT, { innHere: true });
    run.hp = 5;
    run.flasks.push({ flaskId: 'crimsonFlask' });
    let changed = 0;
    const mount = (target) => {
      const app = dom.document.createElement('main');
      dom.document.body.replaceChildren(app);
      mountShop(app, {
        registries: OUT, run: target, meta: { settings: {} },
        onLeave() {}, onChanged() { changed += 1; },
        restAtInn: (quote) => commitInnRest({ run: target, registries: OUT, rng }, quote),
      });
      return app;
    };
    let app = mount(run);
    // The rail's order: the shelves, then the additions, then services and sell.
    // (5b's own shelves may come up by their chances here; tests/market-additions-5b.test.mjs lays them out.)
    const rail = app.querySelectorAll('[data-shop-category]').map((item) => item.dataset.shopCategory).filter((key) => !['skillBooks', 'reviveTokens', 'questEvent', 'companions'].includes(key));
    assert.deepEqual(rail, ['cards', 'armaments', 'weaponArts', 'relics', 'flasks', 'armour', 'smithStones', 'sigils', 'innRest', 'services', 'sell']);
    // Each addition shelf holds one tile per stock item.
    const tiles = (key) => app.querySelectorAll(`#shop-${key} .shop-offer`).length;
    assert.equal(tiles('armour'), run.shopStock.armour.length);
    assert.equal(tiles('sigils'), run.shopStock.sigils.length);
    assert.equal(tiles('smithStones'), 1);
    assert.equal(tiles('innRest'), 1);
    const before = { stones: run.smithingStones, sigils: run.sigils.length, armour: run.shopStock.armour.length, sigilShelf: run.shopStock.sigils.length, left: run.shopStock.smithStones.left, cinders: run.cinders };
    for (const key of ADDITIONS_5A) {
      app.querySelector(`#shop-cat-${key}`).click();
      const primary = app.querySelector('#shop-primary');
      assert.ok(primary && !primary.disabled, `${key}: the footer offers Buy`);
      assert.equal(primary.dataset.shopAction, 'buy');
      primary.click();
      assert.equal(dom.document.body.querySelector('[role="dialog"]'), null, `${key}: no review opens`);
      assert.equal(dom.document.body.querySelector('[role="alertdialog"]'), null, `${key}: no alert opens`);
    }
    assert.equal(run.smithingStones, before.stones + 1, 'a stone bought');
    assert.equal(run.sigils.length, before.sigils + 1, 'a sigil bought');
    assert.equal(run.loadout.boughtArmour.length, 1, 'an armour set bought');
    assert.equal(run.shopStock.innRest.bought, true, 'the rest bought');
    assert.equal(run.hp, run.maxHp);
    assert.ok(run.cinders < before.cinders);
    assert.ok(changed >= 4, 'each purchase persisted');
    // Sold stays sold: a reload and a fresh mount show the shelves as left.
    const back = reload(run, rng, OUT);
    app = mount(back);
    const again = (key) => app.querySelectorAll(`#shop-${key} .shop-offer`).length;
    assert.equal(again('armour'), before.armour - 1);
    assert.equal(again('sigils'), before.sigilShelf - 1);
    assert.equal(back.shopStock.smithStones.left, before.left - 1);
    app.querySelector('#shop-cat-innRest').click();
    const restBuy = app.querySelector('#shop-primary');
    assert.ok(restBuy && restBuy.disabled, 'the rest cannot be bought again after a reload');
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

test('a paid offering\'s price rows start at 1, so Settings refuses a free one (Codex, on #1374)', () => {
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  const paid = ['market.smithStones.price', 'market.innRest.price', 'market.armour.cost.min', 'market.armour.cost.max', 'market.sigils.pricePct', 'blacksmith.smithStones.price'];
  for (const leaf of paid) {
    const key = `${PREFIX}${leaf}`;
    assert.equal(rows.get(key).min, 1, `${leaf} starts at 1`);
    assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [key]: 0 }), contentBundle, {}), /Invalid value/, `${leaf}: 0 is refused`);
    // (A max of 1 needs a min of 1 beside it: the range must not invert.)
    const beside = leaf === 'market.armour.cost.max' ? { [`${PREFIX}market.armour.cost.min`]: 1 } : {};
    assert.doesNotThrow(() => parseAdvancedConfigFile(advancedConfigExport({ ...beside, [key]: 1 }), contentBundle, {}), `${leaf}: 1 is taken`);
  }
});

test('no generated addition stock fails its own saved-shape check, even at every price row\'s floor (Codex, on #1374)', () => {
  const rows = advancedConfigRows(contentBundle).filter((row) => row.key.startsWith(`${PREFIX}market.`) && row.type === 'number' && !/\.(chance|weight)$/.test(row.key));
  const floors = Object.fromEntries(rows.map((row) => [row.key, row.min]));
  for (const settings of [{}, floors]) {
    const registries = registriesWith({ ...ALL_OUT, ...settings });
    for (let seed = 1; seed <= 40; seed++) {
      const run = createRunState({ seed, classId: ['reaver', 'starseer', 'herald', 'rogue'][seed % 4], registries });
      const stock = buildMarketStock(registries, createRng(seed), run, { meta: {}, innInTown: true });
      assert.deepEqual(shopStockProblems(stock), [], `seed ${seed}`);
    }
  }
  // Even a table that reached the roll with a free armour range (a stored
  // value that got past Settings), the shelf never prices below 1.
  const table = structuredClone(REG.shops);
  const armour = table.market.offerings.find((row) => row.id === 'armour');
  armour.cost = { min: 0, max: 0 };
  armour.chance = 100;
  const run = createRunState({ seed: 2, classId: 'reaver', registries: REG });
  const stock = buildMarketStock({ ...REG, shops: table }, createRng(2), run, { meta: {} });
  assert.ok(stock.armour.length && stock.armour.every((item) => item.cost >= 1));
  assert.deepEqual(shopStockProblems(stock), []);
});

test('a bought armour set this build does not know archives the save by name, like an unknown sigil (Codex, on #1374)', () => {
  const save = (boughtArmour) => {
    const run = createRunState({ seed: 3, classId: 'reaver', registries: REG });
    run.loadout.boughtArmour = boughtArmour;
    const storage = createMemoryStorage();
    createSaveManager(storage).saveRun(run, createRng(3));
    const saves = createSaveManager(storage);
    return { run: saves.loadRun(REG), status: saves.runStatus() };
  };
  const unknown = save([{ classId: 'reaver', id: 'noSuchPlate' }]);
  assert.equal(unknown.run, null);
  assert.equal(unknown.status.state, 'archived');
  assert.match(unknown.status.reason, /noSuchPlate/);
  // Another class's set that this class lacks is unknown for it too.
  assert.equal(save([{ classId: 'reaver', id: 'eclipse' }]).run, null);
  // A known set loads.
  assert.ok(save([{ classId: 'reaver', id: 'vigil' }]).run);
});

// ---------------------------------------------------------------------------
// Review of #1374 (should-fix and nits), and Codex's third round
// ---------------------------------------------------------------------------

test('an atlas market and a classic merchant both scale every price on a custom run, through the one door main.js opens them by (review, #1374)', () => {
  const run = createRunState({ seed: 8, classId: 'reaver', registries: OUT });
  const plain = marketVisitStock(OUT, createRng(8), run, { meta: {}, door: 'atlas', ownerId: 'crownfall', priceMult: 1 });
  const dear = marketVisitStock(OUT, createRng(8), run, { meta: {}, door: 'atlas', ownerId: 'crownfall', priceMult: 2 });
  assert.ok(plain.offerings.includes('innRest'), 'a town with an inn always offers the rest');
  assert.equal(dear.innRest.price, plain.innRest.price * 2);
  assert.equal(dear.smithStones.price, plain.smithStones.price * 2);
  for (const kind of ['cards', 'relics', 'flasks', 'armour', 'sigils']) dear[kind].forEach((item, i) => assert.equal(item.cost, plain[kind][i].cost * 2, `atlas ${kind}[${i}]`));
  assert.equal(dear.removeCost, plain.removeCost * 2);
  const merchant = marketVisitStock(OUT, createRng(8), run, { meta: {}, door: 'merchant', priceMult: 2 });
  const merchantPlain = marketVisitStock(OUT, createRng(8), run, { meta: {}, door: 'merchant', priceMult: 1 });
  assert.equal(merchant.smithStones.price, merchantPlain.smithStones.price * 2);
  // main.js opens both doors through it, with the run's own multiplier.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /marketVisitStock\(registries, rng, run, \{[^}]*door: 'atlas'[^}]*priceMult: shopPriceMult\(\)/);
  assert.match(main, /marketVisitStock\(registries, rng, run, \{[^}]*door: 'merchant'[^}]*priceMult: shopPriceMult\(\)/);
  assert.doesNotMatch(main, /buildMarketStock\(registries, rng, run, \{ meta: saves\.loadMeta\(\), innInTown/);
});

test('armour is sold for this run only: the profile unlock is untouched, and a new run does not own the set (coordinator ruling, #1374)', () => {
  const meta = { unlocked: [] };
  const { run } = marketRun(OUT, { meta });
  const item = run.shopStock.armour[0];
  const piece = OUT.equipment.armour.find((row) => row.classId === run.class && row.id === item.id);
  assert.ok(piece.unlock, 'a locked set is on sale');
  commitArmourPurchase(OUT, run, armourPurchasePlan(OUT, run, item, { meta }), { meta });
  assert.deepEqual(meta.unlocked, [], 'the profile unlock is not written');
  const next = createRunState({ seed: 99, classId: 'reaver', registries: OUT });
  assert.equal(ownership(OUT, { meta, loadout: next.loadout }).has(piece), false, 'a new run does not own it');
});

test('a set bought this run is never restocked, and once every eligible set is bought the shelf is omitted and the guarantee fills (Codex, on #1375)', () => {
  const meta = { unlocked: [] };
  const { run } = marketRun(OUT, { meta });
  const item = run.shopStock.armour[0];
  commitArmourPurchase(OUT, run, armourPurchasePlan(OUT, run, item, { meta }), { meta });
  for (let seed = 1; seed <= 20; seed++) {
    const stock = buildMarketStock(OUT, createRng(seed), run, { meta });
    assert.ok(!(stock.armour || []).some((row) => row.id === item.id), `seed ${seed}: the bought set is not offered again`);
  }
  // Every eligible set bought: no armour shelf, and a chance-0 visit still lays out its guarantee.
  run.loadout.boughtArmour = OUT.equipment.armour.filter((row) => row.classId === run.class).map((row) => ({ classId: row.classId, id: row.id }));
  const onlyArmour = registriesWith({ ...allMarketChancesZero(), [`${PREFIX}market.armour.chance`]: 100 });
  const stock = buildMarketStock(onlyArmour, createRng(4), run, { meta });
  assert.ok(!stock.offerings.includes('armour'), 'the empty armour shelf is not laid out');
  assert.equal(stock.armour, undefined);
  assert.equal(stock.offerings.length, onlyArmour.shops.market.guaranteedMinimum, 'the guarantee fills from the others');
  assert.deepEqual(stock.offerings, ['cards', 'remove'], 'by weight, in written order');
});

test('armour.includeLocked (default on) is a generated Settings row; off, the armour shelf is empty and omitted (coordinator ruling, #1374)', () => {
  const row = advancedConfigRows(contentBundle).find((r) => r.key === `${PREFIX}market.armour.includeLocked`);
  assert.ok(row, 'the toggle has its row');
  assert.equal(row.def, true);
  assert.ok(row.note && row.note.length > 20);
  assert.equal(shippedShops.market.offerings.find((o) => o.id === 'armour').includeLocked, true);
  const on = marketRun(OUT).run;
  assert.ok(on.shopStock.offerings.includes('armour') && on.shopStock.armour.length > 0);
  const off = registriesWith({ ...ALL_OUT, [`${PREFIX}market.armour.includeLocked`]: false });
  for (let seed = 1; seed <= 10; seed++) {
    const run = createRunState({ seed, classId: 'reaver', registries: off });
    const stock = buildMarketStock(off, createRng(seed), run, { meta: {} });
    assert.ok(!stock.offerings.includes('armour'), `seed ${seed}`);
    assert.equal(stock.armour, undefined);
  }
  // A non-boolean toggle is refused by name at the content door.
  const table = structuredClone(shippedShops);
  table.market.offerings.find((o) => o.id === 'armour').includeLocked = 'yes';
  const errors = validateContent({ ...contentBundle, shops: table }).errors.filter((e) => e.path.startsWith('shops.market.armour.includeLocked'));
  assert.equal(errors.length, 1);
});

test('an empty sigil shelf is not laid out, and the guarantee fills from the others (review, #1374)', () => {
  const onlySigils = registriesWith({ ...allMarketChancesZero(), [`${PREFIX}market.sigils.chance`]: 100 });
  const run = createRunState({ seed: 5, classId: 'reaver', registries: onlySigils });
  run.sigils = onlySigils.sigils.ids();
  const stock = buildMarketStock(onlySigils, createRng(5), run, { meta: {} });
  assert.ok(!stock.offerings.includes('sigils'));
  assert.equal(stock.sigils, undefined);
  assert.deepEqual(stock.offerings, ['cards', 'remove']);
  // With a sigil left to sell, the same visit lays it out.
  run.sigils = [];
  assert.ok(buildMarketStock(onlySigils, createRng(5), run, { meta: {} }).offerings.includes('sigils'));
});

test('an inverted armour cost range is refused by name in Settings, so it costs only the market, not every setting (review, #1374)', () => {
  const settings = { [`${PREFIX}market.armour.cost.min`]: 500, [`${PREFIX}market.armour.cost.max`]: 400 };
  const problems = shopSettingsProblems(contentBundle, settings);
  assert.equal(problems.length, 1);
  assert.deepEqual(problems[0].keys.sort(), Object.keys(settings).sort());
  assert.equal(problems[0].id, 'settings.shops.refuse.armourCost');
  assert.match(problems[0].message, /500/);
  assert.match(problems[0].message, /400/);
  assert.deepEqual(shopSettingsProblems(contentBundle, { [`${PREFIX}market.armour.cost.min`]: 350 }), []);
  // One bad kind costs that kind: the market keeps its authored table, and
  // an unrelated Advanced setting still applies.
  const bundle = configuredContentBundle(contentBundle, { ...settings, [`${PREFIX}blacksmith.smithStones.price`]: 77 });
  assert.equal(validateContent(bundle).ok, true);
  const kept = bundle.shops.market.offerings.find((o) => o.id === 'armour').cost;
  assert.deepEqual([kept.min, kept.max], [300, 390]);
  assert.equal(bundle.shops.blacksmith.offerings.find((o) => o.id === 'smithStones').price, 77);
});

test('the sigil markup rises above 100 but is bounded at 1-300 (coordinator ruling, #1374)', () => {
  const row = advancedConfigRows(contentBundle).find((r) => r.key === `${PREFIX}market.sigils.pricePct`);
  assert.deepEqual([row.min, row.max, row.integer], [1, 300, true]);
});

test('every addition stock and per-visit count is a whole number at the content door, and an integer Settings row (Codex, on #1374)', () => {
  const counts = [['smithStones', 'perVisit'], ['armour', 'stock'], ['sigils', 'stock']];
  const rows = new Map(advancedConfigRows(contentBundle).map((r) => [r.key, r]));
  for (const [id, key] of counts) {
    const row = rows.get(`${PREFIX}market.${id}.${key}`);
    assert.equal(row.integer, true, `${id}.${key} is an integer row`);
    assert.equal(row.step, 1);
    const table = structuredClone(shippedShops);
    table.market.offerings.find((o) => o.id === id)[key] = 1.5;
    const errors = validateContent({ ...contentBundle, shops: table }).errors.filter((e) => e.path === `shops.market.${id}.${key}`);
    assert.equal(errors.length, 1, `${id}.${key}: 1.5 refused by name`);
    assert.match(errors[0].msg, /whole/);
  }
  // Prices too: a fractional stone price or rest price would roll a stock the saved check refuses.
  for (const [id, key] of [['smithStones', 'price'], ['innRest', 'price']]) {
    const table = structuredClone(shippedShops);
    table.market.offerings.find((o) => o.id === id)[key] = 10.5;
    assert.equal(validateContent({ ...contentBundle, shops: table }).errors.filter((e) => e.path === `shops.market.${id}.${key}`).length, 1, `${id}.${key}`);
  }
});

test('the market sigil offering has its own label; the blacksmith keeps "Sigil setting" (review, #1374)', () => {
  assert.equal(t('settings.shops.offering.market.sigils'), 'Sigils');
  assert.equal(t('settings.shops.offering.sigils'), 'Sigil setting');
  const rows = advancedConfigRows(contentBundle);
  const market = rows.find((r) => r.key === `${PREFIX}market.sigils.enabled`);
  const smith = rows.find((r) => r.key === `${PREFIX}blacksmith.sigils.enabled`);
  assert.match(shopRowLabel(market.shopLabel), /Sigils:/);
  assert.match(shopRowLabel(smith.shopLabel), /Sigil setting/);
});

test('inn rest is refused by a restDenied relic in its tag-list form, naming the relic (review, #1374)', () => {
  const relic = { ...structuredClone(contentBundle.relics[0]), id: 'probeLightSleeper', name: 'Probe of Light Sleep', rarity: 'common', passives: { restDenied: ['restHpFull'] } };
  delete relic.triggers;
  const registries = createRegistries({ ...configuredContentBundle(contentBundle, ALL_OUT), relics: [...contentBundle.relics, relic] });
  const { run } = marketRun(registries, { innHere: true });
  run.relics.push('probeLightSleeper');
  const quote = innRestPlan(registries, run);
  assert.equal(quote.ok, false);
  assert.match(quote.reason, /Probe of Light Sleep/);
  // A list naming a tag the inn does not carry does not refuse it.
  const shrineOnly = { ...relic, id: 'probeShrineAverse', name: 'Probe of Shrine Aversion', passives: { restDenied: ['restHpPartial'] } };
  const reg2 = createRegistries({ ...configuredContentBundle(contentBundle, ALL_OUT), relics: [...contentBundle.relics, shrineOnly] });
  const other = marketRun(reg2, { innHere: true }).run;
  other.relics.push('probeShrineAverse');
  assert.equal(innRestPlan(reg2, other).ok, true);
});

test('a relic an arrival rule hands over that denies the rest refuses the bought rest by name, and nothing changes (review, #1374)', () => {
  const relic = { ...structuredClone(contentBundle.relics[0]), id: 'probeInsomnia', name: 'Probe of Sleeplessness', rarity: 'common', passives: { restDenied: true } };
  delete relic.triggers;
  const configured = configuredContentBundle(contentBundle, ALL_OUT);
  const propertyRules = configured.propertyRules.map((rule) => (rule.tag === 'restFlasks'
    ? { ...rule, triggers: [...rule.triggers, { on: 'arrived', do: [{ op: 'addRelic', id: 'probeInsomnia' }] }] }
    : rule));
  const registries = createRegistries({ ...configured, relics: [...contentBundle.relics, relic], propertyRules });
  const { run, rng } = marketRun(registries, { innHere: true });
  run.hp = 5;
  const quote = innRestPlan(registries, run);
  assert.equal(quote.ok, true, 'the plan cannot see what the arrival will hand over');
  const before = JSON.stringify(run);
  const counters = JSON.stringify(rng.getCounters());
  assert.throws(() => commitInnRest({ run, registries, rng }, quote), /Probe of Sleeplessness/);
  assert.equal(JSON.stringify(run), before, 'no relic, no heal, no cinders spent');
  assert.equal(JSON.stringify(rng.getCounters()), counters, 'no stream moved');
});

test('the addition stock rolls on shopOffers in written order: armour, then sigils (review, #1374)', () => {
  // Armour is written before sigils, so a sigil setting never moves the armour
  // shelf; the sigil shelf does move when the armour shelf draws more.
  const run = createRunState({ seed: 12, classId: 'reaver', registries: OUT });
  const base = buildMarketStock(OUT, createRng(12), run, { meta: {} });
  const moreSigils = registriesWith({ ...ALL_OUT, [`${PREFIX}market.sigils.stock`]: 4 });
  assert.deepEqual(buildMarketStock(moreSigils, createRng(12), run, { meta: {} }).armour, base.armour);
  let moved = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const r = createRunState({ seed, classId: 'reaver', registries: OUT });
    const a = buildMarketStock(OUT, createRng(seed), r, { meta: {} });
    const b = buildMarketStock(registriesWith({ ...ALL_OUT, [`${PREFIX}market.armour.stock`]: 1 }), createRng(seed), r, { meta: {} });
    if (JSON.stringify(a.sigils) !== JSON.stringify(b.sigils)) moved += 1;
  }
  assert.ok(moved > 0, 'the sigil shelf draws after the armour shelf');
  // The offering roll comes first: the same visit with the additions' chances
  // at 100 (no draw) and at 99 (one draw each) rolls different stock.
  const drawn = registriesWith(Object.fromEntries(ADDITIONS_5A.map((id) => [`${PREFIX}market.${id}.chance`, 99])));
  const c = createRng(12);
  buildMarketStock(drawn, c, run, { meta: {} });
  const d = createRng(12);
  buildMarketStock(OUT, d, run, { meta: {} });
  assert.ok(c.getCounters().shopOffers >= d.getCounters().shopOffers);
});

test('a v15 save carrying bought armour and addition stock loads with every field kept (review, #1374)', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/market-additions-v15.json', import.meta.url), 'utf8'));
  const saved = JSON.parse(fixture.bytes);
  assert.equal(saved.schemaVersion, 15);
  assert.ok(saved.loadout.boughtArmour.length > 0);
  assert.ok(saved.sigils.length > 0);
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, fixture.bytes);
  const run = createSaveManager(storage).loadRun(OUT);
  assert.ok(run, 'it loads');
  assert.deepEqual(run.loadout.boughtArmour, saved.loadout.boughtArmour);
  assert.deepEqual(run.sigils, saved.sigils);
  for (const key of ADDITIONS_5A) assert.deepEqual(run.shopStock[key], saved.shopStock[key], key);
  assert.deepEqual(run.shopStock.offerings, saved.shopStock.offerings);
});

test('the armour shelf offers only locked sets of the run\'s own class: never another class\'s, never a shared or starting set, never one the profile has unlocked (Codex, on #1375)', () => {
  const armour = OUT.equipment.armour;
  for (const classId of ['reaver', 'starseer', 'herald', 'rogue']) {
    const locked = armour.filter((piece) => piece.classId === classId && piece.unlock);
    // The profile has unlocked the first locked set of this class.
    const meta = { unlocked: [locked[0].unlock] };
    const bigShelf = registriesWith({ ...ALL_OUT, [`${PREFIX}market.armour.stock`]: 20 });
    for (let seed = 1; seed <= 12; seed++) {
      const run = createRunState({ seed, classId, registries: bigShelf });
      const stock = buildMarketStock(bigShelf, createRng(seed), run, { meta });
      const offered = stock.armour || [];
      for (const item of offered) {
        const piece = armour.find((row) => row.classId === classId && row.id === item.id);
        assert.ok(piece, `${classId} seed ${seed}: ${item.id} is a set of the run's own class`);
        assert.ok(piece.unlock, `${classId} seed ${seed}: ${item.id} is a locked set, not a shared or starting one`);
        assert.ok(!meta.unlocked.includes(piece.unlock), `${classId} seed ${seed}: ${item.id} is not one the profile unlocked`);
      }
      // With a shelf larger than the pool, the pool is laid out whole: every
      // locked set of this class the profile lacks, and nothing else.
      assert.deepEqual(offered.map((item) => item.id).sort(), locked.filter((piece) => !meta.unlocked.includes(piece.unlock)).map((piece) => piece.id).sort(), `${classId} seed ${seed}`);
    }
  }
});

test('armour.includeLocked, both values: on lays out the locked sets; off omits the shelf and the guarantee fills (coordinator ruling, #1374)', () => {
  const only = { ...allMarketChancesZero(), [`${PREFIX}market.armour.chance`]: 100 };
  const on = registriesWith({ ...only, [`${PREFIX}market.armour.includeLocked`]: true });
  const off = registriesWith({ ...only, [`${PREFIX}market.armour.includeLocked`]: false });
  const run = createRunState({ seed: 3, classId: 'rogue', registries: on });
  const withSets = buildMarketStock(on, createRng(3), run, { meta: {} });
  assert.ok(withSets.offerings.includes('armour'));
  assert.ok(withSets.armour.length > 0);
  const without = buildMarketStock(off, createRng(3), run, { meta: {} });
  assert.ok(!without.offerings.includes('armour'));
  assert.equal(without.armour, undefined);
  assert.equal(without.offerings.length, off.shops.market.guaranteedMinimum, 'the guarantee fills from the others');
});

test('a conditional offering does not count toward the enablement minimum: Settings and the content door refuse it by name (coordinator ruling, #1375)', () => {
  // Minimum 2, and only armour (conditional) plus cards (unconditional) left on.
  const off = Object.fromEntries(shippedShops.market.offerings
    .filter((row) => !['armour', 'cards'].includes(row.id))
    .map((row) => [`${PREFIX}market.${row.id}.enabled`, false]));
  const settings = { ...off, [`${PREFIX}market.guaranteedMinimum`]: 2 };
  const problems = shopSettingsProblems(contentBundle, settings);
  assert.equal(problems.length, 1, JSON.stringify(problems));
  assert.equal(problems[0].id, 'settings.shops.refuse.conditional');
  assert.equal(problems[0].kind, 'market');
  assert.ok(problems[0].keys.includes(`${PREFIX}market.guaranteedMinimum`));
  assert.match(problems[0].message, /Armour/);
  assert.doesNotMatch(problems[0].message, /\{|\}/, 'every token filled');
  // A config import refuses it the same way (Settings and sync read the same rows).
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle, {}));
  // Two unconditional offerings on beside armour: taken.
  const two = { ...settings, [`${PREFIX}market.flasks.enabled`]: true };
  assert.deepEqual(shopSettingsProblems(contentBundle, two), []);
  // Sigils count as conditional too.
  const sigilsOnly = Object.fromEntries(shippedShops.market.offerings
    .filter((row) => !['sigils', 'cards'].includes(row.id))
    .map((row) => [`${PREFIX}market.${row.id}.enabled`, false]));
  assert.equal(shopSettingsProblems(contentBundle, sigilsOnly)[0]?.id, 'settings.shops.refuse.conditional');
  // The content door: the same table authored is refused by name.
  const table = structuredClone(shippedShops);
  for (const row of table.market.offerings) row.enabled = ['armour', 'cards'].includes(row.id);
  const errors = validateContent({ ...contentBundle, shops: table }).errors.filter((e) => e.path === 'shops.market');
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.match(errors[0].msg, /conditional/);
  assert.match(errors[0].msg, /armour/);
});

test('every offering authors a boolean `conditional` with its [NOTE]; the market classifies each shelf whose pool can be empty as conditional (coordinator ruling, #1375)', () => {
  for (const kind of ['market', 'blacksmith', 'master']) {
    for (const row of shippedShops[kind].offerings) {
      assert.equal(typeof row.conditional, 'boolean', `${kind}.${row.id} authors conditional`);
      const note = row[NOTE] && row[NOTE].conditional;
      assert.ok(typeof note === 'string' && note.length > 20, `${kind}.${row.id}: conditional carries its sentence`);
    }
  }
  const market = Object.fromEntries(shippedShops.market.offerings.map((row) => [row.id, row.conditional]));
  assert.deepEqual(market, {
    cards: false, relics: true, flasks: false, armaments: true, weaponArts: true, remove: true,
    armour: true, smithStones: true, sigils: true, innRest: true,
    // Step 5b (SPEC §14.3): each can have nothing to lay out.
    skillBooks: true, reviveTokens: true, questEvent: true, companions: true,
  });
  // Authored data, not a Settings row.
  assert.equal(advancedConfigRows(contentBundle).some((r) => /\.conditional$/.test(r.key)), false);
  // A missing or non-boolean flag is refused by name at the content door.
  for (const bad of [undefined, 'yes', 1]) {
    const table = structuredClone(shippedShops);
    const row = table.market.offerings.find((o) => o.id === 'cards');
    if (bad === undefined) delete row.conditional; else row.conditional = bad;
    const errors = validateContent({ ...contentBundle, shops: table }).errors.filter((e) => e.path === 'shops.market.cards.conditional');
    assert.equal(errors.length, 1, `conditional = ${JSON.stringify(bad)} is refused by name`);
  }
});

test('validateContent refuses a kind with too few enabled offerings that are not conditional, reading the flag and no list (coordinator ruling, #1375)', () => {
  // Minimum 2, and cards is the one non-conditional offering left on beside
  // four conditional ones: five enabled, one that can never come up empty.
  const table = structuredClone(shippedShops);
  for (const row of table.market.offerings) row.enabled = ['cards', 'relics', 'armaments', 'weaponArts', 'armour'].includes(row.id);
  const errors = validateContent({ ...contentBundle, shops: table }).errors.filter((e) => e.path === 'shops.market');
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.match(errors[0].msg, /conditional/);
  // The flag decides, not an id: an authored table that calls relics
  // unconditional passes the same rule.
  const flipped = structuredClone(table);
  flipped.market.offerings.find((o) => o.id === 'relics').conditional = false;
  assert.deepEqual(validateContent({ ...contentBundle, shops: flipped }).errors.filter((e) => e.path === 'shops.market'), []);
  // And Settings refuses the same combination, naming the conditional ones.
  const settings = Object.fromEntries(shippedShops.market.offerings
    .filter((row) => !['cards', 'relics', 'armaments'].includes(row.id))
    .map((row) => [`${PREFIX}market.${row.id}.enabled`, false]));
  const problems = shopSettingsProblems(contentBundle, settings);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].id, 'settings.shops.refuse.conditional');
  assert.match(problems[0].message, /Relics/);
  assert.match(problems[0].message, /Armaments/);
});

test('PROPERTY: a run that owns every relic and carries every armament still gets its guarantee, and no empty conditional shelf is laid out (coordinator ruling, #1375)', () => {
  const settingsSets = [
    {},
    ALL_OUT,
    { ...allMarketChancesZero(), [`${PREFIX}market.relics.chance`]: 100, [`${PREFIX}market.armaments.chance`]: 100 },
    // The guarantee reaching first for the shelves the run has emptied. (A
    // minimum of 3 is refused while only cards and flasks count.)
    { ...allMarketChancesZero(), [`${PREFIX}market.relics.weight`]: 100, [`${PREFIX}market.armaments.weight`]: 99, [`${PREFIX}market.remove.weight`]: 98 },
    { ...allMarketChancesZero(), [`${PREFIX}market.armour.weight`]: 100, [`${PREFIX}market.sigils.weight`]: 99 },
    // Stock-0 mixes (coordinator ruling, #1375): a shelf whose stock is set
    // to 0 lays out nothing, so it is omitted and the guarantee refills.
    // (Cards and flasks at 0 are refused by Settings; the backstop for them
    // is tested on a bundle below.)
    { ...allMarketChancesZero(), 'gameConfig.balance.shop.relicStock': 0, [`${PREFIX}market.relics.weight`]: 1000 },
    { ...ALL_OUT, 'gameConfig.balance.shop.relicStock': 0, 'gameConfig.balance.shop.armamentStock': 0, 'gameConfig.balance.shop.weaponArtStock': 0, [`${PREFIX}market.smithStones.perVisit`]: 0, [`${PREFIX}market.sigils.stock`]: 0, [`${PREFIX}market.armour.stock`]: 0 },
  ];
  for (const settings of settingsSets) {
    const registries = registriesWith(settings);
    assert.deepEqual(shopSettingsProblems(contentBundle, settings), [], JSON.stringify(settings));
    const minimum = registries.shops.market.guaranteedMinimum;
    for (let seed = 1; seed <= 40; seed++) {
      const run = createRunState({ seed, classId: ['reaver', 'starseer', 'herald', 'rogue'][seed % 4], registries });
      run.relics = registries.relics.all().map((r) => r.id);
      run.loadout.storage = [...new Set([...(run.loadout.storage || []), ...registries.equipment.armaments.map((piece) => piece.id)])];
      run.sigils = registries.sigils.ids();
      run.loadout.boughtArmour = registries.equipment.armour.filter((row) => row.classId === run.class).map((row) => ({ classId: row.classId, id: row.id }));
      // Every other seed, a deck with nothing Remove could take.
      if (seed % 2) run.deck = run.deck.filter((card) => card.grantedBy);
      const stock = buildMarketStock(registries, createRng(seed), run, { meta: {} });
      if (seed % 2) assert.ok(!stock.offerings.includes('remove'), `seed ${seed}: remove with nothing to remove is omitted`);
      assert.ok(stock.offerings.length >= minimum, `seed ${seed} ${JSON.stringify(settings)}: ${stock.offerings.join(',')} meets ${minimum}`);
      for (const id of ['relics', 'armaments', 'armour', 'sigils']) {
        assert.ok(!stock.offerings.includes(id), `seed ${seed}: the empty ${id} shelf is not laid out`);
      }
      // No rail item is ever empty: every laid-out shelf holds something.
      for (const id of stock.offerings) {
        if (id === 'remove') { assert.ok(Number.isFinite(stock.removeCost)); continue; }
        const shelf = stock[id];
        const holds = Array.isArray(shelf) ? shelf.length > 0 : (id === 'smithStones' ? shelf.left > 0 : shelf != null);
        assert.ok(holds, `seed ${seed} ${JSON.stringify(settings)}: ${id} is laid out only with something on it`);
      }
    }
  }
});

test('a non-conditional offering counts toward the minimum only while its named stock is at least 1: cardStock 0 plus flaskStock 0 at minimum 2 is refused (coordinator ruling, #1375)', () => {
  const market = Object.fromEntries(shippedShops.market.offerings.map((row) => [row.id, row]));
  assert.equal(market.cards.stockKey, 'balance.shop.cardStock');
  assert.equal(market.flasks.stockKey, 'balance.shop.flaskStock');
  assert.equal(market.remove.stockKey, undefined, 'remove is a service, always available');
  // Authored data, never a Settings row.
  assert.equal(advancedConfigRows(contentBundle).some((r) => /\.stockKey$/.test(r.key)), false);
  const both = { 'gameConfig.balance.shop.cardStock': 0, 'gameConfig.balance.shop.flaskStock': 0 };
  const problems = shopSettingsProblems(contentBundle, both);
  assert.equal(problems.length, 1, JSON.stringify(problems));
  assert.equal(problems[0].id, 'settings.shops.refuse.emptyStock');
  assert.ok(problems[0].keys.includes('gameConfig.balance.shop.cardStock'));
  assert.ok(problems[0].keys.includes('gameConfig.balance.shop.flaskStock'));
  assert.match(problems[0].message, /Cards/);
  assert.match(problems[0].message, /Flasks/);
  assert.doesNotMatch(problems[0].message, /\{|\}/);
  // An import refuses it whole.
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport(both), contentBundle, {}), /Nothing was imported/);
  // One bad kind costs that kind: the stock rows that break it are set aside
  // with it, the configured bundle still validates, and an unrelated setting applies.
  const bundle = configuredContentBundle(contentBundle, { ...both, [`${PREFIX}blacksmith.smithStones.price`]: 77 });
  assert.equal(validateContent(bundle).ok, true, JSON.stringify(validateContent(bundle).errors));
  assert.equal(bundle.balance.shop.cardStock, contentBundle.balance.shop.cardStock);
  assert.equal(bundle.shops.blacksmith.offerings.find((o) => o.id === 'smithStones').price, 77);
  // cardStock 0 alone is refused too: cards and flasks are the only
  // offerings the shipped minimum of 2 can count.
  const cardsOnly = { 'gameConfig.balance.shop.cardStock': 0 };
  assert.equal(shopSettingsProblems(contentBundle, cardsOnly)[0]?.id, 'settings.shops.refuse.emptyStock');
  // THE RUNTIME BACKSTOP, on a bundle that carries the 0 past Settings: the
  // empty cards shelf is omitted and the guarantee refills from the rest.
  const zeroCards = structuredClone(contentBundle.balance);
  zeroCards.shop.cardStock = 0;
  const registries = createRegistries({ ...configuredContentBundle(contentBundle, allMarketChancesZero()), balance: zeroCards });
  const run = createRunState({ seed: 2, classId: 'reaver', registries });
  const stock = buildMarketStock(registries, createRng(2), run, { meta: {} });
  assert.ok(!stock.offerings.includes('cards'));
  assert.equal(stock.offerings.length, 2);
  // The content door refuses the same bundle authored.
  const authored = structuredClone(contentBundle.balance);
  authored.shop.cardStock = 0;
  authored.shop.flaskStock = 0;
  const errors = validateContent({ ...contentBundle, balance: authored }).errors.filter((e) => e.path === 'shops.market');
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.match(errors[0].msg, /stock/);
  // A stock key that names no number is refused by name.
  const table = structuredClone(shippedShops);
  table.market.offerings.find((o) => o.id === 'cards').stockKey = 'balance.shop.noSuchStock';
  assert.equal(validateContent({ ...contentBundle, shops: table }).errors.filter((e) => e.path === 'shops.market.cards.stockKey').length, 1);
});

test('remove is conditional: with no card it could remove (one card left, or only granted cards) it is omitted and the guarantee refills (coordinator ruling, #1375)', () => {
  assert.equal(shippedShops.market.offerings.find((o) => o.id === 'remove').conditional, true);
  const registries = registriesWith(allMarketChancesZero());
  const minimum = registries.shops.market.guaranteedMinimum;
  // A fresh deck has cards to remove: the guarantee lays out cards and remove.
  const fresh = createRunState({ seed: 6, classId: 'reaver', registries });
  assert.deepEqual(buildMarketStock(registries, createRng(6), fresh, { meta: {} }).offerings, ['cards', 'remove']);
  // One card left: nothing may be removed.
  const thin = createRunState({ seed: 6, classId: 'reaver', registries });
  thin.deck = thin.deck.filter((card) => !card.grantedBy).slice(0, 1);
  const one = buildMarketStock(registries, createRng(6), thin, { meta: {} });
  assert.ok(!one.offerings.includes('remove'), 'one card: remove is omitted');
  assert.equal(one.offerings.length, minimum, 'the guarantee refills');
  // Only granted cards: none may be removed.
  const granted = createRunState({ seed: 6, classId: 'reaver', registries });
  granted.deck = granted.deck.filter((card) => card.grantedBy);
  assert.ok(granted.deck.length > 1);
  const locked = buildMarketStock(registries, createRng(6), granted, { meta: {} });
  assert.ok(!locked.offerings.includes('remove'), 'granted cards only: remove is omitted');
  assert.equal(locked.offerings.length, minimum);
});

test('only cards plus remove enabled at minimum 2 is refused: cards and flasks are the only offerings that count (coordinator ruling, #1375)', () => {
  const settings = Object.fromEntries(shippedShops.market.offerings
    .filter((row) => !['cards', 'remove'].includes(row.id))
    .map((row) => [`${PREFIX}market.${row.id}.enabled`, false]));
  const problems = shopSettingsProblems(contentBundle, settings);
  assert.equal(problems.length, 1, JSON.stringify(problems));
  assert.equal(problems[0].id, 'settings.shops.refuse.conditional');
  assert.match(problems[0].message, /Remove/);
  const nonConditional = shippedShops.market.offerings.filter((row) => !row.conditional).map((row) => row.id);
  assert.deepEqual(nonConditional, ['cards', 'flasks']);
  // The shipped defaults still pass.
  assert.deepEqual(shopSettingsProblems(contentBundle, {}), []);
  assert.deepEqual(validateContent(contentBundle).errors.filter((e) => e.path.startsWith('shops')), []);
});

// Step 6 (SPEC §14.4) registered the blacksmith and step 7 (§14.5) the master,
// so the rule now binds every kind (tests/blacksmith.test.mjs,
// tests/master.test.mjs).
test('the non-conditional minimum binds every kind whose screen is registered, the master included since step 7 (coordinator ruling, #1375)', () => {
  assert.deepEqual(SHOP_KIND_SCREENS, ['market', 'blacksmith', 'master']);
  assert.deepEqual(validateContent(contentBundle).errors.filter((e) => e.path.startsWith('shops')), []);
  assert.deepEqual(shopSettingsProblems(contentBundle, {}), []);
  // A master with only conditional offerings left on is refused now that its
  // screen is registered...
  const table = structuredClone(shippedShops);
  for (const kind of ['master']) for (const row of table[kind].offerings) row.enabled = row.conditional;
  assert.equal(validateContent({ ...contentBundle, shops: table }).errors.filter((e) => e.path === 'shops.master').length, 1);
  const settings = Object.fromEntries(['master'].flatMap((kind) => shippedShops[kind].offerings
    .filter((row) => !row.conditional).map((row) => [`${PREFIX}${kind}.${row.id}.enabled`, false])));
  assert.ok(shopSettingsProblems(contentBundle, settings).some((p) => p.kind === 'master'));
  // ...but the plain enablement minimum still binds every kind.
  const bare = structuredClone(shippedShops);
  bare.blacksmith.offerings.forEach((row, i) => { row.enabled = i === 0; });
  assert.equal(validateContent({ ...contentBundle, shops: bare }).errors.filter((e) => e.path === 'shops.blacksmith').length, 1);
});

test('an armour offer names its class: a class change between stocking and buying refuses the purchase by name, and nothing changes (Codex, on #1375)', () => {
  const { run } = marketRun(OUT);
  for (const item of run.shopStock.armour) assert.equal(item.classId, 'reaver', `${item.id} carries its classId`);
  const item = run.shopStock.armour[0];
  const quote = armourPurchasePlan(OUT, run, item);
  assert.equal(quote.ok, true);
  // The Turncoat's Mirror swaps the class after the shelf was stocked.
  run.class = 'rogue';
  const before = JSON.stringify(run);
  const plan = armourPurchasePlan(OUT, run, item);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, new RegExp(OUT.equipment.armour.find((row) => row.classId === 'reaver' && row.id === item.id).name));
  assert.throws(() => commitArmourPurchase(OUT, run, quote), new RegExp(plan.reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(JSON.stringify(run), before, 'no cinders spent, no set recorded');
});

test('a saved atlas stock stocked for the old class does not sell the wrong set: the shelf shows it unavailable, and a stock without classId is refused (Codex, on #1375)', () => {
  withKitDom((dom) => {
    // A rogue's run holding a saved stock that was stocked for a reaver (the
    // class swapped since), naming a set id the rogue's class also has.
    const { run: reaver } = marketRun(OUT);
    const run = createRunState({ seed: 21, classId: 'rogue', registries: OUT });
    run.cinders = 5000;
    const rng = createRng(21);
    const shared = OUT.equipment.armour.find((row) => row.classId === 'reaver' && OUT.equipment.armour.some((o) => o.classId === 'rogue' && o.id === row.id));
    const rogueSet = OUT.equipment.armour.find((row) => row.classId === 'rogue' && row.unlock);
    const stale = { classId: 'reaver', id: shared.id, cost: 300 };
    const mount = (target) => {
      const app = dom.document.createElement('main');
      dom.document.body.replaceChildren(app);
      mountShop(app, { registries: OUT, run: target, meta: { settings: {} }, onLeave() {}, onChanged() {}, restAtInn() {} });
      return app;
    };
    // Beside an offer for this class, the stale one is shown but cannot be bought.
    run.shopStock = { ...structuredClone(reaver.shopStock), armour: [stale, { classId: 'rogue', id: rogueSet.id, cost: 300 }] };
    assert.deepEqual(shopStockProblems(run.shopStock), []);
    const back = reload(run, rng, OUT);
    assert.equal(back.class, 'rogue');
    assert.deepEqual(back.shopStock.armour[0], stale, 'the saved offer keeps its class');
    let app = mount(back);
    app.querySelector('#shop-cat-armour').click();
    const tiles = app.querySelectorAll('#shop-armour .shop-offer');
    assert.equal(tiles.length, 2, 'both offers are shown');
    tiles[0].click();
    const primary = app.querySelector('#shop-primary');
    assert.ok(!primary || primary.disabled, 'the stale offer cannot be bought');
    assert.equal((back.loadout.boughtArmour || []).length, 0);
    // With no offer for this class at all, the armour shelf is hidden, and
    // nothing backfills it (coordinator ruling, #1375).
    back.shopStock.armour = [stale];
    app = mount(back);
    assert.equal(app.querySelector('#shop-cat-armour'), null, 'no armour rail item');
    assert.ok(!app.querySelectorAll('[data-shop-category]').map((el) => el.dataset.shopCategory).includes('armour'));
    assert.deepEqual(back.shopStock.armour, [stale], 'the saved stock is not rerolled');
  });
  // The saved-stock check requires the classId.
  assert.ok(shopStockProblems({ kind: 'market', offerings: ['armour'], armour: [{ id: 'bastion', cost: 300 }] }).some((p) => /armour\[0\]/.test(p) && /classId/.test(p)));
});

test('a non-conditional offering needs a non-empty authored pool: content with only charge vessels is refused by name (coordinator ruling, #1375)', () => {
  const onlyVessels = contentBundle.flasks.filter((def) => flaskKindOf(def) !== 'utility');
  assert.ok(onlyVessels.length > 0 && onlyVessels.length < contentBundle.flasks.length);
  const errors = validateContent({ ...contentBundle, flasks: onlyVessels }).errors.filter((e) => e.path === 'shops.market.flasks');
  assert.equal(errors.length, 1, JSON.stringify(validateContent({ ...contentBundle, flasks: onlyVessels }).errors.slice(0, 5)));
  assert.match(errors[0].msg, /pool/);
  // A class with no shop cards at all is refused the same way.
  const classes = contentBundle.classes.map((row, i) => (i === 0 ? { ...row, cardPool: [] } : row));
  const cards = contentBundle.cards.filter((card) => card.class !== 'colorless');
  const cardErrors = validateContent({ ...contentBundle, classes, cards }).errors.filter((e) => e.path === 'shops.market.cards');
  assert.equal(cardErrors.length, 1, JSON.stringify(cardErrors));
});

test('an unsold offer this build no longer knows is pruned at the load door, never rerolled, and the run is not archived; owned references are untouched (Codex, on #1374)', () => {
  const { run, rng } = marketRun(OUT);
  const validSigil = run.shopStock.sigils[0];
  const validArmour = run.shopStock.armour[0];
  run.shopStock.sigils = [{ id: 'retiredSigil', cost: 90 }, validSigil];
  run.shopStock.armour = [{ classId: 'reaver', id: 'retiredSet', cost: 300 }];
  run.sigils = [OUT.sigils.ids()[0]];
  const owned = OUT.equipment.armour.find((row) => row.classId === 'reaver' && row.unlock && row.id !== validArmour.id);
  run.loadout.boughtArmour = [{ classId: 'reaver', id: owned.id }];
  const offeringsBefore = [...run.shopStock.offerings];
  const back = reload(run, rng, OUT);
  assert.deepEqual(back.shopStock.sigils, [validSigil], 'the unknown sigil offer is gone, the known one kept');
  // The armour shelf lost its only offer: it is hidden, not rerolled.
  assert.ok(!(back.shopStock.armour || []).length);
  assert.ok(!back.shopStock.offerings.includes('armour'), 'an emptied shelf is no longer laid out');
  assert.deepEqual(back.shopStock.offerings, offeringsBefore.filter((id) => id !== 'armour'));
  // Owned references are unaffected.
  assert.deepEqual(back.sigils, run.sigils);
  assert.deepEqual(back.loadout.boughtArmour, run.loadout.boughtArmour);
  // A save whose OWNED sigil is unknown is still archived by name.
  const bad = structuredClone(run);
  bad.sigils = ['retiredSigil'];
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(bad, rng);
  assert.equal(createSaveManager(storage).loadRun(OUT), null);
});
