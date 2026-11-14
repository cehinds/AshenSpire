// End Turn commits on ONE activation, whether or not a card is still playable
// (owner, 2026-11-14, Wave 2). It was a hold while a card was playable
// (2026-10-18) and before that always a hold (2026-08-17); the warning now
// lives on the button (`end-turn--cards-left`) instead of in a second beat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beatFor, enumerateBeats, assertTableSane } from '../src/model/secondbeat.js';

test('the endTurn row: no beat at either edge, and the playable fact still fails by name when omitted', () => {
  assert.equal(beatFor('endTurn', { playable: true }).form, 'none');
  assert.equal(beatFor('endTurn', { playable: true }).tap, true);
  assert.equal(beatFor('endTurn', { playable: false }).form, 'none');
  assert.throws(() => beatFor('endTurn'), /playable/, 'an omitted fact fails by name, never resolves to a default');
  assert.throws(() => beatFor('endTurn', {}), /playable/, 'and so does an empty context');
  // The recorded stakes still move with the hand (audit record), fail-open as before.
  assert.equal(beatFor('endTurn', { playable: true }).stakes, 'turn');
  assert.equal(beatFor('endTurn', { playable: false }).stakes, 'nothing');
  for (const playable of [undefined, null, 0, '', 'no']) assert.equal(beatFor('endTurn', { playable }).stakes, 'turn');
});

test('the endTurn row is enumerated at both edges and the table is sane', () => {
  const cells = enumerateBeats().filter((r) => r.id === 'endTurn');
  assert.deepEqual(cells.map((r) => [r.ctx.playable, r.form]).sort(), [[false, 'none'], [true, 'none']]);
  assert.deepEqual(assertTableSane(), []);
});

test('combat.js arms End Turn with a live ctx read from the same fact as the pulse', () => {
  const src = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(src, /arm\(\$\('\.end-turn'\), 'endTurn', \{\s*ctx: \(\) => \(\{ playable: endTurnHasPlayableCard\(\) \}\)/);
  assert.match(src, /classList\.toggle\('end-turn--cards-left', cardsLeft\)/, 'the warning state is drawn from the same card-only fact');
  assert.doesNotMatch(src, /confirmLabel: 'END TURN'/, 'and no review is wired');
  assert.match(src, /const hasPlayable = endTurnHasPlayable\(\);\s*\$\('\.end-turn'\)\.classList\.toggle\('pulse', hasPlayable\)/);
});

test('the End Turn beat is card-only: a control-recovery action does not count as a playable card', () => {
  const src = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const cardOnly = src.match(/function endTurnHasPlayableCard\(\) \{([\s\S]*?)\n  \}\n/)?.[1] || '';
  assert.ok(cardOnly.includes('combat.piles.hand.some'), 'it reads the hand');
  assert.ok(!/recoveryControls/.test(cardOnly), 'and nothing broader than the hand');
  assert.match(src, /function endTurnHasPlayable\(\) \{\s*return endTurnHasPlayableCard\(\) \|\| combat\.combatExpansionVersion === 2 && recoveryControls\(/, 'the pulse keeps the broader fact');
});
