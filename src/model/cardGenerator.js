// src/model/cardGenerator.js — generate a card of a target combat power (owner, 2026-11-21).
//
// Pure and headless; not wired into any reward pool. generateCard({rarity, rank | combatPower, cls, camp, type, seed}, {scoring}) returns a
// Core cards.json-shaped definition (id `gen.<seed>`) whose scoreCard face lands EXACTLY on the target combat power:
//
//   1. target cp  = the given combatPower, or a cp inside the rank band (picked by the seed); raw target = cp + rarity discount;
//   2. the face (src/model/combatPower.js baseFace) gets SP/MP costs and one primary effect (damage for attacks, Block for skills),
//      plus an optional Poise rider (attack) or draw (skill); the primary amount is solved so the rounded raw score equals the target;
//      a target too low for any effect adds an HP-cost drawback instead of going unreachable;
//   3. the AUTHORED effect amounts are converted back from the face numbers with the scorer's authored-to-final constants
//      (scoring.model.AUTH_PHYS / AUTH_SPELL / AUTH_BLOCK; the unarmed attack baseline from scoring.items.kit and the Block add of 6 that
//      scoring.items.kit.weaponArt documents): face damage = 3 + 0.35 x authored (spell 0.5), face Block = 6 + 0.49 x authored.
// The face, not the authored amount, is the scored truth; authored amounts never go below 1.
import { scoring as shippedScoring } from '../content/generated/scoring.js';
import { baseFace, scoreCard, combatPower, rankOf, cardName } from './combatPower.js';

const BLOCK_ADD = 6; // scoring.items.kit.weaponArt: "Block x0.49 + 6 (DR add)"
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function prng(seed) { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (rand, n) => Math.floor(rand() * n);

/** The combat power a rank's band holds, chosen by the seed (Unranked: 0 down to -2; the top rank: maxRank band floor and up). */
export function targetCp(rank, rand, scoring = shippedScoring) {
  const RK = scoring.rank;
  if (rank === 0) return 0 - pick(rand, 3);
  if (rank < 0 || rank > RK.maxRank) throw new Error(`cardGenerator: rank ${rank} is outside 0..${RK.maxRank}`);
  const top = rank * RK.width;
  return rank === RK.maxRank ? top - (RK.width - 1) + pick(rand, 3) : top - pick(rand, RK.width);
}

const authoredDamage = (face, camp, scoring) => Math.max(1, Math.round((face - scoring.items.kit.unarmedAttack) / (camp === 'spell' ? scoring.model.AUTH_SPELL : scoring.model.AUTH_PHYS)));
const authoredBlock = (face, scoring) => Math.max(1, Math.round((face - BLOCK_ADD) / scoring.model.AUTH_BLOCK));

/**
 * generateFace(target, {scoring}) -> {face, cp, target}: the scorer's face (src/model/combatPower.js) and the combat power it lands on
 * exactly. `target` is {rarity, rank | combatPower, cls, camp, type, seed}, defaults filled in. `type` is 'attack' (default) or 'skill';
 * `camp` 'physical' (default) or 'spell'; `cls` defaults to 'colorless'.
 */
export function generateFace(input, { scoring = shippedScoring } = {}) {
  const { rarity = 'common', cls = 'colorless', camp = 'physical', type = 'attack', seed = 1 } = input;
  if (!(rarity in scoring.rarity.discount)) throw new Error(`cardGenerator: unknown rarity '${rarity}'`);
  if (!['attack', 'skill'].includes(type)) throw new Error(`cardGenerator: type must be attack or skill, not '${type}'`);
  if (!['physical', 'spell'].includes(camp)) throw new Error(`cardGenerator: camp must be physical or spell, not '${camp}'`);
  const rand = prng(`${seed}|${rarity}|${cls}|${camp}|${type}`);
  let cp;
  if (Number.isFinite(input.combatPower)) cp = Math.round(input.combatPower);
  else if (Number.isInteger(input.rank)) cp = targetCp(input.rank, rand, scoring);
  else throw new Error('cardGenerator: give a rank or a combatPower');
  const raw = cp + scoring.rarity.discount[rarity];

  const face = Object.assign(baseFace(), { cls, rarity, camp, type });
  face.tags = [`camp:${camp}`, ...(camp === 'spell' ? ['source:spell', 'maneuver:casting'] : [type === 'attack' ? 'maneuver:attack' : 'maneuver:defend']), `classification.${type}`];
  if (camp === 'spell') face.tags.push('tradition:arcane');
  face.sp = pick(rand, 3); face.mp = camp === 'spell' ? pick(rand, 2) : 0;
  if (face.mp) face.sp = Math.max(1, face.sp); // a Mana card costs at least 1 action (balance.mana.minActionCost)
  let value = raw + 5 * face.sp + 7 * face.mp; // what the effects must be worth
  if (value < 1) { face.sp = 0; face.mp = 0; value = raw; }
  const drawback = Math.max(0, 1 - value); // a target below any effect: one point of effect, the rest as lost HP
  if (drawback) { face.loseHp = drawback; value = 1; }
  if (type === 'attack') {
    const poise = value >= 3 ? pick(rand, Math.min(3, Math.floor(value / 2)) + 1) : 0; // value in damage points: poise/3 each
    face.poise = 3 * poise; face.dmg = value - poise;
  } else {
    const draw = value >= 6 ? pick(rand, Math.min(2, Math.floor(value / 6)) + 1) : 0;
    face.draw = draw; face.blk = 2 * (value - 3 * draw);
  }
  const check = combatPower(scoreCard(face, scoring).raw, rarity, scoring);
  if (check !== cp) throw new Error(`cardGenerator: face scores ${check}, wanted ${cp} (${JSON.stringify(input)})`);
  return { face, cp, target: { rarity, cls, camp, type, seed } };
}

/**
 * generateCard(target, {scoring, buildupPerManaSpell}) -> a Core cards.json-shaped definition (id `gen.<seed>`) whose scoreCard face lands exactly
 * on the target. `buildupPerManaSpell` is balance.exposure.buildupPerManaSpell (5 in Core), the Exposure floor of a Mana-costing magic attack.
 */
export function generateCard(input, { scoring = shippedScoring, buildupPerManaSpell = 5 } = {}) {
  const { face, cp, target } = generateFace(input, { scoring });
  const { rarity, cls, camp, type, seed } = target;
  const effects = [], parts = [], faceTemplate = [];
  const text = (t) => { parts.push(t); faceTemplate.push(t); };
  if (face.loseHp) effects.push({ op: 'loseHp', target: 'self', amount: face.loseHp, nonlethal: true });
  if (face.draw) effects.push({ op: 'draw', amount: face.draw });
  if (type === 'attack') {
    effects.push({ op: 'damage', target: 'enemy', amount: authoredDamage(face.dmg, camp, scoring) });
    text('Deal {damage} damage.');
    if (face.poise) { effects.push({ op: 'poiseDamage', target: 'enemy', amount: face.poise }); text('Deal {poiseDamage} Poise damage.'); }
  } else {
    effects.push({ op: 'block', target: 'self', amount: authoredBlock(face.blk, scoring) });
    text('Gain {block} Block.');
    if (face.draw) text(`Draw {draw} card${face.draw > 1 ? 's' : ''}.`);
  }
  if (face.loseHp) text('Lose {loseHp} HP.');
  return {
    id: `gen.${seed}`, name: cardName(face, 0, scoring), class: cls, rarity, cost: face.sp, staminaCost: face.sp, manaCost: face.mp, costRule: 'fixed', type,
    icon: type === 'attack' ? 'attack' : 'shield', keywords: [], effects, tags: face.tags,
    textTemplate: parts.join(' '), ...(parts.length > 1 ? { faceTemplate } : {}),
    flavor: `Generated: combat power ${cp}, Rank ${rankOf(cp, scoring)}.`,
    ...(type === 'attack' ? { damageSchool: camp === 'spell' ? 'magic' : 'physical', exposureBuildupPerHit: camp === 'spell' && face.mp ? buildupPerManaSpell : 0 } : {}),
  };
}
