import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { createRegistries } from '../src/model/registries.js';
import { attributeContentProblems } from '../src/model/attributes.js';
import { createRunState } from '../src/model/state.js';

const poolKey = 'gameConfig.startingStats.pointbuy.total';
test('pool changes redistribute every class exactly and leave authored content alone', () => {
  for (const total of [5, 10, 60, 100, 495]) {
    const configured = configuredContentBundle(contentBundle, { [poolKey]: total });
    assert.deepEqual(attributeContentProblems(configured), []);
    for (const preset of Object.values(configured.attributeRules.presets.pointbuy)) assert.equal(Object.values(preset).reduce((a,b) => a+b, 0), total);
  }
  assert.equal(contentBundle.creationModes.find(m => m.id === 'pointbuy').bonusPool, 10);
});

test('automatic scaling changes thresholds; manual mode keeps configured thresholds', () => {
  const settings = { [poolKey]: 10, 'gameConfig.derivedStatRules.rules.hp.pointsPerTier': 2 };
  const auto = configuredContentBundle(contentBundle, settings);
  const manual = configuredContentBundle(contentBundle, { ...settings, 'gameConfig.startingStats.autoScale': false });
  assert.equal(auto.creationModes.find(m => m.id === 'pointbuy').statConversionScale, 1/6);
  assert.equal(manual.creationModes.find(m => m.id === 'pointbuy').statConversionScale, undefined);
  assert.equal(manual.derivedStatRules.rules.hp.pointsPerTier, 2);
  const a = createRunState({ registries: createRegistries(auto), classId: 'reaver', seed: 42, attributeMode: 'pointbuy' });
  const b = createRunState({ registries: createRegistries(manual), classId: 'reaver', seed: 42, attributeMode: 'pointbuy' });
  assert.equal(Object.values(a.attributes).reduce((x,y) => x+y), 10);
  assert(a.maxHp > b.maxHp);
});

test('pool and conversion settings round trip and reject impossible budgets', () => {
  const settings = { [poolKey]: 10, 'gameConfig.startingStats.autoScale': false };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [poolKey]: 2 }), contentBundle));
});
