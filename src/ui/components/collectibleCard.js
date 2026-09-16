import { renderEquipmentCard, renderEquipmentInspection } from './equipmentCard.js';
import { relicText } from './card.js';
import { assetUrl } from '../assetmap.js';
import { openModal } from './modalShell.js';
import { possessionVariant } from '../models/PossessionVariantModel.js';

// The same poker canvas, populated with the collectible's authored effects.
// No equipment statistics or invented combat values are attached to collectibles.
// WC2b1/WC2b2 and WC2c1–WC2c3: the variant model reads the relic's passives and
// triggers, or the potion's effect opcodes, and supplies the detail lines; the
// usage label follows the same data instead of calling every relic passive.
function presentation(registries, item, kind, { charges = null } = {}) {
  const potion = kind === 'Potion';
  const effect = potion ? item.textTemplate : relicText(item, registries);
  const variant = possessionVariant(registries, item, { kind: potion ? 'potion' : 'relic', charges });
  // A potion names its purpose on row one. A relic's modes lead its detail
  // lines ("Passive: …", "Trigger: …"), so row one keeps the room for its state.
  const usage = potion ? variant.usage || 'Consumable' : null;
  return {
    id: item.id, name: item.name, cardKind: kind.toLowerCase(), type: usage ? `${kind} · ${usage}` : kind,
    art: item.artAsset ? assetUrl(item.artAsset) : null,
    glyph: potion ? '⚗︎' : '◆',
    accent: item.tint || (potion ? '#87b5d0' : '#d0ac5d'),
    typeExplanation: potion ? 'A carried potion. Use it through the potion action menu.'
      : `A relic whose authored effects apply while owned.${variant.usage ? ` ${variant.usage}.` : ''}`,
    facts: [],
    variant,
    tags: [],
    effectsLabel: 'Effect', bonuses: [{ label: effect || 'No effect text authored.', explanation: effect || 'No effect text authored.' }],
    flavor: item.blurb || (potion ? 'A draught carried for the road ahead.' : 'A keepsake carried through the Spire.'),
    requirement: potion ? 'Potion slot' : 'Active while owned',
    requirementExplanation: potion ? 'An available potion slot is required to collect it.' : 'This relic applies its authored effects while it is owned.',
    rarity: item.rarity || 'common',
  };
}

export function renderCollectibleCard(registries, item, kind, options = {}) {
  const result = renderEquipmentCard(registries, item, { ...options, presentation: presentation(registries, item, kind, options) });
  result.card.classList.add('collectible-poker-card');
  return result;
}

export function renderCollectibleInspection(registries, item, kind, options = {}) {
  const result = renderEquipmentInspection(registries, item, { ...options, presentation: presentation(registries, item, kind, options) });
  result.querySelector('.equipment-poker-card').classList.add('collectible-poker-card');
  return result;
}

export function openCollectibleInspection(registries, item, kind, opener) {
  return openModal({ title: item.name, eyebrow: `${kind} information`, size: 'lg',
    className: 'card-inspection-modal', opener,
    body: renderCollectibleInspection(registries, item, kind, { interactive: false }) });
}
