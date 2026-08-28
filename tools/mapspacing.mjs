#!/usr/bin/env node
// tools/mapspacing.mjs — measure adjacent map-floor pitch on the rendered map.
//
// ROW_H is not evidence. The delivered pitch is ROW_H × map zoom × --ui-zoom,
// and Fit may move the middle term when geometry changes. This instrument reads
// circle centres after layout at both claimed phone shapes, in both reveal
// modes, at the shipping percentage and at Fit. It also checks that every node
// the screen invites the player to press remains wholly in the scrollport.
//
// Usage:
//   node tools/mapspacing.mjs
//   node tools/mapspacing.mjs --dist
//   node tools/mapspacing.mjs --out evidence/map-spacing-after
//   node tools/mapspacing.mjs --mutate   # compresses node Y in the page; must red
//
// Exit 0 = every cell meets NODE_PITCH_MIN_PX and keeps invited nodes visible.
// With --mutate, exit 0 means the planted compression was caught.
//
// REMOVAL: delete when the act map no longer has adjacent floor rows, or when a
// broader rendered-geometry instrument measures this exact population (both
// phone shapes × fog/path × 115/Fit) and carries an observed-red compression.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { NODE_PITCH_MIN_PX } from '../src/model/mapview.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const mutate = args.includes('--mutate');
const useDist = args.includes('--dist');
const outArg = arg('--out');
const OUT = outArg ? resolve(ROOT, outArg) : null;

const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = BROWSERS.find((p) => existsSync(p));
const SHAPES = [
  { tag: '320x640', w: 320, h: 640, d: 3 },
  { tag: '390x844', w: 390, h: 844, d: 3 },
];
const MODES = ['fog', 'path'];
const ZOOMS = ['115', 'Fit'];
const SEED = 'SHOWCASE';
const POSITION = 'floor:4';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function cdpConnect(url) {
  const ws = new WebSocket(url);
  let id = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve: done, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : done(msg.result);
  });
  return {
    ready: new Promise((done, reject) => {
      ws.addEventListener('open', done);
      ws.addEventListener('error', reject);
    }),
    send(method, params = {}, sessionId) {
      const callId = id++;
      return new Promise((done, reject) => {
        pending.set(callId, { resolve: done, reject });
        ws.send(JSON.stringify({ id: callId, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

const PROBE = `(() => {
  const scroll = document.querySelector('.map-scroll');
  if (!scroll) return { error: 'no .map-scroll — map did not mount' };
  const port = scroll.getBoundingClientRect();
  const rows = new Map();
  const invited = [];
  for (const node of document.querySelectorAll('#map-nodes > .map-node')) {
    const match = /^n(\\d+)_/.exec(node.dataset.node || '');
    const circle = node.querySelector('circle:not(.node-halo)');
    if (!match || !circle) continue;
    const r = circle.getBoundingClientRect();
    const floor = Number(match[1]);
    const cy = (r.top + r.bottom) / 2;
    if (!rows.has(floor)) rows.set(floor, []);
    rows.get(floor).push(cy);
    if (node.matches('.current, .reachable')) {
      invited.push({
        id: node.dataset.node,
        whole: r.left >= port.left - 0.5 && r.right <= port.right + 0.5
          && r.top >= port.top - 0.5 && r.bottom <= port.bottom + 0.5,
      });
    }
  }
  const centres = [...rows].map(([floor, ys]) => ({
    floor,
    y: ys.reduce((sum, value) => sum + value, 0) / ys.length,
  })).sort((a, b) => a.floor - b.floor);
  const pairs = [];
  for (let i = 1; i < centres.length; i++) {
    if (centres[i].floor !== centres[i - 1].floor + 1) continue;
    pairs.push({ floors: [centres[i - 1].floor, centres[i].floor], px: Math.abs(centres[i].y - centres[i - 1].y) });
  }
  return {
    pairs,
    minPitch: pairs.length ? Math.min(...pairs.map((pair) => pair.px)) : null,
    invited: invited.length,
    invitedWhole: invited.filter((node) => node.whole).length,
    hiddenInvited: invited.filter((node) => !node.whole).map((node) => node.id),
    zoom: Number(scroll.dataset.framingZoom || 0),
    nodePx: Number(scroll.dataset.nodePx || 0),
    uiZoom: Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')),
    framing: scroll.dataset.framing || null,
    travel: [scroll.scrollWidth - scroll.clientWidth, scroll.scrollHeight - scroll.clientHeight],
  };
})()`;

async function main() {
  if (!browser) {
    console.error('mapspacing: no Chrome/Edge found; set CHROME or install a supported browser.');
    process.exit(2);
  }
  if (OUT) mkdirSync(OUT, { recursive: true });
  const served = useDist ? null : await serve({ root: ROOT, port: 8377, open: false });
  const base = useDist
    ? pathToFileURL(resolve(ROOT, 'dist', 'AshenSpire.html')).href
    : `http://127.0.0.1:${served.port}/index.html`;
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'mapspacing-', browser, headless: '--headless=new',
    args: ['--hide-scrollbars'],
    timeoutMs: 20000,
  });
  const cdp = cdpConnect(wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const evaluate = async (expression) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)).result.value;

  const rows = [];
  const findings = [];
  for (const shape of SHAPES) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: shape.w, height: shape.h, deviceScaleFactor: shape.d, mobile: true,
    }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    for (const mode of MODES) {
      for (const zoom of ZOOMS) {
        const settings = encodeURIComponent(JSON.stringify({ mapMode: mode, mapZoom: zoom }));
        const url = `${base}?shot=map&shotSeed=${SEED}&shotAt=${encodeURIComponent(POSITION)}&shotSettings=${settings}`;
        await cdp.send('Page.navigate', { url }, sessionId);
        let mounted = false;
        for (let i = 0; i < 80; i++) {
          if (await evaluate(`document.querySelectorAll('#map-nodes > .map-node').length > 1`)) { mounted = true; break; }
          await wait(120);
        }
        if (!mounted) {
          findings.push(`${shape.tag} ${mode} ${zoom}: map did not mount`);
          continue;
        }
        await wait(600);
        if (mutate) await evaluate(`document.querySelector('#map-nodes').setAttribute('transform', 'scale(1 0.5)')`);
        await wait(120);
        const reading = await evaluate(PROBE);
        if (!reading || reading.error || reading.minPitch == null) {
          findings.push(`${shape.tag} ${mode} ${zoom}: ${reading?.error || 'no adjacent rendered floors — measurement had no referent'}`);
          continue;
        }
        const row = { shape: shape.tag, mode, zoomSetting: zoom, ...reading };
        rows.push(row);
        if (reading.minPitch + 0.5 < NODE_PITCH_MIN_PX) {
          findings.push(`${shape.tag} ${mode} ${zoom}: ${reading.minPitch.toFixed(2)} px pitch < ${NODE_PITCH_MIN_PX} px floor`);
        }
        if (!reading.invited || reading.invitedWhole !== reading.invited) {
          findings.push(`${shape.tag} ${mode} ${zoom}: invited nodes on screen ${reading.invitedWhole}/${reading.invited}`
            + `${reading.hiddenInvited.length ? ` (${reading.hiddenInvited.join(', ')})` : ''}`);
        }
        if (OUT) {
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
          writeFileSync(resolve(OUT, `${shape.tag}-${mode}-${zoom.toLowerCase()}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
    }
  }

  console.log(`\nmapspacing — device-space adjacent-floor pitch (floor ${NODE_PITCH_MIN_PX}px)`);
  for (const row of rows) {
    console.log(`  ${row.shape} ${row.mode.padEnd(4)} ${row.zoomSetting.padEnd(3)} · pitch ${row.minPitch.toFixed(2).padStart(6)} px`
      + ` · zoom ${row.zoom.toFixed(3)} · ui ${row.uiZoom.toFixed(2)} · node ${row.nodePx.toFixed(1)} px`
      + ` · invited ${row.invitedWhole}/${row.invited} · travel ${row.travel.map((n) => Math.round(n)).join('/')}`);
  }
  if (!rows.length) findings.push('zero cells measured — never a pass');
  const caught = findings.length > 0;
  console.log(`\nBOUNDARY: headless Chromium on Windows; CSS-pixel geometry under CDP phone emulation, not a physical device.`);
  console.log(`  Seed ${SEED}, floor 4, two reveal modes, 115% and Fit. Centre pitch only; this does not judge visual composition.`);
  if (mutate) {
    console.log(`\n--mutate: ${caught ? `CAUGHT (${findings.length} finding(s)) — the instrument can go red.` : 'NOT CAUGHT — instrument is decoration.'}`);
  } else {
    console.log(`\n${findings.length ? `FAIL — ${findings.length} finding(s)` : `PASS — ${rows.length} cells measured`}`);
  }
  for (const finding of findings) console.log(`  - ${finding}`);
  if (OUT) {
    writeFileSync(resolve(OUT, 'measurements.json'), JSON.stringify({ floorPx: NODE_PITCH_MIN_PX, mutate, rows, findings }, null, 2));
    console.log(`  evidence: ${OUT}`);
  }

  cdp.close();
  await dropBrowser();
  if (served) served.server.close();
  process.exit(mutate ? (caught ? 0 : 2) : (findings.length ? 1 : 0));
}

main().catch((error) => {
  console.error(`mapspacing: ${error.stack || error.message}`);
  process.exit(2);
});
