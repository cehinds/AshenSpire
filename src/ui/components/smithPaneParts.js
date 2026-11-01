// Pane parts shared by the Smith item dialog (smithUpgradeModal.js) and the Core card-upgrade dialog
// (cardUpgradeModal.js), so both read the same. `.smith-*` classes and the b/i/strong delta tags stay:
// tools/armament-smithing-ui.mjs reads them.
import { el, glyph } from '../kit/index.js';
import { t } from '../strings.js';

/** A StatPair whose key and value are separated by a space, so the text reads "AR 5". */
export const pairSpaced = (key, valueNode, className = '') => el('span', { class: `as-statpair${className ? ` ${className}` : ''}` }, [
  el('em', { class: 'sp-k', text: key }), ' ', valueNode,
]);

/** A delta as the kit draws it, with the tags the Smith tool reads (b before, i arrow, strong after). */
export const deltaNode = (from, to, { spaced = true } = {}) => {
  const dir = Number(to) > Number(from) ? 'up' : Number(to) < Number(from) ? 'down' : 'flat';
  return el('span', { class: 'sp-v as-delta', dataset: { dir } }, spaced
    ? [el('b', { class: 'd-from', text: from }), ' ', el('i', { class: 'd-arrow', 'aria-hidden': 'true', text: '→' }), ' ', el('strong', { class: 'd-to', text: to })]
    : [el('b', { class: 'd-from', text: from }), el('i', { class: 'd-arrow', 'aria-hidden': 'true', text: '→' }), el('strong', { class: 'd-to', text: to })]);
};

export const CHANGE_LABELS = {
  damage: 'DAMAGE', block: 'GUARD', draw: 'DRAW', discard: 'DISCARD', 'cost:action': 'STAMINA', 'cost:mana': 'MANA', 'cost:stamina': 'STAMINA',
};

/** A row's changes as StatPairs with deltas: "AR 7 → 10". `row.values` is [{ op?, label?, before, after }]. */
export const changeSummary = (row) => el('span', { class: 'smith-fold-values' }, row.values.map((change) => {
  const label = change.label || CHANGE_LABELS[change.op] || String(change.op || 'change');
  return pairSpaced(label, deltaNode(String(change.before), String(change.after)));
}));

/** The stone cost as a StatPair: "REQ/AVAIL 1/0", the available count coloured by affordability. */
export const costPairNode = (selected) => el('span', { class: 'as-statpair smith-cost-pair' }, [
  el('span', { class: 'sp-k' }, [el('em', { text: 'REQ' }), el('i', { 'aria-hidden': 'true', text: '/' }), el('em', { text: 'AVAIL' })]),
  ' ',
  el('span', { class: 'sp-v' }, [el('strong', { class: 'smith-cost-required', text: String(selected.cost) }), el('i', { 'aria-hidden': 'true', text: '/' }), el('strong', { class: 'smith-cost-available', text: String(selected.stones) })]),
]);

export const economyNode = (selected) => el('span', { class: 'smith-economy-values' }, [
  glyph('weight', { class: 'smith-stone-icon', 'aria-hidden': 'true' }),
  el('b', { text: t('smith.cost.label') }), ' ', costPairNode(selected),
]);
