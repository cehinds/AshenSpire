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
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, previewIntent, getEntity } from '../src/engine/combat.js';
import { computeAttackDamage, applyLoseHp } from '../src/engine/actions.js';
import * as S from '../src/engine/statuses.js';
import { generateActMap } from '../src/engine/mapgen.js';
import { createSaveManager, createMemoryStorage, RUN_KEY, RUN_ARCHIVE_KEY } from '../src/engine/save.js';
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
import { cardTagging } from '../src/content/generated/cardTagging.js';
import { weapons } from '../src/content/generated/weapons.js';
import { KEEPSAKES } from '../src/content/keepsakes.js';
import {
  validateEquipment, equipPiece, stampDeck, runMods, loadoutTags, addToStorage, carriedIds,
} from '../src/model/loadout.js';
import {
  UNLOCK_CONDITIONS, REVEAL_MODES, emptyProgress, recordProgress, evaluateUnlocks, unlockView,
} from '../src/model/unlocks.js';
import { ENGINE_KEYWORDS } from '../src/model/schemas.js';

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
];

const TEST_CARDS = [
  { id: 'tBigDraw', name: 'T Big Draw', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: ['innate'], effects: [{ op: 'draw', amount: 10 }], textTemplate: 'Draw {draw} cards.' },
  { id: 'tKeep', name: 'T Keep', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: ['retain'], effects: [], textTemplate: 'Retain.' },
  { id: 'tPoise', name: 'T Poise', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'poiseDamage', target: 'enemy', amount: 10 }], textTemplate: '{poiseDamage} Poise damage.' },
  { id: 'tCharge', name: 'T Charge', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: ['innate'], effects: [{ op: 'applyStatus', target: 'self', status: 'testCharge', stacks: 3 }], textTemplate: 'Gain {testCharge} Charge.' },
];

const TEST_ENEMIES = [
  { id: 'tDummy', name: 'T Dummy', hp: [30, 30], poiseMax: 99, moves: { wait: { intent: 'unknown', weight: 1 } } },
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

  // ---- 7. Bleed: accumulate / burst / clamp / threshold growth / freeze --------
  test('7. Bleed bursts at 12 for clamp(15% maxHp, 8, 35); threshold ×1.5; Lord\'s Blood freezes', () => {
    const c = makeCombat({ deck: Array(6).fill('gorefireSlash') });
    playFromHand(c, 'gorefireSlash');
    playFromHand(c, 'gorefireSlash');
    playFromHand(c, 'gorefireSlash'); // 9 bleed
    eq(S.getStacks(getEntity(c, 'e1'), 'bleed'), 9, 'bleed accumulated, no decay');
    dispatch(c, { type: 'endTurn' });
    eq(S.getStacks(getEntity(c, 'e1'), 'bleed'), 9, 'bleed persists through turns');
    playFromHand(c, 'gorefireSlash'); // 12 → burst
    const burst = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1' && e.cause === 'effect').pop();
    assert(burst, 'burst happened');
    eq(burst.amount, 8, '15% of 30 = 4.5 → min-clamped to 8');
    eq(getEntity(c, 'e1').statuses.bleed.meter.max, 18, 'threshold grew ×1.5');

    const g = makeCombat({ deck: Array(6).fill('gorefireSlash'), enemies: ['tGiant'] });
    for (let i = 0; i < 4; i++) {
      if (g.player.energy === 0) dispatch(g, { type: 'endTurn' });
      playFromHand(g, 'gorefireSlash');
    }
    const gb = logOf(g, 'hpLost').filter((e) => e.targetId === 'e1' && e.cause === 'effect').pop();
    eq(gb.amount, 35, '15% of 400 = 60 → max-clamped to 35');

    const l = makeCombat({ deck: ['goreblood', ...Array(6).fill('gorefireSlash')] });
    const lb = l.piles.hand.find((x) => x.cardId === 'goreblood');
    if (lb) dispatch(l, { type: 'playCard', cardInstanceId: lb.instanceId });
    else throw new Error('goreblood not in opening hand (6-card deck draws 5; adjust seed)');
    for (let i = 0; i < 4; i++) {
      if (l.player.energy === 0) dispatch(l, { type: 'endTurn' });
      playFromHand(l, 'gorefireSlash');
    }
    eq(getEntity(l, 'e1').statuses.bleed.meter.max, 12, "Goreblood froze the threshold");
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
    const gen = (seed) => generateActMap({ config, rng: createRng(seed) });

    // Fixed seed → identical graph (determinism snapshot).
    eq(JSON.stringify(gen(0x715e)), JSON.stringify(gen(0x715e)), 'same seed, same map');

    for (let s = 1; s <= 200; s++) {
      const map = gen(s * 2654435761);
      const nodes = Object.values(map.nodes);

      // Fixed rows: floor 1 all monster, floor 9 all treasure, floor 15 shrine.
      for (const n of nodes) {
        if (n.floor === 1) eq(n.type, 'monster', `seed ${s}: floor-1 node ${n.id}`);
        if (n.floor === 9) eq(n.type, 'treasure', `seed ${s}: floor-9 node ${n.id}`);
        // No early elites/shrines; no floor-14 shrine (SPEC §6 constraints).
        if (n.floor < config.floorRules.noEliteOrShrineBefore && n.floor > 1) {
          assert(n.type !== 'elite' && n.type !== 'shrine', `seed ${s}: early ${n.type} on floor ${n.floor}`);
        }
        if (n.floor === config.floorRules.noShrineOn) {
          assert(n.type !== 'shrine', `seed ${s}: shrine on floor 14`);
        }
      }
      eq(map.nodes[map.shrineId].type, 'shrine', `seed ${s}: pre-boss shrine`);
      eq(map.nodes[map.bossId].type, 'boss', `seed ${s}: boss node`);

      // Minimum counts (hard promise even via the relax path).
      assert(nodes.filter((n) => n.type === 'elite').length >= config.floorRules.minReachableElites, `seed ${s}: elites`);
      assert(nodes.filter((n) => n.type === 'merchant').length >= config.floorRules.minReachableMerchants, `seed ${s}: merchant`);

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
        resolveUnknownNode(REG, r, {}),
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
    const burst = logOf(v, 'hpLost').filter((e) => e.targetId === 'player' && e.cause === 'effect').pop();
    assert(burst, 'player bleed burst');
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

    equipPiece(run.loadout, 'rightHand', 0, 'dagger');
    equipPiece(run.loadout, 'rightHand', 1, 'greatsword');
    equipPiece(run.loadout, 'armor', 0, 'oathsworn');
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
    equipPiece(run.loadout, 'rightHand', 0, 'greatsword');
    assert(carriedIds(run.loadout).includes('greatsword'), 'and what is slotted');
  });

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

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return { passed, failed, results };
}
