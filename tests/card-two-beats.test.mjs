// Every card owes two beats: the first tap SELECTS it and reveals its `i`
// after the authored delay; the second reaches the card's own act. The
// behavioural proof is tools/holdconfirm.mjs in a real browser (it presses a
// Smith candidate and checks the shape of each beat). This file guards the
// SOURCE SHAPE, because the rule has now been broken twice by edits that each
// looked local and correct:
//
//   #980 handed the first tap to the action (`actionOwnsTouch` on the Smith
//        and the merchant) to fix a three-tap count — buying the count by
//        spending the selecting beat.
//   #987 gave a truncated card's chevron a private door straight to the
//        inspect modal, so one gesture meant two things depending on whether
//        a card's text happened to fit its face.
//
// Both are cheap to re-introduce and expensive to notice, so each has a line.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const inspection = read('src/ui/components/cardInspection.js');
// The comments in that file NAME the shapes this test forbids, on purpose —
// a reader has to be told what went wrong twice. So the forbidding checks read
// the code with its comments stripped; the comments are documentation, not the
// defect.
const code = inspection.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
let checks = 0;
const ok = (cond, what) => { checks++; assert.ok(cond, what); };

// ---- the rule itself --------------------------------------------------------
ok(/if \(!actionOwnsTouch && touchTaps === 1 && !touchSelectionSafe\)/.test(inspection),
  'only the selecting tap is swallowed');
ok(!/touchTaps === 2/.test(code),
  'the second tap is never reserved for the information button (the three-tap shape)');

// ---- the chevron begins the beats, it does not spend them -------------------
const more = inspection.slice(inspection.indexOf("more.addEventListener('click'"));
ok(/select\(\); revealInfo\(\);/.test(more.slice(0, 400)),
  'the chevron selects and reveals the `i`');
ok(!/open\(more\)/.test(code),
  'the chevron never opens the inspect door itself — the `i` is the one door');

// ---- reading a card spends the beat rather than zeroing it ------------------
// The tap count moved to ./cardSelection.js, so these now check the CALL
// rather than the assignment. Same two facts: reading a card never resets its
// count, and both doors spend exactly one selecting beat.
ok(!/touchTaps = 0|touchedIdentity = null/.test(code),
  'neither the `i` nor the chevron resets the tap count under a lit card');
ok((code.match(/spendSelectingBeat\(identity, douse\)/g) || []).length === 2,
  'both the `i` and the chevron spend exactly one selecting beat');
ok(/countBeat\(identity, douse\)/.test(code),
  'and the face counts its taps through the same store');

// ---- the selection grids kept their selecting beat --------------------------
// `actionOwnsTouch` is for surfaces with no selecting beat to spend: a card in
// the combat hand, and the reward chooser whose click only selects anyway.
for (const path of [
  'src/ui/components/smithUpgradeModal.js',
  'src/ui/components/mountServiceModal.js',
  'src/ui/screens/shop.js',
]) {
  ok(!/actionOwnsTouch/.test(read(path)), `${path} does not spend the selecting tap`);
}
for (const path of ['src/ui/components/hand.js', 'src/ui/screens/reward.js']) {
  ok(/actionOwnsTouch/.test(read(path)), `${path} keeps actionOwnsTouch (no selecting beat to spend)`);
}

// ---- the merchant's burn grew the green button the others already had -------
const shop = read('src/ui/screens/shop.js');
ok(/shop-burn-confirm/.test(shop), 'the burn grid has a confirm button');
ok(/cardinspectionselect/.test(shop), 'it is lit by the shared selection event, not a second idea of selection');
ok(/burnConfirm\.dataset\.burnState/.test(shop), 'its state is readable by an instrument');
ok(/t\('shop\.burn\.idle'\)/.test(shop) && /t\('shop\.burn\.ready'/.test(shop),
  'its copy is a row in uiStrings.csv, not a literal');

const strings = read('content/source/uiStrings.csv');
for (const id of ['shop.burn.idle', 'shop.burn.ready']) {
  ok(strings.includes(`\n${id},`), `${id} is authored`);
}

console.log(`PASS ${checks}/${checks}; every card owes two beats and the selection grids keep the first`);

// A REPAINT MAY DESTROY ONLY WHAT IT DREW.
//
// Selection repaints a card's face (#1128). The paint kept a NAMED PAIR of
// children — the `i` and the chevron — and deleted everything else, but the
// combat hand appends a positional keycap, a `card-unavailable-reason` pill
// and its `.hand-hit-lane` after the renderer has run. So the first tap on a
// card in combat removed them, and the hit lane is part of how the hand
// decides what a touch landed on: the defect could move where a player's taps
// go. It shipped to dev before it was caught.
//
// The rule that replaced it is an inversion, and the inversion is the thing
// worth guarding: the renderer marks what IT drew, and a repaint keeps every
// child that is not marked. An allow-list cannot be right here, because the
// renderer cannot know what a surface will add — so a future edit that goes
// back to naming children is the regression, whatever names it lists.
//
// This guards the SOURCE SHAPE, as the two rules above do. The behavioural
// proof is the combat gates (tools/handlayout.mjs, tools/hand-resize-probe.mjs).
{
  const card = read('src/ui/components/card.js');
  const paint = card.slice(card.indexOf('const paint = ('));
  const kept = paint.slice(paint.indexOf('const kept ='), paint.indexOf('el.innerHTML ='));
  assert.doesNotMatch(kept, /card-info-button|card-more-button/,
    'the repaint keep-list must not name individual children again: mark what the renderer drew and keep the rest');
  assert.match(kept, /cardPainted/,
    'the repaint decides what to keep by the renderer\'s own paint marker');
  assert.match(paint, /dataset\.cardPainted = '1'/,
    'each paint stamps the children it drew, or the next repaint cannot tell them from a caller\'s');
  assert.ok(paint.indexOf("dataset.cardPainted = '1'") < paint.indexOf('for (const node of kept)'),
    'the stamp lands before the kept children are re-appended, or the kept ones are stamped too and deleted next time');
}

// ONE TRACK PER IN-FLOW CHILD, OR EVERY BAND ON EVERY CARD IS MISALIGNED.
//
// A level that withholds a region must give its grid track back, so the paint
// recomputes `--card-bands` from the children it actually drew. That list is a
// POSITIONAL MIRROR of the emit order — name, art, body, metadata — and the
// cost rail and the tag strip are deliberately absent from it because both are
// absolutely positioned and take no track. A future edit that adds a fifth
// in-flow child, or reorders the emits, shifts every band on every playing
// card with nothing to say so: `card-one-shape.mjs` states in its own boundary
// that it asks about the card's OUTER shape and not its face bands, and the
// presentation-level gate covers `cardFields`, not tracks.
//
// So the mirror is pinned here: four entries, in the emitted order, and the
// rail's own offset derived from the same list rather than from the root
// property (which is head/total for the AUTHORED four and drifts as soon as a
// band is withheld).
{
  const card = read('src/ui/components/card.js');
  const paint = card.slice(card.indexOf('const paint = ('));
  const block = paint.slice(paint.indexOf('const drawn = ['), paint.indexOf('el.dataset.level'));
  const order = [...block.matchAll(/\/\/ \.([a-z-]+)/g)].map((m) => m[1]);
  assert.deepEqual(order.slice(0, 4), ['cname', 'art', 'cd-body', 'card-metadata'],
    'the drawn-children list must mirror the emit order of the four in-flow grid children');
  assert.doesNotMatch(block, /card-cost-rail|ctags/,
    'the cost rail and the tag strip are absolutely positioned and take no track: counting them misaligns every band');
  assert.match(block, /minmax\(0, \$\{b\}fr\)/,
    'bands must be shrinkable: a bare `fr` carries an implicit auto minimum and lets content take the budget back');
  assert.match(block, /--card-band-head/,
    'the cost rail hangs under the head band, so its offset is derived from the same recomputed list');
}
