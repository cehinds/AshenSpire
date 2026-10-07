// THE SURFACE HAS TO REACH THE DOOR.
//
// #1000 ended the inspect door's inherited verb. Before it, card.js handed
// every door `opts.inspectionAction || (() => ({ enabled: false, reason: 'Play
// cards from your combat hand.' }))` — so the spoils screen, the merchant, the
// draft and the Smith all opened a card and offered a dead button wearing
// combat's word. #1000 replaced that with a triple the SURFACE supplies:
//
//   surface       which place in the game this card is standing on
//   availability  whether each act is offered, and the sentence if it is not
//   commands      the commit, which the surface owns and the door never holds
//
// It then wired combat.js to build all three for every card in the hand — and
// missed the one link in between. `mountHand` is the ONLY path from a combat
// hand entry to `renderCard`, and it went on forwarding `inspectionAction`,
// the field #1000 had just retired. The three new fields were built, passed to
// mountHand, and dropped on the floor.
//
// WHAT A PLAYER GOT: `renderCard` falls back to `const surface = opts.surface
// || 'none'`, and `cardActions('none', …)` is an empty list by design — the
// honest answer for a card you are only reading. So the inspect door on a
// combat hand card, the ONE surface whose verb had always worked, offered no
// button at all. The change meant to give every other surface its verb took
// combat's away.
//
// It shipped. It was caught by a review bot reading the promotion diff, not by
// any check in this repo, which is why this file exists: the forwarding is a
// seam between two files that each look correct alone.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const strip = (text) => text.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

const hand = strip(read('src/ui/components/hand.js'));
const combat = strip(read('src/ui/screens/combat.js'));
const card = strip(read('src/ui/components/card.js'));

let checks = 0;
const ok = (cond, what) => { checks++; assert.ok(cond, what); };

// ---- the surface builds the triple ------------------------------------------
ok(/surface:\s*'combat'/.test(combat), "combat.js names its surface on the hand entry");
ok(/availability:\s*\{\s*play:/.test(combat), 'combat.js supplies the play availability');
ok(/commands:\s*\{\s*play:/.test(combat), 'combat.js supplies the play command');

// ---- the hand forwards it, which is the link that was missing ---------------
// Read the ONE renderCard call in mountHand rather than the file at large: the
// defect was that this call's option object omitted the fields, while the same
// names appeared elsewhere in the file on the entry it was given.
const call = hand.match(/renderCard\(registries,\s*entry\.inst,[\s\S]*?\}\);/);
ok(!!call, 'mountHand still renders its cards through renderCard');
for (const field of ['surface', 'availability', 'commands']) {
  ok(new RegExp(`${field}:\\s*entry\\.${field}`).test(call[0]),
    `mountHand forwards entry.${field} to renderCard`);
}

// The retired field is gone from the code rather than merely unused: leaving it
// readable is what let a live-looking line keep the real one from being written.
ok(!/inspectionAction/.test(hand), 'hand.js no longer reads the retired inspectionAction');
ok(!/inspectionAction/.test(combat), 'combat.js no longer builds the retired inspectionAction');

// ---- the reuse signature carries the action state ---------------------------
// A kept card is a card whose signature did not change. Availability moves
// within a turn — the energy spent, the target gone — so a signature blind to
// it keeps a door that still says the act is offered.
const signature = hand.match(/const signature = JSON\.stringify\(\[[^\]]*\]\);/);
ok(!!signature, 'the hand still derives a reuse signature');
ok(/entry\.surface/.test(signature[0]) && /entry\.availability/.test(signature[0]),
  'the reuse signature includes the surface and its availability');
// `commands` are closures that resolve the live combat when pressed, so a kept
// one is never stale — and JSON.stringify drops functions, which would make a
// signature that named them silently blind rather than strict.
ok(!/entry\.commands/.test(signature[0]),
  'the reuse signature does NOT name commands, which JSON cannot carry');

// ---- the generic hold still belongs to cards with no act --------------------
// The predicate used to read the retired field, so it had quietly become
// "always true": the reading hold was arming on hand cards that own their own.
ok(/if \(inspectHold && !entry\.commands\)/.test(hand),
  'the generic reading hold arms only on a card with no command of its own');

// ---- and the door has no default verb to fall back to -----------------------
ok(/const surface = opts\.surface \|\| 'none';/.test(card),
  "renderCard's fallback surface is 'none'");
ok(!/Play cards from your combat hand/.test(card),
  'no inherited combat verb survives in card.js');

console.log(`PASS ${checks}/${checks}; the hand forwards its surface, availability and commands to the inspect door`);
