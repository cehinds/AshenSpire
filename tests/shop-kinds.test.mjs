// SPEC §14.2, §14.6 step 4 — the shop-kind framework.
//
// docs/FINISH.md §14 "Shop kinds and the guaranteed minimum" is this file's
// acceptance line. Each clause of it is a test below, named after the clause;
// the tests after them hold the rest of §14.2 that step 4 builds (the stream,
// the kind roll, the percent domains, the schema bump).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { NOTE } from '../src/content/balance.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigRows, advancedConfigSnapshot, configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRng, STREAM_NAMES } from '../src/engine/rng.js';
import { buildShopStock } from '../src/engine/encounters.js';
import { smithServicesAt } from '../src/model/cardExtraction.js';
import { createRunState, RUN_SCHEMA_VERSION, migrateRunSchema, validateRunShape } from '../src/model/state.js';
import { validateContent } from '../src/model/validate.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import {
  SHOP_KINDS, SHOP_KIND_SCREENS, LEGACY_MARKET_OFFERINGS, MARKET_SHELVES,
  shopConfigRows, shopSettingsProblems, shopStockKind, shopStockOfferings, bringShopStockForward,
} from '../src/model/shopKinds.js';
import { rollShopKind, rollShopOfferings, buildMarketStock, buildMerchantStock } from '../src/engine/shopKinds.js';
import { t } from '../src/ui/strings.js';
import { shopCategories } from '../src/ui/models/ShopWorkspaceModel.js';

const REG = createRegistries(contentBundle);
const PREFIX = 'gameConfig.shops.';
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const rowsByKey = () => new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
const configured = (settings) => configuredContentBundle(contentBundle, settings);
const registriesWith = (settings) => createRegistries(configured(settings));
const offeringsOf = (kind) => shippedShops[kind].offerings;

// Every chance of every kind set to 0, through the Settings rows.
const allChancesZero = () => Object.fromEntries(SHOP_KINDS.flatMap((kind) => offeringsOf(kind)
  .map((row) => [`${PREFIX}${kind}.${row.id}.chance`, 0])));

// A copy of the shipped table that keeps each [NOTE] (structuredClone drops a Symbol key).
function cloneWithNotes(value) {
  if (Array.isArray(value)) return value.map(cloneWithNotes);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) out[key] = cloneWithNotes(child);
  if (value[NOTE]) out[NOTE] = { ...value[NOTE] };
  return out;
}
const bundleWithShops = (edit) => {
  const table = cloneWithNotes(shippedShops);
  edit(table);
  return { ...contentBundle, shops: table };
};
const errorsAt = (bundle, prefix) => validateContent(bundle).errors.filter((error) => error.path.startsWith(prefix));

// ---------------------------------------------------------------------------
// The FINISH §14 clauses
// ---------------------------------------------------------------------------

test('FINISH: every kind rolls at least guaranteedMinimum offerings over 200 seeds with every chance 0 (chance-0 offerings fill the guarantee)', () => {
  const registries = registriesWith(allChancesZero());
  for (const kind of SHOP_KINDS) {
    const def = registries.shops[kind];
    assert.ok(def.guaranteedMinimum >= 2, `${kind} guarantees at least 2`);
    for (const seed of SEEDS) {
      const rng = createRng(seed);
      const ids = rollShopOfferings(def, rng);
      assert.ok(ids.length >= def.guaranteedMinimum, `${kind} seed ${seed}: ${ids.length} < ${def.guaranteedMinimum}`);
      // Chance 0 never comes up by the roll, so exactly the guarantee is laid out,
      // and neither 0 nor the guarantee draws a value.
      assert.equal(ids.length, def.guaranteedMinimum, `${kind} seed ${seed}`);
      assert.equal(rng.getCounters().shopOffers, 0, 'chance 0 rolls nothing');
    }
  }
  // A real market visit under those settings still opens with the guarantee's shelves.
  const run = createRunState({ seed: 11, classId: 'reaver', registries });
  const stock = buildMarketStock(registries, createRng(11), run);
  assert.equal(stock.kind, 'market');
  assert.equal(stock.offerings.length, registries.shops.market.guaranteedMinimum);
});

test('FINISH: a guaranteedMinimum of 1 is refused by name, in content and in Settings', () => {
  for (const kind of SHOP_KINDS) {
    const errors = errorsAt(bundleWithShops((table) => { table[kind].guaranteedMinimum = 1; }), `shops.${kind}.guaranteedMinimum`);
    assert.equal(errors.length, 1, `${kind}: one refusal`);
    assert.match(errors[0].msg, /at least 2/);
  }
  const key = `${PREFIX}market.guaranteedMinimum`;
  const row = rowsByKey().get(key);
  assert.ok(row, 'the minimum has a Settings row');
  assert.equal(row.min, 2, 'the row itself will not take 1');
  const problems = shopSettingsProblems(contentBundle, { [key]: 1 });
  assert.equal(problems.length, 1);
  assert.deepEqual(problems[0].keys, [key]);
  const sentence = t(problems[0].id, problems[0].tokens);
  assert.match(sentence, /Market/);
  assert.match(sentence, /\b1\b/);
  assert.match(sentence, /\b2\b/);
  assert.deepEqual(shopSettingsProblems(contentBundle, { [key]: 2 }), []);
});

test('FINISH: raising an offering\'s weight in Settings changes which one the guarantee adds', () => {
  const zero = allChancesZero();
  const def = registriesWith(zero).shops.market;
  const before = rollShopOfferings(def, createRng(1));
  // The shipped weights put cards (60) and remove (50) first.
  assert.deepEqual(before, ['cards', 'remove']);
  const light = offeringsOf('market').find((row) => !before.includes(row.id)).id;
  const raised = registriesWith({ ...zero, [`${PREFIX}market.${light}.weight`]: 999 }).shops.market;
  const after = rollShopOfferings(raised, createRng(1));
  assert.ok(after.includes(light), `${light} is added once it is the heaviest`);
  assert.notDeepEqual(after, before);
  // Laid out in written order, whatever order the guarantee added them in.
  const order = offeringsOf('market').map((row) => row.id);
  assert.deepEqual(after, [...after].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
});

test('FINISH: every numeric offering leaf has a generated gameConfig.shops.* row frozen per run', () => {
  const rows = rowsByKey();
  const leaves = [];
  const walk = (value, path) => {
    if (typeof value === 'number') { leaves.push({ path, value }); return; }
    if (value && typeof value === 'object' && !Array.isArray(value)) for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
  };
  for (const kind of SHOP_KINDS) {
    for (const [key, value] of Object.entries(shippedShops[kind])) if (key !== 'offerings') walk(value, [kind, key]);
    for (const row of offeringsOf(kind)) for (const [key, value] of Object.entries(row)) if (key !== 'id') walk(value, [kind, row.id, key]);
  }
  // Prices and stock counts are among them.
  assert.ok(leaves.some(({ path }) => path.join('.') === 'blacksmith.smithStones.price'));
  assert.ok(leaves.some(({ path }) => path.join('.') === 'blacksmith.armaments.stock'));
  for (const { path, value } of leaves) {
    const key = `${PREFIX}${path.join('.')}`;
    const row = rows.get(key);
    assert.ok(row, `${key} has a row`);
    assert.equal(row.def, value, `${key} defaults to the data`);
    assert.equal(row.advancedGroup, 'Shops');
    assert.ok(row.note && row.note.length > 20, `${key} carries its note`);
  }
  for (const kind of SHOP_KINDS) {
    for (const row of offeringsOf(kind)) assert.ok(rows.has(`${PREFIX}${kind}.${row.id}.enabled`), `${kind}.${row.id}.enabled`);
  }

  // FROZEN PER RUN: the run's snapshot is taken from the profile once, and a
  // later change to the profile does not reach the run's bundle.
  const settings = { [`${PREFIX}blacksmith.smithStones.price`]: 55, [`${PREFIX}market.relics.chance`]: 40 };
  const snapshot = advancedConfigSnapshot(settings);
  assert.ok(Object.isFrozen(snapshot));
  settings[`${PREFIX}blacksmith.smithStones.price`] = 999;
  const runShops = createRegistries(configured(snapshot)).shops;
  assert.equal(runShops.blacksmith.offerings.find((row) => row.id === 'smithStones').price, 55);
  assert.equal(runShops.market.offerings.find((row) => row.id === 'relics').chance, 40);
  assert.equal(REG.shops.blacksmith.offerings.find((row) => row.id === 'smithStones').price, 90, 'the authored table is untouched');
});

test('FINISH: a numeric offering leaf without a [NOTE] is refused by name', () => {
  const bundle = bundleWithShops((table) => {
    const stones = table.blacksmith.offerings.find((row) => row.id === 'smithStones');
    delete stones[NOTE].price;
  });
  const errors = errorsAt(bundle, 'shops.blacksmith.smithStones.price');
  assert.equal(errors.length, 1);
  assert.match(errors[0].msg, /\[NOTE\]/);
  // A nested leaf is named by its whole path.
  const nested = bundleWithShops((table) => {
    const respec = table.master.offerings.find((row) => row.id === 'respec');
    delete respec.respec.cost[NOTE].perLevel;
  });
  assert.equal(errorsAt(nested, 'shops.master.respec.respec.cost.perLevel').length, 1);
  // And a new number written with no sentence at all.
  const added = bundleWithShops((table) => { table.market.offerings[0].restockFee = 5; });
  assert.equal(errorsAt(added, 'shops.market.cards.restockFee').length, 1);
  assert.deepEqual(validateContent(contentBundle).errors, [], 'the shipped table is clean');
});

test('FINISH: a disabled offering never appears, and disabling below the minimum is refused by name', () => {
  // Disabled at chance 100: never rolled.
  const off = registriesWith({ [`${PREFIX}market.cards.enabled`]: false });
  for (const seed of SEEDS.slice(0, 50)) assert.ok(!rollShopOfferings(off.shops.market, createRng(seed)).includes('cards'));
  // Disabled while the guarantee is short: never added either, though it is the heaviest.
  const zeroOff = registriesWith({ ...allChancesZero(), [`${PREFIX}market.cards.enabled`]: false });
  for (const seed of SEEDS) {
    const ids = rollShopOfferings(zeroOff.shops.market, createRng(seed));
    assert.ok(!ids.includes('cards'), `seed ${seed}`);
    assert.equal(ids.length, 2);
  }
  // Its shelf is empty on the visit, and the screen has no rail item for it.
  const run = createRunState({ seed: 3, classId: 'reaver', registries: off });
  const stock = buildMarketStock(off, createRng(3), run);
  assert.deepEqual(stock.cards, []);
  assert.ok(!stock.offerings.includes('cards'));
  assert.ok(!shopCategories({ offered: new Set(stock.offerings), services: true }).includes('cards'));

  // Disabling below the minimum: five of six off leaves one, under a minimum of 2.
  const market = offeringsOf('market').map((row) => row.id);
  const disabled = Object.fromEntries(market.slice(1).map((id) => [`${PREFIX}market.${id}.enabled`, false]));
  const problems = shopSettingsProblems(contentBundle, disabled);
  assert.equal(problems.length, 1);
  const sentence = t(problems[0].id, problems[0].tokens);
  assert.match(sentence, /Market/);
  for (const id of market.slice(1)) assert.ok(problems[0].keys.includes(`${PREFIX}market.${id}.enabled`), `${id} is addressed`);
  assert.match(sentence, /\b1\b/);
  assert.match(sentence, /\b2\b/);
  // The same table in content is refused by name.
  const errors = errorsAt(bundleWithShops((table) => { for (const row of table.market.offerings.slice(1)) row.enabled = false; }), 'shops.market');
  assert.equal(errors.length, 1);
  assert.match(errors[0].msg, /relics/);
  assert.match(errors[0].msg, /guaranteedMinimum/);
  // Four off leaves two: allowed.
  const fine = Object.fromEntries(market.slice(2).map((id) => [`${PREFIX}market.${id}.enabled`, false]));
  assert.deepEqual(shopSettingsProblems(contentBundle, fine), []);
});

test('FINISH: a pre-§14 run.shopStock loads as market unchanged', () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const shelves = JSON.parse(readFileSync(new URL('./fixtures/shop-shelves-pre-kinds.json', import.meta.url), 'utf8'));
  const oldStock = shelves.shelves['1'].stock;
  assert.equal('kind' in oldStock, false, 'the captured stock predates the kind');
  const v13 = JSON.parse(corpus.versions['13'].bytes);
  assert.equal(v13.schemaVersion, 13);
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify({ ...v13, shopStock: oldStock }));
  const run = createSaveManager(storage).loadRun(REG);
  assert.ok(run, 'the save loads');
  assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION);
  assert.equal(run.shopStock.kind, 'market');
  assert.deepEqual(run.shopStock.offerings, [...LEGACY_MARKET_OFFERINGS]);
  // Every shelf, every price and the smith roll exactly as saved: nothing rerolled.
  const { kind: _kind, offerings: _offerings, ...shelvesAfter } = run.shopStock;
  assert.deepEqual(shelvesAfter, oldStock);
  // Readers answer the same for a stock that never passed the migration door.
  assert.equal(shopStockKind(oldStock), 'market');
  assert.deepEqual(shopStockOfferings(oldStock), [...LEGACY_MARKET_OFFERINGS]);
  assert.deepEqual(shopStockKind(null), 'market');
  // An atlas shop point's persisted stock comes forward the same way.
  const journeyRun = { journey: { serviceStates: { a: { stock: structuredClone(oldStock) }, b: { used: true } } } };
  bringShopStockForward(journeyRun);
  assert.equal(journeyRun.journey.serviceStates.a.stock.kind, 'market');
  assert.deepEqual(journeyRun.journey.serviceStates.b, { used: true });
});

test('FINISH: a non-zero blacksmith or master weight is refused by name while that kind\'s screen is unregistered', () => {
  assert.deepEqual([...SHOP_KIND_SCREENS], ['market']);
  for (const kind of ['blacksmith', 'master']) {
    const errors = errorsAt(bundleWithShops((table) => { table.kindWeights[kind] = 10; }), `shops.kindWeights.${kind}`);
    assert.equal(errors.length, 1, kind);
    assert.match(errors[0].msg, new RegExp(kind));
    assert.match(errors[0].msg, /screen/);
  }
  assert.deepEqual(errorsAt(bundleWithShops((table) => { table.kindWeights.market = 5; }), 'shops.kindWeights'), []);
  // Settings shows a weight row only for a kind whose screen has shipped.
  const rows = rowsByKey();
  assert.ok(rows.has(`${PREFIX}kindWeights.market`));
  assert.ok(!rows.has(`${PREFIX}kindWeights.blacksmith`));
  assert.ok(!rows.has(`${PREFIX}kindWeights.master`));
  // The sole open kind cannot be weighted to 0: its row starts at 1, and a
  // stored 0 (an old profile, an import) is refused by name (Codex, on #1371).
  assert.equal(rows.get(`${PREFIX}kindWeights.market`).min, 1);
  const zeroKind = shopSettingsProblems(contentBundle, { [`${PREFIX}kindWeights.market`]: 0 });
  assert.equal(zeroKind.length, 1);
  assert.deepEqual(zeroKind[0].keys, [`${PREFIX}kindWeights.market`]);
  assert.match(t(zeroKind[0].id, zeroKind[0].tokens), /Market/);
  assert.equal(errorsAt(configured({ [`${PREFIX}kindWeights.market`]: 0 }), 'shops.kindWeights').length, 1, 'the bundle it would build is refused too');
  assert.deepEqual(shopSettingsProblems(contentBundle, { [`${PREFIX}kindWeights.market`]: 3 }), []);
  // A stored weight for a locked kind has no row, so it never reaches a run.
  const locked = createRegistries(configured({ [`${PREFIX}kindWeights.blacksmith`]: 50 }));
  assert.equal(locked.shops.kindWeights.blacksmith, 0);
});

test('FINISH: the classic merchant\'s existing shelves are byte-identical on 50 fixed seeds', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/shop-shelves-pre-kinds.json', import.meta.url), 'utf8'));
  const seeds = Object.keys(fixture.shelves);
  assert.equal(seeds.length, 50);
  for (const n of seeds) {
    const before = fixture.shelves[n];
    const run = createRunState({ seed: before.runSeed, classId: before.classId, registries: REG });
    const rng = createRng(before.runSeed, { shop: before.shopCounterAtEntry });
    // main.js's merchant case, in its order: the stock, then the smith's roll.
    const stock = buildMerchantStock(REG, rng, run);
    stock.smith = smithServicesAt(REG, 'merchant', rng);
    const { kind, offerings, ...shelvesNow } = stock;
    assert.equal(kind, 'market');
    assert.deepEqual(offerings, offeringsOf('market').map((row) => row.id));
    assert.equal(JSON.stringify(shelvesNow), JSON.stringify(before.stock), `seed ${n}: the shelves, byte for byte`);
    // Nothing new is drawn on any existing stream, and the shipped defaults
    // draw nothing on the new one either.
    const { shopOffers, ...counters } = rng.getCounters();
    assert.deepEqual(counters, before.counters, `seed ${n}: every existing stream`);
    assert.equal(shopOffers, 0, `seed ${n}: shopOffers untouched by the shipped defaults`);
  }
});

// ---------------------------------------------------------------------------
// The rest of §14.2 that step 4 builds
// ---------------------------------------------------------------------------

test('shopOffers is appended to the END of STREAM_NAMES, so no existing stream moves', () => {
  assert.equal(STREAM_NAMES.at(-1), 'shopOffers');
  assert.equal(STREAM_NAMES.at(-2), 'rewardRolls');
  assert.equal(STREAM_NAMES.indexOf('shop'), 9);
  // A save written before the stream existed restores it at 0.
  assert.equal(createRng(7, { shop: 3 }).getCounters().shopOffers, 0);
});

test('a chance between 0 and 100 rolls once per enabled offering, in written order, on shopOffers only', () => {
  const registries = registriesWith({ [`${PREFIX}market.relics.chance`]: 50, [`${PREFIX}market.flasks.chance`]: 50 });
  let withRelics = 0;
  for (const seed of SEEDS) {
    const rng = createRng(seed);
    const ids = rollShopOfferings(registries.shops.market, rng);
    const { shopOffers, ...rest } = rng.getCounters();
    assert.equal(shopOffers, 2, 'one draw for each offering whose chance is between 0 and 100');
    assert.ok(Object.values(rest).every((count) => count === 0), 'no other stream is drawn');
    if (ids.includes('relics')) withRelics += 1;
  }
  assert.ok(withRelics > 60 && withRelics < 140, `a 50% offering came up ${withRelics}/200 times`);
});

test('a merchant rolls its kind from kindWeights on shopOffers, and only when more than one kind can come up', () => {
  const rng = createRng(5);
  assert.equal(rollShopKind(REG.shops, rng), 'market');
  assert.equal(rng.getCounters().shopOffers, 0, 'one rollable kind draws nothing');
  const mixed = { ...REG.shops, kindWeights: { market: 50, blacksmith: 50, master: 0 } };
  const seen = new Set();
  for (const seed of SEEDS) {
    const r = createRng(seed);
    seen.add(rollShopKind(mixed, r));
    assert.equal(r.getCounters().shopOffers, 1);
  }
  assert.deepEqual([...seen].sort(), ['blacksmith', 'market']);
  // A kind with no screen cannot open: the merchant refuses it by name rather
  // than laying out a market under the wrong sign.
  const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
  const forced = { ...REG, shops: { ...REG.shops, kindWeights: { market: 0, blacksmith: 1, master: 0 } } };
  assert.throws(() => buildMerchantStock(forced, createRng(5), run), /blacksmith/);
});

test('the market keeps rolling every shelf on the shop stream, so a shelf left off moves no other shelf', () => {
  const off = registriesWith({ [`${PREFIX}market.cards.chance`]: 0, [`${PREFIX}market.cards.weight`]: 0 });
  for (const seed of [1, 2, 3]) {
    const run = createRunState({ seed, classId: 'reaver', registries: REG });
    const plain = buildShopStock(REG, createRng(seed), run);
    const stock = buildMarketStock(off, createRng(seed), run);
    assert.deepEqual(stock.cards, []);
    for (const shelf of MARKET_SHELVES.filter((key) => key !== 'cards')) assert.deepEqual(stock[shelf], plain[shelf], `${shelf} on seed ${seed}`);
    assert.ok(!stock.offerings.includes('cards'));
  }
});

test('every new percentage has a 0–100 domain, and the refund percent its 50–75 clamp', () => {
  const rows = [...rowsByKey().values()].filter((row) => row.key.startsWith(PREFIX));
  const chances = rows.filter((row) => row.key.endsWith('.chance'));
  assert.equal(chances.length, SHOP_KINDS.reduce((sum, kind) => sum + offeringsOf(kind).length, 0));
  for (const row of chances) assert.deepEqual([row.min, row.max, row.integer], [0, 100, true], row.key);
  const refund = rows.find((row) => row.key === `${PREFIX}master.respecRefundPct`);
  assert.deepEqual([refund.min, refund.max], [50, 75]);
  // Every Shops row is one shopConfigRows generated from the data.
  assert.deepEqual(rows.map((row) => row.key).sort(), shopConfigRows(contentBundle).map((row) => row.key).sort());
});

test('Settings files every Shops row under its kind, with its label from uiStrings', () => {
  const rows = shopConfigRows(contentBundle);
  for (const row of rows) {
    assert.ok(row.shopLabel && row.shopLabel.id, `${row.key} names its label row`);
    const label = t(row.shopLabel.id, row.shopLabel.tokens);
    assert.ok(label.length > 3 && !label.includes('{'), `${row.key}: ${label}`);
  }
  assert.ok(t('settings.shops.group.label').length > 0);
});

test('stock.kind rides schema 14: the bump, the RUN_SHAPE row and the captured corpus entry', () => {
  assert.equal(RUN_SCHEMA_VERSION, 14);
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  assert.equal(JSON.parse(corpus.versions['14'].bytes).schemaVersion, 14);
  const run = createRunState({ seed: 9, classId: 'reaver', registries: REG });
  run.shopStock = buildMerchantStock(REG, createRng(9), run);
  assert.deepEqual(validateRunShape(run), []);
  const bad = { ...structuredClone(run), shopStock: { ...structuredClone(run.shopStock), kind: 7 } };
  assert.ok(validateRunShape(bad).some((problem) => /shopStock\.kind/.test(problem)));
  // A current save round-trips its stock untouched.
  const back = migrateRunSchema(JSON.parse(JSON.stringify(run)));
  assert.deepEqual(back.shopStock, JSON.parse(JSON.stringify(run.shopStock)));
});
