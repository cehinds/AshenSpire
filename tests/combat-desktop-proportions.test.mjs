// Desktop and widescreen combat proportions (owner, 2026-10-13: "the ratio for
// battlefield to desktop should be relative"). The bands, hand and horizon are
// the phone's; the sprites follow the battlefield height. Sprite placement on the
// phone grid is NOT applied here: it shrank desktop enemies (see the test below).
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

// The formation grid stays the layout's (narrow = phone, wide = desktop): placing
// desktop enemies on the phone grid shrank them 20% (216 to 173 px at 1920x1080),
// against the owner's "larger sprites". That placement choice is open (see the report).
test('the formation grid still follows the layout mode, as it did before the change', () => {
  assert.match(stageSource, /alternativeFormation\(plan, fieldRect\.width, fieldRect\.height, document\.documentElement\.dataset\.layout === 'narrow'\)/);
});

// The caller, not allocateCombatBands, decides the form factor's bands: combatLayout.js
// must not hand formFactor to allocateCombatBands (it picks the footer art width only).
test('combatLayout.js does not pass formFactor to allocateCombatBands', () => {
  const call = layoutSource.match(/allocateCombatBands\(\{[^}]*\}/);
  assert.ok(call, 'the allocateCombatBands call is in combatLayout.js');
  assert.doesNotMatch(call[0], /\bformFactor\s*[,}:]/, call[0]);
});

// Driven through the real caller: a desktop 1920x1080 window must give the
// battlefield (scene band) the phone's share, not the retired 50% desktop band.
test('the desktop battlefield takes the phone scene band, above the retired 50% share', () => {
  const desktop = planCombatLayout({ formFactor: 'desktop', width: 1920, height: 1080 });
  assert.ok(desktop.battlefield / 1080 > .5, `battlefield share ${desktop.battlefield / 1080}`);
  const phone = planCombatLayout({ formFactor: 'mobile', width: 1920, height: 1080 });
  assert.deepEqual([desktop.hud, desktop.hand], [phone.hud, phone.hand], 'the hud and hand are the phone\'s');
});

// Sprite height follows the battlefield the caller hands it. At 1920x1080 the
// scene band is now the phone's ~55% share, so sprites stand taller than they did
// on the retired 50% desktop band.
test('desktop sprites stand taller in proportion to the larger scene band at 1920x1080', () => {
  const actor = (id, side, height) => ({ id, side, slot: { id, artWidth: 400, depth: 1, ground: height * .75, x: 960 }, ratio: 1, multiplier: 1,
    visibleWidth: 60, visibleHeight: 160, leading: 40, enemyId: 'x' });
  const spriteHeight = (field) => {
    const actors = [actor('p', 'player', field), actor('a', 'enemy', field)];
    return fitAlternativeSprites({ width: 1920, height: field, actors, narrow: false }).find(size => size.id === 'a').visibleHeight;
  };
  const scene = planCombatLayout({ formFactor: 'desktop', width: 1920, height: 1080 }).battlefield;
  const retiredHalf = 1080 * .5;
  const ratio = spriteHeight(scene) / spriteHeight(retiredHalf);
  assert.ok(scene > retiredHalf, `scene ${scene} against the retired 540`);
  assert.ok(Math.abs(ratio - scene / retiredHalf) < .02, `sprite ratio ${ratio} for scene ratio ${scene / retiredHalf}`);
});
