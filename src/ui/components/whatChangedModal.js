// The what-changed receipt: a page-locked dialog shown AFTER a choice or purchase commits, listing
// what moved (stats, resources, relics, cards with before/after faces, armaments with tier stats).
// Rows come from model/runChangeReceipt.js; this file only draws them. It reuses the Smith
// dialog's stat rows and deltas, so a receipt reads like the picker that preceded it.
import { el, button, statRow, prose, glyph } from '../kit/index.js';
import { openModal } from './modalShell.js';
import { renderCard } from './card.js';
import { deltaNode, changeSummary } from './smithPaneParts.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { t } from '../strings.js';
import { diffRunSnapshots, snapshotRunForDiff } from '../../model/runChangeReceipt.js';

const CHANGE_WORD = { added: 'whatChanged.added', removed: 'whatChanged.removed', upgraded: 'whatChanged.upgraded', ranked: 'whatChanged.ranked', tier: 'whatChanged.tier' };

const facesNode = (registries, row) => el('div', { class: 'card-upgrade-faces', dataset: { whatChangedFaces: row.instanceId || row.cardId } },
  ['before', 'after'].map((which) => el('div', { class: `card-upgrade-face ${which}`, dataset: { cardUpgradeFace: which } },
    renderCard(registries, { cardId: row.cardId }, { small: true, tooltip: false, inspectReadOnly: true, definition: row.faces[which] }))));

const cardFace = (registries, row) => el('div', { class: 'card-upgrade-faces', dataset: { whatChangedFaces: row.instanceId || row.cardId } },
  el('div', { class: 'card-upgrade-face after', dataset: { cardUpgradeFace: 'after' } },
    renderCard(registries, { cardId: row.cardId }, { small: true, tooltip: false, inspectReadOnly: true })));

/** One row: the label and kind on the left, the delta (or the state word) on the right, optional faces/stats below. */
function rowNode(registries, row) {
  const delta = row.before !== '' && row.after !== '' && row.kind !== 'relic'
    ? deltaNode(row.before, row.after) : null;
  const word = !delta
    ? el('span', { class: 'sp-v', text: row.kind === 'relic' ? t(row.gained ? 'whatChanged.gained' : 'whatChanged.lost') : (row.after || row.before) }) : null;
  const hint = CHANGE_WORD[row.change] ? t(CHANGE_WORD[row.change]) : '';
  const wrap = el('div', { class: 'what-changed-row', dataset: { whatChangedKind: row.kind, ...(row.change ? { whatChangedChange: row.change } : {}) } });
  wrap.appendChild(statRow({ flat: true, nameNode: el('b', { class: 'sr-name', text: row.label }), hint, values: [delta || word] }));
  if (row.stats?.length) wrap.appendChild(el('div', { class: 'confirmation-change-list' }, row.stats.map((s) => statRow({ flat: true, nameNode: el('b', { class: 'sr-name', text: s.label }), values: changeSummary({ values: [s] }) }))));
  if (registries && row.kind === 'card') {
    if (row.faces) wrap.appendChild(facesNode(registries, row));
    else if (row.change === 'added') wrap.appendChild(cardFace(registries, row));
  }
  return wrap;
}

/**
 * openWhatChangedModal({ title, eyebrow, lead, rows, registries, costLine, onClose, returnFocusElement })
 * `rows` is runChangeReceipt's rows; a row may carry `stats` ([{ label, before, after }]) for an armament tier.
 * `costLine` is a string or { cinders, stones }. Returns the modal's close function.
 */
export function openWhatChangedModal({ title, eyebrow: eyebrowText = t('whatChanged.eyebrow'), lead = '', rows = [], registries = null, costLine = null, onClose = null, returnFocusElement = document.activeElement } = {}) {
  let closeModal = () => {};
  const cont = button({ label: t('whatChanged.continue'), weight: 'primary', id: 'what-changed-continue' });
  cont.addEventListener('click', () => closeModal());
  const cost = typeof costLine === 'string' ? costLine
    : costLine ? [costLine.cinders ? t('whatChanged.cost.cinders', { n: costLine.cinders }) : '', costLine.stones ? t('whatChanged.cost.stones', { n: costLine.stones }) : ''].filter(Boolean).join(' · ') : '';
  const body = el('div', { class: 'what-changed-body' }, [
    lead ? prose(lead, { class: 'what-changed-lead' }) : null,
    el('div', { class: 'confirmation-change-list what-changed-list' }, rows.map((row) => rowNode(registries, row))),
    cost ? el('div', { class: 'smith-cost-strip what-changed-cost' }, el('div', { class: 'smith-summary-cell' }, [glyph('weight', { class: 'smith-stone-icon', 'aria-hidden': 'true' }), el('b', { text: t('whatChanged.cost') }), ' ', cost])) : null,
  ]);
  const handle = openModal({
    name: 'what-changed', size: 'sm', className: 'what-changed-modal',
    eyebrow: eyebrowText, title, closeLabel: t('whatChanged.close'),
    body, primary: cont, onClose, opener: returnFocusElement,
  });
  markUiComponent(handle.panel, UI.whatChangedModal);
  closeModal = handle.close;
  return closeModal;
}

/**
 * showRunReceipt({ run, registries, before, title, lead, costLine, onClose, returnFocusElement })
 * Diffs `before` (snapshotRunForDiff taken ahead of the commit) against the run now and opens the receipt
 * when something changed. Returns true when it opened one; a pure flavour choice opens nothing.
 */
export function showRunReceipt({ run, registries, before, title, lead = '', costLine = null, onClose = null, returnFocusElement = undefined } = {}) {
  if (!before) return false;
  const diff = diffRunSnapshots(before, snapshotRunForDiff(run), registries);
  if (diff.empty) return false;
  openWhatChangedModal({ title, lead, rows: diff.rows, registries, costLine, onClose, ...(returnFocusElement ? { returnFocusElement } : {}) });
  return true;
}
