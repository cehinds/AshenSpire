// THE POSITIONAL CARD KEYS (SPEC §7.3, §9 M4): `1`–`9` name hand slots 1–9,
// `q`/`Q` names slot 10, and while a card or flask is armed a digit names the
// Nth LIVING enemy instead. The mapping is cardHotkeyAction in
// src/ui/screens/combat.js — pure, so it is tested here without a DOM — and the
// last block proves (by source match) the keydown handler still goes through it
// with a flask counted as armed and enemies counted living.
//
// NOT CHECKED HERE: what the handler does with a 'select' (affordability,
// hostile-vs-self arming, focus) or a 'target' (playCard/useFlask) — those run
// against a mounted combat screen and live DOM, which this file does not build.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardHotkeyAction } from '../src/ui/screens/combat.js';

let checks = 0;
const eq = (actual, expected, what) => { checks++; assert.deepEqual(actual, expected, what); };

// ---- selection: key N picks hand card N -------------------------------------
for (let n = 1; n <= 9; n++) {
  eq(cardHotkeyAction(String(n), { handSize: 10 }), { kind: 'select', index: n - 1 }, `key ${n} selects hand slot ${n}`);
}
eq(cardHotkeyAction('q', { handSize: 10 }), { kind: 'select', index: 9 }, "'q' selects the 10th card");
eq(cardHotkeyAction('Q', { handSize: 10 }), { kind: 'select', index: 9 }, "'Q' selects the 10th card");

// ---- keys past the hand size do nothing (but are still card keys) -----------
eq(cardHotkeyAction('4', { handSize: 3 }), { kind: 'none' }, 'key 4 with a 3-card hand does nothing');
eq(cardHotkeyAction('3', { handSize: 3 }), { kind: 'select', index: 2 }, 'key 3 with a 3-card hand is the last card');
eq(cardHotkeyAction('9', { handSize: 0 }), { kind: 'none' }, 'any digit with an empty hand does nothing');
eq(cardHotkeyAction('q', { handSize: 9 }), { kind: 'none' }, "'q' with a 9-card hand does nothing");

// ---- targeting: with a hostile card armed, N picks living enemy N -----------
const armed = { targeting: true, handSize: 10, livingEnemies: 3 };
eq(cardHotkeyAction('1', armed), { kind: 'target', index: 0 }, 'armed: key 1 targets the 1st living enemy');
eq(cardHotkeyAction('3', armed), { kind: 'target', index: 2 }, 'armed: key 3 targets the 3rd living enemy');
eq(cardHotkeyAction('4', armed), { kind: 'none' }, 'armed: a key past the living enemies does nothing (no fallback to a hand card)');
eq(cardHotkeyAction('1', { targeting: true, handSize: 10, livingEnemies: 0 }), { kind: 'none' }, 'armed with no living enemy: nothing');
// Q never targets: it still names hand slot 10 while armed.
eq(cardHotkeyAction('q', armed), { kind: 'select', index: 9 }, "armed: 'q' still selects the 10th card, never an enemy");

// ---- not a card key ----------------------------------------------------------
for (const key of ['0', '10', 'w', 'e', 'Enter', ' ', 'Escape', '', 'F1']) {
  eq(cardHotkeyAction(key, { handSize: 10, livingEnemies: 3 }), null, `'${key}' is not a card key`);
  eq(cardHotkeyAction(key, armed), null, `'${key}' is not a card key while armed`);
}

// ---- the handler goes through the mapping ----------------------------------
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const start = source.indexOf('const keyHandler');
const end = source.indexOf("addEventListener('keydown', keyHandler)");
checks++; assert.ok(start >= 0 && end > start, 'combat.js has a keyHandler registered on keydown');
const handler = source.slice(start, end);
checks++; assert.match(handler, /cardHotkeyAction\(ev\.key,/, 'the keydown handler maps card keys through cardHotkeyAction');
checks++; assert.doesNotMatch(handler, /\/\^\[1-9\]\$\//, 'the handler carries no second copy of the digit mapping');
// The handler's inputs to the mapping (source-level, not run): a flask armed
// counts as targeting, and enemies are counted LIVING — the same list the
// 'target' index is read from, so livingEnemies[hotkey.index] is never undefined.
checks++; assert.match(handler, /targeting:\s*Boolean\(selected \|\| selectedFlask != null\)/, 'targeting covers an armed card OR an armed flask');
checks++; assert.match(handler, /const livingEnemies = combat\.enemies\.filter\(\(e\) => e\.alive\);/, 'enemies are counted living');
checks++; assert.match(handler, /livingEnemies:\s*livingEnemies\.length/, 'the mapping is given the living-enemy count');
checks++; assert.match(handler, /livingEnemies\[hotkey\.index\]/, "a 'target' reads the same living list");

console.log(`card-hotkeys: ${checks} checks passed`);
