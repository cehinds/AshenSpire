// The Core card-upgrade step generator (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md).
// Pure and stateless: the roll is mulberry32(hash(run.seed, instanceId, stepIndex)),
// so a preview equals the commit and no named RNG stream moves. A leaf module:
// it imports only rng.js (a leaf) and cardUpgrade.js (a leaf).
//
// `retain` is deliberately NOT an option: Core's end-of-turn fate
// (src/engine/handRules.js endTurnCardFate, configured branch) never reads the
// `retain` keyword, so a Retain upgrade would show a keyword that does nothing.
import { mulberry32 } from '../engine/rng.js';
import { applyUpgradeSteps, firstPlainIndex, isPlainEffect, isPlainStatus, TAG_FAMILIES, TARGETING, UPGRADE_ELEMENTS, RANK_DOWN_TAG } from './cardUpgrade.js';
import { normalizeRange } from './combatRanges.js';
import { STACK_CAPS, rankedEffectsCapped } from './cardRank.js';
import { MULTI_HIT_SP_FLOOR } from '../content/actionCosts.js';

export { STACK_CAPS };
// Owner ask 2026-10-31: poise, a range / targeting / stance / school / element change and a rank-down join the
// pool. `range`..`rankDown` are all `tag` steps (cardUpgrade.js); they are separate options so a choice of
// several never offers the same thing twice.
const WEIGHTS = Object.freeze({ dmg: 30, blk: 25, stk: 20, addStatus: 8, cost: 10, hits: 5,
  poise: 12, range: 6, targeting: 6, maneuver: 5, school: 4, element: 6, rankDown: 3 });
const RESTRICTED_TYPES = new Set(['power', 'status', 'curse', 'consumable']);

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

const hitsOf = (effect) => (Number.isInteger(effect.hits) && effect.hits > 1 ? effect.hits : 1);
const totalOf = (effects, op) => {
  const index = firstPlainIndex(effects, op);
  return index < 0 ? 0 : effects[index].amount * hitsOf(effects[index]);
};

// Core 2 charges a multi-hit card at least max(hits - offset, minimum) SP (SPEC 4.3a, model/actionCosts.js multiHitFloorFor):
// offset 0, or 1 for a `finesse` card, or 2 for a Mana card. Mirrored here because this module must stay a leaf.
const hitFloor = (card, hits) => {
  if (!(hits > 1)) return 0;
  const rule = MULTI_HIT_SP_FLOOR;
  const finesse = [...(card.tags || []), ...(card.cardTags || []), ...(card.authoredTags || [])].includes('finesse');
  const offset = Math.max(rule.baseOffset, finesse ? rule.finesseOffset : 0, card.manaCost > 0 ? rule.manaOffset : 0);
  return Math.max(hits - offset, rule.minimum);
};
const currentHits = (effects) => effects.reduce((most, e) => (e.op === 'damage' ? Math.max(most, hitsOf(e)) : most), 1);

function options(base, current, applied, limits) {
  const type = base.type;
  const restricted = RESTRICTED_TYPES.has(type);
  const found = {};
  const spMin = Math.max(1, limits.minStaminaCost | 0);
  const actionMin = Math.max(1, limits.minActionCost | 0);

  // cost: once per card; SP never below 1, MP never below 1, cost tracks staminaCost.
  if (!applied.some((s) => s.k === 'cost')) {
    const pools = [];
    if (Number.isInteger(current.staminaCost) && current.staminaCost - 1 >= spMin && current.cost === current.staminaCost
      && current.cost - 1 >= actionMin
      // a multi-hit card pays at least its hit floor, so a cheaper printed SP would buy nothing
      && hitFloor(current, currentHits(current.effects || [])) <= current.staminaCost - 1) pools.push('sp');
    if (Number.isInteger(current.manaCost) && current.manaCost >= 2) pools.push('mp');
    if (pools.length) found.cost = { pools };
  }
  if (restricted) return found;

  const effects = current.effects || [];
  const baseEffects = base.effects || [];
  const dmgIndex = firstPlainIndex(effects, 'damage');
  if (dmgIndex >= 0 && effects[dmgIndex].target === 'enemy') {
    const baseTotal = totalOf(baseEffects, 'damage') || totalOf(effects, 'damage');
    const n = Math.max(2, Math.ceil(baseTotal * 0.15));
    const after = (effects[dmgIndex].amount + n) * hitsOf(effects[dmgIndex]);
    if (after - baseTotal <= baseTotal) found.dmg = { n };
  }
  const blkIndex = firstPlainIndex(effects, 'block');
  if (blkIndex >= 0) {
    const baseTotal = totalOf(baseEffects, 'block') || totalOf(effects, 'block');
    const n = Math.max(2, Math.ceil(baseTotal * 0.2));
    if (effects[blkIndex].amount + n - baseTotal <= baseTotal) found.blk = { n };
  }
  // apply raises the FIRST plain effect of a status, so only that one is a candidate. It is judged on the
  // FINAL face, rank applied: a status the rank already holds at its cap gains nothing from a step.
  const rank = limits.rank > 1 ? limits.rank : 1;
  const finalStacks = (card, status) => {
    const shown = rank > 1 ? { ...card, effects: rankedEffectsCapped(card, rank - 1) } : card;
    return (shown.effects || []).find((e) => isPlainStatus(e) && e.status === status)?.stacks;
  };
  const seenStatus = new Set();
  const stackable = effects.find((e) => {
    if (!isPlainStatus(e) || seenStatus.has(e.status)) return false;
    seenStatus.add(e.status);
    if (STACK_CAPS[e.status] === undefined || e.stacks + 1 > STACK_CAPS[e.status]) return false;
    const stepped = applyUpgradeSteps(base, [...applied, { k: 'stk', status: e.status, n: 1 }]);
    return finalStacks(stepped, e.status) > finalStacks(current, e.status);
  });
  if (stackable) found.stk = { status: stackable.status };

  if (!effects.some((e) => e.op === 'applyStatus') && dmgIndex >= 0 && effects[dmgIndex].target === 'enemy') {
    // The card's school: its damage school, else its `camp:` tag (kept unquoted so the
    // mechanics generator does not take this file for the tag's reader).
    const camp = ((base.tags || []).find((tag) => tag.startsWith('camp:')) || '').slice(5);
    const school = base.damageSchool === 'magic' || camp === 'spell' ? 'spell' : base.damageSchool === 'physical' || camp === 'physical' ? 'physical' : '';
    if (school === 'spell') found.addStatus = { statuses: ['burn', 'vulnerable'] };
    else if (school === 'physical') found.addStatus = { statuses: ['bleed', 'weak'] };
  }

  if (dmgIndex >= 0 && !applied.some((s) => s.k === 'hits') && !effects.some((e) => e.op === 'damage' && hitsOf(e) > 1)
    && effects[dmgIndex].target === 'enemy' && effects[dmgIndex].amount <= 8) {
    const baseTotal = totalOf(baseEffects, 'damage') || totalOf(effects, 'damage');
    const amount = effects[dmgIndex].amount;
    const per = Math.ceil(amount * 0.6);
    // The step must not raise what the card costs to play: its hit floor has to fit the SP it already pays.
    const sp = Number.isInteger(current.staminaCost) ? current.staminaCost : 0;
    const counts = [2, 3].filter((hits) => hits <= 3 && per * hits - baseTotal <= baseTotal && per * hits > amount && hitFloor(current, hits) <= sp);
    if (counts.length) found.hits = { per, counts };
  }
  addTagOptions(base, current, applied, found, dmgIndex);
  return found;
}

const tagsOf = (card) => card.cardTags ?? card.tags ?? [];
const familyValue = (tags, prefix) => tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || '';
const ATTACK_MANEUVERS = TAG_FAMILIES['maneuver:'].filter((m) => ['attack', 'smash', 'ranged'].some((x) => x === m));
// Mirrors upgradeBasic (cardUpgradeLimits.js, which imports this module): a cantrip, or a common non-spell.
const basicDef = (def) => {
  const tags = def.tags || [];
  return tags.includes(RANK_DOWN_TAG) || (def.rarity === 'common' && !tags.includes('source:spell') && !tags.includes('camp:spell'));
};

/** The identity-change options (poise, range, targeting, stance, school, element, rank-down) for a non-restricted card. */
function addTagOptions(base, current, applied, found, dmgIndex) {
  const effects = current.effects || [];
  const tags = tagsOf(current);
  const camp = familyValue(tags, 'camp:');
  const maneuver = familyValue(tags, 'maneuver:');
  const spell = camp === 'spell' || tags.includes('source:spell');
  const hitsEnemy = dmgIndex >= 0 && (effects[dmgIndex].target === 'enemy' || effects[dmgIndex].target === 'allEnemies');
  const attacking = hitsEnemy && (['attack', 'smash', 'sweep', 'ranged', 'counter'].includes(maneuver) || spell);
  const tagged = (predicate) => applied.some((s) => s.k === 'tag' && predicate(s));

  const poiseIndex = firstPlainIndex(effects, 'poiseDamage');
  if (poiseIndex >= 0) {
    const baseTotal = (base.effects || []).find((e) => isPlainEffect(e, 'poiseDamage'))?.amount || effects[poiseIndex].amount;
    const n = Math.max(1, Math.ceil(baseTotal * 0.2));
    if (effects[poiseIndex].amount + n - baseTotal <= baseTotal) found.poise = { n };
  }
  if (attacking) {
    const raw = familyValue(tags, 'range:') || normalizeRange(familyValue(tags, 'reach:')) || (maneuver === 'ranged' ? 'reach' : 'melee');
    const next = { melee: 'reach', reach: 'ranged' }[raw];
    if (next) found.range = { tag: `range:${next}` };
  }
  if (hitsEnemy && maneuver !== 'sweep' && !tagged((s) => s.retarget)) {
    const [SINGLE, AREA] = TARGETING;
    const area = familyValue(tags, 'targeting:') ? familyValue(tags, 'targeting:') === AREA : effects[dmgIndex].target === 'allEnemies';
    // Single-target hits harder (x1.25 up): it stays inside the same +100% guard a damage step keeps.
    const baseTotal = totalOf(base.effects || [], 'damage') || totalOf(effects, 'damage');
    const grown = Math.ceil(effects[dmgIndex].amount * 1.25) * hitsOf(effects[dmgIndex]);
    if (!area) found.targeting = { tag: `targeting:${AREA}`, retarget: AREA };
    else if (grown - baseTotal <= baseTotal) found.targeting = { tag: `targeting:${SINGLE}`, retarget: SINGLE };
  }
  if (hitsEnemy && !spell && ATTACK_MANEUVERS.includes(maneuver) && !tagged((t) => t.tag?.startsWith('maneuver:'))) {
    const sp = Number.isInteger(current.staminaCost) ? current.staminaCost : 0;
    const tags2 = ATTACK_MANEUVERS.filter((m) => m !== maneuver && (m !== 'smash' || sp >= 2));
    if (tags2.length) found.maneuver = { tags: tags2.map((m) => `maneuver:${m}`) };
  }
  if (hitsEnemy && camp === 'spell' && !tagged((t) => t.tag?.startsWith('school:'))) {
    const own = familyValue(tags, 'school:');
    const schools = TAG_FAMILIES['school:'].filter((school) => school !== own);
    if (schools.length) found.school = { tags: schools.map((school) => `school:${school}`) };
  }
  if (hitsEnemy && camp !== 'spell' && current.damageSchool === 'physical' && !tagged((s) => s.damageSchool)) found.element = { schools: UPGRADE_ELEMENTS };
  if (!basicDef(base) && !tags.includes(RANK_DOWN_TAG) && !tagged((s) => s.tag === RANK_DOWN_TAG)) found.rankDown = { tag: RANK_DOWN_TAG };
}

/**
 * rollUpgradeStep(baseDef, appliedSteps, stepIndex, rng, limits?) → the next (limits: minStaminaCost, minActionCost, rank)
 * stored step. `appliedSteps` are the steps the card already has; `rng` is
 * upgradeStepRng(run.seed, instanceId, stepIndex). Filters the options to the
 * ones the card is eligible for, then makes a weighted pick; if none is
 * eligible the card is fully upgraded and the result is null (no filler step).
 */
export function rollUpgradeStep(baseDef, appliedSteps, stepIndex, rng, limits = {}) {
  return rollUpgradeOptions(baseDef, appliedSteps, stepIndex, rng, limits, 1)[0] || null;
}

const stepOf = (kind, option, choice) => {
  const pickOf = (list) => list[Math.min(list.length - 1, Math.floor(choice * list.length))];
  switch (kind) {
    case 'dmg': return { k: 'dmg', n: option.n };
    case 'blk': return { k: 'blk', n: option.n };
    case 'stk': return { k: 'stk', status: option.status, n: 1 };
    case 'addStatus': return { k: 'addStatus', status: pickOf(option.statuses), stacks: 1 };
    case 'cost': return { k: 'cost', pool: pickOf(option.pools) };
    case 'poise': return { k: 'poise', n: option.n };
    case 'range': case 'rankDown': return { k: 'tag', tag: option.tag };
    case 'targeting': return { k: 'tag', tag: option.tag, retarget: option.retarget };
    case 'maneuver': case 'school': return { k: 'tag', tag: pickOf(option.tags) };
    case 'element': return { k: 'tag', damageSchool: pickOf(option.schools) };
    default: {
      // Three hits only on the rarer roll; two otherwise.
      const hits = option.counts.includes(3) && choice >= 0.7 ? 3 : option.counts[0];
      return { k: 'hits', hits, per: option.per };
    }
  }
};

/**
 * rollUpgradeOptions(baseDef, appliedSteps, stepIndex, rng, limits, count) → up to `count` DISTINCT steps (distinct
 * kinds of option, so never the same step twice) from the one per-step stream: each takes two draws (pick, then the
 * option's own choice), so the first option is exactly rollUpgradeStep's. Fewer than `count` come back when the card
 * has fewer eligible options; [] when it is fully upgraded.
 */
export function rollUpgradeOptions(baseDef, appliedSteps, stepIndex, rng, limits = {}, count = 1) {
  const applied = appliedSteps || [];
  const current = applied.length ? applyUpgradeSteps(baseDef, applied) : baseDef;
  const found = options(baseDef, current, applied, limits);
  const kinds = Object.keys(WEIGHTS).filter((kind) => found[kind]);
  const out = [];
  // Draw order is fixed (pick, then the kind's own choice) so a roll is a pure function of its stream.
  for (let n = 0; n < Math.max(1, count | 0); n += 1) {
    const pick = rng();
    const choice = rng();
    if (!kinds.length) break;
    let roll = pick * kinds.reduce((sum, kind) => sum + WEIGHTS[kind], 0);
    let kind = kinds[kinds.length - 1];
    for (const candidate of kinds) {
      roll -= WEIGHTS[candidate];
      if (roll < 0) { kind = candidate; break; }
    }
    out.push(stepOf(kind, found[kind], choice));
    kinds.splice(kinds.indexOf(kind), 1);
  }
  return out;
}
