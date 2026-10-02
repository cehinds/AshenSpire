// src/model/sigils.js — the run's sigil inventory (SPEC §14.3), headless.
//
// Two fields, both added at §14.6 step 5 (schema 15):
//
//   run.sigils      string[]                         owned sigils not installed
//   run.sigilSlots  { [itemRef]: (sigilId|null)[] }  slots cut into items, keyed
//                                                    like itemMounts
//
// The market sells into `sigils` (model/marketAdditions.js); the blacksmith
// cuts slots and installs sigils into them (§14.4, step 6), and a sigil works
// only while installed in a slot of an equipped armament. Selling or
// unequipping the piece keeps its slot record, as §12.2 keeps mounts.
// Legendary sigils (§15.4) stay in `sigils` and are attuned, never slotted.

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * sigilInventoryProblems(run) → the shape of both fields, refused by name
 * (validateRunShape). Registry-free: that a saved id names a sigil this build
 * knows is the load door's question (engine/save.js).
 */
export function sigilInventoryProblems(run) {
  const problems = [];
  if (run.sigils !== undefined && run.sigils !== null) {
    if (!Array.isArray(run.sigils)) problems.push('sigils must be a list of sigil ids');
    else run.sigils.forEach((id, index) => { if (typeof id !== 'string' || !id) problems.push(`sigils[${index}] must be a non-empty sigil id`); });
  }
  if (run.sigilSlots !== undefined && run.sigilSlots !== null) {
    if (!object(run.sigilSlots)) problems.push('sigilSlots must be an object { [itemRef]: (sigilId|null)[] }');
    else {
      for (const [itemRef, slots] of Object.entries(run.sigilSlots)) {
        if (!Array.isArray(slots)) { problems.push(`sigilSlots['${itemRef}'] must be a list of slots (a sigil id or null)`); continue; }
        slots.forEach((slot, index) => {
          if (slot !== null && (typeof slot !== 'string' || !slot)) problems.push(`sigilSlots['${itemRef}'][${index}] must be a sigil id or null`);
        });
      }
    }
  }
  return problems;
}

/** Every sigil id the run holds: carried, or sitting in a slot. */
export function ownedSigilIds(run) {
  const slotted = Object.values(object(run.sigilSlots) ? run.sigilSlots : {}).flatMap((slots) => (Array.isArray(slots) ? slots : []));
  return [...(Array.isArray(run.sigils) ? run.sigils : []), ...slotted.filter((id) => typeof id === 'string' && id)];
}

/** The first saved sigil id the registries do not know, or null (the load door archives on one). */
export function unknownSigilId(registries, run) {
  return ownedSigilIds(run).find((id) => !registries.sigils.has(id)) || null;
}
