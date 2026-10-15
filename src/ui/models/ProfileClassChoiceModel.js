// Progressive game profiles show every available class and the next class in
// their authored unlock path. Later locked classes stay out of the chooser.
export function profileClassChoiceIds(classIds, rules, isAvailable) {
  const allIds = [...classIds];
  if (!rules || !Array.isArray(rules.initial) || !Array.isArray(rules.sequence)) return allIds;

  const firstLocked = rules.sequence.findIndex(id => !isAvailable(id));
  const visibleSequence = firstLocked < 0
    ? rules.sequence
    : rules.sequence.slice(0, firstLocked + 1);
  const known = new Set(allIds);
  const seen = new Set();
  return [...rules.initial, ...visibleSequence].filter(id => {
    if (!known.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
