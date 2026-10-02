// SPEC §14.3, §14.6 step 5b — the market's skill books, revive tokens, quest
// event and companions, and the five follow-ups from 5a's re-review.
//
// docs/FINISH.md §14 "Market additions" is the acceptance line. 5a's file
// (tests/market-additions.test.mjs) holds the stones, armour, inn rest and
// sigil clauses; this file holds the rest: a skill book pays its XP through
// `awardSkillXp` and sells for its `sellValue`, never above its buy price; a
// revive token spends once at 0 HP and a fight saved after the revive and
// reloaded still shows it spent; a companion's `combatsLeft` counts down and
// it leaves at 0; a quest event opens the event door once and closes the
// visit, and with every eligible event seen it is not stocked and the
// guarantee still fills. Consumables and companions persist across a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { consumables as shippedConsumables } from '../src/content/consumables.js';
import { companions as shippedCompanions } from '../src/content/companions.js';
import { NOTE } from '../src/content/balance.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigRows, configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { createRng, STREAM_NAMES } from '../src/engine/rng.js';
import { buildMarketStock, marketVisitStock } from '../src/engine/shopKinds.js';
import { eligibleEventIds, buildShopStock } from '../src/engine/encounters.js';
import { createRunCombat, runCombatEnd } from '../src/engine/runCombat.js';
import { applyLoseHp } from '../src/engine/actions.js';
import { serializeCombatSnapshot, restoreCombatSnapshot, commitCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createRunState, RUN_SCHEMA_VERSION, migrateRunSchema, validateRunShape } from '../src/model/state.js';
import { validateContent } from '../src/model/validate.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { awardSkillXp } from '../src/model/skills.js';
import { inventoryRows } from '../src/model/inventoryPresentation.js';
import { shopStockProblems, shopSettingsProblems } from '../src/model/shopKinds.js';
import { MARKET_ADDITIONS, pruneUnknownAdditionOffers, applyShopPriceMult } from '../src/model/marketStock.js';
import {
  consumablePurchasePlan, commitConsumablePurchase,
  companionPurchasePlan, commitCompanionPurchase,
  questEventPlan, commitQuestEvent,
} from '../src/model/marketAdditions.js';
import {
  skillBookReadPlan, commitSkillBookRead,
  consumableSalePlan, commitConsumableSale, consumableBuyPrice,
  consumablesProblems, companionsProblems,
} from '../src/model/consumables.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { generateJourney, journeyGraph } from '../src/model/worldAtlas.js';
import { mountShop } from '../src/ui/screens/shop.js';
import { t } from '../src/ui/strings.js';
import { eligibleWeaponArts } from '../src/model/armamentTrading.js';

const REG = createRegistries(contentBundle);
const PREFIX = 'gameConfig.shops.';
const ADDITIONS_5B = ['skillBooks', 'reviveTokens', 'questEvent', 'companions'];
const registriesWith = (settings) => createRegistries(configuredContentBundle(contentBundle, settings));
const ALL_OUT = Object.fromEntries(ADDITIONS_5B.map((id) => [`${PREFIX}market.${id}.chance`, 100]));
const OUT = registriesWith(ALL_OUT);
const allMarketChancesZero = () => Object.fromEntries(shippedShops.market.offerings.map((row) => [`${PREFIX}market.${row.id}.chance`, 0]));
const book = () => OUT.consumables.all().find((def) => def.kind === 'skillBook');
const token = () => OUT.consumables.all().find((def) => def.kind === 'revive');

function marketRun(registries = OUT, { seed = 21, cinders = 5000, classId = 'reaver' } = {}) {
  const run = createRunState({ seed, classId, registries });
  run.cinders = cinders;
  run.seenEvents = [];
  const rng = createRng(seed);
  run.shopStock = buildMarketStock(registries, rng, run, { meta: {} });
  return { run, rng };
}

function reload(run, rng, registries = REG) {
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

// ---------------------------------------------------------------------------
// The data
// ---------------------------------------------------------------------------

test('the market authors skillBooks, reviveTokens, questEvent and companions: conditional, each number noted with a Settings row', () => {
  const market = shippedShops.market.offerings;
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  for (const id of ADDITIONS_5B) {
    const row = market.find((offering) => offering.id === id);
    assert.ok(row, `market offers ${id}`);
    assert.ok(MARKET_ADDITIONS.includes(id), `${id} is a market addition`);
    assert.equal(row.conditional, true, `${id} is conditional`);
    assert.equal(typeof row[NOTE].conditional, 'string');
    assert.ok(row.chance < 100 && row.weight < 50, `${id} ships below the shelves`);
    for (const key of ['enabled', 'chance', 'weight']) assert.ok(rows.has(`${PREFIX}market.${id}.${key}`), `${id}.${key}`);
    const label = t(`settings.shops.offering.${id}`);
    assert.ok(label && !label.startsWith('settings.'), `${id} has a label`);
  }
  for (const key of ['skillBooks.stock', 'reviveTokens.stock', 'companions.stock', 'questEvent.price']) {
    const row = rows.get(`${PREFIX}market.${key}`);
    assert.ok(row, `${key} has a row`);
    assert.equal(row.integer, true, `${key} is whole`);
    assert.ok(row.note.length > 20, `${key} carries its sentence`);
  }
  assert.equal(rows.get(`${PREFIX}market.questEvent.price`).min, 1, 'a price starts at 1');
  // The item numbers are rows of the item itself (SPEC §14.3).
  for (const def of shippedConsumables) {
    const keys = ['cost', 'sellValue', ...(def.kind === 'skillBook' ? ['xp'] : ['hpPct'])];
    for (const key of keys) {
      const row = rows.get(`gameConfig.consumables.${def.id}.${key}`);
      assert.ok(row, `${def.id}.${key} has a row`);
      assert.equal(row.integer, true);
      assert.ok(row.min >= 1, `${def.id}.${key} starts at 1`);
      assert.equal(typeof def[NOTE][key], 'string', `${def.id}.${key} is noted`);
    }
  }
  for (const def of shippedCompanions) {
    for (const key of ['cost', 'combats']) assert.ok(rows.get(`gameConfig.companions.${def.id}.${key}`)?.min >= 1, `${def.id}.${key}`);
  }
  assert.deepEqual(validateContent(contentBundle).errors.filter((e) => /^(shops|consumables|companions)/.test(e.path)), []);
});

test('a consumable or companion is refused by name when malformed: fractions, a sale above the price, an unknown track, inline triggers, no property tag', () => {
  const at = (bundle, prefix) => validateContent(bundle).errors.filter((e) => e.path.startsWith(prefix));
  const b = book();
  const cases = [
    [{ ...b, xp: 2.5 }, /xp/],
    [{ ...b, cost: 0 }, /cost/],
    [{ ...b, sellValue: b.cost + 1 }, /sellValue/],
    [{ ...b, skill: 'item:noSuch' }, /skill/],
    [{ ...b, skill: 'class:reaver' }, /skill/],
    [{ ...token(), hpPct: 101 }, /hpPct/],
  ];
  for (const [row, pattern] of cases) {
    const list = shippedConsumables.map((def) => (def.id === row.id ? row : def));
    assert.ok(at({ ...contentBundle, consumables: list }, `consumables.${row.id}`).some((e) => pattern.test(e.path + e.msg)), JSON.stringify(row));
  }
  const c = shippedCompanions[0];
  const inline = shippedCompanions.map((def) => (def.id === c.id ? { ...def, triggers: [] } : def));
  assert.ok(at({ ...contentBundle, companions: inline }, `companions.${c.id}`).some((e) => /triggers/.test(e.path + e.msg)));
  const stranger = [...shippedCompanions, { id: 'untaggedFriend', name: 'Friend', blurb: 'Walks beside you.', cost: 100, combats: 2 }];
  assert.ok(at({ ...contentBundle, companions: stranger }, 'companions.untaggedFriend').some((e) => /property/.test(e.msg)));
  assert.ok(at({ ...contentBundle, companions: shippedCompanions.map((def) => (def.id === c.id ? { ...def, combats: 0 } : def)) }, `companions.${c.id}`).some((e) => /combats/.test(e.path)));
});

test('Settings refuses a sale value above the price by name, and only that item\'s rows are set aside', () => {
  const b = book();
  const settings = { [`gameConfig.consumables.${b.id}.sellValue`]: b.cost + 50 };
  const problems = shopSettingsProblems(contentBundle, settings);
  assert.equal(problems.length, 1, JSON.stringify(problems));
  assert.equal(problems[0].id, 'settings.shops.refuse.sellValue');
  assert.match(problems[0].message, new RegExp(b.name));
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle, {}), /Nothing was imported/);
  const bundle = configuredContentBundle(contentBundle, { ...settings, [`${PREFIX}market.questEvent.price`]: 99 });
  assert.equal(validateContent(bundle).ok, true, JSON.stringify(validateContent(bundle).errors.slice(0, 3)));
  assert.equal(bundle.consumables.find((def) => def.id === b.id).sellValue, b.sellValue);
  assert.equal(bundle.shops.market.offerings.find((o) => o.id === 'questEvent').price, 99);
  // A legal change applies.
  const cheaper = configuredContentBundle(contentBundle, { [`gameConfig.consumables.${b.id}.sellValue`]: 1 });
  assert.equal(cheaper.consumables.find((def) => def.id === b.id).sellValue, 1);
});

test('with shipped defaults the pre-§14 shelves are byte-identical to buildShopStock, only shopOffers moves, and no stream was added', () => {
  // The pre-§14 shelves (cards, relics, flasks, armaments, weapon arts and the
  // Remove price) roll on `shop` and are compared byte for byte. The 5a
  // additions' stock (armour, sigils) and which of them come up DO shift on a
  // given seed, because the 5b offerings' chance rolls come before them on
  // `shopOffers`: SPEC §14.2 orders the roll by the written offerings, and
  // only today's shelves are promised unmoved (review, #1377).
  // Only §15.4's `sigils` stream was appended after it, and a market draws nothing there.
  assert.deepEqual(STREAM_NAMES.slice(STREAM_NAMES.indexOf('shopOffers')), ['shopOffers', 'sigils'], 'no stream was inserted before shopOffers');
  for (let seed = 1; seed <= 30; seed++) {
    const run = createRunState({ seed, classId: 'reaver', registries: REG });
    run.seenEvents = [];
    const plainRng = createRng(seed);
    const plain = buildShopStock(REG, plainRng, run);
    const rng = createRng(seed);
    const stock = buildMarketStock(REG, rng, run, { meta: {} });
    for (const shelf of ['cards', 'relics', 'flasks', 'armaments', 'weaponArts']) assert.equal(JSON.stringify(stock[shelf]), JSON.stringify(plain[shelf]), `${shelf} seed ${seed}`);
    assert.equal(stock.removeCost, plain.removeCost, `removeCost seed ${seed}`);
    const { shopOffers: _a, ...before } = plainRng.getCounters();
    const { shopOffers: _b, ...after } = rng.getCounters();
    assert.deepEqual(after, before, `seed ${seed}: no stream but shopOffers moves`);
    for (const id of ['cards', 'relics', 'flasks', 'armaments', 'weaponArts', 'remove']) assert.ok(stock.offerings.includes(id), `${id} seed ${seed}`);
    assert.deepEqual(shopStockProblems(stock), [], `seed ${seed}`);
  }
});

// ---------------------------------------------------------------------------
// Skill books
// ---------------------------------------------------------------------------

test('FINISH: a skill book bought at the market pays its XP through awardSkillXp when read, and survives a reload unread', () => {
  const { run, rng } = marketRun();
  const shelf = run.shopStock.skillBooks;
  assert.ok(shelf.length > 0, 'books for sale');
  const item = shelf[0];
  const def = OUT.consumables.get(item.id);
  assert.equal(def.kind, 'skillBook');
  assert.equal(item.cost, def.cost);
  const cinders = run.cinders;
  commitConsumablePurchase(OUT, run, 'skillBooks', consumablePurchasePlan(OUT, run, 'skillBooks', item));
  assert.deepEqual(run.consumables, { [item.id]: 1 });
  assert.equal(run.cinders, cinders - item.cost);
  assert.ok(!run.shopStock.skillBooks.includes(item), 'sold off the shelf');
  const back = reload(run, rng, OUT);
  assert.deepEqual(back.consumables, { [item.id]: 1 }, 'the book survives a reload');
  assert.ok(!back.shopStock.skillBooks.some((row) => row.id === item.id && row.cost === item.cost) || back.shopStock.skillBooks.length < shelf.length + 1);
  // Reading it is exactly one awardSkillXp on its track.
  const expected = structuredClone(back);
  awardSkillXp(OUT, expected, def.skill, def.xp);
  const receipt = commitSkillBookRead(OUT, back, skillBookReadPlan(OUT, back, item.id));
  assert.deepEqual(back.skills[def.skill], expected.skills[def.skill]);
  assert.equal(receipt.gained, def.xp);
  assert.deepEqual(back.consumables, {}, 'a read book is used up and its entry deleted');
  assert.equal(skillBookReadPlan(OUT, back, item.id).ok, false, 'no second read');
  // A revive token is not read.
  back.consumables = { [token().id]: 1 };
  assert.equal(skillBookReadPlan(OUT, back, token().id).ok, false);
});

test('FINISH: a skill book sells for its sellValue, never above its buy price, through a plan and commit that refuse a stale quote', () => {
  const { run } = marketRun();
  const def = book();
  run.consumables = { [def.id]: 2 };
  const plan = consumableSalePlan(OUT, run, def.id);
  assert.equal(plan.ok, true, plan.reason);
  assert.equal(plan.price, def.sellValue);
  assert.ok(plan.price <= consumableBuyPrice(def), 'never above the buy price');
  const cinders = run.cinders;
  commitConsumableSale(OUT, run, plan);
  assert.equal(run.cinders, cinders + def.sellValue);
  assert.deepEqual(run.consumables, { [def.id]: 1 });
  assert.throws(() => commitConsumableSale(OUT, run, plan), /changed|again/i, 'the old quote is stale');
  // A multiplier below 1 would make the buy price cheaper than the sale: the
  // sale is capped at what one would cost now, so a round trip never profits.
  const cheap = consumableSalePlan(OUT, run, def.id, { priceMult: 0.25 });
  assert.equal(cheap.price, Math.min(def.sellValue, consumableBuyPrice(def, 0.25)));
  assert.ok(cheap.price <= Math.ceil(def.cost * 0.25));
  for (const each of OUT.consumables.all()) assert.ok(each.sellValue <= each.cost, `${each.id}: a sale never beats the price`);
  // Nothing owned: refused by name.
  run.consumables = {};
  assert.equal(consumableSalePlan(OUT, run, def.id).ok, false);
});

// ---------------------------------------------------------------------------
// Revive tokens
// ---------------------------------------------------------------------------

test('FINISH: a revive token spends once at 0 HP: HP is set to hpPct of max, reviveSpent is logged, and the next death is death', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries: OUT });
  const def = token();
  run.consumables = { [def.id]: 1 };
  const combat = fightFor(run);
  assert.deepEqual(combat.consumables, { [def.id]: 1 }, 'the fight carries a copy of the counts');
  applyLoseHp(combat, combat.player, combat.player.hp + 50);
  assert.equal(combat.player.alive, true);
  assert.equal(combat.player.hp, Math.max(1, Math.floor(combat.player.maxHp * def.hpPct / 100)));
  assert.deepEqual(combat.consumables, {}, 'spent');
  assert.equal(run.consumables[def.id], 1, 'the run is untouched until the fight ends');
  const spent = combat.eventLog.filter((e) => e.type === 'reviveSpent');
  assert.equal(spent.length, 1);
  assert.equal(spent[0].consumableId, def.id);
  applyLoseHp(combat, combat.player, combat.player.hp + 50);
  assert.equal(combat.player.alive, false, 'no token left: the player dies');
  assert.equal(combat.eventLog.filter((e) => e.type === 'reviveSpent').length, 1);
  runCombatEnd(run, combat);
  assert.deepEqual(run.consumables, {}, 'settled back at combat end');
});

test('FINISH: a fight saved after the revive and reloaded still shows the token spent (the count rides the snapshot, not the log)', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries: OUT });
  const def = token();
  run.consumables = { [def.id]: 2 };
  const combat = fightFor(run);
  applyLoseHp(combat, combat.player, combat.player.hp + 50);
  assert.deepEqual(combat.consumables, { [def.id]: 1 });
  commitCombatSnapshot({ run, combat, nodeId: 'n1', encounterId: 'enc1' });
  const snapshot = run.combatEntered.snapshot;
  assert.deepEqual(snapshot.consumables, { [def.id]: 1 });
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
  // Through a real save and load.
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(run, createRng(4));
  const back = createSaveManager(storage).loadRun(OUT);
  assert.ok(back);
  const restored = restoreCombatSnapshot({ registries: OUT, rng: createRng(4), snapshot: back.combatEntered.snapshot });
  assert.deepEqual(restored.consumables, { [def.id]: 1 }, 'the restored fight has one left');
  applyLoseHp(restored, restored.player, restored.player.hp + 50);
  assert.equal(restored.player.alive, true, 'the one left saves again');
  assert.deepEqual(restored.consumables, {});
  runCombatEnd(back, restored);
  assert.deepEqual(back.consumables, {});
  // A malformed copy is refused by name.
  assert.ok(combatSnapshotProblems({ ...snapshot, consumables: { [def.id]: -1 } }).some((p) => /consumables/.test(p)));
  // A snapshot from before the field restores with none, and its combat end
  // leaves the run's counts as they were.
  const old = structuredClone(snapshot);
  delete old.consumables;
  const legacy = restoreCombatSnapshot({ registries: OUT, rng: createRng(4), snapshot: old });
  assert.equal(legacy.consumables, null);
  const keep = createRunState({ seed: 4, classId: 'reaver', registries: OUT });
  keep.consumables = { [def.id]: 3 };
  runCombatEnd(keep, legacy);
  assert.deepEqual(keep.consumables, { [def.id]: 3 });
});

// ---------------------------------------------------------------------------
// Companions
// ---------------------------------------------------------------------------

test('FINISH: a companion\'s combatsLeft counts down at each combat end and it leaves at 0; its property mounts at combat start and after a restore', () => {
  const def = OUT.companions.all()[0];
  assert.ok(def.propertyTags && def.propertyTags.length, 'its property comes from tagging.csv');
  const run = createRunState({ seed: 6, classId: 'reaver', registries: OUT });
  run.companions = [{ id: def.id, combatsLeft: 2 }];
  const combat = fightFor(run);
  assert.deepEqual(combat.companions, [def.id]);
  assert.ok(combat.propertyMounts.player[`companion:${def.id}`], 'mounted as a companion carrier');
  const restored = restoreCombatSnapshot({ registries: OUT, rng: createRng(6), snapshot: serializeCombatSnapshot(combat) });
  assert.deepEqual(restored.companions, [def.id]);
  assert.ok(restored.propertyMounts.player[`companion:${def.id}`], 're-mounted on restore');
  runCombatEnd(run, combat);
  assert.deepEqual(run.companions, [{ id: def.id, combatsLeft: 1 }]);
  runCombatEnd(run, fightFor(run));
  assert.deepEqual(run.companions, [], 'it leaves at 0');
  const alone = fightFor(run);
  assert.deepEqual(alone.companions, []);
  assert.ok(!alone.propertyMounts?.player?.[`companion:${def.id}`]);
});

test('a companion\'s rule fires in the fight: the first companion\'s property hears the fight as a relic would', () => {
  const def = OUT.companions.all()[0];
  const base = createRunState({ seed: 6, classId: 'reaver', registries: OUT });
  const withIt = createRunState({ seed: 6, classId: 'reaver', registries: OUT });
  withIt.companions = [{ id: def.id, combatsLeft: 3 }];
  const a = fightFor(base);
  const b = fightFor(withIt);
  assert.notDeepEqual(b.eventLog.map((e) => e.type), a.eventLog.map((e) => e.type), 'the companion changed what the fight did');
});

test('companions are bought one of each: the shelf never offers one already travelling, and the purchase appends { id, combatsLeft: combats }', () => {
  const { run, rng } = marketRun();
  const item = run.shopStock.companions[0];
  assert.ok(item, 'a companion for sale');
  const def = OUT.companions.get(item.id);
  commitCompanionPurchase(OUT, run, companionPurchasePlan(OUT, run, item));
  assert.deepEqual(run.companions, [{ id: def.id, combatsLeft: def.combats }]);
  const back = reload(run, rng, OUT);
  assert.deepEqual(back.companions, run.companions, 'the companion survives a reload');
  for (let seed = 1; seed <= 20; seed++) {
    const next = createRunState({ seed, classId: 'reaver', registries: OUT });
    next.companions = [{ id: def.id, combatsLeft: 1 }];
    const stock = buildMarketStock(OUT, createRng(seed), next, { meta: {} });
    assert.ok(!(stock.companions || []).some((row) => row.id === def.id), `seed ${seed}`);
  }
  // Everyone already travelling: the shelf is not laid out.
  const full = createRunState({ seed: 3, classId: 'reaver', registries: OUT });
  full.companions = OUT.companions.all().map((each) => ({ id: each.id, combatsLeft: 1 }));
  const stock = buildMarketStock(OUT, createRng(3), full, { meta: {} });
  assert.ok(!stock.offerings.includes('companions'));
  assert.ok(stock.offerings.length >= OUT.shops.market.guaranteedMinimum);
});

// ---------------------------------------------------------------------------
// The quest event
// ---------------------------------------------------------------------------

test('FINISH: a quest event opens the event door once and closes the visit', () => {
  withKitDom((dom) => {
    const { run } = marketRun();
    const offer = run.shopStock.questEvent;
    assert.ok(offer && typeof offer.eventId === 'string' && offer.taken === false);
    assert.ok(eligibleEventIds(OUT, { history: run.history }).includes(offer.eventId));
    const entered = [];
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    mountShop(app, {
      registries: OUT, run, meta: { settings: {} }, onLeave() {}, onChanged() {},
      enterQuestEvent: (quote) => entered.push(commitQuestEvent(OUT, run, quote).eventId),
    });
    app.querySelector('#shop-cat-questEvent').click();
    const primary = app.querySelector('#shop-primary');
    assert.ok(primary && !primary.disabled, 'the footer offers the event');
    const cinders = run.cinders;
    primary.click();
    assert.deepEqual(entered, [offer.eventId], 'the door opened once');
    assert.equal(run.shopStock.questEvent.taken, true);
    assert.ok(run.seenEvents.includes(offer.eventId));
    assert.equal(run.cinders, cinders - offer.price);
    assert.equal(questEventPlan(OUT, run).ok, false, 'a taken event is refused');
    assert.throws(() => commitQuestEvent(OUT, run, { eventId: offer.eventId, cost: offer.price, revision: 0 }));
  });
});

test('main.js enters the quest event by closing the visit exactly as Leave does, then opening the event door', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const at = main.indexOf('enterQuestEvent:');
  assert.ok(at > 0, 'showShop wires the quest event');
  const body = main.slice(at, at + 900);
  assert.match(body, /commitQuestEvent\(/);
  assert.match(body, /finishWorldService\(\)/);
  assert.match(body, /run\.shopStock = null/);
  assert.match(body, /showEvent\(/);
});

test('FINISH: with every eligible event seen the quest event is not stocked, and the guarantee still fills', () => {
  const registries = registriesWith({ ...allMarketChancesZero(), [`${PREFIX}market.questEvent.chance`]: 100, [`${PREFIX}market.questEvent.weight`]: 1000 });
  const run = createRunState({ seed: 9, classId: 'reaver', registries });
  run.seenEvents = eligibleEventIds(registries, { history: run.history });
  assert.ok(run.seenEvents.length > 0);
  const stock = buildMarketStock(registries, createRng(9), run, { meta: {} });
  assert.ok(!stock.offerings.includes('questEvent'), 'not stocked');
  assert.equal(stock.questEvent, undefined);
  assert.equal(stock.offerings.length, registries.shops.market.guaranteedMinimum, 'the guarantee fills from the others');
  // One unseen left: that one is the offer.
  const last = run.seenEvents.pop();
  const one = buildMarketStock(registries, createRng(9), run, { meta: {} });
  assert.equal(one.questEvent.eventId, last);
  // Seen since it was stocked: refused by name.
  run.shopStock = one;
  run.cinders = 1000;
  run.seenEvents.push(last);
  assert.equal(questEventPlan(registries, run).ok, false);
});

// ---------------------------------------------------------------------------
// Persistence and the schema
// ---------------------------------------------------------------------------

test('consumables and companions ride schema 16: the bump, the appended corpus entry and the migration defaults', () => {
  assert.ok(RUN_SCHEMA_VERSION >= 16, 'schema 16 or later (step 6 bumps to 17)');
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const v16 = JSON.parse(corpus.versions['16'].bytes);
  assert.equal(v16.schemaVersion, 16);
  assert.deepEqual(v16.consumables, {});
  assert.deepEqual(v16.companions, []);
  const v15 = JSON.parse(corpus.versions['15'].bytes);
  assert.equal(v15.schemaVersion, 15, 'the schema-15 entry is untouched');
  assert.equal('consumables' in v15, false);
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(v15));
  const run = createSaveManager(storage).loadRun(REG);
  assert.ok(run);
  assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION, 'brought forward to the current schema');
  assert.deepEqual(run.consumables, {});
  assert.deepEqual(run.companions, []);
  const fresh = createRunState({ seed: 3, classId: 'reaver', registries: REG });
  assert.deepEqual(fresh.consumables, {});
  assert.deepEqual(fresh.companions, []);
  assert.deepEqual(validateRunShape(fresh), []);
  for (const key of ['consumables', 'companions']) {
    const missing = structuredClone(fresh);
    delete missing[key];
    assert.ok(validateRunShape(missing).some((p) => p.includes(key)), `${key} is required at 16`);
  }
});

test('a malformed consumable map or companion list is refused by name', () => {
  const fresh = createRunState({ seed: 3, classId: 'reaver', registries: REG });
  const cases = [
    [{ consumables: [] }, /consumables/],
    [{ consumables: { bladeManual: 0 } }, /consumables\.bladeManual/],
    [{ consumables: { bladeManual: 1.5 } }, /consumables\.bladeManual/],
    [{ companions: {} }, /companions/],
    [{ companions: [{ id: 'x' }] }, /companions\[0\]/],
    [{ companions: [{ id: 'x', combatsLeft: 0 }] }, /companions\[0\]/],
    [{ companions: [{ id: 'x', combatsLeft: 1 }, { id: 'x', combatsLeft: 2 }] }, /companions\[1\]/],
  ];
  for (const [patch, pattern] of cases) {
    const run = { ...structuredClone(fresh), ...patch };
    assert.ok(validateRunShape(run).some((p) => pattern.test(p)), `${JSON.stringify(patch)}: ${validateRunShape(run).join(' | ')}`);
  }
  assert.deepEqual(consumablesProblems({ consumables: { bladeManual: 2 } }), []);
  assert.deepEqual(companionsProblems({ companions: [{ id: 'a', combatsLeft: 1 }] }), []);
  const back = migrateRunSchema(JSON.parse(JSON.stringify({ ...fresh, consumables: { [book().id]: 2 }, companions: [{ id: OUT.companions.all()[0].id, combatsLeft: 2 }] })));
  assert.deepEqual(back.consumables, { [book().id]: 2 });
});

test('an owned consumable or companion this build does not know archives the save by name', () => {
  for (const patch of [{ consumables: { retiredBook: 1 } }, { companions: [{ id: 'retiredFriend', combatsLeft: 1 }] }]) {
    const run = { ...createRunState({ seed: 3, classId: 'reaver', registries: REG }), ...patch };
    const storage = createMemoryStorage();
    createSaveManager(storage).saveRun(run, createRng(3));
    assert.equal(createSaveManager(storage).loadRun(REG), null, JSON.stringify(patch));
  }
});

test('unsold 5b offers this build no longer knows are pruned at the load door, on the open stock and on atlas points, never rerolled', () => {
  const { run, rng } = marketRun();
  run.shopStock.skillBooks = [{ id: 'retiredBook', cost: 90 }, ...run.shopStock.skillBooks];
  run.shopStock.reviveTokens = [{ id: 'retiredToken', cost: 90 }];
  run.shopStock.companions = [{ id: 'retiredFriend', cost: 90 }, ...run.shopStock.companions];
  run.shopStock.questEvent = { eventId: 'retiredEvent', price: 50, taken: false };
  const back = reload(run, rng, OUT);
  assert.ok(!back.shopStock.skillBooks.some((row) => row.id === 'retiredBook'));
  assert.ok(!back.shopStock.companions.some((row) => row.id === 'retiredFriend'));
  assert.ok(!back.shopStock.offerings.includes('reviveTokens'), 'an emptied shelf leaves the rail');
  assert.ok(!back.shopStock.offerings.includes('questEvent'), 'an unknown event offer is pruned');
  assert.equal(back.shopStock.questEvent, undefined);
  // The prune reads the same rules for an atlas point's saved stock.
  const stock = { kind: 'market', offerings: ['cards', 'skillBooks', 'questEvent'], cards: [], skillBooks: [{ id: 'retiredBook', cost: 5 }], questEvent: { eventId: 'retiredEvent', price: 5, taken: false } };
  const removed = pruneUnknownAdditionOffers(stock, { consumableKnown: () => false, eventKnown: () => false, companionKnown: () => false, sigilKnown: () => true, armourKnown: () => true });
  assert.equal(removed.length, 2);
  assert.deepEqual(stock.offerings, ['cards']);
});

test('the saved 5b shelves are shape-checked by name, and the price multiplier reaches them', () => {
  const { run } = marketRun();
  assert.deepEqual(shopStockProblems(run.shopStock), []);
  const bad = [
    [{ skillBooks: 'x' }, /skillBooks/],
    [{ reviveTokens: [{ id: 'emberToken' }] }, /reviveTokens/],
    [{ companions: [{ id: '', cost: 3 }] }, /companions/],
    [{ questEvent: { eventId: 'x', price: 0, taken: false } }, /questEvent/],
    [{ questEvent: { eventId: 'x', price: 5, taken: 'no' } }, /questEvent/],
  ];
  for (const [patch, pattern] of bad) {
    const problems = shopStockProblems({ ...structuredClone(run.shopStock), ...patch });
    assert.ok(problems.some((p) => pattern.test(p)), `${JSON.stringify(patch)}: ${problems.join(' | ')}`);
  }
  const scaled = applyShopPriceMult(structuredClone(run.shopStock), 1.5);
  for (const shelf of ['skillBooks', 'reviveTokens', 'companions']) scaled[shelf].forEach((item, i) => assert.equal(item.cost, Math.ceil(run.shopStock[shelf][i].cost * 1.5), shelf));
  assert.equal(scaled.questEvent.price, Math.ceil(run.shopStock.questEvent.price * 1.5));
  const viaDoor = marketVisitStock(OUT, createRng(21), { ...createRunState({ seed: 21, classId: 'reaver', registries: OUT }), seenEvents: [] }, { meta: {}, door: 'merchant', priceMult: 2 });
  assert.deepEqual(shopStockProblems(viaDoor), []);
});

test('a v16 save carrying consumables, companions and 5b stock loads with every field kept', () => {
  const { run, rng } = marketRun();
  run.consumables = { [book().id]: 2, [token().id]: 1 };
  run.companions = [{ id: OUT.companions.all()[0].id, combatsLeft: 2 }];
  const back = reload(run, rng, OUT);
  assert.deepEqual(back.consumables, run.consumables);
  assert.deepEqual(back.companions, run.companions);
  for (const key of ADDITIONS_5B) assert.deepEqual(back.shopStock[key], run.shopStock[key], key);
});

// ---------------------------------------------------------------------------
// The screens
// ---------------------------------------------------------------------------

test('DOM: every 5b shelf lays out its stock, one click buys a book, a token and a companion, and a book sells from the Sell pane', () => {
  withKitDom((dom) => {
    const { run } = marketRun();
    let changed = 0;
    const mount = () => {
      const app = dom.document.createElement('main');
      dom.document.body.replaceChildren(app);
      mountShop(app, { registries: OUT, run, meta: { settings: {} }, onLeave() {}, onChanged() { changed += 1; }, enterQuestEvent() {} });
      return app;
    };
    let app = mount();
    const rail = app.querySelectorAll('[data-shop-category]').map((item) => item.dataset.shopCategory);
    for (const id of ADDITIONS_5B) assert.ok(rail.includes(id), `${id} has a rail item`);
    assert.ok(rail.indexOf('skillBooks') < rail.indexOf('services'), 'additions stand before services');
    for (const key of ['skillBooks', 'reviveTokens', 'companions']) {
      assert.equal(app.querySelectorAll(`#shop-${key} .shop-offer`).length, run.shopStock[key].length, key);
      app.querySelector(`#shop-cat-${key}`).click();
      const primary = app.querySelector('#shop-primary');
      assert.ok(primary && !primary.disabled, `${key}: Buy is offered`);
      primary.click();
    }
    assert.equal(Object.values(run.consumables).reduce((a, b) => a + b, 0), 2, 'a book and a token bought');
    assert.equal(run.companions.length, 1);
    assert.ok(changed >= 3);
    // The Sell pane lists the book and the token beside the armament sale.
    app = mount();
    app.querySelector('#shop-cat-sell').click();
    const sellTiles = app.querySelectorAll('#shop-sell .shop-offer');
    const refs = sellTiles.map((tile) => tile.dataset.shopRef);
    const bookId = Object.keys(run.consumables).find((id) => OUT.consumables.get(id).kind === 'skillBook');
    const bookDef = OUT.consumables.get(bookId);
    const tile = sellTiles.find((each) => each.dataset.shopRef === `sell-consumable:${bookId}#0`);
    assert.ok(tile, `the book is on the Sell pane (${refs.join(' / ')})`);
    assert.ok(refs.includes(`sell-consumable:${Object.keys(run.consumables).find((id) => id !== bookId)}#0`), 'and the token beside it');
    tile.click();
    const cinders = run.cinders;
    const sell = app.querySelector('#shop-primary');
    assert.ok(sell && !sell.disabled);
    sell.click();
    const confirm = dom.document.body.querySelector('[role="alertdialog"] .btn.primary, [role="dialog"] .btn.primary, [role="alertdialog"] button[data-weight="primary"], [role="dialog"] button[data-weight="primary"]');
    if (confirm) confirm.click();
    assert.equal(run.cinders, cinders + bookDef.sellValue, 'sold for its sellValue');
    assert.equal(run.consumables[bookId], undefined);
  });
});

test('the Armoury inventory lists owned consumables stacked by id, and only a skill book offers Read', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries: OUT });
  run.consumables = { [book().id]: 2, [token().id]: 1 };
  const rows = inventoryRows(OUT, run, {}).filter((row) => row.category === 'Consumable');
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.id === book().id).count, 2);
  assert.equal(rows.find((row) => row.id === book().id).read, true);
  assert.equal(rows.find((row) => row.id === token().id).read, false);
});

// ---------------------------------------------------------------------------
// 5a's re-review follow-ups
// ---------------------------------------------------------------------------

test('follow-up 1: the empty-stock refusal names only the fix that works, raising that shelf\'s stock', () => {
  const [problem] = shopSettingsProblems(contentBundle, { 'gameConfig.balance.shop.cardStock': 0 });
  assert.equal(problem.id, 'settings.shops.refuse.emptyStock');
  assert.match(problem.message, /raise the stock of Cards/i);
  assert.doesNotMatch(problem.message, /turn another offering on|lower the minimum/i);
});

test('follow-up 2: a prune that empties the only offering drops its id too, so no empty rail item is left', () => {
  const stock = { kind: 'market', offerings: ['sigils'], sigils: [{ id: 'retiredSigil', cost: 90 }] };
  pruneUnknownAdditionOffers(stock, { sigilKnown: () => false, armourKnown: () => true });
  assert.deepEqual(stock.offerings, []);
  assert.equal(stock.sigils, undefined);
});

test('follow-up 3: the load door prunes an atlas point\'s saved stock (journey.serviceStates.*.stock) too', () => {
  const { run, rng } = marketRun();
  const pointStock = structuredClone(run.shopStock);
  pointStock.skillBooks = [{ id: 'retiredBook', cost: 90 }, ...pointStock.skillBooks];
  pointStock.sigils = [{ id: 'retiredSigil', cost: 90 }];
  if (!pointStock.offerings.includes('sigils')) pointStock.offerings = [...pointStock.offerings, 'sigils'];
  run.shopStock = null;
  // A real atlas journey, so the save passes the journey's own shape check.
  run.journey = generateJourney('PRUNE');
  run.mapGraph = journeyGraph(run.journey);
  run.journey.serviceStates['crownfall/market'] = { stock: pointStock };
  const back = reload(run, rng, OUT);
  const kept = back.journey.serviceStates['crownfall/market'].stock;
  assert.ok(!kept.skillBooks.some((row) => row.id === 'retiredBook'), 'the unknown book offer is pruned');
  assert.ok(kept.skillBooks.length > 0, 'the known ones stay');
  assert.ok(!kept.offerings.includes('sigils'), 'the emptied sigil shelf leaves the point\'s rail');
  assert.equal(kept.sigils, undefined);
});

test('follow-up 4: the authored card pool the content door checks excludes weapon arts, as rollShopCards does', () => {
  // The mountable arts: what eligibleWeaponArts names (defaults carrying the extractable tag).
  const artIds = new Set(eligibleWeaponArts(REG));
  assert.ok(artIds.size > 0);
  // A class with no pool of its own and only weapon-art colourless cards has
  // an empty shop pool, and is refused by name.
  const classes = contentBundle.classes.map((row, i) => (i === 0 ? { ...row, cardPool: [] } : row));
  const cards = contentBundle.cards.filter((card) => card.class !== 'colorless' || artIds.has(card.id));
  assert.ok(cards.some((card) => card.class === 'colorless'), 'weapon-art colourless cards remain');
  const errors = validateContent({ ...contentBundle, classes, cards }).errors.filter((e) => e.path === 'shops.market.cards');
  assert.equal(errors.length, 1, JSON.stringify(errors));
});

test('follow-up 5: a sold-out armour shelf stays visible like a sold-out sigil shelf; it hides only when its stock fits no offer to this class', () => {
  withKitDom((dom) => {
    const armourOut = registriesWith({ [`${PREFIX}market.armour.chance`]: 100 });
    const { run } = marketRun(armourOut);
    assert.ok(run.shopStock.offerings.includes('armour'));
    const mount = () => {
      const app = dom.document.createElement('main');
      dom.document.body.replaceChildren(app);
      mountShop(app, { registries: armourOut, run, meta: { settings: {} }, onLeave() {}, onChanged() {} });
      return app;
    };
    run.shopStock.armour = [];
    assert.ok(mount().querySelector('#shop-cat-armour'), 'sold out: still on the rail');
    run.shopStock.armour = [{ classId: 'rogue', id: 'x', cost: 300 }];
    assert.equal(mount().querySelector('#shop-cat-armour'), null, 'only another class\'s offers: hidden');
  });
});
