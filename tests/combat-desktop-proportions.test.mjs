// Responsive combat keeps shared 6/53/27/14 bands. The formation camera
// receives the live form factor so each native cell profile fits its artwork.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alternativeFormation, fitAlternativeSprites } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { planCombatLayout } from './helpers/combat-layout-plan.mjs';

const stageSource = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../src/ui/components/combatLayout.js', import.meta.url), 'utf8');

const gridFor = (width, height, narrow) => {
  const plan = alternativeFormation(combatFormation({ width, height, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
    friends: ['p'], enemies: ['a', 'b', 'c'] }), width, height, narrow);
  return plan.cells.map(cell => [cell.side, cell.rank, cell.lane, Math.round(cell.ground * 100) / 100]);
};

// The grid still receives the layout flag, plus the explicit camera profile.
test('the formation grid still follows the layout mode, as it did before the change', () => {
  assert.match(stageSource, /alternativeFormation\(plan, fieldRect\.width, fieldRect\.height, document\.documentElement\.dataset\.layout === 'narrow', \{ \.\.\.presentation, formFactor: document\.documentElement\.dataset\.formFactor \}\)/);
});

// The caller, not allocateCombatBands, decides the form factor's bands: combatLayout.js
// must not hand formFactor to allocateCombatBands (it picks the footer art width only).
test('combatLayout.js does not pass formFactor to allocateCombatBands', () => {
  const call = layoutSource.match(/allocateCombatBands\(\{[^}]*\}/);
  assert.ok(call, 'the allocateCombatBands call is in combatLayout.js');
  assert.doesNotMatch(call[0], /\bformFactor\s*[,}:]/, call[0]);
});

// Exercise the real caller so a separate desktop band table cannot return.
test('the desktop battlefield keeps the approved 53% share and the common hand bands', () => {
  const desktop = planCombatLayout({ formFactor: 'desktop', width: 1920, height: 1080 });
  assert.ok(Math.abs(desktop.battlefield / 1080 - .53) < 1e-9, `battlefield share ${desktop.battlefield / 1080}`);
  const phone = planCombatLayout({ formFactor: 'mobile', width: 1920, height: 1080 });
  assert.deepEqual([desktop.hud, desktop.hand], [phone.hud, phone.hand], 'the hud and hand are the phone\'s');
});

// With the same available cell, body height responds proportionally to scene space.
test('desktop sprite height tracks available scene space without inflating the approved band', () => {
  const actor = (id, side, height) => ({ id, side, slot: { id, artWidth: 400, depth: 1, ground: height * .75, x: 960 }, ratio: 1, multiplier: 1,
    visibleWidth: 60, visibleHeight: 160, leading: 40, enemyId: 'x' });
  const spriteHeight = (field) => {
    const actors = [actor('p', 'player', field), actor('a', 'enemy', field)];
    return fitAlternativeSprites({ width: 1920, height: field, actors, narrow: false }).find(size => size.id === 'a').visibleHeight;
  };
  const scene = planCombatLayout({ formFactor: 'desktop', width: 1920, height: 1080 }).battlefield;
  const retiredHalf = 1080 * .5;
  const ratio = spriteHeight(scene) / spriteHeight(retiredHalf);
  assert.ok(Math.abs(scene - 1080 * .53) < 1e-9, 'approved scene share is independent of the retired layout');
  assert.ok(Math.abs(ratio - scene / retiredHalf) < .02, `sprite ratio ${ratio} for scene ratio ${scene / retiredHalf}`);
});
