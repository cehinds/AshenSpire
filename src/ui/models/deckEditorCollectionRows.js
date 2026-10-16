import { playingCardDefinition } from '../../model/playingCard.js';
import { t } from '../strings.js';

// Presentation identity only. The editor session keeps every original mint,
// owned copy and equipment grant, so grouping never changes ownership rules.
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export function deckEditorCollectionRows({ registries, run, collection }) {
  const groups = new Map();
  for (const tile of collection) {
    const definition = playingCardDefinition(registries, tile.ref, { rules: run });
    const ref = tile.ref;
    const identity = JSON.stringify(canonical({ definition, upgraded: !!ref.upgraded,
      mods: ref.mods || [], rank: ref.rank || 1, abilityRank: ref.abilityRank ?? definition.abilityRank ?? 0,
      profileId: ref.profileId || null, sourceArmamentId: ref.sourceArmamentId || null,
      ratingId: ref.ratingId || null, ratingValue: ref.ratingValue ?? null,
      smithingLevel: ref.smithingLevel || 0, equipmentEligible: tile.equipmentEligible !== false,
    }));
    if (!groups.has(identity)) groups.set(identity, []);
    groups.get(identity).push(tile);
  }
  return Object.freeze([...groups.values()].map(members => {
    if (members.length === 1) return members[0];
    const lead = members.find(row => row.unlimited) || members[0];
    const inDeck = members.reduce((count, row) => count + row.inDeck, 0);
    const unlimited = members.some(row => row.unlimited);
    const owned = unlimited ? Infinity : members.reduce((count, row) => count + row.owned + (row.key.startsWith('kept:') ? row.inDeck : 0), 0);
    // Restore a real owned copy first, then use the unlimited mint if needed.
    const add = members.find(row => row.addable && !row.unlimited) || members.find(row => row.addable);
    const removableIds = new Set(members.filter(row => row.removable).map(row => row.removeInstanceId));
    const removeInstanceId = [...(run.deck || [])].reverse().find(card => removableIds.has(card.instanceId))?.instanceId ?? null;
    return Object.freeze({ ...lead, inDeck, owned, totalOwned: owned, unlimited,
      memberKeys: Object.freeze(members.map(row => row.key)), addKey: add?.key || lead.key,
      addable: !!add, refusal: add ? '' : lead.refusal,
      removeInstanceId, removable: removeInstanceId !== null,
      countText: unlimited ? t('deckEditor.tile.basic', { inDeck }) : t('deckEditor.tile.owned', { owned, inDeck }),
    });
  }));
}
