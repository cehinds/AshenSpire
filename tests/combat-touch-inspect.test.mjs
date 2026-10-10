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

// Enemy name (#1785, regressed by #1787): with nothing armed, a centre tap or
// Enter/Space on the name opens the full read; the frame's left core selects.
// docs/combat-target-pointer-behavior.md; the aria-label promises the read.
const nameAt = combat.indexOf("const openThisRead = (event) => {");
check(() => assert.ok(nameAt >= 0, 'the enemy-name handler exists'));
const nameHandler = combat.slice(nameAt, combat.indexOf('};', nameAt));
check(() => assert.match(nameHandler, /if \(selected\) playCard\(selected, enemy\.id\);\s*else if \(selectedFlask != null\) useFlask\(selectedFlask, enemy\.id\);\s*else openCombatantDoor\(combatantSubject\('enemy', enemy\), nm\);/));
check(() => assert.doesNotMatch(nameHandler, /selectCombatant/, 'the name must not merely select (core does that)'));
check(() => assert.match(combat, /nm\.setAttribute\('aria-label', `\$\{def\.name\} — the full read`\)/));
check(() => assert.match(combat, /nm\.addEventListener\('click', openThisRead\);/));
check(() => assert.match(combat, /nm\.addEventListener\('keydown', \(event\) => \{\s*if \(event\.key !== 'Enter' && event\.key !== ' '\) return;\s*event\.preventDefault\(\);\s*openThisRead\(event\);/));
// The frame (left core) click still selects when unarmed.
check(() => assert.match(combat, /else if \(selectedFlask != null\) useFlask\(selectedFlask, enemy\.id\);\s*else if \(!selfArm\) \{\s*selectCombatant\(enemy\.id\);/));

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

console.log(`PASS ${checks}/${checks}; combat inspection opens from the overhead Information control, one tap on desktop, select-then-open on touch; enemy name opens the full read, core selects`);
