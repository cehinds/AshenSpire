#!/usr/bin/env node
// tools/viewport-units.mjs — Law 2's detector for viewport-constrained UI CSS.
//
// `body { zoom: var(--ui-zoom) }` creates a second coordinate space. A viewport
// unit below that zoom can measure the unzoomed viewport while its box is painted
// in the zoomed containing block. Percentage constraints stay inside that block.
// This tool keeps the CSS sweep honest and proves the distinction in Chromium.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CSS = resolve(ROOT, 'styles/ui.css');
const FIXTURE = resolve(ROOT, 'tests/fixtures/viewport-units/zoom-probe.html');
const allowlisted = [
  { re: /transform:\s*translate\([^;]*-92vh/i, reason: 'intentional off-screen exit animation' },
  { re: /font-size:\s*clamp\([^;]*7vw/i, reason: 'art glyph remains fluid inside its component' },
];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

export function scanCss(src) {
  const clean = stripComments(src);
  const findings = [];
  for (const m of clean.matchAll(/[^{}]*\{[^{}]*\}|[^{}]+/g)) {
    const block = m[0];
    for (const unit of block.matchAll(/\b\d+(?:\.\d+)?\s*(?:vw|vh)\b/gi)) {
      const before = clean.slice(0, m.index + unit.index);
      const line = before.split('\n').length;
      const allowed = allowlisted.find((entry) => entry.re.test(block));
      if (!allowed) findings.push({ line, text: unit[0], block: block.trim() });
    }
  }
  return findings;
}

function expect(label, actual, wanted, failures) {
  if (actual !== wanted) failures.push(`${label}: got ${actual}, expected ${wanted}`);
}

export function selftest() {
  const failures = [];
  expect('known-bad viewport constraint is caught', scanCss('.x { max-width: 96vw; }').length, 1, failures);
  expect('known-good percentage constraint is clean', scanCss('.x { max-width: 96%; }').length, 0, failures);
  expect('intentional animation allowlist is stable', scanCss('.x { transform: translate(0, -92vh); }').length, 0, failures);
  expect('component art allowlist is stable', scanCss('.x { font-size: clamp(2rem, 7vw, 4rem); }').length, 0, failures);
  const findings = scanCss(readFileSync(CSS, 'utf8'));
  expect('styles/ui.css has no unowned viewport constraints', findings.length, 0, failures);
  if (failures.length) {
    console.error('viewport-units selftest RED');
    for (const failure of failures) console.error(`  ${failure}`);
    for (const finding of findings) console.error(`  ${relative(ROOT, CSS)}:${finding.line} ${finding.block}`);
    return 1;
  }
  console.log('viewport-units selftest GREEN — known-bad 1/1, known-good 3/3, ui.css clean');
  return 0;
}

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

async function browserProof() {
  const browser = resolveBrowser([
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ]);
  if (!browser || !existsSync(FIXTURE)) return { code: 2, message: 'browser or fixture unavailable' };
  const launched = await launchBrowser({ prefix: 'viewport-units-', browser, timeoutMs: 15000 });
  const cdp = connectCdp(launched.wsUrl);
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Page.navigate', { url: pathToFileURL(FIXTURE).href }, sessionId);
    await new Promise((resolveWait) => setTimeout(resolveWait, 350));
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const viewport = document.documentElement.clientWidth;
        const read = (id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(), c = getComputedStyle(e); return { right: r.right, width: r.width, maxWidth: c.maxWidth, widthStyle: c.width }; };
        const vw = read('vw'), percent = read('percent');
        const body = document.body.getBoundingClientRect();
        return { viewport, body: { right: body.right, width: body.width }, vw, percent, vwOverflows: vw.right > viewport + 0.5, percentBounded: percent.right <= viewport + 0.5 };
      })()`,
      returnByValue: true,
    }, sessionId);
    const value = result.result?.value;
    if (!value || !value.vwOverflows || !value.percentBounded) {
      return { code: 1, message: `browser proof failed: ${JSON.stringify(value)}` };
    }
    console.log(`viewport-units browser proof GREEN — 96vw overflows (${value.vw.right.toFixed(1)} > ${value.viewport}), 96% is bounded (${value.percent.right.toFixed(1)})`);
    return { code: 0, message: 'browser proof green' };
  } finally {
    cdp.close();
    await launched.close();
  }
}

async function main(args) {
  if (args.includes('--selftest')) {
    const staticCode = selftest();
    if (staticCode) return staticCode;
    const proof = await browserProof();
    if (proof.code === 2) { console.error(`viewport-units UNKNOWN — ${proof.message}`); return 2; }
    if (proof.code) { console.error(proof.message); return proof.code; }
    return 0;
  }
  const findings = scanCss(readFileSync(CSS, 'utf8'));
  for (const finding of findings) console.error(`${relative(ROOT, CSS)}:${finding.line} ${finding.block}`);
  console.log(findings.length ? `RESULT RED — ${findings.length} unowned viewport unit(s)` : 'RESULT GREEN — no unowned viewport constraints');
  return findings.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exit(await main(process.argv.slice(2)));
