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
import { advancedConfigRows, advancedConfigSnapshot, configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile, advancedConfigProblems } from '../src/model/advancedConfig.js';
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
import { MARKET_ADDITIONS } from '../src/model/marketStock.js';
import { t } from '../src/ui/strings.js';
import { shopCategories } from '../src/ui/models/ShopWorkspaceModel.js';
import { localServiceModel } from '../src/ui/models/LocalServiceModel.js';
import { shopStockProblems } from '../src/model/shopKinds.js';

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
  // Disabled at chance 100: never rolled. (Relics, since cards and flasks are
  // the two offerings the shipped minimum of 2 needs on: SPEC §14.2.)
  const off = registriesWith({ [`${PREFIX}market.relics.enabled`]: false });
  assert.equal(off.shops.market.offerings.find((row) => row.id === 'relics').enabled, false, 'the setting applied');
  for (const seed of SEEDS.slice(0, 50)) assert.ok(!rollShopOfferings(off.shops.market, createRng(seed)).includes('relics'));
  // Disabled while the guarantee is short: never added either, though it is the heaviest.
  const zeroOff = registriesWith({ ...allChancesZero(), [`${PREFIX}market.relics.weight`]: 1000, [`${PREFIX}market.relics.enabled`]: false });
  for (const seed of SEEDS) {
    const ids = rollShopOfferings(zeroOff.shops.market, createRng(seed));
    assert.ok(!ids.includes('relics'), `seed ${seed}`);
    assert.equal(ids.length, 2);
  }
  // Its shelf is empty on the visit, and the screen has no rail item for it.
  const run = createRunState({ seed: 3, classId: 'reaver', registries: off });
  const stock = buildMarketStock(off, createRng(3), run);
  assert.deepEqual(stock.relics, []);
  assert.ok(!stock.offerings.includes('relics'));
  assert.ok(!shopCategories({ offered: new Set(stock.offerings), services: true }).includes('relics'));

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
  // All but two off, both of them offerings that can never come up empty
  // (not `conditional`, SPEC §14.2): allowed.
  const keep = ['cards', 'flasks'];
  const fine = Object.fromEntries(market.filter((id) => !keep.includes(id)).map((id) => [`${PREFIX}market.${id}.enabled`, false]));
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

// Step 6 (SPEC §14.4) registered the blacksmith and step 7 (§14.5) the
// master: every kind's weight is now a row and may be raised.
test('FINISH: every kind\'s screen is registered, so the blacksmith and master weights are Settings rows that may be raised, and every open kind at 0 is refused by name', () => {
  assert.deepEqual([...SHOP_KIND_SCREENS], ['market', 'blacksmith', 'master']);
  for (const kind of ['blacksmith', 'master']) {
    assert.deepEqual(errorsAt(bundleWithShops((table) => { table.kindWeights[kind] = 10; }), `shops.kindWeights.${kind}`), [], `the ${kind} is registered now`);
  }
  assert.deepEqual(errorsAt(bundleWithShops((table) => { table.kindWeights.market = 5; }), 'shops.kindWeights'), []);
  // Settings shows a weight row only for a kind whose screen has shipped.
  const rows = rowsByKey();
  assert.ok(rows.has(`${PREFIX}kindWeights.market`));
  assert.ok(rows.has(`${PREFIX}kindWeights.blacksmith`));
  assert.ok(rows.has(`${PREFIX}kindWeights.master`));
  // With two open kinds either row may be 0, but not both: every open kind at
  // 0 (an old profile, an import) is refused by name (Codex, on #1371).
  assert.equal(rows.get(`${PREFIX}kindWeights.market`).min, 0);
  const zeroKind = shopSettingsProblems(contentBundle, { [`${PREFIX}kindWeights.market`]: 0 });
  assert.equal(zeroKind.length, 1);
  assert.deepEqual(zeroKind[0].keys, [`${PREFIX}kindWeights.market`, `${PREFIX}kindWeights.blacksmith`, `${PREFIX}kindWeights.master`]);
  assert.match(t(zeroKind[0].id, zeroKind[0].tokens), /Market/);
  assert.deepEqual(shopSettingsProblems(contentBundle, { [`${PREFIX}kindWeights.market`]: 0, [`${PREFIX}kindWeights.blacksmith`]: 5 }), [], 'a blacksmith-only merchant is allowed');
  // The stored 0 is set aside, so the run's bundle keeps the authored weight and validates.
  assert.equal(configured({ [`${PREFIX}kindWeights.market`]: 0 }).shops.kindWeights.market, 100);
  assert.equal(errorsAt(bundleWithShops((table) => { table.kindWeights.market = 0; }), 'shops.kindWeights').length, 1, 'the same table in content is refused');
  assert.deepEqual(shopSettingsProblems(contentBundle, { [`${PREFIX}kindWeights.market`]: 3 }), []);
  // A stored master weight now reaches the run, through its row.
  const opened = createRegistries(configured({ [`${PREFIX}kindWeights.master`]: 50 }));
  assert.equal(opened.shops.kindWeights.master, 50);
});

test('FINISH: the classic merchant\'s existing shelves are byte-identical on 50 fixed seeds', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/shop-shelves-pre-kinds.json', import.meta.url), 'utf8'));
  const seeds = Object.keys(fixture.shelves);
  assert.equal(seeds.length, 50);
  // The fixture holds the card pools of its capture. Cards authored since
  // (skill-draft depth) join the reward pools and so the card shelf; replaying
  // at the capture's pools keeps this a test of the shop code, not the content.
  const addedSinceCapture = new Set(['hewingArc', 'sunderingChop', 'setTheShield', 'aegisOfEmbers', 'shieldCrash',
    'pinningShot', 'arrowVolley', 'nockAndWait', 'aimedShot', 'barbedArrow', 'bindingParry', 'whirlingGuard',
    'cinderSigil', 'ashenMote', 'emberVigil', 'readTheAsh', 'pyreOfCharts', 'ashCircle', 'kindledOmen', 'cinderLance',
    'ashfallRite', 'phoenixChart', 'pyreLight', 'riteOfCinders']);
  const CAPTURE_REG = createRegistries({ ...contentBundle,
    classes: contentBundle.classes.map((c) => ({ ...c, cardPool: c.cardPool.filter((id) => !addedSinceCapture.has(id)) })) });
  for (const n of seeds) {
    const before = fixture.shelves[n];
    const run = createRunState({ seed: before.runSeed, classId: before.classId, registries: CAPTURE_REG });
    const rng = createRng(before.runSeed, { shop: before.shopCounterAtEntry });
    // main.js's merchant case, in its order: the stock, then the smith's roll.
    const stock = buildMerchantStock(CAPTURE_REG, rng, run);
    stock.smith = smithServicesAt(CAPTURE_REG, 'merchant', rng);
    const { kind, offerings } = stock;
    assert.equal(kind, 'market');
    // Every shelf that existed before shop kinds is out on every visit. The
    // market additions of §14.3 (step 5) may join them by their own chances.
    assert.deepEqual(offerings.filter((id) => LEGACY_MARKET_OFFERINGS.includes(id)), [...LEGACY_MARKET_OFFERINGS]);
    for (const id of offerings) assert.ok(LEGACY_MARKET_OFFERINGS.includes(id) || MARKET_ADDITIONS.includes(id), `seed ${n}: ${id}`);
    // The captured shelves, byte for byte, in their captured key order; any
    // other key is an addition's own stock.
    const shelvesNow = Object.fromEntries(Object.keys(before.stock).map((key) => [key, stock[key]]));
    assert.equal(JSON.stringify(shelvesNow), JSON.stringify(before.stock), `seed ${n}: the shelves, byte for byte`);
    for (const key of Object.keys(stock)) assert.ok(key in before.stock || key === 'kind' || key === 'offerings' || MARKET_ADDITIONS.includes(key), `seed ${n}: stray stock key ${key}`);
    // Nothing new is drawn on any existing stream. Only the additions' own
    // rolls (§14.3, on shopOffers after the offering roll) draw on the new one.
    // `sigils` (SPEC §15.4) was appended after the fixture; a shop draws nothing there.
    const { shopOffers: _offers, sigils: _sigils, ...counters } = rng.getCounters();
    assert.equal(_sigils, 0);
    assert.deepEqual(counters, before.counters, `seed ${n}: every existing stream`);
  }
});

// ---------------------------------------------------------------------------
// The rest of §14.2 that step 4 builds
// ---------------------------------------------------------------------------

test('shopOffers is appended to the END of STREAM_NAMES, so no existing stream moves', () => {
  // §15.4's `sigils` was appended after it later (tests/legendary-sigils.test.mjs).
  assert.equal(STREAM_NAMES.at(-2), 'shopOffers');
  assert.equal(STREAM_NAMES.at(-3), 'rewardRolls');
  assert.equal(STREAM_NAMES.indexOf('shop'), 9);
  // A save written before the stream existed restores it at 0.
  assert.equal(createRng(7, { shop: 3 }).getCounters().shopOffers, 0);
});

test('a chance between 0 and 100 rolls once per enabled offering, in written order, on shopOffers only', () => {
  const registries = registriesWith({ [`${PREFIX}market.relics.chance`]: 50, [`${PREFIX}market.flasks.chance`]: 50 });
  // The two set to 50 here, plus every shipped offering whose own chance is
  // between 0 and 100 (the §14.3 additions).
  const between = registries.shops.market.offerings.filter((row) => row.enabled && row.chance > 0 && row.chance < 100).length;
  assert.ok(between >= 2);
  let withRelics = 0;
  for (const seed of SEEDS) {
    const rng = createRng(seed);
    const ids = rollShopOfferings(registries.shops.market, rng);
    const { shopOffers, ...rest } = rng.getCounters();
    assert.equal(shopOffers, between, 'one draw for each offering whose chance is between 0 and 100');
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
  // Each kind opens its own visit, never a market under the wrong sign: the
  // blacksmith (step 6) and the master (step 7) are both registered.
  const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
  const forced = { ...REG, shops: { ...REG.shops, kindWeights: { market: 0, blacksmith: 0, master: 1 } } };
  assert.equal(buildMerchantStock(forced, createRng(5), run).kind, 'master');
  const smithy = { ...REG, shops: { ...REG.shops, kindWeights: { market: 0, blacksmith: 1, master: 0 } } };
  assert.equal(buildMerchantStock(smithy, createRng(5), run).kind, 'blacksmith');
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
  // 14 added the kind; later bumps (15, the sigil inventory) keep it.
  assert.ok(RUN_SCHEMA_VERSION >= 14);
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

test('a configuration import that leaves a kind below its minimum is refused whole, by name (Codex, on #1371)', () => {
  const market = offeringsOf('market').map((row) => row.id);
  const disabled = Object.fromEntries(market.slice(1).map((id) => [`${PREFIX}market.${id}.enabled`, false]));
  // The model-level list every door reads carries the same sentence Settings shows.
  const problems = advancedConfigProblems(contentBundle, disabled);
  assert.ok(problems.some((line) => /Market/.test(line) && /guaranteed minimum of 2/.test(line)), problems.join(' | '));
  const file = advancedConfigExport(disabled);
  assert.throws(() => parseAdvancedConfigFile(file, contentBundle, {}), /Nothing was imported\. Market: /);
  // All but two unconditional offerings off (cards and flasks left) imports.
  const keep = ['cards', 'flasks'];
  const fine = Object.fromEntries(market.filter((id) => !keep.includes(id)).map((id) => [`${PREFIX}market.${id}.enabled`, false]));
  const changes = parseAdvancedConfigFile(advancedConfigExport(fine), contentBundle, {});
  assert.equal(changes[`${PREFIX}market.flasks.enabled`], undefined);
  assert.equal(changes[`${PREFIX}market.relics.enabled`], false);
});

test('a saved stock naming an offering its kind has not got is refused by name (Codex, on #1371)', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries: REG });
  run.shopStock = buildMerchantStock(REG, createRng(4), run);
  assert.deepEqual(validateRunShape(run), []);
  const bogus = { ...structuredClone(run), shopStock: { ...structuredClone(run.shopStock), offerings: ['bogus'] } };
  assert.ok(validateRunShape(bogus).some((problem) => /shopStock\.offerings names 'bogus'/.test(problem)));
  const empty = { ...structuredClone(run), shopStock: { ...structuredClone(run.shopStock), offerings: [] } };
  // An empty list is refused while any shelf still holds stock (review of
  // #1377): the load door's prune empties the list only with its last shelf
  // (5a re-review, follow-up 2), so stock with no offerings is a tampered save.
  assert.ok(validateRunShape(empty).some((problem) => /shopStock\.offerings is empty/.test(problem)));
  const emptied = { ...structuredClone(run), shopStock: { kind: 'market', offerings: [], cards: [], relics: [], flasks: [], armaments: [], weaponArts: [], removeCost: 75 } };
  assert.deepEqual(validateRunShape(emptied), [], 'with nothing on any shelf, an empty list is the prune\'s honest result');
  const notIds = { ...structuredClone(run), shopStock: { ...structuredClone(run.shopStock), offerings: [3] } };
  assert.ok(validateRunShape(notIds).some((problem) => /shopStock\.offerings must be a list of offering ids/.test(problem)));
  // Through the real load door: archived and refused, never opened.
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify({ ...JSON.parse(JSON.stringify(run)), schemaVersion: RUN_SCHEMA_VERSION, shopStock: bogus.shopStock }));
  assert.equal(createSaveManager(storage).loadRun(REG), null);
});

test('one bad shop kind costs that kind, not every Advanced setting (review, #1371)', () => {
  const market = offeringsOf('market').map((row) => row.id);
  const settings = {
    'gameConfig.balance.shop.removeBase': 99,
    [`${PREFIX}blacksmith.smithStones.price`]: 55,
    ...Object.fromEntries(market.slice(1).map((id) => [`${PREFIX}market.${id}.enabled`, false])),
  };
  const bundle = configured(settings);
  assert.deepEqual(validateContent(bundle).errors, [], 'the configured bundle still validates, so rebuildRegistries keeps it');
  assert.equal(bundle.balance.shop.removeBase, 99, 'the unrelated setting survives');
  assert.equal(bundle.shops.blacksmith.offerings.find((row) => row.id === 'smithStones').price, 55, 'another kind\'s setting survives');
  assert.ok(bundle.shops.market.offerings.every((row) => row.enabled), 'the broken kind keeps its authored offerings');
  // The same holds for the merchant-kind weights and a minimum below 2.
  const weights = configured({ 'gameConfig.balance.shop.removeBase': 99, [`${PREFIX}kindWeights.market`]: 0 });
  assert.deepEqual(validateContent(weights).errors, []);
  assert.equal(weights.shops.kindWeights.market, 100);
  assert.equal(weights.balance.shop.removeBase, 99);
  const minimum = configured({ [`${PREFIX}master.guaranteedMinimum`]: 1, [`${PREFIX}market.relics.chance`]: 30 });
  assert.equal(minimum.shops.master.guaranteedMinimum, 2);
  assert.equal(minimum.shops.market.offerings.find((row) => row.id === 'relics').chance, 30);
});

test('the atlas shop inspection promises Remove only when the visit offered it (review, #1371)', () => {
  const run = createRunState({ seed: 6, classId: 'reaver', registries: REG });
  const withRemove = buildMarketStock(REG, createRng(6), run);
  const offered = localServiceModel({ handlerId: 'shop', registries: REG, run, state: { stock: withRemove } });
  assert.match(offered.benefit, /remove a card/);
  assert.ok(offered.facts.some((fact) => /^Remove a card: \d+ cinders/.test(fact)));
  const noRemove = registriesWith({ [`${PREFIX}market.remove.enabled`]: false });
  const without = buildMarketStock(noRemove, createRng(6), run);
  assert.ok(!without.offerings.includes('remove'));
  const hidden = localServiceModel({ handlerId: 'shop', registries: noRemove, run, state: { stock: without } });
  assert.doesNotMatch(hidden.benefit, /remove/i);
  // Once rolled, the benefit names only the shelves the visit laid out (Codex, on #1371).
  assert.match(offered.benefit, /^Spend cinders on this visit’s cards, relics, flasks, armaments, weapon arts\./);
  // (Cards and flasks are the offerings the minimum counts, so two others go.)
  const noCards = registriesWith({ [`${PREFIX}market.relics.enabled`]: false, [`${PREFIX}market.weaponArts.enabled`]: false });
  const fewer = localServiceModel({ handlerId: 'shop', registries: noCards, run, state: { stock: buildMarketStock(noCards, createRng(6), run) } });
  assert.doesNotMatch(fewer.benefit, /relics|weapon arts/);
  assert.match(fewer.benefit, /cards, flasks, armaments\./);
  assert.ok(!hidden.facts.some((fact) => /Remove a card/.test(fact)));
  // Before the first entry nothing is rolled: removal is only a possibility.
  const unrolled = localServiceModel({ handlerId: 'shop', registries: REG, run, state: {} });
  assert.match(unrolled.benefit, /may also offer to remove a card/);
});

test('an atlas point\'s saved stock is shape-checked like run.shopStock, and Shops rows wear their uiStrings names', async () => {
  assert.deepEqual(shopStockProblems({ kind: 'market', offerings: ['cards'] }, 'journey.serviceStates.p.stock'), []);
  assert.ok(shopStockProblems({ kind: 'market', offerings: ['bogus'] }, 'journey.serviceStates.p.stock')
    .some((problem) => problem.startsWith("journey.serviceStates.p.stock.offerings names 'bogus'")));
  const { settingsRows } = await import('../src/ui/screens/settings.js');
  const rows = new Map(settingsRows().filter((row) => row.advancedGroup === 'Shops').map((row) => [row.key, row]));
  assert.equal(rows.get(`${PREFIX}market.weaponArts.chance`).label, 'Market · Weapon arts: chance');
  assert.equal(rows.get(`${PREFIX}master.training.training.xp`).label, 'Wise master · Training: Training xp');
});

test('a schema-14 stock must name its kind and offerings; only an older save gets the market fallback (Codex, on #1371)', () => {
  const run = createRunState({ seed: 8, classId: 'reaver', registries: REG });
  run.shopStock = buildMarketStock(registriesWith({ [`${PREFIX}market.remove.enabled`]: false }), createRng(8), run);
  assert.ok(!run.shopStock.offerings.includes('remove'));
  const { offerings: _gone, ...noOfferings } = run.shopStock;
  const { kind: _kindGone, ...noKind } = run.shopStock;
  assert.ok(validateRunShape({ ...run, shopStock: noOfferings }).some((problem) => /shopStock\.offerings is missing/.test(problem)));
  assert.ok(validateRunShape({ ...run, shopStock: noKind }).some((problem) => /shopStock\.kind is missing/.test(problem)));
  assert.ok(shopStockProblems(noOfferings, 'journey.serviceStates.p.stock', { required: true })
    .some((problem) => problem.startsWith('journey.serviceStates.p.stock.offerings is missing')));
  // Through the load door a current save missing the field is refused, so a
  // Remove the visit never offered cannot come back on reload.
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify({ ...JSON.parse(JSON.stringify(run)), schemaVersion: RUN_SCHEMA_VERSION, shopStock: noOfferings }));
  assert.equal(createSaveManager(storage).loadRun(REG), null);
  // A schema-13 save of the same shape is brought forward instead.
  const older = migrateRunSchema({ ...JSON.parse(JSON.stringify(run)), schemaVersion: 13, shopStock: JSON.parse(JSON.stringify(noOfferings)) });
  assert.deepEqual(older.shopStock.offerings, [...LEGACY_MARKET_OFFERINGS]);
});

// Every kind's screen has shipped since step 7 (SPEC §14.5), so the refusal is
// now met by a kind this build does not have at all.
test('a saved stock of a kind this build does not have is refused by name and archived, never opened (Codex, on #1371)', () => {
  const run = createRunState({ seed: 10, classId: 'reaver', registries: REG });
  run.shopStock = buildMarketStock(REG, createRng(10), run);
  const master = { ...structuredClone(run.shopStock), kind: 'bazaar', offerings: ['training'] };
  assert.ok(validateRunShape({ ...run, shopStock: master }).some((problem) => /shopStock\.kind must be one of market, blacksmith, master, got "bazaar"/.test(problem)));
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify({ ...JSON.parse(JSON.stringify(run)), schemaVersion: RUN_SCHEMA_VERSION, shopStock: master }));
  assert.equal(createSaveManager(storage).loadRun(REG), null, 'archived and refused, never opened onto an empty market');
});

test('a saved stock that is not an object is refused by name, wherever it is kept (Codex, on #1371)', () => {
  for (const bad of [['cards'], 'market']) {
    const problems = shopStockProblems(bad, 'journey.serviceStates.p.stock', { required: true });
    assert.ok(problems.some((problem) => problem.startsWith('journey.serviceStates.p.stock must be an object')), `${JSON.stringify(bad)}: ${problems.join(' | ')}`);
  }
  // Absent or null is simply no stock, as before.
  assert.deepEqual(shopStockProblems(undefined, 'journey.serviceStates.p.stock', { required: true }), []);
  assert.deepEqual(shopStockProblems(null, 'shopStock', { required: true }), []);
  const run = createRunState({ seed: 12, classId: 'reaver', registries: REG });
  assert.ok(validateRunShape({ ...run, shopStock: ['cards'] }).some((problem) => /shopStock must be an object/.test(problem)));
});

test('an offering\'s nested value that is not a number is refused by name (Codex, on #1371)', () => {
  const bundle = bundleWithShops((table) => { table.market.offerings[0].bad = { nested: 'oops' }; });
  const errors = errorsAt(bundle, 'shops.market.cards.bad');
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.equal(errors[0].path, 'shops.market.cards.bad.nested');
  assert.match(errors[0].msg, /must be a number/);
  // A top-level string, and a kind-level nested string, too.
  assert.equal(errorsAt(bundleWithShops((table) => { table.market.offerings[0].label = 'oops'; }), 'shops.market.cards.label').length, 1);
  assert.equal(errorsAt(bundleWithShops((table) => { table.master.refund = { pct: true }; }), 'shops.master.refund.pct').length, 1);
});
