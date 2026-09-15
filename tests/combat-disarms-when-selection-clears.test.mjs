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
// AND THAT FIX WAS HALF OF IT. The first version of this file rested on a claim
// written into combat.js: that `selected` is set in exactly one place, the
// inspect door's Play. IT IS NOT. Arming also happens at the drag/flick
// `select()`, at the positional card key, and through `armSelf` — and none of
// those light the store. `clearSelection()` RETURNS WITHOUT NOTIFYING when the
// store is already empty, so on a keyboard-armed card the watcher never ran and
// the Armoury left the same live aim behind. Found by the review bot reading the
// fix itself.
//
// THE RULE THIS FILE HOLDS, in two halves that need each other:
//   1. when the store goes EMPTY, combat drops its card targeting and re-dresses
//      — the douse has already changed the glass under it. Only the empty case:
//      a store that moves to another card is the `cardinspectionselect`
//      listener's business, and that listener deliberately ignores a lit card
//      outside the hand.
//   2. opening the Armoury puts the aim down DIRECTLY, whatever armed it and
//      whether or not any store ever knew — because the overlay covers the
//      battlefield on every path.
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


// ---- and the Armoury does not wait to be told ---------------------------------
// The half the store cannot cover. Read the body of `openCombatArmoury` up to
// the `onArmoury` delegation: the disarm must be BEFORE it, or the host-routed
// Armoury keeps the aim while the panel mounted here drops it.
const armoury = combat.match(/function openCombatArmoury\(request = ''\) \{([\s\S]*?)\n  \}/);
ok(!!armoury, 'combat.js still opens the Armoury through a function whose body can be read');
const beforeDelegation = armoury[1].split('if (onArmoury)')[0];
ok(armoury[1].includes('if (onArmoury)'), 'the Armoury can still be routed to the host');

// AND A CLICK THAT OPENS NOTHING TAKES NOTHING. The first version of the disarm
// ran before the feature gate, so with `balance.equipment.enabled` false and no
// host handler the button opened nothing and still threw the player's aim away —
// worse than the bug it fixed.
//
// The gate is `!onArmoury && !enabled`, not `!enabled`: main.js's `showArmoury`
// never consults that flag, so a host-routed Armoury OPENS regardless and the
// aim must still go down. Gating on `enabled` alone would put the original bug
// back on that route.
const gate = beforeDelegation.match(/if \(!onArmoury && !registries\.balance\.equipment\.enabled\) return;/);
ok(!!gate, 'a click that opens nothing returns before anything is cleared');
ok(beforeDelegation.indexOf(gate[0]) < beforeDelegation.indexOf('selected = null;'),
  'that guard stands BEFORE the clearing, not after it');
// The old post-delegation gate was only reachable with no `onArmoury`, which the
// guard above now catches earlier. Leaving both would be dead code claiming to
// be a check.
ok(!/if \(!registries\.balance\.equipment\.enabled\) return;/.test(armoury[1]),
  'the superseded gate after the delegation is gone rather than left dead');
for (const field of ['selected', 'selfArm', 'selectedFlask']) {
  ok(new RegExp(`${field} = null;`).test(beforeDelegation),
    `opening the Armoury clears ${field} before the host delegation`);
}
ok(/syncCardSelection\(\);/.test(beforeDelegation),
  'and re-dresses, so the enemies stop wearing `.targetable`');

// The arming paths that never touch the store are the reason the direct clear
// exists. If one of them started lighting the store this test would still pass —
// but if they all vanished, the comment above would be wrong, so name them.
ok(/if \(hostile\) \{ selected = inst\.instanceId;/.test(combat),
  'the positional card key still arms `selected` directly');
ok(/if \(pv\.needsTarget \|\| dragTargetMode === 'all'\) \{ selected = inst\.instanceId;/.test(combat),
  'the drag/flick select still arms `selected` directly');

// ---- the stage is REPAINTED, not merely re-dressed --------------------------
// `syncCardSelection` toggles classes on nodes that already exist. The 1-9
// target keycap is not a class: `renderEnemies` APPENDS it to
// `.combatant-leading` while `targeting` holds, and its renderKey names
// `targeting`, so nothing short of a repaint takes it off again. A disarm that
// only re-dressed left every enemy wearing its number while those same number
// keys had gone back to selecting cards in hand.
ok(/renderCombatantStage\(\);\s*\n\s*syncCardSelection\(\);/.test(beforeDelegation),
  'opening the Armoury repaints the combatant stage BEFORE it re-dresses');
// The store watcher has the same gap and the same fix. It clears `selected` and
// `selfArm` only, so a raised flask still holds `targeting` — which is exactly
// why the repaint decides rather than the call site.
const watchBody = combat.match(/onSelectionChange\(\(lit\) => \{[\s\S]*?\n  \}\);/);
ok(!!watchBody, 'the selection watcher can still be read');
ok(/renderCombatantStage\(\);\s*\n\s*syncCardSelection\(\);/.test(watchBody[0]),
  'the store watcher repaints the combatant stage before it re-dresses');
// And the keycap really is built by the renderer rather than toggled, which is
// the fact both assertions above depend on.
ok(/if \(enemy\.alive && targeting\) \{/.test(combat),
  'the target keycap is still built under `targeting` by renderEnemies');
ok(!/enemy-key/.test(combat.match(/function syncCardSelection\(\)[\s\S]*?\n  \}/)[0]),
  'syncCardSelection still does not touch the keycap, so only a repaint can');

// And the store really does stay silent on an empty clear — the exact reason a
// watcher alone could not carry this.
resetSelection();
const quiet = [];
const releaseQuiet = onSelectionChange((lit) => quiet.push(lit));
clearSelection();
ok(quiet.length === 0,
  'clearSelection() on an ALREADY EMPTY store notifies nobody — so a keyboard-armed card needs the direct clear');
releaseQuiet();
resetSelection();

console.log(`PASS ${checks}/${checks}; combat puts the aim down when the store empties AND when the Armoury opens`);
