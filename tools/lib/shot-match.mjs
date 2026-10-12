// tools/lib/shot-match.mjs — which shots a `--only` list keeps (tools/screenshot.mjs).
//
// By default an id is a prefix: `class-rogue` keeps `class-rogue` and `class-rogue-ember`.
// With `exact` an id must be the whole shot name. Callers that pass no options keep the prefix match.

/** True when the shot `name` is named by one of the `ids`. */
export function keepShot(name, ids, { exact = false } = {}) {
  return ids.some((id) => (exact ? name === id : name.startsWith(id)));
}
