// The face of the "copy a card" service on a merchant's shelf (owner 2026-11-20): the collectible poker canvas, like the
// rank-up service's face (rankUpOfferCard.js). Presentation only.
import { renderEquipmentCard } from './equipmentCard.js';
import { t, UiFullText } from '../strings.js';

/** CardCopyOfferModel(usesLeft) -> the equipment-card presentation of the service. */
export function CardCopyOfferModel(usesLeft = 1) {
  const effect = t('cardCopy.blurb');
  return {
    id: 'cardCopy', name: t('cardCopy.name'), cardKind: 'service', type: 'Service', art: null, glyph: 'skill', accent: '#8fb3c9',
    typeExplanation: UiFullText('cardCopy.name'), facts: [], tags: [],
    effectsLabel: 'Effect', bonuses: [{ label: effect, explanation: effect }],
    flavor: effect, requirement: t('cardCopy.uses', { uses: usesLeft }), requirementExplanation: effect, rarity: 'uncommon',
  };
}

/** RenderCardCopyOfferCard(registries, usesLeft, options) -> the card element (same options as renderEquipmentCard). */
export function RenderCardCopyOfferCard(registries, usesLeft = 1, options = {}) {
  const item = { id: 'cardCopy', name: t('cardCopy.name') };
  const result = renderEquipmentCard(registries, item, { ...options, presentation: CardCopyOfferModel(usesLeft) });
  result.card.classList.add('collectible-poker-card', 'card-copy-offer-card');
  return result;
}
