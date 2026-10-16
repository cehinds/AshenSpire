import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, generalGroups, settingsRowHtml } from '../src/ui/screens/settings.js';
import { presentationConfig } from '../src/model/advancedConfig.js';
import { SETTINGS_DEFAULTS } from '../src/content/settingsDefaults.js';
import { seedSettingsDefaults, SEED_KEY, seedAfterChange } from '../src/model/settingsDefaults.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { perspectiveCellOutlinePath } from '../src/ui/models/FormationGridModel.js';
const key='gameConfig.presentation.showFormationGrid';

test('simple grid switch is available in both profile Display sections without advanced formation controls',()=>{
  const row=settingsRows().find(row=>row.key===key);
  assert.equal(row.label,'Show battlefield grid');
  assert.equal(row.cat,'Display');
  assert.equal(row.def,true);
  for(const id of ['core','current']) {
    const display=[...generalGroups('Display',resolveGameProfile(id)).values()].flat();
    assert.equal(display.filter(r=>r.key===key).length,1);
    assert.ok(!display.some(r=>r.key==='gameConfig.presentation.movementEnabled'));
  }
  assert.match(settingsRowHtml({},row),/aria-checked="true"/);
  assert.match(settingsRowHtml({[key]:false},row),/aria-checked="false"/);
});
test('grid defaults migrate untouched owner defaults while retaining explicit off preferences',()=>{
  assert.equal(SETTINGS_DEFAULTS.values[key],true);
  assert.equal(presentationConfig().showFormationGrid,true);
  assert.equal(presentationConfig({[key]:false}).showFormationGrid,false);
  assert.equal(seedSettingsDefaults({[key]:false,[SEED_KEY]:{[key]:false}},SETTINGS_DEFAULTS)[key],true);
  assert.equal(seedSettingsDefaults({[key]:false},SETTINGS_DEFAULTS)[key],undefined);
  const before={[key]:true,[SEED_KEY]:{[key]:true}};
  const off={[key]:false,[SEED_KEY]:seedAfterChange(before,{[key]:false})};
  assert.equal(seedSettingsDefaults(off,SETTINGS_DEFAULTS)[key],undefined);
});
test('perspective grid paints each shared edge once and closes only outer boundaries',()=>{
  assert.equal(perspectiveCellOutlinePath({lane:0,visualBand:'A'},3),'M0,100V0H100');
  assert.equal(perspectiveCellOutlinePath({lane:2,visualBand:'A'},3),'M0,100V0H100V100');
  assert.equal(perspectiveCellOutlinePath({lane:0,visualBand:'D'},3),'M0,100V0H100M100,100H0');
  assert.equal(perspectiveCellOutlinePath({lane:2,visualBand:'D'},3),'M0,100V0H100V100M100,100H0');
});
