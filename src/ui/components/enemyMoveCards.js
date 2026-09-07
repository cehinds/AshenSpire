import { optionCard, options } from '../kit/index.js';

/** Inert shared kit cards: inspecting a move never selects or plays it. */
export function renderEnemyMoveCards(cards) {
  return options(cards.map((card) => optionCard({
    name: card.name, description: card.detail, meta: card.meta,
    selected: card.active, arrow: false, tag: 'article',
    className: 'enemy-move-card',
    attrs: { 'data-move-id': card.moveId, 'aria-label': `${card.name}. ${card.meta}. ${card.detail}` },
  })), { class: 'enemy-move-cards', 'aria-label': 'Enemy move set' });
}
