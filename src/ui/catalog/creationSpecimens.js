// Additional folios in the existing ?shot=components production catalog.
// Every specimen is built by the same renderer used by the creation screen.
import { el, pane } from '../kit/index.js';
import { feats } from '../../content/feats.js';
import { createRunState } from '../../model/state.js';
import { statProjection } from '../../model/statProjection.js';
import { classChoiceCard, classUnfold } from '../components/creationCards.js';
import { creationClassTileSummary } from '../models/CreationClassTileModel.js';
import { subclassOptions } from '../../model/subclasses.js';
import * as SubclassDeck from '../../model/subclassDeck.js';
import { createCreationSubclassSelector, createCreationStartingDeck } from '../components/creationSubclass.js';
import { renderCard } from '../components/card.js';
import { creationDraftStartingDeck, CREATION_CARD_RULES } from '../models/CreationSubclassModel.js';
import { UI_COMPONENTS as UI, markUiComponent } from '../components/uiComponents.js';
import { creationFeatBrowserGroups } from '../models/CreationFeatBrowserModel.js';
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

function featBrowser(groups) {
  const requirement = (row, available = false) => row.unlockedByProfile ? t('creation.feats.profileUnlocked')
    : row.requiredLevel == null ? t('creation.feats.noOffers', { track: row.trackLabel })
      : t(available ? 'creation.feats.availableRequirement' : 'creation.feats.lockedRequirement', { track: row.trackLabel, required: row.requiredLevel, current: row.currentLevel });
  return createCreationFeatBrowser({ groups, selectedId: groups[0]?.rows[0]?.id, allowance: 0,
    labels: { eyebrow: t('creation.feats.eyebrow'), title: t('creation.feats.title'), description: t('creation.feats.description'),
      availability: t('creation.feats.availability'), detailLabel: t('creation.feats.detailLabel'),
      groups: Object.fromEntries(['character', 'class', 'skill'].map(id => [id, t(`creation.feats.group.${id}`)])),
      lockedRequirement: row => requirement(row), availableRequirement: row => requirement(row, true),
      profileUnlocked: t('creation.feats.profileUnlocked'), profileUnlockedRequirement: () => t('creation.feats.profileUnlocked'),
      unavailable: t('creation.feats.locked'), unavailableRequirement: row => requirement(row),
      locked: t('creation.feats.locked'), available: t('creation.feats.available'), emptyGroup: t('creation.feats.emptyGroup') },
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

/** The selected Class miniature uses the live summary, gear and opening refs. */
export function createCreationClassSpecimen({ registries, classId, run = null, settings = {}, visual = null, makeSprite = null, onRelicInspect = null }) {
  const cls = registries.classes.get(classId);
  const draft = run || createRunState({ registries, classId, subclassId: subclassOptions(registries, classId)[0].id,
    seed: 7, profileMeta: { settings } });
  const refs = creationDraftStartingDeck(registries, draft, [], settings);
  const summary = creationClassTileSummary(registries, draft, statProjection(registries, draft), refs);
  const relic = registries.relics.get(draft.relics[0]);
  const card = classChoiceCard(cls, { selected: true, expanded: true, visual });
  card.classList.add('unfolded', 'cc-catalog-specimen');
  card.append(classUnfold({ cls, summary, relic, visual,
    sprite: makeSprite?.(classId, draft.loadout.sets.armor[0]), onRelicInspect }));
  return card;
}

export function mountCreationPartSpecimens({ host, registries }) {
  const run = createRunState({ registries, classId: 'starseer', seed: 7 });
  const groups = creationFeatBrowserGroups(registries, run);
  const navigation = createCreationStepNavigation({ steps: STEP_ROWS, currentId: 'class',
    labels: { title: t('creation.categories'), allSteps: t('creation.nav.allSteps'), currentStep: (step, index, total) => t('creation.step.progress', { index: index + 1, count: total, category: step.label }) },
    onSelect: id => navigation.update(id),
  });
  // A standalone navigation needs the vertical room the live page gives it.
  navigation.classList.add('cz-railed');
  navigation.style.minHeight = '300px';
  const detail = featBrowser(groups).querySelector('[data-ui-component="creation-feat-detail"]');
  const subclassChoices = subclassOptions(registries, 'reaver');
  const subclassRun = createRunState({ registries, classId: 'reaver', subclassId: subclassChoices[0].id, seed: 7 });
  const deckRefs = SubclassDeck.stampedSubclassDeckPreview(registries, subclassRun);
  const subclassSelector = () => createCreationSubclassSelector({ options: subclassChoices, selectedId: subclassChoices[0].id });
  const startingDeck = () => createCreationStartingDeck({ registries, refs: deckRefs });
  const inspector = renderCard(registries, deckRefs[0], { interactive: false, level: 'inspect', rules: CREATION_CARD_RULES });
  markUiComponent(inspector, UI.creationStartingCardInspector);
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
    ['creation-feat-browser', 'Canonical Character, Class and Skill feat groups with level requirements', featBrowser(groups)],
    ['creation-feat-tile', 'One canonical feat tile, level requirement and detail', featBrowser([{ ...groups[0], rows: groups[0].rows.slice(0, 1) }])],
    ['creation-feat-detail', 'Canonical feat detail panel', detail],
    ['creation-feat-emblem', 'Canonical feat emblem', creationFeatEmblem(feats[0].id)],
    ['creation-subclass-selector', t('creation.subclass.catalog.selector'), subclassSelector()],
    ['creation-subclass-tile', t('creation.subclass.catalog.tile'), subclassSelector().querySelector('[data-ui-component="creation-subclass-tile"]')],
    ['creation-starting-deck', t('creation.subclass.catalog.deck'), startingDeck()],
    ['creation-starting-deck-group', t('creation.subclass.catalog.group'), startingDeck().querySelector('[data-ui-component="creation-starting-deck-group"]')],
    ['creation-starting-deck-card', t('creation.subclass.catalog.card'), startingDeck().querySelector('[data-ui-component="creation-starting-deck-card"]')],
    ['creation-starting-card-inspector', t('creation.subclass.catalog.inspector'), inspector],
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
