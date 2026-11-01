// Test fixture: a content bundle whose two hand slots carry three weapon sets.
// The shipped game carries one set per hand (content/source/equipSlots.csv,
// 2026-11-01); the swap mechanism is still data-driven and still tested, so a
// test that swaps armaments mid-fight builds its registries from this bundle:
//   createRegistries(withWeaponRack(contentBundle))
export function withWeaponRack(bundle, sets = 3) {
  return { ...bundle, equipment: { ...bundle.equipment, slots: bundle.equipment.slots.map((slot) => (slot.hand ? { ...slot, sets } : slot)) } };
}
