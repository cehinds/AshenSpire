// A leaf shared by rewards, books and the deck editor: no content/loadout cycle.
export function unusedInstanceId(run, prefix, cardId) {
  const taken = new Set([...(run.deck || []), ...(run.sideboard || [])].map((card) => card && card.instanceId));
  let n = (run.deck || []).length;
  while (taken.has(`${prefix}${n}_${cardId}`)) n++;
  return `${prefix}${n}_${cardId}`;
}
