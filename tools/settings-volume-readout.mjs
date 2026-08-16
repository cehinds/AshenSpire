#!/usr/bin/env node

// Proves the Audio settings sliders through their rendered door: the value a
// player sees and the value assistive technology reads both include the unit,
// and both move when the real input handler runs.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

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
  if (container.innerHTML.includes('aria-live=')) failures.push(`${key}: output duplicates the slider announcement as a live region`);
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

const args = process.argv.slice(2);
const browserAt = args.indexOf('--browser');
const browserPath = browserAt >= 0 ? args[browserAt + 1] : null;
if (browserPath) await runBrowserEvidence(browserPath);

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: done, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else done(message.result);
  });
  return {
    ready: new Promise((done, reject) => {
      ws.addEventListener('open', done);
      ws.addEventListener('error', reject);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((done, reject) => {
        pending.set(id, { resolve: done, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

function launchChrome(path, profile) {
  return new Promise((done, reject) => {
    const child = spawn(path, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=0',
      `--user-data-dir=${profile}`, '--no-first-run', 'about:blank',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const read = (chunk) => {
      output += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
      if (match) done({ child, wsUrl: match[1] });
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.on('error', reject);
    setTimeout(() => reject(new Error(`Chrome gave no DevTools endpoint: ${output.slice(-300)}`)), 12000);
  });
}

async function runBrowserEvidence(path) {
  if (!existsSync(path)) throw new Error(`Browser not found: ${path}`);
  const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
  const profile = mkdtempSync(join(tmpdir(), 'audio-volume-browser-'));
  const local = await serve({ root, port: 8517, open: false });
  let child;
  let cdp;
  try {
    const launched = await launchChrome(path, profile);
    child = launched.child;
    cdp = connectCdp(launched.wsUrl);
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('DOM.enable', {}, sessionId);
    await cdp.send('Accessibility.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    }, sessionId);
    await cdp.send('Page.navigate', { url: `http://localhost:${local.port}/?shot=profile` }, sessionId);
    await new Promise((done) => setTimeout(done, 1500));

    const evaluate = async (expression, returnByValue = true) => {
      const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'browser evaluation failed');
      return returnByValue ? result.result.value : result.result;
    };
    const opened = await evaluate(`(() => {
      const tab=[...document.querySelectorAll('.set-tab')].find((node)=>node.dataset.member==='Audio');
      if(!tab) return false; tab.click();
      const slider=document.querySelector('.set-range[data-key="musicVolume"]');
      if(!slider) return false; slider.focus(); return true;
    })()`);
    if (!opened) throw new Error('Audio settings did not open through their real tab');

    const press = async (key, code = key) => {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code }, sessionId);
    };
    const read = () => evaluate(`(() => {
      const slider=document.querySelector('.set-range[data-key="musicVolume"]');
      const out=document.querySelector('.range-val[data-for="musicVolume"]');
      const r=out.getBoundingClientRect();
      return { value: slider.value, name: slider.getAttribute('aria-label'),
        valueText: slider.getAttribute('aria-valuetext'), visibleText: out.textContent,
        outputVisible: r.width>0 && r.height>0 && getComputedStyle(out).visibility!=='hidden',
        liveRegions: document.querySelectorAll('.range-val[aria-live]').length };
    })()`);

    await press('Home');
    const atZero = await read();
    await press('End');
    const atHundred = await read();
    await press('ArrowLeft');
    const afterKeyboard = await read();

    const remote = await evaluate(`document.querySelector('.set-range[data-key="musicVolume"]')`, false);
    const described = await cdp.send('DOM.describeNode', { objectId: remote.objectId }, sessionId);
    const ax = await cdp.send('Accessibility.getPartialAXTree', {
      backendNodeId: described.node.backendNodeId, fetchRelatives: false,
    }, sessionId);
    const sliderAx = ax.nodes.find((node) => node.role && node.role.value === 'slider');
    const axName = sliderAx && sliderAx.name && sliderAx.name.value;
    const axValue = sliderAx && sliderAx.value && sliderAx.value.value;

    const browserFailures = [];
    const exact = (state, value) => state.value === value && state.valueText === `${value}%`
      && state.visibleText === `${value}%` && state.outputVisible;
    if (!exact(atZero, '0')) browserFailures.push(`0% edge disagreed: ${JSON.stringify(atZero)}`);
    if (!exact(atHundred, '100')) browserFailures.push(`100% edge disagreed: ${JSON.stringify(atHundred)}`);
    if (!exact(afterKeyboard, '95')) browserFailures.push(`keyboard step disagreed: ${JSON.stringify(afterKeyboard)}`);
    if (afterKeyboard.name !== 'Music volume') browserFailures.push(`DOM accessible name was ${afterKeyboard.name}`);
    if (axName !== 'Music volume') browserFailures.push(`AX name was ${axName}`);
    if (!String(axValue).includes('95')) browserFailures.push(`AX value was ${axValue}`);
    if (afterKeyboard.liveRegions !== 0) browserFailures.push(`${afterKeyboard.liveRegions} duplicate live region(s) remain`);
    if (browserFailures.length) throw new Error(browserFailures.join('\n'));

    console.log('PASS real Chrome source branch: Home=0%, End=100%, ArrowLeft=95%; visible output matched each value.');
    console.log(`PASS accessibility tree: slider name "${axName}", value "${axValue}"; duplicate live regions 0.`);
  } finally {
    if (cdp) cdp.close();
    if (child) child.kill();
    local.server.close();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
