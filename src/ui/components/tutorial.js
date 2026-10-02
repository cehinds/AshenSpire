// src/ui/components/tutorial.js — first-run combat callouts (SPEC §7.4, §9 M4)
//
// A one-time guided overlay (≤4 dismissible callouts) shown on the player's
// first combat. Spotlights each key element and explains it; the "seen" flag is
// persisted in meta settings (main.js) so it never shows twice. Steps whose
// target isn't on screen (e.g. a Staggered enemy has no intent) are skipped.
//
// THREE INDEPENDENT EXITS, on purpose. `finish()` is the only thing that ever
// writes `seenTutorial` (main.js onTutorialDone), so an unreachable exit is not
// a cosmetic bug — it locks the player out of their first fight and survives a
// reload, because the flag is still unwritten. So: the buttons, the Escape key,
// and — the backstop that needs no geometry at all — a veil that does not eat
// the board's input (ui.css .tut-veil is pointer-events:none; only the bubble
// takes clicks). Even with every callout mispositioned, the player can play.

import { anchorLocalBox } from '../fx.js';
import { veilIsOpen } from './veil.js';
import { actionLabel } from '../input.js';
import { el, button, buttonRow, titleS, prose } from '../kit/index.js';

// `text` IS A FUNCTION WHEREVER IT NAMES A CONTROL, and that is the whole of the
// change here. The End Turn step shipped as *"Done? End Turn (or press E)."* — a
// hardcoded `E` in the FIRST THING a new player ever reads, which the first rebind
// orphans in the one place a player has no way to know it is lying (Law 1 clause
// 7). It derives from the live binding now, resolved at the moment the callout is
// SHOWN rather than at module load, so a rebind between boot and first fight still
// carries. `actionLabel` also answers the active device, so a pad player is told
// the glyph on the button under their thumb rather than a letter they cannot press.
//
// `press 1–9` in the Play-cards step is DELIBERATELY LEFT AS PROSE: the positional
// quick-play keys are not rows in ACTIONS, are not rebindable, and have no binding
// to derive from. Said here rather than leaving the next reader to work out which
// of the two rules applied to which line.
const STEPS = [
  { sel: '.energy-orb', title: 'Energy', text: 'Three energy each turn. Cards cost energy to play — spend it wisely.' },
  { sel: '.enemy-row .intent', title: 'Enemy intent', text: 'Enemies telegraph their next move. The number is the exact damage they will deal to you.' },
  { sel: '.hand .card', title: 'Play cards', text: 'Click a card or press 1–9. Attacks need a target — click an enemy, or drag the card onto it.' },
  { sel: '.end-turn', title: 'End your turn',
    text: () => `Done? End Turn (or press ${actionLabel('endTurn')}). Unspent energy and most Block are lost at your next turn.` },
];

// What the bubble keeps off (place() below): the cards the player is being
// taught to play. A selector, so it follows the hand wherever the layout puts it.
const KEEP_CLEAR = '.hand .card';

export function mountTutorial(root, { onDone }) {
  const steps = STEPS.filter((s) => root.querySelector(s.sel));
  if (!steps.length) return onDone();

  // THE CALLOUT IS THE KIT'S SPOTLIGHT (styles/kit.css §SPOTLIGHT): a veil that
  // takes no input, the lit box, and a Popover holding a Title·S, Prose and a
  // ButtonRow. The veil's `pointer-events: none` is the backstop this file's
  // header is about, and it is the atom's, not this file's.
  const skipButton = button({ label: 'Skip', className: 'tut-skip' });
  const nextButton = button({ label: '', weight: 'primary', className: 'tut-next' });
  const veil = el('div', { class: 'as-spot-veil tut-veil' }, [
    el('div', { class: 'as-spot tut-spot' }),
    el('div', { class: 'as-pop tut-bubble' }, [
      titleS(''), prose('', { class: 'tut-text' }),
      buttonRow({ size: 'short', buttons: [skipButton, nextButton], className: 'tut-row' }),
    ]),
  ]);
  veil.querySelector('.as-title-s').classList.add('tut-title');
  root.appendChild(veil);

  const spot = veil.querySelector('.tut-spot');
  const bubble = veil.querySelector('.tut-bubble');
  let i = 0;

  // Keep every number below in ONE space: the veil's own local coordinates.
  // getBoundingClientRect answers in post-zoom (visual) pixels, but an inline
  // left/top on a child is read in the layer's pre-zoom local space — so a raw
  // rect offset lands at offset×zoom. anchorLocalBox (fx.js, five other call
  // sites) is where that conversion lives; measuring the veil against itself
  // gives the viewport in the same space, so clamps compare like with like.
  // The veil really is the layer here — .tut-spot / .tut-bubble are absolute
  // inside it (ui.css), so it is their containing block, not just their parent.
  const MARGIN = 12;
  const GAP = 20;
  const clamp = (v, max) => Math.max(MARGIN, Math.min(v, max));
  const overlaps = (a, k) => a.left < k.left + k.width && k.left < a.left + a.width
    && a.top < k.top + k.height && k.top < a.top + a.height;

  function place() {
    const target = root.querySelector(steps[i].sel);
    if (!target) return false;
    const view = anchorLocalBox(veil, veil); // the viewport, in the veil's space
    const box = anchorLocalBox(veil, target);
    const pad = 8;
    spot.style.left = `${box.left - pad}px`;
    spot.style.top = `${box.top - pad}px`;
    spot.style.width = `${box.width + pad * 2}px`;
    spot.style.height = `${box.height + pad * 2}px`;

    // Measure the bubble as rendered (its height depends on the text that was
    // just written into it) rather than trusting a constant, then clamp BOTH
    // axes — the buttons live at its bottom edge, so an unclamped Y is exactly
    // how "Got it" ended up below the fold.
    const b = anchorLocalBox(veil, bubble);
    const below = box.top + box.height + GAP;
    const above = box.top - b.height - MARGIN;
    const wantY = below + b.height + MARGIN <= view.height ? below : above;
    const at = (x, y) => ({
      left: clamp(x, view.width - b.width - MARGIN),
      top: clamp(y, view.height - b.height - MARGIN),
      width: b.width, height: b.height,
    });
    // THE BUBBLE MUST NOT SIT ON THE HAND. The veil lets the board answer
    // through it, but the bubble itself takes clicks — so a bubble parked on a
    // card is a card the player cannot play while the coach marks stand. When
    // the action row moved Energy to the bottom-left, "above, left-aligned"
    // landed on the first card at every shipped viewport. Try the same
    // above/below choice at the other alignments, then beside the target, and
    // take the first that clears the hand and the lit target; if none does,
    // keep the original placement (the buttons stay reachable either way).
    const clear = Array.from(root.querySelectorAll(KEEP_CLEAR), (n) => anchorLocalBox(veil, n));
    clear.push(box);
    const midY = box.top + box.height / 2 - b.height / 2;
    // On the shortest screens the hand fills the width beside a bottom-row
    // target, so the last resort is the band above the whole hand.
    const overHand = Math.min(...clear.map((k) => k.top)) - b.height - MARGIN;
    const candidates = [
      at(box.left, wantY),
      at(box.left + box.width - b.width, wantY),
      at(box.left + box.width / 2 - b.width / 2, wantY),
      at(box.left + box.width + GAP, midY),
      at(box.left - b.width - GAP, midY),
      at(box.left, overHand),
      at(box.left + box.width - b.width, overHand),
    ];
    const pick = candidates.find((c) => !clear.some((k) => overlaps(c, k))) || candidates[0];
    bubble.style.left = `${pick.left}px`;
    bubble.style.top = `${pick.top}px`;
    return true;
  }

  function show() {
    const step = steps[i];
    veil.querySelector('.tut-title').textContent = step.title;
    veil.querySelector('.tut-text').textContent = typeof step.text === 'function' ? step.text() : step.text;
    veil.querySelector('.tut-next').textContent = i === steps.length - 1 ? 'Got it' : `Next (${i + 1}/${steps.length})`;
    if (!place()) next(); // target vanished between filter and show
  }

  function next() {
    i += 1;
    if (i >= steps.length) finish();
    else show();
  }

  let done = false;
  function finish() {
    if (done) return; // Escape, then a click on the same frame, is still one finish
    done = true;
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', onResize);
    veil.remove();
    onDone();
  }

  // Escape ends the tutorial. Captured (before the combat screen's own Esc, which
  // would otherwise only cancel targeting) so exactly one thing answers the key —
  // but a standing veil owns input while it's up, same rule as combat.js.
  //
  // THIS FILE IS A CALLER OF THE PREDICATE, NEVER A SUBJECT OF IT, and that is
  // the whole reason `.tut-veil` is not a `.modal-veil`. The veil this file
  // mounts is `pointer-events: none`: the tutorial coaches the player THROUGH
  // playing the board, so the board beneath must keep answering keys. Asking is
  // the other direction — a veil over the tutorial takes Escape from it. Both
  // halves are stated in components/veil.js so neither is rediscovered as a bug.
  function onKey(ev) {
    if (ev.key !== 'Escape' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (veilIsOpen()) return;
    // Step 3 teaches the player to arm a target, and combat can reach that state
    // through either a hand card or a targeted flask. The enemy's `targetable`
    // class is the shared, rendered truth; a flask deliberately has no selected
    // card. While that state stands, Escape belongs to combat's existing cancel
    // handler, which runs after this capture listener. Yield the SAME event
    // without preventing or stopping it: combat clears its card/flask selection
    // and targetable enemies, while this tutorial remains mounted and onDone
    // stays untouched. A selected self-card has no targetable enemy, so it still
    // follows the tutorial's ordinary one-press exit.
    if (root.querySelector('.enemy-row .enemy.targetable')) return;
    ev.preventDefault();
    ev.stopPropagation();
    finish();
  }
  addEventListener('keydown', onKey, true);

  // Resizing changes --ui-zoom (Auto), which changes the local space every
  // placement above was computed in — re-place instead of going stale.
  //
  // ONE RE-PLACE IS NOT ENOUGH, because the board finishes moving after it. The
  // combat action row re-lays itself out a few hundred ms after the zoom
  // re-flex (measured 2560x1440 -> 1280x800: the Energy orb moved 163 px left
  // at ~600 ms, after the 220 ms re-place), and the spotlight was left lit on
  // empty floor. So after the first re-place this follows the target frame by
  // frame and re-places whenever its box moves, until it has held still for
  // SETTLE_STILL_MS or SETTLE_MAX_MS has passed — whichever comes first. Both
  // are wall-clock times, not frame counts: a count of frames is ~250 ms at
  // 120 Hz, which gives up before the ~600 ms move above.
  //
  // BUT A GAP BETWEEN FRAMES IS NOT TIME SPENT HOLDING STILL. Time in which no
  // frame was rendered is time nobody looked. On a loaded machine the re-flex
  // arrives as long tasks — measured on a busy 4-core box: the resize delivered
  // 3.6 s after it was sent, then frames 400-900 ms apart while the action row
  // re-laid itself (orb 200,745 -> 363,766 -> 200,745, the last move ~1.4 s
  // after the first re-place). One long gap read as "held still for 500 ms",
  // the loop stopped, and the orb's next move left the spotlight lit on where
  // it had been (tutorial-reach on CI: "0% of null", "13% of .energy-orb").
  // So both clocks here count RENDERED time: each frame adds at most
  // FRAME_CREDIT_MS, however long the gap before it. At 60 or 120 Hz that is
  // the wall clock; on a starved page it takes more frames, never fewer.
  const SETTLE_STILL_MS = 500;
  const SETTLE_MAX_MS = 3000;
  const FRAME_CREDIT_MS = 50;
  let resizeTimer = null;
  let settleRun = 0;
  const targetKey = () => {
    const t = root.querySelector(steps[i]?.sel);
    if (!t) return '';
    const r = t.getBoundingClientRect();
    return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
  };
  function settle() {
    const run = ++settleRun;
    let prev = performance.now();
    let last = targetKey();
    let elapsed = 0; // rendered ms since settle began
    let still = 0;   // rendered ms the target has held its box
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(now - prev, FRAME_CREDIT_MS);
      prev = now;
      elapsed += dt;
      if (done || run !== settleRun || elapsed > SETTLE_MAX_MS) return;
      const key = targetKey();
      if (key !== last) { last = key; still = 0; place(); } else still += dt;
      if (still < SETTLE_STILL_MS) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!done) { place(); settle(); } }, 220); // after main.js's 150ms zoom re-flex
  }
  addEventListener('resize', onResize);

  veil.querySelector('.tut-next').addEventListener('click', next);
  veil.querySelector('.tut-skip').addEventListener('click', finish);
  show();
}
