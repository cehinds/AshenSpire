import { rangePolicyProblems } from './combatEngagement.js';
// Browser-safe rules adapter. Authored JSON is compiled by content-build; no
// combat state, RNG or rounding is owned by this module.
import { fixCoreMechanics as defaults } from '../content/generated/fixCoreMechanics.js';
import { fixCoreProtection } from '../content/generated/fixCoreProtection.js';
import { compileBindings, evaluateModifiers, queryBinding, parameterDefaults } from './mechanicsKernel.js';
import { tFull } from './strings.js';
const mechanics = new Map(fixCoreProtection);
const behaviorTags = new Set(fixCoreProtection.map(([, row]) => row.manifest.tag));

const families = ['stance','accuracy','perception','statuses','actionCosts'];
export function fixCoreModuleParameters(rules = defaults) {
  return { ...rules.protectionParameters, ...Object.fromEntries(families.map(id => [`combat.${id}`,
    id === 'actionCosts' ? {enemyHealBlockCost:rules.enemyHealBlockCost} : rules[id]])) };
}
// Owner, 2026-10-18: Ward code stays; `ward.enabled: false` in fixCoreMechanics.json switches it off. Missing = on.
// Owner, 2026-10-18 (D13/D4, ruling 20:09): Poise loses what it absorbed (the damage it prevented) plus any extra Poise damage the hit carries;
// a Poise break puts the owner in the Staggered stance (-staminaLoss SP, +vulnerableStacks Vulnerable that only
// extends duration). Missing blocks (saves from before this ruling) fall back to these defaults.
export const FIXCORE_POISE_DEFAULTS = Object.freeze({ drain: 'prevented' });
export const FIXCORE_STAGGERED_DEFAULTS = Object.freeze({ stance: true, staminaLoss: 1, vulnerableStacks: 1, extendOnly: true });
// Owner, 2026-10-19: Counter return = floor(returnFraction x incoming damage), Poise = floor(poiseFraction x return); with advantage
// the return gains floor(advantageIncomingFraction x incoming), Poise uses advantagePoiseFraction and the owner gains
// floor(advantageBlockFraction x incoming) Block. Enemy-turn reactions in an already matching stance cost handCostDiscount less SP (floor 0).
export const FIXCORE_COUNTER_DEFAULTS = Object.freeze({ returnFraction: 0.5, poiseFraction: 0.2, advantageIncomingFraction: 0.25, advantagePoiseFraction: 0.5, advantageBlockFraction: 0.25 });
export const FIXCORE_REACTION_DEFAULTS = Object.freeze({ handCostDiscount: 1 });
// Owner, 2026-11-15 (Wave 2 batch 5): Counter acts like Evade. `stackSource: "card"` switches a fight to it: a Counter card grants stacksByCard[id]
// (else stacksPerCard) stacks, +stacksUpgradeBonus when upgraded, each grant clamped to 1..stacksMax; a covered landed hit returns
// floor(incoming x returnPerStack x stacks held) + the card's base damage (+ floor(advantageShare x incoming)) and consumes consumePerHit stacks;
// decayPerTurn stacks fade at the owner's turn start. Stacks held have no cap. A rules object without `stackSource` (a fight saved earlier) keeps
// the Block-as-stacks rule, mechanics.counter.stackFraction and decayPerTurn. Logic: src/engine/counterRule.js, guardStacks.js.
// Owner, 2026-11-17 (theme B): `armedWhileStacks: true` keeps an armed Counter through its owner's turn start while Counter stacks remain (the stacks
// follow the normal decay rule, so the Counter lasts as long as they do); `enemyBadgeStacks` is the Counter badge an enemy Counter move shows, which
// fades by decayPerTurn at the enemy's turn start and loses 1 each time the Counter is used. A fight saved without a key keeps the earlier rule.
const COUNTER_STACK_KEYS = Object.freeze(['stackSource', 'returnPerStack', 'consumePerHit', 'decayPerTurn', 'decayClock', 'advantageShare', 'stacksPerCard', 'stacksUpgradeBonus', 'stacksMax', 'stacksByCard', 'armedWhileStacks', 'enemyBadgeStacks']);
/** The Counter-stack rules a fight plays under (the `counter` block with `stackSource: "card"`), or null for the Block-as-stacks rule of an earlier fight. */
export const FixCoreCounterStacks = ctx => fixCoreEnabled(ctx) && rawRules(ctx).counter?.stackSource === 'card' ? rawRules(ctx).counter : null;
/** When Counter stacks fade (owner 2026-11-18): "ownerTurnStart", the start of the holder's own turn, never the end of it. A fight saved without the key fades them at the same clock. */
export const CounterDecayClock = ctx => FixCoreCounterStacks(ctx)?.decayClock ?? 'ownerTurnStart';
/** True when an armed Counter survives its owner's turn start while Counter stacks remain (theme B, 2026-11-17). */
export const CounterArmedWhileStacks = ctx => FixCoreCounterStacks(ctx)?.armedWhileStacks === true;
/** The Counter badge stacks an enemy Counter move grants (theme B, 2026-11-17); 0 for a fight saved without the key. */
export const EnemyCounterBadgeStacks = ctx => Math.max(0, FixCoreCounterStacks(ctx)?.enemyBadgeStacks | 0);
/** The Counter stacks one play of `cardId` grants under `rules` (a `counter` block with stackSource "card"): its table entry or stacksPerCard, +upgrade bonus, clamped to 1..stacksMax; 0 for another rule. */
export function CounterStacksForCard(rules, cardId, upgraded = false) {
  if (rules?.stackSource !== 'card') return 0;
  const base = Number.isInteger(rules.stacksByCard?.[cardId]) ? rules.stacksByCard[cardId] : rules.stacksPerCard;
  return Math.max(1, Math.min(rules.stacksMax, base + (upgraded ? Math.max(0, rules.stacksUpgradeBonus | 0) : 0)));
}
function validateCounterStacks(row) {
  if (!row || row.stackSource === undefined) return;
  const whole = value => Number.isInteger(value) && value >= 0;
  if (row.stackSource !== 'card' || !(Number.isFinite(row.returnPerStack) && row.returnPerStack >= 0) || !whole(row.consumePerHit) || !whole(row.decayPerTurn)
    || !(Number.isFinite(row.advantageShare) && row.advantageShare >= 0) || !Number.isInteger(row.stacksMax) || row.stacksMax < 1 || !whole(row.stacksUpgradeBonus)
    || !Number.isInteger(row.stacksPerCard) || row.stacksPerCard < 1 || row.stacksPerCard > row.stacksMax
    || (row.stacksByCard !== undefined && (typeof row.stacksByCard !== 'object' || row.stacksByCard === null
      || Object.values(row.stacksByCard).some(value => !Number.isInteger(value) || value < 1 || value > row.stacksMax)))
    || (row.decayClock !== undefined && row.decayClock !== 'ownerTurnStart')
    || (row.armedWhileStacks !== undefined && typeof row.armedWhileStacks !== 'boolean')
    || (row.enemyBadgeStacks !== undefined && !whole(row.enemyBadgeStacks))) {
    throw new Error('FixCore counter stacks require stackSource "card", returnPerStack, advantageShare, whole consumePerHit, decayPerTurn, stacksUpgradeBonus, stacksMax >= 1, stacksPerCard and stacksByCard values within 1..stacksMax, decayClock "ownerTurnStart", boolean armedWhileStacks, whole enemyBadgeStacks');
  }
}
export const fixCoreCounterRules = rules => ({ ...FIXCORE_COUNTER_DEFAULTS, ...(rules?.counter || {}) });
export const fixCoreReactionRules = rules => ({ ...FIXCORE_REACTION_DEFAULTS, ...(rules?.reaction || {}) });
export const fixCorePoiseRules = rules => ({ ...FIXCORE_POISE_DEFAULTS, ...(rules?.poise || {}) });
export const fixCoreStaggeredRules = rules => ({ ...FIXCORE_STAGGERED_DEFAULTS, ...(rules?.staggered || {}) });
// Owner, 2026-11-14 (Wave 3, "a Poise break is the payoff"): `poise.breakRule: "broken"` turns a Poise break into Broken: the owner
// loses its next action (an enemy's next planned move, the player 1 Stamina next turn), takes `brokenDamageMultiplier` x damage until
// the end of that turn, then its Poise refills to full. A rules object without the key (a fight saved before this ruling) keeps the
// Staggered stance above exactly.
export const FIXCORE_BROKEN_DAMAGE_MULTIPLIER = 1.5;
/** The Broken rule of a fight's Core rules, or null when the fight keeps the Staggered stance. */
export function FixCoreBrokenRules(ctx) {
  if (!fixCoreEnabled(ctx)) return null;
  const poise = rawRules(ctx).poise;
  // Owner, 2026-11-18: a break also applies `breakStatusStacks` stacks each of Staggered, Vulnerable, Weak and Frail until the owner's next turn starts (0 or absent: none).
  return poise?.breakRule === 'broken' ? { damageMultiplier: poise.brokenDamageMultiplier ?? FIXCORE_BROKEN_DAMAGE_MULTIPLIER, statusStacks: poise.breakStatusStacks ?? 0 } : null;
}
// Owner, 2026-10-19: a Smash against a defensive stance deals damageMultiplier x its normal damage plus blockFraction of the target's Block,
// and costs the target's Poise poiseFraction of that total (instead of the 25% Poise absorption). Missing blocks keep these defaults.
export const FIXCORE_SMASH_VS_DEFENSIVE_DEFAULTS = Object.freeze({ damageMultiplier: 1.25, blockFraction: 0.25, poiseFraction: 0.5 });
export const fixCoreSmashVsDefensiveRules = rules => ({ ...FIXCORE_SMASH_VS_DEFENSIVE_DEFAULTS, ...(rules?.smashVsDefensive || {}) });
// Owner, 2026-10-26: a pierce hit lets floor(blockBypassFraction x its damage) past Block. Missing blocks keep this default.
// Owner, 2026-11-18: `builtInElements` carry Pierce without a tag (Lightning); `skinStatus` is the status whose stacks each cut a Pierce hit's bypass by 1 (Stone Skin);
// `earthSource` marks Block laid by a card of that school, which a built-in Pierce does not bypass.
// Owner, 2026-11-18 (section 21): each Pierce stack ignores `blockIgnoredPerStack` Block. The default 0 keeps the 2026-10-26 fraction for a fight saved without the key.
export const FIXCORE_PIERCE_DEFAULTS = Object.freeze({ blockBypassFraction: 0.2, blockIgnoredPerStack: 0, builtInElements: [], skinStatus: null, earthSource: null });
export const fixCorePierceRules = rules => ({ ...FIXCORE_PIERCE_DEFAULTS, ...(rules?.pierce || {}) });
// Owner, 2026-11-14: attacks always connect and intents are always read. `accuracy.hitRoll: false` draws no d20 and makes Evade a
// stack that cancels the next attack; `perception.roll: false` makes every intent read exact. A rules object without the key
// (a fight saved before this ruling) keeps rolling, so only an explicit `false` switches the roll off.
export const FixCoreHitRollOff = rules => rules?.accuracy?.hitRoll === false;
export const FixCorePerceptionRollOff = rules => rules?.perception?.roll === false;
export const fixCoreWardEnabled = rules => rules?.ward?.enabled !== false;
// Owner, 2026-11-15 (W25-W): every hit meets Block first; a target holding Ward stacks then has its Poise absorb the whole remainder 1:1 before HP.
// `ward.routing: "blockFirst"` turns it on; a fight saved without the key keeps the Poise-first Ward routing (the whole hit to Poise, the rest to Block).
// Owner, 2026-11-18 (section 20): Ward loses `ward.decayPerTurn` stacks (1) at the start of its holder's turn, and its +poisePerStack maximum Poise leaves
// with each stack; when the holder's Poise reaches 0 (`ward.breaksAtZeroPoise`) every Ward stack is removed. A fight saved without the keys keeps the old decay and no break.
/** FixCoreWardDecay(ctx, entity) -> the Ward stacks lost at the start of the holder's turn (`ward.decayPerTurn`), else the generic status decay. */
export function FixCoreWardDecay(ctx, entity, fallback) {
  const rules = fixCoreEnabled(ctx) ? fixCoreRules(ctx, entity).ward : null;
  return Number.isInteger(rules?.decayPerTurn) ? rules.decayPerTurn : fallback;
}
/** FixCoreWardBreaksAtZeroPoise(ctx) -> true when a Poise break strips every Ward stack. */
export const FixCoreWardBreaksAtZeroPoise = ctx => fixCoreEnabled(ctx) && rawRules(ctx).ward?.breaksAtZeroPoise === true;
export const FixCoreWardBlockFirst = ctx => fixCoreEnabled(ctx) && rawRules(ctx).ward?.routing === 'blockFirst';
// Owner, 2026-11-14 (W25): PR (spell damage) is priced from max(INT, WIS). `ratings.prAttributes` lists the attributes PR reads the highest
// of; rules without the key (a run or fight made before this ruling) keep PR on Intelligence alone.
export const FIXCORE_PR_ATTRIBUTE_IDS = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);
/** FixCorePrAttributes(ctx) -> the attribute ids PR reads the highest of, or null for Intelligence-only PR (rules without the key). */
export function FixCorePrAttributes(ctx) {
  if (!fixCoreEnabled(ctx)) return null;
  const ids = rawRules(ctx).ratings?.prAttributes;
  return Array.isArray(ids) && ids.length > 1 && ids.every(id => FIXCORE_PR_ATTRIBUTE_IDS.includes(id)) ? ids : null;
}
/**
 * PrAttributeView(ctx, attributes) -> the attributes PR is priced from: Intelligence replaced by the highest of the listed
 * attributes when the rules carry `ratings.prAttributes`, else the attributes untouched.
 */
export function PrAttributeView(ctx, attributes) {
  const ids = FixCorePrAttributes(ctx);
  if (!ids || !attributes) return attributes;
  return { ...attributes, intelligence: Math.max(...ids.map(id => Number(attributes[id]) || 0)) };
}
const OLD_PERCEPTION_FIELDS = ['levelBaseline','intelligenceBaseline','levelWeight','intelligenceWeight'];
// Pure v1 -> current migration for persisted rules: a perception block saved
// before bonuses[] keeps baseDC, drops the four retired fields and gets
// bonuses: []. Current-shape rules are returned untouched (same object).
// A snapshot older than the 2026-11-14 ruling lacks hitRoll / evadeStacksPerCard / perception.roll; migration must leave them missing (keep rolling), never fill the shipped values.
const OLD_ACCURACY_FIELDS = ['evasionPerStack','precisionPerStack'];
export function normalizeFixCoreRules(rules) {
  let out = rules;
  const p = rules?.perception;
  if (p && typeof p === 'object' && OLD_PERCEPTION_FIELDS.some(key => Object.hasOwn(p, key))) {
    const perception = { ...p };
    for (const key of OLD_PERCEPTION_FIELDS) delete perception[key];
    if (perception.bonuses === undefined) perception.bonuses = [];
    out = { ...out, perception };
  }
  // Retired fields and the shipped unversioned 1 + DEX grant are normalized
  // without changing caller snapshots or intentional version-2 overrides.
  const a = rules?.accuracy;
  if (a && typeof a === 'object' && (a.evasionVersion === undefined || OLD_ACCURACY_FIELDS.some(key => Object.hasOwn(a, key)))) {
    const accuracy = { ...a };
    if (OLD_ACCURACY_FIELDS.some(key => Object.hasOwn(a, key))) {
      for (const key of OLD_ACCURACY_FIELDS) delete accuracy[key];
      for (const [key, value] of Object.entries(defaults.accuracy)) if (accuracy[key] === undefined && !['maneuverPrecision','stanceMinimum','stanceMaximum','stanceAdvantageBonus','hitRoll','evadeStacksPerCard'].includes(key)) accuracy[key] = structuredClone(value);
    }
    if (a.evasionVersion === undefined) {
      if (a.evadeStackBase === 1 && a.evadeStackDex === 1) accuracy.evadeStackDex = 0;
      accuracy.evasionVersion = 2;
    }
    out = { ...out, accuracy };
  }
  return out;
}
const rawRules = ctx => normalizeFixCoreRules(ctx?.fixCoreRules || ctx?.gameProfile?.fixCoreRules || defaults);
// Owner, 2026-11-14 (Wave 2.5): each stance has a natural benefit, in data. A missing block (a fight saved before this ruling) means no benefits.
// Fields per stance: attack/prepared damageMultiplier; smash poiseDamageBonus; sweep splashFraction; counter blockMultiplier + hpReturnFraction;
// defend blockMultiplier + poiseDamageTakenMultiplier + poiseFloorWhileBlock (the Poise a Defend-stance target holding Block keeps against a
// physical hit or Sweep) + poiseFloorWardMagic (1: also against magic while it holds Ward stacks; owner 2026-11-17); neutral extraDrawNextTurn. Stance weaknesses (owner 2026-11-17): prepared meleeDamageTakenMultiplier (melee hits on a Prepared target),
// neutral damageTakenMultiplier (every hit on an Idle target). Logic: src/engine/stanceBenefits.js.
const STANCE_BENEFIT_FIELDS = Object.freeze({ attack: ['damageMultiplier'], prepared: ['damageMultiplier', 'meleeDamageTakenMultiplier'], smash: ['poiseDamageBonus'], sweep: ['splashFraction'],
  counter: ['blockMultiplier', 'hpReturnFraction'], defend: ['blockMultiplier', 'poiseDamageTakenMultiplier', 'poiseFloorWhileBlock', 'poiseFloorWardMagic'], neutral: ['extraDrawNextTurn', 'damageTakenMultiplier'] });
function validateStanceBenefits(rows) {
  if (rows === undefined) return;
  if (typeof rows !== 'object' || rows === null || rows.version !== 1) throw new Error('FixCore stanceBenefits requires version 1');
  for (const [stance, row] of Object.entries(rows)) {
    if (stance === 'version') continue;
    const fields = STANCE_BENEFIT_FIELDS[stance];
    if (!fields || typeof row !== 'object' || row === null || Object.entries(row).some(([key, value]) => !fields.includes(key) || !Number.isFinite(value) || value < 0)) throw new Error(`FixCore stanceBenefits.${stance} requires non-negative numbers for ${(fields || []).join(', ')}`);
  }
}
// Owner, 2026-11-15 (W25-F): spell costs and the elemental flux stance, in data. A missing block (a fight saved before this ruling) keeps today's costs and has no flux.
// spellCosts: manaSurcharge (every spell), staminaSurcharge (every spell except a `cantripTag` one), preparedStaminaDiscount (in Prepared), focusManaDiscount (a Focus item held), optional manaOnlyTag (a spell with it pays 0 Stamina; a fight without the key ignores the tag). Logic: src/engine/spellCosts.js.
// elementFlux: multiplier of the next card of the flux element (floored per number). Logic: src/engine/elementFlux.js.
const SPELL_COST_INTEGERS = Object.freeze(['manaSurcharge', 'staminaSurcharge', 'preparedStaminaDiscount', 'focusManaDiscount']);
function validateSpellCosts(row) {
  if (row === undefined) return;
  if (typeof row !== 'object' || row === null || row.version !== 1 || Object.keys(row).some(key => !['version', 'cantripTag', 'manaOnlyTag', ...SPELL_COST_INTEGERS].includes(key))
    || SPELL_COST_INTEGERS.some(key => !Number.isInteger(row[key]) || row[key] < 0) || typeof row.cantripTag !== 'string' || !row.cantripTag
    || (row.manaOnlyTag !== undefined && (typeof row.manaOnlyTag !== 'string' || !row.manaOnlyTag))) throw new Error(`FixCore spellCosts requires version 1, a cantripTag and whole numbers >= 0 for ${SPELL_COST_INTEGERS.join(', ')}`);
}
// Owner, 2026-11-15 (W25-BANDS): front and back rows. `bands.rows: true` turns the system on; a fight saved without the block (or with rows:false)
// plays as before. advancedTurnEnds: how many of the player's turn ends an Advance lasts (2 = through the enemy phase and the next turn).
// retreatTag / retreatCardId: a weapon with the tag grants the free Retreat card each turn. formationBlock: Block two enemies of one row gain at their turn start.
// Logic: src/engine/bandRows.js.
const BANDS_FIELDS = Object.freeze(['version', 'rows', 'advancedTurnEnds', 'retreatTag', 'retreatCardId', 'formationBlock']);
function validateBands(row) {
  if (row === undefined) return;
  if (typeof row !== 'object' || row === null || row.version !== 1 || Object.keys(row).some(key => !BANDS_FIELDS.includes(key)) || typeof row.rows !== 'boolean'
    || !Number.isInteger(row.advancedTurnEnds) || row.advancedTurnEnds < 1 || !Number.isInteger(row.formationBlock) || row.formationBlock < 0
    || typeof row.retreatTag !== 'string' || !row.retreatTag || typeof row.retreatCardId !== 'string' || !row.retreatCardId) throw new Error('FixCore bands requires {version:1, rows:boolean, advancedTurnEnds >= 1, formationBlock >= 0, retreatTag, retreatCardId}');
}
/** FixCoreBands(ctx) -> the band rules of a fight, or null when the fight has no `bands.rows: true` (a fight made before the rows ruling). */
export function FixCoreBands(ctx) {
  if (!fixCoreEnabled(ctx)) return null;
  const row = rawRules(ctx).bands;
  return row?.rows === true ? row : null;
}
function validateElementFlux(row) {
  if (row === undefined) return;
  if (typeof row !== 'object' || row === null || row.version !== 1 || Object.keys(row).some(key => !['version', 'multiplier'].includes(key)) || !(Number.isFinite(row.multiplier) && row.multiplier >= 1)) throw new Error('FixCore elementFlux requires {version:1, multiplier:number >= 1}');
}
export function validateFixCoreRules(rules) {
  if (rules?.version !== 1 || typeof rules.enabled !== 'boolean') throw new Error('FixCore rules require version 1 and enabled');
  if (rules.spellTraditionsVersion !== undefined && ![0, 1].includes(rules.spellTraditionsVersion)) throw new Error('FixCore spellTraditionsVersion must be 0 or 1');
  const known = new Set(['spellTraditionsVersion','version','enabled','statusCaps','range','ward','poise','staggered','smashVsDefensive','pierce','counter','reaction','defaultTags','protectionParameters','ratings','stanceBenefits','elements','bands','spellCosts','elementFlux',...families.filter(id=>id!=='actionCosts'),'enemyHealBlockCost']);
  if (rules.ward !== undefined && (typeof rules.ward !== 'object' || rules.ward === null || typeof rules.ward.enabled !== 'boolean' || Object.keys(rules.ward).some(key => !['enabled', 'poisePerStack', 'routing', 'decayPerTurn', 'breaksAtZeroPoise'].includes(key))
    || (rules.ward.poisePerStack !== undefined && !(Number.isInteger(rules.ward.poisePerStack) && rules.ward.poisePerStack >= 0))
    || (rules.ward.decayPerTurn !== undefined && !(Number.isInteger(rules.ward.decayPerTurn) && rules.ward.decayPerTurn >= 0))
    || (rules.ward.breaksAtZeroPoise !== undefined && typeof rules.ward.breaksAtZeroPoise !== 'boolean')
    || (rules.ward.routing !== undefined && rules.ward.routing !== 'blockFirst'))) throw new Error('FixCore ward requires {enabled:boolean, poisePerStack?:whole number, routing?:"blockFirst", decayPerTurn?:whole number, breaksAtZeroPoise?:boolean}');
  if (rules.statusCaps !== undefined && rules.statusCaps !== 'none') throw new Error('FixCore statusCaps requires "none" (or no key: the old caps)');
  if (rules.range !== undefined && rangePolicyProblems(rules.range).length) throw new Error('FixCore range requires a valid versioned range policy');
  const poise = rules.poise, stag = rules.staggered;
  if (poise !== undefined && (typeof poise !== 'object' || poise === null || poise.drain !== 'prevented' || Object.keys(poise).some(key => !['drain','breakRule','brokenDamageMultiplier','breakStatusStacks'].includes(key))
    || (poise.breakRule !== undefined && poise.breakRule !== 'broken') || (poise.brokenDamageMultiplier !== undefined && !(Number.isFinite(poise.brokenDamageMultiplier) && poise.brokenDamageMultiplier >= 1))
    || (poise.breakStatusStacks !== undefined && !(Number.isInteger(poise.breakStatusStacks) && poise.breakStatusStacks >= 0)))) throw new Error('FixCore poise requires {drain:"prevented", breakRule?:"broken", brokenDamageMultiplier?:number >= 1, breakStatusStacks?:whole number}');
  if (stag !== undefined && (typeof stag !== 'object' || stag === null || typeof stag.stance !== 'boolean' || typeof stag.extendOnly !== 'boolean' || !Number.isInteger(stag.staminaLoss) || stag.staminaLoss < 0 || !Number.isInteger(stag.vulnerableStacks) || stag.vulnerableStacks < 0 || Object.keys(stag).some(key => !['stance','staminaLoss','vulnerableStacks','extendOnly'].includes(key)))) throw new Error('FixCore staggered requires {stance:boolean, staminaLoss:int, vulnerableStacks:int, extendOnly:boolean}');
  const fractions = (name, row, keys) => { if (row !== undefined && (typeof row !== 'object' || row === null || Object.keys(row).some(key => !keys.includes(key) || !Number.isFinite(row[key]) || row[key] < 0))) throw new Error(`FixCore ${name} requires non-negative numbers for ${keys.join(', ')}`); };
  fractions('counter', rules.counter && Object.fromEntries(Object.entries(rules.counter).filter(([key]) => !COUNTER_STACK_KEYS.includes(key))), Object.keys(FIXCORE_COUNTER_DEFAULTS));
  validateCounterStacks(rules.counter);
  if (rules.reaction !== undefined && (typeof rules.reaction !== 'object' || rules.reaction === null || Object.keys(rules.reaction).some(key => key !== 'handCostDiscount') || !Number.isInteger(rules.reaction.handCostDiscount) || rules.reaction.handCostDiscount < 0)) throw new Error('FixCore reaction requires {handCostDiscount:int >= 0}');
  const pr = rules.ratings;
  if (pr !== undefined && (typeof pr !== 'object' || pr === null || Object.keys(pr).some(key => key !== 'prAttributes')
    || (pr.prAttributes !== undefined && !(Array.isArray(pr.prAttributes) && pr.prAttributes.every(id => FIXCORE_PR_ATTRIBUTE_IDS.includes(id)))))) throw new Error('FixCore ratings requires {prAttributes?:attribute ids}');
  const pierce = rules.pierce;
  if (pierce !== undefined && (typeof pierce !== 'object' || pierce === null || Array.isArray(pierce)
    || Object.keys(pierce).some(key => !Object.hasOwn(FIXCORE_PIERCE_DEFAULTS, key))
    || (pierce.blockBypassFraction !== undefined && !(Number.isFinite(pierce.blockBypassFraction) && pierce.blockBypassFraction >= 0 && pierce.blockBypassFraction <= 1))
    || (pierce.blockIgnoredPerStack !== undefined && !(Number.isInteger(pierce.blockIgnoredPerStack) && pierce.blockIgnoredPerStack >= 0))
    || (pierce.builtInElements !== undefined && !(Array.isArray(pierce.builtInElements) && pierce.builtInElements.every(id => typeof id === 'string' && id.length > 0)))
    || ['skinStatus', 'earthSource'].some(key => pierce[key] !== undefined && pierce[key] !== null && !(typeof pierce[key] === 'string' && pierce[key].length > 0)))) throw new Error('FixCore pierce requires optional fraction, non-negative integer Block per stack, element strings and nullable status/source strings');
  validateStanceBenefits(rules.stanceBenefits);
  validateSpellCosts(rules.spellCosts);
  validateElementFlux(rules.elementFlux);
  validateBands(rules.bands);
  const smash = rules.smashVsDefensive;
  if (smash !== undefined && (typeof smash !== 'object' || smash === null || Object.keys(smash).some(key => !['damageMultiplier','blockFraction','poiseFraction'].includes(key))
    || ![smash.damageMultiplier,smash.blockFraction,smash.poiseFraction].every(v => typeof v === 'number' && Number.isFinite(v)) || smash.damageMultiplier < 1 || smash.blockFraction < 0 || smash.poiseFraction < 0)) throw new Error('FixCore smashVsDefensive requires {damageMultiplier>=1, blockFraction>=0, poiseFraction>=0}');
  if (rules.elements !== undefined && (typeof rules.elements !== 'object' || rules.elements === null || rules.elements.version !== 1)) throw new Error('FixCore elements requires {version:1}');
  for(const key of Object.keys(rules)) if(!known.has(key)) throw new Error(`FixCore unknown configuration field ${key}`);
  for (const tag of rules.defaultTags || []) if (!behaviorTags.has(tag)) throw new Error(`FixCore unknown behavior tag ${tag}`);
  compileBindings({mechanics,moduleParameters:fixCoreModuleParameters(rules),attachments:[{
    ownerId:'rules',sourceInstanceId:'rules',kind:'run',tags:families.map(id=>`combat:${id}`)}]});
  return rules;
}
validateFixCoreRules(defaults);
// Only active sources enter this adapter: worn mounts, current status instances,
// an actor and an optional card's play window. Inventory is never consulted.
export function fixCoreAttachments(ctx,entity,carrier=null) {
  if (!entity) return [];
  const rules=rawRules(ctx), ownerId=ctx?.playerIdForEntity?.(entity) || entity.id;
  const table=entity.kind==='enemy' ? ctx?.registries?.enemies : null;
  const definitionId=entity.enemyId || entity.classId;
  const definition=table?.has?.(definitionId) ? table.get(definitionId) : {};
  const rows=[{ownerId,sourceInstanceId:ownerId,kind:'entity',tags:entity.mechanicTags ?? definition.mechanicTags ?? (fixCoreWardEnabled(rules) ? rules.defaultTags : (rules.defaultTags || []).filter(tag => tag !== 'defense:wardProtection')),
    mechanicBindings:entity.mechanicBindings ?? definition.mechanicBindings ?? []}];
  for(const [id,mount] of Object.entries(ctx?.propertyMounts?.[ownerId] || {})) rows.push({ownerId,sourceInstanceId:id,
    kind:({armour:'gear',armament:'gear',sigil:'gear',class:'character',feat:'character',companion:'entity'})[mount.kind] || mount.kind,
    label:mount.name,tags:mount.mechanicTags || mount.scopeTags || [],mechanicBindings:mount.mechanicBindings || []});
  for(const [id,instance] of Object.entries(entity.statuses || {})) {
    if (!(instance.stacks>0 || instance.meter?.value>0)) continue;
    const def=ctx?.registries?.statuses?.get(id);
    if(def?.mechanicTags || def?.mechanicBindings) rows.push({ownerId,sourceInstanceId:`status:${id}`,kind:'status',tags:def.mechanicTags || [],mechanicBindings:def.mechanicBindings || []});
  }
  if(carrier && (carrier.mechanicTags || carrier.mechanicBindings)) rows.push({ownerId,sourceInstanceId:`card:${carrier.instanceId || carrier.cardId || carrier.moveId || 'active'}`,kind:'card',tags:carrier.mechanicTags || [],mechanicBindings:carrier.mechanicBindings || []});
  return rows;
}
export function fixCoreRules(ctx,entity=null,carrier=null) {
  const raw=rawRules(ctx), moduleParameters=fixCoreModuleParameters(raw);
  if(raw!==defaults) validateFixCoreRules(raw);
  const bindings=compileBindings({mechanics,moduleParameters,attachments:[{ownerId:'rules',sourceInstanceId:'rules',kind:'run',tags:families.map(id=>`combat:${id}`)},...fixCoreAttachments(ctx,entity,carrier)]});
  const result={...raw};
  for(const family of families) {
    const candidates=bindings.filter(binding=>binding.mechanicId===`combat.${family}`);
    const attached=candidates.filter(binding=>binding.ownerId!=='rules');
    // Config queries are exclusive replacements. Ambiguous equipped sources
    // are rejected instead of silently taking an object iteration winner.
    if(attached.length>1) throw new Error(`Conflicting ${family} rule attachments: ${attached.map(row=>row.sourceInstanceId).join(', ')}`);
    const value=queryBinding(attached[0] || candidates[0],'parameters');
    if(family==='actionCosts') result.enemyHealBlockCost=value.enemyHealBlockCost;else result[family]=value;
  }
  return result;
}
export function fixCoreEnabled(ctx) { return ctx?.combatExpansionVersion === 2 && (ctx?.fixCoreRules?.version === 1 || ctx?.gameProfile?.modules?.effects?.fixCoreVersion === 1) && rawRules(ctx).enabled; }

/**
 * Owner, 2026-11-15: "nothing should have a max stack count". True when this fight's rules lift every cap on how many stacks a combatant
 * can HOLD (the expanded-status caps of 3, Shock's 10, Reflect's 10). A fight saved without `statusCaps: "none"` keeps its caps; a per-grant
 * amount (what a card adds) is never a cap. Safety ceilings that only keep garbage out of a save are not caps and stay.
 */
export const StatusCapsLifted = ctx => fixCoreEnabled(ctx) && ctx?.fixCoreRules?.statusCaps === 'none';
/** True when FixCore is active and the data toggle has switched Ward off. */
export function fixCoreWardDisabled(ctx) { return fixCoreEnabled(ctx) && !fixCoreWardEnabled(rawRules(ctx)); }
export function protectionBindings(ctx, entity, carrier=null) {
  return compileBindings({ mechanics, attachments:fixCoreAttachments(ctx,entity,carrier), moduleParameters:fixCoreModuleParameters(rawRules(ctx)) });
}
export function protectionReceipt(ctx, entity, kind, amount) {
  // Detached preview targets may omit inactive pools. Normalize only the
  // read model; live entities and strict mechanic reference validation stay intact.
  const owner = entity ? {...entity, persistentWard: entity.persistentWard ?? {value:0,max:0},
    persistentPoise: entity.persistentPoise ?? {value:0,max:0}} : entity;
  const ownerId = ctx?.playerIdForEntity?.(entity) || entity?.id;
  const receipt = evaluateModifiers({ bindings: fixCoreEnabled(ctx) && amount > 0 ? protectionBindings(ctx, entity) : [],
    phase: 'damage.mitigation', subjectId: ownerId, context: { owner, damageKind: kind }, amount, quantity: true });
  const sources = [...receipt.sources];
  if (receipt.rounding) sources.push({ id: 'rounding', label: 'Final damage rounding', stage: 'rounding', operation: 'add', amount: receipt.rounding });
  // Poise cannot absorb more than it holds (owner, 2026-10-18 20:09): the rest of the hit gets through.
  const held = kind === 'physical' && owner?.persistentPoise ? Math.max(0, owner.persistentPoise.value) : Infinity;
  let reduced = Math.max(0, amount - receipt.amount), taken = receipt.amount;
  if (reduced > held) { taken += reduced - held; sources.push({ id: 'poise-cap', label: 'Poise cannot absorb more than it holds', stage: 'mitigation', operation: 'add', amount: reduced - held }); reduced = held; }
  return { ...receipt, amount: taken, reduced, sources };
}
export function damageReceipt(targetId, hits) {
  return { version: 1, targetId, hits, totalDamage: hits.reduce((sum, hit) => sum + hit.hpLoss, 0) };
}

// Read-only status projection for cards, PIPs, logs and inspectors. The base
// registry is explicit so UI facades cannot recursively query themselves.
/** The off-combat phrase for Evade's configured (and card-scoped) stack grant. */
export function evadeStackGainPhrase(ctx, carrier = null, per = 1) {
  const accuracy = fixCoreRules(ctx, { id: 'card-face' }, carrier).accuracy;
  // `per` is the card's multiplier on the configured gain (an upgraded Evade card reads per 2).
  if (FixCoreHitRollOff({ accuracy })) return String(Math.floor((accuracy.evadeStacksPerCard ?? 1) * per));
  const base = accuracy.evadeStackBase * per, dex = accuracy.evadeStackDex * per;
  return dex === 0 ? String(base) : `${base} plus ${dex === 1 ? '' : dex + '× '}DEX`;
}
/** A card whose whole authored rule is its configured self Evade grant. */
export const evadeGrantOnlyCard = def => def.effects?.length === 1 && def.effects[0].op === 'applyStatus'
  && def.effects[0].status === 'evade' && def.effects[0].target === 'self'
  && Object.keys(def.effects[0]).every(key => ['op', 'target', 'status', 'stacks'].includes(key))
  && def.effects[0].stacks?.f === 'metric' && def.effects[0].stacks.metric === 'evadeStackGain'
  && def.effects[0].stacks.of === 'self'
  && Object.keys(def.effects[0].stacks).every(key => ['f', 'metric', 'of'].includes(key));
export function fixCoreStatusDefinition(ctx, id, baseDefinition, holder = null) {
  const base = baseDefinition ?? ctx?.registries?.statuses?.get(id);
  if (!fixCoreEnabled(ctx)) return base;
  const rules = fixCoreRules(ctx, holder), overrides = rules.statuses.overrides?.[id];
  const row = overrides ? {...base,...overrides} : {...base};
  const facts = {
    weak: `Attack rating ×${rules.statuses.weakARMultiplier} while active.`,
    vulnerable: `Damage taken ×${rules.statuses.vulnerabilityMultiplier} while active.`,
    staggered: `Poise broke: lose ${fixCoreStaggeredRules(rules).staminaLoss} Stamina next turn and gain ${fixCoreStaggeredRules(rules).vulnerableStacks} Vulnerable. Repeat breaks only extend Vulnerable.`,
    evade: FixCoreHitRollOff(rules) ? 'The next attack against you misses.' : `Each stack adds ${rules.accuracy.baseAC} + DEX to fixed Evasion. Only attacks roll.`,
    precision: `Each stack adds another multiple of your Precision score (attributes and level) to your Precision roll.`,
  };
  if (id === 'precision') row.tooltip = row.description = `${facts[id]} Applications add stacks. Expires at the end of the owner's turn unless the granting effect is Persistent. Does not increase damage.`;
  else if (id === 'staggered') row.tooltip = row.description = facts[id];
  else if (id === 'ward' && rules.ward?.poisePerStack > 0) {
    const tokens = { poise: rules.ward.poisePerStack, decay: rules.ward.decayPerTurn ?? rules.statuses.decayAmount };
    row.tooltip = row.description = [tFull(rules.ward.routing === 'blockFirst' ? 'status.ward.tooltipBlockFirst' : 'status.ward.tooltipPoiseFirst', tokens),
      ...(rules.ward.breaksAtZeroPoise ? [tFull('status.ward.breaks')] : [])].join(' ');
  }
  else if (id === 'barrier') { const per = ctx?.ratingsRules?.barrier?.poisePerStack ?? ctx?.registries?.balance?.combatRatings?.barrier?.poisePerStack ?? 5; row.tooltip = row.description = `Poise gained above your maximum. Each stack is +${per} maximum and current Poise. Lose ${rules.statuses.decayAmount} stack at the start of your turn, and its +${per} maximum Poise with it.`; }
  else if (facts[id]) row.tooltip = row.description = `${facts[id]} Applications add stacks. Lose ${rules.statuses.decayAmount} stack at the start of the owner's turn each round.`;
  return row;
}

export function fixCoreProtectionDescription(ctx,entity,kind) {
  if (!fixCoreEnabled(ctx) || !entity) return null;
  const damageKind = kind === 'ward' || kind === 'magical' ? 'magical' : 'physical';
  // A deep pool, so the percentages shown are the uncapped absorbed shares.
  const shadow = {...entity,persistentWard:{...entity.persistentWard,value:1000},persistentPoise:{...entity.persistentPoise,value:1000}};
  const receipt = protectionReceipt(ctx,shadow,damageKind,100);
  const restores = fixCoreWardDisabled(ctx) ? 'Poise' : 'both Poise and Ward';
  // Owner, 2026-10-18 20:09: Poise absorbs a share of each hit and loses exactly what it absorbed.
  const broken = FixCoreBrokenRules(ctx);
  // Owner, 2026-11-18 (3a): a break no longer multiplies damage; it applies Staggered, Vulnerable, Weak and Frail stacks instead.
  const brokenByStatuses = broken && broken.damageMultiplier === 1 && broken.statusStacks > 0;
  const spends = brokenByStatuses ? tFull('poise.broken.statuses', { stacks: broken.statusStacks }) : broken ? `The damage it absorbs is taken off the pool, and when the pool is empty the owner is Broken: it loses its next action and takes ×${broken.damageMultiplier} damage until then, and its Poise refills to full.`
    : 'The damage it absorbs is taken off the pool, and when the pool is empty the owner is Staggered.';
  if (fixCoreWardDisabled(ctx)) {
    const poise = protectionReceipt(ctx,shadow,'physical',100);
    return `While active, Poise takes ${poise.reduced}% off each hit (you take the rest, rounded down) and loses what it absorbed. ${spends} Block cards restore Poise by their Block amount, up to its maximum.`;
  }
  return `While active, absorbs ${receipt.reduced}% of ${damageKind} damage. ${spends} Block cards restore ${restores} by their Block amount, up to each maximum.`;
}

export function snapshotFixCoreRules(ctx) {
  const rules=structuredClone(fixCoreRules(ctx));
  rules.protectionParameters=Object.fromEntries(fixCoreProtection.filter(([id])=>id.startsWith('defense.')).map(([id,row])=>[id,{...parameterDefaults(row.manifest.parameters),...(rules.protectionParameters?.[id] || {})}]));
  return validateFixCoreRules(rules);
}

/** The combat stance a Staggered owner stands in until its next turn begins (shared by live play and previews). */
// It carries the resolved costs so the inspector row reads the profile's numbers, not hard-coded ones.
export const fixCoreStaggeredStance = (entity, rules = FIXCORE_STAGGERED_DEFAULTS) => ({ maneuver: 'staggered', camp: 'physical', range: 'melee', staggered: true,
  staminaLoss: rules.staminaLoss, vulnerableStacks: rules.vulnerableStacks, expiresOnOwnerCycle: (entity.combatOwnerCycle || 0) + 1 });
