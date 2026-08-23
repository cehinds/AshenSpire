#!/usr/bin/env node
// tools/armoury-picked-up.mjs — the Armoury tells the truth about what you are
// carrying, and every item is a card you press.
//
// Constantine, 2026-08-21, three asks in one message and one correction after:
//   1. "it should only show armory you actually picked up mid run"
//   2. "each item should be folded panes that can expand"
//   3. "clicking on the armory item pane should auto expand it with a button to
//      equip (un equip in red if it's already equipped)"
//   correction: "the sub button under the folded weapon army item pane should
//      NOT exist. it should be part of the card and is revealed pressing the
//      card instead"
//
// THREE PROPERTIES, ONE PER ASK, AND A3 CARRIES THE CORRECTION AS A NEGATIVE.
//
//   A1  THE SHELF IS THE RUN'S, NOT THE PROFILE'S. Every piece the picker
//       offers is one this RUN carries (or one tagged basic — his own earlier
//       ask, A7, and the one exception this property allows by name). Measured
//       at the MODEL door, `ownership()` in src/model/loadout.js, because that
//       is the single predicate `eligible()` in the screen calls; a page count
//       is carried beside it as the surface witness.
//   A2  EVERY ITEM ARRIVES FOLDED. Each candidate is a face with
//       aria-expanded="false" and nothing revealed under it at open.
//   A3  THE CARD IS THE CONTROL. Pressing a face opens exactly that face,
//       reveals one equip control, and that control says Unequip — carrying the
//       danger class, which is what "in red" is in this stylesheet — when the
//       piece is the one already in the set. AND THE NEGATIVE, which is his
//       correction stated as a check: no pressable control exists in the
//       candidate list that is not a face, inside the revealed panel, OR THE
//       ONE GRIP A6 RULES ON. A sub button relabelled is still a sub button,
//       and this is what catches it.
//
//       THE EXCEPTION IS HIM OVERRIDING HIMSELF AND IT IS NOT SMOOTHED HERE.
//       On 2026-08-21 he corrected item 3 to *"the sub button ... should NOT
//       exist"*; on the same day he ruled TWO ELEMENTS, which puts a control
//       back outside the card. Both sentences are his, the second is later, and
//       the check follows the later one — but only for a control that is
//       exactly `.ep-hold`, exactly one per face, immediately after its own
//       face. Anything else outside a card is still A3.stray.
//
//   A6  TWO ELEMENTS, ONE GESTURE EACH (his ruling, 2026-08-21). The grip holds
//       the hold and nothing else: a real pointer press, held past the player's
//       own dial, equips — and an EARLY RELEASE does nothing at all, neither
//       equipping (rule 1) nor leaking a click into the card's unfold path.
//       The card keeps its click, the in-card button keeps its click, and
//       NEITHER of the other two is armed. Driven with REAL CDP INPUT — mouse
//       and touch — not DOM `.click()`, because a hold is a pointer press by
//       nature and a wired handler is not a finger.
//
// DOOR. The source tree, served by the repo's own tools/serve.mjs, driven in
// real Chromium through tools/browser.mjs's CDP path — the same road every
// other driven tool here takes, and the road tools/screenshot.mjs does NOT take
// (it prints an 87 px white band and exits 0 under Chromium 141; a green from
// it means nothing). `--selftest` plants each known-bad as BYTES in the file the
// real defect would ship in and re-runs this whole tool against the copy.
//
// Usage:  node tools/armoury-picked-up.mjs
//         node tools/armoury-picked-up.mjs --selftest
// Exit:   0 all green · 1 any finding · 2 the harness could not run
//
// BOUNDARY, and it is the extent of the green. One Linux container, one
// headless Chromium, and — for A1/A2/A3 — ONE SHAPE (1200x730) and ONE BOARD:
// `?shot=combat`,
// which is the IN-COMBAT mount (inCombat: true). The map's Armoury is a second
// mount with a different `meta` and a live onChange, and NOTHING HERE SPEAKS
// FOR IT. A1's model half is shape-free and covers both; A2 and A3 are the
// combat mount only.
//
// REMOVAL CONDITION: deleted the day the Armoury stops being the shelf — if the
// picker ever moves off `ownership()`, A1 is measuring a predicate nobody reads.
//
// -----------------------------------------------------------------------------
// FINDING CODES — one closed set, read by BOTH the emitter and the plant, so the
// second copy never exists. Added 2026-08-21 after Saga's WITHHOLD at ea2cf89.
//
// WHAT BIT US, and it was my own rule from both ends. I wrote that an
// `expectRed` matching a check ID instead of a sentence is not a plant but a
// hope — /FAIL A1/ is satisfied by whichever of A1's three sub-checks happens to
// fire, so it catches something and measures nothing. That correction was right
// and it is kept. What it did NOT survive is the inverse: an `expectRed` bound
// to a SENTENCE dies silently the day the sentence is reworded. Both of A1's
// plants asserted prose this file no longer printed; the checks discriminated
// correctly in both directions and the corpus reported NOT CAUGHT anyway.
//
// THE ANCHOR, and why it cannot rot either way:
//   · A code names ONE ASSERTION IN ONE DIRECTION — `A1.wide` (the shelf offers
//     what the run never picked up) and `A1.step` (a pickup does not move the
//     shelf) are different codes, so a plant bound to one CANNOT be satisfied by
//     the other. That is the discrimination the sentence was bought for.
//   · The prose stays free. Reword any FAIL line and every plant still holds:
//     the code and the sentence are printed by ONE call, so they cannot drift
//     into two copies of the same fact.
//   · A plant naming a code this file cannot emit THROWS AT LOAD (`redRe`
//     below), so a rename is a hard red on the next run, never a silent green.
//     doorplant already gives the plant's FIND-STRING that guarantee; this gives
//     it to the assertion side, which is the half that was missing.
//
// REMOVAL CONDITION for the codes: deleted the day a plant is bound to something
// stronger than an output match — a structured findings array the harness reads.
// Then the string is the second copy and this block is the thing to cut.
const CODES = new Set([
  'A1.wide',   // the shelf offers a piece neither in the kit nor picked up
  'A1.floor',  // the shelf is empty rather than narrow
  'A1.step',   // picking a piece up does not move the shelf by exactly one
  'A2.faces',  // the picker draws no item faces at all
  'A2.folded', // the items do not arrive folded
  'A3.stray',  // a pressable control sits outside the card
  'A3.press',  // pressing the card does not reveal exactly that card
  'A3.control',// the revealed card carries no equip control
  'A3.marked', // no face is marked as the equipped piece
  'A3.word',   // the equipped card's control does not say Unequip
  'A3.danger', // the unequip control does not carry .danger
  'A4.nocard', // no card on the map mount to press
  'A4.acted',  // a short click equipped or unequipped
  'A4.unfold', // a short click did not unfold the card
  'A5.refold', // clicking again did not refold
  'A5.pose',   // could not pose an open card with somewhere outside it
  'A5.offcard',// clicking off the card left it open
  // A6 — HIS TWO-ELEMENT RULING (2026-08-21). The grip carries the hold; the
  // card keeps its click; the in-card button keeps its click. Every code below
  // names ONE assertion in ONE direction, so a plant bound to one can never be
  // satisfied by another (the anchor rule, above).
  'A6.nogrip',      // a card has no grip immediately after it
  'A6.unreachable', // the grip has no box while the list is folded
  'A6.unarmed',     // the grip publishes no armed hold while the dial is on
  'A6.thumb',       // the grip is shorter than the tap floor
  'A6.face',        // the card face itself carries an armed hold
  'A6.finger',      // no real pointer press could be landed on the grip
  'A6.leak',        // an aborted hold unfolded the card
  'A6.acted',       // an aborted hold equipped or unequipped
  'A6.equips',      // a completed hold did not equip
  'A6.tail',        // the lift after a completed hold dispatched a click the swallow did not eat
  'A6.button',      // the in-card equip button no longer equips on a plain click
  // A7/A8 — SOMETHING ARMED THAT SHOULD NOT BE, AND SOMETHING NEVER DISARMED.
  // Both found by Codex on 2026-08-22, both verified here before either was
  // touched. One direction per code, as above.
  'A7.nokey',    // the focus cursor could not be walked onto the grip with real keys
  'A7.keyhold',  // a held Confirm KEY did not commit on the grip
  'A7.swallow',  // the next ordinary keyboard activation was eaten by the lift-eater
  'A8.leak',     // window keydown listeners outlived the closed Armoury
  'A8.escleak',  // the Escape handler outlived the closed Armoury
  // A7's MOUSE half and A9 — Codex again, 2026-08-22 (P2a, P2b), both verified
  // here before either was touched. `A7.premise` is the odd one and says so: it
  // is a finding about the BROWSER, not this app — the fact equipment.js's
  // pointerType gate rests on, asserted so it can stop being true out loud.
  'A7.premise',      // a mouse release over a REMOVED element made a click after all
  'A7.nomouse',      // no grip could be held with a real mouse — the road was not driven
  'A7.mousehold',    // a completed MOUSE hold did not commit on the grip
  'A7.mouseswallow', // the next activation after a MOUSE hold was eaten by the lift-eater
  // A7's CANCEL half — the THIRD arming road, found 2026-08-22 after the first
  // two were closed one at a time. A completed hold whose pointer is then
  // CANCELLED (a system gesture, lost capture, palm) never lifts, so no click
  // is ever dispatched — measured, both with the grip present and with it
  // removed. One direction per code, as above.
  'A7.nocancel',      // no grip to cancel on — the cancel road was not driven
  'A7.cancelhold',    // a hold cancelled AFTER full did not commit on the grip
  'A7.cancelabort',   // a hold cancelled BEFORE full committed anyway
  'A7.cancelswallow', // the next activation after a CANCELLED hold was eaten
  'A7.nomulti',       // no grip could be driven with two overlapping pointers
  'A7.multicommit',   // the original above-full pointer did not commit
  'A7.multitail',     // another pointer disarmed the original pointer's lift eater
  'A7.multiabort',    // an overlapping below-full pointer committed anyway
  'A9.name',         // a grip does not name its piece in the accessibility tree
  'A9.collide',      // two grips in one picker share an accessible name
  'A9.hold',         // an armed grip's accessible name does not say that it requires a hold
  'A9.sealedhold',   // a sealed grip claims a hold gesture it cannot arm
  'A9.blind',        // no picker opened, so no grip name was read at all
]);
// NO CODE FOR THE BOUNDARY PLANT, DELIBERATELY. A code in this set is a finding
// this file EMITS; the boundary plant asserts the opposite — that the run died
// without emitting anything and printed its boundary anyway. Giving it a code
// would put one fact in two homes and make the closed set a lie about itself.
// That plant binds to the boundary's own words; see BOUNDARY_ANCHOR below.
const BOUNDARY_ANCHOR = /THE RUN DIED, so this count is what was reached/;
const known = (code) => { if (!CODES.has(code)) throw new Error(`armoury-picked-up: unknown finding code "${code}" — the codes are a closed set; add it above or fix the caller.`); return code; };
/** The one emitter: the code and its sentence are born in the same call.
 *
 *  IT ALSO KEEPS THE LIST, and that is a defect this tool paid for on
 *  2026-08-22. `doorplant` quotes the LAST EIGHT LINES of a red run, and this
 *  tool's boundary is far longer than eight lines — so a clean-copy red inside
 *  `--selftest` printed nothing but boundary prose and the finding was
 *  invisible in the one place it had to be read. Every call site prints its own
 *  red where it happens; `finish()` prints them again, LAST, so a harness that
 *  reads the end of the output reads the findings. Recorded here rather than at
 *  the fourteen call sites because this call is the one home a finding is born
 *  in — every `red(...)` is evaluated only on the failing branch of its own
 *  ternary, so this list is exactly the findings and never the passes. */
const FOUND = [];
const red = (code, text) => { const line = `FAIL [${known(code)}] ${text}`; FOUND.push(line); return line; };
/** The one anchor a plant may use. Unknown code = throw, not a quiet miss. */
const redRe = (code) => new RegExp(`FAIL \\[${known(code).replace('.', '\\.')}\\]`);

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  // THE GATE LINE, ONCE. Three plants edit this exact literal, and a plant
  // whose find-string has drifted from source does not fail — doorplant reports
  // NOT CAUGHT and the check underneath it goes unwatched, which is how the
  // A6.tail plant sat green while its subject had moved. One copy here means a
  // change to the gate breaks all three loudly, together, in the same run.
  const GATE = "onConfirm: (ev) => { if (ev && ev.type === 'pointerdown') eatTheLift(ev.pointerId); act(); },";
  // THE ONE PREDICATE, ALSO ONCE. `WHOSE` is the line that closes all three
  // arming roads — the eater eats the click carrying its own gesture's
  // pointerId and nothing else. Three plants below remove it; if it is
  // reworded, all three break loudly together instead of quietly reporting
  // NOT CAUGHT, which is the whole reason GATE lives up here too.
  const WHOSE = '          if (e.pointerId !== pointerId) return;';
  const DOWN = "        const down = (e) => { if (e.pointerId === pointerId) off(); };";
  const LABEL = "        `${verb} ${entry.face.label}${act && gripMs > 0 ? ' — hold' : ''}`);";
  const RELEASE_END = "      onEnd: () => { if (armed) stop('idle'); return true; },";
  // The cancel teardown, which is HYGIENE ON TOP OF `WHOSE` and not a second
  // guard for a second case: a cancelled pointer dispatches no click, so the
  // eater is torn down rather than left inert. A plant that wants the cancel
  // defect back has to remove both, and that is a fact about the fix.
  const CANCELDOWN = "        addEventListener('pointercancel', gone, true);";
  const UNGUARDED = '          /* planted: the eater does not check whose lift this is */';
  process.exit(await doorSelftest({
    tool: 'armoury-picked-up.mjs',
    timeoutMs: 900000,
    plants: [
      {
        // A1's known-bad, and it is THE DEFECT AT dev: the shelf reads the
        // profile as well as the run, so a piece found in an earlier climb is
        // offered in this one. One word in a content table, which is the point.
        name: 'the shelf goes back to profile-wide (persistence: both)',
        edits: [{ file: 'src/content/balance.js',
          find: "    persistence: 'perRun',",
          replace: "    persistence: 'both'," }],
        // BOUND TO ITS OWN DIRECTION BY CODE, not by prose. `both` widens the
        // shelf past the run, so A1.wide is the sentence this defect owns.
        expectRed: redRe('A1.wide'),
      },
      {
        // THE OTHER DIRECTION OF THE SAME COLLAPSE, and it is the one my own
        // Charter row names as the worse silence: not "the shelf is too wide"
        // but "the shelf invented a state nobody built". `unlocked` is a legal
        // value of this closed set that makes the run's own pickups invisible —
        // a player collects a sword and the Armoury does not offer it.
        name: 'the shelf stops counting the run at all (persistence: unlocked)',
        edits: [{ file: 'src/content/balance.js',
          find: "    persistence: 'perRun',",
          replace: "    persistence: 'unlocked'," }],
        // BOUND TO ITS OWN DIRECTION, and this is a correction to my first
        // draft rather than caution. `expectRed: /FAIL A1/` passed here — but
        // it passed on the OTHER sub-check's line, the same "offers too much"
        // sentence the plant above produces. A plant whose name says
        // "the run's pickups go invisible" and whose evidence says
        // "the shelf is too wide" has caught something and measured nothing
        // (SOP 14 §3: failing for the wrong reason is not red). The emptiness
        // direction is the one my own Charter row names as the worse silence,
        // so it gets the assertion that can only be satisfied by it.
        //
        // THAT REASONING STANDS; ITS ANCHOR DID NOT. The tightening above was
        // written against a sentence this file has since reworded, so the plant
        // asserted prose nobody prints and reported NOT CAUGHT while the check
        // discriminated perfectly. A1.step is the same direction stated as a
        // code: `both` does not fire it, `unlocked` does.
        expectRed: redRe('A1.step'),
        // BOUNDARY, measured not assumed: an empty shelf also draws no cards on
        // the map mount, so this plant additionally kills the A4/A5 stage with
        // `timeout picker`. The catch above is the MODEL-DOOR red, which prints
        // before any browser boots — not the crash.
      },
      {
        // A2's known-bad: the panes arrive already open. This is the state the
        // screen was in at dev — every candidate's comparison rendered inline,
        // permanently — so the plant restores the shipped defect rather than
        // inventing one.
        name: 'the candidate panes open unfolded',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '    const fold = mountDisclosure(list, entries, { moreLabel: \'more\' });',
          replace: '    const fold = mountDisclosure(list, entries, { moreLabel: \'more\' });\n'
            + '    if (entries.length) fold.open(entries[0].key); // planted: arrives open' }],
        // A2 has two directions too — "no faces at all" is a different defect
        // from "the faces arrive open". This plant owns the second.
        expectRed: redRe('A2.folded'),
      },
      {
        // A3's known-bad, and it is HIS CORRECTION planted: a second control
        // hung under the pane instead of living inside the card. It equips
        // correctly and reads plausibly, which is exactly why the negative
        // check has to exist rather than being argued.
        name: 'a sub button returns under the pane',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '    return box;\n  }\n\n  /** The rewrites, live:',
          replace: '    const sub = document.createElement(\'button\');\n'
            + '    sub.type = \'button\'; sub.className = \'ep-sub\'; sub.textContent = \'Stats\';\n'
            + '    list.appendChild(sub); // planted: the sub button he removed\n'
            + '    return box;\n  }\n\n  /** The rewrites, live:' }],
        expectRed: redRe('A3.stray'),
      },
      {
        // The RED half of "un equip in red". A plant that repaints the control
        // without changing its word: it still says Unequip, still equips
        // nothing, and only the danger class is gone. If the check is really
        // reading the colour channel this goes red; if it was only reading the
        // word, this passes and the check was half of what it claimed.
        name: 'the unequip control loses its danger class (word unchanged)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: "      btn.className = equipped ? 'ep-equip danger' : 'ep-equip';",
          replace: "      btn.className = 'ep-equip';" }],
        // The colour channel ONLY. A3.word is the other half of his sentence and
        // this plant leaves the word alone on purpose, so binding to A3.word
        // would be the "caught something, measured nothing" failure again.
        expectRed: redRe('A3.danger'),
      },
      // ---- A6, HIS TWO-ELEMENT RULING ---------------------------------
      // ALL SIX BELOW WERE HAND-PLANTED IN THE REAL TREE FIRST and reverted;
      // this door is the repeatable copy of that, not the evidence for it.
      {
        // THE ONE THE RULING WAS BOUGHT WITH. Two elements exist so that no
        // control carries both gestures — so the aborted hold's click must have
        // NO path to the fold. This wires one by hand, in front of armHold's
        // own swallow so it runs first, which is exactly the "second door"
        // rule 1 forbids. Hand-planted red on BOTH mouse and touch.
        name: 'the grip also unfolds the card (rule 1 leaks a second door)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '      heldGrips.push(armHold(grip,',
          replace: "      grip.addEventListener('click', () => fold.open(entry.key)); // planted: the second door\n"
            + '      heldGrips.push(armHold(grip,' }],
        expectRed: redRe('A6.leak'),
      },
      {
        // THE CARD CLAIMS THE HOLD. Bound to the PUBLISHED attribute, and that
        // is a deliberate narrowing rather than caution. The behavioural
        // known-bad — actually `armHold(face, …)` — was hand-planted too and it
        // reds A4.acted + A4.unfold FIRST (a DOM click on an armed control is
        // `detail === 0`, so it commits instead of folding) and then empties the
        // shelf, taking the whole A6 stage with it: exit 2, A6.face never
        // reached. Binding this plant to A6.face would then have been a plant
        // that catches something and measures nothing — my own named failure.
        // So the plant states the direction the CHECK can actually own: a face
        // that publishes an armed hold, which is a lying page whether or not a
        // hold is behind it (holdbeat.js and main.js both read that attribute).
        name: 'a card face publishes an armed hold',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '      heldGrips.push(armHold(grip,',
          replace: '      face.dataset.holdMs = String(gripMs); // planted: the face claims a hold\n'
            + '      heldGrips.push(armHold(grip,' }],
        expectRed: redRe('A6.face'),
      },
      {
        // THE ARRANGEMENT THIS ONE WAS CHOSEN OVER, planted so the choice is
        // the tool's finding and not this file's prose. A grip inside the
        // revealed pane is in the DOM and measures 0x0 while the list is
        // folded: no pointer can reach it, so the hold can only be performed
        // after the click it exists to save.
        name: 'the grip moves inside the revealed pane (the arrangement this one was chosen over)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: "      face.insertAdjacentElement('afterend', grip);",
          replace: '      entry.reveal.node.appendChild(grip); // planted: the grip lives in the pane' }],
        expectRed: redRe('A6.unreachable'),
      },
      {
        // WHAT A THUMB GETS. This plant caught the CHECK, not the product: the
        // first draft read the floor off `getComputedStyle('.ep-hold').minHeight`
        // — the resolved value of the rule it was guarding — so deleting the
        // rule deleted the check and the tool EXITED 0 on a 19 px hold target.
        // The floor now comes from `--tap-floor`, the datum balance.ui.tapSize
        // writes for the whole app, measured through a probe box.
        name: 'the grip loses its tap floor (what a thumb gets)',
        edits: [{ file: 'styles/ui.css',
          find: '  min-height: var(--tap-floor);\n  width: 100%;',
          replace: '  width: 100%;' }],
        expectRed: redRe('A6.thumb'),
      },
      {
        // THE LIFT AFTER THE COMMIT, and it is TOUCH-ONLY by nature: a mouse
        // release over a removed element generates no click at all, a finger
        // does. Hand-planted red at 1200x730 with the release landing on
        // `BUTTON.es-cell` — a picker the player never asked for.
        name: 'the lift after a completed hold is not swallowed (the redraw eats the finger)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: GATE,
          replace: 'onConfirm: act, /* planted: no lift swallow */' }],
        expectRed: redRe('A6.tail'),
      },
      {
        // CODEX, 2026-08-22, AND THE INVERSE OF THE PLANT ABOVE. That one takes
        // the eater away from the road that needs it; this one gives it back to
        // the three roads that do not. Verified before it was fixed: a held
        // Confirm key committed on the grip and the next Enter on the view tab
        // did nothing at all.
        // TWO EDITS, AND THE SECOND ONE IS THE POINT. Widening the road gate
        // alone no longer reproduces this: the eater armed on a keyboard
        // commit waits for a click carrying a pointerId the keyboard has not
        // got (input.js's synthetic click is id -1, measured), so it starves
        // instead of eating. The defect needs the PREDICATE gone as well —
        // which is the honest statement that `WHOSE`, not the road gate, is
        // what closed this road.
        name: 'the lift-eater is armed on every road, and does not check whose lift it eats',
        edits: [
          { file: 'src/ui/screens/equipment.js',
            find: GATE,
            replace: 'onConfirm: (ev) => { eatTheLift(ev && ev.pointerId); act(); }, /* planted: armed on keyboard and pad too */' },
          { file: 'src/ui/screens/equipment.js', find: WHOSE, replace: UNGUARDED },
        ],
        expectRed: redRe('A7.swallow'),
      },
      {
        // CODEX, 2026-08-22 (P2a). THE HALF THE FIRST GATE LEFT: `pointerdown`
        // alone is true of a MOUSE press too, and a mouse release over the
        // element `act()` has just removed makes no click — so the eater armed
        // and never fired, and the next activation on ANY other road paid for
        // it. This plant restores exactly that state: the road gate stays, the
        // device gate goes. A6 CANNOT SEE IT — `[]` after a mouse lift either
        // way — so it is bound to A7's mouse-origin check, which watches the
        // product: one keyboard Enter on a view tab after a mouse hold.
        // REPOINTED 2026-08-22 WITH THE THIRD FINDING. This plant used to
        // delete `pointerType !== 'mouse'`, and that gate no longer exists:
        // the device special case was the wrong shape of answer and the
        // predicate replaced it. The defect it named is still exactly one edit
        // away — an eater that does not ask whose lift it is arms on the mouse
        // road with a pointerId nothing will ever match, and eats the next
        // keyboard activation instead. SURGICAL: the keyboard road stays
        // closed by the road gate and the cancel road by its teardown, so this
        // plant reds A7.mouseswallow and nothing else.
        name: 'the lift-eater does not check whose lift it is (the MOUSE road, Codex P2a)',
        edits: [{ file: 'src/ui/screens/equipment.js', find: WHOSE, replace: UNGUARDED }],
        expectRed: redRe('A7.mouseswallow'),
      },
      {
        // THE THIRD ARMING ROAD, 2026-08-22. A touch hold that reaches full
        // COMMITS and then the pointer is CANCELLED rather than lifted — a
        // system gesture, a lost capture, a palm. No click is ever dispatched
        // (measured on a probe button, both sides), so the eater armed at full
        // outlives its own gesture.
        //
        // THIS ROAD IS CLOSED TWICE AND THE PLANT SAYS SO BY NEEDING BOTH
        // EDITS. `WHOSE` makes the armed eater inert; `CANCELDOWN` removes it
        // outright. Neither alone reproduces the defect, which is the honest
        // shape of the fix and not a plant being generous with itself.
        //
        // BOUNDARY, STATED: removing `WHOSE` also reds A7.mouseswallow in the
        // same run, because it is one predicate serving both roads. This plant
        // is bound to A7.cancelswallow, the road furthest from where the
        // predicate is written, so it can only be satisfied by its own stage.
        name: 'the eater is not torn down when a completed hold is CANCELLED instead of lifted',
        edits: [
          { file: 'src/ui/screens/equipment.js', find: WHOSE, replace: UNGUARDED },
          { file: 'src/ui/screens/equipment.js',
            find: CANCELDOWN,
            replace: '        /* planted: no teardown when the gesture is cancelled */' },
        ],
        expectRed: redRe('A7.cancelswallow'),
      },
      {
        name: 'another pointerdown disarms this gesture\'s lift eater',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: DOWN,
          replace: '        const down = () => off(); /* planted: any pointer disarms A */' }],
        expectRed: redRe('A7.multitail'),
      },
      {
        // The below-full overlap control must read AFTER A lifts. This plant
        // commits at that boundary; a pre-lift sample cannot see it.
        name: 'an overlapping below-full hold commits when pointer A releases',
        edits: [{ file: 'src/ui/components/holdconfirm.js',
          find: RELEASE_END,
          replace: "      onEnd: () => { if (armed) { stop('idle'); onConfirm(ev); } return true; }, /* planted: release commits */" }],
        expectRed: redRe('A7.multiabort'),
      },
      {
        // CODEX, 2026-08-22 (P2b). The grip loses its accessible name and
        // nothing else changes: it still equips, still holds, still meets the
        // tap floor, still reads `Equip` on screen. Every other check in this
        // file passes. Measured at the max edge before the fix — eight grips,
        // seven named `Equip HOLD`, six collisions — which is the state this
        // plant returns the tree to.
        name: 'the grip loses the piece name from its accessible name (Codex P2b)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: "      grip.setAttribute('aria-label',\n" + LABEL,
          replace: '      /* planted: the grip is named `Equip` and nothing else */' }],
        expectRed: redRe('A9.name'),
      },
      {
        name: 'an armed grip omits the hold instruction from its accessible name',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: LABEL,
          replace: '        `${verb} ${entry.face.label}`); /* planted: HOLD is hidden from assistive tech */' }],
        expectRed: redRe('A9.hold'),
      },
      {
        name: 'a sealed grip claims the hold instruction even though it cannot arm',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: LABEL,
          replace: "        `${verb} ${entry.face.label}${gripMs > 0 ? ' — hold' : ''}`); /* planted: sealed claims hold */" }],
        expectRed: redRe('A9.sealedhold'),
      },
      {
        // CODEX, 2026-08-22. `draw()` drains the grips; a CLOSE runs no draw.
        // Removing the drain from `close()` is the defect exactly as it stood.
        name: 'the grips are not disarmed when the Armoury closes',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '    while (heldGrips.length) heldGrips.pop()();\n    document.removeEventListener',
          replace: '    /* planted: no grip drain on close */\n    document.removeEventListener' }],
        expectRed: redRe('A8.leak'),
      },
      {
        // THE HALF THAT WAS NOT MINE, planted so the repair is watched too. This
        // is dev's behaviour restored: the Escape handler removes itself only on
        // the Escape path, so every ✕ and every backdrop tap leaves one behind.
        name: 'the Escape handler is only removed on the Escape path (dev\'s shape)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: "    document.removeEventListener('keydown', onKey);\n    wrap.remove();",
          replace: '    wrap.remove();' }],
        expectRed: redRe('A8.escleak'),
      },
      {
        // THE INSTRUMENT'S OWN EXIT, and it is planted in THIS FILE because that
        // is where the defect would live. Bjorn measured 41 of 69 boundary-
        // printing tools with an exit path above their print; this tool had
        // three. The plant makes the first driven wait unreachable, so the run
        // dies in the harness with nothing checked — and the assertion is that
        // the BOUNDARY PRINTS ANYWAY and the exit is 2.
        //
        // Bound to the boundary's own sentence rather than to a finding code:
        // there is no finding here, which is the whole point (see the note by
        // BOUNDARY_ANCHOR). If that sentence is reworded this plant fails loudly
        // on the next run, which is the correct direction for it to rot.
        name: 'the run dies in the harness before a single check (does the boundary still print?)',
        //
        // The find-string carries the `?shot=combat` line above it ON PURPOSE:
        // this plant edits the tool it is written in, so a bare `until(...)`
        // token would match the plant's OWN definition first (doorplant replaces
        // the first occurrence) and arm nothing. That is the plant-editing-
        // itself trap, and it costs one line of context to close.
        edits: [{ file: 'tools/armoury-picked-up.mjs',
          find: `?shot=combat\` }, S);\n    await until("!!document.querySelector('.combat .hand .card')", 'combat');`,
          replace: `?shot=combat\` }, S);\n    await until("!!document.querySelector('.combat .hand .card-that-cannot-exist')", 'combat');` }],
        expectRed: BOUNDARY_ANCHOR,
      },
      {
        // HIS OWN GUARDRAIL ON HIS OWN RULING: the grip must not become the
        // only road. Anyone who cannot perform a hold — on any input — still
        // has the control inside the opened card.
        name: 'the in-card control stops equipping (the hold becomes the only road)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: "      if (seal.ok) btn.addEventListener('click', act);",
          replace: "      if (seal.ok && false) btn.addEventListener('click', act); // planted: the hold is the only road" }],
        expectRed: redRe('A6.button'),
      },
    ],
  }));
}

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = BROWSERS.find((p) => p && existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHAPE = [1200, 730];

let fails = 0; let checks = 0;
const ok = (cond, what) => { checks++; if (cond) console.log(`    PASS ${what}`); else { fails++; console.log(`    ${what}`); } };

// ---------------------------------------------------------------------------
// ONE EXIT, AND THE BOUNDARY IS PART OF IT.
//
// Bjorn measured 41 of 69 boundary-printing tools with an exit path ABOVE their
// print, and Sunna's own tool was one of them the same night — an unreachable
// subject gave 0 boundary lines, 0 verdict lines, exit 2, under a comment three
// lines up calling the print unconditional. THIS TOOL WAS ONE TOO, THREE TIMES
// OVER: the no-Chrome exit, the harness-death catch, and a throw out of
// `a1Model()` (which runs before the try, so it exited 1 — the code reserved
// for A FINDING — having checked nothing and said nothing).
//
// A comment cannot fix that, and neither can three careful `console.log`s: the
// defect is that there was more than one place to leave from. There is now one.
// Every exit in this file goes through `finish()`, so the boundary cannot be
// skipped by a path added later — which is the only version of this that stays
// true after I stop looking at it.
//
// WATCHED, not asserted: `--selftest`'s `A0.boundary` plant makes the first
// `until` unreachable and the run dies in the harness. The boundary prints
// anyway, and exit is 2.
let boundaryPrinted = false;
function finish(code, why = null) {
  if (why) console.error(`    HARNESS could not run: ${why}`);
  if (!boundaryPrinted) {
    boundaryPrinted = true;
    console.log(`\n  ${checks} checks, ${fails} finding(s)${why ? ' — THE RUN DIED, so this count is what was reached, not what exists' : ''}`);
    console.log('  BOUNDARY: one container, one headless Chromium, ONE shape (1200x730). A1 is a model-door');
    console.log('  check and is shape- and mount-free. A2/A3 drive ?shot=combat (the IN-COMBAT mount, where');
    console.log('  canEquip seals every act); A4/A5 drive ?shot=map (where it does not). The fold checks are');
    console.log('  DOM clicks, not synthetic pointer presses, and they prove the handler wiring only.');
    console.log('  A6 IS THE ONE THAT PROVES A REAL FINGER CAN REACH A CONTROL, and two other PRs now');
    console.log('  defer to it, so its extent is stated positively: REAL CDP input — Input.dispatchMouseEvent');
    console.log('  AND Input.dispatchTouchEvent — aimed at the coordinates elementFromPoint reports for the');
    console.log('  control, with a pointerdown recorded on the element either side, so a press that misses');
    console.log('  is A6.finger and never a quiet pass. WHAT A6 DOES NOT COVER: any shape but 1200x730;');
    console.log('  any control but the Armoury grip, the card face and the in-card button; the pad; a real');
    console.log('  human finger\'s size, angle or accuracy (a CDP point is exact and a thumb is not); and');
    console.log('  anything under a CSS transform or a body zoom — rect px and CDP input px are different');
    console.log('  spaces (#304), and A6 aims in RAW rect px. That is correct HERE because this app scales');
    console.log('  with --ui-zoom, which does not move the rect, and it was measured: at 390x844 with');
    console.log('  --ui-zoom 0.9 the raw centre lands and rect x zoom lands on the wrong control. A surface');
    console.log('  that ever uses body.style.zoom or a transform breaks that and A6 would need converting.');
    console.log('  KEYBOARD IS NOW DRIVEN, by A7 only, and only for the eater: real Input.dispatchKeyEvent');
    console.log('  through input.js\'s own road. THE PAD IS NOT DRIVEN HERE — tools/holdconfirm.mjs is where');
    console.log('  that is watched. A7 ALSO DRIVES A MOUSE HOLD AND THEN A KEY, which is the only stage that');
    console.log('  can see a mouse-armed eater: A6 reads [] after a mouse lift whether one is armed or not,');
    console.log('  because a mouse release over a removed element makes NO CLICK — A7 measures that premise');
    console.log('  on a probe button of its own, both sides, and it is a claim about the BROWSER, not this');
    console.log('  app. THE CANCEL ROAD IS DRIVEN AT BOTH EDGES, with Input.dispatchTouchEvent touchCancel:');
    console.log('  below full (the abort — must not commit) and above it (fired at full, then cancelled —');
    console.log('  must commit AND must leave the next activation alive). PEN IS NOT DRIVEN AND NOT');
    console.log('  MEASURED: the fix makes no device assumption at all now — the eater eats the click that');
    console.log('  carries its own gesture\'s pointerId — but no pen event has been dispatched at this ref.');
    console.log('  THE MULTI-POINTER OVERLAP IS A MIXED INPUT PROBE: pointer A is real CDP touch, while');
    console.log('  pointer B is injected with window.dispatchEvent(new PointerEvent(...)). Two real CDP');
    console.log('  touches suppress A\'s click in this harness, so A7 does NOT prove a two-real-finger');
    console.log('  gesture; it proves the post-release final-state check for this A-real/B-synthetic edge.');
    console.log('  ON THE MOUSE ROAD THE EATER ARMS AND IS NEVER FED, so one window click-capture listener');
    console.log('  stands from the hold to the next pointerdown: INERT, not absent, and nothing here counts');
    console.log('  listeners of that kind (A8 counts keydown only).');
    console.log('  A8 counts window/document keydown listeners with getEventListeners over');
    console.log('  six open/close cycles on the map mount; it says nothing about any other listener kind.');
    console.log('  A9 READS THE ACCESSIBILITY TREE (Accessibility.getFullAXTree), which is a different tree');
    console.log('  from the DOM — it is the whole reason data-hold-for does not answer P2b. It covers the');
    console.log('  GRIPS ONLY, at three edges: one armed candidate, eight armed candidates filled through');
    console.log('  addToStorage, and the sealed in-combat picker. It does NOT cover the in-card control:');
    console.log('  the fold is an accordion — all eight');
    console.log('  faces clicked left aria-expanded true on exactly one — so at most one such control is in');
    console.log('  the tree at a time and it has no sibling to collide with. NO SCREEN READER WAS RUN: this');
    console.log('  is the name Chromium computes, not what NVDA or VoiceOver announces from it.');
    console.log('  The phone shape 390x844 was driven by hand during the build and is not in this run.');
    console.log('  tools/screenshot.mjs is NOT used: it prints an 87 px white band and exits 0 under');
    console.log('  Chromium 141, so every frame here is Page.captureScreenshot over browser.mjs\'s CDP path.');
  }
  // THE FINDINGS, LAST. See the note on `red` — a harness quotes the tail, and
  // this tool's tail is boundary prose. A run with no findings prints nothing
  // here, so silence is the green and there is no line to mistake for one.
  for (const line of FOUND) console.log(`  ${line}`);
  process.exit(code);
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}

// ---------------------------------------------------------------------------
// A1 — the model door. `ownership()` is the one predicate the picker calls, so
// the known-bad enters where the real input enters: the content table it reads.
// ---------------------------------------------------------------------------
async function a1Model() {
  console.log('\n  A1 · the shelf is KIT ∪ WHAT THIS RUN PICKED UP  (model door: ownership())');
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createRunState } = await import('../src/model/state.js');
  const { ownership, carriedIds } = await import('../src/model/loadout.js');
  const reg = createRegistries(contentBundle);
  const cfg = reg.balance.equipment;
  const pieces = [...(reg.equipment.armaments || [])];
  console.log(`      persistence = ${JSON.stringify(cfg.persistence)} · basicTag = ${JSON.stringify(cfg.basicTag)}`);

  // THE WIDEST POSSIBLE PROFILE, on purpose. If anything outside the run can
  // reach the shelf, this is the corpus that finds it: every armament the game
  // has, marked found in an earlier climb. His sentence says none of it counts.
  const everything = pieces.map((p) => p.id);
  let wideFail = 0; let floorFail = 0; const seen = [];
  for (const cls of reg.classes.all()) {
    const run = createRunState({ seed: 1, classId: cls.id, registries: reg, profileMeta: { found: everything } });
    const carried = new Set(carriedIds(run.loadout));
    const own = ownership(reg, { meta: { found: everything }, loadout: run.loadout });
    const offered = pieces.filter((p) => own.has(p)).map((p) => p.id);
    const strangers = offered.filter((id) => !carried.has(id));
    seen.push(`${cls.id}: ${offered.join(', ') || '(none)'}`);
    if (strangers.length) {
      wideFail++;
      console.log(`    ${red('A1.wide', `${cls.id} is offered ${strangers.length} piece(s) neither in its kit nor picked up`
        + ` — ${strangers.slice(0, 5).join(', ')}`)}`);
    }
    // THE FLOOR, and it is the half his "unless" clause protects: a run that has
    // picked up nothing still shows the kit it is WEARING. A shelf of zero would
    // satisfy "nothing you did not pick up" and be the worse screen.
    if (!offered.length) {
      floorFail++;
      console.log(`    ${red('A1.floor', `${cls.id} is offered NOTHING — the shelf is empty, not narrow`)}`);
    }
  }
  for (const line of seen) console.log(`      ${line}`);
  checks += 2;
  if (!wideFail) console.log(`    PASS A1 no class is offered anything outside its kit, against a MAXIMAL profile (${reg.classes.all().length} classes)`);
  else fails++;
  if (!floorFail) console.log('    PASS A1 every class still sees the kit it is wearing — the floor holds');
  else fails++;

  // AND A PICKUP IS STILL A PICKUP. Without this the two checks above are both
  // satisfied by a shelf frozen at the kit forever, which is not his rule.
  const cls0 = reg.classes.all()[0];
  const run0 = createRunState({ seed: 1, classId: cls0.id, registries: reg, profileMeta: {} });
  const before = pieces.filter((p) => ownership(reg, { meta: {}, loadout: run0.loadout }).has(p)).length;
  const pickup = pieces.find((p) => !carriedIds(run0.loadout).includes(p.id));
  run0.loadout.storage = [...(run0.loadout.storage || []), pickup.id];
  const after = pieces.filter((p) => ownership(reg, { meta: {}, loadout: run0.loadout }).has(p)).length;
  ok(after === before + 1,
    after === before + 1
      ? `A1 picking one piece up adds exactly one to the shelf (${before} → ${after}, ${pickup.id})`
      : red('A1.step', `picking up ${pickup.id} moved the shelf ${before} → ${after}, not by one`));
}

async function main() {
  if (!browserPath) finish(2, 'no Chrome/Chromium — set $CHROME');
  console.log(`armoury-picked-up — source tree, real browser, ${SHAPE[0]}x${SHAPE[1]}, ?shot=combat`);

  await a1Model();

  const s = await serve({ root: ROOT, port: 8479, open: false });
  const base = `http://localhost:${s.port}/`;
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'armpick-', browser: browserPath, args: ['--allow-file-access-from-files'], timeoutMs: 20000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: SHAPE[0], height: SHAPE[1], deviceScaleFactor: 1, mobile: false }, S);
  const ev = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
    return r.result.value;
  };
  // `getEventListeners` is the command-line API, not a page global — A8 is the
  // only caller and it says so here rather than widening `ev` for everyone.
  const evCLI = async (e) => {
    const r = await cdp.send('Runtime.evaluate',
      { expression: e, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
    return r.result.value;
  };
  const key = async (type, k, code, vk) => cdp.send('Input.dispatchKeyEvent',
    { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }, S);
  const until = async (x, w, ms = 25000) => { const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(60); } throw new Error('timeout ' + w); };
  // ONE HOME FOR "ACTIVATE, THEN WAIT FOR THE PAGE TO ANSWER". Every A7 stage
  // ends the same way — one ordinary Enter on a view tab, then read `data-view`
  // — and every one of them used to SLEEP 400 ms and read. THAT IS A LYING
  // INSTRUMENT ON A BUSY BOX, and it was measured lying on 2026-08-22: inside
  // `--selftest` the clean copy went red twice on A7.swallow + A7.mouseswallow
  // while an identical copy run standalone was green (63 checks, 0 findings),
  // with another seat holding 26 Chromium processes on the same container. A
  // fixed sleep turns "the render was slow" into "the eater ate it", which is a
  // finding nobody can distinguish from the real one.
  //
  // SO IT POLLS, BOUNDED. A real swallow still fails — the view never changes,
  // the poll spends its whole budget and the assertion below reads the
  // unchanged value. What is gone is only the false red. The timeout is
  // swallowed on purpose: the VERDICT is the assertion that follows, never the
  // absence of a throw.
  const enterAndSettle = async (want) => {
    await key('rawKeyDown', 'Enter', 'Enter', 13); await wait(90);
    await key('keyUp', 'Enter', 'Enter', 13);
    await until(`document.querySelector('.armoury').dataset.view === ${JSON.stringify(want)}`,
      'view moved', 6000).catch(() => {});
    return ev("document.querySelector('.armoury').dataset.view");
  };

  try {
    await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, S);
    await until("!!document.querySelector('.combat .hand .card')", 'combat');
    await wait(600);
    await ev("document.querySelector('#combat-armoury').click()");
    await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
    await wait(400);

    // Open a slot's picker — the surface all three asks are about. The slot is
    // READ off the page, never typed: a hardcoded id stops measuring the day
    // equipSlots.csv moves, which is the same defect this file is checking for.
    const slotOpened = await ev(`(() => {
      const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
             || document.querySelector('.armoury-overlay .equip-slot .es-cell');
      if (!b) return false; b.click(); return true; })()`);
    if (!slotOpened) { console.log('    SKIP no slot cell to open — NOT a pass'); fails++; checks++; }
    else {
      await until("!!document.querySelector('.equip-picker .ep-list')", 'picker', 8000);
      await wait(350);

      // ---- A2 ----------------------------------------------------------
      console.log('\n  A2 · every item arrives folded  (page door)');
      const snap = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const faces = [...list.querySelectorAll('.disc-face')];
        return {
          faces: faces.length,
          expandedAtOpen: faces.filter((f) => f.getAttribute('aria-expanded') === 'true').length,
          revealShown: [...list.querySelectorAll('.disc-reveal')].filter((p) => !p.hidden).length,
          chipsFlat: list.querySelectorAll(':scope > .equip-candidate-row').length,
        }; })())`));
      console.log(`      faces ${snap.faces} · expanded at open ${snap.expandedAtOpen} · reveal panels showing ${snap.revealShown} · flat rows ${snap.chipsFlat}`);
      ok(snap.faces > 0, snap.faces > 0 ? `A2 the picker draws ${snap.faces} item faces`
        : red('A2.faces', 'the picker draws no item faces at all — nothing to fold'));
      ok(snap.faces > 0 && snap.expandedAtOpen === 0 && snap.revealShown === 0,
        (snap.faces > 0 && snap.expandedAtOpen === 0 && snap.revealShown === 0)
          ? 'A2 every item arrives folded — 0 expanded, 0 panels showing'
          : red('A2.folded', `items do not arrive folded — ${snap.expandedAtOpen} face(s) expanded, ${snap.revealShown} panel(s) showing`));

      // ---- A3 ----------------------------------------------------------
      console.log('\n  A3 · the card is the control  (page door)');
      // THE NEGATIVE FIRST, because it is his correction: nothing pressable in
      // the list may sit outside a face or the revealed panel.
      const strays = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const all = [...list.querySelectorAll('button')];
        const outside = all.filter((b) => !b.classList.contains('disc-face') && !b.closest('.disc-reveal'));
        // THE ONE NAMED EXCEPTION, and it is checked rather than waved through:
        // a control outside the card is legal ONLY if it is the ruled grip AND
        // it is the immediate next sibling of a face. Anything else is a stray.
        const grip = (b) => b.classList.contains('ep-hold')
          && b.previousElementSibling && b.previousElementSibling.classList.contains('disc-face');
        const stray = outside.filter((b) => !grip(b));
        return { total: all.length, outside: outside.length, grips: outside.length - stray.length,
          stray: stray.length, names: stray.slice(0, 4).map((b) => b.className || b.textContent.trim().slice(0, 20)) };
      })())`));
      ok(strays.stray === 0, strays.stray === 0
        ? `A3 no control outside the card but the ruled grip — ${strays.total} button(s), ${strays.grips} grip(s)`
        : red('A3.stray', `${strays.stray} sub button(s) hang outside the card and are not the ruled grip: ${strays.names.join(' · ')}`));

      // Press the card. One gesture, and it must open THAT card and only it.
      const pressed = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const faces = [...list.querySelectorAll('.disc-face')];
        const f = faces[0]; if (!f) return null;
        f.click();
        const open = [...list.querySelectorAll('.disc-face')].filter((x) => x.getAttribute('aria-expanded') === 'true');
        const panel = list.querySelector('.disc-reveal');
        const btn = panel && !panel.hidden ? panel.querySelector('.ep-equip') : null;
        return { openCount: open.length, openedIsPressed: open[0] === f, panelShown: !!(panel && !panel.hidden),
          btn: btn ? { text: btn.textContent.trim(), cls: btn.className, act: btn.dataset.act || '' } : null };
      })())`));
      await wait(200);
      if (!pressed) { console.log(`    ${red('A3.press', 'no face to press')}`); fails++; checks++; }
      else {
        console.log(`      after press: ${pressed.openCount} open · panel shown ${pressed.panelShown} · control ${JSON.stringify(pressed.btn)}`);
        ok(pressed.openCount === 1 && pressed.openedIsPressed && pressed.panelShown,
          (pressed.openCount === 1 && pressed.openedIsPressed && pressed.panelShown)
            ? 'A3 pressing the card reveals exactly that card'
            : red('A3.press', `pressing the card did not reveal it — ${pressed.openCount} open, panel shown ${pressed.panelShown}`));
        ok(!!pressed.btn, pressed.btn ? `A3 the revealed card carries one equip control ("${pressed.btn.text}")`
          : red('A3.control', 'the revealed card carries no equip control'));
      }

      // The RED half. Find the face for the piece already in the set and press
      // it: its control must say Unequip AND carry the danger class. Two
      // independent channels, because a word without the colour, or a colour
      // without the word, each satisfies half his sentence.
      const un = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const faces = [...list.querySelectorAll('.disc-face')];
        const cur = faces.find((f) => f.dataset.equipped === '1');
        if (!cur) return { none: true, faces: faces.map((f) => f.dataset.face) };
        // PRESS ONLY IF SHUT. The face toggles, so a probe that clicks
        // unconditionally closes the pane the previous check opened and then
        // reports "no control" — which is the instrument failing, wearing the
        // product's clothes. It cost this file one red for the wrong reason.
        if (cur.getAttribute('aria-expanded') !== 'true') cur.click();
        const panel = list.querySelector('.disc-reveal');
        const btn = panel && !panel.hidden ? panel.querySelector('.ep-equip') : null;
        return { none: false, text: btn ? btn.textContent.trim() : null, cls: btn ? btn.className : null,
          act: btn ? (btn.dataset.act || '') : null };
      })())`));
      if (un.none) {
        console.log(`    ${red('A3.marked', `no face is marked as the equipped piece (faces: ${(un.faces || []).slice(0, 5).join(', ')}) — the red state is unreachable, so it is unmeasured`)}`);
        fails++; checks++;
      } else {
        console.log(`      equipped card's control: ${JSON.stringify(un)}`);
        ok(/unequip/i.test(un.text || ''), /unequip/i.test(un.text || '')
          ? `A3 the equipped card's control says "${un.text}"`
          : red('A3.word', `the equipped card's control says "${un.text}", not Unequip`));
        ok(/\bdanger\b/.test(un.cls || ''), /\bdanger\b/.test(un.cls || '')
          ? 'A3 the unequip control is red (carries .danger)'
          : red('A3.danger', `the unequip control is not red — class "${un.cls}"`));
      }
    }

    // ---- A4 / A5 · THE MAP MOUNT, where equipping is not sealed ---------
    //
    // WHY A SECOND BOARD, AND IT IS NOT THOROUGHNESS. `?shot=combat` mounts the
    // Armoury with inCombat: true, so `canEquip` SEALS every act — no hold is
    // armed at all there, and a check for "the hold equips" would have been
    // vacuous on the only board this file used to drive. His hold rules are
    // only measurable where equipping is legal, which is the map. This also
    // closes half the boundary this tool used to print.
    console.log('\n  A4/A5 · click folds, and does NOT act  (map mount, ?shot=map)');
    await cdp.send('Page.navigate', { url: `${base}?shot=map` }, S);
    await until("!!document.querySelector('#open-armoury')", 'map');
    await wait(700);
    await ev("document.querySelector('#open-armoury').click()");
    await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
    await wait(450);
    await ev(`(() => { const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
      || document.querySelector('.armoury-overlay .equip-slot .es-cell'); if (b) b.click(); return !!b; })()`);
    // NO CARD HERE IS A FINDING, NOT A CRASH — and it is the ONE timeout on this
    // stage that is. An empty shelf used to kill the run with an unhandled
    // `timeout picker` and exit 1, the code line 41 reserves for A FINDING; the
    // tool was reporting a harness death in a finding's clothes. Found by
    // hand-planting `persistence: 'unlocked'` in the real tree (Saga's WITHHOLD,
    // ea2cf89). No new concept: `A4.nocard` below is already the sentence for
    // "no card to press", so catching into a boolean lets that emitter reach it.
    // The two `until` calls just above are NOT this — a map that never mounts is
    // a harness death, and they now reach the exit-2 catch at the end of main().
    const mapHasCard = await until("!!document.querySelector('.equip-picker .ep-list .disc-face')", 'picker', 8000)
      .then(() => true, () => false);
    await wait(350);

    const faceBox = async () => JSON.parse(await ev(`JSON.stringify((() => {
      const f = document.querySelector('.equip-picker .ep-list .disc-face');
      if (!f) return null; const r = f.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2,
        holdMs: Number(f.dataset.holdMs || 0), equipped: f.dataset.equipped === '1',
        expanded: f.getAttribute('aria-expanded') === 'true' }; })())`));

    // THE CLICKS BELOW ARE DOM CLICKS, NOT SYNTHETIC POINTER EVENTS, AND THE
    // DIFFERENCE IS NAMED RATHER THAN GLOSSED. This app scales itself with
    // `body.style.zoom`, so `getBoundingClientRect()` px and CDP's input px are
    // NOT the same coordinate space — fx.js's `viewportLocalBox` exists for
    // exactly that conversion. A CDP press at rect coordinates landed nowhere
    // and printed three reds that were mine, not the screen's.
    // WHAT THIS COSTS, said plainly: these checks prove the HANDLER WIRING —
    // click folds, click again unfolds, click elsewhere closes — and say
    // NOTHING about whether a real finger at those pixels hits the card. That
    // is a geometry question and it wants the zoom conversion, not this road.
    const b0 = mapHasCard ? await faceBox() : null;
    if (!b0) { console.log(`    ${red('A4.nocard', 'no card on the map mount to press')}`); fails++; checks++; }
    else {
      // THE LENGTH IS READ OFF THE CONTROL, never typed here. `armHold` publishes
      // the dial it actually armed with; a number in this file would stop
      // measuring the moment a player moves the Hold-to-confirm setting, and
      // would also silently pass if the hold stopped being armed at all.
      console.log(`      the card publishes data-hold-ms=${b0.holdMs} (the player's dial, derived — not a number this tool chose)`);
      // NOT A CHECK, AND DELIBERATELY NOT ONE. His press-and-hold is BLOCKED on
      // a ruling (see equipment.js: armHold's rule 1 kills the short click that
      // his fold rule needs). Asserting it here would print a red for a thing
      // nobody has agreed to build; asserting the opposite would quietly bless
      // its absence. It is reported, and it is `unknown`.
      console.log(`      UNBUILT: no hold armed (data-hold-ms=${b0.holdMs || 0}). His press-and-hold is blocked on a`);
      console.log('      ruling — armHold rule 1 swallows the short click his fold rule needs. NOT counted either way.');

      // 1 · A SHORT CLICK MUST NOT EQUIP. It unfolds, and nothing else.
      const wasEquipped = b0.equipped;
      await ev(`document.querySelector('.equip-picker .ep-list .disc-face').click()`);
      await wait(400);
      const afterClick = await faceBox();
      ok(afterClick && afterClick.equipped === wasEquipped,
        (afterClick && afterClick.equipped === wasEquipped)
          ? `A4 a short click did NOT change what is equipped (still ${wasEquipped ? 'equipped' : 'empty'})`
          : red('A4.acted', 'a short click equipped/unequipped — click is supposed to fold, not act'));
      ok(afterClick && afterClick.expanded,
        (afterClick && afterClick.expanded)
          ? 'A4 a short click unfolded the card'
          : red('A4.unfold', 'a short click did not unfold the card'));

      // 2 · CLICK AGAIN REFOLDS.
      const b1 = await faceBox();
      await ev(`document.querySelector('.equip-picker .ep-list .disc-face').click()`);
      await wait(350);
      const b2 = await faceBox();
      ok(b2 && !b2.expanded, (b2 && !b2.expanded)
        ? 'A5 clicking the card again refolded it'
        : red('A5.refold', 'clicking again did not refold the card'));

      // 3 · CLICK OFF THE CARD REFOLDS. Open it, then press the picker header.
      await ev(`document.querySelector('.equip-picker .ep-list .disc-face').click()`);
      await wait(300);
      const openNow = await faceBox();
      const off = JSON.parse(await ev(`JSON.stringify((() => {
        const h = document.querySelector('.equip-picker h4'); if (!h) return null;
        const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`));
      if (!openNow || !openNow.expanded || !off) {
        console.log(`    ${red('A5.pose', 'could not pose an open card with somewhere outside it to press — NOT a pass')}`);
        fails++; checks++;
      } else {
        await ev(`document.querySelector('.equip-picker h4').click()`);
        await wait(350);
        const b3 = await faceBox();
        ok(b3 && !b3.expanded, (b3 && !b3.expanded)
          ? 'A5 clicking OFF the card refolded it'
          : red('A5.offcard', 'clicking off the card left it open'));
      }

    }

    // ---- A6 · TWO ELEMENTS, ONE GESTURE EACH ---------------------------
    //
    // REAL POINTER INPUT, and that is the whole reason this stage exists as a
    // separate one. A4/A5 above are DOM `.click()` calls: they prove handler
    // wiring and say nothing about a finger. A HOLD IS A PRESS BY NATURE —
    // there is no `.click()` that can express "down, wait 600 ms, up" — so it
    // is driven with `Input.dispatchMouseEvent` and `Input.dispatchTouchEvent`
    // at real coordinates, twice: once as a mouse, once as a THUMB.
    //
    // #304 said the conversion was the obstacle: this app scales with a zoom,
    // so `getBoundingClientRect()` px might not be CDP input px. MEASURED HERE
    // AND IT IS NOT: at 390x844 `--ui-zoom` is 0.9, a press at the RAW rect
    // centre lands on the grip and a press at rect x zoom lands on the wrong
    // control. So no conversion is applied — and the tool does not trust that
    // sentence either. Every press is preceded by an `elementFromPoint` at the
    // same coordinates and followed by a recorded `pointerdown`; if the finger
    // did not land, A6.finger is a red, not a silent pass on a press that
    // missed. THAT is what #304 actually hit: the picker opens below the fold
    // in this region, so the press landed on the heading painted over it.
    for (const touch of [false, true]) {
      const way = touch ? 'touch' : 'mouse';
      console.log(`\n  A6 · the grip holds the hold, and only the hold  (map mount, REAL ${way} input)`);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 5 }, S);
      // A FRESH BOARD PER PASS, AND AGAIN BEFORE THE BUTTON. The completed hold
      // below CHANGES THE LOADOUT, which is the point of it — and unequipping a
      // kit piece empties the shelf, because `ownership()` is kit-you-are-
      // WEARING union what you picked up. A second measurement on the same
      // board would be measuring the wreckage of the first, and it did: the
      // first draft of this stage reported "no in-card control" as a product
      // finding when the instrument had eaten its own corpus.
      const openBoard = async () => {
        await cdp.send('Page.navigate', { url: `${base}?shot=map` }, S);
        await until("!!document.querySelector('#open-armoury')", 'map');
        await wait(700);
        await ev("document.querySelector('#open-armoury').click()");
        await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
        await wait(450);
        await ev(`(() => { const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
          || document.querySelector('.armoury-overlay .equip-slot .es-cell'); if (b) b.click(); return !!b; })()`);
        return until("!!document.querySelector('.equip-picker .ep-list .ep-hold')", 'grip', 8000)
          .then(() => true, () => false);
      };
      const hasGrip = await openBoard();
      if (!hasGrip) {
        console.log(`    ${red('A6.nogrip', `${way}: the folded list draws no grip at all`)}`);
        fails++; checks++; continue;
      }
      await wait(300);

      // THE FOLDED LIST, READ AS THE PLAYER MEETS IT. Every number below is off
      // the laid-out page, not off the source: the grip's own box, the tap
      // floor the stylesheet resolved, and whether the CARD is armed too.
      const shelf = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const faces = [...list.querySelectorAll('.disc-face')];
        const grips = [...list.querySelectorAll('.ep-hold')];
        // THE FLOOR IS THE HOUSE'S, NOT THE CONTROL'S, and this line is a repair.
        // It read \`getComputedStyle('.ep-hold').minHeight\` — the resolved value of
        // the very rule the check exists to guard. Hand-planting the removal of
        // that rule made the floor 0 and the tool EXITED 0: the check and the
        // defect were reading one source, so deleting the source deleted the
        // check. \`--tap-floor\` is the datum \`balance.ui.tapSize\` writes for the
        // whole app; it is a calc(), so it is resolved by measuring a probe box
        // rather than parsed out of a string.
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:var(--tap-floor)';
        document.body.appendChild(probe);
        const floor = probe.getBoundingClientRect().height;
        probe.remove();
        const paired = faces.filter((f) => f.nextElementSibling && f.nextElementSibling.classList.contains('ep-hold'));
        const boxed = grips.filter((g) => { const r = g.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        const short = boxed.filter((g) => g.getBoundingClientRect().height + 0.5 < floor);
        const armedFaces = faces.filter((f) => Number(f.dataset.holdMs || 0) > 0);
        const g0 = grips[0] ? grips[0].getBoundingClientRect() : null;
        return { faces: faces.length, grips: grips.length, paired: paired.length, boxed: boxed.length,
          floor, short: short.length, armedFaces: armedFaces.length,
          holdMs: grips[0] ? Number(grips[0].dataset.holdMs || 0) : 0,
          g0: g0 ? { w: Math.round(g0.width), h: Math.round(g0.height) } : null,
          listH: Math.round(list.getBoundingClientRect().height),
          pickerH: Math.round(document.querySelector('.equip-picker').getBoundingClientRect().height),
          portH: document.querySelector('.armoury-right').clientHeight,
          portScroll: document.querySelector('.armoury-right').scrollHeight,
        }; })())`));
      console.log(`      ${shelf.faces} card(s) · ${shelf.grips} grip(s) · grip ${shelf.g0 ? shelf.g0.w + 'x' + shelf.g0.h : '(none)'}`
        + ` · tap floor ${shelf.floor} · data-hold-ms ${shelf.holdMs}`);
      console.log(`      INK, the cost of his ruling, off the laid-out page: card list ${shelf.listH} px,`
        + ` picker ${shelf.pickerH} px, and the box it opens in shows ${shelf.portH} of ${shelf.portScroll} px.`);

      ok(shelf.faces > 0 && shelf.paired === shelf.faces,
        (shelf.faces > 0 && shelf.paired === shelf.faces)
          ? `A6 every card has its own grip immediately after it (${shelf.paired}/${shelf.faces})`
          : red('A6.nogrip', `${shelf.faces - shelf.paired} card(s) of ${shelf.faces} have no grip immediately after them`));
      // THE V2 DIRECTION, AND IT IS THE ARRANGEMENT THIS ONE WAS CHOSEN OVER.
      // A grip parked inside the revealed pane exists in the DOM and measures
      // 0x0 while the list is folded — no pointer can reach it, so the hold is
      // only performable AFTER the click it exists to save. Its own code.
      ok(shelf.grips > 0 && shelf.boxed === shelf.grips,
        (shelf.grips > 0 && shelf.boxed === shelf.grips)
          ? `A6 every grip has a box while the list is folded (${shelf.boxed}/${shelf.grips})`
          : red('A6.unreachable', `${shelf.grips - shelf.boxed} grip(s) of ${shelf.grips} have no box while folded`
            + ' — the hold is unreachable until the card is already open'));
      ok(shelf.holdMs > 0, shelf.holdMs > 0
        ? `A6 the grip publishes an armed hold (data-hold-ms=${shelf.holdMs}, the player's own dial)`
        : red('A6.unarmed', `the grip publishes data-hold-ms=${shelf.holdMs} — nothing is armed on it`));
      ok(shelf.short === 0, shelf.short === 0
        ? `A6 every grip meets the tap floor (${shelf.floor} px)`
        : red('A6.thumb', `${shelf.short} grip(s) are shorter than the tap floor (${shelf.floor} px)`
          + ' — a hold target a thumb misses is a control that does not exist'));
      // HIS WHOLE RULING IN ONE ASSERTION: the card is NOT the hold element.
      ok(shelf.armedFaces === 0, shelf.armedFaces === 0
        ? 'A6 no card face is armed — the two gestures do not share an element'
        : red('A6.face', `${shelf.armedFaces} card face(s) carry an armed hold — one element, both gestures, which is what rule 1 forbids`));

      // ---- THE FINGER ------------------------------------------------
      const aim = async () => JSON.parse(await ev(`JSON.stringify((() => {
        const g = document.querySelector('.equip-picker .ep-list .ep-hold');
        if (!g) return null;
        g.scrollIntoView({ block: 'center' });
        const r = g.getBoundingClientRect();
        const x = r.x + r.width / 2; const y = r.y + r.height / 2;
        const e = document.elementFromPoint(x, y);
        return { x, y, onTop: !!(e && e.closest && e.closest('.ep-hold')),
          top: e ? e.tagName : null }; })())`));
      // WHAT IS IN THE SLOT, the product-level signal, read off the page. The
      // completed hold rebuilds this whole subtree, so a probe that watched a
      // face's own dataset would be reading a node that no longer exists.
      const slotSay = async () => ev(`(() => { const c = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
        || document.querySelector('.armoury-overlay .equip-slot .es-cell'); return c ? c.textContent.trim() : '(no slot)'; })()`);
      const down = async (x, y) => (touch
        ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y) }] }, S)
        : cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, buttons: 1 }, S));
      const up = async (x, y) => (touch
        ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, S)
        : cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, buttons: 0 }, S));
      const watch = async () => ev(`(() => { window.__a6 = [];
        for (const t of ['pointerdown', 'click']) document.addEventListener(t, (e) => window.__a6.push({ t,
          grip: !!(e.target.closest && e.target.closest('.ep-hold')),
          ctrl: !!(e.target.closest && e.target.closest('button')),
          tag: (e.target.tagName || '') + '.' + (typeof e.target.className === 'string' ? e.target.className.slice(0, 34) : 'svg') }), true);
        return 'ok'; })()`);

      await wait(250);
      let a = await aim();
      await watch();
      if (!a || !a.onTop) {
        console.log(`    ${red('A6.finger', `${way}: the grip is not the topmost element at its own centre`
          + ` (found ${a ? a.top : 'nothing'}) — no press can be aimed at it, so nothing below is measured`)}`);
        fails++; checks++; continue;
      }

      // 1 · THE EARLY RELEASE IS THE ABORT. Press, lift well inside the dial.
      const before = await slotSay();
      const foldedBefore = await ev(`document.querySelector('.equip-picker .disc-face').getAttribute('aria-expanded')`);
      await down(a.x, a.y); await wait(150); await up(a.x, a.y); await wait(450);
      const abort = JSON.parse(await ev(`JSON.stringify({ hits: window.__a6,
        expanded: (document.querySelector('.equip-picker .disc-face') || {}).getAttribute
          ? document.querySelector('.equip-picker .disc-face').getAttribute('aria-expanded') : null })`));
      const landed = abort.hits.some((h) => h.t === 'pointerdown' && h.grip);
      console.log(`      abort (${way}, 150 ms of a ${shelf.holdMs} ms dial): landed on grip ${landed}`
        + ` · slot "${before}" → "${await slotSay()}" · card expanded ${foldedBefore} → ${abort.expanded}`);
      ok(landed, landed ? `A6 the ${way} press landed on the grip (pointerdown recorded on it)`
        : red('A6.finger', `${way}: the press at the grip's own centre did not reach it`));
      ok((await slotSay()) === before, (await slotSay()) === before
        ? `A6 an aborted ${way} hold changed nothing in the slot ("${before}")`
        : red('A6.acted', `an aborted ${way} hold changed the slot: "${before}" → "${await slotSay()}"`));
      // RULE 1, MEASURED RATHER THAN CONSTRUCTED. The early release generates a
      // click; that click must die on the grip and must NOT reach the card's
      // unfold path. A grip that also unfolds is exactly the second door.
      ok(abort.expanded === foldedBefore, abort.expanded === foldedBefore
        ? `A6 an aborted ${way} hold did NOT unfold the card — rule 1's click died on the grip`
        : red('A6.leak', `an aborted ${way} hold unfolded the card (aria-expanded ${foldedBefore} → ${abort.expanded})`
          + ' — the abort became a second door'));

      // 2 · THE COMPLETED HOLD EQUIPS, and the lift afterwards does nothing.
      await ev('window.__a6 = []');
      a = await aim(); await wait(200);
      const was = await slotSay();
      await down(a.x, a.y);
      await wait(shelf.holdMs + 300);
      const atFull = await slotSay();
      await ev('window.__a6 = []');
      await up(a.x, a.y); await wait(400);
      const tail = JSON.parse(await ev('JSON.stringify(window.__a6)'));
      console.log(`      hold (${way}, ${shelf.holdMs + 300} ms): slot "${was}" → "${atFull}" at full · after the lift ${JSON.stringify(tail)}`);
      ok(atFull !== was, atFull !== was
        ? `A6 a completed ${way} hold changed the slot at full: "${was}" → "${atFull}"`
        : red('A6.equips', `a completed ${way} hold left the slot at "${was}" — the hold did not equip`));
      // THE LIFT AFTER THE COMMIT. armHold fires AT FULL and the screen redraws
      // under the finger, so the click the lift generates lands on whatever now
      // occupies that pixel — rule 1's own swallow lives on an element that no
      // longer exists. Measured at 1200x730 touch on base c06c4f2: the release
      // hit `BUTTON.es-cell` and re-opened a picker nobody asked for.
      //
      // THIS ASSERTION WAS `click && closest('button')` AND IT WENT UNFALSIFIABLE
      // UNDER ME, WHICH IS WHY IT IS WIDER NOW. #316 opens the Armoury on the
      // figure and the right pane became 524 px, so the pixel under the finger
      // after the redraw is no longer a slot cell. Planted at THIS head with the
      // swallow removed entirely, the recorder caught
      // `{"t":"click","ctrl":false,"tag":"DIV.armoury-right"}` — a real
      // unswallowed lift that the old predicate scored as a PASS. The corpus had
      // not stopped producing the defect; the predicate had stopped mentioning it.
      //
      // The eater's claim is "the lift's click is swallowed", not "the click
      // landed somewhere harmless", so the check now says what the mechanism
      // says: ZERO clicks after the lift, control or not. Clean-tree reading is
      // `[]` on both mouse and touch — AND THE TWO ZEROES HAVE DIFFERENT CAUSES,
      // which this comment claimed otherwise until 2026-08-22 and which is why
      // Codex's P2a could hide here. On TOUCH the eater stops a real click at
      // window capture, above this recorder. On MOUSE there was never a click:
      // a mouse release over an element removed between press and release
      // generates none — the premise stated at :308-310 of this file, now
      // measured by A7 below rather than only written down. So A6.tail is blind
      // to the mouse road by construction: it reads the same `[]` whether the
      // eater is armed there or not, and cannot be made to see it. A7 owns it.
      const woke = tail.filter((h) => h.t === 'click');
      ok(woke.length === 0, woke.length === 0
        ? `A6 the ${way} lift after a completed hold dispatched no click at all — the swallow held`
        : red('A6.tail', `the ${way} lift after a completed hold dispatched ${woke.length} click(s) the swallow did not eat: `
          + woke.map((h) => `${h.tag}${h.ctrl ? ' (A CONTROL — it activated)' : ''}`).join(' · ')));

      // 3 · THE IN-CARD BUTTON IS STILL A DOOR. His ruling must not make the
      // hold the only road: a plain click on the revealed control still equips.
      // A DOM click on purpose — this is the keyboard/pad/assistive road, and
      // the question here is whether the ACT still happens, not whether a
      // finger can reach it (A2/A3 already own the geometry of the card).
      if (!await openBoard()) {
        console.log(`    ${red('A6.button', `${way}: the board would not re-open for the in-card control check`)}`);
        fails++; checks++; continue;
      }
      await wait(300);
      const btnRow = JSON.parse(await ev(`JSON.stringify((() => {
        const f = document.querySelector('.equip-picker .ep-list .disc-face');
        if (!f) return { none: true };
        if (f.getAttribute('aria-expanded') !== 'true') f.click();
        const b = document.querySelector('.equip-picker .disc-reveal .ep-equip');
        return { none: !b, text: b ? b.textContent.trim() : null, locked: b ? b.classList.contains('locked') : null }; })())`));
      await wait(300);
      if (btnRow.none) {
        console.log(`    ${red('A6.button', `${way}: no in-card equip control to press — the grip would be the only road`)}`);
        fails++; checks++;
      } else {
        const b4 = await slotSay();
        await ev(`document.querySelector('.equip-picker .disc-reveal .ep-equip').click()`);
        await wait(450);
        const b5 = await slotSay();
        console.log(`      in-card control "${btnRow.text}" (locked ${btnRow.locked}): slot "${b4}" → "${b5}"`);
        ok(b5 !== b4, b5 !== b4
          ? `A6 the in-card control still equips on a plain click ("${b4}" → "${b5}") — the hold is not the only road`
          : red('A6.button', `the in-card control "${btnRow.text}" left the slot at "${b4}" — the hold is the ONLY road to equipping`));
      }
    }
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 }, S);

    // ---- A7 · THE LIFT-EATER IS A POINTER DEVICE -----------------------
    //
    // A6 above proves a finger can reach the grip and that a completed hold's
    // lift is swallowed. THIS IS THE OTHER HALF OF THAT SWALLOW: the eater must
    // not exist on a road that has no lift.
    //
    // `armHold` runs one `onConfirm` for every road — a held pointer, a held
    // Confirm KEY, a held Confirm PAD BUTTON (armPress, ui/gesture.js S7), and
    // the synthetic `detail === 0` click input.js dispatches when no hold is
    // owed. A keyboard commit generates NO trailing click, and the eater is
    // released by the next `pointerdown` — which a keyboard never sends. So it
    // sat armed and ate the next activation anywhere on the page.
    //
    // REAL KEYS, input.js's own road: `Input.dispatchKeyEvent`, the focus cursor
    // WALKED onto the grip with real ArrowDown rather than assigned, so a run
    // where the cursor cannot reach the grip is A7.nokey and never a quiet pass.
    console.log('\n  A7 · the eater is armed only where a lift makes a click  (map mount, REAL keyboard AND mouse input)');
    {
      await cdp.send('Page.navigate', { url: `${base}?shot=map` }, S);
      await until("!!document.querySelector('#open-armoury')", 'map');
      await wait(700);
      await ev("document.querySelector('#open-armoury').click()");
      await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
      await wait(450);
      await ev(`(() => { const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
        || document.querySelector('.armoury-overlay .equip-slot .es-cell'); if (b) b.click(); return !!b; })()`);
      const gripThere = await until("!!document.querySelector('.equip-picker .ep-list .ep-hold')", 'grip', 8000)
        .then(() => true, () => false);
      let landed = false;
      let steps = 0;
      if (gripThere) {
        await wait(350);
        for (; steps < 40 && !landed; steps++) {
          await key('rawKeyDown', 'ArrowDown', 'ArrowDown', 40);
          await key('keyUp', 'ArrowDown', 'ArrowDown', 40);
          await wait(70);
          landed = await ev("!!document.querySelector('.ep-hold.gp-focus')");
        }
      }
      console.log(`      focus cursor walked onto the grip with real ArrowDown: ${landed} (${steps} press(es))`);
      ok(landed, landed
        ? `A7 the focus cursor reaches the grip with real keys (${steps} ArrowDown)`
        : red('A7.nokey', 'no number of real ArrowDown presses put the focus cursor on the grip — the keyboard road could not be driven, NOT a pass'));
      if (landed) {
        const slotSay7 = () => ev("document.querySelector('.armoury-overlay .equip-slot .es-cell').textContent.trim()");
        const k0 = await slotSay7();
        await key('rawKeyDown', 'Enter', 'Enter', 13);
        await wait(900);              // 900 of a 600 ms dial — past full
        await key('keyUp', 'Enter', 'Enter', 13);
        await wait(400);
        const k1 = await slotSay7();
        console.log(`      held Enter (900 ms of a 600 ms dial): slot "${k0}" → "${k1}"`);
        ok(k1 !== k0, k1 !== k0
          ? `A7 a held Confirm KEY commits on the grip ("${k0}" → "${k1}")`
          : red('A7.keyhold', `a held Confirm key left the slot at "${k0}" — the keyboard road does not reach the hold at all`));
        // THE ASSERTION THIS STAGE EXISTS FOR. One ordinary keyboard activation
        // somewhere else on the page, immediately after. If the eater is armed
        // it dies at window capture and the control does nothing.
        const view0 = await ev("document.querySelector('.armoury').dataset.view");
        const target = await ev(`(() => {
          const tabs = [...document.querySelectorAll('[data-surface="armouryView"] [data-member]')];
          const other = tabs.find((t) => t.dataset.member !== document.querySelector('.armoury').dataset.view);
          if (!other) return null;
          document.querySelectorAll('.gp-focus').forEach((e) => e.classList.remove('gp-focus'));
          other.classList.add('gp-focus');
          return other.dataset.member; })()`);
        if (!target) {
          console.log(`    ${red('A7.swallow', 'no second view tab to activate — nothing to watch the eater against, NOT a pass')}`);
          fails++; checks++;
        } else {
          const view1 = await enterAndSettle(target);
          console.log(`      then one ordinary Enter on the "${target}" view tab: data-view "${view0}" → "${view1}"`);
          ok(view1 === target, view1 === target
            ? `A7 the next keyboard activation was NOT swallowed (data-view "${view0}" → "${view1}")`
            : red('A7.swallow', `the next keyboard activation did nothing — data-view stayed "${view1}" after Enter on "${target}"; a lift-eater armed by a keyboard commit ate it`));
        }
      }

      // ---- A7 · THE PREMISE NOTHING RESTS ON ANY MORE ----------------
      //
      // KEPT, AND DEMOTED, 2026-08-22. `equipment.js` used to refuse to arm the
      // eater when `ev.pointerType === 'mouse'`, and the only reason that was
      // safe was this: a mouse release over an element removed between press
      // and release generates no click at all. A DEVICE GATE IS A BET ON THE
      // BROWSER — the day this stopped being true the gate turned back into the
      // A6.tail defect on mouse, silently, with every check green. The gate is
      // gone; the eater now asks whose lift a click is, which needs no premise.
      //
      // SO WHY THIS STILL RUNS: it is what makes A6 blind on the mouse road
      // (`[]` after a mouse lift whether an eater is armed or not), and it is
      // what leaves an inert listener standing on that road until the next
      // pointerdown. Both are printed as boundaries below, and a boundary
      // resting on an unwatched claim about the browser is one nobody checked.
      // It is a claim about CHROMIUM, not about this app.
      //
      // Measured on the live page with a probe button of this tool's own making,
      // BOTH SIDES of the one condition that matters: element present at release
      // (a click is expected) and element removed before it (none is).
      {
        const box = JSON.parse(await ev(`JSON.stringify((() => {
          document.querySelectorAll('#a7-probe').forEach((n) => n.remove());
          const d = document.createElement('button');
          d.id = 'a7-probe'; d.textContent = 'probe';
          d.style.cssText = 'position:fixed;left:20px;top:20px;width:200px;height:80px;z-index:2147483647';
          document.body.appendChild(d);
          window.__a7p = [];
          document.addEventListener('click', (e) => window.__a7p.push(e.target.id || e.target.tagName), true);
          const r = d.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`));
        const mdown = (x, y) => cdp.send('Input.dispatchMouseEvent',
          { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, buttons: 1 }, S);
        const mup = (x, y) => cdp.send('Input.dispatchMouseEvent',
          { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, buttons: 0 }, S);
        await ev('window.__a7p = []');
        await mdown(box.x, box.y); await wait(60); await mup(box.x, box.y); await wait(250);
        const present = JSON.parse(await ev('JSON.stringify(window.__a7p)'));
        await ev('window.__a7p = []');
        await mdown(box.x, box.y); await wait(60);
        await ev("document.querySelector('#a7-probe').remove()");
        await wait(60);
        await mup(box.x, box.y); await wait(250);
        const removed = JSON.parse(await ev('JSON.stringify(window.__a7p)'));
        await ev("document.querySelectorAll('#a7-probe').forEach((n) => n.remove())");
        console.log(`      mouse press/release over a probe button — element PRESENT ${JSON.stringify(present)} · element REMOVED first ${JSON.stringify(removed)}`);
        // BOTH SIDES, because either alone is worthless: a run where the probe
        // is never hit at all also prints [] for the removed case.
        ok(present.length === 1 && removed.length === 0, (present.length === 1 && removed.length === 0)
          ? 'A7 the premise holds — a mouse release over a REMOVED element makes no click, over a present one it makes exactly 1'
          : red('A7.premise', present.length !== 1
            ? `the control case failed: a mouse press/release on a PRESENT button produced ${present.length} click(s), not 1 — the probe was never hit, so the removed case below measures nothing`
            : `a mouse release over a REMOVED element produced ${removed.length} click(s) — this browser DOES dispatch it, so A6 is no longer blind on the mouse road and the two boundaries citing that are stale`));
      }

      // ---- A7 · THE MOUSE ORIGIN, WHICH A6 CANNOT SEE ----------------
      //
      // Codex, 2026-08-22 (P2a). The `ev.type === 'pointerdown'` gate fixed the
      // key and pad origins and left the MOUSE one arming an eater with nothing
      // to eat — released only by the next `pointerdown`, so a player who
      // finishes a mouse hold and reaches for the keyboard loses one activation
      // anywhere on the page. Reproduced before the fix at 1200x730: window
      // click-capture listeners NET +1 after the lift, and the next Enter on the
      // Grid view tab left `data-view` at "hybrid".
      //
      // STILL DRIVEN AFTER THE FIX CHANGED SHAPE. The eater now ARMS on this
      // road and is simply never fed, so this stage is the one that proves the
      // armed-and-inert state really is inert. A check retired because its gate
      // was deleted would have been measuring the gate, not the road.
      //
      // THIS IS A7.swallow's ASSERTION WITH A MOUSE IN FRONT OF IT, and it is a
      // separate check because A6 reads `[]` after a mouse lift either way.
      {
        await cdp.send('Page.navigate', { url: `${base}?shot=map` }, S);
        await until("!!document.querySelector('#open-armoury')", 'map');
        await wait(700);
        await ev("document.querySelector('#open-armoury').click()");
        await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
        await wait(450);
        await ev(`(() => { const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
          || document.querySelector('.armoury-overlay .equip-slot .es-cell'); if (b) b.click(); return !!b; })()`);
        const grip7 = await until("!!document.querySelector('.equip-picker .ep-list .ep-hold')", 'grip', 8000)
          .then(() => true, () => false);
        if (!grip7) {
          console.log(`    ${red('A7.nomouse', 'no grip to hold with a mouse — the mouse road could not be driven, NOT a pass')}`);
          fails++; checks++;
        } else {
          await wait(350);
          const aim7 = JSON.parse(await ev(`JSON.stringify((() => {
            const g = document.querySelector('.equip-picker .ep-list .ep-hold');
            g.scrollIntoView({ block: 'center' });
            const r = g.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`));
          const hold7 = Number(await ev("document.querySelector('.ep-hold').dataset.holdMs || 600"));
          const slot7 = () => ev("document.querySelector('.armoury-overlay .equip-slot .es-cell').textContent.trim()");
          const m0 = await slot7();
          await cdp.send('Input.dispatchMouseEvent',
            { type: 'mousePressed', x: Math.round(aim7.x), y: Math.round(aim7.y), button: 'left', clickCount: 1, buttons: 1 }, S);
          await wait(hold7 + 300);
          const m1 = await slot7();
          await cdp.send('Input.dispatchMouseEvent',
            { type: 'mouseReleased', x: Math.round(aim7.x), y: Math.round(aim7.y), button: 'left', clickCount: 1, buttons: 0 }, S);
          await wait(400);
          console.log(`      held MOUSE (${hold7 + 300} ms of a ${hold7} ms dial): slot "${m0}" → "${m1}"`);
          ok(m1 !== m0, m1 !== m0
            ? `A7 a completed MOUSE hold commits on the grip ("${m0}" → "${m1}")`
            : red('A7.mousehold', `a completed mouse hold left the slot at "${m0}" — the mouse road did not reach the hold, so nothing below is measured`));
          const mv0 = await ev("document.querySelector('.armoury').dataset.view");
          const mtarget = await ev(`(() => {
            const tabs = [...document.querySelectorAll('[data-surface="armouryView"] [data-member]')];
            const other = tabs.find((t) => t.dataset.member !== document.querySelector('.armoury').dataset.view);
            if (!other) return null;
            document.querySelectorAll('.gp-focus').forEach((e) => e.classList.remove('gp-focus'));
            other.classList.add('gp-focus');
            return other.dataset.member; })()`);
          if (!mtarget) {
            console.log(`    ${red('A7.mouseswallow', 'no second view tab to activate — nothing to watch the eater against, NOT a pass')}`);
            fails++; checks++;
          } else {
            const mv1 = await enterAndSettle(mtarget);
            console.log(`      then one ordinary KEYBOARD Enter on the "${mtarget}" view tab: data-view "${mv0}" → "${mv1}"`);
            ok(mv1 === mtarget, mv1 === mtarget
              ? `A7 the next keyboard activation after a MOUSE hold was NOT swallowed (data-view "${mv0}" → "${mv1}")`
              : red('A7.mouseswallow', `the next keyboard activation after a MOUSE hold did nothing — data-view stayed "${mv1}" after Enter on "${mtarget}";`
                + ' a lift-eater armed by a mouse commit, which has no lift to eat, ate it instead'));
          }
        }
      }
      // ---- A7 · THE COMPLETED HOLD THAT IS CANCELLED, NOT LIFTED ------
      //
      // THE THIRD ARMING ROAD, and it is here because the first two were found
      // one at a time. A touch or pen hold that reaches full COMMITS — that is
      // fire-at-full, holdconfirm.js's design — and the pointer can then end
      // with `pointercancel` instead of `pointerup`: a system gesture takes the
      // touch, the browser drops the capture, a palm lands. `trackGesture`
      // (ui/gesture.js) calls `onEnd` either way, so the app never notices.
      //
      // A CANCELLED POINTER PRODUCES NO CLICK. Measured on this page with a
      // probe button of this tool's own making, both with the element present
      // at the cancel and with it removed first — the same two-sided shape
      // A7.premise uses for the mouse, and for the same reason: a run where the
      // probe was never hit also prints `[]`.
      //
      // So the eater armed at full waits for a lift that never comes, and the
      // NEXT activation on any other road pays for it — A7.swallow's assertion
      // with a cancelled finger in front of it.
      //
      // BOTH EDGES OF THE CANCEL, because the population that only cancels late
      // cannot tell you the early cancel is right: BELOW full the hold is the
      // ABORT and must not commit, ABOVE full it must commit. Both must leave
      // the next keyboard activation alive.
      {
        const tprobe = JSON.parse(await ev(`JSON.stringify((() => {
          document.querySelectorAll('#a7-cancel-probe').forEach((n) => n.remove());
          const d = document.createElement('button');
          d.id = 'a7-cancel-probe'; d.textContent = 'probe';
          d.style.cssText = 'position:fixed;left:20px;top:120px;width:200px;height:80px;z-index:2147483647';
          document.body.appendChild(d);
          window.__a7c = [];
          document.addEventListener('click', (e) => window.__a7c.push(e.target.id || e.target.tagName), true);
          const r = d.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`));
        const tdown = (x, y) => cdp.send('Input.dispatchTouchEvent',
          { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y) }] }, S);
        const tup = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, S);
        const tcancel = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }, S);
        await ev('window.__a7c = []');
        await tdown(tprobe.x, tprobe.y); await wait(60); await tup(); await wait(250);
        const lifted = JSON.parse(await ev('JSON.stringify(window.__a7c)'));
        await ev('window.__a7c = []');
        await tdown(tprobe.x, tprobe.y); await wait(60); await tcancel(); await wait(250);
        const cancelled = JSON.parse(await ev('JSON.stringify(window.__a7c)'));
        await ev("document.querySelectorAll('#a7-cancel-probe').forEach((n) => n.remove())");
        console.log(`      touch on a probe button — LIFTED ${JSON.stringify(lifted)} · CANCELLED ${JSON.stringify(cancelled)}`);
        ok(lifted.length === 1 && cancelled.length === 0, (lifted.length === 1 && cancelled.length === 0)
          ? 'A7 the cancel premise holds — a cancelled touch makes no click, a lifted one makes exactly 1'
          : red('A7.premise', lifted.length !== 1
            ? `the control case failed: a touch tap on a PRESENT button produced ${lifted.length} click(s), not 1 — the probe was never hit, so the cancelled case below measures nothing`
            : `a CANCELLED touch produced ${cancelled.length} click(s) — a cancelled pointer does dispatch one in this browser, and the eater must then be allowed to eat it rather than torn down`));

        for (const edge of [
          { say: 'BELOW full (the abort)', over: -400, commits: false },
          { say: 'ABOVE full (fired, then cancelled)', over: +300, commits: true },
        ]) {
          await cdp.send('Page.navigate', { url: `${base}?shot=map` }, S);
          await until("!!document.querySelector('#open-armoury')", 'map');
          await wait(700);
          await ev("document.querySelector('#open-armoury').click()");
          await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
          await wait(450);
          await ev(`(() => { const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
            || document.querySelector('.armoury-overlay .equip-slot .es-cell'); if (b) b.click(); return !!b; })()`);
          const gripC = await until("!!document.querySelector('.equip-picker .ep-list .ep-hold')", 'grip', 8000)
            .then(() => true, () => false);
          if (!gripC) {
            console.log(`    ${red('A7.nocancel', `${edge.say}: no grip to cancel a hold on — the cancel road could not be driven, NOT a pass`)}`);
            fails++; checks++;
            continue;
          }
          await wait(350);
          const aimC = JSON.parse(await ev(`JSON.stringify((() => {
            const g = document.querySelector('.equip-picker .ep-list .ep-hold');
            g.scrollIntoView({ block: 'center' });
            const r = g.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`));
          const holdC = Number(await ev("document.querySelector('.ep-hold').dataset.holdMs || 600"));
          const slotC = () => ev("document.querySelector('.armoury-overlay .equip-slot .es-cell').textContent.trim()");
          const c0 = await slotC();
          await tdown(aimC.x, aimC.y);
          await wait(Math.max(80, holdC + edge.over));
          await tcancel();
          await wait(400);
          const c1 = await slotC();
          console.log(`      ${edge.say}: touch held ${Math.max(80, holdC + edge.over)} ms of a ${holdC} ms dial, then CANCELLED: slot "${c0}" → "${c1}"`);
          if (edge.commits) {
            ok(c1 !== c0, c1 !== c0
              ? `A7 a hold cancelled AFTER full still commits ("${c0}" → "${c1}") — fire-at-full, so the eater IS armed`
              : red('A7.cancelhold', `a hold held past full and then cancelled left the slot at "${c0}" — the road did not reach the commit, so the swallow check below measures nothing`));
          } else {
            ok(c1 === c0, c1 === c0
              ? `A7 a hold cancelled BEFORE full does not commit (slot stayed "${c0}") — the abort survives a cancel`
              : red('A7.cancelabort', `a hold cancelled BEFORE full equipped anyway ("${c0}" → "${c1}") — a cancelled gesture became a commit`));
          }
          // THE ASSERTION THIS STAGE EXISTS FOR, at both edges. One ordinary
          // keyboard activation elsewhere on the page, straight after the
          // cancel. If an eater is armed and has no lift coming, it dies at
          // window capture and the control does nothing.
          const cv0 = await ev("document.querySelector('.armoury').dataset.view");
          const ctarget = await ev(`(() => {
            const tabs = [...document.querySelectorAll('[data-surface="armouryView"] [data-member]')];
            const other = tabs.find((t) => t.dataset.member !== document.querySelector('.armoury').dataset.view);
            if (!other) return null;
            document.querySelectorAll('.gp-focus').forEach((e) => e.classList.remove('gp-focus'));
            other.classList.add('gp-focus');
            return other.dataset.member; })()`);
          if (!ctarget) {
            console.log(`    ${red('A7.cancelswallow', `${edge.say}: no second view tab to activate — nothing to watch the eater against, NOT a pass`)}`);
            fails++; checks++;
          } else {
            const cv1 = await enterAndSettle(ctarget);
            console.log(`      then one ordinary KEYBOARD Enter on the "${ctarget}" view tab: data-view "${cv0}" → "${cv1}"`);
            ok(cv1 === ctarget, cv1 === ctarget
              ? `A7 ${edge.say}: the next keyboard activation after a CANCELLED hold was NOT swallowed (data-view "${cv0}" → "${cv1}")`
              : red('A7.cancelswallow', `${edge.say}: the next keyboard activation after a CANCELLED hold did nothing — data-view stayed "${cv1}" after Enter on "${ctarget}";`
                + ' the pointer never lifted, so no click was ever coming, and the eater armed at full ate an unrelated one'));
          }
        }

        // ---- A7 · A SECOND FINGER IS NOT THIS GESTURE -----------------
        //
        // Pointer A reaches the hold threshold and rebuilds the picker while
        // it is still down. Pointer B then lands elsewhere before A lifts.
        // B's pointerdown must not disarm A's eater: A still owns one trailing
        // click, even though its original grip no longer exists. The below-full
        // edge is the control — overlapping input must not turn an abort into a
        // commit.
        for (const edge of [
          { say: 'BELOW full (overlap control)', over: -400, commits: false },
          { say: 'ABOVE full (A commits, B lands, A lifts)', over: +300, commits: true },
        ]) {
          await cdp.send('Page.navigate', { url: `${base}?shot=map` }, S);
          await until("!!document.querySelector('#open-armoury')", 'map');
          await wait(700);
          await ev("document.querySelector('#open-armoury').click()");
          await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
          await wait(450);
          await ev(`(() => { const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
            || document.querySelector('.armoury-overlay .equip-slot .es-cell'); if (b) b.click(); return !!b; })()`);
          const gripM = await until("!!document.querySelector('.equip-picker .ep-list .ep-hold')", 'grip', 8000)
            .then(() => true, () => false);
          if (!gripM) {
            console.log(`    ${red('A7.nomulti', `${edge.say}: no grip for the overlapping-pointer run — NOT a pass`)}`);
            fails++; checks++;
            continue;
          }
          await wait(350);
          const multi = JSON.parse(await ev(`JSON.stringify((() => {
            const g = document.querySelector('.equip-picker .ep-list .ep-hold');
            g.scrollIntoView({ block: 'center' });
            const r = g.getBoundingClientRect();
            window.__a7multi = [];
            document.addEventListener('click', (e) => window.__a7multi.push({
              id: e.pointerId, target: e.target.id || e.target.className || e.target.tagName
            }), true);
            return { ax: r.x + r.width / 2, ay: r.y + r.height / 2,
              hold: Number(g.dataset.holdMs || 600) }; })())`));
          const slotM = () => ev("document.querySelector('.armoury-overlay .equip-slot .es-cell').textContent.trim()");
          const m0 = await slotM();
          const A = { x: Math.round(multi.ax), y: Math.round(multi.ay), id: 41 };
          await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 }, S);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [A] }, S);
          await wait(Math.max(80, multi.hold + edge.over));
          const m1 = await slotM();
          // Keep A as real CDP touch input, then inject B as the exact unrelated
          // pointerdown the global eater listens for. A second CDP touch causes
          // Chromium to suppress A's click entirely, which cannot discriminate
          // this listener defect; the product boundary here is the PointerEvent
          // identity, so B is injected at that boundary while A remains real.
          await ev("window.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 42, pointerType: 'touch', bubbles: true, cancelable: true }))");
          await wait(80);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, S);
          await wait(350);
          const m2 = await slotM();
          const clicks = JSON.parse(await ev('JSON.stringify(window.__a7multi || [])'));
          await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 }, S);
          console.log(`      ${edge.say}: slot "${m0}" → before lift "${m1}" → after lift "${m2}"; clicks after A lifted ${JSON.stringify(clicks)}`);
          if (edge.commits) {
            ok(m1 !== m0, m1 !== m0
              ? `A7 the original pointer committed before the overlap ("${m0}" → "${m1}")`
              : red('A7.multicommit', `the above-full pointer did not commit before the second pointer landed (slot stayed "${m0}")`));
            ok(clicks.length === 0, clicks.length === 0
              ? 'A7 another pointerdown did not disarm the original pointer\'s owed lift eater'
              : red('A7.multitail', `pointer A leaked ${clicks.length} click(s) after pointer B landed — ${JSON.stringify(clicks)}`));
          } else {
            ok(m2 === m0, m2 === m0
              ? `A7 the below-full overlap stayed an abort (slot "${m0}")`
              : red('A7.multiabort', `the below-full overlap committed by release (slot "${m0}" → "${m2}")`));
          }
        }
      }
    }

    // ---- A8 · EVERY GRIP A DRAW ARMED IS DISARMED BY THE CLOSE ----------
    //
    // `armHold` adds a window-level keydown listener (its Escape abort) that
    // only its own `disarm()` removes. `draw()` drains them because it replaces
    // the subtree they are bound to — but a CLOSE runs no draw, and the ✕ and
    // the backdrop close without one. Codex found it; this counts it.
    //
    // A CENSUS, NOT A SAMPLE: the count is taken with the Armoury SHUT, then
    // again after each full open→picker→close-by-✕ cycle, so the number is
    // "what outlived the panel" and nothing else. Six cycles, because one leak
    // per cycle is a line and one leak once is a coincidence.
    console.log('\n  A8 · nothing this mount armed outlives its close  (map mount, listener census)');
    {
      await cdp.send('Page.navigate', { url: `${base}?shot=map` }, S);
      await until("!!document.querySelector('#open-armoury')", 'map');
      await wait(700);
      const win = () => evCLI("(getEventListeners(window).keydown || []).length");
      const doc = () => evCLI("(getEventListeners(document).keydown || []).length");
      const w0 = await win(); const d0 = await doc();
      const wSeen = []; const dSeen = [];
      let cycles = 0;
      for (let i = 0; i < 6; i++) {
        await ev("document.querySelector('#open-armoury').click()");
        await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
        await wait(350);
        await ev(`(() => { const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
          || document.querySelector('.armoury-overlay .equip-slot .es-cell'); if (b) b.click(); return !!b; })()`);
        const gripped = await until("!!document.querySelector('.equip-picker .ep-list .ep-hold')", 'grip', 8000)
          .then(() => true, () => false);
        if (!gripped) break;
        await wait(200);
        await ev("document.querySelector('.armoury-overlay .armoury-close').click()");
        await wait(300);
        if (await ev("!!document.querySelector('.armoury-overlay')")) break;
        cycles++;
        wSeen.push(await win()); dSeen.push(await doc());
      }
      console.log(`      shut: window keydown ${w0} · document keydown ${d0}`);
      console.log(`      after ${cycles} open→picker→close-by-✕ cycle(s): window ${wSeen.join(',') || '(none)'} · document ${dSeen.join(',') || '(none)'}`);
      const wLast = wSeen.length ? wSeen[wSeen.length - 1] : w0;
      const dLast = dSeen.length ? dSeen[dSeen.length - 1] : d0;
      ok(cycles === 6 && wLast === w0, (cycles === 6 && wLast === w0)
        ? `A8 window keydown listeners are flat across ${cycles} close cycles (${w0})`
        : red('A8.leak', cycles !== 6
          ? `only ${cycles} of 6 close cycles completed — the census could not be taken, NOT a pass`
          : `${wLast - w0} window keydown listener(s) outlived the closed Armoury (${w0} → ${wSeen.join(',')}) — a grip armed by a draw that no close put down`));
      ok(cycles === 6 && dLast === d0, (cycles === 6 && dLast === d0)
        ? `A8 the Escape handler is flat across ${cycles} close cycles (${d0})`
        : red('A8.escleak', cycles !== 6
          ? `only ${cycles} of 6 close cycles completed — the census could not be taken, NOT a pass`
          : `${dLast - d0} document keydown listener(s) outlived the closed Armoury (${d0} → ${dSeen.join(',')})`));
    }

    // ---- A9 · EVERY GRIP SAYS WHICH PIECE IT IS FOR ---------------------
    //
    // Codex, 2026-08-22 (P2b), and it is a defect OF HIS RULING rather than a
    // nicety. D97 puts a SECOND control on every candidate; a second control
    // with no name is a worse screen-reader and voice-control surface than the
    // single one it joined, and that is not what he was shown when he ruled.
    //
    // READ OFF THE ACCESSIBILITY TREE, never the DOM. `data-hold-for` carries
    // the piece id and is NOT in that tree — that is the whole finding, so a
    // check that read the dataset would agree with itself and prove nothing.
    // `Accessibility.getFullAXTree` is the same tree a screen reader consumes.
    //
    // BOTH EDGES, and the max edge needs a bag: `?shot=map&shotStorage=full`
    // fills it through `addToStorage`, the real writer every drop enters, so
    // the eight candidates are the product's own, not an array this tool wrote.
    //   ONE candidate  — no sibling to be confused with; the name must still
    //                    carry the piece, because a lone `Equip` tells a blind
    //                    player nothing about what they are about to wear.
    //   MANY candidates — measured before the fix: 8 grips, AX names
    //                    ["Unequip HOLD","Equip HOLD" x7], 6 collisions.
    //
    // NOT THE IN-CARD CONTROL, AND THAT IS MEASURED TOO: the fold is an
    // ACCORDION. Clicking all eight faces left `aria-expanded="true"` on
    // exactly ONE, and a folded card's `.ep-equip` is absent from the AX tree
    // altogether. At most one in-card control exists at a time, inside the card
    // whose face carries the name — no sibling, no collision, nothing to name.
    console.log('\n  A9 · every grip names its piece  (ACCESSIBILITY TREE, armed + sealed edges)');
    {
      await cdp.send('DOM.enable', {}, S);
      await cdp.send('Accessibility.enable', {}, S);
      const axGrips = async () => {
        const { nodes } = await cdp.send('Accessibility.getFullAXTree', {}, S);
        const byBackend = new Map();
        for (const n of nodes) if (n.backendDOMNodeId != null) byBackend.set(n.backendDOMNodeId, n);
        const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true }, S);
        const { nodeIds } = await cdp.send('DOM.querySelectorAll',
          { nodeId: root.nodeId, selector: '.equip-picker .ep-list .ep-hold' }, S);
        const out = [];
        for (const nodeId of nodeIds) {
          const { node } = await cdp.send('DOM.describeNode', { nodeId }, S);
          const ax = byBackend.get(node.backendNodeId);
          const attrs = {};
          for (let i = 0; i < (node.attributes || []).length; i += 2) attrs[node.attributes[i]] = node.attributes[i + 1];
          out.push({ name: ax && ax.name ? String(ax.name.value) : '',
            role: ax && ax.role ? ax.role.value : null,
            holdMs: Number(attrs['data-hold-ms'] || 0),
            disabled: attrs['aria-disabled'] === 'true' });
        }
        return out;
      };
      // Every edge in one walk: the bag-full run gives the main hand EIGHT
      // candidates and other slots ONE, so both armed ends enter by the same
      // door. Combat supplies the sealed edge: the same grips are visible but
      // canEquip refuses every act, so none may claim a hold it cannot arm.
      for (const edge of [{ q: '?shot=map&shotStorage=full', say: 'bag FULL (max edge)', open: '#open-armoury' },
        { q: '?shot=map', say: 'fresh run (empty edge)', open: '#open-armoury' },
        { q: '?shot=combat', say: 'combat (sealed edge)', open: '#combat-armoury' }]) {
        await cdp.send('Page.navigate', { url: `${base}${edge.q}` }, S);
        await until(`!!document.querySelector(${JSON.stringify(edge.open)})`, `${edge.say} entry`);
        await wait(700);
        const cells = Number(await ev("document.querySelectorAll('.armoury-overlay .equip-slot .es-cell').length")) || 0;
        void cells;
        await ev(`document.querySelector(${JSON.stringify(edge.open)}).click()`);
        await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
        await wait(450);
        const slotCount = Number(await ev(`document.querySelectorAll('.armoury-overlay .equip-slot .es-cell:not(.locked)').length`));
        let seen = 0;
        for (let i = 0; i < slotCount; i++) {
          const opened = await ev(`(() => {
            const c = [...document.querySelectorAll('.armoury-overlay .equip-slot .es-cell:not(.locked)')][${i}];
            if (!c) return false; c.click(); return true; })()`);
          if (!opened) continue;
          await wait(500);
          if (!await ev("!!document.querySelector('.equip-picker .ep-list .ep-hold')")) continue;
          const pieces = JSON.parse(await ev(`JSON.stringify(
            [...document.querySelectorAll('.equip-picker .ep-list .disc-face .df-label, .equip-picker .ep-list .disc-face')]
              .filter((n) => n.classList.contains('disc-face'))
              .map((f) => (f.querySelector('.ec-name') || f).textContent.trim()))`));
          const grips = await axGrips();
          const names = grips.map((g) => g.name);
          const dups = names.length - new Set(names).size;
          const unnamed = names.filter((n, k) => {
            const piece = (pieces[k] || '').trim();
            return !piece || !n.toLowerCase().includes(piece.toLowerCase());
          }).length;
          const missingHold = grips.filter((g) => g.holdMs > 0 && !/\bhold\b/i.test(g.name)).length;
          const sealedHold = grips.filter((g) => g.disabled && /\bhold\b/i.test(g.name)).length;
          seen++;
          console.log(`      ${edge.say} · slot ${i}: ${names.length} grip(s) · pieces ${JSON.stringify(pieces)}`);
          console.log(`          AX names ${JSON.stringify(names)}`);
          ok(unnamed === 0, unnamed === 0
            ? `A9 ${edge.say} slot ${i}: all ${names.length} grip name(s) carry their piece`
            : red('A9.name', `${edge.say} slot ${i}: ${unnamed} of ${names.length} grip(s) do not name their piece in the accessibility tree`
              + ` — ${JSON.stringify(names)} against ${JSON.stringify(pieces)}. data-hold-for is not in that tree.`));
          ok(dups === 0, dups === 0
            ? `A9 ${edge.say} slot ${i}: no two grips share an accessible name (${names.length} candidate(s))`
            : red('A9.collide', `${edge.say} slot ${i}: ${dups} grip name collision(s) among ${names.length} candidates — ${JSON.stringify(names)};`
              + ' assistive tech and voice control meet several sibling buttons with one name'));
          ok(missingHold === 0, missingHold === 0
            ? `A9 every armed grip exposes its hold requirement (${names.length} candidate(s))`
            : red('A9.hold', `${edge.say} slot ${i}: ${missingHold} armed grip(s) omit the hold requirement from their accessible name — ${JSON.stringify(names)}`));
          ok(sealedHold === 0, sealedHold === 0
            ? `A9 sealed grips do not claim a hold they cannot arm (${names.length} candidate(s))`
            : red('A9.sealedhold', `${edge.say} slot ${i}: ${sealedHold} sealed grip(s) claim a hold they cannot arm — ${JSON.stringify(names)}`));
          // Back to a clean panel: each slot's picker is read on its own draw.
          await cdp.send('Page.navigate', { url: `${base}${edge.q}` }, S);
          await until(`!!document.querySelector(${JSON.stringify(edge.open)})`, `${edge.say} entry`);
          await wait(650);
          await ev(`document.querySelector(${JSON.stringify(edge.open)}).click()`);
          await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
          await wait(400);
        }
        // A run where no picker opened would print nothing and pass — the blind
        // green this house keeps finding. It is a finding, not a skip.
        ok(seen > 0, seen > 0
          ? `A9 ${edge.say}: ${seen} slot picker(s) read off the accessibility tree`
          : red('A9.blind', `${edge.say}: no slot picker opened at all — no grip name was read, NOT a pass`));
      }
    }

  // ONE HARNESS-DEATH HANDLER FOR THE WHOLE DRIVEN RUN, and this catch used to
  // sit two hundred lines up. Saga measured the half I left open (ea2cf89 →
  // 4d18b23): I named the structural cause and closed ONE of three `until`
  // calls. The other two — waiting for the map, waiting for its overlay — still
  // threw into the void and exited 1, the code line 41 reserves for A FINDING.
  // The fix is not three fixes: A SECOND REGION WITH A DIFFERENT EXIT CONTRACT
  // WAS THE DEFECT. There is now one, so no `until` added below can be born
  // outside it. The one timeout that IS a finding says so at its own call site
  // (`mapHasCard`, which catches into a boolean and reaches `A4.nocard`).
  } catch (e) {
    cdp.close(); await dropBrowser(); if (s.server) s.server.close();
    finish(2, e.message);
  }

  cdp.close(); await dropBrowser(); if (s.server) s.server.close();
  finish(fails ? 1 : 0);
}

// EVERY DOOR OUT OF THIS FILE IS `finish()`, INCLUDING THE ONES I DID NOT WRITE.
// `a1Model()` runs before the driven try and a throw there used to leave through
// node's own unhandled-rejection path: exit 1, the code reserved for a finding,
// with no boundary and no count. This catch is not belt-and-braces — it is the
// third exit path the audit found.
await main().catch((e) => finish(2, e && e.message ? e.message : String(e)));
