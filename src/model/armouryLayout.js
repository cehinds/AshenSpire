// src/model/armouryLayout.js — the data contract for the Armoury shell.
//
// This module is deliberately pure. Content authors tune the proportions and
// order in content/source/armouryUi.json; the UI reads this normalized shape
// and never embeds a second set of layout numbers.

const DEFAULTS = Object.freeze({
  shell: { characterRatio: 0.4, equipmentRatio: 0.6, gapRem: 1.6 },
  character: { spriteRatio: 0.38, statsRatio: 0.62, statsPaneRatio: 0.6, minWidth: '0' },
  equipment: {
    groupLabel: 'Armaments', outerBorder: false, slotOrder: ['armor', 'rightHand', 'leftHand'], defaultView: 'list', gridColumns: 3,
  },
  inventorySplit: {
    defaultArmamentsRatio: 0.6,
    minimumArmamentsRatio: 0.3,
    maximumArmamentsRatio: 0.8,
    snapRatios: [0.4, 0.5, 0.6, 0.7],
    snapTolerance: 0.035,
    compactItemsBelowPx: 520,
    foldSubcardsBelowPx: 420,
    foldGroupsBelowPx: 260,
  },
  trays: {
    defaultHeightRatio: 0.45,
    minimumHeightRatio: 0.3,
    maximumHeightRatio: 0.9,
    multipleExpandedMinimumRatio: 0.3,
    snapRatios: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    snapTolerance: 0.035,
    contentGapRem: 0.35,
  },
  combatPower: {
    groupLabel: 'Combat Power',
    cards: [
      { id: 'strike', role: 'attack', label: 'Strike', fullLabel: 'Strike Power' },
      { id: 'potency', role: 'technique', label: 'Magic', fullLabel: 'Magic Power' },
      { id: 'defense', role: 'guard', label: 'Defense', fullLabel: 'Guard / Defense' },
    ],
  },
  cards: { defaultView: 'list', gridColumns: 4 },
  comparison: {
    presentation: 'tooltip', hoverDelayMs: 550, tooltipWidthRem: 52, tooltipMaxHeightRatio: 0.8,
  },
  cardClasses: { inventoryItem: { holdAction: false } },
  viewModes: {
    grid: { label: 'Character', pane: 'character', character: 'expanded', armaments: 'folded', inventory: 'folded', cards: 'expanded' },
    rack: { label: 'Inventory', pane: 'inventory', character: 'folded', armaments: 'expanded', inventory: 'expanded', cards: 'folded' },
    hybrid: { label: 'Hybrid', pane: 'both', character: 'folded', armaments: 'folded', inventory: 'folded', cards: 'folded' },
  },
  responsive: {
    breakpoint: 760,
    phone: { minWidth: '0', characterRatio: 0.4, equipmentRatio: 0.6, cardsGridColumns: 2, armamentGridColumns: 2 },
  },
});

const ratio = (value, path) => {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new Error(`armouryUi.layout.${path} must be a number between 0 and 1`);
  }
  return value;
};

const positive = (value, path) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`armouryUi.layout.${path} must be positive`);
  return value;
};

/**
 * Normalize and validate authored Armoury layout content.
 *
 * The returned object is detached from the JSON module so callers can attach
 * CSS variables without mutating the frozen content registry.
 */
export function normalizeArmouryLayout(source = {}) {
  const raw = source && typeof source === 'object' ? source : {};
  const shell = { ...DEFAULTS.shell, ...(raw.shell || {}) };
  const character = { ...DEFAULTS.character, ...(raw.character || {}) };
  const equipment = { ...DEFAULTS.equipment, ...(raw.equipment || {}) };
  const inventorySplit = { ...DEFAULTS.inventorySplit, ...(raw.inventorySplit || {}) };
  const trays = { ...DEFAULTS.trays, ...(raw.trays || {}) };
  const combatPower = { ...DEFAULTS.combatPower, ...(raw.combatPower || {}) };
  const cards = { ...DEFAULTS.cards, ...(raw.cards || {}) };
  const comparison = { ...DEFAULTS.comparison, ...(raw.comparison || {}) };
  const cardClasses = { ...DEFAULTS.cardClasses, ...(raw.cardClasses || {}) };
  const inventoryItemClass = { ...DEFAULTS.cardClasses.inventoryItem, ...(cardClasses.inventoryItem || {}) };
  const viewModes = { ...DEFAULTS.viewModes, ...(raw.viewModes || {}) };
  const responsive = { ...DEFAULTS.responsive, ...(raw.responsive || {}) };
  const phone = { ...DEFAULTS.responsive.phone, ...(responsive.phone || {}) };

  const shellTotal = Number(shell.characterRatio) + Number(shell.equipmentRatio);
  if (Math.abs(shellTotal - 1) > 0.0001) {
    throw new Error(`armouryUi.layout.shell ratios must total 1 (got ${shellTotal})`);
  }
  const characterTotal = Number(character.spriteRatio) + Number(character.statsRatio);
  if (Math.abs(characterTotal - 1) > 0.0001) {
    throw new Error(`armouryUi.layout.character ratios must total 1 (got ${characterTotal})`);
  }
  const phoneTotal = Number(phone.characterRatio) + Number(phone.equipmentRatio);
  if (Math.abs(phoneTotal - 1) > 0.0001) {
    throw new Error(`armouryUi.layout.responsive.phone ratios must total 1 (got ${phoneTotal})`);
  }
  if (!Array.isArray(equipment.slotOrder) || new Set(equipment.slotOrder).size !== equipment.slotOrder.length
    || equipment.slotOrder.some((id) => typeof id !== 'string' || !id)) {
    throw new Error('armouryUi.layout.equipment.slotOrder must contain unique non-empty slot ids');
  }
  if (!['list', 'grid'].includes(equipment.defaultView)) {
    throw new Error('armouryUi.layout.equipment.defaultView must be list or grid');
  }
  if (!Number.isInteger(Number(equipment.gridColumns)) || Number(equipment.gridColumns) < 1 || Number(equipment.gridColumns) > 8) {
    throw new Error('armouryUi.layout.equipment.gridColumns must be an integer from 1 to 8');
  }
  if (!Array.isArray(inventorySplit.snapRatios) || !inventorySplit.snapRatios.length
    || inventorySplit.snapRatios.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) >= 1)) {
    throw new Error('armouryUi.layout.inventorySplit.snapRatios must contain ratios between 0 and 1');
  }
  if (Number(inventorySplit.minimumArmamentsRatio) >= Number(inventorySplit.maximumArmamentsRatio)) {
    throw new Error('armouryUi.layout.inventorySplit minimum ratio must be below its maximum ratio');
  }
  if (!Array.isArray(trays.snapRatios) || !trays.snapRatios.length
    || trays.snapRatios.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) >= 1)) {
    throw new Error('armouryUi.layout.trays.snapRatios must contain ratios between 0 and 1');
  }
  if (Number(trays.minimumHeightRatio) >= Number(trays.maximumHeightRatio)) {
    throw new Error('armouryUi.layout.trays minimum ratio must be below its maximum ratio');
  }
  if (Number(trays.defaultHeightRatio) < Number(trays.minimumHeightRatio)
    || Number(trays.defaultHeightRatio) > Number(trays.maximumHeightRatio)) {
    throw new Error('armouryUi.layout.trays.defaultHeightRatio must be within the tray minimum and maximum');
  }
  if (Number(trays.multipleExpandedMinimumRatio) < Number(trays.minimumHeightRatio)
    || Number(trays.multipleExpandedMinimumRatio) > Number(trays.maximumHeightRatio)) {
    throw new Error('armouryUi.layout.trays.multipleExpandedMinimumRatio must be within the tray minimum and maximum');
  }
  positive(Number(trays.contentGapRem), 'trays.contentGapRem');
  const trayStops = trays.snapRatios.map(Number);
  if (new Set(trayStops).size !== trayStops.length
    || trayStops.some((value) => value < Number(trays.minimumHeightRatio) || value > Number(trays.maximumHeightRatio))) {
    throw new Error('armouryUi.layout.trays.snapRatios must be unique and within the tray minimum and maximum');
  }
  if (!Array.isArray(combatPower.cards) || combatPower.cards.length !== 3
    || combatPower.cards.some((card) => !card || !card.id || !card.role || !card.label || !card.fullLabel)) {
    throw new Error('armouryUi.layout.combatPower.cards must declare three labelled power cards');
  }
  if (!['list', 'grid'].includes(cards.defaultView)) {
    throw new Error('armouryUi.layout.cards.defaultView must be list or grid');
  }
  if (!Number.isInteger(Number(cards.gridColumns)) || Number(cards.gridColumns) < 1 || Number(cards.gridColumns) > 8) {
    throw new Error('armouryUi.layout.cards.gridColumns must be an integer from 1 to 8');
  }
  if (!['tooltip', 'inline'].includes(comparison.presentation)) {
    throw new Error('armouryUi.layout.comparison.presentation must be tooltip or inline');
  }
  if (!Number.isInteger(Number(comparison.hoverDelayMs)) || Number(comparison.hoverDelayMs) < 0
    || Number(comparison.hoverDelayMs) > 600000) {
    throw new Error('armouryUi.layout.comparison.hoverDelayMs must be an integer from 0 to 600000');
  }
  positive(Number(comparison.tooltipWidthRem), 'comparison.tooltipWidthRem');
  ratio(Number(comparison.tooltipMaxHeightRatio), 'comparison.tooltipMaxHeightRatio');
  if (typeof inventoryItemClass.holdAction !== 'boolean') {
    throw new Error('armouryUi.layout.cardClasses.inventoryItem.holdAction must be true or false');
  }
  if (!Number.isInteger(Number(phone.cardsGridColumns)) || Number(phone.cardsGridColumns) < 1 || Number(phone.cardsGridColumns) > 8) {
    throw new Error('armouryUi.layout.responsive.phone.cardsGridColumns must be an integer from 1 to 8');
  }
  if (!Number.isInteger(Number(phone.armamentGridColumns)) || Number(phone.armamentGridColumns) < 1 || Number(phone.armamentGridColumns) > 8) {
    throw new Error('armouryUi.layout.responsive.phone.armamentGridColumns must be an integer from 1 to 8');
  }
  const paneValues = new Set(['character', 'inventory', 'both']);
  for (const [id, mode] of Object.entries(viewModes)) {
    if (!mode || !paneValues.has(mode.pane)) {
      throw new Error(`armouryUi.layout.viewModes.${id}.pane must be character, inventory, or both`);
    }
  }

  return Object.freeze({
    shell: Object.freeze({
      characterRatio: ratio(Number(shell.characterRatio), 'shell.characterRatio'),
      equipmentRatio: ratio(Number(shell.equipmentRatio), 'shell.equipmentRatio'),
      gapRem: positive(Number(shell.gapRem), 'shell.gapRem'),
    }),
    character: Object.freeze({
      spriteRatio: ratio(Number(character.spriteRatio), 'character.spriteRatio'),
      statsRatio: ratio(Number(character.statsRatio), 'character.statsRatio'),
      statsPaneRatio: ratio(Number(character.statsPaneRatio), 'character.statsPaneRatio'),
      minWidth: String(character.minWidth || '0'),
    }),
    equipment: Object.freeze({
      groupLabel: String(equipment.groupLabel || DEFAULTS.equipment.groupLabel),
      outerBorder: equipment.outerBorder !== false,
      slotOrder: Object.freeze([...equipment.slotOrder]),
      defaultView: String(equipment.defaultView),
      gridColumns: Number(equipment.gridColumns),
    }),
    inventorySplit: Object.freeze({
      defaultArmamentsRatio: ratio(Number(inventorySplit.defaultArmamentsRatio), 'inventorySplit.defaultArmamentsRatio'),
      minimumArmamentsRatio: ratio(Number(inventorySplit.minimumArmamentsRatio), 'inventorySplit.minimumArmamentsRatio'),
      maximumArmamentsRatio: ratio(Number(inventorySplit.maximumArmamentsRatio), 'inventorySplit.maximumArmamentsRatio'),
      snapRatios: Object.freeze(inventorySplit.snapRatios.map((value) => ratio(Number(value), 'inventorySplit.snapRatios'))),
      snapTolerance: ratio(Number(inventorySplit.snapTolerance), 'inventorySplit.snapTolerance'),
      compactItemsBelowPx: positive(Number(inventorySplit.compactItemsBelowPx), 'inventorySplit.compactItemsBelowPx'),
      foldSubcardsBelowPx: positive(Number(inventorySplit.foldSubcardsBelowPx), 'inventorySplit.foldSubcardsBelowPx'),
      foldGroupsBelowPx: positive(Number(inventorySplit.foldGroupsBelowPx), 'inventorySplit.foldGroupsBelowPx'),
    }),
    trays: Object.freeze({
      defaultHeightRatio: ratio(Number(trays.defaultHeightRatio), 'trays.defaultHeightRatio'),
      minimumHeightRatio: ratio(Number(trays.minimumHeightRatio), 'trays.minimumHeightRatio'),
      maximumHeightRatio: ratio(Number(trays.maximumHeightRatio), 'trays.maximumHeightRatio'),
      multipleExpandedMinimumRatio: ratio(Number(trays.multipleExpandedMinimumRatio), 'trays.multipleExpandedMinimumRatio'),
      snapRatios: Object.freeze(trays.snapRatios.map((value) => ratio(Number(value), 'trays.snapRatios'))),
      snapTolerance: ratio(Number(trays.snapTolerance), 'trays.snapTolerance'),
      contentGapRem: positive(Number(trays.contentGapRem), 'trays.contentGapRem'),
    }),
    combatPower: Object.freeze({
      groupLabel: String(combatPower.groupLabel || DEFAULTS.combatPower.groupLabel),
      cards: Object.freeze(combatPower.cards.map((card) => Object.freeze({
        id: String(card.id), role: String(card.role), label: String(card.label), fullLabel: String(card.fullLabel),
      }))),
    }),
    cards: Object.freeze({ defaultView: String(cards.defaultView), gridColumns: Number(cards.gridColumns) }),
    comparison: Object.freeze({
      presentation: String(comparison.presentation),
      hoverDelayMs: Number(comparison.hoverDelayMs),
      tooltipWidthRem: Number(comparison.tooltipWidthRem),
      tooltipMaxHeightRatio: Number(comparison.tooltipMaxHeightRatio),
    }),
    cardClasses: Object.freeze({
      inventoryItem: Object.freeze({ holdAction: inventoryItemClass.holdAction === true }),
    }),
    viewModes: Object.freeze(Object.fromEntries(Object.entries(viewModes).map(([id, mode]) => [id, Object.freeze({
      label: String(mode.label || id),
      pane: String(mode.pane),
      character: String(mode.character || 'folded'),
      armaments: String(mode.armaments || 'folded'),
      inventory: String(mode.inventory || 'folded'),
      cards: String(mode.cards || 'folded'),
    })]))),
    responsive: Object.freeze({
      breakpoint: positive(Number(responsive.breakpoint), 'responsive.breakpoint'),
      phone: Object.freeze({
        minWidth: String(phone.minWidth || '0'),
        characterRatio: ratio(Number(phone.characterRatio), 'responsive.phone.characterRatio'),
        equipmentRatio: ratio(Number(phone.equipmentRatio), 'responsive.phone.equipmentRatio'),
        cardsGridColumns: Number(phone.cardsGridColumns),
        armamentGridColumns: Number(phone.armamentGridColumns),
      }),
    }),
  });
}

/**
 * Resolve the two deliberately separate tray states.
 *
 * `savedHeightRatio` belongs to the next expanded presentation. A collapsed
 * tray has no rendered height ratio and no resize affordance; its intrinsic
 * header is the entire tray. Keeping the saved value in the receipt lets the
 * next unfold restore it without allowing it to leak into the folded layout.
 */
export function trayPresentationState({ collapsed, savedHeightRatio, defaultHeightRatio }) {
  const saved = Number.isFinite(Number(savedHeightRatio)) && Number(savedHeightRatio) > 0
    ? Number(savedHeightRatio)
    : Number(defaultHeightRatio);
  return Object.freeze({
    collapsed: collapsed === true,
    savedHeightRatio: saved,
    heightRatio: collapsed === true ? null : saved,
    resizable: collapsed !== true,
  });
}

/**
 * Resolve the mutation an Inventory item owes to the selected equipment
 * position. The selected position is the destination even when another hand
 * currently owns the item; ownership determines Move versus Equip, never the
 * destination. If the selected position already owns it, the same action is
 * Unequip.
 */
export function inventorySelectionAction({
  itemId, selectedSlotId, selectedSetIndex, selectedItemId, equippedPositions = [],
}) {
  if (!itemId || !selectedSlotId || !Number.isInteger(Number(selectedSetIndex)) || Number(selectedSetIndex) < 0) {
    throw new Error('inventorySelectionAction requires an item and a selected equipment position');
  }
  const equippedHere = selectedItemId === itemId;
  const equippedElsewhere = (equippedPositions || []).some((position) => (
    position && position.itemId === itemId
    && (position.slotId !== selectedSlotId || Number(position.setIndex) !== Number(selectedSetIndex))
  ));
  return Object.freeze({
    kind: equippedHere ? 'unequip' : equippedElsewhere ? 'move' : 'equip',
    slotId: selectedSlotId,
    setIndex: Number(selectedSetIndex),
    pieceId: equippedHere ? null : itemId,
  });
}

/** Order every authored equipment group without assigning meaning to its id. */
export function orderArmourySlots(slots, layout) {
  const order = new Map(layout.equipment.slotOrder.map((id, index) => [id, index]));
  return [...(slots || [])].slice().sort((a, b) => {
    const ai = order.has(a.id) ? order.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bi = order.has(b.id) ? order.get(b.id) : Number.MAX_SAFE_INTEGER;
    return ai - bi || (a.order || 0) - (b.order || 0) || String(a.id).localeCompare(String(b.id));
  });
}

const positionText = (template, fallback, index) => String(template || fallback)
  .replaceAll('{n}', String(index + 1));

/**
 * Pure presentation state for one authored equipment position.
 *
 * The slot owns its labels and position count; the renderer only iterates the
 * model's open/next/hidden state. This keeps future foot, back, talisman, or
 * additional armour positions out of named UI branches.
 */
export function equipmentPositionCardState({ slot, index, modelState, item, activeIndex }) {
  if (!slot || !slot.id || !Number.isInteger(index) || index < 0) {
    throw new Error('equipmentPositionCardState requires a slot and a non-negative integer index');
  }
  const label = positionText(slot.positionLabel, `${slot.label || slot.id} Slot {n}`, index);
  const code = positionText(slot.positionCode, `${slot.id}{n}`, index);
  const active = modelState === 'open' && index === Number(activeIndex || 0);
  const state = modelState === 'next' ? 'locked' : item ? 'occupied' : 'empty';
  const action = state === 'locked' ? 'locked' : state === 'empty' ? 'select' : active ? 'equipped' : 'equip';
  const equippedLabel = action === 'equipped'
    ? (Number(slot.sets) === 1 ? String(slot.label || code) : code)
    : '';
  return Object.freeze({ label, code, state, action, active, equippedLabel });
}
