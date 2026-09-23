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
// THE MOUNT BUDGET BELONGS TO THE ENTRY, NOT TO ONE NUMBER FOR BOTH DOORS.
//
// Every other wait below is an in-page transition — an overlay opening, a menu
// row answering, a screen remounting inside a document that is already up — and
// waitFor's 7 s default is generous for those. A wait that FOLLOWS A NAVIGATE
// is a different thing: it is the whole document coming up. Through the SOURCE
// entry (no --entry, which is what --selftest uses, because its plants go into
// src/) that means the unbundled ES-module graph plus one request for
// src/buildversion.js — and tools/serve.mjs stamps that module by re-deriving
// sourceDigest() over the entire tree ON EVERY REQUEST. That is deliberate and
// stays (see its comment: a stamp frozen at boot would name a source that is no
// longer there), but it is not free here.
//
// Measured on this Windows machine, 2026-09-17, against the real source mount:
// that one request costs 4.7-8.8 s on its own (2,386 files, 49 MB, of which
// assets/ is the bulk), it is synchronous, so every other module queues behind
// it, and the first map mount of a freshly checked-out tree took 23.3 s end to
// end. The 7 s default could not be met, so the tool timed out in its first
// wait and judged nothing — a red that was never about the camera.
//
// So a source-entry mount is given a budget measured against that mount: 45 s,
// about twice the slowest observed, which still fails in well under a minute
// when a mount is genuinely broken. The bundle entry (--entry) is served as one
// already-stamped file and keeps the 7 s default, so a real hang on that door
// still fails fast. Caching the digest per file would cut the warm cost but not
// this one — the first request of a run is always cold — so the budget is the
// fix and the cache is not.
const MOUNT_TIMEOUT_MS = ENTRY ? 7000 : 45000;

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
    // A mount wait — the first thing asked of a document that a Page.navigate
    // has just started. These carry the entry's budget; everything else stays
    // on waitFor's default.
    const waitForMount = (label, expression) => waitFor(label, expression, MOUNT_TIMEOUT_MS);
    // A trusted pointer press at the control's center — the player's tap, not
    // a scripted .click() — as startup-gate and title-new-slot drive the doors.
    const press = async (selector) => {
      const point = await evaluate(`(() => {
        const e = document.querySelector(${JSON.stringify(selector)});
        if (!e) return null;
        e.scrollIntoView({ block: 'center', inline: 'center' });
        const r = e.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`);
      if (!point) throw new Error(`missing ${selector}`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
      await wait(120);
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
        cameraViewport: port.dataset.cameraViewport || null,
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
      await waitForMount('the real map and its camera report', `(() => {
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

    // Fit is a VIEWPORT PROMISE, not a portable camera. The run this case owns
    // is the one the promise is for: a climb framed on a desktop, put down,
    // and picked up again on a phone. The saved fit must not be applied there.
    //
    // THE VIEWPORT CHANGES WHILE NO BOARD IS MOUNTED, and that is the whole
    // shape of this drive rather than a convenience. The earlier version
    // switched the emulation under a LIVE map and remounted through Armaments,
    // and it could not hold a verdict: map.js re-fits a live board on `resize`
    // two animation frames later, so the run may legitimately hold a
    // phone-solved fit by the time Armaments closes — `restored` is then the
    // RIGHT answer — and which of `restored` and `recomputed` landed depended
    // on whether those frames beat the tap, and on which stage of the emulated
    // resize's two-stage layout they caught. Measured on an unchanged tree it
    // flipped run to run, and with the guard itself removed the case still went
    // green, because the live re-fit had already replaced the desktop camera
    // this case exists to catch travelling. A plant that a race can rescue is
    // not a plant. Through the title there is no live board to re-fit anything:
    // what the phone mounts is exactly what the desktop wrote down.
    //
    // The exit is the player's own — Menu, then "Save & Quit to Title", the
    // same door the #243 case drives — because the saved camera is the subject
    // and only a real save writes one.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1200, height: 730, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await cdp.send('Page.navigate', {
      url: `${served.url}${ENTRY}?shot=map&shotSeed=SHOWCASE`,
    }, sessionId);
    await waitForMount('desktop fit camera', `(() => {
      const port = document.querySelector('.map-scroll');
      return !!(port && port.dataset.framing && port.dataset.cameraRestore
        && port.dataset.cameraViewport);
    })()`);
    await wait(220); // outlast the board's 120 ms camera backstop
    const desktopFit = await readState();
    await evaluate(`document.querySelector('#open-menu').click()`);
    await waitFor('the save-and-quit row in the quick menu',
      `!!document.querySelector('.qn-row[data-act="saveQuit"]')`);
    await evaluate(`document.querySelector('.qn-row[data-act="saveQuit"]').click()`);
    await waitFor('the title after Save & Quit', `(() => !document.querySelector('.map-scroll')
      && !!(document.querySelector('.startup-gate') || document.querySelector('.title-menu')))()`);
    // No map is mounted from here until Continue, so nothing can re-fit the
    // saved camera before the phone reads it back.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
    }, sessionId);
    await wait(220);
    await evaluate(`document.querySelector('.startup-gate')?.click()`);
    await waitFor('the folded title and its Continue door',
      `!!document.querySelector('.title-menu .slot-continue:not([disabled])')`);
    await evaluate(`document.querySelector('.title-menu .slot-continue').click()`);
    await waitFor('the phone map the desktop run resumed into', `(() => {
      const port = document.querySelector('.map-scroll');
      return !!(port && port.dataset.framing && port.dataset.cameraRestore
        && port.dataset.cameraViewport);
    })()`);
    await wait(220);
    const phoneFit = await readState();
    const solvedShape = (state) => {
      const [width, height] = String(state.cameraViewport || '').split('x').map(Number);
      return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null;
    };
    const desktopSolve = solvedShape(desktopFit);
    const phoneSolve = solvedShape(phoneFit);
    results.fitViewport = {
      // The shapes really did differ — without that there is nothing to own —
      // the desktop board was solved for the desktop it was on, the phone did
      // NOT take the saved camera as given, and what it is looking through was
      // measured against a viewport the phone can actually show.
      //
      // FITS IN, rather than matches exactly, and the asymmetry is the subject:
      // the harm in a travelling fit is a frame sized for a wider screen and so
      // cut off on a narrower one. An exact match would also fail the board for
      // solving against an early stage of this shape's OWN layout — the app
      // scales its root before the map settles, so a mount can land on 390x405
      // of an eventual 433x643 and never re-fit, `recenter`'s observer being
      // one-shot with no window `resize` to follow the app's own scaling. That
      // is a real wart — #1142 — and it is one shape mis-measuring itself rather
      // than a desktop camera on a phone, which is the property this case owns.
      // It belongs to that gate; folded in here it would only put this verdict
      // back on which layout stage the remount happened to catch.
      pass: desktopFit.viewportWidth > phoneFit.viewportWidth
        && !!desktopSolve && !!phoneSolve
        && Math.abs(desktopSolve.width - desktopFit.viewportWidth) <= 1
        && Math.abs(desktopSolve.height - desktopFit.viewportHeight) <= 1
        && phoneFit.cameraRestore === 'recomputed'
        && phoneSolve.width <= phoneFit.viewportWidth + 1
        && phoneSolve.height <= phoneFit.viewportHeight + 1
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
      document.querySelector('#map-enter')?.click(); // W4b: select, then Enter
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
    // The pan is the PLAYER'S wheel, not an assignment: this tool's own
    // boundary (the #38 cases above) is that writing scrollTop only proves
    // JavaScript can write a number, and the review at ea7cd5e held this case
    // to it. The drive wheels UP over the real scrollport's center — the
    // seeded slot restores at MAXIMUM scroll, so upward is the direction with
    // guaranteed headroom — and refuses a verdict unless the scroll event was
    // TRUSTED (isTrusted, which no synthetic dispatch can forge) AND the
    // camera moved a measured nonzero amount. Both shipped shapes. The
    // verdict stays narrow: reached, returned to title, zero uncaught.
    // Camera final-vs-resumed identity is #245's, not this case's.
    const exitShapeRows = [];
    for (const exitShape of [
      { name: '390x844', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
      { name: '1200x730', width: 1200, height: 730, deviceScaleFactor: 1, mobile: false },
    ]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: exitShape.width, height: exitShape.height,
        deviceScaleFactor: exitShape.deviceScaleFactor, mobile: exitShape.mobile,
      }, sessionId);
      await cdp.send('Page.navigate', { url: `${served.url}${ENTRY}?shot=title` }, sessionId);
      await waitForMount('the folded title and its Continue door', `(() => {
        const button = document.querySelector('.title-menu .slot-continue:not([disabled])');
        return !!button && /continue/i.test(button.textContent);
      })()`);
      await evaluate(`[...document.querySelectorAll('button')].find((b) => /continue/i.test(b.textContent)).click()`);
      await waitFor('the map after Continue', `!!document.querySelector('.map-scroll')`);
      await wait(300); // outlast the camera backstop so the restore cannot race the wheel below
      exceptionsSeen.length = 0; // the ?shot=title boot is its own observation; only the exit is on trial
      const exitPoint = await evaluate(`(() => {
        const port = document.querySelector('.map-scroll');
        const r = port.getBoundingClientRect();
        window.__exitPanBefore = port.scrollTop;
        window.__exitPanTrusted = null;
        port.addEventListener('scroll', (ev) => {
          if (window.__exitPanTrusted === null) window.__exitPanTrusted = ev.isTrusted;
        }, { once: true });
        return {
          x: r.left + r.width * 0.5, y: r.top + r.height * 0.5,
          maxScrollTop: Math.max(0, port.scrollHeight - port.clientHeight),
        };
      })()`);
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: exitPoint.x,
        y: exitPoint.y,
        deltaX: 0,
        deltaY: -220, // UP: the seeded camera stands at max, so headroom is above
      }, sessionId);
      const exitDrive = await evaluate(`(async () => {
        const rest = (ms) => new Promise((done) => setTimeout(done, ms));
        const port = document.querySelector('.map-scroll');
        const before = window.__exitPanBefore;
        // The wheel lands asynchronously — a compositor frame after the CDP
        // dispatch resolves. Anchor to the scroll EVENT, not to this drive's
        // own clock: wait (bounded) for the trusted event to fire, then time
        // the quit from it, so the 80 ms race is measured from the moment the
        // board armed its timer.
        const t0 = performance.now();
        while (window.__exitPanTrusted === null && performance.now() - t0 < 500) await rest(5);
        const panDelta = port.scrollTop - before; // measured, not assumed
        const trusted = window.__exitPanTrusted;  // the browser's own word — no synthetic dispatch can forge it
        await rest(45);                          // + ~10 ms of menu rests puts the quit ~55-65 ms after the scroll event — inside the 80 ms window, off the line
        document.querySelector('#open-menu').click(); await rest(5);
        const quit = document.querySelector('.qn-row[data-act="saveQuit"]');
        if (!quit) return { reached: false, panDelta, trusted };
        quit.click();
        await rest(400);                         // outlast the debounce and the save
        return { reached: true, before, panDelta, trusted, onTitle: !!document.querySelector('.startup-gate') };
      })()`);
      await wait(120); // let any exceptionThrown event cross the wire before the verdict
      exitShapeRows.push({
        shape: exitShape.name,
        pass: !!(exitDrive && exitDrive.reached && exitDrive.onTitle
          && exitDrive.trusted === true && Math.abs(exitDrive.panDelta) > 0
          && exitPoint.maxScrollTop > 20 && exceptionsSeen.length === 0),
        exit: exitDrive,
        maxScrollTop: exitPoint.maxScrollTop,
        uncaught: [...exceptionsSeen],
      });
    }
    results.mapExitDuringDebounce = {
      pass: exitShapeRows.length === 2 && exitShapeRows.every((row) => row.pass),
      shapes: exitShapeRows,
      exit: exitShapeRows[0]?.exit,
      uncaught: exitShapeRows.flatMap((row) => row.uncaught),
    };

    // #245: a trusted final wheel-pan inside the 80 ms window must already be
    // present in the in-memory run when Save & Quit performs its one durable
    // write. The delayed connected-board commit remains the only other save.
    results.exitCameraFlush = [];
    for (const shape of [
      { name: '390x844', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
      { name: '1200x730', width: 1200, height: 730, deviceScaleFactor: 1, mobile: false },
    ]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width, height: shape.height,
        deviceScaleFactor: shape.deviceScaleFactor, mobile: shape.mobile,
      }, sessionId);
      await evaluate(`localStorage.clear()`);
      await cdp.send('Page.navigate', { url: `${served.url}${ENTRY}` }, sessionId);
      await waitForMount('the startup gate (flush case)', `!!document.querySelector('.startup-gate')`);
      await evaluate(`document.querySelector('.startup-gate').click()`);
      await waitFor('the real folded title (flush case)', `!!document.querySelector('.title-menu .slot-new')`);
      await evaluate(`document.querySelector('.title-menu .slot-new').click()`);
      await waitFor('the new-slot modal (flush case)', `!!document.querySelector('[data-title-action="modal-continue"]:not([disabled])')`);
      await press('[data-title-action="modal-continue"]');
      // Continue only opens the slot's decision door ("Start in slot n?"); its
      // primary, Start (review-new), is the press that commits the new climb.
      await waitFor('the new-slot decision door (flush case)', `!!document.querySelector('[data-title-action="review-new"]:not([disabled])')`);
      await press('[data-title-action="review-new"]');
      await waitFor('character creation (flush case)', `!!document.querySelector('#cz-start:not([disabled])')`);
      // Creation is gated step by step (781da54a): Begin refuses until a class,
      // a stat mode, a keepsake and starting armour are chosen. Walk the steps
      // a player walks — the first class, Standard stats, the first keepsake,
      // the first armour — opening each fold before tapping inside it.
      const openFace = async (key) => {
        const expanded = await evaluate(`document.querySelector('[data-face="${key}"]')?.getAttribute('aria-expanded') === 'true'`);
        if (!expanded) await press(`[data-face="${key}"]`);
      };
      await openFace('class');
      await press('.cz-class');
      await openFace('character');
      await openFace('primary');
      await evaluate(`(() => { const select = document.querySelector('#cz-statedit .cc-mode-select'); select.value = 'standard'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await openFace('keepsake');
      await press('#cz-keepsakes [data-keepsake-id]');
      await openFace('equipment');
      await openFace('armour');
      await press('#cz-armours .equip-chip .equipment-poker-card');
      await press('#cz-armours .equip-chip .equipment-choose');
      await openFace('seed');
      await waitFor('Begin to accept the finished character (flush case)', `(() => {
        const begin = document.querySelector('#cz-start');
        return !!begin && begin.getAttribute('aria-disabled') !== 'true';
      })()`, 3000).catch(async (error) => {
        const refusal = await evaluate(`document.querySelector('#cz-start')?.dataset.refusal || null`);
        throw new Error(`${error.message}; Begin refuses: ${JSON.stringify(refusal)}`);
      });
      await press('#cz-start');
      await waitFor('the new run map (flush case)', `!!(document.querySelector('.map-scroll') && document.querySelector('#zoom-in'))`);
      await wait(300);
      exceptionsSeen.length = 0;

      const zoomBefore = await evaluate(`Number(document.querySelector('.map-scroll').dataset.framingZoom)`);
      await evaluate(`document.querySelector('#zoom-in').click()`);
      await wait(250);
      let zoomAfter = await evaluate(`Number(document.querySelector('.map-scroll').dataset.framingZoom)`);
      if (Math.abs(zoomAfter - zoomBefore) <= 0.0005) {
        await evaluate(`document.querySelector('#zoom-out').click()`);
        await wait(250);
        zoomAfter = await evaluate(`Number(document.querySelector('.map-scroll').dataset.framingZoom)`);
      }

      await evaluate(`(() => {
        window.__runWrites = 0;
        const put = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === 'sote_run_v1') window.__runWrites += 1;
          return put.call(this, key, value);
        };
      })()`);
      const anchor = await evaluate(`(() => {
        const port = document.querySelector('.map-scroll');
        const max = Math.max(0, port.scrollHeight - port.clientHeight);
        port.scrollTop = Math.round(max * 0.6);
        port.dispatchEvent(new Event('scroll'));
        return { top: port.scrollTop, max };
      })()`);
      await wait(250);

      const control = await evaluate(`(() => {
        window.__runWrites = 0;
        const port = document.querySelector('.map-scroll');
        port.scrollTop = Math.max(0, port.scrollTop - 40);
        port.dispatchEvent(new Event('scroll'));
        return { top: port.scrollTop, immediateWrites: window.__runWrites };
      })()`);
      await wait(250);
      const controlAfter = await evaluate(`window.__runWrites`);

      const finalPoint = await evaluate(`(() => {
        window.__runWrites = 0;
        const port = document.querySelector('.map-scroll');
        const r = port.getBoundingClientRect();
        window.__flushTrusted = null;
        window.__flushBefore = port.scrollTop;
        port.addEventListener('scroll', (event) => {
          if (window.__flushTrusted === null) window.__flushTrusted = event.isTrusted;
        }, { once: true });
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
      })()`);
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: finalPoint.x, y: finalPoint.y,
        deltaX: 0, deltaY: -220,
      }, sessionId);
      const drive = await evaluate(`(async () => {
        const rest = (ms) => new Promise((done) => setTimeout(done, ms));
        const started = performance.now();
        while (window.__flushTrusted === null && performance.now() - started < 500) await rest(5);
        const port = document.querySelector('.map-scroll');
        const finalTop = port.scrollTop;
        const panDelta = finalTop - window.__flushBefore;
        const immediateWrites = window.__runWrites;
        await rest(45);
        document.querySelector('#open-menu').click(); await rest(5);
        const quit = document.querySelector('.qn-row[data-act="saveQuit"]');
        if (!quit) return { reached: false, finalTop, panDelta };
        quit.click();
        await rest(400);
        return {
          reached: true, finalTop, panDelta, trusted: window.__flushTrusted,
          immediateWrites, onTitle: !!document.querySelector('.startup-gate'),
          quitWrites: window.__runWrites,
        };
      })()`);
      await wait(200);
      const settled = await evaluate(`({
        writes: window.__runWrites,
        savedTop: (() => {
          try { return JSON.parse(localStorage.getItem('sote_run_v1')).mapView.scrollTop; }
          catch { return null; }
        })(),
      })`);
      await waitFor('the collapsed title threshold (flush case)', `!!document.querySelector('.startup-gate')`);
      await evaluate(`document.querySelector('.startup-gate').click()`);
      await waitFor('the resumed title menu (flush case)', `!!document.querySelector('.title-menu .slot-continue:not([disabled])')`);
      await evaluate(`document.querySelector('.title-menu .slot-continue:not([disabled])').click()`);
      await waitFor('the resumed map (flush case)', `!!document.querySelector('.map-scroll')`);
      await wait(300);
      const resumed = await readState();
      await wait(120);
      const uncaught = [...exceptionsSeen];
      const manualMove = Number.isFinite(zoomBefore) && Number.isFinite(zoomAfter)
        && Math.abs(zoomAfter - zoomBefore) > 0.0005;
      const observable = Math.abs(drive.panDelta) > 20 && Math.abs(control.top - drive.finalTop) > 20;
      const savedIdentity = settled.savedTop != null && Math.abs(settled.savedTop - drive.finalTop) < 1.5;
      const resumedIdentity = Math.abs(resumed.scrollTop - drive.finalTop) < 1.5;
      results.exitCameraFlush.push({
        shape: shape.name,
        pass: !!(drive.reached && drive.onTitle && drive.trusted === true && manualMove && observable
          && anchor.max > 20 && control.immediateWrites === 0 && controlAfter === 1
          && drive.immediateWrites === 0 && drive.quitWrites === 1 && settled.writes === 1
          && savedIdentity && resumedIdentity && resumed.cameraRestore === 'restored' && uncaught.length === 0),
        zoom: [zoomBefore, zoomAfter], anchor: anchor.top, controlTop: control.top,
        finalTop: drive.finalTop, savedTop: settled.savedTop, resumedTop: resumed.scrollTop,
        panDelta: drive.panDelta, trusted: drive.trusted,
        controlWrites: [control.immediateWrites, controlAfter],
        exitWrites: [drive.immediateWrites, drive.quitWrites, settled.writes],
        cameraRestore: resumed.cameraRestore, uncaught,
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
    await waitForMount('zero-height map scrollport mount', `!!document.querySelector('.map-scroll')`);
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
    const nodeSeam = "    if (isReachable && viewer.onPick) el.addEventListener('click', () => viewer.onPick(n.id, { shownType, revealed }));";
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
      .replace(nodeSeam, "    if (isReachable && viewer.onPick) el.addEventListener('click', () => { run.mapNodeId = n.id; viewer.onPick(n.id, { shownType, revealed }); });")
      .replace(exitSeam, ''));
    const ownership = await runProbe(tempRoot, { screenshots: false });
    const fitCaught = ownership.fitViewport && !ownership.fitViewport.pass;
    const raceCaught = ownership.debounceRace && !ownership.debounceRace.pass;
    const settleCaught = ownership.zeroHeightSettle && !ownership.zeroHeightSettle.pass;
    const exitRows = ownership.mapExitDuringDebounce?.shapes || [];
    const exitCaught = ownership.mapExitDuringDebounce && !ownership.mapExitDuringDebounce.pass
      && exitRows.length === 2
      && exitRows.every((row) => !row.pass && row.uncaught.some((u) => /streamCounters/.test(u)));
    console.log(`map-camera ownership selftest: ${fitCaught && raceCaught && settleCaught && exitCaught ? 'GREEN' : 'RED'} - `
      + `viewport ${fitCaught ? 'caught' : 'MISSED'}, debounce ${raceCaught ? 'caught' : 'MISSED'}, `
      + `zero-height settle ${settleCaught ? 'caught' : 'MISSED'}, `
      + `map exit ${exitCaught ? 'caught' : 'MISSED'} (${ownership.mapExitDuringDebounce?.uncaught?.[0] || 'no uncaught error'})`);
    if (!fitCaught || !raceCaught || !settleCaught || !exitCaught) process.exitCode = 1;

    writeFileSync(boardPath, board);
    const flushSeam = '    emitViewState(false, pendingViewCommit);\n';
    if (!board.includes(flushSeam)) throw new Error('selftest plant refused: synchronous camera hand-over seam is absent');
    writeFileSync(boardPath, board.replace(flushSeam, ''));
    const flushless = await runProbe(tempRoot, { screenshots: false });
    const flushRows = flushless.exitCameraFlush || [];
    const flushCaught = flushRows.length === 2 && flushRows.every((row) => !row.pass
      && row.uncaught.length === 0
      && Math.abs(row.savedTop - row.finalTop) > 20
      && Math.abs(row.resumedTop - row.finalTop) > 20);
    const guardHeld = !!flushless.mapExitDuringDebounce?.pass;
    console.log(`map-camera flush selftest: ${flushCaught && guardHeld ? 'GREEN' : 'RED'} - `
      + `hand-over removal ${flushCaught ? 'caught by identity' : 'MISSED'}, `
      + `detached-board guard ${guardHeld ? 'held green' : 'WENT RED'}`);
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
  // THE DENOMINATOR COUNTS ITSELF. `judged` rises where a judgement is MADE,
  // so the total is what ran. It was `results.length + 4 + ...`, and that 4 was
  // a second copy of the four single checks below: add a fifth and the
  // denominator stays 4, so the line reports a fraction nobody computed.
  let judged = 0;
  const judge = (ok) => { judged += 1; if (!ok) failures += 1; };
  for (const row of results) {
    console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.viewport}: `
      + `zoom ${row.before.zoom} -> ${row.after.zoom}; `
      + `pan [${row.before.scrollLeft.toFixed(1)},${row.before.scrollTop.toFixed(1)}] -> `
      + `[${row.after.scrollLeft.toFixed(1)},${row.after.scrollTop.toFixed(1)}]`);
    judge(row.pass);
  }
  const fit = results.fitViewport;
  console.log(`${fit && fit.pass ? 'PASS' : 'FAIL'} fit viewport ownership: `
    + `${fit ? fit.before.viewportWidth : '?'}x${fit ? fit.before.viewportHeight : '?'} `
    + `(solved ${fit ? fit.before.cameraViewport : '?'}) -> `
    + `${fit ? fit.after.viewportWidth : '?'}x${fit ? fit.after.viewportHeight : '?'} `
    + `(solved ${fit ? fit.after.cameraViewport : '?'}); `
    + `restore=${fit ? fit.after.cameraRestore : '?'}`);
  judge(fit && fit.pass);
  const race = results.debounceRace;
  console.log(`${race && race.pass ? 'PASS' : 'FAIL'} debounced node ownership: `
    + `${race ? race.race?.from : '?'} -> ${race ? race.race?.to : '?'}; `
    + `committed view=${race ? race.committedViewNode : '?'}`);
  judge(race && race.pass);
  const settle = results.zeroHeightSettle;
  console.log(`${settle && settle.pass ? 'PASS' : 'FAIL'} zero-height settlement: `
    + `${settle ? settle.before.viewportHeight : '?'} -> ${settle ? settle.after.viewportHeight : '?'}; `
    + `framing=${settle ? settle.after.framing : '?'}, miss=${settle ? settle.after.framingMiss : '?'}`);
  judge(settle && settle.pass);
  const exit = results.mapExitDuringDebounce;
  console.log(`${exit && exit.pass ? 'PASS' : 'FAIL'} map exit during debounce: `
    + (exit && exit.shapes ? exit.shapes.map((row) => `${row.shape}: reached=${!!row.exit?.reached}, `
      + `trusted=${row.exit?.trusted}, before=${row.exit?.before}, panDelta=${row.exit?.panDelta}, max=${row.maxScrollTop}, onTitle=${!!row.exit?.onTitle}, `
      + `uncaught=${row.uncaught.length}`).join(' · ') : '?')
    + `${exit && exit.uncaught.length ? ` [${exit.uncaught[0]}]` : ''}`);
  judge(exit && exit.pass);
  for (const row of results.exitCameraFlush || []) {
    console.log(`${row.pass ? 'PASS' : 'FAIL'} exit camera flush ${row.shape}: `
      + `zoom ${row.zoom?.[0]} -> ${row.zoom?.[1]}; `
      + `anchor ${row.anchor?.toFixed?.(1)} -> control ${row.controlTop?.toFixed?.(1)} -> final ${row.finalTop?.toFixed?.(1)}; `
      + `saved ${row.savedTop?.toFixed?.(1)}, resumed ${row.resumedTop?.toFixed?.(1)}; `
      + `trusted=${row.trusted}, panDelta=${row.panDelta?.toFixed?.(1)}, `
      + `writes control=${row.controlWrites?.join('/')}, exit=${row.exitWrites?.join('/')}, `
      + `restore=${row.cameraRestore}, uncaught=${row.uncaught?.length}`);
    judge(row.pass);
  }
  const total = judged;
  console.log(`map-camera persistence: ${failures ? 'RED' : 'GREEN'} (${total - failures}/${total})`);
  process.exitCode = failures ? 1 : 0;
}
