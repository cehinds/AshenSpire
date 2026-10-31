import { RANGES } from './combatRanges.js';

// A card definition with its authored upgrade merged over the base. A leaf
// module: gameProfile.js and registries.js both use it, and importing
// registries.js from gameProfile.js would reorder the bundle's load cycle.
export function upgradedDefinition(base) {
  const up = base.upgrade || {};
  return {
    ...base,
    ...up,
    name: up.name != null ? up.name : `${base.name}+`,
    keywords: up.keywords != null ? up.keywords : base.keywords || [],
    effects: up.effects != null ? up.effects : base.effects,
    textTemplate: up.textTemplate != null ? up.textTemplate : base.textTemplate,
    upgraded: true,
  };
}

// ---- Core card upgrades (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md) ----
//
// An instance keeps `upgraded: boolean` ("at least one upgrade") and may add
// `upgradeSteps: Step[]`. Steps are stored, never re-derived, so a later change
// to the step generator cannot change a card the player owns. An old save with
// `upgraded: true` and no list reads as [{ k: 'authored' }].
//
// Step kinds (the generator in cardUpgradeSteps.js writes them):
//   authored                       the card's own `upgrade` block (step 1 only)
//   dmg { n }                      +n on the first plain damage effect
//   blk { n }                      +n on the first plain block effect
//   stk { status, n }              +n stacks on that status's existing applyStatus
//   addStatus { status, stacks }   a new applyStatus on the enemy
//   cost { pool: 'sp' | 'mp' }     -1 stamina (and action) cost, or -1 mana cost
//   hits { hits, per }             the first damage effect becomes `per` x `hits`
//   poise { n }                    +n on the first plain poiseDamage effect
//   tag { tag?, retarget?, damageSchool? }   a new identity tag (it replaces any tag of the same `range:`,
//                                  `targeting:`, `maneuver:` or `school:` family; `rank.cantrip` just adds),
//                                  `retarget` 'area' | 'single' moves the first damage effect between enemy
//                                  and allEnemies (amount x0.75 up, or x1.25 up), `damageSchool` sets the
//                                  card's damage school (a magical property)
export const UPGRADE_STEP_KINDS = Object.freeze(['authored', 'dmg', 'blk', 'stk', 'addStatus', 'cost', 'hits', 'poise', 'tag']);
// The tag vocabulary a `tag` step may write: ranges from combatRanges.js, the rest mirrors combatCardProfile.js
// (tests/core-card-upgrade-choices-tags.test.mjs pins the mirror to the exported sets).
export const TAG_FAMILIES = Object.freeze({
  'range:': RANGES,
  'targeting:': Object.freeze(['single', 'area']),
  'maneuver:': Object.freeze(['attack', 'defend', 'counter', 'sweep', 'ranged', 'smash', 'casting']),
  'school:': Object.freeze(['frost', 'fire', 'lightning', 'force', 'alteration', 'illusion', 'divine', 'decay', 'earth']),
});
export const UPGRADE_ELEMENTS = Object.freeze(['magic', 'arcane', 'holy', 'fire']);
export const RANK_DOWN_TAG = 'rank.cantrip';
export const MAX_CARD_UPGRADES = 10;

const AUTHORED_ONLY = Object.freeze([Object.freeze({ k: 'authored' })]);

/** The steps an instance carries: its list, or [authored] for an old `upgraded` flag. */
export function upgradeStepsOf(instance) {
  if (!instance || typeof instance !== 'object') return [];
  // An explicit `upgraded: false` wins: a site that resets the flag (Smithing's equipment-bound basics)
  // and spreads an old instance cannot leave a stale step list playing as an upgrade.
  if (instance.upgraded === false) return [];
  if (Array.isArray(instance.upgradeSteps) && instance.upgradeSteps.length) return instance.upgradeSteps;
  return instance.upgraded ? AUTHORED_ONLY : [];
}

/** How many upgrades the instance has. */
export function upgradeCount(instance) {
  return upgradeStepsOf(instance).length;
}

/** A short cache-key part: 0 and 1 (authored only) match the old `upgraded ? 1 : 0`. */
export function upgradeSignature(instance) {
  const steps = upgradeStepsOf(instance);
  if (!steps.length) return '0';
  if (steps.length === 1 && steps[0].k === 'authored') return '1';
  return steps.map((s) => Object.entries(s).map(([key, value]) => `${key}=${value}`).join(',')).join(';');
}

const CONDITION_KEYS = ['when', 'if', 'condition', 'unless', 'repeat'];
/** An effect with a plain numeric `amount` and no condition: the ones a step may grow. */
export function isPlainEffect(effect, op) {
  return !!effect && effect.op === op && Number.isFinite(effect.amount) && !CONDITION_KEYS.some((key) => key in effect);
}
/** An applyStatus with a plain numeric `stacks` and no condition. */
export function isPlainStatus(effect) {
  return !!effect && effect.op === 'applyStatus' && Number.isFinite(effect.stacks) && !CONDITION_KEYS.some((key) => key in effect);
}
export function firstPlainIndex(effects, op) {
  return (effects || []).findIndex((effect) => isPlainEffect(effect, op));
}

function applyStep(card, step) {
  const effects = (card.effects || []).map((effect) => ({ ...effect }));
  let out = { ...card, effects };
  switch (step.k) {
    case 'dmg':
    case 'blk': {
      const index = firstPlainIndex(effects, step.k === 'dmg' ? 'damage' : 'block');
      if (index >= 0) effects[index].amount += step.n;
      break;
    }
    case 'stk': {
      const effect = effects.find((e) => isPlainStatus(e) && e.status === step.status);
      if (effect) effect.stacks += step.n;
      break;
    }
    case 'addStatus':
      effects.push({ op: 'applyStatus', target: 'enemy', status: step.status, stacks: step.stacks });
      break;
    case 'cost':
      if (step.pool === 'mp') out.manaCost = (card.manaCost || 0) - 1;
      else { out.staminaCost = (card.staminaCost || 0) - 1; out.cost = (card.cost ?? 0) - 1; }
      break;
    case 'hits': {
      const index = firstPlainIndex(effects, 'damage');
      if (index >= 0) {
        effects[index].amount = step.per;
        effects[index].hits = step.hits;
        const template = card.textTemplate;
        if (typeof template === 'string' && template.includes('{damage} damage') && !template.includes('{hits}')) {
          out.textTemplate = template.replace('{damage} damage', '{damage} damage {hits} times');
        }
      }
      break;
    }
    case 'poise': {
      const index = firstPlainIndex(effects, 'poiseDamage');
      if (index >= 0) effects[index].amount += step.n;
      break;
    }
    case 'tag': {
      if (step.tag) {
        const family = Object.keys(TAG_FAMILIES).find((prefix) => step.tag.startsWith(prefix));
        const keep = (tag) => tag !== step.tag && !(family && (tag.startsWith(family) || (family === 'range:' && tag.startsWith('reach:'))));
        const keys = ['tags', 'cardTags'].filter((key) => Array.isArray(card[key]));
        for (const key of keys.length ? keys : ['tags']) out[key] = [...(card[key] || []).filter(keep), step.tag];
      }
      if (step.retarget) {
        const index = effects.findIndex((e) => isPlainEffect(e, 'damage') && (e.target === 'enemy' || e.target === 'allEnemies'));
        if (index >= 0) {
          const area = step.retarget === 'area';
          effects[index].target = area ? 'allEnemies' : 'enemy';
          effects[index].amount = Math.max(1, Math.ceil(effects[index].amount * (area ? 0.75 : 1.25)));
        }
      }
      if (step.damageSchool) out.damageSchool = step.damageSchool;
      break;
    }
    default:
      throw new Error(`Unknown card upgrade step '${step.k}'`);
  }
  return out;
}

/**
 * applyUpgradeSteps(base, steps) → the card face after those steps. [] returns
 * `base` untouched. Step 1 `authored` merges the card's own upgrade block (the
 * old behaviour, name included); a rolled first step starts from the base.
 * One upgrade is named `Name+` (or the authored name); N >= 2 is `Name+N`.
 */
export function applyUpgradeSteps(base, steps) {
  if (!Array.isArray(steps) || !steps.length) return base;
  let card = steps[0].k === 'authored'
    ? upgradedDefinition(base)
    : { ...base, name: `${base.name}+`, keywords: base.keywords || [], upgraded: true };
  for (let i = steps[0].k === 'authored' ? 1 : 0; i < steps.length; i += 1) {
    if (steps[i].k === 'authored') throw new Error('An authored upgrade step must be the first step');
    card = applyStep(card, steps[i]);
  }
  if (steps.length >= 2) card.name = `${base.name}+${steps.length}`;
  return card;
}

const isCount = (value, max = 99) => Number.isInteger(value) && value >= 1 && value <= max;
/** Problems with an instance's optional `upgradeSteps` (empty when sound or absent). */
export function upgradeStepsProblems(instance, path) {
  const steps = instance && instance.upgradeSteps;
  if (steps === undefined) return [];
  if (!Array.isArray(steps)) return [`${path}.upgradeSteps must be an array when present`];
  const problems = [];
  if (steps.length > MAX_CARD_UPGRADES) problems.push(`${path}.upgradeSteps holds at most ${MAX_CARD_UPGRADES} steps`);
  if (steps.length && instance.upgraded !== true) problems.push(`${path}.upgradeSteps requires upgraded: true`);
  steps.forEach((step, i) => {
    const at = `${path}.upgradeSteps[${i}]`;
    if (!step || typeof step !== 'object' || Array.isArray(step) || !UPGRADE_STEP_KINDS.includes(step.k)) {
      problems.push(`${at} must be a known step kind (${UPGRADE_STEP_KINDS.join(', ')})`);
      return;
    }
    if (step.k === 'authored' && i !== 0) problems.push(`${at}: an authored step may only be the first step`);
    const bad = (field) => problems.push(`${at}.${field} is not valid for a '${step.k}' step`);
    if (['dmg', 'blk', 'stk', 'poise'].includes(step.k) && !isCount(step.n)) bad('n');
    if (['stk', 'addStatus'].includes(step.k) && !(typeof step.status === 'string' && step.status)) bad('status');
    if (step.k === 'addStatus' && !isCount(step.stacks)) bad('stacks');
    if (step.k === 'cost' && step.pool !== 'sp' && step.pool !== 'mp') bad('pool');
    if (step.k === 'hits' && !(isCount(step.hits, 3) && step.hits >= 2)) bad('hits');
    if (step.k === 'hits' && !isCount(step.per)) bad('per');
    if (step.k === 'tag') {
      if (step.tag === undefined && step.retarget === undefined && step.damageSchool === undefined) bad('tag');
      if (step.tag !== undefined && step.tag !== RANK_DOWN_TAG) {
        const family = typeof step.tag === 'string' ? Object.keys(TAG_FAMILIES).find((prefix) => step.tag.startsWith(prefix)) : null;
        if (!family || !TAG_FAMILIES[family].includes(step.tag.slice(family.length))) bad('tag');
      }
      if (step.retarget !== undefined && step.retarget !== 'area' && step.retarget !== 'single') bad('retarget');
      if (step.damageSchool !== undefined && !UPGRADE_ELEMENTS.includes(step.damageSchool)) bad('damageSchool');
    }
  });
  return problems;
}
