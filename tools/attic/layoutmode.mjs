#!/usr/bin/env node
// tools/layoutmode.mjs — #39's focused browser witness.
//
// A height-only resize may change the fit zoom, but it must not change the
// composition mode. This drives the real boot at the same width through a
// 45%-loss height sweep and checks the published data-layout attribute.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserPath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find(existsSync);

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve: done, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else done(msg.result);
  });
  return {
    ready: new Promise((done, fail) => { ws.addEventListener('open', done); ws.addEventListener('error', fail); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((done, reject) => {
        pending.set(id, { resolve: done, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function main() {
  if (!browserPath) { console.error('layoutmode UNKNOWN — no Chrome/Edge found'); return 2; }
  const server = await serve({ root: ROOT, port: 8274, open: false });
  const launched = await launchBrowser({ prefix: 'layoutmode-', browser: browserPath, timeoutMs: 15000 });
  const cdp = connectCdp(launched.wsUrl);
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    const heights = [844, 675, 506, 464];
    const rows = [];
    const readLayout = async () => {
      const result = await cdp.send('Runtime.evaluate', {
        expression: `(() => ({ layout: document.documentElement.dataset.layout || null, zoom: document.documentElement.style.getPropertyValue('--ui-zoom') || null, width: innerWidth, height: innerHeight }))()`,
        returnByValue: true,
      }, sessionId);
      return result.result?.value || {};
    };
    for (const height of heights) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 3, mobile: true }, sessionId);
      await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=map` }, sessionId);
      let row = {};
      for (let attempt = 0; attempt < 50; attempt++) {
        row = await readLayout();
        if (row.layout) break;
        await new Promise((done) => setTimeout(done, 100));
      }
      rows.push({ height, ...row });
    }
    const layouts = [...new Set(rows.map((row) => row.layout))];
    const ok = layouts.length === 1 && layouts[0] === 'narrow';
    for (const row of rows) console.log(`layoutmode ${row.width}x${row.height}: ${row.layout} (zoom ${row.zoom})`);
    if (!ok) { console.error(`layoutmode RED — height-only sweep changed mode: ${layouts.join(', ')}`); return 1; }
    console.log('layoutmode GREEN — 390px width stayed narrow through a 45% height loss');
    return 0;
  } finally {
    cdp.close();
    await launched.close();
    server.server.close();
  }
}

process.exit(await main());
