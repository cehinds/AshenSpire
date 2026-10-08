import { resolveCard } from './registries.js';
import { combatProfileFor } from './combatCardProfile.js';
import { applyCombatExpansionMartial } from '../content/combatExpansionMartial.js';
import { orderStartingDeck, stampDeck } from './loadout.js';

const REQUIRED = { attack: 'strike', smash: 'bashingBlow', counter: 'dodgeRoll' };
const isFiller = card => !card.grantSource && ['attack', 'guard'].includes(card.equipmentRole);
const profileOf = (registries, instance) => combatProfileFor(applyCombatExpansionMartial(resolveCard(registries, instance)));

/** Creation only, after equipment composition. Never called by save migration. */
export function ensureExpandedStarterCoverage(registries, run) {
  if (run.combatExpansionVersion !== 2) return [];
  const added = [];
  const source = registries.balance?.equipment?.startingDeck?.sources?.global || 'from:global';
  for (const [maneuver, cardId] of Object.entries(REQUIRED)) {
    if (run.deck.some(instance => { const profile = profileOf(registries, instance); return profile.camp === 'physical' && profile.maneuver === maneuver; })) continue;
    if (!registries.cards.has(cardId)) throw new Error(`Expanded starter requires authored '${cardId}'`);
    const instanceId = `expansionStarter:${run.class}:${maneuver}`;
    if (run.deck.some(card => card.instanceId === instanceId)) throw new Error(`Conflicting expanded starter '${instanceId}'`);
    const authored = registries.cards.get(cardId);
    run.deck.push({ instanceId, cardId, upgraded: false, grantSource: source,
      ...(run.progressionRulesVersion === 1 && authored.gradeProfiles ? { abilityRank: 0 } : {}) });
    added.push(cardId);
  }
  if (!added.length) return added;
  // The existing cap constrains only minted filler; all bound grants survive.
  const cap = Math.max(0, Number(registries.balance?.startingDeckSize) || 0);
  const bound = run.deck.filter(card => !isFiller(card)).length;
  const targetSize = Math.max(cap, bound);
  while (run.deck.length > targetSize) {
    const index = run.deck.findLastIndex(card => isFiller(card) && card.equipmentRole === 'guard');
    const fallback = index >= 0 ? index : run.deck.findLastIndex(card => {
      if (!isFiller(card)) return false;
      const profile = profileOf(registries, card);
      return run.deck.filter(other => { const p = profileOf(registries, other); return p.camp === profile.camp && p.maneuver === profile.maneuver; }).length > 1;
    });
    if (fallback < 0) break;
    run.deck.splice(fallback, 1);
  }
  run.equipmentAttackSlotCount = run.deck.filter(card => card.equipmentRole === 'attack').length;
  stampDeck(registries, run);
  orderStartingDeck(registries, run);
  return added;
}
