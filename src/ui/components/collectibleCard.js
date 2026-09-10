import { renderEquipmentCard, renderEquipmentInspection } from './equipmentCard.js';
import { relicText } from './card.js';
import { assetUrl } from '../assetmap.js';
import { openModal } from './modalShell.js';

// The same poker canvas, populated with the collectible's authored effects.
// No equipment statistics or invented combat values are attached to collectibles.
function presentation(registries, item, kind) {
  const potion = kind === 'Potion';
  const effect = potion ? item.textTemplate : relicText(item, registries);
  const usage = potion ? 'Consumable' : 'Passive';
  return {
    id: item.id, name: item.name, cardKind: kind.toLowerCase(), type: `${kind} · ${usage}`,
    art: item.artAsset ? assetUrl(item.artAsset) : null,
    glyph: potion ? '⚗︎' : '◆',
    accent: item.tint || (potion ? '#87b5d0' : '#d0ac5d'),
    typeExplanation: potion ? 'A carried potion. Use it through the potion action menu.' : 'A relic whose authored effects apply while owned.',
    facts: [{ label: 'Usage', value: usage, explanation: potion ? 'Using this potion consumes the carried item.' : 'Relics remain owned after their effects trigger.' }],
    tags: [],
    effectsLabel: 'Effect', bonuses: [{ label: effect || 'No effect text authored.', explanation: effect || 'No effect text authored.' }],
    flavor: item.blurb || (potion ? 'A draught carried for the road ahead.' : 'A keepsake carried through the Spire.'),
    requirement: potion ? 'Potion slot' : 'Active while owned',
    requirementExplanation: potion ? 'An available potion slot is required to collect it.' : 'This relic applies its authored effects while it is owned.',
    rarity: item.rarity || 'common',
  };
}

export function renderCollectibleCard(registries, item, kind, options = {}) {
  const result = renderEquipmentCard(registries, item, { ...options, presentation: presentation(registries, item, kind) });
  result.card.classList.add('collectible-poker-card');
  return result;
}

export function renderCollectibleInspection(registries, item, kind, options = {}) {
  const result = renderEquipmentInspection(registries, item, { ...options, presentation: presentation(registries, item, kind) });
  result.querySelector('.equipment-poker-card').classList.add('collectible-poker-card');
  return result;
}

export function openCollectibleInspection(registries, item, kind, opener) {
  return openModal({ title: item.name, eyebrow: `${kind} information`, size: 'lg',
    className: 'card-inspection-modal', opener,
    body: renderCollectibleInspection(registries, item, kind, { interactive: false }) });
}
