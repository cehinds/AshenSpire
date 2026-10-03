import test from 'node:test';
import assert from 'node:assert/strict';
import { combatPositioningBindings } from '../src/ui/components/formationPositioning.js';
import { SETTINGS_DEFAULTS } from '../src/content/settingsDefaults.js';
import { suppliedFormationPositioning } from '../src/content/formationPositioningPresets.js';
import { FORMATION_GROUPS_KEY } from '../src/model/formationGroups.js';

test('the first combat group edit preserves the supplied positions for every other group', () => {
  let settings = { ...SETTINGS_DEFAULTS.values };
  assert.equal(settings[FORMATION_GROUPS_KEY], undefined);
  const bindings = combatPositioningBindings({
    readSettings: () => settings,
    onSettingsChange: patch => { settings = { ...settings, ...patch }; return { ok: true }; },
  });
  const supplied = JSON.parse(suppliedFormationPositioning('2x2').formationGroups);
  const edited = JSON.parse(bindings.read());
  assert.deepEqual(edited, supplied);
  const player = edited.find(group => group.id === 'player');
  player.scale = 1.25;
  bindings.write(JSON.stringify(edited));
  const saved = JSON.parse(bindings.read());
  assert.deepEqual(saved.filter(group => group.id !== 'player'), supplied.filter(group => group.id !== 'player'));
  assert.equal(saved.find(group => group.id === 'player').x, supplied.find(group => group.id === 'player').x);
  assert.equal(saved.find(group => group.id === 'player').scale, 1.25);
  assert.deepEqual(JSON.parse(bindings.readPresentation().formationGroups), saved);
  settings[FORMATION_GROUPS_KEY] = '[]';
  assert.equal(bindings.read(), '[]', 'an explicit cleared layout remains cleared');
});
