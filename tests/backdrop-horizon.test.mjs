import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alternativeCombatComposition, combatSceneryGround, combatStandingGround } from '../src/ui/models/CombatCompositionModel.js';

// Owner (2026-10-11): at 360x620 the battlefield showed only ground. Moving
// short-portrait enemies back (0ec3cf026) also moved the backdrop camera,
// which follows the enemy ground, so the horizon and landmark left the field.
const height = 267, width = 360;
const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
  visibleWidth: 60, leading: 40, slot: { id, ground: 240 } }));
const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [80, 220, 300][i], visibleHeight: 80, scale: 1, multiplier: 1 }));

test('a short portrait field frames its backdrop on the near row while its enemies stand back', () => {
  const fit = alternativeCombatComposition({ actors, sizes, width, height, handTop: height });
  const nearRow = 240 - height * .07;
  assert.ok(Math.abs(combatSceneryGround(fit, actors, 0) - nearRow) < 1e-9, 'camera keeps the pre-0ec3cf026 framing');
  assert.ok(combatStandingGround(fit, actors, 0) <= height * .6, 'enemies stay on the back row');
  assert.ok(combatStandingGround(fit, actors, 0) < combatSceneryGround(fit, actors, 0) - 40);
});

test('a spacious field frames its backdrop on the enemy ground as before', () => {
  const tall = alternativeCombatComposition({ actors, sizes, width, height: 376, handTop: 376 });
  assert.equal(combatSceneryGround(tall, actors, 0), combatStandingGround(tall, actors, 0));
  assert.ok(tall.every(fit => fit.sceneryGround === undefined));
});

test('the backdrop never frames so low that the back-row feet leave its standing area', () => {
  const art = readFileSync(new URL('../src/ui/alternativeArt.js', import.meta.url), 'utf8');
  assert.match(art, /Math\.min\(ground, standGround \+ \(device\.groundAnchor - standingTop\) \* device\.height \* scale\)/);
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  assert.match(stage, /standGround: combatStandingGround\(sizes, actors, plan\.ground\) \/ zoom/);
});
