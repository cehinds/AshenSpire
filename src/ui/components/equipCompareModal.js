// The Replace comparison (owner wireframe, 2026-11-01): after Replace and a
// candidate is picked, this confirmation stands between the pick and the
// equip. The equipped item sits on the LEFT, the candidate on the RIGHT with a
// "→" between, and the facts that move are listed under them, centred, the new
// value green when better and red when worse (model/equipmentCompare.js). It
// borrows the card-upgrade modal's frame, faces and delta nodes
// (cardUpgradeModal.js, smithPaneParts.js). The host owns the equip.
import { el, modalHead, modalFooter, button, eyebrow, statRow, stampModalSize } from '../kit/index.js';
import { renderEquipmentCard } from './equipmentCard.js';
import { deltaNode } from './smithPaneParts.js';
import { t } from '../strings.js';

const DIR = Object.freeze({ better: 'up', worse: 'down', same: 'flat', changed: 'flat' });

const focusables = (root) => [...root.querySelectorAll('button:not([disabled])')]
  .filter((node) => !node.hidden && node.getClientRects().length);

/** One comparison row: the label, then `before → after` with the new value coloured by its verdict. */
export function compareRowNode(row) {
  const delta = deltaNode(String(row.before), String(row.after));
  delta.dataset.dir = DIR[row.verdict] || 'flat';
  return statRow({
    flat: true,
    nameNode: el('b', { class: 'sr-name', text: row.label }),
    values: [delta],
    className: `equip-compare-row is-${row.verdict}`,
    attrs: { dataset: { compareRow: row.id, verdict: row.verdict } },
  });
}

/**
 * mountEquipCompareModal(host, { registries, title, current, next, rows, onBack, onEquip, returnFocusElement })
 *   current / next  { item, name } — the equipped item (left) and the candidate (right)
 *   rows            equipmentCompareRows(...)
 *   onBack()        the player went back to the picker: nothing was equipped
 *   onEquip()       the player confirmed; the host performs the existing equip
 * → { close }
 */
export function mountEquipCompareModal(host, {
  registries, title, current, next, rows, onBack, onEquip, returnFocusElement,
}) {
  const returnFocus = returnFocusElement instanceof HTMLElement ? returnFocusElement
    : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const veil = document.createElement('div');
  veil.className = 'modal-veil smith-modal-veil equip-compare-veil';
  const modal = document.createElement('section');
  modal.className = 'modal card-upgrade-modal equip-compare-modal';
  stampModalSize(modal, 'lg');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'equip-compare-title');
  modal.tabIndex = -1;
  modal.dataset.component = 'armoury.equipCompareModal';

  const head = modalHead({ title, titleId: 'equip-compare-title', closeLabel: t('common.back') });
  const face = (side, entry) => el('figure', { class: `card-upgrade-face equip-compare-face ${side}`, dataset: { compareSide: side } }, [
    renderEquipmentCard(registries, entry.item, { interactive: false, inspection: false, level: 'inspect', surface: 'armoury' }).card,
    el('figcaption', { class: 'equip-compare-caption' }, [
      el('b', { text: entry.name }),
      el('span', { class: 'equip-compare-which', text: t(side === 'current' ? 'armoury.compare.current' : 'armoury.compare.new') }),
    ]),
  ]);
  const faces = el('div', { class: 'card-upgrade-faces equip-compare-faces' }, [
    face('current', current),
    el('span', { class: 'equip-compare-arrow', 'aria-hidden': 'true', text: '→' }),
    face('new', next),
  ]);
  const changed = rows.filter((row) => row.verdict !== 'same');
  const unchanged = rows.filter((row) => row.verdict === 'same');
  const list = el('div', { class: 'equip-compare-rows', dataset: { component: 'armoury.equipCompareRows' } }, [
    eyebrow(t('armoury.compare.title')),
    ...changed.map(compareRowNode),
    ...unchanged.map(compareRowNode),
  ]);
  const body = el('div', { class: 'modal-body equip-compare-body' }, [faces, list]);
  const backBtn = button({ label: t('common.back'), role: 'exit', className: 'subtle equip-compare-back' });
  const equipBtn = button({ label: t('armoury.picker.act.equip'), weight: 'primary', className: 'equip-compare-equip' });
  modal.append(head, body, modalFooter({ secondary: [backBtn], primary: equipBtn, className: 'equip-compare-foot', size: 'medium' }));
  veil.appendChild(modal);
  host.appendChild(veil);

  let closed = false;
  function close({ restoreFocus = true } = {}) {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeydown, true);
    veil.remove();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  const goBack = () => { close(); onBack?.(); };
  const equip = () => { close({ restoreFocus: false }); onEquip?.(); };
  function onKeydown(event) {
    if (event.defaultPrevented || event.repeat) return;
    if ([...document.querySelectorAll('[aria-modal="true"]')].at(-1) !== modal) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); goBack(); return; }
    if (event.key !== 'Tab') return;
    const nodes = focusables(modal);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    else if (!modal.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
  }
  veil.addEventListener('click', (event) => { if (event.target === veil) goBack(); });
  backBtn.addEventListener('click', goBack);
  equipBtn.addEventListener('click', equip);
  modal.querySelector('.modal-close')?.addEventListener('click', goBack);
  window.addEventListener('keydown', onKeydown, true);
  queueMicrotask(() => equipBtn.focus({ preventScroll: true }));
  return { close };
}
