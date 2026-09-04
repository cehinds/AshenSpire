// DOM-free selection authority shared by the title Load and New Game doors.
// The selected card, primary-action availability, and command target are one
// immutable projection so the screen cannot render three different answers.
import { behaviorModel } from './BehaviorModel.js';
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const VALID_KINDS = Object.freeze(['load', 'new']);

export function saveSlotSelectionModel(slots, { kind, selectedSlot = null } = {}) {
  if (!VALID_KINDS.includes(kind)) throw new Error(`Unknown save-slot selection kind: ${kind}`);

  const records = (Array.isArray(slots) ? slots : []).map(({ slot, summary }) => ({
    slot: Number(slot),
    hasSave: Boolean(summary),
    // Every row is selectable in both doors (Constantine, 2026-09-04): an
    // empty Load row leads to "start a new game here", an occupied New Game
    // row to "overwrite?". The decision door says which; this model only
    // names the command.
    selectable: true,
  }));
  const requestedSlot = Number(selectedSlot);
  const requested = records.find((record) => record.slot === requestedSlot && record.selectable) || null;
  const preferred = records.find((record) => record.selectable && (kind === 'new' ? !record.hasSave : record.hasSave))
    || records.find((record) => record.selectable)
    || null;
  // An absent selection chooses the authored default. An explicit invalid
  // selection fails closed instead of silently targeting a different slot.
  const selected = selectedSlot == null ? preferred : requested;

  const slotModels = records.map((record) => componentModel(UI.titleSaveSlot, {
    variant: record.hasSave ? 'occupied' : 'empty',
    properties: {
      slot: record.slot,
      hasSave: record.hasSave,
      selectable: record.selectable,
      selected: record.slot === selected?.slot,
    },
    accessibility: {
      role: 'button',
      pressed: record.slot === selected?.slot,
      disabled: !record.selectable,
    },
    behaviors: record.selectable ? [behaviorModel(`select-save-slot-${record.slot}`, {
      event: 'activate',
      command: 'select-save-slot',
      payload: { slot: record.slot },
    })] : [],
  }));
  const actionSlot = selected?.slot ?? null;
  const actionModel = componentModel(UI.titleModalContinueControl, {
    variant: kind,
    properties: {
      enabled: actionSlot != null,
      slot: actionSlot,
      label: 'CONTINUE',
    },
    accessibility: { role: 'button', disabled: actionSlot == null },
    behaviors: actionSlot == null ? [] : [behaviorModel(`${kind}-selected-save-slot`, {
      event: 'activate',
      command: kind === 'new' || !selected.hasSave ? 'create-in-save-slot' : 'load-save-slot',
      payload: { slot: actionSlot },
    })],
  });

  return componentModel(UI.titleSaveSlotList, {
    variant: kind,
    properties: {
      kind,
      selectedSlot: actionSlot,
      actionSlot,
      canContinue: actionSlot != null,
    },
    accessibility: { role: 'group', label: kind === 'new' ? 'New Game save slots' : 'Load Game save slots' },
    children: [...slotModels, actionModel],
  });
}
