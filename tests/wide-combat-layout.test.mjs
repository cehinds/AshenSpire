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

// The footer must never grow on a wide screen: at every window height the
// wide footer is no taller than the base footer. The design height (730 local
// px) is fitted by the zoom, so a taller window only zooms the same layout.
import { allocateCombatBands, combatBandConfig } from '../src/ui/models/CombatLayout.js';
import { footerArtHeight } from '../src/ui/models/FooterLayoutModel.js';

for (const windowHeight of [720, 1080, 1440, 2160]) {
  test(`wide footer is never taller than the base footer at a ${windowHeight}px window`, () => {
    const zoom = windowHeight / 730, localHeight = 730, width = 1920 / zoom;
    const base = allocateCombatBands({ width, height: localHeight, zoom, footerArtPx: footerArtHeight(width, zoom, false) * zoom }, combatBandConfig(false));
    const wide = allocateCombatBands({ width, height: localHeight, zoom, footerArtPx: footerArtHeight(width, zoom, true) * zoom }, combatBandConfig(true));
    assert.ok(wide.footer * zoom <= base.footer * zoom + .5,
      `wide footer ${wide.footer * zoom}px vs base ${base.footer * zoom}px`);
    assert.ok(wide.hand > base.hand, 'the hand band is taller on a wide screen');
  });
}

// applyUiScale writes data-form-factor after its debounced resize, so a band
// plan that only re-runs on ResizeObserver can keep the old form factor's
// shares. The combat layout must re-plan on that attribute's change, and let go
// of the observer when it releases.
import { readFileSync } from 'node:fs';
const combatLayoutSource = readFileSync(new URL('../src/ui/components/combatLayout.js', import.meta.url), 'utf8');

test('the combat layout re-plans when data-form-factor changes', () => {
  assert.match(combatLayoutSource, /formFactorObserver = new MutationObserver\(records => \{[\s\S]*?data-form-factor[\s\S]*?schedule\(\);/);
  assert.match(combatLayoutSource, /formFactorObserver\.observe\(document\.documentElement, \{ attributes: true, attributeOldValue: true, attributeFilter: \['data-form-factor'\] \}\);/);
  assert.match(combatLayoutSource, /function release\(\) \{[\s\S]*?formFactorObserver\?\.disconnect\(\);/);
});

// The wide floor follows the enemies' feet only in the alternative composition.
// The classic composition ignores `wide`, so its floor stays on the grid.
import { floorCellsFor } from '../src/ui/models/CombatCompositionModel.js';

test('the wide floor follows placed feet only in the alternative composition', () => {
  const cells = [{ ground: 250 }, { ground: 270 }];
  const sizes = [{ ground: 140 }, { ground: 160 }];
  assert.deepEqual(floorCellsFor({ wide: true, classic: false, sizes, cells }), [{ ground: 140 }, { ground: 160 }]);
  assert.deepEqual(floorCellsFor({ wide: true, classic: true, sizes, cells }), cells);
  assert.deepEqual(floorCellsFor({ wide: false, classic: false, sizes, cells }), cells);
});

// A wide field at 720 to 768 px is 300 px or less, which the shared rules read
// as a short portrait phone (enemies at 0.8 scale, lifted, on the near row).
// A wide screen is never a short phone: its enemies keep the back-row rules at
// every field height.
for (const height of [280, 300, 320]) {
  test(`a wide ${height}px field keeps its enemies on the back row, unlifted and full-size`, () => {
    const width = 1293;
    const actors = fight(2, width, height);
    const sizes = fitAlternativeSprites({ width, height, actors, narrow: false });
    const fits = alternativeCombatComposition({ sizes, actors, width, height, handLeft: width * .35, solo: false, wide: true });
    for (const enemy of fits.filter(fit => fit.id.startsWith('e'))) {
      assert.equal(enemy.standingGround, undefined, `enemy ${enemy.id} is not lifted`);
      assert.equal(enemy.sceneryGround, undefined, `enemy ${enemy.id} has no near-row scenery ground`);
      assert.ok(enemy.ground - enemy.visibleHeight >= 0, `enemy ${enemy.id} top stays on the field`);
    }
  });
}
