// AN ARMED CARD THAT STOPPED LOOKING ARMED IS STILL ARMED.
//
// Combat's `selected` is its TARGETING state: the card whose next enemy tap
// commits it. It is written in exactly one place — the inspect door's Play on a
// card that needs a target — and that door lit the same card in the shared
// cardSelection store first. So while combat is armed, the store's lit card IS
// `selected`. Two facts, one card.
//
// #1003 gave every card screen a `clearSelection()` on mount, so a spent beat
// could not outlive the screen that spent it. The mid-fight Armoury is a screen
// that mounts OVER a live fight, on `document.body`, without remounting combat.
// Its `clearSelection()` runs the hand card's `douse`, and that douse removes
// `inspection-selected`, `inspection-info-visible` AND `selected`, and sets
// `aria-pressed="false"`.
//
// WHAT A PLAYER GOT: the card stopped saying it was armed, the enemies kept
// wearing `.targetable` (nothing re-ran combat's sync), and the next enemy tap
// reached `if (selected) playCard(selected, enemy.id)` — committing a card the
// player could no longer see was chosen. Found by a review bot reading this
// branch, and caused by this branch.
//
// THE RULE THIS FILE HOLDS: when the store goes EMPTY, combat drops its own
// targeting and re-dresses. Only the empty case — a store that moves to another
// card is the `cardinspectionselect` listener's business, and that listener
// deliberately ignores a lit card outside the hand.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lightCard, clearSelection, onSelectionChange, resetSelection } from '../src/ui/components/cardSelection.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const strip = (text) => text.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

let checks = 0;
const ok = (cond, what) => { checks++; assert.ok(cond, what); };

// ---- the store really does announce the empty ---------------------------------
// The whole fix rests on `clearSelection()` reaching a watcher. If it ever
// stopped notifying, combat would go back to holding a phantom arming and every
// source check below would still read green.
resetSelection();
const seen = [];
const release = onSelectionChange((lit) => seen.push(lit));
let doused = 0;
lightCard('inst-42', () => { doused++; });
clearSelection();
ok(seen.length === 2, 'the store notifies on the light and on the clear');
ok(seen[0] === 'inst-42', 'the first notice names the lit card');
ok(seen[1] === null, 'the clear notice is the empty, which is what combat watches for');
ok(doused === 1, "the cleared card's own douse ran — the step that strips `selected` from the DOM");
// And a watcher that has been released hears nothing more, which is what keeps
// an outgoing fight from re-dressing a DOM it no longer owns.
release();
lightCard('inst-7');
clearSelection();
ok(seen.length === 2, 'a released watcher hears nothing further');
resetSelection();

// ---- combat holds the other half ---------------------------------------------
const combat = strip(read('src/ui/screens/combat.js'));
ok(/import \{[^}]*onSelectionChange[^}]*\} from '\.\.\/components\/cardSelection\.js'/.test(combat),
  'combat.js watches the selection store');
const watch = combat.match(/const releaseSelectionWatch = onSelectionChange\(\(lit\) => \{([\s\S]*?)\n  \}\);/);
ok(!!watch, 'combat.js registers a watch whose body can be read');
ok(/lit !== null/.test(watch[1]),
  'the watch acts on the EMPTY store only, leaving a move to another card to the inspect listener');
ok(/selected = null;/.test(watch[1]) && /selfArm = null;/.test(watch[1]),
  'the watch drops combat\'s own targeting and self-arming');
ok(/syncCardSelection\(\);/.test(watch[1]),
  're-dressing follows, so the enemies lose `.targetable` with the arming');
ok(!/selectedFlask/.test(watch[1]),
  'a flask is not a card in the store, so the watch leaves flask targeting alone');
ok(/combatEl\.isConnected/.test(watch[1]),
  'a mount whose DOM is gone re-dresses nothing');

// The watch has to be given up, or every past fight re-dresses on every clear.
ok(/releaseSelectionWatch\(\);/.test(combat.replace(/const releaseSelectionWatch[\s\S]*?\n  \}\);/, '')),
  'combat releases the watch when it tears down');

// ---- and the douse is still what makes this necessary -------------------------
// If the douse stopped removing `selected`, the desync would not arise — and
// this test would be guarding nothing. Name the line it depends on.
const inspection = strip(read('src/ui/components/cardInspection.js'));
ok(/classList\.remove\('inspection-selected', 'inspection-info-visible', 'selected'\)/.test(inspection),
  "the douse still strips the combat hand card's `selected` class, which is why combat must be told");

console.log(`PASS ${checks}/${checks}; combat drops its targeting when the shared selection is emptied under it`);
