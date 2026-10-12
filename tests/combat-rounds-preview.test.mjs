// Combat Rounds Preview (SPEC §4.11), phase P2: the setting row, the frozen
// rules, and the fight's `combatRounds` field, which exists only when on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigRows } from '../src/model/advancedConfig.js';
import { COMBAT_ROUNDS_KEY, combatRoundsFor, combatRoundsRows } from '../src/model/combatRounds.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { dispatch } from '../src/engine/combat.js';
import { categoryHandler } from '../src/ui/screens/settings.js';
import { advancedSection } from '../src/ui/models/AdvancedSettingsGroups.js';
import { visibleAdvancedGroups } from '../src/ui/screens/settings.js';

const registries = createRegistries(contentBundle);
const ENEMY = 'wanderingSoldier';
const fight = (run, settings = {}) => createRunCombat({ registries, rng: createRng(4242), run, enemyIds: [ENEMY], settings });

test('the preview is off by default, in the row and in the rules', () => {
  const [row] = combatRoundsRows();
  assert.equal(row.key, COMBAT_ROUNDS_KEY);
  assert.equal(row.def, false);
  assert.equal(combatRoundsFor({}), null);
  assert.equal(combatRoundsFor({ [COMBAT_ROUNDS_KEY]: false }), null);
  assert.equal(combatRoundsFor({ [COMBAT_ROUNDS_KEY]: 'yes' }), null, 'only a boolean true turns it on');
  assert.equal(combatRoundsFor(undefined), null);
});

test('on: frozen rules with the speed merge and the parsed tables', () => {
  const rules = combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true });
  assert.deepEqual({ version: rules.version, merge: rules.merge, decay: rules.decay }, { version: 1, merge: 'speed', decay: 1 });
  assert.ok(Object.isFrozen(rules) && Object.isFrozen(rules.tables));
  assert.equal(rules.tables.stanceAdvantage['smash>block'], 2);
  assert.equal(rules.tables.evasionArmor.Cloth.dexCap, 4);
  assert.equal(rules.tables.evasionCards.Backstep, 5);
  assert.equal(rules.tables.evadeBonus.evade, 20);
  assert.equal(JSON.parse(JSON.stringify(rules)).merge, 'speed', 'the rules survive a JSON save');
});

test('the row sits in Advanced → Combat, and that group is debug-only', () => {
  const row = categoryHandler('Advanced').rows.find((r) => r.key === COMBAT_ROUNDS_KEY);
  assert.ok(row, 'the row is on the Advanced screen');
  assert.equal(advancedSection(row), 'Combat');
  assert.equal(row.label, 'Combat rounds preview');
  assert.ok(advancedConfigRows(contentBundle).some((r) => r.key === COMBAT_ROUNDS_KEY));
  assert.ok(visibleAdvancedGroups(true).some((g) => g.id === 'Combat'), 'dev and test builds show the group');
  assert.ok(!visibleAdvancedGroups(false).some((g) => g.id === 'Combat'), 'a release build hides it');
});

test('rules are frozen at New Run: a later live change does not reach the fight', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true } } });
  assert.equal(run.advancedConfigSnapshot.overrides[COMBAT_ROUNDS_KEY], true);
  // The live setting is now off; the fight reads the run's own snapshot.
  const on = fight(run, { [COMBAT_ROUNDS_KEY]: false });
  assert.deepEqual(on.combatRounds.rules, combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true }));
  // A run born with the preview off stays off even if the live setting is on.
  const off = createRunState({ seed: 3, classId: 'reaver', registries, profileMeta: { settings: {} } });
  assert.equal('combatRounds' in fight(off, { [COMBAT_ROUNDS_KEY]: true }), false);
  // A run from before the row existed has no snapshot key and reads as off.
  const legacy = { ...off, advancedConfigSnapshot: undefined };
  assert.equal('combatRounds' in fight(legacy, { [COMBAT_ROUNDS_KEY]: true }), false);
});

test('combat.combatRounds is stamped only when on, with empty state', () => {
  const run = createRunState({ seed: 5, classId: 'rogue', registries, profileMeta: { settings: {} } });
  const rng = createRng(4242);
  const offCombat = createRunCombat({ registries, rng, run, enemyIds: [ENEMY], settings: {} });
  assert.equal('combatRounds' in offCombat, false, 'off: the field is absent');
  assert.equal('combatRounds' in rng.getCounters(), false, 'off: no RNG counter is written');

  const onRun = createRunState({ seed: 5, classId: 'rogue', registries, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true } } });
  const onCombat = createRunCombat({ registries, rng: createRng(4242), run: onRun, enemyIds: [ENEMY], settings: {} });
  // P3a (PREVIEW-PLAN): the fight's own round state holds the queues too. The player has no card
  // queued yet, and the creation roll has queued each enemy's hidden moves (combatRoundsAdapter.js).
  assert.deepEqual(Object.keys(onCombat.combatRounds).sort(), ['charges', 'enemyQueues', 'momentum', 'playerQueue', 'poiseDouble', 'rules']);
  assert.deepEqual({ momentum: onCombat.combatRounds.momentum, poiseDouble: onCombat.combatRounds.poiseDouble, charges: onCombat.combatRounds.charges }, { momentum: {}, poiseDouble: {}, charges: {} });
  assert.deepEqual(onCombat.combatRounds.playerQueue, []);
  assert.deepEqual(Object.keys(onCombat.combatRounds.enemyQueues), onCombat.enemies.filter((e) => e.alive).map((e) => e.id));
  assert.equal(onCombat.combatRounds.rules.version, 1);
});

// Review finding 3: a save must carry the round state. The off-mode golden below is the snapshot text
// as it was before the preview saved anything (two fights, a turn each): the preview-off save must not change.

test('a preview-off save is byte-identical to the save before the preview saved round state', () => {
  const out = [];
  for (const [seed, classId] of [[5, 'rogue'], [9, 'reaver']]) {
    const run = createRunState({ seed, classId, registries, profileMeta: { settings: {} } });
    const c = createRunCombat({ registries, rng: createRng(4242), run, enemyIds: [ENEMY], settings: {} });
    out.push(JSON.stringify(serializeCombatSnapshot(c)));
    const card = c.piles.hand.find((x) => x.cardId);
    try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.enemies[0].id }); } catch { /* an unplayable card: the save still runs */ }
    dispatch(c, { type: 'endTurn' });
    out.push(JSON.stringify(serializeCombatSnapshot(c)));
  }
  const all = out.join('\n');
  assert.ok(!all.includes('"combatRounds"'), 'no preview key is written');
  assert.equal(createHash('sha256').update(all).digest('hex'), '1940086462feac02ab33381bb753277e996f1ad7c409a100d0fa736a5462cf33');
  assert.equal(all.length, 119423);
});

test('a preview fight with queued cards saves and restores: queues and paid SP intact, End Turn works after restore', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true } } });
  const c = fight(run);
  let queued = 0;
  for (const card of [...c.piles.hand]) {
    if (queued === 2) break;
    const targetId = c.enemies.find((e) => e.alive).id;
    for (const attempt of [{ targetId }, {}]) {
      try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, ...attempt }); queued++; break; } catch { /* not playable this way */ }
    }
  }
  assert.equal(queued, 2, 'fixture: two attacks are queued');
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(c)));
  assert.ok(saved.combatRounds, 'the round record is in the save');
  const restored = restoreCombatSnapshot({ registries, rng: createRng(4242), snapshot: saved });
  assert.deepEqual(restored.combatRounds.playerQueue, c.combatRounds.playerQueue, 'the player queue survives');
  assert.deepEqual(restored.combatRounds.enemyQueues, c.combatRounds.enemyQueues, 'the enemy queues survive');
  assert.deepEqual(restored.combatRounds.momentum, c.combatRounds.momentum);
  assert.deepEqual(restored.combatRounds.rules, c.combatRounds.rules);
  assert.equal(restored.player.energy, c.player.energy, 'the paid Stamina survives');
  assert.equal(restored.player.mana, c.player.mana, 'the paid Mana survives');
  const turn = restored.turn;
  dispatch(restored, { type: 'endTurn' });
  // A player-targeted attack can pause the commit for a reaction (SPEC §4.11): Back declines it.
  while (restored.pendingReaction) dispatch(restored, { type: 'chooseReaction', offerId: restored.pendingReaction.id, optionId: null });
  assert.equal(restored.phase, 'player', 'End Turn commits the restored round and hands the turn back');
  assert.equal(restored.turn, turn + 1);
  assert.deepEqual(restored.combatRounds.playerQueue, []);
});
