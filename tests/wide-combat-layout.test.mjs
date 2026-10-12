// Desktop and widescreen form factors (the owner's wide-screen combat layout):
// three enemies stand on the back row, spread apart and clear of the player,
// the hand band is taller and the footer shorter. Phones and tablets keep the
// established geometry, so the wide rules are gated by the form factor alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeCombatComposition } from '../src/ui/models/CombatCompositionModel.js';
import { fitAlternativeSprites } from '../src/ui/models/AlternativeFormationModel.js';
import { isWideFormFactor, WIDE_FORM_FACTORS } from '../src/ui/models/FormFactorModel.js';
import { uiConfig } from '../src/config/generated/ui.js';

test('only desktop and widescreen are wide form factors', () => {
  assert.deepEqual([...WIDE_FORM_FACTORS], ['desktop', 'widescreen']);
  assert.equal(isWideFormFactor('desktop'), true);
  assert.equal(isWideFormFactor('widescreen'), true);
  assert.equal(isWideFormFactor('tablet'), false);
  assert.equal(isWideFormFactor('mobile'), false);
  assert.equal(isWideFormFactor(undefined), false);
});

test('wide band shares sum to 100 and give the hand more than the default', () => {
  const wide = uiConfig.scenes.w4a.sizing.wideBands;
  assert.equal(wide.hud + wide.scene + wide.context + wide.footer, 100);
  assert.ok(wide.context > uiConfig.scenes.w4a.sizing.bands.context);
  assert.ok(wide.footer < uiConfig.scenes.w4a.sizing.bands.footer + 10);
  assert.ok(uiConfig.presentation.footerLayout.sizing.wideMaximumWidthPx
    < uiConfig.presentation.footerLayout.sizing.maximumWidthPx);
});

function fight(enemyCount, width = 1293, height = 300) {
  const player = { slot: { id: 'p', cell: 'A1', x: width * .3, ground: height * .9, fitGround: height * .9, depth: 1, row: 1, column: 0, side: 'player' },
    side: 'player', ratio: 1, multiplier: 1, leading: 20, visibleWidth: 90, visibleHeight: 200, boxHeight: 200, footOffset: 0, enemyId: 'reaver' };
  const enemies = Array.from({ length: enemyCount }, (_, i) => ({
    slot: { id: `e${i}`, cell: 'A4', x: width * .8, ground: height * .8, fitGround: height * .8, depth: 1, row: i % 2, column: i % 2, side: 'enemy' },
    side: 'enemy', ratio: .9, multiplier: 1, leading: 30, visibleWidth: 110, visibleHeight: 150, boxHeight: 150, footOffset: 0, enemyId: 'bloodHound' }));
  return [player, ...enemies];
}

for (const count of [1, 2, 3]) {
  test(`wide fight with ${count} enemy/enemies: enemies clear the player and each other`, () => {
    const width = 1293, height = 300;
    const actors = fight(count, width, height);
    const sizes = fitAlternativeSprites({ width, height, actors, narrow: false });
    const fits = alternativeCombatComposition({ sizes, actors, width, height, handLeft: width * .35, solo: count === 1, wide: true });
    const byId = new Map(fits.map(fit => [fit.id, fit]));
    const half = id => {
      const actor = actors.find(a => a.slot.id === id);
      return actor.visibleWidth * byId.get(id).scale / 2;
    };
    const player = fits.find(fit => fit.id === 'p');
    const enemies = actors.filter(a => a.side === 'enemy').map(a => byId.get(a.slot.id));
    for (const enemy of enemies) {
      assert.ok(enemy.x > player.x, `enemy ${enemy.id} must stand beyond the player's centre line`);
      assert.ok(enemy.ground < height, 'enemy stands on the field');
    }
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      const gap = Math.abs(a.x - b.x) - (half(a.id) + half(b.id));
      assert.ok(gap >= -1, `enemies ${a.id} and ${b.id} overlap by ${-gap}px`);
    }
  });
}
