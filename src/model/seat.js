// src/model/seat.js — the SEAT ruling: what a companion IS, before anyone
// builds one. Vocabulary and invariants only — NOTHING here ships behaviour.
// This file exists so the next builder starts from the ruling instead of
// rediscovering it (Viki, 2026-08-08, ruled at the one-map collapse; homed
// here 2026-08-14). The bundler never includes it: nothing in src/ imports
// it yet, and that is correct until the companion is built.
//
// HIS WORDS, in the order he said them (family record, claude-family repo,
// commons/decisions/directions.md):
//
//   D10 wave 2, 2026-08-08: "…or even adding a companion (leave it
//   configurable if the user or cpu controls the companion) each companion
//   will likely have their own deck armorment excetra and may be a permanent
//   companion for the run or temporary (I want this to be data driven …)"
//
//   D17 message 1, question 4, 2026-08-08: "cpu companion is teh same thing
//   as the coop companion (difference is that the coop companion levels up
//   on their own but the player can share weapons and weapon arts: perhaps
//   admin settings to  perhaps allow playe rto control the cpu, or even a
//   local coop drop in option to control that character)"
//
//   D17 message 2, 2026-08-08 (correcting against the G3 mock): "actually,
//   I like what g3 mock did for companion, but make the companion derive
//   from the classes available but with their own armor set and weapons and
//   deck"
//
// (The asks ledger indexes these as F6 — companion ≡ co-op SEAT — and F8 —
// companion chassis is a CLASS: commons/decisions/asks-ledger.md.)
//
// ═════════════════════════════════════════════════════════════════════════
// THE RULING — a CPU companion and a co-op partner are ONE SUBJECT: a SEAT.
//
// A seat is an actor in the run with its own class chassis (D17 msg 2: one
// of the available classes), its own deck, armour set, weapons, HP, RNG
// stream and turn. The co-op server (tools/session.mjs) already runs N of
// them deterministically; the couch client (src/ui/screens/coop.js
// `seats`/`seatIdx`/`me`) already drives several from one screen. The
// companion is not a new system — it is a seat whose driver is not a person.
//
// TWO AUTHORED CHARACTERISTICS, BOTH DATA, AND ONLY THESE TWO:
//
//   controller — WHO DRIVES IT (his "user or cpu"). Per-seat, mutable at
//     runtime: his "admin settings to allow player to control the cpu, or
//     even a local coop drop in option" is a controller CHANGE, which the
//     couch machinery (setSeat) already performs between 'local' and 'pad'.
//   tenure — HOW LONG IT STAYS (his "permanent … for the run or temporary").
//
// A companion row is those two words plus a chassis classId and its own
// gear/deck rows — an entry DESCRIBES, the machinery DERIVES (Law 0 c1).
//
// DERIVED, NEVER AUTHORED — the cells that must stay unbuildable:
//
//   · "has its own viewer" IS controller === 'remote'. Make it a field and
//     the vocabulary mints a CPU with its own screen and a remote human with
//     none — cells nobody built (the EldenSpire#78 lesson, both directions).
//   · "is it me" is a POINTER each viewing client holds (one `me` per
//     client), never a per-seat flag. A flag re-opens the same product one
//     level down: zero-me and two-me both become representable.
//
// THE INVARIANT THAT WILL BREAK FIRST IF NOBODY SAYS IT — AWAY ≠ TEMPORARY:
//
//   AWAY is PRESENCE, not tenure. An away member (`connected: false`,
//   tools/session.mjs) is coming back: their missed rewards QUEUE for their
//   return (the catch-up queue; the party bar says so in words). A
//   temporary seat's tenure ENDS: it leaves and nobody is coming back for
//   it — nothing may queue. Conflating `connected: false` with
//   `tenure: 'temporary'` fills an Ember Debt queue for a seat that no
//   longer exists. That is why 'away' and 'connected' are NOT values of
//   SEAT_TENURES and never may be. (Test 56 pins this red-first.)
//
// WHAT IS ENGINE AND WHAT IS DATA (Law 0 c2, the honest edge):
//
//   `controller: 'cpu'` is declared AHEAD of its engine, exactly like
//   'talisman'/'flaskSeed' in FLASK_GROWTH_SOURCES: the WORD exists, the
//   play-policy for a CPU seat is an engine act nobody has built. WHICH
//   companion is cpu-driven, its chassis, its gear, sharing weapons/arts
//   with the player, and the admin control setting are all rows/settings.
//
// AND THE MAP DOES NOT FORK: a seat adds an ACTOR, not a POSITION. One
// party position, one reachable set; vote pips exist because a remote human
// has an opinion — a CPU seat does not vote, and a couch seat votes through
// whoever holds the keyboard (the 2026-08-08 map ruling, mapboard.js).
// ═════════════════════════════════════════════════════════════════════════

// WHO DRIVES A SEAT. 'local' = the keyboard/screen owner; 'pad' = a couch
// gamepad owning the seat; 'remote' = a LAN client (the only value that
// implies a viewer); 'cpu' = the engine's play-policy, not yet built.
export const SEAT_CONTROLLERS = Object.freeze(['local', 'pad', 'remote', 'cpu']);

// HOW LONG A SEAT STAYS — his two words, verbatim subject: "permanent
// companion for the run or temporary" (D10 wave 2). Presence ('away',
// 'connected') is a different axis and may never appear here — see the
// invariant block above.
export const SEAT_TENURES = Object.freeze(['run', 'temporary']);
