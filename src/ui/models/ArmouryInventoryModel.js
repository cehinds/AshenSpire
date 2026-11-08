// src/ui/models/ArmouryInventoryModel.js — the Armoury inventory block's data,
// derived without a DOM or a callback: which rows are listed, how each row is
// presented (armament or not, its card class, its action label) and the picked
// position's context line. components/armouryInventory.js calls these, then
// builds the cards.
import { fitsSlot } from '../../model/loadout.js';
import { inventoryRows, inventoryItemCount } from '../../model/inventoryPresentation.js';
import { learnedClassIds } from '../../model/classLibrary.js';
import { t } from '../strings.js';

/** The categories whose rows are armaments (draggable, equipped through a slot). */
export const ARMAMENT_CATEGORIES = Object.freeze(['Armour', 'Weapon', 'Shield', 'Staff', 'Armament']);

/**
 * A learned class card is an Inventory item too (SPEC §14.3: the Inventory may equip one learned card or leave the core slot
 * empty); it is listed only when there is a choice to make (more than one learned card, or the core slot already empty), out of
 * combat, and never on a configured profile (Core 2 keeps its class fixed).
 */
export function inventoryClassChoice({ inCombat, run }) {
  return !inCombat && run.gameProfile?.foundation?.mode !== 'configured' && (learnedClassIds(run).length > 1 || run.classUnequipped === true);
}

/** An owned item with an action of its own beyond equipping: a skill book (Read), or a class card when there is a choice. */
export function inventoryRowUsable(row, { inCombat, run }) {
  return row.read === true || (row.classCard === true && inventoryClassChoice({ inCombat, run }));
}

/**
 * The rows the block lists. Owner 2026-11-06: outside a slot's picker the Armory lists only the usable non-equippable items
 * (a skill book is Read here); while a position is picked, the rows that fit its slot.
 */
export function armouryInventoryModel({ registries, run, meta, eq, picking, inCombat }) {
  const selectedSlot = picking ? eq.slots.find((slot) => slot.id === picking.slotId) : null;
  const allRows = inventoryRows(registries, run, meta);
  const rows = selectedSlot
    ? allRows.filter((row) => row.item && fitsSlot(selectedSlot, row.item))
    : allRows.filter((row) => inventoryRowUsable(row, { inCombat, run }));
  return { selectedSlot, allRows, rows, booksOnly: !selectedSlot, itemCount: inventoryItemCount(rows) };
}

/** Role -> label, for the comparison facts. */
export function combatPowerRoleLabels(layout) {
  return Object.fromEntries(layout.combatPower.cards.map((card) => [card.role, card.label]));
}

/** How one row is presented: armament or not, its card class, drag-ability and the action's words. */
export function inventoryRowPresentation(row, { target, selectedSlot, layout }) {
  const armament = Boolean(row.item && ARMAMENT_CATEGORIES.includes(row.category));
  const targetLabel = target ? `${target.slot.label} · ${target.setIndex + 1}` : '';
  const actionLabel = target
    ? (target.kind === 'unequip'
      ? t('armoury.action.unequipFrom', { slot: targetLabel })
      : t(target.kind === 'move' ? 'armoury.action.moveTo' : 'armoury.action.equipTo', { slot: targetLabel }))
    : '';
  return {
    armament,
    cardClass: armament ? layout.cardClasses.armamentItem : layout.cardClasses.inventoryItem,
    draggable: armament,
    actionLabel,
    faceActionLabel: selectedSlot ? actionLabel : '',
  };
}

/** The picked position's context line: slot, set, active or reserve, and what it holds now. */
export function inventorySelectionContextText({ slotLabel, index, activeIndex, currentName }) {
  return `${slotLabel} · ${index + 1} — ${t(index === activeIndex ? 'armoury.slot.active' : 'armoury.slot.reserve')} · ${currentName}`;
}
