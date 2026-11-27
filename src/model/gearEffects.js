// src/model/gearEffects.js — the gear vocabulary made executable (owner, 2026-11-18, rulings 13 and 16-19).
//
// Equipment carries no code. A piece's `mods` strings, its TYPE's base mods and its armour GROUP's base mods (content/source/equipmentTypes.json) are
// parsed here against the vocabulary rows of content/source/equipMods.csv and folded into ONE summary the fight reads (`player.itemProps`):
//
//   cardRules   [{ selector, arg, conds, stat, amount }]   a number on every matching card (damage, Poise damage, Block, Pierce, Multi-hit, Reach, cost ...)
//   hitRules    [{ selector, arg, conds, status, stacks } | { ..., remove }]   what a matching hit applies to, or takes off, its target
//   turnGrants  [{ phase, conds, grant, status, amount }]   Block, Counter, Evade, Ward, Retreat stacks, Reach, heal at the start or end of a turn
//   playGrants  [{ selector, arg, conds, grant, status, amount }]   what playing a matching card grants
//   resist      { <element>: percent }   firstTurnSp, vulnMelee, twoHanded   flags
//
// Pure and headless. Card rules are applied to the card DEFINITION (ApplyGearCardRules), the one definition the face, the quote and the play all read,
// so a preview equals the play. A rule with a target condition (Retreat-stacked, back row, front row) reads the target, so it rides the hit
// (engine/gearHooks.js), through the same receipt the quote uses.
import { RANGES } from './combatRanges.js';
import * as CombatProfiles from './combatCardProfile.js';
import { GEAR_TYPES } from '../content/gearTypes.js';
import { parseMod } from './loadout/modStrings.js';
import { equippedPieces, equippedIn } from './loadout/equipped.js';
import { isFormula } from './formulas.js';
import { SpellCategory, SpellTraditionsActive, RealSpellSchool } from './spellTraditions.js';
import { ITEM_PROPERTIES } from '../content/itemProperties.js';
import { relics as RELICS } from '../content/relics.js';

const TARGET_CONDS = new Set(['target']);
// An Initiate mod (owner 2026-11-26) always reads Prepared stance;
// a spell takes at most one Initiate cut.
const INITIATE_FIELD = 'cardInitiate';
const INITIATE_STANCE = 'prepared';
const STANCE_COND = 'stance';
const RELIC_PIECE_KIND = 'relic';

/** ParseGearMod('anyAttack@target:retreating.cardAddDex=+1') -> { selector, arg, conds, field, mode, value } | null. */
export function ParseGearMod(raw) {
  const mod = parseMod(raw);
  if (!mod) return null;
  const [head, ...conds] = mod.prefix.split('@');
  const [selector, arg = null] = head.split(':');
  return { raw, selector, arg, conds: conds.map(text => { const [name, value = null] = text.split(':'); return { name, arg: value }; }),
    field: mod.field, mode: mod.mode, value: mod.value };
}

/** The type id an armament belongs to (equipmentTypes.json `items`), or null. */
export const GearWeaponTypeOf = piece => GEAR_TYPES.items[piece?.id] || piece?.gearType || null;
/** The armour group id an armour piece belongs to (`armourItems`; a class's `default` outfit reads `defaultOutfitGroups`), or null. */
export function GearArmourGroupOf(piece) {
  if (!piece) return null;
  if (piece.id === 'default') return GEAR_TYPES.defaultOutfitGroups[piece.classId] || null;
  return GEAR_TYPES.armourItems[piece.id] || piece.gearGroup || null;
}
/** The type or group row a piece carries, with its id. */
export function GearTypeRow(piece) {
  if (piece?.kind === 'armor') { const id = GearArmourGroupOf(piece); return id ? { id, group: true, ...GEAR_TYPES.armourGroups[id] } : null; }
  const id = GearWeaponTypeOf(piece);
  return id && GEAR_TYPES.weaponTypes[id] ? { id, group: false, ...GEAR_TYPES.weaponTypes[id] } : null;
}

/** GearPieceMods(piece) -> the mod strings a worn piece carries: its type or armour group base (one body piece wears the whole group base, Thorns and all), then its own mods. */
export function GearPieceMods(piece, includeType = true) {
  const row = includeType ? GearTypeRow(piece) : null;
  return [...(row?.mods || []), ...(piece?.mods || [])];
}

const wholeNumber = (mode, value, prior = 0) => (mode === 'add' ? prior + value : value);

/** An Initiate mod's conditions: its own, plus Prepared stance when it names no stance. */
function initiateConds(conds)
{
  if (conds.some(cond => cond.name === STANCE_COND))
  {
    return conds;
  }
  return [
    ...conds,
    {
      name: STANCE_COND,
      arg: INITIATE_STANCE,
    },
  ];
}

/** The relic ids a run (`relics`) or a fight (`player.relicIds`) holds. */
function heldRelicIds(subject)
{
  const relicIds = subject?.relics ?? subject?.player?.relicIds;
  return Array.isArray(relicIds)
    ? relicIds
    : [];
}

/** The gear mod strings an item property carries (`fx.gearMods`, itemProperties.json). */
function propertyGearMods(propertyId)
{
  const property = ITEM_PROPERTIES.find(row => row.id === propertyId);
  return property?.fx?.gearMods || [];
}

/** Each held relic whose properties carry gear mods, as a worn piece with no type row. */
export function GearRelicPieces(subject, relicRows = RELICS)
{
  const pieces = [];
  for (const relicId of heldRelicIds(subject))
  {
    const propertyIds = relicRows.find(row => row.id === relicId)?.properties || [];
    const mods = propertyIds.flatMap(propertyGearMods);
    if (mods.length)
    {
      pieces.push({
        id: relicId,
        kind: RELIC_PIECE_KIND,
        mods,
      });
    }
  }
  return pieces;
}

/**
 * GearSummary(registries, loadout, classId) -> the folded effects of every worn piece.
 * `statPoints` and `pools` are read by the receipt and runMods; the rest is stamped on the player for the fight.
 */
export const GearTypeEffectsEnabled = subject => subject?.gameProfile?.modules?.gear?.typeEffectsVersion === 1;
export const GearVocabularyEnabled = (subject, spec) => GearTypeEffectsEnabled(subject) || !(spec?.scope === 'gear' || ['statPoint', 'flag', 'resist'].includes(spec?.apply) || ['thorns', 'thornsFire'].includes(spec?.status));

export function GearSummary(registries, loadout, classId, subject = registries) {
  const typeEffects = GearTypeEffectsEnabled(subject);
  const traditions = SpellTraditionsActive({ gameProfile: subject?.gameProfile });
  const fields = registries?.equipment?.modFields || {};
  const pieces = loadout
    ? equippedPieces(registries, loadout, classId)
    : [];
  const worn = [
    ...pieces,
    ...GearRelicPieces(subject),
  ];
  const out = { cardRules: [], hitRules: [], turnGrants: [], playGrants: [], resist: {}, statPoints: {}, flags: {}, startStatuses: {},
    mainWeaponType: typeEffects && loadout ? GearWeaponTypeOf(equippedIn(registries, loadout, classId, 'rightHand')) : null };
  if (!typeEffects) return out;
  for (const piece of worn) for (const raw of GearPieceMods(piece, typeEffects)) {
    const mod = ParseGearMod(raw), spec = mod && fields[mod.field];
    if (!spec) continue;
    // Arcane and Divine selectors match nothing on a profile saved without spell traditions.
    if (!traditions && GEAR_TYPES.selectors[mod.selector]?.spellCategory) continue;
    const initiate = mod.field === INITIATE_FIELD;
    const conds = initiate
      ? initiateConds(mod.conds)
      : mod.conds;
    const common = {
      selector: mod.selector,
      arg: mod.arg,
      conds,
      source: piece.id,
      ...(initiate ? { initiate: true } : {}),
    };
    if (spec.scope === 'run') {
      if (spec.apply === 'statPoint') out.statPoints[spec.op] = wholeNumber(mod.mode, mod.value, out.statPoints[spec.op]);
      else if (spec.apply === 'flag') out.flags[spec.op] = wholeNumber(mod.mode, mod.value, out.flags[spec.op]);
      else if (spec.apply === 'resist') out.resist[spec.op] = (out.resist[spec.op] || 0) + GEAR_TYPES.resistPercent * Math.max(1, mod.value);
      else if (spec.apply === 'startStatus') out.startStatuses[spec.status] = wholeNumber(mod.mode, mod.value, out.startStatuses[spec.status]);
    } else if (spec.scope === 'gear') {
      if (spec.apply === 'cardStat') out.cardRules.push({ ...common, stat: spec.op, amount: mod.value, mode: mod.mode });
      else if (spec.apply === 'hitStatus') out.hitRules.push({ ...common, status: spec.status, stacks: mod.value });
      else if (spec.apply === 'hitRemove') out.hitRules.push({ ...common, remove: spec.status, stacks: mod.value });
      else if (spec.apply === 'hitPush') out.hitRules.push({ ...common, push: mod.value });
      else if (spec.apply === 'turnGrant') out.turnGrants.push({ phase: mod.selector, conds: mod.conds, grant: spec.op || 'status', status: spec.status || null, amount: mod.value, source: piece.id });
      else if (spec.apply === 'playGrant') out.playGrants.push({ ...common, grant: spec.op || 'status', status: spec.status || null, amount: mod.value });
    }
  }
  return out;
}

/** The fields of GearSummary the fight reads off the player (`itemProps`); empty groups are left out. */
export function GearItemProps(summary) {
  const props = {};
  for (const key of ['cardRules', 'hitRules', 'turnGrants', 'playGrants']) if (summary[key].length) props[key] = summary[key];
  if (Object.keys(summary.resist).length) props.gearResist = summary.resist;
  for (const key of ['firstTurnSp', 'vulnMelee', 'twoHanded']) if (summary.flags[key]) props[key] = summary.flags[key];
  // Every Counter or Evade gain gives this many more stacks (Medium and Light armour); the end-of-turn grants below are exempt.
  const gainBonus = {};
  if (summary.flags.gainCounter) gainBonus.counter = summary.flags.gainCounter;
  if (summary.flags.gainEvade) gainBonus.evade = summary.flags.gainEvade;
  if (Object.keys(gainBonus).length) props.gainBonus = gainBonus;
  if (summary.mainWeaponType) props.mainWeaponType = summary.mainWeaponType;
  return props;
}

// ---- selectors and conditions -------------------------------------------------------------------------------------------------------------------

const tagsOfDef = def => (def?.cardTags ?? def?.tags ?? []).map(tag => (typeof tag === 'string' ? tag : tag?.id)).filter(Boolean);
const totalCostOf = def => (Number(def?.resourceCosts?.sp ?? def?.staminaCost ?? def?.cost) || 0) + (Number(def?.resourceCosts?.mp ?? def?.manaCost) || 0);

/** Whether a selector (equipmentTypes.json `selectors`) names this card. `def` is a card definition or a hit carrier (tags only). */
export function GearSelectorMatches(selector, arg, def) {
  const row = GEAR_TYPES.selectors[selector];
  if (!row) return false;
  const tags = tagsOfDef(def);
  if (row.allTags && !row.allTags.every(tag => tags.includes(tag))) return false;
  if (row.argTag && arg && !tags.includes(row.argTag.replace('{arg}', arg))) return false;
  if (row.totalCost !== undefined && Array.isArray(def?.effects) && totalCostOf(def) !== row.totalCost) return false;
  if (row.hasEffect && !(def?.effects || []).some(effect => effect?.op === row.hasEffect)) return false;
  // An Arcane or Divine selector also names a Shared Spell (docs/plans/spell-categories.md, section 5).
  if (row.spellCategory && ![row.spellCategory, 'shared'].includes(SpellCategory(def))) return false;
  if (row.argSchool && RealSpellSchool(def) !== arg)
  {
    return false;
  }
  return true;
}

const categoryOf = rule => GEAR_TYPES.selectors[rule.selector]?.spellCategory || null;
const groupTotal = (rules, category, key, field) => rules
  .filter(rule => !rule.initiate && categoryOf(rule) === category && key(rule) === field)
  .reduce((sum, rule) => sum + (Number(rule.amount ?? rule.stacks) || 0), 0);

// Initiates never enter the overlap: GearManaCost keeps the single strongest one, so a larger Divine
// Initiate still wins and no Initiate cancels a plain Mana change.
const overlapCategoryOf = rule => (rule.initiate
  ? null
  : categoryOf(rule));

/**
 * A Shared Spell draws on Arcane and Divine bonuses, but they do not stack: per field (`key`), only the larger group total counts
 * (ties keep Arcane); bonuses from every other selector still add on top (owner 2026-11-20). `rules` already match the card.
 */
export function GearCategoryOverlap(rules, def, key = rule => rule.stat) {
  if (SpellCategory(def) !== 'shared') return rules;
  const fields = new Set(rules.filter(rule => overlapCategoryOf(rule)).map(key));
  const dropped = new Set();
  for (const field of fields) {
    const arcane = groupTotal(rules, 'arcane', key, field), divine = groupTotal(rules, 'divine', key, field);
    dropped.add(`${Math.abs(divine) > Math.abs(arcane) ? 'arcane' : 'divine'}|${field}`);
  }
  const kept = rule => !overlapCategoryOf(rule) || !dropped.has(`${categoryOf(rule)}|${key(rule)}`);
  return rules.filter(kept);
}

/** A rule is triggered (it reads the fight: a stance, a first play, a target) rather than always-on; triggered numbers colour on the face. */
export const GearRuleTriggered = rule => rule.conds.some(cond => GEAR_TYPES.conditions[cond.name]?.triggered);
/** A rule that needs the target. */
export const GearRuleNeedsTarget = rule => rule.conds.some(cond => TARGET_CONDS.has(cond.name));

/**
 * GearCondMet(cond, state) -> boolean for the non-target conditions.
 *   state = { stance, attacksPlayedThisCombat, spellsPlayedThisTurn, weaponType }
 */
export function GearCondMet(cond, state = {}) {
  const kind = GEAR_TYPES.conditions[cond.name]?.kind;
  if (kind === 'stance') return (state.stance === 'casting' ? 'prepared' : state.stance) === (cond.arg === 'casting' ? 'prepared' : cond.arg);
  if (kind === 'weapon') return state.weaponType === cond.arg;
  if (kind === 'break') return state.poiseBreak === true; // only the hit that Poise-breaks its target (engine/actions.js GearBreakRiders)
  if (kind === 'holding') return (state.holding?.[cond.arg] || 0) >= 1; // holding 0 stacks gives nothing
  if (kind === 'first') return cond.arg === 'fight' ? (state.attacksPlayedThisCombat || 0) === 0 : (state.spellsPlayedThisTurn || 0) === 0;
  return true;
}

/** GearTargetCondMet(cond, target) -> boolean: `target:retreating|backRow|frontRow`. */
export function GearTargetCondMet(cond, target) {
  if (cond.name !== 'target') return true;
  if (cond.arg === 'retreating') return (target?.statuses?.retreat?.stacks || 0) > 0;
  if (cond.arg === 'backRow') return target?.row === 'back';
  if (cond.arg === 'frontRow') return target?.row !== 'back';
  return false;
}

// ---- applying card rules to a definition ----------------------------------------------------------------------------------------------------------

const ENEMY_AIMED = new Set(['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies', 'otherEnemy']);
const adjust = (current, rule) => (rule.mode === 'set' ? rule.amount : (Number(current) || 0) + rule.amount);
/** The rules the player's own statuses stand for: Multi-hit stacks repeat each attack, Reach stacks give physical attacks Reach. */
export function GearStatusRules(statuses = {}) {
  const rules = [];
  const stacks = id => Math.max(0, Number(statuses?.[id]?.stacks) || 0);
  if (stacks('multiHit')) rules.push({ selector: 'anyAttack', arg: null, conds: [], stat: 'multiHit', amount: stacks('multiHit'), mode: 'add', source: 'status:multiHit' });
  if (stacks('reach')) rules.push({ selector: 'anyAttack', arg: null, conds: [], stat: 'reach', amount: 1, mode: 'add', source: 'status:reach' });
  return rules;
}

const EFFECT_STATS = new Set(['damage', 'poiseDamage', 'block', 'heal', 'multiHit']);
const amountValue = value => typeof value === 'number' || isFormula(value);
const adjustAmount = (current, rule) => rule.mode === 'set' ? Math.max(0, rule.amount)
  : isFormula(current) ? { f: 'add', args: [current, rule.amount], min: 0 } : Math.max(0, adjust(current, rule));

// Match selectors against the original branch, then project only its effects. Shared prices and flags belong to the card-level pass.
function projectGearEffects(rules, def) {
  const live = rules.filter(rule => EFFECT_STATS.has(rule.stat) && GearSelectorMatches(rule.selector, rule.arg, def));
  const effects = (def.effects || []).map(effect => ({ ...effect })), applied = new Set();
  for (const rule of live) {
    const n = rule.amount;
    if (rule.stat === 'damage' || rule.stat === 'block' || rule.stat === 'heal') {
      for (const effect of effects) if (effect.op === rule.stat && (rule.stat !== 'damage' || ENEMY_AIMED.has(effect.target)) && amountValue(effect.amount)) {
        effect.amount = adjustAmount(effect.amount, rule); applied.add(rule);
      }
    } else if (rule.stat === 'poiseDamage') {
      const own = effects.find(effect => effect.op === 'poiseDamage' && amountValue(effect.amount));
      const hit = effects.find(effect => effect.op === 'damage' && ENEMY_AIMED.has(effect.target));
      if (own) { own.amount = adjustAmount(own.amount, rule); applied.add(rule); }
      else if (hit && n > 0) { effects.splice(effects.indexOf(hit) + 1, 0, { op: 'poiseDamage', target: hit.target, amount: n }); applied.add(rule); }
    } else if (rule.stat === 'multiHit') {
      for (const effect of effects) if (effect.op === 'damage' && ENEMY_AIMED.has(effect.target)) {
        effect.hits = Math.max(1, (effect.hits || 1) + n); applied.add(rule);
      }
    }
  }
  return { effects, applied };
}

/**
 * ApplyGearCardRules(rules, def, state) -> a new card definition, or `def` unchanged. Only rules without a target condition apply here.
 * Applied rules are recorded on `def.gearApplied` (stat, amount, triggered) so a face can colour a triggered number; the flags Pierce, Ignore
 * Block, DEX and a second STR travel on `def.gear` to the hit carrier.
 */
export function ApplyGearCardRules(rules, def, state = {}) {
  const conditioned = (rules || []).filter(rule => !GearRuleNeedsTarget(rule) && rule.conds.every(cond => GearCondMet(cond, state)));
  if (!conditioned.length || !def) return def;
  const eligible = GearCategoryOverlap(conditioned.filter(rule => !categoryOf(rule) || GearSelectorMatches(rule.selector, rule.arg, def)), def);
  const live = eligible.filter(rule => GearSelectorMatches(rule.selector, rule.arg, def));
  if (!live.length && !(def.effectVariants || []).some(variant => eligible.some(rule => EFFECT_STATS.has(rule.stat) && GearSelectorMatches(rule.selector, rule.arg, { ...def, effects: variant.effects })))) return def;
  const base = projectGearEffects(eligible, def), common = new Set();
  const gear = { ...(def.gear || {}) };
  let stamina = Number(def.resourceCosts?.sp ?? def.staminaCost ?? def.cost);
  const manaRules = [...(def.gearManaRules || [])];
  let keywords = def.keywords, costGrowth = def.costGrowth;
  let range = [def.range, def.combatProfile?.range, ...tagsOfDef(def).filter(tag => tag.startsWith('range:')).map(tag => tag.slice(6))].filter(id => RANGES.includes(id)).sort((a, b) => RANGES.indexOf(a) - RANGES.indexOf(b)).at(-1);
  const hasCost = Number.isFinite(stamina);
  for (const rule of live) {
    const n = rule.amount;
    const note = () => common.add(rule);
    if (rule.stat === 'cost' && hasCost) { stamina = Math.max(0, adjust(stamina, rule)); note(); }
    else if (rule.stat === 'manaCost')
    {
      manaRules.push({
        mode: rule.mode,
        amount: n,
        ...(rule.initiate ? { initiate: true } : {}),
      });
      note();
    }
    else if (rule.stat === 'reach') { if (range !== 'ranged') range = 'reach'; note(); }
    else if (rule.stat === 'retain') { keywords = [...new Set([...(keywords || []), 'retain'])]; note(); }
    else if (rule.stat === 'escalate') { costGrowth ||= { perUse: 1, max: Number.MAX_SAFE_INTEGER, stamina: 1 }; note(); }
    else if (['pierce', 'ignoreBlock', 'addDex', 'addStr'].includes(rule.stat)) { gear[rule.stat] = adjust(gear[rule.stat], rule); note(); }
  }
  const notes = (projection, original = def) => [...(original.gearApplied || def.gearApplied || []), ...eligible
    .filter(rule => projection.applied.has(rule) || common.has(rule))
    .map(rule => ({ stat: rule.stat, amount: rule.amount, triggered: GearRuleTriggered(rule), source: rule.source }))];
  const variants = def.effectVariants?.map(variant => {
    const projection = projectGearEffects(eligible, { ...def, effects: variant.effects });
    return { ...variant, effects: projection.effects, gearApplied: notes(projection, variant) };
  });
  const costs = hasCost ? { cost: stamina, staminaCost: stamina } : {};
  const next = { ...def, effects: base.effects, ...(variants ? { effectVariants: variants } : {}), ...costs, ...(manaRules.length ? { gearManaRules: manaRules } : {}), keywords, gear, gearApplied: notes(base),
    ...(costGrowth ? { costGrowth } : {}), ...(range && range !== def.range ? { range, combatProfile: { ...CombatProfiles.combatProfileFor(def), ...(def.combatProfile || {}), range } } : {}) };
  if (def.resourceCosts && hasCost) next.resourceCosts = { ...def.resourceCosts, sp: stamina };
  return next;
}

/** A rule condition that may read the target. */
const GearRuleCondMet = (cond, target, state) => (GEAR_TYPES.conditions[cond.name]?.kind === 'target' ? GearTargetCondMet(cond, target) : GearCondMet(cond, state));
/** The field a hit rider changes: the status it applies or removes, or a push. */
const riderField = rule => rule.push ? 'push' : rule.remove ? 'remove:' + rule.remove : 'status:' + rule.status;

/**
 * GearHitAdds(rules, carrier, target, state) -> { damage, addDex } from the rules that read the target (Retreat-stacked, back row, front row).
 * `carrier` holds the card's tags; a rule's other conditions still apply.
 */
export function GearHitAdds(rules, carrier, target, state = {}) {
  const out = { damage: 0, addDex: 0, triggered: false };
  const live = (rules || []).filter(rule => GearRuleNeedsTarget(rule) && ['damage', 'addDex'].includes(rule.stat)
    && GearSelectorMatches(rule.selector, rule.arg, carrier) && rule.conds.every(cond => GearRuleCondMet(cond, target, state)));
  for (const rule of GearCategoryOverlap(live, carrier)) {
    if (rule.stat === 'damage') out.damage += rule.amount; else out.addDex += rule.amount;
    out.triggered = true;
  }
  return out;
}

/** Hit riders: the statuses a matching hit applies and the stacks it removes, for `proposalHitRules`. */
export function GearHitRiders(rules, carrier, target, state = {}) {
  const applies = [], removes = [], pushes = [];
  // The break pass runs the break riders only.
  const live = (rules || []).filter(rule => !(state.poiseBreak && !rule.conds.some(cond => cond.name === 'breaks'))
    && GearSelectorMatches(rule.selector, rule.arg, carrier) && rule.conds.every(cond => GearRuleCondMet(cond, target, state)));
  for (const rule of GearCategoryOverlap(live, carrier, riderField)) {
    if (rule.push) pushes.push({ bands: rule.push });
    else if (rule.remove) removes.push({ status: rule.remove, stacks: rule.stacks }); else applies.push({ status: rule.status, stacks: rule.stacks });
  }
  return { applies, removes, pushes };
}

/**
 * GearAlwaysOn(registries, run) -> { rules, state }: the card rules a face outside combat reads (owner, 2026-11-18, ruling 15). Always-on gear is part of the
 * baseline face and prints black; a triggered rule (stance, first play, target) only exists in the fight, where it colours the number it changes.
 */
export function GearAlwaysOn(registries, run) {
  if (!run?.loadout || !registries) return { rules: [], state: {} };
  const classId = run.class ?? run.player?.classId;
  const summary = GearSummary(registries, run.loadout, classId, run);
  return { rules: summary.cardRules.filter(rule => !GearRuleTriggered(rule)), state: { weaponType: summary.mainWeaponType } };
}

// ---- text, generated from the data ---------------------------------------------------------------------------------------------------------------

const humanize = id => String(id).replace(/([a-z\d])([A-Z])/g, '$1 $2').toLowerCase();
const COND_WORDS = { stance: arg => `in ${arg[0].toUpperCase()}${arg.slice(1)} stance`, first: arg => (arg === 'fight' ? 'the first one each fight' : 'the first one each turn'),
  holding: arg => `while holding ${arg[0].toUpperCase()}${arg.slice(1)}`,
  weapon: arg => `with a ${humanize(arg)}`, breaks: () => 'that break Poise', target: arg => ({ retreating: 'against a Retreat-stacked target', backRow: 'against a back-row enemy', frontRow: 'against a front-row enemy' })[arg] || arg };
const SELECTOR_WORDS = { any: 'cards', attack: 'attacks', sweep: 'Sweeps', smash: 'Smashes', counter: 'Counter cards', defend: 'Defend cards', anyAttack: 'physical attacks',
  zeroCost: '0-cost attacks', blockCard: 'Block cards', spell: 'spells', healSpell: 'healing spells', arcaneSpell: 'Arcane spells', divineSpell: 'Divine spells' };
const capitalize = text => `${text[0].toUpperCase()}${text.slice(1)}`;
// Selectors whose argument reads as part of the noun ("Fire spells" rather than "spells (fire)").
const SELECTOR_ARG_WORDS = {
  schoolSpell: arg => `${capitalize(arg)} spells`,
};

/** The cards a mod names, in words. */
function selectorWords(mod)
{
  const argWords = SELECTOR_ARG_WORDS[mod.selector];
  if (argWords && mod.arg)
  {
    return argWords(mod.arg);
  }
  const noun = SELECTOR_WORDS[mod.selector] || humanize(mod.selector);
  return mod.arg
    ? `${noun} (${mod.arg})`
    : noun;
}

const LABEL_ONLY_FIELDS = new Set([
  'cardReach',
  'cardRetain',
  'cardEscalate',
]);

/** What a non-Initiate mod does, in words ("+1 Damage", "apply 2 Burn"). */
function plainModWords(spec, mod, sign)
{
  if (spec.apply === 'cardStat' && LABEL_ONLY_FIELDS.has(mod.field))
  {
    return spec.label;
  }
  if (spec.apply === 'hitStatus')
  {
    return `apply ${mod.value} ${spec.label.replace(' on hit', '')}`;
  }
  if (spec.apply === 'hitRemove')
  {
    return `remove ${mod.value} Retreat`;
  }
  if (spec.apply === 'resist' || (spec.apply === 'flag' && mod.value === 1))
  {
    return spec.label;
  }
  return `${sign} ${spec.label}`;
}

/** GearModText(registries, raw) -> one line of item text generated from the mod string and the vocabulary row ("Smashes: +1 Poise damage"). */
export function GearModText(registries, raw) {
  const mod = ParseGearMod(raw), spec = mod && registries?.equipment?.modFields?.[mod.field];
  if (!mod || !spec) return String(raw);
  const sign = `${mod.value >= 0 ? '+' : ''}${mod.value}`;
  const initiate = mod.field === INITIATE_FIELD;
  const modConds = initiate
    ? initiateConds(mod.conds)
    : mod.conds;
  const condWords = cond => (COND_WORDS[cond.name] || (() => cond.name))(cond.arg || '');
  const conds = modConds.map(condWords).join(', ');
  const where = mod.selector === 'self' ? '' : mod.selector === 'start' ? 'Start of turn' : mod.selector === 'end' ? 'End of turn'
    : selectorWords(mod);
  const what = initiate
    ? `${spec.label}, ${sign} MP cost`
    : plainModWords(spec, mod, sign);
  const head = [where, conds].filter(Boolean).join(' ');
  const text = head ? `${head}: ${what}` : what;
  return `${text[0].toUpperCase()}${text.slice(1)}`;
}

/** The counters, held stacks and stance a pure gear condition reads. */
export const GearConditionState = (entity, weaponType = null) => ({
  stance: entity?.combatStance?.maneuver,
  attacksPlayedThisCombat: entity?.counters?.attacksPlayedThisCombat || 0,
  spellsPlayedThisTurn: entity?.counters?.spellsPlayedThisTurn || 0,
  weaponType,
  holding: { counter: entity?.counterStacks || 0, evade: entity?.statuses?.evade?.stacks || 0 },
});

/** The one Initiate cut a spell takes: the largest that matches, however many pieces carry one. */
function strongestInitiate(rules)
{
  const initiates = rules.filter(rule => rule.initiate);
  if (!initiates.length)
  {
    return [];
  }
  const strongest = initiates.reduce((best, rule) =>
    rule.amount < best.amount
      ? rule
      : best
  );
  return [strongest];
}

/**
 * Gear Mana changes apply once to the final price, after surcharges; authored prices stay intact
 * and only the result floors.
 * Every non-Initiate change applies, then at most one Initiate cut.
 */
export function GearManaCost(def, price)
{
  const rules = def?.gearManaRules || [];
  const applied = [
    ...rules.filter(rule => !rule.initiate),
    ...strongestInitiate(rules),
  ];
  return Math.max(0, applied.reduce((value, rule) => adjust(value, rule), price));
}
