#!/usr/bin/env node
// tools/textsize-baseline.mjs — #53's browser witness.
//
// Auto is the stylesheet-owned baseline. M is retained only as a legacy save
// alias, so both stored values must clear the inline root write; S/L/XL must
// still apply their explicit content values. The settings surface must expose
// Auto, S, L, XL and no visible M choice.

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
  if (!browserPath) { console.error('textsize-baseline UNKNOWN — no Chrome/Edge found'); return 2; }
  const server = await serve({ root: ROOT, port: 8275, open: false });
  const launched = await launchBrowser({ prefix: 'textsize-', browser: browserPath, timeoutMs: 15000 });
  const cdp = connectCdp(launched.wsUrl);
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sessionId);
    const read = async (settings) => {
      const encoded = encodeURIComponent(JSON.stringify(settings));
      await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=map&shotSettings=${encoded}` }, sessionId);
      let value = null;
      for (let attempt = 0; attempt < 50; attempt++) {
        const result = await cdp.send('Runtime.evaluate', {
          expression: `(() => ({ inline: document.documentElement.style.fontSize, computed: getComputedStyle(document.documentElement).fontSize, layout: document.documentElement.dataset.layout || null }))()`,
          returnByValue: true,
        }, sessionId);
        value = result.result?.value || null;
        if (value?.layout) return value;
        await new Promise((done) => setTimeout(done, 100));
      }
      return value;
    };
    const rows = {};
    for (const key of ['Auto', 'M', 'S', 'L', 'XL']) rows[key] = await read({ textSize: key });
    await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=profile` }, sessionId);
    let settingsMounted = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const probe = await cdp.send('Runtime.evaluate', {
        expression: `!!document.querySelector('[data-settings-host]')`, returnByValue: true,
      }, sessionId);
      settingsMounted = probe.result?.value === true;
      if (settingsMounted) break;
      await new Promise((done) => setTimeout(done, 100));
    }
    await cdp.send('Runtime.evaluate', {
      expression: `(() => { const tab=[...document.querySelectorAll('.set-tab')].find(x => x.textContent.trim() === 'Accessibility'); tab?.click(); return !!tab; })()`,
      returnByValue: true,
    }, sessionId);
    const settings = await cdp.send('Runtime.evaluate', {
      expression: `(() => { const row=[...document.querySelectorAll('.set-row')].find(x => x.querySelector('b')?.textContent.trim() === 'Text size'); return [...(row?.querySelectorAll('button.choice') || [])].map(x=>x.textContent.trim()); })()`,
      returnByValue: true,
    }, sessionId);
    const choices = settings.result?.value || [];
    const explicit = { S: '56.25%', L: '68.75%', XL: '75%' };
    const failures = [];
    for (const key of ['Auto', 'M']) if (rows[key]?.inline) failures.push(`${key} retained inline root font-size ${rows[key].inline}`);
    for (const [key, expected] of Object.entries(explicit)) if (rows[key]?.inline !== expected) failures.push(`${key} wrote ${rows[key]?.inline}, expected ${expected}`);
    if (JSON.stringify(choices) !== JSON.stringify(['AUTO', 'S', 'L', 'XL'])) failures.push(`visible choices were ${JSON.stringify(choices)}`);
    if (!settingsMounted) failures.push('settings probe did not mount');
    for (const [key, row] of Object.entries(rows)) console.log(`textsize ${key}: inline=${row?.inline || '(none)'} computed=${row?.computed || '?'}`);
    if (failures.length) { for (const failure of failures) console.error(`textsize-baseline RED — ${failure}`); return 1; }
    console.log('textsize-baseline GREEN — Auto/M clear the inline baseline; S/L/XL apply; visible choices exclude M');
    return 0;
  } finally {
    cdp.close();
    await launched.close();
    server.server.close();
  }
}

process.exit(await main());
