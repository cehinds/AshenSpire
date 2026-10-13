// Desktop and widescreen combat proportions (owner, 2026-10-13: "the ratio for
// battlefield to desktop should be relative"). The bands, hand and horizon are
// the phone's; the sprites follow the battlefield height. Sprite placement on the
// phone grid is NOT applied here: it shrank desktop enemies (see the test below).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alternativeFormation, fitAlternativeSprites } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { allocateCombatBands } from '../src/ui/models/CombatLayout.js';

const stageSource = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');

const gridFor = (width, height, narrow) => {
  const plan = alternativeFormation(combatFormation({ width, height, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
    friends: ['p'], enemies: ['a', 'b', 'c'] }), width, height, narrow);
  return plan.cells.map(cell => [cell.side, cell.rank, cell.lane, Math.round(cell.ground * 100) / 100]);
};

// The formation grid stays the layout's (narrow = phone, wide = desktop): placing
// desktop enemies on the phone grid shrank them 20% (216 to 173 px at 1920x1080),
// against the owner's "larger sprites". That placement choice is open (see the report).
test('the formation grid still follows the layout mode, as it did before the change', () => {
  assert.match(stageSource, /alternativeFormation\(plan, fieldRect\.width, fieldRect\.height, document\.documentElement\.dataset\.layout === 'narrow'\)/);
});

test('combatant size follows the battlefield height: a taller field stands the figures taller in proportion', () => {
  // Each figure's foot line sits at 75% of the field, as the grid's rows do, so only the field height limits it.
  const actor = (id, side, height) => ({ id, side, slot: { id, artWidth: 400, depth: 1, ground: height * .75, x: 640 }, ratio: 1, multiplier: 1,
    visibleWidth: 60, visibleHeight: 160, leading: 40, enemyId: 'x' });
  const at = (height) => {
    const actors = [actor('p', 'player', height), actor('a', 'enemy', height)];
    return fitAlternativeSprites({ width: 1280, height, actors, narrow: false }).find(size => size.id === 'a').visibleHeight;
  };
  const ratio = at(440) / at(400);
  assert.ok(Math.abs(ratio - 1.1) < .02, `enemy height ratio ${ratio} for a 10% taller field`);
});

test('the desktop battlefield takes the phone scene band, above the retired 50% share', () => {
  const bands = allocateCombatBands({ height: 1000 });
  assert.ok(bands.battlefield / 1000 > .5, `battlefield share ${bands.battlefield / 1000}`);
});
