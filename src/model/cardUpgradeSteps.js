// The Core card-upgrade step generator (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md).
// Pure and stateless: the roll is mulberry32(hash(run.seed, instanceId, stepIndex)); its callers fold the visit's
// offer key into the instance id (upgradeOffer.js), so a preview equals the commit and no named RNG stream moves.
// A leaf module: it imports only rng.js, cardUpgrade.js, combatRanges.js, cardRank.js and generated data.
// Retain is offered as an `fx` step (W25): Core keeps a Retain card in hand at the end of a turn.
import { mulberry32 } from './rng.js';
import { applyUpgradeSteps, MAX_CARD_UPGRADES, MAX_UPGRADE_TAG_STACKS, UPGRADE_RARITIES, FlatSteps, firstPlainIndex, isPlainEffect, isPlainStatus, TAG_FAMILIES, TARGETING, UPGRADE_ELEMENTS, ELEMENT_IDENTITY, RANK_DOWN_TAG, PHYSICAL_DAMAGE_TYPES, HoldsPacket, RUN_ATTRIBUTE_STATS, hitFloor, currentHits, DrawbackSteps, UpgradeTagStacks, ImprovedScaledAmount } from './cardUpgrade.js';
import { RANGES, normalizeRange } from './combatRanges.js';
import { STACK_CAPS, rankedEffectsCapped } from './cardRank.js';
import { EvaluateUpgradeStepCp } from './cardUpgradeCp.js';
import { GetActiveScoring } from './activeScoring.js';
import { fixCoreMechanics } from '../content/generated/fixCoreMechanics.js';
import {
  EffectiveTier,
  UpgradeKindUnlocked,
  UpgradeRarityUnlocked,
  UpgradeTagStackUnlocked,
  ZeroCostUnlocked,
  HybridUnlocked,
  ElementUnlocked,
  StatusUnlocked,
  StatusStackCapAtTier,
  NumericCeilingAtTier,
} from './tierUnlocks.js';

export { STACK_CAPS };
// Owner ask 2026-10-31: poise, a range / targeting / stance / school / element change and a rank-down join the
// pool. `range`..`rankDown` are all `tag` steps (cardUpgrade.js); they are separate options so a choice of
// several never offers the same thing twice.
const WEIGHTS = Object.freeze({ dmg: 30, blk: 25, stk: 20, addStatus: 8, cost: 10, costSwap: 8, hits: 5,
  poise: 12, range: 3, targeting: 6, maneuver: 5, school: 4, dmgType: 5, element: 6, rankDown: 3,
  // The effect menu (W25): one entry per `fx` step id (cardUpgrade.js FX_KINDS), keyed `fx:<id>`.
  'fx:block': 18, 'fx:draw': 14, 'fx:cycle': 8, 'fx:cull': 4, 'fx:copy': 5, 'fx:shuffle': 4, 'fx:retain': 10, 'fx:innate': 5,
  'fx:unexhaust': 8, 'fx:holdOne': 6, 'fx:boost': 8, 'fx:target': 7, 'fx:reaction': 8, 'fx:counter': 8, 'fx:recurring': 5,
  // Purified upgrade line (owner, 2026-11-25): healing & cleansing.
  'fx:heal': 7, 'fx:cleanse': 6,
  // Easing a drawback (playtest 2026-11-17, theme C): offered only on a card that has it, and weighted to come up.
  'fx:unethereal': 12, 'fx:steady': 12,
  // Owner, 2026-11-19: a signed `stk` lowers a drawback's count (self debuff, enemy buff, discard, added status cards); dropped at 0.
  stkEase: 12,
  // A run-long +1 INT / WIS, about a fifth of a normal step (W25-L); offered on spells only.
  attr: 2 });
// The roll's groups (owner, 2026-11-19; docs/balance/buff-drawbacks-proposal-2026-11-19.md section 6). A roll picks the group by
// the upgrade number, then a kind inside the group by WEIGHTS. `ease` lowers a drawback, `eff` (effectiveness / cost) makes the
// card's own numbers better, `new` adds an effect, `identity` reshapes what the card is (inside "new effect").
export const UPGRADE_GROUPS = Object.freeze(['ease', 'eff', 'new', 'identity']);
const GROUP_OF = Object.freeze({
  'fx:unexhaust': 'ease', 'fx:unethereal': 'ease', 'fx:steady': 'ease', stkEase: 'ease',
  dmg: 'eff', blk: 'eff', stk: 'eff', cost: 'eff', costSwap: 'eff', hits: 'eff', poise: 'eff', element: 'eff', rankDown: 'eff',
  range: 'identity', targeting: 'identity', maneuver: 'identity', school: 'identity', dmgType: 'identity',
});
/** The group an option kind belongs to; every `fx:` effect and `addStatus` / `attr` is a new effect. */
export const UpgradeGroupOf = (kind) => GROUP_OF[kind] || 'new';
// Share of each group by upgrade number (upTo is inclusive). New effect and identity are listed apart: identity sits inside the
// brief's "new effect" total (25 / 40 / 50 / 65).
const GROUP_SHARES = Object.freeze([
  { upTo: 3, ease: 40, eff: 35, new: 20, identity: 5 },
  { upTo: 5, ease: 30, eff: 30, new: 30, identity: 10 },
  { upTo: 7, ease: 20, eff: 30, new: 35, identity: 15 },
  { upTo: MAX_CARD_UPGRADES, ease: 15, eff: 20, new: 45, identity: 20 },
]);
export const UpgradeGroupShares = (upgradeNumber) => GROUP_SHARES.find((row) => upgradeNumber <= row.upTo) || GROUP_SHARES[GROUP_SHARES.length - 1];

/** Pick a key by weight from `u` in [0, 1): { key, rest } where `rest` is `u` rescaled inside the picked slice, for the next level of the roll. */
function pickByWeight(entries, u) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = u * total;
  for (const [key, weight] of entries) {
    if (roll < weight) return { key, rest: weight > 0 ? roll / weight : 0 };
    roll -= weight;
  }
  const [key] = entries[entries.length - 1];
  return { key, rest: 0 };
}

// Upgrade rarity (owner, 2026-11-19; proposal section 10). Every rolled step has one: common, uncommon or rare. A later
// upgrade number raises the odds of the higher ones. A step stores `r` only when it is not common, so every step saved
// before rarity (no `r`) reads as common and applies unchanged.
export { UPGRADE_RARITIES };
const RARITY_ODDS = Object.freeze([
  { upTo: 3, odds: [70, 25, 5] },
  { upTo: 5, odds: [45, 40, 15] },
  { upTo: 7, odds: [25, 45, 30] },
  { upTo: MAX_CARD_UPGRADES, odds: [10, 40, 50] },
]);
// A vendor's own category and its off-category read other odds (proposal section 11); neutral kinds and ease rows read the base table.
const VENDOR_RARITY_ODDS = Object.freeze({
  own: Object.freeze([{ upTo: 3, odds: [55, 33, 12] }, { upTo: 5, odds: [35, 42, 23] }, { upTo: 7, odds: [18, 42, 40] }, { upTo: MAX_CARD_UPGRADES, odds: [7, 33, 60] }]),
  off: Object.freeze([{ upTo: 3, odds: [80, 18, 2] }, { upTo: 5, odds: [60, 32, 8] }, { upTo: 7, odds: [40, 42, 18] }, { upTo: MAX_CARD_UPGRADES, odds: [25, 45, 30] }]),
});
/** The rarity odds of an upgrade number: the base table, or a vendor's `own` / `off` category table. */
export const UpgradeRarityOdds = (upgradeNumber, standing = 'base') => {
  const table = VENDOR_RARITY_ODDS[standing] || RARITY_ODDS;
  return (table.find((row) => upgradeNumber <= row.upTo) || table[table.length - 1]).odds;
};
// Upgrade vendors (proposal section 11). A vendor multiplies the weight of the kinds of its own category and of the other one; neutral kinds
// are always x1. The Blacksmith favours physical kinds, the Arcane Trader magic ones; a rest site, a free upgrade and a rank-up bonus have no vendor.
export const UPGRADE_VENDORS = Object.freeze({
  blacksmith: Object.freeze({ own: 'physical', physical: 3, magic: 0.25, neutral: 1 }),
  arcane: Object.freeze({ own: 'magic', physical: 0.25, magic: 3, neutral: 1 }),
});
const WARD_STATUSES = Object.freeze(['ward', 'barrier']);
/**
 * UpgradeCategoryOf(kind, option, card) -> 'physical' | 'magic' | 'neutral' (proposal section 11). A kind can be either by card: a boost is
 * physical for STR / DEX and magic for INT / WIS, a Block is magic on a spell, a status is the card's school's, a cost cut is SP or Mana.
 */
export function UpgradeCategoryOf(kind, option, card) {
  const spell = isSpellCard(card);
  switch (kind) {
    case 'dmg': case 'hits': case 'poise': case 'dmgType': case 'maneuver': case 'range': case 'fx:target': case 'fx:counter': return 'physical';
    case 'blk': case 'fx:block': return spell ? 'magic' : 'physical';
    case 'element': case 'school': case 'attr': case 'rankDown': case 'fx:heal': case 'fx:cleanse': return 'magic';
    case 'fx:boost': return ['intelligence', 'wisdom'].includes(option?.stat) ? 'magic' : 'physical';
    case 'addStatus': return (option?.statuses || []).some((status) => ['burn', 'vulnerable'].includes(status)) ? 'magic' : 'physical';
    case 'stk': return WARD_STATUSES.includes(option?.status) ? 'magic' : 'neutral';
    case 'cost': {
      const pools = option?.combo || option?.pools || [];
      return pools.length === 1 ? (pools[0] === 'mp' ? 'magic' : 'physical') : 'neutral';
    }
    default: return 'neutral';
  }
}
/** The rarity of a stored step: its `r`, or common when it has none (a step saved before rarity, or a common one). */
export const RarityOfStep = (step) => (UPGRADE_RARITIES.includes(step?.r) ? step.r : 'common');
// How much bigger each rarity makes a sized step (times limits.scale, the rank-up bonus's own x2): damage, Block and Poise x1 / x2 / x4,
// stacks +1 / +2 / +3, a status added 1 / 2 / 3 stacks, a Block effect x1 / x2 / x3. Every kind's own guard (the +100% cap, the status cap,
// the cost floors) still limits the size, and a rarity whose size would not beat the one below it is not offered.
const SIZE_MULT = Object.freeze({ dmg: [1, 2, 4], blk: [1, 2, 4], poise: [1, 2, 4], stk: [1, 2, 3], 'fx:block': [1, 2, 3], 'fx:heal': [1, 2, 3], element: [1, 2, 4] });
// The element packet is 75% of the matching damage step, at least this much per rarity (owner, 2026-11-19; proposal section 9).
const PACKET_MIN = Object.freeze([2, 3, 6]);
// Kinds with one size: the rarity they sit at is only a placement (proposal section 10 tables).
const PLACED_AT = Object.freeze({
  'fx:cull': 0, 'fx:copy': 0, 'fx:shuffle': 0, 'fx:counter': 0,
  'fx:retain': 1, 'fx:innate': 1, 'fx:holdOne': 1, 'fx:reaction': 1, 'fx:cleanse': 1, targeting: 1, maneuver: 1, rankDown: 1,
  range: 2, attr: 2, school: 0, dmgType: 0,
});
// The ease kinds: easing a drawback is common; the uncommon version removes it and draws a card, the rare one removes it and takes a rare-size step.
const EASE_KINDS = Object.freeze(['fx:unexhaust', 'fx:unethereal', 'fx:steady', 'stkEase']);

// A Reach hit skips the Advance SP and gains Precision, so its weight is halved (owner, 2026-11-19; proposal section 9).
/** The weight of every option kind inside its group. */
export const UPGRADE_KIND_WEIGHTS = WEIGHTS;

/** Every option kind a rolled upgrade can be; a card's `upgradeMenu` names a subset of these (theme C, playtest 2026-11-17). */
export const UPGRADE_OPTION_KINDS = Object.freeze(Object.keys(WEIGHTS));

// Option families (owner, 2026-11-20: "no upgrade" or "damage +2 / damage +3" side by side is no choice). One roll never
// offers two options of one family, so the choices differ in kind, not only in amount:
//   damage    more or wider HP damage: dmg, hits, targeting, element, a second target, a STR / INT boost
//   defense   Block and answers to a hit: blk, an added Block, Counter, a DEX / WIS boost
//   pressure  what wears an enemy down besides HP: status stacks, an added status, Poise damage
//   cost      what the card costs: cost, a steady (no longer rising) cost, rank down
//   flow      cards moving: draw, cycle, shuffle, cull, a copy
//   keyword   how the card sits in hand: Innate, Retain, hold one, losing Exhaust or Ethereal
//   form      how and when the card is played: range, stance, school, damage type, Reaction (a play in the enemy's turn), a run attribute
export const UPGRADE_FAMILIES = Object.freeze({
  damage: Object.freeze(['dmg', 'hits', 'targeting', 'element', 'fx:target']),
  defense: Object.freeze(['blk', 'fx:block', 'fx:counter', 'fx:heal']),
  pressure: Object.freeze(['stk', 'stkEase', 'addStatus', 'poise', 'fx:cleanse']),
  cost: Object.freeze(['cost', 'costSwap', 'fx:steady', 'rankDown']),
  flow: Object.freeze(['fx:draw', 'fx:cycle', 'fx:shuffle', 'fx:cull', 'fx:copy']),
  keyword: Object.freeze(['fx:unexhaust', 'fx:innate', 'fx:retain', 'fx:holdOne', 'fx:unethereal']),
  form: Object.freeze(['range', 'maneuver', 'school', 'dmgType', 'fx:reaction', 'fx:recurring', 'attr']),
});
// Kinds a random roll never offers (owner, 2026-11-20: no "no upgrade"): a run-long +1 attribute (`attr`) and a rank
// down (`rankDown`) change nothing on a single play. Saved steps of these kinds still resolve; a card's authored
// `upgradeMenu` may still name one.
export const DUD_KINDS = Object.freeze(['attr', 'rankDown']);
const FAMILY_OF = Object.freeze(Object.fromEntries(Object.entries(UPGRADE_FAMILIES).flatMap(([family, kinds]) => kinds.map((kind) => [kind, family]))));
const DEFENSE_STATS = Object.freeze(['dexterity', 'wisdom']);
/** The family of an option kind (a boost goes with what it raises: STR / INT damage, DEX / WIS defense). */
export function UpgradeKindFamily(kind, option = null) {
  if (kind === 'fx:boost') return DEFENSE_STATS.includes(option?.stat) ? 'defense' : 'damage';
  return FAMILY_OF[kind] || kind;
}
/** The families a stored step belongs to: one, or both of a combo's. An authored step has none here (its caller reads the face). */
export function UpgradeStepFamilies(step) {
  if (!step || step.k === 'authored') return [];
  if (step.k === 'combo') return [...new Set((step.steps || []).flatMap(UpgradeStepFamilies))];
  if (step.k === 'fx') return [UpgradeKindFamily(`fx:${step.fx}`, step)];
  if (step.k === 'tag') {
    if (step.retarget || step.damageSchool) return ['damage'];
    if (step.tag === RANK_DOWN_TAG) return ['cost'];
    return ['form'];
  }
  return [UpgradeKindFamily(step.k, step)];
}
// A cantrip's own element status (Frost, Shocked, Venom, Regen...) may gain stacks up to this many (owner, 2026-11-14:
// cantrip upgrades add +1 stack); every other status keeps STACK_CAPS, or none.
const CANTRIP_STACK_CAP = 5;
// Venom stops at 3 stacks when a card plays (a fourth shows on the face and does nothing), so a cantrip may not be offered past it.
const ENGINE_STACK_CAPS = Object.freeze({ venom: 3 });
const stackCap = (status, card) => STACK_CAPS[status] ?? ENGINE_STACK_CAPS[status] ?? (tagsOf(card).includes(RANK_DOWN_TAG) ? CANTRIP_STACK_CAP : undefined);
const RESTRICTED_TYPES = new Set(['power', 'status', 'curse', 'consumable']);
// The drawbacks a signed `stk` can lower (proposal section 7): a self debuff, a buff the card gives an enemy, a forced discard, or
// status cards (Wound, Dazed) added to a pile. Only an effect the card was authored with counts (a Cycle or Copy step is not a drawback).
const SELF_DEBUFFS = Object.freeze(['weak', 'frail', 'vulnerable', 'bleed', 'burn']);
const ENEMY_BUFFS = Object.freeze(['strength']);
const isSelfDebuff = (e) => isPlainStatus(e) && e.target === 'self' && SELF_DEBUFFS.includes(e.status);
const isEnemyBuff = (e) => isPlainStatus(e) && (e.target === 'enemy' || e.target === 'allEnemies') && ENEMY_BUFFS.includes(e.status);
const isDrawbackStatus = (e) => isSelfDebuff(e) || isEnemyBuff(e);
const isAddedCards = (e, id) => e.op === 'addCard' && e.card !== id && Number.isFinite(e.count) && !CONDITION_KEYS_OF(e);
const CONDITION_KEYS_OF = (e) => ['when', 'if', 'condition', 'unless', 'repeat'].some((key) => key in e);

/** FNV-1a over the three roll inputs: a stable 32-bit seed. */
export function upgradeSeed(runSeed, instanceId, stepIndex) {
  const text = `${runSeed}|${instanceId}|${stepIndex}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The stateless roll stream for one step of one card instance. */
export function upgradeStepRng(runSeed, instanceId, stepIndex) {
  return mulberry32(upgradeSeed(runSeed, instanceId, stepIndex));
}

const hitsAnEnemy = (effect) => effect.target === 'enemy' || effect.target === 'allEnemies';
const hitsOf = (effect) => (Number.isInteger(effect.hits) && effect.hits > 1 ? effect.hits : 1);
const totalOf = (effects, op) => {
  const index = firstPlainIndex(effects, op);
  return index < 0 ? 0 : effects[index].amount * hitsOf(effects[index]);
};

// The largest amount from `plain` up to its rank-up scale (limits.scale, 1 for a blacksmith upgrade) that `ok`
// still allows, 0 when even the plain amount is refused. A rank-up bonus is bigger than a normal upgrade
// (owner, 2026-11-01), yet never past the guards a normal upgrade keeps.
const biggest = (plain, scale, ok) => {
  for (let n = Math.max(plain, Math.round(plain * (scale > 1 ? scale : 1))); n >= plain; n -= 1) if (ok(n)) return n;
  return 0;
};

// `rarity` (0 common, 1 uncommon, 2 rare) is the size tier this call builds: the options it returns are the ones the card can take at it.
function resolveEffectiveTier(base, current, limits, scoring) {
  if (limits.tierUnlocks === false) return Infinity;
  if (Number.isFinite(limits.tier)) return Math.max(0, Math.floor(limits.tier));
  if (Number.isFinite(limits.cardRank)) {
    const rarity = limits.instance?.rarityOverride || current.rarity || base.rarity || 'common';
    return EffectiveTier(limits.cardRank, rarity, scoring);
  }
  return Infinity;
}

function options(base, current, applied, limits, rarity = 0, scoring = GetActiveScoring()) {
  const type = base.type;
  const scale = Number.isFinite(limits.scale) ? limits.scale : 1;
  const sized = (kind) => scale * SIZE_MULT[kind][rarity];
  const restricted = RESTRICTED_TYPES.has(type);
  const found = {};
  const tier = resolveEffectiveTier(base, current, limits, scoring);
  const tierGated = Number.isFinite(tier);

  // cost: each cost reduction adds 1 Efficient stack (Efficient / Efficient+ / Efficient+2, max 3 stacks, doubling CP surcharge 10/20/40).
  const efficientStacks = UpgradeTagStacks(current, 'efficient');
  const maxEffStacks = scoring?.upgradeTags?.efficient?.maxStacks ?? MAX_UPGRADE_TAG_STACKS;
  const minCostFloor = tierGated && !ZeroCostUnlocked(tier, scoring) ? 1 : 0;
  if (efficientStacks < maxEffStacks && (!tierGated || UpgradeTagStackUnlocked('efficient', efficientStacks + 1, tier, scoring))) {
    const pools = [];
    const by = {};
    if (Number.isInteger(current.staminaCost) && current.cost === current.staminaCost) {
      const floor = Math.max(minCostFloor, hitFloor(current, currentHits(current.effects || [])));
      if (current.staminaCost - 1 >= floor && current.cost - 1 >= minCostFloor) {
        by.sp = 1;
        pools.push('sp');
      }
    }
    if (Number.isInteger(current.manaCost) && current.manaCost - 1 >= minCostFloor) {
      by.mp = 1;
      pools.push('mp');
    }
    if (rarity === 1 && by.sp && by.mp && efficientStacks + 2 <= maxEffStacks
      && (!tierGated || UpgradeTagStackUnlocked('efficient', efficientStacks + 2, tier, scoring))) {
      found.cost = { combo: ['sp', 'mp'] };
    } else if (rarity === 0 && pools.length) {
      found.cost = { pools, by };
    }
  }
  if (!applied.some((s) => s.k === 'costSwap')) {
    const dirs = [];
    if (Number.isInteger(current.manaCost) && current.manaCost >= 1 && typeof current.cost === 'number') dirs.push('mpToSp');
    if (Number.isInteger(current.staminaCost) && current.cost === current.staminaCost && current.staminaCost >= 2
      && !tagsOf(current).includes(RANK_DOWN_TAG)
      && hitFloor({ ...current, manaCost: (current.manaCost || 0) + 1 }, currentHits(current.effects || [])) <= current.staminaCost - 2) {
      dirs.push('spToMp');
    }
    if (dirs.length) found.costSwap = { dirs };
  }
  // A Power eases its drawbacks too (Ethereal, a rising cost, a debuff); it has no Exhaust to drop.
  if (type === 'power') addDrawbackEase(base, current, found);
  if (restricted) return found;

  const effects = current.effects || [];
  const baseEffects = base.effects || [];
  // prepareTacticalCard turns a counter card's damage and poise into a return payload aimed at the one attacker it
  // answers (the same `maneuver` test it makes), and Core 2 replaces that payload's HP and Poise with the fixed
  // return: a range, area, damage, hits or poise step could never be honoured, so none of them is offered.
  const counterReturn = familyValue(tagsOf(current), 'maneuver:') === 'counter';
  const improvedStacks = UpgradeTagStacks(current, 'improved');
  const impRule = scoring?.upgradeTags?.improved;
  const maxImpStacks = impRule?.maxStacks ?? MAX_UPGRADE_TAG_STACKS;
  const impMult = Number.isFinite(impRule?.effectMultPerStack) && impRule.effectMultPerStack > 1 ? impRule.effectMultPerStack : 1.1;
  let maxAllowedImpStacks = maxImpStacks;
  if (tierGated) {
    maxAllowedImpStacks = 0;
    for (let s = 1; s <= maxImpStacks; s += 1) {
      if (UpgradeTagStackUnlocked('improved', s, tier, scoring)) maxAllowedImpStacks = s;
    }
  }
  const improvedDeltaFor = (baseAmount, curAmount) => {
    const addStacks = Math.min(rarity + 1, maxAllowedImpStacks - improvedStacks);
    if (addStacks <= 0 || baseAmount <= 0) return null;
    const targetAmount = ImprovedScaledAmount(baseAmount, improvedStacks + addStacks, impMult);
    const delta = Math.max(addStacks, targetAmount - curAmount);
    return delta > 0 ? { n: delta, improvedStacks: addStacks } : null;
  };
  const dmgIndex = firstPlainIndex(effects, 'damage');
  // Compounding 10% Improved scaling (1.10^1, 1.10^2, 1.10^3) capped at maxImpStacks, tier ceiling, and the +100% total-damage guard.
  if (!counterReturn && dmgIndex >= 0 && hitsAnEnemy(effects[dmgIndex])) {
    const baseTotal = totalOf(baseEffects, 'damage') || totalOf(effects, 'damage');
    const curTotal = totalOf(effects, 'damage');
    const hits = hitsOf(effects[dmgIndex]);
    const basePerHit = (baseEffects[dmgIndex]?.op === 'damage' ? baseEffects[dmgIndex].amount : effects[dmgIndex].amount) || 1;
    const hitRes = improvedDeltaFor(basePerHit, effects[dmgIndex].amount);
    if (hitRes) {
      const tierCeiling = tierGated ? NumericCeilingAtTier('damage', tier, scoring) : Infinity;
      const maxTotal = Math.min(baseTotal * 2, tierCeiling);
      const maxDelta = Math.floor((maxTotal - curTotal) / Math.max(1, hits));
      const clamped = Math.min(hitRes.n, maxDelta);
      if (clamped >= 1) found.dmg = { ...hitRes, n: clamped };
    }
  }
  const blkIndex = firstPlainIndex(effects, 'block');
  // Only a Block the card was printed with grows: one an `fx` step added has no printed total to cap against.
  if (blkIndex >= 0 && totalOf(baseEffects, 'block') > 0) {
    const baseTotal = totalOf(baseEffects, 'block');
    const blkRes = improvedDeltaFor(baseTotal, effects[blkIndex].amount);
    if (blkRes) {
      const tierCeiling = tierGated ? NumericCeilingAtTier('block', tier, scoring) : Infinity;
      const maxTotal = Math.min(baseTotal * 2, tierCeiling);
      const maxDelta = Math.max(0, maxTotal - effects[blkIndex].amount);
      const clamped = Math.min(blkRes.n, maxDelta);
      if (clamped >= 1) found.blk = { ...blkRes, n: clamped };
    }
  }
  // apply raises the FIRST plain effect of a status, so only that one is a candidate. It is judged on the
  // FINAL face, rank applied: a status the rank already holds at its cap gains nothing from a step.
  const rank = limits.rank > 1 ? limits.rank : 1;
  const finalStacks = (card, status) => {
    const shown = rank > 1 ? { ...card, effects: rankedEffectsCapped(card, rank - 1) } : card;
    return (shown.effects || []).find((e) => isPlainStatus(e) && e.status === status)?.stacks;
  };
  const effectiveStatusCap = (status) => {
    const baseCap = stackCap(status, current);
    if (!tierGated) return baseCap;
    const tierCap = StatusStackCapAtTier(status, tier, scoring);
    if (baseCap === undefined) return Number.isFinite(tierCap) ? tierCap : undefined;
    return Math.min(baseCap, tierCap);
  };
  const seenStatus = new Set();
  const purifiedStacks = UpgradeTagStacks(current, 'purified');
  const purifyStatuses = new Set(['re' + 'gen', 'ward']);
  const stackable = effects.find((e) => {
    if (!isPlainStatus(e) || isDrawbackStatus(e) || seenStatus.has(e.status)) return false;
    seenStatus.add(e.status);
    if (tierGated) {
      if (!StatusUnlocked(e.status, tier, scoring)) return false;
      const tagFam = purifyStatuses.has(e.status) ? 'purified' : 'improved';
      const curTagStacks = tagFam === 'purified' ? purifiedStacks : improvedStacks;
      if (!UpgradeTagStackUnlocked(tagFam, curTagStacks + 1, tier, scoring)) return false;
    }
    const cap = effectiveStatusCap(e.status);
    if (cap === undefined || e.stacks + 1 > cap) return false;
    const stepped = applyUpgradeSteps(base, [...applied, { k: 'stk', status: e.status, n: 1 }]);
    return finalStacks(stepped, e.status) > finalStacks(current, e.status);
  });
  if (stackable) {
    const cap = effectiveStatusCap(stackable.status);
    const n = biggest(1, sized('stk'), (k) => stackable.stacks + k <= cap
      && finalStacks(applyUpgradeSteps(base, [...applied, { k: 'stk', status: stackable.status, n: k }]), stackable.status) > finalStacks(current, stackable.status));
    if (n) found.stk = { status: stackable.status, n };
  }

  if (!effects.some((e) => e.op === 'applyStatus') && dmgIndex >= 0 && effects[dmgIndex].target === 'enemy') {
    // The card's school: its damage school, else its `camp:` tag (kept unquoted so the
    // mechanics generator does not take this file for the tag's reader).
    const camp = ((base.tags || []).find((tag) => tag.startsWith('camp:')) || '').slice(5);
    const school = base.damageSchool === 'magic' || camp === 'spell' ? 'spell' : base.damageSchool === 'physical' || camp === 'physical' ? 'physical' : '';
    const rawStatuses = school === 'spell' ? ['burn', 'vulnerable'] : school === 'physical' ? ['bleed', 'weak'] : [];
    const unlockedStatuses = tierGated ? rawStatuses.filter((s) => StatusUnlocked(s, tier, scoring)) : rawStatuses;
    if (unlockedStatuses.length) {
      const cap = tierGated ? Math.min(...unlockedStatuses.map((s) => StatusStackCapAtTier(s, tier, scoring))) : Infinity;
      const stacks = Math.min(rarity + 1, cap);
      if (stacks >= 1) found.addStatus = { statuses: unlockedStatuses, stacks };
    }
  }

  if (!counterReturn && dmgIndex >= 0 && !applied.some((s) => s.k === 'hits') && !effects.some((e) => e.op === 'damage' && hitsOf(e) > 1)
    && hitsAnEnemy(effects[dmgIndex]) && effects[dmgIndex].amount <= 8) {
    const baseTotal = totalOf(baseEffects, 'damage') || totalOf(effects, 'damage');
    const amount = effects[dmgIndex].amount;
    const per = Math.ceil(amount * 0.6);
    // The step must not raise what the card costs to play: its hit floor has to fit the SP it already pays.
    const sp = Number.isInteger(current.staminaCost) ? current.staminaCost : 0;
    const counts = [rarity === 2 ? 3 : 2].filter((hits) => rarity !== 1 && hits <= 3 && per * hits - baseTotal <= baseTotal && per * hits > amount && hitFloor(current, hits) <= sp);
    if (counts.length) found.hits = { per, counts };
  }
  addTagOptions(base, current, applied, found, dmgIndex, limits, counterReturn, rarity, tier, scoring);
  addMenuOptions(base, current, found, dmgIndex, counterReturn, rarity, scale);
  addDrawbackEase(base, current, found);
  if (!counterReturn && isSpellCard(current) && !applied.some((s) => s.k === 'attr')) found.attr = { stats: RUN_ATTRIBUTE_STATS };
  return found;
}

const isSpellCard = (card) => familyValue(tagsOf(card), 'camp:') === 'spell' || tagsOf(card).includes('source:spell');
const hasOp = (effects, op) => effects.some((effect) => effect.op === op);
const FX_OF = (id) => `fx:${id}`;

/**
 * The effect menu (owner, 2026-11-14): each option adds an effect the card does not already have, so it always changes
 * what the card does. A kind is left out when the card already has what it would add (no second Draw effect past 3, no
 * Retain on a Retain card, no Exhaust-removal on a card without Exhaust, no hit-all-style duplicate).
 */
function addMenuOptions(base, current, found, dmgIndex, counterReturn, rarity = 0, scale = 1) {
  const effects = current.effects || [];
  const tags = tagsOf(current);
  const keywords = current.keywords || [];
  const maneuver = familyValue(tags, 'maneuver:');
  const hasBlock = hasOp(effects, 'block');
  const attack = tags.includes('classification.attack') || base.type === 'attack';
  const sp = Number.isInteger(current.staminaCost) ? current.staminaCost : 0;
  const spell = familyValue(tags, 'camp:') === 'spell' || tags.includes('source:spell');
  const set = (id, option = {}) => { found[FX_OF(id)] = { fx: id, ...option }; };
  // Wave 2 batch 5: +1 Counter on a card that already grants Counter stacks, while the whole grant (its own, +1 once upgraded, plus every earlier +1) stays within stacksMax.
  const stackRules = fixCoreMechanics.counter;
  if (maneuver === 'counter' && stackRules?.stackSource === 'card') {
    const own = Number.isInteger(stackRules.stacksByCard?.[base.id]) ? stackRules.stacksByCard[base.id] : stackRules.stacksPerCard;
    const extra = effects.filter((e) => e.op === 'gainCounterStacks').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    if (own + (stackRules.stacksUpgradeBonus || 0) + extra + 1 <= stackRules.stacksMax) set('counter', { n: 1 });
  }
  if (!hasBlock && !counterReturn && maneuver !== 'counter') set('block', { n: (sp >= 2 ? 6 : 4) * SIZE_MULT['fx:block'][rarity] });
  const draw = effects.filter((e) => isPlainEffect(e, 'draw')).reduce((sum, e) => sum + e.amount, 0);
  // Draw and Cycle come in two sizes: 1 (common) and 2 (rare, total draw still 3 or less).
  if (rarity !== 1 && draw + (rarity === 2 ? 2 : 1) <= 3) set('draw', { n: rarity === 2 ? 2 : 1 });
  if (rarity !== 1 && !hasOp(effects, 'discard') && !hasOp(effects, 'draw')) set('cycle', { n: rarity === 2 ? 2 : 1 });
  if (!hasOp(effects, 'exhaust') && !keywords.includes('exhaust')) set('cull');
  if (!hasOp(effects, 'addCard') && !keywords.includes('exhaust')) set('copy');
  if (!hasOp(effects, 'shuffleDiscardIntoDraw')) set('shuffle');
  if (!keywords.includes('retain') && !keywords.includes('ethereal')) set('retain');
  if (!keywords.includes('innate')) set('innate');
  if (keywords.includes('exhaust')) set('unexhaust');
  if (!hasOp(effects, 'retain')) set('holdOne');
  const boosted = (stat) => effects.some((e) => (e.op === 'applyStatus' && e.thisTurn === true && e.status === stat) || (e.op === 'changeAttribute' && e.attribute === stat));
  // A boost is a live attribute change (engine/liveStats.js): STR for an attack, DEX for a block, INT for a spell's damage, WIS for a
  // spell's defence. stepOf picks the duration: this turn (+2) or the rest of the fight (+1, stacks per play).
  const hasWard = hasOp(effects, 'gainWard') || hasOp(effects, 'gainBarrier');
  if (!spell && dmgIndex >= 0 && !boosted('strength')) set('boost', { stat: 'strength' });
  else if (!spell && hasBlock && !boosted('dexterity')) set('boost', { stat: 'dexterity' });
  else if (spell && dmgIndex >= 0 && !boosted('intelligence')) set('boost', { stat: 'intelligence' });
  else if (spell && (hasBlock || hasWard) && !boosted('wisdom')) set('boost', { stat: 'wisdom' });
  if (!counterReturn && dmgIndex >= 0 && effects[dmgIndex].target === 'enemy' && attack
    && rarity > 0 && !effects.some((e) => e.op === 'damage' && (e.target === 'randomEnemy' || e.target === 'otherEnemy'))) set('target', { other: true, share: rarity === 2 ? 0.75 : 0.5 });
  // Owner, 2026-11-14: Reaction is open to every stance (attack, smash, sweep, spells, skills). A card that already reacts (Defense, Counter,
  // or `trait:reaction`) and an X-cost card are left out; Powers never reach this menu.
  if (!tags.includes('trait:reaction') && !['defend', 'counter'].includes(maneuver) && !tags.includes('maneuver:defend') && !tags.includes('maneuver:counter') && current.cost !== 'X' && base.cost !== 'X') set('reaction');
  const hasSelfBuff = effects.some((e) => e && e.target === 'self' && (e.op === 'changeAttribute' || (e.op === 'applyStatus' && !SELF_DEBUFFS.includes(e.status))));
  if (hasSelfBuff && !tags.includes('trait:recurring')) set('recurring');
  // Purified upgrade line (owner, 2026-11-25): healing & cleansing.
  const curHeal = effects.filter((e) => isPlainEffect(e, 'heal')).reduce((sum, e) => sum + e.amount, 0);
  if (!counterReturn && maneuver !== 'counter' && curHeal < 12) set('heal', { n: 2 * SIZE_MULT['fx:heal'][rarity] });
  if (!counterReturn && !hasOp(effects, 'removeStatus')) set('cleanse', { status: 'weak', n: 1 });
}

/** Ethereal and a rising cost (both `fx` steps) and the signed `stk` (proposal section 7) lower what a card's drawback costs. */
function addDrawbackEase(base, current, found) {
  const effects = current.effects || [];
  if ((current.keywords || []).includes('ethereal')) found['fx:unethereal'] = { fx: 'unethereal' };
  if (risingCost(current)) found['fx:steady'] = { fx: 'steady' };
  const targets = [];
  for (const e of effects) {
    if (isDrawbackStatus(e) && !targets.some((t) => t.status === e.status && t.side === (e.target === 'self' ? 'self' : 'enemy'))) targets.push({ status: e.status, side: e.target === 'self' ? 'self' : 'enemy', count: e.stacks });
  }
  const authored = base.effects || [];
  const discard = effects.find((e) => isPlainEffect(e, 'discard'));
  if (discard && authored.some((e) => isPlainEffect(e, 'discard'))) targets.push({ op: 'discard', count: discard.amount });
  const added = effects.find((e) => isAddedCards(e, base.id));
  if (added && authored.some((e) => isAddedCards(e, base.id))) targets.push({ op: 'addCard', count: added.count });
  if (targets.length) found.stkEase = { targets };
}

const tagsOf = (card) => card.cardTags ?? card.tags ?? [];
/** Whether the card's cost still rises with each play (an upgrade's `steady` sets the growth to 0). */
const risingCost = (card) => !!card.costGrowth && ((card.costGrowth.stamina || 0) > 0 || (card.costGrowth.mana || 0) > 0);
const familyValue = (tags, prefix) => tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || '';
// The owner removed ranged cards (2026-11-14): a stance change never offers `ranged` (old saves with it still resolve).
const ATTACK_MANEUVERS = TAG_FAMILIES['maneuver:'].filter((m) => ['attack', 'smash'].some((x) => x === m));
/** Chill stacks a card applies at or above which a frost hit leaves its Poise damage nothing to spend (see freezesTarget). */
const FREEZING_CHILL = 3;
// Mirrors upgradeBasic (cardUpgradeLimits.js, which imports this module): a cantrip, or a common non-spell.
const basicDef = (def) => {
  const tags = def.tags || [];
  return tags.includes(RANK_DOWN_TAG) || (def.rarity === 'common' && !tags.includes('source:spell') && !tags.includes('camp:spell'));
};

/** The identity-change options (poise, range, targeting, stance, school, element, rank-down) for a non-restricted card. */
function addTagOptions(base, current, applied, found, dmgIndex, limits = {}, counterReturn = false, rarity = 0, tier = Infinity, scoring = GetActiveScoring()) {
  const effects = current.effects || [];
  const tags = tagsOf(current);
  const camp = familyValue(tags, 'camp:');
  const maneuver = familyValue(tags, 'maneuver:');
  const spell = camp === 'spell' || tags.includes('source:spell');
  const hitsEnemy = dmgIndex >= 0 && (effects[dmgIndex].target === 'enemy' || effects[dmgIndex].target === 'allEnemies');
  const attacking = hitsEnemy && (['attack', 'smash', 'sweep', 'ranged', 'counter'].includes(maneuver) || spell);
  const tagged = (predicate) => applied.some((s) => s.k === 'tag' && predicate(s));

  const poiseIndex = firstPlainIndex(effects, 'poiseDamage');
  // A Smash card's Poise damage is derived from the hit it lands (gameProfileCombat smashRule), so its printed Poise number
  // never reaches the engine: a Poise step on it would change a shown number and nothing else (W25 upgrades, step 1).
  // Glacial Spike (3 Chill, a frost hit that soaks the whole Poise pool before its Poise damage lands): measured in the no-op probe against Chilled targets of every
  // pool size, Poise rating and Constitution tried, a Poise step on it changes nothing the engine does, so none is offered (batch 4 review).
  const freezesTarget = familyValue(tags, 'school:') === 'frost' && effects.some((e) => e.op === 'applyStatus' && e.status === 'chill' && e.target !== 'self' && (e.stacks || 0) >= FREEZING_CHILL);
  if (poiseIndex >= 0 && !counterReturn && maneuver !== 'smash' && !freezesTarget) {
    const baseTotal = (base.effects || []).find((e) => isPlainEffect(e, 'poiseDamage'))?.amount || effects[poiseIndex].amount;
    const n = biggest(Math.max(1, Math.ceil(baseTotal * 0.2)), (Number.isFinite(limits.scale) ? limits.scale : 1) * SIZE_MULT.poise[rarity], (k) => effects[poiseIndex].amount + k - baseTotal <= baseTotal);
    if (n) found.poise = { n };
  }
  if (attacking && !counterReturn) {
    // The default mirrors combatCardProfile defaultRangeFor: a spell, a projectile or a ranged stance already reaches.
    const raw = familyValue(tags, 'range:') || normalizeRange(familyValue(tags, 'reach:'))
      || (maneuver === 'ranged' || spell || familyValue(tags, 'delivery:') === 'projectile' ? 'reach' : 'melee');
    // Only a longer reach is offered: Reach to Melee loses range on a single play (owner, 2026-11-20, no downgrades).
    const next = { melee: 'reach' }[raw];
    // Owner, 2026-11-05: a fight capped at Reach never offers Reach to Ranged (limits.maxRange, from the run's range policy).
    const cap = RANGES.indexOf(limits.maxRange);
    if (next && applied.filter((t) => t.tag?.startsWith('range:')).length < 2 && (cap < 0 || RANGES.indexOf(next) <= cap)) found.range = { tag: `range:${next}` };
  }
  if (hitsEnemy && maneuver !== 'sweep' && !counterReturn && !tagged((s) => s.retarget)) {
    const [SINGLE, AREA] = TARGETING;
    const area = familyValue(tags, 'targeting:') ? familyValue(tags, 'targeting:') === AREA : effects[dmgIndex].target === 'allEnemies';
    // Single-target hits harder (x1.25 up): it stays inside the same +100% guard a damage step keeps.
    const baseTotal = totalOf(base.effects || [], 'damage') || totalOf(effects, 'damage');
    const grown = Math.ceil(effects[dmgIndex].amount * 1.25) * hitsOf(effects[dmgIndex]);
    // One enemy to all enemies is not offered: it cuts the hit 25%, a downgrade on a single play (owner, 2026-11-20).
    // A saved `targeting:all` step still resolves (cardUpgrade.js).
    if (area && grown - baseTotal <= baseTotal) found.targeting = { tag: `targeting:${SINGLE}`, retarget: SINGLE };
  }
  if (hitsEnemy && !spell && ATTACK_MANEUVERS.includes(maneuver) && !tagged((t) => t.tag?.startsWith('maneuver:'))) {
    const sp = Number.isInteger(current.staminaCost) ? current.staminaCost : 0;
    const tags2 = ATTACK_MANEUVERS.filter((m) => m !== maneuver && (m !== 'smash' || sp >= 2));
    if (tags2.length) found.maneuver = { tags: tags2.map((m) => `maneuver:${m}`) };
  }
  // No `school` swap option: a school change alone changes no play (the riders that read it belong to the elements work),
  // and `add elemental damage` (step 2) is how a card gains an element.
  // dmgType (owner, 2026-11-19): a melee, non-spell, non-elemental attack, smash or sweep may change its physical type, once per card.
  // A weapon card may change away from its weapon's type: the step replaces the weapon block with the fixed type, as an element does.
  if (hitsEnemy && !counterReturn && !spell && ['attack', 'smash', 'sweep'].includes(maneuver) && current.damageSchool === 'physical'
    && (familyValue(tags, 'range:') || normalizeRange(familyValue(tags, 'reach:')) || 'melee') === 'melee'
    && !tags.some((t) => t.startsWith('damage:') && !PHYSICAL_DAMAGE_TYPES.includes(t.slice(7)))
    && !tagged((s) => s.damageSchool || PHYSICAL_DAMAGE_TYPES.includes(s.damage))) {
    const now = tags.find((t) => t.startsWith('damage:'))?.slice(7) || current.attack?.damageType;
    found.dmgType = { types: PHYSICAL_DAMAGE_TYPES.filter((type) => type !== now) };
  }
  // Element (owner, 2026-11-19): ADDS a magic packet to the hit instead of replacing it; a card that already holds one raises its own packet.
  // The packet is 75% of the matching damage step (min 2 / 3 / 6 by rarity) and, with the damage steps, stays inside the +100% guard.
  // A card with an authored `attack` block (typed components) keeps its own mix: no packet is offered there.
  if (hitsEnemy && !counterReturn && camp !== 'spell' && !current.attack && isPlainEffect(effects[dmgIndex], 'damage')) {
    const held = HoldsPacket(current);
    const tierGated = Number.isFinite(tier);
    if ((held || (current.damageSchool === 'physical' && !tagged((s) => s.damageSchool)))
      && (!tierGated || held || HybridUnlocked(tier, scoring))) {
      const baseTotal = totalOf(base.effects || [], 'damage') || totalOf(effects, 'damage');
      const hits = hitsOf(effects[dmgIndex]);
      const step = Math.max(2, Math.ceil(baseTotal * 0.15)) * SIZE_MULT.dmg[rarity];
      const lift = Number.isFinite(limits.scale) && limits.scale > 1 ? limits.scale : 1;
      let n = Math.round(Math.max(PACKET_MIN[rarity], Math.ceil(step * 0.75)) * lift);
      while (n >= 2 && (effects[dmgIndex].amount + n) * hits - baseTotal > baseTotal) n -= 1;
      const schools = held ? [current.damageSchool] : (tierGated ? UPGRADE_ELEMENTS.filter((el) => ElementUnlocked(el, tier, scoring)) : UPGRADE_ELEMENTS);
      if (n >= 2 && schools.length) found.element = { schools, n, ...(held ? {} : { exposure: limits.exposure }) };
    }
  }
  // a card that pays no Stamina (the 0 SP / 0 MP zero-cost cards) would become a 0-cost cantrip, which Core forbids (SPEC, zero-cost cards)
  // ...and only a card that pays Mana: on a 0-Mana card the step would change a tag and nothing else.
  if (!basicDef(base) && !tags.includes(RANK_DOWN_TAG) && current.staminaCost !== 0 && current.manaCost > 0
    // zeroing Mana drops the multi-hit Stamina offset: never offer it when the floor would then exceed the printed SP
    && hitFloor({ ...current, manaCost: 0 }, currentHits(current.effects || [])) <= (current.staminaCost || 0) && !tagged((s) => s.tag === RANK_DOWN_TAG)) found.rankDown = { tag: RANK_DOWN_TAG };
}

/**
 * The options a card can take at each rarity: [common, uncommon, rare], each a map of option kind -> option. A sized kind
 * (damage, Block, Poise, stacks) shows at a rarity only when its size there beats the sizes below it, so the picker never
 * offers two rarities of one number; a placed kind (one size) shows at its own rarity only. An ease option is common as is,
 * uncommon as a combo of the ease and a draw, and rare as a combo of the ease and a rare-size step the card can take.
 */
const TEMPERED_KINDS = new Set(['hits', 'poise', 'fx:block', 'fx:counter', 'range', 'targeting', 'maneuver', 'element']);
const PURIFIED_KINDS = new Set(['fx:heal', 'fx:cleanse']);

function optionsByRarity(base, current, applied, limits, scoring = GetActiveScoring()) {
  const per = [0, 1, 2].map((rarity) => options(base, current, applied, limits, rarity, scoring));
  for (let r = 0; r < 3; r += 1) {
    for (const kind of Object.keys(per[r])) if (kind in PLACED_AT && PLACED_AT[kind] !== r) delete per[r][kind];
    for (const kind of EASE_KINDS) if (r > 0) delete per[r][kind];
  }
  for (let r = 1; r < 3; r += 1) {
    for (const kind of Object.keys(SIZE_MULT)) {
      const size = (option) => (['stk', 'fx:block', 'fx:heal', 'dmg', 'blk', 'poise', 'element'].includes(kind) ? option?.n : 0);
      const below = Math.max(0, ...per.slice(0, r).map((found) => size(found[kind]) || 0));
      if (per[r][kind] && size(per[r][kind]) <= below) delete per[r][kind];
    }
  }
  // Tier unlock gating (owner, 2026-11-25): filter kinds, upgrade rarity sizes, and stacking tag lines
  // (Improved, Efficient, Refined, Tempered, Purified) by effectiveTier = cardRank + rarityBonus[rarity]
  // BEFORE attaching ease-combo partners, so no tier-locked partner ever leaks into an uncommon/rare ease combo.
  const tier = resolveEffectiveTier(base, current, limits, scoring);
  const menu = Array.isArray(base.upgradeMenu) ? base.upgradeMenu : null;
  const graded = Array.isArray(base.gradeProfiles) && !menu;
  const refinedStacks = UpgradeTagStacks(current, 'refined');
  const temperedStacks = UpgradeTagStacks(current, 'tempered');
  const purifiedStacks = UpgradeTagStacks(current, 'purified');
  if (Number.isFinite(tier)) {
    for (let r = 0; r < 3; r += 1) {
      for (const kind of Object.keys(per[r])) {
        if (menu?.includes(kind)) continue;
        if (graded && EASE_KINDS.includes(kind) && r === 0) continue;
        if (!UpgradeKindUnlocked(kind, tier, scoring)) { delete per[r][kind]; continue; }
        if (!UpgradeRarityUnlocked(r, tier, scoring) && !(kind in PLACED_AT)) { delete per[r][kind]; continue; }
        if (EASE_KINDS.includes(kind)) {
          if (!UpgradeTagStackUnlocked('refined', refinedStacks + 1, tier, scoring)) { delete per[r][kind]; continue; }
        } else if (TEMPERED_KINDS.has(kind)) {
          if (!UpgradeTagStackUnlocked('tempered', temperedStacks + 1, tier, scoring)) { delete per[r][kind]; continue; }
        } else if (PURIFIED_KINDS.has(kind)) {
          if (!UpgradeTagStackUnlocked('purified', purifiedStacks + 1, tier, scoring)) { delete per[r][kind]; continue; }
        }
      }
    }
  }
  for (const kind of EASE_KINDS) {
    const ease = per[0][kind];
    if (!ease) continue;
    // A Power takes no draw option, so its sweetener is a cost cut.
    const partner = per[0]['fx:draw'] ? 'fx:draw' : per[0].cost ? 'cost' : '';
    const uncOk = !Number.isFinite(tier) || (UpgradeRarityUnlocked(1, tier, scoring) && UpgradeTagStackUnlocked('refined', Math.max(refinedStacks + 1, 2), tier, scoring));
    if (partner && uncOk) per[1][kind] = { ...ease, remove: true, also: [{ kind: partner, option: per[0][partner] }] };
    const rare = ['cost', 'dmg', 'blk'].filter((k) => per[2][k]).map((k) => ({ kind: k, option: per[2][k] }));
    const rareOk = !Number.isFinite(tier) || (UpgradeRarityUnlocked(2, tier, scoring) && UpgradeTagStackUnlocked('refined', Math.max(refinedStacks + 1, 3), tier, scoring));
    if (rare.length && rareOk) per[2][kind] = { ...ease, remove: true, also: rare };
  }
  return per;
}

/**
 * rollUpgradeStep(baseDef, appliedSteps, stepIndex, rng, limits?) → the next (limits: scale, rank, ...)
 * stored step. `appliedSteps` are the steps the card already has; `rng` is
 * upgradeStepRng(run.seed, instanceId, stepIndex). Filters the options to the
 * ones the card is eligible for, then makes a weighted pick; if none is
 * eligible the card is fully upgraded and the result is null (no filler step).
 */
export function rollUpgradeStep(baseDef, appliedSteps, stepIndex, rng, limits = {}) {
  return rollUpgradeOptions(baseDef, appliedSteps, stepIndex, rng, limits, 1)[0] || null;
}

const stepOf = (kind, option, choice, rarity = 0) => {
  const pickOf = (list) => list[Math.min(list.length - 1, Math.floor(choice * list.length))];
  const rated = (step) => (rarity > 0 ? { ...step, r: UPGRADE_RARITIES[rarity] } : step);
  // An ease at a higher rarity is a combo: the ease and its partner step (a draw, or a rare-size step). The partner's own
  // choice is the rest of this option's choice, so the roll stays two draws per option.
  if (option.also) {
    const { also, ...ease } = option;
    const at = Math.min(also.length - 1, Math.floor(choice * also.length));
    const partner = stepOf(also[at].kind, also[at].option, choice * also.length - at, 0);
    return rated({ k: 'combo', steps: [stepOf(kind, ease, choice, 0), partner] });
  }
  // The boost's duration and size follow the rarity: +2 this turn, +1 for the rest of the fight, +2 for the rest of the fight.
  if (kind === 'fx:boost') return rated(rarity === 0 ? { k: 'fx', fx: 'boost', stat: option.stat, n: 2, until: 'turn' } : { k: 'fx', fx: 'boost', stat: option.stat, n: rarity, until: 'fight' });
  if (kind.startsWith('fx:')) { const { remove, ...fx } = option; return rated({ k: 'fx', ...fx }); }
  if (kind === 'stkEase') {
    const target = pickOf(option.targets);
    const n = option.remove ? -target.count : -1;
    return rated(target.op ? { k: 'stk', op: target.op, n } : { k: 'stk', status: target.status, side: target.side, n });
  }
  switch (kind) {
    case 'dmg': return rated({ k: 'dmg', n: option.n, ...(option.improvedStacks > 1 ? { improvedStacks: option.improvedStacks } : {}) });
    case 'blk': return rated({ k: 'blk', n: option.n, ...(option.improvedStacks > 1 ? { improvedStacks: option.improvedStacks } : {}) });
    case 'stk': return rated({ k: 'stk', status: option.status, n: option.n || 1 });
    case 'addStatus': return rated({ k: 'addStatus', status: pickOf(option.statuses), stacks: option.stacks || 1 });
    case 'cost': {
      if (option.combo) return rated({ k: 'combo', steps: option.combo.map((pool) => ({ k: 'cost', pool })) });
      // A bigger cut (a rank-up bonus, or a rare -2) names its amount; the plain -1 stays the bare step every save already holds.
      const pool = pickOf(option.pools);
      return rated(option.by?.[pool] > 1 ? { k: 'cost', pool, n: option.by[pool] } : { k: 'cost', pool });
    }
    case 'costSwap': return rated({ k: 'costSwap', dir: pickOf(option.dirs) });
    case 'poise': return rated({ k: 'poise', n: option.n });
    case 'attr': return rated({ k: 'attr', stat: pickOf(option.stats), n: 1 });
    case 'range': case 'rankDown': return rated({ k: 'tag', tag: option.tag });
    case 'targeting': return rated({ k: 'tag', tag: option.tag, retarget: option.retarget });
    case 'dmgType': return rated({ k: 'tag', damage: pickOf(option.types) });
    case 'maneuver': case 'school': return rated({ k: 'tag', tag: pickOf(option.tags) });
    case 'element': {
      const damageSchool = pickOf(option.schools);
      const identity = ELEMENT_IDENTITY[damageSchool];
      // The step stores the packet's size; apply derives the magic share from it (a step saved before packets carries `magicShare: 1` and no `packet`).
      return rated({ k: 'tag', tag: `school:${identity.school}`, damage: identity.damage, damageSchool, packet: option.n,
        ...(Number.isInteger(option.exposure) && option.exposure > 0 ? { exposureBuildupPerHit: option.exposure } : {}) });
    }
    default: return rated({ k: 'hits', hits: option.counts[0], per: option.per });
  }
};

/**
 * rollUpgradeOptions(baseDef, appliedSteps, stepIndex, rng, limits, count) → up to `count` DISTINCT steps (each of
 * another family, UPGRADE_FAMILIES, so never two of one kind) from the one per-step stream: each takes two draws (pick, then the
 * option's own choice), so the first option is exactly rollUpgradeStep's. Fewer than `count` come back when the card
 * has fewer eligible options; [] when it is fully upgraded.
 */
export function rollUpgradeOptions(baseDef, appliedSteps, stepIndex, rng, limits = {}, count = 1) {
  // A combo is two effects in one slot: the checks below (once per card, already tagged) look through it.
  const applied = FlatSteps(appliedSteps);
  const current = applied.length ? applyUpgradeSteps(baseDef, applied) : baseDef;
  const activeScoring = limits.scoring || GetActiveScoring();
  const perRarity = optionsByRarity(baseDef, current, applied, limits, activeScoring);
  // An authored `upgradeMenu` limits the rolled options to the kinds it names (Star Seer's Ethereal: Reaction, drop Ethereal or more Block).
  // A ranked ability card's grade table owns its numbers, so it applies only drawback-removal steps (cardUpgrade.js DrawbackSteps):
  // it is offered only those, at the common size (a combo's second step would be one the grade table ignores), so the offer equals the
  // effect (review of #2819).
  const menu = Array.isArray(baseDef.upgradeMenu) ? baseDef.upgradeMenu
    : Array.isArray(baseDef.gradeProfiles) ? DrawbackSteps.map((fx) => `fx:${fx}`) : null;
  const graded = Array.isArray(baseDef.gradeProfiles) && !Array.isArray(baseDef.upgradeMenu);
  // `limits.excludeFamilies` names families already on offer (an authored first step's), so no option repeats one.
  // With `limits.everyFamily` a pick excludes only its own kind (a probe or test that walks the whole menu).
  const takenFamilies = new Set(limits.excludeFamilies || []);
  const takenKinds = new Set();
  // A dud kind (DUD_KINDS) is rolled only when a card's own upgradeMenu names it.
  const allowed = (kind) => (menu ? menu.includes(kind) : !DUD_KINDS.includes(kind));
  // An ease above common is a combo of the ease and a partner step (`also`): the partner must be of a family still open, so the
  // combo never brings back a family already on offer. `optionAt` drops the closed partners; an ease with none left is closed.
  // Memoize CP checks per (r, kind[, also]) within this roll so kindsAt/open do not re-run applyUpgradeSteps + ScoreCard
  // thousands of times across the Blacksmith/Trader/Rest picker (was ~20,000+ calls per card).
  const cpCache = new Map();
  const cpCheck = (r, kind, opt, cacheKey) => {
    if (!opt || limits.playerLevel == null) return opt;
    const key = cacheKey || `${r}:${kind}`;
    let allowedNow = cpCache.get(key);
    if (allowedNow === undefined) {
      const probe = stepOf(kind, opt, 0, r);
      allowedNow = EvaluateUpgradeStepCp({ baseDef, currentDef: current, instance: limits.instance || null, step: probe, playerLevel: limits.playerLevel, scoring: activeScoring }).allowed;
      cpCache.set(key, allowedNow);
    }
    return allowedNow ? opt : null;
  };
  const optionAt = (r, kind) => {
    const option = perRarity[r][kind];
    if (!option) return null;
    if (!option.also || limits.everyFamily) return cpCheck(r, kind, option, `${r}:${kind}`);
    const also = option.also.filter((partner) => !takenFamilies.has(UpgradeKindFamily(partner.kind, partner.option)));
    if (!also.length) return null;
    const key = `${r}:${kind}:${also.map((p) => p.kind).join(',')}`;
    return cpCheck(r, kind, { ...option, also }, key);
  };
  const open = (r, kind) => !takenKinds.has(kind) && !takenFamilies.has(UpgradeKindFamily(kind, perRarity[r][kind])) && !!optionAt(r, kind);
  // kindsAt(r, group): the kinds still open at rarity r, in WEIGHTS order.
  const vendor = UPGRADE_VENDORS[limits.vendor] || null;
  const categoryAt = (r, kind) => UpgradeCategoryOf(kind, perRarity[r][kind], current);
  const kindsAt = (r, group, category) => Object.keys(WEIGHTS).filter((kind) => perRarity[r][kind] && allowed(kind) && open(r, kind) && (!graded || r === 0)
    && (!group || UpgradeGroupOf(kind) === group) && (!category || categoryAt(r, kind) === category));
  const out = [];
  const shares = UpgradeGroupShares(stepIndex + 1);
  // Draw order is fixed (pick, then the kind's own choice) so a roll is a pure function of its stream. `pick` is split by
  // rescaling: it picks the group, the rest of it picks the rarity, and what remains picks the kind inside both.
  for (let n = 0; n < Math.max(1, count | 0); n += 1) {
    const pick = rng();
    const choice = rng();
    if (![0, 1, 2].some((r) => kindsAt(r).length)) break;
    // A group with no eligible kind gives its share to the others pro rata (they are renormalised by the pick); so does a rarity.
    const groups = UPGRADE_GROUPS.filter((group) => [0, 1, 2].some((r) => kindsAt(r, group).length)).map((group) => [group, shares[group]]);
    const { key: group, rest: afterGroup } = pickByWeight(groups, pick);
    // A vendor then picks the category (its multipliers over the group's kinds) and reads that category's rarity odds; without one the roll is unchanged.
    let category = '', standing = 'base', afterCategory = afterGroup;
    if (vendor) {
      const seen = new Map();
      for (const r of [0, 1, 2]) for (const kind of kindsAt(r, group)) if (!seen.has(kind)) seen.set(kind, categoryAt(r, kind));
      const weights = ['physical', 'magic', 'neutral'].map((name) => [name, [...seen].reduce((sum, [kind, cat]) => sum + (cat === name ? WEIGHTS[kind] : 0), 0) * vendor[name]]).filter(([, weight]) => weight > 0);
      ({ key: category, rest: afterCategory } = pickByWeight(weights, afterGroup));
      standing = category === 'neutral' ? 'base' : category === vendor.own ? 'own' : 'off';
    }
    const here = (r) => kindsAt(r, group, category || undefined);
    const rarityOdds = UpgradeRarityOdds(stepIndex + 1, standing);
    const rarities = [0, 1, 2].filter((r) => here(r).length).map((r) => [r, rarityOdds[r]]);
    const { key: rarity, rest: afterRarity } = pickByWeight(rarities, afterCategory);
    const inGroup = here(rarity);
    const { key: kind } = pickByWeight(inGroup.map((candidate) => [candidate, WEIGHTS[candidate]]), afterRarity);
    let step = stepOf(kind, optionAt(rarity, kind), choice, rarity);
    if (limits.playerLevel != null) {
      const cpRes = EvaluateUpgradeStepCp({ baseDef, currentDef: current, instance: limits.instance || null, step, playerLevel: limits.playerLevel, scoring: activeScoring });
      const curRarity = limits.instance?.rarityOverride || current.rarity || baseDef.rarity || 'common';
      const curRank = limits.cardRank ?? 0;
      if (cpRes.allowed) {
        if (cpRes.rarity && cpRes.rarity !== curRarity) step = { ...step, nextRarity: cpRes.rarity };
        if (Number.isInteger(cpRes.rank) && cpRes.rank > curRank) step = { ...step, nextRank: cpRes.rank };
      }
    }
    out.push(step);
    // The picked family leaves the draw: the next option is of another family (with everyFamily, only the kind).
    if (limits.everyFamily) takenKinds.add(kind); else for (const family of [UpgradeKindFamily(kind, perRarity[rarity][kind]), ...UpgradeStepFamilies(step)]) takenFamilies.add(family);
  }
  return out;
}
