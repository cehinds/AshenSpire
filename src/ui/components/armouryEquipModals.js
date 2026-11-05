// The Armoury's equip flow for an Inventory item is two small modals, not an
// inline section (owner, 2026-11-05): "Choose a slot" when the item fits more
// than one open position, then the compare modal (an occupied position,
// components/equipCompareModal.js) or this file's confirm modal (an empty one).
// Both are kit modals, so Escape / the header close / the veil answer Back and
// focus returns to `opener`. The host owns the equip and every refusal.
import { openModal, button, el } from '../kit/index.js';
import { renderEquipmentCard } from './equipmentCard.js';
import { optionRowList } from './optionRowList.js';
import { t } from '../strings.js';

/**
 * openSlotChoiceModal({ options, onChoose, opener })
 *   options  [{ id, label, sub, disabled?, hint? }] — one per position; a locked
 *            position is disabled and shows its unlock hint as the sub-line.
 *   onChoose(id) runs after the modal has closed.
 */
export function openSlotChoiceModal({ options, onChoose, opener }) {
  const back = button({ label: t('common.back'), role: 'exit' });
  let list = null;
  const shell = openModal({
    title: t('armoury.slot.title'), size: 'md', className: 'equip-slot-choice', deferFocus: true,
    opener, closeLabel: t('common.back'), secondary: [back],
    initialFocus: () => list?.querySelector('button:not([disabled])') || null,
    body(host) {
      list = optionRowList(options.map((option) => ({
        id: option.id, name: option.label, text: option.disabled && option.hint ? option.hint : option.sub,
        disabled: !!option.disabled, className: 'equip-slot-option',
      })), {
        idAttr: 'data-slot-option',
        onSelect: (id) => { shell.close(); onChoose?.(id); },
      });
      host.append(list);
    },
  });
  back.addEventListener('click', () => shell.close());
  return shell;
}

/**
 * openEquipConfirmModal({ registries, item, name, slotLabel, onEquip, opener })
 *   The empty-position confirm: the item's card, Back / Equip.
 */
export function openEquipConfirmModal({ registries, item, name, slotLabel, onEquip, opener }) {
  const back = button({ label: t('common.back'), role: 'exit' });
  const equip = button({ label: t('armoury.picker.act.equip'), weight: 'primary', className: 'equip-confirm-equip' });
  const shell = openModal({
    title: t('armoury.confirm.title', { verb: t('armoury.picker.act.equip'), name, slot: slotLabel }), size: 'md', className: 'equip-confirm-modal',
    deferFocus: true, opener, closeLabel: t('common.back'), secondary: [back], primary: equip,
    initialFocus: () => equip,
    body(host) {
      const rendered = renderEquipmentCard(registries, item, { inspection: false, interactive: false, level: 'inspect', surface: 'armoury' });
      host.append(el('div', { class: 'equip-confirm-card' }, [rendered.card]));
    },
  });
  back.addEventListener('click', () => shell.close());
  equip.addEventListener('click', () => { shell.close(); onEquip?.(); });
  return shell;
}
