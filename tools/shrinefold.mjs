#!/usr/bin/env node
// tools/shrinefold.mjs — #282's rendered contract at both published shapes.
//
// The shrine had the affordability predicate but no fold. This drives the real
// ?shot=rest door and checks the player-visible contract rather than source
// vocabulary: two uniform collapsed faces, one live reveal, fold state retained
// across flask reallocation, and Level up disabled only after the model reports
// a cinder shortfall. Evidence is harness-owned and non-serialized: this tool
// never overwrites the published docs/preview images.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { balance } from '../src/content/balance.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const OUT = outAt >= 0 && args[outAt + 1]
  ? resolve(args[outAt + 1])
  : join(ROOT, 'audit-evidence', 'issue-282-shrinefold-harness');
const REFERENCE_OUT = join(ROOT, 'audit-evidence', 'issue-282-shrinefold-harness');
const USE_DIST = process.argv.includes('--dist');
const EVIDENCE_KIND = USE_DIST ? 'dist' : 'source';
const TEXT_XL = balance.ui.textSize.XL;
const MAX_RASTER_NOISE_PIXELS = 64;

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'shrinefold.mjs',
    timeoutMs: 900000,
    env: process.env.CHROME ? { CHROME: process.env.CHROME } : {},
    extraCopy: ['assets', 'audit-evidence/issue-282-shrinefold-harness'],
    includePng: true,
    plants: [
      {
        name: 'S0: the requested Text XL profile silently resolves to Text M',
        file: 'src/main.js',
        find: "  const tKey = TEXT_SIZES[settings.textSize] ? settings.textSize\n    : (settings.largeText === true ? 'L' : 'M');",
        replace: "  const tKey = 'M'; // KNOWN BAD: ignore the requested Text XL profile.",
        expectRed: /S0 390x844: textXL=/,
      },
      {
        name: 'S3: pointer activation cannot reach the Level fold face',
        file: 'styles/ui.css',
        append: '.shrine-screen [data-face="shrine:level"] { pointer-events: none !important; }',
        expectRed: /S3 390x844: pointer open=/,
      },
      {
        name: 'S3b: keyboard-generated disclosure clicks are ignored',
        file: 'src/ui/components/disclosure.js',
        find: "    button.addEventListener('click', () => {\n      hideTooltip();",
        replace: "    button.addEventListener('click', (event) => {\n      if (event.detail === 0) return; // KNOWN BAD: Enter and Space do nothing.\n      hideTooltip();",
        expectRed: /S3b 390x844: keyboard Enter close=/,
      },
      {
        name: 'S2: the two collapsed shrine faces stop being uniform',
        file: 'styles/ui.css',
        append: '.shrine-screen .shrine-folds [data-face="shrine:level"] { min-height: 80px !important; }',
        expectRed: /S2 390x844: uniform=false/,
      },
      {
        name: 'S4: opening Flask leaves the Level reveal painted too',
        file: 'src/ui/components/disclosure.js',
        find: '    close();\n    openKey = key;',
        replace: '    // KNOWN BAD: previous reveal is not closed.\n    openKey = key;',
        expectRed: /S4 390x844:.*levelArea=true.*flaskArea=true/,
      },
      {
        name: 'S6: cinder shortfall no longer disables the Level face',
        file: 'src/ui/screens/rest.js',
        find: '    levelFace.disabled = true;',
        replace: '    levelFace.disabled = false;',
        expectRed: /S6 390x844:.*disabled=false/,
      },
      {
        name: 'S5: flask reallocation remount forgets the open fold',
        file: 'src/ui/screens/rest.js',
        find: "mountRest(app, { registries, run, meta, onDone, onReallocate, onLevelUp, levelValue, healMult, refill: { chargePools: { ...run.flaskCharges }, grants: [], total: 0, shortfalls: [] }, openFold: 'shrine:flasks' });",
        replace: "mountRest(app, { registries, run, meta, onDone, onReallocate, onLevelUp, levelValue, healMult, refill: { chargePools: { ...run.flaskCharges }, grants: [], total: 0, shortfalls: [] }, openFold: null });",
        expectRed: /S5 390x844:.*open=null/,
      },
      {
        name: 'S7: the final desktop title is clipped above the viewport',
        file: 'styles/ui.css',
        append: '.shrine-screen h2 { transform: translateY(-100px) !important; }',
        expectRed: /S7 1200x730: title=/,
      },
      {
        name: 'S7c: a geometry shift survives DOM in-bounds checks but changes the rendered fold',
        file: 'styles/ui.css',
        append: '.shrine-screen .shrine-folds { transform: translateX(4px) !important; }',
        expectRed: /S7c 390x844: normalized visual drift/,
      },
      {
        name: 'S7c: a palette drift survives DOM geometry checks but changes the rendered fold',
        file: 'styles/ui.css',
        append: '.shrine-screen .shrine-folds .disc-face { border-color: #00ffff !important; }',
        expectRed: /S7c 390x844: normalized visual drift/,
      },
    ],
  }));
}
const SHAPES = [
  { tag: '390x844', width: 390, height: 844, scale: 2, mobile: true },
  { tag: '1200x730', width: 1200, height: 730, scale: 1, mobile: false },
];
const findings = [];
let checks = 0;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const ok = (id, shape, detail) => { checks++; console.log(`  ok   ${id} ${shape} — ${detail}`); };
const bad = (id, shape, detail) => { checks++; findings.push(`${id} ${shape}: ${detail}`); console.log(`  BAD  ${id} ${shape} — ${detail}`); };
const SHOT_SETTINGS = encodeURIComponent(JSON.stringify({ textSize: 'XL' }));

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Chrome's screenshots are non-interlaced 8-bit RGB/RGBA PNGs. Decode that
// narrow product directly so the evidence comparator has no package or image
// tool whose version can silently change the verdict.
function decodePng(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new Error(`truncated PNG ${type} chunk`);
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(start);
      height = bytes.readUInt32BE(start + 4);
      bitDepth = bytes[start + 8];
      colorType = bytes[start + 9];
      interlace = bytes[start + 12];
    } else if (type === 'IDAT') idat.push(bytes.subarray(start, end));
    offset = end + 4;
    if (type === 'IEND') break;
  }
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!width || !height || bitDepth !== 8 || !channels || interlace !== 0) {
    throw new Error(`unsupported PNG ${width}x${height} depth=${bitDepth} color=${colorType} interlace=${interlace}`);
  }
  const rowBytes = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length !== height * (rowBytes + 1)) {
    throw new Error(`PNG scanlines=${raw.length}, expected ${height * (rowBytes + 1)}`);
  }
  const recon = Buffer.alloc(rowBytes * height);
  let input = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[input++];
    const row = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const left = x >= channels ? recon[row + x - channels] : 0;
      const up = y > 0 ? recon[row - rowBytes + x] : 0;
      const upperLeft = y > 0 && x >= channels ? recon[row - rowBytes + x - channels] : 0;
      let predictor;
      if (filter === 0) predictor = 0;
      else if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      else throw new Error(`unsupported PNG filter ${filter}`);
      recon[row + x] = (raw[input++] + predictor) & 0xff;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let source = 0, target = 0; source < recon.length; source += channels, target += 4) {
    rgba[target] = recon[source];
    rgba[target + 1] = recon[source + 1];
    rgba[target + 2] = recon[source + 2];
    rgba[target + 3] = channels === 4 ? recon[source + 3] : 255;
  }
  return { width, height, rgba };
}

function normalizedPixelDiff(referenceBytes, candidateBytes) {
  const reference = decodePng(referenceBytes);
  const candidate = decodePng(candidateBytes);
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    return { dimensions: `${candidate.width}x${candidate.height} != ${reference.width}x${reference.height}`, meaningfulPixels: Infinity };
  }
  let rawDiffPixels = 0;
  let rasterNoisePixels = 0;
  let meaningfulPixels = 0;
  let maxDelta = 0;
  let minX = reference.width;
  let minY = reference.height;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < reference.rgba.length; i += 4) {
    const delta = Math.max(
      Math.abs(reference.rgba[i] - candidate.rgba[i]),
      Math.abs(reference.rgba[i + 1] - candidate.rgba[i + 1]),
      Math.abs(reference.rgba[i + 2] - candidate.rgba[i + 2]),
      Math.abs(reference.rgba[i + 3] - candidate.rgba[i + 3]),
    );
    if (delta === 0) continue;
    rawDiffPixels++;
    if (delta <= 1) rasterNoisePixels++; else meaningfulPixels++;
    maxDelta = Math.max(maxDelta, delta);
    const pixel = i / 4;
    const x = pixel % reference.width;
    const y = Math.floor(pixel / reference.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    dimensions: `${reference.width}x${reference.height}`,
    rawDiffPixels,
    rasterNoisePixels,
    meaningfulPixels,
    maxDelta,
    bbox: rawDiffPixels ? `${minX},${minY}..${maxX},${maxY}` : 'none',
  };
}

async function recordNormalizedCapture(candidateBytes, filename, shapeTag) {
  const referencePath = join(REFERENCE_OUT, filename);
  let referenceBytes;
  try {
    referenceBytes = await readFile(referencePath);
  } catch (error) {
    bad('S7c', shapeTag, `missing committed pixel reference ${filename}: ${error.message}`);
    if (resolve(OUT) !== resolve(REFERENCE_OUT)) await writeFile(join(OUT, filename), candidateBytes);
    return;
  }
  let diff;
  try {
    diff = normalizedPixelDiff(referenceBytes, candidateBytes);
  } catch (error) {
    bad('S7c', shapeTag, `pixel comparison could not decode ${filename}: ${error.message}`);
    if (resolve(OUT) !== resolve(REFERENCE_OUT)) await writeFile(join(OUT, filename), candidateBytes);
    return;
  }
  const rawReference = hash(referenceBytes);
  const rawCandidate = hash(candidateBytes);
  const normalizedGreen = !diff.dimensions.includes('!=')
    && diff.meaningfulPixels === 0
    && diff.rasterNoisePixels <= MAX_RASTER_NOISE_PIXELS;
  if (normalizedGreen) {
    ok('S7c', shapeTag, `normalized pixels match; raw ${rawReference.slice(0, 12)}→${rawCandidate.slice(0, 12)}; `
      + `${diff.rasterNoisePixels} raster-noise pixel(s) <=1 channel, 0 meaningful, bbox ${diff.bbox}`);
  } else {
    bad('S7c', shapeTag, `normalized visual drift; dimensions ${diff.dimensions}; `
      + `${diff.rasterNoisePixels || 0} raster-noise, ${diff.meaningfulPixels} meaningful, `
      + `max delta ${diff.maxDelta || 0}, bbox ${diff.bbox || 'n/a'}; raw ${rawReference.slice(0, 12)}→${rawCandidate.slice(0, 12)}`);
  }
  // The committed PNG is the immutable raw anchor. A default verification run
  // never replaces it with an antialias variant that only happens to win this
  // compositor pass. Custom --out runs retain their raw candidate for audit.
  if (resolve(OUT) !== resolve(REFERENCE_OUT)) await writeFile(join(OUT, filename), candidateBytes);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: done, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else done(message.result);
  });
  return {
    ready: new Promise((done, reject) => { ws.addEventListener('open', done); ws.addEventListener('error', reject); }),
    send(method, params = {}, sessionId = null) {
      const id = nextId++;
      return new Promise((done, reject) => {
        pending.set(id, { resolve: done, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

const READ = `(() => {
  const area = (el) => !!el && [...el.getClientRects()].some((r) => r.width > 0 && r.height > 0);
  const rect = (el) => { const r = el && el.getBoundingClientRect(); return r ? { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height } : null; };
  const faces = [...document.querySelectorAll('.shrine-folds .disc-face')];
  const panel = document.querySelector('.shrine-folds .disc-reveal');
  const screen = document.querySelector('.shrine-screen');
  const title = document.querySelector('.shrine-screen h2');
  const controls = [...document.querySelectorAll('.shrine-folds button')]
    .map((el) => ({ key:el.dataset.face || el.dataset.attr || el.textContent.trim().slice(0, 24), rect:rect(el) }))
    .filter((row) => row.rect);
  return {
    title: title ? { text:title.textContent.trim(), rect:rect(title) } : null,
    viewport: { width:innerWidth, height:innerHeight, scrollX, scrollY },
    screen: screen ? { scrollTop:screen.scrollTop, scrollLeft:screen.scrollLeft, clientWidth:screen.clientWidth, clientHeight:screen.clientHeight, scrollWidth:screen.scrollWidth, scrollHeight:screen.scrollHeight, rect:rect(screen) } : null,
    rootFontSize: document.documentElement.style.fontSize,
    focusedFace: document.activeElement?.dataset?.face || null,
    faces: faces.map((el) => ({ key:el.dataset.face, expanded:el.getAttribute('aria-expanded'), disabled:el.disabled, ariaDisabled:el.getAttribute('aria-disabled'), value:(el.querySelector('.disc-value') || {}).textContent || '', rect:rect(el) })),
    open: panel && !panel.hidden ? panel.dataset.revealFor : null,
    revealRect: panel && !panel.hidden ? rect(panel) : null,
    flaskArea: area(document.querySelector('#flask-reallocate')),
    levelArea: area(document.querySelector('#level-opt')),
    level: (() => { const el=document.querySelector('#level-opt'); return el ? { affordable:el.dataset.affordable, blockedBy:el.dataset.blockedBy, cost:+el.dataset.cost, short:+el.dataset.short } : null; })(),
    counts: [...document.querySelectorAll('#flask-reallocate .flask-increment-count')].map((el) => +el.textContent.trim()),
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    controlsOutsideX: controls.filter(({rect:r}) => r.left < -0.5 || r.right > innerWidth + 0.5).map((row) => row.key),
    controlsOutsideY: controls.filter(({rect:r}) => r.top < -0.5 || r.bottom > innerHeight + 0.5).map((row) => row.key),
  };
})()`;

async function main() {
  const served = await serve({ root: ROOT, port: 8328, open: false });
  const base = USE_DIST ? `${served.url}dist/AshenSpire.html` : served.url;
  const browser = await launchBrowser({ prefix: 'shrinefold-', timeoutMs: 20000 });
  const cdp = connect(browser.wsUrl);
  await cdp.ready;
  await mkdir(OUT, { recursive: true });
  console.log(`shrinefold — ${base} (${USE_DIST ? 'shipped bundle' : 'source tree'})`);

  try {
    for (const shape of SHAPES) {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width, height: shape.height, deviceScaleFactor: shape.scale, mobile: shape.mobile,
      }, sessionId);
      const ev = async (expression) => {
        const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page evaluation threw');
        return result.result.value;
      };
      const until = async (expression, label, timeoutMs = 20000) => {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          if (await ev(expression).catch(() => false)) return;
          await wait(100);
        }
        throw new Error(`timeout waiting for ${label}`);
      };
      const pointerPress = async (selector) => {
        const point = await ev(`(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        if (!point) return false;
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y }, sessionId);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
        return true;
      };
      const keyboardPress = async (selector, key, code, virtualKey, text = null) => {
        const focused = await ev(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)return false; el.focus(); return document.activeElement===el; })()`);
        if (!focused) return false;
        const common = { key, code, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey };
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...common, ...(text != null ? { text } : {}) }, sessionId);
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...common }, sessionId);
        return true;
      };
      const resetCaptureState = async (fitSelector = null) => {
        await ev(`new Promise((done) => {
          const screen = document.querySelector('.shrine-screen');
          window.scrollTo(0, 0);
          if (screen) {
            screen.scrollTop = 0;
            screen.scrollLeft = 0;
          }
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const fit = ${JSON.stringify(fitSelector)} && document.querySelector(${JSON.stringify(fitSelector)});
            fit?.scrollIntoView({ block:'end', inline:'nearest' });
            requestAnimationFrame(() => requestAnimationFrame(done));
          }));
        })`);
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: shape.width - 2,
          y: shape.height - 2,
        }, sessionId);
        await wait(300);
      };
      const captureStateProblem = (state, { posedScroll = false } = {}) => {
        const titleRect = state.title?.rect;
        const revealRect = state.revealRect;
        const exactViewport = state.viewport?.width === shape.width && state.viewport?.height === shape.height;
        const atOrigin = Math.abs(state.viewport?.scrollX || 0) < 0.5
          && Math.abs(state.viewport?.scrollY || 0) < 0.5
          && Math.abs(state.screen?.scrollLeft || 0) < 0.5
          && (posedScroll
            ? state.screen?.scrollTop >= -0.5 && state.screen?.scrollTop <= state.screen?.scrollHeight - state.screen?.clientHeight + 0.5
            : Math.abs(state.screen?.scrollTop || 0) < 0.5);
        const titleInside = state.title?.text === 'SHRINE OF EMBER' && titleRect
          && titleRect.top >= 1 && titleRect.bottom <= shape.height + 0.5;
        const revealInside = revealRect && revealRect.left >= -0.5 && revealRect.right <= shape.width + 0.5
          && revealRect.top >= -0.5 && revealRect.bottom <= shape.height + 0.5;
        if (!exactViewport) return `viewport=${state.viewport?.width}x${state.viewport?.height}, expected ${shape.width}x${shape.height}`;
        if (!atOrigin) return `windowScroll=${state.viewport?.scrollX},${state.viewport?.scrollY} screenScroll=${state.screen?.scrollLeft},${state.screen?.scrollTop}`;
        if (!titleInside) return `title=${JSON.stringify(state.title)}`;
        if (!revealInside) return `revealRect=${JSON.stringify(revealRect)}`;
        if (state.overflow !== 0 || state.controlsOutsideX.length !== 0) return `overflow=${state.overflow} controlsOutsideX=${state.controlsOutsideX.join(',') || 'none'}`;
        return null;
      };

      console.log(`\n  ${shape.tag}`);
      await cdp.send('Page.navigate', { url: `${base}?shot=rest&shotSettings=${SHOT_SETTINGS}` }, sessionId);
      await until(`!!document.querySelector('#flask-reallocate') && !!document.querySelector('#level-opt')`, 'shrine panels');
      await wait(300);
      const arrival = await ev(READ);
      if (arrival.rootFontSize === TEXT_XL) ok('S0', shape.tag, `Text XL applied at the real shotSettings door (${arrival.rootFontSize})`);
      else bad('S0', shape.tag, `textXL=${JSON.stringify(TEXT_XL)} rootFontSize=${JSON.stringify(arrival.rootFontSize)}`);
      const keys = arrival.faces.map((face) => face.key);
      if (keys.join('|') === 'shrine:flasks|shrine:level'
          && arrival.faces.every((face) => face.expanded === 'false')
          && arrival.open === null && !arrival.flaskArea && !arrival.levelArea) {
        ok('S1', shape.tag, 'two named faces arrive aria-collapsed and neither full panel paints');
      } else {
        bad('S1', shape.tag, `faces=${JSON.stringify(keys)} open=${arrival.open} flaskArea=${arrival.flaskArea} levelArea=${arrival.levelArea}`);
        continue;
      }
      const [flaskFace, levelFace] = arrival.faces;
      const uniform = flaskFace.rect && levelFace.rect
        && Math.abs(flaskFace.rect.width - levelFace.rect.width) < 1
        && Math.abs(flaskFace.rect.height - levelFace.rect.height) < 1;
      if (uniform && flaskFace.rect.height >= 44 && arrival.overflow === 0 && arrival.controlsOutsideX.length === 0) {
        ok('S2', shape.tag, `uniform ${flaskFace.rect.width.toFixed(1)}×${flaskFace.rect.height.toFixed(1)} faces; zero x-overflow; controls horizontally inside`);
      } else {
        bad('S2', shape.tag, `uniform=${uniform} overflow=${arrival.overflow} controlsOutsideX=${arrival.controlsOutsideX.join(',') || 'none'}`);
      }

      const pointerOpened = await pointerPress('[data-face="shrine:level"]');
      await wait(150);
      const levelOpen = await ev(READ);
      if (pointerOpened && levelOpen.open === 'shrine:level' && levelOpen.levelArea && !levelOpen.flaskArea
          && levelOpen.faces.find((face) => face.key === 'shrine:level')?.expanded === 'true') ok('S3', shape.tag, 'real CDP pointer opens Level alone');
      else bad('S3', shape.tag, `pointer open=${levelOpen.open} levelArea=${levelOpen.levelArea} flaskArea=${levelOpen.flaskArea}`);
      const enterSent = await keyboardPress('[data-face="shrine:level"]', 'Enter', 'Enter', 13, '\r');
      await wait(150);
      const levelClosed = await ev(READ);
      if (enterSent && levelClosed.open === null && !levelClosed.levelArea && levelClosed.faces.every((face) => face.expanded === 'false')) ok('S3b', shape.tag, 'real keyboard Enter collapses the focused face');
      else bad('S3b', shape.tag, `keyboard Enter close=${levelClosed.open} levelArea=${levelClosed.levelArea}`);
      const spaceSent = await keyboardPress('[data-face="shrine:level"]', ' ', 'Space', 32, ' ');
      await wait(150);
      const spaceOpen = await ev(READ);
      if (spaceSent && spaceOpen.open === 'shrine:level' && spaceOpen.levelArea
          && spaceOpen.faces.find((face) => face.key === 'shrine:level')?.expanded === 'true') ok('S3c', shape.tag, 'real keyboard Space reopens Level');
      else bad('S3c', shape.tag, `keyboard Space open=${spaceOpen.open} levelArea=${spaceOpen.levelArea}`);
      await resetCaptureState('.shrine-folds .disc-reveal');
      const affordableState = await ev(READ);
      const affordableProblem = captureStateProblem(affordableState, { posedScroll: true });
      if (affordableProblem) bad('S3d', shape.tag, `affordable capture refused: ${affordableProblem}`);
      else {
        ok('S3d', shape.tag, `Text XL affordable capture is explicitly posed with title/reveal inside (screen scroll ${affordableState.screen.scrollTop.toFixed(1)})`);
        const affordablePng = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
        await writeFile(join(OUT, `${EVIDENCE_KIND}-shrine-fold-affordable-text-xl-${shape.tag}.png`), Buffer.from(affordablePng.data, 'base64'));
      }

      await pointerPress('[data-face="shrine:flasks"]');
      await wait(150);
      const flaskOpen = await ev(READ);
      if (flaskOpen.open === 'shrine:flasks' && flaskOpen.flaskArea && !flaskOpen.levelArea) ok('S4', shape.tag, 'opening Flask closes Level');
      else bad('S4', shape.tag, `open=${flaskOpen.open} levelArea=${flaskOpen.levelArea} flaskArea=${flaskOpen.flaskArea}`);
      const beforeCounts = flaskOpen.counts.join(',');
      const moved = await ev(`(() => { const b=[...document.querySelectorAll('#flask-reallocate .flask-step')].find((el)=>el.getAttribute('aria-disabled')!=='true'); if(!b)return false; b.click(); return true; })()`);
      if (moved) {
        const persisted = await until(`document.querySelector('.shrine-folds .disc-reveal')?.dataset.revealFor === 'shrine:flasks'`, 'flask fold after reallocation', 2000)
          .then(() => true, () => false);
        const afterMove = await ev(READ);
        if (persisted && afterMove.open === 'shrine:flasks' && afterMove.counts.join(',') !== beforeCounts) ok('S5', shape.tag, `reallocation keeps Flask open (${beforeCounts} → ${afterMove.counts.join(',')})`);
        else bad('S5', shape.tag, `open=${afterMove.open} counts=${beforeCounts} → ${afterMove.counts.join(',')}`);
      } else bad('S5', shape.tag, 'no enabled flask step exists');

      let purchases = 0;
      while (purchases < 30) {
        const state = await ev(READ);
        const face = state.faces.find((row) => row.key === 'shrine:level');
        if (state.level?.blockedBy === 'cinders' && face?.disabled) break;
        await ev(`document.querySelector('[data-face="shrine:level"]')?.click(); true`);
        const before = state.level?.cost;
        const armed = await ev(`(() => { const b=document.querySelector('#level-opt [data-attr]:not([disabled])'); if(!b)return false; b.click(); return true; })()`);
        if (!armed) break;
        await until(`!!document.querySelector('.beat-confirm .beat-yes')`, 'level confirmation');
        await ev(`document.querySelector('.beat-confirm .beat-yes').click(); true`);
        await until(`document.querySelector('#level-opt') && +document.querySelector('#level-opt').dataset.cost !== ${Number(before)}`, 'next level price');
        purchases++;
      }
      const locked = await ev(READ);
      const lockedFace = locked.faces.find((row) => row.key === 'shrine:level');
      if (locked.level?.blockedBy === 'cinders' && locked.level.short > 0 && lockedFace?.disabled
          && lockedFace.ariaDisabled === 'true' && lockedFace.value.includes('short')) {
        ok('S6', shape.tag, `after ${purchases} purchases Level is disabled from model shortfall (${locked.level.short} short)`);
      } else {
        bad('S6', shape.tag, `blockedBy=${locked.level?.blockedBy} short=${locked.level?.short} disabled=${lockedFace?.disabled} value=${JSON.stringify(lockedFace?.value)}`);
      }
      await ev(`document.querySelector('[data-face="shrine:flasks"]').click(); true`);
      await wait(150);
      await resetCaptureState();
      const finalState = await ev(READ);
      const finalProblem = captureStateProblem(finalState);
      const finalFlask = finalState.faces.find((row) => row.key === 'shrine:flasks');
      const finalLevel = finalState.faces.find((row) => row.key === 'shrine:level');
      const finalContract = finalState.open === 'shrine:flasks' && finalState.flaskArea && !finalState.levelArea
        && finalFlask?.expanded === 'true' && finalLevel?.expanded === 'false'
        && finalLevel?.disabled && finalLevel?.ariaDisabled === 'true';
      if (finalProblem || !finalContract) {
        bad('S7', shape.tag, finalProblem || `final open=${finalState.open} flaskExpanded=${finalFlask?.expanded} levelExpanded=${finalLevel?.expanded} levelDisabled=${finalLevel?.disabled}`);
      } else {
        const verticalReach = finalState.controlsOutsideY.length === 0
          ? 'all controls vertically visible'
          : `${finalState.controlsOutsideY.length} controls vertically outside but scroll-reachable`;
        ok('S7', shape.tag, `final Text XL ${shape.width}x${shape.height}; title/reveal inside at origin; horizontal controls inside; ${verticalReach}`);
        const lowPng = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
        const lowBytes = Buffer.from(lowPng.data, 'base64');
        await recordNormalizedCapture(lowBytes, `${EVIDENCE_KIND}-shrine-fold-low-cinders-text-xl-${shape.tag}.png`, shape.tag);
      }
      await ev(`new Promise((done) => {
        const face=document.querySelector('[data-face="shrine:level"]');
        face?.scrollIntoView({ block:'end', inline:'nearest' });
        requestAnimationFrame(() => requestAnimationFrame(done));
      })`);
      const disabledFaceState = await ev(READ);
      const disabledFaceRect = disabledFaceState.faces.find((row) => row.key === 'shrine:level')?.rect;
      const disabledFaceInside = disabledFaceRect && disabledFaceRect.left >= -0.5
        && disabledFaceRect.right <= shape.width + 0.5 && disabledFaceRect.top >= -0.5
        && disabledFaceRect.bottom <= shape.height + 0.5;
      if (disabledFaceInside && disabledFaceState.faces.find((row) => row.key === 'shrine:level')?.disabled) {
        ok('S7b', shape.tag, 'disabled Level face is reachable by vertical scroll at Text XL');
        const disabledPng = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
        await writeFile(join(OUT, `${EVIDENCE_KIND}-shrine-fold-disabled-level-text-xl-${shape.tag}.png`), Buffer.from(disabledPng.data, 'base64'));
      } else {
        bad('S7b', shape.tag, `disabled Level face rect=${JSON.stringify(disabledFaceRect)} disabled=${disabledFaceState.faces.find((row) => row.key === 'shrine:level')?.disabled}`);
      }
      await cdp.send('Target.closeTarget', { targetId });
    }
  } finally {
    cdp.close();
    await browser.close();
    await new Promise((done) => served.server.close(done));
  }
  console.log(`\nshrinefold — ${checks - findings.length}/${checks} checks passed`);
  if (findings.length) {
    console.error(findings.map((finding) => `  ${finding}`).join('\n'));
    process.exitCode = 1;
  }
}

await main();
