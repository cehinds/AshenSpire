// Simultaneous action: pure resolver prototype.
//
// Exploration only. Not wired into src/. No DOM, no Math.random.
// Randomness is injected: `rng` is a function returning a float in [0, 1).
// Design and placeholder rules: see DESIGN.md in this folder.

export const MOMENTUM_MIN = -3;
export const MOMENTUM_MAX = 3;
export const AC_BASE = 8;

const COMPONENTS = ['card', 'weapon', 'armor', 'range', 'attackType', 'skill', 'initiative'];
const KINDS = ['attack', 'counter', 'other'];
const STATUS_TAGS = ['stagger', 'stun'];
const SIDES = ['player', 'enemy'];

const other = (who) => (who === 'player' ? 'enemy' : 'player');

export function clampMomentum(m) {
  const n = Number(m);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MOMENTUM_MAX, Math.max(MOMENTUM_MIN, n));
}

// Looks up each component in `mods[component][id]`. A missing, blank or TBD
// value counts as 0 and still appears in `parts` so the gap is visible.
// `input.momentum` is the shared momentum M. The player side adds M, the
// enemy side adds -M (DESIGN.md, Momentum).
export function actionSpeed(input = {}, mods = {}, side = 'player') {
  if (!SIDES.includes(side)) throw new TypeError(`side must be one of ${SIDES.join(', ')}`);
  const parts = {};
  let total = 0;
  for (const key of COMPONENTS) {
    const id = input[key];
    const table = (mods && mods[key]) || {};
    const raw = id == null ? undefined : table[id];
    const n = raw == null ? NaN : Number(raw);
    const value = Number.isFinite(n) ? n : 0;
    parts[key] = value;
    total += value;
  }
  const shared = clampMomentum(input.momentum ?? 0);
  // `0 - shared` rather than `-shared`, so a zero stays +0 for the enemy side.
  parts.momentum = side === 'enemy' ? 0 - shared : shared;
  total += parts.momentum;
  return { total, parts };
}

// floor(1*STR + 1*DEX + 0.5*WIS + 0.5*INT)
export function attributeBonus(attrs = {}) {
  const v = (k) => {
    const n = Number(attrs[k] ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  return Math.floor(1 * v('STR') + 1 * v('DEX') + 0.5 * v('WIS') + 0.5 * v('INT'));
}

// Hit when d20 + accuracy + attributeBonus >= 8 + evasion.
// `need` is the lowest d20 that hits (may fall outside 1..20 at the extremes).
export function hitRoll({ accuracy = 0, attrs = {}, evasion = 0 } = {}, d20) {
  if (!Number.isInteger(d20) || d20 < 1 || d20 > 20) {
    throw new RangeError(`d20 must be an integer 1..20, got ${d20}`);
  }
  const bonus = Number(accuracy || 0) + attributeBonus(attrs);
  const target = AC_BASE + Number(evasion || 0);
  // Natural 1 always misses and natural 20 always hits, whatever the totals.
  let hit = d20 + bonus >= target;
  if (d20 === 1) hit = false;
  if (d20 === 20) hit = true;
  return { hit, need: target - bonus };
}

export function rollD20(rng) {
  if (typeof rng !== 'function') throw new TypeError('rng must be a function returning [0, 1)');
  const x = rng();
  if (!(x >= 0 && x < 1)) throw new RangeError(`rng must return a value in [0, 1), got ${x}`);
  return Math.floor(x * 20) + 1;
}

function normalizeSide(name, s) {
  if (!s || typeof s !== 'object') throw new TypeError(`${name} must be an object`);
  if (!Number.isFinite(s.speed)) throw new TypeError(`${name}.speed must be a finite number`);
  const kind = s.kind ?? 'other';
  if (!KINDS.includes(kind)) throw new TypeError(`${name}.kind must be one of ${KINDS.join(', ')}`);
  return {
    name,
    id: s.id ?? name,
    kind,
    speed: s.speed,
    tags: Array.isArray(s.tags) ? [...s.tags] : [],
    accuracy: Number(s.accuracy ?? 0),
    attrs: s.attrs ?? {},
    evasion: Number(s.evasion ?? 0),
    stance: s.stance ?? null,
    damage: Number(s.damage ?? 0),
    block: Number(s.block ?? 0),
  };
}

// Resolves one player action against one enemy action. Returns ordered events.
//
// Rules (placeholder where DESIGN.md says so):
// - Higher speed acts first. Equal speed is a tie: both act at once.
// - A faster counter cancels a slower attack ('countered'). It does not
//   cancel a tied attack.
// - A faster attack's hit interrupts a slower action, unless that action's
//   holder has 'hyperArmor' ('hyperArmor' event instead).
// - On a tie, 'counterDamage' adds counter damage to the opponent. 'stagger'
//   and 'stun' apply to the opponent, unless it has 'hyperArmor' ('resisted').
//   These tags do nothing outside a tie.
// - Each attack that is not cancelled rolls a hit with hitRoll(). The d20
//   is drawn from `rng`, in resolution order (first actor, then second; on a
//   tie, player then enemy).
export function resolvePair(playerIn, enemyIn, rng) {
  const side = {
    player: normalizeSide('player', playerIn),
    enemy: normalizeSide('enemy', enemyIn),
  };
  const events = [];
  const cancelled = { player: null, enemy: null };
  const tie = side.player.speed === side.enemy.speed;
  const first = tie ? null : side.player.speed > side.enemy.speed ? 'player' : 'enemy';

  events.push({
    type: 'order',
    first,
    simultaneous: tie,
    speeds: { player: side.player.speed, enemy: side.enemy.speed },
  });

  const rollHit = (who) => {
    const attacker = side[who];
    const target = side[other(who)];
    const d20 = rollD20(rng);
    const { hit, need } = hitRoll({ accuracy: attacker.accuracy, attrs: attacker.attrs, evasion: target.evasion }, d20);
    // A full block (Block >= damage, damage > 0) absorbs a hit that rolled true.
    // The blocking side wins the slot, and the attack does not land.
    const blocked = hit && attacker.damage > 0 && target.block >= attacker.damage;
    events.push({ type: 'hit', by: who, target: other(who), d20, hit, need, blocked });
    if (blocked) {
      events.push({ type: 'absorbed', by: other(who), target: who });
    } else if (!hit && target.stance === 'evade') {
      // A miss against an evade action is a dodge: the defender wins the slot.
      events.push({ type: 'evaded', by: other(who), target: who });
    }
    return hit && !blocked;
  };

  if (tie) {
    for (const who of SIDES) if (side[who].kind === 'attack') rollHit(who);
    for (const who of SIDES) {
      const foe = other(who);
      for (const tag of side[who].tags) {
        if (tag === 'counterDamage') {
          events.push({ type: 'counterDamage', by: who, target: foe });
        } else if (STATUS_TAGS.includes(tag)) {
          if (side[foe].tags.includes('hyperArmor')) {
            events.push({ type: 'resisted', status: tag, target: foe });
          } else {
            events.push({ type: 'status', status: tag, target: foe });
          }
        }
      }
    }
    return events;
  }

  const second = other(first);
  const f = side[first];
  const s = side[second];

  if (f.kind === 'counter' && s.kind === 'attack') {
    cancelled[second] = 'countered';
    events.push({ type: 'countered', by: first, target: second });
    // A counter that fires can stagger or stun the attacker it cancelled.
    for (const tag of f.tags) {
      if (!STATUS_TAGS.includes(tag)) continue;
      if (s.tags.includes('hyperArmor')) {
        events.push({ type: 'resisted', status: tag, target: second });
      } else {
        events.push({ type: 'status', status: tag, target: second });
      }
    }
  }
  if (f.kind === 'attack') {
    const landed = rollHit(first);
    // Only a landed hit interrupts. A miss leaves the slower action intact.
    if (landed) {
      if (s.tags.includes('hyperArmor')) {
        events.push({ type: 'hyperArmor', side: second, ignored: 'interrupt' });
      } else {
        cancelled[second] = 'interrupted';
        events.push({ type: 'interrupted', side: second, by: first });
      }
    }
  }
  if (!cancelled[second] && s.kind === 'attack') rollHit(second);
  return events;
}

// Momentum gain on success: the card's `momentumGain`, default 1.
function gainOf(card) {
  const g = Number(card.momentumGain ?? 1);
  if (!Number.isFinite(g)) throw new TypeError('momentumGain must be a finite number');
  return g;
}

// Parses stance-advantage.csv text into a Map from 'attacker>defender' to a
// bonus. A blank bonus cell means the default, 1 (DESIGN.md, Momentum).
export function parseStanceAdvantage(text) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const header = (lines.shift() ?? '').split(',').slice(0, 3).join(',');
  if (header !== 'attacker_stance,defender_stance,bonus') {
    throw new TypeError('stance-advantage.csv: unexpected header');
  }
  const table = new Map();
  for (const line of lines) {
    const [attacker, defender, bonusCell] = line.split(',');
    const bonus = bonusCell === undefined || bonusCell.trim() === '' ? 1 : Number(bonusCell);
    if (!Number.isFinite(bonus)) throw new TypeError(`stance-advantage.csv: bad bonus in "${line}"`);
    table.set(`${attacker}>${defender}`, bonus);
  }
  return table;
}

// Bonus momentum when a stance wins against the opposing stance. 0 if none.
export function stanceBonus(table, stance, opposing) {
  if (!table || !stance || !opposing) return 0;
  return table.get(`${stance}>${opposing}`) ?? 0;
}

// The side that wins the slot with this event, or null. A landed hit or a
// counter that fires is a success (DESIGN.md, Momentum).
function successSide(e) {
  if (e.type === 'hit' && e.hit === true && !e.blocked) return e.by;
  if (e.type === 'countered' || e.type === 'absorbed' || e.type === 'evaded') return e.by;
  return null;
}

// Each queued action belongs to an enemy. `enemyId` names that enemy; it
// defaults to the action's `id`. Momentum is kept per enemy.
const enemyKey = (enemy) => enemy.enemyId ?? enemy.id;

// Resolves one round: each player card is paired with one enemy slot.
//
// playerCards: [{ id, slot, speed, kind, tags, accuracy, attrs, evasion, momentumGain? }]
// enemyQueue:  [{ id, enemyId?, speed, kind, tags, accuracy, attrs, evasion, momentumGain? }]   (3 per round)
//   `speed` is the card's total without momentum. This function adds the
//   momentum of that action's enemy: the player adds M_e, the enemy adds -M_e.
// perception:  number of queued actions visible to the player. It only tags
//              events with `visible`. Thresholds are open (DESIGN.md, Open q. e).
// options.momentum: { [enemyId]: M_e } at the start of the round (default 0 each).
//
// Returns { events, momentum }, where `momentum` is { [enemyId]: M_e } after the
// round. Momentum updates at round end (DESIGN.md, Momentum):
// - Every pairing in the round uses the round's starting M_e.
// - Each success moves M_e toward the winner by the card's momentumGain
//   (default 1). The deltas are summed per enemy, then clamped once to -3..3.
// - Pair events carry `momentum`: that enemy's starting M_e. A 'momentum'
//   event marks each success. 'momentumApplied' marks each round-end change.
// - A second player card on an already paired slot is rejected ('rejected').
// - An enemy slot with no player card is 'unpaired' and has no effect.
export function resolveRound(playerCards, enemyQueue, perception, rng, options = {}) {
  if (!Array.isArray(playerCards)) throw new TypeError('playerCards must be an array');
  if (!Array.isArray(enemyQueue)) throw new TypeError('enemyQueue must be an array');
  const visibleCount = Math.max(0, Math.min(enemyQueue.length, Math.trunc(Number(perception) || 0)));
  const inputM = options.momentum ?? {};
  const stanceTable = options.stanceAdvantage ?? null; // Map from parseStanceAdvantage()
  if (typeof inputM !== 'object' || Array.isArray(inputM)) {
    throw new TypeError('options.momentum must be an object keyed by enemy id');
  }

  // Starting M_e for each enemy in the queue. Every pairing uses these values.
  const start = {};
  for (const enemy of enemyQueue) {
    const k = enemyKey(enemy);
    if (!(k in start)) start[k] = clampMomentum(inputM[k] ?? 0);
  }

  const pending = {}; // summed raw deltas per enemy, applied at round end
  const fullSet = {}; // enemy -> +-3, set by a counter that staggers (round end)
  const events = [];
  const paired = new Set();
  const push = (e, k = null) => events.push({ ...e, momentum: k === null ? null : start[k] });

  playerCards.forEach((pc, i) => {
    const slot = pc.slot;
    if (!Number.isInteger(slot) || slot < 0 || slot >= enemyQueue.length) {
      throw new RangeError(`playerCards[${i}].slot must be an integer in 0..${enemyQueue.length - 1}`);
    }
    if (paired.has(slot)) {
      push({ type: 'rejected', reason: 'slot taken', slot, cardId: pc.id });
      return;
    }
    paired.add(slot);

    const enemy = enemyQueue[slot];
    const k = enemyKey(enemy);
    const visible = slot < visibleCount;
    const pairEvents = resolvePair(
      { ...pc, speed: pc.speed + start[k] },
      { ...enemy, speed: enemy.speed - start[k] },
      rng,
    );
    for (const e of pairEvents) {
      push({ ...e, slot, visible }, k);
      const winner = successSide(e);
      if (winner) {
        const card = winner === 'player' ? pc : enemy;
        const foe = winner === 'player' ? enemy : pc;
        const gain = gainOf(card);
        // Stance advantage adds to the success (owner's rule: "adds bonus momentum").
        const bonus = stanceBonus(stanceTable, card.stance, foe.stance);
        const delta = (winner === 'player' ? 1 : -1) * (gain + bonus);
        pending[k] = (pending[k] ?? 0) + delta;
        push({ type: 'momentum', enemyId: k, by: winner, gain, bonus, delta, reason: 'success', slot }, k);
      }
    }
    // A counter that staggers its target gives its side full momentum (set to +-3).
    const counterWin = pairEvents.find((e) => e.type === 'countered');
    if (counterWin && pairEvents.some((e) => e.type === 'status' && e.target === other(counterWin.by))) {
      const sign = counterWin.by === 'player' ? 1 : -1;
      fullSet[k] = sign * MOMENTUM_MAX;
      push({ type: 'momentum', enemyId: k, by: counterWin.by, reason: 'counterStagger', set: fullSet[k], slot }, k);
    }
  });

  enemyQueue.forEach((enemy, slot) => {
    if (!paired.has(slot)) {
      push({ type: 'unpaired', slot, enemyId: enemy.id, visible: slot < visibleCount }, enemyKey(enemy));
    }
  });

  // Round end: sum each enemy's deltas, then clamp once.
  const momentum = {};
  for (const k of Object.keys(start)) {
    const from = start[k];
    const to = k in fullSet ? clampMomentum(fullSet[k]) : clampMomentum(from + (pending[k] ?? 0));
    momentum[k] = to;
    if (to !== from) {
      events.push({ type: 'momentumApplied', enemyId: k, from, delta: to - from, to, momentum: to });
    }
  }
  for (const k of Object.keys(inputM)) {
    if (!(k in momentum)) momentum[k] = clampMomentum(inputM[k]);
  }

  return { events, momentum };
}
