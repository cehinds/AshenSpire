// SPEC §15.3 — armament, equipment and crafting drops.
//
// Every number is a balance leaf with a generated Settings row, and the shipped
// defaults reproduce today's drops exactly. The Falsify lines of §15.3 are the
// tests below, each named after the line it falsifies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigRows, configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRng } from '../src/engine/rng.js';
import { rollArmamentDrop } from '../src/engine/encounters.js';
import {
  commitItemUpgrade, grantSmithingReward, initializeRunSmithing, smithingPlan, smithingRewardId, smithingRewardPays,
} from '../src/model/smithing.js';
import { normalizeSmithingRules } from '../src/model/smithingRules.js';
import { createRunState, deserializeRun, serializeRun, validateRunShape, RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { rewardPlan } from '../src/model/rewardplan.js';
import { validateContent } from '../src/model/validate.js';

const REG = createRegistries(contentBundle);
const POOLS = ['normal', 'elite', 'boss', 'treasure'];

function registriesWith(overrides) {
  const settings = Object.fromEntries(Object.entries(overrides).map(([path, value]) => [`gameConfig.balance.${path}`, value]));
  return createRegistries(configuredContentBundle(contentBundle, settings));
}

function freshRun(registries = REG, seed = 7) {
  return createRunState({ seed, classId: 'reaver', registries });
}

test('§15.3 shipped defaults: normal armament chance 0, every stone chance 100, no refined payout', () => {
  const drops = contentBundle.balance.equipment.drops;
  assert.equal(drops.chance.normal, 0);
  assert.equal(drops.chance.treasure, 60);
  assert.equal(drops.chance.elite, 30);
  assert.equal(drops.chance.boss, 100);
  const rules = normalizeSmithingRules(contentBundle.balance.smithing);
  assert.deepEqual({ ...rules.rewardChancePct }, { normal: 100, elite: 100, boss: 100, treasure: 100 });
  assert.deepEqual({ ...rules.refinedRewardByPool }, { normal: 0, elite: 0, boss: 0, treasure: 0 });
  assert.equal(rules.rewardByPool.treasure, 0);
  assert.equal('refinedValue' in contentBundle.balance.smithing, false, 'refined stones are not spent yet: §14.4 owns refine.value');
  // A normal armament roll has its own rarity row, a copy of the elite row,
  // so raising chance.normal draws a piece rather than a roll that returns null.
  assert.deepEqual({ ...drops.rarityWeights.normal }, { ...drops.rarityWeights.elite });
  assert.deepEqual(validateContent(contentBundle).errors, []);
});

test('§15.3 every new leaf has a generated Settings row with a note and a 0–100 percent domain', () => {
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  const percent = [
    'equipment.drops.chance.normal',
    ...POOLS.map((pool) => `smithing.rewardChancePct.${pool}`),
  ];
  for (const path of percent) {
    const row = rows.get(`gameConfig.balance.${path}`);
    assert.ok(row, `${path} has a Settings row`);
    assert.ok(row.note && row.note.length > 20, `${path} carries a note`);
    assert.equal(row.min, 0, `${path} min`);
    assert.equal(row.max, 100, `${path} max`);
  }
  for (const path of POOLS.map((pool) => `smithing.refinedRewardByPool.${pool}`)) {
    const row = rows.get(`gameConfig.balance.${path}`);
    assert.ok(row && row.note, `${path} has a noted Settings row`);
  }
});

test('Falsify: with defaults, a seed\'s armament drops are unchanged', () => {
  // Today's balance had no `normal` chance and no `normal` rarity row. Strip
  // them and the rolls must be byte-identical, stream counters included.
  const legacyBalance = structuredClone(contentBundle.balance);
  delete legacyBalance.equipment.drops.chance.normal;
  delete legacyBalance.equipment.drops.rarityWeights.normal;
  const legacy = { ...REG, balance: legacyBalance };
  for (let seed = 1; seed <= 50; seed++) {
    for (const source of ['normal', 'elite', 'boss', 'treasure']) {
      const a = createRng(seed); const b = createRng(seed);
      const now = rollArmamentDrop(REG, a, { source, found: [], carried: [] });
      const before = rollArmamentDrop(legacy, b, { source, found: [], carried: [] });
      assert.equal(now, before, `seed ${seed} ${source}`);
      assert.deepEqual(a.getCounters(), b.getCounters(), `seed ${seed} ${source} counters`);
    }
    const rng = createRng(seed);
    assert.equal(rollArmamentDrop(REG, rng, { source: 'normal' }), null, 'a normal win drops nothing by default');
    assert.equal(rng.getCounters().armaments, 0, 'and rolls nothing');
  }
});

test('Falsify: with defaults, a seed\'s stone drops are unchanged and the smith stream never moves', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const run = freshRun(REG, seed);
    const rng = createRng(seed);
    for (const pool of POOLS) {
      const receipt = grantSmithingReward(REG, run, pool, `seed:${seed}:${pool}`, rng);
      assert.equal(receipt.amount, contentBundle.balance.smithing.rewardByPool[pool], `${pool} pays the table`);
      assert.equal(receipt.refined, undefined, 'the receipt is the one it always was');
      assert.deepEqual(Object.keys(receipt).sort(), ['amount', 'duplicate', 'pool', 'rewardId', 'stoneBalanceAfter']);
    }
    assert.equal(run.smithingStones, 2);
    assert.equal(run.smithingStonesRefined, 0, 'the refined purse is untouched when nothing refined was paid');
    assert.equal(rng.getCounters().smith, 0);
  }
});

test('Falsify: with drops.chance.normal 100, every normal win drops an armament while one remains unfound', () => {
  const registries = registriesWith({ 'equipment.drops.chance.normal': 100 });
  const eligible = (registries.equipment.armaments || []).filter((a) => a.unlock === '' && Number(a.dropWeight) > 0);
  assert.ok(eligible.length > 1);
  const rng = createRng(11);
  const found = [];
  for (let i = 0; i < eligible.length; i++) {
    const id = rollArmamentDrop(registries, rng, { source: 'normal', found, carried: [] });
    assert.ok(id, `win ${i + 1} drops while ${eligible.length - found.length} remain unfound`);
    assert.ok(!found.includes(id), 'never a piece already found');
    found.push(id);
  }
  assert.equal(rollArmamentDrop(registries, rng, { source: 'normal', found, carried: [] }), null, 'nothing left unfound: no drop');
});

test('Falsify: with rewardChancePct.elite 0 an elite pays no stone; with 100 the smith counter does not move', () => {
  const never = registriesWith({ 'smithing.rewardChancePct.elite': 0 });
  const rng = createRng(3);
  const run = freshRun(never);
  const receipt = grantSmithingReward(never, run, 'elite', 'combat:elite:0', rng);
  assert.equal(receipt.amount, 0);
  assert.equal(run.smithingStones, 0);
  assert.equal(rng.getCounters().smith, 0, '0 is never, and rolls nothing');
  assert.equal(grantSmithingReward(never, run, 'boss', 'combat:boss:0', rng).amount, 1, 'another pool is untouched');

  const always = registriesWith({ 'smithing.rewardChancePct.elite': 100 });
  const rng100 = createRng(3);
  const run100 = freshRun(always);
  for (let i = 0; i < 20; i++) grantSmithingReward(always, run100, 'elite', `combat:elite:${i}`, rng100);
  assert.equal(run100.smithingStones, 20);
  assert.equal(rng100.getCounters().smith, 0);
});

test('a partial stone chance rolls once per door on the smith stream, and pays about that often', () => {
  const half = registriesWith({ 'smithing.rewardChancePct.elite': 50 });
  const rng = createRng(21);
  const run = freshRun(half);
  let paid = 0;
  for (let i = 0; i < 200; i++) paid += grantSmithingReward(half, run, 'elite', `combat:elite:${i}`, rng).amount;
  assert.equal(rng.getCounters().smith, 200);
  assert.ok(paid > 60 && paid < 140, `paid ${paid}/200`);
  // A duplicate claim rolls nothing and pays nothing.
  const before = rng.getCounters().smith;
  assert.equal(grantSmithingReward(half, run, 'elite', 'combat:elite:0', rng).duplicate, true);
  assert.equal(rng.getCounters().smith, before);
  // A pool that pays nothing rolls nothing, whatever its chance.
  const zero = registriesWith({ 'smithing.rewardChancePct.normal': 50 });
  const rngZero = createRng(21);
  grantSmithingReward(zero, freshRun(zero), 'normal', 'combat:normal:0', rngZero);
  assert.equal(rngZero.getCounters().smith, 0);
  // A partial chance with no stream to roll on is refused by name.
  assert.throws(() => grantSmithingReward(half, freshRun(half), 'elite', 'x'), /rng/);
});

test('treasure opens the stone door only when a treasure table pays, so shipped saves are unchanged', () => {
  assert.equal(smithingRewardPays(REG, 'treasure'), false, 'both treasure tables ship at 0: no claim is written');
  assert.equal(smithingRewardPays(REG, 'normal'), false);
  assert.equal(smithingRewardPays(REG, 'elite'), true);
  assert.equal(smithingRewardPays(registriesWith({ 'smithing.refinedRewardByPool.treasure': 1 }), 'treasure'), true);
  assert.throws(() => smithingRewardPays(REG, 'shop'), /Unknown Smithing reward pool 'shop'/);
  const registries = registriesWith({ 'smithing.rewardByPool.treasure': 2 });
  assert.equal(smithingRewardPays(registries, 'treasure'), true);
  const run = freshRun(registries);
  const receipt = grantSmithingReward(registries, run, 'treasure', smithingRewardId(run, 'treasure'), createRng(1));
  assert.equal(receipt.amount, 2);
  assert.equal(run.smithingStones, 2);
});

test('smithingRewardId keeps the combat claim id byte-for-byte and names treasure its own door', () => {
  const run = { actNumber: 2, floor: 5, mapNodeId: 'n7' };
  assert.equal(smithingRewardId(run, 'elite'), 'combat:2:5:n7:elite');
  assert.equal(smithingRewardId({ actNumber: 1, floor: 0 }, 'boss'), 'combat:1:0:unknown:boss');
  assert.equal(smithingRewardId({ ...run, legacyDungeon: { current: 'd3' } }, 'normal'), 'combat:2:5:n7:d3:normal');
  assert.equal(smithingRewardId(run, 'treasure'), 'treasure:2:5:n7');
  assert.equal(smithingRewardId({ ...run, legacyDungeon: { current: 'd3' } }, 'treasure'), 'treasure:2:5:n7:d3');
});

test('Falsify: a refined stone reward pays and survives a reload', () => {
  const registries = registriesWith({ 'smithing.refinedRewardByPool.boss': 2 });
  const run = freshRun(registries);
  const rng = createRng(5);
  const receipt = grantSmithingReward(registries, run, 'boss', 'combat:1:9:boss:boss', rng);
  assert.equal(receipt.amount, 1, 'the ordinary stone still pays');
  assert.equal(receipt.refined, 2);
  assert.equal(receipt.refinedBalanceAfter, 2);
  assert.equal(run.smithingStonesRefined, 2);
  assert.equal(rng.getCounters().smith, 0, 'shipped chance 100 rolls nothing');
  assert.deepEqual(validateRunShape(run), []);
  const reloaded = deserializeRun(serializeRun(run));
  assert.equal(reloaded.smithingStonesRefined, 2);
  initializeRunSmithing(registries, reloaded);
  assert.equal(reloaded.smithingStonesRefined, 2);
  // Same door, same chance: a failed roll pays neither purse.
  const none = registriesWith({ 'smithing.refinedRewardByPool.boss': 2, 'smithing.rewardChancePct.boss': 0 });
  const dry = freshRun(none);
  const nothing = grantSmithingReward(none, dry, 'boss', 'b', createRng(5));
  assert.equal(nothing.amount + (nothing.refined ?? 0), 0);
  assert.deepEqual(dry.smithingRewardClaims, ['b'], 'the claim is recorded though nothing paid');
  // A failed partial roll records its claim too, so a retry never rolls again.
  const half = registriesWith({ 'smithing.refinedRewardByPool.boss': 2, 'smithing.rewardChancePct.boss': 1 });
  const hrun = freshRun(half);
  const hrng = createRng(5);
  const first = grantSmithingReward(half, hrun, 'boss', 'door', hrng);
  assert.equal(hrng.getCounters().smith, 1);
  assert.ok(hrun.smithingRewardClaims.includes('door'));
  const retry = grantSmithingReward(half, hrun, 'boss', 'door', hrng);
  assert.equal(retry.duplicate, true);
  assert.equal(hrng.getCounters().smith, 1, 'the retry rolls nothing');
  assert.equal(hrun.smithingStones, first.amount);
  // A refined-only pool still pays (the ordinary table is 0 for normal fights).
  const normal = registriesWith({ 'smithing.refinedRewardByPool.normal': 1 });
  const nrun = freshRun(normal);
  assert.equal(grantSmithingReward(normal, nrun, 'normal', 'n', createRng(1)).refined, 1);
});

test('run.smithingStonesRefined rides schema 13: a fresh run writes 0, a missing or bad value is refused by name', () => {
  const run = freshRun();
  // 13 when the purse arrived; a later bump (14, SPEC §14.2) keeps it.
  assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION);
  assert.equal(run.smithingStonesRefined, 0);
  assert.deepEqual(validateRunShape(run), []);
  const { smithingStonesRefined: _gone, ...missing } = run;
  assert.ok(validateRunShape(missing).includes("missing 'smithingStonesRefined'"), 'required at schema 13');
  assert.deepEqual(validateRunShape(missing, { preRefinedStones: true }), [], 'a pre-13 save may lack it');
  assert.equal(smithingPlan(REG, run).refined, 0);
  for (const bad of [-1, 1.5, '2']) {
    const problems = validateRunShape({ ...run, smithingStonesRefined: bad });
    assert.ok(problems.some((p) => /smithingStonesRefined/.test(p)), `${JSON.stringify(bad)} refused`);
  }
});

test('refined stones are shown, not spent: the upgrade still prices in ordinary stones alone', () => {
  const run = freshRun();
  run.smithingStones = 0;
  run.smithingStonesRefined = 3;
  const plan = smithingPlan(REG, run);
  assert.equal(plan.refined, 3);
  const candidate = plan.candidates.find((row) => row.itemRef === 'armament/straightSword');
  assert.equal(candidate.affordable, false);
  assert.throws(() => commitItemUpgrade(REG, run, 'armament/straightSword'), /Insufficient Smithing Stones/);
  run.smithingStones = 1;
  commitItemUpgrade(REG, run, 'armament/straightSword');
  assert.equal(run.smithingStones, 0);
  assert.equal(run.smithingStonesRefined, 3, 'the refined purse is untouched');
  assert.doesNotThrow(() => initializeRunSmithing(REG, deserializeRun(serializeRun(run))));
});

test('the spoils row shows a refined stone, alone or beside ordinary stones', () => {
  const kinds = (receipt) => rewardPlan({ smithingStoneReceipt: receipt }).rows.map((row) => row.kind);
  assert.deepEqual(kinds({ amount: 0, refined: 1, stoneBalanceAfter: 0, refinedBalanceAfter: 1 }), ['smithingStone']);
  assert.deepEqual(kinds({ amount: 1, refined: 0, stoneBalanceAfter: 1 }), ['smithingStone']);
  assert.deepEqual(kinds({ amount: 0, refined: 0, stoneBalanceAfter: 0 }), []);
  assert.deepEqual(kinds({ amount: 0, stoneBalanceAfter: 0 }), [], 'an offer saved before refined stones existed');
});

test('the smith\'s purse line shows refined stones once the run holds any', async () => {
  const { smithSelectionModel } = await import('../src/ui/models/SmithSelectionModel.js');
  const run = freshRun();
  const plain = smithSelectionModel(REG, smithingPlan(REG, run));
  assert.doesNotMatch(plain.properties.purseLabel, /Refined/);
  run.smithingStonesRefined = 2;
  const rich = smithSelectionModel(REG, smithingPlan(REG, run));
  assert.match(rich.properties.purseLabel, /^0 Smithing Stones · 2 Refined Stones$/);
});

test('the spoils row copy names a refined stone', async () => {
  const { t } = await import('../src/ui/strings.js');
  assert.equal(t('reward.stone.refinedTitle', { amount: 2, plural: 's' }), '2 Refined Stones');
  assert.match(t('reward.stone.refinedBody', { total: 3 }), /3 refined/);
});

test('co-op treasure pays the same stone door as solo, and the catch-up names it', async () => {
  const { createSession } = await import('../tools/session.mjs');
  const { smithingStoneNote } = await import('../src/model/rewardplan.js');
  const { t } = await import('../src/ui/strings.js');
  const party = (registries) => {
    const host = createSession({ registries, seedString: 'GOLDBOUGH' });
    host.addMember({ id: 'p1', name: 'Here', classId: 'reaver' });
    host.addMember({ id: 'p2', name: 'Away', classId: 'reaver' });
    host.start();
    host.setConnected('p2', false);
    // Stand the party on a real node, dressed as treasure, as travelTo would.
    const node = host.session.mapGraph.nodes[host.session.reachableIds[0]];
    host.session.cursorId = node.id;
    host.session.floor = node.floor;
    host.resolveNode({ ...node, type: 'treasure' });
    const [here, away] = host.livingMembers();
    return { here, away, host };
  };
  // Shipped tables: no claim, no receipt, nothing written.
  const plain = party(REG);
  assert.deepEqual((plain.here.run.smithingRewardClaims || []).filter((id) => id.startsWith('coop-treasure')), []);
  assert.equal(plain.away.catchup.at(-1).smithingStoneReceipt, undefined);
  // Raised: both seats are paid, present or away, and the away seat's catch-up carries the receipt.
  const raised = party(registriesWith({ 'smithing.rewardByPool.treasure': 2, 'smithing.refinedRewardByPool.treasure': 1 }));
  assert.equal(raised.here.run.smithingStones, 2);
  assert.equal(raised.here.run.smithingStonesRefined, 1);
  assert.equal(raised.away.run.smithingStones, 2);
  const item = raised.away.catchup.at(-1);
  assert.equal(item.type, 'treasure');
  assert.equal(item.smithingStoneReceipt.amount, 2);
  assert.equal(smithingStoneNote(item.smithingStoneReceipt, t), '⚒ 2 Smithing Stone secured · 2 total · 1 Refined Stone · 1 refined');
  // The present seat sees its receipt too, on its own snapshot, until the party moves on.
  const seat = (h, id) => h.snapshot().party.find((p) => p.id === id);
  assert.equal(seat(plain.host, 'p1').treasureStoneReceipt, undefined, 'nothing paid, nothing shown');
  const shown = seat(raised.host, 'p1').treasureStoneReceipt;
  assert.equal(shown.amount, 2);
  assert.equal(shown.refined, 1);
  assert.equal(seat(raised.host, 'p2').treasureStoneReceipt, undefined, 'the away seat reads it on its catch-up instead');
  raised.host.session.scene = { kind: 'map' };
  raised.host.chooseNode('p1', raised.host.session.reachableIds[0]);
  assert.equal(seat(raised.host, 'p1').treasureStoneReceipt, undefined, 'travelling on clears the notice');
  assert.equal(smithingStoneNote(null, t), '');
  assert.equal(smithingStoneNote({ amount: 0, stoneBalanceAfter: 0 }, t), '');
});

test('the spoils row names only the purse that was paid, in its title and its body', async () => {
  const { t } = await import('../src/ui/strings.js');
  const { smithingStoneRowCopy } = await import('../src/model/rewardplan.js');
  const refinedOnly = smithingStoneRowCopy({ amount: 0, stoneBalanceAfter: 0, refined: 1, refinedBalanceAfter: 1 }, t);
  assert.equal(refinedOnly.title, '1 Refined Stone');
  assert.doesNotMatch(refinedOnly.body, /0 total/);
  assert.match(refinedOnly.body, /1 refined/);
  const ordinary = smithingStoneRowCopy({ amount: 1, stoneBalanceAfter: 3 }, t);
  assert.equal(ordinary.title, t('reward.stone.title', { amount: 1, plural: '' }));
  assert.equal(ordinary.body, t('reward.stone.body', { total: 3 }), 'an ordinary-only row reads as it always did');
  const both = smithingStoneRowCopy({ amount: 2, stoneBalanceAfter: 2, refined: 2, refinedBalanceAfter: 2 }, t);
  assert.equal(both.title, '2 Smithing Stones · 2 Refined Stones');
  assert.match(both.body, /2 total.*2 refined/);
});

test('a failed roll records its claim, and a retry rolls nothing (chance 1 and chance 0)', () => {
  const one = registriesWith({ 'smithing.rewardChancePct.elite': 1 });
  const rng = createRng(5); // seed 5's first smith draw fails a 1% roll
  const run = freshRun(one);
  const first = grantSmithingReward(one, run, 'elite', 'combat:1:3:n2:elite', rng);
  assert.equal(first.amount, 0, 'the roll failed');
  assert.equal(first.duplicate, false);
  assert.equal(rng.getCounters().smith, 1);
  assert.deepEqual(run.smithingRewardClaims, ['combat:1:3:n2:elite'], 'the claim is recorded though the roll failed');
  const retry = grantSmithingReward(one, run, 'elite', 'combat:1:3:n2:elite', rng);
  assert.equal(retry.duplicate, true);
  assert.equal(rng.getCounters().smith, 1, 'the retry rolls nothing');
  assert.equal(run.smithingStones, 0);

  const zero = registriesWith({ 'smithing.rewardChancePct.elite': 0 });
  const rng0 = createRng(5);
  const run0 = freshRun(zero);
  assert.equal(grantSmithingReward(zero, run0, 'elite', 'e', rng0).amount, 0);
  assert.deepEqual(run0.smithingRewardClaims, ['e']);
  assert.equal(grantSmithingReward(zero, run0, 'elite', 'e', rng0).duplicate, true);
  assert.equal(rng0.getCounters().smith, 0, 'chance 0 never rolls');
});

test('refined payout rows allow up to 100 in Settings', () => {
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  for (const pool of POOLS) {
    const row = rows.get(`gameConfig.balance.smithing.refinedRewardByPool.${pool}`);
    assert.equal(row.min, 0);
    assert.equal(row.max, 100);
  }
});

test('schema-11 and -12 saves load with an empty refined purse, and the v13 capture keeps its own', async () => {
  const { readFileSync } = await import('node:fs');
  const { createSaveManager, createMemoryStorage, RUN_KEY } = await import('../src/engine/save.js');
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  for (const v of ['11', '12', '13']) {
    const storage = createMemoryStorage();
    storage.setItem(RUN_KEY, corpus.versions[v].bytes);
    const run = createSaveManager(storage).loadRun(REG);
    assert.ok(run, `the schema-${v} save loads`);
    assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION);
    assert.equal(run.smithingStonesRefined, 0);
  }
  for (const v of ['11', '12']) assert.equal('smithingStonesRefined' in JSON.parse(corpus.versions[v].bytes), false, `v${v} was written without it`);
  assert.equal(JSON.parse(corpus.versions['13'].bytes).smithingStonesRefined, 0, 'v13 writes it');
});
