// Combat preview toggles (SPEC §4.11, owner decision 2026-10-12): three independent Advanced → Combat toggles,
// all off by default and frozen at New Run: rounds mode, momentum and the multi-action preview.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { cardKind } from '../src/model/tree.js';
import { advancedConfigRows } from '../src/model/advancedConfig.js';
import { COMBAT_ROUNDS_KEY, MOMENTUM_KEY, MULTI_ACTION_KEY, combatRoundsFor, combatRoundsRows, normalPreviewFor } from '../src/model/combatRounds.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { categoryHandler } from '../src/ui/screens/settings.js';
import { advancedSection } from '../src/ui/models/AdvancedSettingsGroups.js';
import { visibleAdvancedGroups } from '../src/ui/screens/settings.js';

const registries = createRegistries(contentBundle);
const ENEMY = 'wanderingSoldier';
const fight = (run, settings = {}) => createRunCombat({ registries, rng: createRng(4242), run, enemyIds: [ENEMY], settings });
const runWith = (settings, seed = 5) => createRunState({ seed, classId: 'reaver', registries, profileMeta: { settings } });

test('three toggles sit in Advanced → Combat, all off by default, and the group is debug-only', () => {
  const rows = combatRoundsRows();
  assert.deepEqual(rows.map((r) => r.key), [COMBAT_ROUNDS_KEY, MOMENTUM_KEY, MULTI_ACTION_KEY]);
  assert.deepEqual(rows.map((r) => r.def), [false, false, false]);
  assert.equal(COMBAT_ROUNDS_KEY, 'gameConfig.combatRounds.preview', 'the existing rounds toggle keeps its key');
  for (const row of rows) {
    assert.equal(row.cat, 'Advanced');
    assert.equal(row.advancedGroup, 'Combat');
    assert.ok(categoryHandler('Advanced').rows.some((r) => r.key === row.key), `${row.key} is on the Advanced screen`);
    assert.equal(advancedSection({ key: row.key, advancedGroup: 'Combat' }), 'Combat');
    assert.ok(advancedConfigRows(contentBundle).some((r) => r.key === row.key), `${row.key} is a frozen Advanced row`);
  }
  assert.ok(visibleAdvancedGroups(true).some((g) => g.id === 'Combat'), 'dev and test builds show the group');
  assert.ok(!visibleAdvancedGroups(false).some((g) => g.id === 'Combat'), 'a release build hides it, as before');
});

test('the rules read each toggle on its own: nothing on, or only one of them, turns on another', () => {
  assert.equal(combatRoundsFor({}), null);
  assert.equal(normalPreviewFor({}), null, 'normal combat: both toggles off means no preview state');
  assert.equal(normalPreviewFor(undefined), null);
  assert.deepEqual({ ...normalPreviewFor({ [MOMENTUM_KEY]: true }) }, { momentum: true, multiAction: false });
  assert.deepEqual({ ...normalPreviewFor({ [MULTI_ACTION_KEY]: true }) }, { momentum: false, multiAction: true });
  assert.equal(normalPreviewFor({ [MOMENTUM_KEY]: 'yes' }), null, 'only a boolean true turns a toggle on');
  assert.equal(normalPreviewFor({ [COMBAT_ROUNDS_KEY]: true, [MOMENTUM_KEY]: true }), null, 'rounds mode carries its own toggles');
  const rounds = combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true });
  assert.equal(rounds.momentum, false, 'rounds mode alone: momentum is off');
  assert.equal(rounds.followUps, false, 'rounds mode alone: follow-ups are off');
  const both = combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true, [MOMENTUM_KEY]: true, [MULTI_ACTION_KEY]: true });
  assert.deepEqual([both.momentum, both.followUps], [true, true]);
  assert.equal(combatRoundsFor({ [MOMENTUM_KEY]: true, [MULTI_ACTION_KEY]: true }), null, 'the other two do not turn rounds on');
});

test('the three toggles are frozen at New Run: a later live change does not reach the fight', () => {
  const run = runWith({ [MOMENTUM_KEY]: true, [MULTI_ACTION_KEY]: true });
  assert.equal(run.advancedConfigSnapshot.overrides[MOMENTUM_KEY], true);
  assert.equal(run.advancedConfigSnapshot.overrides[MULTI_ACTION_KEY], true);
  const c = fight(run, { [MOMENTUM_KEY]: false, [MULTI_ACTION_KEY]: false });
  assert.deepEqual({ ...c.normalPreview, state: undefined }, { momentum: true, multiAction: true, state: undefined });
  const off = fight(runWith({}), { [MOMENTUM_KEY]: true, [MULTI_ACTION_KEY]: true });
  assert.equal('normalPreview' in off, false, 'a run born with both off stays off even if the live settings are on');
  const legacy = { ...runWith({}), advancedConfigSnapshot: undefined };
  assert.equal('normalPreview' in fight(legacy, { [MOMENTUM_KEY]: true }), false, 'a run from before the rows reads as off');
});

test('all toggles off: the fight and its save carry no preview key', () => {
  const c = fight(runWith({}));
  assert.equal('normalPreview' in c, false);
  assert.equal('combatRounds' in c, false);
  assert.ok(!JSON.stringify(serializeCombatSnapshot(c)).includes('normalPreview'));
});

test('a normal fight with a toggle on saves and restores its preview state', () => {
  const c = fight(runWith({ [MOMENTUM_KEY]: true }));
  assert.deepEqual(c.normalPreview.state, { momentum: {}, poiseDouble: {}, pending: {} });
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(c)));
  assert.ok(saved.normalPreview, 'the save carries the toggles');
  const restored = restoreCombatSnapshot({ registries, rng: createRng(4242), snapshot: saved });
  assert.deepEqual(restored.normalPreview, c.normalPreview);
});

// Every combatant roll reads 0.999 (a natural 20 and d4 4: every attack lands), as in combat-rounds-live.test.mjs.
function everyAttackLands(c) {
  const base = c.rng;
  c.rng = new Proxy(base, {
    get(target, key) {
      if (key === 'float') return (stream) => (stream === 'combatRounds' ? 0.999 : target.float(stream));
      const v = target[key];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return c;
}

// Three turns: each turn plays the first attack that can be played on the first living enemy, then End Turn commits.
function playThreeTurns(c) {
  for (let turn = 0; turn < 3 && !c.result; turn++) {
    const target = c.enemies.find((e) => e.alive);
    const attacks = c.piles.hand.filter((x) => cardKind(resolveCard(registries, x)) === 'attack');
    for (const x of attacks) {
      try { dispatch(c, { type: 'playCard', cardInstanceId: x.instanceId, targetId: target?.id }); break; } catch { /* not playable */ }
    }
    dispatch(c, { type: 'endTurn' });
    while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  }
  return c;
}

// One turn: the player's attack lands on the enemy, which plays a non-attack move (warcry) this round.
function oneLandedAttack(c) {
  for (const e of c.enemies.filter((x) => x.alive)) c.combatRounds.enemyQueues[e.id] = [{ moveId: 'warcry', sp: 1 }];
  const attacks = c.piles.hand.filter((x) => cardKind(resolveCard(registries, x)) === 'attack');
  const played = attacks.some((card) => {
    try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.enemies[0].id }); return true; } catch { return false; }
  });
  assert.ok(played, 'the hand holds an attack that targets the enemy');
  dispatch(c, { type: 'endTurn' });
  while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  return c;
}

test('rounds mode with momentum off keeps every enemy at 0, though the same landed attack moves it when the toggle is on', () => {
  const off = oneLandedAttack(everyAttackLands(fight(runWith({ [COMBAT_ROUNDS_KEY]: true }))));
  assert.equal(off.combatRounds.rules.momentum, false);
  assert.deepEqual(off.combatRounds.momentum, {}, 'momentum stays frozen at 0');
  assert.deepEqual(off.combatRounds.poiseDouble, {}, 'no overflow flag either');
  // Control: the same landed attack with the toggle on moves momentum, so the frozen result is the toggle's doing.
  const on = oneLandedAttack(everyAttackLands(fight(runWith({ [COMBAT_ROUNDS_KEY]: true, [MOMENTUM_KEY]: true }))));
  assert.ok(Object.values(on.combatRounds.momentum).some((m) => m !== 0), 'with momentum on, the landed attack moves it');
});
