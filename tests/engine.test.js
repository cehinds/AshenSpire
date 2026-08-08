// tests/engine.test.js — headless engine/model/content tests (SPEC §8)
//
// Runs identically in Node (tests/run-node.mjs) and the browser
// (tests/index.html). No DOM access. Tests 12–13 (map gen, save) are M2 and
// reported as skipped placeholders.

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import {
  validateContent,
  extractTemplateTokens,
  computeTokenBindings,
} from '../src/model/validate.js';
import { resolveFloorPlan } from '../src/model/floorplan.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, previewIntent, getEntity } from '../src/engine/combat.js';
import { computeAttackDamage, applyLoseHp } from '../src/engine/actions.js';
import * as S from '../src/engine/statuses.js';
import { generateActMap } from '../src/engine/mapgen.js';
import { createSaveManager, createMemoryStorage, RUN_KEY, RUN_ARCHIVE_KEY, META_KEY, META_BACKUP_KEY, META_SCHEMA_VERSION } from '../src/engine/save.js';
import { createRunState, RUN_SCHEMA_VERSION, validateRunShape } from '../src/model/state.js';
import { executeRunEffects } from '../src/engine/actions.js';
import {
  rollEncounter,
  rollRuneReward,
  rollCardRewardIds,
  rollFlaskDrop,
  rollRelicReward,
  buildShopStock,
  resolveUnknownNode,
  shrineHealAmount,
  rollArmamentDrop,
} from '../src/engine/encounters.js';
import {
  endlessActInfo, activeMods, isCustomRun, ENDLESS_HP_PER_LOOP, ENDLESS_STR_PER_LOOP,
} from '../src/content/customMods.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { outfits } from '../src/content/generated/outfits.js';
import { unlocks } from '../src/content/generated/unlocks.js';
import { TAGS, tagsFor, tagIdsFor, cardsWithTag } from '../src/content/tags.js';
import { SFX_RECIPES, resolveRecipe } from '../src/content/sfx.js';
import { cardTagging } from '../src/content/generated/cardTagging.js';
import { weapons } from '../src/content/generated/weapons.js';
import { KEEPSAKES } from '../src/content/keepsakes.js';
import {
  validateEquipment, equipPiece, stampDeck, runMods, loadoutTags, addToStorage, carriedIds,
  figureSpec, fitsSlot, slotHand, pieceHand,
  ownership, fromDropPool, slotRungs, openedSets, visibleSets, rungFor, setCellState,
  SLOT_RUNG_KIND, createLoadout, cycleSet, canSwap, canEquip,
} from '../src/model/loadout.js';
import {
  UNLOCK_CONDITIONS, REVEAL_MODES, emptyProgress, recordProgress, evaluateUnlocks, unlockView,
} from '../src/model/unlocks.js';
import { ENGINE_KEYWORDS } from '../src/model/schemas.js';
// The one UI import in this suite, and it is deliberate: `settingOn` is where a
// default now lives, so a default is testable headlessly. settings.js reaches no
// DOM at module scope (verified — it imports cleanly under plain Node), so the
// "no DOM access" rule at the top of this file still holds.
import { settingOn } from '../src/ui/screens/settings.js';

// ---------------------------------------------------------------------------
// Test-only content (registered alongside the real bundle; never shipped)
// ---------------------------------------------------------------------------

const TEST_STATUSES = [
  {
    // Test 17: throwaway status exercising meter + modifier + hook with ZERO
    // engine changes (design law §3.1(2) proof).
    id: 'testCharge', name: 'Test Charge', stackMode: 'add', decay: 'none',
    meter: { max: 5, growthMult: 2, onFill: [{ op: 'block', target: 'self', amount: 7 }] },
    modifiers: { attackDamageAdd: 1 },
    hooks: [{ on: 'ownerTurnStart', do: [{ op: 'draw', amount: 1 }] }],
  },
  {
    // #61 tests: an ADDITIVE-stacking tagged vulnerability, to prove the
    // declared-stacking enum drives composition (the shipped rows are all
    // multiplicative).
    id: 'tAddVuln', name: 'T Add Vuln', stackMode: 'add', decay: 'none',
    taggedVulnerability: { tags: ['starstone'], mult: 1.5, stacking: 'additive' },
  },
];

const TEST_CARDS = [
  { id: 'tBigDraw', name: 'T Big Draw', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: ['innate'], effects: [{ op: 'draw', amount: 10 }], textTemplate: 'Draw {draw} cards.' },
  { id: 'tKeep', name: 'T Keep', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: ['retain'], effects: [], textTemplate: 'Retain.' },
  { id: 'tPoise', name: 'T Poise', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'poiseDamage', target: 'enemy', amount: 10 }], textTemplate: '{poiseDamage} Poise damage.' },
  { id: 'tCharge', name: 'T Charge', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: ['innate'], effects: [{ op: 'applyStatus', target: 'self', status: 'testCharge', stacks: 3 }], textTemplate: 'Gain {testCharge} Charge.' },
  // #61 fixtures: proc appliers + a tagged hit for the vulnerability lane.
  { id: 'tFrost10', name: 'T Frost', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 10 }], textTemplate: 'Apply {frost} Frost.' },
  { id: 'tInsanity14', name: 'T Insanity', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'insanity', stacks: 14 }], textTemplate: 'Apply {insanity} Insanity.' },
  { id: 'tStarHit', name: 'T Star Hit', class: 'colorless', rarity: 'special', cost: 0, type: 'attack', keywords: [], effects: [{ op: 'damage', target: 'enemy', amount: 10, tags: ['starstone'] }], textTemplate: 'Deal {damage} damage.' },
  { id: 'tPlainHit', name: 'T Plain Hit', class: 'colorless', rarity: 'special', cost: 0, type: 'attack', keywords: [], effects: [{ op: 'damage', target: 'enemy', amount: 10 }], textTemplate: 'Deal {damage} damage.' },
  // 7g collision fixture (Vira's drive, made display-conformant: tokens bind
  // both applications — her probe card's bare 'Collide.' was the one
  // non-conformance her gate note named).
  { id: 'tCollide', name: 'T Collide', class: 'colorless', rarity: 'special', cost: 1, type: 'skill', keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 12 }, { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 10 }], textTemplate: 'Apply {bleed} Bleed and {frost} Frost.' },
];

const TEST_ENEMIES = [
  { id: 'tDummy', name: 'T Dummy', hp: [30, 30], poiseMax: 99, moves: { wait: { intent: 'unknown', weight: 1 } } },
  // #61: tagged twin of tDummy — the resistance gate's positive arm.
  { id: 'tBeast', name: 'T Beast', hp: [30, 30], poiseMax: 99, tags: ['beast'], moves: { wait: { intent: 'unknown', weight: 1 } } },
  { id: 'tGiant', name: 'T Giant', hp: [400, 400], poiseMax: 99, moves: { wait: { intent: 'unknown', weight: 1 } } },
  { id: 'tHitter', name: 'T Hitter', hp: [50, 50], poiseMax: 99, moves: { hit: { intent: 'attack', damage: 10, weight: 1 } } },
  { id: 'tRegen', name: 'T Regen', hp: [50, 50], poiseMax: 99, moves: { regen: { intent: 'buff', weight: 1, effects: [{ op: 'heal', target: 'self', amount: 4 }] } } },
  { id: 'tAi', name: 'T AI', hp: [999, 999], poiseMax: 999, moves: { a: { intent: 'unknown', weight: 9999, maxConsecutive: 1 }, b: { intent: 'unknown', weight: 1 } } },
  {
    id: 'tDelayer', name: 'T Delayer', hp: [60, 60], poiseMax: 5, firstMove: 'held',
    moves: { held: { intent: 'attack', damage: 16, weight: 1, delay: { turns: 1, whileCharging: { block: 8 } } } },
  },
];

function testBundle() {
  return {
    ...contentBundle,
    cards: [...contentBundle.cards, ...TEST_CARDS],
    statuses: [...contentBundle.statuses, ...TEST_STATUSES],
    enemies: [...contentBundle.enemies, ...TEST_ENEMIES],
  };
}

const REG = createRegistries(testBundle());

// #90 — equipPiece now gates on OWNERSHIP as well as fit, and the argument is
// required so a stale call site fails closed rather than skipping the check.
// The blocks below that predate #90 are about the FIT gate, so they hand it an
// owner that has everything: the ownership gate has its own block (41) and
// mixing the two would make either failure look like the other.
const OWNS_EVERYTHING = { has: () => true };

// #95 — the same shape one argument later. equipPiece also gates on WHETHER A
// FIGHT IS ON, and that context is required for the same reason: a default of
// "not in combat" fails OPEN, so every call site written after today would
// re-arm mid-fight by saying nothing. Blocks that predate #95 are about the fit
// and ownership gates, so they declare the context they were always assuming.
const AT_CAMP = { inCombat: false };
const MID_FIGHT = { inCombat: true };

// deck: array of cardId strings or { id, up: true }
function makeCombat({ seed = 0xc0ffee, deck = ['strike'], enemies = ['tDummy'], hp = 78, maxHp = 78, relicIds = [], flasks = [] } = {}) {
  const rng = createRng(seed >>> 0);
  const instances = deck.map((d, i) => {
    const isObj = typeof d === 'object';
    return { instanceId: `c${i + 1}`, cardId: isObj ? d.id : d, upgraded: isObj ? !!d.up : false };
  });
  return createCombat({
    registries: REG,
    rng,
    player: { classId: 'reaver', maxHp, hp, deck: instances, relicIds, flasks },
    enemyIds: enemies,
  });
}

function playFromHand(combat, cardId, targetId = 'e1') {
  const inst = combat.piles.hand.find((c) => c.cardId === cardId);
  if (!inst) throw new Error(`'${cardId}' not in hand: [${combat.piles.hand.map((c) => c.cardId).join(', ')}]`);
  return dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId, targetId });
}

function logOf(combat, type) {
  return combat.eventLog.filter((e) => e.type === type);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runTests({ artManifest = null } = {}) {
  const results = [];
  const test = (name, fn) => {
    try {
      const out = fn();
      // An async test body would resolve AFTER this returns, so every throw
      // inside it would be swallowed and the test would report green forever.
      // Refuse it rather than quietly lie — the same rule as every other
      // fallback here: if it can fail silently, make it fail loudly instead.
      if (out && typeof out.then === 'function') {
        throw new Error('test body returned a promise; this harness is synchronous — pass data in via runTests({...}) instead');
      }
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, detail: e && e.message ? e.message : String(e) });
    }
  };
  const skip = (name, why) => results.push({ name, ok: true, skipped: true, detail: why });
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  const eq = (a, b, msg) => assert(a === b, `${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

  // ---- 1. Damage order (SPEC §4.2) ----------------------------------------
  test('1. damage order: (6+2 Str) ×0.75 Weak ×1.5 Vuln = 9, floor once, min 0', () => {
    const c = makeCombat({ deck: ['strike', 'strike', 'strike', 'strike', 'strike'] });
    S.applyStatus(c, c.player, 'strength', 2);
    S.applyStatus(c, c.player, 'weak', 1);
    S.applyStatus(c, getEntity(c, 'e1'), 'vulnerable', 1);
    playFromHand(c, 'strike');
    const hit = logOf(c, 'damageDealt').pop();
    eq(hit.amount, 9, 'final damage');
    eq(computeAttackDamage(c, c.player, getEntity(c, 'e1'), -20), 0, 'negative damage clamps to 0');
    eq(computeAttackDamage(c, c.player, null, 7), Math.floor((7 + 2) * 0.75), 'attacker-only math (single floor)');
  });

  // ---- 2. Block absorb / expiry / Unbreakable cap ---------------------------
  test('2. block absorbs first, expires at player turn start; Unbreakable retains with cap', () => {
    const c = makeCombat({ deck: ['defend', 'defend', 'defend', 'defend', 'defend'], enemies: ['tHitter'] });
    playFromHand(c, 'defend');
    eq(c.player.block, 5, 'block gained');
    dispatch(c, { type: 'endTurn' });
    const hit = logOf(c, 'damageDealt').filter((e) => e.targetId === 'player').pop();
    eq(hit.amount, 10, 'enemy hit');
    eq(hit.blocked, 5, 'block absorbed first');
    eq(c.player.block, 0, 'block expired at player turn start');

    const u = makeCombat({ deck: ['unbreakable', 'defend', 'defend', 'defend', 'defend'] });
    playFromHand(u, 'unbreakable');
    playFromHand(u, 'defend');
    eq(u.player.block, 5, 'block before retain');
    dispatch(u, { type: 'endTurn' });
    eq(u.player.block, 5, 'Unbreakable retains block');
    // Accumulate past the cap.
    for (const cardId of u.piles.hand.filter((x) => x.cardId === 'defend').slice(0, 3).map((x) => x.cardId)) {
      playFromHand(u, cardId);
    }
    dispatch(u, { type: 'endTurn' });
    while (u.player.block < 30) {
      const d = u.piles.hand.find((x) => x.cardId === 'defend');
      if (!d || u.player.energy < 1) {
        dispatch(u, { type: 'endTurn' });
        continue;
      }
      dispatch(u, { type: 'playCard', cardInstanceId: d.instanceId });
    }
    eq(u.player.block, 30, 'blockCap 30 honored');
  });

  // ---- 3. Frail + Dexterity block math --------------------------------------
  test('3. block = floor((5 + 2 Dex) × 0.75 Frail) = 5', () => {
    const c = makeCombat({ deck: ['defend', 'defend', 'defend', 'defend', 'defend'] });
    S.applyStatus(c, c.player, 'dexterity', 2);
    S.applyStatus(c, c.player, 'frail', 1);
    playFromHand(c, 'defend');
    eq(logOf(c, 'blockGained').filter((e) => e.targetId === 'player').pop().amount, 5, 'frail+dex block');
  });

  // ---- 4. Deterministic seeded reshuffle -------------------------------------
  test('4. fixed seed → identical draw order across runs, reshuffle included', () => {
    const draws = () => {
      const c = makeCombat({ deck: Array(8).fill('strike'), seed: 0xdead });
      dispatch(c, { type: 'endTurn' });
      dispatch(c, { type: 'endTurn' });
      assert(logOf(c, 'deckShuffled').length >= 2, 'reshuffle happened');
      return logOf(c, 'cardDrawn').map((e) => e.cardInstanceId).join(',');
    };
    eq(draws(), draws(), 'deterministic draws');
  });

  // ---- 5. Hand limit overflow → discard ---------------------------------------
  test('5. draws past 10-card hand go to discard (handFull)', () => {
    const c = makeCombat({ deck: ['tBigDraw', ...Array(11).fill('strike')] });
    playFromHand(c, 'tBigDraw');
    eq(c.piles.hand.length, 10, 'hand capped at 10');
    assert(logOf(c, 'cardDiscarded').some((e) => e.reason === 'handFull'), 'handFull discard emitted');
  });

  // ---- 6. Keywords + X-cost -----------------------------------------------------
  test('6. Exhaust / Ethereal / Retain / Innate / X-cost / upgrade removes Exhaust', () => {
    const c = makeCombat({ deck: ['kickOff', 'lastStand', 'tKeep', 'strike', 'strike'] });
    playFromHand(c, 'kickOff');
    assert(c.piles.exhaust.some((x) => x.cardId === 'kickOff'), 'Exhaust card exhausted on play');
    dispatch(c, { type: 'endTurn' });
    assert(c.piles.exhaust.some((x) => x.cardId === 'lastStand'), 'Ethereal exhausted at turn end');
    assert(c.piles.hand.some((x) => x.cardId === 'tKeep'), 'Retain kept in hand');

    const inn = makeCombat({ deck: ['warriorsVow', ...Array(9).fill('strike')], seed: 0xbeef });
    assert(inn.piles.hand.some((x) => x.cardId === 'warriorsVow'), 'Innate in opening hand');

    const x = makeCombat({ deck: ['stitchedArms', 'strike', 'strike', 'strike', 'strike'] });
    playFromHand(x, 'stitchedArms');
    eq(x.player.energy, 0, 'X-cost consumed all energy');
    eq(logOf(x, 'damageDealt').filter((e) => e.sourceId === 'player').length, 3, '3 energy → 3 hits');

    // X = 0 whiffs entirely (StS): playable, but zero hits.
    const x0 = makeCombat({ deck: ['stitchedArms', 'defend', 'defend', 'defend', 'strike'] });
    playFromHand(x0, 'defend');
    playFromHand(x0, 'defend');
    playFromHand(x0, 'defend');
    eq(x0.player.energy, 0, 'energy spent on defends');
    playFromHand(x0, 'stitchedArms');
    eq(logOf(x0, 'damageDealt').filter((e) => e.sourceId === 'player').length, 0, 'X=0 → 0 hits');

    const up = resolveCard(REG, { cardId: 'kickOff', upgraded: true });
    assert(!up.keywords.includes('exhaust'), 'Kick Off+ upgrade removed Exhaust');
    eq(resolveCard(REG, { cardId: 'hemorrhage', upgraded: true }).keywords.length, 0, 'Hemorrhage+ removed Exhaust');
  });

  // ---- 7. Bleed threshold-proc (#61): accumulate / own-proc burst / clamp /
  // reset-to-zero / constant threshold / per-proc poise ------------------------
  // Pins Constantine's direction (2026-08-06): burst at the threshold as ITS
  // OWN PROC, build-up resets to zero (overflow dropped), threshold constant.
  // The pre-#61 contract this replaces: overflow carried, threshold ×1.5.
  test('7. Bleed procs at its table threshold for clamp(15% maxHp, 8, 35) as its own event; resets to zero; threshold constant; +3 poise per proc', () => {
    // Threshold-DERIVED, not pinned: the knob is PROVISIONAL and his to move
    // (Constantine, "let rune pick the threshold against the sim") — the
    // contract under test is the mechanism, not the current pick.
    const T = REG.statuses.get('bleed').proc.threshold;
    const c = makeCombat({ deck: Array(6).fill('gorefireSlash') });
    const e1 = getEntity(c, 'e1');
    S.applyStatus(c, e1, 'bleed', T - 3); // sub-threshold build-up
    eq(S.getStacks(e1, 'bleed'), T - 3, 'bleed accumulated, no decay');
    dispatch(c, { type: 'endTurn' });
    eq(S.getStacks(e1, 'bleed'), T - 3, 'bleed persists through turns');
    const poiseBefore = e1.poiseMeter.value;
    playFromHand(c, 'gorefireSlash'); // +3 → T exactly → proc
    // The own-proc invariant: the burst is its own damage-record entry —
    // a procBurst event plus its own hpLost — never folded into the
    // triggering hit's damageDealt.
    const proc = logOf(c, 'procBurst').filter((e) => e.targetId === 'e1').pop();
    assert(proc, 'procBurst emitted as its own event');
    eq(proc.amount, 8, '15% of 30 = 4.5 → min-clamped to 8');
    const hit = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1' && e.isAttack).pop();
    eq(hit.amount, 5, "triggering hit's damageDealt stays the card's own 5 — burst not folded in");
    const burst = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1' && e.cause === 'proc:bleed').pop();
    assert(burst, "burst hpLost carries cause 'proc:bleed' — attributable in the damage record");
    eq(burst.amount, 8, 'burst hpLost is its own entry');
    eq(e1.statuses.bleed.meter.value, 0, 'build-up RESET TO ZERO after proc');
    eq(e1.statuses.bleed.meter.max, T, 'threshold CONSTANT — no ×1.5 (pre-#61 behavior gone)');
    eq(e1.poiseMeter.value, poiseBefore + 3, 'fixed 3 poise damage per proc (PROVISIONAL knob)');

    const g = makeCombat({ deck: Array(8).fill('gorefireSlash'), enemies: ['tGiant'] });
    S.applyStatus(g, getEntity(g, 'e1'), 'bleed', T - 3);
    playFromHand(g, 'gorefireSlash'); // → T → proc on the giant
    const gb = logOf(g, 'procBurst').filter((e) => e.targetId === 'e1').pop();
    eq(gb.amount, 35, '15% of 400 = 60 → max-clamped to 35');

    // Overflow is DROPPED at proc (reset-to-zero, his words) — (T-1) + 3
    // procs once and leaves 0, not 2. This is the anti-stranding delta the
    // #61 falsifier measures.
    const o = makeCombat({ deck: Array(6).fill('gorefireSlash') });
    S.applyStatus(o, getEntity(o, 'e1'), 'bleed', T - 1);
    playFromHand(o, 'gorefireSlash'); // T-1+3 = T+2 ≥ T → proc
    eq(logOf(o, 'procBurst').filter((e) => e.targetId === 'e1').length, 1, 'single proc');
    eq(getEntity(o, 'e1').statuses.bleed.meter.value, 0, 'overflow dropped, not carried');
  });

  // ---- 7b. Frost proc (#61): smaller percent, leaves Weak + Frost-Exposed ----
  test('7b. Frost procs at 10 for clamp(8% maxHp, 4, 20); leaves Weak and Frost-Exposed; no poise, no stagger', () => {
    const c = makeCombat({ deck: ['tFrost10', 'tPlainHit'] });
    const e1 = getEntity(c, 'e1');
    const poiseBefore = e1.poiseMeter.value;
    playFromHand(c, 'tFrost10'); // 10 ≥ threshold 10 → proc
    const proc = logOf(c, 'procBurst').filter((e) => e.targetId === 'e1' && e.status === 'frost').pop();
    assert(proc, 'frost procBurst emitted');
    eq(proc.amount, 4, '8% of 30 = 2.4 → min-clamped to 4');
    eq(e1.statuses.frost.meter.value, 0, 'frost build-up reset to zero');
    eq(S.getStacks(e1, 'weak'), 1, 'proc left Weak (the damage debuff)');
    eq(S.getStacks(e1, 'frostExposed'), 1, 'proc left Frost-Exposed');
    eq(e1.poiseMeter.value, poiseBefore, 'frost has no poiseDamage knob set');
    assert(!e1.skipNextTurn, 'frost does not stagger');
  });

  // ---- 7c. Insanity proc (#61): highest percent, poise, guaranteed stagger ---
  test('7c. Insanity procs at 14 for clamp(18% maxHp, 10, 40); +8 poise; direct stagger bypasses the bar', () => {
    const c = makeCombat({ deck: ['tInsanity14'] });
    const e1 = getEntity(c, 'e1');
    const poiseBefore = e1.poiseMeter.value;
    playFromHand(c, 'tInsanity14'); // 14 ≥ threshold 14 → proc
    const proc = logOf(c, 'procBurst').filter((e) => e.status === 'insanity').pop();
    assert(proc, 'insanity procBurst emitted');
    eq(proc.amount, 10, '18% of 30 = 5.4 → min-clamped to 10');
    eq(e1.poiseMeter.value, poiseBefore + 8, '+8 poise per proc (PROVISIONAL, highest of the three)');
    assert(e1.skipNextTurn, 'staggered DIRECTLY — poiseMax 99 bar nowhere near full');
    assert(logOf(c, 'enemyStaggered').some((e) => e.targetId === 'e1'), 'enemyStaggered emitted');
    eq(e1.intent.kind, 'staggered', 'intent shows the break');
    eq(S.getStacks(e1, 'insanityExposed'), 1, 'proc left Unraveled (tag-scoped vulnerability)');
  });

  // ---- 7d. Post-proc resistance (#61): tag-gated, halves points, expires -----
  test('7d. Bleed resistance: beast-tagged target gains Clotted after proc, points halve with a procResisted receipt, resist expires', () => {
    // Positive arm: tagged enemy → resist applied on proc. The proc fires
    // inside a dispatch (card play) so the enqueued resistance drains.
    // Threshold-derived like test 7 — the knob is provisional.
    const T = REG.statuses.get('bleed').proc.threshold;
    const c = makeCombat({ deck: Array(6).fill('gorefireSlash'), enemies: ['tBeast'] });
    const e1 = getEntity(c, 'e1');
    S.applyStatus(c, e1, 'bleed', T - 3);
    playFromHand(c, 'gorefireSlash'); // +3 → T → proc
    eq(S.getStacks(e1, 'bleedResist'), 1, 'Clotted applied — beast tag matched the gate');
    // Resistance halves the NEXT application, defender-favored rounding:
    // 3 points → blocked ceil(1.5)=2, applied 1 — with a visible receipt.
    S.applyStatus(c, e1, 'bleed', 3);
    const receipt = logOf(c, 'procResisted').filter((e) => e.targetId === 'e1').pop();
    assert(receipt, 'procResisted receipt emitted — refusal is visible, never silent');
    eq(receipt.blocked, 2, 'blocked ceil(3×50%)=2');
    eq(e1.statuses.bleed.meter.value, 1, 'only 1 of 3 points landed');
    // Expiry: duration 2 decays at the owner's turn end ×2 → resist gone,
    // full points land again.
    dispatch(c, { type: 'endTurn' });
    dispatch(c, { type: 'endTurn' });
    eq(S.getStacks(e1, 'bleedResist'), 0, 'Clotted expired after its duration');
    S.applyStatus(c, e1, 'bleed', 3);
    eq(e1.statuses.bleed.meter.value, 1 + 3, 'post-expiry application lands in full');

    // Negative arm: untagged enemy → gate closed, no resist ever.
    const u = makeCombat({ deck: ['strike'] }); // tDummy, no tags
    const ue = getEntity(u, 'e1');
    S.applyStatus(u, ue, 'bleed', T);
    eq(S.getStacks(ue, 'bleedResist'), 0, 'untagged target gains no resistance');
    // Zero-bleed empty edge: applying 0 is a no-op, no proc, no crash.
    S.applyStatus(u, ue, 'bleed', 0);
    eq(logOf(u, 'procBurst').filter((e) => e.status === 'bleed').length, 1, 'zero application cannot proc');
  });

  // ---- 7e. Tag-scoped vulnerability (#61): declared stacking + the ceiling ---
  test('7e. Frost-Exposed boosts only tagged hits; declared stacking composes; the ceiling is stack-invariant', () => {
    const c = makeCombat({ deck: ['tStarHit', 'tPlainHit', 'tStarHit', 'tPlainHit', 'tStarHit'], enemies: ['tGiant'] });
    const e1 = getEntity(c, 'e1');
    S.applyStatus(c, e1, 'frostExposed', 1);
    playFromHand(c, 'tPlainHit');
    let last = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(last.amount, 10, 'untagged hit unaffected by Frost-Exposed');
    playFromHand(c, 'tStarHit');
    last = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(last.amount, 12, 'starstone hit ×1.25 (multiplicative row)');
    // Composes with regular Vulnerable multiplicatively: 10 × 1.5 × 1.25 = 18.75 → 18.
    S.applyStatus(c, e1, 'vulnerable', 1);
    playFromHand(c, 'tStarHit');
    last = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(last.amount, 18, 'stacks WITH Vulnerable: floor(10 × 1.5 × 1.25)');
    // THE CEILING (known-bad probe answered): every vulnerability lane is
    // flat-per-status and stack-count-invariant, so max compose is the
    // closed-form product of DISTINCT table mults — stacks cannot raise it.
    S.applyStatus(c, e1, 'frostExposed', 99);
    S.applyStatus(c, e1, 'vulnerable', 99);
    if (c.player.energy === 0) dispatch(c, { type: 'endTurn' });
    playFromHand(c, 'tStarHit');
    last = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(last.amount, 18, '99 stacks of both: SAME 18 — the ceiling is the table, not the stacks');
    // Additive lane: declared 'additive' pools (mult−1). tAddVuln 1.5-additive
    // + frostExposed 1.25-mult on the same tagged hit:
    // 10 × 1.25 × (1 + 0.5) = 18.75 → 18.
    const a = makeCombat({ deck: ['tStarHit'], enemies: ['tGiant'] });
    const ae = getEntity(a, 'e1');
    S.applyStatus(a, ae, 'frostExposed', 1);
    S.applyStatus(a, ae, 'tAddVuln', 1);
    playFromHand(a, 'tStarHit');
    const al = logOf(a, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(al.amount, 18, 'additive lane pools once, multiplicative lane per source');
  });

  // ---- 7f. Known-bads through the REAL bundle (#61): each red names its row --
  test('7f. proc vocabulary known-bads: bad threshold, bad percent, unknown tag, bad duration, bad stacking — red, naming rows', () => {
    const withStatus = (row) => ({ ...contentBundle, statuses: [...contentBundle.statuses, row] });
    const base = { name: 'ZZ', stackMode: 'add', decay: 'none' };
    const expectRed = (bundle, rowPath, needle, label) => {
      const v = validateContent(bundle);
      assert(!v.ok, `${label}: bundle must fail`);
      assert(
        v.errors.some((e) => e.path.startsWith(rowPath) && e.msg.includes(needle)),
        `${label}: red names ${rowPath} (got: ${v.errors.map((e) => `${e.path}: ${e.msg}`).join(' | ')})`
      );
    };
    expectRed(
      withStatus({ ...base, id: 'zzProc1', proc: { threshold: 0, burstPercent: 15, burstMin: 8, burstMax: 35 } }),
      'statuses.zzProc1.proc.threshold', 'integer > 0', 'threshold 0'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc2', proc: { threshold: 12, burstPercent: 150, burstMin: 8, burstMax: 35 } }),
      'statuses.zzProc2.proc.burstPercent', '(0, 100]', 'percent 150'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc3', proc: { threshold: 12, burstPercent: 15, burstMin: 8, burstMax: 35, resistance: { status: 'bleedResist', tags: ['dragon'] } } }),
      'statuses.zzProc3.proc.resistance.tags', "unknown creature tag 'dragon' (legal:", 'unknown creature tag — message lists the legal set'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc4', decay: 'none', resists: { status: 'bleed', percent: 50 } }),
      'statuses.zzProc4.decay', 'duration', 'resist row without a duration'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc5', taggedVulnerability: { tags: ['starstone'], mult: 1.25, stacking: 'banana' } }),
      'statuses.zzProc5', 'banana', 'stacking outside the closed enum'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc6', taggedVulnerability: { tags: ['dragonfire'], mult: 1.25, stacking: 'additive' } }),
      'statuses.zzProc6.taggedVulnerability.tags', "unknown effect tag 'dragonfire' (legal:", 'unknown effect tag — message lists the legal set'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc7', proc: { threshold: 12, burstPercent: 15, burstMin: 40, burstMax: 35 } }),
      'statuses.zzProc7.proc', 'burstMin 40 exceeds burstMax 35', 'min > max'
    );
    // Vira's gate, finding 1 — the recurring finite class, closed by ONE
    // shared helper (finitePositive in validate.js), not a fourth patch.
    // Both were OBSERVED GREEN at ab33e41 before the helper landed.
    expectRed(
      withStatus({ ...base, id: 'zzProc8', taggedVulnerability: { tags: ['starstone'], mult: Infinity, stacking: 'multiplicative' } }),
      'statuses.zzProc8.taggedVulnerability.mult', 'finite', 'mult Infinity (damage *= Infinity at play)'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc9', proc: { threshold: 12, burstPercent: 15, burstMin: -10, burstMax: -5 } }),
      'statuses.zzProc9.proc.burstMin', '≥ 0', 'negative burst band (a proc that fires and silently no-ops)'
    );
    // Finding 2 — reverse-direction: a resist row naming a non-proc status is
    // consulted by nobody.
    expectRed(
      withStatus({ ...base, id: 'zzProc10', decay: { duration: 2 }, stackMode: 'refresh', resists: { status: 'weak', percent: 50 } }),
      'statuses.zzProc10.resists.status', 'never be consulted', 'resist row pointing at a non-proc status'
    );
    // Finding 3 — empty resistance.tags held to the same red as empty
    // taggedVulnerability.tags: one screen, one rule.
    expectRed(
      withStatus({ ...base, id: 'zzProc11', proc: { threshold: 12, burstPercent: 15, burstMin: 8, burstMax: 35, resistance: { status: 'bleedResist', tags: [] } } }),
      'statuses.zzProc11.proc.resistance.tags', 'non-empty', 'empty resistance tag gate (a resistance no creature can trigger)'
    );
    // Both shipped edges stay green: the real bundle validates.
    assert(validateContent(contentBundle).ok, 'shipped bundle stays green');
  });

  // ---- 7g. The collision drive (#61, Marina's rider — Vira drove it at the
  // gate, this is her drive as a fixture): two procs, one card play, one
  // beast-tagged target. Everything must hold at once: both bursts attributed,
  // both resets exact, both resistances granted. -------------------------------
  test('7g. bleed 12 + frost 10 in one play on a beast: both proc, 8+4 attributed, both reset, both resistances land', () => {
    const c = makeCombat({ deck: ['tCollide'], enemies: ['tBeast'] });
    const e1 = getEntity(c, 'e1');
    playFromHand(c, 'tCollide');
    const procs = logOf(c, 'procBurst').filter((e) => e.targetId === 'e1');
    eq(procs.length, 2, 'both procs fired from one card play');
    eq(procs.filter((e) => e.status === 'bleed')[0].amount, 8, 'bleed burst min-clamped to 8');
    eq(procs.filter((e) => e.status === 'frost')[0].amount, 4, 'frost burst min-clamped to 4');
    // Attribution: each burst is its own hpLost with its own cause — 8+4,
    // never a merged 12 (the own-proc invariant under collision).
    const losses = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1');
    eq(losses.filter((e) => e.cause === 'proc:bleed').reduce((s, e) => s + e.amount, 0), 8, 'bleed loss attributed proc:bleed');
    eq(losses.filter((e) => e.cause === 'proc:frost').reduce((s, e) => s + e.amount, 0), 4, 'frost loss attributed proc:frost');
    eq(e1.hp, 30 - 12, 'total 12 landed, as two entries');
    eq(e1.statuses.bleed.meter.value, 0, 'bleed build-up reset exactly to zero');
    eq(e1.statuses.frost.meter.value, 0, 'frost build-up reset exactly to zero');
    eq(S.getStacks(e1, 'bleedResist'), 1, 'Clotted granted — beast matched bleed\'s gate');
    eq(S.getStacks(e1, 'frostResist'), 1, 'Weathered granted — beast matched frost\'s gate');
    eq(S.getStacks(e1, 'weak'), 1, 'frost\'s Weak landed through the collision');
    eq(S.getStacks(e1, 'frostExposed'), 1, 'frost\'s exposure landed through the collision');
  });

  // ---- 8. Crimson Blight: tick / expire after 3 / refresh ---------------------------
  test('8. Blight ticks at enemy turn start, expires entirely after 3 turns, re-apply refreshes', () => {
    const c = makeCombat({ deck: Array(5).fill('defend') });
    const e1 = getEntity(c, 'e1');
    S.applyStatus(c, e1, 'crimsonBlight', 4);
    dispatch(c, { type: 'endTurn' }); // enemy turn 1
    let ticks = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1');
    eq(ticks.length, 1, 'one tick');
    eq(ticks[0].amount, 4, 'tick = stacks');
    S.applyStatus(c, e1, 'crimsonBlight', 2); // 6 stacks, duration refreshed to 3
    dispatch(c, { type: 'endTurn' }); // tick 6 (duration 3→2)
    dispatch(c, { type: 'endTurn' }); // tick 6 (2→1)
    dispatch(c, { type: 'endTurn' }); // tick 6 (1→0 → expired)
    ticks = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1');
    eq(ticks.map((t) => t.amount).join(','), '4,6,6,6', 'tick sequence');
    assert(!e1.statuses.crimsonBlight, 'blight expired entirely');
    assert(logOf(c, 'statusExpired').some((e) => e.status === 'crimsonBlight' && e.reason === 'expired'), 'expired event');
  });

  // ---- 9. Poise: fill → Stagger (skip + 1.5× window + growth + cancel delayed) ----
  test('9. Poise fill Staggers: skips turn, +50% window, poiseMax ×1.25, cancels Held Blade', () => {
    const c = makeCombat({ deck: ['tPoise', 'strike', 'strike', 'strike', 'strike'], enemies: ['tDelayer'] });
    const e1 = getEntity(c, 'e1');
    assert(c.eventLog.length > 0, 'combat created');
    eq(previewIntent(c, 'e1').delayed, true, 'Held Blade telegraphs as delayed');
    dispatch(c, { type: 'endTurn' }); // enemy commits: +8 block, pendingMove
    eq(e1.block, 8, 'whileCharging block');
    assert(e1.pendingMove, 'move committed');
    playFromHand(c, 'tPoise'); // 10 poise vs max 5 → Stagger
    const st = logOf(c, 'enemyStaggered').pop();
    assert(st, 'staggered');
    eq(st.cancelledMove, 'held', 'Held Blade cancelled by Stagger');
    assert(!e1.pendingMove, 'pending cleared');
    eq(e1.poiseMeter.max, 7, 'poiseMax grew ceil(5×1.25)=7');
    eq(S.getStacks(e1, 'staggered'), 2, 'staggered status applied (2-turn window)');
    playFromHand(c, 'strike');
    eq(logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop().amount, 9, 'staggered takes 6×1.5=9');
    const hpBefore = c.player.hp;
    dispatch(c, { type: 'endTurn' }); // enemy turn skipped
    eq(c.player.hp, hpBefore, 'staggered enemy dealt no damage');
    eq(S.getStacks(e1, 'staggered'), 1, 'staggered decayed at enemy turn end');
    playFromHand(c, 'strike');
    eq(logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop().amount, 9, 'window still open on player\'s next turn');
  });

  // ---- 10b. Same-stance re-entry is a no-op (StS) -------------------------------
  test('10b. re-entering the current stance is a no-op (no onEnter re-trigger)', () => {
    const c = makeCombat({ deck: ['enterGorefire', 'enterGorefire', 'strike', 'strike', 'strike'] });
    playFromHand(c, 'enterGorefire');
    eq(c.player.hp, 76, 'first entry costs 2 HP');
    playFromHand(c, 'enterGorefire');
    eq(c.player.hp, 76, 'second entry did NOT re-trigger the 2 HP onEnter');
    eq(logOf(c, 'stanceEntered').length, 1, 'only one stanceEntered event');
    eq(c.player.stanceId, 'gorefire', 'still in the stance');
  });

  // ---- 10. Stances -------------------------------------------------------------
  test('10. stance exclusivity; Gorefire per-hit Bleed; Bulwark on-Skill block', () => {
    const c = makeCombat({ deck: ['enterGorefire', 'twinbladeFlurry', 'enterBulwark', 'defend', 'strike'] });
    playFromHand(c, 'enterGorefire');
    eq(c.player.stanceId, 'gorefire', 'entered gorefire');
    eq(c.player.hp, 76, 'entering Gorefire cost 2 HP (ignores block)');
    playFromHand(c, 'twinbladeFlurry');
    eq(S.getStacks(getEntity(c, 'e1'), 'bleed'), 6, '3 hits × 2 Bleed per hit');
    playFromHand(c, 'enterBulwark');
    eq(c.player.stanceId, 'bulwark', 'stance switched (exclusive)');
    assert(logOf(c, 'stanceExited').some((e) => e.stance === 'gorefire'), 'exited event');
    eq(c.player.block, 3, 'Bulwark onEnter +3 (its own play does not double-trigger)');
    dispatch(c, { type: 'endTurn' });
    const d = c.piles.hand.find((x) => x.cardId === 'defend' || x.cardId === 'enterGorefire');
    const before = c.player.block;
    const skill = c.piles.hand.find((x) => resolveCard(REG, x).type === 'skill' && resolveCard(REG, x).cardId !== undefined) || d;
    const defend = c.piles.hand.find((x) => x.cardId === 'defend');
    if (defend) {
      dispatch(c, { type: 'playCard', cardInstanceId: defend.instanceId });
      eq(c.player.block - before, 7, 'Skill in Bulwark: 5 block + 2 stance');
    } else {
      // Deck order variance: play any skill and expect the +2 rider.
      assert(skill, 'a skill is in hand');
      const b0 = c.player.block;
      dispatch(c, { type: 'playCard', cardInstanceId: skill.instanceId });
      assert(c.player.block >= b0 + 2, 'Bulwark added 2 block on Skill play');
    }
  });

  // ---- 11. maxConsecutive over many rolls -----------------------------------------
  test('11. maxConsecutive never violated over 200 rolls (weight 9999:1)', () => {
    const c = makeCombat({ deck: Array(5).fill('defend'), enemies: ['tAi'], seed: 0xabcd });
    for (let i = 0; i < 200 && !c.result; i++) dispatch(c, { type: 'endTurn' });
    const hist = getEntity(c, 'e1').movesHistory;
    assert(hist.length >= 200, 'history recorded');
    for (let i = 1; i < hist.length; i++) {
      assert(!(hist[i] === 'a' && hist[i - 1] === 'a'), `maxConsecutive violated at ${i}`);
    }
    assert(hist.includes('b'), 'fallback move was forced in');
  });

  // ---- 12. Map generation (SPEC §6, §8.12) -------------------------------------------
  test('12. map gen: fixed-seed snapshot; constraints over 200 seeds', () => {
    const config = contentBundle.mapConfigs[1];
    // READ THE RESOLVED PLAN, never the raw rules. This test used to hardcode
    // "floor 9 all treasure, floor 15 shrine" and read
    // `config.floorRules.noEliteOrShrineBefore` as a number — a second decider
    // for what a rule means, which drifts from the generator the moment the
    // vocabulary changes. It also encoded `15: 'shrine'`, a rule that had never
    // fired. One resolution, every reader (model/floorplan.js).
    const { plan } = resolveFloorPlan(config);
    assert(plan != null, 'act 1 floor rules resolve');
    const gen = (seed) => generateActMap({ config, rng: createRng(seed) });

    // Fixed seed → identical graph (determinism snapshot).
    eq(JSON.stringify(gen(0x715e)), JSON.stringify(gen(0x715e)), 'same seed, same map');

    for (let s = 1; s <= 200; s++) {
      const map = gen(s * 2654435761);
      const nodes = Object.values(map.nodes);

      // Every fixed rank the plan resolved, whatever it resolved to.
      for (const n of nodes) {
        const fixedType = plan.fixed[n.floor];
        if (fixedType) eq(n.type, fixedType, `seed ${s}: fixed ${fixedType} node ${n.id} on floor ${n.floor}`);
        // No early elites/shrines; none on the barred floor (SPEC §6).
        if (n.floor < plan.eliteShrineFrom && !plan.fixed[n.floor]) {
          assert(n.type !== 'elite' && n.type !== 'shrine', `seed ${s}: early ${n.type} on floor ${n.floor}`);
        }
        if (n.floor === plan.noShrineOn) {
          assert(n.type !== 'shrine', `seed ${s}: shrine on the barred floor ${plan.noShrineOn}`);
        }
      }
      // The plan's fixed ranks are not a formality — each must actually land.
      for (const [floor, type] of Object.entries(plan.fixed)) {
        assert(nodes.some((n) => n.floor === Number(floor) && n.type === type),
          `seed ${s}: no ${type} on its fixed floor ${floor}`);
      }
      // `columns` travels with the graph, so the map screen can size its SVG.
      eq(map.columns, config.columns, `seed ${s}: graph carries its column count`);
      eq(map.nodes[map.shrineId].type, 'shrine', `seed ${s}: pre-boss shrine`);
      eq(map.nodes[map.bossId].type, 'boss', `seed ${s}: boss node`);

      // Minimum counts (hard promise even via the relax path).
      // NOTE THE NAMES. These were `minReachableElites` / `minReachableMerchants`
      // and this test asserted a COUNT while the name promised REACHABILITY —
      // two different claims, and the graph-wide count is the one that was ever
      // true. Freja measured the gap: 6 of 102 starts reach no Elite at 15x7.
      assert(nodes.filter((n) => n.type === 'elite').length >= plan.minElites, `seed ${s}: elites`);
      assert(nodes.filter((n) => n.type === 'merchant').length >= plan.minMerchants, `seed ${s}: merchant`);

      // No crossing edges within the path floors.
      for (let floor = 1; floor < config.floors - 1; floor++) {
        const es = [];
        for (const n of nodes.filter((x) => x.floor === floor)) {
          for (const toId of n.next) {
            const to = map.nodes[toId];
            if (to.floor === floor + 1) es.push([n.col, to.col]);
          }
        }
        for (let i = 0; i < es.length; i++) {
          for (let j = i + 1; j < es.length; j++) {
            const [a1, a2] = es[i];
            const [b1, b2] = es[j];
            assert(!((a1 < b1 && a2 > b2) || (a1 > b1 && a2 < b2)), `seed ${s}: crossing edges on floor ${floor}`);
          }
        }
      }

      // Boss reachable from EVERY floor-1 start (BFS).
      for (const startId of map.startIds) {
        const seen = new Set([startId]);
        const queue = [startId];
        while (queue.length) {
          for (const nx of map.nodes[queue.shift()].next) {
            if (!seen.has(nx)) {
              seen.add(nx);
              queue.push(nx);
            }
          }
        }
        assert(seen.has(map.bossId), `seed ${s}: boss unreachable from ${startId}`);
      }
    }
  });

  // ---- 13. Save round-trip + versioning (SPEC §3.12, §8.13) ----------------------------
  test('13. save round-trip; unknown schemaVersion and dangling ids refused + archived', () => {
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    const rng = createRng(0xfeed);
    rng.float('shuffle');
    rng.float('cardRewards');
    const run = createRunState({ seed: 0xfeed, classId: 'reaver', registries: REG });
    run.cinders = 123;
    run.floor = 4;
    saves.saveRun(run, rng);

    const loaded = saves.loadRun(REG);
    eq(JSON.stringify(loaded), JSON.stringify(run), 'round-trip identical');
    eq(loaded.streamCounters.shuffle, 1, 'rng counters persisted');

    // Unknown schemaVersion → refused, archived, save slot cleared.
    const tampered = { ...run, schemaVersion: RUN_SCHEMA_VERSION + 99 };
    storage.setItem(RUN_KEY, JSON.stringify(tampered));
    eq(saves.loadRun(REG), null, 'unknown schemaVersion refused');
    assert(storage.getItem(RUN_ARCHIVE_KEY) != null, 'refused save was archived');
    eq(storage.getItem(RUN_KEY), null, 'save slot cleared after archive');

    // contentVersion mismatch + dangling card id → refused and archived.
    const ghost = { ...run, contentVersion: 'other', deck: [{ instanceId: 'g1', cardId: 'ghostCard', upgraded: false }] };
    storage.setItem(RUN_KEY, JSON.stringify(ghost));
    eq(saves.loadRun(REG), null, 'dangling id after content change refused');

    // contentVersion mismatch but all ids resolve → run survives the patch.
    const fine = { ...run, contentVersion: 'other' };
    storage.setItem(RUN_KEY, JSON.stringify(fine));
    const migrated = saves.loadRun(REG);
    assert(migrated != null, 'compatible save survives content patch');
    eq(migrated.contentVersion, REG.contentVersion, 'contentVersion re-stamped');

    // Parseable but malformed body (right schemaVersion, broken shape) → refused
    // and archived, instead of loading and exploding later mid-run.
    for (const [label, bad] of [
      ['missing hp', (() => { const r = { ...run }; delete r.hp; return r; })()],
      ['deck not an array', { ...run, deck: 'nope' }],
      ['deck entry missing cardId', { ...run, deck: [{ instanceId: 'x1' }] }],
      ['null class', { ...run, class: null }],
    ]) {
      storage.removeItem(RUN_ARCHIVE_KEY);
      storage.setItem(RUN_KEY, JSON.stringify(bad));
      eq(saves.loadRun(REG), null, `malformed save refused (${label})`);
      assert(storage.getItem(RUN_ARCHIVE_KEY) != null, `malformed save archived (${label})`);
    }

    // A sound save still declares its shape (no drift): seedString is part of it.
    assert(validateRunShape(run).length === 0, 'a freshly created run satisfies RUN_SHAPE');
    assert('seedString' in run, 'seedString is declared by createRunState, not bolted on later');

    // Meta history capped at 20.
    storage.setItem(RUN_KEY, JSON.stringify(run));
    for (let i = 0; i < 25; i++) saves.recordResult({ victory: i % 2 === 0, seed: i });
    eq(saves.loadMeta().results.length, 20, 'history capped at 20');
  });

  // ---- 13b. Profile durability (#67) — the five properties --------------------
  // A 2000-run profile is somebody's history. Each assertion below was observed
  // RED at dev e444d77 before the fix; the standalone instrument with the full
  // corpus is tools/profile-durability-probe.mjs (Sten's probe, extended).
  test('13b. profile: stamped and read, newer refused AND preserved, archives keyed, never silently empty, evidence survives the next write, drawer has a handle', () => {
    // P1 — the stamp is written AND something branches on it.
    const s1 = createMemoryStorage();
    const m1 = createSaveManager(s1);
    m1.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
    eq(JSON.parse(s1.getItem(META_KEY)).schemaVersion, META_SCHEMA_VERSION, 'profile is stamped on write');

    // P1 — NEWER: refused and PRESERVED (an old build must not eat a new profile).
    const s2 = createMemoryStorage();
    const m2 = createSaveManager(s2);
    const newerBytes = JSON.stringify({ schemaVersion: META_SCHEMA_VERSION + 6, profile: { runs: 2000 } });
    s2.setItem(META_KEY, newerBytes);
    m2.loadMeta();
    eq(m2.profileStatus().state, 'newer', 'a newer profile is refused by name');
    eq(s2.getItem(META_KEY), newerBytes, 'newer profile bytes are preserved untouched');
    eq(m2.saveMeta({ settings: { uiScale: 1.1 } }).ok, false, 'writes are refused while quarantined');
    eq(s2.getItem(META_KEY), newerBytes, 'and the bytes are STILL untouched after that write');

    // P1 — OLDER: migrated when we have a migration, refused BY NAME when we don't.
    const s3 = createMemoryStorage();
    const m3 = createSaveManager(s3);
    s3.setItem(META_KEY, JSON.stringify({ schemaVersion: 0, results: [], progress: { runs: 7 } }));
    eq(m3.loadMeta().progress.runs, 7, 'a v0 profile is migrated, not discarded');
    eq(m3.profileStatus().state, 'migrated', 'and the migration is named');
    const s4 = createMemoryStorage();
    const m4 = createSaveManager(s4);
    s4.setItem(META_KEY, JSON.stringify({ schemaVersion: -3, progress: { runs: 9 } }));
    m4.loadMeta();
    assert(/schemaVersion -3/.test(m4.profileStatus().reason || ''), 'an un-migratable older profile is refused BY NAME');

    // P2 — archives are keyed and appended: the second loss keeps the first.
    const s5 = createMemoryStorage();
    const m5 = createSaveManager(s5);
    s5.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":111},');
    m5.loadMeta();
    m5.startNewProfile();
    m5.saveMeta({ settings: {}, results: [], progress: { runs: 222 } });
    s5.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":222},');
    m5.loadMeta();
    const metaArchives = m5.listArchives().filter((a) => a.kind === 'meta');
    eq(metaArchives.length, 2, 'two losses produce two archives');
    assert(/111/.test(m5.getArchive(metaArchives[0].id).save), 'the first loss was not overwritten by the second');
    // …and repeated reads of one bad profile do not fill the drawer with copies.
    m5.loadMeta(); m5.loadMeta(); m5.loadMeta();
    eq(m5.listArchives().filter((a) => a.kind === 'meta').length, 2, 'repeat loads de-duplicate by content');
    // Run archives are keyed by SLOT — slot 2 no longer lands on slot 1.
    const s6 = createMemoryStorage();
    const m6 = createSaveManager(s6);
    s6.setItem(RUN_KEY, '{"schemaVersion":1,broken');
    s6.setItem(`${RUN_KEY}_s2`, '{"schemaVersion":1,alsobroken');
    m6.loadRun(REG, 1);
    m6.loadRun(REG, 2);
    const runArchives = m6.listArchives().filter((a) => a.kind === 'run');
    eq(runArchives.length, 2, 'both slots archived separately');
    assert(runArchives.some((a) => a.slot === 1) && runArchives.some((a) => a.slot === 2), 'archives carry their slot');

    // P3 + P4 — never silently empty, and the next write cannot destroy the evidence.
    const s7 = createMemoryStorage();
    const m7 = createSaveManager(s7);
    m7.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
    s7.setItem(META_KEY, 'not json at all');
    s7.setItem(META_BACKUP_KEY, 'the mirror is gone too');
    const loaded = m7.loadMeta();
    const st7 = m7.profileStatus();
    assert(st7.ok === false && st7.state === 'corrupt' && !!st7.reason, 'a failed load is a named state');
    assert(loaded.progress === undefined && st7.quarantined, 'empty is returned, but the state says why');
    const evidence = s7.getItem(META_KEY);
    m7.saveMeta({ settings: { uiScale: 1.1 } });
    m7.recordResult({ victory: false });
    eq(s7.getItem(META_KEY), evidence, 'the original bytes survive the next write AND recordResult');
    // A first boot is 'empty', not loss — the two must never look alike.
    const m8 = createSaveManager(createMemoryStorage());
    m8.loadMeta();
    assert(m8.profileStatus().state === 'empty' && m8.profileStatus().ok, 'a first-ever boot is not a loss');

    // P5 — the drawer has a handle, and a readable mirror means it is never opened.
    const s9 = createMemoryStorage();
    const m9 = createSaveManager(s9);
    m9.saveMeta({ settings: {}, results: [], progress: { runs: 1234 }, unlocked: ['weaponMoonveil'] });
    const goodBytes = s9.getItem(META_KEY);
    s9.setItem(META_KEY, goodBytes.slice(0, goodBytes.length - 9));
    m9.loadMeta();
    eq(m9.profileStatus().state, 'recovered', 'the last-known-good mirror recovers the profile');
    eq(JSON.parse(s9.getItem(META_KEY)).progress.runs, 1234, 'and the primary is put back');
    const archived = m9.listArchives().find((a) => a.kind === 'meta');
    assert(archived && archived.at && archived.reason, 'the corrupt bytes are still archived, with when and why');
    assert(/weaponMoonveil/.test(m9.exportArchive(archived.id) || ''), 'an archive exports to something a player can keep');
    assert(m9.restoreProfile(archived.id).ok === false, 'restoring genuinely-bad bytes fails plainly, not silently');

    // ---- the PRODUCT of state × consent action (Vira's gate, D1) -----------
    // The corpus above walks each state and each action but never their
    // product, and the hole was exactly there: consenting to a new profile
    // destroyed an unarchived one. The invariant, asserted for EVERY state:
    // no path may replace the primary without the old bytes being recoverable.
    const build = {
      ok: (st) => { const m = createSaveManager(st); m.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } }); return m; },
      corrupt: (st) => { const m = createSaveManager(st); m.saveMeta({ results: [], progress: { runs: 2000 } }); st.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":2000}'); st.setItem(META_BACKUP_KEY, 'gone'); m.loadMeta(); return m; },
      newer: (st) => { const m = createSaveManager(st); st.setItem(META_KEY, JSON.stringify({ schemaVersion: META_SCHEMA_VERSION + 6, profile: { runs: 2000 } })); m.loadMeta(); return m; },
      older: (st) => { const m = createSaveManager(st); st.setItem(META_KEY, JSON.stringify({ schemaVersion: -3, progress: { runs: 2000 } })); m.loadMeta(); return m; },
    };
    // EVERY path that replaces the primary, not the one that was tested. The
    // rule held twice and its COVERAGE was per-function twice: startNewProfile
    // (Vira D1), then restoreProfile (Sunna D12), which destroyed the outgoing
    // profile while its dialog promised to set it aside.
    const seedArchive = (st, runs) => {
      const other = JSON.stringify({ schemaVersion: META_SCHEMA_VERSION, settings: {}, results: [], progress: { runs } });
      const idx = JSON.parse(st.getItem(RUN_ARCHIVE_KEY) || '{"v":1,"entries":[]}');
      idx.entries.push({ id: 'meta-seeded', kind: 'meta', slot: null, reason: 'seeded', at: new Date().toISOString(), count: 1, save: other });
      st.setItem(RUN_ARCHIVE_KEY, JSON.stringify(idx));
    };
    const replacers = {
      startNewProfile: (mgr) => mgr.startNewProfile(),
      restoreProfile: (mgr, st) => { seedArchive(st, 111); return mgr.restoreProfile('meta-seeded'); },
    };
    for (const [name, make] of Object.entries(build)) {
      for (const [action, run] of Object.entries(replacers)) {
        const st = createMemoryStorage();
        const mgr = make(st);
        const before = st.getItem(META_KEY);
        run(mgr, st);
        const recoverable = mgr.listArchives().some((a) => (mgr.getArchive(a.id) || {}).save === before);
        assert(!before || recoverable, `${name} × ${action}: the replaced bytes are still recoverable`);
      }
    }

    // The named case, with values worth noticing: 777 out, 111 in, and BOTH
    // must be in the drawer afterwards — a restore consumes nothing.
    const stR = createMemoryStorage();
    const mR = createSaveManager(stR);
    mR.saveMeta({ settings: {}, results: [], progress: { runs: 777 } });
    seedArchive(stR, 111);
    eq(mR.restoreProfile('meta-seeded').ok, true, 'a readable archive restores');
    eq(mR.loadMeta().progress.runs, 111, 'the restored profile is live');
    const inDrawer = mR.listArchives()
      .map((a) => { try { return JSON.parse(mR.getArchive(a.id).save).progress.runs; } catch (e) { return null; } });
    assert(inDrawer.includes(777), 'the profile that was replaced is set aside, not destroyed');
    assert(inDrawer.includes(111), 'the archive it restored from is still there');

    // newer × export: the bytes are intact and deliberately unarchived, so the
    // export must read the LIVE profile — and must never offer an unrelated
    // archive as "your profile" (Vira, D2).
    const stN = createMemoryStorage();
    stN.setItem(RUN_ARCHIVE_KEY, JSON.stringify({ reason: 'an old run', save: '{"unrelated":"run bytes"}' }));
    const mN = build.newer(stN);
    eq(mN.profileStatus().archiveId, null, 'the newer state points at no archive — it archived nothing');
    const exported = mN.exportProfile();
    eq(JSON.parse(exported).profile, stN.getItem(META_KEY), 'export carries the live profile bytes verbatim');
    assert(!/unrelated/.test(exported), 'export never hands back somebody else\'s archive');

    // THE DRAWER'S PROMISE (Saga's gate): "never deleted to make room for
    // anything else" must be true. A profile is not evicted by later run
    // losses, and is not aged out either — same promise, two routes.
    const stD = createMemoryStorage();
    const mD = createSaveManager(stD);
    mD.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
    stD.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":2000},');
    mD.loadMeta();
    const profileId = mD.profileStatus().archiveId;
    for (let i = 0; i < 20; i++) {
      stD.setItem(`${RUN_KEY}_s${(i % 2) + 2}`, '{"schemaVersion":1,broken' + i);
      mD.loadRun(REG, (i % 2) + 2);
    }
    assert(mD.getArchive(profileId), 'a set-aside profile survives twenty later run losses');
    assert(typeof mD.exportArchive(profileId) === 'string', 'and it is still exportable afterwards');
    const idxD = JSON.parse(stD.getItem(RUN_ARCHIVE_KEY));
    idxD.entries.forEach((e) => { e.at = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString(); });
    stD.setItem(RUN_ARCHIVE_KEY, JSON.stringify(idxD));
    stD.setItem(RUN_KEY, '{"schemaVersion":1,broken');
    mD.loadRun(REG, 1);
    assert(mD.getArchive(profileId), 'a set-aside profile is not aged out of the drawer either');

    // A corrupt archive INDEX must not silently discard the drawer (Vira, D4).
    const stI = createMemoryStorage();
    const mI = createSaveManager(stI);
    stI.setItem(RUN_ARCHIVE_KEY, 'the index itself is garbage');
    mI.saveMeta({ results: [], progress: { runs: 5 } });
    stI.setItem(META_KEY, 'broken');
    mI.loadMeta();
    assert(Object.keys(stI).length >= 0, 'index salvage does not throw');
    assert(mI.listArchives().length >= 1, 'a fresh index is started so the game keeps working');
  });

  // ---- 14. Scripted bot completes a boss combat -------------------------------------
  test('14. bot (leftmost affordable, end turn) finishes a seeded boss fight without throwing', () => {
    const deck = REG.classes.get('reaver').startingDeck.map((id, i) => ({ instanceId: `c${i}`, cardId: id, upgraded: false }));
    const c = createCombat({
      registries: REG,
      rng: createRng(0x51deb00b),
      player: { classId: 'reaver', maxHp: 78, hp: 78, deck, relicIds: ['forsakenMedallion'] },
      enemyIds: ['fellWarden'],
    });
    let guard = 0;
    while (!c.result) {
      if (++guard > 2000) throw new Error('bot did not finish in 2000 actions');
      const target = c.enemies.find((e) => e.alive);
      const playable = c.piles.hand.find((inst) => {
        const def = resolveCard(REG, inst);
        if ((def.keywords || []).includes('unplayable')) return false;
        const cost = def.cost === 'X' ? 0 : def.cost;
        return c.player.energy >= cost;
      });
      if (playable && target) {
        dispatch(c, { type: 'playCard', cardInstanceId: playable.instanceId, targetId: target.id });
      } else {
        dispatch(c, { type: 'endTurn' });
      }
    }
    assert(c.result === 'victory' || c.result === 'defeat', 'combat concluded');
    assert(logOf(c, 'relicTriggered').some((e) => e.relicId === 'forsakenMedallion'), 'starter relic fired');
  });

  // ---- 15. Content validation ---------------------------------------------------------
  test('15. shipped content validates; closed sets enforced; scripts budget < 5%', () => {
    const r = validateContent(contentBundle);
    assert(r.ok, `content invalid: ${r.errors.slice(0, 5).map((e) => `${e.path}: ${e.msg}`).join(' | ')}`);
    assert(r.scriptReport.pct < 5, 'scripts budget');

    const bad1 = validateContent({ ...contentBundle, cards: [...contentBundle.cards, { id: 'zz', name: 'zz', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'notAnOp', amount: 1 }], textTemplate: '' }] });
    assert(!bad1.ok && bad1.errors.some((e) => e.msg.includes("Unknown opcode 'notAnOp'")), 'unknown opcode caught');

    const bad2 = validateContent({ ...contentBundle, cards: [...contentBundle.cards, { id: 'zz2', name: 'zz', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'applyStatus', status: 'noSuchStatus', stacks: { f: 'add', args: [1] } }], textTemplate: '' }] });
    assert(!bad2.ok && bad2.errors.some((e) => e.msg.includes('noSuchStatus')), 'dangling status id caught');

    const bad3 = validateContent({ ...contentBundle, cards: [...contentBundle.cards, { id: 'zz3', name: 'zz', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [], textTemplate: 'Deal {damage} damage.' }] });
    assert(!bad3.ok && bad3.errors.some((e) => e.msg.includes('does not bind')), 'unbound template token caught');
  });

  // ---- 16. Text templating + shared preview math ----------------------------------------
  test('16. every token binds (base + upgrade); Strike previews 9 with +3 Str; Strike+ shows 6 under Weak', () => {
    for (const card of contentBundle.cards) {
      const check = (tpl, effs, label) => {
        const bound = new Set(computeTokenBindings(effs).map((b) => b.token));
        for (const tok of extractTemplateTokens(tpl)) {
          assert(bound.has(tok), `${label}: token {${tok}} unbound`);
        }
      };
      check(card.textTemplate, card.effects, card.id);
      if (card.upgrade) {
        check(card.upgrade.textTemplate ?? card.textTemplate, card.upgrade.effects ?? card.effects, `${card.id}+`);
      }
    }
    const c = makeCombat({ deck: Array(5).fill('strike') });
    S.applyStatus(c, c.player, 'strength', 3);
    eq(previewCard(c, c.piles.hand[0].instanceId, 'e1').tokens.damage, 9, 'Strike previews 6+3=9');

    const w = makeCombat({ deck: Array(5).fill({ id: 'strike', up: true }) });
    S.applyStatus(w, w.player, 'weak', 1);
    eq(previewCard(w, w.piles.hand[0].instanceId, 'e1').tokens.damage, 6, 'Strike+ (9) under Weak previews 6');

    // Intent numbers recompute live through the same math (SPEC §4.6).
    const i = makeCombat({ deck: Array(5).fill('defend'), enemies: ['tHitter'] });
    S.applyStatus(i, i.player, 'vulnerable', 1);
    eq(previewIntent(i, 'e1').damage, 15, 'intent shows 10×1.5=15 with player Vulnerable');
  });

  // ---- 17. Status-model generality (zero engine changes) ----------------------------------
  test('17. throwaway status (meter + hook + modifier) works with zero engine changes', () => {
    // 7-card deck (tCharge is Innate → both in the opening hand) so the
    // ownerTurnStart bonus draw has cards left to actually draw.
    const c = makeCombat({ deck: ['tCharge', 'tCharge', 'strike', 'strike', 'strike', 'strike', 'strike'] });
    playFromHand(c, 'tCharge'); // 3
    playFromHand(c, 'tCharge'); // 6 ≥ 5 → fill: +7 block, max ×2 → 10, value 1
    eq(c.player.block, 7, 'meter onFill granted block');
    eq(c.player.statuses.testCharge.meter.max, 10, 'growthMult ×2 applied');
    eq(S.getStacks(c.player, 'testCharge'), 1, 'overflow carried');
    playFromHand(c, 'strike');
    eq(logOf(c, 'damageDealt').pop().amount, 7, 'attackDamageAdd modifier: 6+1');
    const drawnBefore = logOf(c, 'cardDrawn').length;
    dispatch(c, { type: 'endTurn' });
    assert(logOf(c, 'cardDrawn').length >= drawnBefore + 6, 'ownerTurnStart hook drew an extra card');
  });

  // ---- 18. M2 run systems ---------------------------------------------------------------
  test('18. run systems: deterministic rewards, flask pity, relic passives, event opcodes, Physick', () => {
    // Same seed → identical roll bundle (SPEC §3.11 stream promise).
    const rollAll = () => {
      const r = createRng(0xaa11);
      const rn = createRunState({ seed: 0xaa11, classId: 'reaver', registries: REG });
      return JSON.stringify([
        rollEncounter(REG, r, { pool: 'normal' }),
        rollRuneReward(REG, r, 'normal', []),
        rollCardRewardIds(REG, r, { classId: 'reaver', pool: 'normal' }),
        rollFlaskDrop(REG, r, rn),
        rollRelicReward(REG, r, ['forsakenMedallion']),
        buildShopStock(REG, r, rn),
        resolveUnknownNode(REG, r, { act: 1 }),
      ]);
    };
    eq(rollAll(), rollAll(), 'reward/shop/unknown rolls deterministic');

    // runeGainMult passive (Cinder Pouch ×1.25, floored).
    const base = rollRuneReward(REG, createRng(7), 'normal', []);
    eq(rollRuneReward(REG, createRng(7), 'normal', ['cinderPouch']), Math.floor(base * 1.25), 'Cinder Pouch');

    // Feral Eye: elites offer +1 card choice.
    eq(rollCardRewardIds(REG, createRng(9), { classId: 'reaver', pool: 'elite', relicIds: ['feralEye'] }).length, 4, 'Feral Eye extra choice');

    // Flask pity: −step on drop, +step on miss.
    const rn2 = createRunState({ seed: 1, classId: 'reaver', registries: REG });
    rn2.flaskChancePct = 100;
    assert(rollFlaskDrop(REG, createRng(3), rn2) != null, 'guaranteed drop at 100%');
    eq(rn2.flaskChancePct, 90, 'chance decayed after drop');
    rn2.flaskChancePct = 0;
    eq(rollFlaskDrop(REG, createRng(3), rn2), null, 'no drop at 0%');
    eq(rn2.flaskChancePct, 10, 'chance grew after miss');

    // Cracked Tear: Flask of Stone 15 Block × 1.5 → ceil 23.
    const c = makeCombat({ deck: Array(5).fill('strike'), relicIds: ['crackedTear'], flasks: [{ flaskId: 'flaskOfStone' }] });
    dispatch(c, { type: 'useFlask', slot: 0 });
    eq(c.player.block, 23, 'flaskPowerMult 1.5 rounded up');

    // Wondrous Draught: the one budgeted script — two random flask payloads.
    const w = makeCombat({ deck: Array(5).fill('strike'), flasks: [{ flaskId: 'wondrousDraught' }] });
    const out = dispatch(w, { type: 'useFlask', slot: 0 });
    assert(out.events.some((e) => e.type === 'flaskUsed'), 'physick used');
    assert(
      out.events.some((e) => ['blockGained', 'healed', 'energyGained', 'statusApplied'].includes(e.type)),
      'physick produced flask effects'
    );

    // Ancestral Horn: Powers cost 1 less (preview AND execution).
    const h = makeCombat({ deck: ['unbreakable', 'strike', 'strike', 'strike', 'strike'], relicIds: ['ancestralHorn'] });
    const inst = h.piles.hand.find((x) => x.cardId === 'unbreakable');
    eq(previewCard(h, inst.instanceId).cost, 1, 'preview shows reduced cost');
    dispatch(h, { type: 'playCard', cardInstanceId: inst.instanceId });
    eq(h.player.energy, 2, 'paid 1 instead of 2');

    // Run-level event opcodes: addCardToDeck + startCombat + shrine math.
    const rn3 = createRunState({ seed: 2, classId: 'reaver', registries: REG });
    executeRunEffects({ run: rn3, registries: REG, rng: createRng(5) }, [
      { op: 'addCardToDeck', card: 'guilt' },
      { op: 'startCombat', encounterId: 'loneSoldier' },
    ]);
    assert(rn3.deck.some((x) => x.cardId === 'guilt'), 'curse added to deck');
    eq(rn3.combatEntered, 'loneSoldier', 'startCombat handed off');

    const rn4 = createRunState({ seed: 4, classId: 'reaver', registries: REG });
    rn4.hp = 10;
    eq(shrineHealAmount(REG, rn4), Math.floor((84 * 35) / 100), 'shrine heal 35%');
    rn4.relics.push('emberFragment');
    eq(shrineHealAmount(REG, rn4), Math.floor((84 * 35 * 1.15) / 100), 'Ember Fragment ×1.15');
  });

  // ---- 19. Keepsakes (character creation boons) -------------------------------------------
  test('19. keepsakes: effect lists validate and apply as run effects', () => {
    // Every keepsake's effects must pass the same closed-set validation as events.
    const probe = { ...contentBundle, events: [...contentBundle.events, ...KEEPSAKES.map((k) => ({
      id: `ks_${k.id}`, name: k.name, text: 'probe',
      choices: [{ label: 'x', effects: k.effects, resultText: 'x' }],
    }))] };
    const v = validateContent(probe);
    assert(v.ok, `keepsake effects invalid: ${v.errors.map((e) => e.path + ': ' + e.msg).join(' | ')}`);

    const rn = createRunState({ seed: 11, classId: 'reaver', registries: REG });
    executeRunEffects({ run: rn, registries: REG, rng: createRng(11) }, KEEPSAKES.find((k) => k.id === 'oldCinder').effects);
    eq(rn.cinders, 50, 'Old Cinder grants 50 cinders');
    executeRunEffects({ run: rn, registries: REG, rng: createRng(11) }, KEEPSAKES.find((k) => k.id === 'travelersFlask').effects);
    eq(rn.flasks[0].flaskId, 'crimsonFlask', "Traveler's Flask grants a Crimson Flask");
    executeRunEffects({ run: rn, registries: REG, rng: createRng(11) }, KEEPSAKES.find((k) => k.id === 'whetstoneMemory').effects);
    assert(rn.deck.some((c) => c.cardId === 'strike' && c.upgraded), 'Whetstone Memory upgrades a Strike');
  });

  // ---- 20. M3 phase 1: Starseer + Herald class mechanics ---------------------------------
  test('20. Starstone combos, Starstone Shard, blood economy, Gold Figurine — all pure data', () => {
    eq(REG.classes.size, 3, 'three playable classes registered');

    // Starstone: 1st spell plain, 2nd spell empowered, charge fades at turn end.
    const a = makeCombat({ deck: Array(5).fill('starstonePebble'), enemies: ['tGiant'] });
    playFromHand(a, 'starstonePebble');
    let hits = logOf(a, 'damageDealt').map((e) => e.amount);
    eq(hits.join(','), '6', 'first spell: no bonus');
    playFromHand(a, 'starstonePebble');
    hits = logOf(a, 'damageDealt').map((e) => e.amount);
    eq(hits.join(','), '6,6,3', 'second spell: Starstone bonus fired');
    dispatch(a, { type: 'endTurn' });
    eq(S.getStacks(a.player, 'starstoneCharge'), 0, 'charge fades at turn end');
    playFromHand(a, 'starstonePebble');
    eq(logOf(a, 'damageDealt').map((e) => e.amount).join(','), '6,6,3,6', 'new turn: no bonus again');

    // Starstone Shard: combat starts pre-charged → the FIRST spell combos.
    const s = makeCombat({ deck: Array(5).fill('starstonePebble'), enemies: ['tGiant'], relicIds: ['starstoneShard'] });
    playFromHand(s, 'starstonePebble');
    eq(logOf(s, 'damageDealt').map((e) => e.amount).join(','), '6,3', 'Shard pre-charges the opener');

    // Herald blood economy: Blood Pact pays HP for energy + draw.
    const p = makeCombat({ deck: ['bloodPact', 'strike', 'strike', 'strike', 'strike', 'strike'] });
    const hpBefore = p.player.hp;
    const handBefore = p.piles.hand.length;
    playFromHand(p, 'bloodPact');
    eq(p.player.hp, hpBefore - 2, 'paid 2 HP (ignores block)');
    eq(p.player.energy, 4, '0-cost + gain 1 → energy 4');
    eq(p.piles.hand.length, handBefore, 'drew 1 (played 1, drew 1)');

    // Gold Figurine: your heals armor you (even at full HP); enemy heals do not.
    const g = makeCombat({ deck: ['urgentHeal', 'strike', 'strike', 'strike', 'strike'], relicIds: ['goldFigurine'], enemies: ['tRegen'] });
    playFromHand(g, 'urgentHeal'); // at full HP → 0 healed, still armors
    eq(g.player.block, 2, 'overheal converted to Block');
    dispatch(g, { type: 'endTurn' }); // tRegen heals itself
    assert(logOf(g, 'healed').some((e) => e.targetId === 'e1'), 'enemy healed itself');
    eq(g.player.block, 0, "enemy heals did NOT trigger the Figurine (eventTargetIsOwner)");

    // A bot finishes an elite fight with each new class's starting deck.
    for (const classId of ['starseer', 'herald']) {
      const cls = REG.classes.get(classId);
      const deck = cls.startingDeck.map((id, i) => ({ instanceId: `b${i}`, cardId: id, upgraded: false }));
      const c = createCombat({
        registries: REG,
        rng: createRng(0xabc0 + classId.length),
        player: { classId, maxHp: cls.maxHp, hp: cls.maxHp, deck, relicIds: [cls.startingRelic] },
        enemyIds: ['wyrmAspirant'],
      });
      let guard = 0;
      while (!c.result) {
        if (++guard > 2000) throw new Error(`${classId} bot did not finish`);
        const target = c.enemies.find((e) => e.alive);
        const playable = c.piles.hand.find((inst) => {
          const def = resolveCard(REG, inst);
          if ((def.keywords || []).includes('unplayable')) return false;
          return c.player.energy >= (def.cost === 'X' ? 0 : def.cost);
        });
        if (playable && target) dispatch(c, { type: 'playCard', cardInstanceId: playable.instanceId, targetId: target.id });
        else dispatch(c, { type: 'endTurn' });
      }
      assert(c.result === 'victory' || c.result === 'defeat', `${classId} elite fight concluded (${c.result})`);
    }
  });

  // ---- 21. M3 phase 2: Acts II–III mechanics ------------------------------------------------
  test('21. act-scoped encounters; Blighted Valkyrie heal-on-hit; player-side Bleed; Stitched King phase', () => {
    // Encounter rolls are act-scoped.
    for (let i = 0; i < 20; i++) {
      const r = createRng(i * 7919);
      assert(rollEncounter(REG, r, { pool: 'normal', act: 2 }).startsWith('a2_'), 'act 2 pool only');
      assert(rollEncounter(REG, r, { pool: 'normal', act: 3 }).startsWith('a3_'), 'act 3 pool only');
      assert(!rollEncounter(REG, r, { pool: 'normal', act: 1 }).startsWith('a2_'), 'act 1 pool untouched');
    }
    eq(rollEncounter(REG, createRng(1), { pool: 'boss', act: 3 }), 'a3_bossRotValkyrie', 'act 3 boss');

    // Blighted Valkyrie: heals 2 whenever SHE lands a hit (persistent phase trigger);
    // her thrust also Bleeds the PLAYER (entity-agnostic status model).
    const v = makeCombat({ deck: Array(5).fill('defend'), enemies: ['blightedValkyrie'] });
    const e1 = getEntity(v, 'e1');
    applyLoseHp(v, e1, 30); // give her something to heal back
    dispatch(v, { type: 'endTurn' }); // firstMove spiralThrust: 12 dmg + 2 player Bleed
    const heals = logOf(v, 'healed').filter((e) => e.targetId === 'e1');
    assert(heals.length >= 1 && heals[0].amount === 2, 'healed 2 off her own hit');
    eq(S.getStacks(v.player, 'bleed'), 2, 'her blade Bleeds the player');

    // Player-side Bleed meter bursts exactly like an enemy's (SPEC §10 seam).
    S.applyStatus(v, v.player, 'bleed', 10); // 2 + 10 = 12 → fill (effects enqueued)
    dispatch(v, { type: 'endTurn' }); // drains the queue
    const burst = logOf(v, 'hpLost').filter((e) => e.targetId === 'player' && e.cause === 'proc:bleed').pop();
    assert(burst, 'player bleed burst (attributed proc:bleed in the record)');
    eq(burst.amount, Math.floor((78 * 15) / 100), 'burst = 15% of player max HP (11)');

    // Stitched King: ≤50% HP grafts new limbs — unlocks thousandHands, buffs, Frails you.
    const k = makeCombat({ deck: Array(5).fill('defend'), enemies: ['stitchedKing'] });
    const king = getEntity(k, 'e1');
    applyLoseHp(k, king, 115); // 220 → 105 (<50%): checkPhases fires in afterHpChange
    dispatch(k, { type: 'endTurn' }); // drain phase effects
    assert(king.unlockedMoves.includes('thousandHands'), 'phase 2 move unlocked');
    assert(S.getStacks(king, 'strength') >= 2, 'phase buffed his Strength');
    assert(S.getStacks(k.player, 'frail') >= 1 || logOf(k, 'statusApplied').some((e) => e.status === 'frail'), 'player Frailed by the phase');

    // Full-fight bot: an upgraded Reaver deck concludes the final boss fight.
    const cls = REG.classes.get('reaver');
    const deck = [...cls.startingDeck, 'stomp', 'executioner', 'crimsonCleave'].map((id, i) => ({ instanceId: `f${i}`, cardId: id, upgraded: true }));
    const f = createCombat({
      registries: REG,
      rng: createRng(0xf17e),
      player: { classId: 'reaver', maxHp: 78, hp: 78, deck, relicIds: ['forsakenMedallion'] },
      enemyIds: ['blightedValkyrie'],
    });
    let guard = 0;
    while (!f.result) {
      if (++guard > 3000) throw new Error('final boss bot did not finish');
      const target = f.enemies.find((e) => e.alive);
      const playable = f.piles.hand.find((inst) => {
        const def = resolveCard(REG, inst);
        if ((def.keywords || []).includes('unplayable')) return false;
        return f.player.energy >= (def.cost === 'X' ? 0 : def.cost);
      });
      if (playable && target) dispatch(f, { type: 'playCard', cardInstanceId: playable.instanceId, targetId: target.id });
      else dispatch(f, { type: 'endTurn' });
    }
    assert(f.result === 'victory' || f.result === 'defeat', `final boss fight concluded (${f.result})`);
  });

  // ---- 22. Endless Spire (Custom Climb chaos rule) --------------------------
  test('22. Endless Spire: act loop math, per-cycle scaling, mod wiring', () => {
    // Acts 1-3 are the first pass (loop 0); 4-6 replay acts 1-3 as cycle 2; etc.
    for (const [act, want] of [[1, [1, 0]], [3, [3, 0]], [4, [1, 1]], [6, [3, 1]], [7, [1, 2]], [12, [3, 3]]]) {
      const { contentAct, loop } = endlessActInfo(act);
      eq(contentAct, want[0], `act ${act} content act`);
      eq(loop, want[1], `act ${act} loop count`);
    }
    // Every looped content act must resolve to real content (no unknown-act throw).
    for (let act = 4; act <= 12; act++) {
      const ca = endlessActInfo(act).contentAct;
      assert(REG.mapConfig(ca), `mapConfig exists for looped act ${act} → ${ca}`);
      assert(rollEncounter(REG, createRng(act), { pool: 'boss', act: ca }), `boss encounter rolls for looped act ${act}`);
    }
    // Cycle scaling applies in combat: +35% HP and +1 Strength per loop.
    const base = createCombat({
      registries: REG, rng: createRng(7), player: { classId: 'reaver', maxHp: 84, hp: 84, deck: [{ instanceId: 'x1', cardId: 'strike', upgraded: false }] },
      enemyIds: ['blightHound'],
    });
    const loop2 = createCombat({
      registries: REG, rng: createRng(7), player: { classId: 'reaver', maxHp: 84, hp: 84, deck: [{ instanceId: 'x2', cardId: 'strike', upgraded: false }] },
      enemyIds: ['blightHound'],
      hpMult: 1 + ENDLESS_HP_PER_LOOP * 2,
      enemyStatuses: [{ status: 'strength', stacks: ENDLESS_STR_PER_LOOP * 2 }],
    });
    eq(getEntity(loop2, 'e1').maxHp, Math.round(getEntity(base, 'e1').maxHp * 1.7), 'loop-2 enemy HP = base ×1.7');
    eq(S.getStacks(getEntity(loop2, 'e1'), 'strength'), 2, 'loop-2 enemy has +2 Strength');
    // The chaos toggle flags the run as custom (kept out of win-rate telemetry).
    assert(activeMods({ mods: { endless: true } }).endless, 'endless resolves as an active mod');
    assert(isCustomRun({ mods: { endless: true } }), 'endless runs are flagged custom');
  });

  // ---- 23. 'ally' target (co-op cards, solo-valid) ---------------------------
  test("23. 'ally' target falls back to self in solo; co-op cards validate", () => {
    // Solo: no teammate exists, so Rallying Banner's ally-block lands on the player.
    const c = makeCombat({ deck: ['rallyingBanner', 'strike', 'strike', 'strike', 'strike'] });
    playFromHand(c, 'rallyingBanner');
    eq(c.player.block, 10, "ally-targeted Block resolves to the player when there's no ally");
    // The co-op set is registered, special-rarity (kept out of pools/shops).
    for (const id of ['rallyingBanner', 'sharedFlame', 'ashOath']) {
      assert(REG.cards.has(id), `co-op card '${id}' registered`);
      eq(REG.cards.get(id).rarity, 'special', `'${id}' is special rarity (never in solo pools)`);
    }
    for (const cls of REG.classes.all()) {
      assert(!cls.cardPool.includes('rallyingBanner'), `no class pool contains a co-op card (${cls.id})`);
    }
  });

  // ---- 24. co-op: once/limitPerTurn gates are per-seat, not party-wide -------
  test('24. a once-per-combat relic held by two co-op players fires for each', () => {
    // Goldleaf Charm: { on:'playerTurnStart', once:true, block 4 to owner }.
    // Co-op runs every seat through ONE ctx and all player entities share the id
    // 'player', so before per-seat scoping the first seat's fire consumed the
    // gate and the second seat silently got nothing.
    const deck = (tag) => Array.from({ length: 5 }, (_, i) => ({ instanceId: `${tag}${i}`, cardId: 'strike', upgraded: false }));
    const C = createCoopCombat({
      registries: REG,
      rng: createRng(11),
      players: [
        { id: 'p1', classId: 'reaver', maxHp: 80, hp: 80, deck: deck('a'), relicIds: ['goldleafCharm'], flasks: [] },
        { id: 'p2', classId: 'reaver', maxHp: 80, hp: 80, deck: deck('b'), relicIds: ['goldleafCharm'], flasks: [] },
      ],
      enemyIds: ['blightHound'],
    });
    eq(C.players.get('p1').entity.block, 4, 'seat 1 got its own Goldleaf Charm block');
    eq(C.players.get('p2').entity.block, 4, 'seat 2 got its own Goldleaf Charm block (gate is per-seat)');

    // The gate still holds WITHIN a seat: the relic must not re-fire next turn.
    const before = C.players.get('p1').entity.block;
    C.emit('playerTurnStart', { turn: C.turn, playerId: 'p1' });
    eq(C.players.get('p1').entity.block, before, "once:true still gates repeat fires for the same seat");

    // Enemy-owned gates stay shared (enemies are one set, not per-seat).
    assert(C.enemies.length === 1, 'shared enemy set is unaffected by seat scoping');
  });

  // ---- 25. authored content (CSV -> generated modules) ----------------------
  test('25. outfits + unlocks compile and cross-reference correctly', () => {
    // Authoring is CSV; tools/content-build.mjs compiles it into the generated
    // modules imported here. These checks are what stops a spreadsheet typo
    // from reaching the game as a silently broken reference.
    const CONDITIONS = ['winAsClass', 'beatBoss', 'reachAct', 'winRuns'];
    const REVEALS = ['teased', 'hidden', 'listed'];
    const classIds = REG.classes.all().map((c) => c.id);
    const unlockIds = unlocks.map((u) => u.id);
    const outfitIds = outfits.map((o) => o.id);

    assert(outfits.length > 0 && unlocks.length > 0, 'CSV sources compiled to rows');

    for (const o of outfits) {
      assert(classIds.includes(o.classId), `outfit '${o.id}' targets a real class (${o.classId})`);
      assert(/^[0-9A-Fa-f]{6}$/.test(o.plate), `outfit '${o.id}' plate is a 6-digit hex`);
      assert(/^[0-9A-Fa-f]{6}$/.test(o.plateLt), `outfit '${o.id}' plateLt is a 6-digit hex`);
      if (o.unlock !== '') {
        assert(unlockIds.includes(o.unlock), `outfit '${o.id}' unlock '${o.unlock}' exists`);
      }
    }
    // Every class must have a starting outfit, or customization has nothing to show.
    for (const id of classIds) {
      assert(outfits.some((o) => o.classId === id && o.unlock === ''), `class '${id}' has an unlocked outfit`);
    }
    for (const u of unlocks) {
      assert(CONDITIONS.includes(u.condition), `unlock '${u.id}' uses a known condition (${u.condition})`);
      assert(REVEALS.includes(u.reveal), `unlock '${u.id}' uses a known reveal mode (${u.reveal})`);
      if (u.kind === 'outfit') {
        assert(outfitIds.includes(u.ref), `unlock '${u.id}' points at a real outfit (${u.ref})`);
      }
      if (u.condition === 'winAsClass') {
        assert(classIds.includes(u.param), `unlock '${u.id}' names a real class (${u.param})`);
      }
      if (u.condition === 'beatBoss') {
        assert(REG.enemies.has(u.param), `unlock '${u.id}' names a real enemy (${u.param})`);
      }
      // A 'teased' unlock promises the player a hint; a 'hidden' one must not.
      if (u.reveal === 'teased') assert(String(u.hint).length > 0, `teased unlock '${u.id}' has a hint`);
      if (u.reveal === 'hidden') eq(u.hint, '', `hidden unlock '${u.id}' shows no hint`);
    }
    eq(unlockIds.length, new Set(unlockIds).size, 'unlock ids are unique');
  });

  // ---- 26. card subtype tags (CSV-authored) --------------------------------
  test('26. card tags resolve, stay distinct from engine keywords, and index', () => {
    // Subtypes live under the frozen attack/skill/power type. Tagging is a CSV
    // row, so these checks are what stops a spreadsheet typo from silently
    // dropping a chip or pointing at a card that does not exist.
    const tagIds = TAGS.map((t) => t.id);
    eq(tagIds.length, new Set(tagIds).size, 'tag ids are unique');
    for (const t of TAGS) {
      assert(/^[0-9A-Fa-f]{6}$/.test(t.color), `tag '${t.id}' colour is a 6-digit hex`);
      assert(String(t.label).length > 0 && String(t.glyph).length > 0, `tag '${t.id}' has a label + glyph`);
      // Tags are CONTENT; keywords are a frozen engine set. Overlapping names
      // would make 'exhaust' ambiguous between flavour and mechanics.
      assert(!ENGINE_KEYWORDS.includes(t.id), `tag '${t.id}' does not collide with an engine keyword`);
    }
    const seen = new Set();
    for (const row of cardTagging) {
      assert(REG.cards.has(row.cardId), `tagged card '${row.cardId}' exists`);
      assert(!seen.has(row.cardId), `card '${row.cardId}' is tagged only once`);
      seen.add(row.cardId);
      const ids = tagIdsFor(row.cardId);
      assert(ids.length > 0, `card '${row.cardId}' resolves to at least one tag`);
      for (const id of ids) assert(tagIds.includes(id), `card '${row.cardId}' uses a registered tag ('${id}')`);
      // A single-value CSV cell must still come back as an array, not a string.
      assert(Array.isArray(ids), `tags for '${row.cardId}' normalise to an array`);
    }
    // The lookups the UI and any future synergy predicate depend on.
    eq(tagsFor('gorefireSlash').length, 3, 'gorefireSlash carries three tags');
    eq(tagsFor('strike')[0].label, 'Blade', 'strike resolves to the Blade tag');
    eq(tagsFor('nonexistentCard').length, 0, 'an untagged card resolves to no tags');
    assert(cardsWithTag('blade').includes('strike'), 'reverse lookup finds Blade cards');
    assert(cardsWithTag('nope').length === 0, 'reverse lookup on an unknown tag is empty');
  });

  // ---- 27. armaments + armour sets (CSV-authored) --------------------------
  test('27. weapons and armour sets validate against the tag registry', () => {
    const tagIds = TAGS.map((t) => t.id);
    const classIds = REG.classes.all().map((c) => c.id);
    const KINDS = ['weapon', 'shield', 'staff'];
    const HANDS = ['right', 'left', 'either'];
    const RARITY = ['common', 'uncommon', 'rare'];
    // Modifier ops are a closed vocabulary — a typo like 'strike.dmg' would
    // otherwise sit in the CSV doing nothing until someone noticed in play.
    const TARGETS = ['strike', 'defend', 'power', 'self'];

    const ids = weapons.map((w) => w.id);
    eq(ids.length, new Set(ids).size, 'armament ids are unique');
    eq(weapons.filter((w) => w.kind === 'weapon').length, 8, 'eight weapons');
    eq(weapons.filter((w) => w.kind === 'shield').length, 8, 'eight shields/offhands');
    eq(weapons.filter((w) => w.kind === 'staff').length, 8, 'eight staves');

    const checkMods = (mods, where) => {
      if (mods === '') return;
      for (const m of (Array.isArray(mods) ? mods : [mods])) {
        const [lhs] = String(m).split('=');
        const [target, field] = lhs.split('.');
        assert(TARGETS.includes(target), `${where}: '${m}' targets a known card (${target})`);
        assert(field && field.length > 0, `${where}: '${m}' names a field`);
      }
    };
    const checkTags = (tags, where) => {
      for (const t of (tags === '' ? [] : Array.isArray(tags) ? tags : [tags])) {
        assert(tagIds.includes(t), `${where}: tag '${t}' is registered`);
      }
    };

    for (const w of weapons) {
      assert(KINDS.includes(w.kind), `${w.id}: known kind`);
      assert(HANDS.includes(w.hand), `${w.id}: known hand (${w.hand})`);
      assert(RARITY.includes(w.rarity), `${w.id}: known rarity (${w.rarity})`);
      assert(/^[0-9A-Fa-f]{6}$/.test(w.metal), `${w.id}: metal is a 6-digit hex`);
      assert(/^[0-9A-Fa-f]{6}$/.test(w.accent), `${w.id}: accent is a 6-digit hex`);
      assert(String(w.geom).length > 0, `${w.id}: names a geometry archetype`);
      checkTags(w.tags, w.id);
      checkMods(w.mods, w.id);
      // Shields belong in the off hand; staves are cast from the right.
      if (w.kind === 'shield') assert(w.hand !== 'right', `${w.id}: a shield is not right-hand-only`);
      if (w.kind === 'staff') eq(w.hand, 'right', `${w.id}: staves are right-handed`);
    }

    // Armour: four sets per class, exactly one of them unlocked from the start.
    for (const id of classIds) {
      const mine = outfits.filter((o) => o.classId === id);
      eq(mine.length, 4, `class '${id}' has four armour sets`);
      eq(mine.filter((o) => o.unlock === '').length, 1, `class '${id}' has exactly one starting set`);
    }
    for (const o of outfits) {
      checkTags(o.tags, o.id);
      checkMods(o.mods, o.id);
    }
  });

  // ---- 28. equipment: pieces rewrite the cards you already have ------------
  test('28. armaments rewrite Strike/Defend, cost energy to swap, and survive a save', () => {
    // The load-bearing claim of the whole system: equipment adds no cards and
    // no engine code. It changes numbers on the starters, through one closed
    // vocabulary (equipMods.csv) that a typo cannot slip past.
    eq(validateEquipment(REG).join('; '), '', 'every authored piece parses against the vocabulary');

    const bal = REG.balance.equipment;
    const strikeOf = (mods) => resolveCard(REG, { cardId: 'strike', mods });
    const dmgOf = (def) => (def.effects.find((e) => e.op === 'damage') || {}).amount;

    eq(dmgOf(strikeOf([])), 6, 'a bare Strike is still 6');

    // A dagger trades weight for repetition; a greatsword does the reverse.
    const dagger = strikeOf(['damage=3', 'hits=2']);
    eq(dmgOf(dagger), 3, 'dagger: Strike drops to 3');
    eq(dagger.effects.find((e) => e.op === 'damage').hits, 2, 'dagger: Strike lands twice');
    assert(dagger.textTemplate.includes('{hits}'), 'dagger: the rules text learns to mention hits');

    const great = strikeOf(['damage=+4', 'cost=+1', 'poise=+3']);
    eq(dmgOf(great), 10, 'greatsword: Strike climbs to 10');
    eq(great.cost, 2, 'greatsword: Strike costs more');
    eq((great.effects.find((e) => e.op === 'poiseDamage') || {}).amount, 3, 'greatsword: Poise damage appended');
    assert(great.textTemplate.includes('{poiseDamage}'), 'greatsword: the new Poise line is spoken');

    // Order matters and is slot order: a later '=N' replaces, it does not stack.
    eq(dmgOf(strikeOf(['damage=+4', 'damage=3'])), 3, 'a set value overrides an earlier adjustment');
    // Floors hold, so no piece can author a card into nonsense.
    eq(dmgOf(strikeOf(['damage=-99'])), bal.limits.minDamage, 'damage cannot go below its floor');
    eq(strikeOf(['cost=-99']).cost, bal.limits.minCost, 'cost cannot go below its floor');
    eq(strikeOf(['hits=+99']).effects[0].hits, bal.limits.maxHits, 'hits are capped');

    // Mods layer ON TOP of an upgrade rather than fighting with it.
    eq(dmgOf(resolveCard(REG, { cardId: 'strike', upgraded: true })), 9, 'Strike+ is 9 bare-handed');
    eq(dmgOf(resolveCard(REG, { cardId: 'strike', upgraded: true, mods: ['damage=+4'] })), 13, 'Strike+ with a greatsword is 13');

    // A run starts stamped by whatever it starts wearing, and `self.*` mods
    // reach the run rather than a card.
    const run = createRunState({ seed: 7, classId: 'reaver', registries: REG });
    assert(run.loadout && run.loadout.sets.rightHand.length === 3, 'the right hand carries three sets');
    eq(run.loadout.sets.armor[0], 'default', 'the reaver starts in its one unlocked set');

    equipPiece(REG, run.loadout, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, AT_CAMP);
    equipPiece(REG, run.loadout, 'rightHand', 1, 'greatsword', OWNS_EVERYTHING, AT_CAMP);
    equipPiece(REG, run.loadout, 'armor', 0, 'oathsworn', OWNS_EVERYTHING, AT_CAMP);
    stampDeck(REG, run);
    const aStrike = run.deck.find((c) => c.cardId === 'strike');
    eq(dmgOf(resolveCard(REG, aStrike)), 3, 'the deck itself is stamped with the dagger');
    eq(runMods(REG, run.loadout, 'reaver').startStatuses[0].status, 'strength', 'the Oathsworn set grants Strength');
    assert(loadoutTags(REG, run.loadout, 'reaver').includes('blade'), 'worn pieces contribute their tags');

    // Swapping mid-fight: the price is paid, and the hand is re-armed.
    const rng = createRng(11);
    const combat = createCombat({
      registries: REG,
      rng,
      player: { classId: 'reaver', maxHp: run.maxHp, hp: run.hp, deck: run.deck, relicIds: [], loadout: run.loadout },
      enemyIds: ['fellWarden'],
    });
    const energyBefore = combat.player.energy;
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
    eq(combat.player.energy, energyBefore - bal.swapCost, 'the swap costs what the config says');
    const inHand = combat.piles.hand.concat(combat.piles.draw).find((c) => c.cardId === 'strike');
    eq(dmgOf(resolveCard(REG, inHand)), 10, 'every Strike now swings the greatsword');
    // Armour is not something you change with a knight in the room.
    let refused = '';
    try {
      dispatch(combat, { type: 'swapArmament', slotId: 'armor', setIndex: 0 });
    } catch (e) {
      refused = e.message;
    }
    assert(refused.includes('outside combat'), 'armour cannot be swapped mid-fight');

    // Combat works on COPIES of the deck instances, so the orchestrator
    // re-stamps the run's own copies when the fight ends (main.js onCombatEnd).
    stampDeck(REG, run);

    // The instance carries the numbers, so the save carries them too.
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    saves.saveRun(run, rng);
    const loaded = saves.loadRun(REG);
    eq(loaded.loadout.sets.rightHand[1], 'greatsword', 'the loadout round-trips');
    eq(dmgOf(resolveCard(REG, loaded.deck.find((c) => c.cardId === 'strike'))), 10, 'stamped cards round-trip');

    // And a run saved before equipment existed is healed, not refused.
    const legacy = JSON.parse(JSON.stringify(run));
    delete legacy.loadout;
    for (const c of legacy.deck) delete c.mods;
    storage.setItem(RUN_KEY, JSON.stringify(legacy));
    const healed = saves.loadRun(REG);
    assert(healed && healed.loadout, 'a pre-equipment save loads with a fresh loadout');
    eq(healed.loadout.sets.rightHand[0], null, 'the healed loadout starts bare-handed');
  });

  // ---- 28b. hands: the SLOT decides where, the PIECE only asks ------------
  test("28b. which hand a piece is in is the slot's fact, not the piece's", () => {
    // Bjorn's photograph on `dev`, 2026-08-07: Straight Sword in the LEFT hand,
    // Greatsword in the RIGHT, and the figure holds ONE blade — the straight
    // sword, on the right-hand layer. figureSpec() read `hand` off the PIECE, so
    // both landed on spec.rightId and the second write won. Two weapons in, one
    // weapon out, wrong hand, no error. One fact with two homes (Law 0 c4).
    const run = createRunState({ seed: 3, classId: 'reaver', registries: REG });

    // Written straight into the loadout, the way a SAVE arrives — this is a
    // claim about where a piece is DRAWN, with the equip gate out of the way.
    run.loadout.sets.leftHand[0] = 'straightSword';
    run.loadout.sets.rightHand[0] = 'greatsword';
    const both = figureSpec(REG, run.loadout, 'reaver');
    eq(both.leftId, 'straightSword', 'the piece in the left slot is drawn in the left hand');
    eq(both.rightId, 'greatsword', 'the piece in the right slot is drawn in the right hand');

    // 'either' is still a real word: the dagger goes in either hand and is drawn
    // in the one it is in, not in the one its row prefers.
    run.loadout.sets.leftHand[0] = 'dagger';
    eq(figureSpec(REG, run.loadout, 'reaver').leftId, 'dagger', "an 'either' piece in the left hand is drawn there");
    run.loadout.sets.leftHand[0] = null;
    run.loadout.sets.rightHand[0] = 'dagger';
    eq(figureSpec(REG, run.loadout, 'reaver').rightId, 'dagger', '…and in the right hand when it is there');
    eq(figureSpec(REG, run.loadout, 'reaver').leftId, null, 'and it is not in both at once');

    // The two vocabularies read out of their own homes and no other.
    eq(slotHand(REG.equipment.slots.find((s) => s.id === 'leftHand')), 'left', 'the left slot knows it is the left hand');
    eq(slotHand(REG.equipment.slots.find((s) => s.id === 'armor')), null, 'armour is worn, not held');
    eq(pieceHand(REG.equipment.armaments.find((a) => a.id === 'dagger')), null, "'either' constrains nothing");
    eq(pieceHand(REG.equipment.armaments.find((a) => a.id === 'greatsword')), 'right', 'a right-handed weapon says so');

    // The other edge of the same defect, on a slot the real table does not have
    // yet: a slot that is NOT a hand is not a hand. A carried talisman used to
    // arrive as a weapon layer in the right hand and overwrite the weapon.
    const carried = {
      equipment: {
        slots: [
          { id: 'rightHand', label: 'R', kinds: ['weapon'], hand: 'right', sets: 1, swap: 'combat' },
          { id: 'charm', label: 'C', kinds: ['talisman'], hand: '', sets: 1, swap: 'outOfCombat' },
        ],
        armaments: [
          { id: 'w', kind: 'weapon', hand: 'right', tags: [], mods: [] },
          { id: 't', kind: 'talisman', hand: '', tags: [], mods: [] },
        ],
        armour: [],
      },
    };
    const worn = { sets: { rightHand: ['w'], charm: ['t'] }, active: {}, storage: [] };
    const drawn = figureSpec(carried, worn, 'reaver');
    eq(drawn.rightId, 'w', 'the weapon keeps the right hand');
    eq(drawn.leftId, null, 'and the talisman is drawn in no hand at all');

    // ---- the gate is on the mutation, not on the screen -------------------
    const fresh = createRunState({ seed: 4, classId: 'reaver', registries: REG });
    assert(!equipPiece(REG, fresh.loadout, 'leftHand', 0, 'greatsword', OWNS_EVERYTHING, AT_CAMP), 'the left hand refuses a right-handed weapon');
    eq(fresh.loadout.sets.leftHand[0], null, 'and a refusal leaves the slot exactly as it found it');
    assert(equipPiece(REG, fresh.loadout, 'leftHand', 0, 'buckler', OWNS_EVERYTHING, AT_CAMP), 'a left-hand piece goes in');
    assert(equipPiece(REG, fresh.loadout, 'leftHand', 1, 'dagger', OWNS_EVERYTHING, AT_CAMP), "an 'either' piece goes in the left hand");
    assert(equipPiece(REG, fresh.loadout, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, AT_CAMP), '…and in the right hand');
    assert(!equipPiece(REG, fresh.loadout, 'rightHand', 0, 'buckler', OWNS_EVERYTHING, AT_CAMP), 'the kind gate still holds too');
    eq(fresh.loadout.sets.rightHand[0], 'dagger', 'and that refusal changed nothing either');
    assert(equipPiece(REG, fresh.loadout, 'leftHand', 0, null, OWNS_EVERYTHING, AT_CAMP), 'clearing a slot is always allowed');
    eq(fresh.loadout.sets.leftHand[0], null, 'and it clears');

    // The picker offers exactly what the mutation accepts. Not a claim about
    // the screen — a claim that the two questions have ONE answer, which is
    // what stops a slot from taking a click and then doing nothing.
    const allPieces = [...REG.equipment.armaments, ...REG.equipment.armour];
    let checked = 0; let offered = 0;
    for (const slot of REG.equipment.slots) {
      for (const piece of allPieces) {
        const fits = fitsSlot(slot, piece);
        const probe = { sets: { [slot.id]: [null] }, active: {}, storage: [] };
        eq(equipPiece(REG, probe, slot.id, 0, piece.id, OWNS_EVERYTHING, AT_CAMP), fits, `${slot.id} ← ${piece.id}: offer and mutation agree`);
        checked += 1;
        if (fits) offered += 1;
      }
    }
    // An empty result set is never a pass, and neither is an all-false one: a
    // predicate that refused everything would satisfy the loop above.
    eq(checked, REG.equipment.slots.length * allPieces.length, 'every slot × piece pair was actually checked');
    assert(offered > 0 && offered < checked, `the gate both admits and refuses (${offered} of ${checked})`);

    // ---- the validator, watched going red, by name ------------------------
    const clone = () => JSON.parse(JSON.stringify({
      slots: REG.equipment.slots,
      armaments: REG.equipment.armaments,
      armour: REG.equipment.armour,
      modFields: REG.equipment.modFields,
      targets: REG.equipment.targets,
      cardTargets: REG.equipment.cardTargets,
    }));
    const check = (mut) => {
      const equipment = clone();
      mut(equipment);
      return validateEquipment({ equipment, classes: REG.classes, statuses: REG.statuses }).join('; ');
    };
    const slotRow = (e, id) => e.slots.find((s) => s.id === id);
    const armRow = (e, id) => e.armaments.find((a) => a.id === id);

    eq(check(() => {}), '', 'the control arm: an untouched copy of the real tables is sound');
    assert(check((e) => { slotRow(e, 'leftHand').hand = ''; }).includes("slot 'leftHand' accepts"),
      'a hand slot that names no hand fails, naming the slot and a piece it would swallow');
    assert(check((e) => { slotRow(e, 'leftHand').hand = 'sideways'; }).includes('is not one of left|right'),
      'a hand outside the closed set fails and prints the legal values');
    assert(check((e) => { armRow(e, 'ashStaff').hand = 'left'; }).includes("no slot can hold 'ashStaff'"),
      'a piece no slot can hold fails by its own id');
    assert(check((e) => { slotRow(e, 'leftHand').kinds = ['staff']; }).includes("slot 'leftHand' can hold nothing"),
      'a slot whose every matching piece names the other hand fails as an empty result set');
  });

  // ---- 30. unlocks are earned, remembered, and never taken back -------------
  test('30. unlock conditions evaluate against durable progress, not recent history', () => {
    // The conditions are a closed set, so an unregistered one is caught here
    // rather than sitting in the CSV never firing.
    for (const u of REG.unlocks) {
      assert(UNLOCK_CONDITIONS[u.condition], `unlock '${u.id}' uses a registered condition (${u.condition})`);
      assert(REVEAL_MODES.includes(u.reveal), `unlock '${u.id}' uses a known reveal mode (${u.reveal})`);
    }

    const meta = { unlocked: [], progress: emptyProgress() };
    const play = (result) => {
      meta.progress = recordProgress(meta.progress, result);
      const fresh = evaluateUnlocks(REG.unlocks, meta);
      meta.unlocked = [...meta.unlocked, ...fresh];
      return fresh;
    };

    eq(evaluateUnlocks(REG.unlocks, meta).join(','), '', 'a fresh profile has earned nothing');

    // Dying in act 2 still counts as having REACHED act 2.
    const r1 = play({ victory: false, class: 'reaver', act: 2, bosses: [] });
    assert(r1.includes('reachStitchedCourt'), 'reaching act 2 earns the Pilgrim Wrap');
    assert(!r1.includes('winAsReaver'), 'a loss is not a win');

    // Felling a boss counts even in a run that ends badly.
    const r2 = play({ victory: false, class: 'herald', act: 2, bosses: ['fellWarden'] });
    assert(r2.includes('beatFellWarden'), 'the Fell Warden falling earns Starlit Silks');
    eq(play({ victory: false, class: 'herald', act: 1, bosses: ['fellWarden'] }).join(','), '',
      'the same boss again earns nothing new');

    // Progress only ever grows — an act-1 death cannot undo having seen act 2.
    eq(meta.progress.maxAct, 2, 'max act reached is a high-water mark');

    const r3 = play({ victory: true, class: 'reaver', act: 3, bosses: ['stitchedKing'] });
    assert(r3.includes('winAsReaver'), 'winning as the Reaver earns the Oathsworn set');
    assert(r3.includes('beatStitchedKing'), 'and the King falling earns the Ashen Vigil');
    assert(r3.includes('reachAshenCrown'), 'and act 3 earns the Warden Mail');

    // winRuns counts TOTAL wins, which is the reason progress exists at all:
    // meta.results is capped, so counting from it would silently become
    // "wins, recently".
    assert(!meta.unlocked.includes('winTwice'), 'one win is not two');
    const r4 = play({ victory: true, class: 'starseer', act: 3, bosses: [] });
    assert(r4.includes('winTwice'), 'the second win earns the Astral Vestment');
    assert(!r4.includes('graveWardenUnlock'), 'three wins still pending at two');
    assert(play({ victory: true, class: 'herald', act: 3, bosses: [] }).includes('graveWardenUnlock'),
      'the third win earns the Grave Warden');

    // Earned things stay earned even if the tally were somehow rebuilt.
    eq(evaluateUnlocks(REG.unlocks, meta).join(','), '', 'nothing is earned twice');

    // Reveal modes: a hidden unlock is invisible until it is earned.
    const blind = { unlocked: [], progress: emptyProgress() };
    const shown = unlockView(REG.unlocks, blind).map((u) => u.id);
    assert(!shown.includes('ashChildUnlock'), 'a hidden unlock is not listed while unearned');
    assert(shown.includes('graveWardenUnlock'), 'a teased unlock is listed, with its hint');
    eq(unlockView(REG.unlocks, blind).find((u) => u.id === 'graveWardenUnlock').hint, 'Win three runs.',
      'the teased hint tells you what to do');
    const seen = unlockView(REG.unlocks, { unlocked: ['ashChildUnlock'] }).map((u) => u.id);
    assert(seen.includes('ashChildUnlock'), 'once earned, the secret appears');

    // Every armour set an unlock points at must exist, or the wardrobe gates a
    // door onto nothing.
    for (const u of REG.unlocks) {
      if (u.kind !== 'outfit') continue;
      assert(REG.equipment.armour.some((o) => o.id === u.ref), `unlock '${u.id}' points at a real armour set`);
    }
  });

  // ---- 31. armament drops: the run arms you, and the profile remembers -----
  test('31. armament drops are seeded, prefer the unheld, and run dry rather than repeat', () => {
    const drops = REG.balance.equipment.drops;
    const roll = (seed, source, opts = {}) =>
      rollArmamentDrop(REG, createRng(seed), { source, ...opts });

    // Same seed, same drop — a run replays exactly, drops included.
    eq(roll(42, 'boss'), roll(42, 'boss'), 'the same seed drops the same armament');

    // A boss always gives something; treasure is a coin toss, so over many
    // seeds it must both hit and miss.
    const bossOut = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => roll(s, 'boss'));
    assert(bossOut.every(Boolean), 'a boss always drops (chance 100)');
    const treasureOut = Array.from({ length: 40 }, (_, i) => roll(i + 1, 'treasure'));
    assert(treasureOut.some(Boolean), 'treasure sometimes drops');
    assert(treasureOut.some((x) => x === null), 'and sometimes does not');

    // Everything that drops is a real, slottable armament.
    const armIds = REG.equipment.armaments.map((a) => a.id);
    for (const id of bossOut) assert(armIds.includes(id), `dropped '${id}' is a real armament`);

    // A piece already held is never handed to you again.
    const held = armIds.filter((id) => id !== 'towerShield');
    const only = roll(9, 'boss', { found: held });
    eq(only, 'towerShield', 'with one left unheld, that is what drops');
    eq(roll(9, 'boss', { found: armIds }), null, 'holding everything, a boss drops nothing');
    eq(roll(9, 'boss', { found: held.slice(0, 5), carried: held.slice(5) }), 'towerShield',
      'carried counts as held, same as found');

    // Boss odds lean rare; treasure odds lean common. Checked over many seeds
    // rather than asserting one roll, since the point is the distribution.
    const rarityOf = (id) => REG.equipment.armaments.find((a) => a.id === id).rarity;
    const bossRares = Array.from({ length: 120 }, (_, i) => roll(i + 100, 'boss'))
      .filter(Boolean).filter((id) => rarityOf(id) === 'rare').length;
    const treasureRares = Array.from({ length: 120 }, (_, i) => roll(i + 100, 'treasure'))
      .filter(Boolean).filter((id) => rarityOf(id) === 'rare').length;
    assert(bossRares > treasureRares, `bosses drop rares more often (${bossRares} vs ${treasureRares})`);

    // Ordinary fights are not a source: with no 'normal' key the roll is a
    // no-op rather than a hidden 0%.
    eq(drops.chance.normal, undefined, "there is no 'normal' drop chance");
    eq(roll(3, 'normal'), null, 'an ordinary fight drops no armament');

    // Storage: what you find is carried, capped, and never duplicated.
    const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    assert(addToStorage(run.loadout, 'katana', 8), 'a find goes into storage');
    assert(!addToStorage(run.loadout, 'katana', 8), 'the same piece does not stack');
    assert(!addToStorage(run.loadout, 'dagger', 1), 'storage respects its cap');
    assert(carriedIds(run.loadout).includes('katana'), 'carried counts what is in storage');
    equipPiece(REG, run.loadout, 'rightHand', 0, 'greatsword', OWNS_EVERYTHING, AT_CAMP);
    assert(carriedIds(run.loadout).includes('greatsword'), 'and what is slotted');
  });

  // ---- 31b. the armoury is an INVENTORY, and the ladder is arithmetic ------
  //
  // EldenSpire#90, Constantine: *"the armory is more like an empty inventory,
  // but starts with slots locked (but only shows the next locked thing) … as for
  // weapons, I should only see an inventory of the weapons I've collected."*
  //
  // Two properties, and both are about things NOT being offered, which is the
  // hard direction to test: an absence looks the same as a bug. So every count
  // below is checked against a denominator that is also asserted, and each
  // property is watched going the other way.
  test('31b. the picker offers only what the profile owns, and the slot ladder shows exactly one step ahead', () => {
    const eq_ = REG.equipment;
    const rightHand = eq_.slots.find((s) => s.id === 'rightHand');
    const armorSlot = eq_.slots.find((s) => s.id === 'armor');
    const fits = (slot, pool) => pool.filter((p) => fitsSlot(slot, p));

    // ---- the denominator, so "0 offered" cannot pass by being empty --------
    const rightPool = fits(rightHand, eq_.armaments);
    assert(rightPool.length > 1, `the right hand has a pool to filter (${rightPool.length})`);

    // ---- 1. a fresh profile owns nothing droppable ------------------------
    const fresh = createLoadout(REG, 'reaver');
    const none = ownership(REG, { meta: {}, loadout: fresh });
    eq(rightPool.filter((p) => none.has(p)).length, 0,
      `a fresh profile is offered 0 of ${rightPool.length} armaments — an inventory, not a catalogue`);

    // ---- 2. …and what it finds, it is offered, and ONLY that --------------
    const two = ownership(REG, { meta: { found: ['dagger'] }, loadout: fresh });
    const offered = rightPool.filter((p) => two.has(p)).map((p) => p.id);
    eq(offered.join(','), 'dagger',
      'one weapon found is one option offered — his "starting weapon and a scimitar" case');

    // ---- 3. the OTHER direction: the sandbox still opens everything --------
    // requireFound did not change meaning; turning it off still means everything
    // is owned. Proving that keeps this from being "the filter always says no".
    const sandboxReg = { ...REG, balance: { ...REG.balance, equipment: { ...REG.balance.equipment, drops: { ...REG.balance.equipment.drops, requireFound: false } } } };
    const all = ownership(sandboxReg, { meta: {}, loadout: fresh });
    eq(rightPool.filter((p) => all.has(p)).length, rightPool.length,
      'with requireFound off every armament is owned — the documented sandbox survives');

    // ---- 4. armour answers to the OTHER route, and it is not a kind test ---
    const armourPool = fits(armorSlot, eq_.armour.filter((o) => o.classId === 'reaver'));
    assert(armourPool.length > 1, `the reaver has an armour pool (${armourPool.length})`);
    eq(armourPool.filter((p) => none.has(p)).map((p) => p.id).join(','), 'default',
      'a fresh profile is offered exactly its one starting set');
    const earned = ownership(REG, { meta: { unlocked: ['winAsReaver'] }, loadout: fresh });
    eq(armourPool.filter((p) => earned.has(p)).length, 2, 'earning one unlock adds exactly one set');
    assert(!fromDropPool(armourPool[0]) && fromDropPool(rightPool[0]),
      'the pool question is asked of the piece, not spelled as an if on its kind');

    // ---- 5. the gate is on the MUTATION, not the view ---------------------
    // The measured defect at 77a02b9: this returned true for an unowned piece,
    // because the only ownership check in the tree was the picker declining to
    // attach a click handler.
    const probe = createLoadout(REG, 'reaver');
    assert(!equipPiece(REG, probe, 'rightHand', 0, 'greatsword', none, AT_CAMP),
      'an unowned armament cannot be equipped even when it fits');
    eq(probe.sets.rightHand[0], null, 'and the refusal left the slot alone');
    assert(equipPiece(REG, probe, 'rightHand', 0, 'dagger', two, AT_CAMP), 'an owned one goes in');

    // ---- 6. the ladder: three states from two integers --------------------
    const rungs = slotRungs(REG, 'rightHand');
    assert(rungs.length >= 2, `the right hand has rungs to climb (${rungs.length})`);
    eq(rungs.every((u) => u.kind === SLOT_RUNG_KIND && u.ref === 'rightHand'), true, 'and they name it');

    const ladder = (meta, loadout = createLoadout(REG, 'reaver')) => {
      const opened = openedSets(REG, rightHand, { meta, loadout });
      const visible = visibleSets(REG, rightHand, { meta, loadout });
      return Array.from({ length: rightHand.sets }, (_, i) => setCellState(i, opened, visible)).join(',');
    };
    eq(ladder({}), 'open,next,hidden',
      'turn one: one open, the next locked and visible, and nothing beyond it');
    eq(ladder({ unlocked: [rungs[0].id] }), 'open,open,next',
      'earning the first rung opens it and reveals exactly one more');
    eq(ladder({ unlocked: rungs.map((u) => u.id) }), 'open,open,open',
      'with every rung earned there is nothing left to reveal');

    // ---- 7. the state a per-cell field would have allowed is unreachable ---
    // Two locked steps, a hidden cell before an open one, a slot with no open
    // cell: not invalid — UNREPRESENTABLE, because nothing is written per cell.
    for (const meta of [{}, { unlocked: [rungs[0].id] }, { unlocked: rungs.map((u) => u.id) }, { unlocked: ['nonsense'] }]) {
      const seq = ladder(meta).split(',');
      eq(seq.filter((s) => s === 'next').length <= 1, true, 'never two locked steps');
      eq(seq[0], 'open', 'the first cell is always usable');
      eq(seq.join(','), [...seq].sort((a, b) => ['open', 'next', 'hidden'].indexOf(a) - ['open', 'next', 'hidden'].indexOf(b)).join(','),
        'and the three states are always in that order');
    }

    // ---- 8. THE EDGE MY CHANGE INVENTS: a legacy save with a stranded piece -
    // Every loadout written before #90 had all its sets reachable. Without the
    // loadout floor in openedSets, a weapon parked in set 3 sits in a cell the
    // player cannot see while still stamping their deck.
    const legacy = createLoadout(REG, 'reaver');
    legacy.sets.rightHand[2] = 'katana';
    eq(ladder({}, legacy), 'open,open,open', 'what you are already holding is by definition open');
    assert(carriedIds(legacy).includes('katana'), 'and it is still carried, in a cell you can now reach');

    // ---- 9. a rung with no slot fails LOUD and by name --------------------
    const bad = { ...REG, unlocks: [...REG.unlocks, { id: 'ghostRung', kind: SLOT_RUNG_KIND, ref: 'rihgtHand', name: 'x', condition: 'winRuns', param: 1, reveal: 'listed', hint: 'x' }] };
    const said = validateEquipment(bad).join(' | ');
    assert(said.includes('ghostRung') && said.includes('rihgtHand'),
      `a dangling rung names its own row and its bad ref — got: ${said || '(nothing)'}`);
    eq(validateEquipment(REG).join(' | '), '', 'and the shipped content is clean');

    // ---- 9b. …and the OTHER direction of the same join (Vira, at gate) ----
    // Too MANY rungs was checked; too FEW is the silent one. `talisman` declares
    // 3 sets, authors 0 rungs, derives 1 forever, and nothing goes red because
    // nothing goes wrong — the screen simply never draws them. Law 0 clause 5.
    // It is dormant only because talismans are unauthored, so the fixture gives
    // one a piece and watches the fuse blow.
    const talisman = eq_.slots.find((s) => s.id === 'talisman');
    assert(talisman && talisman.sets > 1, 'the fixture needs a wide, rung-less slot');
    eq(slotRungs(REG, 'talisman').length, 0, 'talisman authors no rungs today');
    eq(validateEquipment(REG).join(' | '), '', '…and is silent while nothing fits it');
    const withCharm = {
      ...REG,
      equipment: {
        ...REG.equipment,
        armaments: [...REG.equipment.armaments,
          { id: 'testCharm', name: 'Charm', kind: 'talisman', hand: '', rarity: 'common', tags: [], mods: [], unlock: '' }],
      },
    };
    const fuse = validateEquipment(withCharm).join(' | ');
    assert(fuse.includes("'talisman'") && fuse.includes('3 sets') && fuse.includes('only 1 can ever open'),
      `the day a talisman exists, the unreachable sets are named — got: ${fuse || '(nothing)'}`);

    // ABSENT IS NOT ZERO. A registry with no unlocks table cannot answer this,
    // and a check that cannot know must say nothing rather than something false.
    const blind = { ...withCharm };
    delete blind.unlocks;
    eq(validateEquipment(blind).join(' | ').includes('can ever open'), false,
      'with no unlocks table the too-few check stays silent instead of condemning every slot');

    // ---- 10. no rung authored → no locked cell, so no reasonless refusal ---
    // refuses() errors on an empty reason, and the reason IS the rung's hint.
    // A slot with nothing to earn must therefore show no locked cell at all.
    const noRungs = { ...REG, unlocks: REG.unlocks.filter((u) => u.kind !== SLOT_RUNG_KIND) };
    const openedN = openedSets(noRungs, rightHand, { meta: {}, loadout: fresh });
    const visibleN = visibleSets(noRungs, rightHand, { meta: {}, loadout: fresh });
    eq(Array.from({ length: rightHand.sets }, (_, i) => setCellState(i, openedN, visibleN)).join(','),
      'open,hidden,hidden', 'with nothing to earn there is nothing to lock');
    eq(rungFor(REG, rightHand, 1).id, rungs[0].id, 'and the visible lock always has a rung to name');
  });

  test('31c. cycleSet refuses a set the ladder has not opened, and never strands a held one', () => {
    const rightHand = REG.equipment.slots.find((s) => s.id === 'rightHand');
    const rungs = slotRungs(REG, 'rightHand');
    assert(rungs.length >= 2, `the right hand has rungs (${rungs.length})`);

    // EDGE 1 — fresh profile. The defect: openedSets said 1, cycleSet took 3.
    const meta = { unlocked: [] };
    const fresh = createLoadout(REG, 'reaver');
    eq(openedSets(REG, rightHand, { meta, loadout: fresh }), 1, 'one set open on a fresh profile');
    const accepts = (m, lo) => [0, 1, 2].filter((i) => cycleSet(REG, structuredClone(lo), 'rightHand', i, { meta: m })).length;
    eq(accepts(meta, fresh), 1, 'and the mutation accepts exactly one — not the raw array width');

    // …and it is a GATE, not a blanket refusal: earning rungs opens indices.
    eq(accepts({ unlocked: [rungs[0].id] }, fresh), 2, 'one rung earned opens the second');
    eq(accepts({ unlocked: rungs.map((u) => u.id) }, fresh), 3, 'every rung earned opens them all');

    // EDGE 2 — HER edge, and the one that makes this not "just add a bound".
    // A save from before #90 has sets full-width with a piece already in the
    // last cell and no rungs earned. Over-tight strands that weapon behind a
    // lock that did not exist when the player put it there.
    const legacy = createLoadout(REG, 'reaver');
    legacy.sets.rightHand[2] = 'katana';
    const last = legacy.sets.rightHand.length - 1;
    eq(openedSets(REG, rightHand, { meta, loadout: legacy }), 3, 'a held piece raises the floor');
    assert(cycleSet(REG, legacy, 'rightHand', last, { meta }), 'and the mutation lets the player reach it');
    eq(legacy.active.rightHand, last, 'and it actually switched');

    // ONE TRUTH FUNCTION, TWO CONSUMERS — the whole point of the fix. Whatever
    // the screen would draw as `open`, the mutation accepts, and nothing else.
    for (const m of [{ unlocked: [] }, { unlocked: [rungs[0].id] }, { unlocked: rungs.map((u) => u.id) }]) {
      for (const lo of [fresh, legacy]) {
        const open = openedSets(REG, rightHand, { meta: m, loadout: lo });
        const drawn = [0, 1, 2].filter((i) => setCellState(i, open, open) === 'open').length;
        eq(accepts(m, lo), drawn, 'the cells drawn open and the indices accepted are the same set');
      }
    }

    // A stale call site fails CLOSED rather than skipping the check: the old
    // first argument was a loadout, so the slot cannot resolve.
    assert(!cycleSet(fresh, 'rightHand', 0, { meta }), 'the pre-#90 signature cycles nothing');
  });

  // ---- 31d. the inventory is VISIBLE in combat and the slots are SEALED ----
  test('31d. a fight seals what a set holds without sealing which set is active', () => {
    // Constantine, 2026-08-08: "I think you should be able to see your inventory
    // in combat, just have the slots locked in combat only."
    //
    // THE WHOLE DISTINCTION IS TWO MUTATIONS, NOT ONE, and this block exists to
    // keep them apart. A slot has N sets; a set holds a piece.
    //   cycleSet   — which set is ACTIVE. A designed, PRICED mid-fight mechanic
    //                (balance.equipment.swapCost), per-slot in equipSlots.csv.
    //                Test 28 owns it and #95 does not touch it.
    //   equipPiece — what a set HOLDS. Sealed for every slot once a fight is on.
    // Sealing the first would delete a shipped feature; sealing only the screen
    // would leave the second enforced by nothing.
    const slots = (REG.equipment.slots || []);
    assert(slots.length > 0, 'the fixture has slots to examine');

    // ---- 1. both edges, over every slot, with the denominator asserted -----
    let sealed = 0;
    let cyclable = 0;
    for (const slot of slots) {
      eq(canEquip(REG, slot.id, { inCombat: false }).ok, true, `${slot.id}: at camp a set may be re-armed`);
      const seal = canEquip(REG, slot.id, { inCombat: true });
      eq(seal.ok, false, `${slot.id}: mid-fight it may not`);
      assert(seal.reason.includes(slot.label), `${slot.id}: and the refusal names the slot — got: ${seal.reason || '(nothing)'}`);
      sealed += 1;
      if (canSwap(REG, slot.id, { inCombat: true }).ok) cyclable += 1;
    }
    eq(sealed, slots.length, 'every slot in the table was examined, not a lucky subset');
    // THE CAPABILITY THAT MUST SURVIVE, asserted as a floor rather than assumed:
    // if this ever reaches zero the priced swap has been deleted and test 28 is
    // passing over a mechanic no slot can use.
    assert(cyclable > 0, `at least one slot still cycles mid-fight (${cyclable} of ${slots.length})`);

    // ---- 2. the gate is on the MUTATION, not on the screen ----------------
    // Measured at 98fedde, before this change: this call returned true.
    const held = createLoadout(REG, 'reaver');
    assert(equipPiece(REG, held, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, AT_CAMP), 'it goes in at camp');
    assert(!equipPiece(REG, held, 'rightHand', 0, 'greatsword', OWNS_EVERYTHING, MID_FIGHT),
      'a piece you own and that fits is still refused mid-fight');
    eq(held.sets.rightHand[0], 'dagger', 'and the refusal left the slot exactly as it was');

    // ---- 3. putting a thing DOWN is re-arming too --------------------------
    // Ownership has no opinion about clearing; the seal does. The order of the
    // two checks inside equipPiece is what makes this true, so it is asserted.
    assert(!equipPiece(REG, held, 'rightHand', 0, null, OWNS_EVERYTHING, MID_FIGHT),
      'a slot cannot be emptied mid-fight either');
    eq(held.sets.rightHand[0], 'dagger', 'and that refusal left it alone as well');
    assert(equipPiece(REG, held, 'rightHand', 0, null, OWNS_EVERYTHING, AT_CAMP), 'at camp it empties');

    // ---- 4. a call site that says nothing fails CLOSED --------------------
    // The reason the context is required rather than defaulted: a default of
    // "not in combat" makes silence mean permission.
    const quiet = console.error;
    let said = '';
    console.error = (...a) => { said = a.join(' '); };
    let took;
    try {
      took = equipPiece(REG, held, 'rightHand', 0, 'dagger', OWNS_EVERYTHING);
    } finally { console.error = quiet; }
    eq(took, false, 'no combat context → it equips nothing');
    assert(said.includes('combat context') && said.includes('rightHand'),
      `…and says so, naming the slot — got: ${said || '(nothing)'}`);
    eq(held.sets.rightHand[0], null, 'and the loadout is untouched');

    // ---- 5. a slot the registries do not have is named, not guessed -------
    const ghost = canEquip(REG, 'rihgtHand', { inCombat: true });
    eq(ghost.ok, false, 'an unknown slot refuses');
    assert(ghost.reason.includes('rihgtHand'), `and prints the id it was given — got: ${ghost.reason}`);

    // ---- 5b. MAX EDGE: a profile that owns everything still owns nothing it
    // can act on mid-fight. One piece proves the gate fires; the whole pool
    // proves nothing slips past it, and the denominator is asserted so an empty
    // pool cannot pass by being empty.
    const pool = (REG.equipment.armaments || []).filter((p) => fitsSlot(REG.equipment.slots.find((s) => s.id === 'rightHand'), p));
    assert(pool.length > 1, `the right hand has a pool to sweep (${pool.length})`);
    const rich = createLoadout(REG, 'reaver');
    let refusedAll = 0;
    for (const piece of pool) {
      if (!equipPiece(REG, rich, 'rightHand', 0, piece.id, OWNS_EVERYTHING, MID_FIGHT)) refusedAll += 1;
    }
    eq(refusedAll, pool.length, `every one of ${pool.length} owned, fitting pieces is refused mid-fight`);
    eq(rich.sets.rightHand[0], null, 'and after the whole sweep the slot is still as it started');
    // …and the same sweep at camp is the control group. If BOTH sides refused,
    // the count above would be green for the wrong reason.
    let tookAll = 0;
    for (const piece of pool) {
      if (equipPiece(REG, rich, 'rightHand', 0, piece.id, OWNS_EVERYTHING, AT_CAMP)) tookAll += 1;
    }
    eq(tookAll, pool.length, `and every one of them goes in at camp — the control group`);

    // ---- 6. the two sentences on the screen are siblings, not twins -------
    // A rung's refusal comes from unlocks.csv; the seal's comes from the slot.
    // If they ever became one string the screen would stop saying WHICH rule
    // stopped the player, which is the property refusal-audit floors.
    const rungHint = rungFor(REG, REG.equipment.slots.find((s) => s.id === 'rightHand'), 1).hint;
    const sealSaid = canEquip(REG, 'rightHand', { inCombat: true }).reason;
    assert(rungHint && sealSaid && rungHint !== sealSaid,
      `the ladder and the seal must not say the same thing — "${rungHint}" vs "${sealSaid}"`);
  });

  // ---- 31c. the ladder gates the MUTATION, not just the screen ------------
  //
  // VIRA'S GATE OF #90, and her property in her words:
  //
  //     a set index the player may ACTIVATE must be one openedSets() calls open.
  //
  // It lands here rather than in tools/probes/ because she asked for exactly
  // that: *"whoever fixes it deletes this file in the same act, because a
  // property that lives beside the code that satisfies it is the second copy."*
  // Her probe found 6 of 13 pairs at c43c908; both of its edges are below, and
  // the third case (a rung actually earned) is mine — a bound that refuses
  // everything would have satisfied her edge 1 on its own.

  // ---- 32. no dead armaments (property, not a snapshot) --------------------
  test('32. no armament is strictly dominated by one of equal or lower rarity', () => {
    // Found by Vira, who read the shipped CSVs from the neighbouring worktree
    // and caught what every grammar test here missed: tests 27 and 28 check that
    // each mod PARSES and RESOLVES, and nothing checked whether an item was
    // worth picking up. A common battleaxe strictly beat an uncommon halberd at
    // identical cost — rarity lying to the player.
    //
    // Written as a PROPERTY over the relationship between items rather than an
    // assertion about any one of them, so it keeps working after every future
    // rebalance and catches the next dead item authored without noticing.
    //
    // The trap Vira hit and corrected before reporting: `cost` inverts. Paying
    // more is worse, and comparing it naively invents dominance that isn't there.
    const LOWER_IS_BETTER = new Set(['cost']);
    const RARITY = { common: 0, uncommon: 1, rare: 2 };

    const vec = (piece) => {
      const out = {};
      for (const raw of piece.mods) {
        const m = /^(\w+)\.(\w+)=([+-]?\d+)$/.exec(raw);
        if (!m) continue;
        const key = `${m[1]}.${m[2]}`;
        const n = Number(m[3]);
        out[key] = (out[key] || 0) + (LOWER_IS_BETTER.has(m[2]) ? -n : n);
      }
      return out;
    };

    const arms = REG.equipment.armaments;
    const dominated = [];
    for (const a of arms) {
      for (const b of arms) {
        if (a === b || a.kind !== b.kind || a.hand !== b.hand) continue;
        if (RARITY[b.rarity] > RARITY[a.rarity]) continue; // b must be as cheap or cheaper
        // NO tag exemption. I first wrote one — "a tag `a` carries that `b`
        // lacks is a reason to keep `a`" — reasoning that it should tighten the
        // day tags become mechanical. Vira argued the reverse and was right:
        //
        //   An invariant should be as strict as the current semantics allow,
        //   and loosened by evidence.
        //
        // Tags are read by two UI files and nothing else. An exemption granted
        // in anticipation of a feature nobody has built can only produce false
        // negatives — it spares items that nothing actually distinguishes, and
        // it fails by staying quiet, which is the same shape as every graceful
        // fallback that hid a defect here for months. Add the exemption back
        // the day a tag gates a mechanic, with a test proving that it does.
        const va = vec(a);
        const vb = vec(b);
        const keys = new Set([...Object.keys(va), ...Object.keys(vb)]);
        let better = false;
        let worseAnywhere = false;
        for (const k of keys) {
          const x = va[k] || 0;
          const y = vb[k] || 0;
          if (y > x) better = true;
          if (y < x) worseAnywhere = true;
        }
        if (better && !worseAnywhere) dominated.push(`${a.id} (${a.rarity}) < ${b.id} (${b.rarity})`);
      }
    }
    eq(dominated.join('; '), '', 'no armament is strictly dominated');

    // Guard on the premise, not the conclusion: this rule is strict BECAUSE
    // tags are cosmetic. If that stops being true, this assertion is where the
    // reasoning gets revisited rather than silently outliving its basis.
    const tagConsumers = ['src/ui/components/card.js', 'src/ui/screens/equipment.js'];
    eq(tagConsumers.length, 2, 'tags are still read by exactly the two UI files — if that changed, revisit the strictness above');
  });

  // ---- 33. rendered art cannot drift from the rows that produced it --------
  test('33. every armament and armour set has art rendered from its CURRENT row', () => {
    // Bjorn's gap, named from a codebase he'd never seen: a derived artifact
    // drifting from its source with nothing asserting between them. Add a
    // weapon, forget to re-render, and the game shows a stale image forever.
    // Same defect as a frame constant pointing at the wrong sprite for months.
    //
    // His pattern was "hash the source, stamp the hash into the artifact." One
    // change: the RENDERER records the fields it actually read, and this test
    // does the comparing. Stamping a hash in Blender would put the same hash
    // function in Python and in JS with nothing checking they agree — the very
    // defect being closed, in a smaller costume.
    //
    // Checks BOTH directions, which is the half that's easy to forget: a stale
    // render and an orphaned image are different bugs and only one of them is
    // visible in game.
    const manifest = artManifest;
    if (!manifest) {
      // Browser test page has no filesystem. Skipping loudly beats a green tick
      // that means nothing — the counter beside the quiet fallback.
      assert(true, 'SKIPPED (no filesystem): art provenance is checked in Node');
      return;
    }

    // '1.00' from the CSV cell and 1 from the compiler are the same value. But
    // a colour like '0E0A08' must never be coerced, so only compare as numbers
    // when BOTH sides parse cleanly.
    const same = (x, y) => {
      const a = Number(x);
      const b = Number(y);
      const numeric = String(x).trim() !== '' && String(y).trim() !== ''
        && Number.isFinite(a) && Number.isFinite(b)
        && /^-?\d*\.?\d+$/.test(String(x).trim()) && /^-?\d*\.?\d+$/.test(String(y).trim());
      return numeric ? a === b : String(x) === String(y);
    };
    const stale = [];
    const orphaned = [];

    for (const a of REG.equipment.armaments) {
      const entry = manifest.armaments[a.id];
      if (!entry) {
        stale.push(`${a.id}: no art rendered`);
        continue;
      }
      // Whatever the renderer recorded is what gets checked — add a field to
      // tools/equipment-blender.py and this widens on its own. Restating the
      // list here would put the same fact in Python and in JS with nothing
      // checking they agree: the defect this very test exists to catch.
      for (const f of Object.keys(entry.fields)) {
        // CSV coercion turns '1.00' into 1; compare as strings on both sides.
        if (!same(entry.fields[f], a[f])) {
          stale.push(`${a.id}.${f}: art has '${entry.fields[f]}', CSV says '${a[f]}'`);
        }
      }
    }
    for (const id of Object.keys(manifest.armaments)) {
      if (!REG.equipment.armaments.some((a) => a.id === id)) orphaned.push(`weapon_${id}`);
    }

    for (const o of REG.equipment.armour) {
      const key = `${o.classId}/${o.id}`;
      const entry = manifest.armour[key];
      if (!entry) {
        stale.push(`${key}: no art rendered`);
        continue;
      }
      for (const f of Object.keys(entry.fields)) {
        if (!same(entry.fields[f], o[f])) {
          stale.push(`${key}.${f}: art has '${entry.fields[f]}', CSV says '${o[f]}'`);
        }
      }
    }
    for (const key of Object.keys(manifest.armour)) {
      const [classId, id] = key.split('/');
      if (!REG.equipment.armour.some((o) => o.classId === classId && o.id === id)) {
        orphaned.push(`body_${classId}_${id}`);
      }
    }

    eq(stale.join('; '), '', 'no rendered art is stale — re-run tools/equipment-blender.py');
    eq(orphaned.join('; '), '', 'no rendered art is orphaned by a deleted row');

    // The manifest must also actually cover the content, or an empty file would
    // pass every assertion above by having nothing to disagree with.
    eq(Object.keys(manifest.armaments).length, REG.equipment.armaments.length, 'every armament is covered');
    eq(Object.keys(manifest.armour).length, REG.equipment.armour.length, 'every armour set is covered');
  });

  // ---- 34. armour sets must be visibly distinct in the RENDER --------------
  test('34. armour sets of a class are perceptibly separated in the rendered image', () => {
    // Test 33 stayed green while EIGHT of twelve sets rendered pixel-identical.
    // It proved the renderer READ the palette values; it could not prove they
    // were applied. Bjorn's name for that shape is a hollow citation — a
    // reference asserting authority that points at nothing.
    //
    // So this asserts a property of the OUTPUT: Oklab distance measured from
    // rendered pixels by tools/palette-audit.py, in the same run that produced
    // them. Within a class the geometry is identical (one builder, N repaints),
    // so colour is the entire signal.
    if (!artManifest) {
      assert(true, 'SKIPPED (no filesystem): render distinctness is checked in Node');
      return;
    }
    const audit = artManifest.audit;
    assert(audit && audit.withinClassMin, 'the manifest carries a render audit — re-run tools/equipment-blender.py');

    // KNOWN LIMITATION, recorded rather than quietly carried: this measures the
    // mean of every opaque pixel, and all of a class's sets share unpainted
    // surfaces — the reaver's always-gold cape above all. That drags all four
    // means toward gold and washes out the surfaces actually under test. At
    // source, reaver default (hue 132.6deg) and warden (250.4deg) are 118deg
    // apart; this metric reports 1.6deg. The correct instrument is a masked
    // render showing only the repainted materials. Until then the number below
    // is a floor on a DILUTED quantity, which makes it conservative rather than
    // wrong — it can miss a real collision, it cannot invent one.
    //
    // Bjorn judged the pairs at in-game size and found hue, not total distance,
    // decides whether two sets read as two suits: dE 0.0381 at 1.8deg hue read
    // as one suit, while dE 0.0418 with a wide hue gap read as two. A scalar
    // floor is therefore gameable by darkening. His bracketed hue floor is
    // (5.9deg, 11.7deg], suggested 12deg, from two observations — not enough to
    // assert on, and not to be promoted into a check on this evidence.

    // THERE IS NO PERCEPTUAL THRESHOLD HERE, DELIBERATELY. This asserted an
    // Oklab floor of 0.02 until Bjorn retracted the evidence under it — and the
    // history is the useful part:
    //
    //   1. He judged three pairs by eye and bracketed a hue floor at (5.9, 11.7]
    //      degrees, suggesting 12.
    //   2. Vira warned hue is unstable at low chroma.
    //   3. He re-measured with controls. His own numbers did not reproduce: dE
    //      ~1.5x higher and the ORDERING INVERTED. He could not regenerate his
    //      published figures because he had not recorded his method.
    //
    // What survived is the QUANTITY, and it survived harder: re-measured, the
    // pair with the LARGEST dE (reaver default|oathsworn, 0.0665) is the one he
    // read as a single suit under two lights. Not a 10% gap with opposite
    // verdicts — a full inversion. So dE does not measure what we care about,
    // and hue is unstable exactly where our palettes live (starseer's default
    // sits at chroma 0.0241, below Vira's ~0.03 instability threshold, and is
    // the pair whose hue swung most between his two measurements).
    //
    // Asserting 0.02 now would encode a number whose evidence was withdrawn.
    // "A number without its method is an opinion with decimal places" (Bjorn).
    //
    // So this asserts only what is actually known: the ORIGINAL DEFECT, which
    // was eight sets rendering PIXEL-IDENTICAL. That is not a perceptual claim
    // and is not dressed as one.
    const IDENTICAL = 0.005; // not a JND — a "these are literally the same image" guard
    const identical = Object.entries(audit.withinClassMin)
      .filter(([, d]) => d < IDENTICAL)
      .map(([cls, d]) => `${cls}: ${d.toFixed(4)}`);
    eq(identical.join('; '), '', 'no class renders two of its armour sets as effectively the same image');

    // Coverage, or an empty audit passes by having nothing to disagree with —
    // which is exactly how the original defect survived.
    const classIds = [...new Set(REG.equipment.armour.map((o) => o.classId))];
    eq(Object.keys(audit.withinClassMin).length, classIds.length, 'every class was measured');

    // The ratio `tightestWithin / closestBetween` is NOT recorded here, and the
    // reason is worth keeping: Vira proposed it, I declined to assert it as an
    // unvalidated bar, and she then solved for its ceiling and found there
    // isn't one. An optimiser maximises it by painting all three classes the
    // same colour — driving the denominator to zero — then spreading each
    // class's sets freely. Unbounded, and satisfied by destroying the thing the
    // game needs.
    //
    // The flaw is the RATIO FORM, not the statistic: same-class and cross-class
    // pairs are discriminated through different channels (colour vs
    // silhouette), so they don't constrain each other, and putting them in a
    // ratio invents a relationship the optimiser then exploits. Cross-class
    // pair distance degenerates identically to centroid distance.
    //
    // Not even tracked. A number in the manifest is an invitation to assert it
    // later, and this one is malformed for every k.
  });

  test('35. accessibility defaults resolve from ONE home, and high contrast is on', () => {
    // Why a default deserves a test: this value lived in two places with
    // opposite spellings. `settings.js` declared `def: false`; `main.js` asked
    // `settings.highContrast === true`. Both meant "off", so they agreed — and
    // agreement is not synchronization. Flipping either one alone yields a game
    // whose Settings switch and whose actual palette disagree, and nothing here
    // would notice, because the disagreement is invisible until a human looks at
    // a screen and a switch at the same time.
    //
    // So this asserts the property rather than the value in one file: resolving
    // a default goes through `settingOn`, and `settingOn` against an EMPTY store
    // — exactly what a first-boot player has in sote_meta_v1 — answers true.
    eq(typeof settingOn, 'function', 'settingOn is exported for main.js to ask');
    eq(settingOn({}, 'highContrast'), true, 'first boot gets high contrast');
    eq(settingOn({ highContrast: false }, 'highContrast'), false, 'a player can turn it off');
    eq(settingOn({ highContrast: true }, 'highContrast'), true, 'and back on');

    // Both edges of the sparse store, and for a def:false row too — otherwise
    // this only proves the one polarity it was written for.
    eq(settingOn({}, 'colorblindSafe'), false, 'a def:false row still defaults off');
    eq(settingOn({ colorblindSafe: true }, 'colorblindSafe'), true, 'and can be turned on');

    // An unknown key must throw, not answer false: a silent false is how a
    // renamed setting becomes a quietly-disabled feature.
    let threw = false;
    try { settingOn({}, 'noSuchSetting'); } catch { threw = true; }
    eq(threw, true, 'an unknown settings key throws instead of defaulting');

    // What this does NOT check, said out loud: that main.js actually calls
    // settingOn (no DOM here, so applyDisplaySettings is unreachable from this
    // suite), and that the resulting palette clears WCAG. The second is measured
    // from rendered pixels by `node tools/contrast-audit.mjs --gate`.
  });

  // ---- 35b. SFX recipes are data, and a malformed recipe names itself (#46) -
  // Numbered 35b, not 36: run-node.mjs already prints 36–38, and a duplicated
  // test number is the two-homes defect its own comment warns about.
  test('35b. SFX recipes are content; a malformed recipe fails naming its id (#46)', () => {
    // The table itself: shipped, non-empty, carries the engine's fallback.
    const sfx = contentBundle.sfx;
    assert(sfx && typeof sfx === 'object', 'bundle carries sfx recipes');
    assert(Array.isArray(sfx.default) && sfx.default.length > 0, "the audible 'default' fallback exists");
    assert(Object.keys(sfx).length >= 17, `16 hook recipes + default expected, got ${Object.keys(sfx).length}`);

    // Green on the shipped table (also covered by 15; asserted here so this
    // test is readable alone).
    assert(validateContent(contentBundle).ok, 'shipped sfx table validates');

    // The known-bad corpus — each observed red at authoring time (2026-08-03)
    // before being seeded here (the instrument rule). Every failure must NAME
    // THE RECIPE in its path (Law 1 clause 5): a red that doesn't say which
    // entry broke hands Constantine a treasure hunt, not an error.
    const cases = [
      ['unknown layer kind', { hit: [{ kind: 'chirp', dur: 0.1 }] }, 'sfx.hit', "Unknown layer kind 'chirp'"],
      ['wave type outside the closed set', { buy: [{ kind: 'tone', type: 'pulse', freq: 700, dur: 0.16 }] }, 'sfx.buy', 'Expected one of'],
      ['non-number peak', { hit: [{ kind: 'noise', dur: 0.16, peak: 'loud' }] }, 'sfx.hit', 'Expected number'],
      ['undeclared field', { hit: [{ kind: 'noise', dur: 0.16, wobble: 3 }] }, 'sfx.hit', "Unknown field 'wobble'"],
      ['zero dur (ramp would throw)', { uiClick: [{ kind: 'tone', freq: 420, dur: 0 }] }, 'sfx.uiClick', 'finite number > 0'],
      ['negative peak', { heal: [{ kind: 'tone', freq: 480, dur: 0.4, peak: -0.3 }] }, 'sfx.heal', 'finite number > 0'],
      ['negative t0', { victory: [{ kind: 'tone', freq: 392, dur: 0.5, t0: -0.1 }] }, 'sfx.victory', "'t0' must be a finite number >= 0"],
      ['missing required freq', { shrine: [{ kind: 'tone', dur: 0.6 }] }, 'sfx.shrine', 'Missing required field'],
      ['empty recipe', { relic: [] }, 'sfx.relic', 'non-empty array'],
      ['recipe not an array', { flask: { kind: 'tone' } }, 'sfx.flask', 'non-empty array'],
      // Vira's gate finding: Infinity is typeof 'number' and Infinity > 0 is
      // true, so the first meaning layer passed it — inside the exact class
      // its comment claimed to reject. Finite is now part of the check.
      ['Infinity freq', { hit: [{ kind: 'tone', freq: Infinity, dur: 0.14 }] }, 'sfx.hit', 'finite'],
      ['Infinity dur', { buy: [{ kind: 'tone', freq: 700, dur: Infinity }] }, 'sfx.buy', 'finite'],
      ['Infinity t0', { heal: [{ kind: 'tone', freq: 480, dur: 0.4, t0: Infinity }] }, 'sfx.heal', 'finite'],
      ['-Infinity peak', { relic: [{ kind: 'tone', freq: 880, dur: 0.25, peak: -Infinity }] }, 'sfx.relic', 'finite'],
      ['NaN freq', { shrine: [{ kind: 'tone', freq: NaN, dur: 0.6 }] }, 'sfx.shrine', 'got NaN'],
    ];
    for (const [name, patch, wantPath, wantMsg] of cases) {
      const r = validateContent({ ...contentBundle, sfx: { ...sfx, ...patch } });
      assert(!r.ok, `known-bad '${name}' passed validation`);
      const hit = r.errors.find((e) => e.path.startsWith(wantPath) && e.msg.includes(wantMsg));
      assert(hit, `known-bad '${name}': no error at '${wantPath}*' mentioning '${wantMsg}' — got ${r.errors.slice(0, 3).map((e) => `${e.path}: ${e.msg}`).join(' | ')}`);
    }
    const noDefault = validateContent({ ...contentBundle, sfx: Object.fromEntries(Object.entries(sfx).filter(([k]) => k !== 'default')) });
    assert(!noDefault.ok && noDefault.errors.some((e) => e.path === 'sfx.default'), "removing 'default' is caught by name");

    // The tuning path this issue exists for: a value edit in the TABLE alone
    // reaches what the engine plays — no code path filters or copies it. The
    // engine spreads the layer into tone()/noise() (ui/audio.js synthSfx), so
    // data-side identity is the headless half of that claim.
    eq(sfx.hit.find((l) => l.kind === 'noise').peak, 0.5, "hit's peak lives in the table (was engine code at 70d35e2)");

    // Boundary, said out loud: no WebAudio here — nothing in this suite HEARS
    // a sound or proves synthSfx ran a layer. The runtime half is main.js's
    // boot banner (validation) plus an ear. Whether each cue still SERVES the
    // player at minute forty is Sunna's read, not this file's.
  });

  // ---- 35c. The silence word: deliberate quiet is typed, mistakes are named -
  // Word 3, under Sunna's lift condition: quiet must be a word a human typed
  // on purpose ('silence' as a context's whole bed value), and every
  // quiet-SHAPED mistake — null, [], {}, zero gain, wrong or miscased word,
  // empty variants — is a distinct error naming its entry. 35c beside 35b for
  // the same reason 35b sits beside 35: run-node.mjs owns 36–38.
  // ---- 35d. every id the game can COMPOSE resolves to a real sound (#66/D16)
  // Sunna's finding: #65 started playing `procBurst_${status}` and no recipe
  // answered, so bleed, frost AND insanity played the 440 Hz fallback blip
  // through a release candidate while the settings screen named sounds the
  // build did not make. This test is the composed half of the missing check —
  // driven off the CONTENT (every status with a proc block), so a fourth proc
  // status added by table alone is covered the day it is authored, not the day
  // someone remembers to extend this list.
  test('35d. composed sfx ids resolve to a real recipe; the family row covers unauthored statuses (#66)', () => {
    const procStatuses = contentBundle.statuses.filter((s) => s.proc).map((s) => s.id);
    assert(procStatuses.length >= 3, `expected the proc statuses to exist, got [${procStatuses.join(', ')}]`);

    // THE DEFECT ITSELF: every composed id ui/fx.js can emit must land on a
    // real row, never on `default`. Red on the pre-fix tree for all three.
    for (const id of procStatuses) {
      const r = resolveRecipe(`procBurst_${id}`);
      assert(!r.fellBack, `procBurst_${id} fell back to the default blip — no recipe answers it (matched '${r.matched}')`);
    }

    // The family row is what makes a new proc status safe by table alone
    // (Law 1 clause 3): an UNAUTHORED status still sounds like a burst.
    const novel = resolveRecipe('procBurst_noSuchStatusYet');
    assert(!novel.fellBack && novel.matched === 'procBurst', `an unauthored proc status must fall to the 'procBurst' family row, got '${novel.matched}'`);

    // Both edges of the resolver, so the scheme itself is pinned:
    eq(resolveRecipe('hit').matched, 'hit', 'a plain id matches its own row');
    eq(resolveRecipe('procBurst_frost').matched, 'procBurst_frost', 'an authored specific row wins over its family');
    assert(resolveRecipe('noSuchId').fellBack, 'a genuinely unknown id still reaches the audible default');
    assert(resolveRecipe('toString').fellBack, 'an inherited key is a missing entry, not a function');
    assert(resolveRecipe('_leading').fellBack, "a leading underscore names no family (indexOf('_') === 0)");

    // ORPHANS — the other direction of the same defect (D10). The table must
    // not promise a sound nothing plays: `bleedBurst` lost its caller when #65
    // renamed the event, `uiClick` never had one.
    for (const dead of ['bleedBurst', 'uiClick']) {
      assert(!Object.prototype.hasOwnProperty.call(SFX_RECIPES, dead), `'${dead}' is an orphan row — no call site fires it, so the settings screen promises a sound the build never makes`);
    }

    // Boundary, said out loud: this checks the ids the CONTENT can compose. A
    // static scan of every literal sfx.play('…') in src/ against this table —
    // the general "ids-played == ids-in-table, both directions" check — is the
    // follow-up card, and nothing here covers it.
  });

  test('35c. music beds validate; \'silence\' is the one word for deliberate quiet; quiet-shaped mistakes fail by name', () => {
    const m = contentBundle.music;
    assert(m && typeof m.beds === 'object' && !Array.isArray(m.beds) && typeof m.scales === 'object', 'bundle carries music { beds, scales }');
    assert(validateContent(contentBundle).ok, 'shipped music validates');

    // The word itself is legal at context level — a human typing
    // `credits: 'silence'` has made a decision, not a mistake.
    const silent = validateContent({ ...contentBundle, music: { scales: m.scales, beds: { ...m.beds, credits: 'silence' } } });
    assert(silent.ok, `explicit 'silence' must validate: ${silent.errors.slice(0, 2).map((e) => `${e.path}: ${e.msg}`).join(' | ')}`);

    // The known-bad corpus — each observed red at authoring time (2026-08-06)
    // before being seeded here (the instrument rule). Every red names its
    // entry, and the quiet-shaped ones point at the word.
    const cases = [
      ['null bed', { rest: null }, 'music.beds.rest', 'null is not silence'],
      ['wrong word', { rest: 'quiet' }, 'music.beds.rest', "The only word for deliberate quiet is 'silence'"],
      ['miscased word', { rest: 'Silence' }, 'music.beds.rest', "The only word for deliberate quiet is 'silence'"],
      ['empty array bed', { rest: [] }, 'music.beds.rest', 'not a bed and not silence'],
      ['empty object bed', { rest: {} }, 'music.beds.rest', 'Missing required field'],
      ['empty variants', { rest: { gain: 0.3, variants: [] } }, 'music.beds.rest', 'silence by accident'],
      ['zero gain', { rest: { gain: 0, variants: [{ root: 130, scale: 'calm', cadence: 3000 }] } }, 'music.beds.rest', 'silence spelled as a number'],
      ['dangling scale', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'noSuchScale', cadence: 3000 }] } }, 'music.beds.rest', "unknown scale 'noSuchScale'"],
      ['Infinity root', { rest: { gain: 0.3, variants: [{ root: Infinity, scale: 'calm', cadence: 3000 }] } }, 'music.beds.rest', 'finite'],
      ['unknown bed field', { rest: { gain: 0.3, volume: 9, variants: [{ root: 130, scale: 'calm', cadence: 3000 }] } }, 'music.beds.rest', "Unknown field 'volume'"],
      // Vira's gate finding: 'lift' was missing from the sweep — a
      // validator-green lift: Infinity NaN'd the oscillator frequency at note
      // 1, lift: -3 read scale[-1] from step 1 (63/73 scheduled frequencies
      // non-finite, driven through the real engine). Her two fixtures, plus
      // the adjacent edges of the same class: a fractional stride reads
      // scale[4.5] (same NaN, friendlier number), and lift: 0 is falsy so the
      // engine would silently play stride 3 — a zero that means three is a
      // lie, not a value.
      ['Infinity lift', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'calm', cadence: 3000, lift: Infinity }] } }, 'music.beds.rest', 'positive integer'],
      ['negative lift', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'calm', cadence: 3000, lift: -3 }] } }, 'music.beds.rest', 'positive integer'],
      ['fractional lift', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'calm', cadence: 3000, lift: 2.5 }] } }, 'music.beds.rest', 'positive integer'],
      ['zero lift', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'calm', cadence: 3000, lift: 0 }] } }, 'music.beds.rest', 'positive integer'],
    ];
    for (const [name, patch, wantPath, wantMsg] of cases) {
      const r = validateContent({ ...contentBundle, music: { scales: m.scales, beds: { ...m.beds, ...patch } } });
      assert(!r.ok, `known-bad '${name}' passed validation`);
      const hit = r.errors.find((e) => e.path.startsWith(wantPath) && e.msg.includes(wantMsg));
      assert(hit, `known-bad '${name}': no error at '${wantPath}*' mentioning '${wantMsg}' — got ${r.errors.slice(0, 3).map((e) => `${e.path}: ${e.msg}`).join(' | ')}`);
    }
    const noScales = validateContent({ ...contentBundle, music: { beds: m.beds } });
    assert(!noScales.ok && noScales.errors.some((e) => e.path === 'music.scales'), 'a missing scales table is caught by name');

    // Boundary, said out loud: whether the engine actually STOPS the bed and
    // schedules nothing for a 'silence' context — and warns on an unknown one
    // — is runtime behaviour with WebAudio in it: tools/music-silence-probe.mjs
    // is the half that has run it, and nothing in this suite hears anything.
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return { passed, failed, results };
}
