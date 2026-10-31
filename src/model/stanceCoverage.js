// Core card rewards cover the basic stances (owner, 2026-10-19). While the character owns no card
// of some stance (deck + collection), an offer reserves a slot for a basic or cantrip card of one.
// Rules live in the reward-ranks module's `stanceCoverage` setting; nothing here is a constant.
import { gameModule, gameContent } from './gameProfile.js';
import { stanceOf } from './stanceRules.js';

const STANCE_ALIAS = Object.freeze({ prepared: 'casting' });
const CANTRIP_TAG = 'rank.cantrip';

/** The enabled stanceCoverage rule of a run's profile, or null. */
export function stanceCoverageRule(run) {
  const rule = gameContent(run, 'rewards')?.eligibility?.combatCards?.stanceCoverage;
  return rule?.enabled && gameModule(run, 'stances') && gameModule(run, 'cards') && rule.reservedSlots > 0 ? rule : null;
}
const stanceIds = run => [...new Set((gameModule(run, 'stances')?.include || []).map(id => STANCE_ALIAS[id] || id))];
const stanceOfId = (registries, id) => { try { return stanceOf(registries.cards.get(id))?.maneuver ?? null; } catch { return null; } };

/** Stances of the profile with no owned card (deck + sideboard), in the module's authored order. Pure. */
export function missingBasicStances(run, registries) {
  const owned = new Set([...(run.deck || []), ...(run.sideboard || [])].map(card => stanceOfId(registries, card?.cardId ?? card?.id ?? card)));
  return stanceIds(run).filter(stance => !owned.has(stance));
}

// Basic = named by a cardPools entry outside excludePools; cantrip = tagged rank.cantrip.
function tierMembers(registries, run, rule) {
  const basic = new Set();
  for (const [pool, row] of Object.entries(gameContent(run, 'cardPools') || {})) {
    if (rule.excludePools.includes(pool)) continue;
    for (const id of [...Object.values(row.byTag || {}), ...Object.values(row.byClass || {}).flatMap(byTag => Object.values(byTag))]) basic.add(id);
  }
  const isCantrip = id => (registries.cards.get(id).cardTags || registries.cards.get(id).tags || []).some(tag => (tag.id ?? tag) === CANTRIP_TAG);
  return id => (rule.preferTiers.includes('basic') && basic.has(id)) || (rule.preferTiers.includes('cantrip') && isCantrip(id));
}

/** basicOrCantripMatcher(registries, run) → id => boolean: the card is a basic (named by a card pool outside `special`) or a rank.cantrip card. */
export function basicOrCantripMatcher(registries, run) {
  const rule = gameContent(run, 'rewards')?.eligibility?.combatCards?.stanceCoverage;
  return tierMembers(registries, run, { preferTiers: ['basic', 'cantrip'], excludePools: rule?.excludePools || ['special'] });
}

/**
 * Up to min(`reservedSlots`, `limit`) card ids for the offer: each a basic/cantrip card (from `eligibleIds`) of a stance the
 * character lacks, distinct stances, seeded draws on `stream`. Draws nothing when no candidate exists.
 */
export function reserveStanceCards(registries, run, rng, stream, eligibleIds, limit = Infinity) {
  const rule = stanceCoverageRule(run);
  const slots = Math.min(rule?.reservedSlots ?? 0, limit);   // never draw for a slot the offer cannot show
  if (!rule || !(slots > 0)) return [];
  const inTier = tierMembers(registries, run, rule), byStance = new Map();
  for (const stance of missingBasicStances(run, registries)) {
    const ids = eligibleIds.filter(id => inTier(id) && stanceOfId(registries, id) === stance);
    if (ids.length) byStance.set(stance, ids);
  }
  // Owner 2026-10-31: a card shown in an earlier offer is drawn at offeredCopyWeight^timesOffered (a stance by the mean of its cards);
  // with no history or the weight at 1 every weight is equal and the draw is the old uniform rng.pick, so existing seeds hold.
  const base = gameContent(run, 'rewards')?.eligibility?.combatCards?.offeredCopyWeight, history = run.rewardOfferHistory?.cards || {};
  const weightOf = id => (Number.isFinite(base) && base !== 1 ? Math.pow(base, history[id] || 0) : 1);
  const pickWeighted = (items, weight) => {
    const weights = items.map(weight), total = weights.reduce((sum, value) => sum + value, 0);
    if (items.length < 2 || !(total > 0) || weights.every(value => value === weights[0])) return rng.pick(stream, items);
    let roll = rng.float(stream) * total;
    for (const [index, item] of items.entries()) { roll -= weights[index]; if (roll < 0) return item; }
    return items.at(-1);
  };
  const picked = [];
  while (picked.length < slots && byStance.size) {
    const stance = pickWeighted([...byStance.keys()], key => byStance.get(key).reduce((sum, id) => sum + weightOf(id), 0) / byStance.get(key).length);
    picked.push(pickWeighted(byStance.get(stance), weightOf));
    byStance.delete(stance);
  }
  return picked;
}
