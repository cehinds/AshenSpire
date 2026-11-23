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
import { scoring as shippedScoring } from '../content/generated/scoring.js';

/** Round half away from zero (the simulator's `rnd`). */
export const Rnd = (x) => (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5) + 0); // + 0 keeps -0 out

/** A blank card face; callers spread their own fields over it. */
export const BaseFace = () => ({
  name: '', cls: 'colorless', rarity: 'common', camp: 'physical', type: 'attack', sp: 1, mp: 0, dmg: 0, hits: 1, blk: 0, poise: 0, statuses: [], kw: [], tags: [],
  draw: 0, heal: 0, loseHp: 0, discard: 0, restoreSp: 0, restoreMp: 0, cleanse: 0, counter: 0, reflect: 0, pull: 0, move: 0, holdOne: 0, boost: 0, cull: 0, shuffle: 0, copy: 0, attr: 0,
});

// The slim view of a scoring table: just what the scorer reads. Not cached: the simulator edits weights in place.
function slimOf(full) {
  const tags = {};
  for (const [k, v] of Object.entries(full.tags || {})) {
    if (k[0] === '$' || !v || !(v.weight || v.multiplier || v.pMultiplier || v.perN)) continue;
    const o = {};
    for (const kk of ['weight', 'per', 'multiplier', 'pMultiplier', 'perN']) if (kk in v) o[kk] = v[kk];
    tags[k] = o;
  }
  return {
    full, model: full.model, tags, rank: full.rank, keywords: full.keywords,
    costs: Object.fromEntries(Object.entries(full.costs).map(([k, v]) => [k, v.weight])),
    effects: Object.fromEntries(Object.entries(full.effects).map(([k, v]) => [k, [v.weight, v.per]])),
    statuses: Object.fromEntries(Object.entries(full.statuses).map(([k, v]) => [k, [v.weight, v.target]])),
    decayOne: new Set(full.cardModel.decayOneStatuses),
    discount: { ...(full.items?.rarityDiscount || {}), ...full.rarity.discount }, // rarity.discount first; items.rarityDiscount adds boss
  };
}

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

/** Score a card face: {raw, parts, positive}. `positive` is P, the sum of the positive non-cost parts. */
export function ScoreCard(c, scoring = shippedScoring) {
  const S = slimOf(scoring), M = S.model, CM = scoring.cardModel;
  const parts = {};
  const add = (k, v) => { if (v) parts[k] = (parts[k] || 0) + v; };
  // `fx` mirrors only the effect parts (damage, block, statuses ...), so the effect count never mistakes a tag or keyword that
  // happens to share a part key with a status (a `venom` tag and the Venom status) for, or hides it from, an effect.
  const fx = {};
  const addFx = (k, v) => { add(k, v); if (v) fx[k] = (fx[k] || 0) + v; };
  const area = c.tags.includes(CM.areaTag) ? M.ENEMIES : 1;
  add('SP', S.costs.sp * c.sp); add('MP', S.costs.mp * c.mp);
  addFx('damage', ew(S, 'damage', c.dmg) * area);
  addFx('block', ew(S, 'block', c.blk));
  addFx('poise', ew(S, 'poiseDamage', c.poise) * area);
  for (const [s, n, tgt] of c.statuses) {
    const st = S.statuses[s]; if (!st) continue;
    const self = tgt === 'self', good = (st[1] === 'self') === self;
    const exact = exactStatus(S, s, n);
    const v = exact !== null ? exact : st[0] * (S.decayOne.has(s) ? Math.min(n, M.R) : n);
    addFx(s, v * (good ? 1 : -1) * (self ? 1 : area));
  }
  addFx('draw', ew(S, 'draw', c.draw)); addFx('heal', ew(S, 'heal', c.heal)); addFx('HP cost', ew(S, 'loseHp', c.loseHp));
  addFx('discard', ew(S, 'discard', c.discard)); addFx('SP restore', ew(S, 'restoreStamina', c.restoreSp)); addFx('MP restore', ew(S, 'restoreMana', c.restoreMp));
  addFx('cleanse', ew(S, 'removeStatus', c.cleanse)); addFx('counter', ew(S, 'counterStack', c.counter)); addFx('reflect', ew(S, 'applyReflect', c.reflect));
  addFx('pull', ew(S, 'pullEnemy', c.pull)); addFx('move', ew(S, 'moveEngagement', c.move));
  const U = CM.utility;
  addFx('utility', c.holdOne * U.holdOne + c.boost * U.boost + c.cull * U.cull + c.shuffle * U.shuffle + c.attr * U.attr);
  for (const t of c.tags) {
    const w = S.tags[t]; if (!w || !w.weight) continue;
    add(t, w.weight * (w.per === 'hit' ? Math.max(1, c.hits) * area : 1));
  }
  if (c.tags.includes(CM.honedTag)) add(CM.honedTag, S.tags[CM.honedTag].perN);
  const P = Object.entries(parts).filter(([k, v]) => k !== 'SP' && k !== 'MP' && v > 0).reduce((s, [, v]) => s + v, 0);
  for (const t of c.tags) { const w = S.tags[t]; if (w && w.pMultiplier) add(t, P * w.pMultiplier); }
  if (c.tags.includes(CM.counterstrikeTag)) add('counterstrike', P * (S.tags[CM.counterstrikeTag].multiplier - 1));
  if (c.copy) add('copy', P / CM.copyDivisor * c.copy);
  for (const k of c.kw) {
    const d = S.keywords[k]; if (!d) continue;
    let v = d.flat ?? P * d.multiplier;
    if (d.min !== undefined) v = d.min < 0 ? Math.min(v, d.min) : Math.max(v, d.min);
    add(k, v);
  }
  // Owner 2026-11-21 (scoring.effectCount): + weight per distinct real effect type scoring > 0, beyond the first (skipFirst).
  // Not effects: costs, tag bonuses, keywords, multipliers (only `fx` parts count, so a tag sharing a status's part key cannot hide it); a rider (Poise) counts only on a card with no damage.
  const EC = scoring.effectCount;
  if (EC && EC.weight) {
    const notEffect = new Set(['SP', 'MP', 'HP cost', 'discard']);
    const riders = new Set(EC.riders || []);
    const n = Object.entries(fx).filter(([k, v]) => v > 0 && !notEffect.has(k) && !(riders.has(k) && fx.damage > 0)).length;
    add('effect count', EC.weight * Math.max(0, n - (EC.skipFirst ? 1 : 0)));
  }
  const raw = Rnd(Object.values(parts).reduce((s, v) => s + v, 0));
  return { raw, parts, positive: P };
}

/** Combat power: raw score minus the rarity discount (cards and items share one table; boss comes from scoring.items.rarityDiscount). */
export function CombatPower(raw, rarity, scoring = shippedScoring) {
  return raw - (slimOf(scoring).discount[rarity] || 0);
}

/** Rank number from combat power: 0 = Unranked, 1..maxRank. */
export function RankOf(cp, scoring = shippedScoring) {
  const RK = slimOf(scoring).rank;
  return cp <= RK.unrankedMax ? 0 : Math.min(RK.maxRank, Math.ceil(cp / RK.width));
}
export const RankName = (k) => (k === 0 ? 'Unranked' : 'Rank ' + k);
/** The combat-power band of a rank, as text; it matches RankOf (Rank 1 starts just above unrankedMax, every later rank is `width` wide). */
export function RankRange(k, scoring = shippedScoring) {
  const RK = slimOf(scoring).rank;
  if (k === 0) return `<= ${RK.unrankedMax}`;
  const lo = k === 1 ? RK.unrankedMax + 1 : RK.width * (k - 1) + 1;
  return k === RK.maxRank ? (RK.maxCp ? `${lo}-${RK.maxCp}` : `>= ${lo}`) : `${lo}-${RK.width * k}`;
}

/** Apply an optional per-card/item override ({raw, cp, rank, rarity}) to a scored row; returns row unchanged when absent. */
export function ApplyScoringOverride(row, override, scoring = shippedScoring) {
  if (!override || typeof override !== 'object') return row;
  const hasRarity = typeof override.rarity === 'string' && override.rarity.length > 0;
  const hasRaw = Number.isFinite(override.raw);
  const hasCp = Number.isFinite(override.cp);
  const hasRank = Number.isInteger(override.rank);
  if (!hasRarity && !hasRaw && !hasCp && !hasRank) return row;
  const rarity = hasRarity ? override.rarity : row.rarity;
  const raw = hasRaw ? override.raw : row.raw;
  const cp = hasCp ? override.cp : CombatPower(raw, rarity, scoring);
  const rank = hasRank ? Math.max(0, Math.min(slimOf(scoring).rank.maxRank, override.rank)) : RankOf(cp, scoring);
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
function modOf(S, key) {
  const mods = S.full.items.mods;
  if (mods[key]) return mods[key];
  for (const [k, m] of Object.entries(mods)) if (m.prefix && key.startsWith(k)) return m;
  return { label: key, calc: S.full.items.unmodelledMod.calc };
}
/** Label of an item modifier key ("strike.damage" -> "Strike damage"). */
export const ModLabel = (key, scoring = shippedScoring) => modOf(slimOf(scoring), key).label;
/** Points of one item modifier at value n. */
export function ModValue(key, n, scoring = shippedScoring) {
  const S = slimOf(scoring), m = modOf(S, key), x = +n || 0;
  const start = m.pre === 'extraHits' ? Math.max(0, x - 1) : m.pre === 'flag' ? (x ? 1 : 0) : x;
  return applyCalc(S, start, m.calc);
}

function opValueOf(S, op) {
  const a = typeof op.amount === 'number' ? op.amount : 1;
  if (op.op === 'applyStatus') {
    const st = S.statuses[op.status], n = typeof op.stacks === 'number' ? op.stacks : 1;
    if (!st) return n;
    const self = op.target === 'self';
    return st[0] * n * ((st[1] === 'self') === self ? 1 : -1);
  }
  const table = S.full.items.propertyTriggers.opCalc;
  const e = Object.prototype.hasOwnProperty.call(table, op.op) && typeof table[op.op] === 'object' ? table[op.op] : table.default;
  return 'flat' in e ? e.flat : applyCalc(S, a, e.calc);
}
/** Points of one property-rule op (restoreMana, draw, applyStatus, ...). */
export const OpValue = (op, scoring = shippedScoring) => opValueOf(slimOf(scoring), op);

/** Points of a property rule ({triggers: [{on, cond, once, perTurn, do}], passives}) over 3 rounds. */
export function PropertyValue(rule, scoring = shippedScoring) {
  if (!rule) return 0;
  const S = slimOf(scoring), PT = scoring.items.propertyTriggers, freq = PT.frequencyIn3Rounds;
  let v = 0;
  for (const t of rule.triggers || []) {
    let f = freq[t.on] ?? PT.defaultFrequency;
    if (t.once) f = Math.min(f, PT.onceCap);
    if (t.perTurn) f = Math.min(f, t.perTurn * S.model.R);
    if (t.cond) f *= PT.conditionalFactor;
    v += f * (t.do || []).reduce((s, op) => s + opValueOf(S, op), 0);
  }
  if (rule.passives) v += PT.passiveValue * Object.keys(rule.passives).length;
  return v;
}

/**
 * Score an item: {raw, disc, cp, parts}. `rules` maps each property tag in item.props to its rule.
 * Item raw rounds with Math.round (half toward +infinity), as the simulator does; card raw rounds half away from zero.
 */
export function ScoreItem(it, scoring = shippedScoring, rules = {}) {
  const S = slimOf(scoring), M = S.model, I = scoring.items, plays = I.plays;
  const parts = {};
  for (const [k, n] of it.mods || []) { const v = ModValue(k, n, scoring); const label = ModLabel(k, scoring); if (v) parts[label] = (parts[label] || 0) + v; }
  for (const t of it.props || []) { const v = PropertyValue(rules[t], scoring); if (v) parts['prop:' + t] = (parts['prop:' + t] || 0) + v; }
  for (const t of it.tags || []) { if (t.startsWith('range:')) continue; const w = S.tags[t]; if (w && w.weight) parts[t] = w.weight * (w.per === 'hit' ? plays.strike : 1); }
  if (it.kind === 'weapon') {
    const atkAuth = it.magicShare ? (1 - it.magicShare) * M.AUTH_PHYS + it.magicShare * M.AUTH_SPELL : M.AUTH_PHYS;
    const atk = ((it.attackBase ?? I.kit.unarmedAttack) - I.kit.unarmedAttack) * atkAuth * plays.strike; if (atk) parts['Attack profile'] = atk;
    const grd = ((it.guardBase ?? I.kit.unarmedGuard) - I.kit.unarmedGuard) * M.AUTH_BLOCK / 2 * plays.defend; if (grd) parts['Guard profile'] = grd;
    if (it.art) { const a = ScoreCard(Object.assign(BaseFace(), JSON.parse(JSON.stringify(it.art))), scoring).raw * plays.weaponArt; if (a) parts['Weapon art: ' + it.art.name] = a; }
  }
  if (typeof it.poise === 'number' && it.kind !== 'relic') { const pv = (it.poise - I.poiseThreshold.baseline) * I.poiseThreshold.perPoint; if (pv) parts['Poise threshold'] = pv; }
  const rg = it.range ? 'range:' + it.range : null;
  if (rg && S.tags[rg] && S.tags[rg].weight) parts[rg] = S.tags[rg].weight * plays.strike;
  const raw = Math.round(Object.values(parts).reduce((s, v) => s + v, 0)) + 0;
  const disc = S.discount[it.rarity] || 0;
  return { raw, disc, cp: raw - disc, parts };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Naming: effect word + base word + rank numeral (+N upgrades)
// ---------------------------------------------------------------------------------------------------------------------------------
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const numeral = (N, rk) => N.roman[rk] || '';

/** Parts of a card's convention name: {name, effect, base, rank, source, baseSource}. */
export function CardNameParts(c, ups = 0, scoring = shippedScoring) {
  const G = scoring.naming.card, N = scoring.naming;
  const s = ScoreCard(c, scoring);
  const top = Object.entries(s.parts).filter(([k, v]) => k !== 'SP' && k !== 'MP' && v > 0).sort((a, b) => b[1] - a[1]);
  const elementTag = c.tags.find((t) => t.startsWith('school:') && G.element[t]) || c.tags.find((t) => t.startsWith('damage:') && G.element[t]);
  let effect = null, source = null;
  const man0 = c.tags.find((t) => t.startsWith('maneuver:'));
  const DUP = { block: ['maneuver:defend', 'maneuver:counter'], counter: ['maneuver:counter'], evade: ['maneuver:evade'], 'maneuver:smash': ['maneuver:smash'], 'maneuver:sweep': ['maneuver:sweep'] };
  const dmgV = s.parts.damage || 0;
  for (const [k, v] of top) {
    if (DUP[k] && DUP[k].includes(man0)) continue;
    if (k === 'poise' && dmgV > 0 && v <= dmgV * 1.5) continue;
    const w = G.effect[k] ?? G.element[k];
    if (!w) continue;
    effect = w === '@element' ? (elementTag ? G.element[elementTag] : G.fallback[c.camp]) : w; source = k; break;
  }
  if (!effect) { effect = G.fallback[c.camp]; source = 'fallback'; }
  const man = c.tags.find((t) => t.startsWith('maneuver:') && G.base[t]);
  const area = c.tags.includes(scoring.cardModel.areaTag);
  const base = man ? G.base[man] : c.type === 'attack' || c.dmg > 0 ? G.base[`attack:${area ? 'area:' : ''}${c.camp}`] : G.base[`skill:${c.camp}`];
  const rk = RankOf(CombatPower(s.raw, c.rarity, scoring), scoring);
  if (effect === base || (effect === 'Guarding' && base === 'Guard')) effect = G.fallback[c.camp];
  const name = [effect, base, numeral(N, rk)].filter(Boolean).join(' ') + (ups ? ` +${ups}` : '');
  return { name, effect, base, rank: rk, source, baseSource: man || (c.type === 'attack' ? 'attack' : 'skill') + ':' + c.camp + (area ? ' (area)' : '') };
}
/** A card's convention name, e.g. "Searing Strike III". */
export const CardName = (c, ups = 0, scoring = shippedScoring) => CardNameParts(c, ups, scoring).name;

function propWord(tag, rules, scoring) {
  const S = slimOf(scoring), W = scoring.naming, p = rules[tag];
  if (!p) return 'Fabled';
  let best = null, bv = -1;
  for (const t of p.triggers || []) for (const op of t.do || []) { const v = Math.abs(opValueOf(S, op)); if (v > bv) { bv = v; best = op; } }
  if (!best) return 'Fabled';
  if (best.op === 'applyStatus') return W.card.effect[best.status] || 'Fabled';
  return W.item.op[best.op] || 'Fabled';
}

/** Parts of an item's convention name: {name, effect, base, rank, source}. */
export function ItemNameParts(it, ups = 0, scoring = shippedScoring, rules = {}) {
  const W = scoring.naming, s = ScoreItem(it, scoring, rules);
  const top = Object.entries(s.parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
  let effect = 'Plain', source = 'none';
  if (top) {
    source = top[0];
    effect = top[0].startsWith('prop:') ? propWord(top[0].slice(5), rules, scoring)
      : top[0].startsWith('Weapon art: ') ? CardNameParts(Object.assign(BaseFace(), JSON.parse(JSON.stringify(it.art))), 0, scoring).effect
        : W.item.mod[top[0]] || W.card.effect[top[0]] || W.card.element[top[0]] || 'Fabled';
  }
  const lastWord = String(it.name || '').split(' ').pop();
  const b = it.base || '';
  const base = it.kind === 'armour' && W.itemArmourSuffixes.includes(lastWord) ? lastWord
    : W.item.base[b] || (b.startsWith('staff') ? 'Staff' : it.kind === 'armour' ? 'Robes' : it.kind === 'relic' ? 'Relic' : cap(b || it.kind));
  const rk = RankOf(s.cp, scoring);
  return { name: [effect, base, numeral(W, rk)].filter(Boolean).join(' ') + (ups ? ` +${ups}` : ''), effect, base, rank: rk, source };
}
/** An item's convention name. */
export const ItemName = (it, ups = 0, scoring = shippedScoring, rules = {}) => ItemNameParts(it, ups, scoring, rules).name;

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
