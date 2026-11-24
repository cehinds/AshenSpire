// BLUR AND SHADOWS (owner, 2026-11-20): two device-local choices, Auto / On / Off,
// independent of the Effects master. Auto keeps the phones-only rule; On and Off
// force it on any device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, EffectsModalHtml } from '../src/ui/screens/settings.js';
import { t } from '../src/ui/strings.js';
import { SurfaceFlags, SURFACE_KEYS, EffectsSummary } from '../src/ui/performance.js';
import { DEVICE_KEYS } from '../src/model/settingsSync.js';
import { ApplySurfaceFlags } from '../src/ui/displaySettings.js';

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

test('the root carries data-fx-blur / data-fx-shadows only when forced, and drops them for Auto', () => {
  const root = { dataset: {} };
  ApplySurfaceFlags(root, { fxBlur: 'off', fxShadows: 'off' });
  assert.deepEqual(root.dataset, { fxBlur: 'off', fxShadows: 'off' });
  ApplySurfaceFlags(root, { fxBlur: 'on', fxShadows: 'auto' });
  assert.deepEqual(root.dataset, { fxBlur: 'on' });
  ApplySurfaceFlags(root, {});
  assert.deepEqual(root.dataset, {});
});

test('Shadows forced Off draws the target silhouette as a coloured outline, not a tinted copy its filter reset would blank', async () => {
  const { renderTargetSilhouette } = await import('../src/ui/components/friendlyTargets.js');
  const element = (cls = '') => ({
    className: cls, dataset: {}, style: { setProperty() {} }, children: [],
    classList: { _s: new Set(cls.split(' ').filter(Boolean)), add(...c) { c.forEach((x) => this._s.add(x)); }, contains(c) { return this._s.has(c); } },
    cloneNode() { return element(cls); }, appendChild(c) { this.children.push(c); }, insertBefore(c) { this.children.unshift(c); },
    matches() { return false; }, querySelector() { return null; },
  });
  const saved = globalThis.document;
  try {
    for (const [flags, outline] of [[{}, false], [{ fxShadows: 'off' }, true], [{ fxShadows: 'on' }, false], [{ effects: 'off' }, true]]) {
      globalThis.document = { documentElement: { dataset: { ...flags } }, createElement: () => element() };
      const sprite = element('sprite');
      sprite.children.push(element('art'));
      const combatant = element('combatant');
      combatant.querySelector = (sel) => (sel === '.sprite' ? sprite : null);
      assert.equal(renderTargetSilhouette(combatant, 'enemy'), true, JSON.stringify(flags));
      const holder = sprite.children[0];
      assert.equal(holder.classList.contains('aim-outline'), outline, `${JSON.stringify(flags)}: outline=${outline}`);
    }
  } finally {
    globalThis.document = saved;
  }
});
