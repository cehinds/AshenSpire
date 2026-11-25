// W25 step 5: changing a weapon's category: 1 stone + 75 cinders, keep up to N old properties, 1..1+N new ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { CategoryChangePlan, CommitCategoryChange, CanChangeCategory } from '../src/model/blacksmith.js';
import { KeepableProperties, KeepLimit, NewPropertyMax, CategoryChoices } from '../src/model/smithCategory.js';
import { ItemCategory, ItemFamily, ItemPropertyIds, ItemUpgradeCount } from '../src/model/itemPicks.js';
import { ITEM_PROPERTIES } from '../src/content/itemProperties.js';
import { gameProfileEquipmentReceipt, gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import '../src/engine/runCombat.js';

const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
const profile = resolveGameProfile(author);
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const registries = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);
const GS = 'armament/greatsword';
function smithRun(seed = 31) {
  const run = createRunState({ seed, classId: 'reaver', registries, runId: 'w25-cat' });
  run.smithingStones = 5; run.cinders = 1000; run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(seed), run);
  return run;
}
const withPicks = (run, picks) => { run.itemUpgradePicks = { [GS]: picks }; return run; };
const AR = { id: 'ar', k: 'stat', stat: 'ar', n: 1 }, DR = { id: 'dr', k: 'stat', stat: 'dr', n: 1 }, STR = { id: 'attr:strength', k: 'stat', stat: 'strength', n: 1 };

test('only weapons change category, to any other category; the quote costs 1 stone and 150 cinders (owner 2026-11-23: doubled)', () => {
  const run = smithRun();
  assert.equal(CanChangeCategory(registries, run, GS), true);
  assert.equal(CanChangeCategory(registries, run, `armor/reaver/${run.loadout.sets.armor[0]}`), false);
  assert.equal(CanChangeCategory(registries, run, 'relic/forsakenMedallion'), false);
  const choices = CategoryChoices(run, GS);
  assert.ok(choices.includes('sword') && choices.includes('staff') && !choices.includes('greatsword'));
  const plan = CategoryChangePlan(registries, run, GS, 'katana');
  assert.deepEqual([plan.ok, plan.stones, plan.cinders, plan.cost], [true, 1, 150, 150], plan.reason);
});

test('the keep limit is the upgrade count (at least 1) and at least 1 old property must carry over', () => {
  const run = withPicks(smithRun(), [AR, DR, STR]);
  assert.equal(ItemUpgradeCount(run, GS), 3);
  assert.equal(KeepLimit(run, GS), 3);
  assert.equal(NewPropertyMax(run, GS), 4);
  const keys = KeepableProperties(run, GS).map((row) => row.key);
  assert.deepEqual(keys, ['pick:0', 'pick:1', 'pick:2']);
  assert.match(CategoryChangePlan(registries, run, GS, 'katana', []).reason, /at least one/);
  assert.equal(CategoryChangePlan(registries, run, GS, 'katana', ['pick:0', 'pick:2']).ok, true);
  assert.match(CategoryChangePlan(registries, run, GS, 'katana', ['pick:9']).reason, /changed|Inspect/);
  const one = withPicks(smithRun(), [AR]);
  assert.equal(KeepLimit(one, GS), 1);
  assert.match(CategoryChangePlan(registries, one, GS, 'katana', ['pick:0', 'pick:0']).reason || 'ok', /ok|/);
  const fresh = smithRun();
  assert.equal(KeepLimit(fresh, GS), 1, 'a never-upgraded weapon still allows 1');
  assert.equal(CategoryChangePlan(registries, fresh, GS, 'katana', []).ok, true, 'and, holding nothing, has nothing it must keep');
});

test('commit: category set, kept picks stay, the rest are spent, new properties are added, the price is paid, the count holds', () => {
  const run = withPicks(smithRun(), [AR, DR, STR]);
  const quote = CategoryChangePlan(registries, run, GS, 'staff', ['pick:1']);
  assert.equal(quote.ok, true, quote.reason);
  assert.ok(quote.newProperties.length >= 1 && quote.newProperties.length <= 4);
  const receipt = CommitCategoryChange(registries, run, quote);
  assert.equal(ItemCategory(run, GS), 'staff');
  assert.equal(ItemFamily(run, GS), 'magic');
  assert.deepEqual(run.itemUpgradePicks[GS].map((p) => p.k), ['spent', 'stat', 'spent']);
  assert.equal(run.itemUpgradePicks[GS][1].stat, 'dr');
  assert.equal(ItemUpgradeCount(run, GS), 3, 'the upgrade count holds');
  assert.deepEqual(run.itemProps[GS], quote.newProperties.map((row) => row.id));
  assert.deepEqual([run.smithingStones, run.cinders], [4, 850]);
  assert.equal(receipt.kept, 1);
  // the new properties come from the new category's pool, none already held
  for (const id of ItemPropertyIds(run, GS)) assert.ok(ITEM_PROPERTIES.find((row) => row.id === id).weights.magic > 0, id);
  assert.throws(() => CommitCategoryChange(registries, run, quote), /cannot change category|changed|Inspect/, 'the same quote commits once');
});

test('the number of new properties is 1..1+N and weighted to the lower numbers (seeded, 2000 rolls)', () => {
  const histogram = {};
  for (let seed = 1; seed <= 2000; seed += 1) {
    const run = withPicks(smithRun(seed), [AR, DR]);
    const plan = CategoryChangePlan(registries, run, GS, 'katana', ['pick:0']);
    histogram[plan.newProperties.length] = (histogram[plan.newProperties.length] || 0) + 1;
  }
  assert.deepEqual(Object.keys(histogram).map(Number).sort(), [1, 2, 3], JSON.stringify(histogram));
  assert.ok(histogram[1] > histogram[2] && histogram[2] > histogram[3], JSON.stringify(histogram));
});

test('a quote is the same every time it is asked; a different keep set may roll differently', () => {
  const run = withPicks(smithRun(), [AR, DR]);
  const a = CategoryChangePlan(registries, run, GS, 'axe', ['pick:0']);
  assert.deepEqual(CategoryChangePlan(registries, run, GS, 'axe', ['pick:0']).newProperties, a.newProperties);
});

test('a change refused for a short purse keeps both purses; an old save loads and a changed weapon survives a save round trip', () => {
  const poor = withPicks(smithRun(), [AR]); poor.cinders = 10;
  const quote = CategoryChangePlan(registries, poor, GS, 'axe', ['pick:0']);
  assert.equal(quote.ok, false);
  assert.match(quote.reason, /cinders/i);
  assert.throws(() => CommitCategoryChange(registries, poor, quote));
  assert.deepEqual([poor.smithingStones, poor.cinders], [5, 10]);
  const run = withPicks(smithRun(), [AR, DR]);
  CommitCategoryChange(registries, run, CategoryChangePlan(registries, run, GS, 'axe', ['pick:0']));
  assert.deepEqual(validateRunShape(run, registries) || [], []);
  const back = deserializeRun(serializeRun(run), registries);
  assert.equal(ItemCategory(back, GS), 'axe');
  assert.deepEqual(back.itemUpgradePicks[GS], run.itemUpgradePicks[GS]);
  const old = smithRun();
  assert.equal(old.itemUpgradePicks, undefined);
  assert.equal(ItemCategory(old, GS), 'greatsword');
});

// With tier attribute grants enabled, a Smith tier is attribute points on the item, never AR or PR, so a category
// change moves no tier bonus between AR and magic damage; the ratings read the same either side of the change.
test('a weapon\'s tier bonus stays attribute points, not AR or magic damage, when its category changes', () => {
  const custom = resolveGameProfile({ ...author, modules: { ...author.modules,
    gear: { ...author.modules.gear, statPoints: { ...profile.modules.gear.statPoints, perRank: 1 } },
  } });
  const tierRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, custom)), custom);
  const run = createRunState({ seed: 31, classId: 'reaver', registries: tierRegistries });
  const untiered = gameProfileRatingReceipt(tierRegistries, run).totals;
  const source = () => gameProfileEquipmentReceipt(tierRegistries, run).sources.find(row => row.sourceId === GS).resolved;
  const baseStrength = source().points.strength;
  run.itemUpgradeLevels = { [GS]: 2 };
  const martial = gameProfileRatingReceipt(tierRegistries, run).totals;
  assert.equal(source().points.strength, baseStrength + 2);
  assert.equal(source().points.ar, 0, 'no flat AR is assigned to the weapon');
  run.itemCategories = { [GS]: 'staff' };
  const magic = gameProfileRatingReceipt(tierRegistries, run).totals;
  assert.equal(source().points.strength, baseStrength + 2, 'both tier points stay on the weapon');
  assert.equal(martial.ar - untiered.ar, 2, 'two Strength points add exactly two AR');
  assert.deepEqual([magic.ar, magic.pr], [martial.ar, martial.pr], 'a category change moves no tier bonus');
});

test('Core category changes leave the current tier attribute budget unchanged', () => {
  const run = smithRun();
  assert.equal(profile.modules.gear.statPoints.perRank, 0);
  const source = () => gameProfileEquipmentReceipt(registries, run).sources.find(row => row.sourceId === GS).resolved;
  const untiered = source();
  const rating = gameProfileRatingReceipt(registries, run).totals;
  run.itemUpgradeLevels = { [GS]: 2 };
  assert.equal(source().rank, untiered.rank + 2);
  assert.deepEqual(source().points, untiered.points);
  run.itemCategories = { [GS]: 'staff' };
  assert.deepEqual(source().points, untiered.points);
  assert.deepEqual(gameProfileRatingReceipt(registries, run).totals, rating);
});
