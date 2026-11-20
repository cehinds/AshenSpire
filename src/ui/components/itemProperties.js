// An item's properties on the Armoury (W25-R): a short chip list on the tile and a full section in the item's detail.
// Both read model/itemPropertyLines.js; nothing here computes a property. Text is 12px or more; the chips are labels, not controls
// (the tile's own select button owns the tap), so the 44px phone target belongs to that button.
import { el } from '../kit/index.js';
import { t } from '../strings.js';

const CHIPS_ON_A_TILE = 3;

/** ItemPropertyChips(lines) -> a chip list of the property names (at most three, then "+N more"), or null when there are none. */
export function ItemPropertyChips(lines) {
  if (!lines?.properties?.length) return null;
  const shown = lines.properties.slice(0, CHIPS_ON_A_TILE);
  const extra = lines.properties.length - shown.length;
  return el('ul', { class: 'item-prop-chips', 'aria-label': t('armoury.props.aria') }, [
    ...shown.map((row) => el('li', { class: 'item-prop-chip', title: row.text, dataset: { propertyId: row.id }, text: row.name })),
    extra > 0 ? el('li', { class: 'item-prop-chip item-prop-more', text: t('armoury.props.more', { n: extra }) }) : null,
  ].filter(Boolean));
}

/** The "Rank R · U upgrades" line, or '' for an item nothing was done to. */
export function ItemPropertyCounts(lines) {
  if (!lines || (!lines.rank && !lines.upgrades)) return '';
  return t(lines.upgrades === 1 ? 'armoury.props.countsOne' : 'armoury.props.counts', { rank: lines.rank, upgrades: lines.upgrades });
}

/** ItemPropertyDetail(lines) -> the detail section: heading, rank and upgrade count, then one row (name and one-line effect) per property; null when nothing to say. */
export function ItemPropertyDetail(lines) {
  const counts = ItemPropertyCounts(lines);
  if (!lines?.properties?.length && !counts) return null;
  return el('section', { class: 'item-prop-detail', dataset: { itemProperties: lines.itemRef || '' } }, [
    el('h4', { class: 'item-prop-heading', text: t('armoury.props.heading') }),
    counts ? el('p', { class: 'item-prop-counts', text: counts }) : null,
    lines.properties.length ? el('ul', { class: 'item-prop-list' }, lines.properties.map((row) => el('li', { class: 'item-prop-row', dataset: { propertyId: row.id } }, [
      el('strong', { class: 'item-prop-name', text: row.name }),
      el('span', { class: 'item-prop-text', text: row.text }),
    ]))) : null,
  ].filter(Boolean));
}
