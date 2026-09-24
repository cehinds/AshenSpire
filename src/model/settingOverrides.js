// ---- A SPECIFIC VALUE WINS, AND THE SCREEN SAYS SO (owner, 2026-09-23) -----
//
// "changes to specific stats should over write global stats with something in
// the settings clearly stating that or a toggle to over write global per stat
// … Disable fields if toggle isn't on."
//
// Two row properties carry that, and this module is their one reader:
//
//   own   — on a TOGGLE row. "<thing> uses its own value." On: the specific
//           rows it names are in force and win over the global they would
//           otherwise inherit. Off: they are ignored and the global applies.
//           Its key is the member's key with `gameConfig.` → `gameConfig.own.`,
//           so the toggle travels in exports and snapshots with the rest.
//   gate  — on a DEPENDENT row. The row does nothing while its gate is closed,
//           so the screen disables it (and, for an override, shows the value
//           it is inheriting instead of the one it would use).
//
// A toggle's default is whatever the game already did, so no existing profile
// or shipped value changes on upgrade: a class that ships its own rarity table
// starts ON; any specific value already stored in a profile turns its toggle ON.

export const OWN_PREFIX = 'gameConfig.own.';

/** The toggle key for a member key or member prefix. */
export function ownKey(member) {
  return String(member).replace(/^gameConfig\./, OWN_PREFIX);
}

/** The member key a toggle key governs (the inverse of `ownKey`). */
export function memberOfOwnKey(key) {
  return String(key).startsWith(OWN_PREFIX) ? `gameConfig.${String(key).slice(OWN_PREFIX.length)}` : key;
}

function isMember(key, member) {
  return key === member || key.startsWith(`${member}.`);
}

/**
 * ownOn(settings, own) → is the specific value in force?
 *
 * `own` is `{ member, defaultOn }`. An explicit stored boolean decides;
 * otherwise a stored member value turns it on, and failing that the default.
 */
export function ownOn(settings = {}, own) {
  const stored = settings[ownKey(own.member)];
  if (typeof stored === 'boolean') return stored;
  if (own.defaultOn) return true;
  return Object.keys(settings).some((key) => isMember(key, own.member));
}

/**
 * withoutUnowned(settings, owns) → the settings with every member value whose
 * toggle is OFF taken out, so no reader can apply a value the screen shows as
 * disabled. The stored value itself is kept in the profile: switching the
 * toggle back on brings it back.
 */
export function withoutUnowned(settings = {}, owns = []) {
  const off = owns.filter((own) => !ownOn(settings, own)).map((own) => own.member);
  if (!off.length) return settings;
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !off.some((member) => isMember(key, member))));
}

/**
 * gateOpen(settings, gate, rowFor) → does the gated row take effect?
 *
 * `gate` is `{ key, when? , own? }`. For an override gate (`own` set) the gate
 * is the toggle's resolved state. Otherwise it reads the gating row's value
 * (stored, else its default) and compares it with `when` (true by default).
 */
export function gateOpen(settings = {}, gate, rowFor = () => null) {
  if (gate.own) return ownOn(settings, gate.own);
  const row = rowFor(gate.key);
  const raw = row?.resolve ? row.resolve(settings)
    : Object.hasOwn(settings, gate.key) ? settings[gate.key] : row?.def;
  const want = gate.when === undefined ? true : gate.when;
  return Array.isArray(want) ? want.includes(raw) : raw === want;
}
