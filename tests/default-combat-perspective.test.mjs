import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveDisplayAppearance } from '../src/model/displayAppearance.js';
import { alternativeCombatComposition } from '../src/ui/models/CombatCompositionModel.js';

test('regular combat routes the default stage through the approved alternative perspective', () => {
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  // The default (no classicAppearance) resolves to the alternative composition per fit.
  assert.match(stage, /import\s*\{[^}]*\balternativeCombatComposition\b[,}]/);
  assert.match(stage, /const combatComposition = classicAppearance\(\) \? classicCombatComposition : alternativeCombatComposition;/);
  assert.match(stage, /const sizes = combatComposition\(/);
  assert.equal(resolveDisplayAppearance({}), 'alternative');
  // 2026-10-12: the default perspective is a uniform grid; feet stand on the
  // cell anchors (tests/alternative-formation.test.mjs pins the grid).
  const actors = [{ side: 'player', visibleWidth: 60, leading: 40, slot: { id: 'p', x: 65, ground: 400 } },
    { side: 'enemy', visibleWidth: 60, leading: 40, slot: { id: 'e', x: 195, ground: 220 } }];
  const sizes = [{ id: 'p', visibleHeight: 150, scale: 1.5, multiplier: 1 },
    { id: 'e', visibleHeight: 150, scale: 1.5, multiplier: 1 }];
  const fit = alternativeCombatComposition({ actors, sizes, width: 390, height: 460, perspectiveGrid: true });
  assert.deepEqual(fit.map(f => [f.x, f.ground]), [[65, 400], [195, 220]]);
});
