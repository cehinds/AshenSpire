// alternative-combat-rounds: simultaneous action, pure resolver prototype.
//
// Exploration only. Not wired into src/. No DOM, no Math.random.
// Randomness is injected: `rng` is a function returning a float in [0, 1).
// Design and placeholder rules: see DESIGN.md in this folder.

export const MOMENTUM_MIN = -3;
export const MOMENTUM_MAX = 3;
export const AC_BASE = 8;

const COMPONENTS = ['card', 'weapon', 'armor', 'range', 'attackType', 'skill', 'initiative'];
// The fields a full (stage 3) enemy action carries for its speed. Any one of
// them present means the action's speed is known.
const SPEED_COMPONENTS = COMPONENTS;
const KINDS = ['attack', 'counter', 'other'];
const STATUS_TAGS = ['stagger', 'stun'];
const SIDES = ['player', 'enemy'];

const other = (who) => (who === 'player' ? 'enemy' : 'player');

// Momentum adds half its value to speed, truncated toward zero, so the
// shift is symmetric: +-1 gives 0, +-2 and +-3 give +-1 (DESIGN.md, Momentum).
// `|| 0` turns a truncated -0 into +0.
export function momentumSpeed(m) {
  return Math.trunc(clampMomentum(m) / 2) || 0;
}

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
  const shift = momentumSpeed(clampMomentum(input.momentum ?? 0));
  // `0 - shift` rather than `-shift`, so a zero stays +0 for the enemy side.
  parts.momentum = side === 'enemy' ? 0 - shift : shift;
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

function rollUnit(rng) {
  if (typeof rng !== 'function') throw new TypeError('rng must be a function returning [0, 1)');
  const x = rng();
  if (!(x >= 0 && x < 1)) throw new RangeError(`rng must return a value in [0, 1), got ${x}`);
  return x;
}

export function rollD20(rng) {
  return Math.floor(rollUnit(rng) * 20) + 1;
}

// Evade percent cap (placeholder, flagged in DESIGN.md, Evasion).
export const EVADE_PCT_MAX = 95;

export function clampEvadePct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(EVADE_PCT_MAX, Math.max(0, v));
}

// evadePct for one defender in one exchange: evadeBasePct plus the live
// evadeBonuses, clamped to 0..EVADE_PCT_MAX (DESIGN.md, Evasion).
export function evadePctFor(side, ctx = {}) {
  const live = activeEvadeBonuses(side.evadeBonuses ?? [], ctx);
  const bonus = live.reduce((n, b) => n + Number(b.pct), 0);
  return clampEvadePct(Number(side.evadeBasePct ?? 0) + bonus);
}

// Parses evade-bonus.csv text into a Map from stance to bonus percent. A blank
// bonus cell is 0 (no bonus). Values are TBD (DESIGN.md, Evasion).
export function parseEvadeBonus(text) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const header = (lines.shift() ?? '').split(',').slice(0, 2).join(',');
  if (header !== 'stance,bonusPct') throw new TypeError('evade-bonus.csv: unexpected header');
  const table = new Map();
  for (const line of lines) {
    const [stance, pctCell] = line.split(',');
    const pct = pctCell === undefined || pctCell.trim() === '' ? 0 : Number(pctCell);
    if (!Number.isFinite(pct)) throw new TypeError(`evade-bonus.csv: bad bonus in "${line}"`);
    table.set(stance, pct);
  }
  return table;
}

// The defender's stance bonus to evade, as one exchange-scoped bonus (or none).
function stanceEvadeBonuses(stance, table) {
  if (!table || !stance) return [];
  const pct = table.get(stance) ?? 0;
  return pct === 0 ? [] : [{ source: `stance:${stance}`, pct, scope: 'exchange' }];
}

function normalizeEvadeBonuses(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw new TypeError('evadeBonuses must be an array');
  return list.map((b) => {
    if (!b || typeof b !== 'object') throw new TypeError('evade bonus must be an object');
    if (!Number.isFinite(Number(b.pct))) throw new TypeError('evade bonus pct must be a finite number');
    return { ...b, pct: Number(b.pct) };
  });
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
    // Charges for the 'intangible' tag (DESIGN.md, Evasion). Never negative.
    intangibleCharges: Math.max(0, Math.trunc(Number(s.intangibleCharges ?? 0)) || 0),
    // Percent to avoid an attack that would land, before bonuses (DESIGN.md, Evasion).
    evadeBasePct: Number.isFinite(Number(s.evadeBasePct ?? 0)) ? Number(s.evadeBasePct ?? 0) : 0,
    evadeBonuses: normalizeEvadeBonuses(s.evadeBonuses),
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
//   Outside a tie, a counter that fires also applies its stagger and stun.
// - Each attack that is not cancelled rolls a hit with hitRoll(). The d20
//   is drawn from `rng`, in resolution order (first actor, then second; on a
//   tie, player then enemy).
export function resolvePair(playerIn, enemyIn, rng, options = {}) {
  const side = {
    player: normalizeSide('player', playerIn),
    enemy: normalizeSide('enemy', enemyIn),
  };
  // What the evade bonus scopes see for this exchange (DESIGN.md, Evasion).
  const exchangeCtx = { inExchange: true, round: options.round, combatId: options.combatId };
  // Shared charge pool by side, mutated as charges are spent (DESIGN.md, Evasion).
  // Without it, each side's own intangibleCharges is the pool.
  const pool = options.charges ?? null;
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
    // Avoiding a hit that would land (DESIGN.md, Evasion). A charge of
    // 'intangible' avoids it outright and is spent only then. Otherwise the
    // defender rolls its evadePct, and only a hit that would land is rolled.
    let avoid = null; // 'intangible' | 'evasion'
    let evade = null; // { evadePct, roll, success } when the percent roll is made
    const targetKey = other(who);
    const chargesLeft = pool ? pool[targetKey] : target.intangibleCharges;
    if (hit && !blocked) {
      if (target.tags.includes('intangible') && chargesLeft > 0) {
        avoid = 'intangible';
      } else {
        const stanceBonus = stanceEvadeBonuses(target.stance, options.evadeTable);
        const evadePct = evadePctFor(
          { ...target, evadeBonuses: [...target.evadeBonuses, ...stanceBonus] },
          exchangeCtx,
        );
        if (evadePct > 0) {
          const roll = Math.floor(rollUnit(rng) * 100);
          evade = { evadePct, roll, success: roll < evadePct };
          if (evade.success) avoid = 'evasion';
        }
      }
    }
    events.push({ type: 'hit', by: who, target: other(who), d20, hit, need, blocked, avoided: avoid !== null });
    if (evade) events.push({ type: 'evadeRoll', by: other(who), target: who, ...evade });
    if (blocked) {
      events.push({ type: 'absorbed', by: other(who), target: who });
    } else if (avoid === 'intangible') {
      if (pool) pool[targetKey] -= 1;
      else target.intangibleCharges -= 1;
      const remaining = pool ? pool[targetKey] : target.intangibleCharges;
      events.push({ type: 'evaded', by: other(who), target: who, reason: 'intangible', charges: remaining });
    } else if (avoid === 'evasion') {
      events.push({ type: 'evaded', by: other(who), target: who, reason: 'evasion' });
    } else if (!hit && target.stance === 'evade') {
      // A miss against an evade action is a dodge: the defender wins the slot.
      events.push({ type: 'evaded', by: other(who), target: who });
    }
    return hit && !blocked && avoid === null;
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

// Intangible charges: a non-negative whole number, NaN and blanks count as 0.
function chargeCount(v) {
  return Math.max(0, Math.trunc(Number(v ?? 0)) || 0);
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

// Evade bonus scopes (DESIGN.md, Evasion). Every tag or stance bonus to evade
// is { source, pct, scope, condition? }. The same scope model is meant for all
// tag bonuses, not only evasion.
export const EVADE_SCOPES = Object.freeze(['exchange', 'round', 'combat', 'run']);

// Keeps the bonuses whose scope is live in ctx, and whose condition passes.
// - exchange: live when ctx.inExchange is true.
// - round: live when ctx.round is set, and equals bonus.round if that is set.
// - combat: live when ctx.combatId is set, and equals bonus.combatId if that is set.
// - run: live whenever the bonus is present.
// Pure: does not change the bonuses.
export function activeEvadeBonuses(bonuses = [], ctx = {}) {
  if (!Array.isArray(bonuses)) throw new TypeError('evade bonuses must be an array');
  return bonuses.filter((b) => {
    if (!b || typeof b !== 'object') throw new TypeError('evade bonus must be an object');
    if (!EVADE_SCOPES.includes(b.scope)) {
      throw new TypeError(`evade bonus scope must be one of ${EVADE_SCOPES.join(', ')}, got ${b.scope}`);
    }
    let live = true;
    if (b.scope === 'exchange') live = ctx.inExchange === true;
    else if (b.scope === 'round') live = ctx.round != null && (b.round == null || b.round === ctx.round);
    else if (b.scope === 'combat') live = ctx.combatId != null && (b.combatId == null || b.combatId === ctx.combatId);
    if (!live) return false;
    return typeof b.condition !== 'function' || Boolean(b.condition(ctx));
  });
}

// Stance groups shown at perception stage 1 (DESIGN.md, Round flow and
// perception). Only the shape is decided; every group name is TBD until the
// owner names them. Stances come from stance-advantage.csv and the stance tree.
export const STANCE_GROUPS = Object.freeze({
  attack: 'offense', // TBD
  smash: 'offense', // TBD
  sweep: 'offense', // TBD
  block: 'defense', // TBD
  counter: 'defense', // TBD
  evade: 'evade', // TBD
});

export const PERCEPTION_MAX = 3;

// Perception stage 0..3, clamped. Anything not a finite number counts as 0.
export function clampStage(stage) {
  const n = Number(stage);
  // NaN counts as 0. +-Infinity clamp to the ends, like any other out-of-range number.
  if (Number.isNaN(n)) return 0;
  return Math.min(PERCEPTION_MAX, Math.max(0, Math.trunc(n)));
}

// The fields of one enemy action the player can see at a perception stage
// (DESIGN.md, Round flow and perception):
// - 0: { hidden: true }. Only that an action exists.
// - 1: { stanceGroup }.
// - 2: { stanceGroup, stance, damage }.
// - 3: the whole action, including speed and tags.
export function revealAction(action, stage) {
  const s = clampStage(stage);
  if (s === 0) return { hidden: true };
  if (!action || typeof action !== 'object') throw new TypeError('action must be an object');
  const stance = action.stance ?? null;
  const stanceGroup = stance !== null && Object.hasOwn(STANCE_GROUPS, stance) ? STANCE_GROUPS[stance] : null;
  if (s === 1) return { stanceGroup };
  if (s === 2) return { stanceGroup, stance, damage: Number(action.damage ?? 0) };
  return { ...action, tags: Array.isArray(action.tags) ? [...action.tags] : [] };
}

// Card hint thresholds on the speed difference (placeholder, TBD: DESIGN.md
// open question s). delta >= strong: '>>'. delta >= slight: '>'. Mirror for '<'.
export const SPEED_TIERS = { strong: 2, slight: 1 };

// Speed terms in display order, as [breakdown term, actionSpeed part key].
const BREAKDOWN_TERMS = [
  ['base', 'card'],
  ['weapon', 'weapon'],
  ['armor', 'armor'],
  ['range', 'range'],
  ['attackType', 'attackType'],
  ['skill', 'skill'],
  ['initiative', 'initiative'],
  ['momentum', 'momentum'],
];

// Left-edge arrow for a speed difference (player minus enemy), or null at 0.
function speedArrow(delta) {
  if (delta >= SPEED_TIERS.strong) return { glyph: '>>', colour: 'green' };
  if (delta >= SPEED_TIERS.slight) return { glyph: '>', colour: 'yellow' };
  if (delta <= -SPEED_TIERS.strong) return { glyph: '<<', colour: 'red' };
  if (delta <= -SPEED_TIERS.slight) return { glyph: '<', colour: 'yellow' };
  return null;
}

// UI hint for one player card against one enemy action (DESIGN.md, Card hints).
//
// card:        { card, weapon, armor, range, attackType, skill, initiative ids,
//                stance, target }. target 'self' marks a self-target card (skills).
// enemyAction: same speed ids, plus stance.
// ctx:         { mods, stanceAdvantage, momentum }. mods is the speed-mods table,
//              stanceAdvantage the Map from parseStanceAdvantage(), momentum the
//              M_e for this enemy (default 0).
//
// Returns { border, speedDelta, arrow, breakdown }:
// - border: self-target -> 'blue'. Otherwise 'green' when the card is faster
//   and its stance beats the enemy's, 'yellow' when only one holds, 'red' when
//   neither does.
// - speedDelta: player total minus enemy total (momentum included).
// - arrow: { glyph, colour } from SPEED_TIERS, or null when the delta is 0.
//   Self-target cards always have arrow null.
// - breakdown: the player's speed terms [{ term, value }], ending with momentum
//   (trunc(M_e / 2)). The values sum to the player total.
// Speed unknown (a revealAction() result below stage 3, no speed components):
// speedDelta and arrow are null, and the border uses stance only. A known stance
// gives yellow (stance advantage) or red. An unknown stance gives 'grey'.
export function cardHint(card, enemyAction, ctx = {}) {
  if (!card || typeof card !== 'object') throw new TypeError('card must be an object');
  if (!enemyAction || typeof enemyAction !== 'object') throw new TypeError('enemyAction must be an object');
  const mods = ctx.mods ?? {};
  const momentum = clampMomentum(ctx.momentum ?? 0);
  const player = actionSpeed({ ...card, momentum }, mods, 'player');
  const enemy = actionSpeed({ ...enemyAction, momentum }, mods, 'enemy');
  const breakdown = BREAKDOWN_TERMS.map(([term, key]) => ({ term, value: player.parts[key] }));

  if (card.target === 'self') {
    return { border: 'blue', speedDelta: player.total - enemy.total, arrow: null, breakdown };
  }
  // A revealed action below stage 3 has no speed components, so its speed is
  // unknown and no speed delta is shown. The stance is known from stage 2 (the
  // key is present, even when null). Stage 1 shows only the group: grey.
  const speedKnown = SPEED_COMPONENTS.some((k) => enemyAction[k] !== undefined);
  const stanceKnown = Object.hasOwn(enemyAction, 'stance');
  // Same rule as momentum: an advantage is a stance bonus above 0.
  const stanceAdv = stanceKnown && stanceBonus(ctx.stanceAdvantage ?? null, card.stance, enemyAction.stance) > 0;
  if (!speedKnown) {
    return { border: stanceKnown ? (stanceAdv ? 'yellow' : 'red') : 'grey', speedDelta: null, arrow: null, breakdown };
  }
  const speedDelta = player.total - enemy.total;
  const speedAdv = player.total > enemy.total;
  let border = 'red';
  if (speedAdv && stanceAdv) border = 'green';
  else if (speedAdv || stanceAdv) border = 'yellow';
  return { border, speedDelta, arrow: speedArrow(speedDelta), breakdown };
}

// The side that wins the slot with this event, or null. A landed hit or a
// counter that fires is a success (DESIGN.md, Momentum).
function successSide(e) {
  if (e.type === 'hit' && e.hit === true && !e.blocked && !e.avoided) return e.by;
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
//   momentum of that action's enemy: the player adds half of M_e, the enemy adds -half of M_e.
// perception:  number of queued actions visible to the player. It only tags
//              events with `visible`. Thresholds are open (DESIGN.md, Open q. e).
// options.momentum: { [enemyId]: M_e } at the start of the round (default 0 each).
// options.evadeBonuses: scoped evade bonuses, filtered here by scope, round,
//   combatId and appliesTo (see inputBonuses below). Default none.
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
  const chargeIn = options.charges ?? {};
  if (typeof chargeIn !== 'object' || Array.isArray(chargeIn)) {
    throw new TypeError('options.charges must be an object keyed by side or enemy id');
  }
  const visibleCount = Math.max(0, Math.min(enemyQueue.length, Math.trunc(Number(perception) || 0)));
  const inputM = options.momentum ?? {};
  // Scoped evade bonuses from the caller (DESIGN.md, Evade bonus scopes). Each
  // bonus has an owner, `side`: 'player' (the default) or an enemy id. It only
  // helps defences by that owner. An exchange bonus attaches to the card or
  // action named by appliesTo. Other scopes apply to every defence of the owner
  // when appliesTo is unset, or only to the named one when it is set.
  const inputBonuses = normalizeEvadeBonuses(options.evadeBonuses);
  const attaches = (b, id, who) => (b.side ?? 'player') === who
    && (b.appliesTo == null ? b.scope !== 'exchange' : b.appliesTo === id);
  const bonusesFor = (id, who) => activeEvadeBonuses(
    inputBonuses.filter((b) => attaches(b, id, who)),
    { inExchange: true, round: options.round, combatId: options.combatId },
  );
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

  // Intangible charge pools for the round (DESIGN.md, Evasion): one for the
  // player, one per enemy. Each starts from options.charges, else from the
  // largest intangibleCharges of that side's cards (or of that enemy's queued
  // actions), and is spent in place.
  const largestCharges = (entries) => Math.max(0, ...entries.map((e) => chargeCount(e.intangibleCharges)));
  const charges = { player: 0 };
  charges.player = chargeCount(chargeIn.player ?? largestCharges(playerCards));
  for (const enemy of enemyQueue) {
    const k = enemyKey(enemy);
    if (k === 'player') throw new TypeError('an enemy id cannot be "player"');
    if (!(k in charges)) {
      const own = enemyQueue.filter((e) => enemyKey(e) === k);
      charges[k] = chargeCount(chargeIn[k] ?? largestCharges(own));
    }
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
    const pool = { player: charges.player, enemy: charges[k] };
    const pairEvents = resolvePair(
      { ...pc, speed: pc.speed + momentumSpeed(start[k]), evadeBonuses: [...normalizeEvadeBonuses(pc.evadeBonuses), ...bonusesFor(pc.id, 'player')] },
      { ...enemy, speed: enemy.speed - momentumSpeed(start[k]), evadeBonuses: [...normalizeEvadeBonuses(enemy.evadeBonuses), ...bonusesFor(enemy.id, k)] },
      rng,
      { round: options.round, combatId: options.combatId, evadeTable: options.evadeTable, charges: pool },
    );
    charges.player = pool.player;
    charges[k] = pool.enemy;
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
    if (counterWin && pairEvents.some((e) => e.type === 'status' && e.status === 'stagger' && e.target === other(counterWin.by))) {
      const sign = counterWin.by === 'player' ? 1 : -1;
      fullSet[k] = sign * MOMENTUM_MAX;
      push({ type: 'momentum', enemyId: k, by: counterWin.by, reason: 'counterStagger', set: fullSet[k], slot }, k);
    }
  });

  enemyQueue.forEach((enemy, slot) => {
    if (!paired.has(slot)) {
      push({ type: 'unpaired', slot, enemyId: enemyKey(enemy), visible: slot < visibleCount }, enemyKey(enemy));
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

  return { events, momentum, charges };
}
