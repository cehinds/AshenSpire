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

// Enemy weaknesses (SPEC 5.3) add one field to each saved enemy record and change the fight's damage numbers; the historical bytes are
// compared with that approved field removed, so the guard still sees any other save change.
const savedBytes = combat => {
  const snapshot = serializeCombatSnapshot(combat);
  for (const enemy of snapshot.enemies) delete enemy.weaknesses;
  return JSON.stringify(snapshot);
};
test('preview-off saves preserve historical bytes apart from approved event metadata', () => {
  const out = [];
  for (const [seed, classId] of [[5, 'rogue'], [9, 'reaver']]) {
    const run = createRunState({ seed, classId, registries, profileMeta: { settings: {} } });
    const c = createRunCombat({ registries, rng: createRng(4242), run, enemyIds: [ENEMY], settings: {} });
    out.push(savedBytes(c));
    const card = c.piles.hand.find((x) => x.cardId);
    try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.enemies[0].id }); } catch { /* an unplayable card: the save still runs */ }
    dispatch(c, { type: 'endTurn' });
    out.push(savedBytes(c));
  }
  const all = out.join('\n');
  assert.ok(!all.includes('"combatRounds"'), 'no preview key is written');
  // Re-recorded for the cost formula and the 3-SP stat enemy pool (SPEC §4.3a, §4.6a; owner 2026-10-12): the saved
  // costs and the enemy's planned moves changed. The previous hash came from the replaced stance-table rule.
  // Re-recorded again for the retuned Wandering Soldier (2 SP, HP 31-36, Slash 8; owner 2026-10-13: harder normals).
  // Re-recorded at the origin/dev merge of 2026-10-13: dev's new save fields (reaction rules version 2, enemyReaction
  // stream) and the re-priced cards change the text. The "no preview key" check above is what guards the off mode.
  // Re-recorded at the origin/dev merge 1ab0ff716 (#1945): the saved event log gains moveId on the enemy move's events
  // and triggeredBy on a relic's status; every other byte is the 18560cde5 save.
  // Re-recorded from ae2899cf CI for the stance continuation: ordinary fight
  // saves now carry stance entry, Accuracy and round-start Evasion receipts.
  // Both SHAs re-recorded 2026-11-01 for one weapon set per hand (equipSlots.csv sets 3 -> 1): the saved loadout's hand
  // arrays hold one cell, not three. Nothing else moved: the same fights built with three-set hands
  // (tests/withWeaponRack.mjs) reproduce the previous SHAs exactly.
  // The exact SHA commits to every byte, including the saved text's length.
  // Base abilities add three empty per-combat bookkeeping maps. Independently
  // compared with origin/dev 37c414acd: these are the only twelve differences
  // across the four snapshots; removing exactly those fields preserves its SHA.
  // Compared independently with actual Dev eb6: the only changes are ten
  // public intent/action receipt keys on six actor/move events. Normalize only
  // those approved event fields to retain both historical snapshot goldens.
  let receiptKeys = 0;
  const previousTotals = [], endedMoves = [], rawCompatible = [], metadataCompatible = [];
  // Ward and Barrier (SPEC 4.1a, 2026-11-01): the numeric `barrier` field is gone and Barrier is a status. Normalize ONLY that, per entity:
  // re-insert `barrier` (the last Barrier gain's total, else 0) after `persistentPoise` (the historical key order), and remove the `barrier` status, its Poise bonus and its
  // `statusApplied` receipts. Anything else that differs still breaks the byte checks below.
  const withoutBarrierStatus = snapshot => {
    for (const entity of [snapshot.player, ...snapshot.enemies]) {
      assert.ok(!('barrier' in entity), 'the numeric barrier field is no longer saved');
      // The historical pool held the last Barrier gain's total (it was cleared only at its owner's turn start).
      const gains = snapshot.eventLog.filter(event => event.type === 'barrierGained' && event.targetId === entity.id);
      const pooled = gains.length ? gains.at(-1).total : 0;
      delete entity.statuses?.barrier;
      const pool = entity.persistentPoise;
      if (pool?.barrierBonus) { pool.max -= pool.barrierBonus; pool.value = Math.max(0, pool.value - pool.barrierBonus); delete pool.barrierBonus; }
      const keys = Object.keys(entity), at = keys.indexOf('persistentPoise');
      const rebuilt = {};
      keys.forEach((key, i) => { rebuilt[key] = entity[key]; if (i === at) rebuilt.barrier = pooled; });
      for (const key of keys) delete entity[key];
      Object.assign(entity, rebuilt);
    }
    snapshot.eventLog = snapshot.eventLog.filter(event => !(event.type === 'statusApplied' && event.status === 'barrier'));
    return snapshot;
  };
  const compatible = out.map(text => {
    const snapshot = withoutBarrierStatus(JSON.parse(text));
    snapshot.eventLog = snapshot.eventLog.filter(event => {
      if (event.type !== 'enemyMoveEnded') return true;
      assert.deepEqual(Object.keys(event).sort(), ['moveId', 'sourceId', 'type'], 'the additive lifecycle receipt has only its event name, actor and consumed move');
      assert.equal(event.sourceId, snapshot.enemies[0].id);
      assert.equal(typeof event.moveId, 'string');
      endedMoves.push([event.sourceId, event.moveId]);
      return false;
    });
    rawCompatible.push(JSON.stringify(snapshot));
    // #2260's additive status receipt records the pre-grant total. Verify
    // every occurrence before excluding only that field from prior goldens.
    for (const event of snapshot.eventLog) {
      if (event.type === 'statusApplied') {
        assert.ok(Number.isInteger(event.previousTotal) && event.previousTotal >= 0);
        previousTotals.push(event.previousTotal);
        delete event.previousTotal;
      } else assert.equal(Object.hasOwn(event, 'previousTotal'), false, 'before-total metadata belongs only to statusApplied');
    }
    metadataCompatible.push(JSON.stringify(snapshot));
    for (const event of snapshot.eventLog) {
      if (event.type === 'enemyActorTurnStarted') {
        assert.equal(event.intentPreview?.moveId, event.moveId);
        assert.equal(event.intentPreview?.revealed, true);
        assert.equal(event.intentPreview?.hidden, false);
        assert.equal(typeof event.intentPreview?.moveId, 'string');
        delete event.intentPreview; receiptKeys++;
      } else if (event.type === 'enemyMoveStarted') {
        assert.equal(event.intentPreview?.moveId, event.moveId);
        assert.equal(event.intentPreview?.revealed, true);
        assert.equal(event.intentPreview?.hidden, false);
        assert.equal(event.actionPreview?.moveId, event.moveId);
        delete event.intentPreview; delete event.actionPreview; receiptKeys += 2;
      }
    }
    return snapshot;
  });
  assert.equal(previousTotals.length, 6, 'the four snapshots carry exactly six status before-total receipts');
  assert.deepEqual(previousTotals, [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(endedMoves, [['e1', 'warcry'], ['e1', 'guard'], ['e1', 'warcry'], ['e1', 'guard']],
    'only the consumed-move lifecycle events are removed from the historical snapshots');
  assert.equal(createHash('sha256').update(rawCompatible.join('\n')).digest('hex'), 'e7426f174a65ae5a26e2cc29f2e050325d27245eeb3c62a9d0a3211a9ef70945',
    'filtering only the four verified additive lifecycle events retains the raw historical snapshots');
  assert.equal(createHash('sha256').update(metadataCompatible.join('\n')).digest('hex'), '93d6eabd4472b4de11b457a57e8c4c99add1302cd654db0a31b5d4334086b1ae',
    'removing only the six approved status fields retains the previous complete snapshot golden');
  assert.equal(receiptKeys, 10, 'two actor and four move events carry the approved metadata');
  const compatibleText = compatible.map(snapshot => JSON.stringify(snapshot)).join('\n');
  assert.equal(createHash('sha256').update(compatibleText).digest('hex'), '58ef3e9185a370136aef73c4b5e0729017a0a81826fa74761f04d066b82cab64');
  const legacyText = compatible.map(snapshot => {
    for (const key of ['typePlays', 'instanceUsesCombat', 'cardUsesCombat']) {
      assert.deepEqual(snapshot.player.abilityRiders[key], {});
      delete snapshot.player.abilityRiders[key];
    }
    return JSON.stringify(snapshot);
  }).join('\n');
  assert.equal(createHash('sha256').update(legacyText).digest('hex'), '7470d1798b70c40051fa756e26725ed42fe62f358863a30a9f332f6e7469d1ae');
  // The raw historical golden includes the six previousTotal receipts; the
  // additive end events above are checked by exact shape and move identity.
  assert.equal(rawCompatible.join('\n').length, 137217);
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
