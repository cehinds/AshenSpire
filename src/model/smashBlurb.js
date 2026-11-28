// Leaf of smashClause.js: the Smash tag-blurb swap and the shared text fill. Reads the profile through model/profileModule.js only,
// so combatCardProfile.js can import it without the smashClause -> gameProfileCombat -> stanceRules -> combatCardProfile cycle.
// Core (FixCore) Smash text, one shared source for every card tagged maneuver:smash (no per-card edits).
// A Core Smash reads the multiplier for each active matchup, plus blockFraction of the target's Block and
// poiseFraction of the total to Poise (smashVsDefensive in fixCoreMechanics.json). The words are read from the
// same rules combat uses, so a profile with other numbers says them; other profiles keep the legacy wording.
import { fixCoreEnabled, fixCoreSmashVsDefensiveRules } from './fixCoreMechanics.js';
import { fixCoreRules } from './fixCoreRulesCache.js';
import { configuredModule } from './profileModule.js';
import { uiStrings } from '../content/generated/uiStrings.js';
import { PoiseEnabled } from './simpleCombatFlags.js';

const row = id => {
  const text = uiStrings.find(r => r.id === id)?.full;
  if (!text) throw new Error(`uiStrings: '${id}' has no full form`);
  return text;
};
const num = n => String(Number(n.toFixed(3)));
const FRACTIONS = new Map([[0.25, 'a quarter'], [0.5, 'half'], [0.75, 'three quarters'], [1, 'all']]);
const multWord = m => (m === 2 ? 'double' : `${num(m)}×`);
const fractionWord = f => FRACTIONS.get(f) ?? `${num(f * 100)}%`;
export const ruleCtx = (ctx, rules = null) => ({
  combatExpansionVersion: rules?.combatExpansionVersion ?? ctx?.combatExpansionVersion ?? 2,
  gameProfile: rules && Object.hasOwn(rules, 'gameProfile') ? rules.gameProfile : ctx?.gameProfile,
  fixCoreRules: rules && Object.hasOwn(rules, 'fixCoreRules') ? rules.fixCoreRules : ctx?.fixCoreRules,
});
const list = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
/** The defender stances Smash beats, read from the active stances.matchups.smash exactly as profileDamageReceipt does ([] when it beats none). */
export const smashBeatsStances = ctx => {
  const stances = configuredModule(ctx, 'stances');
  return stances?.include?.includes('smash') ? [...new Set(stances.matchups?.smash || [])] : [];
};
const stanceName = id => uiStrings.find(r => r.id === `stance.name.${id}`)?.short || id.charAt(0).toUpperCase() + id.slice(1);
// stagger.poise off: the Smash text keeps its matchups and drops the Poise sentence.
const NO_POISE_SUFFIX = '.noPoise';
const smashTextId = (id, ctx) => PoiseEnabled(ruleCtx(ctx))
  ? id
  : `${id}${NO_POISE_SUFFIX}`;
export const fill = (textId, ctx) => {
  const id = smashTextId(textId, ctx);
  const rules = fixCoreSmashVsDefensiveRules(fixCoreRules(ruleCtx(ctx)));
  const groups = [];
  for (const stance of smashBeatsStances(ctx)) {
    const multiplier = stance === 'defend' ? rules.defendDamageMultiplier ?? rules.damageMultiplier : rules.damageMultiplier;
    let group = groups.find(row => row.multiplier === multiplier);
    if (!group) { group = { multiplier, stances: [] }; groups.push(group); }
    group.stances.push(stanceName(stance));
  }
  const matchupRow = row('card.smash.matchupClause');
  const matchups = groups.map(group => matchupRow.replace('{stances}', list(group.stances)).replace('{mult}', multWord(group.multiplier))).join(' ');
  const words = { matchups, poise: fractionWord(rules.poiseFraction) };
  return row(id).replace(/\{(\w+)\}/g, (whole, key) => words[key] ?? whole);
};
/** A resolved tag row with the Core Smash help swapped in for maneuver:smash under a Core profile; any other row is returned as is. */
export const withCoreSmashBlurb = (tag, ctx) => tag?.id === 'maneuver:smash' && fixCoreEnabled(ruleCtx(ctx)) && smashBeatsStances(ctx).length > 0
  ? { ...tag, blurb: fill('tag.smash.coreHelp', ctx) } : tag;
