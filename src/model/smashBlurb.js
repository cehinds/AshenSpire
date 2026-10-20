// Leaf of smashClause.js: the Smash tag-blurb swap and the shared text fill. Reads the profile through model/profileModule.js only,
// so combatCardProfile.js can import it without the smashClause -> gameProfileCombat -> stanceRules -> combatCardProfile cycle.
// Core (FixCore) Smash text, one shared source for every card tagged maneuver:smash (no per-card edits).
// Under a Core profile a Smash into Defend or Prepared deals damageMultiplier x its damage plus blockFraction of the
// target's Block, poiseFraction of that to Poise (smashVsDefensive in fixCoreMechanics.json). The words are read from the
// same rules combat uses, so a profile with other numbers says them; other profiles keep the legacy wording.
import { fixCoreEnabled, fixCoreRules, fixCoreSmashVsDefensiveRules } from './fixCoreMechanics.js';
import { configuredModule } from './profileModule.js';
import { uiStrings } from '../content/generated/uiStrings.js';

const row = id => {
  const text = uiStrings.find(r => r.id === id)?.full;
  if (!text) throw new Error(`uiStrings: '${id}' has no full form`);
  return text;
};
const num = n => String(Math.round(n * 1000) / 1000);
const FRACTIONS = new Map([[0.25, 'a quarter'], [0.5, 'half'], [0.75, 'three quarters'], [1, 'all']]);
const multWord = m => (m === 2 ? 'double' : `${num(m)}×`);
const fractionWord = f => FRACTIONS.get(f) ?? `${num(f * 100)}%`;
export const ruleCtx = ctx => ({ combatExpansionVersion: 2, gameProfile: ctx?.gameProfile, fixCoreRules: ctx?.fixCoreRules });
const list = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
/** The defender stances Smash beats, read from the active stances.matchups.smash exactly as profileDamageReceipt does ([] when it beats none). */
export const smashBeatsStances = ctx => {
  const stances = configuredModule(ctx, 'stances');
  return stances?.include?.includes('smash') ? [...new Set(stances.matchups?.smash || [])] : [];
};
const stanceName = id => uiStrings.find(r => r.id === `stance.name.${id}`)?.short || id.charAt(0).toUpperCase() + id.slice(1);
export const fill = (id, ctx) => {
  const rules = fixCoreSmashVsDefensiveRules(fixCoreRules(ruleCtx(ctx)));
  const words = { mult: multWord(rules.damageMultiplier), block: fractionWord(rules.blockFraction), poise: fractionWord(rules.poiseFraction), stances: list(smashBeatsStances(ctx).map(stanceName)) };
  return row(id).replace(/\{(\w+)\}/g, (whole, key) => words[key] ?? whole);
};
/** A resolved tag row with the Core Smash help swapped in for maneuver:smash under a Core profile; any other row is returned as is. */
export const withCoreSmashBlurb = (tag, ctx) => tag?.id === 'maneuver:smash' && fixCoreEnabled(ruleCtx(ctx)) && smashBeatsStances(ctx).length > 0
  ? { ...tag, blurb: fill('tag.smash.coreHelp', ctx) } : tag;
