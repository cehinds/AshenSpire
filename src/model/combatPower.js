// src/model/combatPower.js — the combat-power scorer, shared by the game and the standalone card/item simulator.
//
// Pure and dependency-free (it is bundled into the simulator): no DOM, no engine, no content registry. The only import is the generated
// scoring table (content/source/scoring.json). Every export takes an optional `scoring` override so the simulator can pass edited
// weights; no weight lives in this file. The arithmetic (order of operations, rounding) mirrors the simulator it was ported from, so a
// card or item scores the same number here and there.
//
//   raw  = effect power after costs, over 3 rounds (ScoreCard / ScoreItem)
//   cp   = raw - rarity discount (CombatPower)
//   rank = Unranked (cp <= 0), Rank k for cp (width*(k-1)+1)..(width*k), capped at maxRank; rank.maxCp (40) bounds generated cards while authored top rank is open-ended (RankOf)
//
// A face is the simulator's card model: {name, cls, rarity, camp, type, sp, mp, dmg, hits, blk, poise, statuses: [[id, stacks, 'enemy'|'self']],
// kw, tags, draw, heal, loseHp, discard, restoreSp, restoreMp, cleanse, counter, reflect, pull, move, holdOne, boost, cull, shuffle, copy, attr}.
// An item is {kind, id, name, rarity, base, mods: [[key, n]], props: [tag], tags, poise, range, attackBase, magicShare, guardBase, art}; the
// property rules its `props` name are passed as `rules` ({tag: {triggers, passives}}).
import { GetActiveScoring } from './activeScoring.js';
import { CountFaceDrawbacks } from './cardLimits.js';
import { scoring as shippedScoring } from '../content/generated/scoring.js';
import { EffectiveCostGrowth, EffectiveWitherLimit, MechanicRule } from './combatMechanics.js';

/** Round half away from zero (the simulator's `rnd`). */
export const Rnd = (x) => (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5) + 0); // + 0 keeps -0 out

/** A blank card face; callers spread their own fields over it. */
export const BaseFace = () => ({
  name: '', cls: 'colorless', rarity: 'common', camp: 'physical', type: 'attack', sp: 1, mp: 0, dmg: 0, hits: 1, blk: 0, poise: 0, statuses: [], kw: [], tags: [],
  draw: 0, heal: 0, loseHp: 0, discard: 0, restoreSp: 0, restoreMp: 0, cleanse: 0, counter: 0, reflect: 0, pull: 0, move: 0, holdOne: 0, boost: 0, cull: 0, shuffle: 0, copy: 0, attr: 0,
});

const PLAIN_CARD_KINDS = ['power', 'curse', 'status'];

/** A card's play style from its type and tags: attack, skill, spell, sweep, counter, defend, power, curse or status. */
export function CardKind(face) {
  const tags = face.tags || [];
  if (PLAIN_CARD_KINDS.includes(face.type)) return face.type;
  if (face.camp === 'spell' || tags.includes('camp:spell') || tags.includes('maneuver:casting')) return 'spell';
  for (const kind of ['sweep', 'counter', 'defend']) if (tags.includes(`maneuver:${kind}`)) return kind;
  return face.type === 'attack' || tags.some((t) => ['maneuver:attack', 'maneuver:smash', 'maneuver:ranged'].includes(t)) ? 'attack' : 'skill';
}

/** The scoring categories a face belongs to: Martial and/or Magic (and Hybrid when both), then its play style. A face may list its own (`categories`). */
export function CardCategories(face) {
  if (Array.isArray(face.categories)) return face.categories;
  // A physical hit with a magic share (the game's packet hit) is both.
  const hybrid = face.camp !== 'spell' && face.magicShare > 0;
  return [face.camp === 'spell' ? 'magic' : 'martial', ...(hybrid ? ['magic', 'hybrid'] : []), CardKind(face)];
}

// The slim view of a scoring table: just what the scorer reads. Not cached: the simulator edits weights in place.
function slimOf(full) {
  const tags = {};
  for (const [k, v] of Object.entries(full.tags || {})) {
    if (k[0] === '$' || !v || !(v.weight || v.multiplier || v.pMultiplier || v.perN)) continue;
    const o = {};
    for (const kk of ['weight', 'per', 'multiplier', 'pMultiplier', 'perN', 'surchargeEnabled']) if (kk in v) o[kk] = v[kk];
    tags[k] = o;
  }
  return {
    full, model: full.model, tags, keywords: full.keywords,
    costs: Object.fromEntries(Object.entries(full.costs).map(([k, v]) => [k, v.weight])),
    effects: Object.fromEntries(Object.entries(full.effects).map(([k, v]) => [k, [v.weight, v.per]])),
    statuses: Object.fromEntries(Object.entries(full.statuses).map(([k, v]) => [k, [v.weight, v.target]])),
    // Owner 2026-11-27: a cost, effect or status with `multiplier: true` scores P x weight x units instead of weight x units.
    multiplied: { costs: multipliedKeys(full.costs), effects: multipliedKeys(full.effects), statuses: multipliedKeys(full.statuses) },
    decayOne: new Set(full.cardModel.decayOneStatuses),
  };
}

const multipliedKeys = (section) => new Set(Object.entries(section || {}).filter(([, v]) => v && v.multiplier === true).map(([k]) => k));

const triOf = (S, n) => { let s = 0; for (let t = 0; t < S.model.R; t++) s += Math.max(n - t, 0); return s; };
const ew = (S, k, amt) => S.effects[k][0] * amt / S.effects[k][1];

// Closed forms for the statuses whose value is not weight x stacks (numbers from scoring.cardModel).
function exactStatus(S, id, n) {
  const M = S.model, tick = S.full.cardModel.tickDamageTakenPerStack;
  switch (id) {
    case 'burn': return triOf(S, n) * (1 + tick * M.D);
    case 'venom': return triOf(S, n);
    case 'shock': return triOf(S, n) * tick * (M.I + M.D);
    case 'chill': return triOf(S, n) * tick * M.I + n / S.full.cardModel.chillStacksPerStamina;
    default: return null;
  }
}

export function UpgradeTagFor(family, stacks) {
  const n = Math.max(0, Math.floor(Number(stacks) || 0));
  if (n <= 0) return null;
  if (n === 1) return `upgrade:${family}`;
  if (n === 2) return `upgrade:${family}+`;
  return `upgrade:${family}+${n - 1}`;
}

export function ParseUpgradeTag(tag) {
  const m = /^upgrade:([a-zA-Z]+)(?:\+(\d*))?$/.exec(String(tag || ''));
  if (!m) return null;
  const family = m[1];
  const plus = tag.includes('+');
  const stacks = !plus ? 1 : (m[2] ? 1 + Number(m[2]) : 2);
  return { family, stacks };
}

export function UpgradeTagLabel(tag) {
  const parsed = ParseUpgradeTag(tag);
  if (!parsed) return String(tag || '');
  const base = parsed.family[0].toUpperCase() + parsed.family.slice(1);
  if (parsed.stacks === 1) return base;
  if (parsed.stacks === 2) return `${base}+`;
  return `${base} +${parsed.stacks - 1}`;
}

/**
 * Compute CP surcharge for a stacking upgrade tag (Efficient, Improved, ExtraEffect, DrawbackEase, IdentityShift, GearAttribute).
 * Supports toggling surcharges off (`surchargeEnabled: false`), flat doubling tiers (`base * 2^(n-1)` or `stacks[n-1]`),
 * and compounding multiplicative scaling (`positiveScore * ((1 + pMultiplier)^n - 1)`).
 */
export function UpgradeTagSurcharge(rule, stacks, positiveScore = 0) {
  const n = Math.max(0, Math.floor(Number(stacks) || 0));
  if (!rule || rule.surchargeEnabled === false || n <= 0) return 0;
  if (rule.mode === 'multiplicative') {
    const mult = Number.isFinite(rule.pMultiplier) ? rule.pMultiplier : 0.1;
    return Math.max(0, positiveScore) * (Math.pow(1 + mult, n) - 1);
  }
  if (Array.isArray(rule.stacks) && rule.stacks.length) {
    if (n <= rule.stacks.length && Number.isFinite(rule.stacks[n - 1])) return rule.stacks[n - 1];
    const last = Number(rule.stacks[rule.stacks.length - 1]) || Number(rule.base) || 0;
    return last * Math.pow(2, n - rule.stacks.length);
  }
  const base = Number(rule.base) || 0;
  return rule.escalate === 'linear' ? base * n : base * Math.pow(2, n - 1);
}

/** A count rule's CP: weight per counted item, or P x weight per item with `multiplier: true`. */
export function CountSurcharge(rule, positive, count) {
  return rule.multiplier === true ? positive * rule.weight * count : rule.weight * count;
}

/** Score a card face: {raw, parts, positive}. `positive` is P, the sum of the positive non-cost parts. */
export function ScoreCard(c, scoring = GetActiveScoring(), context = null) {
  return scorePrepared(c, scoring, slimOf(scoring), context);
}

/** Compile only for one read-only operation; create a new scorer after edits. */
export function PrepareCardScorer(scoring = GetActiveScoring()) {
  const S = slimOf(scoring);
  return (card, context = null) => scorePrepared(card, scoring, S, context);
}

function scorePrepared(c, scoring, S, context) {
  const M = S.model, CM = scoring.cardModel;
  const parts = {};
  const add = (k, v) => { if (v) parts[k] = (parts[k] || 0) + v; };
  // `fx` mirrors only the effect parts (damage, block, statuses ...), so the effect count never mistakes a tag or keyword that
  // happens to share a part key with a status (a `venom` tag and the Venom status) for, or hides it from, an effect.
  const fx = {};
  const addFx = (k, v) => { add(k, v); if (v) fx[k] = (fx[k] || 0) + v; };
  // Multiplier-form costs, effects and statuses wait for P: [part key, weight, units, is an effect part].
  const deferred = [];
  const cost = (part, k, units) => {
    if (S.multiplied.costs.has(k)) deferred.push([part, S.costs[k], units, false]);
    else add(part, S.costs[k] * units);
  };
  const effect = (part, k, amt, scale = 1) => {
    if (S.multiplied.effects.has(k)) deferred.push([part, S.effects[k][0], amt / S.effects[k][1] * scale, true]);
    else addFx(part, ew(S, k, amt) * scale);
  };
  const area = c.tags.includes(CM.areaTag) ? M.ENEMIES : 1;
  cost('SP', 'sp', c.sp); cost('MP', 'mp', c.mp);
  effect('damage', 'damage', c.dmg, area);
  const blockBreakRule = MechanicRule('blockBreak', context);
  if (c.blockBreak && (!blockBreakRule || blockBreakRule.enabled !== false) && S.effects.blockBreak) {
    effect('blockBreak', 'blockBreak', c.blockBreak, area);
  }
  effect('block', 'block', c.blk);
  effect('poise', 'poiseDamage', c.poise, area);
  for (const [s, n, tgt] of c.statuses) {
    const st = S.statuses[s]; if (!st) continue;
    const self = tgt === 'self', good = (st[1] === 'self') === self;
    const exact = exactStatus(S, s, n);
    const scale = (good ? 1 : -1) * (self ? 1 : area);
    // Units: the formula value for a formula status (its flat form ignores the weight), else the stacks counted.
    if (S.multiplied.statuses.has(s)) deferred.push([s, st[0], (exact !== null ? exact : (S.decayOne.has(s) ? Math.min(n, M.R) : n)) * scale, true]);
    else {
      const v = exact !== null ? exact : st[0] * (S.decayOne.has(s) ? Math.min(n, M.R) : n);
      addFx(s, v * scale);
    }
  }
  effect('draw', 'draw', c.draw); effect('heal', 'heal', c.heal); effect('HP cost', 'loseHp', c.loseHp);
  effect('discard', 'discard', c.discard); effect('SP restore', 'restoreStamina', c.restoreSp); effect('MP restore', 'restoreMana', c.restoreMp);
  effect('cleanse', 'removeStatus', c.cleanse); effect('counter', 'counterStack', c.counter); effect('reflect', 'applyReflect', c.reflect);
  effect('pull', 'pullEnemy', c.pull); effect('move', 'moveEngagement', c.move);
  const U = CM.utility;
  addFx('utility', c.holdOne * U.holdOne + c.boost * U.boost + c.cull * U.cull + c.shuffle * U.shuffle + c.attr * U.attr);
  for (const t of c.tags) {
    const w = S.tags[t]; if (!w || w.surchargeEnabled === false || !w.weight) continue;
    add(t, w.weight * (w.per === 'hit' ? Math.max(1, c.hits) * area : 1));
  }
  if (c.tags.includes(CM.honedTag) && S.tags[CM.honedTag]?.surchargeEnabled !== false) add(CM.honedTag, S.tags[CM.honedTag].perN);
  const P = Object.entries(parts).filter(([k, v]) => k !== 'SP' && k !== 'MP' && v > 0).reduce((s, [, v]) => s + v, 0);
  // Multiplier-form entries scale with P and never feed it (as categories do): a -0.1 SP weight takes 10% of P per SP.
  for (const [part, weight, units, isEffect] of deferred) (isEffect ? addFx : add)(part, P * weight * units);
  // A pMultiplier tag adds P x pMultiplier, once per hit (and per enemy) when its flat form counts hits (owner, 2026-11-27).
  for (const t of c.tags) { const w = S.tags[t]; if (w && w.surchargeEnabled !== false && w.pMultiplier) add(t, P * w.pMultiplier * (w.per === 'hit' ? Math.max(1, c.hits) * area : 1)); }
  // Counterstrike as a multiplier scales P; set flat (weight, no multiplier) it scored in the tag loop above.
  const cs = S.tags[CM.counterstrikeTag];
  if (c.tags.includes(CM.counterstrikeTag) && cs && cs.surchargeEnabled !== false && Number.isFinite(cs.multiplier)) add('counterstrike', P * (cs.multiplier - 1));
  if (c.copy) add('copy', P / CM.copyDivisor * c.copy);
  for (const k of c.kw) {
    const d = S.keywords[k]; if (!d || d.surchargeEnabled === false) continue;
    let v = d.flat ?? P * d.multiplier;
    if (d.min !== undefined) v = d.min < 0 ? Math.min(v, d.min) : Math.max(v, d.min);
    add(k, v);
  }
  const witherLimit = !c.kw.includes('exhaust') ? EffectiveWitherLimit(c, context) : null;
  if (witherLimit && S.keywords.wither && S.keywords.wither.surchargeEnabled !== false) {
    const d = S.keywords.wither;
    let v = (d.flat ?? P * d.multiplier) / witherLimit;
    if (d.min !== undefined) v = d.min < 0 ? Math.min(v, d.min) : Math.max(v, d.min);
    add('wither', v);
  }
  const growth = EffectiveCostGrowth(c, context);
  if (growth && S.keywords.costGrowth && S.keywords.costGrowth.surchargeEnabled !== false) {
    const d = S.keywords.costGrowth;
    const stepSize = (growth.stamina || 0) + (growth.mana || 0);
    let v = d.flat !== undefined ? d.flat * stepSize : P * d.multiplier;
    if (d.min !== undefined) v = d.min < 0 ? Math.min(v, d.min) : Math.max(v, d.min);
    add('costGrowth', v);
  }
  // Stacking upgrade tags (Efficient, Improved, ExtraEffect, DrawbackEase, IdentityShift)
  const UT = scoring.upgradeTags;
  if (UT) {
    for (const t of c.tags) {
      const parsed = ParseUpgradeTag(t);
      if (!parsed || !UT[parsed.family]) continue;
      const surcharge = UpgradeTagSurcharge(UT[parsed.family], parsed.stacks, P);
      if (surcharge) add(UpgradeTagLabel(t), surcharge);
    }
  }
  // Owner 2026-11-21 (scoring.effectCount): + weight per distinct real effect type scoring > 0, beyond the first (skipFirst).
  // Not effects: costs, tag bonuses, keywords, multipliers (only `fx` parts count, so a tag sharing a status's part key cannot hide it); a rider (Poise) counts only on a card with no damage.
  const EC = scoring.effectCount;
  if (EC && EC.surchargeEnabled !== false && EC.weight) {
    const notEffect = new Set(['SP', 'MP', 'HP cost', 'discard']);
    const riders = new Set(EC.riders || []);
    const n = Object.entries(fx).filter(([k, v]) => v > 0 && !notEffect.has(k) && !(riders.has(k) && fx.damage > 0)).length;
    const extra = Math.max(0, n - (EC.skipFirst ? 1 : 0));
    add('effect count', CountSurcharge(EC, P, extra));
  }
  // scoring.drawbackCount: weight per drawback CARD_LIMITS counts (ops, keywords, debuffs on self).
  const DC = scoring.drawbackCount;
  if (DC && DC.surchargeEnabled !== false && DC.weight) {
    add('drawback count', CountSurcharge(DC, P, CountFaceDrawbacks(c).length));
  }
  // Owner 2026-11-23 (scoring.categories): each category the card belongs to adds its weight, or with `multiplier` on
  // scales the positive score by it (1 = no change).
  const CAT = scoring.categories;
  if (CAT) for (const k of CardCategories(c)) {
    const w = CAT[k];
    if (!w || w.surchargeEnabled === false || !Number.isFinite(w.weight)) continue;
    if (w.multiplier) add(`category:${k}`, P * (w.weight - 1));
    else add(`category:${k}`, w.weight);
  }
  const raw = Rnd(Object.values(parts).reduce((s, v) => s + v, 0));
  return { raw, parts, positive: P };
}

function rarityDiscount(scoring, rarity) {
  const cards = scoring.rarity.discount, items = scoring.items?.rarityDiscount;
  if (cards && Object.hasOwn(cards, rarity)) return cards[rarity] || 0;
  return items && Object.hasOwn(items, rarity) ? items[rarity] || 0 : 0;
}

/** Combat power: raw score minus the rarity discount (cards and items share one table; boss comes from scoring.items.rarityDiscount). */
export function CombatPower(raw, rarity, scoring = GetActiveScoring()) {
  return raw - rarityDiscount(scoring, rarity);
}

/** Rank number from combat power: 0 = Unranked, 1..maxRank. */
export function RankOf(cp, scoring = GetActiveScoring()) {
  const RK = scoring.rank;
  return cp <= RK.unrankedMax ? 0 : Math.min(RK.maxRank, Math.ceil(cp / RK.width));
}
export const RankName = (k) => (k === 0 ? 'Unranked' : 'Rank ' + k);
/** The combat-power band of a rank, as text; it matches RankOf (Rank 1 starts just above unrankedMax, every later rank is `width` wide). */
export function RankRange(k, scoring = GetActiveScoring()) {
  const RK = scoring.rank;
  if (k === 0) return `<= ${RK.unrankedMax}`;
  const lo = k === 1 ? RK.unrankedMax + 1 : RK.width * (k - 1) + 1;
  return k === RK.maxRank ? (RK.maxCp ? `${lo}-${RK.maxCp}` : `>= ${lo}`) : `${lo}-${RK.width * k}`;
}

/** Apply an optional per-card/item override ({raw, cp, rank, rarity}) to a scored row; returns row unchanged when absent. */
export function ApplyScoringOverride(row, override, scoring = GetActiveScoring()) {
  if (!override || typeof override !== 'object') return row;
  const hasRarity = typeof override.rarity === 'string' && override.rarity.length > 0;
  const hasRaw = Number.isFinite(override.raw);
  const hasCp = Number.isFinite(override.cp);
  const hasRank = Number.isInteger(override.rank);
  if (!hasRarity && !hasRaw && !hasCp && !hasRank) return row;
  const rarity = hasRarity ? override.rarity : row.rarity;
  const raw = hasRaw ? override.raw : row.raw;
  const cp = hasCp ? override.cp : CombatPower(raw, rarity, scoring);
  const rank = hasRank ? Math.max(0, Math.min(scoring.rank.maxRank, override.rank)) : RankOf(cp, scoring);
  return { ...row, raw, cp, rank, rarity, overridden: true };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------------------------------------------
function refValue(S, ref) {
  if (typeof ref === 'number') return ref;
  const neg = ref[0] === '-', name = neg ? ref.slice(1) : ref, [group, key] = name.split('.');
  let v;
  if (group === 'model') v = S.model[key];
  else if (group === 'plays') v = S.full.items.plays[key];
  else if (group === 'costs') v = S.costs[key];
  else if (group === 'status') v = S.statuses[key] ? S.statuses[key][0] : 1;
  else throw new Error(`combatPower: unknown scoring reference ${ref}`);
  return neg ? -v : v;
}
function applyCalc(S, n, steps) {
  let v = n;
  for (const [op, x] of steps) { const r = refValue(S, x); v = op === '*' ? v * r : v / r; }
  return v;
}
function parseGearModKey(key) {
  const dot = String(key || '').lastIndexOf('.');
  if (dot <= 0) return null;
  const head = key.slice(0, dot), field = key.slice(dot + 1);
  const parts = head.split('@');
  const [selector, arg = null] = parts[0].split(':');
  return { selector, arg, condCount: Math.max(0, parts.length - 1), field };
}
function modOf(S, key) {
  const mods = S.full.items.mods || {};
  if (mods[key]) return mods[key];
  for (const [k, m] of Object.entries(mods)) if (m.prefix && key.startsWith(k)) return m;
  const parsed = parseGearModKey(key);
  const gearFields = S.full.items.gearFields || {};
  if (parsed && gearFields[parsed.field]) {
    const gf = gearFields[parsed.field];
    const selFactors = S.full.items.selectorFactors || {};
    const selFactor = Object.prototype.hasOwnProperty.call(selFactors, parsed.selector) ? selFactors[parsed.selector] : 1;
    const condFactor = Math.pow(S.full.items.conditionFactor ?? 0.65, parsed.condCount);
    const argFactor = parsed.arg ? 0.6 : 1;
    return {
      label: gf.label || parsed.field,
      field: parsed.field,
      calc: [['*', gf.weight * selFactor * condFactor * argFactor]],
    };
  }
  return { label: key, calc: S.full.items.unmodelledMod.calc };
}
/** Label of an item modifier key ("strike.damage" -> "Strike damage", "self.statPoise" -> "Poise bonus"). */
export const ModLabel = (key, scoring = GetActiveScoring()) => modOf(slimOf(scoring), key).label;
/** Points of one item modifier at value n. */
export function ModValue(key, n, scoring = GetActiveScoring()) {
  const S = slimOf(scoring), m = modOf(S, key), x = +n || 0;
  const start = m.pre === 'extraHits' ? Math.max(0, x - 1) : m.pre === 'flag' ? (x ? 1 : 0) : x;
  return applyCalc(S, start, m.calc);
}

function opValueOf(S, op) {
  const a = typeof op.amount === 'number' ? op.amount : 1;
  if (op.op === 'applyStatus') {
    const st = S.statuses[op.status], n = typeof op.stacks === 'number' ? op.stacks : 1;
    if (!st) return n;
    const self = op.target === 'self' || op.target === 'owner' || op.target === 'player';
    return st[0] * n * ((st[1] === 'self') === self ? 1 : -1);
  }
  const table = S.full.items.propertyTriggers.opCalc;
  const e = Object.prototype.hasOwnProperty.call(table, op.op) && typeof table[op.op] === 'object' ? table[op.op] : table.default;
  return 'flat' in e ? e.flat : applyCalc(S, a, e.calc);
}
/** Points of one property-rule op (restoreMana, draw, applyStatus, ...). */
export const OpValue = (op, scoring = GetActiveScoring()) => opValueOf(slimOf(scoring), op);

/** Points of a property rule ({triggers: [{on, cond, once, perTurn, everyNth, do}], passives}) over 3 rounds. */
export function PropertyValue(rule, scoring = GetActiveScoring()) {
  if (!rule) return 0;
  const S = slimOf(scoring), PT = scoring.items.propertyTriggers, freq = PT.frequencyIn3Rounds;
  let v = 0;
  for (const t of rule.triggers || []) {
    let f = freq[t.on] ?? PT.defaultFrequency;
    if (t.once) f = Math.min(f, PT.onceCap);
    if (t.perTurn) f = Math.min(f, t.perTurn * S.model.R);
    if (Number.isFinite(t.everyNth) && t.everyNth > 1) f /= t.everyNth;
    else if (t.cond) f *= PT.conditionalFactor;
    v += f * (t.do || []).reduce((s, op) => s + opValueOf(S, op), 0);
  }
  if (rule.passives) v += PT.passiveValue * Object.keys(rule.passives).length;
  return v;
}

/**
 * Score an item: {raw, disc, cp, parts}. `rules` maps each property tag in item.props to its rule.
 * Item raw rounds with Math.round (half toward +infinity), as the simulator does; card raw rounds half away from zero.
 */
export function ScoreItem(it, scoring = GetActiveScoring(), rules = {}) {
  const S = slimOf(scoring), M = S.model, I = scoring.items, plays = I.plays;
  const parts = {};
  const allMods = [...(it.typeMods || []), ...(it.mods || [])];
  for (const [k, n] of allMods) { const v = ModValue(k, n, scoring); const label = ModLabel(k, scoring); if (v) parts[label] = (parts[label] || 0) + v; }
  for (const t of it.props || []) { const v = PropertyValue(rules[t], scoring); if (v) parts['prop:' + t] = (parts['prop:' + t] || 0) + v; }
  if ((it.passives || (it.triggers && it.triggers.length)) && !(it.props && it.props.length)) {
    const v = PropertyValue({ passives: it.passives || null, triggers: it.triggers || [] }, scoring);
    if (v) parts['Relic effect'] = (parts['Relic effect'] || 0) + v;
  }
  for (const t of it.tags || []) { if (t.startsWith('range:')) continue; const w = S.tags[t]; if (w && w.surchargeEnabled !== false && w.weight) parts[t] = w.weight * (w.per === 'hit' ? plays.strike : 1); }
  if (it.kind === 'weapon') {
    const atkAuth = it.magicShare ? (1 - it.magicShare) * M.AUTH_PHYS + it.magicShare * M.AUTH_SPELL : M.AUTH_PHYS;
    const atk = ((it.attackBase ?? I.kit.unarmedAttack) - I.kit.unarmedAttack) * atkAuth * plays.strike; if (atk) parts['Attack profile'] = atk;
    const grd = ((it.guardBase ?? I.kit.unarmedGuard) - I.kit.unarmedGuard) * M.AUTH_BLOCK / 2 * plays.defend; if (grd) parts['Guard profile'] = grd;
    if (it.art) { const a = ScoreCard(Object.assign(BaseFace(), JSON.parse(JSON.stringify(it.art))), scoring).raw * plays.weaponArt; if (a) parts['Weapon art: ' + it.art.name] = a; }
    if (typeof it.poiseDamage === 'number' && I.weaponPoiseDamage) {
      const wpd = (it.poiseDamage - (I.weaponPoiseDamage.baseline ?? 1)) * (I.weaponPoiseDamage.perPoint ?? 1);
      if (wpd) parts['Weapon Poise'] = wpd;
    }
  }
  // Only armour's poiseThreshold is Poise (a weapon's poiseThreshold is its equip weight; SPEC §13.4k).
  if (typeof it.poise === 'number' && it.poise > 0 && it.kind === 'armour') {
    const pv = (it.poise - (I.poiseThreshold.baseline || 0)) * I.poiseThreshold.perPoint;
    if (pv > 0) parts['Poise threshold'] = pv;
  }
  // Item range: read items.range when present (skip reach if already granted via cardReach mod so it is never double-counted).
  const rg = it.range ? 'range:' + it.range : null;
  if (rg && !(it.range === 'reach' && parts['Reach'])) {
    const rw = I.range && Number.isFinite(I.range[it.range]) ? I.range[it.range] : (S.tags[rg]?.weight ? S.tags[rg].weight * plays.strike : 0);
    if (rw) parts[rg] = rw;
  }
  // Flat gear attribute surcharge (configurable flat doubling or multiplicative in scoring.upgradeTags.gearAttribute)
  const attrRule = scoring.upgradeTags?.gearAttribute;
  if (attrRule && attrRule.surchargeEnabled !== false && (it.kind === 'weapon' || it.kind === 'armour')) {
    const STAT_ATTR_RE = /\.stat(Str|Dex|Con|Int|Wis)$/;
    const totalAttr = (it.mods || []).reduce((sum, [k, n]) => (STAT_ATTR_RE.test(String(k)) && Number(n) > 0 ? sum + Number(n) : sum), 0);
    if (totalAttr > 0) {
      const pos = Object.values(parts).filter((v) => v > 0).reduce((s, v) => s + v, 0);
      const surcharge = UpgradeTagSurcharge(attrRule, totalAttr, pos);
      if (surcharge) parts['Gear attribute surcharge'] = surcharge;
    }
  }
  const raw = Math.round(Object.values(parts).reduce((s, v) => s + v, 0)) + 0;
  const disc = rarityDiscount(scoring, it.rarity);
  return { raw, disc, cp: raw - disc, parts };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Naming: rarity word + second-effect word + element word (magic) + base word + rank numeral + upgrade mark
// ---------------------------------------------------------------------------------------------------------------------------------
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const numeral = (N, rk) => N.roman[rk] || '';

/** Upgrade mark: '' for none, '+' for one, '+N' for N, written straight after the last word. */
export const UpgradeMark = (ups) => (ups > 0 ? (ups === 1 ? '+' : `+${ups}`) : '');

// Words in name order; the upgrade mark is attached to the last word. These parts are never dropped by the length limit.
const NAME_ORDER = ['rarity', 'effect', 'element', 'base', 'rank'];
const NEVER_DROPPED = new Set(['base', 'rank', 'upgrade']);
const joinName = (words, mark) => NAME_ORDER.map((k) => words[k]).filter(Boolean).join(' ') + mark;

/**
 * Apply naming.card.limit ({maxChars, keep}, keep = most important first): while the name is longer than maxChars, drop the
 * least important droppable part (from the end of keep). Base, rank and upgrade stay even when still too long. No limit = no trim.
 */
function fitCardName(words, mark, limit) {
  const kept = { ...words }, dropped = [];
  if (!limit || !Number.isFinite(limit.maxChars)) return { name: joinName(kept, mark), dropped };
  const order = (Array.isArray(limit.keep) ? limit.keep : []).filter((k) => !NEVER_DROPPED.has(k) && k in kept).reverse();
  for (const k of order) {
    if (joinName(kept, mark).length <= limit.maxChars) break;
    if (!kept[k]) continue;
    kept[k] = null; dropped.push(k);
  }
  return { name: joinName(kept, mark), dropped };
}

// Two words share a stem when their first STEM_LETTERS letters match, ignoring case.
const STEM_LETTERS = 4;
const sharesStem = (a, b) => Boolean(a && b) && a.slice(0, STEM_LETTERS).toLowerCase() === b.slice(0, STEM_LETTERS).toLowerCase();

// A card is magic when it is a spell, carries camp:spell, or is a hybrid hit with a magic share (magic words win).
const isMagicFace = (c) => c.camp === 'spell' || (c.tags || []).includes('camp:spell') || c.magicShare > 0;

// A scoring table's naming words over the shipped ones, so a custom table saved before a naming table existed still names cards.
function NamingOf(scoring)
{
  const own = scoring.naming || {};
  // limit is optional (absent = no limit), so it never falls back.
  const { limit: cardLimit, ...shippedCardWords } = shippedScoring.naming.card;
  const { limit: itemLimit, ...shippedItemWords } = shippedScoring.naming.item;
  const ownItem = own.item || {};
  return {
    ...shippedScoring.naming,
    ...own,
    card: { ...shippedCardWords, ...(own.card || {}) },
    item: {
      ...shippedItemWords,
      ...ownItem,
      mod: { ...(shippedItemWords.mod || {}), ...(ownItem.mod || {}) },
      op: { ...(shippedItemWords.op || {}), ...(ownItem.op || {}) },
      base: { ...(shippedItemWords.base || {}), ...(ownItem.base || {}) },
      rarity: { ...(shippedItemWords.rarity || {}), ...(ownItem.rarity || {}) },
    },
  };
}

/**
 * Parts of a card's convention name (owner, 2026-11-24):
 *   <rarity word> <second-effect word> <element word (magic only)> <base word> <rank numeral><upgrade mark>
 * Returns {name, rarityWord, effect, element, base, rank, upgrades, source, baseSource}. Every word is data in scoring.naming.card.
 */
export function CardNameParts(c, ups = 0, scoring = GetActiveScoring()) {
  const N = NamingOf(scoring), G = N.card;
  const s = ScoreCard(c, scoring);
  const tags = c.tags || [];
  const magic = isMagicFace(c), campKey = magic ? 'magic' : 'martial';
  // Base word: a maneuver word, else attacks by camp and range (area keeps Cleave / Wave), else the camp's skill word.
  const man = tags.find((t) => t.startsWith('maneuver:') && G.base[t]);
  const area = tags.includes(scoring.cardModel.areaTag);
  const isAttack = c.type === 'attack' || c.dmg > 0;
  const rangeTag = tags.find((t) => G.range[t]);
  const range = rangeTag ? G.range[rangeTag] : G.defaultRange[campKey];
  const baseKey = man || (isAttack ? (area ? `attack:area:${campKey}` : `attack:${campKey}:${range}`) : `skill:${campKey}`);
  const base = G.base[baseKey];
  // Element word, magic only: the school or damage element, else the tradition (one of them alone), else the default tradition.
  let element = null;
  if (magic) {
    const elementTag = tags.find((t) => t.startsWith('school:') && G.element[t]) || tags.find((t) => t.startsWith('damage:') && G.element[t]);
    const traditions = tags.filter((t) => G.tradition[t]);
    element = elementTag ? G.element[elementTag] : traditions.length === 1 ? G.tradition[traditions[0]] : G.defaultTradition;
  }
  // Second-effect word: the highest-scoring part the base word does not already name. Attack bases name damage; a skill base
  // names nothing, so its top effect is the word; maneuvers follow the DUP table.
  // A range-built base (Strike, Shot, Touch, Bolt) also names its range tag.
  const named = new Set(!man && isAttack ? ['damage', ...(area ? [] : Object.keys(G.range))] : []);
  const DUP = { block: ['maneuver:defend', 'maneuver:counter'], counter: ['maneuver:counter'], evade: ['maneuver:evade'], 'maneuver:smash': ['maneuver:smash'], 'maneuver:sweep': ['maneuver:sweep'] };
  const top = Object.entries(s.parts).filter(([k, v]) => k !== 'SP' && k !== 'MP' && v > 0).sort((x, y) => y[1] - x[1]);
  const dmgV = s.parts.damage || 0;
  let effect = null, source = null;
  for (const [k, v] of top) {
    if (named.has(k) || (DUP[k] && DUP[k].includes(man))) continue;
    if (k === 'poise' && dmgV > 0 && v <= dmgV * 1.5) continue;
    const w = G.effect[k] ?? G.element[k];
    if (!w) continue;
    if (w === '@element') {
      const dmgTag = tags.find((t) => t.startsWith('damage:') && G.element[t]);
      effect = magic ? element : (dmgTag ? G.element[dmgTag] : G.fallback.damage);
    } else effect = w;
    source = k; break;
  }
  // No repeated stem: the effect word goes when it starts like the element or base word (Warded Warding Rite -> Warding Rite).
  if (effect && [element, base].some((word) => sharesStem(effect, word))) effect = null;
  const rk = RankOf(CombatPower(s.raw, c.rarity, scoring), scoring);
  const rarityWord = (G.rarity && G.rarity[c.rarity]) || null;
  const words = { rarity: rarityWord, effect, element, base, rank: numeral(N, rk) };
  const { name, dropped } = fitCardName(words, UpgradeMark(ups), G.limit);
  return { name, rarityWord, effect, element, base, rank: rk, upgrades: ups, source, baseSource: baseKey, dropped };
}
/** A card's convention name after the length limit: "Greater Searing Frost Bolt II+" in full (30 characters) is "Searing Frost Bolt II+" at 24. */
export const CardName = (c, ups = 0, scoring = GetActiveScoring()) => CardNameParts(c, ups, scoring).name;

function propWord(tag, rules, scoring) {
  const S = slimOf(scoring), W = NamingOf(scoring), p = rules[tag];
  if (!p) return null;
  let best = null, bv = -1;
  for (const t of p.triggers || []) for (const op of t.do || []) { const v = Math.abs(opValueOf(S, op)); if (v > bv) { bv = v; best = op; } }
  if (!best) return p.passives ? 'Blessed' : null;
  if (best.op === 'applyStatus') return W.card.effect[best.status] || null;
  return W.item.op[best.op] || null;
}

// A weapon art names its item by the art card's effect word, or its element, or the plain damage word.
function weaponArtWord(art, scoring) {
  const p = CardNameParts(Object.assign(BaseFace(), JSON.parse(JSON.stringify(art))), 0, scoring);
  return p.effect || p.element || NamingOf(scoring).card.fallback.damage;
}

const ITEM_ELEMENT_HINTS = Object.freeze([
  ['fire', 'Flame'], ['burn', 'Flame'], ['ember', 'Flame'],
  ['frost', 'Frost'], ['chill', 'Frost'],
  ['lightning', 'Storm'], ['shock', 'Storm'],
  ['blight', 'Blight'], ['decay', 'Blight'],
  ['divine', 'Divine'], ['sacred', 'Divine'], ['holy', 'Divine'],
  ['arcane', 'Arcane'], ['dark', 'Shadow'],
]);

const ELEMENT_SYNONYMS = Object.freeze({
  Flame: ['searing', 'scorching', 'ember', 'flame', 'fire', 'burn'],
  Frost: ['freezing', 'chilling', 'frost', 'rime', 'ice'],
  Storm: ['shocking', 'crackling', 'storm', 'lightning', 'thunder'],
  Blight: ['blighted', 'withering', 'blight', 'decay', 'rot'],
  Divine: ['divine', 'sacred', 'radiant', 'holy', 'hallowed'],
  Arcane: ['arcane', 'channeling', 'resonant'],
  Shadow: ['shadow', 'dark', 'night'],
});
const sameElementConcept = (el, word) => Boolean(el && word) && (sharesStem(el, word) || (ELEMENT_SYNONYMS[el] || []).some((s) => word.toLowerCase().startsWith(s.slice(0, 4))));

function itemElementWord(it, parts) {
  const keys = [
    ...(it.tags || []),
    ...(it.mods || []).map(([k]) => k),
    ...(it.typeMods || []).map(([k]) => k),
    ...Object.keys(parts || {}),
  ].join(' ').toLowerCase();
  for (const [needle, word] of ITEM_ELEMENT_HINTS) {
    if (keys.includes(needle)) return word;
  }
  return null;
}

/**
 * Parts of an item's convention name (matching CardNameParts):
 *   <rarity word> <effect/trait word> <element word> <base word> <rank numeral><upgrade mark>
 * Returns {name, rarityWord, effect, element, base, rank, upgrades, source, dropped}.
 */
export function ItemNameParts(it, ups = 0, scoring = GetActiveScoring(), rules = {}) {
  const W = NamingOf(scoring), I = W.item, s = ScoreItem(it, scoring, rules);
  const lastWord = String(it.name || '').trim().split(/\s+/).pop() || '';
  const typeKey = it.gearType || it.gearGroup || it.base || '';
  const relicSuffixes = I.relicSuffixes || [];
  const base = it.kind === 'armour' && (W.itemArmourSuffixes || []).includes(lastWord) ? lastWord
    : it.kind === 'relic' && relicSuffixes.includes(lastWord) ? lastWord
      : I.base[typeKey] || I.base[it.base || '']
        || (String(typeKey).startsWith('staff') ? 'Staff' : it.kind === 'armour' ? 'Robes' : it.kind === 'relic' ? 'Relic' : cap(typeKey || it.kind || 'Item'));

  // Pick the highest-scoring positive part as the trait/effect word; skip generic baseline parts when a stronger trait exists.
  const positive = Object.entries(s.parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const nonBaseline = positive.filter(([k]) => !['Attack profile', 'Guard profile', 'Weapon Poise', 'Poise threshold', 'range:reach', 'range:ranged'].includes(k));
  const ordered = nonBaseline.length ? [...nonBaseline, ...positive.filter(([k]) => !nonBaseline.some(([nk]) => nk === k))] : positive;
  let effect = null, source = 'none';
  for (const [k] of ordered) {
    const word = k.startsWith('prop:') ? propWord(k.slice(5), rules, scoring)
      : k.startsWith('Weapon art: ') ? weaponArtWord(it.art, scoring)
        : I.mod[k] || W.card.effect[k] || W.card.element[k] || null;
    if (!word) continue;
    if (sharesStem(word, base)) continue;
    effect = word;
    source = k;
    break;
  }
  let element = itemElementWord(it, s.parts);
  if (element && (sameElementConcept(element, base) || sameElementConcept(element, effect))) element = null;
  const rk = RankOf(s.cp, scoring);
  const rarityWord = (I.rarity && I.rarity[it.rarity]) || null;
  const words = { rarity: rarityWord, effect, element, base, rank: numeral(W, rk) };
  const limit = I.limit !== undefined ? I.limit : scoring.naming?.card?.limit;
  const { name, dropped } = fitCardName(words, UpgradeMark(ups), limit);
  return { name, rarityWord, effect, element, base, rank: rk, upgrades: ups, source, dropped };
}
/** An item's convention name. */
export const ItemName = (it, ups = 0, scoring = GetActiveScoring(), rules = {}) => ItemNameParts(it, ups, scoring, rules).name;

// ---------------------------------------------------------------------------------------------------------------------------------
// Enemy combat power (pre-existing export of this module, used by levelup.js for XP weight; unrelated to the card and item scoring above)
// ---------------------------------------------------------------------------------------------------------------------------------
// A defeated enemy's XP weight. The three contributions are additive so gear
// nudges the reward without multiplying the effect of a high level or HP roll.
const enemyReference = Object.freeze({ hp: 24, poise: 10, attack: 8 });

export function enemyCombatPower(registries, enemy) {
  const def = enemy?.enemyId && registries?.enemies?.has?.(enemy.enemyId)
    ? registries.enemies.get(enemy.enemyId) : null;
  // Older receipts and the level-pace example have no enemy definition. Their
  // reference power is explicit rather than guessing combat stats from 0 HP.
  if (!def) return Number.isFinite(enemy?.combatPower) && enemy.combatPower >= 0 ? enemy.combatPower : 3;

  const level = Number.isSafeInteger(enemy.level) && enemy.level > 0 ? enemy.level : 1;
  const hp = Number.isFinite(enemy.maxHp) ? enemy.maxHp : (def.hp[0] + def.hp[1]) / 2;
  const poise = Number.isFinite(enemy.poiseMeter?.max) ? enemy.poiseMeter.max : def.poiseMax;
  const attack = Math.max(0, ...Object.values(def.moves || {}).filter((move) => move.intent === 'attack')
    .map((move) => (move.damage || 0) * (move.hits || 1)));
  const damageMult = Number.isFinite(enemy.damageMult) ? enemy.damageMult : 1;
  const stats = (hp / enemyReference.hp + poise / enemyReference.poise + attack * damageMult / enemyReference.attack) / 3;
  return 1 + level / 5 + stats + (def.equipmentPower || 0);
}
