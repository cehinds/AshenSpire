#!/usr/bin/env node
// Combat canvas layout probe (owner, 2026-11-14: "game keeps auto scaling, it shouldn't do that";
// "it can change between desktop and mobile and tablet and wide screen, but each should have it's
// own configuration that's relative"). docs/design/fixed-form-factor-layouts.md.
//
// Inside one form factor every combat element is laid out in that form factor's fixed canvas;
// the real window only changes the canvas's uniform scale and letterbox offset. This probe reads
// the combat screen's key rects in CANVAS px (real rect minus the canvas offset, divided by the
// canvas scale, both read from the computed transform of <html>) and checks:
//   a. same form factor, same picture: fresh loads at two window sizes of a form factor agree;
//   b. path independence: after a chain of resizes (and a drag of intermediate sizes) each stop
//      equals a fresh load at that window, and the chain ends where it started;
//   c. everything visible sits inside the canvas, the hand has its cards, no page errors.
// Prints one line per check and exits non-zero when any fails.
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright/index.js node tools/combat-canvas-qa.mjs
// Optional: CANVAS_QA_OUT=<dir> saves a screenshot per stop.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = playwright.chromium || playwright.default.chromium;
const out = process.env.CANVAS_QA_OUT ? resolve(process.env.CANVAS_QA_OUT) : null;
if (out) mkdirSync(out, { recursive: true });
const TOLERANCE = 1.5;
const ROUTE = '/?gameProfile=core&shot=combat&shotHand=2';
const KEYS = ['player', 'enemy', 'card', 'endTurn', 'sky', 'groundTop'];

const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = 'http://127.0.0.1:' + server.server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

// Runs in the page: the key rects in canvas px, plus the canvas box and the hand.
function canvasFacts() {
  const root = document.documentElement;
  const matrix = new DOMMatrix(getComputedStyle(root).transform === 'none' ? undefined : getComputedStyle(root).transform);
  const scale = matrix.a || 1, left = matrix.e, top = matrix.f;
  const canvas = { width: root.offsetWidth, height: root.offsetHeight, scale, left, top, preset: root.dataset.viewPreset };
  const rect = selector => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    return [(r.left - left) / scale, (r.top - top) / scale, r.width / scale, r.height / scale];
  };
  const ground = rect('.layered-environment-layer[data-role="ground"]:not([data-mirror]), .alternative-backdrop image[data-layer$="-ground"]');
  return { win: [innerWidth, innerHeight], canvas,
    player: rect('.combatant.player .sprite'), enemy: rect('.combatant.enemy .sprite'),
    card: rect('.hand .card'), endTurn: rect('.end-turn'),
    // The sky: the layered backdrop plate, or the painted scene's SVG frame.
    sky: rect('.layered-environment-layer[data-role="backdrop"], .alternative-backdrop svg'),
    groundTop: ground ? [ground[1]] : null,
    handCards: document.querySelectorAll('.hand .card').length };
}

// Waits until the measured rects hold still (the layout's debounce and rAF have run).
async function settled(page) {
  await page.waitForTimeout(450);
  let previous = '', stable = 0, facts = null;
  for (let i = 0; i < 60 && stable < 3; i++) {
    await page.waitForTimeout(120);
    facts = await page.evaluate(canvasFacts);
    const now = JSON.stringify(KEYS.map(key => facts[key]?.map(n => n.toFixed(1))));
    stable = now === previous ? stable + 1 : 0;
    previous = now;
  }
  return facts;
}

async function openFight(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error.message || error).slice(0, 200)));
  await page.goto(base + ROUTE, { timeout: 90000 });
  await page.waitForSelector('.end-turn', { timeout: 90000 });
  await page.waitForFunction(() => window.__combat?.phase === 'player', null, { timeout: 90000 });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  return { context, page, errors };
}

const fresh = new Map();
async function freshFacts(width, height) {
  const key = `${width}x${height}`;
  if (fresh.has(key)) return fresh.get(key);
  const { context, page, errors } = await openFight(width, height);
  const facts = await settled(page);
  if (out) await page.screenshot({ path: resolve(out, `fresh-${key}.png`) });
  await context.close();
  const value = { facts, errors };
  fresh.set(key, value);
  return value;
}

// The largest per-number difference between two fact sets, and which rect it was on.
function compare(a, b) {
  let worst = 0, where = '';
  for (const key of KEYS) {
    const x = a[key], y = b[key];
    if (!x || !y) { if (x !== y) return { worst: Infinity, where: `${key} missing on one side` }; continue; }
    x.forEach((n, i) => { const d = Math.abs(n - y[i]); if (d > worst) { worst = d; where = `${key}[${i}] ${n.toFixed(1)} vs ${y[i].toFixed(1)}`; } });
  }
  return { worst, where };
}
const fmt = f => KEYS.map(key => `${key}=${f[key] ? '[' + f[key].map(n => n.toFixed(0)).join(',') + ']' : 'none'}`).join(' ');

function visibleChecks(label, facts, errors) {
  const { width, height } = facts.canvas;
  const outside = ['player', 'enemy', 'card', 'endTurn'].filter(key => {
    const r = facts[key];
    return !r || r[0] < -TOLERANCE || r[1] < -TOLERANCE || r[0] + r[2] > width + TOLERANCE || r[1] + r[3] > height + TOLERANCE;
  });
  check(`${label}: player, enemy, first card and End Turn sit inside the ${width}x${height} canvas`, !outside.length, outside.length ? 'outside or missing: ' + outside.join(', ') : '');
  check(`${label}: the hand has its cards`, facts.handCards > 0, `${facts.handCards} cards`);
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
}

const PAIRS = [
  ['desktop', [1440, 900], [2000, 1225]],
  ['mobile', [390, 844], [412, 915]],
  // A 1180x820 WINDOW is a desktop (tabletMaxWidth 1100); the tablet canvas is 1180x820 / 820x1180.
  ['tablet', [1024, 768], [1100, 820]],
  ['tablet portrait', [768, 1024], [820, 1180]],
  ['widescreen', [2560, 1080], [3440, 1440]],
];
const CHAIN = [[390, 844], [2000, 1225], [1100, 800], [2560, 1080], [1440, 900]];
const DRAG = [];
for (let i = 1; i <= 12; i++) DRAG.push([Math.round(1440 + (420 - 1440) * i / 12), Math.round(900 + (860 - 900) * i / 12)]);
for (let i = 11; i >= 0; i--) DRAG.push([Math.round(1440 + (420 - 1440) * i / 12), Math.round(900 + (860 - 900) * i / 12)]);

try {
  // a. Same form factor, same picture.
  for (const [name, a, b] of PAIRS) {
    const first = await freshFacts(...a), second = await freshFacts(...b);
    visibleChecks(`fresh ${a.join('x')}`, first.facts, first.errors);
    visibleChecks(`fresh ${b.join('x')}`, second.facts, second.errors);
    const presets = `${first.facts.canvas.preset}/${second.facts.canvas.preset}`;
    const { worst, where } = compare(first.facts, second.facts);
    check(`same form factor ${name}: fresh ${a.join('x')} and ${b.join('x')} agree in canvas px (${presets})`,
      worst <= TOLERANCE && first.facts.canvas.preset === second.facts.canvas.preset,
      worst <= TOLERANCE ? `max diff ${worst.toFixed(2)}` : `max diff ${worst.toFixed(1)} at ${where}`);
  }
  // b. Path independence, then c. on every stop.
  for (const [label, stops, every] of [['chain', CHAIN, true], ['drag', DRAG, false]]) {
    const { context, page, errors } = await openFight(1440, 900);
    const start = await settled(page);
    const startFresh = await freshFacts(1440, 900);
    const startDiff = compare(start, startFresh.facts);
    check(`${label} start 1440x900 equals a fresh load`, startDiff.worst <= TOLERANCE, `max diff ${startDiff.worst.toFixed(2)} ${startDiff.where}`);
    for (const [index, [width, height]] of stops.entries()) {
      await page.setViewportSize({ width, height });
      // A drag passes through its sizes quickly; only its stops at the ends and the middle are measured.
      const measure = every || index === stops.length - 1 || index === 11;
      if (!measure) { await page.waitForTimeout(60); continue; }
      const facts = await settled(page);
      if (out) await page.screenshot({ path: resolve(out, `${label}-${index}-${width}x${height}.png`) });
      const reference = await freshFacts(width, height);
      const { worst, where } = compare(facts, reference.facts);
      check(`${label} stop ${index} ${width}x${height} (${facts.canvas.preset}) equals a fresh load`, worst <= TOLERANCE,
        worst <= TOLERANCE ? `max diff ${worst.toFixed(2)}` : `max diff ${worst.toFixed(1)} at ${where}; got ${fmt(facts)}; fresh ${fmt(reference.facts)}`);
      visibleChecks(`${label} stop ${index} ${width}x${height}`, facts, errors);
    }
    const end = await settled(page);
    const { worst, where } = compare(end, start);
    check(`${label} ends where it started (1440x900)`, worst <= TOLERANCE, worst <= TOLERANCE ? `max diff ${worst.toFixed(2)}` : `max diff ${worst.toFixed(1)} at ${where}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.server.closeAllConnections?.();
  await new Promise(r => server.server.close(r));
}
const failed = results.filter(ok => !ok).length;
console.log(`combat-canvas-qa: ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
