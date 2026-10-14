// Only the actor frame or its artwork performs the independent frame action.
// Reading/ability/Info controls can stop propagation and must be tested separately.
export function frameOwnsHit(frame, sprite, hit) {
  return Boolean(hit && (hit === frame || hit === sprite || sprite?.contains(hit)));
}
