import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alternativeBackdropFit } from '../src/ui/models/AlternativeBackdropModel.js';
import { alternativeArtCatalog } from '../src/ui/alternativeArtCatalog.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('only combat clamps the scenery floor; dialogue keeps its own floor line', () => {
  const art = read('../src/ui/alternativeArt.js');
  assert.match(art, /fitAlternativeBackdrop\(combat, \{[^}]*coverFloor = false \}\)/, 'the clamp is opt-in');
  assert.match(art, /alternativeBackdropFit\(device, \{ width, height, fieldTop, ground, standGround, coverFloor \}\)/);
  const stage = read('../src/ui/components/battlefieldStage.js');
  const combatCall = stage.slice(stage.indexOf('fitAlternativeBackdrop(combat, {'), stage.indexOf('});', stage.indexOf('fitAlternativeBackdrop(combat, {')));
  assert.match(combatCall, /coverFloor: true/);
  const dialogue = read('../src/ui/components/dialogueStage.js');
  const at = dialogue.indexOf('fitAlternativeBackdrop(wrap, {');
  assert.ok(at >= 0);
  assert.doesNotMatch(dialogue.slice(at, dialogue.indexOf('});', at)), /coverFloor/, 'dialogue honours its 60% floor split');
});

test('combat reveals the landmark above the road without moving the authored standing floor', () => {
  const device = alternativeArtCatalog.scenes['pale-marches-2'].devices.desktop;
  const fit = alternativeBackdropFit(device, { width: 1440, height: 448, fieldTop: 90,
    ground: 232, standGround: 232, coverFloor: true });
  // This measured desktop battlefield previously discarded the upper 44%.
  assert(-fit.top / fit.height < .28, 'the landmark and upper scene enter the aperture');
  assert(Math.abs(fit.top + device.standingArea.y * fit.height - 322) < 1e-8, 'standing area starts at the back-row feet');
  assert.equal(fit.width / device.width, fit.height / device.height, 'layers keep one uniform scale');
});

test('all canonical combat canvases cover the HUD-to-field window at four form factors', () => {
  for (const scene of Object.values(alternativeArtCatalog.scenes)) {
    for (const [width, height, fieldTop, narrow] of [[390,426,76,true],[1024,338,77,false],[1440,448,90,false],[2560,596,108,false], [390,740,100,true]]) {
      const device = scene.devices[narrow ? 'phone' : 'desktop'];
      const before = JSON.stringify(device);
      const fit = alternativeBackdropFit(device, { width, height, fieldTop, ground: height * .52,
        standGround: height * .52, coverFloor: true });
      assert(fit.top <= 1e-8, `${scene.name}: no blank upper edge`);
      assert(fit.top + fit.height >= fieldTop + height - 1e-8, `${scene.name}: floor covers the field`);
      assert(fit.left <= 0 && fit.left + fit.width >= width, `${scene.name}: no blank side edges`);
      assert.equal(JSON.stringify(device), before, 'canonical transforms are immutable');
    }
  }
});

test('dialogue keeps its explicit ground anchor and existing standing-area safety clamp', () => {
  const device = alternativeArtCatalog.scenes['pale-marches-2'].devices.desktop;
  const options = { width: 1024, height: 600, fieldTop: 0, ground: 360 };
  const fit = alternativeBackdropFit(device, options);
  assert.equal(fit.top + device.groundAnchor * fit.height, options.ground);
  const guarded = alternativeBackdropFit(device, { ...options, ground: 900, standGround: 340 });
  assert(Math.abs(guarded.top + device.standingArea.y * guarded.height - 340) < 1e-8);
});
