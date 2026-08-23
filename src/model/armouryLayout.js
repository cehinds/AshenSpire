// src/model/armouryLayout.js — the data contract for the Armoury shell.
//
// This module is deliberately pure. Content authors tune the proportions and
// order in content/source/armouryUi.json; the UI reads this normalized shape
// and never embeds a second set of layout numbers.

const DEFAULTS = Object.freeze({
  shell: { characterRatio: 0.4, equipmentRatio: 0.6, gapRem: 1.6 },
  character: { spriteRatio: 0.38, statsRatio: 0.62, statsPaneRatio: 0.6, minWidth: '0' },
  equipment: { groupLabel: 'Armaments', outerBorder: false, slotOrder: ['armor', 'rightHand', 'leftHand'] },
  combatPower: {
    groupLabel: 'Combat Power',
    cards: [
      { id: 'strike', role: 'attack', label: 'Strike', fullLabel: 'Strike Power' },
      { id: 'potency', role: 'technique', label: 'Potency', fullLabel: 'Technique Potency' },
      { id: 'defense', role: 'guard', label: 'Defense', fullLabel: 'Guard / Defense' },
    ],
  },
  cards: { defaultView: 'list', gridColumns: 4 },
  viewModes: {
    grid: { label: 'Character', pane: 'character', character: 'expanded', armaments: 'folded', inventory: 'folded', cards: 'expanded' },
    rack: { label: 'Inventory', pane: 'inventory', character: 'folded', armaments: 'folded', inventory: 'expanded', cards: 'folded' },
    hybrid: { label: 'Hybrid', pane: 'both', character: 'folded', armaments: 'folded', inventory: 'folded', cards: 'folded' },
  },
  responsive: {
    breakpoint: 760,
    phone: { minWidth: '0', characterRatio: 0.4, equipmentRatio: 0.6, cardsGridColumns: 2 },
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
  const combatPower = { ...DEFAULTS.combatPower, ...(raw.combatPower || {}) };
  const cards = { ...DEFAULTS.cards, ...(raw.cards || {}) };
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
  if (!Array.isArray(equipment.slotOrder) || equipment.slotOrder.length < 3
    || equipment.slotOrder[0] !== 'armor'
    || !equipment.slotOrder.includes('rightHand')
    || !equipment.slotOrder.includes('leftHand')) {
    throw new Error('armouryUi.layout.equipment.slotOrder must start with armor and include rightHand and leftHand');
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
  if (!Number.isInteger(Number(phone.cardsGridColumns)) || Number(phone.cardsGridColumns) < 1 || Number(phone.cardsGridColumns) > 8) {
    throw new Error('armouryUi.layout.responsive.phone.cardsGridColumns must be an integer from 1 to 8');
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
    }),
    combatPower: Object.freeze({
      groupLabel: String(combatPower.groupLabel || DEFAULTS.combatPower.groupLabel),
      cards: Object.freeze(combatPower.cards.map((card) => Object.freeze({
        id: String(card.id), role: String(card.role), label: String(card.label), fullLabel: String(card.fullLabel),
      }))),
    }),
    cards: Object.freeze({ defaultView: String(cards.defaultView), gridColumns: Number(cards.gridColumns) }),
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
      }),
    }),
  });
}

/** Put the authored armament group before the two hand sockets. */
export function orderArmourySlots(slots, layout) {
  const order = new Map(layout.equipment.slotOrder.map((id, index) => [id, index]));
  const rank = (slot) => {
    if (order.has(slot.id)) return order.get(slot.id);
    if (slot.hand === 'right' && order.has('rightHand')) return order.get('rightHand');
    if (slot.hand === 'left' && order.has('leftHand')) return order.get('leftHand');
    return 99;
  };
  return [...(slots || [])].slice().sort((a, b) => {
    const ai = rank(a);
    const bi = rank(b);
    return (ai ?? 99) - (bi ?? 99) || (a.order || 0) - (b.order || 0);
  });
}
