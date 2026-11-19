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
import { GEAR_TYPES } from '../content/gearTypes.js';
import { parseMod } from './loadout/modStrings.js';
import { equippedPieces, equippedIn } from './loadout/equipped.js';

const TARGET_CONDS = new Set(['target']);

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

/**
 * GearSummary(registries, loadout, classId) -> the folded effects of every worn piece.
 * `statPoints` and `pools` are read by the receipt and runMods; the rest is stamped on the player for the fight.
 */
export const GearTypeEffectsEnabled = subject => subject?.gameProfile?.modules?.gear?.typeEffectsVersion === 1;
export const GearVocabularyEnabled = (subject, spec) => GearTypeEffectsEnabled(subject) || !(spec?.scope === 'gear' || ['statPoint', 'flag', 'resist'].includes(spec?.apply) || ['thorns', 'thornsFire'].includes(spec?.status));

export function GearSummary(registries, loadout, classId, subject = registries) {
  const typeEffects = GearTypeEffectsEnabled(subject);
  const fields = registries?.equipment?.modFields || {};
  const worn = loadout ? equippedPieces(registries, loadout, classId) : [];
  const out = { cardRules: [], hitRules: [], turnGrants: [], playGrants: [], resist: {}, statPoints: {}, flags: {}, startStatuses: {},
    mainWeaponType: typeEffects && loadout ? GearWeaponTypeOf(equippedIn(registries, loadout, classId, 'rightHand')) : null };
  if (!typeEffects) return out;
  for (const piece of worn) for (const raw of GearPieceMods(piece, typeEffects)) {
    const mod = ParseGearMod(raw), spec = mod && fields[mod.field];
    if (!spec) continue;
    const common = { selector: mod.selector, arg: mod.arg, conds: mod.conds, source: piece.id };
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
  return true;
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
  if (kind === 'stance') return state.stance === cond.arg;
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

/**
 * ApplyGearCardRules(rules, def, state) -> a new card definition, or `def` unchanged. Only rules without a target condition apply here.
 * Applied rules are recorded on `def.gearApplied` (stat, amount, triggered) so a face can colour a triggered number; the flags Pierce, Ignore
 * Block, DEX and a second STR travel on `def.gear` to the hit carrier.
 */
export function ApplyGearCardRules(rules, def, state = {}) {
  const live = (rules || []).filter(rule => !GearRuleNeedsTarget(rule) && GearSelectorMatches(rule.selector, rule.arg, def) && rule.conds.every(cond => GearCondMet(cond, state)));
  if (!live.length || !def) return def;
  let effects = (def.effects || []).map(effect => ({ ...effect }));
  const gear = { ...(def.gear || {}) }, applied = [...(def.gearApplied || [])];
  let stamina = Number(def.resourceCosts?.sp ?? def.staminaCost ?? def.cost), mana = Number(def.resourceCosts?.mp ?? def.manaCost) || 0;
  let keywords = def.keywords, range = def.range, costGrowth = def.costGrowth;
  const hasCost = Number.isFinite(stamina);
  for (const rule of live) {
    const triggered = GearRuleTriggered(rule), n = rule.amount;
    const note = () => applied.push({ stat: rule.stat, amount: n, triggered, source: rule.source });
    if (rule.stat === 'damage') {
      let touched = false;
      for (const effect of effects) if (effect.op === 'damage' && ENEMY_AIMED.has(effect.target) && typeof effect.amount === 'number') { effect.amount = Math.max(0, adjust(effect.amount, rule)); touched = true; }
      if (touched) note();
    } else if (rule.stat === 'poiseDamage') {
      const own = effects.find(effect => effect.op === 'poiseDamage' && typeof effect.amount === 'number');
      const hit = effects.find(effect => effect.op === 'damage' && ENEMY_AIMED.has(effect.target));
      if (own) { own.amount = Math.max(0, adjust(own.amount, rule)); note(); }
      else if (hit && n > 0) { effects.splice(effects.indexOf(hit) + 1, 0, { op: 'poiseDamage', target: hit.target, amount: n }); note(); }
    } else if (rule.stat === 'block' || rule.stat === 'heal') {
      let touched = false;
      for (const effect of effects) if (effect.op === rule.stat && typeof effect.amount === 'number') { effect.amount = Math.max(0, adjust(effect.amount, rule)); touched = true; }
      if (touched) note();
    } else if (rule.stat === 'multiHit') {
      let touched = false;
      for (const effect of effects) if (effect.op === 'damage' && ENEMY_AIMED.has(effect.target)) { effect.hits = Math.max(1, (effect.hits || 1) + n); touched = true; }
      if (touched) note();
    } else if (rule.stat === 'cost' && hasCost) { stamina = Math.max(0, adjust(stamina, rule)); note(); }
    else if (rule.stat === 'manaCost') { mana = Math.max(0, adjust(mana, rule)); note(); }
    else if (rule.stat === 'reach') { if (range !== 'ranged') range = 'reach'; note(); }
    else if (rule.stat === 'retain') { keywords = [...new Set([...(keywords || []), 'retain'])]; note(); }
    else if (rule.stat === 'escalate') { costGrowth ||= { perUse: 1, max: Number.MAX_SAFE_INTEGER, stamina: 1 }; note(); }
    else if (['pierce', 'ignoreBlock', 'addDex', 'addStr'].includes(rule.stat)) { gear[rule.stat] = adjust(gear[rule.stat], rule); note(); }
  }
  const costs = hasCost ? { cost: stamina, staminaCost: stamina } : {};
  const next = { ...def, effects, ...costs, ...(mana !== (Number(def.manaCost) || 0) ? { manaCost: mana } : {}), keywords, gear, gearApplied: applied,
    ...(costGrowth ? { costGrowth } : {}), ...(range && range !== def.range ? { range, combatProfile: { ...(def.combatProfile || {}), range } } : {}) };
  if (def.resourceCosts && (hasCost || mana !== (Number(def.manaCost) || 0))) next.resourceCosts = { ...def.resourceCosts, ...(hasCost ? { sp: stamina } : {}), mp: mana };
  return next;
}

/**
 * GearHitAdds(rules, carrier, target, state) -> { damage, addDex } from the rules that read the target (Retreat-stacked, back row, front row).
 * `carrier` holds the card's tags; a rule's other conditions still apply.
 */
export function GearHitAdds(rules, carrier, target, state = {}) {
  const out = { damage: 0, addDex: 0, triggered: false };
  for (const rule of rules || []) {
    if (!GearRuleNeedsTarget(rule) || !['damage', 'addDex'].includes(rule.stat)) continue;
    if (!GearSelectorMatches(rule.selector, rule.arg, carrier)) continue;
    if (!rule.conds.every(cond => (GEAR_TYPES.conditions[cond.name]?.kind === 'target' ? GearTargetCondMet(cond, target) : GearCondMet(cond, state)))) continue;
    if (rule.stat === 'damage') out.damage += rule.amount; else out.addDex += rule.amount;
    out.triggered = true;
  }
  return out;
}

/** Hit riders: the statuses a matching hit applies and the stacks it removes, for `proposalHitRules`. */
export function GearHitRiders(rules, carrier, target, state = {}) {
  const applies = [], removes = [], pushes = [];
  for (const rule of rules || []) {
    if (state.poiseBreak && !rule.conds.some(cond => cond.name === 'breaks')) continue; // the break pass runs the break riders only
    if (!GearSelectorMatches(rule.selector, rule.arg, carrier)) continue;
    if (!rule.conds.every(cond => (GEAR_TYPES.conditions[cond.name]?.kind === 'target' ? GearTargetCondMet(cond, target) : GearCondMet(cond, state)))) continue;
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
  weapon: arg => `with a ${humanize(arg)}`, breaks: () => 'that break Poise', target: arg => ({ retreating: 'against a Retreat-stacked target', backRow: 'against a back-row enemy', frontRow: 'against a front-row enemy' })[arg] || arg };
const SELECTOR_WORDS = { any: 'cards', attack: 'attacks', sweep: 'Sweeps', smash: 'Smashes', counter: 'Counter cards', defend: 'Defend cards', anyAttack: 'physical attacks',
  zeroCost: '0-cost attacks', blockCard: 'Block cards', spell: 'spells', healSpell: 'healing spells' };

/** GearModText(registries, raw) -> one line of item text generated from the mod string and the vocabulary row ("Smashes: +1 Poise damage"). */
export function GearModText(registries, raw) {
  const mod = ParseGearMod(raw), spec = mod && registries?.equipment?.modFields?.[mod.field];
  if (!mod || !spec) return String(raw);
  const sign = `${mod.value >= 0 ? '+' : ''}${mod.value}`;
  const conds = mod.conds.map(cond => (COND_WORDS[cond.name] || (() => cond.name))(cond.arg || '')).join(', ');
  const where = mod.selector === 'self' ? '' : mod.selector === 'start' ? 'Start of turn' : mod.selector === 'end' ? 'End of turn'
    : `${SELECTOR_WORDS[mod.selector] || humanize(mod.selector)}${mod.arg ? ` (${mod.arg})` : ''}`;
  const what = spec.apply === 'cardStat' && ['cardReach', 'cardRetain', 'cardEscalate'].includes(mod.field) ? spec.label : spec.apply === 'hitStatus' ? `apply ${mod.value} ${spec.label.replace(' on hit', '')}`
    : spec.apply === 'hitRemove' ? `remove ${mod.value} Retreat` : spec.apply === 'resist' ? spec.label : spec.apply === 'flag' && mod.value === 1 ? spec.label : `${sign} ${spec.label}`;
  const head = [where, conds].filter(Boolean).join(' ');
  const text = head ? `${head}: ${what}` : what;
  return `${text[0].toUpperCase()}${text.slice(1)}`;
}
