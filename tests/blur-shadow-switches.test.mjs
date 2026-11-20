// BLUR AND SHADOWS (owner, 2026-11-20): two device-local choices, Auto / On / Off,
// independent of the Effects master. Auto keeps the phones-only rule; On and Off
// force it on any device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, EffectsModalHtml } from '../src/ui/screens/settings.js';
import { t } from '../src/ui/strings.js';
import { SurfaceFlags, SURFACE_KEYS, EffectsSummary } from '../src/ui/performance.js';
import { DEVICE_KEYS } from '../src/model/settingsSync.js';

const rows = settingsRows();
const row = (key) => rows.find((candidate) => candidate.key === key);

test('blur and shadows are Auto / On / Off choices, default Auto, kept on this device', () => {
  for (const key of Object.values(SURFACE_KEYS)) {
    assert.equal(row(key).type, 'choice', key);
    assert.deepEqual(row(key).choices, ['auto', 'on', 'off'], key);
    assert.equal(row(key).def, 'auto', key);
    assert.equal(row(key).modal, 'effects', key);
    assert.equal(row(key).modalSection, 'surface', key);
    assert.ok(DEVICE_KEYS.includes(key), `${key} is device-local`);
  }
});

test('Auto sets no flag; On and Off set their own flag, whatever the Effects master says', () => {
  assert.deepEqual(SurfaceFlags({}), { blur: null, shadows: null });
  assert.deepEqual(SurfaceFlags({ fxBlur: 'auto', fxShadows: 'auto', effects: true }), { blur: null, shadows: null });
  assert.deepEqual(SurfaceFlags({ fxBlur: 'off', fxShadows: 'on' }), { blur: 'off', shadows: 'on' });
  assert.deepEqual(SurfaceFlags({ fxBlur: 'on', fxShadows: 'off', effects: true }), { blur: 'on', shadows: 'off' });
  assert.deepEqual(SurfaceFlags({ fxBlur: 'bogus', fxShadows: true }), { blur: null, shadows: null });
});

test('the Effects button count leaves blur and shadows out', () => {
  assert.deepEqual(EffectsSummary({ effects: true, fxBlur: 'off', fxShadows: 'off' }), EffectsSummary({ effects: true }));
});

test('the modal draws a Blur and shadows section after Fighter motion, live with Effects off', () => {
  const html = EffectsModalHtml({});
  assert.ok(html.indexOf('data-effects-section="surface"') > html.indexOf('data-effects-section="motion"'));
  assert.doesNotMatch(html, /data-effects-section="surface" data-off/);
  assert.ok(html.includes(t('settings.effects.surface')));
  assert.ok(html.includes(t('settings.effects.surfaceNote')));
  for (const key of Object.values(SURFACE_KEYS)) assert.ok(html.includes(`data-row-key="${key}"`), key);
});
