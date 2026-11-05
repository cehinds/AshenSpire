import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, generalGroups } from '../src/ui/screens/settings.js';
import { presentationConfig } from '../src/model/advancedConfig.js';
import { SETTINGS_DEFAULTS } from '../src/content/settingsDefaults.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { perspectiveCellOutlinePath } from '../src/ui/models/FormationGridModel.js';
const key='gameConfig.presentation.showFormationGrid';

test('the battlefield grid switch is no longer a setting, and nothing promotes its key',()=>{
  assert.ok(!settingsRows().some(row=>row.key===key));
  for(const id of ['core']) {
    const display=[...generalGroups('Display',resolveGameProfile(id)).values()].flat();
    assert.ok(!display.some(r=>r.key===key||r.key==='gameConfig.presentation.movementEnabled'));
  }
  assert.ok(!(key in SETTINGS_DEFAULTS.values));
  assert.equal(presentationConfig().showFormationGrid,true);
});
test('perspective grid paints each shared edge once and closes only outer boundaries',()=>{
  assert.equal(perspectiveCellOutlinePath({lane:0,visualBand:'A'},3),'M0,100V0H100');
  assert.equal(perspectiveCellOutlinePath({lane:2,visualBand:'A'},3),'M0,100V0H100V100');
  assert.equal(perspectiveCellOutlinePath({lane:0,visualBand:'D'},3),'M0,100V0H100M100,100H0');
  assert.equal(perspectiveCellOutlinePath({lane:2,visualBand:'D'},3),'M0,100V0H100V100M100,100H0');
});
