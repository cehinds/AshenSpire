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
ok(!/touchedIdentity = null; touchTaps = 0;/.test(code),
  'neither the `i` nor the chevron resets the tap count under a lit card');
ok((code.match(/touchedIdentity = identity; touchTaps = 1;/g) || []).length === 2,
  'both the `i` and the chevron spend exactly one selecting beat');

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
