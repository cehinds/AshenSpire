// Core (FixCore) Smash text, one shared source for every card tagged maneuver:smash (no per-card edits).
// Under a Core profile a Smash into Defend or Prepared deals damageMultiplier x its damage plus blockFraction of the
// target's Block, poiseFraction of that to Poise (smashVsDefensive in fixCoreMechanics.json). The words are read from the
// same rules combat uses, so a profile with other numbers says them; other profiles keep the legacy wording.
import { fixCoreEnabled, fixCoreRules, fixCoreSmashVsDefensiveRules } from './fixCoreMechanics.js';
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
const ruleCtx = ctx => ({ combatExpansionVersion: 2, gameProfile: ctx?.gameProfile, fixCoreRules: ctx?.fixCoreRules });
const fill = (id, ctx) => {
  const rules = fixCoreSmashVsDefensiveRules(fixCoreRules(ruleCtx(ctx)));
  const words = { mult: multWord(rules.damageMultiplier), block: fractionWord(rules.blockFraction), poise: fractionWord(rules.poiseFraction) };
  return row(id).replace(/\{(\w+)\}/g, (whole, key) => words[key] ?? whole);
};
/** True when the card is a Smash under a Core profile; `ctx` is the registries (or any { gameProfile, fixCoreRules } holder). */
export const coreSmashCard = (def, ctx) => Array.isArray(def?.tags) && def.tags.includes('maneuver:smash') && fixCoreEnabled(ruleCtx(ctx));
/** The card-face sentence for a Core Smash, else ''. */
export const coreSmashClause = (def, ctx) => coreSmashCard(def, ctx) ? fill('card.smash.coreClause', ctx) : '';
/** The Smash tag help under a Core profile, else null (the caller keeps the node's legacy blurb). */
export const coreSmashHelp = (def, ctx) => coreSmashCard(def, ctx) ? fill('tag.smash.coreHelp', ctx) : null;
/** A resolved tag row with the Core Smash help swapped in for maneuver:smash under a Core profile; any other row is returned as is. */
export const withCoreSmashBlurb = (tag, ctx) => tag?.id === 'maneuver:smash' && fixCoreEnabled(ruleCtx(ctx))
  ? { ...tag, blurb: fill('tag.smash.coreHelp', ctx) } : tag;
