// Review follow-up on #1815: every alive foe keeps a working target (placed, or
// explicitly hidden with its sprite still targetable); the co-op nameplate reads
// the real seat ledger row; the footer aria text is spaced; and a refused HUD
// retry never leaves its reservation for the tracking pass to reapply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enemyTargetGrid } from '../src/ui/models/EnemyTargetGridModel.js';
import { alternativeEnemyTargetGrid } from '../src/ui/models/AlternativeEnemyTargetGridModel.js';
import { characterLevel, levelOf } from '../src/model/levelup.js';
import { packCombatTargetsWithHud } from '../src/ui/components/battlefieldStage.js';

const overlaps = (a, b) => a.left < b.left + b.width && a.left + a.width > b.left
  && a.top < b.top + b.height && a.top + a.height > b.top;
const picker = readFileSync(new URL('../src/ui/components/enemyTargetPicker.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
const coop = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/ui/components/footerArt.js', import.meta.url), 'utf8');

// Crowded narrow phone: a player/intent band above and cards below leave one
// free strip in the middle, with four foes to place.
const crowded = {
  width: 320, height: 200,
  hardObstacles: [{ left: 0, top: 0, width: 320, height: 70 }, { left: 0, top: 150, width: 320, height: 50 }],
};
const foes = n => Array.from({ length: n }, (_, index) => ({ id: `e${index}`, x: 180, y: 110 }));

for (const [label, grid] of [['Classic', enemyTargetGrid], ['Alternative', alternativeEnemyTargetGrid]]) {
  test(`${label} grid places all four crowded foes on non-overlapping cells of at least 44px`, () => {
    const targets = foes(4);
    const placements = grid({ ...crowded, targets });
    assert.equal(placements.length, targets.length, 'no silent gap: every foe gets a cell');
    assert.deepEqual(placements.map(p => p.id).sort(), targets.map(t => t.id).sort());
    for (const [index, slot] of placements.entries()) {
      assert.ok(slot.width >= 44 && slot.width === slot.height);
      assert.ok(!crowded.hardObstacles.some(rect => overlaps(slot, rect)));
      assert.ok(!placements.slice(index + 1).some(other => overlaps(slot, other)));
    }
  });

  test(`${label} grid returns no stale cell for foes it cannot fit (picker hides them)`, () => {
    // Only a 10px strip is free: no cell fits, so the grid reports fewer placements.
    const impossible = { width: 320, height: 200, hardObstacles: [
      { left: 0, top: 0, width: 320, height: 120 }, { left: 0, top: 130, width: 320, height: 70 }] };
    const placements = grid({ ...impossible, targets: foes(4) });
    assert.ok(placements.length < 4);
    for (const p of placements) assert.ok(p.width >= 44 && !impossible.hardObstacles.some(rect => overlaps(p, rect)));
  });
}

test('picker hides any button the grid did not place and unhides placed ones', () => {
  assert.match(picker, /button\.hidden = !placed\.has\(button\.dataset\.eid\);/);
  assert.match(picker, /const placed = new Set\(placements\.map\(placement => placement\.id\)\);/);
  assert.match(css, /\.enemy-target-button\[hidden\] \{ display: none; \}/);
});

test('co-op nameplate level reads the real seat ledger row (memberView sends level as a row)', () => {
  assert.match(coop, /characterLevel\(\{ level: m\.level \}\)/);
  const row = { ...levelOf({}), level: 4, xp: 120 };
  assert.equal(characterLevel({ level: row }), 4);
  assert.equal(characterLevel({ level: null }), 1);
});

test('footer compact label aria separates "end" and "discard" with a space', () => {
  assert.match(footer, /, discard: `\$\{t\('combat\.discard'\)\}/);
  assert.doesNotMatch(footer, /,discard:/);
});

test('refused HUD retry clears the settled reservation; accepted retry keeps it', () => {
  const core = { id: 'e0', left: 0, right: 44, top: 0, bottom: 44 };
  const obstructed = [{ id: 'e0', obstructed: true }];
  const clear = [{ id: 'e0', obstructed: false }];
  // Retry still obstructed: original layout returned and nothing stays reserved.
  const refusedCores = [core];
  const hudCalls = [];
  const refused = packCombatTargetsWithHud({
    pack: () => obstructed, placeHud: c => hudCalls.push(c), targetCores: refusedCores,
  });
  assert.deepEqual(refused, obstructed);
  assert.deepEqual(refusedCores, [], 'refused reservation must not be reapplied by the tracking pass');
  assert.deepEqual(hudCalls.at(-1), []);
  // Retry clears the obstruction: accepted, reservation kept.
  const keptCores = [core];
  let calls = 0;
  const accepted = packCombatTargetsWithHud({
    pack: () => (calls++ === 0 ? obstructed : clear), placeHud: () => {}, targetCores: keptCores,
  });
  assert.deepEqual(accepted, clear);
  assert.deepEqual(keptCores, [core]);
});
