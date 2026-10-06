// The compact class preview's detail doors. The row owns its meaning and
// calculation; this component only orders them for reading.
import { el, eyebrow, statPair } from '../kit/index.js';
import { openModal } from './modalShell.js';
import { t } from '../strings.js';

export function openCreationStatDetail(entry, opener) {
  const title = entry.inspectionLabel || entry.label || entry.faceLabel;
  return openModal({
    size: 'sm', className: 'cc-preview-detail-modal', title, eyebrow: t('creation.preview.statEyebrow'), opener,
    body: el('div', { class: 'as-stack cc-preview-detail-body' }, [
      el('p', { class: 'cc-preview-detail-definition', text: entry.sense }),
      statPair({ key: title, value: entry.value, attrs: { class: 'cc-preview-detail-value' } }),
      el('section', { class: 'as-stack tight cc-preview-detail-calculation', 'aria-label': t('creation.preview.calculation') }, [
        eyebrow(t('creation.preview.calculation')),
        el('p', { class: 'cc-preview-detail-formula', text: entry.formula }),
      ]),
    ]),
  });
}

export function openCreationRelicDetail(relic, description, opener) {
  return openModal({
    size: 'sm', className: 'cc-preview-detail-modal', title: relic.name, eyebrow: t('creation.preview.relicEyebrow'), opener,
    body: el('div', { class: 'as-stack cc-preview-detail-body' }, [
      el('p', { class: 'cc-preview-detail-definition', text: description }),
      relic.flavor ? el('p', { class: 'flavour', text: relic.flavor }) : null,
    ]),
  });
}
