import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATION_POSITIONING_PRESETS, suppliedFormationPositioning } from '../src/content/formationPositioningPresets.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { presentationConfig } from '../src/model/advancedConfig.js';
import { SETTINGS_DEFAULTS } from '../src/content/settingsDefaults.js';

for (const [layout, source] of Object.entries(FORMATION_POSITIONING_PRESETS)) {
  test(`${layout} reproduces every supplied anchor and scales proportionally`, () => {
    for (const scale of [1, 0.5]) {
      const presentation = suppliedFormationPositioning(layout);
      const plan = combatFormation({ width:source.battlefield.width*scale, height:source.battlefield.height*scale,
        presentation, friends:[], enemies:[] });
      for (const expected of source.anchors) {
        const actual = plan.cells.find(c => c.cell === expected.cell);
        assert.ok(Math.abs(actual.x - expected.left*scale) < 1e-8, `${expected.cell} X`);
        assert.ok(Math.abs(actual.ground - expected.top*scale) < 1e-8, `${expected.cell} ground`);
      }
    }
  });
  test(`${layout} supplies default groups while retaining explicit edits`, () => {
    const supplied = suppliedFormationPositioning(layout);
    const settings = {...SETTINGS_DEFAULTS.values,
      'gameConfig.presentation.formationColumns':supplied.formationColumns,
      'gameConfig.presentation.formationRows':supplied.formationRows};
    assert.equal(presentationConfig(settings).formationGroups, supplied.formationGroups);
    settings['gameConfig.presentation.formationGroups']='[]';
    assert.equal(presentationConfig(settings).formationGroups,'[]');
  });
}
test('unprovided layouts remain independent and returned drafts cannot mutate the presets', () => {
  assert.equal(suppliedFormationPositioning('2x3'),null);
  const draft=suppliedFormationPositioning('1x1');
  draft.formationGroups='[]';
  assert.notEqual(suppliedFormationPositioning('1x1').formationGroups,'[]');
});
