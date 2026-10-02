// SPEC §14.4, §14.6 step 6 — the blacksmith screen, built to the shapes of
// the SPEC-only PR #1378.
//
// docs/FINISH.md §14 "Blacksmith screen" is the acceptance line: refining
// spends exactly `refine.from` stones; a sigil slot is bought, filled and
// emptied, and an installed sigil's trigger fires only while its piece is
// equipped; extracting, installing and upgrading an art each commit once and
// refuse a stale quote; a stacked copy is a new `upgraded: false` instance the
// editor counts as owned, and it can be installed straight from the
// sideboard; a granted card or a Strike cannot be stacked; stock and prices
// survive a reload. The rest here is what the step must also hold: the kind
// registered with its offerings classified truthfully, every number a noted
// Settings row, the sigils moved onto tagging rows, and one schema bump.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { sigils as shippedSigils } from '../src/content/sigils.js';
import { NOTE } from '../src/content/balance.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigRows, configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRng, STREAM_NAMES } from '../src/engine/rng.js';
import { buildBlacksmithStock, buildMarketStock, buildMerchantStock, blacksmithVisitStock } from '../src/engine/shopKinds.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { syncLoadoutProperties } from '../src/engine/properties.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createRunState, RUN_SCHEMA_VERSION, validateRunShape } from '../src/model/state.js';
import { validateContent } from '../src/model/validate.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { SHOP_KIND_SCREENS, shopSettingsProblems, shopSentence, shopStockProblems } from '../src/model/shopKinds.js';
import { smithingPlan, commitItemUpgrade } from '../src/model/smithing.js';
import { extractionPlan } from '../src/model/cardExtraction.js';
import { ownedCopies } from '../src/model/deckRules.js';
import {
  refinePlan, commitRefine,
  sigilSlotsOf, sigilSlotPlan, commitSigilSlot,
  sigilInstallPlan, commitSigilInstall, sigilRemovePlan, commitSigilRemove,
  upgradeArtPlan, commitUpgradeArt,
  stackCopyPlan, commitStackCopy,
  blacksmithExtractPlan, commitBlacksmithExtract,
  blacksmithInstallPlan, commitBlacksmithInstall,
  blacksmithUpgradePlan, commitBlacksmithUpgrade,
  BLACKSMITH_SERVICES, serviceCandidates, stackableCardIds,
} from '../src/model/blacksmith.js';
import { armamentPurchasePlan, commitArmamentPurchase } from '../src/model/armamentTrading.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountBlacksmith } from '../src/ui/screens/blacksmith.js';

const REG = createRegistries(contentBundle);
const PREFIX = 'gameConfig.shops.';
const registriesWith = (settings) => createRegistries(configuredContentBundle(contentBundle, settings));
const OFFERINGS = shippedShops.blacksmith.offerings.map((row) => row.id);
// Every blacksmith offering out, so the tests below reach each service.
const ALL_OUT = Object.fromEntries(OFFERINGS.map((id) => [`${PREFIX}blacksmith.${id}.chance`, 100]));
const OUT = registriesWith(ALL_OUT);
const offeringOf = (registries, id) => registries.shops.blacksmith.offerings.find((row) => row.id === id);
const KATANA = 'armament/katana';
const SWORD = 'armament/straightSword';

function smithRun(registries = OUT, { seed = 21, cinders = 5000, stones = 50 } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries });
  run.cinders = cinders;
  run.smithingStones = stones;
  run.seenEvents = [];
  const rng = createRng(seed);
  run.shopStock = buildBlacksmithStock(registries, rng, run);
  return { run, rng };
}

function reload(run, rng, registries = OUT) {
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(run, rng);
  const back = createSaveManager(storage).loadRun(registries);
  assert.ok(back, 'the save loads');
  return back;
}

function fightFor(run, registries = OUT, seed = 5) {
  const enemyId = registries.enemies.all().find((def) => def.hp && def.hp[1] < 200).id;
  return createRunCombat({ registries, rng: createRng(seed), run, enemyIds: [enemyId] });
}

// A katana carried in Inventory, its Draw Cut extracted into the deck: a loose art.
function withLooseArt(registries = OUT) {
  const made = smithRun(registries);
  made.run.loadout.storage.push('katana');
  const item = extractionPlan(registries, made.run).candidates.find((row) => row.itemRef === KATANA);
  const mount = item.mounts.find((row) => row.cardId === 'katanaDrawCut');
  const quote = blacksmithExtractPlan(registries, made.run, KATANA, mount.mountKey);
  assert.equal(quote.ok, true, quote.reason);
  const receipt = commitBlacksmithExtract(registries, made.run, quote);
  return { ...made, mount, receipt, art: made.run.deck.find((card) => card.instanceId === receipt.instanceId) };
}

// ---------------------------------------------------------------------------
// The kind, its offerings and their numbers
// ---------------------------------------------------------------------------

test('the blacksmith screen is registered; its weight ships 0 with only a Settings row; the shipped content validates', () => {
  assert.ok(SHOP_KIND_SCREENS.includes('blacksmith'), 'blacksmith is a registered screen');
  assert.equal(shippedShops.kindWeights.blacksmith, 0, 'the owner raises the weight, not this step');
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  const weight = rows.get(`${PREFIX}kindWeights.blacksmith`);
  assert.ok(weight, 'the blacksmith weight has its Settings row');
  assert.equal(weight.def, 0);
  assert.equal(validateContent(contentBundle).errors.length, 0, JSON.stringify(validateContent(contentBundle).errors.slice(0, 5)));
  // A raised weight is accepted now that the screen is registered.
  const raised = { ...contentBundle, shops: { ...shippedShops, kindWeights: { ...shippedShops.kindWeights, blacksmith: 50 } } };
  assert.deepEqual(validateContent(raised).errors.filter((e) => /kindWeights/.test(e.path)), []);
});

test('each blacksmith offering is classified truthfully, and the non-conditional minimum binds the kind', () => {
  const byId = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [row.id, row]));
  assert.equal(byId.refineStones.conditional, false, 'refining is a service that always has something to do');
  assert.equal(byId.smithStones.conditional, false, 'the stone shelf always has stock while perVisit is at least 1');
  assert.equal(byId.smithStones.stockKey, 'shops.blacksmith.smithStones.perVisit', 'its stock key names its own number');
  for (const id of OFFERINGS.filter((id) => !['refineStones', 'smithStones'].includes(id))) {
    assert.equal(byId[id].conditional, true, `${id} can have nothing to act on`);
    assert.equal(typeof byId[id][NOTE].conditional, 'string', `${id} says why`);
  }
  // Disabling one of the two non-conditional offerings leaves one: refused by name.
  const off = shopSettingsProblems(contentBundle, { [`${PREFIX}blacksmith.refineStones.enabled`]: false });
  assert.ok(off.some((p) => p.kind === 'blacksmith' && p.id === 'settings.shops.refuse.conditional'), JSON.stringify(off));
  // A stone stock of 0 lays out nothing, so smithStones stops counting: refused by name.
  const empty = shopSettingsProblems(contentBundle, { [`${PREFIX}blacksmith.smithStones.perVisit`]: 0 });
  assert.ok(empty.some((p) => p.kind === 'blacksmith' && p.id === 'settings.shops.refuse.emptyStock'), JSON.stringify(empty));
  // And validateContent refuses a table that keeps too few.
  const table = structuredClone(shippedShops);
  table.blacksmith.offerings.find((row) => row.id === 'refineStones').enabled = false;
  const errors = validateContent({ ...contentBundle, shops: table }).errors;
  assert.ok(errors.some((e) => e.path === 'shops.blacksmith' && /can never come up empty/.test(e.msg)), JSON.stringify(errors));
});

test('every blacksmith number is a noted Settings row with its floor; a bad one is refused by name', () => {
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  const floors = {
    'armaments.stock': 0, 'smithStones.price': 1, 'smithStones.perVisit': 0,
    'refineStones.refine.from': 1, 'refineStones.refine.value': 1, 'refineStones.refine.cinders': 1,
    'sigilSlots.sigilSlots.base': 0, 'sigilSlots.sigilSlots.max': 0, 'sigilSlots.sigilSlots.cinders': 1,
    'upgradeArt.stones': 1, 'stackCopy.stack.stones': 1, 'stackCopy.stack.cinders': 1, 'stackCopy.stack.stepPerOwned': 0,
  };
  for (const [path, floor] of Object.entries(floors)) {
    const row = rows.get(`${PREFIX}blacksmith.${path}`);
    assert.ok(row, `${path} has a row`);
    assert.equal(row.integer, true, `${path} is whole`);
    assert.equal(row.min, floor, `${path} starts at ${floor}`);
    assert.ok(row.note.length > 20, `${path} carries its sentence`);
  }
  const bad = (mutate) => {
    const table = structuredClone(shippedShops);
    mutate(table.blacksmith.offerings);
    return validateContent({ ...contentBundle, shops: table }).errors.map((e) => `${e.path} ${e.msg}`);
  };
  const find = (list, id) => list.find((row) => row.id === id);
  assert.ok(bad((o) => { find(o, 'refineStones').refine.value = 0; }).some((m) => /blacksmith\.refineStones\.refine\.value/.test(m)));
  assert.ok(bad((o) => { find(o, 'refineStones').refine.from = 1.5; }).some((m) => /blacksmith\.refineStones\.refine\.from/.test(m)));
  assert.ok(bad((o) => { find(o, 'upgradeArt').stones = 0; }).some((m) => /blacksmith\.upgradeArt\.stones/.test(m)));
  assert.ok(bad((o) => { find(o, 'sigilSlots').sigilSlots.base = 4; }).some((m) => /blacksmith\.sigilSlots/.test(m) && /max/.test(m)));
  const settings = shopSettingsProblems(contentBundle, { [`${PREFIX}blacksmith.sigilSlots.sigilSlots.base`]: 5 });
  assert.ok(settings.some((p) => p.kind === 'blacksmith' && /base/i.test(p.message)), JSON.stringify(settings));
});

test('the sigils moved to tagging rows: no inline triggers, one property leaf each under the sigil branch, one kind row each', () => {
  for (const def of shippedSigils) {
    assert.equal(def.triggers, undefined, `${def.id} writes no triggers`);
    assert.equal(def.modifiers, undefined, `${def.id} writes no modifiers`);
    const stamped = REG.sigils.get(def.id);
    assert.equal(stamped.propertyTags.length, 1, `${def.id} derives one property tag`);
    assert.ok(REG.propertyRules.has(stamped.propertyTags[0]), `${def.id}'s tag has a rule`);
    const kinds = contentBundle.tagging.filter((row) => row.family === 'sigil' && row.objectId === def.id && row.tagId === 'classification.sigil');
    assert.equal(kinds.length, 1, `${def.id} states its kind once`);
  }
  const inline = shippedSigils.map((def, i) => (i === 0 ? { ...def, triggers: [{ on: 'combatStart', do: [] }] } : def));
  assert.ok(validateContent({ ...contentBundle, sigils: inline }).errors.some((e) => e.path.startsWith(`sigils.${shippedSigils[0].id}`) && /triggers/.test(e.path + e.msg)));
  const untagged = [...shippedSigils, { id: 'plainSigil', name: 'Plain', rarity: 'common', cost: 100, blurb: 'Nothing.' }];
  assert.ok(validateContent({ ...contentBundle, sigils: untagged }).errors.some((e) => e.path === 'sigils.plainSigil' && /property/.test(e.msg)));
});

// ---------------------------------------------------------------------------
// The stock
// ---------------------------------------------------------------------------

test('a blacksmith visit lays out a blacksmith stock on shopOffers alone, and the market is untouched', () => {
  const { run, rng } = smithRun(OUT);
  const stock = run.shopStock;
  assert.equal(stock.kind, 'blacksmith');
  assert.ok(stock.offerings.length >= shippedShops.blacksmith.guaranteedMinimum);
  assert.ok(stock.offerings.every((id) => OFFERINGS.includes(id)));
  assert.equal(rng.getCounters().shop || 0, 0, 'the blacksmith never draws on `shop`');
  assert.deepEqual(shopStockProblems(stock, 'shopStock', { required: true }), []);
  assert.ok(Array.isArray(stock.armaments) && stock.armaments.length > 0 && stock.armaments.length <= offeringOf(OUT, 'armaments').stock);
  for (const item of stock.armaments) assert.ok(Number.isSafeInteger(item.cost) && item.cost >= 1);
  assert.deepEqual(stock.smithStones, { price: offeringOf(OUT, 'smithStones').price, left: offeringOf(OUT, 'smithStones').perVisit });
  assert.equal('smith' in stock, false, 'no merchant smith add-on rides a blacksmith');
  // No new stream: the blacksmith rolls on shopOffers, already appended.
  assert.equal(STREAM_NAMES.at(-1) === 'shopOffers' || STREAM_NAMES.includes('shopOffers'), true);
  // A market built on the same seed is the same with the blacksmith registered.
  const a = createRunState({ seed: 9, classId: 'reaver', registries: REG });
  const b = structuredClone(a);
  assert.deepEqual(buildMarketStock(REG, createRng(9), a, { meta: {} }), buildMerchantStock(REG, createRng(9), b, { meta: {} }));
});

test('a service with nothing to act on stays laid out once rolled, and the guarantee fills past it with usable offerings', () => {
  // A fresh run holds no loose art, no sigil and no stackable card, so those
  // services roll out (chance 100) with nothing to do.
  for (let seed = 1; seed <= 20; seed++) {
    const { run } = smithRun(OUT, { seed });
    const out = run.shopStock.offerings;
    for (const id of ['sigils', 'installArt', 'upgradeArt', 'stackCopy']) {
      assert.ok(out.includes(id), `seed ${seed}: ${id} rolled, so it stays laid out`);
      assert.equal(serviceCandidates(OUT, run, id).length, 0, `seed ${seed}: ${id} has nothing to act on now`);
    }
  }
  // With every chance 0, the guarantee adds only offerings that have something now.
  const zero = registriesWith(Object.fromEntries(OFFERINGS.map((id) => [`${PREFIX}blacksmith.${id}.chance`, 0])));
  for (let seed = 1; seed <= 20; seed++) {
    const { run } = smithRun(zero, { seed });
    const out = run.shopStock.offerings;
    const usable = out.filter((id) => !BLACKSMITH_SERVICES.includes(id) || serviceCandidates(zero, run, id).length > 0);
    assert.ok(usable.length >= shippedShops.blacksmith.guaranteedMinimum, `seed ${seed}: ${out}`);
    assert.equal(usable.length, out.length, `seed ${seed}: the guarantee added nothing idle`);
  }
});

test('ruling on #1378: with no upgrade candidate the rolled upgrade stays, shown unavailable; buying an armament on the same visit makes it usable', () => {
  const run = createRunState({ seed: 21, classId: 'reaver', registries: OUT });
  run.cinders = 5000;
  run.smithingStones = 50;
  // Every item the run owns at its top tier: nothing left to upgrade.
  for (let guard = 0; guard < 50 && smithingPlan(OUT, run).candidates.length; guard++) {
    for (const candidate of smithingPlan(OUT, run).candidates) run.itemUpgradeLevels = { ...(run.itemUpgradeLevels || {}), [candidate.itemRef]: candidate.nextLevel };
  }
  assert.equal(smithingPlan(OUT, run).candidates.length, 0);
  run.shopStock = buildBlacksmithStock(OUT, createRng(21), run);
  assert.ok(run.shopStock.offerings.includes('upgrade'), 'the rolled upgrade stays laid out');
  assert.ok(run.shopStock.offerings.includes('armaments'));
  const idle = blacksmithUpgradePlan(OUT, run, SWORD);
  assert.equal(idle.ok, false);
  withKitDom((dom) => {
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    const screen = mountBlacksmith(app, { registries: OUT, run, meta: { settings: {} }, onChanged() {}, onLeave() {} });
    assert.ok(app.querySelector('#shop-cat-upgrade'), 'the upgrade rail item is drawn');
    assert.ok(app.querySelector('#blacksmith-upgrade .bs-idle')?.textContent.includes(shopSentence('blacksmith.idle.upgrade')), 'shown unavailable with its reason');
    const offer = run.shopStock.armaments[0];
    commitArmamentPurchase(OUT, run, armamentPurchasePlan(OUT, run, offer));
    screen.render();
    assert.equal(app.querySelector('#blacksmith-upgrade .bs-idle'), null, 'the reason is gone once there is a candidate');
  });
  const bought = `armament/${run.loadout.storage.at(-1)}`;
  const quote = blacksmithUpgradePlan(OUT, run, bought);
  assert.equal(quote.ok, true, quote.reason);
  commitBlacksmithUpgrade(OUT, run, quote);
  assert.equal(run.itemUpgradeLevels[bought], 1);
});

test('FINISH: stock and prices survive a reload, and the atlas smith keeps its stock on the point', () => {
  const { run, rng } = smithRun(OUT);
  const before = structuredClone(run.shopStock);
  const refine = refinePlan(OUT, run);
  const back = reload(run, rng);
  assert.deepEqual(back.shopStock, before, 'the shelves and their prices are as saved');
  assert.deepEqual(refinePlan(OUT, back).cost, refine.cost, 'a service quotes the same price after a reload');
  const atlas = blacksmithVisitStock(OUT, createRng(4), run, { priceMult: 1.5 });
  assert.equal(atlas.kind, 'blacksmith');
  assert.equal(atlas.smithStones.price, Math.ceil(offeringOf(OUT, 'smithStones').price * 1.5), 'a custom price multiplier scales the stones, rounding up');
  run.journey = run.journey || null;
});

// ---------------------------------------------------------------------------
// Refining and the refined purse
// ---------------------------------------------------------------------------

test('FINISH: refining spends exactly refine.from stones and refine.cinders, adds one refined stone, and refuses a stale quote', () => {
  const { run } = smithRun(OUT, { stones: 10, cinders: 1000 });
  const refine = offeringOf(OUT, 'refineStones').refine;
  const quote = refinePlan(OUT, run);
  assert.equal(quote.ok, true, quote.reason);
  commitRefine(OUT, run, quote);
  assert.equal(run.smithingStones, 10 - refine.from);
  assert.equal(run.cinders, 1000 - refine.cinders);
  assert.equal(run.smithingStonesRefined, 1);
  assert.throws(() => commitRefine(OUT, run, quote), new RegExp(shopSentence('shop.refuse.stale')));
  assert.equal(run.smithingStonesRefined, 1, 'the stale quote changed nothing');
  run.smithingStones = refine.from - 1;
  const short = refinePlan(OUT, run);
  assert.equal(short.ok, false);
  assert.ok(short.reason.length > 0, 'the refusal is a sentence');
});

test('an upgrade paid from the refined purse spends ceil(cost / refine.value) refined stones and no ordinary stone', () => {
  const { run, rng } = smithRun(OUT, { stones: 3 });
  const value = offeringOf(OUT, 'refineStones').refine.value;
  const candidate = smithingPlan(OUT, run).candidates.find((row) => row.itemRef === SWORD);
  assert.ok(candidate, 'the sword can be upgraded');
  assert.equal(candidate.refinedCost, Math.ceil(candidate.cost / value));
  run.smithingStonesRefined = candidate.refinedCost;
  const quote = blacksmithUpgradePlan(OUT, run, SWORD, { purse: 'refined' });
  assert.equal(quote.ok, true, quote.reason);
  const receipt = commitBlacksmithUpgrade(OUT, run, quote);
  assert.equal(run.smithingStones, 3, 'no ordinary stone spent');
  assert.equal(run.smithingStonesRefined, 0);
  assert.equal(receipt.purse, 'refined');
  assert.equal(receipt.refinedSpent, candidate.refinedCost);
  assert.equal(receipt.spent, 0);
  assert.throws(() => commitBlacksmithUpgrade(OUT, run, quote), /./, 'the quote commits once');
  const back = reload(run, rng);
  assert.equal(back.lastSmithingReceipt.purse, 'refined', 'the receipt survives the load door');
  // The shrine door takes the purse too, and a stone purse is the default.
  const other = smithRun(OUT, { stones: 99 }).run;
  const plain = commitItemUpgrade(OUT, other, SWORD);
  assert.equal(plain.purse, 'stones');
});

// ---------------------------------------------------------------------------
// Sigil slots and installed sigils
// ---------------------------------------------------------------------------

test('FINISH: a sigil slot is bought, filled and emptied, up to max', () => {
  const { run } = smithRun(OUT, { cinders: 5000 });
  const slots = offeringOf(OUT, 'sigilSlots').sigilSlots;
  assert.deepEqual(sigilSlotsOf(OUT, run, SWORD), Array(slots.base).fill(null));
  const quote = sigilSlotPlan(OUT, run, SWORD);
  assert.equal(quote.ok, true, quote.reason);
  commitSigilSlot(OUT, run, quote);
  assert.equal(run.sigilSlots[SWORD].length, slots.base + 1);
  assert.equal(run.cinders, 5000 - slots.cinders);
  run.sigils = ['emberSigil'];
  const install = sigilInstallPlan(OUT, run, SWORD, 0, 'emberSigil');
  assert.equal(install.ok, true, install.reason);
  commitSigilInstall(OUT, run, install);
  assert.deepEqual(run.sigils, []);
  assert.equal(run.sigilSlots[SWORD][0], 'emberSigil');
  assert.equal(run.cinders, 5000 - slots.cinders, 'installing is free');
  const remove = sigilRemovePlan(OUT, run, SWORD, 0);
  assert.equal(remove.ok, true, remove.reason);
  commitSigilRemove(OUT, run, remove);
  assert.deepEqual(run.sigils, ['emberSigil']);
  assert.equal(run.sigilSlots[SWORD][0], null);
  while (sigilSlotPlan(OUT, run, SWORD).ok) commitSigilSlot(OUT, run, sigilSlotPlan(OUT, run, SWORD));
  assert.equal(run.sigilSlots[SWORD].length, slots.max, 'max counts every slot');
  // An armament the run does not carry has no slot to buy.
  assert.equal(sigilSlotPlan(OUT, run, 'armament/greatsword').ok, false);
});

test('FINISH: an installed sigil\'s trigger fires only while its piece is equipped, mid-fight swaps and restores included', () => {
  const { run } = smithRun(OUT);
  run.sigilSlots = { [SWORD]: ['emberSigil'], [KATANA]: [null] };
  run.loadout.storage.push('katana');
  const emberBlock = OUT.balance.sigils.emberSigil.block;
  const openingBlock = (combat) => {
    const start = combat.eventLog.findIndex((e) => e.type === 'combatStart');
    const turn = combat.eventLog.findIndex((e) => e.type === 'playerTurnStart');
    return combat.eventLog.slice(start, turn).filter((e) => e.type === 'blockGained' && e.targetId === 'player').map((e) => e.amount);
  };
  const equipped = fightFor(run);
  assert.ok(equipped.propertyMounts.player['sigil:emberSigil'], 'mounted while the sword is worn');
  assert.deepEqual(openingBlock(equipped), [emberBlock], 'the Ember Sigil\'s rule fired at combat start, at its balance number');
  // Unequip the sword mid-fight: the sigil leaves with it.
  equipped.loadout.sets.rightHand[0] = 'katana';
  equipped.loadout.storage = equipped.loadout.storage.filter((id) => id !== 'katana').concat('straightSword');
  syncLoadoutProperties(equipped);
  assert.equal(equipped.propertyMounts.player?.['sigil:emberSigil'], undefined, 'unmounted when the sword leaves the hand');
  // A sigil in an unequipped piece's slot never mounts.
  const stored = smithRun(OUT).run;
  stored.loadout.storage.push('katana');
  stored.sigilSlots = { [KATANA]: ['emberSigil'] };
  const idle = fightFor(stored);
  assert.equal(idle.propertyMounts.player?.['sigil:emberSigil'], undefined);
  assert.deepEqual(openingBlock(idle), [], 'and its rule does not fire');
  // The slots ride the snapshot, and a restore mounts the same sigil again.
  // (The fight above swapped the run's own loadout, so a fresh run wears the sword.)
  const again = smithRun(OUT).run;
  again.sigilSlots = { [SWORD]: ['emberSigil'] };
  const worn = fightFor(again);
  const snap = serializeCombatSnapshot(worn);
  assert.deepEqual(snap.sigilSlots, again.sigilSlots);
  assert.deepEqual(combatSnapshotProblems(snap), []);
  const restored = restoreCombatSnapshot({ registries: OUT, rng: createRng(5), snapshot: snap });
  assert.ok(restored.propertyMounts.player['sigil:emberSigil']);
  const old = { ...snap };
  delete old.sigilSlots;
  assert.equal(restoreCombatSnapshot({ registries: OUT, rng: createRng(5), snapshot: old }).propertyMounts.player?.['sigil:emberSigil'], undefined, 'an older snapshot mounts none');
  assert.ok(combatSnapshotProblems({ ...snap, sigilSlots: [] }).some((p) => /sigilSlots/.test(p)));
});

// ---------------------------------------------------------------------------
// Weapon arts: extract, install, upgrade, stack
// ---------------------------------------------------------------------------

test('FINISH: extracting and installing an art each commit once and refuse a stale quote', () => {
  const { run, mount, receipt } = withLooseArt(OUT);
  assert.ok(run.deck.some((card) => card.instanceId === receipt.instanceId), 'the extracted art is loose in the deck');
  const again = blacksmithExtractPlan(OUT, run, KATANA, mount.mountKey);
  assert.equal(again.ok, false, 'the mount is empty now');
  const install = blacksmithInstallPlan(OUT, run, KATANA, mount.mountKey, receipt.instanceId);
  assert.equal(install.ok, true, install.reason);
  commitBlacksmithInstall(OUT, run, install);
  assert.equal(run.itemMounts[KATANA][mount.mountKey].card, 'katanaDrawCut');
  assert.throws(() => commitBlacksmithInstall(OUT, run, install), /./, 'the same quote does not commit twice');
  // A quote made stale by another purchase is refused before anything moves.
  const quote = blacksmithExtractPlan(OUT, run, KATANA, mount.mountKey);
  assert.equal(quote.ok, true, quote.reason);
  commitRefine(OUT, run, refinePlan(OUT, run));
  const bytes = JSON.stringify(run);
  assert.throws(() => commitBlacksmithExtract(OUT, run, quote), new RegExp(shopSentence('shop.refuse.stale')));
  assert.equal(JSON.stringify(run), bytes);
});

test('FINISH: upgrading a loose art sets upgraded once, priced in stones, and refuses a stale quote', () => {
  const { run, art } = withLooseArt(OUT);
  const stones = run.smithingStones;
  const quote = upgradeArtPlan(OUT, run, art.instanceId);
  assert.equal(quote.ok, true, quote.reason);
  commitUpgradeArt(OUT, run, quote);
  assert.equal(run.deck.find((card) => card.instanceId === art.instanceId).upgraded, true);
  assert.equal(run.smithingStones, stones - offeringOf(OUT, 'upgradeArt').stones);
  assert.throws(() => commitUpgradeArt(OUT, run, quote), /./, 'commits once');
  assert.equal(upgradeArtPlan(OUT, run, art.instanceId).ok, false, 'an upgraded art is refused');
  const granted = run.deck.find((card) => card.grantedBy && card.equipmentRole === 'weaponArt');
  assert.equal(upgradeArtPlan(OUT, run, granted.instanceId).ok, false, 'an item-owned art is not loose');
});

test('FINISH: a stacked copy is a new upgraded:false instance in the sideboard, counted as owned, installable from there', () => {
  const { run, art, mount } = withLooseArt(OUT);
  commitUpgradeArt(OUT, run, upgradeArtPlan(OUT, run, art.instanceId));
  const stack = offeringOf(OUT, 'stackCopy').stack;
  const owned = ownedCopies(run, 'katanaDrawCut');
  const quote = stackCopyPlan(OUT, run, 'katanaDrawCut');
  assert.equal(quote.ok, true, quote.reason);
  assert.equal(quote.stones, stack.stones + stack.stepPerOwned * (owned - 1));
  assert.equal(quote.cost, stack.cinders + stack.stepPerOwned * (owned - 1));
  const receipt = commitStackCopy(OUT, run, quote);
  const copy = run.sideboard.find((card) => card.instanceId === receipt.instanceId);
  assert.deepEqual(copy, { instanceId: 'stack:1:katanaDrawCut', cardId: 'katanaDrawCut', upgraded: false });
  assert.equal(ownedCopies(run, 'katanaDrawCut'), owned + 1, 'the editor counts it as owned');
  assert.throws(() => commitStackCopy(OUT, run, quote), /./, 'commits once');
  const next = stackCopyPlan(OUT, run, 'katanaDrawCut');
  assert.equal(next.stones, quote.stones + stack.stepPerOwned, 'each further copy costs one step more');
  // Installed straight from the sideboard, with no trip back into the deck.
  const install = blacksmithInstallPlan(OUT, run, KATANA, mount.mountKey, copy.instanceId);
  assert.equal(install.ok, true, install.reason);
  commitBlacksmithInstall(OUT, run, install);
  assert.equal(run.sideboard.some((card) => card.instanceId === copy.instanceId), false);
  assert.equal(run.itemMounts[KATANA][mount.mountKey].upgraded, false);
});

test('FINISH: a granted card or a Strike cannot be stacked, each refused by name', () => {
  const { run } = smithRun(OUT);
  const granted = run.deck.find((card) => card.grantedBy && card.equipmentRole === 'weaponArt');
  const g = stackCopyPlan(OUT, run, granted.cardId);
  assert.equal(g.ok, false);
  assert.ok(g.reason.includes(OUT.cards.get(granted.cardId).name), g.reason);
  const s = stackCopyPlan(OUT, run, 'strike');
  assert.equal(s.ok, false);
  assert.ok(s.reason.includes(OUT.cards.get('strike').name), s.reason);
});

// ---------------------------------------------------------------------------
// Schema 17 and the load door
// ---------------------------------------------------------------------------

test('schema 17: the bump, the appended corpus entry, and a schema-16 save loads unchanged', () => {
  // Step 7 (SPEC §14.5) bumped once more; this entry and its migration stay.
  assert.ok(RUN_SCHEMA_VERSION >= 17);
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const v17 = JSON.parse(corpus.versions['17'].bytes);
  assert.equal(v17.schemaVersion, 17, 'one schema-17 save is appended');
  assert.deepEqual(validateRunShape(v17, { preTrainingPool: true }), [], 'a schema-17 save, before the training pool (SPEC §14.5)');
  const v16 = JSON.parse(corpus.versions['16'].bytes);
  assert.equal(v16.schemaVersion, 16, 'the schema-16 entry is untouched');
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(v16));
  const run = createSaveManager(storage).loadRun(REG);
  assert.ok(run);
  assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION);
  assert.deepEqual(run.sigilSlots, v16.sigilSlots);
});

test('a malformed blacksmith stock is refused by name; an unknown unsold armament is pruned at the load door', () => {
  const { run, rng } = smithRun(OUT);
  const cases = [
    [{ armaments: {} }, /shopStock\.armaments/],
    [{ armaments: [{ id: 'dagger', cost: 0 }] }, /shopStock\.armaments\[0\]/],
    [{ smithStones: { price: 1.5, left: 1 } }, /shopStock\.smithStones/],
    [{ tradeRevision: -1 }, /shopStock\.tradeRevision/],
  ];
  for (const [patch, pattern] of cases) {
    const bad = { ...run, shopStock: { ...run.shopStock, ...patch } };
    assert.ok(validateRunShape(bad).some((p) => pattern.test(p)), `${JSON.stringify(patch)} refused`);
  }
  run.shopStock.armaments = [...run.shopStock.armaments, { id: 'retiredBlade', cost: 90 }];
  const back = reload(run, rng);
  assert.equal(back.shopStock.armaments.some((item) => item.id === 'retiredBlade'), false, 'pruned, not rerolled');
  assert.equal(back.shopStock.kind, 'blacksmith');
});

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

test('the blacksmith screen lays out one rail item per offering and refines through its footer', () => {
  withKitDom((dom) => {
    const { run } = smithRun(OUT, { stones: 10, cinders: 1000 });
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    let changed = 0;
    mountBlacksmith(app, { registries: OUT, run, meta: { settings: {} }, onChanged: () => { changed++; }, onLeave: () => {} });
    const keys = [...app.querySelectorAll('.shop-rail [data-shop-category]')].map((el) => el.dataset.shopCategory);
    assert.deepEqual(keys, run.shopStock.offerings, 'one rail item per laid-out offering, in order');
    app.querySelector('#shop-cat-refineStones').click();
    const action = app.querySelector('#blacksmith-refine');
    assert.ok(action, 'the refine action is drawn');
    action.click();
    assert.equal(run.smithingStonesRefined, 1);
    assert.equal(changed, 1);
  });
});

test('the blacksmith screen refuses a displayed refine quote after another trade', () => {
  withKitDom((dom) => {
    const { run } = smithRun(OUT, { stones: 50, cinders: 1000 });
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    let changed = 0;
    mountBlacksmith(app, { registries: OUT, run, meta: { settings: {} }, onChanged: () => { changed++; }, onLeave: () => {} });
    app.querySelector('#shop-cat-refineStones').click();
    const action = app.querySelector('#blacksmith-refine');
    commitRefine(OUT, run, refinePlan(OUT, run));
    const before = JSON.stringify(run);
    action.click();
    assert.equal(JSON.stringify(run), before, 'the displayed stale quote spends nothing');
    assert.equal(changed, 0, 'a refused trade is not persisted');
    assert.ok(app.querySelector('.bs-refusal').textContent.includes(shopSentence('shop.refuse.stale')));
  });
});

test('Stack Copy refuses capped Rogue Powers, respects a raised limit and leaves other classes unrestricted', () => {
  const { run } = smithRun(OUT);
  run.class = 'rogue';
  for (const cardId of ['afterimageCard', 'deadlyTempoCard']) {
    run.deck.push({ instanceId: `limited:${cardId}`, cardId, upgraded: false });
    const before = JSON.stringify(run);
    const quote = stackCopyPlan(OUT, run, cardId);
    assert.equal(quote.ok, false, `${cardId} is capped at one`);
    assert.equal(stackableCardIds(OUT, run).includes(cardId), false);
    assert.throws(() => commitStackCopy(OUT, run, quote));
    assert.equal(JSON.stringify(run), before, 'a refused copy changes nothing');
    const settings = { classSpellPowerCopies: 2 };
    const allowed = stackCopyPlan(OUT, run, cardId, { settings });
    assert.equal(allowed.ok, true, allowed.reason);
    assert.equal(stackableCardIds(OUT, run, settings).includes(cardId), true);
    commitStackCopy(OUT, run, allowed, { settings });
    assert.equal(stackCopyPlan(OUT, run, cardId, { settings }).ok, false, 'owned sideboard copies count toward the cap');
  }
  run.class = 'reaver';
  assert.equal(stackCopyPlan(OUT, run, 'afterimageCard').ok, true, 'a Power kept from a previous class is unrestricted');
});

test('the blacksmith upgrade modal commits its displayed quote and reports a stale refusal', () => {
  withKitDom((dom) => {
    globalThis.HTMLElement = dom.document.body.constructor;
    const { run } = smithRun(OUT);
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    let changed = 0;
    mountBlacksmith(app, { registries: OUT, run, meta: { settings: {} }, onChanged: () => { changed++; }, onLeave: () => {} });
    app.querySelector('#shop-cat-upgrade').click();
    app.querySelector('#blacksmith-upgrade button').click();
    const confirm = app.querySelector('.smith-confirm');
    assert.ok(confirm, 'the upgrade quote is displayed');
    commitRefine(OUT, run, refinePlan(OUT, run));
    const before = JSON.stringify(run);
    confirm.click();
    assert.equal(JSON.stringify(run), before, 'confirm cannot silently requote');
    assert.equal(changed, 0);
    assert.ok(app.querySelector('.bs-refusal').textContent.includes(shopSentence('shop.refuse.stale')));
  });
});

for (const service of ['extract', 'install']) {
  test(`the blacksmith ${service} modal refuses a quote made stale after selection`, () => {
    withKitDom((dom) => {
      globalThis.HTMLElement = dom.document.body.constructor;
      const { run } = service === 'install' ? withLooseArt(OUT) : smithRun(OUT);
      if (service === 'extract') run.loadout.storage.push('katana');
      const app = dom.document.createElement('main');
      dom.document.body.replaceChildren(app);
      let changed = 0;
      mountBlacksmith(app, { registries: OUT, run, meta: { settings: {} }, onChanged: () => { changed++; }, onLeave: () => {} });
      app.querySelector(`#shop-cat-${service}Art`).click();
      app.querySelector(`#blacksmith-${service}Art button`).click();
      const item = app.querySelector(`[data-item-ref="${KATANA}"]`);
      item.dispatchEvent(new dom.Event('click', { bubbles: true, detail: 0, target: item }));
      item.dispatchEvent(new dom.Event('click', { bubbles: true, detail: 0, target: item }));
      const mount = app.querySelector('[data-mount-key]');
      assert.ok(mount, 'selecting the item exposes its mounts');
      mount.click();
      if (service === 'install') app.querySelector('.mount-card-list [data-instance-id]').click();
      const confirm = app.querySelector('.mount-confirm');
      assert.equal(confirm.getAttribute('aria-disabled'), 'false', 'the selected quote is affordable');
      commitRefine(OUT, run, refinePlan(OUT, run));
      const before = JSON.stringify(run);
      confirm.click();
      assert.equal(JSON.stringify(run), before, 'the selected card and purse are untouched');
      assert.equal(changed, 0);
      assert.ok(app.querySelector('.bs-refusal').textContent.includes(shopSentence('shop.refuse.stale')));
    });
  });
}
