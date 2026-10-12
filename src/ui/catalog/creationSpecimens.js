// Additional folios in the existing ?shot=components production catalog.
// Every specimen is built by the same renderer used by the creation screen.
import { el, pane } from '../kit/index.js';
import { feats } from '../../content/feats.js';
import { engravedIcon } from '../components/engravedIcon.js';
import { t } from '../strings.js';
import {
  creationPageHeading, creationPanel, creationChoiceTile, creationFeatEmblem,
  createCreationFeatBrowser, createCreationStepNavigation, decorateCreationWorkspace,
} from '../components/creationPageParts.js';
import { linkCreationCatalogFolios } from './creationCatalogLinks.js';

const STEP_ROWS = [
  'class', 'attributes', 'keepsake', 'equipment', 'feats', 'spells', 'review',
].map(id => ({ id, label: t(`creation.category.${id}`) }));

function featBrowser(rows = feats) {
  return createCreationFeatBrowser({ feats: rows, selectedId: rows[0]?.id, allowance: 0,
    labels: { eyebrow: t('creation.feats.eyebrow'), title: t('creation.feats.title'), description: t('creation.feats.description'),
      availability: t('creation.feats.availability'), detailLabel: t('creation.feats.detailLabel') },
  });
}

function choiceSpecimen() {
  const host = el('div', { class: 'cc-catalog-specimen' });
  let selected = false;
  const draw = () => host.replaceChildren(creationChoiceTile({
    id: 'catalog-choice', title: feats[0].name, description: feats[0].description,
    art: engravedIcon('relic'), selected, onChoose: () => { selected = !selected; draw(); },
  }));
  draw();
  return host;
}

function panelSpecimen() {
  return creationPanel({ kind: 'catalog-panel', title: feats[0].name,
    children: el('p', { text: feats[0].description }),
  });
}

export function mountCreationPartSpecimens({ host }) {
  const navigation = createCreationStepNavigation({ steps: STEP_ROWS, currentId: 'class',
    labels: { title: t('creation.categories'), allSteps: t('creation.nav.allSteps'), currentStep: (step, index, total) => t('creation.step.progress', { index: index + 1, count: total, category: step.label }) },
    onSelect: id => navigation.update(id),
  });
  // A standalone navigation needs the vertical room the live page gives it.
  navigation.style.minHeight = '300px';
  const detail = featBrowser().querySelector('[data-ui-component="creation-feat-detail"]');
  const specimens = [
    ['creation-page-heading', 'Page heading', creationPageHeading({ eyebrow: t('creation.feats.eyebrow'), title: t('creation.title'), description: t('creation.feats.description') })],
    ['creation-panel', 'Creation panel', panelSpecimen()],
    ['creation-choice-tile', 'Interactive choice tile', choiceSpecimen()],
    ['creation-part-material', 'Material layer in its production panel', panelSpecimen()],
    ['creation-part-trim', 'Trim layer in its production panel', panelSpecimen()],
    ['creation-part-body', 'Content body in its production panel', panelSpecimen()],
    ['creation-choice-art', 'Choice artwork in its interactive tile', choiceSpecimen()],
    ['creation-choice-copy', 'Choice live text in its interactive tile', choiceSpecimen()],
    ['creation-step-navigation', 'Desktop steps and mobile current-step selector', navigation],
    ['creation-feat-browser', 'All six canonical feats and interactive detail', featBrowser()],
    ['creation-feat-tile', 'One canonical feat tile and its detail', featBrowser(feats.slice(0, 1))],
    ['creation-feat-detail', 'Canonical feat detail panel', detail],
    ['creation-feat-emblem', 'Canonical feat emblem', creationFeatEmblem(feats[0].id)],
  ];
  for (const [componentId, label, specimen] of specimens) {
    const headingId = `cc-catalog-${componentId}`;
    const folio = pane({ eyebrow: componentId, title: label,
      attrs: { class: 'flush cc-catalog-item', dataset: { catalogComponent: componentId } },
    });
    folio.querySelector('h3').id = headingId;
    specimen.setAttribute('aria-labelledby', headingId);
    folio.append(specimen);
    host.append(folio);
  }
  decorateCreationWorkspace(host);
  linkCreationCatalogFolios(host);
  return { destroy: () => navigation.destroy?.() };
}
