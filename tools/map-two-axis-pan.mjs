#!/usr/bin/env node
// Issue #1168: the opt-in/default two-axis map camera moves horizontally and
// vertically for mouse, touch, and pen, persists both axes, and leaves nodes
// clickable. The legacy vertical-only path stays covered by map-pan-ownership.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ENTRY = process.argv.includes('--entry') ? process.argv[process.argv.indexOf('--entry') + 1] : '';
const WRITE_SHOTS = !process.argv.includes('--no-screenshots');
const BROWSER = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((path) => path && existsSync(path));
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
  { name: 'phone', width: 390, height: 844, scale: 3, mobile: true },
];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function connect(url) {
  const ws = new WebSocket(url); let id = 0; const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data); const job = pending.get(message.id);
    if (!job) return; pending.delete(message.id);
    message.error ? job.reject(new Error(message.error.message)) : job.resolve(message.result);
  });
  return {
    ready: new Promise((resolveReady, reject) => { ws.addEventListener('open', resolveReady); ws.addEventListener('error', reject); }),
    send(method, params = {}, sessionId) {
      const callId = ++id;
      return new Promise((resolveCall, reject) => {
        pending.set(callId, { resolve: resolveCall, reject });
        ws.send(JSON.stringify({ id: callId, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

if (!BROWSER) throw new Error('No Chrome or Edge found; set CHROME to a Chromium executable.');
const served = await serve({ root: ROOT, port: 8561, open: false });
const launched = await launchBrowser({ prefix: 'map-two-axis-', browser: BROWSER, timeoutMs: 12000 });
const cdp = connect(launched.wsUrl);
const rows = [];
try {
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(80); }
    throw new Error(`Timed out waiting for ${expression}`);
  };

  for (const viewport of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale, mobile: viewport.mobile,
    }, sessionId);
    await cdp.send('Page.navigate', { url: `${served.url}${ENTRY}?shot=map&shotSeed=SHOWCASE` }, sessionId);
    await until(`!!document.querySelector('.map-scroll[data-pan-axis="both"]')`);
    await evaluate(`for(let i=0;i<3;i++) document.querySelector('#zoom-in').click()`);
    await wait(150);

    const evidence = await evaluate(`(() => {
      const port = document.querySelector('.map-scroll');
      const maxLeft = port.scrollWidth - port.clientWidth;
      const maxTop = port.scrollHeight - port.clientHeight;
      const test = (pointerType, pointerId) => {
        port.scrollLeft = maxLeft / 2; port.scrollTop = maxTop / 2;
        const before = { left: port.scrollLeft, top: port.scrollTop };
        const send = (type, x, y) => port.dispatchEvent(new PointerEvent(type, {
          bubbles:true, cancelable:true, pointerType, pointerId, button:0,
          buttons:type === 'pointerup' || type === 'pointercancel' ? 0 : 1, clientX:x, clientY:y,
        }));
        send('pointerdown', 240, 360); send('pointermove', 180, 300);
        const moved = { left: port.scrollLeft, top: port.scrollTop, grabbed: port.classList.contains('grabbing') };
        send('pointerup', 180, 300);
        return { before, moved, cleaned: !port.classList.contains('grabbing') };
      };
      const mouse = test('mouse', 31), touch = test('touch', 32), pen = test('pen', 33);
      document.querySelector('#zoom-reset').click();
      port.scrollLeft = Math.min(maxLeft, port.scrollLeft + Math.min(80, maxLeft / 4));
      port.dispatchEvent(new Event('scroll'));
      const node = document.querySelector('.map-node.reachable');
      return {
        maxLeft, maxTop, touchAction:getComputedStyle(port).touchAction,
        mouse, touch, pen, nodeReachable:!!node,
        resting:{ left:port.scrollLeft, top:port.scrollTop },
      };
    })()`);
    await wait(180);

    // A HAND ON ⊙ BEATS A GLIDE ALREADY IN FLIGHT. The tween owns both axes for
    // `cameraMs` after a pick (content/config/ui/scenes/w4b-map.json: 150 ms of
    // open delay, then 300 ms of glide), and until #1229 only `glideTo` and
    // `teardown` ever cancelled its frame — so anything that wrote the camera by
    // hand inside that window was overwritten on the next frame and the glide
    // still landed on the picked node. ⊙ read as doing nothing at all.
    //
    // THE SHAPE IS DELIBERATELY ONE-SIDED: a runner so slow that the ⊙ click
    // lands AFTER the glide finished makes this check vacuous (⊙ from rest is
    // ⊙ from rest), never red. It can only fail if a glide really did outrank
    // the player's hand.
    const restingCamera = `(() => {
      const port = document.querySelector('.map-scroll');
      const box = port.querySelector('svg').getAttribute('viewBox').split(/\s+/);
      return { left: port.scrollLeft, top: port.scrollTop, x0: Number(box[0]) };
    })()`;
    await evaluate(`document.querySelector('#zoom-reset').click()`);
    await wait(600);
    const rest = await evaluate(restingCamera);
    await evaluate(`(() => {
      const lit = [...document.querySelectorAll('.map-node.reachable')];
      lit[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    })()`);
    await wait(200);
    await evaluate(`document.querySelector('#zoom-reset').click()`);
    await wait(900);
    const afterReset = await evaluate(restingCamera);
    // Back to nothing selected: a tap on the map away from the lit nodes closes
    // the tray (screens/map.js), so the pick below is a FIRST pick again rather
    // than the repeat that would travel into the room.
    await evaluate(`(() => {
      const port = document.querySelector('.map-scroll');
      port.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    })()`);
    await wait(700);

    // #1168'S OTHER HALF: THE CAMERA MOVING ITSELF. Everything above proves the
    // PLAYER can pan both axes; this proves the board can. Selecting a node
    // opens the tray and asks the camera to bring that node to the middle of
    // what the tray leaves visible (screens/map.js -> centerOnNode), and in
    // two-axis mode the horizontal camera is `scrollLeft` rather than the
    // viewBox — which is exactly the axis a `scrollLeft = 0` inside the glide
    // used to throw away, landing the act in the right half of the screen on
    // every pick. THE NODE IS THE RIGHTMOST LIT ONE AND THE CAMERA STARTS AT THE
    // FAR LEFT: the two ends of the axis, so the pick has the longest horizontal
    // journey this act affords and a camera that does nothing across cannot pass
    // by luck. Taking `.map-node.reachable` in document order would take
    // whichever column the generator happened to emit first, which on some seeds
    // is already near the middle — a gate whose strength varies with the seed is
    // not one.
    const pickedNode = await evaluate(`(() => {
      const port = document.querySelector('.map-scroll');
      port.scrollLeft = 0;
      port.dispatchEvent(new Event('scroll'));
      const lit = [...document.querySelectorAll('.map-node.reachable')];
      const centre = (n) => { const r = n.getBoundingClientRect(); return r.left + r.width / 2; };
      const target = lit.reduce((best, n) => (centre(n) > centre(best) ? n : best), lit[0]);
      // A <g> is not an HTMLElement: there is no .click() on it, and the board
      // listens for a plain bubbling click.
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return { id: target.dataset.node, lit: lit.length };
    })()`);
    await wait(1200);
    const picked = await evaluate(`(() => {
      const port = document.querySelector('.map-scroll');
      const node = document.querySelector('.map-node.selected');
      if (!node) return { selected: false };
      const pr = port.getBoundingClientRect();
      const nr = (node.querySelector('circle') || node).getBoundingClientRect();
      const reveal = document.querySelector('.map-tray-reveal');
      const rr = reveal ? reveal.getBoundingClientRect() : null;
      // THE CONTENT BOX, NOT THE BORDER BOX, AND IN THE RIGHT UNITS. Two
      // measuring errors dressed as camera errors live here:
      //   * a classic scrollbar (this port asks for scrollbar-width: thin, not
      //     overlay) takes layout width, so the middle of the BORDER box is half
      //     a scrollbar off the middle the camera aims at — 4.6 px across and
      //     5.2 px down at 1440x900, and 0 on a phone with overlay scrollbars.
      //   * clientWidth/clientHeight are LOCAL px (past --ui-zoom) and every
      //     rect here is DEVICE px. Subtracting one from the other is a 124 px
      //     lie at desktop's 1.2 and a 21 px one at the phone's 0.9.
      // So the content box is measured in local px and scaled into the rect's
      // space by the port's own border-box ratio.
      const sx = port.offsetWidth ? pr.width / port.offsetWidth : 1;
      const sy = port.offsetHeight ? pr.height / port.offsetHeight : 1;
      const right = pr.left + port.clientWidth * sx;
      const foot = pr.top + port.clientHeight * sy;
      // The tray's reveal panel is absolutely positioned over the foot of the
      // scrollport, so the band the player can actually see ends where it starts.
      const floor = rr && rr.height > 0 ? Math.min(foot, rr.top) : foot;
      return {
        selected: true,
        trayOpen: !!reveal && rr.height > 0,
        dx: (nr.left + nr.width / 2) - (pr.left + right) / 2,
        dy: (nr.top + nr.height / 2) - (pr.top + floor) / 2,
        node: node.dataset.node,
        scrollLeft: port.scrollLeft,
        maxLeft: port.scrollWidth - port.clientWidth,
        covered: rr ? Math.round(rr.height) : 0,
      };
    })()`);

    const moves = (sample) => Math.abs(sample.moved.left - sample.before.left - 60) < 1.5
      && Math.abs(sample.moved.top - sample.before.top - 60) < 1.5 && sample.moved.grabbed && sample.cleaned;
    const checks = {
      horizontalExtent: evidence.maxLeft > 100,
      verticalExtent: evidence.maxTop > 100,
      customTouchOwnership: evidence.touchAction === 'none',
      mouseMovesBothAxes: moves(evidence.mouse),
      touchMovesBothAxes: moves(evidence.touch),
      penMovesBothAxes: moves(evidence.pen),
      reachableNodeRemains: evidence.nodeReachable,
      resetOutranksAGlide: Math.abs(afterReset.left - rest.left) <= 2
        && Math.abs(afterReset.top - rest.top) <= 2
        && Math.abs(afterReset.x0 - rest.x0) <= 2,
      selectionOpensTray: picked.selected && picked.trayOpen,
      selectionTookTheNodePicked: picked.selected && picked.node === pickedNode.id,
      selectionCentersHorizontally: picked.selected && Math.abs(picked.dx) <= 2,
      selectionCentersVertically: picked.selected && Math.abs(picked.dy) <= 2,
    };
    const pass = Object.values(checks).every(Boolean);
    rows.push({ viewport: viewport.name, pass, checks, evidence: { ...evidence, rest, afterReset, pickedNode, picked } });

    if (WRITE_SHOTS) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
      const path = resolve(ROOT, 'docs', 'preview', `map-two-axis-pan-${viewport.name}.png`);
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, Buffer.from(shot.data, 'base64'));
    }
  }

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1200, height: 730, deviceScaleFactor: 1, mobile: false,
  }, sessionId);
  await cdp.send('Page.navigate', { url: `${served.url}${ENTRY}?shot=title` }, sessionId);
  await until(`!!document.querySelector('#settings')`);
  await evaluate(`document.querySelector('#settings').click()`);
  await until(`!!document.querySelector('.set-tab[data-member="Advanced"]')`);
  await evaluate(`document.querySelector('.set-tab[data-member="Advanced"]').click()`);
  await until(`!!document.querySelector('.set-subtab[data-advanced-group="Interface"]')`);
  await evaluate(`document.querySelector('.set-subtab[data-advanced-group="Interface"]').click()`);
  const setting = await evaluate(`(() => {
    const control = document.querySelector('[data-key="mapFreePan"]');
    const row = control && control.closest('.set-row');
    const before = control && control.getAttribute('aria-checked');
    control && control.click();
    const after = control && control.getAttribute('aria-checked');
    control && control.click();
    row && row.scrollIntoView({ block:'center' });
    return { present:!!control, before, after, restored:control && control.getAttribute('aria-checked'), text:row && row.textContent.trim() };
  })()`);
  const settingsChecks = {
    settingPresent: setting.present,
    defaultsOn: setting.before === 'true',
    togglesOff: setting.after === 'false',
    togglesBackOn: setting.restored === 'true',
    explainsBothAxes: /left and right.*up and down/i.test(setting.text || ''),
  };
  rows.push({ viewport: 'advanced-setting', pass: Object.values(settingsChecks).every(Boolean), checks: settingsChecks, evidence: setting });
  if (WRITE_SHOTS) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    const path = resolve(ROOT, 'docs', 'preview', 'map-two-axis-pan-setting.png');
    writeFileSync(path, Buffer.from(shot.data, 'base64'));
  }
} finally {
  cdp.close();
  await launched.close().catch(() => {});
  await new Promise((done) => served.server.close(done));
}

let failures = 0;
for (const row of rows) {
  console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.viewport}`);
  for (const [name, pass] of Object.entries(row.checks)) console.log(`  ${pass ? 'PASS' : 'FAIL'} ${name}`);
  if (!row.pass) { failures++; console.log(`  evidence ${JSON.stringify(row.evidence)}`); }
}
console.log(`map two-axis pan: ${failures ? 'RED' : 'GREEN'} (${rows.length - failures}/${rows.length})`);
process.exitCode = failures ? 1 : 0;
