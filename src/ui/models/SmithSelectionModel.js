// A DOM-free read model for the Shrine armament Smith transaction.
// Selection is reversible; only the modal's explicit Confirm command commits.
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const freeze = (value) => Object.freeze(value);

function changeLabel(change) {
  const labels = {
    damage: 'Attack Rating',
    block: 'Guard',
    draw: 'Draw',
    discard: 'Discard',
    'cost:action': 'Action Cost',
    'cost:mana': 'Mana Cost',
    'cost:stamina': 'Stamina Cost',
  };
  return `${labels[change.op] || change.op}: ${change.before} → ${change.after}`;
}

function groupedAffected(cards) {
  const rows = new Map();
  for (const card of cards) {
    const rawChanges = card.changes.filter((change) => change.before !== change.after);
    const changes = rawChanges.map(changeLabel);
    const used = card.used !== false;
    const key = `${card.cardId}|${card.role}|${used ? 'used' : 'unused'}|${changes.join('|')}`;
    if (!rows.has(key)) rows.set(key, {
      cardId: card.cardId,
      name: card.name.replace(/\+$/, ''),
      role: card.role,
      reference: card.reference,
      scaling: card.scaling,
      changes,
      values: rawChanges,
      used,
      activeCopies: card.activeCopies ?? (used ? 1 : 0),
    });
  }
  return freeze([...rows.values()].map((row) => freeze({
    ...row,
    changes: freeze(row.changes),
    values: freeze(row.values.map((value) => freeze({ ...value }))),
  })));
}

function pieceForCandidate(registries, candidate) {
  if (candidate.itemKind === 'armor') {
    return (registries.equipment.armour || []).find((row) => row.classId === candidate.classId && row.id === candidate.itemId) || null;
  }
  if (candidate.itemKind === 'relic') return registries.relics.get(candidate.itemId);
  return (registries.equipment.armaments || []).find((row) => row.id === (candidate.itemId || candidate.armamentId)) || null;
}

function genericAffected(candidate) {
  return freeze((candidate.changes || []).map((change) => freeze({
    cardId: null,
    name: change.label,
    role: candidate.itemKind,
    reference: null,
    scaling: null,
    changes: freeze([`${change.label}: ${change.before} → ${change.after}`]),
    values: freeze([freeze({
      op: change.tag,
      label: change.label,
      before: change.before,
      after: change.after,
    })]),
  })));
}

export function smithSelectionModel(registries, plan, selectedItemRef = null) {
  const items = plan.candidates.map((candidate) => {
    const itemKind = candidate.itemKind || 'armament';
    const itemId = candidate.itemId || candidate.armamentId;
    const itemRef = candidate.itemRef || `armament/${itemId}`;
    const piece = pieceForCandidate(registries, { ...candidate, itemKind, itemId });
    if (!piece) throw new Error(`Unknown Smithing item '${itemRef}'`);
    const artAsset = itemKind === 'armor'
      ? `assets/equipment/body_${candidate.classId}_${piece.artKey || piece.id}.webp`
      : itemKind === 'armament'
        ? `assets/equipment/icon_${piece.artKey || piece.id}.webp`
        : null;
    const itemTypes = (piece.itemTypes || []).map((type) => freeze({ ...type }));
    return freeze({
      itemRef,
      itemKind,
      itemId,
      armamentId: candidate.armamentId || null,
      name: candidate.itemName || candidate.armamentName,
      selected: itemRef === selectedItemRef || candidate.armamentId === selectedItemRef,
      inventoryCount: candidate.inventoryCount,
      artAsset,
      artGlyph: itemKind === 'relic' ? (piece.icon || '') : '',
      rarity: piece.rarity || 'common',
      kindLabel: itemKind === 'armor' ? 'Armor' : itemKind === 'relic' ? 'Relic' : 'Armament',
      itemTypes: freeze(itemTypes),
      tags: freeze([...(piece.tags || [])]),
      intrinsicStats: freeze({
        attackRating: piece.attackRating ?? null,
        defenseRating: piece.defenseRating ?? null,
        weight: piece.weight ?? null,
        weaponArtManaCost: piece.weaponArtManaCost ?? null,
        uniqueSkillStaminaCost: piece.uniqueSkillStaminaCost ?? null,
      }),
      currentLevel: candidate.currentLevel,
      nextLevel: candidate.nextLevel,
      cost: candidate.cost,
      stones: candidate.stones,
      shortfall: candidate.shortfall,
      affordable: candidate.affordable,
      affectedCount: candidate.affectedCards.length,
      affectedRows: itemKind === 'armament'
        ? groupedAffected(candidate.previewCards || candidate.affectedCards)
        : genericAffected(candidate),
      requirements: freeze(candidate.requirements.map((row) => freeze({ ...row }))),
    });
  });
  const selected = items.find((item) => item.selected) || null;
  return freeze({
    component: UI.smithUpgradeModal,
    variant: selected ? 'review' : 'choose',
    properties: freeze({
      title: 'Upgrade an Item',
      eyebrow: 'Shrine action',
      instruction: 'Choose one owned item. Review its exact changes, requirements, and Stone cost.',
      consequence: 'Click Upgrade to review the change and cost. Hold Upgrade to commit immediately. The upgrade leaves the Shrine.',
      purseLabel: `${plan.stones} Smithing Stone${plan.stones === 1 ? '' : 's'}`,
      candidates: freeze(items),
      selected,
      canConfirm: Boolean(selected?.affordable),
      blockedReasons: freeze(selected && !selected.affordable
        ? [`Need ${selected.shortfall} more Smithing Stone${selected.shortfall === 1 ? '' : 's'}.`]
        : []),
      backLabel: 'Back to Shrine',
      confirmLabel: !selected
        ? 'Select an item'
        : selected.affordable
          ? `Upgrade (${selected.cost})`
          : `Upgrade (${selected.cost})`,
    }),
    accessibility: freeze({
      label: 'Upgrade an owned item',
      description: 'Select one item, review its exact changes, requirements and cost, or return without changing the run.',
    }),
  });
}
