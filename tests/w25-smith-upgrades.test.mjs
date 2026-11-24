// W25 step 4: Blacksmith item upgrades are a choice of 2-3 rolled options, priced by the item's upgrade number.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { blacksmithUpgradePlan, commitBlacksmithUpgrade, SmithUpgradeItems, serviceCandidates } from '../src/model/blacksmith.js';
import { SmithUpgradeCost, SmithUpgradeSlots, RollSmithOptions, SmithOptionPool } from '../src/model/smithUpgrade.js';
import { ItemFamily, ItemCategory, ItemUpgradeCount, ItemPropertyIds } from '../src/model/itemPicks.js';
import { gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';
import { UpgradeSlots, WeaponSmithLevel } from '../src/model/cardUpgradeLimits.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const registries = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);

function smithRun({ classId = 'reaver', stones = 40, cinders = 5000, seed = 31 } = {}) {
  const run = createRunState({ seed, classId, registries, runId: 'w25-smith', profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.smithingStones = stones; run.cinders = cinders; run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(seed), run);
  return run;
}
const GS = 'armament/greatsword';

test('cost table: cinders 150, 255, 360, 465 then +105 (owner 2026-11-17, tripled 2026-11-23); stones 1 for upgrades 1-3, 2 for 4-6, 3 for 7-9', () => {
  const rows = Array.from({ length: 10 }, (_, i) => SmithUpgradeCost(i + 1, 0, profile));
  assert.deepEqual(rows.map((r) => r.cinders), [150, 255, 360, 465, 570, 675, 780, 885, 990, 1095]);
  assert.deepEqual(rows.map((r) => r.stones), [1, 1, 1, 2, 2, 2, 3, 3, 3, 4]);
});

test('every quote offers two or three distinct options, the same every time it is asked', () => {
  const run = smithRun();
  const counts = new Set();
  for (let n = 1; n <= 40; n += 1) {
    const options = RollSmithOptions(run, GS, n);
    counts.add(options.length);
    assert.ok(options.length >= 2 && options.length <= 3, `upgrade ${n}: ${options.length}`);
    assert.equal(new Set(options.map((o) => o.id)).size, options.length, 'distinct');
    assert.deepEqual(RollSmithOptions(run, GS, n), options, 'stable');
  }
  assert.deepEqual([...counts].sort(), [2, 3], 'both counts occur');
});

// Owner, 2026-11-17: gear grants no AR, DR or PR, so the picks are Poise or attributes (martial +3 Poise or a related
// attribute; magic +10% Poise damage or INT / WIS / Mana).
test('a martial weapon rolls +3 Poise / a related attribute; a magic weapon rolls Poise damage / INT, WIS or Mana', () => {
  const martial = smithRun();
  assert.equal(ItemFamily(martial, GS), 'martial');
  const ids = new Set(SmithOptionPool(martial, GS).map((row) => row.pick.id));
  assert.deepEqual([...ids].filter((id) => !id.startsWith('prop:')).sort(), ['attr:constitution', 'attr:strength', 'poise']);
  const magic = smithRun({ classId: 'starseer' });
  const staff = `armament/${magic.loadout.sets.rightHand[0]}`;
  assert.equal(ItemFamily(magic, staff), 'magic');
  const magicIds = SmithOptionPool(magic, staff).map((row) => row.pick.id).filter((id) => !id.startsWith('prop:'));
  assert.ok(magicIds.includes('poisePct'), magicIds.join());
  assert.ok(magicIds.some((id) => /^attr:(intelligence|wisdom|mp)$/.test(id)));
  assert.ok(!magicIds.includes('ar') && !magicIds.includes('magicDamage'), magicIds.join());
});

test('the blacksmith quote prices upgrade n and commit applies the chosen option', () => {
  const run = smithRun();
  assert.ok(SmithUpgradeItems(registries, run).some((row) => row.itemRef === GS));
  assert.ok(serviceCandidates(registries, run, 'upgrade').some((row) => row.itemRef === GS));
  const ratingsBefore = gameProfileRatingReceipt(registries, run).totals;
  let quote = blacksmithUpgradePlan(registries, run, GS);
  assert.equal(quote.ok, true, quote.reason);
  assert.deepEqual([quote.stones, quote.cost, quote.n], [1, 150, 1]);
  const pick = quote.options.find((o) => o.k === 'stat' && o.stat === 'poise') || quote.options[0];
  const stonesBefore = run.smithingStones;
  const receipt = commitBlacksmithUpgrade(registries, run, { ...quote, optionId: pick.id });
  assert.equal(receipt.pick.id, pick.id);
  assert.deepEqual([run.smithingStones, run.cinders], [stonesBefore - 1, 5000 - 150]);
  assert.equal(ItemUpgradeCount(run, GS), 1);
  assert.equal(run.itemUpgradeLevels?.[GS] || 0, 0, 'the fixed tier ladder is untouched');
  quote = blacksmithUpgradePlan(registries, run, GS);
  assert.deepEqual([quote.stones, quote.cost, quote.n], [1, 255, 2]);
  if (pick.stat === 'poise') assert.equal(gameProfileRatingReceipt(registries, run).totals.poise, ratingsBefore.poise + pick.n);
});

test('a picked +1 attribute reaches the effective attributes and +1 DR reaches the rating receipt', () => {
  const run = smithRun();
  run.itemUpgradePicks = { [GS]: [{ id: 'attr:strength', k: 'stat', stat: 'strength', n: 1 }, { id: 'dr', k: 'stat', stat: 'dr', n: 1 }] };
  const base = smithRun();
  assert.equal(gameProfileEffectiveAttributes(registries, run).strength, gameProfileEffectiveAttributes(registries, base).strength + 1);
  assert.equal(gameProfileRatingReceipt(registries, run).totals.dr, gameProfileRatingReceipt(registries, base).totals.dr + 1);
});

test('a stale quote is refused; an option not offered is refused; slots end the line', () => {
  const run = smithRun();
  const quote = blacksmithUpgradePlan(registries, run, GS);
  assert.throws(() => commitBlacksmithUpgrade(registries, run, { ...quote, optionId: 'nope' }), /not one of the options/);
  commitBlacksmithUpgrade(registries, run, quote);
  assert.throws(() => commitBlacksmithUpgrade(registries, run, quote), /no longer|stale|changed|moved/i);
  run.itemUpgradePicks[GS] = Array.from({ length: SmithUpgradeSlots(run, GS) }, () => ({ id: 'ar', k: 'stat', stat: 'ar', n: 1 }));
  const full = blacksmithUpgradePlan(registries, run, GS);
  assert.equal(full.ok, false);
  assert.match(full.reason, /upgrade slots/);
});

test(`picks raise the weapon's smith level but no longer add card slots (owner 2026-11-23), and an old save (no picks) is unchanged`, () => {
  const run = smithRun();
  const strike = run.deck.find((c) => c.cardId === 'core.strike');
  assert.equal(UpgradeSlots(run, strike), 1);
  run.itemUpgradePicks = { [GS]: [{ id: 'ar', k: 'stat', stat: 'ar', n: 1 }] };
  assert.equal(WeaponSmithLevel(run, strike), 1);
  assert.equal(UpgradeSlots(run, strike), 1);
  assert.equal(ItemCategory(run, GS), 'greatsword');
});

test('item rank-up: +1 upgrade slot for the rank-up price; slots never pass the ceiling', async () => {
  const { ItemRankUpPlan, CommitItemRankUp } = await import('../src/model/blacksmith.js');
  const run = smithRun();
  assert.equal(SmithUpgradeSlots(run, GS), 6);
  const quote = ItemRankUpPlan(registries, run, GS);
  assert.deepEqual([quote.ok, quote.stones, quote.cost], [true, 1, 240], quote.reason);
  const [stonesBefore, cindersBefore] = [run.smithingStones, run.cinders];
  CommitItemRankUp(registries, run, quote);
  assert.equal(SmithUpgradeSlots(run, GS), 7);
  assert.deepEqual([run.smithingStones, run.cinders], [stonesBefore - 1, cindersBefore - 240]);
  assert.equal(ItemRankUpPlan(registries, run, GS).cost, 480, 'the next rank costs the rank-up price twice (owner 2026-11-23)');
  assert.throws(() => CommitItemRankUp(registries, run, quote), /changed|Inspect/);
  run.itemRanks[GS] = 99;
  assert.equal(SmithUpgradeSlots(run, GS), 12);
  assert.equal(ItemRankUpPlan(registries, run, GS).ok, false);
});

test('an upgrade can roll a property, and the property it picks is held by the item and counted as an upgrade', () => {
  const run = smithRun();
  let found = null;
  for (let n = 1; n <= 60 && !found; n += 1) found = RollSmithOptions(run, GS, n).find((o) => o.k === 'prop');
  assert.ok(found, 'a property appears among the options');
  run.itemUpgradePicks = { [GS]: [{ id: found.id, k: 'prop', prop: found.prop }] };
  assert.deepEqual(ItemPropertyIds(run, GS), [found.prop]);
  assert.ok(!SmithOptionPool(run, GS).some((row) => row.pick.id === found.id), 'a held property is not offered again');
  assert.equal(ItemUpgradeCount(run, GS), 1);
});

test('the blacksmith card upgrade offers 2 or 3 options at random, the same every time it is asked', async () => {
  const { upgradeChoiceCount } = await import('../src/model/cardUpgradeLimits.js');
  const run = smithRun();
  const seen = new Set();
  for (let i = 1; i <= 60; i += 1) {
    const instance = { instanceId: `x${i}`, cardId: 'core.strike' };
    const n = upgradeChoiceCount(registries.cards.get('core.strike'), instance, { blacksmith: true, run });
    seen.add(n);
    assert.equal(upgradeChoiceCount(registries.cards.get('core.strike'), instance, { blacksmith: true, run }), n);
  }
  assert.deepEqual([...seen].sort(), [2, 3]);
  assert.equal(upgradeChoiceCount(registries.cards.get('core.strike'), { instanceId: 'x' }, { run }), 1, 'a rest-site upgrade keeps its own rule');
});

test('Blacksmith card work raises the rank on a seeded 20% chance, never on an equipment card', async () => {
  const { UpgradeGrantsRank } = await import('../src/model/blacksmith.js');
  const run = smithRun();
  let ranked = 0;
  for (let i = 0; i < 2000; i += 1) if (UpgradeGrantsRank(run, { instanceId: `c${i}`, cardId: 'core.strike' })) ranked += 1;
  assert.ok(ranked > 300 && ranked < 500, `about 20% of 2000: ${ranked}`);
  assert.equal(UpgradeGrantsRank(run, { instanceId: 'c1', cardId: 'core.strike' }), UpgradeGrantsRank(run, { instanceId: 'c1', cardId: 'core.strike' }));
  assert.equal(UpgradeGrantsRank(run, { instanceId: 'c1', cardId: 'core.strike', sourceArmamentId: 'greatsword' }), false);
});
