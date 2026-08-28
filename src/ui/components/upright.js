// src/ui/components/upright.js — THE LAST-RESORT SHORT-SCREEN GATE.
//
// CURRENT AFTER #27 (2026-08-20). Landscape is supported wherever the rendered
// short-wide composition is complete: 340..464 device px high at a fitting wide
// width. This component no longer stands at 844x390 or at the browser-chrome
// sensitivity cell 844x344. It remains only below the compact composition's
// measured lower floor (844x339 is the one-pixel control), where drawing the
// ordinary board would strand END TURN. styles/ui.css compresses only the gate's
// decorative spacing there so every sentence remains readable at Text XL.
//
// The long decision record below is PRE-#27 history. It is retained because it
// explains the refusal's ownership, input semantics and player-controlled switch;
// claims in it that 844x390 is refused or landscape support is owed describe the
// former runtime and are superseded by the current contract above.
//
// ============================================================================
// ⚠ AMENDED BY THE OWNER, 2026-08-17. READ THIS BEFORE THE RULING BELOW.
// ============================================================================
//
// Constantine, unprompted, in his own words:
//
//   "rotating to horizontal should work again. I hate that it tells me to
//    rerotate to verticle. revert that back, or make that a configurable
//    setting."
//
// HE OFFERED TWO ANSWERS AND MARINA RULED THE SECOND — a revert deletes whatever
// the gate was protecting; a setting keeps the protection reachable. So the gate
// now takes an `enabled` argument fed by ONE row, `Display / Short-screen
// warning`, and `SAY.hint` names that row on the gate's own face.
//
// ⚠ AND THE LEAST FLATTERING FACT IN THIS LANE IS ALREADY IN THIS FILE, sixty
// lines down: *"A gate that tells a desktop player to rotate their monitor is a
// gate nobody trusts the second time."* WE WROTE DOWN THAT THIS NAG CAN BE WRONG,
// SHIPPED IT WITH NO WAY TO TURN IT OFF, AND LEFT THE OWNER TO ASK. The sentence
// was about the *wording* being false on a desktop; the amendment is about there
// being no door at all. Two different defects, one root — a refusal we knew could
// misfire and gave nobody a switch for.
//
// HISTORICAL — WHAT THE AMENDMENT DID NOT CHANGE, said plainly because the row's default turns
// on it: **the wall is still there.** At 844x390 on this tree, measured, not
// argued (`node tools/uprightgate.mjs`):
//
//     .end-turn  top 415.41..439.78  0% on screen  NO scroll path to the rest
//     .energy-orb 0% on screen, unreachable · .hand-area 32.05% on screen
//
// So the row ships DEFAULTING ON. Off, the board draws and the turn cannot be
// ended — that is a choice a player may make with the note in front of them, and
// it is not "rotating to horizontal should work again". **LANDSCAPE SUPPORT IS
// STILL OWED** and it is still the thing the four reasons below are about. The
// default is one token (`def: true` in screens/settings.js) and it is the one part
// of this held for his word.
//
// ============================================================================
// THE HISTORICAL DECISION, BEFORE #27'S LAYOUT: GATE, NOT SUPPORT.
// ============================================================================
//
// Sunna, 2026-08-15, on Marina's ruling that this act opens with a decision and
// not a stylesheet. Landscape phone is REFUSED, out loud, with a way back — it
// is not a supported shape and this file is the whole of that answer. Four
// reasons, in the order they actually decided it:
//
// 1. THE WALL IS HEIGHT, AND REARRANGING DOES NOT MAKE HEIGHT. At 844x390 the
//    app renders at its zoom FLOOR (0.62, the clamp, not the fit) and the board
//    gets 390/0.62 = 629 local px against a baseline that declares it needs 730.
//    Bjorn measured the consequence: END TURN at top 395 in a 390 px viewport,
//    inside `DIV.combat` at `overflow-y: hidden` (scrollHeight 758 vs
//    clientHeight 629), NO scrollable ancestor, `docH == vh`. No gesture reaches
//    it. The 101 px his flask probe pushed the topbar above the fold is the SAME
//    NUMBER: 730 - 629. One deficit, two faces. A composition can move a button;
//    it cannot conjure the 101 px.
//
// 2. SUPPORT IS NOT ONE SCREEN, IT IS EVERY SCREEN. The wall is combat. The map
//    at 844x390 is a second face — the `ENTRANCE ——— BOSS` strip is
//    `display: none` above 700 px (styles/map.css:16), so a 844-wide phone loses
//    the one thing that says which way the act runs, and the bundle logs
//    "1074 px of the choice is off screen". Behind those two sit creation, the
//    Armoury, settings, rest, shop, event, the co-op surfaces. Supporting
//    landscape means a THIRD composition for all of them, and a third
//    composition is a third thing that rots. This game has two and #24 was born
//    out of having two DECIDERS for those two.
//
// 3. NOBODY ASKED FOR IT, AND HIS ONE MOBILE RULING POINTS THE OTHER WAY. Law 5
//    is his: "for mobile, if possible, I should only be scrolling up and down."
//    Vertical is the budget. A landscape phone is the shape with the least
//    vertical budget there is.
//
// 4. A GATE IS REVERSIBLE AND A COMPOSITION IS NOT. "Revert costs nothing"
//    (Charter). If landscape support is ever wanted, this file is deleted and
//    the premise dies with it — see the WAKE CONDITION below, which is written
//    so a machine notices that day instead of me.
//
// WHAT I AM NOT CLAIMING: that landscape *could* not be made to work. Only that
// it is not one change, it is not this act, and the man is holding a build
// whose only protection today is a sentence in a note asking him not to rotate
// his phone. This replaces the sentence.
//
// ============================================================================
// THE PREDICATE — WHY IT IS A FIT AND NOT AN ORIENTATION
// ============================================================================
//
// `@media (orientation: landscape)` would gate a 1024x768 tablet and a desktop
// window, both of which are FINE, and it would ask "is this a phone" — the
// question main.js already refuses to ask because it has no honest answer. So
// the gate rides the same decider that picks the zoom and the layout, in the
// same call, and reads:
//
//   SHORT  <=>  innerHeight < balance.ui.uiScale.gateBelowH
//
// One number, one home, and it is a MEASUREMENT with its ladder written beside
// it in balance.js — the rendered bottom edge of END TURN at the zoom floor.
// This file holds no copy of it (Law 0 clause 4, Law 1 clause 2).
//
// I HAD IT WRONG FIRST, AND WRITING IT DOWN HERE IS THE POINT. My first
// predicate was "the zoom clamp is what is binding" — h < min x baselineH. True
// about the zoom, wrong about the player: it refused 800x450, where END TURN is
// whole and 100% on screen. I found that by widening the check's shape list, not
// by reasoning, and the check went red on my own build before anyone saw it.
// A REFUSAL MUST BE PINNED TO THE CONTROL THE PLAYER NEEDS, NEVER TO THE
// BASELINE THE BOARD DECLARES — those two differ by 30 px of viewport, and every
// one of them is somebody's window.
//
// WHAT THE GATE DOES NOT ANNEX. On that same ladder `.hand-area` is already
// clipped at h 480 — well above any gate — sliding 94% -> 74% before END TURN
// moves at all. That is a pre-existing defect of the wide layout in short
// windows and it needs layout work. Widening the refusal to cover it would hide
// a bug behind a wall.
//
// THE ADVICE IS DERIVED, NEVER GUESSED. "Turn your phone upright" is a CLAIM
// about a screen this code has not seen, so main.js asks the same decider about
// the TURNED viewport (h x w) before this file is allowed to say it. If turning
// would not help, the gate says the true thing instead — make the window taller.
// A gate that tells a desktop player to rotate their monitor is a gate nobody
// trusts the second time.
//
// ============================================================================
// WAKE CONDITION (development.md, *The wake condition*) — A REFUSAL ROTS QUIETLY
// ============================================================================
//
// This is a refusal mechanism: it exists to NOT draw the board while a premise
// holds. Its correct state and its expired state print the same nothing, so:
//
//   PREMISE, as an observable predicate: at some shape, combat's END TURN is
//   outside the viewport with no scrollable ancestor between it and the
//   document — i.e. a real wall exists there.
//
//   THE WAKE RED, and it is the half a suite written to assert absence never
//   fires: `node tools/uprightgate.mjs` goes RED WHEN THE GATE STANDS ON A SHAPE
//   WHERE END TURN IS REACHABLE. The day a landscape composition ships, the
//   premise dies, that clause goes red, and this file is deleted rather than
//   quietly outliving its reason. It is not enough to check that the gate
//   appears; something has to check that it stops.
//
// REMOVAL CONDITION: deleted the day `balance.ui.uiScale` carries a baseline
// that fits a short viewport — then `gateBelowH` goes to 0, no shape is short,
// and this file refuses nothing. Removing the key entirely also disarms it (see
// main.js): a missing threshold must never invent a refusal at a guessed number.
//
// ============================================================================
// MECHANISM — BORROWED, NOT INVENTED
// ============================================================================
//
// The gate is a `.modal-veil`, which in this tree is not decoration: it is how a
// layer DECLARES INPUT OWNERSHIP (components/veil.js). Carrying the class buys,
// with no new input code:
//   - combat.js:912 and map.js:270 refuse their keyboard handlers, so the `E`
//     chip stops ending turns behind a screen the player cannot see;
//   - input.js's scopeRoot() scopes the pad/keyboard focus cursor to this veil,
//     which has nothing focusable — so the cursor has nowhere to wander;
//   - `topVeil()` sorts by z-index, and this one is ABOVE the six at 500, so it
//     owns input even if it rises over an open overlay.
// The precondition veil.js states holds: this mounts as a child of <body>, at
// `position: fixed`, in the same root stacking context as the other six.
//
// NO INTERACTIVE CONTROLS, AND THAT IS RULED RATHER THAN OMITTED. There is no
// "continue anyway", because continuing leads to a fight that cannot be
// advanced, and a door into a wall is worse than a wall. Law 3 clause 4 (a
// tooltip on every interactive control) therefore has no subject here — not an
// exemption, an empty set. THE COST, NAMED: a player whose device is physically
// locked to landscape cannot play. If that ever arrives as a real report, the
// answer is landscape support (Viki), never a bypass added here.
//
// THE TYPE IS DIVIDED BY `--ui-zoom` ON PURPOSE, and it is the one carve-out in
// this file. This is the message ABOUT the app having zoomed itself to its
// floor; scaling it by that zoom is the message shrinking exactly when it
// matters. Same idiom, same reason, as `--tap-floor: calc(44px/var(--ui-zoom))`
// in base.css. Law 4 is intact: the unit is still `rem`, so Text size still
// scales these glyphs and only these glyphs; what is cancelled is UI size, which
// is the thing being reported on.

/** The gate's own element, or null when nothing is standing. */
let gate = null;

// ONE HOME FOR THE COPY, and it is a function of the advice rather than two
// pasted blocks — the quarantine-sentence lesson (main.js): two doors with two
// strings is how they drift. `rotate` is only ever chosen when main.js has
// already confirmed the turned viewport is not short.
// ONE REASSURANCE LINE FOR BOTH, AND IT NAMES NO DEVICE. The heading is the
// instruction; this line's only job is to answer the question the player is
// actually asking, which is "have I lost my run". Its first draft was
// per-variant and read "turn back — or make this window taller —" on a phone: a
// third line of text, and the word `window` on something that is not one. If
// the pointer query is ever wrong about someone, they still read a true
// sentence here — which is exactly why it must not name the fix.
const SAFE = 'Your run is safe — nothing is lost, and it comes right back.';
// ONE LINE NAMING THE WAY OUT, ADDED FOR HIS AMENDMENT, AND IT IS A POINTER AND
// NOT A CONTROL. He wrote *"I hate that it tells me to rerotate to verticle"* —
// and the reason he had to ASK is that this screen never said a setting existed.
// A refusal a player cannot turn off, that does not admit it can be turned off,
// is the shape of the complaint. It stays a sentence rather than a button, which
// keeps the header's no-bypass argument intact: what it costs is one tap in a
// menu, and what that buys is a player who read the row's note before choosing.
// SHARED BY BOTH VARIANTS for the same reason SAFE is — two doors with two
// strings is how they drift.
const HINT = 'Rather draw it anyway? Settings › Display › Short-screen warning.';
const SAY = {
  rotate: {
    title: 'Turn your phone upright',
    body: 'Sideways there isn’t enough height for the board, and END TURN ends up somewhere your thumb can’t reach.',
    safe: SAFE,
    hint: HINT,
  },
  resize: {
    title: 'This window is too short',
    body: 'There isn’t enough height for the board, and END TURN ends up somewhere you can’t reach.',
    safe: SAFE,
    hint: HINT,
  },
};

/**
 * updateUprightGate({ short, offerRotate, enabled })
 *
 *   short        no complete narrow or short-wide composition fits this
 *                viewport — the only geometric thing that decides refusal
 *   offerRotate  main.js asked the same decider about the SWAPPED viewport and
 *                it is not short, AND the primary pointer is coarse — so
 *                "turn it" is a true and doable instruction. WORDING ONLY.
 *   enabled      the player's own answer — `Display / Short-screen warning`.
 *                `false` and nothing stands, whatever the geometry says. It is a
 *                SECOND, INDEPENDENT gate rather than a term inside `short`,
 *                because "is this screen too short" and "does this player want to
 *                be told" are two questions and one of them is his.
 *
 * ⚠ `enabled === false` IS THE ONE DOOR THROUGH THIS REFUSAL AND IT IS NOT THE
 * "CONTINUE ANYWAY" BUTTON THE HEADER RULES OUT. The header's argument stands
 * unchanged — a door into a wall placed AT the wall is worse than the wall,
 * because it is pressed in the moment of annoyance by someone who has not been
 * told what is on the other side. This one is a persisted setting, in the Display
 * list, reached from a screen that is working, with the cost written on the row;
 * and the gate does not offer it, it merely NAMES it (see SAY.hint below), which
 * is the difference between an escape hatch and an informed choice. **His word
 * amended the ruling and it is recorded here rather than reinterpreted.**
 *
 * Idempotent, and deliberately so: it is called from every applyUiScale, which
 * fires on boot, on every settings change and on a 150ms resize debounce. When
 * the advice has not changed it touches nothing, so the gate does not blink and
 * — the part that matters — NOTHING BENEATH IT RE-RENDERS. Turning the phone
 * back removes one element; the run underneath never knew.
 */
export function updateUprightGate({ short, offerRotate, enabled = true } = {}) {
  if (typeof document === 'undefined') return null;
  // `enabled === false` takes the gate down by the SAME path a fitting screen
  // does, so turning the setting off mid-fight removes one element and the run
  // underneath never knows — the idempotence promise above, applied to his row.
  if (!short || enabled === false) {
    if (gate) { gate.remove(); gate = null; }
    return null;
  }
  const advice = offerRotate ? 'rotate' : 'resize';
  if (gate && gate.dataset.advice === advice) return gate;
  if (!gate) {
    gate = document.createElement('div');
    // `.modal-veil` is the input-ownership declaration, not the dimming — see
    // the header. `.upright-veil` carries the look and the higher z-index.
    gate.className = 'modal-veil upright-veil';
    gate.setAttribute('role', 'alertdialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-labelledby', 'upright-title');
    document.body.appendChild(gate);
  }
  const say = SAY[advice];
  gate.dataset.advice = advice;
  gate.innerHTML = `
    <div class="upright-card">
      <div class="upright-glyph" aria-hidden="true"><span class="upright-phone"></span></div>
      <h2 id="upright-title">${say.title}</h2>
      <p class="upright-say">${say.body}</p>
      <p class="upright-safe">${say.safe}</p>
      <p class="upright-hint">${say.hint}</p>
    </div>`;
  return gate;
}

/** Is the gate standing? One reader, for tests and for anything downstream. */
export function uprightGateIsUp() {
  return !!(typeof document !== 'undefined' && document.querySelector('.upright-veil'));
}
