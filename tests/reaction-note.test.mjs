// THE "NO REACTION: WHY" NOTE (owner, 2026-10-11; ui/components/reactionNote.js).
// When a Counter or Sweep in hand could not be offered, a toast above the
// Reaction switch says why, in the combat log's own words, for the local seat
// only; the newest replaces the last; it is polite and never takes a click.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { latestReactionNote, createReactionNote, avoidRects, REACTION_NOTE_MS } from '../src/ui/components/reactionNote.js';
import { combatLogEntries } from '../src/model/combatLog.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = {
  cards: new Map([['counter', { name: 'Counter', cardTags: [] }], ['sweep', { name: 'Sweep', cardTags: ['maneuver:sweep'] }]]),
  enemies: new Map([['wolf', { name: 'Ash Wolf' }]]),
};
const enemies = [{ id: 'e1', enemyId: 'wolf' }];
const notCovered = { type: 'combatReactionUnavailable', ownerId: 'player', sourceId: 'e1', reason: 'notCovered', cardId: 'counter', attackKind: 'sweep' };
const cost = { type: 'combatReactionUnavailable', ownerId: 'player', sourceId: 'e1', reason: 'cost', cardId: 'sweep', resource: 'stamina', need: 1, have: 0 };

test('the note uses the combat log\'s own wording', () => {
  for (const event of [notCovered, cost, { ...notCovered, reason: 'alreadyAnswered' }, { ...notCovered, reason: 'attackerStaggered' }]) {
    const note = latestReactionNote([event], { registries, enemies });
    const [row] = combatLogEntries([event], { registries, players: [{ id: 'player', name: 'Ash' }], enemies });
    assert.equal(note.text, row.text, `${event.reason}: the same line as the log`);
  }
  assert.equal(latestReactionNote([notCovered], { registries, enemies }).text, "No reaction: Counter can't answer a Sweep.");
  assert.equal(latestReactionNote([cost], { registries, enemies }).text, 'Not enough SP to Sweep (need 1, have 0).');
});

test('only the local seat\'s note, the newest, and only after the last one shown', () => {
  const events = [{ ...cost, ownerId: 'seatA' }, { type: 'damageDealt' }, { ...notCovered, ownerId: 'seatB' }];
  const isLocal = (id) => id === 'seatA';
  const note = latestReactionNote(events, { isLocal, registries, enemies });
  assert.equal(note.index, 0, 'the teammate\'s note is not shown here');
  assert.equal(note.text, 'Not enough SP to Sweep (need 1, have 0).', 'co-op shows no seat prefix to its own seat');
  assert.equal(latestReactionNote(events, { after: 0, isLocal, registries, enemies }), null, 'an old note is not shown twice');
  assert.equal(latestReactionNote([cost, notCovered], { registries, enemies }).index, 1, 'the newest wins');
});

test('the toast: one at a time, polite, gone after its life, survives a re-render', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom((dom) => {
    const host = dom.document.createElement('div');
    const toggle = dom.document.createElement('button');
    toggle.className = 'reaction-switch';
    host.append(toggle);
    const note = createReactionNote();
    note.attach(host);
    note.show('first');
    note.show('second');
    const shown = host.children.filter((node) => /\breaction-note\b/.test(String(node.className)));
    assert.equal(shown.length, 1, 'the newest replaces the last');
    assert.equal(shown[0].textContent, 'second');
    assert.equal(shown[0].getAttribute('aria-live'), 'polite');
    assert.equal(shown[0].getAttribute('role'), 'status');
    t.mock.timers.tick(1000);
    const rebuilt = dom.document.createElement('div');
    note.attach(rebuilt);
    assert.equal(note.node?.parentNode, rebuilt, 'a rebuilt screen gets the same note back while it has time left');
    t.mock.timers.tick(REACTION_NOTE_MS - 1000);
    assert.equal(note.node, null, 'gone after ~2.5 s');
    assert.equal(rebuilt.children.length, 0);
  });
});

test('the toast never takes a click', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, /\.reaction-note \{[^}]*pointer-events:none/s);
});

test('the note moves up off the hero\'s HP readout (phone, owner 2026-10-11)', () => {
  const note = { left: 120, top: 470, width: 260, height: 28 };
  const hpBar = { left: 36, top: 475, width: 112, height: 29 };
  assert.deepEqual(avoidRects(note, [hpBar], 6), { ...note, top: 475 - 6 - 28 }, 'bottom sits 6px above the HP bar');
  const clear = { left: 0, top: 600, width: 50, height: 20 };
  assert.deepEqual(avoidRects(note, [clear], 6), note, 'nothing overlapped: unchanged');
  const plate = { left: 300, top: 460, width: 40, height: 20 };
  assert.equal(avoidRects(note, [hpBar, plate], 6).top, 460 - 6 - 28, 'the highest overlapping rect wins');
  const above = { left: 200, top: 430, width: 40, height: 20 };
  assert.equal(avoidRects(note, [hpBar, above], 6).top, 430 - 6 - 28, 'a rect it meets after moving pushes it further');
  assert.deepEqual(avoidRects(note, [{ left: 0, top: 0, width: 0, height: 0 }], 6), note, 'a hidden (zero) rect is ignored');
});

test('place() avoids the hero\'s mini HUD', () => {
  const source = readFileSync(new URL('../src/ui/components/reactionNote.js', import.meta.url), 'utf8');
  assert.match(source, /AVOID_SELECTOR = '\.combatant\.player \.combatant-mini-hud'/);
  assert.match(source, /avoidRects\(\{ left: right - width, top: bottom - height, width, height \}, avoid, 6\)/);
});

test('unaffordable automatic range return explains kept defense only to its owning seat', () => {
  const event = { type: 'combatRangeReturnUnavailable', sourceId: 'seatA', ownerId: 'seatA', targetId: 'e1', required: 2, available: 1, advanceSp: 2, reason: 'stamina', defenseKept: true };
  const note = latestReactionNote([event], { isLocal: id => id === 'seatA', registries, enemies });
  assert.equal(note.text, 'Counter return skipped: not enough SP to Advance (need 2, have 1). Defense kept.');
  assert.equal(latestReactionNote([event], { isLocal: id => id === 'seatB', registries, enemies }), null);
  const [row] = combatLogEntries([event], { registries, players: [{ id: 'seatA', name: 'Ash' }], enemies });
  assert.equal(row.text, note.text, 'toast and durable log agree');
});

test('an unaffordable automatic hostile action uses distinct catalog wording in the local note and log', () => {
  const event = { type: 'combatRangeActionUnavailable', sourceId: 'player', ownerId: 'player', targetId: 'e1', required: 2, available: 1, advanceSp: 2, reason: 'stamina', triggerKey: 'relic:starterMedallion' };
  const note = latestReactionNote([event], { registries, enemies });
  assert.equal(note.text, 'Automatic action skipped: not enough SP to Advance (need 2, have 1).');
  assert.doesNotMatch(note.text, /Counter|Defense kept/);
  assert.equal(latestReactionNote([event], { isLocal: () => false, registries, enemies }), null);
  const [row] = combatLogEntries([event], { registries, enemies });
  assert.equal(row.text, note.text);
  const [unreachable] = combatLogEntries([{ ...event, reason: 'range' }], { registries, enemies });
  assert.equal(unreachable.text, 'Automatic action skipped: out of range.');
});
