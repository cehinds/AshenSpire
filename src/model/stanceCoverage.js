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

/**
 * Up to `reservedSlots` card ids for the offer: each a basic/cantrip card (from `eligibleIds`) of a stance the
 * character lacks, distinct stances, seeded draws on `stream`. Draws nothing when no candidate exists.
 */
export function reserveStanceCards(registries, run, rng, stream, eligibleIds) {
  const rule = stanceCoverageRule(run);
  if (!rule) return [];
  const inTier = tierMembers(registries, run, rule), byStance = new Map();
  for (const stance of missingBasicStances(run, registries)) {
    const ids = eligibleIds.filter(id => inTier(id) && stanceOfId(registries, id) === stance);
    if (ids.length) byStance.set(stance, ids);
  }
  const picked = [];
  while (picked.length < rule.reservedSlots && byStance.size) {
    const stance = rng.pick(stream, [...byStance.keys()]);
    picked.push(rng.pick(stream, byStance.get(stance)));
    byStance.delete(stance);
  }
  return picked;
}
