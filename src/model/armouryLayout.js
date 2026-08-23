// src/model/armouryLayout.js — the data contract for the Armoury shell.
//
// This module is deliberately pure. Content authors tune the proportions and
// order in content/source/armouryUi.json; the UI reads this normalized shape
// and never embeds a second set of layout numbers.

const DEFAULTS = Object.freeze({
  shell: { characterRatio: 0.64, equipmentRatio: 0.36, gapRem: 1.6 },
  character: { spriteRatio: 0.6, statsRatio: 0.4, minWidth: '0' },
  equipment: { groupLabel: 'Armaments', slotOrder: ['armaments', 'rightHand', 'leftHand'] },
  responsive: {
    breakpoint: 760,
    phone: { minWidth: '0', characterRatio: 0.46, equipmentRatio: 0.54 },
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
    || equipment.slotOrder[0] !== 'armaments'
    || !equipment.slotOrder.includes('rightHand')
    || !equipment.slotOrder.includes('leftHand')) {
    throw new Error('armouryUi.layout.equipment.slotOrder must start with armaments and include rightHand and leftHand');
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
      minWidth: String(character.minWidth || '0'),
    }),
    equipment: Object.freeze({
      groupLabel: String(equipment.groupLabel || DEFAULTS.equipment.groupLabel),
      slotOrder: Object.freeze([...equipment.slotOrder]),
    }),
    responsive: Object.freeze({
      breakpoint: positive(Number(responsive.breakpoint), 'responsive.breakpoint'),
      phone: Object.freeze({
        minWidth: String(phone.minWidth || '0'),
        characterRatio: ratio(Number(phone.characterRatio), 'responsive.phone.characterRatio'),
        equipmentRatio: ratio(Number(phone.equipmentRatio), 'responsive.phone.equipmentRatio'),
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
