// src/model/cardGenerator.js — generate a card (or batch of cards) of a target combat power (owner, 2026-11-21).
//
// Pure and headless; safe for both Score Studio and procedural runtime generation inside the game.
// GenerateCard({rarity, rank | combatPower, cls, camp, type, school, stances, effectCount, targeting, keywords,
// aimMaxCp, sp, mp, seed}, {scoring}) returns a Core cards.json-shaped definition whose ScoreCard face lands on
// the target combat power (or closest CP <= rank ceiling when aimMaxCp is set).
import { scoring as shippedScoring } from '../content/generated/scoring.js';
import { BaseFace, ScoreCard, CombatPower, RankOf, CardName } from './combatPower.js';

const BLOCK_ADD = 6; // scoring.items.kit.weaponArt: "Block x0.49 + 6 (DR add)"
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function seededPrng(seed) {
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

const authoredDamage = (face, camp, scoring) => Math.max(1, Math.round((face - scoring.items.kit.unarmedAttack) / (camp === 'spell' ? scoring.model.AUTH_SPELL : scoring.model.AUTH_PHYS)));
const authoredBlock = (face, scoring) => Math.max(1, Math.round((face - BLOCK_ADD) / scoring.model.AUTH_BLOCK));

function normalizeStances(input) {
  const raw = Array.isArray(input.stances) ? input.stances : (input.stance ? [input.stance] : []);
  return [...new Set(raw.map((s) => String(s || '').trim().toLowerCase()).filter((s) => GENERATOR_STANCES.includes(s)))];
}

function hasExtendedCriteria(input) {
  return !!(
    input.school
    || (Array.isArray(input.stances) && input.stances.length)
    || input.stance
    || Number.isInteger(input.effectCount)
    || (input.targeting && input.targeting !== 'single')
    || (Array.isArray(input.keywords) && input.keywords.length)
    || Number.isInteger(input.sp)
    || Number.isInteger(input.mp)
    || input.aimMaxCp
  );
}

/**
 * GenerateFace(target, {scoring}) -> {face, cp, target}: the scorer's face (src/model/combatPower.js) and the combat power it lands on.
 * Backwards-compatible with the original {rarity, rank | combatPower, cls, camp, type, seed} signature, and supports optional extended
 * criteria: {school, stances, effectCount, targeting, keywords, sp, mp, aimMaxCp}.
 */
export function GenerateFace(input, { scoring = shippedScoring } = {}) {
  const { rarity = 'common', cls = 'colorless', seed = 1 } = input;
  const school = input.school && GENERATOR_SCHOOLS.includes(input.school) ? input.school : null;
  const camp = input.camp || (school ? 'spell' : 'physical');
  const type = input.type || 'attack';
  if (!(rarity in scoring.rarity.discount)) throw new Error(`cardGenerator: unknown rarity '${rarity}'`);
  if (!['attack', 'skill'].includes(type)) throw new Error(`cardGenerator: type must be attack or skill, not '${type}'`);
  if (!['physical', 'spell'].includes(camp)) throw new Error(`cardGenerator: camp must be physical or spell, not '${camp}'`);

  const extended = hasExtendedCriteria(input);
  const stances = normalizeStances(input);
  const targeting = input.targeting === 'area' ? 'area' : 'single';
  const keywords = Array.isArray(input.keywords)
    ? [...new Set(input.keywords.map((k) => String(k || '').toLowerCase()).filter((k) => GENERATOR_KEYWORDS.includes(k)))]
    : [];
  const effectCount = Number.isInteger(input.effectCount) ? Math.max(1, Math.min(4, input.effectCount)) : null;

  const seedKey = extended
    ? `${seed}|${rarity}|${cls}|${camp}|${type}|${school || ''}|${stances.join(',')}|${effectCount || ''}|${targeting}|${keywords.join(',')}`
    : `${seed}|${rarity}|${cls}|${camp}|${type}`;
  const rand = seededPrng(seedKey);

  let cp;
  if (Number.isFinite(input.combatPower)) cp = Math.round(input.combatPower);
  else if (Number.isInteger(input.rank)) cp = TargetCp(input.rank, rand, scoring, { aimMaxCp: !!input.aimMaxCp });
  else throw new Error('cardGenerator: give a rank or a combatPower');
  if (cp > MaxCpOf(scoring)) throw new Error(`cardGenerator: combat power ${cp} is over the ceiling ${MaxCpOf(scoring)} (scoring.rank.maxCp)`);
  const raw = cp + scoring.rarity.discount[rarity];

  const face = Object.assign(BaseFace(), { cls, rarity, camp, type });
  let primaryManeuver = camp === 'spell' ? 'casting' : (type === 'attack' ? 'attack' : 'defend');
  let stanceTrigger = null;
  if (stances.length) {
    const first = stances[0];
    if (first === 'evade') {
      primaryManeuver = 'defend';
      stanceTrigger = { stance: 'evade' };
    } else if (first === 'prepared') {
      primaryManeuver = camp === 'spell' ? 'casting' : (type === 'attack' ? 'attack' : 'defend');
    } else {
      primaryManeuver = first;
    }
  }

  face.tags = [
    `camp:${camp}`,
    ...(camp === 'spell' ? ['source:spell', `maneuver:${primaryManeuver}`] : [`maneuver:${primaryManeuver}`]),
    `classification.${type}`,
  ];
  if (camp === 'spell') {
    face.tags.push(school === 'divine' ? 'tradition:divine' : 'tradition:arcane');
    if (school) face.tags.push(`school:${school}`);
  }
  if (targeting === 'area') face.tags.push('targeting:area');
  if (keywords.length) face.kw = [...keywords];

  face.sp = Number.isInteger(input.sp) ? Math.max(0, input.sp) : pick(rand, 3);
  face.mp = Number.isInteger(input.mp) ? Math.max(0, input.mp) : (camp === 'spell' ? pick(rand, 2) : 0);

  const key = type === 'attack' ? 'dmg' : 'blk';
  const addStatus = (status, stacks, target) => {
    if (!status || !(status in (scoring.statuses || {}))) return;
    if (face.statuses.some(([s]) => s === status)) return;
    face.statuses.push([status, stacks, target]);
  };

  if (!extended) {
    if (type === 'attack') face.poise = 3 * pick(rand, 3); else face.draw = pick(rand, 2);
  } else {
    // Stance riders (evade / counter / prepared)
    for (const st of stances) {
      if (st === 'evade') { stanceTrigger = { stance: 'evade' }; addStatus('evade', 1, 'self'); }
      else if (st === 'counter') addStatus('counter', 1, 'self');
      else if (st === 'prepared') addStatus('prepared', 1, 'self');
    }
    const desiredExtras = Math.max(0, (effectCount ?? (1 + pick(rand, 2))) - 1);
    const currentExtras = () => (face.poise ? 1 : 0) + (face.draw ? 1 : 0) + (face.heal ? 1 : 0) + (face.restoreMp ? 1 : 0) + face.statuses.length;

    // Add deterministic extra riders up to desiredExtras
    let guard = 0;
    while (currentExtras() < desiredExtras && guard++ < 8) {
      const slot = (guard + pick(rand, 4)) % 4;
      if (school && SCHOOL_STATUS[school] && !face.statuses.some(([s]) => s === SCHOOL_STATUS[school][0])) {
        const [st, tgt] = SCHOOL_STATUS[school];
        addStatus(st, 1 + pick(rand, 2), tgt);
      } else if (type === 'attack' && !face.poise && slot === 0) {
        face.poise = 3 * (1 + pick(rand, 2));
      } else if (!face.draw && slot === 1) {
        face.draw = 1;
      } else if (type === 'skill' && !face.heal && school === 'divine') {
        face.heal = 3;
      } else {
        const pool = type === 'attack' ? PHYSICAL_ATTACK_STATUSES : PHYSICAL_SKILL_STATUSES;
        const [st, tgt] = pickFrom(rand, pool);
        addStatus(st, 1 + pick(rand, 2), tgt);
      }
    }
  }

  const rawOf = () => ScoreCard(face, scoring).raw;
  const solve = () => {
    for (let v = 0; v <= 999; v++) {
      face[key] = v;
      const r = rawOf();
      if (r === raw) return true;
      if (r > raw) return false;
    }
    return false;
  };
  let ok = solve();
  if (!ok) { face.poise = 0; face.draw = 0; face.heal = 0; ok = solve(); }
  const protectedStatusCount = stances.filter((s) => ['evade', 'counter', 'prepared'].includes(s)).length;
  if (!ok && face.statuses.length > protectedStatusCount) {
    while (!ok && face.statuses.length > protectedStatusCount) {
      face.statuses.pop();
      ok = solve();
    }
  }
  if (!ok && extended && !Number.isInteger(input.sp)) {
    const origSp = face.sp;
    for (const sp of [origSp + 1, origSp + 2, 0, 1, 2, 3]) {
      if (sp < 0 || sp > 3) continue;
      face.sp = sp;
      if (solve()) { ok = true; break; }
    }
    if (!ok) face.sp = origSp;
  }
  for (let hp = 1; !ok && hp <= 99; hp++) { face.loseHp = hp; ok = solve(); }
  if (!ok && face.statuses.length) {
    face.statuses.length = 0;
    face.loseHp = 0;
    ok = solve();
    for (let hp = 1; !ok && hp <= 99; hp++) { face.loseHp = hp; ok = solve(); }
  }
  // If still unable to land exact raw (e.g. step size > 1 with area/multipliers), pick closest raw <= target
  if (!ok && extended) {
    let bestV = 0;
    let bestDiff = Infinity;
    for (let v = 0; v <= 999; v++) {
      face[key] = v;
      const r = rawOf();
      const diff = raw - r;
      if (diff >= 0 && diff < bestDiff) { bestDiff = diff; bestV = v; }
      if (r > raw + 4) break;
    }
    face[key] = bestV;
    ok = true;
  }
  if (!ok) throw new Error(`cardGenerator: no face reaches raw ${raw} (${JSON.stringify(input)})`);
  const check = CombatPower(ScoreCard(face, scoring).raw, rarity, scoring);
  if (!extended && check !== cp) throw new Error(`cardGenerator: face scores ${check}, wanted ${cp} (${JSON.stringify(input)})`);
  return {
    face,
    cp: check,
    target: { rarity, cls, camp, type, seed, school, stances, targeting, keywords, stanceTrigger },
  };
}

/**
 * GenerateCard(target, {scoring, spellExposureBuildup, idPrefix, applyNaming}) -> a Core cards.json-shaped definition
 * whose ScoreCard face lands on the target combat power.
 */
export function GenerateCard(input, { scoring = shippedScoring, spellExposureBuildup = 5, idPrefix = 'gen', applyNaming = true } = {}) {
  const { face, cp, target } = GenerateFace(input, { scoring });
  const { rarity, cls, camp, type, seed, targeting, keywords, stanceTrigger } = target;
  const enemyTarget = targeting === 'area' ? 'allEnemies' : 'enemy';
  const effects = [], parts = [], faceTemplate = [];
  const text = (t) => { parts.push(t); faceTemplate.push(t); };

  if (face.loseHp) effects.push({ op: 'loseHp', target: 'self', amount: face.loseHp, nonlethal: true });
  if (face.draw) effects.push({ op: 'draw', amount: face.draw });
  if (type === 'attack') {
    effects.push({ op: 'damage', target: enemyTarget, amount: authoredDamage(face.dmg, camp, scoring) });
    text(targeting === 'area' ? 'Deal {damage} damage to all enemies.' : 'Deal {damage} damage.');
    if (face.poise) {
      effects.push({ op: 'poiseDamage', target: enemyTarget, amount: face.poise });
      text('Deal {poiseDamage} Poise damage.');
    }
  } else {
    if (face.blk > 0 || !face.statuses.length) {
      effects.push({ op: 'block', target: 'self', amount: authoredBlock(face.blk, scoring) });
      text('Gain {block} Block.');
    }
    if (face.heal) {
      effects.push({ op: 'heal', target: 'self', amount: face.heal });
      text('Heal {heal} HP.');
    }
    if (face.draw) text(`Draw {draw} card${face.draw > 1 ? 's' : ''}.`);
  }
  if (type === 'attack' && face.draw) text(`Draw {draw} card${face.draw > 1 ? 's' : ''}.`);
  for (const [status, stacks, stTarget] of face.statuses) {
    const resolvedTarget = stTarget === 'self' ? 'self' : enemyTarget;
    effects.push({ op: 'applyStatus', target: resolvedTarget, status, stacks });
    const label = STATUS_LABELS[status] || status;
    if (resolvedTarget === 'self') text(`Gain ${stacks} ${label}.`);
    else text(`Apply ${stacks} ${label}.`);
  }
  if (face.loseHp) text('Lose {loseHp} HP.');

  const computedName = applyNaming ? CardName(face, 0, scoring) : `Generated ${type === 'attack' ? 'Attack' : 'Skill'} ${seed}`;
  return {
    id: `${idPrefix}.${seed}`,
    name: computedName,
    class: cls,
    rarity,
    cost: face.sp,
    staminaCost: face.sp,
    manaCost: face.mp,
    costRule: 'fixed',
    type,
    icon: type === 'attack' ? 'attack' : 'shield',
    keywords: [...(keywords || [])],
    effects,
    tags: [...face.tags],
    textTemplate: parts.join(' '),
    ...(parts.length > 1 ? { faceTemplate } : {}),
    flavor: `Generated: combat power ${cp}, Rank ${RankOf(cp, scoring)}.`,
    ...(stanceTrigger ? { stanceTrigger } : {}),
    ...(type === 'attack' ? { damageSchool: camp === 'spell' ? 'magic' : 'physical', exposureBuildupPerHit: camp === 'spell' && face.mp ? spellExposureBuildup : 0 } : {}),
  };
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
