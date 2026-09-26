// W1h Discard / Exhaust viewer. One combined pile control opens a W1
// workspace: a rail picks the pile, and the pane shows that pile's cards
// beside the reading of the selected one. Viewing never moves or merges cards.

export const SPENT_PILES = Object.freeze(['discard', 'exhaust']);
const LABELS = Object.freeze({ discard: 'Discard', exhaust: 'Exhaust' });

export function spentPileView(piles = {}, active = 'discard', selectedId = null) {
  if (!SPENT_PILES.includes(active)) throw new Error(`Unknown pile '${active}'`);
  const count = (id) => (piles[id] || []).length;
  const tabs = SPENT_PILES.map((id) => Object.freeze({
    id, count: count(id), label: `${LABELS[id]} (${count(id)})`, selected: id === active,
  }));
  const cards = Object.freeze([...(piles[active] || [])]);
  // The reading follows the selection; before one, it shows the pile's first
  // card, so the detail column is never an empty frame beside a full pile.
  const detail = cards.find((card) => card.instanceId === selectedId) || cards[0] || null;
  return Object.freeze({ tabs: Object.freeze(tabs), cards, empty: cards.length === 0, detail });
}
