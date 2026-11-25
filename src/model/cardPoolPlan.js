// src/model/cardPoolPlan.js — plan a whole generated card pool from totals and odds (owner, 2026-11-24).
//
// Pure and headless. PlanCardPool(options, {scoring}) turns pool-level priorities into one GenerateCard target per card, then the cards:
//
//   options = { total, perSchool: {fire: n, ..., none: n}, perCamp: {martial, magic, hybrid},
//               rarity: {common: %, uncommon: %, rare: %}, rank: {0: %, 1: %, ...}, sp: {0..3: %}, mp: {0..3: %},
//               type: {attack, skill, smash, sweep, counter, defend: %}, range: {melee, reach: %}, effects: {1, 2, 3: %},
//               allowedEffects: [...], allowedStatuses: [...], allowedKeywords: [...], keywordOdds: %, drawbackOdds: %, areaOdds: %,
//               seed, cls }
//
// Rules (each count is exact, by largest-remainder rounding, so the counts add up to the card count):
//   - Card count: the per-school counts win when any is set (their sum is the count and `total` is ignored); otherwise `total`.
//   - Camps: perCamp when any is set (scaled to the card count); otherwise a card with a school is magic and one without is martial.
//     With neither per-school nor per-camp counts, martial and magic split evenly.
//   - Schools: per-school counts are dealt with real schools going to magic cards first, then hybrid, then martial, and 'none' to the
//     rest. Without per-school counts, magic and hybrid cards spread evenly over the real schools and martial cards get none.
//   - Percent groups are weights: they need not add to 100 (an all-zero group is spread evenly).
//   - MP odds apply to magic and hybrid cards; martial cards cost no MP. Range odds apply to single-target attacks.
//     Area odds apply to attacks that are not sweeps (a sweep is always area). Keyword, drawback and area odds are a share of the cards.
//   - Every random choice comes from the seed, so one seed always plans the same pool.
import { scoring as shippedScoring } from '../content/generated/scoring.js';
import { GenerateCardWithTarget, SeededRandom, SCHOOLS, CAMPS, CARD_TYPES, RANGES, KEYWORDS, RIDER_EFFECTS } from './cardGenerator.js';

export const RARITIES = Object.freeze(['common', 'uncommon', 'rare']);
export const EFFECT_COUNTS = Object.freeze(['1', '2', '3']);
export const COSTS = Object.freeze(['0', '1', '2', '3']);
const ATTACK_TYPES = new Set(['attack', 'smash', 'sweep', 'counter']);
const REAL_SCHOOLS = SCHOOLS.filter((s) => s !== 'none');

const sumOf = (obj) => Object.values(obj || {}).reduce((s, v) => s + Math.max(0, Number(v) || 0), 0);

/** Largest-remainder rounding: {key: weight} -> {key: whole count} adding up to n. Ties go to the earlier key; all-zero weights spread evenly. */
export function Apportion(weights, n, keys = Object.keys(weights)) {
  const w = keys.map((k) => Math.max(0, Number(weights[k]) || 0));
  const total = w.reduce((s, v) => s + v, 0);
  const share = total > 0 ? w.map((v) => (v * n) / total) : keys.map(() => n / keys.length);
  const out = share.map(Math.floor);
  let left = n - out.reduce((s, v) => s + v, 0);
  const order = share.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let j = 0; left > 0 && keys.length; j = (j + 1) % order.length, left--) out[order[j][1]]++;
  return Object.fromEntries(keys.map((k, i) => [k, out[i]]));
}

/** A group's weights scaled to whole percentages that add up to 100 (the modal's normalise step). */
export const NormalisePercent = (weights, keys = Object.keys(weights)) => Apportion(weights, 100, keys);

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

// n values with exactly the apportioned count of each key, in a seeded order.
function deal(weights, n, keys, rand) {
  const counts = Apportion(weights || {}, n, keys);
  return shuffle(keys.flatMap((k) => Array(counts[k]).fill(k)), rand);
}

// Exactly round(n x odds%) of the given indices, chosen by the seed.
function chooseShare(indices, odds, rand) {
  const k = Math.round((indices.length * Math.max(0, Math.min(100, Number(odds) || 0))) / 100);
  return new Set(shuffle([...indices], rand).slice(0, k));
}

/** The planned GenerateCard targets: {count, inputs}. */
export function PlanCardPoolInputs(options = {}, { scoring = shippedScoring } = {}) {
  const o = options;
  const seed = o.seed ?? 1;
  const rand = SeededRandom(`pool|${seed}`);
  const schoolSet = sumOf(o.perSchool) > 0, campSet = sumOf(o.perCamp) > 0;
  const n = schoolSet ? Math.round(sumOf(o.perSchool)) : Math.max(0, Math.round(Number(o.total) || 0));
  const idx = [...Array(n).keys()];

  // Camps, then schools by camp preference.
  let schools = schoolSet ? deal(o.perSchool, n, SCHOOLS, rand) : null;
  let camps;
  if (campSet) camps = deal(o.perCamp, n, CAMPS, rand);
  else if (schools) camps = schools.map((s) => (s === 'none' ? 'martial' : 'magic'));
  else camps = deal({ martial: 1, magic: 1 }, n, CAMPS, rand);
  if (schools && campSet) {
    const order = ['magic', 'hybrid', 'martial'].flatMap((c) => idx.filter((i) => camps[i] === c));
    const queue = [...schools.filter((s) => s !== 'none'), ...schools.filter((s) => s === 'none')];
    schools = Array(n);
    order.forEach((i, j) => { schools[i] = queue[j]; });
  } else if (!schools) {
    const caster = idx.filter((i) => camps[i] !== 'martial');
    const dealt = deal(Object.fromEntries(REAL_SCHOOLS.map((s) => [s, 1])), caster.length, REAL_SCHOOLS, rand);
    schools = idx.map(() => 'none');
    caster.forEach((i, j) => { schools[i] = dealt[j]; });
  }

  const maxRank = scoring.rank.maxRank;
  const rankKeys = Object.keys(o.rank || { 0: 1 }).filter((k) => Number.isInteger(Number(k)) && Number(k) >= 0 && Number(k) <= maxRank);
  const rarities = deal(o.rarity, n, RARITIES, rand);
  const ranks = deal(o.rank, n, rankKeys.length ? rankKeys : ['0'], rand).map(Number);
  const types = deal(o.type, n, CARD_TYPES, rand);
  const sps = deal(o.sp, n, COSTS, rand).map(Number);
  const effects = deal(o.effects, n, EFFECT_COUNTS, rand).map(Number);
  const casters = idx.filter((i) => camps[i] !== 'martial');
  const mpDealt = deal(o.mp, casters.length, COSTS, rand).map(Number);
  const mps = idx.map(() => 0);
  casters.forEach((i, j) => { mps[i] = mpDealt[j]; });
  // A magic card casts, so only a martial or hybrid smash / sweep / counter keeps its attack maneuver; a magic sweep is still area.
  const attacks = idx.filter((i) => ATTACK_TYPES.has(types[i]));
  const areas = chooseShare(attacks.filter((i) => types[i] !== 'sweep'), o.areaOdds, rand);
  const single = attacks.filter((i) => types[i] !== 'sweep' && !areas.has(i));
  const rangeDealt = deal(o.range, single.length, RANGES, rand);
  const ranges = idx.map(() => undefined);
  single.forEach((i, j) => { ranges[i] = rangeDealt[j]; });
  const keywordList = (o.allowedKeywords || ['exhaust']).filter((k) => KEYWORDS.includes(k));
  const keyed = keywordList.length ? chooseShare(idx, o.keywordOdds, rand) : new Set();
  const drawn = chooseShare(idx, o.drawbackOdds, rand);
  const allowedEffects = (o.allowedEffects || RIDER_EFFECTS).filter((k) => RIDER_EFFECTS.includes(k));
  const allowedStatuses = (o.allowedStatuses || []).filter((s) => scoring.statuses[s]);

  const inputs = idx.map((i) => ({
    rarity: rarities[i], rank: ranks[i], cls: o.cls || 'colorless', camp: camps[i], type: types[i], school: schools[i],
    ...(ranges[i] ? { range: ranges[i] } : {}), sp: sps[i], mp: mps[i], effects: effects[i], allowedEffects, allowedStatuses,
    ...(keyed.has(i) ? { keyword: keywordList[Math.floor(rand() * keywordList.length)] } : {}),
    drawback: drawn.has(i), area: areas.has(i), seed: `${seed}.${i + 1}`,
  }));
  return { count: n, inputs };
}

/** Counts of a planned pool by rarity, rank, school, camp and type (for the preview). */
export function PoolCounts(inputs) {
  const tally = (key) => inputs.reduce((m, t) => { m[t[key]] = (m[t[key]] || 0) + 1; return m; }, {});
  return { rarity: tally('rarity'), rank: tally('rank'), school: tally('school'), camp: tally('camp'), type: tally('type') };
}

/**
 * PlanCardPool(options, {scoring, spellExposureBuildup}) -> {count, inputs, cards, targets, counts}: the planned targets, the generated
 * cards and the combat power each card was built to (targets[i] for cards[i]).
 */
export function PlanCardPool(options = {}, { scoring = shippedScoring, spellExposureBuildup } = {}) {
  const { count, inputs } = PlanCardPoolInputs(options, { scoring });
  const built = inputs.map((t) => GenerateCardWithTarget(t, { scoring, ...(spellExposureBuildup !== undefined ? { spellExposureBuildup } : {}) }));
  return { count, inputs, cards: built.map((b) => b.card), targets: built.map((b) => b.cp), counts: PoolCounts(inputs) };
}

// The rider kind a Core effect would be on a generated card (null when it is the primary or not a rider).
function riderKindOf(effect, type) {
  switch (effect.op) {
    case 'poiseDamage': return 'poise';
    case 'block': return type === 'attack' ? 'block' : null;
    case 'damage': return type === 'attack' ? null : 'damage';
    case 'draw': return 'draw';
    case 'heal': return 'heal';
    case 'removeStatus': return 'cleanse';
    case 'restoreStamina': return 'restoreSp';
    case 'restoreMana': return 'restoreMp';
    case 'moveEngagement': return 'move';
    default: return null;
  }
}

const percentOf = (counts, keys) => NormalisePercent(counts, keys);

/**
 * MeasurePoolShape(cards, {rankOf, scoring}) -> pool options shaped like the given cards (the modal's defaults are today's Core pool).
 * `rankOf(card)` gives a card's rank (Score Studio passes its own score).
 */
export function MeasurePoolShape(cards, { rankOf, scoring = shippedScoring } = {}) {
  const count = (fn, keys, list = cards) => { const m = Object.fromEntries(keys.map((k) => [k, 0])); for (const c of list) { const k = fn(c); if (k in m) m[k]++; } return m; };
  const tags = (c) => c.tags || [];
  const isMagic = (c) => tags(c).includes('camp:spell');
  const isHybrid = (c) => !isMagic(c) && Number(c.magicShare) > 0;
  const campOf = (c) => (isMagic(c) ? 'magic' : isHybrid(c) ? 'hybrid' : 'martial');
  const schoolOf = (c) => (tags(c).find((t) => t.startsWith('school:') && SCHOOLS.includes(t.slice(7))) || 'school:none').slice(7);
  const typeOf = (c) => {
    for (const k of ['smash', 'sweep', 'counter', 'defend']) if (tags(c).includes(`maneuver:${k}`)) return k;
    return c.type === 'attack' ? 'attack' : 'skill';
  };
  const attacks = cards.filter((c) => c.type === 'attack');
  const rangeOf = (c) => {
    const t = tags(c).find((x) => x === 'range:melee' || x === 'range:reach');
    return t ? t.slice(6) : isMagic(c) ? 'reach' : 'melee';
  };
  const effectCount = (c) => String(Math.min(3, Math.max(1, new Set((c.effects || []).filter((e) => !['loseHp', 'discard'].includes(e.op)).map((e) => (e.op === 'applyStatus' ? `s:${e.status}` : e.op))).size)));
  const riders = new Set(), statuses = new Set(), keywords = new Set();
  for (const c of cards) for (const e of c.effects || []) {
    const r = riderKindOf(e, c.type); if (r) riders.add(r);
    if (e.op === 'applyStatus' && scoring.statuses[e.status] && typeof e.stacks === 'number') statuses.add(e.status);
  }
  for (const c of cards) for (const k of c.keywords || []) if (KEYWORDS.includes(k)) keywords.add(k);
  const pct = (part, whole) => (whole ? Math.round((100 * part) / whole) : 0);
  const sweepless = attacks.filter((c) => typeOf(c) !== 'sweep');
  const rankKeys = Array.from({ length: scoring.rank.maxRank + 1 }, (_, k) => String(k));
  return {
    total: cards.length,
    perSchool: count(schoolOf, SCHOOLS),
    perCamp: count(campOf, CAMPS),
    rarity: percentOf(count((c) => c.rarity, RARITIES), RARITIES),
    rank: percentOf(count((c) => String(rankOf ? rankOf(c) : 0), rankKeys), rankKeys),
    sp: percentOf(count((c) => String(Math.min(3, Math.max(0, Number(c.staminaCost ?? c.cost) || 0))), COSTS), COSTS),
    mp: percentOf(count((c) => String(Math.min(3, Math.max(0, Number(c.manaCost) || 0))), COSTS, cards.filter((c) => campOf(c) !== 'martial')), COSTS), // magic and hybrid cards
    type: percentOf(count(typeOf, CARD_TYPES), CARD_TYPES),
    range: percentOf(Object.fromEntries(RANGES.map((r) => [r, attacks.filter((c) => !tags(c).includes('targeting:area') && rangeOf(c) === r).length])), RANGES),
    effects: percentOf(count(effectCount, EFFECT_COUNTS), EFFECT_COUNTS),
    allowedEffects: RIDER_EFFECTS.filter((k) => riders.has(k)),
    allowedStatuses: Object.keys(scoring.statuses).filter((s) => statuses.has(s)),
    allowedKeywords: KEYWORDS.filter((k) => keywords.has(k)),
    keywordOdds: pct(cards.filter((c) => (c.keywords || []).some((k) => KEYWORDS.includes(k))).length, cards.length),
    drawbackOdds: pct(cards.filter((c) => (c.effects || []).some((e) => e.op === 'loseHp')).length, cards.length),
    areaOdds: pct(sweepless.filter((c) => tags(c).includes('targeting:area')).length, sweepless.length),
    seed: 1,
    cls: 'colorless',
  };
}
