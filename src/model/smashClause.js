// Core (FixCore) Smash text, one shared source for every card tagged maneuver:smash (no per-card edits).
// Under a Core profile a Smash into Defend or Prepared deals double damage plus a quarter of the target's Block,
// half of it to Poise (model/fixCoreMechanics.js smashVsDefensive); other profiles keep the legacy wording.
import { fixCoreEnabled } from './fixCoreMechanics.js';
import { uiStrings } from '../content/generated/uiStrings.js';

const row = id => {
  const text = uiStrings.find(r => r.id === id)?.full;
  if (!text) throw new Error(`uiStrings: '${id}' has no full form`);
  return text;
};
/** True when the card is a Smash under a Core profile; `ctx` is the registries (or any { gameProfile } holder). */
export const coreSmashCard = (def, ctx) => Array.isArray(def?.tags) && def.tags.includes('maneuver:smash')
  && fixCoreEnabled({ combatExpansionVersion: 2, gameProfile: ctx?.gameProfile });
/** The card-face sentence for a Core Smash, else ''. */
export const coreSmashClause = (def, ctx) => coreSmashCard(def, ctx) ? row('card.smash.coreClause') : '';
/** The Smash tag help under a Core profile, else null (the caller keeps the node's legacy blurb). */
export const coreSmashHelp = (def, ctx) => coreSmashCard(def, ctx) ? row('tag.smash.coreHelp') : null;
/** A resolved tag row with the Core Smash help swapped in for maneuver:smash under a Core profile; any other row is returned as is. */
export const withCoreSmashBlurb = (tag, ctx) => tag?.id === 'maneuver:smash' && fixCoreEnabled({ combatExpansionVersion: 2, gameProfile: ctx?.gameProfile })
  ? { ...tag, blurb: row('tag.smash.coreHelp') } : tag;
