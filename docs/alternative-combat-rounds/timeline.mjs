// alternative-combat-rounds: timeline model (owner, 2026-10-11). Prototype only.
//
// Every combatant (the player and each enemy) builds a queue of cards each round.
// Cards cost SP. buildTimeline() orders all queued actions under one of three merge
// modes; createRound() resolves them one at a time. Reuses resolver.mjs primitives.
// Not wired into src/. No DOM, no Math.random: randomness is injected as `rng`, a
// function returning a float in [0, 1). Design: DESIGN.md, "Timeline model".

import {
  evasionFor,
  momentumSpeed,
  rollUnit,
} from './resolver.mjs';

export const MERGE_MODES = Object.freeze(['speed', 'roundRobin', 'wholeQueue']);
export const CARD_KINDS = Object.freeze(['attack', 'guard', 'evade', 'counter', 'other']);
export const DEFENSIVE_KINDS = Object.freeze(['guard', 'evade', 'counter']);

// PLACEHOLDER: every SP cost is 3 for testing, unless a card gives its own `cost`.
export const CARD_SP_COST = 3;
// PLACEHOLDER: SP budget per combatant per round when a spec gives none.
export const DEFAULT_SP = 6;

// PLACEHOLDER: a queued (preemptive) defensive card gets this buff. Reactions use base values.
export const REACTION_BUFF = Object.freeze({ speed: 1, block: 2, evadePct: 10, counterDamage: 1 });
// PLACEHOLDER: base values of the defensive cards, before any buff.
export const DEFENSE_BASE = Object.freeze({ block: 6, evadePct: 20, counterDamage: 2 });

const SIDES = Object.freeze(['player', 'enemy']);

const cardCost = (card) => {
  const c = card.cost ?? CARD_SP_COST;
  if (!Number.isFinite(Number(c)) || Number(c) < 0) throw new RangeError(`card "${card.id}" cost must be 0 or more`);
  return Number(c);
};

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
  const attrs = { ...(spec.attrs ?? {}) };
  const evasion = evasionFor({
    evasionArmor: spec.evasionArmor,
    dex: spec.dex,
    shield: spec.shield,
    evasionCard: spec.evasionCard,
    attrs,
    evasion: spec.evasion,
  }, tables);
  const base = Number(spec.evadeBasePct ?? spec.evadePct ?? 0);
  const wis = Number(spec.wis ?? 0);
  const charges = Math.trunc(Number(spec.intangibleCharges ?? 0));
  return {
    id,
    side,
    name: spec.name ?? id,
    attrs,
    level: Number(spec.level ?? 0),
    hp,
    maxHp: hp,
    sp,
    wis: Number.isFinite(wis) ? wis : 0,
    tags: Array.isArray(spec.tags) ? [...spec.tags] : [],
    stance: spec.stance ?? null,
    evasion,
    evadeBasePct: Number.isFinite(base) ? base : 0,
    intangibleCharges: Number.isFinite(charges) && charges > 0 ? charges : 0,
    accuracyExtra: Number(spec.accuracy ?? 0) || 0,
    hand: Array.isArray(spec.hand) ? spec.hand.map((c) => ({ ...c })) : [],
  };
}

// The foes a combatant may target: enemies for the player, the player for an enemy.
function foesOf(combatants, id) {
  if (combatants[id].side === 'player') {
    return Object.keys(combatants).filter((k) => combatants[k].side === 'enemy');
  }
  return ['player'];
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
      if (!CARD_KINDS.includes(card.kind)) throw new TypeError(`card "${card.id}" kind must be one of ${CARD_KINDS.join(', ')}`);
      if (!Number.isFinite(Number(card.speed ?? 0))) throw new TypeError(`card "${card.id}" speed must be a finite number`);
      const foes = foesOf(combatants, id);
      const t = card.target;
      const ok = card.kind === 'attack' ? foes.includes(t)
        : card.kind === 'guard' || card.kind === 'evade' ? t === 'self'
          : t === 'self' || foes.includes(t);
      if (!ok) throw new TypeError(`card "${card.id}" of "${id}" has an invalid target "${t}"`);
      spent += cardCost(card);
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
  if (side === 'player') return momentumSpeed(momentum[target] ?? 0);
  return 0 - momentumSpeed(momentum[id] ?? 0);
}

// Orders the queued actions for one round (owner, 2026-10-11). Returns
// { merge, initiative: { [id]: { base, d4, lead } }, entries }.
//
// queues:  { [combatantId]: [card] }. A card is { id, kind, target, speed, cost?, ... }.
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

  // Lane order: player first, then the other combatants in key order.
  const laneIds = [
    'player',
    ...Object.keys(combatants).filter((k) => k !== 'player'),
  ];
  const d4 = {};
  const base = {};
  for (const id of laneIds) {
    base[id] = initiativeBase(combatants[id]);
    d4[id] = rollD4(ctx.rng);
  }

  let seq = 0;
  const lanes = laneIds.map((id) => {
    const cards = Array.isArray(queues?.[id]) ? queues[id] : [];
    return cards.map((c, cardIndex) => {
      const preemptive = DEFENSIVE_KINDS.includes(c.kind);
      const buff = preemptive ? REACTION_BUFF.speed : 0;
      const card = Number(c.speed ?? 0) + buff;
      const momentumPart = momentumTerm(combatants[id].side, id, c.target, momentum);
      const initiative = base[id] + d4[id] + momentumPart;
      return {
        seq: (seq += 1) - 1,
        actor: id,
        side: combatants[id].side,
        cardIndex,
        cardId: c.id,
        target: c.target,
        preemptive,
        card: { ...c, cost: cardCost(c) },
        speed: {
          card,
          buff,
          base: base[id],
          d4: d4[id],
          momentum: momentumPart,
          initiative,
          total: card + initiative,
          effective: card + initiative,
        },
      };
    });
  });

  // Lead initiative: the first card's initiative, or base + d4 for an empty queue.
  const lead = {};
  laneIds.forEach((id, i) => {
    lead[id] = lanes[i][0] ? lanes[i][0].speed.initiative : base[id] + d4[id];
  });
  const initiative = {};
  laneIds.forEach((id) => {
    initiative[id] = { base: base[id], d4: d4[id], lead: lead[id] };
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
          || (b.entry.speed.card - a.entry.speed.card)
          || (a.i - b.i));
      entries.push(...pass.map((p) => p.entry));
    }
  } else {
    // Speed: a k-way merge over the queue heads. Each queue's effective speeds never
    // rise, so taking the best head keeps every queue in its own order.
    let running = Infinity;
    for (const lane of lanes) {
      running = Infinity;
      for (const e of lane) {
        e.speed.effective = Math.min(e.speed.total, running);
        running = e.speed.effective;
      }
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
