// src/model/cardGenerator.js — generate a card (or batch of cards) of a target combat power (owner, 2026-11-21; riders, schools and costs 2026-11-24).
//
// Pure and headless; safe for Score Studio, card pool planning, auto-balancing, and runtime generation.
// GenerateCard(target, {scoring, spellExposureBuildup, idPrefix, applyNaming}) returns a Core cards.json-shaped definition
// whose ScoreCard face lands on the target combat power:
//
//   1. target cp  = the given combatPower (never over scoring.rank.maxCp), or a cp inside the rank band (picked by the seed, or the band ceiling when aimMaxCp is true); raw target = cp + rarity discount;
//   2. the face (src/model/combatPower.js BaseFace) gets its camp, school, range, area/targeting, keyword(s), SP/MP costs, optional stances,
//      optional HP-cost drawback and riders (`effects` 1..3 or `effectCount` 1..4 counts the primary), then the primary amount (damage for attacks,
//      Block for skills) is searched against the live weights so the rounded raw score equals the target. When the card is too strong even at a
//      primary of 1, the fallback raises the SP cost (to 3), then the MP cost of a magic or hybrid card (to 3), then drops riders last-picked first,
//      a keyword that adds power and area, and only on a card that allows a drawback adds HP cost (to MAX_HP_COST). A card still too strong keeps
//      its nearest combat power and is marked `miss` (GenerateCard: `_cpMiss`). Every step is fixed, so a seed always gives the same card;
//   3. the AUTHORED effect amounts are converted back from the face numbers with the scorer's authored-to-final constants
//      (scoring.model.AUTH_PHYS / AUTH_SPELL / AUTH_BLOCK; the unarmed attack baseline from scoring.items.kit and the Block add of 6 that
//      scoring.items.kit.weaponArt documents): face damage = 3 + 0.35 x authored (spell 0.5), face Block = 6 + 0.49 x authored.
// The face, not the authored amount, is the scored truth; authored amounts never go below 1.
// Since 2026-11-24 the primary search starts at 1 (a card always does its main thing) and no HP is added without `drawback`, so
// tools/generate-cards.mjs prints different cards than the first generator for the same seed.
//
// Target fields: rarity, rank | combatPower, cls, seed, and optionally
//   camp       physical | spell, or martial | magic | hybrid (hybrid = a physical hit with a 0.5 magic share);
//   type       attack | skill | smash | sweep | counter | defend (smash, sweep and counter are attacks, defend a skill; a magic card
//              casts, so its smash or sweep is a plain attack and its counter or defend a plain skill; sweep is always area);
//   school     fire | frost | lightning | force | decay | divine | illusion | earth | alteration | none (school:* and, on attacks, the
//              matching damage:* tag on magic and hybrid cards; a martial card ignores it);
//   range      melee | reach (single-target attacks only);  area / targeting:'area' = targeting:area;
//   sp, mp     costs 0..3 (default: picked by the seed; martial cards cost no MP);
//   effects    1..3 (with allowedEffects / allowedStatuses: which riders may be picked), or riders: an explicit list such as ['poise', 'status:weak'];
//   effectCount 1..4, stances / stance, keywords (array), aimMaxCp (for batch generation & auto-balancing);
//   keyword    exhaust | ethereal | retain | innate;  drawback  true = an HP cost.
import { scoring as shippedScoring } from '../content/generated/scoring.js';
import { BaseFace, ScoreCard, CombatPower, RankOf, CardName } from './combatPower.js';

const BLOCK_ADD = 6; // scoring.items.kit.weaponArt: "Block x0.49 + 6 (DR add)"
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function seededPrng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, n) => Math.floor(rand() * n);
const pickFrom = (rand, list) => list[pick(rand, list.length)];
/** The generator's seeded random source (a string or number seed -> a function returning 0..1). */
export const SeededRandom = seededPrng;

/** Card types the generator makes, and what each one is in the game. */
export const CARD_TYPES = Object.freeze(['attack', 'skill', 'smash', 'sweep', 'counter', 'defend']);
const TYPE_SHAPE = {
  attack: { type: 'attack', maneuver: 'maneuver:attack' },
  skill: { type: 'skill', maneuver: null },
  smash: { type: 'attack', maneuver: 'maneuver:smash' },
  sweep: { type: 'attack', maneuver: 'maneuver:sweep', area: true },
  counter: { type: 'attack', maneuver: 'maneuver:counter', extraTags: ['trait:reaction'] },
  defend: { type: 'skill', maneuver: 'maneuver:defend' },
};
/** Magic schools (school:* tags) and the damage:* tag each one deals. Alteration deals no element. */
export const SCHOOLS = Object.freeze(['fire', 'frost', 'lightning', 'force', 'decay', 'divine', 'illusion', 'earth', 'alteration', 'none']);
const SCHOOL_DAMAGE = { fire: 'damage:fire', frost: 'damage:frost', lightning: 'damage:lightning', force: 'damage:arcane', decay: 'damage:decay', divine: 'damage:sacred', illusion: 'damage:psychic', earth: 'damage:earth' };
export const CAMPS = Object.freeze(['martial', 'magic', 'hybrid']);
const CAMP_ALIAS = { physical: 'martial', spell: 'magic', martial: 'martial', magic: 'magic', hybrid: 'hybrid' };
export const RANGES = Object.freeze(['melee', 'reach']);
export const KEYWORDS = Object.freeze(['exhaust', 'ethereal', 'retain', 'innate']);
const HYBRID_MAGIC_SHARE = 0.5;
const MAGIC_ATTACK_TYPES = new Set(['attack', 'smash', 'sweep']);
/** Rider effects (beyond the primary). Statuses are riders too, named 'status:<id>' from scoring.statuses. */
export const RIDER_EFFECTS = Object.freeze(['poise', 'block', 'damage', 'draw', 'heal', 'cleanse', 'restoreSp', 'restoreMp', 'move']);
const ATTACK_ONLY = new Set(['poise', 'block']);
const SKILL_ONLY = new Set(['damage']);
const HEAVY_STATUS_WEIGHT = 10; // a status this strong gets one stack
const MAX_HP_COST = 6; // the most HP a drawback costs
const MAX_COST = 3;    // the highest SP or MP cost the fallback raises to
const MAX_PRIMARY = 999;

export const GENERATOR_SCHOOLS = Object.freeze([
  'fire', 'frost', 'lightning', 'decay', 'divine', 'earth', 'force', 'illusion', 'alteration',
]);
export const GENERATOR_STANCES = Object.freeze([
  'attack', 'defend', 'counter', 'evade', 'prepared', 'smash', 'sweep',
]);
export const GENERATOR_CLASSES = Object.freeze(['reaver', 'starseer', 'rogue', 'herald', 'colorless']);
export const GENERATOR_RARITIES = Object.freeze(['common', 'uncommon', 'rare']);
export const GENERATOR_KEYWORDS = Object.freeze(['exhaust', 'retain', 'innate']);

const SCHOOL_STATUS = Object.freeze({
  fire: ['burn', 'enemy'],
  frost: ['frost', 'enemy'],
  lightning: ['vulnerable', 'enemy'],
  decay: ['venom', 'enemy'],
  divine: ['ward', 'self'],
  earth: ['barrier', 'self'],
  force: ['weak', 'enemy'],
  illusion: ['evade', 'self'],
  alteration: ['strength', 'self'],
});
const PHYSICAL_ATTACK_STATUSES = Object.freeze([
  ['bleed', 'enemy'],
  ['vulnerable', 'enemy'],
  ['weak', 'enemy'],
  ['venom', 'enemy'],
]);
const PHYSICAL_SKILL_STATUSES = Object.freeze([
  ['ward', 'self'],
  ['barrier', 'self'],
  ['strength', 'self'],
  ['counter', 'self'],
  ['evade', 'self'],
]);
const STATUS_LABELS = Object.freeze({
  burn: 'Burn', frost: 'Frost', bleed: 'Bleed', venom: 'Venom',
  weak: 'Weak', vulnerable: 'Vulnerable', ward: 'Ward', barrier: 'Bonus Poise',
  strength: 'Strength', counter: 'Counter', evade: 'Evade', prepared: 'Prepared',
});

/** The hard combat-power ceiling: scoring.rank.maxCp, else the top of the top rank's band (maxRank x width). */
export const MaxCpOf = (scoring = shippedScoring) => scoring.rank.maxCp ?? scoring.rank.maxRank * scoring.rank.width;

/** Inclusive [min, max] combat-power band for a rank under scoring.rank. */
export function RankBand(rank, scoring = shippedScoring) {
  const RK = scoring.rank;
  if (!Number.isInteger(rank) || rank < 0 || rank > RK.maxRank) {
    throw new Error(`cardGenerator: rank ${rank} is outside 0..${RK.maxRank}`);
  }
  if (rank === 0) return { min: RK.unrankedMax - 2, max: RK.unrankedMax };
  const max = Math.min(rank * RK.width, MaxCpOf(scoring));
  const min = Math.min((rank - 1) * RK.width + 1, max);
  return { min, max };
}

/** Maximum allowed combat power for a rank (the ceiling target for auto-balancing). */
export function RankMaxCp(rank, scoring = shippedScoring) {
  return RankBand(rank, scoring).max;
}

/** A combat power inside a rank's band, chosen by the seed (or the band ceiling when aimMaxCp is true). */
export function TargetCp(rank, rand, scoring = shippedScoring, { aimMaxCp = false } = {}) {
  const RK = scoring.rank;
  if (!Number.isInteger(rank) || rank < 0 || rank > RK.maxRank) throw new Error(`cardGenerator: rank ${rank} is outside 0..${RK.maxRank}`);
  if (aimMaxCp) return RankMaxCp(rank, scoring);
  if (rank === 0) return RK.unrankedMax - pick(rand, 3);
  const hi = Math.min(rank * RK.width, MaxCpOf(scoring)), lo = Math.min((rank - 1) * RK.width + 1, hi);
  return lo + pick(rand, hi - lo + 1);
}

const authFactor = (camp, scoring) => (camp === 'spell' ? scoring.model.AUTH_SPELL : scoring.model.AUTH_PHYS);
const authoredDamage = (face, camp, scoring) => Math.max(1, Math.round((face - scoring.items.kit.unarmedAttack) / authFactor(camp, scoring)));
const authoredBlock = (face, scoring) => Math.max(1, Math.round((face - BLOCK_ADD) / scoring.model.AUTH_BLOCK));
const statusWords = (id) => STATUS_LABELS[id] || id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

// One rider, its face numbers picked by the seed. Block and damage riders pick the authored amount and score its exact face.
function makeRider(kind, rand, camp, scoring) {
  if (kind.startsWith('status:')) {
    const id = kind.slice('status:'.length), st = scoring.statuses[id];
    if (!st) throw new Error(`cardGenerator: unknown status '${id}'`);
    return { kind, status: id, target: st.target === 'self' ? 'self' : 'enemy', stacks: st.weight >= HEAVY_STATUS_WEIGHT ? 1 : 1 + pick(rand, 2) };
  }
  switch (kind) {
    case 'poise': return { kind, amount: 3 * (1 + pick(rand, 2)) };
    case 'block': { const authored = 2 + pick(rand, 4); return { kind, authored, face: BLOCK_ADD + scoring.model.AUTH_BLOCK * authored }; }
    case 'damage': { const authored = 2 + pick(rand, 4); return { kind, authored, face: scoring.items.kit.unarmedAttack + authFactor(camp, scoring) * authored }; }
    case 'heal': return { kind, amount: 2 + pick(rand, 3) };
    case 'draw': case 'cleanse': case 'restoreSp': case 'restoreMp': case 'move': return { kind, amount: 1 };
    default: throw new Error(`cardGenerator: unknown rider '${kind}'`);
  }
}

const RIDER_FIELD = { poise: 'poise', block: 'blk', damage: 'dmg', draw: 'draw', heal: 'heal', cleanse: 'cleanse', restoreSp: 'restoreSp', restoreMp: 'restoreMp', move: 'move' };
function applyRider(face, r) {
  if (r.status) face.statuses.push([r.status, r.stacks, r.target]);
  else face[RIDER_FIELD[r.kind]] += r.face ?? r.amount;
}

// The riders a card of this shape may pick: the allowed effects that suit its type, then the allowed statuses.
function riderPool(kind, allowedEffects, allowedStatuses, scoring) {
  const wrongType = kind === 'attack' ? SKILL_ONLY : ATTACK_ONLY;
  const fx = (allowedEffects || RIDER_EFFECTS).filter((k) => RIDER_EFFECTS.includes(k) && !wrongType.has(k));
  const st = (allowedStatuses || []).filter((s) => scoring.statuses[s]).map((s) => `status:${s}`);
  return [...fx, ...st];
}

function normalizeStances(input) {
  const raw = Array.isArray(input.stances) ? input.stances : (input.stance ? [input.stance] : []);
  return [...new Set(raw.map((s) => String(s || '').trim().toLowerCase()).filter((s) => GENERATOR_STANCES.includes(s)))];
}

function hasBatchCriteria(input) {
  return !!(
    (Array.isArray(input.stances) && input.stances.length)
    || input.stance
    || Number.isInteger(input.effectCount)
    || input.targeting
    || (Array.isArray(input.keywords) && input.keywords.length)
  );
}

function normaliseInput(input, scoring) {
  const { rarity = 'common', cls = 'colorless', type = 'attack', seed = 1 } = input;
  if (!(rarity in scoring.rarity.discount)) throw new Error(`cardGenerator: unknown rarity '${rarity}'`);
  if (!CARD_TYPES.includes(type)) throw new Error(`cardGenerator: type must be one of ${CARD_TYPES.join(', ')}, not '${type}'`);
  const school = input.school == null || input.school === '' ? 'none' : input.school;
  if (!SCHOOLS.includes(school)) throw new Error(`cardGenerator: unknown school '${school}'`);
  const rawCamp = input.camp ?? (school !== 'none' ? 'spell' : 'physical');
  const campKind = CAMP_ALIAS[rawCamp];
  if (!campKind) throw new Error(`cardGenerator: camp must be physical, spell, martial, magic or hybrid, not '${input.camp}'`);
  if (input.range != null && !RANGES.includes(input.range)) throw new Error(`cardGenerator: range must be melee or reach, not '${input.range}'`);
  if (input.keyword && !KEYWORDS.includes(input.keyword)) throw new Error(`cardGenerator: unknown keyword '${input.keyword}'`);
  if (input.effects !== undefined && !(Number.isInteger(input.effects) && input.effects >= 1 && input.effects <= 3)) throw new Error('cardGenerator: effects must be 1, 2 or 3');
  return { rarity, cls, type, seed, campKind, school };
}

const NEW_FIELDS = ['effects', 'riders', 'range', 'area', 'keyword', 'drawback', 'sp', 'mp'];

/**
 * GenerateFace(target, {scoring}) -> {face, cp, riders, target}: the scorer's face (src/model/combatPower.js) and the combat power it lands
 * on. Supports both pool-planner targets (`effects`, `riders`, `range`, `area`, `keyword`, `drawback`) and batch/auto-balance targets
 * (`stances`, `effectCount`, `targeting`, `keywords`, `aimMaxCp`).
 */
export function GenerateFace(input, { scoring = shippedScoring } = {}) {
  const { rarity, cls, type, seed, campKind, school } = normaliseInput(input, scoring);
  const camp = campKind === 'magic' ? 'spell' : 'physical';
  const batchMode = hasBatchCriteria(input);
  const stances = normalizeStances(input);
  const requestedKeywords = Array.isArray(input.keywords)
    ? [...new Set(input.keywords.map((k) => String(k || '').toLowerCase()).filter((k) => KEYWORDS.includes(k)))]
    : (input.keyword ? [input.keyword] : []);
  const effectCount = Number.isInteger(input.effectCount) ? Math.max(1, Math.min(4, input.effectCount)) : null;

  // A target with none of the newer fields is the first generator's card (one optional Poise or draw rider) and keeps its seed string.
  const legacy = !batchMode && input.effects === undefined && input.riders === undefined;
  const plain = !batchMode && school === 'none' && campKind !== 'hybrid' && NEW_FIELDS.every((k) => input[k] === undefined);
  const extra = batchMode
    ? `|${campKind}|${school}|${stances.join(',')}|${effectCount || ''}|${input.targeting || ''}|${requestedKeywords.join(',')}`
    : (plain ? '' : `|${campKind}|${school}|${NEW_FIELDS.map((k) => JSON.stringify(input[k] ?? null)).join('|')}`);
  const rand = seededPrng(`${seed}|${rarity}|${cls}|${camp}|${type}${extra}`);

  let cp;
  if (Number.isFinite(input.combatPower)) cp = Math.round(input.combatPower);
  else if (Number.isInteger(input.rank)) cp = TargetCp(input.rank, rand, scoring, { aimMaxCp: !!input.aimMaxCp });
  else throw new Error('cardGenerator: give a rank or a combatPower');
  if (cp > MaxCpOf(scoring)) throw new Error(`cardGenerator: combat power ${cp} is over the ceiling ${MaxCpOf(scoring)} (scoring.rank.maxCp)`);
  const raw = cp + scoring.rarity.discount[rarity];

  // A magic card casts: its maneuver is casting, so smash / sweep play as an attack and counter / defend as a skill.
  const shape = campKind === 'magic' ? { type: MAGIC_ATTACK_TYPES.has(type) ? 'attack' : 'skill', maneuver: 'maneuver:casting', area: TYPE_SHAPE[type].area } : TYPE_SHAPE[type];
  const kind = shape.type;
  let primaryManeuver = shape.maneuver;
  let stanceTrigger = null;
  if (stances.length) {
    const first = stances[0];
    if (first === 'evade') {
      primaryManeuver = 'maneuver:defend';
      stanceTrigger = { stance: 'evade' };
    } else if (first !== 'prepared') {
      primaryManeuver = `maneuver:${first}`;
    }
  }

  const face = Object.assign(BaseFace(), { cls, rarity, camp, type: kind });
  if (campKind === 'hybrid') face.magicShare = HYBRID_MAGIC_SHARE;
  const tags = [`camp:${camp}`];
  if (camp === 'spell') tags.push('source:spell');
  if (primaryManeuver) tags.push(primaryManeuver);
  else if ((legacy || batchMode) && camp !== 'spell') tags.push('maneuver:defend'); // legacy & batch physical skills default to Guard
  tags.push(`classification.${kind}`, ...(shape.extraTags || []));
  if (campKind !== 'martial' && school !== 'none') tags.push(`school:${school}`);
  if (camp === 'spell') tags.push(school === 'divine' ? 'tradition:divine' : 'tradition:arcane');
  if (kind === 'attack' && campKind !== 'martial' && SCHOOL_DAMAGE[school]) tags.push(SCHOOL_DAMAGE[school]); // a martial card has no school
  let area = Boolean(input.area || input.targeting === 'area' || shape.area);
  if (kind === 'attack' && !area && input.range) tags.push(`range:${input.range}`);
  if (type === 'counter' && campKind !== 'magic') face.counter = 1; // Score Studio reads a counter maneuver as one Counter stack
  const setTags = () => { face.tags = area ? [...tags, 'targeting:area', 'targeting.allEnemies'] : [...tags]; };
  let sp = Number.isInteger(input.sp) ? Math.max(0, input.sp) : pick(rand, 3);
  let mp = campKind === 'martial' ? 0 : Number.isInteger(input.mp) ? Math.max(0, input.mp) : camp === 'spell' ? pick(rand, 2) : 0;
  let keywords = [...requestedKeywords];
  const baseHp = input.drawback ? 1 + pick(rand, 3) : 0;

  // Riders: the legacy target keeps the first generator's Poise or draw; batch mode honours stances & effectCount;
  // otherwise effects-1 riders from the allowed pools, no repeats.
  let riders = [];
  let protectedRiderCount = 0;
  if (batchMode) {
    const addStatusRider = (status, stacks, target) => {
      if (!status || !(status in (scoring.statuses || {}))) return false;
      if (riders.some((r) => r.status === status)) return false;
      riders.push({ kind: `status:${status}`, status, target, stacks });
      return true;
    };
    for (const st of stances) {
      if (st === 'evade') { stanceTrigger = { stance: 'evade' }; if (addStatusRider('evade', 1, 'self')) protectedRiderCount++; }
      else if (st === 'counter') { if (addStatusRider('counter', 1, 'self')) protectedRiderCount++; }
      else if (st === 'prepared') { if (addStatusRider('prepared', 1, 'self')) protectedRiderCount++; }
    }
    const desiredExtras = Math.max(0, (effectCount ?? (1 + pick(rand, 2))) - 1);
    let guard = 0;
    while (riders.length < desiredExtras && guard++ < 8) {
      const slot = (guard + pick(rand, 4)) % 4;
      if (school !== 'none' && SCHOOL_STATUS[school] && !riders.some((r) => r.status === SCHOOL_STATUS[school][0])) {
        const [st, tgt] = SCHOOL_STATUS[school];
        addStatusRider(st, 1 + pick(rand, 2), tgt);
      } else if (kind === 'attack' && !riders.some((r) => r.kind === 'poise') && slot === 0) {
        riders.push({ kind: 'poise', amount: 3 * (1 + pick(rand, 2)) });
      } else if (!riders.some((r) => r.kind === 'draw') && slot === 1) {
        riders.push({ kind: 'draw', amount: 1 });
      } else if (kind === 'skill' && !riders.some((r) => r.kind === 'heal') && school === 'divine') {
        riders.push({ kind: 'heal', amount: 3 });
      } else {
        const pool = kind === 'attack' ? PHYSICAL_ATTACK_STATUSES : PHYSICAL_SKILL_STATUSES;
        const [st, tgt] = pickFrom(rand, pool);
        addStatusRider(st, 1 + pick(rand, 2), tgt);
      }
    }
  } else if (legacy) {
    const n = kind === 'attack' ? 3 * pick(rand, 3) : pick(rand, 2);
    if (n) riders.push(kind === 'attack' ? { kind: 'poise', amount: n } : { kind: 'draw', amount: n });
  } else if (Array.isArray(input.riders)) {
    riders = input.riders.slice(0, 2).map((k) => makeRider(k, rand, camp, scoring));
  } else {
    const pool = riderPool(kind, input.allowedEffects, input.allowedStatuses, scoring);
    for (let i = 1; i < input.effects && pool.length; i++) riders.push(makeRider(pool.splice(pick(rand, pool.length), 1)[0], rand, camp, scoring));
  }

  const key = kind === 'attack' ? 'dmg' : 'blk';
  const build = (hp) => {
    Object.assign(face, { sp, mp, dmg: 0, blk: 0, poise: 0, draw: 0, heal: 0, cleanse: 0, restoreSp: 0, restoreMp: 0, move: 0, statuses: [], loseHp: hp });
    for (const r of riders) applyRider(face, r);
    face.kw = [...keywords];
    setTags();
  };
  // The primary is at least 1 face point, so a card always does its main thing.
  const solve = (hp) => {
    build(hp);
    const base = face[key];
    for (let v = 1; v <= MAX_PRIMARY; v++) { face[key] = base + v; const r = ScoreCard(face, scoring).raw; if (r === raw) return true; if (r > raw) return false; }
    return false;
  };
  // Fallback order when the card is too strong: raise SP, then MP (magic and hybrid), then drop non-protected riders last-picked first,
  // a keyword that adds power and area (unless preserved by batch criteria), then add HP cost only when a drawback is allowed.
  let ok = solve(baseHp);
  while (!ok && sp < MAX_COST) { sp++; ok = solve(baseHp); }
  while (!ok && campKind !== 'martial' && mp < MAX_COST) { mp++; ok = solve(baseHp); }
  while (!ok && riders.length > protectedRiderCount) { riders.pop(); ok = solve(baseHp); }
  if (!ok && !batchMode && keywords.length && (scoring.keywords[keywords[0]]?.flat ?? 1) >= 0) { keywords = []; ok = solve(baseHp); }
  if (!ok && !batchMode && area && !shape.area) { area = false; ok = solve(baseHp); }
  let hp = baseHp;
  if (input.drawback) while (!ok && hp < MAX_HP_COST) { hp++; ok = solve(hp); }
  // In batch/aimMaxCp mode, if an exact hit was skipped (e.g. area step > 1), pick the closest primary whose raw <= target so requested
  // school, area, keywords, and stance statuses stay intact inside the rank ceiling.
  let miss = false;
  if (!ok && batchMode) {
    build(hp);
    const base = face[key];
    let bestV = 1, bestDiff = Infinity;
    for (let v = 1; v <= MAX_PRIMARY; v++) {
      face[key] = base + v;
      const r = ScoreCard(face, scoring).raw;
      const diff = raw - r;
      if (diff >= 0 && diff < bestDiff) { bestDiff = diff; bestV = v; }
      if (r > raw + 4) break;
    }
    face[key] = base + bestV;
    ok = bestDiff < Infinity;
  }
  // Still too strong: keep the weakest face (primary 1) and its combat power, marked as a miss.
  if (!ok) { build(hp); face[key] += 1; miss = true; }
  const got = CombatPower(ScoreCard(face, scoring).raw, rarity, scoring);
  if (!miss && !batchMode && got !== cp) throw new Error(`cardGenerator: face scores ${got}, wanted ${cp} (${JSON.stringify(input)})`);
  return {
    face,
    cp: got,
    wanted: cp,
    miss,
    riders,
    target: {
      rarity, cls, camp, campKind, type, kind, school, area,
      targeting: area ? 'area' : 'single',
      keyword: keywords[0] || null,
      keywords,
      stances,
      stanceTrigger,
      seed,
    },
  };
}

// The effect, rules text and short face line for one rider. `to` is the enemy target ('allEnemies' on area).
function riderPart(r, to, area) {
  const all = area ? ' to ALL enemies' : '', allFace = area ? ' to ALL' : '';
  switch (r.kind) {
    case 'poise': return { effect: { op: 'poiseDamage', target: to, amount: r.amount }, text: `Deal {poiseDamage} Poise damage${all}.`, face: `Deal {poiseDamage} Poise${allFace}.` };
    case 'block': return { effect: { op: 'block', target: 'self', amount: r.authored }, text: 'Gain {block} Block.' };
    case 'damage': return { effect: { op: 'damage', target: to, amount: r.authored }, text: `Deal {damage} damage${all}.`, face: `Deal {damage} damage${allFace}.` };
    case 'draw': return { effect: { op: 'draw', amount: r.amount }, text: `Draw {draw} card${r.amount > 1 ? 's' : ''}.` };
    case 'heal': return { effect: { op: 'heal', target: 'self', amount: r.amount }, text: 'Heal {heal} HP.' };
    case 'cleanse': return { effect: { op: 'removeStatus', target: 'self', status: 'weak' }, text: 'Remove your Weak.' };
    case 'restoreSp': return { effect: { op: 'restoreStamina', target: 'self', amount: r.amount }, text: 'Restore {restoreStamina} Stamina.' };
    case 'restoreMp': return { effect: { op: 'restoreMana', target: 'self', amount: r.amount }, text: 'Restore {restoreMana} Mana.' };
    case 'move': return { effect: { op: 'moveEngagement', target: 'enemy', bands: -1 }, text: 'Close one band.' };
    default: {
      const words = statusWords(r.status);
      if (r.target === 'self') return { effect: { op: 'applyStatus', target: 'self', status: r.status, stacks: r.stacks }, text: `Gain {${r.status}} ${words}.` };
      return { effect: { op: 'applyStatus', target: to, status: r.status, stacks: r.stacks }, text: `Apply {${r.status}} ${words}${all}.`, face: area ? `{${r.status}} ${words} to ALL.` : undefined };
    }
  }
}

/**
 * GenerateCard(target, {scoring, spellExposureBuildup, idPrefix, applyNaming}) -> a Core cards.json-shaped definition
 * whose ScoreCard face lands on the target combat power.
 */
export const GenerateCard = (input, options) => GenerateCardWithTarget(input, options).card;

/** GenerateCardWithTarget(target, options) -> {card, cp, scored, miss}: GenerateCard's card, the combat power it was built to, what it scores (differs only on a miss). */
export function GenerateCardWithTarget(input, { scoring = shippedScoring, spellExposureBuildup = 5, idPrefix = 'gen', applyNaming = true } = {}) {
  const { face, cp, miss, wanted, riders, target } = GenerateFace(input, { scoring });
  const { rarity, cls, camp, campKind, type, kind, area, keywords, stanceTrigger, seed } = target;
  const to = area ? 'allEnemies' : 'enemy';
  const all = area ? ' to ALL enemies' : '', allFace = area ? ' to ALL' : '';
  // The primary's face amount is everything the riders did not add.
  const riderFace = (k) => riders.filter((r) => r.kind === k).reduce((s, r) => s + r.face, 0);
  const parts = [];
  if (kind === 'attack') {
    const counter = type === 'counter' && campKind !== 'magic';
    parts.push({
      effect: { op: 'damage', target: to, amount: authoredDamage(face.dmg - riderFace('damage'), camp, scoring) },
      text: counter ? 'Prepare Melee Counter: return {damage} damage.' : `Deal {damage} damage${all}.`,
      face: counter ? 'Counter for {damage} damage.' : `Deal {damage} damage${allFace}.`,
    });
  } else parts.push({ effect: { op: 'block', target: 'self', amount: authoredBlock(face.blk - riderFace('block'), scoring) }, text: 'Gain {block} Block.' });
  for (const r of riders) parts.push(riderPart(r, to, area));
  if (face.loseHp) parts.push({ effect: { op: 'loseHp', target: 'self', amount: face.loseHp, nonlethal: true }, text: 'Lose {loseHp} HP.' });
  const keywordText = keywords.length ? ' ' + keywords.map((kw) => `${kw[0].toUpperCase()}${kw.slice(1)}.`).join(' ') : '';
  const computedName = applyNaming ? CardName(face, 0, scoring) : `Generated ${kind === 'attack' ? 'Attack' : 'Skill'} ${seed}`;
  const card = {
    id: `${idPrefix}.${seed}`, name: computedName, class: cls, rarity, cost: face.sp, staminaCost: face.sp, manaCost: face.mp, costRule: 'fixed', type: kind,
    icon: kind === 'attack' ? 'attack' : 'shield', keywords: [...keywords], effects: parts.map((p) => p.effect), tags: [...face.tags],
    textTemplate: parts.map((p) => p.text).join(' ') + keywordText, ...(parts.length > 1 ? { faceTemplate: parts.slice(0, 3).map((p) => p.face || p.text) } : {}),
    flavor: `Generated: combat power ${cp}, Rank ${RankOf(cp, scoring)}.`,
    ...(face.magicShare ? { magicShare: face.magicShare } : {}),
    ...(stanceTrigger ? { stanceTrigger } : {}),
    ...(miss ? { _cpMiss: wanted } : {}),
    ...(kind === 'attack' ? { damageSchool: camp === 'spell' ? 'magic' : 'physical', exposureBuildupPerHit: camp === 'spell' && face.mp ? spellExposureBuildup : 0 } : {}),
  };
  return { card, cp: wanted, scored: cp, miss };
}

/**
 * GenerateCardBatch(criteria, {scoring, spellExposureBuildup}) -> { cards, summary }.
 * Any omitted or 'auto' field is deterministically generated from seed + index.
 */
export function GenerateCardBatch(criteria = {}, { scoring = shippedScoring, spellExposureBuildup = 5 } = {}) {
  const count = Math.max(1, Math.min(200, Math.round(Number(criteria.count) || 5)));
  const seedBase = criteria.seed ?? 1;
  const rand = seededPrng(`cardBatch|${seedBase}`);
  const idPrefix = String(criteria.idPrefix || 'gen').replace(/[^a-zA-Z0-9_-]/g, '') || 'gen';
  const applyNaming = criteria.applyNaming !== false;
  const aimMaxCp = criteria.aimMaxCp !== false;

  const pickOrUse = (val, pool) => {
    if (Array.isArray(val) && val.length) return pickFrom(rand, val);
    if (val != null && val !== '' && val !== 'auto') return val;
    return pickFrom(rand, pool);
  };

  const cards = [];
  for (let i = 0; i < count; i++) {
    const cls = pickOrUse(criteria.cls, GENERATOR_CLASSES);
    const rarity = pickOrUse(criteria.rarity, GENERATOR_RARITIES);
    const defaultRanks = rarity === 'rare' ? [3, 4] : rarity === 'uncommon' ? [2, 3] : [1, 2];
    const rank = Number.isInteger(criteria.rank)
      ? criteria.rank
      : (Array.isArray(criteria.rank) && criteria.rank.length ? pickFrom(rand, criteria.rank) : pickFrom(rand, defaultRanks));
    const type = pickOrUse(criteria.type, ['attack', 'skill']);
    const school = criteria.school && criteria.school !== 'auto'
      ? (Array.isArray(criteria.school) ? pickFrom(rand, criteria.school) : criteria.school)
      : (criteria.camp === 'spell' ? pickFrom(rand, GENERATOR_SCHOOLS) : null);
    const camp = criteria.camp && criteria.camp !== 'auto'
      ? criteria.camp
      : (school ? 'spell' : (cls === 'starseer' || cls === 'herald' ? (rand() < 0.7 ? 'spell' : 'physical') : (rand() < 0.2 ? 'spell' : 'physical')));
    const resolvedSchool = camp === 'spell' ? (school || pickFrom(rand, GENERATOR_SCHOOLS)) : null;
    const stances = Array.isArray(criteria.stances) && criteria.stances.length
      ? criteria.stances
      : (criteria.stance && criteria.stance !== 'auto' ? [criteria.stance] : []);
    const effectCount = Number.isInteger(criteria.effectCount)
      ? criteria.effectCount
      : (1 + pick(rand, 3));
    const targeting = criteria.targeting && criteria.targeting !== 'auto'
      ? criteria.targeting
      : (type === 'attack' && rand() < 0.2 ? 'area' : 'single');
    const keywords = Array.isArray(criteria.keywords) ? criteria.keywords : [];

    const itemSeed = `${seedBase}_${i + 1}`;
    const card = GenerateCard({
      rarity,
      rank,
      ...(Number.isFinite(criteria.combatPower) ? { combatPower: criteria.combatPower } : {}),
      aimMaxCp,
      cls,
      camp,
      type,
      school: resolvedSchool,
      stances,
      effectCount,
      targeting,
      keywords,
      ...(Number.isInteger(criteria.sp) ? { sp: criteria.sp } : {}),
      ...(Number.isInteger(criteria.mp) ? { mp: criteria.mp } : {}),
      seed: itemSeed,
    }, { scoring, spellExposureBuildup, idPrefix, applyNaming });
    cards.push(card);
  }
  return {
    cards,
    summary: { count: cards.length, seed: seedBase },
  };
}
