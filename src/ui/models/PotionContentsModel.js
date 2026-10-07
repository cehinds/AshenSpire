import { wireframeUi } from '../../content/wireframeUi.js';

// WGH8 POTIONS CONTENTS (CURRENT-SPECIFICATION, "Potions ownership"). ONE
// projection for the ONE Potions control: the HP and MP charge flasks and the
// carried consumables, each with its count. WGC11 in the combat footer lists
// these entries; nothing renders them as sibling HUD buttons.
//
// DOM-, registry- and rules-free. The caller passes the snapshot's fields and
// resolves names and definitions itself; the result is frozen and carries no
// callbacks. Charge providers and owned item instances stay separate in the
// data — this only lists them side by side.
//
//   chargeKinds   the charge-flask kinds in their fixed order (hp, mana)
//   flaskCharges  the pool record, read as `<kind>Current`
//   carried       the carried flask instances, in slot order ({ flaskId })
//
// Carried consumables of one kind collapse into ONE entry with a count and the
// slots that hold them; Use spends the first of those slots, as choosing that
// slot did before. Hotkeys follow their slots: charge flasks keep flask1 and
// flask2 by position, and flask3 stays with whichever entry holds slot 0.
// `config` hides a provider category; hiding it spends and changes nothing.
export function potionContents({ chargeKinds = [], flaskCharges = null, carried = [] } = {}, config = wireframeUi.hud.potions) {
  const entries = [];
  if (config.chargeFlasks) {
    chargeKinds.forEach((kind, index) => {
      const raw = flaskCharges ? flaskCharges[`${kind}Current`] : 0;
      const count = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
      entries.push({ key: `charge:${kind}`, category: 'charge', kind, flaskId: null, count, slots: [], useActionId: `flask${index + 1}` });
    });
  }
  if (config.carried) {
    const groups = new Map();
    (Array.isArray(carried) ? carried : []).forEach((item, slot) => {
      const flaskId = item && typeof item.flaskId === 'string' ? item.flaskId : null;
      if (!flaskId) return;
      if (!groups.has(flaskId)) groups.set(flaskId, []);
      groups.get(flaskId).push(slot);
    });
    for (const [flaskId, slots] of groups) {
      entries.push({ key: `carried:${flaskId}`, category: 'carried', kind: null, flaskId, count: slots.length, slots, useActionId: slots.includes(0) ? 'flask3' : null });
    }
  }
  return Object.freeze({
    entries: Object.freeze(entries.map((entry) => Object.freeze({ ...entry, slots: Object.freeze(entry.slots) }))),
    // Nothing to drink: every charge pool is dry and nothing is carried.
    empty: entries.every((entry) => entry.count <= 0),
  });
}

// The uiStrings row that words an entry's count ({count} is the token).
export function potionCountStringId(entry) {
  if (entry.category === 'charge') return entry.count === 1 ? 'potions.count.charge' : 'potions.count.charges';
  return entry.count === 1 ? 'potions.count.carried' : 'potions.count.carriedMany';
}
