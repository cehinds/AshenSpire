// End Turn is a single tap when no card is playable; the configured second beat
// stays while a card is still affordable (owner, 2026-10-18). It was ruled
// state-independent on 2026-08-17; the spent hand is now the exception.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beatFor, enumerateBeats, assertTableSane } from '../src/model/secondbeat.js';

test('the endTurn row: a hold while a card is playable, none once the hand is spent', () => {
  assert.equal(beatFor('endTurn', { playable: true }).form, 'hold');
  assert.equal(beatFor('endTurn', { playable: false }).form, 'none');
  assert.throws(() => beatFor('endTurn'), /playable/, 'an omitted fact fails by name, never resolves to a default');
  assert.throws(() => beatFor('endTurn', {}), /playable/, 'and so does an empty context');
  // Fail-open: only an explicit false takes the beat off.
  for (const playable of [undefined, null, 0, '', 'no']) {
    assert.equal(beatFor('endTurn', { playable }).form, 'hold', `playable ${JSON.stringify(playable)} keeps the hold`);
  }
});

test('the endTurn row is enumerated at both edges and the table is sane', () => {
  const cells = enumerateBeats().filter((r) => r.id === 'endTurn');
  assert.deepEqual(cells.map((r) => [r.ctx.playable, r.form]).sort(), [[false, 'none'], [true, 'hold']]);
  assert.deepEqual(assertTableSane(), []);
});

test('combat.js arms End Turn with a live ctx read from the same fact as the pulse', () => {
  const src = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(src, /arm\(\$\('\.end-turn'\), 'endTurn', \{\s*ctx: \(\) => \(\{ playable: endTurnHasPlayable\(\) \}\)/);
  assert.match(src, /const hasPlayable = endTurnHasPlayable\(\);\s*\$\('\.end-turn'\)\.classList\.toggle\('pulse', hasPlayable\)/);
});
