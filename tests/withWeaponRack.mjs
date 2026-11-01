// Test fixture: a content bundle whose two hand slots carry three weapon sets,
// with the four `slot` unlock rungs that opened sets 2 and 3.
// The shipped game carries one set per hand (content/source/equipSlots.csv and
// unlocks.csv, 2026-11-01); the swap and ladder mechanisms are still data-driven
// and still tested, so a test that swaps armaments or climbs the ladder builds
// its registries from this bundle:  createRegistries(withWeaponRack(contentBundle))
const RUNGS = [
  { id: 'rack2Right', kind: 'slot', ref: 'rightHand', name: 'Second Main-hand Slot', condition: 'reachAct', param: 2, reveal: 'listed', hint: 'Reach the Stitched Court.' },
  { id: 'rack3Right', kind: 'slot', ref: 'rightHand', name: 'Third Main-hand Slot', condition: 'winRuns', param: 1, reveal: 'listed', hint: 'Win a run.' },
  { id: 'rack2Left', kind: 'slot', ref: 'leftHand', name: 'Second Off-hand Slot', condition: 'reachAct', param: 3, reveal: 'listed', hint: 'Reach the Ashen Crown.' },
  { id: 'rack3Left', kind: 'slot', ref: 'leftHand', name: 'Third Off-hand Slot', condition: 'winRuns', param: 2, reveal: 'listed', hint: 'Win two runs.' },
];
export function withWeaponRack(bundle, sets = 3) {
  const have = new Set((bundle.unlocks || []).map((row) => row.id));
  return {
    ...bundle,
    equipment: { ...bundle.equipment, slots: bundle.equipment.slots.map((slot) => (slot.hand ? { ...slot, sets } : slot)) },
    unlocks: [...(bundle.unlocks || []), ...RUNGS.filter((row) => !have.has(row.id))],
    tagging: [...(bundle.tagging || []), ...RUNGS.map((row) => ({ family: 'unlock', scope: '', objectId: row.id, tagId: 'classification.unlock' }))],
  };
}
