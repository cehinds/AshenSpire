// alternative-combat-rounds: simultaneous action, pure resolver prototype.
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

// Writes an own property, so a key such as 'toString' or '__proto__' is stored
// as data, not read as an inherited member. Maps keyed by enemy id use this for
// returned objects, and Object.hasOwn for every membership check.
const setOwn = (obj, k, v) => Object.defineProperty(obj, k, { value: v, enumerable: true, writable: true, configurable: true });

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

// Momentum decay step (owner, 2026-10-11; DESIGN.md, Timing): moves m toward 0 by
// `step`, never past it. The input is clamped first. A step of 0 leaves m as it is.
// resolveRound uses it before pairing. A caller that shows a card hint for the
// current round passes the decayed M_e to cardHint, not the stored one.
export function decayMomentum(m, step = 1) {
  const s = Number(step);
  if (!Number.isFinite(s) || s < 0) throw new TypeError('decay step must be a finite number of 0 or more');
  const from = clampMomentum(m);
  const to = from > 0 ? Math.max(0, from - s) : Math.min(0, from + s);
  return to || 0;
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

// Hit when d20 + accuracy + attributeBonus >= 8 + evasion (DESIGN.md, Hit roll).
// The required die is clamped to HIT_NEED_MIN..HIT_NEED_MAX, so a hit is at
// least 25% and a miss at most 75%. `need` is that clamped die.
export const HIT_NEED_MIN = 2;
export const HIT_NEED_MAX = 16;
export function hitRoll({ accuracy = 0, attrs = {}, evasion = 0 } = {}, d20) {
  if (!Number.isInteger(d20) || d20 < 1 || d20 > 20) {
    throw new RangeError(`d20 must be an integer 1..20, got ${d20}`);
  }
  const bonus = Number(accuracy || 0) + attributeBonus(attrs);
  const target = AC_BASE + Number(evasion || 0);
  const need = Math.min(HIT_NEED_MAX, Math.max(HIT_NEED_MIN, target - bonus));
  // Natural 1 always misses (need is at least 2) and natural 20 always hits (need is at most 16).
  const hit = d20 !== 1 && d20 >= need;
  return { hit, need };
}

// Attack tags that change accuracy (DESIGN.md, Hit roll). Other tags add nothing.
export const ATTACK_TAG_ACCURACY = Object.freeze({ quick: 1, telegraphed: -2 });

// Accuracy = floor(STR + DEX + WIS/2 + INT/2) + floor(level / 5) + attack tag
// (DESIGN.md, Hit roll). `accuracy` is any extra flat bonus, and a plain numeric
// accuracy works on its own. The attribute term is attributeBonus().
export function accuracyFor({ attrs = {}, level = 0, tags = [], accuracy = 0 } = {}) {
  const lvl = Number(level ?? 0);
  let tagMod = 0;
  for (const t of Array.isArray(tags) ? tags : []) {
    if (Object.hasOwn(ATTACK_TAG_ACCURACY, t)) tagMod += ATTACK_TAG_ACCURACY[t];
  }
  const flat = Number(accuracy ?? 0);
  return attributeBonus(attrs)
    + (Number.isFinite(lvl) ? Math.floor(lvl / 5) : 0)
    + tagMod
    + (Number.isFinite(flat) ? flat : 0);
}

// Parses evasion-armor.csv (armor,base,dexCap) into a Map from armor name to
// { base, dexCap } (DESIGN.md, Hit roll).
export function parseEvasionArmor(text) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const header = (lines.shift() ?? '').split(',').slice(0, 3).join(',');
  if (header !== 'armor,base,dexCap') throw new TypeError('evasion-armor.csv: unexpected header');
  const table = new Map();
  for (const line of lines) {
    const [armor, baseCell, capCell] = line.split(',');
    const base = Number(baseCell);
    const dexCap = Number(capCell);
    if (!Number.isFinite(base) || !Number.isFinite(dexCap)) {
      throw new TypeError(`evasion-armor.csv: bad row "${line}"`);
    }
    table.set(armor, { base, dexCap });
  }
  return table;
}

// Parses evasion-cards.csv (card,bonus) into a Map from card name to bonus.
export function parseEvasionCards(text) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const header = (lines.shift() ?? '').split(',').slice(0, 2).join(',');
  if (header !== 'card,bonus') throw new TypeError('evasion-cards.csv: unexpected header');
  const table = new Map();
  for (const line of lines) {
    const [card, bonusCell] = line.split(',');
    const bonus = Number(bonusCell);
    if (!Number.isFinite(bonus)) throw new TypeError(`evasion-cards.csv: bad bonus in "${line}"`);
    table.set(card, bonus);
  }
  return table;
}

// Evasion (DESIGN.md, Hit roll): armor base + min(DEX - 1, armor DEX cap) + shield
// + card bonus + `evasion` (any extra flat bonus). `tables` is { armor, cards }
// from parseEvasionArmor and parseEvasionCards. A missing armor counts as Cloth,
// and a missing DEX adds nothing. The DEX term is never negative. A buckler adds
// 1 and any other shield adds 0. A card not in the table adds 0.
// With none of armor, dex, shield or card given, the result is the plain
// `evasion` number, so existing callers are unchanged.
export const SHIELD_EVASION = Object.freeze({ buckler: 1 });

export function evasionFor({ armor, dex, shield, card, evasion = 0 } = {}, tables = {}) {
  const flat = Number(evasion ?? 0);
  const extra = Number.isFinite(flat) ? flat : 0;
  if (armor == null && dex == null && shield == null && card == null) return extra;
  const armorName = armor ?? 'Cloth';
  const row = tables?.armor?.get(armorName);
  if (!row) throw new RangeError(`unknown armor "${armorName}"`);
  const dexNum = Number(dex ?? 1);
  const dexTerm = Math.max(0, Math.min(dexNum - 1, row.dexCap)) || 0;
  const shieldBonus = shield != null && Object.hasOwn(SHIELD_EVASION, shield) ? SHIELD_EVASION[shield] : 0;
  const cardBonus = card == null ? 0 : (tables?.cards?.get(card) ?? 0);
  return row.base + dexTerm + shieldBonus + cardBonus + extra;
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

// Evade percent cap (owner, 2026-10-11; DESIGN.md, Evasion).
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

// One attack rolls its hit, then the target's avoids (DESIGN.md, Evasion). Shared
// by a paired pairing (resolvePair) and an unpaired enemy attack (resolveRound).
// Pushes its events to `events` and returns true when the attack lands.
// `options.poise` is { [who]: bool }: an armed side's landed hit carries
// poiseMultiplier 2 (DESIGN.md, Momentum: double poise). Poise damage is not modelled.
function rollAttack({ who, attacker, target, pool, rng, options, events }) {
  const targetKey = other(who);
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
  const chargesLeft = pool[targetKey];
  if (hit && !blocked) {
    if (target.tags.includes('intangible') && chargesLeft > 0) {
      avoid = 'intangible';
    } else {
      const exchangeCtx = { inExchange: true, round: options.round, combatId: options.combatId };
      const stanceEvade = stanceEvadeBonuses(target.stance, options.evadeTable);
      const evadePct = evadePctFor(
        { ...target, evadeBonuses: [...target.evadeBonuses, ...stanceEvade] },
        exchangeCtx,
      );
      if (evadePct > 0) {
        const roll = Math.floor(rollUnit(rng) * 100);
        evade = { evadePct, roll, success: roll < evadePct };
        if (evade.success) avoid = 'evasion';
      }
    }
  }
  const landed = hit && !blocked && avoid === null;
  const armed = landed && options.poise?.[who] === true;
  events.push({
    type: 'hit',
    by: who,
    target: targetKey,
    d20,
    hit,
    need,
    blocked,
    avoided: avoid !== null,
    ...(armed ? { poiseMultiplier: 2 } : {}),
  });
  if (evade) events.push({ type: 'evadeRoll', by: targetKey, target: who, ...evade });
  if (blocked) {
    events.push({ type: 'absorbed', by: targetKey, target: who });
  } else if (avoid === 'intangible') {
    pool[targetKey] -= 1;
    const remaining = pool[targetKey];
    events.push({ type: 'evaded', by: targetKey, target: who, reason: 'intangible', charges: remaining });
  } else if (avoid === 'evasion') {
    events.push({ type: 'evaded', by: targetKey, target: who, reason: 'evasion' });
  } else if (!hit && target.stance === 'evade') {
    // A miss against an evade action is also a dodge. The slot win comes from any miss (successSide).
    events.push({ type: 'evaded', by: targetKey, target: who });
  }
  return landed;
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
  // Shared charge pool by side, spent in this call (DESIGN.md, Evasion). A side
  // missing from options.charges uses its own intangibleCharges. The caller's
  // object is only written back at the end, for supplied sides whose charges changed.
  const supplied = options.charges ?? {};
  const pool = {};
  for (const who of SIDES) pool[who] = Object.hasOwn(supplied, who) ? supplied[who] : side[who].intangibleCharges;
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

  const rollHit = (who) => rollAttack({
    who,
    attacker: side[who],
    target: side[other(who)],
    pool,
    rng,
    options,
    events,
  });

  // Write back only the supplied sides whose charges were spent. A frozen
  // caller object with nothing spent is never written to.
  const settle = () => {
    for (const who of SIDES) {
      if (Object.hasOwn(supplied, who) && pool[who] !== supplied[who]) supplied[who] = pool[who];
    }
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
    settle();
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
  settle();
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
  if (s === 0) return { hidden: true, stage: 0 };
  if (!action || typeof action !== 'object') throw new TypeError('action must be an object');
  const stance = action.stance ?? null;
  const stanceGroup = stance !== null && Object.hasOwn(STANCE_GROUPS, stance) ? STANCE_GROUPS[stance] : null;
  if (s === 1) return { stanceGroup, stage: 1 };
  if (s === 2) return { stanceGroup, stance, damage: Number(action.damage ?? 0), stage: 2 };
  return { ...action, tags: Array.isArray(action.tags) ? [...action.tags] : [], stage: 3 };
}

// Card hint thresholds on the speed difference (owner, 2026-10-11: arrow tiers stay
// >=2 strong, >=1 slight; DESIGN.md open question s). delta >= strong: '>>'.
// delta >= slight: '>'. Mirror for '<'.
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
//              decayed M_e for this enemy for the current round (decayMomentum;
//              default 0). The stored value would not match resolveRound.
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
// Speed unknown (the action's stage below 3): speedDelta and arrow are null, and
// the border uses stance only. A known stance gives yellow (stance advantage) or
// red. An unknown stance gives 'grey'.
//
// Totals match resolveRound's pairing: a `speed` field wins (the player adds
// momentumSpeed(M), the enemy subtracts it). Without one, the component total
// from mods is used.
export function cardHint(card, enemyAction, ctx = {}) {
  if (!card || typeof card !== 'object') throw new TypeError('card must be an object');
  if (!enemyAction || typeof enemyAction !== 'object') throw new TypeError('enemyAction must be an object');
  const mods = ctx.mods ?? {};
  const momentum = clampMomentum(ctx.momentum ?? 0);
  const player = actionSpeed({ ...card, momentum }, mods, 'player');
  const enemy = actionSpeed({ ...enemyAction, momentum }, mods, 'enemy');
  const shift = momentumSpeed(momentum);
  const playerTotal = Number.isFinite(card.speed) ? card.speed + shift : player.total;
  const enemyTotal = Number.isFinite(enemyAction.speed) ? enemyAction.speed - shift : enemy.total;
  // The breakdown sums to playerTotal. With a `speed` field the total is that
  // field plus momentum, so the terms are speed and momentum.
  const breakdown = Number.isFinite(card.speed)
    ? [{ term: 'speed', value: card.speed }, { term: 'momentum', value: shift }]
    : BREAKDOWN_TERMS.map(([term, key]) => ({ term, value: player.parts[key] }));

  // Speed is known from stage 3 (a missing stage counts as 3). The stance is known
  // from stage 2 (the key is present, even when null). Stage 1 shows only the group: grey.
  const stage = enemyAction.stage ?? 3;
  const speedKnown = stage >= 3;
  if (card.target === 'self') {
    return { border: 'blue', speedDelta: speedKnown ? playerTotal - enemyTotal : null, arrow: null, breakdown };
  }
  const stanceKnown = stage >= 2 && Object.hasOwn(enemyAction, 'stance');
  // Same rule as momentum: an advantage is a stance bonus above 0.
  const stanceAdv = stanceKnown && stanceBonus(ctx.stanceAdvantage ?? null, card.stance, enemyAction.stance) > 0;
  if (!speedKnown) {
    return { border: stanceKnown ? (stanceAdv ? 'yellow' : 'red') : 'grey', speedDelta: null, arrow: null, breakdown };
  }
  const speedDelta = playerTotal - enemyTotal;
  const speedAdv = speedDelta > 0;
  let border = 'red';
  if (speedAdv && stanceAdv) border = 'green';
  else if (speedAdv || stanceAdv) border = 'yellow';
  return { border, speedDelta, arrow: speedArrow(speedDelta), breakdown };
}

// The side that wins the slot with this event, or null (DESIGN.md, Momentum). A
// landed hit or a counter that fires is the attacker's success. Any miss is the
// defender's success, whatever the defender did (owner, 2026-10-11).
function successSide(e) {
  if (e.type === 'hit' && e.hit === true && !e.blocked && !e.avoided) return e.by;
  if (e.type === 'hit' && e.hit === false) return other(e.by);
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
//   Decays before pairing (see options.decay below).
// options.decay: momentum decay step per round (default 1, 0 turns it off).
// options.evadeBonuses: scoped evade bonuses, filtered here by scope, round,
//   combatId and appliesTo (see inputBonuses below). Default none.
// options.playerDefense: { evasion, evadePct, tags } for the player against an
//   unpaired enemy attack. Default evasion 0, evadePct 0, no tags. The
//   'intangible' tag draws on the player's pool in options.charges.
// options.poiseDouble: { player?, [enemyId]: bool } flags from an earlier round. A
//   flagged side's first landed hit this round carries poiseMultiplier 2 and clears
//   the flag. Poise damage itself is not modelled.
//
// Returns { events, momentum, charges, poiseDouble }. `momentum` is { [enemyId]: M_e }
// after the round. `poiseDouble` is { player, [enemyId]: bool } after the round: a
// side's flag is set at round end when its success overflows M_e (see below).
// Momentum updates at round end (DESIGN.md, Momentum):
// - Before any pairing, each enemy's M_e moves 1 toward 0 (options.decay, default 1,
//   0 turns it off). A 'momentum' event with reason 'decay' marks each change.
// - Every pairing in the round uses the round's decayed starting M_e.
// - Each slot win moves M_e toward the winner by the card's momentumGain
//   (default 1), plus the stance bonus. Any miss is the defender's success.
//   A side wins a slot at most once per pairing. A counter that staggers adds +-3 on top of its slot win. The
//   deltas are summed per enemy, then clamped once to -3..3. Opposing staggers
//   net naturally (owner, 2026-10-11).
// - Pair events carry `momentum`: that enemy's starting M_e. A 'momentum'
//   event marks each slot win and each counter stagger (`delta`).
//   'momentumApplied' marks each round-end change.
// - A second player card on an already paired slot is rejected ('rejected').
// - An enemy slot with no player card is 'unpaired'. Its events carry unpaired: true.
//   An unpaired enemy attack rolls its hit against options.playerDefense. A landed
//   hit wins the slot for that enemy. A miss or an avoid gives the player no credit
//   (owner, 2026-10-11). The events are still emitted. An unpaired non-attack action does nothing.
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
  const inputPoise = options.poiseDouble ?? {};
  if (typeof inputPoise !== 'object' || Array.isArray(inputPoise)) {
    throw new TypeError('options.poiseDouble must be an object keyed by side or enemy id');
  }

  // Momentum decay (owner, 2026-10-11; DESIGN.md, Timing): before any pairing,
  // each enemy's M_e moves `decayStep` toward 0 (never past it). 0 turns it off.
  const decayStep = options.decay === undefined ? 1 : Number(options.decay);
  if (!Number.isFinite(decayStep) || decayStep < 0) {
    throw new TypeError('options.decay must be a finite number of 0 or more');
  }
  const events = [];
  const decayed = (k) => {
    const from = clampMomentum(Object.hasOwn(inputM, k) ? inputM[k] : 0);
    const to = decayMomentum(from, decayStep);
    if (to !== from) events.push({ type: 'momentum', reason: 'decay', enemyId: k, from, to, delta: to - from, by: null });
    return to;
  };

  // Starting M_e (after decay) for each enemy in the queue, and for each enemy
  // only in options.momentum. Every pairing uses these values. Internal maps are
  // null-prototype, so no enemy id can read an inherited member.
  const start = Object.create(null);
  for (const enemy of enemyQueue) {
    const k = enemyKey(enemy);
    if (!Object.hasOwn(start, k)) start[k] = decayed(k);
  }
  for (const k of Object.keys(inputM)) {
    if (!Object.hasOwn(start, k)) start[k] = decayed(k);
  }

  // Intangible charge pools for the round (DESIGN.md, Evasion): one for the
  // player, one per enemy. Each starts from options.charges, else from the
  // largest intangibleCharges of that side's cards (or of that enemy's queued
  // actions), and is spent in place.
  // Every side in options.charges is kept, even one with no queued action this
  // round, so its charges carry over. Sides not given take the queue defaults.
  const largestCharges = (entries) => Math.max(0, ...entries.map((e) => chargeCount(e.intangibleCharges)));
  // Only cards that will be accepted fund the default player pool: a valid slot,
  // and the first card on that slot. A rejected duplicate adds no charges.
  const acceptedPlayer = [];
  const claimedSlots = new Set();
  playerCards.forEach((pc, i) => {
    const slot = pc.slot;
    if (!Number.isInteger(slot) || slot < 0 || slot >= enemyQueue.length) {
      throw new RangeError(`playerCards[${i}].slot must be an integer in 0..${enemyQueue.length - 1}`);
    }
    if (claimedSlots.has(slot)) return;
    claimedSlots.add(slot);
    acceptedPlayer.push(pc);
  });
  const charges = Object.create(null);
  for (const [key, v] of Object.entries(chargeIn)) charges[key] = chargeCount(v);
  if (!Object.hasOwn(charges, 'player')) charges.player = largestCharges(acceptedPlayer);
  for (const enemy of enemyQueue) {
    const k = enemyKey(enemy);
    if (k === 'player') throw new TypeError('an enemy id cannot be "player"');
    if (!Object.hasOwn(charges, k)) {
      const own = enemyQueue.filter((e) => enemyKey(e) === k);
      charges[k] = largestCharges(own);
    }
  }

  // The player as the target of an unpaired enemy attack (DESIGN.md, Open question d).
  const defence = options.playerDefense ?? {};
  if (typeof defence !== 'object' || Array.isArray(defence)) {
    throw new TypeError('options.playerDefense must be an object');
  }
  const playerDefender = normalizeSide('player', {
    speed: 0,
    kind: 'other',
    evasion: defence.evasion,
    evadeBasePct: defence.evadePct,
    tags: defence.tags,
    evadeBonuses: bonusesFor(null, 'player'),
  });

  // Poise flags (owner, 2026-10-11; DESIGN.md, Momentum). Null-prototype, keyed by
  // 'player' or by enemy id. A side's first landed hit this round spends its flag.
  const poise = Object.create(null);
  for (const [key, v] of Object.entries(inputPoise)) poise[key] = Boolean(v);
  const spendPoise = (evs, k) => {
    for (const e of evs) {
      if (e.type !== 'hit' || e.poiseMultiplier !== 2) continue;
      if (e.by === 'player') poise.player = false;
      else poise[k] = false;
    }
  };

  const pending = Object.create(null); // summed raw deltas per enemy, applied at round end
  const paired = new Set();
  const push = (e, k = null) => events.push({ ...e, momentum: k === null ? null : start[k] });

  // Pushes one slot's events and credits its slot wins (DESIGN.md, Momentum). `pc`
  // is the player's card, or null for an unpaired slot, where the player side
  // uses the defaults (gain 1, no stance). `extra` marks unpaired slots.
  const settleSlot = (slotEvents, { pc, enemy, k, slot, visible, extra }) => {
    const credited = new Set();
    for (const e of slotEvents) {
      push({ ...e, slot, visible, ...extra }, k);
      const winner = successSide(e);
      // Owner, 2026-10-11: on an unpaired slot the player gets no credit, whether the
      // enemy's attack misses or is avoided. Only the enemy's landed hit moves momentum.
      if (pc === null && winner === 'player') continue;
      // A side wins a slot at most once per pairing, however many of its successes it makes.
      if (winner && !credited.has(winner)) {
        credited.add(winner);
        const card = winner === 'player' ? (pc ?? {}) : enemy;
        const foe = winner === 'player' ? enemy : (pc ?? {});
        const gain = gainOf(card);
        // Stance advantage adds to the success (owner's rule: "adds bonus momentum").
        const bonus = stanceBonus(stanceTable, card.stance, foe.stance);
        const delta = (winner === 'player' ? 1 : -1) * (gain + bonus);
        pending[k] = (pending[k] ?? 0) + delta;
        push({ type: 'momentum', enemyId: k, by: winner, gain, bonus, delta, reason: 'success', slot, ...extra }, k);
      }
    }
    // A counter that staggers its target adds +-3 to its side's summed delta, on
    // top of the slot win above (owner, 2026-10-11). Clamped once at round end.
    const counterWin = slotEvents.find((e) => e.type === 'countered');
    if (counterWin && slotEvents.some((e) => e.type === 'status' && e.status === 'stagger' && e.target === other(counterWin.by))) {
      const sign = counterWin.by === 'player' ? 1 : -1;
      const delta = sign * MOMENTUM_MAX;
      pending[k] = (pending[k] ?? 0) + delta;
      push({ type: 'momentum', enemyId: k, by: counterWin.by, reason: 'counterStagger', delta, slot, ...extra }, k);
    }
  };

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
    const armed = { player: poise.player === true, enemy: poise[k] === true };
    const pairEvents = resolvePair(
      { ...pc, speed: pc.speed + momentumSpeed(start[k]), evadeBonuses: [...normalizeEvadeBonuses(pc.evadeBonuses), ...bonusesFor(pc.id, 'player')] },
      { ...enemy, speed: enemy.speed - momentumSpeed(start[k]), evadeBonuses: [...normalizeEvadeBonuses(enemy.evadeBonuses), ...bonusesFor(enemy.id, k)] },
      rng,
      { round: options.round, combatId: options.combatId, evadeTable: options.evadeTable, charges: pool, poise: armed },
    );
    charges.player = pool.player;
    charges[k] = pool.enemy;
    spendPoise(pairEvents, k);
    settleSlot(pairEvents, { pc, enemy, k, slot, visible, extra: {} });
  });

  enemyQueue.forEach((enemy, slot) => {
    if (paired.has(slot)) return;
    const k = enemyKey(enemy);
    const visible = slot < visibleCount;
    const extra = { unpaired: true };
    push({ type: 'unpaired', slot, enemyId: k, visible, kind: enemy.kind ?? 'other', unpaired: true }, k);
    // Only an attack has an effect on an unpaired slot. It rolls against the player's defence.
    if ((enemy.kind ?? 'other') !== 'attack') return;
    const attacker = normalizeSide('enemy', enemy);
    const pool = { player: charges.player, enemy: charges[k] };
    const slotEvents = [];
    rollAttack({
      who: 'enemy',
      attacker,
      target: playerDefender,
      pool,
      rng,
      options: { round: options.round, combatId: options.combatId, evadeTable: options.evadeTable, poise: { enemy: poise[k] === true } },
      events: slotEvents,
    });
    charges.player = pool.player;
    charges[k] = pool.enemy;
    spendPoise(slotEvents, k);
    settleSlot(slotEvents, { pc: null, enemy, k, slot, visible, extra });
  });

  // Round end: sum each enemy's deltas (slot wins and counter staggers alike),
  // then clamp once. Opposing staggers net naturally. Order of playerCards does not matter.
  const momentum = {};
  for (const k of Object.keys(start)) {
    const from = start[k];
    const raw = from + (pending[k] ?? 0);
    const to = clampMomentum(raw);
    setOwn(momentum, k, to);
    if (to !== from) {
      events.push({ type: 'momentumApplied', enemyId: k, from, delta: to - from, to, momentum: to });
    }
    // Overflow (owner, 2026-10-11): a summed success past the limit gives that side
    // double poise on its next landed hit. Only a player success can push past +3.
    if (raw > MOMENTUM_MAX) {
      events.push({ type: 'momentum', reason: 'overflow', enemyId: k, side: 'player', delta: 0, by: null });
      poise.player = true;
    }
    if (raw < MOMENTUM_MIN) {
      events.push({ type: 'momentum', reason: 'overflow', enemyId: k, side: 'enemy', delta: 0, by: null });
      poise[k] = true;
    }
  }

  // Returned maps are plain objects, filled by own-property writes only.
  const outCharges = {};
  for (const k of Object.keys(charges)) setOwn(outCharges, k, charges[k]);
  const poiseDouble = {};
  setOwn(poiseDouble, 'player', poise.player === true);
  for (const k of new Set([...Object.keys(start), ...Object.keys(poise)])) {
    if (k !== 'player') setOwn(poiseDouble, k, poise[k] === true);
  }

  return { events, momentum, charges: outCharges, poiseDouble };
}
