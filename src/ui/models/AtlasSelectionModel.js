// W4b on the world-journey atlas: SELECT, THEN ENTER. The classic act map
// follows the same rule; the atlas differs only in its sets. Any discovered
// place may be selected so its facts can be read in the context band, but
// Enter is offered only where the journey already allows it:
//   - an open road (reachableJourneyNodes) travels there, through the same
//     travel command the location dialog's "Travel to" button calls;
//   - the place where you stand opens its location view, where exploring,
//     services and quests live.
// Presentation state only: nothing here moves the run, and reachability and
// discovery stay owned by model/worldAtlas.js.

/** What Enter does for a place: 'travel', 'open', or null (not enterable). */
export function atlasEnterKind(id, { currentId = null, reachable = new Set() } = {}) {
  if (!id) return null;
  if (id === currentId) return 'open';
  return reachable.has(id) ? 'travel' : null;
}

/**
 * A tap on a place. The first tap selects it; tapping the selected place again
 * does what Enter would, or opens its details where Enter is unavailable. An
 * undiscovered place is never selectable.
 */
export function pickAtlasNode(state = {}, id, { known = new Set(), reachable = new Set(), currentId = null } = {}) {
  const selectedId = state.selectedId ?? null;
  if (!known.has(id)) return Object.freeze({ selectedId, action: null });
  if (selectedId !== id) return Object.freeze({ selectedId: id, action: null });
  return Object.freeze({ selectedId: id, action: atlasEnterKind(id, { currentId, reachable }) ? 'enter' : 'inspect' });
}

/**
 * The context band's facts for the selected place. `place` is the screen's
 * projection of the authored node ({ id, name, regionName, description }).
 * `status` is 'here' | 'road' | 'far' and names a uiStrings row.
 */
export function projectAtlasContext({ place = null, currentId = null, reachable = new Set() } = {}) {
  if (!place) return Object.freeze({ empty: true, canEnter: false, enter: null });
  const enter = atlasEnterKind(place.id, { currentId, reachable });
  return Object.freeze({
    empty: false,
    id: place.id,
    name: place.name,
    regionName: place.regionName || '',
    description: place.description || '',
    status: enter === 'open' ? 'here' : enter === 'travel' ? 'road' : 'far',
    enter,
    canEnter: !!enter,
  });
}
