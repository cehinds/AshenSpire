// A DOM-free read model for the smith's two card services — extract and
// install — in the shape the Smith upgrade model already has: the screen
// hands it a plan (model/cardExtraction.js) and a selection, and every
// sentence, label, cost pair and enabled state the modal shows comes out of
// here. Selection is reversible; only the modal's explicit Confirm commits.
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const freeze = (value) => Object.freeze(value);

const KIND_LABEL = Object.freeze({ weaponArt: 'Weapon Art', granted: 'Granted' });
const STATE_LABEL = Object.freeze({
  authored: 'as forged',
  installed: 'seated',
  fallback: 'emptied',
  empty: 'empty',
  open: 'open',
});

function pieceFor(registries, candidate) {
  if (candidate.itemKind === 'armor') {
    return (registries.equipment.armour || []).find((row) => row.classId === candidate.classId && row.id === candidate.itemId) || null;
  }
  return (registries.equipment.armaments || []).find((row) => row.id === candidate.itemId) || null;
}

const COPY = Object.freeze({
  extract: freeze({
    title: 'Extract a Card',
    instruction: 'Choose an item, then the card to lift out of it. The card is yours from then on; the mount shows its fallback until you seat another.',
    verb: 'Extract',
    label: 'Cards available to extract',
    idle: 'Select an item to see which of its cards can be lifted out.',
    decisionId: 'smithExtract',
  }),
  install: freeze({
    title: 'Seat a Card',
    instruction: 'Choose an item, one of its open mounts, and a card from your deck to seat in it. The card rides with the item from then on.',
    verb: 'Seat',
    label: 'Mounts open for a card',
    idle: 'Select an item to see its open mounts.',
    decisionId: 'smithInstall',
  }),
});

/**
 * mountServiceModel(registries, plan, selection, { multiUse, place })
 *
 * `selection` is { itemRef?, mountKey?, instanceId? } — the item, one of its
 * mounts, and (install only) the deck card to seat. `place` is where the
 * smith is standing: at the Shrine a commit leaves unless multi-use is on;
 * at the merchant it never leaves.
 */
export function mountServiceModel(registries, plan, selection = {}, { multiUse = false, place = 'shrine' } = {}) {
  const service = plan.service;
  const copy = COPY[service];
  if (!copy) throw new Error(`Unknown mount service '${service}'`);
  const items = plan.candidates.map((candidate) => {
    const piece = pieceFor(registries, candidate);
    if (!piece) throw new Error(`Unknown mount item '${candidate.itemRef}'`);
    const selected = candidate.itemRef === selection.itemRef;
    const mounts = candidate.mounts.map((mount) => {
      const mountSelected = selected && mount.mountKey === selection.mountKey;
      const cards = (mount.cards || []).map((card) => freeze({
        ...card,
        selected: mountSelected && card.instanceId === selection.instanceId,
      }));
      return freeze({
        ...mount,
        kindLabel: KIND_LABEL[mount.kind] || mount.kind,
        stateLabel: STATE_LABEL[mount.state] || mount.state,
        selected: mountSelected,
        cards: freeze(cards),
      });
    });
    return freeze({
      itemRef: candidate.itemRef,
      itemKind: candidate.itemKind,
      itemId: candidate.itemId,
      name: candidate.itemName,
      selected,
      equipped: candidate.equipped,
      whereLabel: candidate.equipped ? 'worn' : 'carried',
      artAsset: candidate.itemKind === 'armor'
        ? `assets/equipment/body_${candidate.classId}_${piece.artKey || piece.id}.webp`
        : `assets/equipment/icon_${piece.artKey || piece.id}.webp`,
      rarity: piece.rarity || 'common',
      kindLabel: candidate.itemKind === 'armor' ? 'Armor' : 'Armament',
      itemTypes: freeze((piece.itemTypes || []).map((type) => freeze({ ...type }))),
      tags: freeze([...(piece.tags || [])]),
      cost: candidate.cost,
      stones: candidate.stones,
      shortfall: candidate.shortfall,
      affordable: candidate.affordable,
      mounts: freeze(mounts),
    });
  });
  const selected = items.find((item) => item.selected) || null;
  const selectedMount = selected ? selected.mounts.find((mount) => mount.selected) || null : null;
  const selectedCard = service === 'install' && selectedMount ? selectedMount.cards.find((card) => card.selected) || null : null;
  const complete = service === 'extract' ? Boolean(selectedMount) : Boolean(selectedCard);
  const canConfirm = complete && Boolean(selected && selected.affordable);
  const blockedReasons = [];
  if (selected && !selected.affordable) blockedReasons.push(`Need ${selected.shortfall} more Smithing Stone${selected.shortfall === 1 ? '' : 's'}.`);
  if (selected && !selectedMount) blockedReasons.push(service === 'extract' ? 'Choose the card to extract.' : 'Choose an open mount.');
  if (service === 'install' && selectedMount && !selectedCard) blockedReasons.push('Choose the deck card to seat.');
  const leaves = place === 'shrine' && !multiUse;
  const stays = place === 'merchant' ? 'You stay with the merchant.' : (multiUse ? 'You stay at the Shrine.' : 'The work leaves the Shrine.');
  const what = service === 'extract'
    ? (selectedMount ? `${selectedMount.cardName} leaves ${selected.name} and joins your deck` : 'the card joins your deck')
    : (selectedCard ? `${selectedCard.cardName} leaves your deck and is seated in ${selected.name}` : 'the card is seated in the item');
  return freeze({
    component: UI.mountServiceModal,
    variant: selected ? (complete ? 'review' : 'choose-mount') : 'choose',
    properties: freeze({
      service,
      title: copy.title,
      eyebrow: place === 'merchant' ? 'The merchant\'s smith' : 'Shrine action',
      instruction: copy.instruction,
      listLabel: copy.label,
      idle: copy.idle,
      decisionId: copy.decisionId,
      staysAtShrine: !leaves,
      consequence: `Click ${copy.verb} to review the change and cost. Hold ${copy.verb} to commit immediately. ${stays}`,
      consequenceBadge: place === 'merchant' ? 'STAYS WITH THE MERCHANT' : (multiUse ? 'STAYS AT SHRINE' : 'LEAVES SHRINE'),
      decisionConsequence: `${what}${leaves ? ', and the work leaves the Shrine' : ''}`,
      purseLabel: `${plan.stones} Smithing Stone${plan.stones === 1 ? '' : 's'}`,
      cost: plan.cost,
      candidates: freeze(items),
      selected,
      selectedMount,
      selectedCard,
      canConfirm,
      blockedReasons: freeze(blockedReasons),
      backLabel: place === 'merchant' ? 'Back to the merchant' : 'Back to Shrine',
      confirmLabel: !selected ? 'Select an item' : `${copy.verb} (${selected.cost})`,
      verb: copy.verb,
    }),
    accessibility: freeze({
      label: copy.title,
      description: `${copy.instruction} Or return without changing the run.`,
    }),
  });
}
