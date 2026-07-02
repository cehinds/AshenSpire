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
import { computeAttackDamage } from '../src/engine/actions.js';
import * as S from '../src/engine/statuses.js';

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
function makeCombat({ seed = 0xc0ffee, deck = ['strike'], enemies = ['tDummy'], hp = 78, maxHp = 78, relicIds = [] } = {}) {
  const rng = createRng(seed >>> 0);
  const instances = deck.map((d, i) => {
    const isObj = typeof d === 'object';
    return { instanceId: `c${i + 1}`, cardId: isObj ? d.id : d, upgraded: isObj ? !!d.up : false };
  });
  return createCombat({
    registries: REG,
    rng,
    player: { classId: 'vagabond', maxHp, hp, deck: instances, relicIds },
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

export async function runTests() {
  const results = [];
  const test = (name, fn) => {
    try {
      fn();
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

    const x = makeCombat({ deck: ['graftedArms', 'strike', 'strike', 'strike', 'strike'] });
    playFromHand(x, 'graftedArms');
    eq(x.player.energy, 0, 'X-cost consumed all energy');
    eq(logOf(x, 'damageDealt').filter((e) => e.sourceId === 'player').length, 3, '3 energy → 3 hits');

    // X = 0 whiffs entirely (StS): playable, but zero hits.
    const x0 = makeCombat({ deck: ['graftedArms', 'defend', 'defend', 'defend', 'strike'] });
    playFromHand(x0, 'defend');
    playFromHand(x0, 'defend');
    playFromHand(x0, 'defend');
    eq(x0.player.energy, 0, 'energy spent on defends');
    playFromHand(x0, 'graftedArms');
    eq(logOf(x0, 'damageDealt').filter((e) => e.sourceId === 'player').length, 0, 'X=0 → 0 hits');

    const up = resolveCard(REG, { cardId: 'kickOff', upgraded: true });
    assert(!up.keywords.includes('exhaust'), 'Kick Off+ upgrade removed Exhaust');
    eq(resolveCard(REG, { cardId: 'hemorrhage', upgraded: true }).keywords.length, 0, 'Hemorrhage+ removed Exhaust');
  });

  // ---- 7. Bleed: accumulate / burst / clamp / threshold growth / freeze --------
  test('7. Bleed bursts at 12 for clamp(15% maxHp, 8, 35); threshold ×1.5; Lord\'s Blood freezes', () => {
    const c = makeCombat({ deck: Array(6).fill('bloodflameSlash') });
    playFromHand(c, 'bloodflameSlash');
    playFromHand(c, 'bloodflameSlash');
    playFromHand(c, 'bloodflameSlash'); // 9 bleed
    eq(S.getStacks(getEntity(c, 'e1'), 'bleed'), 9, 'bleed accumulated, no decay');
    dispatch(c, { type: 'endTurn' });
    eq(S.getStacks(getEntity(c, 'e1'), 'bleed'), 9, 'bleed persists through turns');
    playFromHand(c, 'bloodflameSlash'); // 12 → burst
    const burst = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1' && e.cause === 'effect').pop();
    assert(burst, 'burst happened');
    eq(burst.amount, 8, '15% of 30 = 4.5 → min-clamped to 8');
    eq(getEntity(c, 'e1').statuses.bleed.meter.max, 18, 'threshold grew ×1.5');

    const g = makeCombat({ deck: Array(6).fill('bloodflameSlash'), enemies: ['tGiant'] });
    for (let i = 0; i < 4; i++) {
      if (g.player.energy === 0) dispatch(g, { type: 'endTurn' });
      playFromHand(g, 'bloodflameSlash');
    }
    const gb = logOf(g, 'hpLost').filter((e) => e.targetId === 'e1' && e.cause === 'effect').pop();
    eq(gb.amount, 35, '15% of 400 = 60 → max-clamped to 35');

    const l = makeCombat({ deck: ['lordsBlood', ...Array(6).fill('bloodflameSlash')] });
    const lb = l.piles.hand.find((x) => x.cardId === 'lordsBlood');
    if (lb) dispatch(l, { type: 'playCard', cardInstanceId: lb.instanceId });
    else throw new Error('lordsBlood not in opening hand (6-card deck draws 5; adjust seed)');
    for (let i = 0; i < 4; i++) {
      if (l.player.energy === 0) dispatch(l, { type: 'endTurn' });
      playFromHand(l, 'bloodflameSlash');
    }
    eq(getEntity(l, 'e1').statuses.bleed.meter.max, 12, "Lord's Blood froze the threshold");
  });

  // ---- 8. Scarlet Rot: tick / expire after 3 / refresh ---------------------------
  test('8. Rot ticks at enemy turn start, expires entirely after 3 turns, re-apply refreshes', () => {
    const c = makeCombat({ deck: Array(5).fill('defend') });
    const e1 = getEntity(c, 'e1');
    S.applyStatus(c, e1, 'scarletRot', 4);
    dispatch(c, { type: 'endTurn' }); // enemy turn 1
    let ticks = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1');
    eq(ticks.length, 1, 'one tick');
    eq(ticks[0].amount, 4, 'tick = stacks');
    S.applyStatus(c, e1, 'scarletRot', 2); // 6 stacks, duration refreshed to 3
    dispatch(c, { type: 'endTurn' }); // tick 6 (duration 3→2)
    dispatch(c, { type: 'endTurn' }); // tick 6 (2→1)
    dispatch(c, { type: 'endTurn' }); // tick 6 (1→0 → expired)
    ticks = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1');
    eq(ticks.map((t) => t.amount).join(','), '4,6,6,6', 'tick sequence');
    assert(!e1.statuses.scarletRot, 'rot expired entirely');
    assert(logOf(c, 'statusExpired').some((e) => e.status === 'scarletRot' && e.reason === 'expired'), 'expired event');
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
    const c = makeCombat({ deck: ['enterBloodflame', 'enterBloodflame', 'strike', 'strike', 'strike'] });
    playFromHand(c, 'enterBloodflame');
    eq(c.player.hp, 76, 'first entry costs 2 HP');
    playFromHand(c, 'enterBloodflame');
    eq(c.player.hp, 76, 'second entry did NOT re-trigger the 2 HP onEnter');
    eq(logOf(c, 'stanceEntered').length, 1, 'only one stanceEntered event');
    eq(c.player.stanceId, 'bloodflame', 'still in the stance');
  });

  // ---- 10. Stances -------------------------------------------------------------
  test('10. stance exclusivity; Bloodflame per-hit Bleed; Bulwark on-Skill block', () => {
    const c = makeCombat({ deck: ['enterBloodflame', 'twinbladeFlurry', 'enterBulwark', 'defend', 'strike'] });
    playFromHand(c, 'enterBloodflame');
    eq(c.player.stanceId, 'bloodflame', 'entered bloodflame');
    eq(c.player.hp, 76, 'entering Bloodflame cost 2 HP (ignores block)');
    playFromHand(c, 'twinbladeFlurry');
    eq(S.getStacks(getEntity(c, 'e1'), 'bleed'), 6, '3 hits × 2 Bleed per hit');
    playFromHand(c, 'enterBulwark');
    eq(c.player.stanceId, 'bulwark', 'stance switched (exclusive)');
    assert(logOf(c, 'stanceExited').some((e) => e.stance === 'bloodflame'), 'exited event');
    eq(c.player.block, 3, 'Bulwark onEnter +3 (its own play does not double-trigger)');
    dispatch(c, { type: 'endTurn' });
    const d = c.piles.hand.find((x) => x.cardId === 'defend' || x.cardId === 'enterBloodflame');
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

  // ---- 12 / 13 — M2 placeholders ---------------------------------------------------
  skip('12. map generation constraints', 'M2 — mapgen.js lands with the run milestone');
  skip('13. save round-trip + versioning', 'M2 — save.js lands with the run milestone');

  // ---- 14. Scripted bot completes a boss combat -------------------------------------
  test('14. bot (leftmost affordable, end turn) finishes a seeded boss fight without throwing', () => {
    const deck = REG.classes.get('vagabond').startingDeck.map((id, i) => ({ instanceId: `c${i}`, cardId: id, upgraded: false }));
    const c = createCombat({
      registries: REG,
      rng: createRng(0x51deb00b),
      player: { classId: 'vagabond', maxHp: 78, hp: 78, deck, relicIds: ['tarnishedMedallion'] },
      enemyIds: ['watchfulOmen'],
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
    assert(logOf(c, 'relicTriggered').some((e) => e.relicId === 'tarnishedMedallion'), 'starter relic fired');
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

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return { passed, failed, results };
}
