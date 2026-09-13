import { NODE_TYPES } from '../uiContent.js';

// W4b: SELECT, THEN ENTER. A pick on a lit node selects it; Enter, or picking
// the selected node again, travels. Presentation state only: nothing here
// moves the run, and a node outside the reachable set is never selectable.

export function pickMapNode(state = {}, id, reachable = new Set()) {
  if (!reachable.has(id)) return Object.freeze({ selectedId: state.selectedId ?? null, enter: false });
  return Object.freeze({ selectedId: id, enter: state.selectedId === id });
}

// The context band's facts for the selected node, from the same kind table
// the legend and tooltip read. `reading` is the board's own presentation of
// the node (the shown kind under fog, and whether a key revealed it).
export function projectMapContext({ node = null, reading = null, reachable = false } = {}, kinds = NODE_TYPES) {
  if (!node) return Object.freeze({ empty: true, canEnter: false });
  const type = reading?.shownType || node.type;
  const kind = kinds[type] || {};
  return Object.freeze({
    empty: false,
    floor: node.floor,
    kindName: kind.name || type,
    blurb: kind.blurb || '',
    destination: type === 'boss' && node.destinationLabel ? node.destinationLabel : null,
    revealed: !!reading?.revealed,
    canEnter: !!reachable,
  });
}
