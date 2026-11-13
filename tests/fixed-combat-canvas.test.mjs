import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { effectiveViewPreset, configureDisplaySettings } from '../src/ui/displaySettings.js';

const ui = JSON.parse(readFileSync(new URL('../content/source/balanceUi.json', import.meta.url), 'utf8'));
configureDisplaySettings({ ui: ui.ui || ui });

test('a manual View preset wins, in or out of combat', () =>
{
  for (const on of [true, false])
  {
    assert.equal(effectiveViewPreset('mobile', on, 1280, 800), 'mobile');
    assert.equal(effectiveViewPreset('Widescreen', on, 390, 844), 'widescreen');
  }
});

test('auto in combat picks the form factor canvas', () =>
{
  assert.equal(effectiveViewPreset('auto', true, 1280, 800), 'desktop');
  assert.equal(effectiveViewPreset('auto', true, 2560, 1080), 'widescreen');
  assert.equal(effectiveViewPreset('auto', true, 1024, 768), 'tablet');
  assert.equal(effectiveViewPreset('auto', true, 390, 844), 'mobile');
  assert.equal(effectiveViewPreset(undefined, true, 1280, 800), 'desktop');
});

test('auto outside combat stays auto', () =>
{
  assert.equal(effectiveViewPreset('auto', false, 1280, 800), 'auto');
  assert.equal(effectiveViewPreset(null, false, 390, 844), 'auto');
});
