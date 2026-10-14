// alternative-combat-rounds: timeline model (owner, 2026-10-11). Prototype only.
//
// Every combatant (the player and each enemy) builds a queue of cards each round.
// Each card has its own SP cost (`sp`, default 1). buildTimeline() orders all queued
// actions under one of three merge modes; createRound() resolves them one at a time.
// Reuses resolver.mjs primitives.
// Not wired into src/. No DOM, no Math.random: randomness is injected as `rng`, a
// function returning a float in [0, 1). Design: DESIGN.md, "Timeline model".

import {
  accuracyFor,
  clampMomentum,
  decayMomentum,
  evadePctFor,
  evasionFor,
  hitRoll,
  momentumSpeed,
  rollD20,
  rollUnit,
  stanceBonus,
  MOMENTUM_MAX,
  MOMENTUM_MIN,
} from './resolver.js';
import {
  ADAPT_COUNTER_DAMAGE,
  ADAPT_INDEX,
  ADAPT_PERCENT_MAX,
  ADAPT_PERCENT_PER_WIS,
  DEFAULT_CARD_SP,
  DEFAULT_SP,
  DEFENSE_BASE,
  REACTION_BUFF,
} from '../../content/combatRounds.js';

export const MERGE_MODES = Object.freeze(['speed', 'roundRobin', 'wholeQueue']);
export const CARD_KINDS = Object.freeze(['attack', 'guard', 'evade', 'counter', 'other']);
export const DEFENSIVE_KINDS = Object.freeze(['guard', 'evade', 'counter']);

// The placeholder numbers (SP, buffs, defence bases, adaptation) are data in src/content/combatRounds.js.
// One-line local re-export: tools/bundle.mjs accepts `export { a, b };` without `from` only.
export { ADAPT_COUNTER_DAMAGE, ADAPT_INDEX, ADAPT_PERCENT_MAX, ADAPT_PERCENT_PER_WIS, DEFAULT_SP, DEFENSE_BASE, REACTION_BUFF };

const SIDES = Object.freeze(['player', 'enemy']);

// Combatant-keyed maps (owner, 2026-10-11). An id may be any string, such as '__proto__' or
// 'constructor'. A key is created with put() as an own property (an assignment would hit the
// prototype setter for '__proto__'), and read with get(), which reads own keys only.
const put = (obj, key, value) => {
  Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
  return value;
};
const get = (obj, key, fallback = undefined) => (obj && Object.hasOwn(obj, key) ? obj[key] : fallback);


const cardSp = (card) => {
  const c = card.sp ?? DEFAULT_CARD_SP;
  if (!Number.isFinite(Number(c)) || Number(c) < 0) throw new RangeError(`card "${card.id}" sp must be 0 or more`);
  return Number(c);
};

// Defence numbers on a card (Codex review on PR #1838). A field that is absent (undefined or
// null) uses its DEFENSE_BASE default, so this returns undefined. A present value must be a
// finite number of 0 or more, else TypeError naming the field.
const DEFENCE_FIELDS = Object.freeze(['block', 'evadePct', 'counterDamage']);
function defenceNumber(card, field) {
  const v = card?.[field];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new TypeError(`card "${card.id}" ${field} must be a finite number of 0 or more`);
  }
  return v;
}

// Checks every defence number on a card (TypeError on the first bad one). Used before a paused
// round commits a reaction, so a bad card throws while the round is still unchanged.
export function assertDefenceNumbers(card) {
  for (const field of DEFENCE_FIELDS) defenceNumber(card, field);
}

// Momentum gain is read after a reaction has been applied, so a paused round must
// validate it before committing the answer. Keep the validation in one place so
// the preflight and the resolver accept exactly the same values.
export function assertMomentumGain(card) {
  const g = Number(card?.momentumGain ?? 1);
  if (!Number.isFinite(g)) throw new TypeError('momentumGain must be a finite number');
  return g;
}

// Checks every field that resolving a defensive card reads: the defence numbers, momentumGain
// (gainOf) and sp (cardSp). Throws the first error, before any round state changes. A paused
// round checks its chosen card with this before un-pausing, and round start checks each player's
// defensive hand cards with it, so a bad card never gets as far as a reaction.
export function assertReactionCard(card) {
  if (!card || typeof card !== 'object') throw new TypeError('a reaction card must be an object');
  assertCardKey(card);
  assertDefenceNumbers(card);
  gainOf(card);
  cardSp(card);
}

// Checks the defensive cards in each player's hand (reactionOffer reads their sp, and a reaction
// reads their defence numbers and momentumGain). Enemies never react, so their hands are not read.
function validateHands(combatants) {
  for (const id of Object.keys(combatants)) {
    if (combatants[id].side !== 'player') continue;
    for (const card of combatants[id].hand ?? []) {
      if (card && typeof card === 'object' && DEFENSIVE_KINDS.includes(card.kind)) assertReactionCard(card);
    }
  }
}

// Initiative base (owner, 2026-10-11, placeholder): floor(DEX / 2).
function initiativeBase(c) {
  const dex = Number(c.attrs?.DEX ?? 0);
  return Math.floor((Number.isFinite(dex) ? dex : 0) / 2);
}

// d4 from the injected rng: floor(u * 4) + 1.
const rollD4 = (rng) => Math.floor(rollUnit(rng) * 4) + 1;

// Builds one combatant record. `spec` takes id, side, name, attrs, level, hp, sp,
// wis, tags, stance, accuracy, evasionArmor, dex, shield, evasionCard, evasion,
// evadeBasePct, intangibleCharges and hand (an array of defensive cards it may
// play as a reaction). `tables` is { armor, cards } for evasionFor().
export function makeCombatant(spec = {}, tables = {}) {
  if (!spec || typeof spec !== 'object') throw new TypeError('combatant spec must be an object');
  const id = spec.id;
  if (typeof id !== 'string' || id === '') throw new TypeError('combatant id must be a non-empty string');
  const side = spec.side ?? (id === 'player' ? 'player' : 'enemy');
  if (!SIDES.includes(side)) throw new TypeError(`side must be one of ${SIDES.join(', ')}`);
  if ((id === 'player') !== (side === 'player')) throw new TypeError('the player is id "player" on side "player"; enemies are not');
  const hp = Number(spec.hp);
  if (!Number.isFinite(hp) || hp < 0) throw new TypeError(`${id}.hp must be a number of 0 or more`);
  const sp = Number(spec.sp ?? DEFAULT_SP);
  if (!Number.isFinite(sp) || sp < 0) throw new TypeError(`${id}.sp must be a number of 0 or more`);
  // A non-finite attribute counts as 0, as the other numbers here do: JSON turns Infinity and NaN
  // into null, so a kept value would make a saved round differ from the live one.
  const attrs = Object.fromEntries(Object.entries(spec.attrs ?? {}).map(([k, x]) => [k, typeof x === 'number' && !Number.isFinite(x) ? 0 : x]));
  // The evasion-cards table, when given, is a Map (makeFight). Anything else would silently drop the
  // card bonuses, so it is rejected here, before evasionFor() reads it.
  if (tables?.cards !== undefined && tables?.cards !== null && !(tables.cards instanceof Map)) {
    throw new TypeError('tables.cards must be a Map from parseEvasionCards()');
  }
  // Every numeric input evasionFor() reads is normalised the same way as attrs (Codex P2 on PR #1871):
  // a non-finite value counts as 0. A missing value (null/undefined) is kept, so dex still falls back
  // to attrs.DEX and evasion to 0.
  const finiteOrZero = (x) => (x == null ? x : (Number.isFinite(Number(x)) ? Number(x) : 0));
  const evasion = evasionFor({
    evasionArmor: spec.evasionArmor,
    dex: finiteOrZero(spec.dex),
    shield: spec.shield,
    evasionCard: spec.evasionCard,
    attrs,
    evasion: finiteOrZero(spec.evasion),
  }, tables);
  const base = Number(spec.evadeBasePct ?? spec.evadePct ?? 0);
  const wis = Number(spec.wis ?? 0);
  const charges = Math.trunc(Number(spec.intangibleCharges ?? 0));
  return {
    id,
    side,
    name: spec.name ?? id,
    attrs,
    // A non-finite level counts as 0, so a saved round (JSON turns NaN into null) reads it the same.
    level: Number.isFinite(Number(spec.level ?? 0)) ? Number(spec.level ?? 0) : 0,
    hp,
    maxHp: hp,
    sp,
    wis: Number.isFinite(wis) ? wis : 0,
    tags: Array.isArray(spec.tags) ? [...spec.tags] : [],
    stance: spec.stance ?? null,
    evasion,
    evadeBasePct: Number.isFinite(base) ? base : 0,
    intangibleCharges: Number.isFinite(charges) && charges > 0 ? charges : 0,
    // Non-finite accuracy counts as 0, like level, so a saved round (JSON turns Infinity into null) reads it the same.
    accuracyExtra: Number.isFinite(Number(spec.accuracy ?? 0)) ? Number(spec.accuracy ?? 0) : 0,
    hand: Array.isArray(spec.hand) ? spec.hand.map((c) => ({ ...c })) : [],
    // The evasion-cards.csv table (owner, 2026-10-11): a played evade card whose name or id is
    // in it adds that bonus to the hit roll of the one attack it answers. Null when no table.
    evadeCards: tables?.cards instanceof Map ? tables.cards : null,
  };
}

// The evasion-cards.csv bonus of a played evade card, or null when the card is not in the table.
// Matches the card's name, then its id (names are case-sensitive, as in the table). The table is a
// Map (makeFight) or a plain object (a JSON round, see round.js); both read the same way.
function evadeCardBonus(combatant, card) {
  const table = combatant.evadeCards;
  if (!table) return null;
  const isMap = table instanceof Map;
  const has = (k) => (isMap ? table.has(k) : Object.hasOwn(table, k));
  const read = (k) => (isMap ? table.get(k) : table[k]);
  const key = [card.name, card.id].find((k) => typeof k === 'string' && has(k));
  return key === undefined ? null : read(key);
}

// The foes a combatant may target: enemies for the player, the player for an enemy.
function foesOf(combatants, id) {
  if (combatants[id].side === 'player') {
    return Object.keys(combatants).filter((k) => combatants[k].side === 'enemy');
  }
  return ['player'];
}

// The target rule for one card (owner, 2026-10-11), shared by queues and reactions: an attack
// hits a foe; a guard or evade is for its owner; a counter or other card is for its owner or a foe.
function targetOk(card, foes) {
  const t = card.target;
  return card.kind === 'attack' ? foes.includes(t)
    : card.kind === 'guard' || card.kind === 'evade' ? t === 'self'
      : t === 'self' || foes.includes(t);
}

// Checks every queue: known combatant, card shape, target, and SP budget.
function validateQueues(queues, combatants) {
  if (!queues || typeof queues !== 'object' || Array.isArray(queues)) throw new TypeError('queues must be an object keyed by combatant id');
  for (const id of Object.keys(queues)) {
    if (!Object.hasOwn(combatants, id)) throw new TypeError(`queue for unknown combatant "${id}"`);
    const queue = queues[id];
    if (!Array.isArray(queue)) throw new TypeError(`queue for "${id}" must be an array`);
    let spent = 0;
    for (const card of queue) {
      if (!card || typeof card !== 'object') throw new TypeError(`a card in "${id}" must be an object`);
      if (typeof card.id !== 'string' || card.id === '') throw new TypeError(`a card in "${id}" needs an id`);
      assertCardKey(card);
      if (!CARD_KINDS.includes(card.kind)) throw new TypeError(`card "${card.id}" kind must be one of ${CARD_KINDS.join(', ')}`);
      if (!Number.isFinite(Number(card.speed ?? 0))) throw new TypeError(`card "${card.id}" speed must be a finite number`);
      for (const field of DEFENCE_FIELDS) defenceNumber(card, field);
      gainOf(card);
      if (!targetOk(card, foesOf(combatants, id))) {
        throw new TypeError(`card "${card.id}" of "${id}" has an invalid target "${card.target}"`);
      }
      spent += cardSp(card);
    }
    if (spent > combatants[id].sp) {
      throw new RangeError(`"${id}" queues ${spent} SP, more than its ${combatants[id].sp} SP`);
    }
  }
}

// Momentum term of an action (owner, 2026-10-11): the player's action on foe X adds
// momentumSpeed(M_X); an enemy's action on the player adds -momentumSpeed(M_enemy).
// A self-target action has no foe, so it carries no momentum term.
function momentumTerm(side, id, target, momentum) {
  if (target === 'self') return 0;
  if (side === 'player') return momentumSpeed(get(momentum, target, 0));
  return 0 - momentumSpeed(get(momentum, id, 0));
}

// The part of an action's speed known at plan time (before the round's d4 roll):
// card speed + preemptive buff + DEX initiative base + momentum term. buildTimeline
// adds the d4 to this, and nothing else, so the two cannot drift apart.
// parts: { combatant, id?, card, preemptive, momentum, foeId }. combatant is a record
// from makeCombatant; id defaults to combatant.id; foeId is the foe the card is aimed
// at (the player's momentum term is on that foe). momentum is { [enemyId]: M }, decayed.
function planParts({ combatant, id = combatant.id, card, preemptive, momentum = {}, foeId }) {
  const cardSpeed = Number(card.speed ?? 0);
  const buff = preemptive ? REACTION_BUFF.speed : 0;
  const base = initiativeBase(combatant);
  const target = card.target === 'self' ? 'self' : foeId;
  const momentumPart = momentumTerm(combatant.side, id, target, momentum);
  return { card: cardSpeed, buff, base, momentum: momentumPart, known: cardSpeed + buff + base + momentumPart };
}

// plannedSpeed({ combatant, card, preemptive, momentum, foeId }): the plan-time speed
// of one queued action, which is the timeline speed without the round's d4 (SPEC 4.11).
// A forecast: the outline and the planning UI use it, and the real order also adds
// the d4 rolled at round start.
export function plannedSpeed(input) {
  return planParts(input).known;
}

// The queue-order cap (owner, 2026-10-11): each action's effective speed is its total capped
// by the previous action's effective speed in the same queue. buildTimeline and
// plannedQueueSpeeds both use this, so the forecast and the real order share one rule.
function capQueue(speeds) {
  let running = Infinity;
  return speeds.map((s) => {
    running = Math.min(s, running);
    return running;
  });
}

// plannedQueueSpeeds({ combatant, queue, momentum, id? }): the plan-time EFFECTIVE speed of
// each card in one combatant's queue, in queue order: plannedSpeed for the card, capped by the
// previous card's effective speed exactly as buildTimeline caps. The d4 is excluded. It is one
// roll per combatant per round and is added to every card in the queue, so the cap commutes
// with it: min(a + d4, b + d4) = min(a, b) + d4. Entry i equals buildTimeline's
// speed.effective[i] - speed.d4. targetOutline takes these as its speeds.
export function plannedQueueSpeeds({ combatant, queue = [], momentum = {}, id = combatant.id }) {
  const cards = Array.isArray(queue) ? queue : [];
  return capQueue(cards.map((card) => plannedSpeed({
    combatant, id, card, preemptive: DEFENSIVE_KINDS.includes(card.kind), momentum, foeId: card.target,
  })));
}

// Orders the queued actions for one round (owner, 2026-10-11). Returns
// { merge, initiative: { [id]: { base, d4, lead } }, entries }.
//
// queues:  { [combatantId]: [card] }. A card is { id, kind, target, speed, sp?, ... }.
//          kind: attack | guard | evade | counter | other. target: a foe id or 'self'.
// ctx:     { combatants: { [id]: record from makeCombatant }, rng, momentum?, merge? }.
//          momentum is { [enemyId]: M } at the start of the round (already decayed).
//          merge: 'speed' (default) | 'roundRobin' | 'wholeQueue'.
//
// Each combatant rolls one d4 per round, in combatants key order (player first).
// Initiative of an action = base + d4 + momentum term. Action speed = card speed +
// initiative. A queued defensive card is preemptive: it gets REACTION_BUFF.speed.
// An entry's speed = { card, buff, base, d4, momentum, initiative, total, effective }.
// `effective` is the speed the merge uses: in 'speed' mode it is the minimum of the
// action's total and the previous card's effective in the same queue.
export function buildTimeline(queues, ctx = {}) {
  const combatants = ctx.combatants;
  if (!combatants || typeof combatants !== 'object' || !Object.hasOwn(combatants, 'player')) {
    throw new TypeError('ctx.combatants must include "player"');
  }
  const merge = ctx.merge ?? 'speed';
  if (!MERGE_MODES.includes(merge)) throw new RangeError(`merge must be one of ${MERGE_MODES.join(', ')}`);
  const momentum = ctx.momentum ?? {};
  if (typeof momentum !== 'object' || Array.isArray(momentum)) throw new TypeError('ctx.momentum must be an object keyed by enemy id');
  validateQueues(queues, combatants);
  validateHands(combatants);

  // Snapshot every queued card before initiative consumes rng. Besides isolating nested caller
  // data, this makes an uncloneable extension field fail while the injected rng is still at its
  // original cursor, just like every other invalid queue field checked above.
  const queueSnapshots = {};
  for (const id of Object.keys(queues)) {
    put(queueSnapshots, id, queues[id].map((card) => structuredClone(card)));
  }

  // Lane order: player first, then the other combatants in key order.
  const laneIds = [
    'player',
    ...Object.keys(combatants).filter((k) => k !== 'player'),
  ];
  const d4 = {};
  const base = {};
  for (const id of laneIds) {
    put(base, id, initiativeBase(combatants[id]));
    put(d4, id, rollD4(ctx.rng));
  }

  let seq = 0;
  const lanes = laneIds.map((id) => {
    const queue = get(queueSnapshots, id, []);
    const cards = Array.isArray(queue) ? queue : [];
    return cards.map((c, cardIndex) => {
      const preemptive = DEFENSIVE_KINDS.includes(c.kind);
      const parts = planParts({ combatant: combatants[id], id, card: c, preemptive, momentum, foeId: c.target });
      const initiative = parts.base + d4[id] + parts.momentum;
      return {
        seq: (seq += 1) - 1,
        actor: id,
        side: combatants[id].side,
        cardIndex,
        cardId: c.id,
        target: c.target,
        preemptive,
        card: { ...c, sp: cardSp(c) },
        speed: {
          card: parts.card,
          buff: parts.buff,
          base: parts.base,
          d4: d4[id],
          momentum: parts.momentum,
          initiative,
          total: parts.known + d4[id],
          effective: parts.known + d4[id],
        },
      };
    });
  });

  // Lead initiative: the first card's initiative, or base + d4 for an empty queue.
  const lead = {};
  laneIds.forEach((id, i) => {
    put(lead, id, lanes[i][0] ? lanes[i][0].speed.initiative : base[id] + d4[id]);
  });
  const initiative = {};
  laneIds.forEach((id) => {
    put(initiative, id, { base: base[id], d4: d4[id], lead: lead[id] });
  });
  // Combatant order: higher lead initiative first, then player first, then lane order.
  const laneOrder = laneIds.map((_, i) => i);
  const byLead = (i, j) => (lead[laneIds[j]] - lead[laneIds[i]])
    || ((laneIds[i] === 'player' ? 0 : 1) - (laneIds[j] === 'player' ? 0 : 1))
    || (i - j);

  let entries;
  if (merge === 'wholeQueue') {
    const order = [...laneOrder].sort(byLead);
    entries = order.flatMap((i) => lanes[i]);
  } else if (merge === 'roundRobin') {
    entries = [];
    const longest = Math.max(0, ...lanes.map((l) => l.length));
    for (let k = 0; k < longest; k += 1) {
      // Within a pass, card speed breaks a tie in lead initiative.
      const pass = laneOrder
        .filter((i) => lanes[i].length > k)
        .map((i) => ({ i, entry: lanes[i][k] }))
        .sort((a, b) => (lead[laneIds[b.i]] - lead[laneIds[a.i]])
          || ((b.entry.speed.card + b.entry.speed.buff) - (a.entry.speed.card + a.entry.speed.buff))
          || (a.i - b.i));
      entries.push(...pass.map((p) => p.entry));
    }
  } else {
    // Speed: a k-way merge over the queue heads. Each queue's effective speeds never
    // rise, so taking the best head keeps every queue in its own order.
    for (const lane of lanes) {
      const capped = capQueue(lane.map((e) => e.speed.total));
      lane.forEach((e, i) => {
        e.speed.effective = capped[i];
      });
    }
    const heads = lanes.map(() => 0);
    entries = [];
    for (;;) {
      let best = -1;
      for (let i = 0; i < lanes.length; i += 1) {
        if (heads[i] >= lanes[i].length) continue;
        if (best === -1) {
          best = i;
          continue;
        }
        const a = lanes[i][heads[i]].speed;
        const b = lanes[best][heads[best]].speed;
        const sideA = lanes[i][heads[i]].side === 'player' ? 0 : 1;
        const sideB = lanes[best][heads[best]].side === 'player' ? 0 : 1;
        if (a.effective !== b.effective) {
          if (a.effective > b.effective) best = i;
        } else if (a.initiative !== b.initiative) {
          if (a.initiative > b.initiative) best = i;
        } else if (sideA !== sideB) {
          if (sideA < sideB) best = i;
        }
      }
      if (best === -1) break;
      entries.push(lanes[best][heads[best]]);
      heads[best] += 1;
    }
  }

  return { merge, initiative, entries };
}

// A fight state: { combatants, momentum, poiseDouble, charges }. `specs` is a list of
// makeCombatant() specs. Momentum starts at 0 for each enemy. Charges start at each
// combatant's intangibleCharges.
export function makeFight(specs, tables = {}) {
  if (!Array.isArray(specs)) throw new TypeError('specs must be an array of combatant specs');
  const combatants = {};
  for (const spec of specs) {
    const c = makeCombatant(spec, tables);
    if (Object.hasOwn(combatants, c.id)) throw new TypeError(`duplicate combatant "${c.id}"`);
    put(combatants, c.id, c);
  }
  if (!Object.hasOwn(combatants, 'player')) throw new TypeError('a fight needs a "player" combatant');
  const charges = {};
  for (const c of Object.values(combatants)) put(charges, c.id, c.intangibleCharges);
  return { combatants, momentum: {}, poiseDouble: {}, charges };
}

// Damage through the target's active block (owner, 2026-10-11): the block absorbs
// up to its amount, the rest reduces hp. A block is spent as it absorbs.
// Emits one 'damage' event. Reaching 0 hp emits 'defeated' once.
function applyDamage(cur, targetId, raw, events) {
  const t = cur.combatants[targetId];
  const pool = cur.active[targetId].guard;
  const absorbed = Math.min(pool, raw);
  const amount = raw - absorbed;
  cur.active[targetId].guard = pool - absorbed;
  // The block cards are spent first-in, first-out, so each keeps its own block left.
  let rest = absorbed;
  for (const g of cur.active[targetId].guardCards) {
    const take = Math.min(g.left, rest);
    g.left -= take;
    rest -= take;
    if (rest === 0) break;
  }
  const wasAlive = t.hp > 0;
  t.hp = Math.max(0, t.hp - amount);
  events.push({ type: 'damage', target: targetId, amount, absorbed, hp: t.hp });
  if (wasAlive && t.hp === 0) events.push({ type: 'defeated', id: targetId });
}

// One attack (owner, 2026-10-11): hit roll, then full block, then intangible or the
// evadePct roll, then damage. Returns nothing; pushes events and updates cur.
function resolveAttack(cur, entry, events, rng, options, reactionEvade = null, reactionPlayed = false) {
  const attacker = cur.combatants[entry.actor];
  const target = cur.combatants[entry.target];
  const card = entry.card;
  // Non-finite damage counts as 0, so a saved round (JSON turns Infinity into null) resolves the same.
  const rawDmg = Number(card.damage ?? 0);
  const dmg = Number.isFinite(rawDmg) ? Math.max(0, rawDmg) : 0;
  // An evade card is spent on the next attack, whether or not that attack hits. A reaction
  // evade belongs to this attack and is used first; queued evades wait for later attacks. When any
  // reaction answers this attack, a queued evade is not spent on it (Codex review on PR #1838).
  const evadeUse = reactionPlayed ? reactionEvade : (cur.active[target.id].evade.shift() ?? null);
  const d20 = rollD20(rng);
  const accuracy = accuracyFor({ attrs: attacker.attrs, level: attacker.level, tags: card.tags, accuracy: card.accuracy })
    + attacker.accuracyExtra;
  // The evade card spent on this attack adds its evasion-cards.csv bonus to the hit roll (owner, 2026-10-11).
  // Under liveDefence (SPEC §4.11) the live dodgeRoll decides the dodge, so the timeline's table bonus is not added.
  const tableEvasion = cur.liveDefence ? 0 : (evadeUse?.evasion ?? 0);
  const { hit, need } = hitRoll({ accuracy, evasion: target.evasion + tableEvasion }, d20);

  // A full block: the block covers the whole hit (block >= damage, damage > 0).
  const blocked = hit && dmg > 0 && cur.active[target.id].guard >= dmg;
  // The guard card that holds block is the defending card for a full block (owner, DESIGN.md).
  const blocker = blocked ? (cur.active[target.id].guardCards.find((g) => g.left > 0) ?? null) : null;

  // Avoid (owner, 2026-10-11): an intangible charge avoids a hit outright and is spent
  // only then. Otherwise the target rolls its evadePct. Only a hit that would land is rolled.
  let avoid = null;
  if (hit && !blocked) {
    if (target.tags.includes('intangible') && cur.charges[target.id] > 0) {
      avoid = 'intangible';
      cur.charges[target.id] -= 1;
    } else if (!cur.liveDefence) {
      const stancePct = target.stance && options.evadeTable ? (options.evadeTable.get(target.stance) ?? 0) : 0;
      const bonuses = [];
      if (stancePct) bonuses.push({ source: `stance:${target.stance}`, pct: stancePct, scope: 'exchange' });
      if (evadeUse) bonuses.push({ source: `card:${evadeUse.cardId}`, pct: evadeUse.pct, scope: 'exchange' });
      const evadePct = evadePctFor({ evadeBasePct: target.evadeBasePct, evadeBonuses: bonuses }, { inExchange: true });
      if (evadePct > 0) {
        const roll = Math.floor(rollUnit(rng) * 100);
        const success = roll < evadePct;
        events.push({ type: 'evadeRoll', by: target.id, target: attacker.id, evadePct, roll, success });
        if (success) avoid = 'evasion';
      }
    }
  }

  const landed = hit && !blocked && avoid === null;
  // A landed hit through a partial block (owner, Codex review on PR #1838): the first guard card
  // that still holds block is the defending card. Captured here, before applyDamage spends it.
  const partialGuard = landed && dmg > 0 && cur.active[target.id].guard > 0
    ? (cur.active[target.id].guardCards.find((g) => g.left > 0) ?? null) : null;
  const armed = landed && cur.poiseDouble[attacker.id] === true;
  events.push({
    type: 'hit',
    by: attacker.id,
    target: target.id,
    d20,
    hit,
    need,
    blocked,
    avoided: avoid !== null,
    ...(armed ? { poiseMultiplier: 2 } : {}),
  });
  if (armed) cur.poiseDouble[attacker.id] = false;

  if (blocked) {
    events.push({ type: 'absorbed', by: target.id, target: attacker.id, amount: dmg });
    applyDamage(cur, target.id, dmg, events);
  } else if (avoid === 'intangible') {
    events.push({ type: 'evaded', by: target.id, target: attacker.id, reason: 'intangible', charges: cur.charges[target.id] });
  } else if (avoid === 'evasion') {
    events.push({ type: 'evaded', by: target.id, target: attacker.id, reason: 'evasion' });
  } else if (landed) {
    applyDamage(cur, target.id, dmg, events);
  }
  // The defender's card that was spent on this attack, for momentum gain and stance. Precedence:
  // a full block's guard card, then an evade card spent on this attack, then the first guard card
  // that absorbed part of a landed hit.
  const defenseCard = blocker ? { momentumGain: blocker.momentumGain, stance: blocker.stance }
    : evadeUse ? { momentumGain: evadeUse.gain, stance: evadeUse.stance }
    : partialGuard ? { momentumGain: partialGuard.momentumGain, stance: partialGuard.stance } : null;
  return { landed, defenseCard };
}

// Momentum gain of a card: its momentumGain, default 1 (as in resolver.mjs).
function gainOf(card) {
  return assertMomentumGain(card);
}

// Credits one side's success in an exchange (owner, 2026-10-11; DESIGN.md, Momentum).
// A side wins an exchange at most once. The gain is the winner's card gain plus the
// stance bonus against the other side's card. The enemy key is the enemy in the exchange.
function credit(cur, run, { key, winner, winCard, foeCard, events, seq, credited }) {
  if (credited.includes(winner)) return;
  credited.push(winner);
  const gain = gainOf(winCard);
  const bonus = stanceBonus(run.stanceTable, winCard?.stance ?? null, foeCard?.stance ?? null);
  const delta = (winner === 'player' ? 1 : -1) * (gain + bonus);
  put(run.pending, key, get(run.pending, key, 0) + delta);
  events.push({ type: 'momentum', reason: 'success', enemyId: key, by: winner, gain, bonus, delta, seq });
}

// The same credit for a caller outside a round (normalPreview.js, SPEC §4.11 normal-combat momentum). `run` is
// { pending, stanceTable }: the summed deltas are written to run.pending, exactly as a round writes them.
export function creditExchange(run, args) {
  credit(null, run, args);
}

// A counter with the 'stagger' tag adds +-3 to its side's summed delta (owner, 2026-10-11).
// A staggered target with 'hyperArmor' resists (as in resolver.mjs): no +-3, and a 'resisted'
// event instead. The target is the attacker the counter answers.
function stagger(run, { key, owner, target, cur, events, seq }) {
  if (cur.combatants[target].tags.includes('hyperArmor')) {
    events.push({ type: 'resisted', status: 'stagger', target, seq });
    return;
  }
  const sign = cur.combatants[owner].side === 'player' ? 1 : -1;
  const delta = sign * MOMENTUM_MAX;
  put(run.pending, key, get(run.pending, key, 0) + delta);
  events.push({ type: 'momentum', reason: 'counterStagger', enemyId: key, by: cur.combatants[owner].side, delta, seq });
}

// The key that tracks one copy of a card (owner, Codex finding on PR #1867): its instanceId when it
// has one, else its id. Two copies of one definition share an id, so queued and used cards are keyed
// by this, and a card without an instanceId keys exactly as before.
export function cardKey(card) {
  return card?.instanceId ?? card?.id;
}

// A card key is persisted in paused rounds and used to select one reaction copy. JSON must keep
// that key unchanged: non-finite numbers become null and -0 becomes 0, while empty or non-scalar
// keys cannot name a card reliably. Queued cards always have an id; reaction-only hand cards may
// instead use a valid instanceId.
export function assertCardKey(card) {
  const instance = card?.instanceId;
  if (instance !== undefined && instance !== null
    && !((typeof instance === 'string' && instance.length > 0)
      || (typeof instance === 'number' && Number.isFinite(instance) && !Object.is(instance, -0)))) {
    throw new TypeError('card instanceId must be a non-empty string or finite number other than -0');
  }
  const key = cardKey(card);
  if (!((typeof key === 'string' && key.length > 0)
    || (typeof key === 'number' && Number.isFinite(key) && !Object.is(key, -0)))) {
    throw new TypeError('a reaction card needs a non-empty string or finite numeric identifier');
  }
  return key;
}

// The player's reaction offer for one attack (owner, 2026-10-11): when an attack targets a player,
// the player may play an unplayed defensive card from hand, if SP is left. Enemies never react.
// Returns { attack, eligible } when there is a card to offer, else null. It changes nothing, so a
// caller may stop here, ask the player, and resume later.
export function reactionOffer(cur, entry, run) {
  const defender = cur.combatants[entry.target];
  if (defender.side !== 'player') return null;
  const id = defender.id;
  const usedIds = get(cur.used, id, []);
  const queued = get(run.queuedIds, id, []);
  const foes = foesOf(cur.combatants, id);
  const eligible = defender.hand.filter((c) => DEFENSIVE_KINDS.includes(c.kind)
    && targetOk(c, foes)
    && !queued.includes(cardKey(c))
    && !usedIds.includes(cardKey(c))
    && cardSp(c) <= cur.spLeft[id]
    && (c.kind !== 'counter' || c.target === 'self' || c.target === entry.actor));
  if (eligible.length === 0) return null;
  const rawDamage = Number(entry.card.damage ?? 0);
  const attack = {
    seq: entry.seq,
    attacker: entry.actor,
    target: id,
    cardId: entry.cardId,
    damage: Number.isFinite(rawDamage) ? Math.max(0, rawDamage) : 0,
    speed: entry.speed.total,
  };
  return { attack, eligible };
}

// The eligible card a pick names (owner, 2026-10-11). A null or undefined pick plays nothing.
// A pick that is not eligible throws a TypeError.
export function chooseReaction(eligible, pick) {
  if (pick === null || pick === undefined) return null;
  const key = cardKey(pick);
  const chosen = eligible.find((c) => cardKey(c) === key);
  if (!chosen) throw new TypeError(`onReaction returned a card that is not eligible: ${key}`);
  return chosen;
}

// Spends a chosen reaction card and places it with base values (no buff). A reaction evade or
// counter is bound to this attack: its record is returned, never left active. A reaction counter
// fires on this attack after it resolves and never cancels it (placeholder). Queued defences wait.
function playReaction(cur, entry, events, chosen) {
  const id = entry.target;
  const usedIds = get(cur.used, id, []);
  cur.spLeft[id] -= cardSp(chosen);
  put(cur.used, id, [...usedIds, cardKey(chosen)]);
  // instanceId names the copy played; a card without one keeps the event it always had.
  const copy = chosen.instanceId ?? null;
  events.push({ type: 'reaction', by: id, cardId: chosen.id, kind: chosen.kind, against: entry.actor, seq: entry.seq, sp: cardSp(chosen), ...(copy === null ? {} : { instanceId: copy }) });
  const record = placeDefence(cur, id, chosen, { preemptive: false, foe: entry.actor, events, reaction: true });
  return {
    evade: chosen.kind === 'evade' ? record : null,
    counter: chosen.kind === 'counter' ? record : null,
    guard: chosen.kind === 'guard' ? record : null,
  };
}

// Makes a defensive card active for its owner (owner, 2026-10-11). A preemptive card
// gets REACTION_BUFF on top of its base values. A reaction uses base values only.
// Returns the defence record of a reaction evade or counter (not made active: it belongs to
// one attack). Returns null for a guard or a queued card, which are made active here.
function placeDefence(cur, owner, card, { preemptive, foe, events, reaction, speed = null }) {
  const buff = (key) => (preemptive ? REACTION_BUFF[key] : 0);
  const act = cur.active[owner];
  if (card.kind === 'guard') {
    const block = (defenceNumber(card, 'block') ?? DEFENSE_BASE.block) + buff('block');
    const record = { cardId: card.id, momentumGain: card.momentumGain, stance: card.stance ?? null, left: block };
    events.push({ type: 'guardUp', by: owner, cardId: card.id, block, buffed: preemptive });
    // A reaction guard belongs to one attack: it is returned, not added to the round's pool.
    if (reaction) return record;
    act.guard += block;
    act.guardCards.push(record);
  } else if (card.kind === 'evade') {
    // A table card (owner, 2026-10-11) gives its Evasion instead of the 20% default: its percent
    // is only the card's own evadePct (plus the buff), and 0 when it has none.
    const tableBonus = evadeCardBonus(cur.combatants[owner], card);
    const explicit = defenceNumber(card, 'evadePct');
    const pct = tableBonus === null
      ? (explicit ?? DEFENSE_BASE.evadePct) + buff('evadePct')
      : (explicit === undefined ? 0 : explicit + buff('evadePct'));
    const evasion = tableBonus ?? 0;
    const record = { cardId: card.id, pct, evasion, gain: card.momentumGain, stance: card.stance ?? null };
    events.push({ type: 'evadeUp', by: owner, cardId: card.id, pct, evasion, buffed: preemptive });
    if (reaction) return record;
    act.evade.push(record);
  } else if (card.kind === 'counter') {
    const damage = (defenceNumber(card, 'counterDamage') ?? DEFENSE_BASE.counterDamage) + buff('counterDamage');
    const target = card.target === 'self' ? null : (foe ?? card.target);
    const record = {
      cardId: card.id,
      owner,
      foe: target,
      speed,
      damage,
      stagger: Array.isArray(card.tags) && card.tags.includes('stagger'),
      gain: card.momentumGain,
      stance: card.stance ?? null,
      reaction,
    };
    events.push({ type: 'counterUp', by: owner, cardId: card.id, foe: target, damage, buffed: preemptive });
    if (reaction) return record;
    act.counters.push(record);
  }
  return null;
}

// Takes the first active counter that fires on this attack, or null (owner, 2026-10-11):
// a counter fires on the next attack from its chosen foe, or any foe when it is 'self'.
function takeCounter(cur, defenderId, attackerId) {
  const list = cur.active[defenderId].counters;
  const i = list.findIndex((c) => c.foe === null || c.foe === attackerId);
  return i < 0 ? null : list.splice(i, 1)[0];
}

// One attack after its reaction offer (owner, 2026-10-11): a queued or reaction counter may
// cancel it or fire on it, and the attack resolves. `reacted` is the reaction offer.
function resolveExchange(cur, entry, events, options, run, reacted) {
  // A reaction card that was played answers this attack, and a queued counter waits for a later
  // attack (owner, DESIGN.md). Only when no reaction was played does the first queued counter fire.
  const reactionPlayed = Boolean(reacted.evade || reacted.counter || reacted.guard);
  const counter = reactionPlayed ? reacted.counter : takeCounter(cur, entry.target, entry.actor);
  // A counter fires or cancels only while its owner is alive (owner, 2026-10-11).
  const ownerAlive = () => Boolean(counter) && cur.combatants[counter.owner].hp > 0;
  // The enemy in this exchange: the attacker, or the defender when the player attacks.
  const key = entry.side === 'enemy' ? entry.actor : entry.target;
  const attackCard = { momentumGain: entry.card.momentumGain, stance: entry.card.stance ?? null };
  const counterCard = counter ? { momentumGain: counter.gain, stance: counter.stance } : null;
  const credited = [];
  const sideOf = (id) => cur.combatants[id].side;
  // liveDefence (SPEC §4.11): the Counter's cancel and its damage are the live rules, applied by combat.js.
  if (!cur.liveDefence && ownerAlive() && !counter.reaction && counter.speed > entry.speed.effective) {
    // A faster counter cancels the attack. A tie or a slower counter does not.
    events.push({ type: 'countered', by: counter.owner, target: entry.actor, cardId: counter.cardId, cancelled: true });
    applyDamage(cur, entry.actor, counter.damage, events);
    credit(cur, run, { key, winner: sideOf(counter.owner), winCard: counterCard, foeCard: attackCard, events, seq: entry.seq, credited });
    if (counter.stagger) stagger(run, { key, owner: counter.owner, target: entry.actor, cur, events, seq: entry.seq });
    return;
  }
  const out = resolveAttack(cur, entry, events, options.rng, options, reacted.evade, reactionPlayed);
  if (out.landed) {
    credit(cur, run, { key, winner: entry.side, winCard: attackCard, foeCard: out.defenseCard ?? {}, events, seq: entry.seq, credited });
  } else {
    // When the attack does not land and the defender's counter fires on it, the defender's one
    // credit uses the counter card (owner, 2026-10-11). The credit is decided here, before the
    // counter below, so the side is credited once.
    const defenderCard = ownerAlive() ? counterCard : (out.defenseCard ?? {});
    credit(cur, run, { key, winner: sideOf(entry.target), winCard: defenderCard, foeCard: attackCard, events, seq: entry.seq, credited });
  }
  if (ownerAlive()) {
    events.push({ type: 'counterFired', by: counter.owner, target: entry.actor, cardId: counter.cardId, after: true });
    if (!cur.liveDefence) applyDamage(cur, entry.actor, counter.damage, events);
    credit(cur, run, { key, winner: sideOf(counter.owner), winCard: counterCard, foeCard: attackCard, events, seq: entry.seq, credited });
    if (counter.stagger) stagger(run, { key, owner: counter.owner, target: entry.actor, cur, events, seq: entry.seq });
  }
}

// A reaction guard's block joins its target's pool for the one attack it was played against
// (owner, Codex review 2026-10-11). The reaction is used first (owner, 2026-10-11): its record
// goes to the front of guardCards, so applyDamage spends it before any queued block. Returns
// the record it was given.
function joinReactionGuard(cur, targetId, record) {
  const act = cur.active[targetId];
  act.guard += record.left;
  act.guardCards.unshift(record);
  return record;
}

// Discards what is left of a reaction guard's block once its attack is over, so a later attack
// cannot consume it. A cancelled attack leaves its whole block to be discarded here.
function discardReactionGuard(cur, targetId, record, events) {
  const act = cur.active[targetId];
  const i = act.guardCards.indexOf(record);
  if (i < 0) return;
  act.guardCards.splice(i, 1);
  act.guard -= record.left;
  if (record.left > 0) events.push({ type: 'guardDiscard', by: targetId, cardId: record.cardId, amount: record.left });
  record.left = 0;
}

// Emits the action event of one timeline entry, or its skip. A defensive card is placed here.
// Returns 'skipped', 'attack' (the attack still needs its reaction and its resolution), or 'done'.
export function enterEntry(cur, entry, events) {
  const actor = cur.combatants[entry.actor];
  const base = { seq: entry.seq, actor: entry.actor, cardId: entry.cardId };
  if (actor.hp <= 0) {
    events.push({ type: 'skipped', reason: 'defeated', ...base });
    return 'skipped';
  }
  if (entry.target !== 'self' && cur.combatants[entry.target].hp <= 0) {
    events.push({ type: 'skipped', reason: 'targetDefeated', ...base, target: entry.target });
    return 'skipped';
  }
  events.push({ type: 'action', ...base, kind: entry.card.kind, target: entry.target, speed: entry.speed.total });
  const kind = entry.card.kind;
  if (kind === 'attack') return 'attack';
  if (kind === 'guard' || kind === 'evade' || kind === 'counter') {
    // A queued defensive card is preemptive: it becomes active for its owner now.
    placeDefence(cur, entry.actor, entry.card, {
      preemptive: true,
      foe: null,
      events,
      reaction: false,
      speed: entry.speed.effective,
    });
  }
  return 'done';
}

// One attack after its reaction is settled (owner, 2026-10-11). `chosen` is the reaction card
// played against it, or null. The attack resolves exactly as it does with no reaction.
export function resolveAttackEntry(cur, entry, events, options, run, chosen) {
  const reacted = chosen ? playReaction(cur, entry, events, chosen) : { evade: null, counter: null, guard: null };
  // A reaction guard's block joins its target's pool for the one attack it was played against.
  const reactionGuard = reacted.guard ? joinReactionGuard(cur, entry.target, reacted.guard) : null;
  resolveExchange(cur, entry, events, options, run, reacted);
  if (reactionGuard) discardReactionGuard(cur, entry.target, reactionGuard, events);
}

// Resolves one timeline entry into `events`, updating `cur` in place. An attack asks the
// player's onReaction (when given) before it resolves.
function applyEntry(cur, entry, events, options, run) {
  if (enterEntry(cur, entry, events) !== 'attack') return;
  const offer = typeof options.onReaction === 'function' ? reactionOffer(cur, entry, run) : null;
  let chosen = null;
  if (offer) {
    const pick = options.onReaction(structuredClone(offer.attack), structuredClone(offer.eligible));
    chosen = chooseReaction(offer.eligible, pick);
  }
  resolveAttackEntry(cur, entry, events, options, run, chosen);
}

// Enemy momentum decay at round start (owner, 2026-10-11): each enemy's M moves
// toward 0 by `step`. Returns the decayed M and the 'decay' events.
function decayAll(cur, combatants, step, events) {
  for (const id of Object.keys(combatants)) {
    if (combatants[id].side !== 'enemy') continue;
    const from = clampMomentum(get(cur.momentum, id, 0));
    const to = decayMomentum(from, step);
    if (to !== from) events.push({ type: 'momentum', reason: 'decay', enemyId: id, from, to, delta: to - from, by: null });
    put(cur.momentum, id, to);
  }
}

// Sets up one round from a fight state (owner, 2026-10-11). Shared by createRound() and the JSON
// round in round.js, so both start from the same numbers and draw the rng in the same order.
// Returns { cur, timeline, startEvents, run }: `cur` is the working fight state, `timeline` holds
// the ordered entries, `startEvents` are the decay events, and `run` is the round-scoped data:
// queuedIds { [combatantId]: [cardKey] }, pending { [enemyId]: momentum delta }, stanceTable.
// Checks every option a round reads, before any rng draw (Codex finding on PR #1867). The caller's
// rng is not rolled back by atomically(), so a throw after a draw would leave it advanced. A bad
// option therefore throws here, first. evadeTable and stanceAdvantage are read with .get(), so the
// check is a get() function (a Map, or any object with a get method). Throws TypeError.
export function assertRoundOptions(options = {}) {
  const { rng, evadeTable, stanceAdvantage, onReaction } = options;
  if (typeof rng !== 'function') throw new TypeError('rng must be a function returning [0, 1)');
  const hasGet = (t) => t !== null && typeof t === 'object' && typeof t.get === 'function';
  if (evadeTable !== undefined && evadeTable !== null && !hasGet(evadeTable)) {
    throw new TypeError('evadeTable must be a Map (or an object with a get method) of stance to evade pct');
  }
  if (stanceAdvantage !== undefined && stanceAdvantage !== null && !hasGet(stanceAdvantage)) {
    throw new TypeError('stanceAdvantage must be a Map (or an object with a get method) from parseStanceAdvantage()');
  }
  if (onReaction !== undefined && onReaction !== null && typeof onReaction !== 'function') {
    throw new TypeError('onReaction must be a function');
  }
}

export function beginRound(state, options = {}) {
  assertRoundOptions(options);
  if (!state || typeof state !== 'object' || !state.combatants) throw new TypeError('state must come from makeFight()');
  const cur = structuredClone(state);
  cur.momentum = { ...(cur.momentum ?? {}) };
  cur.poiseDouble = { ...(cur.poiseDouble ?? {}) };
  cur.charges = { ...(cur.charges ?? {}) };
  // SPEC §4.11: the preview's defences are live. The flag is stored only when set, so a plain round is unchanged.
  if (options.liveDefence === true) cur.liveDefence = true;
  // Every combatant has a poise flag, false unless an overflow set it.
  for (const id of Object.keys(cur.combatants)) put(cur.poiseDouble, id, get(cur.poiseDouble, id) === true);
  // Round-scoped effects (block, evade, counters) start empty each round.
  cur.active = {};
  for (const c of Object.values(cur.combatants)) {
    if (!Object.hasOwn(cur.charges, c.id)) put(cur.charges, c.id, c.intangibleCharges);
    put(cur.active, c.id, { guard: 0, guardCards: [], evade: [], counters: [] });
  }
  const startEvents = [];
  const step = options.decay === undefined ? 1 : Number(options.decay);
  if (!Number.isFinite(step) || step < 0) throw new TypeError('options.decay must be a finite number of 0 or more');
  decayAll(cur, cur.combatants, step, startEvents);

  const timeline = buildTimeline(options.queues ?? {}, {
    combatants: cur.combatants,
    momentum: cur.momentum,
    rng: options.rng,
    merge: options.merge ?? 'speed',
  });
  const spent = {};
  for (const id of Object.keys(cur.combatants)) put(spent, id, 0);
  for (const e of timeline.entries) spent[e.actor] += e.card.sp;
  cur.spLeft = {};
  for (const id of Object.keys(cur.combatants)) put(cur.spLeft, id, cur.combatants[id].sp - spent[id]);

  // Round-scoped: reactions played (by card key) and each combatant's queued card keys.
  cur.used = {};
  const queuedIds = {};
  for (const e of timeline.entries) {
    const list = get(queuedIds, e.actor, []);
    if (!list.includes(cardKey(e.card))) put(queuedIds, e.actor, [...list, cardKey(e.card)]);
  }
  const run = { queuedIds, pending: {}, stanceTable: options.stanceAdvantage ?? null };
  return { cur, timeline, startEvents, run };
}

// Round end (owner, 2026-10-11): each enemy's summed delta (`pending`) is added to its start M
// once, then clamped. A raw total past the cap sets that side's poiseDouble flag. Then the
// round-scoped effects are cleared.
export function settleRound(cur, pending, events) {
  for (const k of Object.keys(cur.combatants)) {
    if (cur.combatants[k].side !== 'enemy') continue;
    const from = get(cur.momentum, k, 0);
    const raw = from + get(pending, k, 0);
    const to = clampMomentum(raw);
    put(cur.momentum, k, to);
    if (to !== from) events.push({ type: 'momentumApplied', enemyId: k, from, delta: to - from, to });
    if (raw > MOMENTUM_MAX) {
      events.push({ type: 'momentum', reason: 'overflow', enemyId: k, side: 'player', delta: 0, by: null });
      put(cur.poiseDouble, 'player', true);
    }
    if (raw < MOMENTUM_MIN) {
      events.push({ type: 'momentum', reason: 'overflow', enemyId: k, side: 'enemy', delta: 0, by: null });
      put(cur.poiseDouble, k, true);
    }
  }
  events.push({ type: 'roundEnd' });
  for (const id of Object.keys(cur.active)) cur.active[id] = { guard: 0, guardCards: [], evade: [], counters: [] };
}

// Runs fn, and if it throws puts `target` back exactly as it was. `target` is plain data or holds
// plain data and Maps (a fight state from makeFight()); structuredClone keeps both. Shared by
// createRound() here and by the JSON round in round.js, so a throw never leaves a half-stepped round.
// NOTE: this restores the round only. The caller's rng is a function and is NOT rolled back: a draw
// made before a throw stays drawn, so a retry rolls differently. That is why every hook a round reads
// is validated (assertRoundOptions, and callContext in round.js) before the first draw.
export function atomically(target, fn) {
  const saved = structuredClone(target);
  try {
    return fn();
  } catch (err) {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, saved);
    throw err;
  }
}

// Starts one round and returns a step-able resolver (owner, 2026-10-11).
//
// state:   from makeFight(); not changed. The round works on a copy.
// options: { queues, rng, merge?, decay? (default 1), evadeTable?, stanceAdvantage?, onReaction? }
//          queues: { [combatantId]: [card] } (see buildTimeline).
// Returns { timeline, next(), resolveAll(), state }:
//   next()        resolves the next timeline entry: { entry, events, state, done }.
//                 `state` is a copy of the state after that action. `done` is true
//                 once the last entry has resolved (the round then ends).
//   resolveAll()  calls next() to the end: { events, state, timeline }.
//   state         a copy of the state now.
// Round start: enemy momentum decays (decay events come with the first next()).
// A throw (onReaction throwing, or returning a card that is not eligible) leaves the round exactly
// as it was before the call: the cursor, the pending start events and the state. The retry then
// resolves the same entry. resolveAll() is atomic as a whole the same way.
export function createRound(state, options = {}) {
  const started = beginRound(state, options);
  const entries = started.timeline.entries;
  // All the mutable round state lives in one frame, so atomically() can put it all back.
  // Keep the resolution RNG cursor there too. The caller's injected RNG cannot generally be
  // rewound, so values already drawn by a failed transaction stay in this private replay buffer;
  // restoring rngIndex makes the retry consume those exact values before drawing anything new.
  const frame = {
    cur: started.cur,
    run: started.run,
    idx: 0,
    settled: false,
    pendingEvents: started.startEvents,
    rngIndex: 0,
  };
  const rngValues = [];
  const replayableRng = () => {
    const index = frame.rngIndex;
    const value = index < rngValues.length ? rngValues[index] : options.rng();
    if (index === rngValues.length) rngValues.push(value);
    frame.rngIndex += 1;
    return value;
  };
  const resolutionOptions = { ...options, rng: replayableRng };
  const snapshot = () => structuredClone(frame.cur);
  const timelineSnapshot = () => structuredClone(started.timeline);

  const next = () => atomically(frame, () => {
    const events = frame.pendingEvents;
    frame.pendingEvents = [];
    if (frame.settled) return { entry: null, events, state: snapshot(), done: true };
    let entry = null;
    if (frame.idx < entries.length) {
      entry = entries[frame.idx];
      applyEntry(frame.cur, entry, events, resolutionOptions, frame.run);
      // The cursor moves only once this entry has resolved, so a throw leaves it on this entry.
      frame.idx += 1;
    }
    if (frame.idx >= entries.length) {
      frame.settled = true;
      settleRound(frame.cur, frame.run.pending, events);
    }
    return { entry: entry ? structuredClone(entry) : null, events, state: snapshot(), done: frame.settled };
  });

  return {
    timeline: timelineSnapshot(),
    next,
    resolveAll() {
      return atomically(frame, () => {
        const events = [];
        let r;
        do {
          r = next();
          events.push(...r.events);
        } while (!r.done);
        return { events, state: r.state, timeline: timelineSnapshot() };
      });
    },
    get state() {
      return snapshot();
    },
  };
}

// Enemy adaptation (owner, 2026-10-11; DESIGN.md, Timeline model). PLACEHOLDERS.
// Chance per WIS point is 15%, clamped to 0..60%. Only the third queued action
// (index 2) can change. A change swaps it for a counter at the player, and only when
// the player's queue attacks that enemy. Otherwise the action is kept.

// Chance (0..1) that an enemy with `wis` changes its third action. A wis of 0 or less never changes.
export function adaptChance(wis) {
  const w = Number(wis);
  if (!Number.isFinite(w) || w <= 0) return 0;
  return Math.min(ADAPT_PERCENT_MAX, w * ADAPT_PERCENT_PER_WIS) / 100;
}

// Lets each enemy maybe change its third queued action, after the player has committed
// (owner, 2026-10-11). `queues` is the round's queues, `playerQueue` the player's cards,
// `rng` the injected rng, and options.wis is { [enemyId]: wis } (default 0 each).
// Returns { queues, changed }: new queues (the input is not changed) and the ids of
// the enemies whose action changed, for a UI to reveal.
export function adaptEnemyQueues(queues, playerQueue, rng, options = {}) {
  if (!queues || typeof queues !== 'object' || Array.isArray(queues)) throw new TypeError('queues must be an object');
  if (playerQueue !== undefined && !Array.isArray(playerQueue)) throw new TypeError('playerQueue must be an array');
  const wis = options.wis ?? {};
  const out = {};
  const changed = [];
  for (const id of Object.keys(queues)) {
    const q = Array.isArray(queues[id]) ? queues[id].map((c) => ({ ...c })) : [];
    put(out, id, q);
    if (id === 'player') continue;
    const chance = adaptChance(get(wis, id, 0));
    if (chance <= 0 || q.length <= ADAPT_INDEX) continue;
    // An enemy the player does not attack draws no rng, so it cannot shift another enemy's roll.
    const attacked = (playerQueue ?? []).some((c) => c && c.kind === 'attack' && c.target === id);
    if (!attacked) continue;
    const roll = rollUnit(rng);
    if (!(roll < chance)) continue;
    const old = q[ADAPT_INDEX];
    q[ADAPT_INDEX] = {
      id: `${old.id}:counter`,
      kind: 'counter',
      target: 'player',
      speed: Number(old.speed ?? 0),
      sp: cardSp(old),
      counterDamage: ADAPT_COUNTER_DAMAGE,
      tags: [],
      replaces: old.id,
    };
    changed.push(id);
  }
  return { queues: out, changed };
}
