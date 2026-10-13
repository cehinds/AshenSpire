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
  return { actors, fit: alternativeCombatComposition({ actors, sizes: fitAlternativeSprites({ width, height, actors, narrow }), width, height, perspectiveGrid: true }) };
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

test('a tablet spacious field frames its backdrop on the enemy ground as before', () => {
  const width = 1024;
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: [330, 300, 280][i] } }));
  const sizes = actors.map((actor, i) => ({ id: actor.slot.id, x: [260, 500, 700][i],
    visibleHeight: 100, scale: 1, multiplier: 1 }));
  const tall = alternativeCombatComposition({ actors, sizes, width, height: 376, handTop: 376 });
  assert.equal(combatSceneryGround(tall, actors, 0), combatStandingGround(tall, actors, 0));
  assert.ok(tall.every(fit => fit.sceneryGround === undefined));
});

// Owner (2026-10-13): desktop and widescreen take the phone's placement, so
// the desktop shared back row and its near-row camera (2026-10-12) are retired.
// A desktop call now frames its camera exactly as a plain call does.
test('a desktop field frames its backdrop on the enemy ground, as the phone does', () => {
  const width = 1280, height = 417;
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 360 } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [260, 560, 900][i], visibleHeight: 200, scale: 1, multiplier: 1 }));
  const plain = alternativeCombatComposition({ actors, sizes, width, height, handTop: height });
  assert.deepEqual(alternativeCombatComposition({ actors, sizes, width, height, handTop: height, desktop: true }), plain);
  assert.equal(plain.some(fit => fit.sceneryGround !== undefined), false, 'no near-row camera on a spacious field');
});
// The desktop horizon share (2026-10-12) is retired: the camera follows the
// enemy ground on every form factor, and the stage passes no horizon share or floor.
test('the stage no longer frames a desktop camera on a horizon share or a standing-area floor', () => {
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  assert.doesNotMatch(stage, /horizonShare|horizonFloor|combatHorizonFloor|DESKTOP_HORIZON_SHARE/);
  const art = readFileSync(new URL('../src/ui/alternativeArt.js', import.meta.url), 'utf8');
  assert.doesNotMatch(art, /horizonCameraGround|desktopHorizonFloor|combatHorizonFloor|horizonShare/);
});

test('the backdrop never frames so low that the back-row feet leave its standing area', () => {
  const art = readFileSync(new URL('../src/ui/alternativeArt.js', import.meta.url), 'utf8');
  assert.match(art, /Math\.min\(ground, standGround \+ \(device\.groundAnchor - standingTop\) \* device\.height \* scale\)/);
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  assert.match(stage, /standGround: combatStandingGround\(sizes, actors, plan\.ground\) \/ zoom/);
});
