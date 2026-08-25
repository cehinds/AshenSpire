#!/usr/bin/env node
// The Controls tab is the overlay's longest phone composition. Exercise the
// real Quick Menu door, measure the rendered rows, and scroll the real panel to
// its end so a fixed save footer cannot conceal the final binding.

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'controls-menu-fit.mjs',
    timeoutMs: 300000,
    plants: [{
      name: 'mobile bindings fall back to mixed side-by-side and stacked rows',
      file: 'styles/ui.css',
      find: `  .controls-screen .rebind-row {
    flex-direction: column; align-items: stretch; gap: 8px; padding: 10px;
  }
  .controls-screen .rebind-row > :first-child { flex: 0 0 auto; min-width: 0; }
  .controls-screen .rebind-ctl {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: 100%;
  }`,
      replace: `  .controls-screen .rebind-row { align-items: center; gap: 8px; padding: 10px; }
  .controls-screen .rebind-row > :first-child { min-width: min(14rem, 100%); }
  .controls-screen .rebind-ctl { display: flex; gap: 8px; width: auto; }`,
      expectRed: /FAIL .*mobile rows share one stacked composition/,
    }],
  }));
}

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACT = process.argv.includes('--artifact');
const BROWSER = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((path) => path && existsSync(path));
const SHAPES = [
  { width: 320, height: 640, mobile: true, textSize: 'XL' },
  { width: 390, height: 844, mobile: true, textSize: 'M' },
  { width: 390, height: 844, mobile: true, textSize: 'XL' },
  { width: 1200, height: 730, mobile: false, textSize: 'M' },
];
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolveCall, rejectCall } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) rejectCall(new Error(message.error.message));
    else resolveCall(message.result);
  });
  return {
    ready: new Promise((resolveReady, rejectReady) => {
      socket.addEventListener('open', resolveReady);
      socket.addEventListener('error', rejectReady);
    }),
    Send(method, params = {}, sessionId = null) {
      const id = nextId++;
      return new Promise((resolveCall, rejectCall) => {
        pending.set(id, { resolveCall, rejectCall });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    Close() { socket.close(); },
  };
}

if (!BROWSER) {
  console.error('controls-menu-fit: UNKNOWN — no Chrome or Edge browser found');
  process.exit(2);
}

const failures = [];
let checks = 0;
const Check = (condition, shape, message) => {
  checks++;
  if (condition) console.log(`  PASS ${shape} — ${message}`);
  else {
    failures.push(`${shape} — ${message}`);
    console.log(`  FAIL ${shape} — ${message}`);
  }
};

const server = await serve({ root: ROOT, port: 8488, open: false });
const appUrl = `${server.url}${ARTIFACT ? 'AshenSpire.html' : ''}`;
let browser = null;
let cdp = null;
try {
  browser = await launchBrowser({ prefix: 'controls-menu-', browser: BROWSER, timeoutMs: 15000 });
  cdp = connectCdp(browser.wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.Send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.Send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.Send('Page.enable', {}, sessionId);
  await cdp.Send('Runtime.enable', {}, sessionId);
  const Evaluate = async (expression) => {
    const result = await cdp.Send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page exception');
    return result.result.value;
  };
  const Until = async (expression, description) => {
    const started = Date.now();
    while (Date.now() - started < 15000) {
      if (await Evaluate(expression).catch(() => false)) return;
      await wait(100);
    }
    throw new Error(`timed out waiting for ${description}`);
  };

  for (const shape of SHAPES) {
    const tag = `${shape.width}x${shape.height} Text ${shape.textSize}`;
    await cdp.Send('Emulation.setDeviceMetricsOverride', {
      width: shape.width, height: shape.height, deviceScaleFactor: shape.mobile ? 3 : 1, mobile: shape.mobile,
    }, sessionId);
    await cdp.Send('Emulation.setTouchEmulationEnabled', { enabled: shape.mobile, maxTouchPoints: shape.mobile ? 5 : 1 }, sessionId);
    const settings = encodeURIComponent(JSON.stringify({ quickNav: 'mirror', textSize: shape.textSize }));
    await cdp.Send('Page.navigate', { url: `${appUrl}?shot=map&shotSettings=${settings}` }, sessionId);
    await Until(`!!document.querySelector('.map-node')`, 'the map');
    await Evaluate(`document.querySelector('#open-menu').click(); true`);
    await Until(`!!document.querySelector('.qn-panel')`, 'the Quick Menu');
    await Evaluate(`document.querySelector('.qn-row[data-tab="controls"]').click(); true`);
    await Until(`!!document.querySelector('.controls-screen')`, 'the Controls tab');
    await wait(150);

    const reading = await Evaluate(`(() => {
      const Box=(element)=>{const rect=element&&element.getBoundingClientRect();return rect&&{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};};
      const body=document.querySelector('.overlay-body'), footer=document.querySelector('.overlay-footer');
      const intro=document.querySelector('.controls-intro'), bindings=document.querySelector('.controls-bindings');
      const rows=[...document.querySelectorAll('.rebind-row')];
      const rowShape=rows.map(row=>{const rowBox=Box(row), label=Box(row.firstElementChild), controls=Box(row.querySelector('.rebind-ctl'));
        return {stacked:label.bottom<=controls.top+0.5, inside:controls.left>=rowBox.left-0.5&&controls.right<=rowBox.right+0.5};});
      const bodyBox=Box(body), footerBox=Box(footer), introBox=Box(intro), bindingsBox=Box(bindings);
      body.scrollTop=body.scrollHeight;
      const last=Box(rows.at(-1)), note=Box(document.querySelector('.controls-rebind-note'));
      return {layout:document.documentElement.dataset.layout, rows:rows.length,
        sectionGap:bindingsBox.top-introBox.bottom, allStacked:rowShape.every(row=>row.stacked),
        rowsInside:rowShape.every(row=>row.inside), horizontalOverflow:body.scrollWidth-body.clientWidth,
        bodyBeforeFooter:bodyBox.bottom<=footerBox.top+0.5,
        atEnd:Math.abs(body.scrollTop-(body.scrollHeight-body.clientHeight))<=1,
        lastClear:last.bottom<=bodyBox.bottom+0.5, noteClear:note.bottom<=bodyBox.bottom+0.5};
    })()`);

    Check(reading.rows === 10 && reading.sectionGap >= 2, tag,
      `Navigation and Bindings remain separate (${reading.rows} rows, ${reading.sectionGap.toFixed(1)}px gap)`);
    Check(reading.layout !== 'narrow' || reading.allStacked, tag,
      reading.layout === 'narrow' ? 'mobile rows share one stacked composition' : 'wide composition remains available');
    Check(reading.rowsInside && reading.horizontalOverflow <= 0.5, tag,
      `bindings remain inside their rows (${reading.horizontalOverflow.toFixed(1)}px horizontal overflow)`);
    Check(reading.bodyBeforeFooter && reading.atEnd && reading.lastClear && reading.noteClear, tag,
      'the final binding and instruction scroll clear of the save footer');
  }
} catch (error) {
  console.error(`controls-menu-fit: UNKNOWN — ${error.message}`);
  process.exitCode = 2;
} finally {
  cdp?.Close();
  await browser?.close();
  server.server.close();
}

if (!process.exitCode) {
  console.log(`\ncontrols-menu-fit: ${failures.length ? `RED — ${failures.length} finding(s)` : `OK — ${checks}/${checks} checks passed`}`);
  process.exitCode = failures.length ? 1 : 0;
}
