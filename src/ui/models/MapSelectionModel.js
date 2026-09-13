import { NODE_TYPES } from '../uiContent.js';

// W4b: SELECT, THEN ENTER. A pick on a lit node selects it; Enter, or picking
// the selected node again, travels. Presentation state only: nothing here
// moves the run, and a node outside the reachable set is never selectable.
// A repeat pick enters only once the selection has stood `repeatDelayMs`, so
// a fast double tap never travels in one gesture.

export function pickMapNode(state = {}, id, reachable = new Set(), { now = 0, repeatDelayMs = 0 } = {}) {
  const selectedId = state.selectedId ?? null;
  const selectedAt = state.selectedAt ?? null;
  if (!reachable.has(id)) return Object.freeze({ selectedId, selectedAt, enter: false });
  if (selectedId !== id) return Object.freeze({ selectedId: id, selectedAt: now, enter: false });
  return Object.freeze({ selectedId, selectedAt, enter: now - (selectedAt ?? -Infinity) >= repeatDelayMs });
}

// The context band's facts for the selected node, from the same kind table
// the legend and tooltip read. `reading` is the board's own presentation of
// the node (the shown kind under fog, and whether a key revealed it). Without
// one the node reads as unknown: the hidden kind never leaks through a caller
// that forgot to pass what the board drew.
export function projectMapContext({ node = null, reading = null, reachable = false } = {}, kinds = NODE_TYPES) {
  if (!node) return Object.freeze({ empty: true, canEnter: false });
  const type = reading?.shownType || 'event';
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
