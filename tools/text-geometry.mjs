#!/usr/bin/env node
// tools/text-geometry.mjs — Law 4: Text size owns text, not component geometry.
//
// This gate enters through the real title screen, opens character customization,
// applies the product's canonical Text M and XL values, and measures rendered
// typography, the primary action, and a real class sprite at 390x844 and
// 412x915. It passes only when the type grows while the action floor and sprite
// stay unchanged and the action remains at least 44 px on glass.
//
// Usage:
//   node tools/text-geometry.mjs
//   node tools/text-geometry.mjs --artifact AshenSpire.html
//   node tools/text-geometry.mjs --shots docs/preview/text-geometry-source
//   node tools/text-geometry.mjs --selftest
//
// BOUNDARY: one Chromium engine, two phone-shaped viewports, the customization
// state, and Text M/XL. It does not judge copy wrapping, legibility, touch input,
// every control, or every sprite tier. Source ownership checks cover the other
// migrated floors; actionreach owns the wider responsive grid.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { balance } from '../src/content/balance.js';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'text-geometry.mjs',
    timeoutMs: 240000,
    plants: [
      {
        name: 'the primary action floor follows root Text size again',
        file: 'styles/ui.css',
        find: '.cz-actions button { min-height: var(--tap-floor); height: auto; }',
        replace: '.cz-actions button { min-height: 4.4rem; height: auto; }',
        expectRed: /action floor changed with Text size/,
      },
      {
        name: 'sprite dimensions are emitted as rem again',
        file: 'src/ui/assets.js',
        find: 'const px = (value) => `${value}px`;',
        replace: 'const px = (value) => `${value / 10}rem`;',
        expectRed: /sprite geometry changed with Text size/,
      },
      {
        name: 'the ergonomic floor falls below 44 px on glass',
        file: 'styles/base.css',
        find: '--tap-floor: calc(var(--tap-target) / var(--ui-zoom, 1));',
        replace: '--tap-floor: calc(36px / var(--ui-zoom, 1));',
        expectRed: /tap floor below 44px on glass/,
      },
    ],
  }));
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const artifactArg = argOf('--artifact');
const useDist = args.includes('--dist');
const artifact = artifactArg ? resolve(ROOT, artifactArg)
  : useDist ? resolve(ROOT, 'dist/AshenSpire.html') : null;
const shotBase = argOf('--shots');
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const browserPath = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p));

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const pair = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? pair.no(new Error(msg.error.message)) : pair.ok(msg.result);
  };
  return {
    ready: new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; }),
    send(method, params = {}, sessionId) {
      const call = ++id;
      return new Promise((ok, no) => {
        pending.set(call, { ok, no });
        ws.send(JSON.stringify({ id: call, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function main() {
  if (!browserPath) {
    console.error('text-geometry: UNKNOWN — no Chrome/Chromium found; nothing was rendered.');
    return 2;
  }
  let server = null;
  let base;
  if (artifact) {
    if (!existsSync(artifact)) {
      console.error(`text-geometry: UNKNOWN — ${artifact} is absent; build first.`);
      return 2;
    }
    base = pathToFileURL(artifact).href;
  } else {
    const served = await serve({ root: ROOT, port: 8274, open: false });
    server = served.server;
    base = `http://localhost:${served.port}/`;
  }

  let dropBrowser = async () => {};
  let cdp;
  try {
    const launched = await launchBrowser({
      prefix: 'text-geometry-', browser: browserPath,
      args: ['--allow-file-access-from-files', '--disable-background-timer-throttling'],
      timeoutMs: 15000,
    });
    dropBrowser = launched.close;
    cdp = connect(launched.wsUrl); await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);

    const evalIn = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page evaluation failed');
      return result.result.value;
    };
    const until = async (expression, label, timeout = 12000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (await evalIn(expression).catch(() => false)) return;
        await wait(120);
      }
      throw new Error(`timed out waiting for ${label}`);
    };

    const pageUrl = (params) => {
      const url = new URL(base);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      return url.href;
    };
    const values = { M: balance.ui.textSize.M, XL: balance.ui.textSize.XL };
    const viewports = [[390, 844], [412, 915]];
    const rows = {};
    for (const [width, height] of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: true,
      }, sessionId);
      const viewport = `${width}x${height}`;
      rows[viewport] = {};
      for (const [key, value] of Object.entries(values)) {
        await cdp.send('Page.navigate', { url: base }, sessionId);
        await until(`!!([...document.querySelectorAll('button')].find((b) => /BEGIN A CLIMB/i.test(b.textContent)))`, `${viewport} Text ${key} title action`);
        await evalIn(`[...document.querySelectorAll('button')].find((b) => /BEGIN A CLIMB/i.test(b.textContent)).click(); true`);
        await until(`!!document.querySelector('#cz-start') && !!document.querySelector('.class-sprite')`, `${viewport} Text ${key} customization geometry`);
        await evalIn(`document.documentElement.style.fontSize=${JSON.stringify(value)}; true`);
        await wait(650);
        const action = await evalIn(`(() => {
          const n = (v) => +Number(v).toFixed(2);
          const action = document.querySelector('#cz-start');
          const ar = action.getBoundingClientRect();
          return {
            font: n(parseFloat(getComputedStyle(action).fontSize)),
            actionMinH: n(parseFloat(getComputedStyle(action).minHeight)),
            actionW: n(ar.width), actionH: n(ar.height),
            layout: document.documentElement.dataset.layout || '',
          };
        })()`);
        if (shotBase) {
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
          const path = resolve(ROOT, `${shotBase}-${key.toLowerCase()}-${viewport}.png`);
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, Buffer.from(shot.data, 'base64'));
        }
        await cdp.send('Page.navigate', { url: pageUrl({ shot: 'combat' }) }, sessionId);
        await until(`!!document.querySelector('.combatant.enemy .sprite > :first-child')`, `${viewport} Text ${key} combat sprite`);
        await evalIn(`document.documentElement.style.fontSize=${JSON.stringify(value)}; true`);
        await wait(300);
        const sprite = await evalIn(`(() => {
          const n = (v) => +Number(v).toFixed(2);
          const el = document.querySelector('.combatant.enemy .sprite > :first-child');
          const rect = el.getBoundingClientRect();
          const css = getComputedStyle(el);
          return {
            spriteW: n(rect.width), spriteH: n(rect.height),
            spriteCssW: n(parseFloat(css.width)), spriteCssH: n(parseFloat(css.height)),
          };
        })()`);
        rows[viewport][key] = { ...action, ...sprite };
      }
    }

    const close = (a, b) => Math.abs(a - b) <= 0.5;
    const failures = [];
    const ui = readFileSync(resolve(ROOT, 'styles/ui.css'), 'utf8');
    const assets = readFileSync(resolve(ROOT, 'src/ui/assets.js'), 'utf8');
    for (const seam of [
      '.cz-actions button { min-height: var(--tap-floor); height: auto; }',
      'min-height: var(--tap-floor); height: auto; padding: 0 1.6rem;',
      'min-height: var(--tap-floor); height: auto; padding: 0.6rem 1.6rem; text-align: left;',
      'width: var(--tap-floor); height: var(--tap-floor); font-size: 1.8rem;',
    ]) {
      if (!ui.includes(seam)) failures.push(`source ownership seam missing: ${seam}`);
    }
    if (!assets.includes('const px = (value) => `${value}px`;')) failures.push('source ownership seam missing: sprite px emitter');

    for (const [viewport, profile] of Object.entries(rows)) {
      const { M, XL } = profile;
      if (!(XL.font > M.font + 1)) failures.push(`${viewport}: type did not grow from M ${M.font}px to XL ${XL.font}px`);
      if (M.actionH < 43.5 || XL.actionH < 43.5) {
        failures.push(`${viewport}: tap floor below 44px on glass: M ${M.actionH}px, XL ${XL.actionH}px`);
      }
      if (!close(M.actionMinH, XL.actionMinH)) {
        failures.push(`${viewport}: action floor changed with Text size: M ${M.actionMinH}px, XL ${XL.actionMinH}px`);
      }
      if (!close(M.spriteW, XL.spriteW) || !close(M.spriteH, XL.spriteH)
        || !close(M.spriteCssW, XL.spriteCssW) || !close(M.spriteCssH, XL.spriteCssH)) {
        failures.push(`${viewport}: sprite geometry changed with Text size: M rendered ${M.spriteW}×${M.spriteH}px / CSS ${M.spriteCssW}×${M.spriteCssH}px, XL rendered ${XL.spriteW}×${XL.spriteH}px / CSS ${XL.spriteCssW}×${XL.spriteCssH}px`);
      }
    }

    console.log(`text-geometry — ${artifact ? `artifact ${artifact}` : 'source'}`);
    for (const [viewport, profile] of Object.entries(rows)) {
      console.log(`  ${viewport}`);
      for (const [key, r] of Object.entries(profile)) {
        console.log(`    Text ${key}: font ${r.font}px · action ${r.actionW}×${r.actionH}px (floor ${r.actionMinH}px) · sprite rendered ${r.spriteW}×${r.spriteH}px · sprite CSS ${r.spriteCssW}×${r.spriteCssH}px · ${r.layout}`);
      }
    }
    if (shotBase) console.log(`  screenshots: ${shotBase}-{m,xl}-{390x844,412x915}.png`);
    if (failures.length) {
      for (const failure of failures) console.error(`  RED — ${failure}`);
      return 1;
    }
    console.log('  GREEN — Text XL grows type; named non-text rects stay within 0.5 px and the action remains at least 44 px on glass.');
    return 0;
  } catch (error) {
    console.error(`text-geometry: UNKNOWN — ${error.message}`);
    return 2;
  } finally {
    if (cdp) cdp.close();
    await dropBrowser();
    if (server) server.close();
  }
}

process.exit(await main());
