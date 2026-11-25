// src/model/itemGenerator.js — deterministic procedural generator for weapons, armours, and relics.
//
// Pure and headless; usable both in Score Studio and procedurally inside the game.
// Any omitted or 'auto' criteria is deterministically generated from seed, then tuned so the item lands
// on the closest Combat Power <= the maximum allowed for its target rank (respecting rarity discounts).
import { scoring as shippedScoring } from '../content/generated/scoring.js';
import { GEAR_TYPES } from '../content/gearTypes.js';
import { ScoreItem, CombatPower, RankOf, ItemNameParts } from './combatPower.js';
import { seededPrng, RankBand, RankMaxCp, MaxCpOf } from './cardGenerator.js';

const pick = (rand, n) => Math.floor(rand() * n);
const pickFrom = (rand, list) => list[pick(rand, list.length)];

export const ITEM_GENERATOR_KINDS = Object.freeze(['weapon', 'armour', 'relic']);
export const ITEM_GENERATOR_RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'boss']);
export const ITEM_GENERATOR_CLASSES = Object.freeze(['reaver', 'starseer', 'rogue', 'herald']);
export const ITEM_GENERATOR_ELEMENTS = Object.freeze(['none', 'fire', 'frost', 'lightning', 'decay', 'bleed', 'venom', 'divine']);
export const ITEM_GENERATOR_RANGES = Object.freeze(['melee', 'reach', 'ranged']);

const WEAPON_TRAIT_POOL = Object.freeze({
  none: [
    ['attack.cardDamage', 1, 3],
    ['attack.pierce', 1, 2],
    ['smash.cardPoise', 1, 3],
    ['smash.hitVulnerable', 1, 2],
    ['attack.hitWeak', 1, 2],
    ['self.statStr', 1, 2],
    ['self.statDex', 1, 2],
    ['self.firstTurnStamina', 1, 2],
  ],
  fire: [['smash.hitBurn', 1, 3], ['spell:fire.cardDamage', 1, 3], ['self.resistFire', 1, 2]],
  frost: [['smash.hitFrost', 1, 3], ['spell:frost.cardDamage', 1, 3], ['self.resistFrost', 1, 2]],
  lightning: [['spell:lightning.cardDamage', 1, 3], ['attack.hitVulnerable', 1, 2], ['self.resistLightning', 1, 2]],
  decay: [['spell:decay.hitBlight', 1, 3], ['spell:decay.cardDamage', 1, 3], ['self.resistDecay', 1, 2]],
  bleed: [['smash.hitBleed', 1, 3], ['attack.hitBleed', 1, 2]],
  venom: [['attack.hitVenom', 1, 3], ['smash.hitVenom', 1, 3]],
  divine: [['spell:healing.cardHeal', 1, 3], ['self.turnWard', 1, 2], ['self.statWis', 1, 2]],
});

const ARMOUR_TRAIT_POOL = Object.freeze({
  none: [
    ['defend.block', 1, 3],
    ['self.statPoise', 1, 3],
    ['self.maxHp', 2, 8],
    ['self.thorns', 1, 2],
    ['self.turnWard', 1, 2],
    ['self.statCon', 1, 2],
    ['self.statDex', 1, 2],
    ['self.statWis', 1, 2],
    ['self.counterGain', 1, 1],
    ['self.evadeGain', 1, 1],
  ],
  fire: [['self.resistFire', 1, 2], ['self.thorns', 1, 2]],
  frost: [['self.resistFrost', 1, 2], ['defend.block', 1, 3]],
  lightning: [['self.resistLightning', 1, 2], ['self.statDex', 1, 2]],
  decay: [['self.resistDecay', 1, 2], ['self.maxHp', 2, 6]],
  bleed: [['self.thorns', 1, 2], ['self.statCon', 1, 2]],
  venom: [['self.evadeGain', 1, 1], ['self.statDex', 1, 2]],
  divine: [['self.turnWard', 1, 2], ['self.maxMana', 1, 2], ['self.statWis', 1, 2]],
});

const RELIC_PASSIVE_TEMPLATES = Object.freeze([
  { key: 'maxHp', modKey: 'relic.maxHp', min: 3, max: 20, step: 1, text: (n) => `Max HP +${n}.` },
  { key: 'poiseThresholdAdd', modKey: 'relic.poise', min: 1, max: 8, step: 1, text: (n) => `Poise threshold +${n}.` },
  { key: 'maxMana', modKey: 'relic.mana', min: 1, max: 4, step: 1, text: (n) => `+${n} max Mana.` },
  { key: 'maxStamina', modKey: 'relic.stamina', min: 1, max: 3, step: 1, text: (n) => `+${n} max Stamina.` },
  { key: 'magicDamageAdd', modKey: 'relic.magicDamage', min: 1, max: 5, step: 1, text: (n) => `Magic damage +${n}.` },
  { key: 'physicalDamageAdd', modKey: 'relic.physicalDamage', min: 1, max: 5, step: 1, text: (n) => `Physical damage +${n}.` },
  { key: 'blockAdd', modKey: 'relic.block', min: 1, max: 6, step: 1, text: (n) => `Block gained +${n}.` },
]);

const RELIC_TRIGGER_TEMPLATES = Object.freeze([
  { on: 'combatStart', once: false, limitPerTurn: 0, everyNth: 0, op: 'applyStatus', status: 'strength', target: 'owner', min: 1, max: 3, text: (n) => `At the start of each combat, gain ${n} Strength.` },
  { on: 'combatStart', once: false, limitPerTurn: 0, everyNth: 0, op: 'block', target: 'owner', min: 3, max: 14, text: (n) => `At the start of each combat, gain ${n} Block.` },
  { on: 'turnStart', once: false, limitPerTurn: 0, everyNth: 0, op: 'block', target: 'owner', min: 2, max: 8, text: (n) => `At the start of each turn, gain ${n} Block.` },
  { on: 'turnStart', once: false, limitPerTurn: 0, everyNth: 0, op: 'heal', target: 'owner', min: 1, max: 5, text: (n) => `At the start of each turn, heal ${n} HP.` },
  { on: 'enemyStaggered', once: false, limitPerTurn: 1, everyNth: 0, op: 'draw', target: 'owner', min: 1, max: 3, text: (n) => `Whenever an enemy is Broken, draw ${n} card${n > 1 ? 's' : ''}.` },
  { on: 'damageDealt', once: true, limitPerTurn: 0, everyNth: 0, op: 'applyStatus', status: 'bleed', target: 'enemy', min: 1, max: 5, text: (n) => `Your first attack each combat applies ${n} Bleed.` },
  { on: 'damageDealt', once: true, limitPerTurn: 0, everyNth: 0, op: 'applyStatus', status: 'burn', target: 'enemy', min: 1, max: 5, text: (n) => `Your first attack each combat applies ${n} Burn.` },
  { on: 'cardPlayed', once: false, limitPerTurn: 0, everyNth: 6, op: 'restoreStamina', target: 'owner', min: 1, max: 2, text: (n) => `Every 6th card you play each combat: gain ${n} Stamina.` },
  { on: 'cardPlayed', once: false, limitPerTurn: 0, everyNth: 6, op: 'block', target: 'owner', min: 3, max: 12, text: (n) => `Every 6th card you play each combat: gain ${n} Block.` },
]);

const fmtMod = (key, value) => `${key}=${value >= 0 ? `+${value}` : String(value)}`;
const parseModPairs = (list) => (list || []).map((raw) => {
  if (Array.isArray(raw)) return raw;
  const [k, v] = String(raw).split('=');
  const n = Number(v);
  return [k, Number.isFinite(n) ? n : 1];
});
const itemDiscount = (rarity, scoring) => scoring.items?.rarityDiscount?.[rarity] ?? scoring.rarity?.discount?.[rarity] ?? 0;

/** Score a studio-shaped item entry with live scoring weights. */
export function ScoreGeneratedItem(entry, scoring = shippedScoring, rules = {}) {
  const typeMods = entry.kind === 'weapon'
    ? [...(GEAR_TYPES.weaponTypes?.[entry.gearType]?.mods || [])]
    : entry.kind === 'armour'
      ? [...(GEAR_TYPES.armourGroups?.[entry.gearGroup]?.mods || [])]
      : [];
  const face = {
    kind: entry.kind,
    id: entry.id,
    name: entry.name,
    rarity: entry.rarity || 'common',
    gearType: entry.gearType,
    gearGroup: entry.gearGroup,
    poiseDamage: entry.poiseDamage,
    range: entry.range || 'melee',
    poise: entry.poise || 0,
    weight: entry.weight || 0,
    mods: parseModPairs(entry.mods),
    typeMods: parseModPairs(typeMods),
    props: entry.props || [],
    tags: entry.tags || [],
    attackBase: entry.attackBase ?? 3,
    magicShare: entry.magicShare ?? 0,
    guardBase: entry.guardBase ?? 1,
    art: entry.art || null,
    passives: entry.passives || null,
    triggers: entry.triggers || null,
  };
  const sc = ScoreItem(face, scoring, rules);
  const disc = itemDiscount(entry.rarity || 'common', scoring);
  const cp = sc.raw - disc;
  const rank = RankOf(cp, scoring);
  const convention = ItemNameParts(face, 0, scoring, rules);
  return { raw: sc.raw, disc, cp, rank, parts: sc.parts, face, convention };
}

function chooseTargetCp(input, rand, scoring) {
  if (Number.isFinite(input.combatPower)) return Math.min(Math.round(input.combatPower), MaxCpOf(scoring));
  const rank = Number.isInteger(input.rank) ? input.rank : 1;
  if (input.aimMaxCp !== false) return RankMaxCp(rank, scoring);
  const { min, max } = RankBand(rank, scoring);
  return min + pick(rand, max - min + 1);
}

function pickBestCandidate(candidates, targetCp, band) {
  let best = null;
  let bestScore = Infinity;
  for (const cand of candidates) {
    const inBand = cand.cp >= band.min && cand.cp <= band.max;
    const overCeiling = cand.cp > band.max;
    // Strongly prefer staying inside [band.min, band.max] and as close to targetCp (<= band.max) as possible.
    const penalty = (inBand ? 0 : (overCeiling ? 2000 : 1000)) + Math.abs(targetCp - cand.cp) * 10 + (cand.editCost || 0);
    if (penalty < bestScore) { bestScore = penalty; best = cand; }
  }
  return best;
}

/**
 * GenerateItem(criteria, { scoring, rules, idPrefix }) -> a Score Studio + game-compatible item entry
 * whose CP lands as close as possible to the target rank's maximum allowed CP.
 */
export function GenerateItem(input = {}, { scoring = shippedScoring, rules = {}, idPrefix = 'genItem' } = {}) {
  const seed = input.seed ?? 1;
  const rand = seededPrng(`itemGen|${seed}|${input.kind || ''}|${input.rarity || ''}|${input.rank ?? ''}|${input.gearType || ''}|${input.gearGroup || ''}|${input.element || ''}`);
  const kind = input.kind && ITEM_GENERATOR_KINDS.includes(input.kind) ? input.kind : pickFrom(rand, ITEM_GENERATOR_KINDS);
  const rarity = input.rarity && (input.rarity in (scoring.items?.rarityDiscount || { common: 0, uncommon: 2, rare: 5, boss: 7, starter: 0 }))
    ? input.rarity
    : pickFrom(rand, ITEM_GENERATOR_RARITIES.slice(0, 3));
  const rank = Number.isInteger(input.rank) ? Math.max(0, Math.min(scoring.rank.maxRank, input.rank)) : (rarity === 'boss' ? 4 : rarity === 'rare' ? 3 : rarity === 'uncommon' ? 2 : 1);
  const targetCp = chooseTargetCp({ ...input, rank }, rand, scoring);
  const band = Number.isFinite(input.combatPower)
    ? { min: Math.round(input.combatPower), max: Math.round(input.combatPower) }
    : RankBand(rank, scoring);
  const element = input.element && ITEM_GENERATOR_ELEMENTS.includes(input.element) ? input.element : pickFrom(rand, ITEM_GENERATOR_ELEMENTS);
  const applyNaming = input.applyNaming !== false;
  const id = `${idPrefix}_${kind}_${seed}`;

  if (kind === 'weapon') {
    const weaponTypes = Object.keys(GEAR_TYPES.weaponTypes || {});
    const gearType = input.gearType && weaponTypes.includes(input.gearType) ? input.gearType : pickFrom(rand, weaponTypes);
    const typeRow = GEAR_TYPES.weaponTypes?.[gearType] || { label: gearType, poiseDamage: 1, mods: [] };
    const isStaff = ['staff', 'sceptre', 'talisman', 'chime', 'tome'].includes(gearType);
    const range = input.range && ITEM_GENERATOR_RANGES.includes(input.range)
      ? input.range
      : (gearType === 'bow' || gearType === 'crossbow' ? 'ranged' : (['spear', 'halberd', 'whip'].includes(gearType) ? 'reach' : 'melee'));
    const traitCount = Number.isInteger(input.traitCount) ? Math.max(0, Math.min(3, input.traitCount)) : (rank >= 2 ? 1 : pick(rand, 2));
    const pool = [...(WEAPON_TRAIT_POOL[element] || []), ...WEAPON_TRAIT_POOL.none];
    const chosenTraits = [];
    for (let i = 0; i < traitCount; i++) {
      const cand = pickFrom(rand, pool);
      if (!chosenTraits.some(([k]) => k === cand[0])) chosenTraits.push(cand);
    }
    const basePoise = Number.isFinite(typeRow.poiseDamage) ? typeRow.poiseDamage : 1;
    const baseEntry = {
      key: `weapon:${id}`,
      kind: 'weapon',
      id,
      name: `Generated ${typeRow.label || gearType}`,
      rarity,
      base: gearType,
      sub: isStaff ? 'staff' : 'weapon',
      gearType,
      poiseDamage: basePoise,
      range,
      poise: 0,
      weight: isStaff ? 2 : 3,
      dmgType: ['hammer', 'mace', 'club', 'staff'].includes(gearType) ? 'blunt' : (['dagger', 'spear', 'rapier', 'bow', 'crossbow'].includes(gearType) ? 'piercing' : 'slashing'),
      mods: [],
      props: [],
      tags: element !== 'none' ? [`element:${element}`] : [],
      attackBase: 3,
      magicShare: isStaff ? 1 : 0,
      guardBase: 1,
      art: null,
      _custom: true,
      _generated: true,
      _edited: true,
      raw: {
        id, name: `Generated ${typeRow.label || gearType}`, kind: isStaff ? 'staff' : 'weapon', hand: 'either',
        rarity, geom: gearType, gearType, range, weight: isStaff ? 2 : 3, poiseDamage: basePoise,
        mods: [], itemTypes: [{ tag: `item:${gearType}`, label: typeRow.label || gearType }],
        tags: element !== 'none' ? [`element:${element}`] : [],
        blurb: `Procedurally forged ${typeRow.label || gearType} (Rank ${rank}).`,
      },
    };

    const candidates = [];
    const poiseOptions = [basePoise, Math.max(0, basePoise - 1), basePoise + 1, basePoise + 2, 0, 1, 2, 3, 4];
    const seenPoise = [...new Set(poiseOptions.filter((p) => p >= 0 && p <= 6))];
    const drawbackMods = [[], ['self.firstTurnStamina=-1']];

    const evalMods = (poiseDmg, mods, editCost) => {
      const probe = { ...baseEntry, poiseDamage: poiseDmg, mods };
      const sc = ScoreGeneratedItem(probe, scoring, rules);
      candidates.push({ poiseDamage: poiseDmg, mods, cp: sc.cp, sc, editCost });
    };

    for (const p of seenPoise) {
      if (!chosenTraits.length) {
        for (const db of drawbackMods) evalMods(p, db, Math.abs(p - basePoise) + db.length * 3);
      } else {
        const [k0, min0, max0] = chosenTraits[0];
        const rest = chosenTraits.slice(1).map(([k, lo]) => fmtMod(k, lo));
        for (let v0 = min0; v0 <= Math.min(max0 + 2, 5); v0++) {
          for (const db of drawbackMods) {
            evalMods(p, [fmtMod(k0, v0), ...rest, ...db], Math.abs(p - basePoise) + Math.abs(v0 - min0) + db.length * 3);
          }
        }
      }
      // Also allow adding a single clean damage/poise trait when target rank is high
      for (const extra of ['attack.cardDamage=+1', 'attack.cardDamage=+2', 'smash.cardPoise=+2', 'self.statStr=+1']) {
        const baseMods = chosenTraits.map(([k, lo]) => fmtMod(k, lo));
        if (!baseMods.some((m) => m.startsWith(extra.split('=')[0] + '='))) {
          evalMods(p, [...baseMods, extra], Math.abs(p - basePoise) + 2);
        }
      }
    }

    const best = pickBestCandidate(candidates, targetCp, band);
    baseEntry.poiseDamage = best.poiseDamage;
    baseEntry.mods = [...best.mods];
    baseEntry.raw.poiseDamage = best.poiseDamage;
    baseEntry.raw.mods = [...best.mods];
    const finalSc = ScoreGeneratedItem(baseEntry, scoring, rules);
    if (applyNaming) {
      baseEntry.name = finalSc.convention.name;
      baseEntry.raw.name = finalSc.convention.name;
    }
    return { entry: baseEntry, score: finalSc };
  }

  if (kind === 'armour') {
    const armourGroups = Object.keys(GEAR_TYPES.armourGroups || {});
    const gearGroup = input.gearGroup && armourGroups.includes(input.gearGroup) ? input.gearGroup : pickFrom(rand, armourGroups);
    const groupRow = GEAR_TYPES.armourGroups?.[gearGroup] || { label: gearGroup, mods: [] };
    const classId = input.classId && ITEM_GENERATOR_CLASSES.includes(input.classId) ? input.classId : pickFrom(rand, ITEM_GENERATOR_CLASSES);
    const traitCount = Number.isInteger(input.traitCount) ? Math.max(0, Math.min(3, input.traitCount)) : (rank >= 1 ? 1 : 0);
    const pool = [...(ARMOUR_TRAIT_POOL[element] || []), ...ARMOUR_TRAIT_POOL.none];
    const chosenTraits = [];
    for (let i = 0; i < traitCount; i++) {
      const cand = pickFrom(rand, pool);
      if (!chosenTraits.some(([k]) => k === cand[0])) chosenTraits.push(cand);
    }
    const defaultPoise = gearGroup === 'heavy' ? 6 : gearGroup === 'medium' ? 4 : gearGroup === 'light' ? 2 : 0;
    const baseEntry = {
      key: `armour:${classId}.${id}`,
      kind: 'armour',
      id,
      name: `Generated ${groupRow.label || gearGroup}`,
      rarity,
      base: gearGroup,
      sub: 'armor',
      gearGroup,
      poise: defaultPoise,
      mods: [],
      props: [],
      tags: element !== 'none' ? [`element:${element}`] : [],
      _custom: true,
      _generated: true,
      _edited: true,
      raw: {
        id, classId, name: `Generated ${groupRow.label || gearGroup}`, kind: 'armor',
        rarity, gearGroup, poiseThreshold: defaultPoise, mods: [],
        tags: element !== 'none' ? [`element:${element}`] : [],
        blurb: `Procedurally fitted ${groupRow.label || gearGroup} armour (Rank ${rank}).`,
      },
    };

    const candidates = [];
    const evalArmour = (poise, mods, editCost) => {
      const probe = { ...baseEntry, poise, mods };
      const sc = ScoreGeneratedItem(probe, scoring, rules);
      candidates.push({ poise, mods, cp: sc.cp, sc, editCost });
    };
    const drawbackMods = [[], ['self.firstTurnStamina=-1']];
    for (let poise = 0; poise <= 10; poise++) {
      if (!chosenTraits.length) {
        for (const db of drawbackMods) evalArmour(poise, db, Math.abs(poise - defaultPoise) + db.length * 3);
      } else {
        const [k0, min0, max0] = chosenTraits[0];
        const rest = chosenTraits.slice(1).map(([k, lo]) => fmtMod(k, lo));
        for (let v0 = min0; v0 <= Math.min(max0 + 2, 8); v0++) {
          for (const db of drawbackMods) {
            evalArmour(poise, [fmtMod(k0, v0), ...rest, ...db], Math.abs(poise - defaultPoise) + Math.abs(v0 - min0) + db.length * 3);
          }
        }
      }
      for (const extra of ['defend.block=+1', 'defend.block=+2', 'self.statPoise=+1', 'self.turnWard=+1']) {
        const baseMods = chosenTraits.map(([k, lo]) => fmtMod(k, lo));
        if (!baseMods.some((m) => m.startsWith(extra.split('=')[0] + '='))) {
          evalArmour(poise, [...baseMods, extra], Math.abs(poise - defaultPoise) + 2);
        }
      }
    }

    const best = pickBestCandidate(candidates, targetCp, band);
    baseEntry.poise = best.poise;
    baseEntry.mods = [...best.mods];
    baseEntry.raw.poiseThreshold = best.poise;
    baseEntry.raw.mods = [...best.mods];
    const finalSc = ScoreGeneratedItem(baseEntry, scoring, rules);
    if (applyNaming) {
      baseEntry.name = finalSc.convention.name;
      baseEntry.raw.name = finalSc.convention.name;
    }
    return { entry: baseEntry, score: finalSc };
  }

  // Relic generation: passive and/or trigger tuned to targetCp
  const useTrigger = input.relicMode === 'triggered' ? true : input.relicMode === 'passive' ? false : rand() < 0.65;
  const pOffset = pick(rand, RELIC_PASSIVE_TEMPLATES.length);
  const tOffset = pick(rand, RELIC_TRIGGER_TEMPLATES.length);
  const candidates = [];

  const buildRelicEntry = (passives, triggers, mods, text) => ({
    key: `relic:${id}`,
    kind: 'relic',
    id,
    name: `Generated Relic ${seed}`,
    rarity,
    base: 'relic',
    sub: 'relic',
    mods: mods || [],
    props: [],
    tags: element !== 'none' ? [`element:${element}`] : [],
    passives,
    triggers,
    _custom: true,
    _generated: true,
    _edited: true,
    raw: {
      id,
      name: `Generated Relic ${seed}`,
      rarity,
      passives: passives || {},
      triggers: triggers || [],
      textTemplate: text,
      flavor: `A procedurally forged keepsake (Rank ${rank}).`,
    },
  });

  const evalTriggerTemplate = (tTmpl, prefPenalty) => {
    for (let n = tTmpl.min; n <= tTmpl.max + 2; n++) {
      const opObj = tTmpl.op === 'applyStatus'
        ? { op: 'applyStatus', status: tTmpl.status, stacks: n, target: tTmpl.target }
        : { op: tTmpl.op, amount: n, target: tTmpl.target };
      const triggers = [{ on: tTmpl.on, once: tTmpl.once, perTurn: tTmpl.limitPerTurn, limitPerTurn: tTmpl.limitPerTurn || undefined, everyNth: tTmpl.everyNth, do: [opObj] }];
      const probe = buildRelicEntry(null, triggers, [], tTmpl.text(n));
      const sc = ScoreGeneratedItem(probe, scoring, rules);
      candidates.push({ entry: probe, cp: sc.cp, sc, editCost: prefPenalty + Math.abs(n - tTmpl.min) * 0.5 });
      for (const bonusHp of [4, 8, 12]) {
        const passives = { maxHp: bonusHp };
        const paired = buildRelicEntry(passives, triggers, [`relic.maxHp=+${bonusHp}`], `Max HP +${bonusHp}. ${tTmpl.text(n)}`);
        const psc = ScoreGeneratedItem(paired, scoring, rules);
        candidates.push({ entry: paired, cp: psc.cp, sc: psc, editCost: prefPenalty + Math.abs(n - tTmpl.min) * 0.5 + 2 });
      }
    }
  };

  const evalPassiveTemplate = (pTmpl, prefPenalty) => {
    for (let n = pTmpl.min; n <= pTmpl.max; n += pTmpl.step) {
      const passives = { [pTmpl.key]: n };
      const mods = pTmpl.modKey ? [`${pTmpl.modKey}=+${n}`] : [];
      const probe = buildRelicEntry(passives, [], mods, pTmpl.text(n));
      const sc = ScoreGeneratedItem(probe, scoring, rules);
      candidates.push({ entry: probe, cp: sc.cp, sc, editCost: prefPenalty + Math.abs(n - pTmpl.min) * 0.5 });
    }
  };

  if (useTrigger) {
    for (let i = 0; i < RELIC_TRIGGER_TEMPLATES.length; i++) {
      const idx = (tOffset + i) % RELIC_TRIGGER_TEMPLATES.length;
      evalTriggerTemplate(RELIC_TRIGGER_TEMPLATES[idx], i === 0 ? 0 : 1 + i * 0.2);
    }
  } else {
    for (let i = 0; i < RELIC_PASSIVE_TEMPLATES.length; i++) {
      const idx = (pOffset + i) % RELIC_PASSIVE_TEMPLATES.length;
      evalPassiveTemplate(RELIC_PASSIVE_TEMPLATES[idx], i === 0 ? 0 : 1 + i * 0.2);
    }
  }

  const best = pickBestCandidate(candidates, targetCp, band);
  const finalEntry = best.entry;
  const finalSc = ScoreGeneratedItem(finalEntry, scoring, rules);
  if (applyNaming) {
    finalEntry.name = finalSc.convention.name;
    finalEntry.raw.name = finalSc.convention.name;
  }
  return { entry: finalEntry, score: finalSc };
}

/**
 * GenerateItemBatch(criteria, { scoring, rules }) -> { items, summary }.
 * Any omitted or 'auto' field is deterministically generated from seed + index.
 */
export function GenerateItemBatch(criteria = {}, { scoring = shippedScoring, rules = {} } = {}) {
  const count = Math.max(1, Math.min(200, Math.round(Number(criteria.count) || 5)));
  const seedBase = criteria.seed ?? 1;
  const rand = seededPrng(`itemBatch|${seedBase}`);
  const idPrefix = String(criteria.idPrefix || 'genItem').replace(/[^a-zA-Z0-9_-]/g, '') || 'genItem';
  const applyNaming = criteria.applyNaming !== false;
  const aimMaxCp = criteria.aimMaxCp !== false;

  const pickOrUse = (val, pool) => {
    if (Array.isArray(val) && val.length) return pickFrom(rand, val);
    if (val != null && val !== '' && val !== 'auto') return val;
    return pickFrom(rand, pool);
  };

  const items = [];
  for (let i = 0; i < count; i++) {
    const kind = pickOrUse(criteria.kind, ITEM_GENERATOR_KINDS);
    const rarity = pickOrUse(criteria.rarity, kind === 'relic' ? ITEM_GENERATOR_RARITIES : ITEM_GENERATOR_RARITIES.slice(0, 3));
    const defaultRanks = rarity === 'boss' ? [3, 4] : rarity === 'rare' ? [2, 3] : rarity === 'uncommon' ? [1, 2] : [0, 1];
    const rank = Number.isInteger(criteria.rank)
      ? criteria.rank
      : (Array.isArray(criteria.rank) && criteria.rank.length ? pickFrom(rand, criteria.rank) : pickFrom(rand, defaultRanks));
    const { entry } = GenerateItem({
      kind,
      rarity,
      rank,
      ...(Number.isFinite(criteria.combatPower) ? { combatPower: criteria.combatPower } : {}),
      aimMaxCp,
      gearType: criteria.gearType && criteria.gearType !== 'auto' ? criteria.gearType : undefined,
      gearGroup: criteria.gearGroup && criteria.gearGroup !== 'auto' ? criteria.gearGroup : undefined,
      range: criteria.range && criteria.range !== 'auto' ? criteria.range : undefined,
      element: criteria.element && criteria.element !== 'auto' ? criteria.element : undefined,
      classId: criteria.classId && criteria.classId !== 'auto' ? criteria.classId : undefined,
      traitCount: Number.isInteger(criteria.traitCount) ? criteria.traitCount : undefined,
      relicMode: criteria.relicMode && criteria.relicMode !== 'auto' ? criteria.relicMode : undefined,
      applyNaming,
      seed: `${seedBase}_${i + 1}`,
    }, { scoring, rules, idPrefix });
    items.push(entry);
  }
  return {
    items,
    summary: { count: items.length, seed: seedBase },
  };
}
