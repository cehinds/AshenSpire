#!/usr/bin/env node

// Proves the Audio settings sliders through their rendered door: the value a
// player sees and the value assistive technology reads both include the unit,
// and both move when the real input handler runs.

globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = { fullscreenElement: null, webkitFullscreenElement: null, body: {}, documentElement: {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '1' });
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
};

const { renderSettings } = await import('../src/ui/screens/settings.js');

const listeners = new Map();
const outputs = new Map();
const sliders = [];
const container = {
  innerHTML: '',
  isConnected: true,
  setAttribute() {},
  querySelector(selector) {
    const match = selector.match(/^\.range-val\[data-for="([^"]+)"\]$/);
    return match ? outputs.get(match[1]) || null : null;
  },
  querySelectorAll(selector) {
    return selector === '.set-range' ? sliders : [];
  },
};

renderSettings(container, {
  settings: { musicVolume: 50, sfxVolume: 75 },
  grouped: false,
  onChange() {},
});

for (const match of container.innerHTML.matchAll(/<input type="range"[^>]*id="([^"]+)"[^>]*value="([^"]+)"[^>]*data-key="([^"]+)"[^>]*aria-valuetext="([^"]+)"/g)) {
  const [, id, value, key, valueText] = match;
  const attrs = new Map([['aria-valuetext', valueText]]);
  const slider = {
    id,
    value,
    dataset: { key },
    addEventListener(type, fn) { listeners.set(`${key}:${type}`, fn); },
    setAttribute(name, val) { attrs.set(name, String(val)); },
    getAttribute(name) { return attrs.get(name); },
  };
  sliders.push(slider);
  outputs.set(key, { textContent: '' });
}

// Wire the nodes through the real render path now that the minimal fake DOM
// has materialised the inputs from the emitted HTML.
renderSettings(container, {
  settings: { musicVolume: 50, sfxVolume: 75 },
  grouped: false,
  onChange() {},
});

const failures = [];
for (const [key, expected] of [['musicVolume', '50%'], ['sfxVolume', '75%']]) {
  if (!container.innerHTML.includes(`id="setting-${key}"`)) failures.push(`${key}: slider has no stable id`);
  if (!container.innerHTML.includes(`for="setting-${key}"`)) failures.push(`${key}: output is not bound to slider`);
  if (!container.innerHTML.includes(`aria-valuetext="${expected}"`)) failures.push(`${key}: accessible value is not ${expected}`);
  if (!container.innerHTML.includes(`>${expected}</output>`)) failures.push(`${key}: visible value is not ${expected}`);
}

const music = sliders.find((slider) => slider.dataset.key === 'musicVolume');
if (!music || !listeners.has('musicVolume:input')) {
  failures.push('musicVolume: real input handler was not wired');
} else {
  music.value = '65';
  listeners.get('musicVolume:input')();
  if (outputs.get('musicVolume').textContent !== '65%') failures.push('musicVolume: visible value did not move to 65%');
  if (music.getAttribute('aria-valuetext') !== '65%') failures.push('musicVolume: accessible value did not move to 65%');
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('PASS Audio settings render and update visible and accessible percentage values through the real input handler.');
