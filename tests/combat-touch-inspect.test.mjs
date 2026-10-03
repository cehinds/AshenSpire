// Combat inspection on touch. The full read (openCombatantDoor) used to hang
// off an "Inspect" action inside the combatant's interactive tooltip. It is now
// the overhead Information control (WCO1: Inspect above the intent;
// docs/component-catalog.html `combatant-frame`: "Touch selects before delayed
// help; a second Information tap opens inspection"), built by
// combatantOverhead.combatantInfo and wired by combat.js for the player and
// every living enemy. The old sprite-overlaid combatantInspectControl stays gone.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rewardDom } from './helpers/reward-dom.mjs';
import { combatantInfo } from '../src/ui/components/combatantOverhead.js';

const combat = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
let checks = 0;
const check = (fn) => { fn(); checks++; };

// Wiring: both roles reach the door through the Information control, with the
// control itself as the opener so focus returns to it.
check(() => assert.doesNotMatch(combat, /function combatantInspectControl/));
check(() => assert.match(combat, /combatantInfo\(combatantSubject\('player', p\)\.name, opener => openCombatantDoor\(combatantSubject\('player', p\), opener\)\)/));
check(() => assert.match(combat, /if \(enemy\.alive\) leading\.push\(combatantInfo\(def\.name, opener => openCombatantDoor\(combatantSubject\('enemy', enemy\), opener\)\)/));

// Behaviour of the control itself.
const dom = rewardDom();
const extra = { MutationObserver: class { observe() {} disconnect() {} } };
const saved = Object.fromEntries([...Object.keys(dom), ...Object.keys(extra)].map((key) => [key, globalThis[key]]));
Object.assign(globalThis, dom, extra);
try {
  const opened = [];
  const info = combatantInfo('Bell Keeper', (opener) => opened.push(opener));
  document.body.appendChild(info);
  const click = (pointerType) => info.dispatchEvent(new Event('click', { bubbles: true, pointerType }));

  check(() => assert.equal(info.tagName, 'BUTTON'));
  check(() => assert.equal(info.getAttribute('aria-label'), 'Inspect Bell Keeper'));
  check(() => assert.equal(info.getAttribute('aria-haspopup'), 'dialog'));

  // Mouse or keyboard activation opens the full read at once.
  click('mouse');
  check(() => assert.deepEqual(opened, [info]));

  // Touch: the first tap only selects (and queues the glance); the second
  // tap on the same control opens the full read.
  click('touch');
  check(() => assert.equal(opened.length, 1, 'first touch tap must not open the door'));
  check(() => assert.ok(info.classList.contains('tooltip-selected'), 'first touch tap selects the control'));
  click('touch');
  check(() => assert.deepEqual(opened, [info, info], 'second touch tap opens the door'));
  check(() => assert.ok(!info.classList.contains('tooltip-selected'), 'opening clears the selection'));
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
}

console.log(`PASS ${checks}/${checks}; combat inspection opens from the overhead Information control, one tap on desktop, select-then-open on touch`);
