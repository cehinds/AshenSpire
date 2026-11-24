// tests/display-settings-effects-hook.test.mjs — applyDisplaySettings writes the one root hook
// (data-effects) and never data-performance (owner, 2026-11-20). It also guards the regression
// where a dropped `quality` variable threw on every settings apply ("quality is not defined").
import test from 'node:test';
import assert from 'node:assert/strict';

// A permissive DOM: any property is a callable that returns another permissive node, except the
// root's dataset and style, which record what was written.
function permissive() {
  const fn = function () { return permissive(); };
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'then') return undefined;
      if (prop === Symbol.iterator) return function* () {};
      if (prop === 'length') return 0;
      if (!(prop in target)) target[prop] = permissive();
      return target[prop];
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

test('applying settings sets data-effects for both Effects states and no data-performance', async () => {
  const dataset = {};
  const root = permissive();
  root.dataset = dataset;
  root.style = { setProperty() {}, getPropertyValue: () => '', removeProperty() {} };
  const doc = permissive();
  doc.documentElement = root;
  doc.fonts = { ready: Promise.resolve(), addEventListener() {} };
  const saved = { document: globalThis.document, window: globalThis.window, matchMedia: globalThis.matchMedia, addEventListener: globalThis.addEventListener, removeEventListener: globalThis.removeEventListener, requestAnimationFrame: globalThis.requestAnimationFrame, innerWidth: globalThis.innerWidth, innerHeight: globalThis.innerHeight };
  globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.requestAnimationFrame = () => 0; globalThis.innerWidth = 1280; globalThis.innerHeight = 800;
  saved.getComputedStyle = globalThis.getComputedStyle; globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.document = doc;
  globalThis.window = permissive();
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  try {
    const { applyDisplaySettings, configureDisplaySettings } = await import('../src/ui/displaySettings.js');
    const { balance } = await import('../src/content/balance.js');
    configureDisplaySettings({ ui: balance.ui, audio: permissive(), bootMusic: permissive(), saves: permissive(), getActiveSettings: () => ({}) });
    for (const [effects, hook, ambient] of [[false, 'off', 'off'], [true, 'on', 'high']]) {
      applyDisplaySettings({ effects, ambient: 'high' });
      assert.equal(dataset.effects, hook);
      assert.equal(dataset.ambient, ambient, 'ambient follows Effects as Lite did');
      assert.ok(!('performance' in dataset), 'data-performance is never written');
    }
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
