// A seeded fight plays to the same log, state and RNG position whatever caches
// sit under the engine's per-action transaction (candidate clone, profile
// separation walk, binding queries). The pinned digests were taken before the
// transaction-cost work (docs/PERF-MOBILE-BASELINE.md fix 2); they change only
// when the rules change, never because a cache was added or removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { withoutBands } from './legacyBandsRules.mjs';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { candidateState } from '../src/engine/combatRules.js';
import { withLegacyDefaults, withoutBatch2Rules, withoutSpellCostRules, withoutStatusCapsRule, withoutCounterStackDefaults, withoutQuickstepCounterStacks, withoutThemeBRules } from './legacyHitRules.mjs';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';

function fight([seed, classId]) {
  const profile = resolveGameProfile('default');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId, seed });
  // W25-BANDS legacy fixture: these digests pin the arithmetic before front/back rows, so the fight is made without the `bands` rules (as one saved before them).
  const combat = withoutBands(() => createRunCombat({ registries, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] }));
  for (const enemy of combat.enemies) enemy.hp = enemy.maxHp = 5000;
  return combat;
}
function answerReactions(combat) {
  for (let guard = 0; combat.pendingReaction && guard < 20; guard++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
}
function play(combat, turns) {
  for (let turn = 0; turn < turns && !combat.result; turn++) {
    answerReactions(combat);
    for (const card of [...combat.piles.hand]) {
      previewCard(combat, card.instanceId);
      try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id }); } catch { /* an unaffordable card is refused, as in play */ }
      if (combat.result) break;
    }
    if (!combat.result) dispatch(combat, { type: 'endTurn' });
    answerReactions(combat);
  }
  return combat;
}
const replacer = (key, value) => value instanceof Map ? { map: [...value] } : value;
export function digest(combat) {
  const data = Object.fromEntries(Object.entries(combat).filter(([key, value]) => typeof value !== 'function' && !['registries', 'rng', 'gameProfile'].includes(key)));
  const text = JSON.stringify({ data, rng: combat.rng.getCounters() }, replacer);
  return { log: createHash('sha256').update(JSON.stringify(combat.eventLog, replacer)).digest('hex').slice(0, 16),
    state: createHash('sha256').update(text).digest('hex').slice(0, 16), events: combat.eventLog.length, turn: combat.turn };
}

// Re-pinned 2026-10-31 after merging dev cf6417b4d9: the same fights on the dev tree
// (no transaction caches) give these digests, so the rules moved, not the caches.
// Core 2 accuracy: Precision = 1 + stat mix + stacks, Evasion = 8 + DEX + 2/stack moves the seeded hit rolls.
// Re-pinned again 2026-10-31 on merging #2430 (enemy weaknesses) with #2436 (Core 2 accuracy): both change the
// seeded fights, #2436 through the hit rolls and #2430 through the weakness damage stage (reaver rows only; turn unchanged).
// Re-pinned 2026-11-01 on merging #2434 (roll log): it adds six roll-receipt log entries per fight and
// itemised perception dcParts on the enemy's read; RNG counters, HP, turn and every other state field match dev.
// Re-pinned 2026-11-01 for Precision swift decay (accuracy.precisionDecayPerTurn 1 -> 3): the PERF1/reaver fight's hit
// chances change, so one log entry fewer (196 -> 195); log 1bb7a14785574ec3 -> c53a18793f401fb2, state 95f05cf25b2cb35a -> ff21e46141b6f702.
// The 4242/reaver fight is unchanged.
// Re-pinned 2026-11-01 for one weapon set per hand (equipSlots.csv sets 3 -> 1): the state hashes change only through the
// loadout's shape (one cell per hand, not three). Log hashes, event counts, turns and RNG counters are identical, and the same
// fights built with three-set hands (tests/withWeaponRack.mjs) reproduce the previous state hashes exactly.
// Re-pinned 2026-11-01 for the per-stat Precision receipt lines (precisionParts only; events, turn and RNG unchanged).
// Re-pinned 2026-11-01 for Core weapon arts (#2474): the Reaver's starter deck trades its class special for the
// greatsword's Sundering Hew, so both reaver fights draw and play a different card (PERF1 195 -> 197 events; turns unchanged).
// Re-pinned 2026-11-01 for Ward/Barrier as stacked statuses (SPEC 4.1a): the old numeric barrier pool is gone from
// combat state and Barrier grants are stacks, so both reaver fights' state and log hashes move; event counts and turns are unchanged.
// Combined (#2483 after #2474): Sundering Hew plus Barrier stacks; re-pinned from the merged run.
// Re-pinned 2026-11-02 for enemy intent commitment (SPEC 4.6b, fix/EnemyIntentCommit). Each fight has two turns where a
// Poise break took the Wandering Soldier's only SP: it used to show Slash/Warcry and then refuse it at act time
// (enemyActorTurnStarted + enemyMoveUnavailable + enemyMoveEnded). The intent now drops to "no move" during the player's turn,
// so the enemy turn logs one fewer event pair (event counts 197 -> 195 and 234 -> 232); turns and the RNG position are unchanged.
// Verified by diffing the two event logs: those are the only differences.
// Re-pinned 2026-11-03 for raw-hit damage previews (owner: intents and quotes show the hit before Block/Poise/Ward/Counter/Reflect/defensive
// stance): the stored enemy intent previews (hitDamages/totalDamage) carry the raw hit. Verified by running the fight on the previous engine:
// player and enemy HP, turn and every RNG counter are identical (PERF1: player 60, enemy 4903, turn 6); only the preview figures differ.
// Re-pinned 2026-11-05 for the Reach cap (maxRange): the run's range policy snapshot gains "maxRange":"reach", so the state hashes move.
// Event logs, counts, turns and RNG are identical; removing that one field from the state text reproduces the previous hashes exactly.
// Re-pinned 2026-11-06 for the enemy-turn order (fix/CombatReachPacingOrder): each move an enemy plays now emits one
// enemyStaminaSpent receipt for the SP it pays (PERF1 195 -> 198 events, 4242 232 -> 235; the receipt also carries the
// SP the enemy is due to have left, which the mid-turn plan trim reads). Turns and RNG are unchanged.
// Re-pinned 2026-11-07 for the foundation removal (cleanup 3i-B): combat state no longer carries the always-null `foundation` key.
// Logs, event counts, turns and RNG are identical; putting `foundation: null` back at its old position reproduces the previous state hashes exactly.
// Re-pinned 2026-11-07 for the skill-feat removal (cleanup P4b): combat state no longer carries the always-empty `skillFeats` list.
// Logs, event counts, turns and RNG are identical; only the state hashes move.
// Re-pinned 2026-11-08 for the enemy level budget (owner, 2026-11-07, SPEC 17): enemies are level 1-5 and carry 5 + level attribute
// points with a floor of 1 and no STR/DEX/CON offset, so their pools, Evasion and Precision differ. PERF1 198 -> 201 events; 4242
// keeps 235 events; turns are unchanged. The two plays of one seed still agree.
// Re-pinned 2026-11-14 for the 11-card Core starter decks and 2 SP Ironbreaker / Rallying Roar (SPEC 5.1, owner 2026-11-14): the
// Reaver draws and plays different cards, so both reaver logs move (PERF1 201 -> 218 events, 4242 235 -> 215; turns unchanged).
// Verified the engine did not move: with the content files of 7b6ac01016 (the starter decks, card costs and generated catalog
// from before that change) laid over this tree, the previous digests (171b2290e0e5728c/30419cc524dfe0b2 and
// 3b5d5f1e6bff1a0b/17b2a175fd3bcb97) reproduce exactly. The new values are this test's own digest() on the shipped content.
// Re-pinned 2026-11-14 for exact hits and intents (accuracy.hitRoll false, perception.roll false): no d20 is drawn for any attack and no
// perception check is made, so the combatAvoidance and intent streams stay at their start and the logs lose their roll receipts.
// Verified the engine only changed through those two keys: the same fights built with the keys absent (a fight saved before the ruling,
// LEGACY_PINNED below, built through withLegacyDefaults) reproduce the previous digests exactly. The new values are this test's own digest().
// Re-pinned 2026-11-14 for shown = dealt (W2-F): intents, card faces and reaction prompts carry the HP lost instead of the raw hit, so the stored
// intentPreview payloads in the log (and the pending-reaction incomingHp fields) change, and an offensive stance no longer grants Precision while
// accuracy.hitRoll is false. Verified on the previous engine (1f0a16daee): with the roll keys absent (the LEGACY_PINNED fights) player and enemy HP, turn,
// every RNG counter, the event types, the damage sequence and the whole log with the display keys (intentPreview, incomingHp, hitDamages, totalDamage,
// projectedDamage, hpLossBounds) removed are identical, so only the preview figures moved. The shipped fights lose exactly the Precision stance-entry
// receipts (PERF1 216 -> 195 events, 4242 211 -> 193): player and enemy HP, turn, RNG counters and the damage sequence are identical.
// 2026-11-14 (#2754): damageDealt events gained `hpRemoved` (the HP a hit actually took, for the no-overkill floater). With that one field
// removed from the three emit sites in src/engine/actions.js all four digests and the cleanup baseline reproduce their previous values exactly,
// so only the event payload moved; HP, turns, RNG counters and event counts are unchanged.
// Re-pinned 2026-11-14 for Ward as a Poise effect (W25-B): the fight's rules snapshot gains ward.poisePerStack 5, so only the state hashes move. Logs, event
// counts, turns and RNG are identical, and removing that one field from the state text reproduces all four previous state hashes exactly
// (the legacy fights' were bfab34c0ca8fef2d / aec32fc07e375e4d, the shipped fights' bea7224313f1fa40 / bde8c04ced638abb).
// Re-pinned 2026-11-14 for the Broken rule (poise.breakRule "broken", batch 1): a Poise break cancels the enemy's next action instead of taking its SP, so
// the shipped fights and the roll-legacy fights below lose the two Slash/Warcry pairs the SP loss refused (legacy-roll fights 218 -> 216 and 215 -> 214 events; shipped
// fights 195 -> 193 and 193 -> 188; turns unchanged). Verified: the fights built with `poise.breakRule` and `brokenDamageMultiplier` absent (a fight saved before the rule, STAGGERED_LEGACY
// below, which keeps the Staggered stance) reproduce the previous legacy digests exactly, and the shipped fights built that way reproduce the previous shipped logs 68045e4bda0ffd02 / 714e5d0f2a83d7e3 (218/215 events, logs aa763c4b47aaef38 / 75301c4daabf3238,
// states 1050e65e93b6c50b / 74dc222af3960b7b), so only the rule moved. The roll-legacy fights under the shipped Broken rule have their own pin.
// Recaptured 2026-11-15 for batch 3's Core card content (school-matched status riders and cantrip statuses: Pommel Strike +Weak, Driving Thrust +Bleed,
// Hammer Blow +Vulnerable, Whirlwind +Bleed, Hit and Run +Draw and others; 21 core cards in all, the Reaver's deck among them). The legacy-rules, roll-legacy
// and pre-batch-2 fights moved too, because card content is not a rule key: all eight fights play the extra effects (+4 events each, +1 for the shipped 4242 fight) and no turn moves. Verified: with only those 21 cards' content reverted to the pre-batch-3 catalog (a scratch run over the old gameProfiles.js card rows),
// all nine previous pins reproduce exactly, and every RNG counter of every fight is identical with and without the riders, so no rng stream moved.
/** Runs `build` with the shipped rules reading as a fight saved before the Broken rule (no `poise.breakRule`): it keeps the Staggered stance. */
function withStaggeredRule(build) {
  const held = { breakRule: fixCoreMechanics.poise.breakRule, mult: fixCoreMechanics.poise.brokenDamageMultiplier };
  delete fixCoreMechanics.poise.breakRule; delete fixCoreMechanics.poise.brokenDamageMultiplier;
  try { return build(); } finally { fixCoreMechanics.poise.breakRule = held.breakRule; fixCoreMechanics.poise.brokenDamageMultiplier = held.mult; }
}
// Recaptured 2026-11-17 for theme A (base damage halved through the profile's effects module, player HP 30 + 5 x (CON + level), SP and MP at 3 points,
// gear granting attribute points and Poise instead of AR and DR): these are profile content, not fight rule keys, so every fight below plays them and
// every pin moved (logs, event counts and states); no turn moved. The layered relations still hold: the pre-W25-F, pre-no-caps, pre-batch-5,
// pre-Evade-cards and pre-theme-B fights share one log per seed and differ only in state, as before.
// Recaptured 2026-11-17 after the balance review tuned Core's pool thresholds, starter gear and tier HP.
// Recaptured 2026-11-18 for the owner's balance ruling (player and enemy damage x0.7, Block gain x0.7, enemy HP 70%, spell Poise damage x2): profile content again,
// so every pin moved by its log and state hashes (a few by one event); the turns did not.
// Recaptured 2026-11-18 (second cut, owner's playtest): physicalDamageMultiplier 0.7 and blockGainMultiplier 0.49 are profile content too, so all pins moved by log
// and state hashes (event counts and turns unchanged). Measured with this test's own digest(), not derived.
// Recaptured 2026-11-18 on the merge of the physical cut with the ratings removal (STR, DEX and magic stat replace AR, DR and PR; the runtime hash moved): every
// pin moved by log and state hashes (a few by event count); no turn moved. Measured with this test's own digest().
// `fight` resolves the current profile for every lane; the legacy wrappers change only the fight policy.
// RNG counters, event types, event counts and turns are unchanged. The exact pre-tuning resolved profile
// from 174714e7d8 still reproduces all 18 previous digests in this engine.
const LEGACY_PINNED = [
  [['PERF1', 'reaver'], { log: '043a5a703a60ea25', state: 'e4a474076da71729', events: 218, turn: 6 }],
  [[4242, 'reaver'], { log: '9ff413b4a033ed60', state: 'd5e282191305ba60', events: 217, turn: 6 }],
];
for (const [setup, expected] of LEGACY_PINNED) {
  test(`legacy-rules fight ${setup[0]}/${setup[1]} still reproduces the pre-ruling digest`, () => {
    const first = digest(play(withLegacyDefaults(() => withStaggeredRule(() => fight(setup))), 5));
    assert.deepEqual(first, expected);
  });
}
const LEGACY_ROLL_BROKEN_PINNED = [
  [['PERF1', 'reaver'], { log: '612ddfa7123fefc8', state: 'caa6e16319dc601f', events: 217, turn: 6 }],
  [[4242, 'reaver'], { log: 'bfcabd7e3d38650f', state: '4486ab98ce19f123', events: 217, turn: 6 }],
];
for (const [setup, expected] of LEGACY_ROLL_BROKEN_PINNED) {
  test(`roll-legacy fight ${setup[0]}/${setup[1]} under the Broken rule reproduces its digest`, () => {
    assert.deepEqual(digest(play(withLegacyDefaults(() => fight(setup)), 5)), expected);
  });
}
// Batch 2 (stance benefits, element identities, PR from max(INT, WIS)): these are the shipped digests before it. A fight whose rules lack those three keys
// (one created earlier) still reproduces them exactly, which is the proof that the new PINNED values below moved only through those rules.
const PRE_BATCH2_PINNED = [
  [['PERF1', 'reaver'], { log: '9b3e2e103e9b101c', state: '907289a2c8a6d1d0', events: 194, turn: 6 }],
  [[4242, 'reaver'], { log: '2e2fa954b17c070b', state: '4835048ad7cc9191', events: 196, turn: 6 }],
];
for (const [setup, expected] of PRE_BATCH2_PINNED) {
  test(`pre-batch-2 fight ${setup[0]}/${setup[1]} still reproduces the digest from before the Wave 2.5 rules`, () => {
    assert.deepEqual(digest(play(withoutBatch2Rules(() => fight(setup)), 5)), expected);
  });
}
// W25-F (spell costs and elemental flux): these are the shipped digests before it. A fight whose rules lack `spellCosts` and `elementFlux` still reproduces them exactly,
// which is the proof that the new PINNED values below moved only through those rules.
const PRE_W25F_PINNED = [
  [['PERF1', 'reaver'], { log: 'ee15e03206874c64', state: '3778640922ac8365', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: 'c99481caa4307bad', state: 'e0eb0aaf0976b400', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_W25F_PINNED) {
  test(`pre-W25-F fight ${setup[0]}/${setup[1]} still reproduces the digest from before spell costs and flux`, () => {
    assert.deepEqual(digest(play(withoutSpellCostRules(() => fight(setup)), 5)), expected);
  });
}
// Recaptured 2026-11-15 for W25-F: PRE_W25F_PINNED above reproduces the previous digests with the two keys removed (and the legacy and pre-batch-2 fights above, built through helpers that remove them too, are unchanged). Logs, event counts, turns and RNG are identical, so only the state hashes move (the fight's rules snapshot gains the two blocks).
// Recaptured 2026-11-15 for batch 4 (Ward routing `ward.routing`, `spellCosts.manaOnlyTag`): log, event counts, turns and RNG are identical (PERF1 194, 4242 195 events), only the
// state hashes move, through the two rule keys in the fight's snapshot. Verified: the pre-W25-F fights above are built with ward.routing, spellCosts and elementFlux removed and reproduce
// the pre-batch-4 digests exactly, as do the legacy, roll-legacy and pre-batch-2 fights (their helpers in tests/legacyHitRules.mjs now remove ward.routing too).
// Recaptured 2026-11-15 for the no-max-stack rule (`statusCaps: "none"`, W25-NC): log, event counts, turns and RNG are identical, only the state hashes move, through the new key in the fight's
// rules snapshot. Verified: PRE_NO_CAPS_PINNED below (the previous shipped values) is reproduced exactly by the shipped rules with `statusCaps` and the Counter-stack keys removed, as are the legacy, roll-legacy,
// pre-batch-2 and pre-W25-F fights (their helpers in tests/legacyHitRules.mjs remove them too).
const PRE_NO_CAPS_PINNED = [
  [['PERF1', 'reaver'], { log: 'ee15e03206874c64', state: 'a3ae2b004b605840', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: 'c99481caa4307bad', state: '3be7db7eb4111056', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_NO_CAPS_PINNED) {
  test(`pre-no-caps fight ${setup[0]}/${setup[1]} still reproduces the digest from before statusCaps`, () => {
    assert.deepEqual(digest(play(withoutCounterStackDefaults(() => withoutStatusCapsRule(() => fight(setup))), 5)), expected);
  });
}
// Recaptured 2026-11-15 for Wave 2 batch 5 (Counter stacks `counter.stackSource` and friends, no Counter-stance return): a fight whose rules lack the Counter-stack
// keys (and keep the stance's hpReturnFraction), built through withoutCounterStackDefaults, reproduces PRE_BATCH5_PINNED (the values shipped after the no-caps rule) exactly, which proves the new PINNED
// values below moved only through those rules: log, event counts and turns are identical (the Counter is never armed in these fights), only the state hashes move through the new keys in the fight's snapshot.
const PRE_BATCH5_PINNED = [
  [['PERF1', 'reaver'], { log: 'ee15e03206874c64', state: '0c05291748f63d68', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: 'c99481caa4307bad', state: '7759fd61e3377468', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_BATCH5_PINNED) {
  test(`pre-batch-5 fight ${setup[0]}/${setup[1]} still reproduces the digest from before the Counter stack rule`, () => {
    assert.deepEqual(digest(play(withoutCounterStackDefaults(() => fight(setup)), 5)), expected);
  });
}
// Recaptured 2026-11-15 for W25-EvadeCards (Quickstep joins `counter.stacksByCard`): log, event counts and turns are identical, only the state hashes move, through the new key in the fight's rules
// snapshot. Verified: a fight built through withoutQuickstepCounterStacks reproduces PRE_EVADECARDS_PINNED (the values shipped before) exactly.
const PRE_EVADECARDS_PINNED = [
  [['PERF1', 'reaver'], { log: 'ee15e03206874c64', state: '1199b444d81c832e', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: 'c99481caa4307bad', state: '49f37cd3b4bb898b', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_EVADECARDS_PINNED) {
  test(`pre-Evade-cards fight ${setup[0]}/${setup[1]} still reproduces the digest from before Quickstep's Counter stack`, () => {
    assert.deepEqual(digest(play(withoutQuickstepCounterStacks(() => fight(setup)), 5)), expected);
  });
}
// Recaptured 2026-11-17 for theme B (Counter armed while stacks remain, the Defend Poise floor, the enemy Counter badge, the Prepared/Idle stance weaknesses):
// a fight built through withoutThemeBRules reproduces PRE_THEME_B_PINNED (the values shipped before) exactly. PERF1's log moves (an Idle target takes x1.25, same
// event count and turn); 4242's log is identical and only its state hash moves, through the new keys in the fight's rules snapshot.
const PRE_THEME_B_PINNED = [
  [['PERF1', 'reaver'], { log: 'ee15e03206874c64', state: '6787a46a046217ff', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: 'c99481caa4307bad', state: '840ad55377faa4cb', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_THEME_B_PINNED) {
  test(`pre-theme-B fight ${setup[0]}/${setup[1]} still reproduces the digest from before the 2026-11-17 status and stance rules`, () => {
    assert.deepEqual(digest(play(withoutThemeBRules(() => fight(setup)), 5)), expected);
  });
}
// Recaptured 2026-11-18 (owner rulings 20 and 21: Ward decay and break keys, Pierce per-stack Block, Force Poise share): the current profile's rules snapshot gained keys, so the state hashes moved; the Poise-break statuses (poise.breakStatusStacks, 2 each of Staggered, Vulnerable, Weak and Frail) add status events, so the logs and event counts moved too (192 -> 212 and 195 -> 227; the Broken x1.5 is gone too, so the hit sizes moved); turns are identical. The legacy wrappers in tests/legacyHitRules.mjs strip the new keys, so every older pin above is unchanged.
const PINNED = [
  [['PERF1', 'reaver'], { log: 'dfa0f981204d76f0', state: '5e1a1d0983839003', events: 212, turn: 6 }],
  [[4242, 'reaver'], { log: 'bf8e894297eefd4d', state: 'f0b8751ca19eb346', events: 227, turn: 6 }],
];
for (const [setup, expected] of PINNED) {
  const seed = `${setup[0]}/${setup[1]}`;
  test(`seeded fight ${seed} reproduces its log, final state and RNG position`, () => {
    const first = digest(play(fight(setup), 5));
    const second = digest(play(fight(setup), 5));
    assert.deepEqual(second, first, 'two plays of one seed agree');
    assert.ok(first.events > 40 && first.turn >= 4, 'the fight did real work');
    assert.deepEqual(first, expected, 'digest matches the pinned profile and fight rules');
  });
}

test('the shared-profile decision follows the live state, not an earlier answer', () => {
  const combat = fight(['PERF1', 'reaver']);
  assert.equal(candidateState(combat, { detached: true }).gameProfile, combat.gameProfile, 'a private profile is shared');
  const key = Object.keys(combat.gameProfile.modules).find(name => combat.gameProfile.modules[name] && typeof combat.gameProfile.modules[name] === 'object');
  combat.leakedModule = combat.gameProfile.modules[key];
  const aliased = candidateState(combat, { detached: true });
  assert.notEqual(aliased.gameProfile, combat.gameProfile, 'state now aliasing a profile node is cloned with it');
  assert.equal(aliased.leakedModule, aliased.gameProfile.modules[key], 'the alias survives inside the clone');
  delete combat.leakedModule;
  assert.equal(candidateState(combat, { detached: true }).gameProfile, combat.gameProfile, 'removing the alias shares again');
});
