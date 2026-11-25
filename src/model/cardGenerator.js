// src/model/cardGenerator.js — generate a card of a target combat power (owner, 2026-11-21; riders, schools and costs 2026-11-24).
//
// Pure and headless; not wired into any reward pool. GenerateCard(target, {scoring}) returns a Core cards.json-shaped definition
// (id `gen.<seed>`) whose ScoreCard face lands EXACTLY on the target combat power:
//
//   1. target cp  = the given combatPower (never over scoring.rank.maxCp), or a cp inside the rank band (picked by the seed); raw target = cp + rarity discount;
//   2. the face (src/model/combatPower.js BaseFace) gets its camp, school, range, area, keyword, SP/MP costs, an optional HP-cost drawback
//      and up to two riders (`effects` 1..3 counts the primary), then the primary amount (damage for attacks, Block for skills) is searched
//      against the live weights so the rounded raw score equals the target. When nothing fits (the target is below the base), riders drop
//      last-picked first, then a keyword that adds power, then area, then an HP cost is added one point at a time. Every step is fixed,
//      so a seed always gives the same card;
//   3. the AUTHORED effect amounts are converted back from the face numbers with the scorer's authored-to-final constants
//      (scoring.model.AUTH_PHYS / AUTH_SPELL / AUTH_BLOCK; the unarmed attack baseline from scoring.items.kit and the Block add of 6 that
//      scoring.items.kit.weaponArt documents): face damage = 3 + 0.35 x authored (spell 0.5), face Block = 6 + 0.49 x authored.
// The face, not the authored amount, is the scored truth; authored amounts never go below 1.
//
// Target fields: rarity, rank | combatPower, cls, seed, and optionally
//   camp     physical | spell, or martial | magic | hybrid (hybrid = a physical hit with a 0.5 magic share);
//   type     attack | skill | smash | sweep | counter | defend (smash, sweep and counter are attacks, defend a skill; a magic card
//            casts, so its smash or sweep is a plain attack and its counter or defend a plain skill; sweep is always area);
//   school   fire | frost | lightning | force | decay | divine | illusion | earth | alteration | none (school:* on magic and hybrid
//            cards, the matching damage:* tag on any attack);
//   range    melee | reach (single-target attacks only);  area  true = targeting:area;
//   sp, mp   costs 0..3 (default: picked by the seed; martial cards cost no MP);
//   effects  1..3 (with allowedEffects / allowedStatuses: which riders may be picked), or riders: an explicit list such as ['poise', 'status:weak'];
//   keyword  exhaust | ethereal | retain | innate;  drawback  true = an HP cost.
import { scoring as shippedScoring } from '../content/generated/scoring.js';
import { BaseFace, ScoreCard, CombatPower, RankOf, CardName } from './combatPower.js';

const BLOCK_ADD = 6; // scoring.items.kit.weaponArt: "Block x0.49 + 6 (DR add)"
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function prng(seed) { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (rand, n) => Math.floor(rand() * n);
/** The generator's seeded random source (a string or number seed -> a function returning 0..1). */
export const SeededRandom = prng;

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
/** Rider effects (beyond the primary). Statuses are riders too, named 'status:<id>' from scoring.statuses. */
export const RIDER_EFFECTS = Object.freeze(['poise', 'block', 'damage', 'draw', 'heal', 'cleanse', 'restoreSp', 'restoreMp', 'move']);
const ATTACK_ONLY = new Set(['poise', 'block']);
const SKILL_ONLY = new Set(['damage']);
const HEAVY_STATUS_WEIGHT = 10; // a status this strong gets one stack
const MAX_HP_COST = 99;
const MAX_PRIMARY = 999;

/** The hard combat-power ceiling: scoring.rank.maxCp, else the top of the top rank's band (maxRank x width). */
export const MaxCpOf = (scoring = shippedScoring) => scoring.rank.maxCp ?? scoring.rank.maxRank * scoring.rank.width;

/** A combat power inside a rank's band, chosen by the seed. Band edges come from scoring.rank (width, maxRank, maxCp, unrankedMax). */
export function TargetCp(rank, rand, scoring = shippedScoring) {
  const RK = scoring.rank;
  if (rank === 0) return RK.unrankedMax - pick(rand, 3);
  if (!Number.isInteger(rank) || rank < 0 || rank > RK.maxRank) throw new Error(`cardGenerator: rank ${rank} is outside 0..${RK.maxRank}`);
  const hi = Math.min(rank * RK.width, MaxCpOf(scoring)), lo = Math.min((rank - 1) * RK.width + 1, hi); // a lowered ceiling pins a high rank to it
  return lo + pick(rand, hi - lo + 1);
}

const authFactor = (camp, scoring) => (camp === 'spell' ? scoring.model.AUTH_SPELL : scoring.model.AUTH_PHYS);
const authoredDamage = (face, camp, scoring) => Math.max(1, Math.round((face - scoring.items.kit.unarmedAttack) / authFactor(camp, scoring)));
const authoredBlock = (face, scoring) => Math.max(1, Math.round((face - BLOCK_ADD) / scoring.model.AUTH_BLOCK));
const statusWords = (id) => id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

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

function normaliseInput(input, scoring) {
  const { rarity = 'common', cls = 'colorless', type = 'attack', seed = 1 } = input;
  if (!(rarity in scoring.rarity.discount)) throw new Error(`cardGenerator: unknown rarity '${rarity}'`);
  if (!CARD_TYPES.includes(type)) throw new Error(`cardGenerator: type must be one of ${CARD_TYPES.join(', ')}, not '${type}'`);
  const campKind = CAMP_ALIAS[input.camp ?? 'physical'];
  if (!campKind) throw new Error(`cardGenerator: camp must be physical, spell, martial, magic or hybrid, not '${input.camp}'`);
  const school = input.school ?? 'none';
  if (!SCHOOLS.includes(school)) throw new Error(`cardGenerator: unknown school '${school}'`);
  if (input.range != null && !RANGES.includes(input.range)) throw new Error(`cardGenerator: range must be melee or reach, not '${input.range}'`);
  if (input.keyword && !KEYWORDS.includes(input.keyword)) throw new Error(`cardGenerator: unknown keyword '${input.keyword}'`);
  if (input.effects !== undefined && !(Number.isInteger(input.effects) && input.effects >= 1 && input.effects <= 3)) throw new Error('cardGenerator: effects must be 1, 2 or 3');
  return { rarity, cls, type, seed, campKind, school };
}

const NEW_FIELDS = ['effects', 'riders', 'range', 'area', 'keyword', 'drawback', 'sp', 'mp'];

/**
 * GenerateFace(target, {scoring}) -> {face, cp, riders, target}: the scorer's face (src/model/combatPower.js) and the combat power it lands
 * on exactly. `target` is described at the top of this file; `riders` lists the riders the card kept.
 */
export function GenerateFace(input, { scoring = shippedScoring } = {}) {
  const { rarity, cls, type, seed, campKind, school } = normaliseInput(input, scoring);
  const camp = campKind === 'magic' ? 'spell' : 'physical';
  // A target with none of the newer fields is the first generator's card (one optional Poise or draw rider) and keeps its seed string.
  const legacy = input.effects === undefined && input.riders === undefined;
  const plain = school === 'none' && campKind !== 'hybrid' && NEW_FIELDS.every((k) => input[k] === undefined);
  const extra = plain ? '' : `|${campKind}|${school}|${NEW_FIELDS.map((k) => JSON.stringify(input[k] ?? null)).join('|')}`;
  const rand = prng(`${seed}|${rarity}|${cls}|${camp}|${type}${extra}`);
  let cp;
  if (Number.isFinite(input.combatPower)) cp = Math.round(input.combatPower);
  else if (Number.isInteger(input.rank)) cp = TargetCp(input.rank, rand, scoring);
  else throw new Error('cardGenerator: give a rank or a combatPower');
  if (cp > MaxCpOf(scoring)) throw new Error(`cardGenerator: combat power ${cp} is over the ceiling ${MaxCpOf(scoring)} (scoring.rank.maxCp)`);
  const raw = cp + scoring.rarity.discount[rarity];

  // A magic card casts: its maneuver is casting, so smash / sweep play as an attack and counter / defend as a skill.
  const shape = campKind === 'magic' ? { type: TYPE_SHAPE[type].type, maneuver: 'maneuver:casting', area: TYPE_SHAPE[type].area } : TYPE_SHAPE[type];
  const kind = shape.type;
  const face = Object.assign(BaseFace(), { cls, rarity, camp, type: kind });
  if (campKind === 'hybrid') face.magicShare = HYBRID_MAGIC_SHARE;
  const tags = [`camp:${camp}`];
  if (camp === 'spell') tags.push('source:spell');
  if (shape.maneuver) tags.push(shape.maneuver);
  else if (legacy && camp !== 'spell') tags.push('maneuver:defend'); // the first generator's skills were all Guards
  tags.push(`classification.${kind}`, ...(shape.extraTags || []));
  if (campKind !== 'martial' && school !== 'none') tags.push(`school:${school}`);
  if (camp === 'spell') tags.push(school === 'divine' ? 'tradition:divine' : 'tradition:arcane');
  if (kind === 'attack' && SCHOOL_DAMAGE[school]) tags.push(SCHOOL_DAMAGE[school]);
  let area = Boolean(input.area || shape.area);
  if (kind === 'attack' && !area && input.range) tags.push(`range:${input.range}`);
  if (type === 'counter' && campKind !== 'magic') face.counter = 1; // Score Studio reads a counter maneuver as one Counter stack
  const setTags = () => { face.tags = area ? [...tags, 'targeting:area', 'targeting.allEnemies'] : [...tags]; };
  face.sp = Number.isInteger(input.sp) ? input.sp : pick(rand, 3);
  face.mp = campKind === 'martial' ? 0 : Number.isInteger(input.mp) ? input.mp : camp === 'spell' ? pick(rand, 2) : 0;
  let keyword = input.keyword || null;
  const baseHp = input.drawback ? 1 + pick(rand, 3) : 0;

  // Riders: the legacy target keeps the first generator's Poise or draw; otherwise effects-1 riders from the allowed pools, no repeats.
  let riders = [];
  if (legacy) {
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
    Object.assign(face, { dmg: 0, blk: 0, poise: 0, draw: 0, heal: 0, cleanse: 0, restoreSp: 0, restoreMp: 0, move: 0, statuses: [], loseHp: hp });
    for (const r of riders) applyRider(face, r);
    face.kw = keyword ? [keyword] : [];
    setTags();
  };
  // The primary is at least 1 face point, so a card always does its main thing.
  const solve = (hp) => {
    build(hp);
    const base = face[key];
    for (let v = 1; v <= MAX_PRIMARY; v++) { face[key] = base + v; const r = ScoreCard(face, scoring).raw; if (r === raw) return true; if (r > raw) return false; }
    return false;
  };
  // Fallback order when nothing fits: drop riders last-picked first, then a keyword that adds power, then area, then add HP cost.
  let ok = solve(baseHp);
  while (!ok && riders.length) { riders.pop(); ok = solve(baseHp); }
  if (!ok && keyword && (scoring.keywords[keyword]?.flat ?? 1) >= 0) { keyword = null; ok = solve(baseHp); }
  if (!ok && area && !shape.area) { area = false; ok = solve(baseHp); }
  for (let hp = baseHp + 1; !ok && hp <= MAX_HP_COST; hp++) ok = solve(hp);
  if (!ok) throw new Error(`cardGenerator: no face reaches raw ${raw} (${JSON.stringify(input)})`);
  const check = CombatPower(ScoreCard(face, scoring).raw, rarity, scoring);
  if (check !== cp) throw new Error(`cardGenerator: face scores ${check}, wanted ${cp} (${JSON.stringify(input)})`);
  return { face, cp, riders, target: { rarity, cls, camp, campKind, type, kind, school, area, keyword, seed } };
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
 * GenerateCard(target, {scoring, spellExposureBuildup}) -> a Core cards.json-shaped definition (id `gen.<seed>`) whose ScoreCard face lands exactly
 * on the target. `spellExposureBuildup` (5) is the Exposure per hit a generated magic attack that costs Mana is authored with; no floor applies to a card (owner ruling 2026-11-22).
 */
export const GenerateCard = (input, options) => GenerateCardWithTarget(input, options).card;

/** GenerateCardWithTarget(target, options) -> {card, cp}: GenerateCard's card and the combat power it was built to. */
export function GenerateCardWithTarget(input, { scoring = shippedScoring, spellExposureBuildup = 5 } = {}) {
  const { face, cp, riders, target } = GenerateFace(input, { scoring });
  const { rarity, cls, camp, campKind, type, kind, area, keyword, seed } = target;
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
  const keywordText = keyword ? ` ${keyword[0].toUpperCase()}${keyword.slice(1)}.` : '';
  const card = {
    id: `gen.${seed}`, name: CardName(face, 0, scoring), class: cls, rarity, cost: face.sp, staminaCost: face.sp, manaCost: face.mp, costRule: 'fixed', type: kind,
    icon: kind === 'attack' ? 'attack' : 'shield', keywords: keyword ? [keyword] : [], effects: parts.map((p) => p.effect), tags: face.tags,
    textTemplate: parts.map((p) => p.text).join(' ') + keywordText, ...(parts.length > 1 ? { faceTemplate: parts.slice(0, 3).map((p) => p.face || p.text) } : {}),
    flavor: `Generated: combat power ${cp}, Rank ${RankOf(cp, scoring)}.`,
    ...(face.magicShare ? { magicShare: face.magicShare } : {}),
    ...(kind === 'attack' ? { damageSchool: camp === 'spell' ? 'magic' : 'physical', exposureBuildupPerHit: camp === 'spell' && face.mp ? spellExposureBuildup : 0 } : {}),
  };
  return { card, cp };
}
