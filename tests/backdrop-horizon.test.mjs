import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alternativeCombatComposition, combatSceneryGround, combatStandingGround } from '../src/ui/models/CombatCompositionModel.js';

import { alternativeFormation, fitAlternativeSprites } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';

// Owner (2026-10-11): at 360x620 the battlefield showed only ground, because
// the backdrop camera follows the enemy ground. On the perspective grid the
// enemies' back rank stands high on the floor, so the camera frames a line
// well above the party and the horizon and landmark stay in view.
const fitAt = (width, height, narrow) => {
  const plan = alternativeFormation(combatFormation({ width, height, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
    friends: ['p'], enemies: ['a', 'b', 'c'] }), width, height, narrow);
  const actors = plan.slots.map(slot => ({ slot, side: slot.side, visibleWidth: 60, visibleHeight: 160, leading: 40, ratio: 1, multiplier: 1 }));
  return { actors, fit: alternativeCombatComposition({ actors, sizes: fitAlternativeSprites({ width, height, actors, narrow }), width, height }) };
};

test('the backdrop frames the enemy back rank, high enough to keep the horizon in view', () => {
  for (const [width, height, narrow] of [[360, 267, true], [390, 460, true], [1440, 400, false]]) {
    const { actors, fit } = fitAt(width, height, narrow);
    const framed = combatSceneryGround(fit, actors, 0);
    assert.ok(framed <= height * .6, `camera line at ${framed} of ${height}`);
    assert.equal(framed, combatStandingGround(fit, actors, 0), 'the grid never splits the camera from the standing line');
    assert.ok(fit.every(size => size.sceneryGround === undefined && size.standingGround === undefined));
  }
});

test('the backdrop never frames so low that the back-row feet leave its standing area', () => {
  const art = readFileSync(new URL('../src/ui/alternativeArt.js', import.meta.url), 'utf8');
  assert.match(art, /Math\.min\(ground, standGround \+ \(device\.groundAnchor - standingTop\) \* device\.height \* scale\)/);
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  assert.match(stage, /standGround: combatStandingGround\(sizes, actors, plan\.ground\) \/ zoom/);
});
