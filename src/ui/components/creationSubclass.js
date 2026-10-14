import { el } from '../kit/index.js';
import { t } from '../strings.js';
import { creationChoiceTile, creationPanel } from './creationPageParts.js';
import { engravedIcon, engravedGlyphId } from './engravedIcon.js';
import { markUiComponent, UI_COMPONENTS as UI } from './uiComponents.js';
import { renderCard } from './card.js';
import { openCardInspection } from './cardInspection.js';
import { creationSubclassSelection, creationStartingDeckModel, CREATION_CARD_RULES } from '../models/CreationSubclassModel.js';

const SUBCLASS_ICONS = Object.freeze({ heavyKnight: 'shield', swordMaster: 'sword', battleMage: 'mana', frostMonarch: 'frost', ranger: 'target', assassin: 'dexterity', cleric: 'health', monk: 'poise' });

export function createCreationSubclassSelector({ options = [], selectedId = null, onChoose = null } = {}) {
  let selected = creationSubclassSelection(options, selectedId);
  const choices = el('div', { class: 'cc-subclass-choices', role: 'group', 'aria-label': t('creation.subclass.choices') });
  const detail = el('p', { class: 'cc-subclass-description', 'aria-live': 'polite' });
  const node = creationPanel({ kind: 'subclass-selector', title: t('creation.subclass.title'),
    subtitle: t('creation.subclass.hint'), className: 'cc-subclass-selector', children: [choices, detail] });
  markUiComponent(node, UI.creationSubclassSelector);
  function choose(id) {
    if (!options.some(row => row.id === id)) return;
    selected = id;
    node.dataset.subclass = id;
    for (const tile of choices.querySelectorAll('button')) {
      const chosen = tile.dataset.subclass === id;
      tile.classList.toggle('chosen', chosen);
      tile.setAttribute('aria-pressed', String(chosen));
    }
    detail.textContent = options.find(row => row.id === id).description;
    onChoose?.(id);
  }
  node.setOptions = (nextOptions, nextId = selected) => {
    options = nextOptions;
    selected = creationSubclassSelection(options, nextId);
    choices.replaceChildren(...options.map(row => {
      const tile = creationChoiceTile({ id: row.id, title: row.name,
        description: row.summary || row.description,
        art: engravedIcon(row.icon || SUBCLASS_ICONS[row.id] || engravedGlyphId(row.glyph) || 'progression'),
        selected: row.id === selected, onChoose: choose, attrs: { dataset: { subclass: row.id } } });
      markUiComponent(tile, UI.creationSubclassTile);
      tile.classList.add('cc-subclass-tile');
      return tile;
    }));
    node.dataset.subclass = selected || '';
    detail.textContent = options.find(row => row.id === selected)?.description || '';
  };
  node.setOptions(options, selected);
  return node;
}

export function openCreationStartingCard(registries, card, opener, { rules = CREATION_CARD_RULES } = {}) {
  const face = renderCard(registries, card.ref, { interactive: false, level: 'inspect', preview: card.preview || null, rules });
  markUiComponent(face, UI.creationStartingCardInspector);
  const sources = [...new Set((card.preview?.values || []).filter(value => value.sourceInfusion && value.sourceName).map(value => value.sourceName))];
  return openCardInspection({ title: card.definition.name, card: face, opener,
    details: el('p', { text: t('creation.subclass.cardRole', { role: t(card.roleStringId) })
      + (sources.length ? ` Weapon source: ${sources.join(', ')}.` : '') }),
  });
}

/** Every copy is visible; inspection opens the existing full rules card. */
export function createCreationStartingDeck({ registries, refs = [], rules = CREATION_CARD_RULES, run = null, settings = {} } = {}) {
  const groups = creationStartingDeckModel(registries, refs, { rules, run, settings });
  const node = creationPanel({ kind: 'starting-deck', title: t('creation.subclass.deckTitle', { count: refs.length }),
    subtitle: t('creation.subclass.deckBreakdown', Object.fromEntries(groups.map(group => [group.source, group.cards.length]))),
    className: 'cc-subclass-deck', children: groups.map(group => {
      const section = el('section', { class: 'cc-subclass-deck-group', dataset: { deckSource: group.source } }, [
        el('h4', { text: t(`creation.subclass.source.${group.source}`, { count: group.cards.length }) }),
        el('div', { class: 'cc-subclass-deck-cards' }, group.cards.map(card => {
          const control = el('button', { type: 'button', class: 'as-btn cc-subclass-deck-card',
            'aria-haspopup': 'dialog', 'aria-label': t('creation.subclass.inspectCard', { name: card.definition.name, role: t(card.roleStringId) }),
            dataset: { cardId: card.ref.cardId, deckRole: card.ref.openingRole, deckSource: group.source } }, [
            el('span', { class: 'cc-subclass-card-role', text: t(card.roleStringId) }),
            el('span', { class: 'cc-subclass-card-name', text: card.definition.name }),
            engravedIcon('info'),
          ]);
          markUiComponent(control, UI.creationStartingDeckCard);
          control.addEventListener('click', () => openCreationStartingCard(registries, card, control, { rules }));
          return control;
        })),
      ]);
      markUiComponent(section, UI.creationStartingDeckGroup);
      return section;
    }) });
  markUiComponent(node, UI.creationStartingDeck);
  node.dataset.deckCount = String(refs.length);
  return node;
}
