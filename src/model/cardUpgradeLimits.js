// How many Core card upgrades are free, what the next one costs, and whether it
// can be bought (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md, owner rulings of
// 2026-10-28). Pure reads of the run: nothing here mutates.
import { basicCardKind } from './basicCardRule.js';
import { cardTrackLevel } from './skills.js';
import { upgradeCount, MAX_CARD_UPGRADES } from './cardUpgrade.js';

/**
 * freeAllowance(run, def[, registries]) → F. A Basic or cantrip card gets 1;
 * every other card gets 1 + R, R being the highest skill-track level over the
 * tracks whose schools match the card (0..10).
 */
export function freeAllowance(run, def, registries) {
  if (!def) return 0;
  if (basicCardKind(run, def)) return 1;
  return 1 + (registries ? cardTrackLevel(registries, run, def) : 0);
}

/**
 * upgradeCost(run, instance, def[, registries]) → the Smithing Stones the NEXT
 * upgrade costs: 0 while its number n (1-based) is within F, else 1; null when
 * the card is at the 10-upgrade cap.
 */
export function upgradeCost(run, instance, def, registries) {
  const n = upgradeCount(instance) + 1;
  if (n > MAX_CARD_UPGRADES) return null;
  return n <= freeAllowance(run, def, registries) ? 0 : 1;
}

const stonesOf = (run) => (Number.isSafeInteger(run && run.smithingStones) ? run.smithingStones : 0);

/**
 * canUpgrade(registries, run, instance) → { ok, code, reason, cost, n, free }.
 * Codes: 'missing' (not a known card), 'bound' (equipment-bound cards upgrade
 * with their armament), 'cap', 'stones'.
 */
export function canUpgrade(registries, run, instance) {
  const def = instance && registries.cards.has(instance.cardId) ? registries.cards.get(instance.cardId) : null;
  const n = upgradeCount(instance) + 1;
  const refuse = (code, reason, cost = null) => ({ ok: false, code, reason, cost, n, free: null });
  if (!def) return refuse('missing', 'That card is not in the deck.');
  if (instance.sourceArmamentId || instance.grantedBy) return refuse('bound', `${def.name} is upgraded with its armament.`);
  const cost = upgradeCost(run, instance, def, registries);
  if (cost === null) return refuse('cap', `${def.name} is already at ${MAX_CARD_UPGRADES} upgrades.`);
  if (cost > stonesOf(run)) return refuse('stones', `Needs ${cost} Smithing Stone; you have ${stonesOf(run)}.`, cost);
  return { ok: true, code: '', reason: '', cost, n, free: cost === 0 };
}
