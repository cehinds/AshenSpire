import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveDisplayAppearance } from '../src/model/displayAppearance.js';
import { alternativeCombatComposition } from '../src/ui/models/CombatCompositionModel.js';

test('regular combat routes the default stage through the approved alternative perspective', () => {
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  assert.match(stage, /import\s*\{\s*alternativeCombatComposition as combatComposition[,}]/);
  assert.match(stage, /const sizes = combatComposition\(/);
  assert.equal(resolveDisplayAppearance({}), 'alternative');
  const actors = [{ side: 'player', visibleWidth: 60, leading: 40, slot: { id: 'p', ground: 300 } },
    { side: 'enemy', visibleWidth: 60, leading: 40, slot: { id: 'e', ground: 300 } }];
  const sizes = [{ id: 'p', x: 80, visibleHeight: 150, scale: 1.5, multiplier: 1 },
    { id: 'e', x: 270, visibleHeight: 150, scale: 1.5, multiplier: 1 }];
  const fit = alternativeCombatComposition({ actors, sizes, width: 390, height: 400, handTop: 440 });
  assert.equal(fit[0].visibleHeight, 192);
  // 2a54a780: the solo player's feet rest on the battlefield edge just above
  // the card band (handTop - 26), not half its height behind the cards.
  assert.equal(fit[0].ground, 440 - 26);
  // A spacious (>300px) field keeps enemy stature and centers them at .66
  // (tests/alternative-composition.test.mjs pins the same formation).
  assert.equal(fit[1].x, 390 * .66);
  assert.equal(fit[1].visibleHeight, 150);
});
