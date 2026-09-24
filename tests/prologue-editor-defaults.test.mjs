import test from 'node:test';
import assert from 'node:assert/strict';
import { prologueConfig, prologueRows, prologueSettingKey, prologueStaging } from '../src/model/prologue.js';
import { saveFirstStepDefaults } from '../tools/prologue-editor-save.mjs';

test('the first-step mobile traveler ships at the foreground position and size', () => {
  const config = prologueConfig({});
  const step = config.scenes.find(scene => scene.id === 'step');
  assert.deepEqual(step.actor.mobile, { x: 40, y: 96, height: 40 });
  assert.deepEqual(step.actor.desktop, { x: 50, y: 96, height: 40 });
});

test('caption height, banner container, and grid defaults are recognized config settings', () => {
  const rows = new Set(prologueRows().map(row => row.key));
  for (const name of ['captionFixedHeight', 'captionHeightVh', 'bannerBox', 'bannerBoxColor', 'bannerBoxOpacity', 'editorGrid', 'editorSnap', 'editorGridStep']) {
    assert.ok(rows.has(prologueSettingKey(['presentation', name])), name);
  }
  const fixed = prologueConfig({
    [prologueSettingKey(['scenes', 'year', 'ownStaging'])]: true,
    [prologueSettingKey(['scenes', 'year', 'stage', 'captionFixedHeight'])]: true,
    [prologueSettingKey(['scenes', 'year', 'stage', 'captionHeightVh'])]: 22,
  });
  const stage = prologueStaging(fixed, fixed.scenes.find(scene => scene.id === 'year'));
  assert.equal(stage.captionFixedHeight, true);
  assert.equal(stage.captionHeightVh, 22);
});

test('project save refuses settings outside first step and editor grid', async () => {
  await assert.rejects(
    saveFirstStepDefaults('', { [prologueSettingKey(['scenes', 'year', 'text'])]: 'No' }),
    /Invalid first-step setting/,
  );
  await assert.rejects(
    saveFirstStepDefaults('', { [prologueSettingKey(['scenes', 'step', 'actor', 'mobile', 'height'])]: 999 }),
    /Invalid first-step setting/,
  );
});
