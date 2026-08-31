// A DOM-free read model for the Shrine armament Smith transaction.
// Selection is reversible; only the modal's explicit Confirm command commits.
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const freeze = (value) => Object.freeze(value);

function changeLabel(change) {
  const labels = { damage: 'Damage', block: 'Block', draw: 'Draw', discard: 'Discard', applyStatus: 'Status' };
  return `${labels[change.op] || change.op}: ${change.before} → ${change.after}`;
}

function groupedAffected(cards) {
  const rows = new Map();
  for (const card of cards) {
    const changes = card.changes.filter((change) => change.before !== change.after).map(changeLabel);
    const key = `${card.cardId}|${card.role}|${changes.join('|')}`;
    const prior = rows.get(key);
    if (prior) prior.count += 1;
    else rows.set(key, { name: card.name.replace(/\+$/, ''), role: card.role, count: 1, changes });
  }
  return freeze([...rows.values()].map((row) => freeze({ ...row, changes: freeze(row.changes) })));
}

export function smithSelectionModel(registries, plan, selectedArmamentId = null) {
  const items = plan.candidates.map((candidate) => {
    const piece = (registries.equipment.armaments || []).find((row) => row.id === candidate.armamentId);
    if (!piece) throw new Error(`Unknown Smithing armament '${candidate.armamentId}'`);
    return freeze({
      armamentId: candidate.armamentId,
      name: candidate.armamentName,
      selected: candidate.armamentId === selectedArmamentId,
      inventoryCount: candidate.inventoryCount,
      artAsset: `assets/equipment/icon_${piece.artKey || piece.id}.webp`,
      rarity: piece.rarity || 'common',
      tags: freeze([...(piece.tags || [])]),
      currentLevel: candidate.currentLevel,
      nextLevel: candidate.nextLevel,
      cost: candidate.cost,
      stones: candidate.stones,
      shortfall: candidate.shortfall,
      affordable: candidate.affordable,
      affectedCount: candidate.affectedCards.length,
      affectedRows: groupedAffected(candidate.affectedCards),
    });
  });
  const selected = items.find((item) => item.selected) || null;
  return freeze({
    component: UI.smithUpgradeModal,
    variant: selected ? 'review' : 'choose',
    properties: freeze({
      title: 'Smith an Armament',
      eyebrow: 'Shrine action',
      instruction: 'Choose one owned armament. Review every sourced basic card before spending.',
      consequence: 'Confirming spends the shown Smithing Stone cost, promotes this armament for the run, and leaves the Shrine.',
      purseLabel: `${plan.stones} Smithing Stone${plan.stones === 1 ? '' : 's'}`,
      candidates: freeze(items),
      selected,
      canConfirm: Boolean(selected?.affordable),
      backLabel: 'Back to Shrine',
      confirmLabel: !selected
        ? 'Select an armament'
        : selected.affordable
          ? `Spend ${selected.cost} · Smith ${selected.name}`
          : `Need ${selected.shortfall} more Stone${selected.shortfall === 1 ? '' : 's'}`,
    }),
    accessibility: freeze({
      label: 'Smith an owned armament',
      description: 'Select one armament, review every affected basic card and the exact cost, or return without changing the run.',
    }),
  });
}
