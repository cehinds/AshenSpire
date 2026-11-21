// Core (FixCore) Smash text, one shared source for every card tagged maneuver:smash (no per-card edits).
// A Core Smash reads the multiplier for each active matchup and
// poiseFraction of the total to Poise (smashVsDefensive in fixCoreMechanics.json). The words are read from the
// same rules combat uses, so a profile with other numbers says them; other profiles keep the legacy wording.
import { configuredStance } from './profileStance.js';
import { smashBeatsStances, fill, ruleCtx, withCoreSmashBlurb } from './smashBlurb.js';
export { smashBeatsStances, withCoreSmashBlurb };
import { fixCoreEnabled } from './fixCoreMechanics.js';

/** True when the card is a Smash under a Core profile; `ctx` is the registries (or any { gameProfile, fixCoreRules } holder). */
// Smash is decided the way combat decides it (configuredStance: the effective combatProfile.maneuver, which Reframe projects, before the static maneuver tag).
// The rule needs a stance Smash beats under the active matchup table, else it never fires and the text stays silent.
// A projected Smash on a card with no damage effect (Reframe on core.defend) never calls the damage receipt, so it says nothing.
const hasDamageEffect = (def) => (def.effects || []).some(effect => effect?.op === 'damage');
export const coreSmashCard = (def, ctx) => !!def && configuredStance(def) === 'smash' && hasDamageEffect(def) && fixCoreEnabled(ruleCtx(ctx)) && smashBeatsStances(ctx).length > 0;
/** The card-face sentence for a Core Smash, else ''. */
export const coreSmashClause = (def, ctx, rules = null) => {
  const context = ruleCtx(ctx, rules);
  return coreSmashCard(def, context) ? fill('card.smash.coreClause', context) : '';
};
/** The Smash tag help under a Core profile, else null (the caller keeps the node's legacy blurb). */
export const coreSmashHelp = (def, ctx, rules = null) => {
  const context = ruleCtx(ctx, rules);
  return coreSmashCard(def, context) ? fill('tag.smash.coreHelp', context) : null;
};
