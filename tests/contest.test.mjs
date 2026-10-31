// Insight contests (owner, 2026-10-31; SPEC §17 Contests).
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollContest, contestPreview } from '../src/engine/contest.js';
import { attributesOf, levelOf } from '../src/engine/counterReturn.js';
const read = { attributesOf, levelOf };
import { createRng } from '../src/engine/rng.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { actorRangeKey, rangePairKey } from '../src/model/combatEngagement.js';

const caster = { kind: 'player', attributes: { intelligence: 1, wisdom: 2, dexterity: 3, constitution: 4 }, level: { level: 1 } };
const enemy = { kind: 'enemy', attributes: { wisdom: 1, constitution: 2 }, level: 1, persistentPoise: { max: 7, value: 7 } };
const stub = roll => ({ int: (stream, lo, hi) => { assert.equal(stream, 'combatContest'); assert.deepEqual([lo, hi], [1, 20]); return roll; } });
const ctx = { attributesForEntity: entity => entity.attributes };

test("owner's example: roll 5 + INT 1 + WIS 2 + rank 1 = 9 vs Poise 7 + WIS 1 + level 1 = 9 passes on the tie", () => {
  const result = rollContest({ rng: stub(5), caster, target: enemy, kind: 'mental', rank: 1, ctx, read });
  assert.equal(result.total, 9); assert.equal(result.dc, 9); assert.equal(result.passed, true);
  assert.deepEqual(result.parts, [{ id: 'intelligence', value: 1 }, { id: 'wisdom', value: 2 }]);
  assert.deepEqual(result.dcParts.map(part => part.id), ['poise', 'wisdom', 'level']);
});
test('a roll of 4 fails the same contest', () => {
  assert.equal(rollContest({ rng: stub(4), caster, target: enemy, kind: 'mental', rank: 1, ctx, read }).passed, false);
});
test('the DC reads CURRENT Poise, not the maximum', () => {
  const broken = { ...enemy, persistentPoise: { max: 7, value: 0 } };
  assert.equal(contestPreview({ caster, target: broken, kind: 'mental', rank: 1, ctx, read }).dc, 2);
  assert.equal(rollContest({ rng: stub(1), caster, target: broken, kind: 'mental', rank: 1, ctx, read }).passed, true);
});
test('physical contests use DEX + CON against CON', () => {
  const preview = contestPreview({ caster, target: enemy, kind: 'physical', rank: 2, ctx, read });
  assert.equal(preview.bonus, 3 + 4 + 2); assert.equal(preview.dc, 7 + 2 + 1);
});
test('the roll is deterministic per seed', () => {
  const roll = seed => rollContest({ rng: createRng(seed), caster, target: enemy, kind: 'mental', ctx, read }).roll;
  assert.equal(roll(42), roll(42));
});

// ---- Read Intent played from hand in a Core 2 fight --------------------------------------------------------------
const profile = resolveGameProfile('core');
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
// The combat rolls on a committed candidate copy of its rng, so a stub cannot reach it: pick the seed whose first
// `combatContest` roll is the wanted extreme instead (the stream is untouched until a contest card is played).
const seedRolling = wanted => { for (let seed = 1; seed < 500; seed++) if (wanted(createRng(seed).int('combatContest', 1, 20))) return seed; throw Error('no seed'); };
const LOW = seedRolling(roll => roll === 1), HIGH = seedRolling(roll => roll === 20);
function fight(enemyId, seed, registries = reg) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [enemyId] });
  Object.assign(combat.player, { energy: 9, mana: 9, stamina: 9 });
  return combat;
}
function play(combat) {
  combat.piles.hand.push({ instanceId: 'ri', cardId: 'base.reveal-opponent-hand', upgraded: false });
  const n = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'ri', targetId: combat.enemies[0].id });
  return combat.eventLog.slice(n).map(event => event.type);
}
for (const enemyId of ['wanderingSoldier', 'graveWisp']) {
  test(`Read Intent reveals the intent of ${enemyId} at any range and never rolls Accuracy`, () => {
    const combat = fight(enemyId, HIGH), target = combat.enemies[0];
    const band = combat.rangeState.engagements[rangePairKey(actorRangeKey(combat, combat.player), actorRangeKey(combat, target))];
    const types = play(combat);
    assert.ok(types.includes('contestPassed'), types.join());
    assert.ok(!types.includes('attackMissed') && !types.includes('attackHit'), `no hit roll (band ${band}): ${types.join()}`);
    assert.ok(!types.includes('engagementAdvanced'), 'no Advance planned');
    assert.equal(combat.rangeState.engagements[rangePairKey(actorRangeKey(combat, combat.player), actorRangeKey(combat, target))], band, 'distance unchanged');
    assert.ok(target.proposalIntentRevealedUntilByOwner?.player > 0, 'the intent is revealed');
  });
}
test('a failed contest still applies the self status, resists the reveal and emits contestFailed', () => {
  const combat = fight('wanderingSoldier', LOW), target = combat.enemies[0];
  const types = play(combat);
  assert.ok(types.includes('contestFailed'), types.join());
  assert.ok(!types.includes('intentRevealed'));
  assert.equal(target.proposalIntentRevealedUntilByOwner?.player, undefined);
  assert.equal(combat.player.statuses['base.read-intent']?.stacks, 1, 'the self status still lands');
  const event = combat.eventLog.find(row => row.type === 'contestFailed');
  assert.equal(event.passed, false); assert.equal(event.roll, 1); assert.equal(event.cardId, 'base.reveal-opponent-hand'); assert.ok(event.dc > event.total);
});
test('the same seed rolls the same contest', () => {
  const roll = () => { const c = fight('wanderingSoldier', 77); play(c); return c.eventLog.find(row => row.type.startsWith('contest')).roll; };
  assert.equal(roll(), roll());
});

// ---- log and callouts ---------------------------------------------------------------------------------------------
import { combatLogEntries } from '../src/model/combatLog.js';
import { calloutForEvent, CALLOUT_KINDS } from '../src/ui/fx.js';
import { t } from '../src/ui/strings.js';
test("the combat log shows the owner's example contest line", () => {
  const result = rollContest({ rng: stub(5), caster, target: enemy, kind: 'mental', rank: 1, ctx, read });
  const event = { type: 'contestPassed', sourceId: 'player', targetId: 'e1', contest: result, ...result };
  const [entry] = combatLogEntries([event], { registries: reg, players: [], enemies: [] });
  assert.match(JSON.stringify(entry), /Contest: d20 \[5\] \+ INT 1 \+ WIS 2 \+ rank 1 = 9 vs Poise 7 \+ WIS 1 \+ level 1 = 9 · success/);
  const failed = rollContest({ rng: stub(4), caster, target: enemy, kind: 'mental', rank: 1, ctx, read });
  const [no] = combatLogEntries([{ type: 'contestFailed', sourceId: 'player', targetId: 'e1', contest: failed, ...failed }], { registries: reg, players: [], enemies: [] });
  assert.match(JSON.stringify(no), /= 8 vs Poise 7 \+ WIS 1 \+ level 1 = 9 · failure/);
});
test('callouts: Read when it passes, Resisted when it fails', () => {
  assert.deepEqual(calloutForEvent({ type: 'contestPassed', targetId: 'e1' }), { kind: 'contestPassed', targetId: 'e1' });
  assert.deepEqual(calloutForEvent({ type: 'contestFailed', targetId: 'e1' }), { kind: 'contestFailed', targetId: 'e1' });
  assert.equal(t(CALLOUT_KINDS.contestPassed.string), 'Read');
  assert.equal(t(CALLOUT_KINDS.contestFailed.string), 'Resisted');
});

// ---- hit badge ----------------------------------------------------------------------------------------------------
import { previewCardHit } from '../src/engine/combat.js';
test('the hit preview of a contest card carries the DC and no out-of-range state, at any distance', () => {
  for (const enemyId of ['wanderingSoldier', 'graveWisp']) {
    const combat = fight(enemyId, HIGH), target = combat.enemies[0];
    combat.piles.hand.push({ instanceId: 'ri', cardId: 'base.reveal-opponent-hand', upgraded: false });
    const preview = previewCardHit(combat, 'ri', target.id, undefined, { observerId: 'player' });
    assert.equal(preview.inRange, true);
    assert.equal(preview.contest.dc, target.persistentPoise.value + (target.attributes?.wisdom || 0) + 1);
    assert.equal(preview.missReason, undefined);
  }
});
test('the badge string reads DC N', () => assert.equal(t('combat.contest.dc', { dc: 9 }), 'DC 9'));

// ---- Current / legacy profile ignores `contest` --------------------------------------------------------------------
test('on the default (Current) bundle Read Intent keeps the Accuracy roll and never touches combatContest', () => {
  const run = createRunState({ registries: createRegistries(contentBundle), classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries: createRegistries(contentBundle), run, rng: createRng(5), enemyIds: ['wanderingSoldier'] });
  Object.assign(combat.player, { energy: 9, mana: 9, stamina: 9 });
  combat.piles.hand.push({ instanceId: 'ri', cardId: 'base.reveal-opponent-hand', upgraded: false });
  const n = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'ri', targetId: combat.enemies[0].id });
  const types = combat.eventLog.slice(n).map(event => event.type);
  assert.ok(types.includes('attackHit') || types.includes('attackMissed'), types.join());
  assert.ok(!types.some(type => type.startsWith('contest')), types.join());
  assert.equal(combat.rng.getCounters().combatContest, undefined, 'combatContest stays at counter 0');
  assert.ok((combat.rng.getCounters().combatAvoidance || 0) > 0, 'Accuracy drew on combatAvoidance');
});
