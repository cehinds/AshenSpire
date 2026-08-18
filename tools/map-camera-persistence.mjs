#!/usr/bin/env node
// Same-door gate for issue #38: a player-chosen map zoom and vertical camera
// offset must survive the real Map -> Armaments -> Map remount.

import { existsSync, mkdirSync, mkdtempSync, cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(HERE, '..');
const WRITE_SHOTS = !process.argv.includes('--no-screenshots');
const SELFTEST = process.argv.includes('--selftest');
const argValue = (name, fallback = '') => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const ENTRY = argValue('--entry');
const SHOT_PREFIX = argValue('--shot-prefix', 'map-camera-persistence');
const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844, deviceScaleFactor: 3 },
  { name: '412x915', width: 412, height: 915, deviceScaleFactor: 3 },
];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

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
    ready: new Promise((done, fail) => {
      ws.addEventListener('open', done);
      ws.addEventListener('error', fail);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((done, fail) => {
        pending.set(id, { resolve: done, reject: fail });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

async function runProbe(root, { screenshots = WRITE_SHOTS } = {}) {
  const browser = BROWSERS.find((candidate) => existsSync(candidate));
  if (!browser) throw new Error('no Chrome or Edge found; set CHROME to a local Chromium executable');

  const served = await serve({ root, port: 8538, open: false });
  const launched = await launchBrowser({
    prefix: 'map-camera-',
    browser,
    args: ['--disable-background-timer-throttling'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(launched.wsUrl);
  const results = [];
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);

    const evaluate = async (expression) => {
      const out = await cdp.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId);
      if (out.exceptionDetails) {
        throw new Error(out.exceptionDetails.exception?.description || 'page evaluation failed');
      }
      return out.result.value;
    };
    const waitFor = async (label, expression, timeoutMs = 7000) => {
      const deadline = Date.now() + timeoutMs;
      let last = null;
      while (Date.now() < deadline) {
        last = await evaluate(expression);
        if (last) return last;
        await wait(80);
      }
      throw new Error(`timed out waiting for ${label}; last=${JSON.stringify(last)}`);
    };
    const readState = () => evaluate(`(() => {
      const port = document.querySelector('.map-scroll');
      const svg = port && port.querySelector('.map-canvas');
      if (!port || !svg) return null;
      return {
        zoom: Number(port.dataset.framingZoom),
        scrollLeft: port.scrollLeft,
        scrollTop: port.scrollTop,
        maxScrollTop: Math.max(0, port.scrollHeight - port.clientHeight),
        viewBox: svg.getAttribute('viewBox'),
        width: svg.style.width,
        viewportWidth: port.clientWidth,
        viewportHeight: port.clientHeight,
        framing: port.dataset.framing,
        cameraRestore: port.dataset.cameraRestore,
      };
    })()`);

    for (const viewport of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor,
        mobile: true,
      }, sessionId);
      await cdp.send('Page.navigate', {
        url: `${served.url}${ENTRY}?shot=map&shotSeed=SHOWCASE`,
      }, sessionId);
      await waitFor('the real map and its camera report', `(() => {
        const port = document.querySelector('.map-scroll');
        return !!(port && document.querySelector('#zoom-in')
          && document.querySelector('#open-armoury')
          && Number.isFinite(Number(port.dataset.framingZoom)));
      })()`);

      // The shipped ladder is the player's zoom door. Two clicks make the
      // reset visible even when the configured default happens to share a rung.
      await evaluate(`document.querySelector('#zoom-out').click()`);
      await evaluate(`document.querySelector('#zoom-out').click()`);
      await wait(120);

      // Wheel over the real scrollport is player input and moves the camera on
      // its owned vertical axis. Directly assigning scrollTop would only prove
      // that JavaScript can write a number.
      const point = await evaluate(`(() => {
        const r = document.querySelector('.map-scroll').getBoundingClientRect();
        return { x: r.left + r.width * 0.25, y: r.top + r.height * 0.5 };
      })()`);
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: point.x,
        y: point.y,
        deltaX: 0,
        deltaY: 220,
      }, sessionId);
      await wait(160);
      const before = await readState();
      if (!(before && before.maxScrollTop > 20 && before.scrollTop > 5)) {
        throw new Error(`${viewport.name}: player wheel did not establish a measurable pan: ${JSON.stringify(before)}`);
      }

      await evaluate(`document.querySelector('#open-armoury').click()`);
      await waitFor('the real Armaments overlay', `!!document.querySelector('.armoury-overlay')`);
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
      }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
      }, sessionId);
      await waitFor('the remounted map after Armaments closes', `(() => {
        const port = document.querySelector('.map-scroll');
        return !document.querySelector('.armoury-overlay') && !!port
          && Number.isFinite(Number(port.dataset.framingZoom));
      })()`);
      await wait(220); // outlast the board's 120 ms camera backstop
      const after = await readState();

      const zoomHeld = Math.abs(after.zoom - before.zoom) < 0.0005;
      const panHeld = Math.abs(after.scrollTop - before.scrollTop) < 1.5
        && Math.abs(after.scrollLeft - before.scrollLeft) < 1.5;
      const pass = zoomHeld && panHeld;
      results.push({ viewport: viewport.name, pass, zoomHeld, panHeld, before, after });

      if (screenshots) {
        const out = resolve(root, 'docs', 'preview', `${SHOT_PREFIX}-${viewport.name}.png`);
        mkdirSync(resolve(out, '..'), { recursive: true });
        const png = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
        writeFileSync(out, Buffer.from(png.data, 'base64'));
      }
    }

    // Fit is computed from viewport geometry. Prove that a desktop Fit is not
    // treated as a portable camera when the same run remounts on a phone.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1200, height: 730, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await cdp.send('Page.navigate', {
      url: `${served.url}${ENTRY}?shot=map&shotSeed=SHOWCASE`,
    }, sessionId);
    await waitFor('desktop fit camera', `(() => {
      const port = document.querySelector('.map-scroll');
      return !!(port && port.dataset.framing && port.dataset.cameraRestore);
    })()`);
    await wait(220);
    const desktopFit = await readState();
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
    }, sessionId);
    await evaluate(`document.querySelector('#open-armoury').click()`);
    await waitFor('cross-viewport Armaments overlay', `!!document.querySelector('.armoury-overlay')`);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    }, sessionId);
    await waitFor('phone map after cross-viewport remount', `(() => {
      const port = document.querySelector('.map-scroll');
      return !document.querySelector('.armoury-overlay') && !!(port && port.dataset.cameraRestore);
    })()`);
    await wait(220);
    const phoneFit = await readState();
    results.fitViewport = {
      pass: desktopFit.viewportWidth > phoneFit.viewportWidth
        && phoneFit.cameraRestore === 'recomputed'
        && phoneFit.framing === 'fit',
      before: desktopFit,
      after: phoneFit,
    };

    // Race the scroll debounce against a real reachable-node transition. The
    // delayed old-board save must retain the node identity it was scheduled on.
    const race = await evaluate(`(() => {
      const port = document.querySelector('.map-scroll');
      const from = (document.querySelector('.map-node.current') || {}).dataset?.node || null;
      const target = document.querySelector('.map-node.reachable');
      if (!port || !target) return null;
      window.__mapRacePort = port;
      port.scrollTop = Math.min(Math.max(0, port.scrollHeight - port.clientHeight), port.scrollTop + 12);
      port.dispatchEvent(new Event('scroll'));
      const to = target.dataset.node;
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return { from, to };
    })()`);
    await wait(180);
    const committedViewNode = await evaluate(`window.__mapRacePort?.dataset.committedViewNode || null`);
    results.debounceRace = {
      pass: !!(race && committedViewNode === (race.from || 'entrance')),
      race,
      committedViewNode,
    };
  } finally {
    cdp.close();
    await launched.close();
    await new Promise((done) => served.server.close(done));
  }
  return results;
}

async function selftest() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'ashenspire-map-camera-'));
  try {
    cpSync(ROOT, tempRoot, {
      recursive: true,
      filter: (source) => !['.git', 'build', 'dist', 'node_modules'].includes(source.split(/[\\/]/).pop()),
    });
    const screenPath = resolve(tempRoot, 'src/ui/screens/map.js');
    const clean = readFileSync(screenPath, 'utf8');
    const seam = 'viewState: run.mapView,';
    if (!clean.includes(seam)) throw new Error(`selftest plant refused: ${seam} is absent`);
    writeFileSync(screenPath, clean.replace(seam, 'viewState: null,'));
    const planted = await runProbe(tempRoot, { screenshots: false });
    const caught = planted.every((row) => !row.pass && (!row.zoomHeld || !row.panHeld));
    console.log(`map-camera selftest: ${caught ? 'GREEN' : 'RED'} - dropped run view state caught at ${planted.filter((r) => !r.pass).length}/${planted.length} viewports`);
    if (!caught) process.exitCode = 1;

    // Two review-found ownership seams, planted together so one browser run
    // proves both outcome arms can go red without tripling the gate's runtime.
    writeFileSync(screenPath, clean);
    const boardPath = resolve(tempRoot, 'src/ui/components/mapboard.js');
    const board = readFileSync(boardPath, 'utf8');
    const fitSeam = '    && fitViewportMatches\n';
    const raceSeam = '      const snapshot = pendingViewCommit;\n';
    const nodeSeam = "    if (isReachable && viewer.onPick) el.addEventListener('click', () => viewer.onPick(n.id));";
    if (!board.includes(fitSeam) || !board.includes(raceSeam) || !board.includes(nodeSeam)) {
      throw new Error('selftest plant refused: viewport or debounce ownership seam is absent');
    }
    writeFileSync(boardPath, board
      .replace(fitSeam, '')
      .replace(raceSeam, '      const snapshot = viewSnapshot();\n')
      .replace(nodeSeam, "    if (isReachable && viewer.onPick) el.addEventListener('click', () => { run.mapNodeId = n.id; viewer.onPick(n.id); });"));
    const ownership = await runProbe(tempRoot, { screenshots: false });
    const fitCaught = ownership.fitViewport && !ownership.fitViewport.pass;
    const raceCaught = ownership.debounceRace && !ownership.debounceRace.pass;
    console.log(`map-camera ownership selftest: ${fitCaught && raceCaught ? 'GREEN' : 'RED'} - `
      + `viewport ${fitCaught ? 'caught' : 'MISSED'}, debounce ${raceCaught ? 'caught' : 'MISSED'}`);
    if (!fitCaught || !raceCaught) process.exitCode = 1;
  } finally {
    rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

if (SELFTEST) {
  await selftest();
} else {
  const results = await runProbe(ROOT);
  let failures = 0;
  for (const row of results) {
    console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.viewport}: `
      + `zoom ${row.before.zoom} -> ${row.after.zoom}; `
      + `pan [${row.before.scrollLeft.toFixed(1)},${row.before.scrollTop.toFixed(1)}] -> `
      + `[${row.after.scrollLeft.toFixed(1)},${row.after.scrollTop.toFixed(1)}]`);
    if (!row.pass) failures++;
  }
  const fit = results.fitViewport;
  console.log(`${fit && fit.pass ? 'PASS' : 'FAIL'} fit viewport ownership: `
    + `${fit ? fit.before.viewportWidth : '?'} -> ${fit ? fit.after.viewportWidth : '?'}; `
    + `restore=${fit ? fit.after.cameraRestore : '?'}`);
  if (!fit || !fit.pass) failures++;
  const race = results.debounceRace;
  console.log(`${race && race.pass ? 'PASS' : 'FAIL'} debounced node ownership: `
    + `${race ? race.race?.from : '?'} -> ${race ? race.race?.to : '?'}; `
    + `committed view=${race ? race.committedViewNode : '?'}`);
  if (!race || !race.pass) failures++;
  const total = results.length + 2;
  console.log(`map-camera persistence: ${failures ? 'RED' : 'GREEN'} (${total - failures}/${total})`);
  process.exitCode = failures ? 1 : 0;
}
