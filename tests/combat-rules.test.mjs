// tests/combat-rules.test.mjs — THE combat engine's exact numbers, as one table.
//
// One node:test, no subtests. Every row is { name, setup, actions, expect }:
//   setup()        → a fresh fight (or config), built through the factories the
//                    game itself uses (createCombat, prototypeInput, createRunState…)
//   actions(ctx)   → plays the row and returns the OBSERVED numbers as an object
//   expect         → the exact object those numbers must deepEqual
// A failing row is reported by its name; every row runs even when one fails.
//
// Replaces engine.test.js's combat sections and the combat / hand / attack /
// status / poise / art-charge / juice / foundation test files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, previewIntent, getEntity } from '../src/engine/combat.js';
import { computeAttackDamage, computeBlockGain, drawCards, dealPoiseDamage, executeAction } from '../src/engine/actions.js';
import * as S from '../src/engine/statuses.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { resolveHandRules, scaledCards, HAND_RULES_PREFIX } from '../src/model/handRules.js';
import { discardChoicePlan } from '../src/engine/handRules.js';
import { resolveCombatRatings, attackImpact } from '../src/model/combatRatings.js';
import { applyRatingImpact } from '../src/engine/combatRatings.js';
import { createRunState, stampPlayerPoiseMax } from '../src/model/state.js';
import { playerPoiseThresholdReceipt } from '../src/model/statProjection.js';
import { startingDeckRefs, stampDeck } from '../src/model/loadout.js';
import { artChargeMax, artChargeView } from '../src/model/artCharge.js';
import { createPrototypeCombat, prototypeInput, prototypeBundle } from '../src/content/prototypes/combatBuilds.js';
import { previewFoundationAction } from '../src/engine/combatRules.js';
import { resolveDamageComponents, allocateInteger, weaponImpact } from '../src/model/combatRules.js';
import {
  COMBAT_JUICE, damageTier, damageNumberScale, hitStopMs, hitStopForEvent,
  killCamPlan, pickKillCam, receiptJuicePlan, coopFinaleHoldMs,
} from '../src/ui/models/CombatJuiceModel.js';

// ---------------------------------------------------------------------------
// Test-only content: registered beside the real bundle, never shipped.
// ---------------------------------------------------------------------------
const skill = (id, effects, extra = {}) => ({ id, name: id, class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects, textTemplate: 'Test.', ...extra });
const TEST_CARDS = [
  skill('tBigDraw', [{ op: 'draw', amount: 10 }], { keywords: ['innate'], textTemplate: 'Draw {draw} cards.' }),
  skill('tKeep', [], { keywords: ['retain'] }),
  skill('tPoise', [{ op: 'poiseDamage', target: 'enemy', amount: 10 }], { textTemplate: '{poiseDamage} Poise damage.' }),
  skill('tSelfPoise', [{ op: 'poiseDamage', target: 'self', amount: 5 }], { textTemplate: '{poiseDamage} Poise damage to you.' }),
  skill('tFrost10', [{ op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 10 }], { textTemplate: 'Apply {frost} Frost.' }),
  skill('tInsanity14', [{ op: 'applyStatus', target: 'enemy', status: 'insanity', stacks: 14 }], { textTemplate: 'Apply {insanity} Insanity.' }),
  skill('tCollide', [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 12 }, { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 10 }], { cost: 1, textTemplate: 'Apply {bleed} Bleed and {frost} Frost.' }),
  skill('tArcane5', [{ op: 'arcaneBuildup', target: 'enemy', amount: 5 }]),
  { id: 'tStarHit', name: 'T Star Hit', class: 'colorless', rarity: 'special', cost: 0, type: 'attack', keywords: [], effects: [{ op: 'damage', target: 'enemy', amount: 10, tags: ['starstone'] }], textTemplate: 'Deal {damage} damage.' },
  { id: 'tPlainHit', name: 'T Plain Hit', class: 'colorless', rarity: 'special', cost: 0, type: 'attack', keywords: [], effects: [{ op: 'damage', target: 'enemy', amount: 10 }], textTemplate: 'Deal {damage} damage.' },
];
const TEST_STATUSES = [
  { id: 'tAddVuln', name: 'T Add Vuln', stackMode: 'add', decay: 'none', taggedVulnerability: { tags: ['starstone'], mult: 1.5, stacking: 'additive' } },
];
const wait = { wait: { intent: 'unknown', weight: 1 } };
const TEST_ENEMIES = [
  { id: 'tDummy', name: 'T Dummy', hp: [30, 30], poiseMax: 99, moves: wait },
  { id: 'tBeast', name: 'T Beast', hp: [30, 30], poiseMax: 99, moves: wait },
  { id: 'tGiant', name: 'T Giant', hp: [400, 400], poiseMax: 99, moves: wait },
  { id: 'tHitter', name: 'T Hitter', hp: [50, 50], poiseMax: 99, moves: { hit: { intent: 'attack', damage: 10, weight: 1 } } },
  { id: 'tAi', name: 'T AI', hp: [999, 999], poiseMax: 999, moves: { a: { intent: 'unknown', weight: 9999, maxConsecutive: 1 }, b: { intent: 'unknown', weight: 1 } } },
  { id: 'tDelayer', name: 'T Delayer', hp: [60, 60], poiseMax: 5, firstMove: 'held',
    moves: { held: { intent: 'attack', damage: 16, weight: 1, delay: { turns: 1, whileCharging: { block: 8 } } } } },
];

/** Every fixture states its kind, exactly as shipped content must (model/tree.js). */
function withKindRows(bundle) {
  const TYPE_KIND = { attack: 'classification.attack', skill: 'classification.skill', power: 'classification.power', curse: 'classification.curse', status: 'classification.statusCard' };
  const rows = [...(bundle.tagging || [])];
  const has = new Set(rows.filter((r) => String(r.tagId).startsWith('classification.')).map((r) => `${r.family}\u0000${r.scope || ''}\u0000${r.objectId}`));
  for (const spec of bundle.tagFamilies || []) {
    if (!spec.source || typeof spec.source !== 'string') continue;
    let node = bundle;
    for (const part of spec.source.split('.')) node = node && node[part];
    for (const def of Array.isArray(node) ? node : []) {
      if (!def || typeof def.id !== 'string') continue;
      const scope = spec.scopeField ? (def[spec.scopeField] || '') : '';
      if (has.has(`${spec.family}\u0000${scope}\u0000${def.id}`)) continue;
      const tagId = spec.family === 'card' ? TYPE_KIND[def.type] : `classification.${spec.family}`;
      if (tagId) rows.push({ family: spec.family, scope, objectId: def.id, tagId });
    }
  }
  return { ...bundle, tagging: rows };
}

const REG = createRegistries(withKindRows({
  ...contentBundle,
  tagging: [...contentBundle.tagging, { family: 'enemy', scope: '', objectId: 'tBeast', tagId: 'beast' }],
  cards: [...contentBundle.cards, ...TEST_CARDS],
  statuses: [...contentBundle.statuses, ...TEST_STATUSES],
  enemies: [...contentBundle.enemies, ...TEST_ENEMIES],
}));
const SHIPPED = createRegistries(contentBundle);
const BAL = contentBundle.balance;
const BLEED_T = REG.statuses.get('bleed').proc.threshold;

// ---------------------------------------------------------------------------
// Factories and readers
// ---------------------------------------------------------------------------
function makeCombat({ seed = 0xc0ffee, deck = ['strike'], enemies = ['tDummy'], hp = 78, maxHp = 78, mana = 2, maxMana = 2, stamina = 0, maxStamina = stamina, poiseMax, registries = REG, ...rest } = {}) {
  return createCombat({
    registries, rng: createRng(seed >>> 0), ...rest,
    player: { classId: 'reaver', maxHp, hp, mana, maxMana, stamina, maxStamina, energyMax: 3, drawPerTurn: 5, relicIds: [], flasks: [],
      ...(poiseMax !== undefined ? { poiseMax } : {}),
      deck: deck.map((id, i) => ({ instanceId: `c${i + 1}`, cardId: id, upgraded: false })) },
    enemyIds: enemies,
  });
}
const e1 = (c) => getEntity(c, 'e1');
const log = (c, type, pred = () => true) => c.eventLog.filter((e) => e.type === type && pred(e));
const last = (c, type, pred) => log(c, type, pred).pop();
const hitOn = (c, id = 'e1') => last(c, 'damageDealt', (e) => e.targetId === id).amount;
function play(c, cardId, targetId = 'e1') {
  const inst = c.piles.hand.find((x) => x.cardId === cardId);
  if (!inst) throw new Error(`'${cardId}' not in hand: [${c.piles.hand.map((x) => x.cardId)}]`);
  return dispatch(c, { type: 'playCard', cardInstanceId: inst.instanceId, targetId });
}
const endTurn = (c, discardIds) => dispatch(c, { type: 'endTurn', ...(discardIds ? { discardIds } : {}) });
const refusal = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// Pulls a card from any pile into the hand (foundation fixtures).
function toHand(c, cardId) {
  for (const pile of ['hand', 'draw', 'discard']) {
    const i = c.piles[pile].findIndex((x) => x.cardId === cardId);
    if (i < 0) continue;
    const [card] = c.piles[pile].splice(i, 1);
    c.piles.hand.push(card);
    return card.instanceId;
  }
  throw new Error(`fixture lacks ${cardId}`);
}
const protoPlay = (c, cardId, targetId = 'e1') => dispatch(c, { type: 'playCard', cardInstanceId: toHand(c, cardId), targetId });
const frozen = (c) => JSON.stringify({ snapshot: serializeCombatSnapshot(c), counters: c.rng.getCounters() });

// The hand-rules fight: the shipped bundle, 25 Strikes, rules from settings.
function handFight(overrides = {}, attributes = { intelligence: 10 }) {
  const settings = Object.fromEntries(Object.entries(overrides).map(([k, v]) => [HAND_RULES_PREFIX + k, v]));
  return createCombat({ registries: SHIPPED, rng: createRng(2309), handRules: resolveHandRules(settings, contentBundle.attributes),
    player: { classId: 'reaver', maxHp: 10000, hp: 10000, maxMana: 0, energyMax: 3, drawPerTurn: 5, attributes, relicIds: [],
      deck: Array.from({ length: 25 }, (_, i) => ({ instanceId: `c${i}`, cardId: 'strike', upgraded: false })) },
    enemyIds: ['wanderingSoldier'] });
}

// The ratings fight: Combat Ratings (AR/DR/PR, Poise and Ward meters) enabled.
function ratingsFight(overrides = {}) {
  return createCombat({ registries: SHIPPED, rng: createRng(998), ratingsRules: resolveCombatRatings(overrides, contentBundle),
    player: { classId: 'reaver', maxHp: 1000, hp: 1000, maxMana: 10, energyMax: 3, drawPerTurn: 3, relicIds: [],
      attributes: { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 },
      deck: Array.from({ length: 15 }, (_, i) => ({ instanceId: `c${i}`, cardId: 'strike', upgraded: false })) },
    enemyIds: ['wanderingSoldier'] });
}
const physical = { cardId: 'strike', type: 'attack', damageSchool: 'physical' };
const magical = { cardId: 'strike', type: 'attack', damageSchool: 'magic' };

// The run fight: a real run's loadout and stamped deck, as main.js builds it.
function runFight({ right = 'greatsword', rightSets = null, seed = 812, ruleset = null } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries: SHIPPED });
  run.loadout.active.rightHand = 0;
  run.loadout.sets.rightHand = rightSets ? [...rightSets] : [right, null, null];
  run.loadout.active.leftHand = 0;
  run.loadout.sets.leftHand[0] = null;
  run.deck = startingDeckRefs(SHIPPED, run.loadout, 'reaver').map((ref, i) => ({ ...ref, instanceId: `art:${i}`, upgraded: false }));
  run.equipmentAttackSlotCount = run.deck.filter((c) => c.equipmentRole === 'attack').length;
  stampDeck(SHIPPED, run);
  const c = createCombat({ registries: SHIPPED, rng: createRng(seed), ...(ruleset ? { ruleset } : {}), enemyIds: ['wanderingSoldier'],
    player: { ...structuredClone(run), classId: run.class, relicIds: run.relics, loadout: run.loadout } });
  for (const enemy of c.enemies) { enemy.hp = enemy.maxHp = 999; if (enemy.poiseMeter) enemy.poiseMeter.max = 999; }
  return c;
}
function runPlay(c, pred) {
  const ref = Object.values(c.piles).flat().find(pred);
  if (!ref) throw new Error('card not in fight');
  for (const pile of Object.values(c.piles)) { const i = pile.indexOf(ref); if (i >= 0) pile.splice(i, 1); }
  c.piles.hand.push(ref);
  c.player.energy = 20; c.player.stamina = c.player.maxStamina; c.player.mana = c.player.maxMana;
  return dispatch(c, { type: 'playCard', cardInstanceId: ref.instanceId, targetId: c.enemies[0].id }).events;
}
const kitAttack = (w) => (c) => c.kitRole === 'attack' && c.grantedBy === w;
const artOf = (w) => (c) => c.equipmentRole === 'weaponArt' && c.grantedBy === w;

// The poise fight: a reaver whose vessel base is exactly 13.
function poiseFight() {
  const run = createRunState({ seed: 4242, classId: 'reaver', registries: SHIPPED });
  run.loadout.sets.rightHand = ['straightSword', 'boneSceptre', null];
  const receipt = playerPoiseThresholdReceipt(SHIPPED, run);
  const perPoint = Math.floor(run.derivedStatRuleSnapshot.rules.rules.poise.constitution + 1e-9) || 1;
  run.attributes.constitution += Math.round((13 - receipt.value) / perPoint);
  return createCombat({ registries: SHIPPED, rng: createRng(99), enemyIds: ['wanderingSoldier'], player: {
    classId: 'reaver', attributes: run.attributes, maxHp: run.maxHp, hp: run.hp, derivedStatRuleSnapshot: run.derivedStatRuleSnapshot,
    maxMana: run.maxMana, mana: run.mana, energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck, relicIds: [], loadout: run.loadout } });
}

const J = COMBAT_JUICE;
const T = J.sizing.damageTiers;
const H = J.motion.hitStop;
const OPEN = { paced: true, reducedMotion: false, killCam: true };
const jhit = (amount, blocked = 0) => ({ type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount, blocked });
const died = (targetId) => ({ type: 'enemyDied', targetId });

// ---------------------------------------------------------------------------
// THE TABLE
// ---------------------------------------------------------------------------
const ROWS = [
  // ---- damage order & flooring (SPEC §4.2) --------------------------------
  { name: 'damage order: floor((6 + 2 Str) × 0.75 Weak × 1.5 Vuln) = 9, one floor, min 0',
    setup: () => makeCombat({ deck: Array(5).fill('strike') }),
    actions: (c) => {
      S.applyStatus(c, c.player, 'strength', 2); S.applyStatus(c, c.player, 'weak', 1); S.applyStatus(c, e1(c), 'vulnerable', 1);
      play(c, 'strike');
      return { hit: hitOn(c), negative: computeAttackDamage(c, c.player, e1(c), -20), attackerOnly: computeAttackDamage(c, c.player, null, 7), hp: e1(c).hp };
    },
    expect: { hit: 9, negative: 0, attackerOnly: 6, hp: 21 } },
  { name: 'plain Strike: 6 damage, 1 energy, card to discard',
    setup: () => makeCombat({ deck: Array(5).fill('strike') }),
    actions: (c) => { play(c, 'strike'); return { hit: hitOn(c), energy: c.player.energy, discard: c.piles.discard.length, hand: c.piles.hand.length }; },
    expect: { hit: 6, energy: 2, discard: 1, hand: 4 } },
  { name: 'Strike preview binds the same math: 4 under Weak, 9 at +3 Str, floor(9 × 0.75) = 6 with both',
    setup: () => makeCombat({ deck: Array(5).fill('strike') }),
    actions: (c) => {
      const id = c.piles.hand[0].instanceId;
      const pv = () => previewCard(c, id, 'e1').values.find((v) => v.op === 'damage').value;
      const fresh = makeCombat({ deck: Array(5).fill('strike') }); S.applyStatus(fresh, fresh.player, 'weak', 1);
      const weak = previewCard(fresh, fresh.piles.hand[0].instanceId, 'e1').values.find((v) => v.op === 'damage').value;
      S.applyStatus(c, c.player, 'strength', 3); const strong = pv();
      S.applyStatus(c, c.player, 'weak', 1);
      return { weak, strong, both: pv() };
    },
    expect: { weak: 4, strong: 9, both: 6 } },

  // ---- block / Frail / Dexterity / Unbreakable -----------------------------
  { name: 'block absorbs first (10 hit, 5 blocked) and expires at player turn start',
    setup: () => makeCombat({ deck: Array(5).fill('defend'), enemies: ['tHitter'] }),
    actions: (c) => {
      play(c, 'defend'); const gained = c.player.block; endTurn(c);
      const hit = last(c, 'damageDealt', (e) => e.targetId === 'player');
      return { gained, amount: hit.amount, blocked: hit.blocked, hp: c.player.hp, blockAfter: c.player.block };
    },
    expect: { gained: 5, amount: 10, blocked: 5, hp: 73, blockAfter: 0 } },
  { name: 'block = floor((5 + 2 Dex) × 0.75 Frail) = 5',
    setup: () => makeCombat({ deck: Array(5).fill('defend') }),
    actions: (c) => {
      S.applyStatus(c, c.player, 'dexterity', 2); S.applyStatus(c, c.player, 'frail', 1); play(c, 'defend');
      return { block: last(c, 'blockGained', (e) => e.targetId === 'player').amount, pure: computeBlockGain(c, c.player, 10) };
    },
    expect: { block: 5, pure: 9 } },
  { name: 'Unbreakable retains block across turns and caps it at 30',
    setup: () => makeCombat({ deck: ['unbreakable', 'defend', 'defend', 'defend', 'defend'] }),
    actions: (c) => {
      play(c, 'unbreakable'); play(c, 'defend'); endTurn(c);
      const kept = c.player.block;
      for (let guard = 0; c.player.block < 30 && guard < 50; guard++) {
        const d = c.piles.hand.find((x) => x.cardId === 'defend');
        if (!d || c.player.energy < 1) endTurn(c); else dispatch(c, { type: 'playCard', cardInstanceId: d.instanceId });
      }
      endTurn(c);
      return { kept, capped: c.player.block };
    },
    expect: { kept: 5, capped: 30 } },

  // ---- draw, hand limit, keywords, X-cost -----------------------------------
  { name: 'fixed seed → identical draw order across runs, reshuffle included',
    setup: () => null,
    actions: () => {
      const draws = () => { const c = makeCombat({ deck: Array(8).fill('strike'), seed: 0xdead }); endTurn(c); endTurn(c); return { shuffles: log(c, 'deckShuffled').length, order: log(c, 'cardDrawn').map((e) => e.cardInstanceId).join(',') }; };
      const a = draws(), b = draws();
      return { same: a.order === b.order, reshuffled: a.shuffles >= 2, drawn: a.order.split(',').length };
    },
    expect: { same: true, reshuffled: true, drawn: 15 } },
  // 4 handFull receipts, not 1: each overflow lands in discard, the empty draw
  // pile reshuffles it back, and the next draw overflows it again.
  { name: 'draws past the 10-card hand go to discard as handFull (overflow re-cycles: 4 receipts)',
    setup: () => makeCombat({ deck: ['tBigDraw', ...Array(11).fill('strike')] }),
    actions: (c) => { play(c, 'tBigDraw'); return { hand: c.piles.hand.length, handFull: log(c, 'cardDiscarded', (e) => e.reason === 'handFull').length }; },
    expect: { hand: 10, handFull: 4 } },
  { name: 'Exhaust on play, Ethereal exhausts at turn end, Retain stays in hand',
    setup: () => makeCombat({ stamina: 4, deck: ['kickOff', 'lastStand', 'tKeep', 'strike', 'strike'] }),
    actions: (c) => {
      play(c, 'kickOff'); const afterPlay = c.piles.exhaust.map((x) => x.cardId); endTurn(c);
      return { afterPlay, afterTurn: c.piles.exhaust.map((x) => x.cardId).sort(), kept: c.piles.hand.some((x) => x.cardId === 'tKeep'),
        etherealReason: last(c, 'cardExhausted', (e) => e.cardId === 'lastStand').reason };
    },
    expect: { afterPlay: ['kickOff'], afterTurn: ['kickOff', 'lastStand'], kept: true, etherealReason: 'ethereal' } },
  { name: 'Innate is in the opening hand; upgrades strip Exhaust (Kick Off+, Hemorrhage+)',
    setup: () => makeCombat({ stamina: 4, deck: ['warriorsVow', ...Array(9).fill('strike')], seed: 0xbeef }),
    actions: (c) => ({ innate: c.piles.hand.some((x) => x.cardId === 'warriorsVow'),
      kickOffPlus: resolveCard(REG, { cardId: 'kickOff', upgraded: true }).keywords.includes('exhaust'),
      hemorrhagePlus: resolveCard(REG, { cardId: 'hemorrhage', upgraded: true }).keywords.length }),
    expect: { innate: true, kickOffPlus: false, hemorrhagePlus: 0 } },
  { name: 'X-cost spends all 3 energy for 3 hits',
    setup: () => makeCombat({ stamina: 4, deck: ['stitchedArms', 'strike', 'strike', 'strike', 'strike'] }),
    actions: (c) => { play(c, 'stitchedArms'); return { energy: c.player.energy, hits: log(c, 'damageDealt', (e) => e.sourceId === 'player').length, spent: last(c, 'energySpent').amount }; },
    expect: { energy: 0, hits: 3, spent: 3 } },
  { name: 'X-cost at 0 energy is playable and whiffs (0 hits)',
    setup: () => makeCombat({ stamina: 4, deck: ['stitchedArms', 'defend', 'defend', 'defend', 'strike'] }),
    actions: (c) => { play(c, 'defend'); play(c, 'defend'); play(c, 'defend'); play(c, 'stitchedArms'); return { energy: c.player.energy, hits: log(c, 'damageDealt', (e) => e.sourceId === 'player').length }; },
    expect: { energy: 0, hits: 0 } },

  // ---- costs and refusals ------------------------------------------------------
  { name: 'energy refusal: a 4th Strike on 3 energy throws and changes nothing',
    setup: () => makeCombat({ deck: Array(5).fill('strike') }),
    actions: (c) => { play(c, 'strike'); play(c, 'strike'); play(c, 'strike'); const before = frozen(c);
      return { msg: refusal(() => play(c, 'strike')), unchanged: frozen(c) === before }; },
    expect: { msg: 'Not enough energy (need 1, have 0)', unchanged: true } },
  { name: 'Mana + Stamina card: Gorefire Slash pays 1 Mana and 1 Stamina, refusals name the pool',
    setup: () => null,
    actions: () => {
      const def = REG.cards.get('gorefireSlash');
      const paid = makeCombat({ deck: Array(5).fill('gorefireSlash'), stamina: 3, mana: 2 }); play(paid, 'gorefireSlash');
      const noMana = makeCombat({ deck: Array(5).fill('gorefireSlash'), stamina: 3, mana: 0 });
      const noStamina = makeCombat({ deck: Array(5).fill('gorefireSlash'), stamina: 0, mana: 2 });
      return { manaCost: def.manaCost, staminaCost: def.staminaCost, mana: paid.player.mana, stamina: paid.player.stamina,
        manaSpent: last(paid, 'manaSpent').amount, staminaSpent: last(paid, 'staminaSpent').amount,
        noMana: refusal(() => play(noMana, 'gorefireSlash')), noStamina: refusal(() => play(noStamina, 'gorefireSlash')) };
    },
    expect: { manaCost: 1, staminaCost: 1, mana: 1, stamina: 2, manaSpent: 1, staminaSpent: 1,
      noMana: 'Not enough mana (need 1, have 0)', noStamina: 'Not enough stamina (need 1, have 0)' } },
  { name: 'Stamina: a spending turn does not recover, an idle turn does',
    setup: () => makeCombat({ deck: Array(10).fill('gorefireSlash'), stamina: 3, mana: 9, maxMana: 9 }),
    actions: (c) => { play(c, 'gorefireSlash'); endTurn(c); const afterSpend = c.player.stamina; endTurn(c);
      return { afterSpend, afterIdle: c.player.stamina, recovered: log(c, 'staminaRecovered').map((e) => [e.amount, e.reason]) }; },
    expect: { afterSpend: 2, afterIdle: 3, recovered: [[1, 'idle']] } },
  { name: 'spent Mana never refills across turns (foundation caster)',
    setup: () => createPrototypeCombat('caster', 'basic', 1),
    actions: (c) => { protoPlay(c, 'prototypeComet'); const spent = c.player.mana; endTurn(c); return { spent, next: c.player.mana }; },
    expect: { spent: 2, next: 2 } },
  { name: 'unknown / misplaced intents refuse by name',
    setup: () => makeCombat({ deck: Array(5).fill('strike') }),
    actions: (c) => ({ unknown: refusal(() => dispatch(c, { type: 'dance' })), missing: refusal(() => dispatch(c, { type: 'playCard', cardInstanceId: 'nope' })),
      badTarget: refusal(() => play(c, 'strike', 'e9')) }),
    expect: { unknown: "Unknown combat intent 'dance'", missing: "Card 'nope' is not in hand", badTarget: "Invalid target 'e9'" } },

  // ---- Bleed / Frost / Insanity procs and resistance (#61) ----------------------
  { name: 'Bleed procs at its threshold for clamp(15% of 30, 8, 35) = 8, own event, resets to 0, +3 poise',
    setup: () => makeCombat({ deck: Array(6).fill('gorefireSlash'), stamina: 6 }),
    actions: (c) => {
      S.applyStatus(c, e1(c), 'bleed', BLEED_T - 3); endTurn(c);
      const held = S.getStacks(e1(c), 'bleed'); const poise0 = e1(c).poiseMeter.value;
      play(c, 'gorefireSlash');
      return { held: held === BLEED_T - 3, burst: last(c, 'procBurst', (e) => e.targetId === 'e1').amount,
        cardHit: last(c, 'damageDealt', (e) => e.targetId === 'e1' && e.isAttack).amount,
        hpLost: last(c, 'hpLost', (e) => e.cause === 'proc:bleed').amount, meter: e1(c).statuses.bleed.meter.value,
        thresholdKept: e1(c).statuses.bleed.meter.max === BLEED_T, poise: e1(c).poiseMeter.value - poise0 };
    },
    expect: { held: true, burst: 8, cardHit: 5, hpLost: 8, meter: 0, thresholdKept: true, poise: 3 } },
  { name: 'Bleed burst max-clamps to 35 on a 400 HP giant; overflow is dropped (single proc, meter 0)',
    setup: () => null,
    actions: () => {
      const g = makeCombat({ deck: Array(8).fill('gorefireSlash'), enemies: ['tGiant'], stamina: 6 });
      S.applyStatus(g, e1(g), 'bleed', BLEED_T - 3); play(g, 'gorefireSlash');
      const o = makeCombat({ deck: Array(6).fill('gorefireSlash'), stamina: 6 });
      S.applyStatus(o, e1(o), 'bleed', BLEED_T - 1); play(o, 'gorefireSlash');
      return { giant: last(g, 'procBurst').amount, procs: log(o, 'procBurst').length, meter: e1(o).statuses.bleed.meter.value };
    },
    expect: { giant: 35, procs: 1, meter: 0 } },
  { name: 'Frost procs at 10 for clamp(8% of 30, 4, 20) = 4, leaves Weak + Frost-Exposed, no poise, no stagger',
    setup: () => makeCombat({ deck: ['tFrost10', 'tPlainHit'] }),
    actions: (c) => { const p0 = e1(c).poiseMeter.value; play(c, 'tFrost10');
      return { burst: last(c, 'procBurst', (e) => e.status === 'frost').amount, meter: e1(c).statuses.frost.meter.value,
        weak: S.getStacks(e1(c), 'weak'), exposed: S.getStacks(e1(c), 'frostExposed'), poise: e1(c).poiseMeter.value - p0, stagger: !!e1(c).skipNextTurn }; },
    expect: { burst: 4, meter: 0, weak: 1, exposed: 1, poise: 0, stagger: false } },
  { name: 'Insanity procs at 14 for clamp(18% of 30, 10, 40) = 10, +8 poise, staggers directly',
    setup: () => makeCombat({ deck: ['tInsanity14'] }),
    actions: (c) => { const p0 = e1(c).poiseMeter.value; play(c, 'tInsanity14');
      return { burst: last(c, 'procBurst', (e) => e.status === 'insanity').amount, poise: e1(c).poiseMeter.value - p0,
        skip: !!e1(c).skipNextTurn, intent: e1(c).intent.kind, unraveled: S.getStacks(e1(c), 'insanityExposed') }; },
    expect: { burst: 10, poise: 8, skip: true, intent: 'staggered', unraveled: 1 } },
  { name: 'Bleed resistance: beast gains Clotted, next 3 points blocked ceil(1.5)=2, expires after 2 turns',
    setup: () => makeCombat({ deck: Array(6).fill('gorefireSlash'), enemies: ['tBeast'], stamina: 6 }),
    actions: (c) => {
      const e = e1(c); S.applyStatus(c, e, 'bleed', BLEED_T - 3); play(c, 'gorefireSlash');
      const clotted = S.getStacks(e, 'bleedResist'); S.applyStatus(c, e, 'bleed', 3);
      const blocked = last(c, 'procResisted').blocked; const landed = e.statuses.bleed.meter.value;
      endTurn(c); endTurn(c); const expired = S.getStacks(e, 'bleedResist');
      S.applyStatus(c, e, 'bleed', 3);
      return { clotted, blocked, landed, expired, full: e.statuses.bleed.meter.value };
    },
    expect: { clotted: 1, blocked: 2, landed: 1, expired: 0, full: 4 } },
  { name: 'untagged target gains no resistance; applying 0 Bleed cannot proc',
    setup: () => makeCombat({ deck: ['strike'] }),
    actions: (c) => { S.applyStatus(c, e1(c), 'bleed', BLEED_T); const resist = S.getStacks(e1(c), 'bleedResist'); S.applyStatus(c, e1(c), 'bleed', 0);
      return { resist, procs: log(c, 'procBurst', (e) => e.status === 'bleed').length }; },
    expect: { resist: 0, procs: 1 } },
  { name: 'collision: Bleed 12 + Frost 10 on a beast → 8 + 4 attributed, both reset, both resistances',
    setup: () => makeCombat({ deck: ['tCollide'], enemies: ['tBeast'] }),
    actions: (c) => { play(c, 'tCollide'); const e = e1(c);
      const lost = (cause) => log(c, 'hpLost', (x) => x.targetId === 'e1' && x.cause === cause).reduce((s, x) => s + x.amount, 0);
      return { procs: log(c, 'procBurst', (x) => x.targetId === 'e1').length, bleed: lost('proc:bleed'), frost: lost('proc:frost'), hp: e.hp,
        meters: [e.statuses.bleed.meter.value, e.statuses.frost.meter.value], resists: [S.getStacks(e, 'bleedResist'), S.getStacks(e, 'frostResist')] }; },
    expect: { procs: 2, bleed: 8, frost: 4, hp: 18, meters: [0, 0], resists: [1, 1] } },
  { name: 'Crimson Blight ticks 4,6,6,6 at enemy turn start and expires after 3 turns (re-apply refreshes)',
    setup: () => makeCombat({ deck: Array(5).fill('defend') }),
    actions: (c) => { S.applyStatus(c, e1(c), 'crimsonBlight', 4); endTurn(c); S.applyStatus(c, e1(c), 'crimsonBlight', 2); endTurn(c); endTurn(c); endTurn(c);
      return { ticks: log(c, 'hpLost', (e) => e.targetId === 'e1').map((e) => e.amount), gone: !e1(c).statuses.crimsonBlight,
        expired: log(c, 'statusExpired', (e) => e.status === 'crimsonBlight' && e.reason === 'expired').length }; },
    expect: { ticks: [4, 6, 6, 6], gone: true, expired: 1 } },

  // ---- tagged vulnerability (Frost-Exposed / Unraveled) --------------------------
  { name: 'Frost-Exposed: plain 10, starstone 12, ×Vuln 18, 99 stacks still 18, additive lane 18',
    setup: () => makeCombat({ deck: ['tStarHit', 'tPlainHit', 'tStarHit', 'tPlainHit', 'tStarHit'], enemies: ['tGiant'] }),
    actions: (c) => {
      const e = e1(c); S.applyStatus(c, e, 'frostExposed', 1);
      play(c, 'tPlainHit'); const plain = hitOn(c); play(c, 'tStarHit'); const star = hitOn(c);
      S.applyStatus(c, e, 'vulnerable', 1); play(c, 'tStarHit'); const vuln = hitOn(c);
      S.applyStatus(c, e, 'frostExposed', 99); S.applyStatus(c, e, 'vulnerable', 99); play(c, 'tStarHit'); const ceiling = hitOn(c);
      const a = makeCombat({ deck: ['tStarHit'], enemies: ['tGiant'] });
      S.applyStatus(a, e1(a), 'frostExposed', 1); S.applyStatus(a, e1(a), 'tAddVuln', 1); play(a, 'tStarHit');
      return { plain, star, vuln, ceiling, additive: hitOn(a) };
    },
    expect: { plain: 10, star: 12, vuln: 18, ceiling: 18, additive: 18 } },
  { name: 'real tagging.csv hits: Starstone Pebble 7 under Frost-Exposed, Blight Touch 6 under Unraveled (preview = execution)',
    setup: () => null,
    actions: () => {
      const s = makeCombat({ deck: ['starstonePebble'], enemies: ['tGiant'], stamina: 2 });
      S.applyStatus(s, e1(s), 'frostExposed', 1);
      const sp = previewCard(s, s.piles.hand[0].instanceId, 'e1').values.find((v) => v.op === 'damage').value; play(s, 'starstonePebble');
      const b = makeCombat({ deck: ['blightTouch'], enemies: ['tGiant'], stamina: 4 });
      S.applyStatus(b, e1(b), 'insanityExposed', 1);
      const bp = previewCard(b, b.piles.hand[0].instanceId, 'e1').values.find((v) => v.op === 'damage').value; play(b, 'blightTouch');
      return { starPreview: sp, star: hitOn(s), blightPreview: bp, blight: hitOn(b) };
    },
    expect: { starPreview: 7, star: 7, blightPreview: 6, blight: 6 } },

  // ---- Poise → Stagger with a growing threshold -----------------------------------
  { name: 'Poise fill Staggers: cancels Held Blade, max ceil(5×1.25)=7, 2-turn window, 6×1.5=9, turn skipped',
    setup: () => makeCombat({ deck: ['tPoise', 'strike', 'strike', 'strike', 'strike'], enemies: ['tDelayer'] }),
    actions: (c) => {
      const e = e1(c); const delayed = previewIntent(c, 'e1').delayed; endTurn(c);
      const charging = e.block; const pending = !!e.pendingMove; play(c, 'tPoise');
      const st = last(c, 'enemyStaggered');
      const out = { delayed, charging, pending, cancelled: st.cancelledMove, pendingAfter: !!e.pendingMove, max: e.poiseMeter.max, window: S.getStacks(e, 'staggered') };
      play(c, 'strike'); out.hit = hitOn(c); const hp = c.player.hp; endTurn(c);
      out.tookDamage = c.player.hp !== hp; out.windowAfter = S.getStacks(e, 'staggered'); play(c, 'strike'); out.hit2 = hitOn(c);
      return out;
    },
    expect: { delayed: true, charging: 8, pending: true, cancelled: 'held', pendingAfter: false, max: 7, window: 2, hit: 9, tookDamage: false, windowAfter: 1, hit2: 9 } },
  { name: 'Held Blade resolves the turn after it commits: 16 damage lands',
    setup: () => makeCombat({ deck: Array(5).fill('tKeep'), enemies: ['tDelayer'] }),
    actions: (c) => { endTurn(c); const hp0 = c.player.hp; endTurn(c);
      return { dealt: hp0 - c.player.hp, move: last(c, 'enemyMoveStarted').moveId }; },
    expect: { dealt: 16, move: 'held' } },
  { name: 'player Poise: self-fill of 5 applies the stagger row, costs next turn 1 action once, grows to ceil(5×1.25)',
    setup: () => createCombat({ registries: REG, rng: createRng(7), enemyIds: ['tDummy'],
      player: { classId: 'reaver', maxHp: 50, hp: 50, mana: 0, maxMana: 0, stamina: 0, maxStamina: 0, energyMax: 3, drawPerTurn: 5, relicIds: [], flasks: [], poiseMax: 5,
        deck: [{ instanceId: 'sp1', cardId: 'tSelfPoise', upgraded: false }] } }),
    actions: (c) => {
      play(c, 'tSelfPoise'); const row = BAL.stagger.player;
      const statuses = Object.entries(row.statuses).every(([id, n]) => S.getStacks(c.player, id) === n);
      const out = { statuses, receipts: log(c, 'playerStaggered').length, actionLoss: last(c, 'playerStaggered').actionLoss, max: c.player.poiseMeter.max };
      endTurn(c); out.energy = c.player.energy; endTurn(c); out.energyAfter = c.player.energy;
      return out;
    },
    expect: { statuses: true, receipts: 1, actionLoss: BAL.stagger.player.actionLoss, max: Math.ceil(5 * BAL.poise.growthMult), energy: 3 - BAL.stagger.player.actionLoss, energyAfter: 3 } },
  { name: 'enemy blows rock the player by playerImpactPerHit; two fill a 2× meter and Stagger',
    setup: () => makeCombat({ deck: Array(5).fill('tKeep'), enemies: ['tHitter'], hp: 90, maxHp: 90, poiseMax: BAL.poise.playerImpactPerHit * 2 }),
    actions: (c) => { endTurn(c); const first = c.player.poiseMeter.value; endTurn(c);
      const fill = last(c, 'impactDealt', (e) => e.targetId === 'player');
      return { first, staggers: log(c, 'playerStaggered').length, receiptMatches: fill.poiseMeter.value === c.player.poiseMeter.value && fill.poiseMeter.max === c.player.poiseMeter.max,
        energy: c.player.energy, foundation: !!c.foundation }; },
    expect: { first: BAL.poise.playerImpactPerHit, staggers: 1, receiptMatches: true, energy: 3 - BAL.stagger.player.actionLoss, foundation: false } },
  { name: 'player Poise vessel 13 → 17 → 22 (rounded growth); swap + save keep it; restamp 14 → 23',
    setup: () => poiseFight(),
    actions: (c) => {
      const base = c.player.poiseMeter.max; dealPoiseDamage(c, c.player, 13); const g1 = c.player.poiseMeter.max;
      dealPoiseDamage(c, c.player, 17); const g2 = c.player.poiseMeter.max; dealPoiseDamage(c, c.player, 3);
      c.player.energy = 99; dispatch(c, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
      const swapped = [c.player.poiseMeter.max, c.player.poiseMeter.value];
      const r = restoreCombatSnapshot({ registries: SHIPPED, rng: createRng(99), snapshot: serializeCombatSnapshot(c) });
      const restoredSame = JSON.stringify(r.player.poiseMeter) === JSON.stringify(c.player.poiseMeter);
      stampPlayerPoiseMax(r.player, 14); const restamped = r.player.poiseMeter.max;
      return { base, g1, g2, swapped, restoredSame, restamped };
    },
    expect: { base: 13, g1: 17, g2: 22, swapped: [22, 3], restoredSame: true, restamped: 23 } },
  { name: 'enemy impact beat: overflow carries, max grows (3 → value 2, then value 1 of 4)',
    setup: () => { const c = poiseFight(); stampPlayerPoiseMax(c.player, 3); return c; },
    actions: (c) => {
      const blow = () => { const n = c.eventLog.length; executeAction(c, { effect: { op: 'damage', target: 'player', amount: 1 }, source: c.enemies[0], owner: c.enemies[0], target: c.player, meta: {} });
        return c.eventLog.slice(n).find((e) => e.type === 'impactDealt').poiseMeter; };
      return { first: blow(), second: blow() };
    },
    expect: { first: { value: 2, max: 3 }, second: { value: 1, max: 4 } } },

  // ---- Combat Ratings: AR/DR/PR, Ward, Poise meters --------------------------------
  { name: 'ratings: STR/DEX/INT 10 → AR 5 DR 5 PR 10, Poise = Ward = 16; +AR/+PR/+DR once',
    setup: () => ratingsFight(),
    actions: (c) => ({ ratings: c.player.ratings, phys: computeAttackDamage(c, c.player, null, 10, [], physical), magic: computeAttackDamage(c, c.player, null, 10, [], magical),
      skillBlock: computeBlockGain(c, c.player, 10, { ...physical, type: 'skill' }), bareBlock: computeBlockGain(c, c.player, 10) }),
    expect: { ratings: { ar: 5, dr: 5, pr: 10, poise: 16, ward: 16 }, phys: 15, magic: 20, skillBlock: 15, bareBlock: 10 } },
  { name: 'ratings: physical resisted by Poise 100 (20 → 10), magic unresisted at Ward 0 (20)',
    setup: () => { const c = ratingsFight(); c.player.ratings.poise = 100; c.player.ratings.ward = 0; return c; },
    actions: (c) => ({ phys: computeAttackDamage(c, c.enemies[0], c.player, 20, [], physical), magic: computeAttackDamage(c, c.enemies[0], c.player, 20, [], magical) }),
    expect: { phys: 10, magic: 20 } },
  { name: 'Ward break: magic impact on a 1-max Ward costs 1 next-turn action and grows Ward to 2; Poise untouched',
    setup: () => { const c = ratingsFight(); c.player.wardMeter = { value: 0, max: 1 }; return c; },
    actions: (c) => { applyRatingImpact(c, c.enemies[0], c.player, magical);
      return { loss: c.player.pendingActionLoss, poise: c.player.poiseMeter.value, wardMax: c.player.wardMeter.max, weak: !!c.player.statuses.weak }; },
    expect: { loss: 1, poise: 0, wardMax: 2, weak: false } },
  { name: 'enemy ratings override: Poise 30 / Ward 5; a magic-typed slash of 7 fills Ward by 1',
    setup: () => ratingsFight({ 'gameConfig.combatRatings.enemyRatings.wanderingSoldier.poise': 30, 'gameConfig.combatRatings.enemyRatings.wanderingSoldier.ward': 5,
      'gameConfig.combatRatings.enemyAttackType.wanderingSoldier:slash': 'magic' }),
    actions: (c) => {
      const e = c.enemies[0]; c.player.ratings.poise = 100; c.player.ratings.ward = 0;
      e.intent = { kind: 'attack', moveId: 'slash', damage: 7, hits: 1 }; const hp = c.player.hp; const preview = previewIntent(c, e.id).damage;
      executeAction(c, { effect: { op: 'damage', target: 'player', amount: 7 }, source: e, owner: e, target: c.player, meta: { moveId: 'slash' } });
      return { meters: [e.poiseMeter.max, e.wardMeter.max], preview, dealt: hp - c.player.hp, ward: c.player.wardMeter.value };
    },
    expect: { meters: [30, 5], preview: 7, dealt: 7, ward: 1 } },
  { name: 'weapon impact by weight: dagger 1, straight sword 2, greatsword 3, warhammer 4; enemy default',
    setup: () => ratingsFight(),
    actions: (c) => ({ byWeapon: ['dagger', 'straightSword', 'greatsword', 'warhammer'].map((id) => attackImpact(c, c.player, { ...physical, sourceArmamentId: id })),
      magic: attackImpact(c, c.player, magical), enemy: attackImpact(c, c.enemies[0], { damageSchool: 'physical' }) === c.ratingsRules.impact.enemyPhysical }),
    expect: { byWeapon: [1, 2, 3, 4], magic: 1, enemy: true } },

  // ---- Arcane Exposure -----------------------------------------------------------------
  { name: 'Arcane Exposure: 5 + 5 on a threshold-8 soldier breaks → Magic Vulnerable 25 for 2, meter 0, then locked',
    setup: () => makeCombat({ deck: ['tArcane5', 'tArcane5', 'tArcane5', 'strike', 'strike'], enemies: ['wanderingSoldier'] }),
    actions: (c) => {
      const e = e1(c); play(c, 'tArcane5'); const first = e.arcaneExposure.value; play(c, 'tArcane5');
      const brk = last(c, 'arcaneBreak'); const after = e.arcaneExposure.value; play(c, 'tArcane5');
      return { first, after, threshold: brk.threshold, status: [brk.status, brk.value, brk.duration], mv: e.statuses.magicVulnerable.duration,
        locked: last(c, 'arcaneExposureRefused').reason, stillZero: e.arcaneExposure.value };
    },
    expect: { first: 5, after: 0, threshold: 8, status: ['magicVulnerable', 25, 2], mv: 2, locked: 'locked', stillZero: 0 } },

  // ---- stances ----------------------------------------------------------------------------
  { name: 'Gorefire: entry costs 2 HP (once, re-entry no-op); 3 hits × 2 Bleed; Bulwark switches exclusively, +3 on enter',
    setup: () => makeCombat({ stamina: 4, deck: ['enterGorefire', 'twinbladeFlurry', 'enterBulwark', 'enterGorefire', 'strike'] }),
    actions: (c) => {
      play(c, 'enterGorefire'); const hp = c.player.hp; const stance = c.player.stanceId;
      play(c, 'twinbladeFlurry'); const bleed = S.getStacks(e1(c), 'bleed');
      play(c, 'enterBulwark');
      return { hp, stance, bleed, now: c.player.stanceId, exited: log(c, 'stanceExited').map((e) => e.stance), block: c.player.block };
    },
    expect: { hp: 76, stance: 'gorefire', bleed: 6, now: 'bulwark', exited: ['gorefire'], block: 3 } },
  { name: 're-entering the current stance does not re-trigger onEnter',
    setup: () => makeCombat({ deck: ['enterGorefire', 'enterGorefire', 'strike', 'strike', 'strike'] }),
    actions: (c) => { play(c, 'enterGorefire'); play(c, 'enterGorefire'); return { hp: c.player.hp, entered: log(c, 'stanceEntered').length, stance: c.player.stanceId }; },
    expect: { hp: 76, entered: 1, stance: 'gorefire' } },
  { name: 'Bulwark: a Skill (Defend) gains 5 + 2 stance block',
    setup: () => makeCombat({ deck: ['enterBulwark', 'defend', 'strike', 'strike', 'strike'] }),
    actions: (c) => { play(c, 'enterBulwark'); const b0 = c.player.block; play(c, 'defend'); return { enter: b0, gained: c.player.block - b0 }; },
    expect: { enter: 3, gained: 7 } },

  // ---- enemy intents ----------------------------------------------------------------------
  { name: 'Wandering Soldier intents carry its exact numbers: slash 7×1, guard 6 block, warcry +2 Str',
    setup: () => makeCombat({ deck: Array(5).fill('tKeep'), enemies: ['wanderingSoldier'], seed: 31, hp: 999, maxHp: 999 }),
    actions: (c) => {
      const seen = {};
      for (let i = 0; i < 12; i++) {
        const it = previewIntent(c, 'e1'); const before = { hp: c.player.hp, block: e1(c).block, str: S.getStacks(e1(c), 'strength') };
        seen[it.kind] ??= { damage: it.damage, hits: it.hits, block: it.block };
        endTurn(c);
        if (it.kind === 'block') seen.block.gained = log(c, 'blockGained', (e) => e.targetId === 'e1').pop().amount;
        if (it.kind === 'buff') seen.buff.str = S.getStacks(e1(c), 'strength') - before.str;
      }
      return { attack: seen.attack && { damage: seen.attack.damage, hits: seen.attack.hits }, block: seen.block && { block: seen.block.block, gained: seen.block.gained }, buff: seen.buff && seen.buff.str };
    },
    expect: { attack: { damage: 7, hits: 1 }, block: { block: 6, gained: 6 }, buff: 2 } },
  { name: 'intent roll is seeded: the same seed rolls the same 20-move history',
    setup: () => null,
    actions: () => {
      const hist = () => { const c = makeCombat({ deck: Array(5).fill('tKeep'), enemies: ['wanderingSoldier'], seed: 77, hp: 9999, maxHp: 9999 }); for (let i = 0; i < 19; i++) endTurn(c); return e1(c).movesHistory.join(','); };
      const a = hist();
      return { same: a === hist(), length: a.split(',').length, legal: a.split(',').every((m) => ['slash', 'guard', 'warcry'].includes(m)) };
    },
    expect: { same: true, length: 20, legal: true } },
  { name: 'maxConsecutive holds over 200 rolls of a 9999:1 weighting',
    setup: () => makeCombat({ deck: Array(5).fill('defend'), enemies: ['tAi'], seed: 0xabcd }),
    actions: (c) => { for (let i = 0; i < 200 && !c.result; i++) endTurn(c); const h = e1(c).movesHistory;
      return { rolls: h.length >= 200, repeats: h.filter((m, i) => i > 0 && m === 'a' && h[i - 1] === 'a').length, fallback: h.includes('b') }; },
    expect: { rolls: true, repeats: 0, fallback: true } },

  // ---- hand rules --------------------------------------------------------------------------
  { name: 'hand rules default: opening 3, unplayed cards survive, next turn fills to 10, full hand draws nothing',
    setup: () => handFight(),
    actions: (c) => { const ids = c.piles.hand.map((x) => x.instanceId); const opening = ids.length; endTurn(c);
      const filled = c.piles.hand.length; const kept = ids.every((id) => c.piles.hand.some((x) => x.instanceId === id));
      const draw = c.piles.draw.length; endTurn(c); return { opening, filled, kept, drawUnchanged: c.piles.draw.length === draw }; },
    expect: { opening: 3, filled: 10, kept: true, drawUnchanged: true } },
  { name: 'hand rules scaling: STR 18 / 3 per card → 5, floor 3, off → 3, capacity 2, INT 30 opens 5',
    setup: () => resolveHandRules({ [HAND_RULES_PREFIX + 'starting.stat']: 'strength', [HAND_RULES_PREFIX + 'starting.pointsPerCard']: 3 }, contentBundle.attributes),
    actions: (rules) => { const strong = scaledCards(rules.starting, { strength: 18 }); const weak = scaledCards(rules.starting, { strength: 1 });
      rules.starting.statEnabled = false;
      return { strong, weak, off: scaledCards(rules.starting, { strength: 99 }), cap2: handFight({ 'capacity.base': 2 }).piles.hand.length, int30: handFight({}, { intelligence: 30 }).piles.hand.length }; },
    expect: { strong: 5, weak: 3, off: 3, cap2: 2, int30: 5 } },
  { name: 'fixed draw mode: +2 a turn (3 → 5); scaled base 1 + INT 20 / 5 → 3 + 4 = 7',
    setup: () => null,
    actions: () => { const a = handFight({ drawMode: 'fixed' }); endTurn(a);
      const b = handFight({ drawMode: 'fixed', 'turn.base': 1, 'turn.statEnabled': true, 'turn.pointsPerCard': 5 }, { intelligence: 20 }); endTurn(b);
      return { fixed: a.piles.hand.length, scaled: b.piles.hand.length }; },
    expect: { fixed: 5, scaled: 7 } },
  { name: 'retention off discards the hand (2 drawn, 3 discarded); discard choice validates atomically',
    setup: () => null,
    actions: () => {
      const a = handFight({ retain: false, drawMode: 'fixed' }); endTurn(a);
      const d = handFight({ promptDiscard: true, discardLimit: 1, drawMode: 'fixed', replaceDiscards: true }); const ids = d.piles.hand.map((x) => x.instanceId);
      const before = serializeCombatSnapshot(d);
      const refused = [[ids[0], ids[1]], [ids[0], ids[0]], ['missing']].map((sel) => refusal(() => endTurn(d, sel)) !== null);
      const atomic = JSON.stringify(serializeCombatSnapshot(d)) === JSON.stringify(before);
      endTurn(d, [ids[0]]);
      return { hand: a.piles.hand.length, discard: a.piles.discard.length, refused, atomic, afterChoice: d.piles.hand.length, discarded: d.piles.discard.some((x) => x.instanceId === ids[0]) };
    },
    expect: { hand: 2, discard: 3, refused: [true, true, true], atomic: true, afterChoice: 5, discarded: true } },
  { name: 'overflow discard requires the selected excess (2); empty draw respects the reshuffle toggle',
    setup: () => null,
    actions: () => {
      const c = handFight({ overflow: 'discard' }); c.handRules.capacity.base = 1; const plan = discardChoicePlan(c);
      const bare = refusal(() => endTurn(c)) !== null; endTurn(c, plan.cards.slice(0, 2).map((x) => x.instanceId)); const hand = c.piles.hand.length;
      const r = handFight({ reshuffle: false }); r.piles.discard.push(...r.piles.draw.splice(0)); drawCards(r, 2); const noShuffle = r.piles.hand.length;
      r.handRules.reshuffle = true; drawCards(r, 2);
      return { minimum: plan.minimum, bare, hand, noShuffle, shuffle: r.piles.hand.length };
    },
    expect: { minimum: 2, bare: true, hand: 1, noShuffle: 3, shuffle: 5 } },
  { name: 'Ethereal exhausts despite auto-retention and cannot be chosen as a discard',
    setup: () => { const c = handFight({ promptDiscard: true }); c.piles.hand.push({ instanceId: 'eth', cardId: 'lastStand', upgraded: false }); return c; },
    actions: (c) => ({ offered: discardChoicePlan(c).cards.some((x) => x.instanceId === 'eth'), refused: refusal(() => endTurn(c, ['eth'])) !== null,
      exhausted: (endTurn(c), c.piles.exhaust.some((x) => x.instanceId === 'eth')) }),
    expect: { offered: false, refused: true, exhausted: true } },
  { name: 'hand-rule snapshot resumes deterministically; a legacy snapshot keeps 5-draw discard-all',
    setup: () => handFight({ drawMode: 'fixed', promptDiscard: true }),
    actions: (c) => {
      const r = restoreCombatSnapshot({ registries: SHIPPED, rng: createRng(8), snapshot: serializeCombatSnapshot(c) });
      const rules = JSON.stringify(r.handRules) === JSON.stringify(c.handRules); endTurn(c); endTurn(r);
      const legacySnap = serializeCombatSnapshot(handFight()); delete legacySnap.handRules; delete legacySnap.pendingDiscardDraw;
      const legacy = restoreCombatSnapshot({ registries: SHIPPED, rng: createRng(8), snapshot: legacySnap }); endTurn(legacy);
      return { rules, piles: JSON.stringify(r.piles) === JSON.stringify(c.piles), legacy: [legacy.piles.hand.length, legacy.piles.discard.length] };
    },
    expect: { rules: true, piles: true, legacy: [5, 3] } },

  // ---- Weapon Art charge ---------------------------------------------------------------------
  { name: 'Art meter: empty at start, greatsword max 3, +1 per own hit, Art below full never charges, cap holds',
    setup: () => runFight(),
    actions: (c) => {
      const start = JSON.stringify(c.artCharge); const max = artChargeMax(SHIPPED, 'greatsword');
      const ev = runPlay(c, kitAttack('greatsword')).filter((e) => e.type === 'artChargeChanged').map((e) => [e.weaponId, e.value, e.reason]);
      const art = runPlay(c, artOf('greatsword')); const artCharged = art.some((e) => e.type === 'artChargeChanged' || e.type === 'artUnleashed');
      for (let i = 0; i < max + 3; i++) runPlay(c, kitAttack('greatsword'));
      return { start, max, katana: artChargeMax(SHIPPED, 'katana'), ev, artCharged, capped: c.artCharge.greatsword, full: artChargeView(c)[0].full };
    },
    expect: { start: '{}', max: 3, katana: 4, ev: [['greatsword', 1, 'hit']], artCharged: false, capped: 3, full: true } },
  { name: 'Art unleash: full meter → artUnleashed, +4 Poise +1 Vulnerable tokens, meter to 0, same damage and payment',
    setup: () => null,
    actions: () => {
      const plain = runFight(); const hp0 = plain.enemies[0].hp; runPlay(plain, artOf('greatsword')); const plainDealt = hp0 - plain.enemies[0].hp;
      const c = runFight(); for (let i = 0; i < 3; i++) runPlay(c, kitAttack('greatsword'));
      const art = Object.values(c.piles).flat().find(artOf('greatsword')); const pv = previewCard(c, art.instanceId);
      const hp = c.enemies[0].hp; const ev = runPlay(c, artOf('greatsword'));
      return { tokens: [pv.tokens['unleashed.0'], pv.tokens['unleashed.1']], ready: pv.artCharge.unleashed, unleashed: ev.some((e) => e.type === 'artUnleashed'),
        spend: ev.some((e) => e.type === 'artChargeChanged' && e.reason === 'unleash' && e.value === 0), after: c.artCharge.greatsword,
        vulnerable: !!c.enemies[0].statuses.vulnerable, sameDamage: hp - c.enemies[0].hp === plainDealt };
    },
    expect: { tokens: [4, 1], ready: true, unleashed: true, spend: true, after: 0, vulnerable: true, sameDamage: true } },
  { name: 'Art charge per weapon: swap keeps greatsword 2 apart, katana starts 0',
    setup: () => runFight({ rightSets: ['greatsword', 'katana', null] }),
    actions: (c) => { runPlay(c, kitAttack('greatsword')); runPlay(c, kitAttack('greatsword')); c.player.energy = 99;
      dispatch(c, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 }); const view = artChargeView(c).map((r) => [r.weaponId, r.value]);
      runPlay(c, kitAttack('katana')); return { view, greatsword: c.artCharge.greatsword, katana: c.artCharge.katana }; },
    expect: { view: [['katana', 0]], greatsword: 2, katana: 1 } },
  { name: 'Art charge through the foundation ruleset: a weapon hit commits +1, then +1 again',
    setup: () => runFight({ ruleset: combatRules }),
    actions: (c) => { const ev = runPlay(c, kitAttack('greatsword')); const first = c.artCharge.greatsword; runPlay(c, kitAttack('greatsword'));
      return { foundation: !!c.foundation, hit: ev.some((e) => e.type === 'damageDealt' && e.sourceId === 'player'), first, second: c.artCharge.greatsword }; },
    expect: { foundation: true, hit: true, first: 1, second: 2 } },

  // ---- foundation transaction (combat ruleset) ---------------------------------------------------
  { name: 'foundation: typed mitigation floors each component, flat bonus once; immunity zeroes',
    setup: () => null,
    actions: () => ({ typed: resolveDamageComponents(combatRules, { components: [{ type: 'slashing', amount: 10 }, { type: 'fire', amount: 10 }], armor: 100, resistances: { fire: 0.5 }, flatBonus: 4 }),
      immune: resolveDamageComponents(combatRules, { components: [{ type: 'arcane', amount: 100 }], armor: 9999, immunities: ['arcane'] })[0].amount,
      allocate: allocateInteger(5, [1, 1, 1]) }),
    expect: { typed: [{ type: 'slashing', amount: 6 }, { type: 'fire', amount: 6 }], immune: 0, allocate: [2, 2, 1] } },
  { name: 'foundation: multi-hit impact conserves the weapon budget; each contact adds Bleed 2 through 100 block',
    setup: () => { const c = createPrototypeCombat('bleed', 'basic', 1); c.enemies[0].block = 100; return c; },
    actions: (c) => { const budget = weaponImpact(combatRules, c.foundation.profiles.player.sources.mainHand); const ev = protoPlay(c, 'prototypeFast').events;
      return { conserved: ev.filter((e) => e.type === 'impactDealt').reduce((s, e) => s + e.amount, 0) === budget, bleed: c.enemies[0].statuses.bleed.meter.value, hpFull: c.enemies[0].hp === c.enemies[0].maxHp }; },
    expect: { conserved: true, bleed: 2, hpFull: true } },
  { name: 'foundation: light Dodge costs 1 stamina (5 → 4), one-hand heavy impact totals 4',
    setup: () => createCombat(prototypeInput('heavy', 'basic', 1, { equipmentOptions: { armor: 'empty', grip: 'oneHand' } })),
    actions: (c) => { protoPlay(c, 'dodgeRoll'); const stamina = c.player.stamina;
      return { stamina, armor: c.foundation.profiles.player.armor, impact: protoPlay(c, 'prototypeHeavy').events.filter((e) => e.type === 'impactDealt').reduce((s, e) => s + e.amount, 0) }; },
    expect: { stamina: 4, armor: 0, impact: 4 } },
  { name: 'foundation: heavy Dodge retains, costs 3 stamina and no energy or RNG; evades one hit; +1 stamina next turn',
    setup: () => createPrototypeCombat('heavy', 'basic', 1),
    actions: (c) => {
      const id = toHand(c, 'dodgeRoll'); endTurn(c); const retained = c.piles.hand.some((x) => x.instanceId === id);
      const counters = JSON.stringify(c.rng.getCounters()); const energy = c.player.energy;
      dispatch(c, { type: 'playCard', cardInstanceId: id });
      const out = { retained, energyKept: c.player.energy === energy, stamina: c.player.stamina, evade: c.player.evade, rng: JSON.stringify(c.rng.getCounters()) === counters };
      out.evaded = endTurn(c).events.some((e) => e.type === 'attackEvaded'); out.staminaNext = c.player.stamina; out.evadeNext = c.player.evade;
      return out;
    },
    expect: { retained: true, energyKept: true, stamina: 2, evade: 1, rng: true, evaded: true, staminaNext: 3, evadeNext: 0 } },
  { name: 'foundation: Evade suppresses damage, impact and Bleed for exactly one hit',
    setup: () => { const c = createPrototypeCombat('bleed', 'basic', 1); c.enemies[0].evade = 1; return c; },
    actions: (c) => { const ev = protoPlay(c, 'prototypeSetup').events;
      return { hpFull: c.enemies[0].hp === c.enemies[0].maxHp, bleed: c.enemies[0].statuses.bleed, evaded: ev.filter((e) => e.type === 'attackEvaded').length, impacts: ev.filter((e) => e.type === 'impactDealt').length }; },
    expect: { hpFull: true, bleed: undefined, evaded: 1, impacts: 0 } },
  { name: 'foundation: exact preview leaves state untouched and equals execution',
    setup: () => createPrototypeCombat('bleed', 'basic', 1),
    actions: (c) => { const intent = { type: 'playCard', cardInstanceId: toHand(c, 'prototypeFast'), targetId: 'e1' }; const before = frozen(c);
      const pv = previewFoundationAction(c, (copy) => dispatch(copy, intent)); const untouched = frozen(c) === before; const res = dispatch(c, intent);
      return { untouched, same: JSON.stringify(res) === JSON.stringify(pv.result), state: frozen(c) === frozen(pv.state) }; },
    expect: { untouched: true, same: true, state: true } },
  { name: 'foundation: a failed resolution rolls back cards, resources, events and RNG',
    setup: () => {
      const input = prototypeInput('heavy', 'basic', 1); const bundle = prototypeBundle();
      bundle.cards = bundle.cards.map((x) => x.id === 'prototypeHeavy' ? { ...x, attack: { source: 'weapon', hitWeights: [1, 1] } } : x);
      input.registries = createRegistries(bundle); return createCombat(input);
    },
    actions: (c) => { const id = toHand(c, 'prototypeHeavy'); const before = frozen(c);
      const msg = refusal(() => dispatch(c, { type: 'playCard', cardInstanceId: id, targetId: 'e1' }));
      return { threw: /hitWeights/.test(msg || ''), rolledBack: frozen(c) === before }; },
    expect: { threw: true, rolledBack: true } },
  { name: 'foundation: save/reload keeps Evade and continues deterministically; tampered rules refuse by fingerprint',
    setup: () => { const c = createPrototypeCombat('heavy', 'basic', 1); protoPlay(c, 'dodgeRoll'); return c; },
    actions: (c) => { const snap = serializeCombatSnapshot(c);
      const r = restoreCombatSnapshot({ registries: c.registries, rng: createRng(c.rng.seed, c.rng.getCounters()), snapshot: snap });
      const same = JSON.stringify(endTurn(c)) === JSON.stringify(endTurn(r)); const state = frozen(c) === frozen(r);
      snap.foundation.rules.armor.cap = 0.9;
      return { same, state, tampered: /fingerprint/.test(refusal(() => restoreCombatSnapshot({ registries: c.registries, rng: c.rng, snapshot: snap })) || '') }; },
    expect: { same: true, state: true, tampered: true } },

  // ---- combat juice (CombatJuiceModel) -------------------------------------------------------------
  { name: 'juice tiers: chip <6, normal 6–14, heavy 15–24, crit ≥25; garbage is chip',
    setup: () => null,
    actions: () => ({ tiers: [0, 5, 6, 14, 15, 24, 25, 99, -5, 'nope'].map((a) => damageTier(a)), thresholds: T }),
    expect: { tiers: ['chip', 'chip', 'normal', 'normal', 'heavy', 'heavy', 'crit', 'crit', 'chip', 'chip'], thresholds: { chipBelow: 6, heavyAt: 15, critAt: 25, capAt: 50 } } },
  { name: 'juice number scale: 1 at each tier floor, 1.15 / 1.15 / 1.3 at tier tops, clamps past capAt',
    setup: () => null,
    actions: () => ({ scales: [0, 5, 6, 14, 15, 24, 25, 50, 500].map((a) => damageNumberScale(a)), mid: damageNumberScale(10) }),
    expect: { scales: [1, 1, 1, 1.15, 1, 1.15, 1, 1.3, 1.3], mid: 1.075 } },
  { name: 'hit-stop: 0 below heavy, 40 at 15, 60 at 20, 80 at 25, 120 at 50+, stagger 100',
    setup: () => null,
    actions: () => ({ ms: [0, 14, 15, 20, 25, 50, 1000].map((a) => hitStopMs(a)), stagger: hitStopForEvent({ type: 'enemyStaggered' }), bounds: [H.minMs, H.critMs, H.maxMs] }),
    expect: { ms: [0, 0, 40, 60, 80, 120, 120], stagger: 100, bounds: [40, 80, 120] } },
  { name: 'hit-stop reads only the residual: guarded, overblocked, other events, reduced motion and instant speed stop 0',
    setup: () => null,
    actions: () => ({ crit: hitStopForEvent(jhit(25)), guarded: hitStopForEvent(jhit(25, 25)), underHeavy: hitStopForEvent(jhit(25, 11)), over: hitStopForEvent(jhit(25, 75)),
      others: ['hpLost', 'healed', 'blockGained', 'enemyDied', 'procBurst'].map((type) => hitStopForEvent({ type, amount: 99 })),
      reduced: hitStopForEvent(jhit(50), { reducedMotion: true }), instant: hitStopForEvent(jhit(50), { paced: false }), none: hitStopForEvent(null) }),
    expect: { crit: 80, guarded: 0, underHeavy: 0, over: 0, others: [0, 0, 0, 0, 0], reduced: 0, instant: 0, none: 0 } },
  { name: 'kill cam: boss 900, elite 750, winning blow 600 at 0.35× and 1.12 zoom; boss > elite > last; gates close it',
    setup: () => null,
    actions: () => {
      const ranks = { n1: null, n2: null, el: 'elite', bo: 'boss' }; const rankOf = (id) => ranks[id];
      const boss = killCamPlan({ rank: 'boss' }, OPEN);
      return { boss: [boss.ms, boss.slowRate, boss.zoom], elite: killCamPlan({ rank: 'elite' }, OPEN).ms, last: killCamPlan({ lastEnemy: true }, OPEN).ms, normal: killCamPlan({}, OPEN),
        pick: pickKillCam([died('n1'), died('bo'), died('el'), died('n2')], { rankOf, won: true }, OPEN).event.targetId,
        winning: pickKillCam([died('n1'), died('n2')], { rankOf, won: true }, OPEN).event.targetId,
        gated: [{ reducedMotion: true }, { killCam: false }, { paced: false }].map((g) => killCamPlan({ rank: 'boss' }, { ...OPEN, ...g })) };
    },
    expect: { boss: [900, 0.35, 1.12], elite: 750, last: 600, normal: null, pick: 'bo', winning: 'n2', gated: [null, null, null] } },
  { name: 'co-op receipt juice: one stop per struck figure at its longest hit; finale hold 700 or the cam',
    setup: () => null,
    actions: () => {
      const plan = receiptJuicePlan([jhit(15), jhit(30), { type: 'enemyStaggered', targetId: 'e1' }, { type: 'damageDealt', sourceId: 'e1', targetId: 'player', targetPlayerId: 'p2', amount: 20, blocked: 0 }], {}, OPEN);
      return { stops: plan.stops.map((s) => [s.targetId, s.ms, s.sourceIds]), killCam: plan.killCam, hold: coopFinaleHoldMs(null, OPEN), instant: coopFinaleHoldMs(null, { paced: false }) };
    },
    expect: { stops: [['e1', 100, []], ['p2', 60, ['e1']]], killCam: null, hold: 700, instant: 0 } },
];

// ---------------------------------------------------------------------------
test('combat rules: every exact number in the table', () => {
  const failures = [];
  const names = new Set();
  for (const row of ROWS) {
    if (names.has(row.name)) failures.push(`${row.name}: duplicate row name`);
    names.add(row.name);
    try {
      const ctx = row.setup();
      const got = row.actions(ctx);
      assert.deepStrictEqual(got, row.expect);
    } catch (err) {
      failures.push(`✗ ${row.name}\n    ${String(err && err.message).split('\n').slice(0, 12).join('\n    ')}`);
    }
  }
  assert.ok(ROWS.length >= 40, `table has ${ROWS.length} rows`);
  if (failures.length) assert.fail(`${failures.length}/${ROWS.length} rows failed:\n${failures.join('\n')}`);
});
