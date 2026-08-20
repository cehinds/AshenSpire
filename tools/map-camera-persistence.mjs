#!/usr/bin/env node
// Same-door gate for issue #38: a player-chosen map zoom and vertical camera
// offset must survive the real Map -> Armaments -> Map remount.
//
// Also the same-door gate for issue #243: leaving the map INSIDE the 80 ms
// scroll-commit debounce must not let the armed timer fire into a run the app
// has already dropped — the "map exit during debounce" case below drives the
// player's own exit (Menu -> Save -> Save & Quit to Title) and counts uncaught
// exceptions, because the delayed commit labelling the right node (the #38
// cases) is silent on whether it should fire at all once the screen is gone.

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
  const eventListeners = new Set();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      for (const listener of eventListeners) listener(message);
      return;
    }
    if (!pending.has(message.id)) return;
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
    onEvent(listener) { eventListeners.add(listener); },
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
        framingMiss: Number(port.dataset.framingMiss),
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

    // Leave the map INSIDE the debounce window, through the player's own door.
    // A real pan arms the board's 80 ms scroll-commit timer; 55 ms later the
    // drive takes Menu -> Save -> "Save & Quit to Title" (~10 ms of menu
    // clicks), so the quit lands around t+65 ms — decisively inside the window,
    // and the timer fires after the run is dropped. At 70 ms the quit races the
    // timer at the 80 ms line itself and the verdict flips run to run; a plant
    // that is red only some of the time is not a plant. The verdict is uncaught
    // exceptions after the exit — not the validation banner, which the
    // ?shot=title boot can raise on its own and which survives navigation.
    const exceptionsSeen = [];
    cdp.onEvent((message) => {
      if (message.method === 'Runtime.exceptionThrown') {
        const d = message.params.exceptionDetails;
        exceptionsSeen.push(d.exception?.description?.split('\n')[0] || d.text || 'unknown exception');
      }
    });
    await cdp.send('Page.navigate', { url: `${served.url}${ENTRY}?shot=title` }, sessionId);
    await waitFor('the title slots and their Continue door', `(() => {
      return document.querySelectorAll('.slot.occupied').length > 0
        && [...document.querySelectorAll('button')].some((b) => /continue/i.test(b.textContent));
    })()`);
    await evaluate(`[...document.querySelectorAll('button')].find((b) => /continue/i.test(b.textContent)).click()`);
    await waitFor('the map after Continue', `!!document.querySelector('.map-scroll')`);
    exceptionsSeen.length = 0; // the ?shot=title boot is its own observation; only the exit is on trial
    const exitDrive = await evaluate(`(async () => {
      const rest = (ms) => new Promise((done) => setTimeout(done, ms));
      const port = document.querySelector('.map-scroll');
      port.scrollTop += 60;                    // a real pan on the real scrollport arms the debounce
      await rest(55);                          // inside the 80 ms window — the timer outlives the screen
      document.querySelector('#open-menu').click(); await rest(5);
      const tab = [...document.querySelectorAll('button,[role=tab]')].find((b) => b.textContent.trim() === 'Save');
      if (tab) tab.click(); await rest(5);
      const quit = document.querySelector('#ovs-quit'); // "Save & Quit to Title"
      if (!quit) return { reached: false };
      quit.click();
      await rest(400);                         // outlast the debounce and the save
      return { reached: true, onTitle: !!document.querySelector('.slot') };
    })()`);
    await wait(120); // let any exceptionThrown event cross the wire before the verdict
    results.mapExitDuringDebounce = {
      pass: !!(exitDrive && exitDrive.reached && exitDrive.onTitle && exceptionsSeen.length === 0),
      exit: exitDrive,
      uncaught: [...exceptionsSeen],
    };

    // The flush half of #243 (PR #244's corrected-head review, and Aurora's
    // inline finding r3826021479): the exit guard must not DISCARD the
    // player's final pan — the pending snapshot rides the Save & Quit
    // persistence door instead of dying with the timer. Fit framing is the
    // UNOBSERVABLE control cell (Vira: the fit camera recomputes on every
    // mount, 0.0 px loss at both timings), so this case buys an observable
    // camera with a deliberate zoom first, commits a mid-extent anchor while
    // the board is connected, pans AWAY from it, quits inside the debounce
    // window at t+55 ms — the same distance from the 80 ms line as the exit
    // case, and for the same reason — resumes, and demands the RESUMED camera
    // equal the FINAL pan, not the anchor. The crash guard's own property is
    // asserted in the same breath: zero uncaught after the exit.
    results.exitCameraFlush = [];
    for (const shape of [
      { name: '390x844', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
      { name: '1200x730', width: 1200, height: 730, deviceScaleFactor: 1, mobile: false },
    ]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width, height: shape.height, deviceScaleFactor: shape.deviceScaleFactor, mobile: shape.mobile,
      }, sessionId);
      // A ?shot= boot swaps in the module's memory-storage stub (main.js
      // pickStorage), which no page-side instrument can see — so THIS case
      // alone enters by the REAL front door on REAL localStorage: the title's
      // own BEGIN THE CLIMB the first time, Continue when the slot is already
      // occupied. That is what makes "saved" a readable fact and a durable
      // write a countable one.
      await cdp.send('Page.navigate', { url: `${served.url}${ENTRY}` }, sessionId);
      await waitFor('the real title (flush case)', `(() => {
        const bs = [...document.querySelectorAll('button')];
        return document.querySelectorAll('.slot').length > 0
          && bs.some((b) => /continue|begin a climb/i.test(b.textContent));
      })()`);
      const door = await evaluate(`(() => {
        const bs = [...document.querySelectorAll('button')];
        const cont = bs.find((b) => /continue/i.test(b.textContent));
        if (cont) { cont.click(); return 'continue'; }
        bs.find((b) => /begin a climb/i.test(b.textContent)).click(); return 'begin';
      })()`);
      if (door === 'begin') {
        await waitFor('the customize screen (flush case)', `!!document.querySelector('#cz-start')`);
        await evaluate(`document.querySelector('#cz-start').click()`);
      }
      await waitFor('the map by the real door (flush case)', `!!(document.querySelector('.map-scroll') && document.querySelector('#zoom-in'))`);
      await wait(300); // outlast the camera backstop; the mount's own centring settles
      exceptionsSeen.length = 0; // the boot is its own observation; the drive is on trial
      // A genuine nonzero manual-framing move: the shipped zoom ladder. NB:
      // `dataset.framing` is the fit-quality report, NOT the framing mode —
      // the mode lives in the snapshot; the zoom delta below is the evidence
      // the move was real, and cameraRestore='restored' on resume is the
      // evidence the saved camera (not a fit recompute) is what came back.
      const zoomBefore = await evaluate(`Number(document.querySelector('.map-scroll').dataset.framingZoom)`);
      await evaluate(`document.querySelector('#zoom-in').click()`);
      await wait(250); // the zoom commits immediately; its programmatic scroll drains through the debounce
      let zoomAfter = await evaluate(`Number(document.querySelector('.map-scroll').dataset.framingZoom)`);
      if (Math.abs(zoomAfter - zoomBefore) <= 0.0005) {
        // The default rung had no headroom upward; the ladder's other
        // direction is the same manual-framing door.
        await evaluate(`document.querySelector('#zoom-out').click()`);
        await wait(250);
        zoomAfter = await evaluate(`Number(document.querySelector('.map-scroll').dataset.framingZoom)`);
      }
      // Count DURABLE writes: every setItem landing on the slot-1 run key.
      // Real localStorage goes through Storage.prototype, so the patch sees
      // every write the save manager makes.
      await evaluate(`(() => {
        window.__runWrites = 0;
        const put = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === 'sote_run_v1') window.__runWrites += 1;
          return put.call(this, key, value);
        };
      })()`);
      const flushSetup = await evaluate(`(() => {
        const port = document.querySelector('.map-scroll');
        const max = Math.max(0, port.scrollHeight - port.clientHeight);
        port.scrollTop = Math.round(max * 0.5); // away from max AND from zero
        port.dispatchEvent(new Event('scroll'));
        return { max, anchor: port.scrollTop, framing: port.dataset.framing };
      })()`);
      await wait(250); // > 80 ms: the anchor commits while the board is still connected
      // CONTROL CELL — connected, no exit: one more pan must cost ZERO durable
      // writes at once (the synchronous hand-over says commit:false) and
      // EXACTLY ONE once the debounce fires. Read in the same synchronous
      // breath as the pan, so no timer can fire between the two.
      const control = await evaluate(`(() => {
        window.__runWrites = 0;
        const port = document.querySelector('.map-scroll');
        port.scrollTop = Math.max(0, port.scrollTop - 40);
        port.dispatchEvent(new Event('scroll'));
        return { top: port.scrollTop, immediateWrites: window.__runWrites };
      })()`);
      await wait(250);
      const controlAfter = await evaluate(`window.__runWrites`);
      // THE DRIVE — final pan, quit inside the window, one save, no echo.
      const flushDrive = await evaluate(`(async () => {
        const rest = (ms) => new Promise((done) => setTimeout(done, ms));
        window.__runWrites = 0;
        const port = document.querySelector('.map-scroll');
        port.scrollTop = Math.max(0, port.scrollTop - 200); // the FINAL pan
        port.dispatchEvent(new Event('scroll'));
        const finalTop = port.scrollTop;
        const immediateWrites = window.__runWrites; // still synchronous with the pan
        await rest(55); // inside the 80 ms window — the durable commit has NOT fired
        document.querySelector('#open-menu').click(); await rest(5);
        const tab = [...document.querySelectorAll('button,[role=tab]')].find((b) => b.textContent.trim() === 'Save');
        if (tab) tab.click(); await rest(5);
        const quit = document.querySelector('#ovs-quit'); // "Save & Quit to Title"
        if (!quit) return { reached: false };
        quit.click();
        await rest(400); // outlast the armed debounce and the save
        return {
          reached: true, finalTop, immediateWrites,
          onTitle: !!document.querySelector('.slot'),
          quitWrites: window.__runWrites,
        };
      })()`);
      await wait(200); // a delayed second save would land here
      const settled = await evaluate(`({
        writes: window.__runWrites,
        savedTop: (() => {
          try { return JSON.parse(localStorage.getItem('sote_run_v1')).mapView.scrollTop; }
          catch { return null; }
        })(),
      })`);
      await evaluate(`[...document.querySelectorAll('button')].find((b) => /continue/i.test(b.textContent)).click()`);
      await waitFor('the resumed map (flush case)', `!!document.querySelector('.map-scroll')`);
      await wait(300); // the restore lands on the settled pass
      const resumed = await readState();
      await wait(120); // let any exceptionThrown cross the wire before the verdict
      const flushUncaught = [...exceptionsSeen];
      const manualMove = Number.isFinite(zoomBefore) && Number.isFinite(zoomAfter)
        && Math.abs(zoomAfter - zoomBefore) > 0.0005;
      const observable = manualMove && (control.top - flushDrive.finalTop) > 20;
      const savedIdentity = settled.savedTop != null && Math.abs(settled.savedTop - flushDrive.finalTop) < 1.5;
      const resumedIdentity = Math.abs(resumed.scrollTop - flushDrive.finalTop) < 1.5;
      results.exitCameraFlush.push({
        shape: shape.name,
        pass: !!(flushDrive.reached && flushDrive.onTitle && observable
          && control.immediateWrites === 0 && controlAfter === 1
          && flushDrive.immediateWrites === 0
          && flushDrive.quitWrites === 1 && settled.writes === 1
          && savedIdentity && resumedIdentity
          && resumed.cameraRestore === 'restored' && flushUncaught.length === 0),
        door,
        zoom: [zoomBefore, zoomAfter],
        anchor: flushSetup.anchor,
        controlTop: control.top,
        finalTop: flushDrive.finalTop,
        savedTop: settled.savedTop,
        resumedTop: resumed.scrollTop,
        controlWrites: [control.immediateWrites, controlAfter],
        exitWrites: [flushDrive.immediateWrites, flushDrive.quitWrites, settled.writes],
        framing: flushSetup.framing,
        cameraRestore: resumed.cameraRestore,
        uncaught: flushUncaught,
      });
    }

    // Hold the real map scrollport at zero height beyond the 120 ms backstop,
    // then release it through an actual viewport resize. The timeout must stay
    // provisional; the later ResizeObserver pass owns the first real fit.
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
        window.__releaseMapHeight = false;
        Object.defineProperty(Element.prototype, 'clientHeight', {
          ...descriptor,
          get() {
            if (!window.__releaseMapHeight && this.classList?.contains('map-scroll')) return 0;
            return descriptor.get.call(this);
          },
        });
      })();`,
    }, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
    }, sessionId);
    await cdp.send('Page.navigate', {
      url: `${served.url}${ENTRY}?shot=map&shotSeed=SHOWCASE&zeroHeightSettle=1`,
    }, sessionId);
    await waitFor('zero-height map scrollport mount', `!!document.querySelector('.map-scroll')`);
    await wait(170); // outlast the 120 ms backstop while clientHeight is held at zero
    const zeroBefore = await readState();
    await evaluate(`window.__releaseMapHeight = true`);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 846, deviceScaleFactor: 3, mobile: true,
    }, sessionId);
    // A bad plant may have disconnected the observer already, so this arm must
    // return a RED outcome rather than time out before the selftest can name it.
    await wait(220);
    const zeroAfter = await readState();
    results.zeroHeightSettle = {
      pass: zeroBefore.viewportHeight === 0
        && !zeroBefore.framing
        && zeroAfter.viewportHeight > 0
        && zeroAfter.framing === 'fit'
        && zeroAfter.framingMiss <= 0.5
        && zeroAfter.maxScrollTop > 0
        && zeroAfter.scrollTop > 0,
      before: zeroBefore,
      after: zeroAfter,
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
    const board = readFileSync(boardPath, 'utf8').replace(/\r\n/g, '\n');
    // A normal Windows checkout may materialize authored JS as CRLF, and an
    // interrupted edit can even leave mixed endings. The disposable mutation
    // copy is normalized before matching so plants describe source meaning,
    // not a checkout's newline bytes.
    const fitSeam = '    && fitViewportMatches\n';
    const raceSeam = '      const snapshot = pendingViewCommit;\n';
    const settleSeam = '      if (settled || scroll.clientHeight <= 0) return false;\n';
    const nodeSeam = "    if (isReachable && viewer.onPick) el.addEventListener('click', () => viewer.onPick(n.id));";
    // The #243 guard: removing it re-opens the detached-timer crash, and the
    // plant enters as source bytes in the copied tree — the same door a real
    // regression would take (a build of this copy, driven by the real controls).
    const exitSeam = '    if (!scroll.isConnected) return; // the player left the map while a commit was pending\n';
    if (!board.includes(fitSeam) || !board.includes(raceSeam)
      || !board.includes(settleSeam) || !board.includes(nodeSeam) || !board.includes(exitSeam)) {
      throw new Error('selftest plant refused: viewport, debounce, settlement, or map-exit ownership seam is absent');
    }
    writeFileSync(boardPath, board
      .replace(fitSeam, '')
      .replace(raceSeam, '      const snapshot = viewSnapshot();\n')
      .replace(settleSeam, '      if (settled) return false;\n')
      .replace(nodeSeam, "    if (isReachable && viewer.onPick) el.addEventListener('click', () => { run.mapNodeId = n.id; viewer.onPick(n.id); });")
      .replace(exitSeam, ''));
    const ownership = await runProbe(tempRoot, { screenshots: false });
    const fitCaught = ownership.fitViewport && !ownership.fitViewport.pass;
    const raceCaught = ownership.debounceRace && !ownership.debounceRace.pass;
    const settleCaught = ownership.zeroHeightSettle && !ownership.zeroHeightSettle.pass;
    const exitCaught = ownership.mapExitDuringDebounce && !ownership.mapExitDuringDebounce.pass;
    console.log(`map-camera ownership selftest: ${fitCaught && raceCaught && settleCaught && exitCaught ? 'GREEN' : 'RED'} - `
      + `viewport ${fitCaught ? 'caught' : 'MISSED'}, debounce ${raceCaught ? 'caught' : 'MISSED'}, `
      + `zero-height settle ${settleCaught ? 'caught' : 'MISSED'}, `
      + `map exit ${exitCaught ? 'caught' : 'MISSED'} (${ownership.mapExitDuringDebounce?.uncaught?.[0] || 'no uncaught error'})`);
    if (!fitCaught || !raceCaught || !settleCaught || !exitCaught) process.exitCode = 1;

    // The flush seam (#243's other half — #245's camera preservation): remove
    // ONLY the synchronous hand-over — the crash guard stays — and the flush
    // case must go red BY IDENTITY (the saved and resumed camera are the stale
    // last commit, with zero uncaught) while the exit case STAYS GREEN. The
    // two halves of #243 are caught by two different instruments, and this
    // proves neither can stand in for the other.
    writeFileSync(boardPath, board);
    const flushSeam = '    emitViewState(false, pendingViewCommit);\n';
    if (!board.includes(flushSeam)) throw new Error('selftest plant refused: the synchronous hand-over seam is absent');
    writeFileSync(boardPath, board.replace(flushSeam, ''));
    const flushless = await runProbe(tempRoot, { screenshots: false });
    const flushRows = flushless.exitCameraFlush || [];
    const flushCaught = flushRows.length === 2 && flushRows.every((row) => !row.pass
      && (row.uncaught?.length || 0) === 0
      && Math.abs(row.savedTop - row.finalTop) > 20
      && Math.abs(row.resumedTop - row.finalTop) > 20);
    const guardHeld = !!flushless.mapExitDuringDebounce?.pass;
    console.log(`map-camera flush selftest: ${flushCaught && guardHeld ? 'GREEN' : 'RED'} - `
      + `hand-over removal ${flushCaught ? 'caught by identity' : 'MISSED'} `
      + `(${flushRows.map((r) => `${r.shape}: final ${r.finalTop?.toFixed?.(1)} vs saved ${r.savedTop?.toFixed?.(1)} / resumed ${r.resumedTop?.toFixed?.(1)}`).join('; ')}), `
      + `crash guard ${guardHeld ? 'held green' : 'WENT RED'}`);
    if (!flushCaught || !guardHeld) process.exitCode = 1;
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
  const settle = results.zeroHeightSettle;
  console.log(`${settle && settle.pass ? 'PASS' : 'FAIL'} zero-height settlement: `
    + `${settle ? settle.before.viewportHeight : '?'} -> ${settle ? settle.after.viewportHeight : '?'}; `
    + `framing=${settle ? settle.after.framing : '?'}, miss=${settle ? settle.after.framingMiss : '?'}`);
  if (!settle || !settle.pass) failures++;
  const exit = results.mapExitDuringDebounce;
  console.log(`${exit && exit.pass ? 'PASS' : 'FAIL'} map exit during debounce: `
    + `reached=${exit ? !!exit.exit?.reached : '?'}, onTitle=${exit ? !!exit.exit?.onTitle : '?'}, `
    + `uncaught=${exit ? exit.uncaught.length : '?'}`
    + `${exit && exit.uncaught.length ? ` [${exit.uncaught[0]}]` : ''}`);
  if (!exit || !exit.pass) failures++;
  for (const row of results.exitCameraFlush || []) {
    console.log(`${row.pass ? 'PASS' : 'FAIL'} exit camera flush ${row.shape}: `
      + `zoom ${row.zoom?.[0]} -> ${row.zoom?.[1]}; `
      + `anchor ${row.anchor?.toFixed?.(1)} -> control ${row.controlTop?.toFixed?.(1)} -> final ${row.finalTop?.toFixed?.(1)}; `
      + `saved ${row.savedTop?.toFixed?.(1)}, resumed ${row.resumedTop?.toFixed?.(1)} `
      + `(door=${row.door}, restore=${row.cameraRestore}, writes control=${row.controlWrites?.join('/')}, `
      + `exit=${row.exitWrites?.join('/')}, uncaught=${row.uncaught?.length})`);
    if (!row.pass) failures++;
  }
  const total = results.length + 4 + (results.exitCameraFlush?.length || 0);
  console.log(`map-camera persistence: ${failures ? 'RED' : 'GREEN'} (${total - failures}/${total})`);
  process.exitCode = failures ? 1 : 0;
}
