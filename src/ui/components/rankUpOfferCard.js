// The face of the "rank up a card" service on a reward door or a merchant's shelf (W25-R): the poker canvas of the
// collectible cards, populated with the service's one effect. Presentation only; the claim is the host's.
import { renderEquipmentCard } from './equipmentCard.js';
import { t, UiFullText } from '../strings.js';

/** RankUpOfferModel() -> the equipment-card presentation of the service. */
export function RankUpOfferModel() {
  const effect = t('rankUp.blurb');
  return {
    id: 'cardRank', name: t('rankUp.name'), cardKind: 'service', type: 'Service', art: null, glyph: 'smith', accent: '#d0ac5d',
    typeExplanation: UiFullText('rankUp.name'), facts: [], tags: [],
    effectsLabel: 'Effect', bonuses: [{ label: effect, explanation: effect }],
    flavor: effect, requirement: 'One card', requirementExplanation: t('rankUp.blurb'), rarity: 'uncommon',
  };
}

/** RenderRankUpOfferCard(registries, options) -> the card element (same options as renderEquipmentCard). */
export function RenderRankUpOfferCard(registries, options = {}) {
  const item = { id: 'cardRank', name: t('rankUp.name') };
  const result = renderEquipmentCard(registries, item, { ...options, presentation: RankUpOfferModel() });
  result.card.classList.add('collectible-poker-card', 'rank-up-offer-card');
  return result;
}
