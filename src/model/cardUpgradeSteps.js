// The Core card-upgrade step generator (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md).
// Pure and stateless: the roll is mulberry32(hash(run.seed, instanceId, stepIndex)),
// so a preview equals the commit and no named RNG stream moves. A leaf module:
// it imports only rng.js (a leaf) and cardUpgrade.js (a leaf).
//
// `retain` is deliberately NOT an option: Core's end-of-turn fate
// (src/engine/handRules.js endTurnCardFate, configured branch) never reads the
// `retain` keyword, so a Retain upgrade would show a keyword that does nothing.
import { mulberry32 } from './rng.js';
import { applyUpgradeSteps, MAX_CARD_UPGRADES, FlatSteps, firstPlainIndex, isPlainEffect, isPlainStatus, TAG_FAMILIES, TARGETING, UPGRADE_ELEMENTS, ELEMENT_IDENTITY, RANK_DOWN_TAG, RUN_ATTRIBUTE_STATS, hitFloor, currentHits, DrawbackSteps } from './cardUpgrade.js';
import { RANGES, normalizeRange } from './combatRanges.js';
import { STACK_CAPS, rankedEffectsCapped } from './cardRank.js';
import { fixCoreMechanics } from '../content/generated/fixCoreMechanics.js';

export { STACK_CAPS };
// Owner ask 2026-10-31: poise, a range / targeting / stance / school / element change and a rank-down join the
// pool. `range`..`rankDown` are all `tag` steps (cardUpgrade.js); they are separate options so a choice of
// several never offers the same thing twice.
const WEIGHTS = Object.freeze({ dmg: 30, blk: 25, stk: 20, addStatus: 8, cost: 10, hits: 5,
  poise: 12, range: 6, targeting: 6, maneuver: 5, school: 4, element: 6, rankDown: 3,
  // The effect menu (W25): one entry per `fx` step id (cardUpgrade.js FX_KINDS), keyed `fx:<id>`.
  'fx:block': 18, 'fx:draw': 14, 'fx:cycle': 8, 'fx:cull': 4, 'fx:copy': 5, 'fx:shuffle': 4, 'fx:retain': 10, 'fx:innate': 5,
  'fx:unexhaust': 8, 'fx:holdOne': 6, 'fx:boost': 8, 'fx:target': 7, 'fx:reaction': 8, 'fx:counter': 8,
  // Easing a drawback (playtest 2026-11-17, theme C): offered only on a card that has it, and weighted to come up.
  'fx:unethereal': 12, 'fx:steady': 12,
  // A run-long +1 INT / WIS, about a fifth of a normal step (W25-L); offered on spells only.
  attr: 2 });
// The roll's groups (owner, 2026-11-19; docs/balance/buff-drawbacks-proposal-2026-11-19.md section 6). A roll picks the group by
// the upgrade number, then a kind inside the group by WEIGHTS. `ease` lowers a drawback, `eff` (effectiveness / cost) makes the
// card's own numbers better, `new` adds an effect, `identity` reshapes what the card is (inside "new effect").
export const UPGRADE_GROUPS = Object.freeze(['ease', 'eff', 'new', 'identity']);
const GROUP_OF = Object.freeze({
  'fx:unexhaust': 'ease', 'fx:unethereal': 'ease', 'fx:steady': 'ease',
  dmg: 'eff', blk: 'eff', stk: 'eff', cost: 'eff', hits: 'eff', poise: 'eff', element: 'eff', rankDown: 'eff',
  range: 'identity', targeting: 'identity', maneuver: 'identity', school: 'identity',
});
/** The group an option kind belongs to; every `fx:` effect and `addStatus` / `attr` is a new effect. */
export const upgradeGroupOf = (kind) => GROUP_OF[kind] || 'new';
// Share of each group by upgrade number (upTo is inclusive). New effect and identity are listed apart: identity sits inside the
// brief's "new effect" total (25 / 40 / 50 / 65).
const GROUP_SHARES = Object.freeze([
  { upTo: 3, ease: 40, eff: 35, new: 20, identity: 5 },
  { upTo: 5, ease: 30, eff: 30, new: 30, identity: 10 },
  { upTo: 7, ease: 20, eff: 30, new: 35, identity: 15 },
  { upTo: MAX_CARD_UPGRADES, ease: 15, eff: 20, new: 45, identity: 20 },
]);
export const upgradeGroupShares = (upgradeNumber) => GROUP_SHARES.find((row) => upgradeNumber <= row.upTo) || GROUP_SHARES[GROUP_SHARES.length - 1];

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

/** Every option kind a rolled upgrade can be; a card's `upgradeMenu` names a subset of these (theme C, playtest 2026-11-17). */
export const UPGRADE_OPTION_KINDS = Object.freeze(Object.keys(WEIGHTS));
// A cantrip's own element status (Frost, Shocked, Venom, Regen...) may gain stacks up to this many (owner, 2026-11-14:
// cantrip upgrades add +1 stack); every other status keeps STACK_CAPS, or none.
const CANTRIP_STACK_CAP = 5;
// Venom stops at 3 stacks when a card plays (a fourth shows on the face and does nothing), so a cantrip may not be offered past it.
const ENGINE_STACK_CAPS = Object.freeze({ venom: 3 });
const stackCap = (status, card) => STACK_CAPS[status] ?? ENGINE_STACK_CAPS[status] ?? (tagsOf(card).includes(RANK_DOWN_TAG) ? CANTRIP_STACK_CAP : undefined);
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

// The largest amount from `plain` up to its rank-up scale (limits.scale, 1 for a blacksmith upgrade) that `ok`
// still allows, 0 when even the plain amount is refused. A rank-up bonus is bigger than a normal upgrade
// (owner, 2026-11-01), yet never past the guards a normal upgrade keeps.
const biggest = (plain, scale, ok) => {
  for (let n = Math.max(plain, Math.round(plain * (scale > 1 ? scale : 1))); n >= plain; n -= 1) if (ok(n)) return n;
  return 0;
};

function options(base, current, applied, limits) {
  const type = base.type;
  const scale = Number.isFinite(limits.scale) ? limits.scale : 1;
  const restricted = RESTRICTED_TYPES.has(type);
  const found = {};
  const spMin = Math.max(1, limits.minStaminaCost | 0);
  const actionMin = Math.max(1, limits.minActionCost | 0);

  // cost: once per card; SP never below 1, MP never below 1, cost tracks staminaCost.
  if (!applied.some((s) => s.k === 'cost')) {
    const pools = [];
    const by = {};
    if (Number.isInteger(current.staminaCost) && current.cost === current.staminaCost) {
      // a multi-hit card pays at least its hit floor, so a cheaper printed SP would buy nothing
      const floor = hitFloor(current, currentHits(current.effects || []));
      by.sp = biggest(1, scale, (n) => current.staminaCost - n >= spMin && current.cost - n >= actionMin && floor <= current.staminaCost - n);
      if (by.sp) pools.push('sp');
    }
    // A cantrip or basic costs no Mana (owner, 2026-11-01), so a Mana cut is pointless on one, or on a copy that becomes one.
    if (Number.isInteger(current.manaCost) && !basicDef(base) && !tagsOf(current).includes(RANK_DOWN_TAG)) {
      by.mp = biggest(1, scale, (n) => current.manaCost - n >= 1);
      if (by.mp) pools.push('mp');
    }
    if (pools.length) found.cost = { pools, by };
  }
  if (restricted) return found;

  const effects = current.effects || [];
  const baseEffects = base.effects || [];
  // prepareTacticalCard turns a counter card's damage and poise into a return payload aimed at the one attacker it
  // answers (the same `maneuver` test it makes), and Core 2 replaces that payload's HP and Poise with the fixed
  // return: a range, area, damage, hits or poise step could never be honoured, so none of them is offered.
  const counterReturn = familyValue(tagsOf(current), 'maneuver:') === 'counter';
  const dmgIndex = firstPlainIndex(effects, 'damage');
  if (!counterReturn && dmgIndex >= 0 && effects[dmgIndex].target === 'enemy') {
    const baseTotal = totalOf(baseEffects, 'damage') || totalOf(effects, 'damage');
    const n = biggest(Math.max(2, Math.ceil(baseTotal * 0.15)), scale, (k) => (effects[dmgIndex].amount + k) * hitsOf(effects[dmgIndex]) - baseTotal <= baseTotal);
    if (n) found.dmg = { n };
  }
  const blkIndex = firstPlainIndex(effects, 'block');
  // Only a Block the card was printed with grows: one an `fx` step added has no printed total to cap against.
  if (blkIndex >= 0 && totalOf(baseEffects, 'block') > 0) {
    const baseTotal = totalOf(baseEffects, 'block');
    const n = biggest(Math.max(2, Math.ceil(baseTotal * 0.2)), scale, (k) => effects[blkIndex].amount + k - baseTotal <= baseTotal);
    if (n) found.blk = { n };
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
    const cap = stackCap(e.status, current);
    if (cap === undefined || e.stacks + 1 > cap) return false;
    const stepped = applyUpgradeSteps(base, [...applied, { k: 'stk', status: e.status, n: 1 }]);
    return finalStacks(stepped, e.status) > finalStacks(current, e.status);
  });
  if (stackable) {
    const n = biggest(1, scale, (k) => stackable.stacks + k <= stackCap(stackable.status, current)
      && finalStacks(applyUpgradeSteps(base, [...applied, { k: 'stk', status: stackable.status, n: k }]), stackable.status) > finalStacks(current, stackable.status));
    found.stk = { status: stackable.status, n };
  }

  if (!effects.some((e) => e.op === 'applyStatus') && dmgIndex >= 0 && effects[dmgIndex].target === 'enemy') {
    // The card's school: its damage school, else its `camp:` tag (kept unquoted so the
    // mechanics generator does not take this file for the tag's reader).
    const camp = ((base.tags || []).find((tag) => tag.startsWith('camp:')) || '').slice(5);
    const school = base.damageSchool === 'magic' || camp === 'spell' ? 'spell' : base.damageSchool === 'physical' || camp === 'physical' ? 'physical' : '';
    if (school === 'spell') found.addStatus = { statuses: ['burn', 'vulnerable'] };
    else if (school === 'physical') found.addStatus = { statuses: ['bleed', 'weak'] };
  }

  if (!counterReturn && dmgIndex >= 0 && !applied.some((s) => s.k === 'hits') && !effects.some((e) => e.op === 'damage' && hitsOf(e) > 1)
    && effects[dmgIndex].target === 'enemy' && effects[dmgIndex].amount <= 8) {
    const baseTotal = totalOf(baseEffects, 'damage') || totalOf(effects, 'damage');
    const amount = effects[dmgIndex].amount;
    const per = Math.ceil(amount * 0.6);
    // The step must not raise what the card costs to play: its hit floor has to fit the SP it already pays.
    const sp = Number.isInteger(current.staminaCost) ? current.staminaCost : 0;
    const counts = [2, 3].filter((hits) => hits <= 3 && per * hits - baseTotal <= baseTotal && per * hits > amount && hitFloor(current, hits) <= sp);
    if (counts.length) found.hits = { per, counts };
  }
  addTagOptions(base, current, applied, found, dmgIndex, limits, counterReturn);
  addMenuOptions(base, current, found, dmgIndex, counterReturn);
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
function addMenuOptions(base, current, found, dmgIndex, counterReturn) {
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
  if (!hasBlock && !counterReturn && maneuver !== 'counter') set('block', { n: sp >= 2 ? 6 : 4 });
  const draw = effects.filter((e) => isPlainEffect(e, 'draw')).reduce((sum, e) => sum + e.amount, 0);
  if (draw < 3) set('draw', { n: 1 });
  if (!hasOp(effects, 'discard') && !hasOp(effects, 'draw')) set('cycle', { n: 1 });
  if (!hasOp(effects, 'exhaust') && !keywords.includes('exhaust')) set('cull');
  if (!hasOp(effects, 'addCard') && !keywords.includes('exhaust')) set('copy');
  if (!hasOp(effects, 'shuffleDiscardIntoDraw')) set('shuffle');
  if (!keywords.includes('retain') && !keywords.includes('ethereal')) set('retain');
  if (!keywords.includes('innate')) set('innate');
  if (keywords.includes('exhaust')) set('unexhaust');
  if (keywords.includes('ethereal')) set('unethereal');
  if (risingCost(current)) set('steady');
  if (!hasOp(effects, 'retain')) set('holdOne');
  const boosted = (stat) => effects.some((e) => (e.op === 'applyStatus' && e.thisTurn === true && e.status === stat) || (e.op === 'changeAttribute' && e.attribute === stat));
  // A boost is a live attribute change (engine/liveStats.js): STR for an attack, DEX for a block, INT for a spell's damage, WIS for a
  // spell's defence. stepOf picks the duration: this turn (+2) or the rest of the fight (+1, stacks per play).
  const hasWard = hasOp(effects, 'gainWard') || hasOp(effects, 'gainBarrier');
  if (!spell && dmgIndex >= 0 && !boosted('strength')) set('boost', { stat: 'strength', n: 2 });
  else if (!spell && hasBlock && !boosted('dexterity')) set('boost', { stat: 'dexterity', n: 2 });
  else if (spell && dmgIndex >= 0 && !boosted('intelligence')) set('boost', { stat: 'intelligence', n: 2 });
  else if (spell && (hasBlock || hasWard) && !boosted('wisdom')) set('boost', { stat: 'wisdom', n: 2 });
  if (!counterReturn && dmgIndex >= 0 && effects[dmgIndex].target === 'enemy' && attack
    && !effects.some((e) => e.op === 'damage' && (e.target === 'randomEnemy' || e.target === 'otherEnemy'))) set('target', { other: true });
  // Owner, 2026-11-14: Reaction is open to every stance (attack, smash, sweep, spells, skills). A card that already reacts (Defense, Counter,
  // or `trait:reaction`) and an X-cost card are left out; Powers never reach this menu.
  if (!tags.includes('trait:reaction') && !['defend', 'counter'].includes(maneuver) && !tags.includes('maneuver:defend') && !tags.includes('maneuver:counter') && current.cost !== 'X' && base.cost !== 'X') set('reaction');
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
function addTagOptions(base, current, applied, found, dmgIndex, limits = {}, counterReturn = false) {
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
    const n = biggest(Math.max(1, Math.ceil(baseTotal * 0.2)), limits.scale, (k) => effects[poiseIndex].amount + k - baseTotal <= baseTotal);
    if (n) found.poise = { n };
  }
  if (attacking && !counterReturn) {
    const raw = familyValue(tags, 'range:') || normalizeRange(familyValue(tags, 'reach:')) || (maneuver === 'ranged' ? 'reach' : 'melee');
    const next = { melee: 'reach', reach: 'melee' }[raw];
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
    if (!area) found.targeting = { tag: `targeting:${AREA}`, retarget: AREA };
    else if (grown - baseTotal <= baseTotal) found.targeting = { tag: `targeting:${SINGLE}`, retarget: SINGLE };
  }
  if (hitsEnemy && !spell && ATTACK_MANEUVERS.includes(maneuver) && !tagged((t) => t.tag?.startsWith('maneuver:'))) {
    const sp = Number.isInteger(current.staminaCost) ? current.staminaCost : 0;
    const tags2 = ATTACK_MANEUVERS.filter((m) => m !== maneuver && (m !== 'smash' || sp >= 2));
    if (tags2.length) found.maneuver = { tags: tags2.map((m) => `maneuver:${m}`) };
  }
  // No `school` swap option: a school change alone changes no play (the riders that read it belong to the elements work),
  // and `add elemental damage` (step 2) is how a card gains an element.
  if (hitsEnemy && !counterReturn && camp !== 'spell' && current.damageSchool === 'physical' && !tagged((s) => s.damageSchool)) found.element = { schools: UPGRADE_ELEMENTS, exposure: limits.exposure };
  // a card that pays no Stamina (the 0 SP / 0 MP zero-cost cards) would become a 0-cost cantrip, which Core forbids (SPEC, zero-cost cards)
  // ...and only a card that pays Mana: on a 0-Mana card the step would change a tag and nothing else.
  if (!basicDef(base) && !tags.includes(RANK_DOWN_TAG) && current.staminaCost !== 0 && current.manaCost > 0
    // zeroing Mana drops the multi-hit Stamina offset: never offer it when the floor would then exceed the printed SP
    && hitFloor({ ...current, manaCost: 0 }, currentHits(current.effects || [])) <= (current.staminaCost || 0) && !tagged((s) => s.tag === RANK_DOWN_TAG)) found.rankDown = { tag: RANK_DOWN_TAG };
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
  // The boost's duration is its own choice: usually this turn (+n), sometimes the rest of the fight (+1, stacking per play).
  if (kind === 'fx:boost') return choice >= 0.65 ? { k: 'fx', fx: 'boost', stat: option.stat, n: 1, until: 'fight' } : { k: 'fx', fx: 'boost', stat: option.stat, n: option.n, until: 'turn' };
  if (kind.startsWith('fx:')) return { k: 'fx', ...option };
  switch (kind) {
    case 'dmg': return { k: 'dmg', n: option.n };
    case 'blk': return { k: 'blk', n: option.n };
    case 'stk': return { k: 'stk', status: option.status, n: option.n || 1 };
    case 'addStatus': return { k: 'addStatus', status: pickOf(option.statuses), stacks: 1 };
    case 'cost': {
      // A bigger cut (a rank-up bonus) names its amount; the plain -1 stays the bare step every save already holds.
      const pool = pickOf(option.pools);
      return option.by?.[pool] > 1 ? { k: 'cost', pool, n: option.by[pool] } : { k: 'cost', pool };
    }
    case 'poise': return { k: 'poise', n: option.n };
    case 'attr': return { k: 'attr', stat: pickOf(option.stats), n: 1 };
    case 'range': case 'rankDown': return { k: 'tag', tag: option.tag };
    case 'targeting': return { k: 'tag', tag: option.tag, retarget: option.retarget };
    case 'maneuver': case 'school': return { k: 'tag', tag: pickOf(option.tags) };
    case 'element': {
      const damageSchool = pickOf(option.schools);
      const identity = ELEMENT_IDENTITY[damageSchool];
      return { k: 'tag', tag: `school:${identity.school}`, damage: identity.damage, damageSchool, magicShare: 1,
        ...(Number.isInteger(option.exposure) && option.exposure > 0 ? { exposureBuildupPerHit: option.exposure } : {}) };
    }
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
  // A combo is two effects in one slot: the checks below (once per card, already tagged) look through it.
  const applied = FlatSteps(appliedSteps);
  const current = applied.length ? applyUpgradeSteps(baseDef, applied) : baseDef;
  const found = options(baseDef, current, applied, limits);
  // An authored `upgradeMenu` limits the rolled options to the kinds it names (Star Seer's Ethereal: Reaction, drop Ethereal or more Block).
  // A ranked ability card's grade table owns its numbers, so it applies only drawback-removal steps (cardUpgrade.js DrawbackSteps):
  // it is offered only those, so the offer equals the effect (review of #2819).
  const menu = Array.isArray(baseDef.upgradeMenu) ? baseDef.upgradeMenu
    : Array.isArray(baseDef.gradeProfiles) ? DrawbackSteps.map((fx) => `fx:${fx}`) : null;
  const kinds = Object.keys(WEIGHTS).filter((kind) => found[kind] && (!menu || menu.includes(kind)));
  const out = [];
  const shares = upgradeGroupShares(stepIndex + 1);
  // Draw order is fixed (pick, then the kind's own choice) so a roll is a pure function of its stream. `pick` is split by
  // rescaling: first it picks the group, the rest of it picks the kind inside the group.
  for (let n = 0; n < Math.max(1, count | 0); n += 1) {
    const pick = rng();
    const choice = rng();
    if (!kinds.length) break;
    // A group with no eligible kind gives its share to the others pro rata (they are renormalised by the pick).
    const groups = UPGRADE_GROUPS.filter((group) => kinds.some((kind) => upgradeGroupOf(kind) === group)).map((group) => [group, shares[group]]);
    const { key: group, rest } = pickByWeight(groups, pick);
    const inGroup = kinds.filter((kind) => upgradeGroupOf(kind) === group);
    const { key: kind } = pickByWeight(inGroup.map((candidate) => [candidate, WEIGHTS[candidate]]), rest);
    out.push(stepOf(kind, found[kind], choice));
    kinds.splice(kinds.indexOf(kind), 1);
  }
  return out;
}
