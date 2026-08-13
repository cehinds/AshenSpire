// tests/engine.test.js — headless engine/model/content tests (SPEC §8)
//
// Runs identically in Node (tests/run-node.mjs) and the browser
// (tests/index.html). No DOM access. Tests 12–13 (map gen, save) are M2 and
// reported as skipped placeholders.

import { contentBundle } from '../src/content/index.js';
import { MAP_SHAPE_LIMITS } from '../src/content/mapconfig.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import {
  validateContent,
  extractTemplateTokens,
  computeTokenBindings,
} from '../src/model/validate.js';
import { resolveFloorPlan, applyRunShape, minViableFloors, MAP_SHAPE_KEYS } from '../src/model/floorplan.js';
import { createRng, seedFromString, seedToString, seedProblem, SEED_MAX_LEN, sweepSeed } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, previewIntent, getEntity } from '../src/engine/combat.js';
import { computeAttackDamage, applyLoseHp } from '../src/engine/actions.js';
import * as S from '../src/engine/statuses.js';
import { generateActMap, sampleActShape } from '../src/engine/mapgen.js';
import { createSaveManager, createMemoryStorage, RUN_KEY, RUN_ARCHIVE_KEY, META_KEY, META_BACKUP_KEY, META_SCHEMA_VERSION } from '../src/engine/save.js';
import { createRunState, RUN_SCHEMA_VERSION, validateRunShape, serializeRun } from '../src/model/state.js';
import { resourceBarPlan, resourceDomains } from '../src/model/resources.js';
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
  ownership, fromDropPool, OWNERSHIP_GATES, slotRungs, openedSets, visibleSets, rungFor, setCellState,
  SLOT_RUNG_KIND, createLoadout, cycleSet, canSwap, canEquip,
  swapCostFor, resolveSwapCostRule, SWAP_COST_BASES, RUN_MOD_APPLIES,
} from '../src/model/loadout.js';
import {
  UNLOCK_CONDITIONS, REVEAL_MODES, PRESENT_STATES, emptyProgress, recordProgress, evaluateUnlocks,
  unlockView, revealState, pieceReveal,
} from '../src/model/unlocks.js';
import { ENGINE_KEYWORDS } from '../src/model/schemas.js';
// The one UI import in this suite, and it is deliberate: `settingOn` is where a
// default now lives, so a default is testable headlessly. settings.js reaches no
// DOM at module scope (verified — it imports cleanly under plain Node), so the
// "no DOM access" rule at the top of this file still holds.
import { settingOn, resolveTapSize } from '../src/ui/screens/settings.js';
// The second UI import, and the same deliberateness: LOCK_COPY is the words for
// a closed set the MODEL declares, so "every route has a sentence" is a join
// this suite can check. uiContent.js is data and touches no DOM at module scope.
import { LOCK_COPY, PARCHMENT_ACTS, PARCHMENT_EXT, BACKDROP_ACTS, parchmentAsset, backdropClass, actPlate } from '../src/ui/uiContent.js';

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

// #104 — THE WIDE, SEALED SLOT, WOKEN ONCE. `talisman` is the only row in
// equipSlots.csv that is BOTH multi-set (`sets=3`) and `swap=outOfCombat`, so it
// is the only cell where the swap seal and the set ladder can be told apart —
// every other multi-set slot is combat-swappable, which is exactly why a whole
// gate could go unenforced with the suite green. It is empty in shipped content,
// so two checks have to wake it: 31b's too-few-rungs fuse and 31e's mid-fight
// seal. **Waking it twice would be the second copy**, and the dormancy is one
// CSV row deep either way (Law 1 clause 1) — so it is authored here, once, as
// test-only content that is never shipped.
const TEST_CHARM = {
  id: 'testCharm', name: 'Charm', kind: 'talisman', hand: '',
  rarity: 'common', tags: [], mods: [], unlock: '',
};
const REG_CHARM = {
  ...REG,
  equipment: { ...REG.equipment, armaments: [...REG.equipment.armaments, TEST_CHARM] },
};

// deck: array of cardId strings or { id, up: true }
function makeCombat({ seed = 0xc0ffee, deck = ['strike'], enemies = ['tDummy'], hp = 78, maxHp = 78, mana = 2, maxMana = 2, relicIds = [], flasks = [] } = {}) {
  const rng = createRng(seed >>> 0);
  const instances = deck.map((d, i) => {
    const isObj = typeof d === 'object';
    return { instanceId: `c${i + 1}`, cardId: isObj ? d.id : d, upgraded: isObj ? !!d.up : false };
  });
  return createCombat({
    registries: REG,
    rng,
    player: { classId: 'reaver', maxHp, hp, mana, maxMana, deck: instances, relicIds, flasks },
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

export async function runTests({ artManifest = null, assetExists = null } = {}) {
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

  // These two falsifiers use SHIPPED cards whose tags exist only in the
  // generated cardTagging.csv index. Neither damage effect carries a copied
  // `tags` field, so green here proves the real card door derives the hit's
  // identity rather than preserving the old test-only tagged-effect fixture.
  test('7e2. Frost-Exposed changes a real Starstone hit through cardTagging.csv', () => {
    const c = makeCombat({ deck: ['starstonePebble'], enemies: ['tGiant'] });
    const e1 = getEntity(c, 'e1');
    const def = REG.cards.get('starstonePebble');
    assert(def.effects.filter((eff) => eff.op === 'damage').every((eff) => eff.tags === undefined), 'Starstone Pebble damage does not hand-copy CSV tags');
    assert(tagIdsFor('starstonePebble').includes('starstone'), 'CSV index names Starstone Pebble as starstone');
    S.applyStatus(c, e1, 'frostExposed', 1);
    const pv = previewCard(c, c.piles.hand[0].instanceId, 'e1');
    eq(pv.values.find((v) => v.op === 'damage').value, 7, 'preview derives starstone: floor(6 × 1.25)');
    playFromHand(c, 'starstonePebble');
    eq(logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop().amount, 7, 'execution derives the same starstone hit');
  });

  test('7e3. Unraveled changes a real Blight hit through cardTagging.csv', () => {
    const c = makeCombat({ deck: ['blightTouch'], enemies: ['tGiant'] });
    const e1 = getEntity(c, 'e1');
    const def = REG.cards.get('blightTouch');
    assert(def.effects.filter((eff) => eff.op === 'damage').every((eff) => eff.tags === undefined), 'Blight Touch damage does not hand-copy CSV tags');
    assert(tagIdsFor('blightTouch').includes('blight'), 'CSV index names Blight Touch as blight');
    S.applyStatus(c, e1, 'insanityExposed', 1);
    const pv = previewCard(c, c.piles.hand[0].instanceId, 'e1');
    eq(pv.values.find((v) => v.op === 'damage').value, 6, 'preview derives blight: floor(5 × 1.3)');
    playFromHand(c, 'blightTouch');
    eq(logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop().amount, 6, 'execution derives the same blight hit');
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

  // ---- 13c. The profile exists BEFORE the first run (M7) ----------------------
  // His ask: "profile should be able to be created before first run, not after".
  // Bjorn's walk on the shipped bundle at cd3da94: cleared storage, picked a
  // class, typed a name, pressed BEGIN THE CLIMB — `sote_run_v1` written,
  // `sote_meta_v1` absent, and Settings → Profile printing his own sentence back
  // at him. Every assertion below was observed RED at dev cd3da94 by running
  // this file against that tree; the screen half — the same walk in a real
  // browser, on the shipped bundle — is tools/profile-first-run.mjs.
  test('13c. a profile exists before the run does, is written first, survives an abandon, and never overwrites one that is there', () => {
    // A storage that REMEMBERS THE ORDER of writes. "Before" is the whole ask,
    // and a test that only checks both keys exist at the end cannot tell the
    // ask from its opposite.
    const logged = () => {
      const inner = createMemoryStorage();
      const writes = [];
      return {
        writes,
        getItem: (k) => inner.getItem(k),
        setItem: (k, v) => { writes.push(k); return inner.setItem(k, v); },
        removeItem: (k) => inner.removeItem(k),
      };
    };
    const aRun = () => {
      const r = createRunState({ seed: 0xc1a55, classId: 'reaver', registries: REG });
      r.floor = 1;
      return r;
    };

    // 1 — the class-pick commit. main.js calls ensureProfile() one line above
    // createRunState, so this is that call, and the run write follows it.
    const s1 = logged();
    const m1 = createSaveManager(s1);
    eq(s1.getItem(META_KEY), null, 'a cleared browser starts with no profile');
    const made = m1.ensureProfile();
    assert(made.created && made.ok, 'ensureProfile creates one when there is none');
    assert(s1.getItem(META_KEY) != null, 'and it is REAL BYTES, not an object a reader synthesized');
    eq(m1.profileStatus().state, 'ok', 'the named state says a profile is there');
    eq(JSON.parse(s1.getItem(META_KEY)).schemaVersion, META_SCHEMA_VERSION, 'stamped like any other profile');
    m1.saveRun(aRun(), null, 1);
    assert(s1.writes.indexOf(META_KEY) < s1.writes.indexOf(RUN_KEY), 'the profile is written BEFORE the run, not after');

    // 2 — the structural half, on its own: a start path that forgets to ask.
    // A STORED RUN IMPLIES A STORED PROFILE.
    const s2 = logged();
    const m2 = createSaveManager(s2);
    m2.saveRun(aRun(), null, 1);
    assert(s2.getItem(META_KEY) != null, 'saveRun alone still leaves a profile behind');
    assert(s2.writes.indexOf(META_KEY) < s2.writes.indexOf(RUN_KEY), 'and still in that order');

    // 3 — THE EDGE BJORN COULD NOT REACH: a player who already has runs and no
    // profile. That is everybody who started a climb on a build before this one.
    const s3 = createMemoryStorage();
    const m3 = createSaveManager(s3);
    s3.setItem(RUN_KEY, JSON.stringify(aRun()));
    eq(s3.getItem(META_KEY), null, 'the shipped population: a run, no profile');
    const resumed = m3.loadRun(REG, 1);
    assert(resumed != null, 'their run still loads');
    assert(s3.getItem(META_KEY) != null, 'and their profile appears with it — no migration to run');
    eq(m3.profileStatus().state, 'ok', 'Settings would no longer tell them they have no profile');

    // …and a run that FAILS to load is not a player arriving.
    const s3b = createMemoryStorage();
    const m3b = createSaveManager(s3b);
    s3b.setItem(RUN_KEY, '{"schemaVersion":1,broken');
    eq(m3b.loadRun(REG, 1), null, 'a corrupt run is still refused');
    eq(s3b.getItem(META_KEY), null, 'and creates no profile out of nothing');

    // 4 — ABANDON BEFORE THE FIRST FIGHT. Begin a climb, then delete the save
    // from the title screen (onDelete → clearRun). The character is gone; the
    // player is not.
    const s4 = createMemoryStorage();
    const m4 = createSaveManager(s4);
    m4.ensureProfile();
    m4.saveRun(aRun(), null, 1);
    m4.clearRun(1);
    eq(s4.getItem(RUN_KEY), null, 'the abandoned run is gone');
    assert(s4.getItem(META_KEY) != null, 'the profile it created is not');

    // 5 — IDEMPOTENT, and it never touches a profile that is already there.
    // This is the edge that would turn a fix into a data loss.
    const s5 = createMemoryStorage();
    const m5 = createSaveManager(s5);
    m5.saveMeta({ settings: { textSize: 'xl' }, results: [], progress: { runs: 2000 } });
    const before = s5.getItem(META_KEY);
    const again = m5.ensureProfile();
    eq(again.created, false, 'a second call creates nothing');
    eq(s5.getItem(META_KEY), before, 'and the 2000-run profile is byte-identical afterwards');
    m5.saveRun(aRun(), null, 1);
    m5.loadRun(REG, 1);
    eq(s5.getItem(META_KEY), before, 'neither does saving or loading a run');
    eq(m5.listArchives().length, 0, 'nothing was set aside, because nothing was replaced');

    // 6 — QUARANTINE WINS. The bytes of an unreadable profile are the evidence
    // (property 4), so the new writer refuses exactly as saveMeta does.
    const s6 = createMemoryStorage();
    const m6 = createSaveManager(s6);
    s6.setItem(META_KEY, JSON.stringify({ schemaVersion: META_SCHEMA_VERSION + 6, progress: { runs: 2000 } }));
    m6.loadMeta();
    assert(m6.profileStatus().quarantined, 'a newer profile quarantines this build');
    const futureBytes = s6.getItem(META_KEY);
    m6.saveRun(aRun(), null, 1);
    eq(s6.getItem(META_KEY), futureBytes, 'starting a run does not write over a profile from the future');
    eq(m6.ensureProfile().created, false, 'and ensureProfile says no rather than pretending');

    // 7 — the sentence's own condition, both edges. 'empty' must still be
    // reachable (someone who has never begun a climb) and must no longer be the
    // state a player is left in after starting a new profile — which is where
    // "No profile yet — one is created when you finish your first run" was the
    // second lie, printed over bytes that existed.
    const m7a = createSaveManager(createMemoryStorage());
    m7a.loadMeta();
    eq(m7a.profileStatus().state, 'empty', 'a browser that has never played still reads empty');
    const s7b = createMemoryStorage();
    const m7b = createSaveManager(s7b);
    m7b.saveMeta({ settings: {}, results: [], progress: { runs: 9 } });
    m7b.startNewProfile();
    assert(s7b.getItem(META_KEY) != null, 'starting a new profile writes one');
    eq(m7b.profileStatus().state, 'ok', 'so the state is ok, not empty');
  });

  // ---- 14. Scripted bot completes a boss combat -------------------------------------
  test('14. bot (leftmost affordable, end turn) finishes a seeded boss fight without throwing', () => {
    const fresh = createRunState({ seed: 1, classId: 'reaver', registries: REG });
    const deck = fresh.deck;
    const c = createCombat({
      registries: REG,
      rng: createRng(0x51deb00b),
      player: { classId: 'reaver', attributes: fresh.attributes, maxHp: 78, hp: 78, mana: 2, maxMana: 2, deck, loadout: fresh.loadout, relicIds: ['forsakenMedallion'] },
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
        return c.player.energy >= cost && c.player.mana >= (def.manaCost || 0);
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
    eq(shrineHealAmount(REG, rn4), Math.floor((rn4.maxHp * 35) / 100), 'shrine heal 35%');
    rn4.relics.push('emberFragment');
    eq(shrineHealAmount(REG, rn4), Math.floor((rn4.maxHp * 35 * 1.15) / 100), 'Ember Fragment ×1.15');
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
    const a = makeCombat({ deck: Array(5).fill('starstonePebble'), enemies: ['tGiant'], mana: 3, maxMana: 3 });
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
      const fresh = createRunState({ seed: 1, classId, registries: REG });
      const deck = fresh.deck;
      const c = createCombat({
        registries: REG,
        rng: createRng(0xabc0 + classId.length),
        player: { classId, attributes: fresh.attributes, maxHp: cls.maxHp, hp: cls.maxHp, mana: 2, maxMana: 2, deck, loadout: fresh.loadout, relicIds: [cls.startingRelic] },
        enemyIds: ['wyrmAspirant'],
      });
      let guard = 0;
      while (!c.result) {
        if (++guard > 2000) throw new Error(`${classId} bot did not finish`);
        const target = c.enemies.find((e) => e.alive);
        const playable = c.piles.hand.find((inst) => {
          const def = resolveCard(REG, inst);
          if ((def.keywords || []).includes('unplayable')) return false;
          return c.player.energy >= (def.cost === 'X' ? 0 : def.cost) && c.player.mana >= (def.manaCost || 0);
        });
        if (playable && target) dispatch(c, { type: 'playCard', cardInstanceId: playable.instanceId, targetId: target.id });
        else dispatch(c, { type: 'endTurn' });
      }
      assert(c.result === 'victory' || c.result === 'defeat', `${classId} elite fight concluded (${c.result})`);
    }
  });

  test('20b. Mana is real state: validated maxima, spend/refuse/restore, save migration, and zero/max HUD plans', () => {
    const fresh = createRunState({ seed: 0x6d616e61, classId: 'reaver', registries: REG });
    eq(fresh.mana, 2, 'run starts at its WIS-derived mana maximum');
    eq(fresh.maxMana, 2, 'Reaver maximum is base-zero WIS tiers');
    assert(validateRunShape(fresh).length === 0, 'the new run shape accepts a sound mana pool');
    assert(validateRunShape({ ...fresh, mana: 3 }).some((s) => s.includes('between 0 and maxMana')), 'overflow mana is refused by name');

    const badMax = validateContent({
      ...contentBundle,
      classes: contentBundle.classes.map((c) => c.id === 'reaver' ? { ...c, maxMana: 0 } : c),
    });
    assert(!badMax.ok && badMax.errors.some((e) => e.path === 'classes.reaver.maxMana'), 'class maxMana authority is refused at the content door');
    const badCost = validateContent({
      ...contentBundle,
      cards: contentBundle.cards.map((c) => c.id === 'gorefireSlash' ? { ...c, manaCost: -1 } : c),
    });
    assert(!badCost.ok && badCost.errors.some((e) => e.path === 'cards.gorefireSlash.manaCost'), 'negative manaCost cannot mint mana');

    const spend = makeCombat({ deck: Array(5).fill('gorefireSlash'), enemies: ['tGiant'], mana: 2, maxMana: 2 });
    const sig = spend.piles.hand[0];
    const pv = previewCard(spend, sig.instanceId);
    eq(pv.manaCost, 1, 'preview exposes the same mana cost execution charges');
    dispatch(spend, { type: 'playCard', cardInstanceId: sig.instanceId, targetId: 'e1' });
    eq(spend.player.mana, 1, 'signature starter spends 1 mana');
    assert(logOf(spend, 'manaSpent').some((e) => e.amount === 1), 'mana spend emits a receipt');

    const empty = makeCombat({ deck: Array(5).fill('gorefireSlash'), enemies: ['tGiant'], mana: 0, maxMana: 2 });
    empty.player.mana = 0;
    const beforeHand = empty.piles.hand.length;
    let refused = '';
    try { dispatch(empty, { type: 'playCard', cardInstanceId: empty.piles.hand[0].instanceId, targetId: 'e1' }); }
    catch (e) { refused = e.message; }
    assert(refused.includes('Not enough mana'), 'under-cost play is refused by name');
    eq(empty.player.mana, 0, 'refusal spends no mana');
    eq(empty.piles.hand.length, beforeHand, 'refusal moves no card');

    const flask = makeCombat({ deck: Array(5).fill('strike'), flasks: [{ flaskId: 'azureFlask' }], mana: 0, maxMana: 2 });
    flask.player.mana = 0;
    dispatch(flask, { type: 'useFlask', slot: 0 });
    eq(flask.player.mana, 1, 'Azure Flask restores one small Mana unit');
    assert(logOf(flask, 'manaRestored').some((e) => e.amount === 1), 'restoration receipt reports the amount actually gained');

    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    const old = { ...fresh };
    delete old.mana;
    delete old.maxMana;
    storage.setItem(RUN_KEY, JSON.stringify(old));
    const migrated = saves.loadRun(REG);
    eq(migrated.mana, 2, 'pre-mana save migrates to full derived mana');
    eq(migrated.maxMana, 2, 'pre-mana save derives base-zero WIS tiers');

    const domains = resourceDomains(REG);
    const zero = { ...empty.player, mana: 0 };
    const atZero = resourceBarPlan(REG, 'main', zero, zero, domains).find((b) => b.id === 'mana');
    eq(atZero.cur, 0, 'zero edge is a real empty mana plan');
    eq(atZero.pct, 0, 'zero edge has zero fill');
    const star = { maxHp: 72, hp: 72, maxMana: 3, mana: 3 };
    const atMax = resourceBarPlan(REG, 'main', star, star, domains).find((b) => b.id === 'mana');
    eq(atMax.pct, 100, 'max edge fills the mana trough');
    eq(atMax.lengthPct, 100, 'largest legal WIS-derived maxMana fills the derived row track');
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
    const fresh = createRunState({ seed: 1, classId: 'reaver', registries: REG });
    const deck = [...fresh.deck.map((c) => ({ ...c, upgraded: true })), ...['stomp', 'executioner', 'crimsonCleave'].map((cardId, i) => ({ instanceId: `f${i}`, cardId, upgraded: true }))];
    const f = createCombat({
      registries: REG,
      rng: createRng(0xf17e),
      player: { classId: 'reaver', attributes: fresh.attributes, maxHp: 78, hp: 78, deck, loadout: fresh.loadout, relicIds: ['forsakenMedallion'] },
      enemyIds: ['blightedValkyrie'],
    });
    let guard = 0;
    while (!f.result) {
      if (++guard > 3000) throw new Error('final boss bot did not finish');
      const target = f.enemies.find((e) => e.alive);
      const playable = f.piles.hand.find((inst) => {
        const def = resolveCard(REG, inst);
        if ((def.keywords || []).includes('unplayable')) return false;
        return f.player.energy >= (def.cost === 'X' ? 0 : def.cost) && f.player.mana >= (def.manaCost || 0);
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
      player: { classId: 'reaver', attributes: run.attributes, maxHp: run.maxHp, hp: run.hp, deck: run.deck, relicIds: [], loadout: run.loadout },
      enemyIds: ['fellWarden'],
    });
    const energyBefore = combat.player.energy;
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
    eq(combat.player.energy, energyBefore - bal.swapCost, 'the swap costs what the config says');
    const inHand = combat.piles.hand.concat(combat.piles.draw).find((c) => c.cardId === 'strike');
    eq(dmgOf(resolveCard(REG, inHand)), 12, 'every Strike now carries the greatsword profile, rarity, tier, and explicit mod');
    // Armour is not something you change with a knight in the room.
    let refused = '';
    try {
      dispatch(combat, { type: 'swapArmament', slotId: 'armor', setIndex: 0 });
    } catch (e) {
      refused = e.message;
    }
    // ASSERTED AGAINST THE VERDICT, NOT AGAINST THE PROSE (Sunna, #98; the
    // identity is Vira's, #104). This line read
    // `refused.includes('outside combat')` — a substring of canSwap's reason,
    // typed here. So the player-facing wording had a second home in a test that
    // does not care about wording, and rewording the refusal turned this red
    // while the rule it names was untouched. A test that fails when a sentence
    // improves is a test that argues for bad sentences.
    //
    // MY FIRST REPLACEMENT WAS TWO INDEPENDENT FACTS AND VIRA MEASURED THE GAP.
    // `assert(refused)` plus `canSwap(...).ok === false` never established the
    // LINK between them: `doSwapArmament` throws for five other reasons (phase,
    // equipment disabled, no loadout, no swaps/energy left, no such set), and any
    // of them makes both true. She planted `'No swaps left this turn'` ABOVE the
    // canSwap gate — so the rule never runs — and my pair passed 58/0 while the
    // old prose substring caught it 57/1. A counted refusal is not a located one.
    //
    // THE IDENTITY IS THE LINK: the message the dispatch threw IS the string the
    // model returns, compared against the model's own return rather than a
    // literal typed here. The string keeps its single home in `canSwap`, so the
    // wording stays free to improve, and no other throw site can wear this
    // refusal's name. Under her plant: 57/1, caught. Reworded `fastened` →
    // `buckled down`: 58/0.
    eq(refused, canSwap(REG, 'armor', { inCombat: true }).reason,
      'armour is refused mid-fight, in the words the model itself refuses in');
    // AND THE FLOOR UNDER IT, which the identity alone does not carry: if canSwap
    // ever stopped refusing, `reason` would be '' and the dispatch would not
    // throw, so `'' === ''` would pass over a rule that had been deleted. An
    // empty result is not a pass — this is the denominator, and it is measured,
    // not argued. Planted the rule out of `canSwap` AND the price gate out of
    // `doSwapArmament`, so the armour swap actually succeeds: with this line,
    // 56/2 and 28 names it; without it, 28 PASSES on '' === '' and only 31d goes
    // red. The deletion does not escape the SUITE — it escapes the one test whose
    // whole subject is that armour is refused mid-fight, which is the same defect
    // Vira just caught in my pair, reporting on something it never observed.
    eq(canSwap(REG, 'armor', { inCombat: true }).ok, false,
      '…and the refusal exists at all, so the identity is not two empty strings');

    // Combat works on COPIES of the deck instances, so the orchestrator
    // re-stamps the run's own copies when the fight ends (main.js onCombatEnd).
    stampDeck(REG, run);

    // The instance carries the numbers, so the save carries them too.
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    saves.saveRun(run, rng);
    const loaded = saves.loadRun(REG);
    eq(loaded.loadout.sets.rightHand[1], 'greatsword', 'the loadout round-trips');
    eq(dmgOf(resolveCard(REG, loaded.deck.find((c) => c.cardId === 'strike'))), 12, 'stamped cards round-trip');

    // And a run saved before equipment existed is healed, not refused.
    const legacy = JSON.parse(JSON.stringify(run));
    delete legacy.loadout;
    for (const c of legacy.deck) delete c.mods;
    storage.setItem(RUN_KEY, JSON.stringify(legacy));
    const healed = saves.loadRun(REG);
    assert(healed && healed.loadout, 'a pre-equipment save loads with a fresh loadout');
    eq(healed.loadout.sets.rightHand[0], 'straightSword', 'the healed loadout restores the class-authored starting weapon');
  });

  // ---- 28p. the swap PRICE: three rules, three measured numbers -----------
  test('28p. his three swap prices are data, and they really are three different prices', () => {
    // Constantine, 2026-08-08: *"switching sets should cost actions. perhaps
    // this action costs more or less depending on Talisman or starting relic…
    // let's default to costing 2 actions. alternatively, or by a setting,
    // different weapon categories have weapon swap costs. THAT WAY I CAN TRY
    // EACH."*
    //
    // THE SUBJECT OF THIS TEST IS THE WORD "DIFFERENT". A settings key nothing
    // can be observed to change is not a knob, it is a comment, and "I can try
    // each" is a comparison — so this measures the same swap, on the same
    // loadout, under each rule, and asserts the numbers are not all equal.
    // Every price below is READ BACK OFF THE PLAYER'S ENERGY after a real
    // dispatch, never off the derivation that produced it.
    const rules = REG.balance.equipment.swapCostRules;
    const byId = (id) => rules.find((r) => r.id === id);
    eq(rules.map((r) => r.id).join(','), 'flat,gear,category', 'his three options are the authored rows');

    // A hand that is heavy in one set and quick in the other, so 'category' has
    // something to say and the two directions are both reachable.
    const armed = () => {
      const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
      run.loadout.sets.rightHand[0] = 'straightSword'; // no category tag → the default
      run.loadout.sets.rightHand[1] = 'greatsword';    // heavy   → 3
      run.loadout.sets.rightHand[2] = 'twinblade';     // flourish → 1
      return run;
    };

    /** Swap to `setIndex` under `rule` and report what the player actually paid. */
    const paid = (rule, setIndex, { relicIds = [] } = {}) => {
      const run = armed();
      const combat = createCombat({
        registries: REG,
        rng: createRng(11),
        player: { classId: 'reaver', attributes: run.attributes, maxHp: run.maxHp, hp: run.hp, deck: run.deck, relicIds, loadout: run.loadout },
        enemyIds: ['fellWarden'],
        swapCostRule: rule,
      });
      const before = combat.player.energy;
      const { events } = dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex });
      const swapped = events.find((e) => e.type === 'armamentSwapped');
      const spent = before - combat.player.energy;
      // The event must AGREE with the wallet, or one of the two is decoration.
      eq(swapped.cost, spent, `the event's cost is what the player actually paid (${swapped.cost} vs ${spent})`);
      return spent;
    };

    // ---- 1. THE MEASUREMENT, and the table it prints -----------------------
    //   rule       → greatsword (heavy)   twinblade (flourish)
    //   flat       → 2                    2
    //   category   → 3                    1
    const table = {
      'flat/heavy': paid(byId('flat'), 1),
      'flat/flourish': paid(byId('flat'), 2),
      'category/heavy': paid(byId('category'), 1),
      'category/flourish': paid(byId('category'), 2),
    };
    eq(table['flat/heavy'], 2, 'flat charges the balance default for a greatsword');
    eq(table['flat/flourish'], 2, '…and the same for a twinblade — that is what flat means');
    eq(table['category/heavy'], 3, 'category charges the heavy row for a greatsword');
    eq(table['category/flourish'], 1, '…and the flourish row for a twinblade');
    assert(new Set(Object.values(table)).size > 1,
      `the rules produce DIFFERENT prices, not one price wearing three names — ${JSON.stringify(table)}`);

    // A piece whose tags match no category row falls through to the default,
    // which is deliberate and is the third cell of the category rule.
    const straightUnder = swapCostFor(REG, {
      rule: byId('category'), loadout: armed().loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 0, relicDelta: 0,
    });
    eq(straightUnder.cost, REG.balance.equipment.swapCost, 'an uncategorised weapon falls through to the default');
    eq(straightUnder.categoryTag, null, '…and says so rather than inventing a category');

    // ---- 2. THE GEAR RUNG — the talisman half, with a piece it authors -----
    // The talisman slot ships with zero rows, so waiting for content would mean
    // shipping a rung nobody has watched work. This adds one armament carrying
    // `self.swapCost=+2` — a CSV row's worth of data, no code — and equips it.
    const withCharm = {
      ...REG,
      equipment: {
        ...REG.equipment,
        armaments: [...REG.equipment.armaments,
          { id: 'testCharm', name: 'Heavy Charm', kind: 'weapon', hand: 'right', rarity: 'common',
            tags: [], mods: ['self.swapCost=+2'], unlock: '' }],
      },
    };
    const charmRun = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    charmRun.loadout.sets.rightHand[0] = 'testCharm';
    charmRun.loadout.sets.rightHand[1] = 'greatsword';
    eq(runMods(withCharm, charmRun.loadout, 'reaver').swapCostDelta, 2,
      'a worn piece contributes its swap-cost delta through the same self.* door every other run mod uses');
    const gearOn = swapCostFor(withCharm, { rule: byId('gear'), loadout: charmRun.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: 0 });
    const gearOff = swapCostFor(withCharm, { rule: byId('flat'), loadout: charmRun.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: 0 });
    eq(gearOn.cost, 4, 'the gear rule charges default 2 + the charm’s 2');
    eq(gearOff.cost, 2, '…and the flat rule charges 2, because gear is off for it');
    // THE IGNORED DELTA IS REPORTED, NOT SWALLOWED. A talisman doing nothing
    // under a gear-off rule is correct; a talisman doing nothing SILENTLY is
    // the graceful fallback my own card warns about.
    eq(gearOff.gearIgnored, 2, 'a rule that declines the gear rung says what it declined');
    eq(gearOn.gearIgnored, 0, '…and a rule that takes it has nothing left over');

    // The relic half is the same rung, summed by the engine (module boundary).
    const relicOn = swapCostFor(REG, { rule: byId('gear'), loadout: armed().loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: -1 });
    eq(relicOn.cost, 1, 'a relic passive of -1 makes the swap cheaper — "more OR LESS", his words');
    const floored = swapCostFor(REG, { rule: byId('gear'), loadout: armed().loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: -9 });
    eq(floored.cost, 0, 'the total floors at 0 rather than paying the player Energy');
    eq(floored.floored, true, '…and the clamp is visible, not quiet');

    // ---- 3. FAIL CLOSED — a missing relicDelta is named, never guessed -----
    const hush = console.error;
    const heard = [];
    console.error = (...a) => { heard.push(a.join(' ')); };
    let quiet;
    try {
      quiet = swapCostFor(REG, { rule: byId('gear'), loadout: armed().loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1 });
    } finally { console.error = hush; }
    eq(quiet.cost, 2, 'a caller that forgets the relic sum still gets a price…');
    eq(heard.length, 1, '…and is named for it rather than silently charged as "no relics"');
    assert(heard[0].includes('relicDelta') && heard[0].includes('rightHand'),
      `the complaint names what was missing and where — got: ${heard[0] || '(nothing)'}`);
  });

  // ---- 28q. a fourth rule is a ROW — Law 0's falsifier, on a rule ---------
  test('28q. a swap-cost rule this build has never seen works with zero code', () => {
    // Law 0's falsifier is *one fictional entry of a brand-new kind, plus its
    // asset, ZERO code commits — it appears and works.* Applied to A8: the two
    // fields of a rule row are closed, so their product is FOUR cells and only
    // three ship. This is the fourth, added the way he would add it — one row
    // in balance.js — and nothing else.
    //
    // AND IT IS THE #78 LESSON PAID BACK. I once declared two characteristics
    // closed separately and shipped three ids for a four-cell product; the
    // fourth cell was legal data that drew an empty screen and every check I
    // owned said green. So this test is not a nicety, it is the check that
    // would have caught me: the product is TOTAL or this goes red.
    const fourth = { id: 'both', label: 'Category + gear', base: 'category', gear: true };
    const REG4 = {
      ...REG,
      balance: {
        ...REG.balance,
        equipment: { ...REG.balance.equipment, swapCostRules: [...REG.balance.equipment.swapCostRules, fourth] },
      },
    };
    eq(validateEquipment(REG4).length, 0, 'the new row validates — it used only words the schema already had');

    const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    run.loadout.sets.rightHand[0] = 'straightSword';
    run.loadout.sets.rightHand[1] = 'greatsword'; // heavy → base 3
    const price = swapCostFor(REG4, {
      rule: resolveSwapCostRule(REG4, { settings: { swapCostRule: 'both' } }),
      loadout: run.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: -1,
    });
    eq(price.ruleId, 'both', 'the settings value selects the row that was never in a build before');
    eq(price.base, 'category', '…it takes the category base…');
    eq(price.cost, 2, '…and the gear rung on top: heavy 3, relic −1, paid 2');

    // EVERY cell of the product computes a real number. Four ids, four prices,
    // no unrepresentable corner and no empty screen.
    const cells = [['default', false], ['default', true], ['category', false], ['category', true]]
      .map(([base, gear]) => swapCostFor(REG4, {
        rule: { id: `${base}/${gear}`, base, gear },
        loadout: run.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: 1,
      }).cost);
    eq(cells.join(','), '2,3,3,4', 'all four cells of the product price a swap: default/gear × off/on');

    // An unknown rule id is the SHIPPING DEFAULT, never a crash and never a
    // free swap — the same rule resolveMapMode uses for a hand-edited save.
    eq(resolveSwapCostRule(REG, { settings: { swapCostRule: 'nonsense' } }).id,
      REG.balance.equipment.swapCostRule, 'an unreadable saved rule falls back to the shipped default');
  });

  // ---- 28r. bad data fails loud and names the row -------------------------
  test('28r. every way to author the swap price wrong is refused BY NAME', () => {
    // Law 1 clause 5. Each of these is a plausible edit that would otherwise be
    // SILENT — the game keeps charging 2 and nobody can tell a setting that is
    // off from one that is broken. Observed red here before being cited:
    // `validateEquipment(REG)` is 0 on the real tree (asserted first), so every
    // count below is caused by the plant and nothing else.
    eq(validateEquipment(REG).length, 0, 'the shipped tree is clean, so a count of 1 below means the plant');

    const bend = (equipment) => ({ ...REG, balance: { ...REG.balance, equipment: { ...REG.balance.equipment, ...equipment } } });
    const oneProblem = (reg, needle, what) => {
      const found = validateEquipment(reg);
      eq(found.length, 1, `${what}: exactly one complaint (got ${found.length}: ${found.join(' | ')})`);
      assert(found[0].includes(needle), `${what}: the complaint names '${needle}' — got: ${found[0]}`);
    };

    oneProblem(bend({ swapCost: -1 }), 'swapCost', 'a negative default');
    oneProblem(bend({ swapCost: 1.5 }), 'swapCost', 'a fractional default');
    oneProblem(bend({ swapCostByCategory: [{ tag: 'heavy', cost: -2 }] }), 'heavy', 'a negative category cost');
    oneProblem(bend({ swapCostByCategory: [{ tag: 'chunky', cost: 3 }] }), 'chunky', 'a category no armament carries');
    oneProblem(bend({ swapCostRule: 'fastest' }), 'fastest', 'a live rule that is not a row');
    oneProblem(bend({ swapCostRules: [{ id: 'flat', base: 'vibes', gear: false }], swapCostRule: 'flat' }),
      'vibes', 'a rule whose base is outside the closed set');
    oneProblem(bend({ swapCostRules: [{ id: 'flat', base: 'default', gear: 'yes' }], swapCostRule: 'flat' }),
      'gear', 'a rule whose gear rung is not a boolean');

    // ---- the shelf's own three, same standard (A7) -------------------------
    oneProblem(bend({ basicTag: 'starter' }), 'starter', 'a basicTag no armament carries');
    const withEarnedBasic = {
      ...bend({}),
      equipment: {
        ...REG.equipment,
        armaments: REG.equipment.armaments.map((a) => (a.id === 'straightSword' ? { ...a, unlock: 'winAsReaver' } : a)),
      },
    };
    oneProblem(withEarnedBasic, 'straightSword', 'a row that is both everybody\'s and earned');
    const basicArmour = {
      ...bend({}),
      equipment: {
        ...REG.equipment,
        armour: REG.equipment.armour.map((o) => (o.id === 'default' && o.classId === 'reaver'
          ? { ...o, tags: [...(o.tags || []), 'basic'] } : o)),
      },
    };
    oneProblem(basicArmour, 'never drops', 'a basic tag on a kind that never drops');

    // ---- the `apply` vocabulary, which nothing checked before A8 -----------
    // A row reading `apply=swapcost` used to validate clean, be collected by
    // nobody and change nothing, forever.
    const typoApply = {
      ...bend({}),
      equipment: {
        ...REG.equipment,
        modFields: { ...REG.equipment.modFields, maxHp: { ...REG.equipment.modFields.maxHp, apply: 'maxhp' } },
      },
    };
    oneProblem(typoApply, 'maxhp', 'an apply value no consumer handles');

    // ---- DECLARED AND HANDLED, both directions ----------------------------
    // The validator above proves nothing outside the list gets in. This proves
    // nothing INSIDE the list is inert — which is the direction that rots,
    // because adding a word to a closed set and forgetting the consumer reads
    // exactly like adding a word and remembering. Every member changes an
    // observable field of runMods' return, or it is decoration.
    const probeRun = (apply) => {
      const reg = {
        ...REG,
        equipment: {
          ...REG.equipment,
          modFields: { ...REG.equipment.modFields, probe: { field: 'probe', scope: 'run', apply, status: 'strength' } },
          armaments: [...REG.equipment.armaments,
            { id: 'probePiece', name: 'Probe', kind: 'weapon', hand: 'right', rarity: 'common', tags: [], mods: ['self.probe=+3'], unlock: '' }],
        },
      };
      const lo = createLoadout(reg, 'reaver');
      lo.sets.rightHand[0] = 'probePiece';
      return JSON.stringify(runMods(reg, lo, 'reaver'));
    };
    const inert = probeRun('__nothing__');
    for (const apply of RUN_MOD_APPLIES) {
      assert(probeRun(apply) !== inert, `RUN_MOD_APPLIES member '${apply}' actually changes runMods' answer`);
    }

    // Same join on the other closed set: every base a rule row may name has to
    // price a swap, or it is a legal word with no meaning.
    const priceRun = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    priceRun.loadout.sets.rightHand[1] = 'greatsword';
    for (const base of SWAP_COST_BASES) {
      const p = swapCostFor(REG, {
        rule: { id: `probe-${base}`, base, gear: false },
        loadout: priceRun.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: 0,
      });
      assert(Number.isInteger(p.cost) && p.cost >= 0, `SWAP_COST_BASES member '${base}' prices a swap (got ${p.cost})`);
      eq(p.base, base, `…and reports the base it used, so '${base}' cannot silently become 'default'`);
    }
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
    eq(fresh.loadout.sets.leftHand[0], 'roundShield', 'and a refusal leaves the authored starting shield exactly as it found it');
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

    // ---- 1. a fresh profile owns nothing droppable EXCEPT THE BASICS -------
    // AMENDED BY HIM, NOT BY US (A7, Viki). This line read `0 of 16 — an
    // inventory, not a catalogue`, and it was the right assertion for the
    // sentence it was written from (*"I should only see an inventory of the
    // weapons I've collected"*, #90). On 2026-08-08 he added the other half:
    // *"everything else is profile specific but maybe A FEW BASIC WEAPONS
    // BECOME AVAILABLE FOR ALL."* So the number is no longer 0 — and the claim
    // this test defends is unchanged and is the one that matters: what a fresh
    // profile is offered is EXACTLY a named, derivable set and nothing else.
    // A catalogue would still fail here.
    const fresh = createLoadout(REG, 'reaver');
    const none = ownership(REG, { meta: {}, loadout: fresh });
    const basicTag = REG.balance.equipment.basicTag;
    const basicsRight = rightPool.filter((p) => (p.tags || []).includes(basicTag)).map((p) => p.id);
    assert(basicsRight.length > 0 && basicsRight.length < rightPool.length,
      `the basics are a FEW of the pool, not none and not all (${basicsRight.length} of ${rightPool.length})`);
    eq(rightPool.filter((p) => none.has(p)).map((p) => p.id).join(','), basicsRight.join(','),
      `a fresh profile is offered exactly the '${basicTag}' rows (${basicsRight.join(', ')}) of ${rightPool.length} armaments`);

    // ---- 1b. …and the TAG is the mechanism, observed both ways -------------
    // A knob read but never watched to change the outcome has not been built.
    // Same registries, same profile, `basicTag` cleared: the shelf goes back to
    // the pre-A7 number, which is the measurement the line above used to be.
    const noBasics = { ...REG, balance: { ...REG.balance, equipment: { ...REG.balance.equipment, basicTag: '' } } };
    eq(rightPool.filter((p) => ownership(noBasics, { meta: {}, loadout: fresh }).has(p)).map((p) => p.id).join(','), 'straightSword',
      'with basicTag cleared a fresh profile is offered 0 again — the tag, not a hard-coded list');

    // ---- 2. …and what it finds, it is offered, and ONLY that --------------
    const two = ownership(REG, { meta: { found: ['dagger'] }, loadout: fresh });
    const offered = rightPool.filter((p) => two.has(p)).map((p) => p.id);
    eq(offered.join(','), [...basicsRight, 'dagger'].sort((a, b) => rightPool.findIndex((p) => p.id === a) - rightPool.findIndex((p) => p.id === b)).join(','),
      'one weapon found is one option ADDED to the basics — his "starting weapon and a scimitar" case, plus the few that are everybody\'s');

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
    eq(probe.sets.rightHand[0], 'straightSword', 'and the refusal left the authored starting weapon alone');
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
    // one a piece and watches the fuse blow. THE FIXTURE IS NO LONGER BUILT HERE
    // (#104): `REG_CHARM` at the top of this file is the one home for the woken
    // talisman, because 31e needs the identical row and two copies of a fixture
    // drift exactly like two copies of anything else.
    const talisman = eq_.slots.find((s) => s.id === 'talisman');
    assert(talisman && talisman.sets > 1, 'the fixture needs a wide, rung-less slot');
    eq(slotRungs(REG, 'talisman').length, 0, 'talisman authors no rungs today');
    eq(validateEquipment(REG).join(' | '), '', '…and is silent while nothing fits it');
    const withCharm = REG_CHARM;
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

    // THE CAMP CONTEXT IS NOW DECLARED, NOT ASSUMED (#104). This block is about
    // the LADDER, and it always was at camp; `inCombat` became required on
    // cycleSet for the same reason it is required on equipPiece, so the blocks
    // that predate it say the thing they were silently relying on. The seal
    // itself is 31e's subject, on the one slot where asking is not vacuous —
    // `rightHand` is `swap=combat`, so nothing here could ever have caught it.
    // EDGE 1 — fresh profile. The defect: openedSets said 1, cycleSet took 3.
    const meta = { unlocked: [] };
    const fresh = createLoadout(REG, 'reaver');
    eq(openedSets(REG, rightHand, { meta, loadout: fresh }), 1, 'one set open on a fresh profile');
    const accepts = (m, lo) => [0, 1, 2].filter((i) => cycleSet(REG, structuredClone(lo), 'rightHand', i, { meta: m, ...AT_CAMP })).length;
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
    assert(cycleSet(REG, legacy, 'rightHand', last, { meta, ...AT_CAMP }), 'and the mutation lets the player reach it');
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
    assert(!cycleSet(fresh, 'rightHand', 0, { meta, ...AT_CAMP }), 'the pre-#90 signature cycles nothing');
  });

  // ---- 31e. the swap rule is asked by the MUTATION, not only by its callers --
  test('31e. cycleSet asks the slot’s own swap rule, on the slot where asking is not vacuous', () => {
    // THE DEFECT THIS REPLACES WAS A VACUOUS TEST, NOT A MISSING ONE. `cycleSet`
    // had no `inCombat` in its signature at all, so `canSwap` was enforced by
    // both of its callers and by neither of them structurally — a second copy
    // fails by divergence, an unenforced gate fails by BYPASS, and only the
    // second was here. Every existing test of the function used `rightHand`,
    // which is `swap=combat`, where the missing gate cannot fail. Green over an
    // absent rule (`31c` above, and test 28's swap block) — the house shorthand
    // is *green wasn't clearance*, and this is that with a slot name on it.
    const slots = REG_CHARM.equipment.slots;
    const talisman = slots.find((s) => s.id === 'talisman');

    // ---- 0. the fixture IS the finding — state it before leaning on it -----
    assert(talisman && talisman.sets > 1 && talisman.swap !== 'combat',
      `the fixture needs a wide, SEALED slot — got sets=${talisman && talisman.sets}, swap=${talisman && talisman.swap}`);
    eq(slots.filter((s) => s.sets > 1 && s.swap !== 'combat').map((s) => s.id).join(','), 'talisman',
      'and it is the only one in the table, which is why one vacuous choice hid a whole gate');
    eq(slotRungs(REG_CHARM, 'talisman').length, 0, 'it authors no rungs, so the ladder alone opens exactly one cell');

    // A carried charm raises the ladder floor to 2 — `openedSets`' legacy path,
    // and the second way this test could have been vacuous: unless index 1 is
    // LADDER-OPEN, a refusal proves only that the ladder still works.
    const carried = createLoadout(REG_CHARM, 'reaver');
    carried.sets.talisman[1] = TEST_CHARM.id;
    eq(openedSets(REG_CHARM, talisman, { meta: {}, loadout: carried }), 2,
      'the carried charm opens the second cell, so the ladder is not what refuses below');

    // ---- 1. THE CONTROL, FIRST — a counted refusal is not a located one ----
    // The same call, the same index, the same loadout: accepted at camp. So
    // when it is refused mid-fight the only thing that changed is the fight.
    const atCamp = structuredClone(carried);
    assert(cycleSet(REG_CHARM, atCamp, 'talisman', 1, { meta: {}, ...AT_CAMP }),
      'at camp the carried charm can be made active');
    eq(atCamp.active.talisman, 1, 'and it actually moved');

    // ---- 2. THE DEFECT. Measured true at c392e13: this returned true --------
    const midFight = structuredClone(carried);
    eq(cycleSet(REG_CHARM, midFight, 'talisman', 1, { meta: {}, ...MID_FIGHT }), false,
      'a slot its own row seals may not be cycled mid-fight');
    eq(midFight.active.talisman, 0, 'and the refusal left the active set exactly as it was');

    // ---- 3. THE CAPABILITY THAT MUST SURVIVE -------------------------------
    // Sealing every slot would satisfy line 2 and delete a shipped, PRICED
    // mechanic (balance.equipment.swapCost, test 28). The cheap pass is refuse
    // everything, so the cheap pass is what this line makes red.
    const hands = createLoadout(REG_CHARM, 'reaver');
    hands.sets.rightHand[1] = 'greatsword';
    assert(cycleSet(REG_CHARM, hands, 'rightHand', 1, { meta: {}, ...MID_FIGHT }),
      'a slot its row calls combat-swappable still cycles mid-fight');
    eq(hands.active.rightHand, 1, 'and that one really moves');

    // ---- 4. THE INVARIANT, over every slot and both edges of the fight ------
    // Identity against `canSwap`'s own answer, never against a rule typed here:
    // the mutation accepts exactly what the truth function permits. A second
    // copy of `slot.swap !== 'combat'` written inside cycleSet would pass 1–3
    // and go wrong only once the two drifted; this is the line that makes that
    // unrepresentable, and it contains no sentence a player reads.
    let permitted = 0;
    for (const slot of slots) {
      for (const fight of [AT_CAMP, MID_FIGHT]) {
        const lo = createLoadout(REG_CHARM, 'reaver');   // index 0 is always ladder-open
        const allowed = canSwap(REG_CHARM, slot.id, fight).ok;
        eq(cycleSet(REG_CHARM, lo, slot.id, 0, { meta: {}, ...fight }), allowed,
          `${slot.id} @ inCombat=${fight.inCombat}: the mutation and canSwap agree`);
        if (allowed) permitted += 1;
      }
    }
    // THE POPULATION FLOOR, not just the findings floor: if the sweep ever saw
    // one answer repeated, the identity above would hold while proving nothing.
    assert(permitted > 0 && permitted < slots.length * 2,
      `the sweep saw BOTH answers, not one repeated (${permitted} permitted of ${slots.length * 2})`);

    // ---- 5. FAIL CLOSED — silence is not permission ------------------------
    // The reason `inCombat` is required rather than defaulted, and it is the
    // same reason equipPiece's is: a default of "not in combat" means every
    // call site written after today swaps a sealed slot by saying nothing.
    // The check is on the VALUE — `{ inCombat: undefined }` is what a caller
    // produces by forwarding a variable that was never set.
    const hush = console.error;
    const heard = [];
    console.error = (...a) => { heard.push(a.join(' ')); };
    let took = [];
    try {
      for (const ctx of [undefined, {}, { meta: {} }, { meta: {}, inCombat: undefined }, { meta: {}, inCombat: 'yes' }]) {
        const lo = structuredClone(carried);
        took.push(cycleSet(REG_CHARM, lo, 'talisman', 1, ctx));
        took.push(lo.active.talisman);
      }
    } finally { console.error = hush; }
    eq(took.join(','), 'false,0,false,0,false,0,false,0,false,0',
      'every under-specified context refuses AND mutates nothing');
    eq(heard.length, 5, 'and each one is named rather than swallowed');
    assert(heard.every((s) => s.includes('inCombat') && s.includes('talisman')),
      `…naming the slot and what it wanted — got: ${heard[0] || '(nothing)'}`);

    // ---- 6. THE BOUNDARY, asserted so it cannot be read as more than it is --
    // This closes the SEAL, not the PRICE. `swapCost` is charged in
    // doSwapArmament, outside this function, so a caller reaching cycleSet
    // directly still moves a combat-swappable slot for free. That is the next
    // act; line 3 above is the same call, and it is deliberately still true.
    eq(REG_CHARM.balance.equipment.swapCostKind, 'energy', 'the price is live and is energy');
    assert(REG_CHARM.balance.equipment.swapCost > 0,
      `…and it is a real number (${REG_CHARM.balance.equipment.swapCost}), which is what makes the remaining bypass worth an act`);
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
      // INVERTED AT #98, and the old assertion is the defect it was written to
      // hold. It read `seal.reason.includes(slot.label)` — I made a screen-wide
      // fact wear a per-slot voice and then asserted it did. No slot may be
      // re-armed mid-fight; saying "Right Hand is sealed" under a Right Hand
      // header carrying no badge said the opposite of what is true.
      assert(!seal.reason.includes(slot.label),
        `${slot.id}: the seal is not a fact about one slot and must not name one — got: ${seal.reason}`);
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
    assert(said.includes('inCombat') && said.includes('rightHand'),
      `…and says so, naming the slot and what it wanted — got: ${said || '(nothing)'}`);
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
    eq(rich.sets.rightHand[0], 'straightSword', 'and after the whole sweep the slot is still at its authored start');
    // …and the same sweep at camp is the control group. If BOTH sides refused,
    // the count above would be green for the wrong reason.
    let tookAll = 0;
    for (const piece of pool) {
      if (equipPiece(REG, rich, 'rightHand', 0, piece.id, OWNS_EVERYTHING, AT_CAMP)) tookAll += 1;
    }
    eq(tookAll, pool.length, `and every one of them goes in at camp — the control group`);

    // ---- 6. the three refusals on this screen share no word ---------------
    // Bjorn, #98: the ARMOUR header said "sealed" (canSwap, about the ACTIVE
    // SET) while the picker said "Right Hand is sealed in combat" (canEquip,
    // about a set's CONTENTS) under a Right Hand header with no badge. BOTH
    // WERE TRUE. Not one fact written twice — ONE WORD CARRYING TWO FACTS, with
    // the copies visibly disagreeing, which is worse: a duplicate at least says
    // the same thing twice.
    //
    // THE BRITTLENESS IS THE CHECK. A future edit that reintroduces the shared
    // word goes red, and that is correct — this is the one property a reader on
    // the glass can actually be misled by, and it has no other home.
    const rungHint = rungFor(REG, REG.equipment.slots.find((s) => s.id === 'rightHand'), 1).hint;
    const sealSaid = canEquip(REG, 'rightHand', { inCombat: true }).reason;
    const badge = canSwap(REG, 'armor', { inCombat: true });
    eq(badge.ok, false, 'armour carries a badge mid-fight');
    assert(badge.word, `and the badge has a word to print — got: ${JSON.stringify(badge.word)}`);
    assert(rungHint && sealSaid, 'both other refusals have something to say');
    for (const [name, said] of [['the rung hint', rungHint], ['the seal', sealSaid]]) {
      assert(!said.toLowerCase().includes(badge.word.toLowerCase()),
        `${name} must not borrow the badge's word "${badge.word}" — got: "${said}"`);
    }
    assert(rungHint !== sealSaid, 'and the ladder and the seal are not one string');

    // ---- 7. no context is SEALED, never "not in combat" -------------------
    // The old signature defaulted inCombat to false, so a caller that said
    // nothing was told it may re-arm. Silence meaning permission is the whole
    // defect the required argument exists to close, and it was still sitting in
    // the truth function's own default.
    const hush = console.error;
    let heard = '';
    console.error = (...a) => { heard = a.join(' '); };
    let blind;
    let nulled;
    try {
      blind = canEquip(REG, 'rightHand');
      nulled = canEquip(REG, 'rightHand', { inCombat: null });
    } finally { console.error = hush; }
    eq(blind.ok, false, 'no context at all → sealed');
    eq(nulled.ok, false, 'a null flag is not a false one → sealed');
    assert(heard.includes('inCombat'), `and it names what it wanted — got: ${heard || '(nothing)'}`);

    // ---- 8. the VALUE is checked, not the key -----------------------------
    // `'inCombat' in ctx` answered whether the key was TYPED, so a forwarded
    // variable that was never set walked through. Both shapes below are what a
    // caller actually produces by accident.
    const hush2 = console.error;
    console.error = () => {};
    const shapes = [{}, { inCombat: undefined }, { inCombat: null }, { inCombat: 'yes' }, { inCombat: 0 }, null];
    let refusedShapes = 0;
    const shapeProbe = createLoadout(REG, 'reaver');
    try {
      for (const bad of shapes) {
        if (!equipPiece(REG, shapeProbe, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, bad)) refusedShapes += 1;
      }
    } finally { console.error = hush2; }
    eq(refusedShapes, shapes.length, `every one of ${shapes.length} non-boolean contexts is refused`);
    eq(shapeProbe.sets.rightHand[0], 'straightSword', 'and none of them moved the authored starting piece');

    // WHICH LAYER REFUSED, and this assertion exists because the plant for it
    // stayed GREEN. `canEquip` also refuses a non-boolean, so with only the
    // count above, reverting equipPiece's check to `'inCombat' in ctx` changes
    // nothing a test can see — defence in depth hiding the removal of one of
    // its own layers. So the layer is named: equipPiece must refuse `undefined`
    // ITSELF, before it ever asks canEquip.
    const hush3 = console.error;
    let byWhom = '';
    console.error = (...a) => { byWhom = a.join(' '); };
    try {
      equipPiece(REG, shapeProbe, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, { inCombat: undefined });
    } finally { console.error = hush3; }
    assert(byWhom.startsWith('equipPiece('),
      `the mutation refuses a typed-but-unset flag on its own, not by way of canEquip — got: ${byWhom || '(nothing)'}`);
    // The control group: the two REAL shapes still work, so the check above is
    // not green because everything refuses.
    assert(equipPiece(REG, shapeProbe, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, { inCombat: false }), 'a real false still equips');
    assert(!equipPiece(REG, shapeProbe, 'rightHand', 1, 'dagger', OWNS_EVERYTHING, { inCombat: true }), 'a real true still refuses');
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

  // ---- 35a. Minimum tap size: one home, both edges, and bad data is loud ----
  //
  // Numbered 35a because it is the same subject as 35 — a default that must
  // resolve from ONE home — for the setting that gives the 44 in `--tap-floor`
  // a home at all. The headless half: the closed set, the sparse store, and
  // the refusal. The RENDERED half is `node tools/tapsize.mjs`, which is the
  // only thing that can say a control actually measured 24 device px, and this
  // test cannot and does not claim it.
  test('35a. the tap floor is one home, defaults to 44, and a bad stored value is refused by name', () => {
    const spec = REG.balance.ui.tapSize;

    // ONE HOME. The four sizes and the default are content, not code: the row
    // derives `choices` and `def` from here. If someone re-types them in
    // settings.js this test still passes — what it can prove is that the
    // content home exists, is the closed set the resolver enforces, and holds
    // the default the resolver returns.
    assert(Array.isArray(spec.sizes) && spec.sizes.length >= 2, 'balance.ui.tapSize.sizes is the closed set');
    eq(spec.def, 44, 'the default is 44 — today, to the pixel');
    eq(spec.sizes[0], Math.max(...spec.sizes), 'sizes are listed largest first (the order the chips draw)');
    eq(spec.def, Math.max(...spec.sizes), 'the default is the largest size — nobody who never opens it sees a pixel move');
    for (const s of spec.sizes) eq(Number.isFinite(s) && s > 0, true, `size ${s} is a positive number`);

    // EDGE 1 — the player who never touches it. An empty store is exactly what
    // a first-boot player has in sote_meta_v1.
    eq(resolveTapSize({}).px, 44, 'first boot gets 44');
    eq(resolveTapSize({}).bad, false, 'an absent key is not bad data — a sparse store is the normal state');
    eq(resolveTapSize(undefined).px, 44, 'no settings object at all still resolves');

    // EDGE 2 — every value in the closed set applies, including the smallest.
    for (const s of spec.sizes) {
      const r = resolveTapSize({ tapFloor: String(s) });
      eq(r.px, s, `chosen ${s} applies as ${s}`);
      eq(r.bad, false, `${s} is in the closed set`);
    }
    eq(resolveTapSize({ tapFloor: '24' }).px, 24, 'the bottom of the dial is a real value, not a clamp back to 44');

    // BAD DATA IS LOUD (Law 1 clause 5). A hand-edited save, an older build, a
    // restored profile from a tree with a different set. It renders the
    // default because it must render something — and it must NOT do that
    // silently, which is what `bad` exists to carry to both callers.
    for (const junk of ['32', '0', '-24', '44px', 'large', 'S', {}, [], true, NaN]) {
      const r = resolveTapSize({ tapFloor: junk });
      eq(r.px, 44, `junk ${JSON.stringify(junk)} still renders something`);
      eq(r.bad, true, `junk ${JSON.stringify(junk)} is reported as bad, not silently defaulted`);
    }
    // A NUMBER IS NOT JUNK, and I got that wrong on the first pass: I asserted
    // numeric 44 would be refused, and it is accepted, because the resolver
    // normalises with String() before testing membership. Accepting it is the
    // right behaviour and the comment was the defect — the chips write strings
    // into the store, but an older build or a hand-edited save can hold a
    // number, and 24 typed as a number is an unambiguous ask. Bad data is a
    // value OUTSIDE the set, never a value spelled in a different type.
    for (const s of spec.sizes) {
      const r = resolveTapSize({ tapFloor: s });
      eq(r.px, s, `numeric ${s} normalises to ${s}`);
      eq(r.bad, false, `numeric ${s} is not bad data`);
    }

    // THE PERCENTAGES ARE ONLY WHERE RESEARCH IS. WCAG 2.1 AAA (2.5.5) is
    // 44x44 and WCAG 2.2 AA (2.5.8) is 24x24; the sizes between them have no
    // measurement, and an interpolated statistic is a fabricated one.
    const rated = Object.keys(spec.missRate).map(Number).sort((a, b) => b - a);
    eq(rated.join(','), '44,24', 'exactly the two sizes with research carry a rate');
    for (const s of rated) assert(spec.sizes.includes(s), `a rate is only attached to a real size (${s})`);

    // What this does NOT check, said out loud: that main.js writes
    // `--tap-target` (no DOM here), that the stylesheet reads it, or that any
    // control rendered at any height. All three are `node tools/tapsize.mjs`.
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

  // 47, NOT 41 (Viki, resolving the merge). This branch was numbered 41 at
  // 77a02b9 and the harness has since grown a 41 of its own — the screen census.
  // Two lines printed `41.` with 60 green underneath, which is one id written
  // twice with nothing checking they agree, one level up from the code. 45 and
  // 46 are left for #102, which published them before this branch merges.
  // THE REAL DEFECT IS THAT THESE NUMBERS ARE AUTHORED AT ALL — engine.test.js
  // and run-node.mjs each type their own and nothing joins them. Named, not
  // fixed: a derived index is a tool change and this is a merge resolution.
  test('47. the Compendium withholds by ONE rule, and a planted row tells the rule from the table', () => {
    // Freja, the Compendium. The screen is a picture and this suite has never
    // seen one; what is testable here is the DECISION the picture obeys, and
    // that decision has one home — src/model/unlocks.js. The rendered half is
    // tools/release-shots.mjs (compendium-empty / compendium-held).
    // `owned` is the REAL ownership() handle, not a hand-built set. That is the
    // whole of Viki's merge ruling: possession has one home and this screen is a
    // reader of it. Building the sets here would re-create the second definition
    // the resolution removed, inside the test meant to prove it is gone.
    const ctx = (over = {}) => {
      const drops = { requireFound: true, reveal: 'teased', ...(over.drops || {}) };
      const reg = {
        balance: { equipment: { drops, persistence: over.persistence || 'both' } },
      };
      const meta = { unlocked: over.unlocked || [], found: over.available || [] };
      return {
        owned: ownership(reg, { meta, loadout: over.loadout || null }),
        unlockById: new Map((REG.unlocks || []).map((u) => [u.id, u])),
        drops,
      };
    };
    const dagger = REG.equipment.armaments.find((a) => a.id === 'dagger');
    assert(dagger, 'the dagger is still in the table');

    // BOTH EDGES OF THE SCREEN'S SUBJECT.
    // Empty: nothing found, so every armament is a shape and no name shows.
    const emptyStates = (REG.equipment.armaments || [])
      .map((a) => pieceReveal(a, ctx()).state);
    eq(emptyStates.filter((s) => s === 'held').length, 0, 'a fresh profile holds nothing');
    assert(emptyStates.every((s) => s === 'teased'),
      `a fresh profile shows only silhouettes — got ${[...new Set(emptyStates)].join(',')}`);
    // Full: everything found, so nothing is withheld and the grid is all lit.
    const allIds = (REG.equipment.armaments || []).map((a) => a.id);
    const fullStates = (REG.equipment.armaments || [])
      .map((a) => pieceReveal(a, ctx({ available: allIds })).state);
    assert(fullStates.every((s) => s === 'held'), 'with everything found nothing is withheld');
    // And the found gate is the ONLY thing between them.
    eq(pieceReveal(dagger, ctx({ drops: { requireFound: false } })).state, 'held',
      'requireFound:false is the sandbox — every armament is yours');

    // THE PLANTED ROWS. Not one armament in the shipped table carries an
    // `unlock`, so every condition branch below is unexercised by the data and
    // a rule that only ever sees found-gating is indistinguishable from
    // `return 'teased'`. Four rows in words the tables already have:
    const plant = [
      { id: 'p_hidden', kind: 'weapon', rarity: 'rare', unlock: 'ashChildUnlock' }, // reveal: hidden
      { id: 'p_listed', kind: 'weapon', rarity: 'common', unlock: 'winTwice' }, // reveal: listed
      { id: 'p_teased', kind: 'weapon', rarity: 'common', unlock: 'graveWardenUnlock' }, // reveal: teased
      { id: 'p_armour', kind: 'armor', rarity: 'common', unlock: '' }, // armour skips the found gate
    ];
    const st = (row, over) => pieceReveal(row, ctx(over)).state;
    eq(st(plant[0]), 'hidden', "a 'hidden' unlock is absent — a secret must not advertise its own hole");
    eq(st(plant[1]), 'listed', "a 'listed' unlock shows its name and why");
    eq(st(plant[2]), 'teased', "a 'teased' unlock shows the shape only");
    eq(st(plant[3]), 'held', 'armour is condition-gated, never found-gated');
    // Earned beats every reveal mode, including hidden.
    eq(st(plant[0], { unlocked: ['ashChildUnlock'], available: ['p_hidden'] }), 'held',
      'once earned, the secret is simply yours');
    // The unlock gate outranks the found gate: an unearned piece you somehow
    // hold is still not offered. Order matters and this is the case that shows it.
    eq(st(plant[1], { available: ['p_listed'] }), 'listed',
      'an unearned unlock wins over having found it');
    // The hint comes from the TABLE, never from this file.
    eq(pieceReveal(plant[1], ctx()).hint, 'Win two runs.', 'the hint is the unlock row\'s own words');
    eq(pieceReveal(dagger, ctx()).gate, 'unfound', 'the gate names why, so a screen picks its own sentence');

    // LAW 1 CLAUSE 5 — `reveal` has no schema, so a typo reaches the screen as a
    // live value. It must fail LOUD and degrade to the safe wrong answer:
    // 'listed' would publish a name that may be a secret, 'hidden' would delete
    // an entry in silence. 'teased' shows the shape and no identity.
    const errs = [];
    const realError = console.error;
    console.error = (...a) => errs.push(a.join(' '));
    let bad;
    try {
      bad = pieceReveal(dagger, ctx({ drops: { reveal: 'teasd' } })).state;
    } finally { console.error = realError; }
    eq(bad, 'teased', 'a bad reveal draws the shape, never the name and never nothing');
    assert(errs.some((e) => e.includes('teasd') && e.includes('balance.equipment.drops.reveal')),
      `the bad value and its home are both named — got ${JSON.stringify(errs)}`);
    assert(REVEAL_MODES.every((m) => PRESENT_STATES.includes(m)) && PRESENT_STATES.includes('held'),
      'the drawable states are the reveal modes plus held, and nothing else');

    // ONE HOME, and this is the assertion that keeps it one: `unlockView` and
    // the Compendium both route "hidden means absent" through revealState.
    // If a second copy is ever reintroduced, this and unlockView disagree first.
    eq(revealState('hidden', false), 'hidden', 'unearned obeys its mode');
    eq(revealState('hidden', true), 'held', 'earned outranks the mode');

    // ---- TWO AXES, ONE HOME EACH (Viki, resolving the #90 merge) ------------
    //
    // POSSESSION. `pieceReveal` must agree with `ownership().has` on every piece
    // and every persistence, because it no longer has its own opinion. This is
    // the assertion that goes red if the second definition ever comes back — and
    // 'perRun' is the value that made the old code and the model DISAGREE, not a
    // hypothetical: the branch read `meta.found` directly and the model does not.
    for (const persistence of ['both', 'unlocked', 'perRun']) {
      const c = ctx({ available: ['dagger'], persistence });
      for (const a of REG.equipment.armaments || []) {
        eq(pieceReveal(a, c).state === 'held', c.owned.has(a),
          `${a.id} at persistence '${persistence}': the screen and the model agree on what is yours`);
      }
    }
    // And they genuinely differ across that value, so the loop above is not
    // vacuously true for three copies of one case.
    eq(ctx({ available: ['dagger'], persistence: 'both' }).owned.has(dagger), true,
      "'both' counts the profile's found list");
    eq(ctx({ available: ['dagger'], persistence: 'perRun' }).owned.has(dagger), false,
      "'perRun' does not — the case the old Compendium got wrong");
    // FREJA'S NUMBER, PINNED. I called the divergence live; she measured that it
    // is TOTAL, not marginal — on a profile holding everything, at 'perRun', the
    // model says 0 of 24 held where the old screen drew 24. A difference of one
    // would still be a defect and would also be easy to argue away; this is the
    // whole screen, and the assertion says which.
    const allFound = (REG.equipment.armaments || []).map((a) => a.id);
    const heldAt = (persistence) => (REG.equipment.armaments || [])
      .filter((a) => pieceReveal(a, ctx({ available: allFound, persistence })).state === 'held').length;
    eq(heldAt('both'), (REG.equipment.armaments || []).length,
      'everything found, everything held — the denominator is the whole table');
    eq(heldAt('perRun'), 0,
      "at 'perRun' nothing off-run is yours — 0 of 24 against 24, total and not marginal");

    // DISCLOSURE. The join owns no condition of its own, so `gate` is exactly
    // what the model returned — never re-derived from `piece.kind`.
    for (const [row, want] of [[dagger, 'unfound'], [plant[1], 'unearned'], [plant[3], null]]) {
      eq(pieceReveal(row, ctx()).gate, ctx().owned.why(row),
        `${row.id}: the reason is READ from ownership(), not re-derived`);
      eq(pieceReveal(row, ctx()).gate, want, `${row.id} is withheld by ${want}`);
    }

    // DECLARED AND HANDLED. Every route the model can return has words. A route
    // with no sentence renders an empty reason — the quiet graceful failure.
    eq([...OWNERSHIP_GATES].sort().join(','), Object.keys(LOCK_COPY).sort().join(','),
      'every ownership gate has a sentence, and no sentence is orphaned');
    for (const g of OWNERSHIP_GATES) assert(LOCK_COPY[g] && LOCK_COPY[g].trim(), `${g} says something`);

    // BOUNDARY: this is the decision, not the drawing. Nothing here proves a
    // silhouette is visible against the panel, that the count reads as a promise
    // rather than a verdict, or that the screen fits a phone — Sunna gates the
    // read and Bjorn confirms the render. It also does not exercise the picker:
    // that both withheld states still show a REASON there (not a silhouette) is
    // a rendered fact, photographed, not asserted here.
  });

  test('48. a typed seed is refused by name, and the sentence cannot disagree with the alphabet', () => {
    // The defect: SEED_ALPHABET has no hyphen, seedFromString threw, and
    // main.js caught the throw and substituted Math.random() — so the tooltip
    // printed on the field ("the same seed gives the same map") was broken by
    // the line that hid the mistake. Six boots of one URL, six different maps.
    //
    // What is testable HERE is the vocabulary and the sentence. That the
    // refusal RENDERS, on three screens, is tools/seedrefuses.mjs, and a green
    // here is silent about it.

    // ONE PASS, TWO CALLERS. seedProblem() and seedFromString() are the same
    // scan, so the sentence a player reads at the field and the error the
    // engine throws are one string. Asserted exhaustively over ASCII plus the
    // shapes Marina measured, because "they agree today" is not the claim —
    // "they cannot disagree" is.
    let bothWays = 0;
    const sample = [];
    for (let c = 32; c <= 126; c++) sample.push(String.fromCharCode(c));
    sample.push('é', 'Å', 'ß', 'ö', '—', ' ');
    for (const ch of sample) {
      const why = seedProblem(ch);
      let threw = null;
      try { seedFromString(ch); } catch (e) { threw = e.message; }
      eq(threw, why, `${JSON.stringify(ch)}: the throw and the field's sentence are one string`);
      bothWays++;
    }
    assert(bothWays >= 100, `the join ran over a real sample (${bothWays})`);

    // MARINA'S MEASURED SET — every one of these silently rerolled at 346f4fa.
    for (const bad of ['MY-SEED', 'MY SEED', 'A_B', 'café', 'ELDEN!', '2026/08/08', 'ÅSA']) {
      const why = seedProblem(bad);
      assert(!!why, `${bad} is refused`);
      // Law 1 clause 5 — it NAMES the entry. The offending character is in the
      // sentence, quoted, not merely "invalid input".
      const offender = [...bad.toUpperCase()].find((ch) => why.includes(`“${ch}”`));
      assert(offender, `${bad}: the refusal names the character — got ${JSON.stringify(why)}`);
    }
    for (const good of ['ELDEN', 'elden', 'OO', 'GOLDBOUGH', 'SHOWCASE', '0', '']) {
      eq(seedProblem(good), null, `${JSON.stringify(good)} is a seed and is not refused`);
    }

    // THE SENTENCE IS DERIVED FROM THE ALPHABET, and this holds it to that.
    // Read the vocabulary the refusal CLAIMS, then check the code obeys its own
    // claim: every character in a claimed range is accepted, and every letter
    // the sentence says is folded actually folds. A prose copy of a closed set
    // is the second copy this refuses to become (Law 1 clause 2).
    const say = seedProblem('-');
    const ranges = [...say.matchAll(/([0-9A-Z])–([0-9A-Z])/g)];
    assert(ranges.length === 2, `the refusal states its ranges — got ${JSON.stringify(say)}`);
    let claimed = 0;
    for (const [, lo, hi] of ranges) {
      for (let c = lo.charCodeAt(0); c <= hi.charCodeAt(0); c++) {
        const ch = String.fromCharCode(c);
        eq(seedProblem(ch), null, `the sentence claims ${lo}–${hi}, so ${ch} must be accepted`);
        claimed++;
      }
    }
    eq(claimed, 36, 'the two claimed ranges cover 0–9 and A–Z');
    for (const [, typed, meant] of say.matchAll(/([0-9A-Z]) reads as ([0-9A-Z])/g)) {
      eq(seedFromString(typed), seedFromString(meant), `the sentence says ${typed} reads as ${meant}, and it does`);
    }

    // THE PROMISE, at the level this suite can see it: one seed, one number,
    // every time — and the header's round-trip lands back on the same map.
    for (const s of ['ELDEN', 'GOLDBOUGH', 'SHOWCASE']) {
      const n = seedFromString(s);
      eq(seedFromString(s), n, `${s} is one number every time`);
      eq(seedFromString(seedToString(n)), n, `${s} → header "${seedToString(n)}" → the same map`);
    }
    // …and BOTH EDGES of the vocabulary itself.
    eq(seedFromString(''), 0, 'empty edge: the empty string is zero, not a reroll');
    eq(seedToString(0), '0', '…and zero prints');
    const widest = 'ZZZZZZZZZZ'.slice(0, SEED_MAX_LEN);
    eq(seedFromString(widest), seedFromString(widest), `max edge: ${SEED_MAX_LEN} characters is deterministic`);
    assert(SEED_MAX_LEN > 0, 'the field bound has a home in rng.js, not in three markup strings');

    // BOUNDARY. This is the vocabulary and the sentence. It does NOT prove the
    // note renders, that BEGIN THE CLIMB refuses, that the refusal lets go
    // again, or that anything at all happens on the co-op wire — those are
    // tools/seedrefuses.mjs (rendered, three screens) and tools/lan.mjs's own
    // boundary check. It is also silent on `ß`, which upper-cases to `SS` and
    // is therefore accepted as two S's exactly as it always has been.
  });

  // ---- 49. every per-act plate the code can NAME is a file that exists ------
  test('49. every act plate the code names exists on disk, for every act it can reach', () => {
    // THE DEFECT THIS IS THE CLASS OF, and it lived for weeks:
    // `assets/map/parchment_act1.webp` never existed. Not a broken image, not a
    // console error, not a red check — a 404 that the fog renders as a flat wash,
    // on a screen that is almost entirely ground. Constantine asked for Elden
    // Ring's undiscovered map and got a dark rectangle, and every instrument in
    // this tree stayed green through it.
    //
    // WHY NOTHING CAUGHT IT, precisely, because the answer is the design of this
    // test. tools/bundle.mjs DOES refuse on a dangling asset path — but only a
    // LITERAL one, and its own comment says so: "Runtime-CONSTRUCTED paths
    // (`assets/equipment/weapon_${id}.webp`) can't be verified statically." The
    // plate path is built from `actPlate(actNumber, PARCHMENT_ACTS)`, so it is
    // exactly the shape that check cannot see. The gap was not an oversight in
    // the bundler; it was the bundler's stated boundary, unpaid.
    //
    // SO THE CHECK IS THE OTHER HALF: not "is this string in the source" but
    // "CALL the function and see if the file is there." Anything with a per-act
    // family and a count belongs in the table below, and adding a fourth act
    // plate stays a number in `balance.ui` — the loop reads the count, never a
    // list (Law 0 clause 1: the entry describes, the machinery derives).
    if (!assetExists) {
      // Browser test page has no filesystem — loud skip, same rule as test 33.
      assert(true, 'SKIPPED (no filesystem): act plates are checked in Node');
      return;
    }
    // ONE ROW PER FAMILY. `path` is the SHIPPED resolver, called — never a
    // second copy of its template, which would agree with itself while the game
    // looked somewhere else.
    const families = [
      { name: 'map parchment', plates: PARCHMENT_ACTS, path: (act) => parchmentAsset(act) },
      // The backdrop is bound through a CSS class rather than a path, so its
      // file name is reconstructed here — and that reconstruction is itself the
      // thing worth watching: if `.backdrop.act-N`'s url() ever stops being
      // `assets/bg/bg_actN.webp`, this row goes red and says which act.
      { name: 'combat backdrop', plates: BACKDROP_ACTS, path: (act) => `assets/bg/bg_act${actPlate(act, BACKDROP_ACTS)}.webp` },
    ];
    const missing = [];
    let checked = 0;
    for (const f of families) {
      assert(Number.isInteger(f.plates) && f.plates > 0, `${f.name}: its plate count is a positive integer (it is data, and data can be wrong)`);
      // BOTH EDGES OF THE CYCLE, not just acts 1..N. Endless Spire runs past act
      // 3 and `actPlate` wraps, so act N+1 must resolve to a real file too — the
      // wrap is the half a "check the three files" test would miss.
      for (let act = 1; act <= f.plates + 1; act++) {
        const p = f.path(act);
        checked++;
        if (!assetExists(p)) missing.push(`${f.name}, act ${act} → ${p}`);
      }
    }
    assert(checked > 0, 'the table is not empty — a loop over nothing is not a pass (SOP 2, the silence guard)');
    // Law 1 clause 5: it NAMES the entry. "some art is missing" would have been
    // as useless as the 404 was.
    eq(missing.join(' | '), '', `every named plate exists — missing: ${missing.join(' | ')}`);
    // And the extension has ONE home, so a hand-edit here cannot quietly fork it.
    assert(parchmentAsset(1).endsWith(PARCHMENT_EXT), `the plate path uses PARCHMENT_EXT (${PARCHMENT_EXT}) and not a second literal`);
    assert(typeof backdropClass(1) === 'string' && backdropClass(1).includes('act-'), 'the backdrop still binds by act class');

    // BOUNDARY. This proves the FILE IS THERE and nothing else: not that it
    // decodes, not that it is the right size, not that it looks like paper, and
    // not that the single-file build carries it — tools/bundle.mjs sweeps
    // assets/ wholesale for that, and `node tools/parchment.mjs --check` is what
    // says the plates are still what the generator makes.
  });

  test('49b. the run-shape knobs cap the act, move the roll, and refuse bad values by name', () => {
    // Constantine: "I only have the patience for 30 min runs. perhaps add an
    // advanced debug feature to limit the amount of max columns, rows, and or
    // columns with percent chance of certain nodes being more likely."
    //
    // THE ONE THING THIS TEST EXISTS FOR is the third knob. A weighting table
    // that is read and never changes what the generator produces would pass
    // every structural check in this file, so the assertion below is on the
    // POPULATION over a seed sweep, not on the table.
    const base = contentBundle.mapConfigs[1];

    // ---- the sweep's own referent. A sweep whose seeds collapse to one value
    // prints a flawless distribution of a single graph — it happened to
    // mapplan's first run (24 seeds, range 52-52). Prove the seeds differ
    // before believing anything measured with them.
    const seeds = new Set(Array.from({ length: 60 }, (_, i) => sweepSeed(i)));
    eq(seeds.size, 60, '60 sweep indices give 60 distinct seeds');
    assert(!seeds.has(sweepSeed(0) + 1) || sweepSeed(0) !== 0, 'index 0 is not seed 0');

    // ---- the caps SHORTEN, and the shortened act still resolves its own rules
    const capped = applyRunShape(base, { floors: 6, columns: 4 }, MAP_SHAPE_LIMITS);
    eq(capped.errors.length, 0, `floors=6 columns=4 resolves — ${JSON.stringify(capped.errors)}`);
    eq(capped.config.floors, 6, 'the floors cap binds');
    eq(capped.config.columns, 4, 'the columns cap binds');
    const wide = sampleActShape(base, 60);
    const short = sampleActShape(capped.config, 60);
    assert(short.nodes.max < wide.nodes.min,
      `every capped act is smaller than every default act — ${short.nodes.min}-${short.nodes.max} vs ${wide.nodes.min}-${wide.nodes.max}`);

    // ---- BOTH EDGES of the caps. The low edge is DERIVED, so ask for it.
    const mv = minViableFloors(base);
    assert(mv.floors >= 2, `this act has a viable minimum length — ${JSON.stringify(mv)}`);
    eq(applyRunShape(base, { floors: mv.floors }, MAP_SHAPE_LIMITS).errors.length, 0,
      `${mv.floors} floors is accepted (it is the derived minimum)`);
    assert(applyRunShape(base, { floors: mv.floors - 1 }, MAP_SHAPE_LIMITS).errors.length > 0,
      `${mv.floors - 1} floors is refused (one below the derived minimum)`);
    // The high edge: a cap above the act is slack, not an error — and it says so.
    const slack = applyRunShape(base, { floors: base.floors + 5 }, MAP_SHAPE_LIMITS);
    eq(slack.errors.length, 0, 'a cap above the act is not an error');
    eq(slack.changed, false, '…and changes nothing');
    assert(slack.readout.some((l) => l.includes('NOT BINDING')), '…and the readout SAYS it did nothing');

    // ---- THE WEIGHTING KNOB ACTUALLY MOVES THE DISTRIBUTION.
    // Floors and columns held at the act's own values, so nothing but the
    // weight can be what moved the share. Both directions, on one sweep.
    const shareOf = (cfg, type) => {
      const s = sampleActShape(cfg, 60);
      const total = Object.values(s.byType).reduce((a, b) => a + b, 0);
      return (s.byType[type] || 0) / total;
    };
    const type = 'elite';
    const authored = base.typeWeights[type];
    const up = applyRunShape(base, { typeWeights: { [type]: MAP_SHAPE_LIMITS.maxWeight } }, MAP_SHAPE_LIMITS);
    const down = applyRunShape(base, { typeWeights: { [type]: 0 } }, MAP_SHAPE_LIMITS);
    eq(up.errors.length, 0, 'a maxed weight is accepted');
    eq(down.errors.length, 0, 'a zeroed weight is accepted');
    const sBase = shareOf(base, type);
    const sUp = shareOf(up.config, type);
    const sDown = shareOf(down.config, type);
    assert(sUp > sBase * 1.5,
      `${type} at weight ${MAP_SHAPE_LIMITS.maxWeight} is markedly more common than at ${authored} — ${(sBase * 100).toFixed(1)}% → ${(sUp * 100).toFixed(1)}%`);
    assert(sDown < sBase,
      `${type} at weight 0 is rarer than at ${authored} — ${(sBase * 100).toFixed(1)}% → ${(sDown * 100).toFixed(1)}%`);

    // …AND A WEIGHT OF ZERO THAT DOES NOT REACH ZERO SAYS SO. This assertion is
    // here because the first version of this test claimed `sDown === 0` and was
    // WRONG: `minElites: 2` is a hard promise mapgen keeps by force-placing, so
    // Elite at weight 0 still lands two a map. Correct behaviour that looks
    // exactly like an ignored knob — Law 0 clause 5 — so the resolver names it.
    assert(sDown > 0, `${type} is force-placed by minElites even at weight 0 — ${(sDown * 100).toFixed(1)}%`);
    // Asserted on `notes`, not on `readout`: notes are the subset the SCREEN
    // prints, so this holds the caveat to reaching a player and not merely to
    // existing in a tool's output.
    assert(down.notes.some((l) => l.toLowerCase().includes(type) && l.includes('force-placed')),
      `…and the note the screen prints says so — got ${JSON.stringify(down.notes)}`);

    // A type nothing forces DOES reach zero, which is what makes the sentence
    // above a real distinction rather than an excuse for a knob that half works.
    const free = 'event';
    const zeroed = applyRunShape(base, { typeWeights: { [free]: 0 } }, MAP_SHAPE_LIMITS);
    eq(zeroed.errors.length, 0, `${free} at 0 is accepted`);
    eq(shareOf(zeroed.config, free), 0, `${free} at weight 0 never appears — nothing forces it`);
    assert(shareOf(base, free) > 0, `…and it is common at its authored weight ${base.typeWeights[free]}`);

    // ---- BAD DATA FAILS LOUD AND NAMES THE ENTRY (Law 1 clause 5).
    const named = (entry, needle) => {
      const r = applyRunShape(base, entry, MAP_SHAPE_LIMITS);
      assert(r.errors.length > 0, `${JSON.stringify(entry)} is refused`);
      const text = r.errors.map((e) => `${e.key}: ${e.msg}`).join(' · ');
      assert(text.toLowerCase().includes(needle.toLowerCase()),
        `…and the refusal says ${JSON.stringify(needle)} — got ${JSON.stringify(text)}`);
      // A refused shape never half-applies: the act comes back untouched.
      eq(r.config, base, `…and ${JSON.stringify(entry)} left the act unchanged`);
    };
    named({ columns: 1 }, 'corridor');
    named({ columns: MAP_SHAPE_LIMITS.minColumns - 1 }, 'is below');
    named({ floors: 0 }, 'is below');
    named({ floors: 8.5 }, 'whole number');
    named({ typeWeights: Object.fromEntries(Object.keys(base.typeWeights).map((k) => [k, 0])) }, 'every weight is zero');
    named({ typeWeights: { notAType: 10 } }, 'is not a node type');
    named({ typeWeights: { [type]: -1 } }, 'weight of 0 or more');
    named({ typeWeights: { [type]: MAP_SHAPE_LIMITS.maxWeight + 1 } }, 'is above the');
    named({ rows: 8 }, 'is not a run-shape knob');
    named('eight floors', 'must be an object');

    // ---- THE KNOBS ARE DERIVED FROM CONTENT, not typed on the screen.
    // The screen builds one weight slider per key of `typeWeights`; this is the
    // property that makes that true, and it is Law 0's falsifier for this
    // feature: add a node type to the act and a knob appears with no UI edit.
    for (const key of Object.keys(base.typeWeights)) {
      eq(applyRunShape(base, { typeWeights: { [key]: 30 } }, MAP_SHAPE_LIMITS).errors.length, 0,
        `'${key}' is a knob because the act rolls it`);
    }
    eq(MAP_SHAPE_KEYS.length, 3, 'three knobs, and the set is closed');

    // ---- IT REACHES THE GAME. The one act-boot path applies it, an absent
    // shape leaves every existing seed byte-for-byte identical, and a shaped
    // run is flagged out of win-rate telemetry.
    const reg = createRegistries(contentBundle);
    const graphOf = (shape) => JSON.stringify(buildActMap(reg, createRng(0x715e), 1, shape));
    eq(graphOf(null), graphOf(undefined), 'no shape and an absent shape are the same run');
    assert(graphOf(null) !== graphOf({ floors: 6 }), 'a shape reaches the generator through buildActMap');
    let threw = null;
    try { buildActMap(reg, createRng(1), 1, { columns: 1 }); } catch (e) { threw = e.message; }
    assert(threw && threw.includes('corridor'), `a bad shape throws at act boot and names the knob — got ${threw}`);
    assert(isCustomRun({ mapShape: { floors: 6 } }), 'a shaped run is kept out of win-rate stats');
    assert(!isCustomRun({ ascension: 0, mods: {}, deckMode: 'standard' }), '…and an unshaped one is not');

    // IT SURVIVES A SAVE. The shape rides on `run.custom`, so a resumed short
    // run stays short and act 2 is generated at the shape act 1 was — the claim
    // buildActMap's header makes, asserted rather than assumed.
    const saved = createRunState({ seed: 1, classId: 'reaver', registries: reg });
    saved.custom = { ascension: 0, mods: {}, deckMode: 'standard', mapShape: { floors: 6, columns: 4 } };
    const revived = JSON.parse(serializeRun(saved));
    eq(JSON.stringify(revived.custom.mapShape), JSON.stringify({ floors: 6, columns: 4 }),
      'the run shape round-trips through the save');

    // BOUNDARY. This is the generator and the resolver. It proves NOTHING about
    // the screen: that the panel opens, that the sliders reach 44 device px,
    // that the live readout prints the same number this sampler returns, or
    // that a phone can scroll it in one axis. Those are rendered facts —
    // tools/tapsize.mjs, tools/axisfit.mjs and a photograph, not this file.
    // It is also silent on MINUTES: node count is the driver of run length and
    // nothing in this tree can measure a clock.
  });

  // ---- 50. Phase 1 attributes are authored data, not engine defaults --------
  test('50. five-stat creation vocabulary and class presets come from one complete content product', () => {
    assert(Array.isArray(contentBundle.attributes), 'attribute definitions are a content table');
    assert(Array.isArray(contentBundle.creationModes), 'creation modes are a content table');
    assert(contentBundle.attributeRules && typeof contentBundle.attributeRules === 'object', 'attribute creation rules are content');
    const attrs = contentBundle.attributes.slice().sort((a, b) => a.order - b.order);
    const modes = contentBundle.creationModes;
    const classes = contentBundle.classes;
    eq(attrs.map((a) => a.id).join(','), 'strength,dexterity,constitution,wisdom,intelligence', 'the five stable ids ship in authored order');
    eq(attrs.map((a) => a.shortLabel).join(','), 'STR,DEX,CON,WIS,INT', 'all five short labels ship from the same rows');
    const standard = contentBundle.creationModes.find((m) => m.id === contentBundle.attributeRules.defaultMode);
    assert(!!standard, 'the default mode resolves');
    eq(`${standard.baseline}/${standard.bonusPool}/${standard.minimum}/${standard.maximum}`, '10/5/10/15', 'standard creation bounds are authored');
    eq(
      classes.map((c) => attrs.map((a) => contentBundle.attributeRules.presets.standard[c.id][a.id]).join('/')).join('|'),
      '13/10/12/10/10|10/11/10/10/14|10/10/12/13/10',
      'all three standard class presets are exact in the authored attribute order'
    );

    // The product is derived from its three axes. This is not a three-class
    // snapshot: every mode/class/stat cell in whatever content ships is walked.
    let cells = 0;
    for (const mode of modes) {
      const expectedTotal = mode.baseline * attrs.length + mode.bonusPool;
      for (const cls of classes) {
        const preset = contentBundle.attributeRules.presets[mode.id][cls.id];
        eq(Object.keys(preset).sort().join(','), attrs.map((a) => a.id).sort().join(','), `${mode.id}/${cls.id} has exactly the authored stat vocabulary`);
        eq(attrs.reduce((sum, a) => sum + preset[a.id], 0), expectedTotal, `${mode.id}/${cls.id} total derives from baseline × count + pool`);
        for (const attr of attrs) {
          assert(Number.isInteger(preset[attr.id]) && preset[attr.id] >= mode.minimum && preset[attr.id] <= mode.maximum, `${mode.id}/${cls.id}/${attr.id} is an in-range integer`);
          cells++;
        }
      }
    }
    eq(cells, modes.length * classes.length * attrs.length, 'the complete mode × class × stat product was checked');

    const clone = () => ({
      ...contentBundle,
      attributes: structuredClone(contentBundle.attributes),
      creationModes: structuredClone(contentBundle.creationModes),
      attributeRules: structuredClone(contentBundle.attributeRules),
    });
    const rejected = (mutate, path, label) => {
      const b = clone(); mutate(b);
      const v = validateContent(b);
      assert(!v.ok && v.errors.some((e) => e.path.includes(path)), `${label} is refused and names ${path}`);
    };
    rejected((b) => { delete b.attributes[0].id; }, 'attributes', 'missing attribute id');
    rejected((b) => { b.attributes[1].id = b.attributes[0].id; }, 'attributes', 'duplicate attribute id');
    rejected((b) => { delete b.attributes[0].order; }, 'attributes', 'missing order');
    rejected((b) => { b.attributes[1].order = b.attributes[0].order; }, 'order', 'duplicate order');
    rejected((b) => { b.attributes[0].order = 1.5; }, 'order', 'fractional order');
    rejected((b) => { b.attributes[0].order = -1; }, 'order', 'negative order');
    rejected((b) => { b.attributes[0].order = Number.NaN; }, 'order', 'NaN order');
    rejected((b) => { b.attributes[0].unknown = true; }, 'unknown', 'unknown attribute field');
    rejected((b) => { b.creationModes.push({ ...b.creationModes[0] }); }, 'creationModes', 'duplicate creation mode id');
    rejected((b) => { b.creationModes[0].unknown = true; }, 'unknown', 'unknown creation mode field');
    rejected((b) => { b.creationModes[0].minimum = b.creationModes[0].baseline + 1; }, 'creationModes', 'minimum above baseline');
    rejected((b) => { b.creationModes[0].maximum = b.creationModes[0].baseline - 1; }, 'creationModes', 'baseline above maximum');
    rejected((b) => { b.creationModes[0].bonusPool = -1; }, 'bonusPool', 'negative bonus pool');
    rejected((b) => { b.attributeRules.defaultMode = 'missing'; }, 'defaultMode', 'dangling default mode');
    rejected((b) => { delete b.attributeRules.presets.standard.reaver.strength; }, 'strength', 'missing stat product cell');
    rejected((b) => { b.attributeRules.presets.standard.reaver.luck = 10; }, 'luck', 'extra stat cell');
    rejected((b) => { b.attributeRules.presets.standard.ghost = { ...b.attributeRules.presets.standard.reaver }; }, 'ghost', 'unknown class cell');
    rejected((b) => { b.attributeRules.presets.ghost = {}; }, 'ghost', 'unknown mode cell');
    rejected((b) => { b.attributeRules.presets.standard.reaver.strength = 10.5; }, 'strength', 'fractional preset value');
    rejected((b) => { b.attributeRules.presets.standard.reaver.strength = standard.maximum + 1; }, 'strength', 'out-of-range preset value');
    rejected((b) => { b.attributeRules.presets.standard.reaver.strength -= 1; }, 'reaver', 'wrong fixed total');

    const fresh = createRunState({ seed: 50, classId: 'herald', registries: REG });
    eq(fresh.attributeMode, contentBundle.attributeRules.defaultMode, 'new run selects the authored default mode');
    eq(JSON.stringify(fresh.attributes), JSON.stringify(contentBundle.attributeRules.presets[fresh.attributeMode].herald), 'new run copies the authored Herald preset');
    for (const mode of modes) {
      const selected = createRunState({ seed: 50, classId: 'reaver', registries: REG, attributeMode: mode.id });
      eq(selected.attributeMode, mode.id, `creation accepts authored mode '${mode.id}'`);
    }
    const allocated = { ...contentBundle.attributeRules.presets.standard.reaver, strength: 12, dexterity: 11 };
    const custom = createRunState({ seed: 50, classId: 'reaver', registries: REG, attributeMode: 'standard', attributes: allocated });
    eq(JSON.stringify(custom.attributes), JSON.stringify(allocated), 'creation accepts a valid player allocation through the shared validator');

    // Whole-block legacy migration is allowed; any half-block is corruption.
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    const legacy = { ...fresh };
    delete legacy.attributeMode;
    delete legacy.attributes;
    storage.setItem(RUN_KEY, JSON.stringify(legacy));
    const migrated = saves.loadRun(REG);
    eq(JSON.stringify(migrated.attributes), JSON.stringify(contentBundle.attributeRules.presets[migrated.attributeMode].herald), 'legacy run migrates to its content-selected class preset as one whole block');
    for (const malformed of [
      { ...fresh, attributeMode: undefined },
      { ...fresh, attributes: undefined },
      { ...fresh, attributes: { ...fresh.attributes, luck: 10 } },
      { ...fresh, attributes: { ...fresh.attributes, wisdom: undefined } },
      { ...fresh, attributeMode: 'ghost' },
      { ...fresh, attributes: { ...fresh.attributes, wisdom: 10.5 } },
      { ...fresh, attributes: { ...fresh.attributes, wisdom: standard.maximum + 1 } },
      { ...fresh, attributes: { ...fresh.attributes, wisdom: fresh.attributes.wisdom + 1 } },
    ]) {
      storage.setItem(RUN_KEY, JSON.stringify(malformed));
      eq(saves.loadRun(REG), null, 'partial/unknown attribute save fails closed');
    }

    // A synthetic second mode changes order, every numeric rule, defaultMode,
    // and a class preset. Readers must follow it without a system default.
    const mutant = clone();
    mutant.attributes = mutant.attributes.map((a, i) => ({ ...a, order: mutant.attributes.length - i }));
    const testMode = { id: 'testMode', label: 'Test Mode', baseline: 7, bonusPool: 3, minimum: 7, maximum: 10, belowBaseline: 'forbid', redistribution: 'fixedTotal' };
    mutant.creationModes.push(testMode);
    mutant.attributeRules.defaultMode = testMode.id;
    mutant.attributeRules.presets.testMode = {
      reaver: { strength: 10, dexterity: 7, constitution: 7, wisdom: 7, intelligence: 7 },
      starseer: { strength: 7, dexterity: 8, constitution: 7, wisdom: 7, intelligence: 9 },
      herald: { strength: 7, dexterity: 7, constitution: 8, wisdom: 9, intelligence: 7 },
    };
    assert(validateContent(mutant).ok, 'mutant content remains valid after every derived input changes');
    const MR = createRegistries(mutant);
    const mr = createRunState({ seed: 51, classId: 'reaver', registries: MR });
    eq(mr.attributeMode, 'testMode', 'creation follows mutated default mode');
    eq(Object.keys(mr.attributes).join(','), mutant.attributes.slice().sort((a, b) => a.order - b.order).map((a) => a.id).join(','), 'run allocation key order follows mutated authored order');
    eq(Object.values(mr.attributes).reduce((a, b) => a + b, 0), testMode.baseline * mutant.attributes.length + testMode.bonusPool, 'run total follows mutated baseline/count/pool');
    const mutantAllocation = { ...mutant.attributeRules.presets.testMode.reaver, strength: 9, dexterity: 8 };
    const ma = createRunState({ seed: 52, classId: 'reaver', registries: MR, attributeMode: testMode.id, attributes: mutantAllocation });
    eq(JSON.stringify(ma.attributes), JSON.stringify(Object.fromEntries(mutant.attributes.slice().sort((a, b) => a.order - b.order).map((a) => [a.id, mutantAllocation[a.id]]))), 'creation input follows mutated vocabulary/order/rules');
    const mutantLegacy = { ...ma }; delete mutantLegacy.attributeMode; delete mutantLegacy.attributes;
    const mutantStorage = createMemoryStorage();
    mutantStorage.setItem(RUN_KEY, JSON.stringify(mutantLegacy));
    const mutantMigrated = createSaveManager(mutantStorage).loadRun(MR);
    eq(mutantMigrated.attributeMode, mutant.attributeRules.defaultMode, 'legacy migration follows the mutated default mode');
    const expectedMutantPreset = Object.fromEntries(mutant.attributes.slice().sort((a, b) => a.order - b.order).map((a) => [a.id, mutant.attributeRules.presets[mutantMigrated.attributeMode].reaver[a.id]]));
    eq(JSON.stringify(mutantMigrated.attributes), JSON.stringify(expectedMutantPreset), 'legacy migration follows the mutated class preset and authored order');
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return { passed, failed, results };
}
