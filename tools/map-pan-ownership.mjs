#!/usr/bin/env node
// Issue #40: the browser owns touch/pen vertical panning; the map owns only
// mouse drag-to-pan. This gate exercises the real source or shipped root page.

import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(HERE, '..');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const valueAfter = (name, fallback = '') => {
  const at = process.argv.indexOf(name);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const ENTRY = valueAfter('--entry');
const WRITE_SHOTS = !process.argv.includes('--no-screenshots');
const SELFTEST = process.argv.includes('--selftest');
const SHOT_PREFIX = valueAfter('--shot-prefix', 'map-pan-ownership');
const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844, scale: 3 },
  { name: '412x915', width: 412, height: 915, scale: 3 },
];

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { done, fail } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) fail(new Error(message.error.message));
    else done(message.result);
  });
  return {
    ready: new Promise((done, fail) => {
      ws.addEventListener('open', done);
      ws.addEventListener('error', fail);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((done, fail) => {
        pending.set(id, { done, fail });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

async function run(tree = ROOT, { screenshots = WRITE_SHOTS } = {}) {
  const browser = BROWSERS.find((candidate) => existsSync(candidate));
  if (!browser) throw new Error('no Chrome or Edge found; set CHROME to a Chromium executable');
  const served = await serve({ root: tree, port: 8560, open: false });
  const launched = await launchBrowser({
    prefix: 'map-pan-', browser, args: ['--disable-background-timer-throttling'], timeoutMs: 12000,
  });
  const cdp = connectCdp(launched.wsUrl);
  const rows = [];
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      window.__mapPanCaptures = [];
      window.__mapPanListenerIds = 0;
      window.__mapPanListeners = {};
      const listenerId = new WeakMap();
      const listenerKey = (target) => {
        if (!(target instanceof Element) || !target.classList.contains('map-scroll')) return null;
        if (!listenerId.has(target)) listenerId.set(target, ++window.__mapPanListenerIds);
        return listenerId.get(target);
      };
      const add = EventTarget.prototype.addEventListener;
      const remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        const id = listenerKey(this);
        if (id && /^pointer(move|up|cancel|down)$/.test(type)) {
          const key = id + ':' + type;
          window.__mapPanListeners[key] = (window.__mapPanListeners[key] || 0) + 1;
        }
        return add.call(this, type, listener, options);
      };
      EventTarget.prototype.removeEventListener = function (type, listener, options) {
        const id = listenerKey(this);
        if (id && /^pointer(move|up|cancel|down)$/.test(type)) {
          const key = id + ':' + type;
          window.__mapPanListeners[key] = (window.__mapPanListeners[key] || 0) - 1;
        }
        return remove.call(this, type, listener, options);
      };
      const capture = Element.prototype.setPointerCapture;
      Element.prototype.setPointerCapture = function (pointerId) {
        if (this.classList && this.classList.contains('map-scroll')) {
          window.__mapPanCaptures.push({ pointerId, type: window.__mapPanPointerType || 'unknown' });
        }
        return capture.call(this, pointerId);
      };
      document.addEventListener('pointerdown', (event) => {
        window.__mapPanPointerType = event.pointerType;
      }, true);
    })();` }, sessionId);

    const evaluate = async (expression) => {
      const out = await cdp.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      }, sessionId);
      if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description || 'page evaluation failed');
      return out.result.value;
    };
    const until = async (label, expression, timeoutMs = 8000) => {
      const deadline = Date.now() + timeoutMs;
      let last = null;
      while (Date.now() < deadline) {
        last = await evaluate(expression).catch(() => null);
        if (last) return last;
        await wait(80);
      }
      throw new Error(`timed out waiting for ${label}; last=${JSON.stringify(last)}`);
    };
    const keyEscape = async () => {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
      }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
      }, sessionId);
    };

    for (const viewport of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height,
        deviceScaleFactor: viewport.scale, mobile: true,
      }, sessionId);
      await cdp.send('Page.navigate', {
        url: `${served.url}${ENTRY}?shot=map&shotSeed=SHOWCASE`,
      }, sessionId);
      await until('map scrollport', `!!(document.querySelector('.map-scroll') && document.querySelector('#zoom-in'))`);
      await evaluate(`(() => {
        for (let i = 0; i < 5; i++) document.querySelector('#zoom-in').click();
        return true;
      })()`);
      await wait(140);

      const synthetic = await evaluate(`(() => {
        const port = document.querySelector('.map-scroll');
        const max = Math.max(0, port.scrollHeight - port.clientHeight);
        const baseline = Math.min(140, Math.max(40, max / 3));
        const send = (type, init) => port.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
          clientX: 120, clientY: 360, ...init,
        }));
        const testNativeOwner = (pointerType, pointerId) => {
          port.scrollTop = baseline;
          const before = port.scrollTop;
          const captureBefore = window.__mapPanCaptures.length;
          send('pointerdown', { pointerType, pointerId, clientY: 360 });
          const grabbed = port.classList.contains('grabbing');
          send('pointermove', { pointerType, pointerId, clientY: 300 });
          const after = port.scrollTop;
          send('pointercancel', { pointerType, pointerId, clientY: 300 });
          return {
            delta: after - before,
            captures: window.__mapPanCaptures.length - captureBefore,
            grabbed,
          };
        };
        const touch = testNativeOwner('touch', 11);
        const pen = testNativeOwner('pen', 12);

        port.scrollTop = baseline;
        const mouseBefore = port.scrollTop;
        send('pointerdown', { pointerType: 'mouse', pointerId: 21, clientY: 360 });
        const grabbed = port.classList.contains('grabbing');
        send('pointerdown', { pointerType: 'mouse', pointerId: 22, clientY: 400 });
        send('pointermove', { pointerType: 'mouse', pointerId: 22, clientY: 350 });
        const afterSecond = port.scrollTop;
        send('pointermove', { pointerType: 'mouse', pointerId: 21, clientY: 320 });
        const afterPrimary = port.scrollTop;
        send('pointercancel', { pointerType: 'mouse', pointerId: 21, clientY: 320 });
        const cleaned = !port.classList.contains('grabbing');
        send('pointermove', { pointerType: 'mouse', pointerId: 21, clientY: 280 });
        const afterCancelledMove = port.scrollTop;
        send('pointercancel', { pointerType: 'mouse', pointerId: 22, clientY: 350 });
        const listenerId = [...Object.keys(window.__mapPanListeners)]
          .map((key) => Number(key.split(':')[0])).sort((a, b) => b - a)[0];
        const listeners = Object.fromEntries(['pointerdown', 'pointermove', 'pointerup', 'pointercancel']
          .map((type) => [type, window.__mapPanListeners[listenerId + ':' + type] || 0]));
        return {
          max, baseline, touchAction: getComputedStyle(port).touchAction,
          touch, pen, mouse: {
            grabbed,
            secondDelta: afterSecond - mouseBefore,
            primaryDelta: afterPrimary - afterSecond,
            cleaned,
            cancelledDelta: afterCancelledMove - afterPrimary,
          },
          listeners,
        };
      })()`);

      // A real finger must move the browser-owned scrollport. Synthetic pointer
      // events above deliberately cannot perform a browser default action.
      const point = await evaluate(`(() => {
        const port = document.querySelector('.map-scroll');
        port.scrollTop = Math.min(80, Math.max(20, (port.scrollHeight - port.clientHeight) / 4));
        const r = port.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.72, before: port.scrollTop };
      })()`);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 41 }],
      }, sessionId);
      for (let step = 1; step <= 5; step++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - step * 24, id: 41 }],
        }, sessionId);
        await wait(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
      await wait(180);
      const nativeAfter = await evaluate(`document.querySelector('.map-scroll').scrollTop`);

      // Remount after the debounced native scroll. The restored camera proves
      // this ownership change preserves PR #200's persistence contract.
      const persistedBefore = nativeAfter;
      await evaluate(`document.querySelector('#open-armoury').click()`);
      await until('Armaments overlay', `!!document.querySelector('.armoury-overlay')`);
      await keyEscape();
      await until('remounted map', `!document.querySelector('.armoury-overlay') && !!document.querySelector('.map-scroll')`);
      await wait(180);
      const remount = await evaluate(`(() => {
        const port = document.querySelector('.map-scroll');
        const before = port.scrollTop;
        const send = (type, y) => port.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, pointerId: 51, pointerType: 'mouse', button: 0,
          buttons: type === 'pointerup' ? 0 : 1, clientX: 120, clientY: y,
        }));
        send('pointerdown', 360); send('pointermove', 330); const after = port.scrollTop; send('pointerup', 330);
        const listenerId = [...Object.keys(window.__mapPanListeners)]
          .map((key) => Number(key.split(':')[0])).sort((a, b) => b - a)[0];
        const listeners = Object.fromEntries(['pointerdown', 'pointermove', 'pointerup', 'pointercancel']
          .map((type) => [type, window.__mapPanListeners[listenerId + ':' + type] || 0]));
        return { before, after, grabbing: port.classList.contains('grabbing'), listeners };
      })()`);

      const checks = {
        overflow: synthetic.max > 120,
        cssNativeAxis: synthetic.touchAction === 'pan-y',
        touchIgnoredByJs: Math.abs(synthetic.touch.delta) < 0.5 && synthetic.touch.captures === 0 && !synthetic.touch.grabbed,
        penIgnoredByJs: Math.abs(synthetic.pen.delta) < 0.5 && synthetic.pen.captures === 0 && !synthetic.pen.grabbed,
        secondPointerIgnored: Math.abs(synthetic.mouse.secondDelta) < 0.5,
        mousePrimaryMovesOnce: Math.abs(synthetic.mouse.primaryDelta - 40) < 1.5 && synthetic.mouse.grabbed,
        cancelCleans: synthetic.mouse.cleaned && Math.abs(synthetic.mouse.cancelledDelta) < 0.5,
        listenerLifecycleCleans: synthetic.listeners.pointerdown === 1
          && synthetic.listeners.pointermove === 0
          && synthetic.listeners.pointerup === 0
          && synthetic.listeners.pointercancel === 0,
        nativeTouchMoves: nativeAfter - point.before > 5,
        cameraPersists: Math.abs(remount.before - persistedBefore) < 2,
        remountMouseMovesOnce: Math.abs((remount.after - remount.before) - 30) < 1.5 && !remount.grabbing,
        remountListenerIsSingle: remount.listeners.pointerdown === 1
          && remount.listeners.pointermove === 0
          && remount.listeners.pointerup === 0
          && remount.listeners.pointercancel === 0,
      };
      const pass = Object.values(checks).every(Boolean);
      rows.push({ viewport: viewport.name, pass, checks, synthetic, native: { before: point.before, after: nativeAfter }, remount });

      if (screenshots) {
        const out = resolve(tree, 'docs', 'preview', `${SHOT_PREFIX}-${viewport.name}.png`);
        mkdirSync(resolve(out, '..'), { recursive: true });
        const png = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
        writeFileSync(out, Buffer.from(png.data, 'base64'));
      }
    }
  } finally {
    cdp.close();
    await launched.close();
    await new Promise((done) => served.server.close(done));
  }
  return rows;
}

async function selftest() {
  const tree = mkdtempSync(join(tmpdir(), 'ashenspire-map-pan-'));
  try {
    cpSync(ROOT, tree, {
      recursive: true,
      filter: (source) => !['.git', 'build', 'dist', 'node_modules'].includes(source.split(/[\\/]/).pop()),
    });
    const cssPath = resolve(tree, 'styles/map.css');
    const boardPath = resolve(tree, 'src/ui/components/mapboard.js');
    const css = readFileSync(cssPath, 'utf8');
    const board = readFileSync(boardPath, 'utf8');
    const cssSeam = '  touch-action: pan-y;\n';
    const guardSeam = "    if (ev.pointerType !== 'mouse' || ev.button !== 0 || activeMousePointerId !== null) return;\n";
    if (!css.replace(/\r\n/g, '\n').includes(cssSeam)
      || !board.replace(/\r\n/g, '\n').includes(guardSeam)) {
      throw new Error('selftest plant refused: CSS or pointer ownership seam is absent');
    }
    writeFileSync(cssPath, css.replace(/\r\n/g, '\n').replace(cssSeam, ''));
    writeFileSync(boardPath, board.replace(/\r\n/g, '\n').replace(
      guardSeam,
      "    if (ev.button !== 0) return; // planted: every pointer and second pointer enter the mouse owner\n",
    ));
    const rows = await run(tree, { screenshots: false });
    const caught = rows.every((row) => !row.checks.cssNativeAxis
      && !row.checks.touchIgnoredByJs
      && !row.checks.penIgnoredByJs
      && !row.checks.secondPointerIgnored);
    console.log(`map-pan ownership selftest: ${caught ? 'GREEN' : 'RED'} - `
      + `${rows.filter((row) => !row.pass).length}/${rows.length} planted viewports rejected`);
    if (!caught) process.exitCode = 1;
  } finally {
    rmSync(tree, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

if (SELFTEST) {
  await selftest();
  process.exit();
}

const rows = await run();
let failures = 0;
for (const row of rows) {
  console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.viewport}`);
  for (const [name, pass] of Object.entries(row.checks)) console.log(`  ${pass ? 'PASS' : 'FAIL'} ${name}`);
  if (!row.pass) console.log(`  evidence ${JSON.stringify({ synthetic: row.synthetic, native: row.native, remount: row.remount })}`);
  if (!row.pass) failures++;
}
console.log(`map-pan ownership: ${failures ? 'RED' : 'GREEN'} (${rows.length - failures}/${rows.length})`);
process.exitCode = failures ? 1 : 0;
