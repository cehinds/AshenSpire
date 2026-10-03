// The two facts this store owns — which card is lit, and how many of its beats
// are spent — used to be two module-level `let`s in cardInspection.js, shared
// by every card on the page, with a DOM class as a second copy and a
// `document.querySelectorAll` sweep reconciling them. Three shipped changes in
// three days broke the tap accounting because that state had no name, no test,
// and no way to be asked a question. This file is the test it never had.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  litCard, beatsSpent, lightCard, countBeat, spendSelectingBeat,
  clearSelection, onSelectionChange, resetSelection,
} from '../src/ui/components/cardSelection.js';

let checks = 0;
const ok = (cond, what) => { checks++; assert.ok(cond, what); };
const eq = (a, b, what) => { checks++; assert.equal(a, b, what); };

// ---- it is headless --------------------------------------------------------
const stripComments = (text) => text
  .split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
const source = stripComments(readFileSync(new URL('../src/ui/components/cardSelection.js', import.meta.url), 'utf8'));
ok(!/\bdocument\b|\bwindow\b|querySelector|classList/.test(source),
  'the store never touches the DOM — that is the whole point of extracting it');
ok(!/^import /m.test(source), 'and it imports nothing');

// ---- nothing is lit to begin with -----------------------------------------
resetSelection();
eq(litCard(), null, 'nothing is lit at rest');
eq(beatsSpent('a'), 0, 'an unlit card has spent nothing');

// ---- lighting a card douses the one before, without a sweep ----------------
let dousedA = 0, dousedB = 0;
lightCard('a', () => { dousedA++; });
eq(litCard(), 'a', 'a is lit');
eq(dousedA, 0, 'lighting a card does not douse it');
lightCard('b', () => { dousedB++; });
eq(litCard(), 'b', 'b is lit');
eq(dousedA, 1, "a was doused by b's arrival — through its own callback");
eq(dousedB, 0, 'b is not doused');
eq(beatsSpent('a'), 0, 'a kept none of its beats');

// ---- re-lighting the lit card keeps its beats ------------------------------
resetSelection();
eq(countBeat('a'), 1, 'the first beat on a card counts 1');
eq(countBeat('a'), 2, 'the second counts 2 — this is the tap that acts');
lightCard('a');
eq(beatsSpent('a'), 2, 're-lighting the card already lit keeps the count');
lightCard('c');
eq(beatsSpent('a'), 0, 'but lighting another card resets it');

// ---- a beat on an unlit card lights it, so no tap is lost ------------------
resetSelection();
eq(countBeat('fresh'), 1, 'a beat on an unlit card counts as its first');
eq(litCard(), 'fresh', 'and lights it — a tap is never lost between the two facts');

// ---- reading spends the selecting beat without counting a new one ----------
resetSelection();
lightCard('r');
eq(spendSelectingBeat('r'), 1, 'reading a lit card spends its selecting beat');
eq(spendSelectingBeat('r'), 1, 'and spending twice does not inflate the count');
eq(countBeat('r'), 2, 'so the next tap on the face is the second beat — the act');

resetSelection();
eq(countBeat('r2'), 1, 'a card tapped once has spent one beat');
eq(spendSelectingBeat('r2'), 1, 'reading it does not reset that to zero');
eq(countBeat('r2'), 2, 'which is the regression this store exists to make untestable-by-accident');

// ---- clearing runs the douse and empties the store -------------------------
resetSelection();
let doused = 0;
lightCard('x', () => { doused++; });
clearSelection();
eq(litCard(), null, 'clearing empties the store');
eq(doused, 1, 'and puts the card out');
clearSelection();
eq(doused, 1, 'clearing an empty store douses nothing');

// ---- watchers see every change, and can leave ------------------------------
resetSelection();
const seen = [];
const stop = onSelectionChange((id) => seen.push(id));
lightCard('p');
lightCard('q');
clearSelection();
assert.deepEqual(seen, ['p', 'q', null], 'a watcher sees each change in order');
checks++;
stop();
lightCard('z');
assert.deepEqual(seen, ['p', 'q', null], 'and stops seeing them after it leaves');
checks++;

// ---- one watcher failing never takes the store down ------------------------
resetSelection();
let reached = false;
onSelectionChange(() => { throw new Error('a watcher blew up'); });
onSelectionChange(() => { reached = true; });
assert.doesNotThrow(() => lightCard('safe'), "a watcher's failure is not the store's");
checks++;
ok(reached, 'and the watchers after it still run');

// ---- the globals are gone from the component -------------------------------
const inspection = stripComments(
  readFileSync(new URL('../src/ui/components/cardInspection.js', import.meta.url), 'utf8'));
// The forbidden thing is MODULE-SCOPE MUTABLE STATE, not the name: the click
// handler still reads the count into a local `const touchTaps` and should.
ok(!/^let (touchedIdentity|touchTaps)\b/m.test(inspection),
  'cardInspection holds no module-level tap state of its own');
ok(!/\btouchedIdentity\b/.test(inspection),
  'and the identity global is gone entirely — the store keys on it now');
ok(!/querySelectorAll\('\.inspection-selected'\)/.test(inspection),
  'and no longer sweeps the document to find what to deselect');

resetSelection();
console.log(`PASS ${checks}/${checks}; the card selection store owns what two module globals used to`);
