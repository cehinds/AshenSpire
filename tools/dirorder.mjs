// tools/dirorder.mjs — the one home for "what order do we read a directory in?"
//
// WHY THIS FILE EXISTS
// -------------------
// A build tool that iterates a directory with a bare `readdirSync` inherits the
// FILESYSTEM's order, and that order is not a property of the repo — it is a
// property of the machine. `build/AshenSpire.html` as committed at 40c5b21 proves
// it: its ASSET_MAP holds the same 97 keys as a Linux rebuild, in an order that
// differs at exactly two positions —
//
//     committed : … enemy_blightedValkyrie.webp , enemy_blightHound.webp …
//     rebuilt   : … enemy_blightHound.webp      , enemy_blightedValkyrie.webp …
//
// The committed order is CASE-INSENSITIVE collation ("blighted" < "blighth"),
// i.e. the shipped bundle was built on a case-insensitive filesystem (NTFS or
// APFS). So the artifact could not be reproduced — and therefore could not be
// verified by hash — from its own source at its own ref.
//
// THE TRAP, and it is the reason this is a module and not two `.sort()` calls:
// `localeCompare` and any case-insensitive comparator REPRODUCE the bad order.
// The fix is only a fix because it is byte order — locale-independent,
// collation-independent, identical on every runner. Written once, here, with the
// reason attached; a `.sort()` at each call site is the decision copied twice
// with its reason nowhere.
//
// Callers: tools/bundle.mjs (assets/ sweep), tools/content-build.mjs
// (content/source sweep). Both previously held this decision, and only one of
// them knew it.
//
// REMOVAL CONDITION (SOP 1's corollary): delete this file the day fewer than two
// tools read a directory whose order reaches a shipped artifact — one caller is a
// local helper and belongs inline. Also delete it if a future build stops
// embedding iteration order in its output at all (e.g. the asset map becomes a
// sorted-at-load structure), because then the order is no longer observable and
// this guard is guarding nothing.

import { readdirSync } from 'node:fs';

/**
 * readdirSortedSync(dir, options?) → the same value `readdirSync` returns, in
 * byte order. Pass `{ withFileTypes: true }` and Dirents come back sorted by
 * `.name`. Byte order deliberately: see the trap above.
 */
export function readdirSortedSync(dir, options) {
  const entries = readdirSync(dir, options);
  if (entries.length && typeof entries[0] === 'string') {
    return entries.sort(byteOrder);
  }
  return entries.sort((a, b) => byteOrder(a.name, b.name));
}

// Explicit comparator rather than a bare `.sort()` so nobody "improves" it into
// a locale-aware one. `<`/`>` on JS strings compare UTF-16 code units, which is
// what every runner agrees on.
function byteOrder(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
