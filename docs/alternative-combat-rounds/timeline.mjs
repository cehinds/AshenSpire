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
} from './resolver.mjs';

export const MERGE_MODES = Object.freeze(['speed', 'roundRobin', 'wholeQueue']);
export const CARD_KINDS = Object.freeze(['attack', 'guard', 'evade', 'counter', 'other']);
export const DEFENSIVE_KINDS = Object.freeze(['guard', 'evade', 'counter']);

// PLACEHOLDER: SP budget per combatant per round when a spec gives none. SP is 3 for
// testing and refills each round (owner, 2026-10-11).
export const DEFAULT_SP = 3;

// PLACEHOLDER: a queued (preemptive) defensive card gets this buff. Reactions use base values.
export const REACTION_BUFF = Object.freeze({ speed: 1, block: 2, evadePct: 10, counterDamage: 1 });
// PLACEHOLDER: base values of the defensive cards, before any buff.
export const DEFENSE_BASE = Object.freeze({ block: 6, evadePct: 20, counterDamage: 2 });

const SIDES = Object.freeze(['player', 'enemy']);

// PLACEHOLDER (owner, 2026-10-11): a card spends its own `sp` (Strike 1, Smash 2). A card
// with no `sp` costs 1.
const DEFAULT_CARD_SP = 1;

const cardSp = (card) => {
  const c = card.sp ?? DEFAULT_CARD_SP;
  if (!Number.isFinite(Number(c)) || Number(c) < 0) throw new RangeError(`card "${card.id}" sp must be 0 or more`);
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
  if (side === 'player') return momentumSpeed(momentum[target] ?? 0);
  return 0 - momentumSpeed(momentum[id] ?? 0);
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
        card: { ...c, sp: cardSp(c) },
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

// A fight state: { combatants, momentum, poiseDouble, charges }. `specs` is a list of
// makeCombatant() specs. Momentum starts at 0 for each enemy. Charges start at each
// combatant's intangibleCharges.
export function makeFight(specs, tables = {}) {
  if (!Array.isArray(specs)) throw new TypeError('specs must be an array of combatant specs');
  const combatants = {};
  for (const spec of specs) {
    const c = makeCombatant(spec, tables);
    if (Object.hasOwn(combatants, c.id)) throw new TypeError(`duplicate combatant "${c.id}"`);
    combatants[c.id] = c;
  }
  if (!Object.hasOwn(combatants, 'player')) throw new TypeError('a fight needs a "player" combatant');
  const charges = {};
  for (const c of Object.values(combatants)) charges[c.id] = c.intangibleCharges;
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
  const wasAlive = t.hp > 0;
  t.hp = Math.max(0, t.hp - amount);
  events.push({ type: 'damage', target: targetId, amount, absorbed, hp: t.hp });
  if (wasAlive && t.hp === 0) events.push({ type: 'defeated', id: targetId });
}

// One attack (owner, 2026-10-11): hit roll, then full block, then intangible or the
// evadePct roll, then damage. Returns nothing; pushes events and updates cur.
function resolveAttack(cur, entry, events, rng, options) {
  const attacker = cur.combatants[entry.actor];
  const target = cur.combatants[entry.target];
  const card = entry.card;
  const dmg = Math.max(0, Number(card.damage ?? 0) || 0);
  // An evade card is spent on the next attack, whether or not that attack hits.
  const evadeUse = cur.active[target.id].evade.shift() ?? null;
  const d20 = rollD20(rng);
  const accuracy = accuracyFor({ attrs: attacker.attrs, level: attacker.level, tags: card.tags, accuracy: card.accuracy })
    + attacker.accuracyExtra;
  const { hit, need } = hitRoll({ accuracy, evasion: target.evasion }, d20);

  // A full block: the block covers the whole hit (block >= damage, damage > 0).
  const blocked = hit && dmg > 0 && cur.active[target.id].guard >= dmg;

  // Avoid (owner, 2026-10-11): an intangible charge avoids a hit outright and is spent
  // only then. Otherwise the target rolls its evadePct. Only a hit that would land is rolled.
  let avoid = null;
  if (hit && !blocked) {
    if (target.tags.includes('intangible') && cur.charges[target.id] > 0) {
      avoid = 'intangible';
      cur.charges[target.id] -= 1;
    } else {
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
  // The defender's card that was spent on this attack, for momentum gain and stance.
  const defenseCard = evadeUse ? { momentumGain: evadeUse.gain, stance: evadeUse.stance } : null;
  return { landed, defenseCard };
}

// Momentum gain of a card: its momentumGain, default 1 (as in resolver.mjs).
function gainOf(card) {
  const g = Number(card?.momentumGain ?? 1);
  if (!Number.isFinite(g)) throw new TypeError('momentumGain must be a finite number');
  return g;
}

// Credits one side's success in an exchange (owner, 2026-10-11; DESIGN.md, Momentum).
// A side wins an exchange at most once. The gain is the winner's card gain plus the
// stance bonus against the other side's card. The enemy key is the enemy in the exchange.
function credit(cur, run, { key, winner, winCard, foeCard, events, seq, credited }) {
  if (credited.has(winner)) return;
  credited.add(winner);
  const gain = gainOf(winCard);
  const bonus = stanceBonus(run.stanceTable, winCard?.stance ?? null, foeCard?.stance ?? null);
  const delta = (winner === 'player' ? 1 : -1) * (gain + bonus);
  run.pending[key] = (run.pending[key] ?? 0) + delta;
  events.push({ type: 'momentum', reason: 'success', enemyId: key, by: winner, gain, bonus, delta, seq });
}

// A counter with the 'stagger' tag adds +-3 to its side's summed delta (owner, 2026-10-11).
function stagger(run, { key, owner, cur, events, seq }) {
  const sign = cur.combatants[owner].side === 'player' ? 1 : -1;
  const delta = sign * MOMENTUM_MAX;
  run.pending[key] = (run.pending[key] ?? 0) + delta;
  events.push({ type: 'momentum', reason: 'counterStagger', enemyId: key, by: cur.combatants[owner].side, delta, seq });
}

// Offers the player's reaction window (owner, 2026-10-11): when an attack targets a
// player, the player may play an unplayed defensive card from hand, if SP is left.
// Enemies never react. The card uses base values and spends its sp.
function offerReaction(cur, entry, events, options, run) {
  const defender = cur.combatants[entry.target];
  if (defender.side !== 'player' || typeof options.onReaction !== 'function') return;
  const id = defender.id;
  const usedIds = cur.used[id] ?? [];
  const queued = run.queuedIds[id] ?? new Set();
  const eligible = defender.hand.filter((c) => DEFENSIVE_KINDS.includes(c.kind)
    && !queued.has(c.id)
    && !usedIds.includes(c.id)
    && cardSp(c) <= cur.spLeft[id]
    && (c.kind !== 'counter' || c.target === 'self' || c.target === entry.actor));
  if (eligible.length === 0) return;
  const attack = {
    seq: entry.seq,
    attacker: entry.actor,
    target: id,
    cardId: entry.cardId,
    damage: Math.max(0, Number(entry.card.damage ?? 0) || 0),
    speed: entry.speed.total,
  };
  const pick = options.onReaction(attack, eligible.map((c) => ({ ...c })));
  if (pick === null || pick === undefined) return;
  const chosen = eligible.find((c) => c.id === pick?.id);
  if (!chosen) throw new TypeError(`onReaction returned a card that is not eligible: ${pick?.id}`);
  cur.spLeft[id] -= cardSp(chosen);
  cur.used[id] = [...usedIds, chosen.id];
  events.push({ type: 'reaction', by: id, cardId: chosen.id, kind: chosen.kind, against: entry.actor, seq: entry.seq, sp: cardSp(chosen) });
  // Base values, no buff (owner, 2026-10-11). A reaction counter fires on this attack,
  // after it resolves, and never cancels it (placeholder).
  placeDefence(cur, id, chosen, { preemptive: false, foe: entry.actor, events, reaction: true });
}

// Makes a defensive card active for its owner (owner, 2026-10-11). A preemptive card
// gets REACTION_BUFF on top of its base values. A reaction uses base values only.
function placeDefence(cur, owner, card, { preemptive, foe, events, reaction, speed = null }) {
  const buff = (key) => (preemptive ? REACTION_BUFF[key] : 0);
  const act = cur.active[owner];
  if (card.kind === 'guard') {
    const block = (card.block ?? DEFENSE_BASE.block) + buff('block');
    act.guard += block;
    events.push({ type: 'guardUp', by: owner, cardId: card.id, block, buffed: preemptive });
  } else if (card.kind === 'evade') {
    const pct = (card.evadePct ?? DEFENSE_BASE.evadePct) + buff('evadePct');
    act.evade.push({ cardId: card.id, pct, gain: card.momentumGain, stance: card.stance ?? null });
    events.push({ type: 'evadeUp', by: owner, cardId: card.id, pct, buffed: preemptive });
  } else if (card.kind === 'counter') {
    const damage = (card.counterDamage ?? DEFENSE_BASE.counterDamage) + buff('counterDamage');
    const target = card.target === 'self' ? null : (foe ?? card.target);
    act.counters.push({
      cardId: card.id,
      owner,
      foe: target,
      speed,
      damage,
      stagger: Array.isArray(card.tags) && card.tags.includes('stagger'),
      gain: card.momentumGain,
      stance: card.stance ?? null,
      reaction,
    });
    events.push({ type: 'counterUp', by: owner, cardId: card.id, foe: target, damage, buffed: preemptive });
  }
}

// Takes the first active counter that fires on this attack, or null (owner, 2026-10-11):
// a counter fires on the next attack from its chosen foe, or any foe when it is 'self'.
function takeCounter(cur, defenderId, attackerId) {
  const list = cur.active[defenderId].counters;
  const i = list.findIndex((c) => c.foe === null || c.foe === attackerId);
  return i < 0 ? null : list.splice(i, 1)[0];
}

// Resolves one timeline entry into `events`, updating `cur` in place.
function applyEntry(cur, entry, events, options, run) {
  const actor = cur.combatants[entry.actor];
  const base = { seq: entry.seq, actor: entry.actor, cardId: entry.cardId };
  if (actor.hp <= 0) {
    events.push({ type: 'skipped', reason: 'defeated', ...base });
    return;
  }
  if (entry.target !== 'self' && cur.combatants[entry.target].hp <= 0) {
    events.push({ type: 'skipped', reason: 'targetDefeated', ...base, target: entry.target });
    return;
  }
  events.push({ type: 'action', ...base, kind: entry.card.kind, target: entry.target, speed: entry.speed.total });
  const kind = entry.card.kind;
  if (kind === 'attack') {
    offerReaction(cur, entry, events, options, run);
    const counter = takeCounter(cur, entry.target, entry.actor);
    // The enemy in this exchange: the attacker, or the defender when the player attacks.
    const key = entry.side === 'enemy' ? entry.actor : entry.target;
    const attackCard = { momentumGain: entry.card.momentumGain, stance: entry.card.stance ?? null };
    const counterCard = counter ? { momentumGain: counter.gain, stance: counter.stance } : null;
    const credited = new Set();
    const sideOf = (id) => cur.combatants[id].side;
    if (counter && !counter.reaction && counter.speed > entry.speed.total) {
      // A faster counter cancels the attack. A tie or a slower counter does not.
      events.push({ type: 'countered', by: counter.owner, target: entry.actor, cardId: counter.cardId, cancelled: true });
      applyDamage(cur, entry.actor, counter.damage, events);
      credit(cur, run, { key, winner: sideOf(counter.owner), winCard: counterCard, foeCard: attackCard, events, seq: entry.seq, credited });
      if (counter.stagger) stagger(run, { key, owner: counter.owner, cur, events, seq: entry.seq });
      return;
    }
    const out = resolveAttack(cur, entry, events, options.rng, options);
    if (out.landed) {
      credit(cur, run, { key, winner: entry.side, winCard: attackCard, foeCard: out.defenseCard ?? {}, events, seq: entry.seq, credited });
    } else {
      credit(cur, run, { key, winner: sideOf(entry.target), winCard: out.defenseCard ?? {}, foeCard: attackCard, events, seq: entry.seq, credited });
    }
    if (counter) {
      events.push({ type: 'counterFired', by: counter.owner, target: entry.actor, cardId: counter.cardId, after: true });
      applyDamage(cur, entry.actor, counter.damage, events);
      credit(cur, run, { key, winner: sideOf(counter.owner), winCard: counterCard, foeCard: attackCard, events, seq: entry.seq, credited });
      if (counter.stagger) stagger(run, { key, owner: counter.owner, cur, events, seq: entry.seq });
    }
  } else if (kind === 'guard' || kind === 'evade' || kind === 'counter') {
    // A queued defensive card is preemptive: it becomes active for its owner now.
    placeDefence(cur, entry.actor, entry.card, {
      preemptive: true,
      foe: null,
      events,
      reaction: false,
      speed: entry.speed.total,
    });
  }
}

// Enemy momentum decay at round start (owner, 2026-10-11): each enemy's M moves
// toward 0 by `step`. Returns the decayed M and the 'decay' events.
function decayAll(cur, combatants, step, events) {
  for (const id of Object.keys(combatants)) {
    if (combatants[id].side !== 'enemy') continue;
    const from = clampMomentum(cur.momentum[id] ?? 0);
    const to = decayMomentum(from, step);
    if (to !== from) events.push({ type: 'momentum', reason: 'decay', enemyId: id, from, to, delta: to - from, by: null });
    cur.momentum[id] = to;
  }
}

// Starts one round and returns a step-able resolver (owner, 2026-10-11).
//
// state:   from makeFight(); not changed. The round works on a copy.
// options: { queues, rng, merge?, decay? (default 1), evadeTable? }
//          queues: { [combatantId]: [card] } (see buildTimeline).
// Returns { timeline, next(), resolveAll(), state }:
//   next()        resolves the next timeline entry: { entry, events, state, done }.
//                 `state` is a copy of the state after that action. `done` is true
//                 once the last entry has resolved (the round then ends).
//   resolveAll()  calls next() to the end: { events, state, timeline }.
//   state         a copy of the state now.
// Round start: enemy momentum decays (decay events come with the first next()).
export function createRound(state, options = {}) {
  if (!state || typeof state !== 'object' || !state.combatants) throw new TypeError('state must come from makeFight()');
  const cur = structuredClone(state);
  cur.momentum = { ...(cur.momentum ?? {}) };
  cur.poiseDouble = { ...(cur.poiseDouble ?? {}) };
  cur.charges = { ...(cur.charges ?? {}) };
  // Every combatant has a poise flag, false unless an overflow set it.
  for (const id of Object.keys(cur.combatants)) cur.poiseDouble[id] = cur.poiseDouble[id] === true;
  // Round-scoped effects (block, evade, counters) start empty each round.
  cur.active = {};
  for (const c of Object.values(cur.combatants)) {
    if (!Object.hasOwn(cur.charges, c.id)) cur.charges[c.id] = c.intangibleCharges;
    cur.active[c.id] = { guard: 0, evade: [], counters: [] };
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
  for (const id of Object.keys(cur.combatants)) spent[id] = 0;
  for (const e of timeline.entries) spent[e.actor] += e.card.sp;
  cur.spLeft = {};
  for (const id of Object.keys(cur.combatants)) cur.spLeft[id] = cur.combatants[id].sp - spent[id];

  // Round-scoped: reactions played (by card id) and each combatant's queued card ids.
  cur.used = {};
  const run = { queuedIds: {}, pending: {}, stanceTable: options.stanceAdvantage ?? null };
  for (const e of timeline.entries) {
    run.queuedIds[e.actor] = run.queuedIds[e.actor] ?? new Set();
    run.queuedIds[e.actor].add(e.card.id);
  }

  let idx = 0;
  let settled = false;
  let pending = startEvents;
  const entries = timeline.entries;
  const snapshot = () => structuredClone(cur);

  // Round end (owner, 2026-10-11): each enemy's summed delta is added to its start M
  // once, then clamped. A raw total past the cap sets that side's poiseDouble flag.
  const settle = (events) => {
    settled = true;
    for (const k of Object.keys(cur.combatants)) {
      if (cur.combatants[k].side !== 'enemy') continue;
      const from = cur.momentum[k] ?? 0;
      const raw = from + (run.pending[k] ?? 0);
      const to = clampMomentum(raw);
      cur.momentum[k] = to;
      if (to !== from) events.push({ type: 'momentumApplied', enemyId: k, from, delta: to - from, to });
      if (raw > MOMENTUM_MAX) {
        events.push({ type: 'momentum', reason: 'overflow', enemyId: k, side: 'player', delta: 0, by: null });
        cur.poiseDouble.player = true;
      }
      if (raw < MOMENTUM_MIN) {
        events.push({ type: 'momentum', reason: 'overflow', enemyId: k, side: 'enemy', delta: 0, by: null });
        cur.poiseDouble[k] = true;
      }
    }
    events.push({ type: 'roundEnd' });
    for (const id of Object.keys(cur.active)) cur.active[id] = { guard: 0, evade: [], counters: [] };
  };

  const next = () => {
    const events = pending;
    pending = [];
    if (settled) return { entry: null, events, state: snapshot(), done: true };
    let entry = null;
    if (idx < entries.length) {
      entry = entries[idx];
      idx += 1;
      applyEntry(cur, entry, events, options, run);
    }
    if (idx >= entries.length) settle(events);
    return { entry: entry ? structuredClone(entry) : null, events, state: snapshot(), done: settled };
  };

  return {
    timeline,
    next,
    resolveAll() {
      const events = [];
      let r;
      do {
        r = next();
        events.push(...r.events);
      } while (!r.done);
      return { events, state: r.state, timeline };
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
export const ADAPT_PERCENT_PER_WIS = 15;
export const ADAPT_PERCENT_MAX = 60;
export const ADAPT_INDEX = 2;
export const ADAPT_COUNTER_DAMAGE = 2;

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
    out[id] = q;
    if (id === 'player') continue;
    const chance = adaptChance(wis[id] ?? 0);
    if (chance <= 0 || q.length <= ADAPT_INDEX) continue;
    const roll = rollUnit(rng);
    if (!(roll < chance)) continue;
    const attacked = (playerQueue ?? []).some((c) => c && c.kind === 'attack' && c.target === id);
    if (!attacked) continue;
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
