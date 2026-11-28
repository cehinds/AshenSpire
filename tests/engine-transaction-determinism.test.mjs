// A seeded fight plays to the same log, state and RNG position whatever caches
// sit under the engine's per-action transaction (candidate clone, profile
// separation walk, binding queries). The pinned digests were taken before the
// transaction-cost work (docs/PERF-MOBILE-BASELINE.md fix 2); they change only
// when the rules change, never because a cache was added or removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
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
import { legacyGearProfile } from './helpers/legacy-gear.mjs';
import { LegacySpellCostBlock } from './helpers/spellCostRules.mjs';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';

// Exact resolved Dev profile at a1d31db6b5, runtime 521250500d421c9742b8877b11e395c5718e0fc218c1add1c27c85d338253772.
// Archive SHA256: 40c87e9a705457ca0504cd44677f7e1a8cb630edb6a3ff5067439af7a6ca0324.
const precedingDevProfile = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-521250.json.gz', import.meta.url))));
// Exact equipment table at a1d31db6b5; SHA256 fa0d4d53ecb59a9020a909b1f40fade5b156131f81db0a8fc7f4b3abf0989990.
const precedingEquipment = JSON.parse(readFileSync(new URL('./fixtures/pre-codex-equipment-a1d31db6.json', import.meta.url), 'utf8'));
// Exact resolved Dev profile at 6727a25530, before the stat changes and after the Codex content merge.
// Archive SHA256: ce955c3da5182f89cd1e1e78fedbb2d8f4d92be84e63569468a0cbd827de5cbd.
const incomingDevProfile = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-6727a255.json.gz', import.meta.url))));
// Genuine resolved Dev 4fc475a249 profile, with the Defend-only Smash rule and without stat traditions.
// Archive SHA256: 0c4712d1748aa2424505d5ad40f2ba354deb988cda19bdee3abb3aeeec0cfbe6.
const smashDevProfile = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-4fc475a2.json.gz', import.meta.url))));
// Genuine archived Gear parent stays unchanged; only the explicitly derived pre-Gear control below removes its type-effects opt-in.
const gearParentProfile = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/gear-profile-62323292.json.gz', import.meta.url))));
// Genuine published Dev 213 before Retreat versioning: these existing stat/Smash goldens remain historical controls.
const preRetreatProfile = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-0b11a358-profile.json.gz', import.meta.url))));
// c18f0d0cdb6 replay inputs outside the resolved profile envelope. Current
// scenarios still use the shipping table and weapon Poise rule.
const historicalDerivedStats = JSON.parse(readFileSync(new URL('./fixtures/js01-pre-equipment-derived-stat-rules.json', import.meta.url)));
// The Smash share of the target's Block that saved fights carried before the flat break.
const SAVED_SMASH_BLOCK_FRACTION = 0.25;
const legacyPoiseKeys = ['drain', 'breakRule', 'brokenDamageMultiplier', 'breakStatusStacks'];

function fight([seed, classId], archivedProfile = null, equipment = null) {
  const profile = archivedProfile ?? resolveGameProfile('default');
  const bundle = archivedProfile ? { ...contentBundle, derivedStatRules: historicalDerivedStats } : contentBundle;
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(bundle, profile)), profile);
  const run = createRunState({ registries, classId, seed });
  if (equipment) run.combatExpansionRules.equipment = structuredClone(equipment);
  // W25-BANDS legacy fixture: these digests pin the arithmetic before front/back rows, so the fight is made without the `bands` rules (as one saved before them).
  const shippedPoise = fixCoreMechanics.poise;
  // Keep the exact old fields selected by any outer legacy rule wrapper.
  if (archivedProfile) fixCoreMechanics.poise = Object.fromEntries(Object.entries(shippedPoise).filter(([key]) => legacyPoiseKeys.includes(key)));
  let combat;
  try {
    combat = withoutBands(() => createRunCombat({
      registries, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'],
      ...(archivedProfile ? { player: { poiseMax: 6 } } : {}),
    }));
  } finally {
    if (archivedProfile) fixCoreMechanics.poise = shippedPoise;
  }
  for (const enemy of combat.enemies) enemy.hp = enemy.maxHp = 5000;
  return combat;
}
function legacyFight(setup) {
  return withoutSmashOverride(withoutGearPierce(fight(setup, precedingDevProfile, precedingEquipment)));
}
function withoutGearPierce(combat) {
  // These immutable historical fixtures predate the three new Pierce snapshot fields.
  for (const key of ['builtInElements', 'skinStatus', 'earthSource']) delete combat.fixCoreRules.pierce[key];
  // ...and the Magic Adept zero Mana floor key (owner ruling 2026-11-22): a fight saved before it keeps floor 1 and its original state.
  delete combat.fixCoreRules.stance?.playerMinimumCost;
  // ...and the spell cost rule list: a fight saved before it holds the version 1 block.
  if (combat.fixCoreRules.spellCosts)
  {
    combat.fixCoreRules.spellCosts = LegacySpellCostBlock();
  }
  return withSavedSmashBlockFraction(combat);
}
function withSavedSmashBlockFraction(combat)
{
  // A fight saved before the flat Smash break still carries `blockFraction`; the engine loads and ignores it (SPEC §17).
  const { poiseFraction, ...leading } = combat.fixCoreRules.smashVsDefensive;
  combat.fixCoreRules.smashVsDefensive = {
    ...leading,
    blockFraction: SAVED_SMASH_BLOCK_FRACTION,
    poiseFraction,
  };
  return combat;
}
function preGearFight(setup, profile = legacyGearProfile(preRetreatProfile)) {
  // Explicit pre-type-effects compatibility lane. The current stat policy remains enabled.
  return withoutSmashOverride(withoutGearPierce(fight(setup, profile)));
}
function withoutSmashOverride(combat) {
  // A saved fixture from before the Defend-only Smash ruling retains its entire original state and arithmetic.
  delete combat.fixCoreRules.smashVsDefensive.defendDamageMultiplier;
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
const stateData = combat => Object.fromEntries(Object.entries(combat).filter(([key, value]) => typeof value !== 'function' && !['registries', 'rng', 'gameProfile'].includes(key)));
export function digest(combat) {
  const data = stateData(combat);
  const text = JSON.stringify({ data, rng: combat.rng.getCounters() }, replacer);
  return { log: createHash('sha256').update(JSON.stringify(combat.eventLog, replacer)).digest('hex').slice(0, 16),
    state: createHash('sha256').update(text).digest('hex').slice(0, 16), events: combat.eventLog.length, turn: combat.turn };
}

// Each pin is this test's own digest() of the fight on the shipped content; a pin moves only when rules or content move.
/** Runs `build` with the shipped rules reading as a fight saved before the Broken rule (no `poise.breakRule`): it keeps the Staggered stance. */
function withStaggeredRule(build) {
  const held = { breakRule: fixCoreMechanics.poise.breakRule, mult: fixCoreMechanics.poise.brokenDamageMultiplier };
  delete fixCoreMechanics.poise.breakRule; delete fixCoreMechanics.poise.brokenDamageMultiplier;
  try { return build(); } finally { fixCoreMechanics.poise.breakRule = held.breakRule; fixCoreMechanics.poise.brokenDamageMultiplier = held.mult; }
}
// Owner ruling 2026-11-28: saved profiles play every effects scale at 1 and Core stores 1:1 values, so every
// lane below moved; the content before the ruling with the scales on reproduces the previous pins exactly.
const LEGACY_PINNED = [
  [['PERF1', 'reaver'], { log: '1313391141c3ca3e', state: 'bb8a2b6b33a19104', events: 217, turn: 6 }],
  [[4242, 'reaver'], { log: 'a391d85098bb38fa', state: '6624163d9158cbc0', events: 217, turn: 6 }],
];
for (const [setup, expected] of LEGACY_PINNED) {
  test(`legacy-rules fight ${setup[0]}/${setup[1]} still reproduces the pre-ruling digest`, () => {
    const first = digest(play(withLegacyDefaults(() => withStaggeredRule(() => legacyFight(setup))), 5));
    assert.deepEqual(first, expected);
  });
}
const LEGACY_ROLL_BROKEN_PINNED = [
  [['PERF1', 'reaver'], { log: 'ac0f88d89d95f308', state: '5245d6b3a91ea935', events: 216, turn: 6 }],
  [[4242, 'reaver'], { log: '75c6fd6fb56d4012', state: '0473275ab3c3a1ae', events: 216, turn: 6 }],
];
for (const [setup, expected] of LEGACY_ROLL_BROKEN_PINNED) {
  test(`roll-legacy fight ${setup[0]}/${setup[1]} under the Broken rule reproduces its digest`, () => {
    assert.deepEqual(digest(play(withLegacyDefaults(() => legacyFight(setup)), 5)), expected);
  });
}
// Batch 2 (stance benefits, element identities, PR from max(INT, WIS)): these are the shipped digests before it. A fight whose rules lack those three keys
// (one created earlier) still reproduces them exactly, which is the proof that the new PINNED values below moved only through those rules.
const PRE_BATCH2_PINNED = [
  [['PERF1', 'reaver'], { log: 'c8617e1ae127b9a2', state: 'ae97ae3a40f5fbc8', events: 193, turn: 6 }],
  [[4242, 'reaver'], { log: '11d0e5df17d42044', state: '99b54120ac2f9831', events: 192, turn: 6 }],
];
for (const [setup, expected] of PRE_BATCH2_PINNED) {
  test(`pre-batch-2 fight ${setup[0]}/${setup[1]} still reproduces the digest from before the Wave 2.5 rules`, () => {
    assert.deepEqual(digest(play(withoutBatch2Rules(() => legacyFight(setup)), 5)), expected);
  });
}
// W25-F (spell costs and elemental flux): these are the shipped digests before it. A fight whose rules lack `spellCosts` and `elementFlux` still reproduces them exactly,
// which is the proof that the new PINNED values below moved only through those rules.
const PRE_W25F_PINNED = [
  [['PERF1', 'reaver'], { log: '4210e7b7a80c0e99', state: 'bc08212e09fd7bf2', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: '3e7cbed1ed799eb6', state: '9cbd0d998b791b5f', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_W25F_PINNED) {
  test(`pre-W25-F fight ${setup[0]}/${setup[1]} still reproduces the digest from before spell costs and flux`, () => {
    assert.deepEqual(digest(play(withoutSpellCostRules(() => legacyFight(setup)), 5)), expected);
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
  [['PERF1', 'reaver'], { log: '4210e7b7a80c0e99', state: '39b11233d3ca27ab', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: '3e7cbed1ed799eb6', state: '561e930618244003', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_NO_CAPS_PINNED) {
  test(`pre-no-caps fight ${setup[0]}/${setup[1]} still reproduces the digest from before statusCaps`, () => {
    assert.deepEqual(digest(play(withoutCounterStackDefaults(() => withoutStatusCapsRule(() => legacyFight(setup))), 5)), expected);
  });
}
// Recaptured 2026-11-15 for Wave 2 batch 5 (Counter stacks `counter.stackSource` and friends, no Counter-stance return): a fight whose rules lack the Counter-stack
// keys (and keep the stance's hpReturnFraction), built through withoutCounterStackDefaults, reproduces PRE_BATCH5_PINNED (the values shipped after the no-caps rule) exactly, which proves the new PINNED
// values below moved only through those rules: log, event counts and turns are identical (the Counter is never armed in these fights), only the state hashes move through the new keys in the fight's snapshot.
const PRE_BATCH5_PINNED = [
  [['PERF1', 'reaver'], { log: '4210e7b7a80c0e99', state: '4b901e721a77dbb7', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: '3e7cbed1ed799eb6', state: 'df49977a16f35ae2', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_BATCH5_PINNED) {
  test(`pre-batch-5 fight ${setup[0]}/${setup[1]} still reproduces the digest from before the Counter stack rule`, () => {
    assert.deepEqual(digest(play(withoutCounterStackDefaults(() => legacyFight(setup)), 5)), expected);
  });
}
// Recaptured 2026-11-15 for W25-EvadeCards (Quickstep joins `counter.stacksByCard`): log, event counts and turns are identical, only the state hashes move, through the new key in the fight's rules
// snapshot. Verified: a fight built through withoutQuickstepCounterStacks reproduces PRE_EVADECARDS_PINNED (the values shipped before) exactly.
const PRE_EVADECARDS_PINNED = [
  [['PERF1', 'reaver'], { log: '4210e7b7a80c0e99', state: '5ada31b6f1df3fb4', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: '3e7cbed1ed799eb6', state: '44b22877b7408468', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_EVADECARDS_PINNED) {
  test(`pre-Evade-cards fight ${setup[0]}/${setup[1]} still reproduces the digest from before Quickstep's Counter stack`, () => {
    assert.deepEqual(digest(play(withoutQuickstepCounterStacks(() => legacyFight(setup)), 5)), expected);
  });
}
// Recaptured 2026-11-17 for theme B (Counter armed while stacks remain, the Defend Poise floor, the enemy Counter badge, the Prepared/Idle stance weaknesses):
// a fight built through withoutThemeBRules reproduces PRE_THEME_B_PINNED (the values shipped before) exactly. PERF1's log moves (an Idle target takes x1.25, same
// event count and turn); 4242's log is identical and only its state hash moves, through the new keys in the fight's rules snapshot.
const PRE_THEME_B_PINNED = [
  [['PERF1', 'reaver'], { log: '4210e7b7a80c0e99', state: 'e0d50afb45a48181', events: 192, turn: 6 }],
  [[4242, 'reaver'], { log: '3e7cbed1ed799eb6', state: 'b6ddd39d6158ec1c', events: 195, turn: 6 }],
];
for (const [setup, expected] of PRE_THEME_B_PINNED) {
  test(`pre-theme-B fight ${setup[0]}/${setup[1]} still reproduces the digest from before the 2026-11-17 status and stance rules`, () => {
    assert.deepEqual(digest(play(withoutThemeBRules(() => legacyFight(setup)), 5)), expected);
  });
}
// Recaptured 2026-11-18 (owner rulings 20 and 21: Ward decay and break keys, Pierce per-stack Block, Force Poise share): the current profile's rules snapshot gained keys, so the state hashes moved; the Poise-break statuses (poise.breakStatusStacks, 2 each of Staggered, Vulnerable, Weak and Frail) add status events, so the logs and event counts moved too (192 -> 207 and 195 -> 217; the Broken x1.5 is gone too, so the hit sizes moved); turns are identical. The legacy wrappers in tests/legacyHitRules.mjs strip the new keys, so every older pin above is unchanged.
// Stat allocation: the 16 legacy-policy lanes pin their exact preceding Dev profile and equipment table. The next two lanes explicitly predate gear type effects.
// After merging Dev 6727a25530, its archived profile with live equipment reproduces both incoming Dev state pins below.
// Only their state digests move: the Poise row/base row replaces CON with WIS, its explicit override is recorded, and
// fixCoreRules.spellTraditionsVersion is added. The control below restores exactly those fields and compares the entire
// serialized state; full logs, event counts, turns and every RNG counter are unchanged. The prior current pins remain controls.
// Recaptured 2026-11-19 after the bare content Poise row returned to CON (saved runs keep it; the
// default profile overrides it with WIS): only the four current state digests moved. assertStatPolicyOnly
// and PRE_STAT_PINNED still prove logs, RNG and every non-Poise field are unchanged.
// Recaptured 2026-11-24 for Ward as a health buffer (fixCoreMechanics.ward: hpPerStack 5, routing "hpBuffer"): only the state hashes of the current/stat/Smash pins moved; every log, event count, turn, RNG counter, and all 16 legacy pins are unchanged.
const PRE_STAT_PINNED = [
  { log: '68cf1adf9990aeb4', state: 'e370309728f74bd8', events: 206, turn: 6 },
  { log: '75d969a68dc95611', state: '55ff4d68b1734dbd', events: 224, turn: 6 },
];
const PINNED = [
  [['PERF1', 'reaver'], { log: '68cf1adf9990aeb4', state: '6cf6853480b85df9', events: 206, turn: 6 }],
  [[4242, 'reaver'], { log: '75d969a68dc95611', state: 'f0ed0c49bfc48a69', events: 224, turn: 6 }],
];
function assertStatPolicyOnly(current, previous) {
  assert.deepEqual(current.eventLog, previous.eventLog, 'stat metadata changes no log payload');
  assert.deepEqual(current.rng.getCounters(), previous.rng.getCounters(), 'stat metadata changes no RNG position');
  const before = JSON.parse(JSON.stringify(stateData(previous), replacer));
  const restored = JSON.parse(JSON.stringify(stateData(current), replacer));
  for (const key of ['rules', 'baseRules']) restored.derivedStatRuleSnapshot[key].rules.poise = before.derivedStatRuleSnapshot[key].rules.poise;
  delete restored.derivedStatRuleSnapshot.modifierOverride.rules.poise;
  delete restored.fixCoreRules.spellTraditionsVersion;
  assert.equal(JSON.stringify(restored), JSON.stringify(before), 'only saved Poise ownership and the tradition flag differ');
}
for (const [index, [setup, expected]] of PINNED.entries()) {
  const seed = `${setup[0]}/${setup[1]}`;
  test(`pre-gear seeded fight ${seed} reproduces its stat-policy log, final state and RNG position`, () => {
    const current = play(preGearFight(setup), 5);
    const first = digest(current);
    const second = digest(play(preGearFight(setup), 5));
    assert.deepEqual(second, first, 'two plays of one seed agree');
    assert.ok(first.events > 40 && first.turn >= 4, 'the fight did real work');
    assert.deepEqual(first, expected, 'digest matches the pinned profile and fight rules');
    const previous = play(preGearFight(setup, incomingDevProfile), 5);
    assert.deepEqual(digest(previous), PRE_STAT_PINNED[index], 'the exact prior profile retains its entire prior digest');
    assertStatPolicyOnly(current, previous);
  });
}

// New Smash pins are additional controls; every historical array and pre-Smash pin above stays intact.
// PERF1 adds only the saved Defend multiplier. Seed4242 has one Smash into Defend: HP 25 -> 30, Poise 5 -> 5.
// That hit's HP/Poise receipts and subsequent HP snapshots change; event counts, turns and all RNG counters do not.
const SMASH_PINNED = [
  [['PERF1', 'reaver'], { log: '68cf1adf9990aeb4', state: '13377afc992154bc', events: 206, turn: 6 }, 'a8a7d26d207ba994'],
  [[4242, 'reaver'], { log: 'fdf934402c9ab224', state: 'eca16a5a508a8876', events: 224, turn: 6 }, '78e4521340e8cf4d'],
];
for (const [index, [setup, expected, incomingState]] of SMASH_PINNED.entries()) {
  test(`pre-Retreat pre-gear Smash fight ${setup[0]}/${setup[1]} matches genuine Dev and preserves pre-ruling controls`, () => {
    const current = play(withoutGearPierce(fight(setup, legacyGearProfile(preRetreatProfile))), 5);
    const incoming = play(withoutGearPierce(fight(setup, legacyGearProfile(smashDevProfile))), 5);
    assert.equal(current.fixCoreRules.smashVsDefensive.defendDamageMultiplier, 1.5);
    assert.deepEqual(digest(current), expected);
    assert.deepEqual(digest(incoming), { ...expected, state: incomingState }, 'the genuine incoming profile reproduces its Dev golden');
    assertStatPolicyOnly(current, incoming);
    const prior = play(preGearFight(setup), 5);
    assert.deepEqual(digest(prior), PINNED[index][1], 'removing only the new Smash override reproduces the exact prior stat pin');
    assert.equal(current.eventLog.length, prior.eventLog.length);
    assert.equal(current.turn, prior.turn);
    assert.deepEqual(current.rng.getCounters(), prior.rng.getCounters());
    const changedHits = current.eventLog.flatMap((event, i) => event.type === 'damageDealt' && event.hpLoss !== prior.eventLog[i].hpLoss
      ? [[prior.eventLog[i].hpLoss, event.hpLoss, prior.eventLog[i].poiseDamage, event.poiseDamage]] : []);
    assert.deepEqual(changedHits, index === 0 ? [] : [[25, 30, 5, 5]], 'only the documented Defend Smash hit changes HP and Poise');
    if (index === 0) {
      const restored = JSON.parse(JSON.stringify(stateData(current), replacer));
      delete restored.fixCoreRules.smashVsDefensive.defendDamageMultiplier;
      assert.equal(JSON.stringify(restored), JSON.stringify(JSON.parse(JSON.stringify(stateData(prior), replacer))), 'PERF1 changes only the saved Smash key');
    }
  });
}

// Incoming Dev's exact current-Smash goldens use its preceding Gear stat policy, before type effects.
// This is a derived control from the genuine archived parent, never a rewrite of that archive.
const SMASH_PARENT_PINNED = [
  [['PERF1', 'reaver'], { log: '68cf1adf9990aeb4', state: 'a8a7d26d207ba994', events: 206, turn: 6 }],
  [[4242, 'reaver'], { log: 'fdf934402c9ab224', state: '78e4521340e8cf4d', events: 224, turn: 6 }],
];
for (const [setup, expected] of SMASH_PARENT_PINNED) {
  test(`derived Gear-parent pre-type fight ${setup[0]}/${setup[1]} preserves incoming Smash goldens`, () => {
    const original = JSON.stringify(gearParentProfile);
    assert.equal(gearParentProfile.hash, 'sha256:6980a72704c52d9d4f3849ed7a5387ed513f5a37f7f83802e2ab7ceaefce47d3');
    const derived = legacyGearProfile(gearParentProfile);
    assert.equal(derived.modules.gear.typeEffectsVersion, undefined);
    assert.equal(derived.modules.effects.spellTraditionsVersion, undefined);
    const combat = withoutGearPierce(fight(setup, derived));
    assert.equal(combat.fixCoreRules.smashVsDefensive.defendDamageMultiplier, 1.5, 'the current override is active in this control');
    assert.deepEqual(digest(play(combat, 5)), expected, 'preserve the exact incoming pin, without recapture');
    assert.equal(JSON.stringify(gearParentProfile), original, 'the genuine parent profile remains untouched');
  });
}

for (const setup of [['PERF1', 'reaver'], [4242, 'reaver']]) {
  test(`current Retreat and gear seeded fight ${setup[0]}/${setup[1]} keeps real stat ownership, preview receipts and deterministic play`, () => {
    function scenario() {
      const combat = fight(setup);
      assert.equal(combat.gameProfile.modules.gear.typeEffectsVersion, 1, 'exercise current gear, not the pre-gear fixture');
      assert.equal(combat.fixCoreRules.spellTraditionsVersion, 1);
      assert.equal(combat.fixCoreRules.retreatRulesVersion, 1, 'new default fights own the Retreat opt-in');
      assert.equal(combat.fixCoreRules.smashVsDefensive.defendDamageMultiplier, 1.5, 'the full current Gear/stat lane keeps the current Smash override');
      const poise = combat.derivedStatRuleSnapshot.rules.rules.poise;
      assert.equal(poise.wisdom, 1);
      for (const id of ['constitution', 'strength', 'dexterity', 'intelligence']) assert.equal(poise[id], 0);
      assert.equal(combat.player.ratingSources.find(row => row.kind === 'attribute').poise, 1 + combat.player.attributes.wisdom, 'live attribute Poise counts effective WIS exactly once');
      assert.ok(combat.player.itemProps.cardRules.length > 0, 'current worn gear contributes real rules');
      const instanceId = 'current-gear-strike';
      combat.piles.hand.push({ instanceId, cardId: 'core.strike', upgraded: false });
      const before = digest(combat);
      const quote = previewCard(combat, instanceId, combat.enemies[0].id);
      assert.deepEqual(digest(combat), before, 'preview does not mutate combat or RNG');
      const hits = quote.values.filter(row => row.op === 'damage').flatMap(row => row.perTargetHitDamages[combat.enemies[0].id]);
      const mark = combat.eventLog.length;
      dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: combat.enemies[0].id });
      answerReactions(combat);
      const events = combat.eventLog.slice(mark);
      assert.deepEqual(events.filter(event => event.type === 'damageDealt' && event.sourceId === 'player' && event.cardInstanceId === instanceId).map(event => event.hpLoss), hits, 'the current gear quote equals every live hit');
      const paid = events.slice(0, events.findIndex(event => event.type === 'cardPlayed'));
      const spent = type => paid.filter(event => event.type === type).reduce((sum, event) => sum + event.amount, 0);
      assert.equal(spent('staminaSpent'), quote.staminaCost || 0);
      assert.equal(spent('manaSpent'), quote.manaCost || 0);
      return play(combat, 5);
    }
    const first = scenario(), second = scenario();
    assert.deepEqual(digest(second), digest(first));
    assert.deepEqual(second.eventLog, first.eventLog, 'the full current-gear logs agree');
    assert.deepEqual(second.rng.getCounters(), first.rng.getCounters());
    assert.ok(first.eventLog.length > 40 && first.turn >= 4);
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
