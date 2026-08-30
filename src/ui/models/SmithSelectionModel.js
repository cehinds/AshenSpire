// A DOM-free read model for the Shrine Smith transaction.
// Selection is reversible; only the modal's explicit Confirm command commits.
import { resolveCard } from '../../model/registries.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const freeze = (value) => Object.freeze(value);

export function smithSelectionModel(registries, candidates, selectedInstanceId = null) {
  const items = candidates.map((instance) => {
    const card = resolveCard(registries, instance);
    // Keep the instance's equipment-authored profile/modifier carrier. A
    // card rewritten as Slashing Strike must not fall back to base Strike in
    // either the candidate face or the permanent-upgrade preview.
    const reference = freeze({
      ...instance,
      ...(Array.isArray(instance.mods) ? { mods: freeze([...instance.mods]) } : {}),
      upgraded: false,
    });
    return freeze({
      instanceId: instance.instanceId,
      cardId: instance.cardId,
      name: card.name,
      selected: instance.instanceId === selectedInstanceId,
      reference,
    });
  });
  const selected = items.find((item) => item.selected) || null;
  return freeze({
    component: UI.smithUpgradeModal,
    variant: selected ? 'review' : 'choose',
    properties: freeze({
      title: 'Smith',
      eyebrow: 'Shrine action',
      instruction: 'Choose one card, review its permanent upgrade, then confirm.',
      consequence: 'Confirming upgrades the selected card and leaves the Shrine.',
      candidates: freeze(items),
      selected,
      canConfirm: Boolean(selected),
      backLabel: 'Back to Shrine',
      confirmLabel: selected ? `Confirm ${selected.name}+` : 'Select a card',
    }),
    accessibility: freeze({
      label: 'Smith a card',
      description: 'Select one card, review its upgrade, or return to the Shrine without changing the run.',
    }),
  });
}
