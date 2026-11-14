import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EffectiveViewPreset, configureDisplaySettings } from '../src/ui/displaySettings.js';

const ui = JSON.parse(readFileSync(new URL('../content/source/balanceUi.json', import.meta.url), 'utf8'));
configureDisplaySettings({ ui: ui.ui || ui });

test('a manual View preset wins, in or out of combat', () =>
{
  for (const on of [true, false])
  {
    assert.equal(EffectiveViewPreset('mobile', on, 1280, 800), 'mobile');
    assert.equal(EffectiveViewPreset('Widescreen', on, 390, 844), 'widescreen');
  }
});

test('auto in combat picks the form factor canvas', () =>
{
  assert.equal(EffectiveViewPreset('auto', true, 1280, 800), 'desktop');
  assert.equal(EffectiveViewPreset('auto', true, 2560, 1080), 'widescreen');
  assert.equal(EffectiveViewPreset('auto', true, 1024, 768), 'tablet');
  assert.equal(EffectiveViewPreset('auto', true, 390, 844), 'mobile');
  assert.equal(EffectiveViewPreset(undefined, true, 1280, 800), 'desktop');
});

test('auto outside combat stays auto', () =>
{
  assert.equal(EffectiveViewPreset('auto', false, 1280, 800), 'auto');
  assert.equal(EffectiveViewPreset(null, false, 390, 844), 'auto');
});
