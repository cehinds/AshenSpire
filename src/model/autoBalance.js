// src/model/autoBalance.js — deterministic quota-driven auto-balancer for cards and items.
//
// Pure and headless. Given a list of cards or items plus flat or percentage quotas for ranks and rarities,
// deterministically assigns each entry to a (targetRank, targetRarity) slot and tunes its numbers to land
// as close as possible to the maximum allowed CP for that rank (respecting rarity discounts), with optional
// convention naming, shortage generation, and optional surplus trimming.
import { scoring as shippedScoring } from '../content/generated/scoring.js';
import { BaseFace, ScoreCard, CombatPower, RankOf, CardName } from './combatPower.js';
import { GenerateCard, RankBand, RankMaxCp } from './cardGenerator.js';
import { GenerateItem, ScoreGeneratedItem } from './itemGenerator.js';

const clone = (v) => structuredClone(v);
const RARITY_ORDER = Object.freeze({ starter: 0, common: 1, uncommon: 2, rare: 3, boss: 4, special: 5 });

export const DEFAULT_CARD_BALANCE_PRESET = Object.freeze({
  mode: 'percent',
  ranks: { 0: 5, 1: 30, 2: 35, 3: 20, 4: 10, 5: 0 },
  rarities: { common: 55, uncommon: 30, rare: 15 },
  aimMaxCp: true,
  applyNaming: false,
  generateShortage: true,
  trimSurplus: false,
  seed: 42,
});

export const DEFAULT_ITEM_BALANCE_PRESET = Object.freeze({
  mode: 'percent',
  ranks: { 0: 10, 1: 35, 2: 35, 3: 15, 4: 5, 5: 0 },
  rarities: { common: 45, uncommon: 35, rare: 15, boss: 5 },
  aimMaxCp: true,
  applyNaming: false,
  generateShortage: true,
  trimSurplus: false,
  seed: 42,
});

/**
 * ResolveQuotaCounts(quotas, total, mode) -> { key: integerCount } summing to exact total (in percent mode)
 * or exact sum of flat counts (in flat mode). Deterministic largest-remainder tie-breaking by key order.
 */
export function ResolveQuotaCounts(quotas, total, mode = 'percent') {
  const entries = Object.entries(quotas || {}).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]);
  if (!entries.length) return {};
  if (mode === 'flat') {
    const out = {};
    for (const [k, v] of entries) out[k] = Math.round(v);
    return out;
  }
  const n = Math.max(0, Math.round(Number(total) || 0));
  const sum = entries.reduce((acc, [, v]) => acc + v, 0);
  if (n === 0 || sum <= 0) {
    return Object.fromEntries(entries.map(([k]) => [k, 0]));
  }
  const raw = entries.map(([k, v], idx) => {
    const exact = (n * v) / sum;
    const floor = Math.floor(exact);
    return { k, idx, floor, rem: exact - floor };
  });
  let left = n - raw.reduce((acc, r) => acc + r.floor, 0);
  const byRem = [...raw].sort((a, b) => (b.rem - a.rem) || (a.idx - b.idx));
  for (let i = 0; i < left; i++) byRem[i % byRem.length].floor += 1;
  return Object.fromEntries(raw.map((r) => [r.k, r.floor]));
}

/**
 * Pair rank counts and rarity counts into an ordered list of `{ targetRank, targetRarity }` slots.
 * Higher rarities naturally pair with higher ranks so raw power expectations stay aligned.
 */
export function BuildTargetSlots(rankCounts, rarityCounts) {
  const ranks = [];
  for (const [rKey, count] of Object.entries(rankCounts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const r = Number(rKey);
    for (let i = 0; i < count; i++) ranks.push(r);
  }
  const rarities = [];
  for (const [rar, count] of Object.entries(rarityCounts).sort((a, b) => (RARITY_ORDER[a[0]] ?? 99) - (RARITY_ORDER[b[0]] ?? 99))) {
    for (let i = 0; i < count; i++) rarities.push(rar);
  }
  const total = Math.max(ranks.length, rarities.length);
  if (total === 0) return [];
  // Pad whichever side is shorter deterministically using its most common / edge entry
  while (ranks.length < total) ranks.push(ranks.length ? ranks[ranks.length - 1] : 1);
  while (rarities.length < total) rarities.push(rarities.length ? rarities[rarities.length - 1] : 'common');
  return ranks.map((targetRank, i) => ({ targetRank, targetRarity: rarities[i] }));
}

/** Headless fallback face derivation for a card definition (used when no combat-engine faceOf callback is passed). */
export function HeadlessCardFace(def, scoring = shippedScoring) {
  const tags = [...(def.tags || [])];
  const camp = (def.damageSchool && def.damageSchool !== 'physical') || tags.includes('camp:spell') || tags.includes('maneuver:casting')
    ? 'spell'
    : 'physical';
  const f = Object.assign(BaseFace(), {
    id: def.id,
    name: def.name,
    cls: def.class || 'colorless',
    rarity: def.rarity || 'common',
    camp,
    type: def.type || 'attack',
    sp: Number(def.staminaCost ?? def.cost ?? 0) || 0,
    mp: Number(def.manaCost ?? 0) || 0,
    kw: [...(def.keywords || [])],
    tags,
  });
  let rawDmg = 0;
  let rawBlk = 0;
  let hits = 1;
  for (const e of def.effects || []) {
    const amt = typeof e.amount === 'number' ? e.amount : (typeof e.stacks === 'number' ? e.stacks : 0);
    if (e.op === 'damage') { const h = Math.max(1, Number(e.hits) || 1); rawDmg += amt * h; hits = Math.max(hits, h); }
    else if (e.op === 'block') rawBlk += amt;
    else if (e.op === 'poiseDamage') f.poise += amt;
    else if (e.op === 'heal') f.heal += amt;
    else if (e.op === 'loseHp') f.loseHp += amt;
    else if (e.op === 'draw') f.draw += amt || 1;
    else if (e.op === 'ward') f.ward += amt;
    else if (e.op === 'gainBarrier') f.gainBarrier += amt;
    else if (e.op === 'restoreMana') f.restoreMp += amt;
    else if (e.op === 'restoreStamina') f.restoreSp += amt;
    else if (e.op === 'applyReflect') f.reflect += amt || 1;
    else if (e.op === 'applyStatus' && e.status) f.statuses.push([e.status, amt || 1, e.target === 'self' ? 'self' : 'enemy']);
  }
  const authDmg = camp === 'spell' ? scoring.model.AUTH_SPELL : scoring.model.AUTH_PHYS;
  f.dmg = rawDmg ? Math.max(1, Math.round(rawDmg * authDmg + (camp === 'spell' ? 0 : (scoring.items?.kit?.unarmedAttack ?? 3) * hits))) : 0;
  f.hits = hits;
  f.blk = rawBlk ? Math.max(1, Math.round(rawBlk * scoring.model.AUTH_BLOCK + 6)) : 0;
  return f;
}

function scoreCardDef(def, scoring, faceOf) {
  const face = faceOf ? faceOf(def) : HeadlessCardFace(def, scoring);
  const sc = ScoreCard(face, scoring);
  const rarity = def.rarity || 'common';
  const cp = CombatPower(sc.raw, rarity, scoring);
  const rank = RankOf(cp, scoring);
  return { face, raw: sc.raw, cp, rank };
}

function findPrimaryScalableEffect(def) {
  const effects = def.effects || [];
  const preferredOps = ['damage', 'block', 'ward', 'gainBarrier', 'poiseDamage', 'heal', 'applyStatus', 'draw', 'restoreMana', 'restoreStamina'];
  for (const op of preferredOps) {
    const idx = effects.findIndex((e) => e.op === op && (typeof e.amount === 'number' || typeof e.stacks === 'number'));
    if (idx >= 0) return idx;
  }
  return -1;
}

function setEffectMagnitude(eff, value) {
  if (eff.op === 'applyStatus') eff.stacks = value;
  else eff.amount = value;
}

function getEffectMagnitude(eff) {
  return eff.op === 'applyStatus' ? (Number(eff.stacks) || 1) : (Number(eff.amount) || 1);
}

/**
 * Deterministically tune one card definition so its CP lands inside `targetRank`'s band
 * and as close as possible to `targetRank`'s maximum allowed CP (when aimMaxCp is true).
 */
export function TuneCardToTarget(cardDef, { targetRarity, targetRank, aimMaxCp = true, applyNaming = false, scoring = shippedScoring, faceOf = null } = {}) {
  const original = clone(cardDef);
  const rarity = targetRarity || original.rarity || 'common';
  const band = RankBand(targetRank, scoring);
  const targetCp = aimMaxCp ? band.max : Math.round((band.min + band.max) / 2);

  const base = clone(original);
  base.rarity = rarity;
  const origSp = Number(base.staminaCost ?? base.cost ?? 0) || 0;
  const origMp = Number(base.manaCost ?? 0) || 0;
  const isSpell = (base.damageSchool && base.damageSchool !== 'physical')
    || (base.tags || []).includes('camp:spell')
    || (base.tags || []).includes('maneuver:casting');

  const primIdx = findPrimaryScalableEffect(base);
  const origPrim = primIdx >= 0 ? getEffectMagnitude(base.effects[primIdx]) : null;
  const primOp = primIdx >= 0 ? base.effects[primIdx].op : null;

  const candidates = [];
  const consider = (cand, editCost) => {
    const sc = scoreCardDef(cand, scoring, faceOf);
    const inBand = sc.cp >= band.min && sc.cp <= band.max;
    const overCeiling = sc.cp > band.max;
    const dist = Math.abs(targetCp - sc.cp);
    // Prioritize: inside band -> not over ceiling -> closest to targetCp (max allowed CP) -> minimal edit distance
    const penalty = (inBand ? 0 : (overCeiling ? 5000 : 2500)) + dist * 25 + editCost;
    candidates.push({ card: cand, score: sc, penalty, inBand });
  };

  // Evaluate untouched (rarity-updated) card first
  consider(clone(base), 0);

  const maxMag = (op) => {
    if (op === 'damage') return 60;
    if (op === 'block') return 55;
    if (op === 'poiseDamage') return 24;
    if (op === 'heal') return 20;
    if (op === 'ward') return 12;
    if (op === 'gainBarrier' || op === 'applyStatus') return 8;
    return 5;
  };

  const spRange = [...new Set([origSp, Math.max(0, origSp - 1), Math.min(3, origSp + 1), 0, 1, 2, 3])];
  const mpRange = isSpell ? [...new Set([origMp, Math.max(0, origMp - 1), Math.min(2, origMp + 1), 0, 1, 2])] : [origMp];

  if (primIdx >= 0) {
    const cap = maxMag(primOp);
    const step = cap >= 40 ? 2 : 1;
    // Pass 1: scale primary effect at original cost (every integer around sweet spot)
    for (let v = 1; v <= cap; v++) {
      const c = clone(base);
      setEffectMagnitude(c.effects[primIdx], v);
      consider(c, Math.abs(v - origPrim) * 0.25);
    }
    // Pass 2: if not hitting exact targetCp at original cost, try small SP/MP adjustments + primary scaling
    const bestSoFar = candidates.reduce((a, b) => (a.penalty < b.penalty ? a : b));
    if (!bestSoFar.inBand || bestSoFar.score.cp !== targetCp) {
      for (const sp of spRange) {
        for (const mp of mpRange) {
          if (sp === origSp && mp === origMp) continue;
          const costDelta = Math.abs(sp - origSp) * 4 + Math.abs(mp - origMp) * 5;
          for (let v = 1; v <= cap; v += step) {
            const c = clone(base);
            c.cost = sp;
            c.staminaCost = sp;
            c.manaCost = mp;
            setEffectMagnitude(c.effects[primIdx], v);
            consider(c, costDelta + Math.abs(v - origPrim) * 0.25);
          }
        }
      }
    }
  } else {
    // Card has no numeric primary effect — tune SP/MP cost
    for (const sp of spRange) {
      for (const mp of mpRange) {
        const c = clone(base);
        c.cost = sp;
        c.staminaCost = sp;
        c.manaCost = mp;
        consider(c, Math.abs(sp - origSp) * 4 + Math.abs(mp - origMp) * 5);
      }
    }
  }

  // Pass 3: if still out of band (e.g. very low target rank or power card), try adding a small clean rider/drawback
  let winner = candidates.reduce((a, b) => (a.penalty < b.penalty ? a : b));
  if (!winner.inBand) {
    if (winner.score.cp > band.max) {
      for (let hp = 1; hp <= 14; hp++) {
        const c = clone(winner.card);
        c.effects = [...(c.effects || []), { op: 'loseHp', target: 'self', amount: hp, nonlethal: true }];
        if (c.textTemplate && !c.textTemplate.includes('loseHp')) c.textTemplate = `${c.textTemplate} Lose {loseHp} HP.`;
        consider(c, 12 + hp * 0.5);
      }
    } else if (winner.score.cp < band.min) {
      for (const rider of [
        { op: 'draw', amount: 1, txt: 'Draw {draw} card.' },
        { op: 'draw', amount: 2, txt: 'Draw {draw} cards.' },
        { op: 'poiseDamage', target: 'enemy', amount: 4, txt: 'Deal {poiseDamage} Poise damage.' },
        { op: 'ward', target: 'self', amount: 2, txt: 'Gain {ward} Ward.' },
      ]) {
        const c = clone(winner.card);
        c.effects = [...(c.effects || []), { op: rider.op, ...(rider.target ? { target: rider.target } : {}), amount: rider.amount }];
        if (c.textTemplate && !c.textTemplate.includes(`{${rider.op}}`)) c.textTemplate = `${c.textTemplate} ${rider.txt}`;
        consider(c, 10);
      }
    }
    winner = candidates.reduce((a, b) => (a.penalty < b.penalty ? a : b));
  }

  const out = winner.card;
  out._edited = true;
  const finalScore = scoreCardDef(out, scoring, faceOf);
  if (applyNaming) {
    out.name = CardName(finalScore.face, 0, scoring);
    out._autoName = true;
  }
  return { card: out, score: finalScore, targetRank, targetRarity: rarity, targetCp };
}

/**
 * Deterministically tune one Studio item entry (weapon, armour, or relic) toward targetRarity and
 * closest CP <= targetRank's maximum allowed CP.
 */
export function TuneItemToTarget(itemEntry, { targetRarity, targetRank, aimMaxCp = true, applyNaming = false, scoring = shippedScoring, rules = {} } = {}) {
  const original = clone(itemEntry);
  const rarity = targetRarity || original.rarity || 'common';
  const band = RankBand(targetRank, scoring);
  const targetCp = aimMaxCp ? band.max : Math.round((band.min + band.max) / 2);

  const base = clone(original);
  base.rarity = rarity;
  if (base.raw) base.raw.rarity = rarity;

  const candidates = [];
  const consider = (cand, editCost) => {
    const sc = ScoreGeneratedItem(cand, scoring, rules);
    const inBand = sc.cp >= band.min && sc.cp <= band.max;
    const overCeiling = sc.cp > band.max;
    const dist = Math.abs(targetCp - sc.cp);
    const penalty = (inBand ? 0 : (overCeiling ? 5000 : 2500)) + dist * 25 + editCost;
    candidates.push({ entry: cand, score: sc, penalty, inBand });
  };

  consider(clone(base), 0);

  if (base.kind === 'weapon') {
    const origPoise = Number(base.poiseDamage) || 0;
    const origMods = [...(base.mods || [])];
    const modEntries = origMods.map((raw) => {
      const [k, v] = String(raw).split('=');
      return [k, Number(v)];
    });
    const extraMods = [
      null,
      'attack.cardDamage=+1',
      'attack.cardDamage=+2',
      'smash.cardPoise=+2',
      'self.statStr=+1',
      'self.firstTurnStamina=-1',
    ];
    for (let p = 0; p <= 6; p++) {
      // Scale existing first mod if numeric
      if (modEntries.length && Number.isFinite(modEntries[0][1])) {
        const [k0, origV] = modEntries[0];
        const rest = origMods.slice(1);
        for (let v = 1; v <= 5; v++) {
          const c = clone(base);
          c.poiseDamage = p;
          c.mods = [`${k0}=${v >= 0 ? `+${v}` : v}`, ...rest];
          consider(c, Math.abs(p - origPoise) * 1.5 + Math.abs(v - origV) * 1.2);
        }
      }
      // Or keep/drop/add a single clean mod
      for (const extra of extraMods) {
        const c = clone(base);
        c.poiseDamage = p;
        if (extra === null) {
          c.mods = [...origMods];
          consider(c, Math.abs(p - origPoise) * 1.5);
          if (origMods.length) {
            const stripped = clone(base);
            stripped.poiseDamage = p;
            stripped.mods = origMods.slice(0, -1);
            consider(stripped, Math.abs(p - origPoise) * 1.5 + 4);
          }
        } else if (!origMods.some((m) => m.startsWith(extra.split('=')[0] + '='))) {
          c.mods = [...origMods, extra];
          consider(c, Math.abs(p - origPoise) * 1.5 + 3.5);
        }
      }
    }
  } else if (base.kind === 'armour') {
    const origPoise = Number(base.poise) || 0;
    const origMods = [...(base.mods || [])];
    const modEntries = origMods.map((raw) => {
      const [k, v] = String(raw).split('=');
      return [k, Number(v)];
    });
    const extraMods = [
      null,
      'defend.block=+1',
      'defend.block=+2',
      'self.statPoise=+1',
      'self.turnWard=+1',
      'self.maxHp=+4',
      'self.firstTurnStamina=-1',
    ];
    for (let poise = 0; poise <= 12; poise++) {
      if (modEntries.length && Number.isFinite(modEntries[0][1])) {
        const [k0, origV] = modEntries[0];
        const rest = origMods.slice(1);
        for (let v = 1; v <= 6; v++) {
          const c = clone(base);
          c.poise = poise;
          c.mods = [`${k0}=${v >= 0 ? `+${v}` : v}`, ...rest];
          consider(c, Math.abs(poise - origPoise) * 1.2 + Math.abs(v - origV) * 1.2);
        }
      }
      for (const extra of extraMods) {
        const c = clone(base);
        c.poise = poise;
        if (extra === null) {
          c.mods = [...origMods];
          consider(c, Math.abs(poise - origPoise) * 1.2);
          if (origMods.length) {
            const stripped = clone(base);
            stripped.poise = poise;
            stripped.mods = origMods.slice(0, -1);
            consider(stripped, Math.abs(poise - origPoise) * 1.2 + 4);
          }
        } else if (!origMods.some((m) => m.startsWith(extra.split('=')[0] + '='))) {
          c.mods = [...origMods, extra];
          consider(c, Math.abs(poise - origPoise) * 1.2 + 3.5);
        }
      }
    }
  } else if (base.kind === 'relic') {
    // Tune custom/generated relic passives or triggers if present
    const passKeys = Object.keys(base.passives || {}).filter((k) => typeof base.passives[k] === 'number');
    if (passKeys.length) {
      const k = passKeys[0];
      const origV = base.passives[k];
      for (let v = 1; v <= 20; v++) {
        const c = clone(base);
        c.passives = { ...c.passives, [k]: v };
        if (c.raw) c.raw.passives = { ...c.passives };
        consider(c, Math.abs(v - origV) * 0.8);
      }
    }
    if (Array.isArray(base.triggers) && base.triggers.length && Array.isArray(base.triggers[0].do) && base.triggers[0].do.length) {
      const op0 = base.triggers[0].do[0];
      const field = op0.op === 'applyStatus' ? 'stacks' : 'amount';
      if (typeof op0[field] === 'number') {
        const origV = op0[field];
        for (let v = 1; v <= 15; v++) {
          const c = clone(base);
          c.triggers = clone(base.triggers);
          c.triggers[0].do[0][field] = v;
          if (c.raw) c.raw.triggers = clone(c.triggers);
          consider(c, Math.abs(v - origV) * 0.8);
        }
      }
    }
  }

  const winner = candidates.reduce((a, b) => (a.penalty < b.penalty ? a : b));
  const out = winner.entry;
  out._edited = true;
  if (out.raw) {
    out.raw.rarity = out.rarity;
    if (out.kind === 'weapon') { out.raw.poiseDamage = out.poiseDamage; out.raw.mods = [...out.mods]; }
    if (out.kind === 'armour') { out.raw.poiseThreshold = out.poise; out.raw.mods = [...out.mods]; }
  }
  const finalScore = ScoreGeneratedItem(out, scoring, rules);
  if (applyNaming) {
    out.name = finalScore.convention.name;
    if (out.raw) out.raw.name = finalScore.convention.name;
  }
  return { entry: out, score: finalScore, targetRank, targetRarity: rarity, targetCp };
}

/**
 * AutoBalanceCards(scopedCards, options) -> { updated, created, removedIds, untouchedIds, report }.
 * Deterministically rebalances a scoped set of cards to meet flat or percentage rank/rarity quotas.
 */
export function AutoBalanceCards(scopedCards, options = {}) {
  const scoring = options.scoring || shippedScoring;
  const faceOf = options.faceOf || null;
  const mode = options.mode === 'flat' ? 'flat' : 'percent';
  const applyNaming = !!options.applyNaming;
  const aimMaxCp = options.aimMaxCp !== false;
  const generateShortage = options.generateShortage !== false;
  const trimSurplus = !!options.trimSurplus;
  const seed = options.seed ?? 42;
  const defaultClass = options.defaultClass || (scopedCards[0]?.class || 'colorless');

  const rawRankQuotas = options.rankQuotas || DEFAULT_CARD_BALANCE_PRESET.ranks;
  const rawRarityQuotas = options.rarityQuotas || DEFAULT_CARD_BALANCE_PRESET.rarities;

  const flatRankSum = Object.values(rawRankQuotas).reduce((a, b) => a + Math.max(0, Math.round(Number(b) || 0)), 0);
  const targetCount = mode === 'flat'
    ? (Number.isInteger(options.targetCount) && options.targetCount > 0 ? options.targetCount : flatRankSum)
    : Math.max(0, Math.round(Number(options.targetCount ?? scopedCards.length) || scopedCards.length));

  const rankCounts = ResolveQuotaCounts(rawRankQuotas, targetCount, mode);
  const rarityCounts = ResolveQuotaCounts(rawRarityQuotas, targetCount, mode);
  const slots = BuildTargetSlots(rankCounts, rarityCounts);

  // Sort existing cards deterministically by (currentCP, rarityOrder, id) for minimum-disruption matching
  const scored = scopedCards.map((card) => ({ card, score: scoreCardDef(card, scoring, faceOf) }));
  scored.sort((a, b) => (a.score.cp - b.score.cp)
    || ((RARITY_ORDER[a.card.rarity] ?? 9) - (RARITY_ORDER[b.card.rarity] ?? 9))
    || String(a.card.id).localeCompare(String(b.card.id)));

  const tuneCount = Math.min(scored.length, slots.length);
  const updated = [];
  const created = [];
  const untouchedIds = [];
  const removedIds = [];

  for (let i = 0; i < tuneCount; i++) {
    const slot = slots[i];
    const res = TuneCardToTarget(scored[i].card, {
      targetRarity: slot.targetRarity,
      targetRank: slot.targetRank,
      aimMaxCp,
      applyNaming,
      scoring,
      faceOf,
    });
    updated.push(res.card);
  }

  // Handle surplus
  for (let i = tuneCount; i < scored.length; i++) {
    if (trimSurplus) removedIds.push(scored[i].card.id);
    else untouchedIds.push(scored[i].card.id);
  }

  // Handle shortage via deterministic procedural generation
  if (generateShortage && slots.length > scored.length) {
    for (let i = scored.length; i < slots.length; i++) {
      const slot = slots[i];
      const gen = GenerateCard({
        rarity: slot.targetRarity,
        rank: slot.targetRank,
        aimMaxCp,
        cls: defaultClass,
        camp: defaultClass === 'starseer' || defaultClass === 'herald' ? 'spell' : (i % 4 === 0 ? 'spell' : 'physical'),
        type: i % 3 === 0 ? 'skill' : 'attack',
        seed: `bal_${seed}_${i + 1}`,
      }, { scoring, idPrefix: 'bal', applyNaming: true });
      gen._custom = true;
      gen._generated = true;
      gen._edited = true;
      gen._autoName = applyNaming;
      created.push(gen);
    }
  }

  const finalList = [...updated, ...created];
  const afterRanks = {};
  const afterRarities = {};
  for (const c of finalList) {
    const sc = scoreCardDef(c, scoring, faceOf);
    afterRanks[sc.rank] = (afterRanks[sc.rank] || 0) + 1;
    afterRarities[c.rarity] = (afterRarities[c.rarity] || 0) + 1;
  }

  return {
    updated,
    created,
    removedIds,
    untouchedIds,
    report: {
      mode,
      targetCount: slots.length,
      tunedCount: updated.length,
      createdCount: created.length,
      untouchedCount: untouchedIds.length,
      removedCount: removedIds.length,
      targetRanks: rankCounts,
      targetRarities: rarityCounts,
      afterRanks,
      afterRarities,
    },
  };
}

/**
 * AutoBalanceItems(scopedItems, options) -> { updated, created, removedKeys, untouchedKeys, report }.
 * Deterministically rebalances weapons, armours, and/or relics to meet flat or percentage rank/rarity quotas.
 */
export function AutoBalanceItems(scopedItems, options = {}) {
  const scoring = options.scoring || shippedScoring;
  const rules = options.rules || {};
  const mode = options.mode === 'flat' ? 'flat' : 'percent';
  const applyNaming = !!options.applyNaming;
  const aimMaxCp = options.aimMaxCp !== false;
  const generateShortage = options.generateShortage !== false;
  const trimSurplus = !!options.trimSurplus;
  const seed = options.seed ?? 42;
  const defaultKind = options.defaultKind && options.defaultKind !== 'all' ? options.defaultKind : (scopedItems[0]?.kind || 'weapon');

  const rawRankQuotas = options.rankQuotas || DEFAULT_ITEM_BALANCE_PRESET.ranks;
  const rawRarityQuotas = options.rarityQuotas || DEFAULT_ITEM_BALANCE_PRESET.rarities;

  const flatRankSum = Object.values(rawRankQuotas).reduce((a, b) => a + Math.max(0, Math.round(Number(b) || 0)), 0);
  const targetCount = mode === 'flat'
    ? (Number.isInteger(options.targetCount) && options.targetCount > 0 ? options.targetCount : flatRankSum)
    : Math.max(0, Math.round(Number(options.targetCount ?? scopedItems.length) || scopedItems.length));

  const rankCounts = ResolveQuotaCounts(rawRankQuotas, targetCount, mode);
  const rarityCounts = ResolveQuotaCounts(rawRarityQuotas, targetCount, mode);
  const slots = BuildTargetSlots(rankCounts, rarityCounts);

  const scored = scopedItems.map((entry) => ({ entry, score: ScoreGeneratedItem(entry, scoring, rules) }));
  scored.sort((a, b) => (a.score.cp - b.score.cp)
    || ((RARITY_ORDER[a.entry.rarity] ?? 9) - (RARITY_ORDER[b.entry.rarity] ?? 9))
    || String(a.entry.key).localeCompare(String(b.entry.key)));

  const tuneCount = Math.min(scored.length, slots.length);
  const updated = [];
  const created = [];
  const untouchedKeys = [];
  const removedKeys = [];

  for (let i = 0; i < tuneCount; i++) {
    const slot = slots[i];
    const res = TuneItemToTarget(scored[i].entry, {
      targetRarity: slot.targetRarity,
      targetRank: slot.targetRank,
      aimMaxCp,
      applyNaming,
      scoring,
      rules,
    });
    updated.push(res.entry);
  }

  for (let i = tuneCount; i < scored.length; i++) {
    if (trimSurplus) removedKeys.push(scored[i].entry.key);
    else untouchedKeys.push(scored[i].entry.key);
  }

  if (generateShortage && slots.length > scored.length) {
    for (let i = scored.length; i < slots.length; i++) {
      const slot = slots[i];
      const { entry } = GenerateItem({
        kind: defaultKind,
        rarity: slot.targetRarity,
        rank: slot.targetRank,
        aimMaxCp,
        applyNaming: true,
        seed: `balItem_${seed}_${i + 1}`,
      }, { scoring, rules, idPrefix: 'balItem' });
      created.push(entry);
    }
  }

  const finalList = [...updated, ...created];
  const afterRanks = {};
  const afterRarities = {};
  for (const it of finalList) {
    const sc = ScoreGeneratedItem(it, scoring, rules);
    afterRanks[sc.rank] = (afterRanks[sc.rank] || 0) + 1;
    afterRarities[it.rarity] = (afterRarities[it.rarity] || 0) + 1;
  }

  return {
    updated,
    created,
    removedKeys,
    untouchedKeys,
    report: {
      mode,
      targetCount: slots.length,
      tunedCount: updated.length,
      createdCount: created.length,
      untouchedCount: untouchedKeys.length,
      removedCount: removedKeys.length,
      targetRanks: rankCounts,
      targetRarities: rarityCounts,
      afterRanks,
      afterRarities,
    },
  };
}
