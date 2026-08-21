#!/usr/bin/env node
// tools/shrinefold.mjs — #282's rendered contract at both published shapes.
//
// The shrine had the affordability predicate but no fold. This drives the real
// ?shot=rest door and checks the player-visible contract rather than source
// vocabulary: two uniform collapsed faces, one live reveal, fold state retained
// across flask reallocation, and Level up disabled only after the model reports
// a cinder shortfall. Evidence is harness-owned and non-serialized: this tool
// never overwrites the published docs/preview images.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const OUT = outAt >= 0 && args[outAt + 1]
  ? resolve(args[outAt + 1])
  : join(ROOT, 'audit-evidence', 'issue-282-shrinefold-harness');
const USE_DIST = process.argv.includes('--dist');
const EVIDENCE_KIND = USE_DIST ? 'dist' : 'source';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'shrinefold.mjs',
    timeoutMs: 900000,
    env: process.env.CHROME ? { CHROME: process.env.CHROME } : {},
    plants: [
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
  const controls = [...document.querySelectorAll('.shrine-folds button')].map(rect).filter(Boolean);
  return {
    title: title ? { text:title.textContent.trim(), rect:rect(title) } : null,
    viewport: { width:innerWidth, height:innerHeight, scrollX, scrollY },
    screen: screen ? { scrollTop:screen.scrollTop, scrollLeft:screen.scrollLeft, clientWidth:screen.clientWidth, clientHeight:screen.clientHeight, scrollWidth:screen.scrollWidth, scrollHeight:screen.scrollHeight, rect:rect(screen) } : null,
    faces: faces.map((el) => ({ key:el.dataset.face, expanded:el.getAttribute('aria-expanded'), disabled:el.disabled, ariaDisabled:el.getAttribute('aria-disabled'), value:(el.querySelector('.disc-value') || {}).textContent || '', rect:rect(el) })),
    open: panel && !panel.hidden ? panel.dataset.revealFor : null,
    revealRect: panel && !panel.hidden ? rect(panel) : null,
    flaskArea: area(document.querySelector('#flask-reallocate')),
    levelArea: area(document.querySelector('#level-opt')),
    level: (() => { const el=document.querySelector('#level-opt'); return el ? { affordable:el.dataset.affordable, blockedBy:el.dataset.blockedBy, cost:+el.dataset.cost, short:+el.dataset.short } : null; })(),
    counts: [...document.querySelectorAll('#flask-reallocate .flask-increment-count')].map((el) => +el.textContent.trim()),
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    controlsOutside: controls.filter((r) => r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5).length,
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
      const resetCaptureState = async () => {
        await ev(`new Promise((done) => {
          const screen = document.querySelector('.shrine-screen');
          window.scrollTo(0, 0);
          if (screen) {
            screen.scrollTop = 0;
            screen.scrollLeft = 0;
          }
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          requestAnimationFrame(() => requestAnimationFrame(done));
        })`);
      };
      const captureStateProblem = (state) => {
        const titleRect = state.title?.rect;
        const revealRect = state.revealRect;
        const exactViewport = state.viewport?.width === shape.width && state.viewport?.height === shape.height;
        const atOrigin = Math.abs(state.viewport?.scrollX || 0) < 0.5
          && Math.abs(state.viewport?.scrollY || 0) < 0.5
          && Math.abs(state.screen?.scrollTop || 0) < 0.5
          && Math.abs(state.screen?.scrollLeft || 0) < 0.5;
        const titleInside = state.title?.text === 'SHRINE OF EMBER' && titleRect
          && titleRect.top >= -0.5 && titleRect.bottom <= shape.height + 0.5;
        const revealInside = revealRect && revealRect.left >= -0.5 && revealRect.right <= shape.width + 0.5
          && revealRect.top >= -0.5 && revealRect.bottom <= shape.height + 0.5;
        if (!exactViewport) return `viewport=${state.viewport?.width}x${state.viewport?.height}, expected ${shape.width}x${shape.height}`;
        if (!atOrigin) return `windowScroll=${state.viewport?.scrollX},${state.viewport?.scrollY} screenScroll=${state.screen?.scrollLeft},${state.screen?.scrollTop}`;
        if (!titleInside) return `title=${JSON.stringify(state.title)}`;
        if (!revealInside) return `revealRect=${JSON.stringify(revealRect)}`;
        if (state.overflow !== 0 || state.controlsOutside !== 0) return `overflow=${state.overflow} controlsOutside=${state.controlsOutside}`;
        return null;
      };

      console.log(`\n  ${shape.tag}`);
      await cdp.send('Page.navigate', { url: `${base}?shot=rest` }, sessionId);
      await until(`!!document.querySelector('#flask-reallocate') && !!document.querySelector('#level-opt')`, 'shrine panels');
      await wait(300);
      const arrival = await ev(READ);
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
      if (uniform && flaskFace.rect.height >= 44 && arrival.overflow === 0 && arrival.controlsOutside === 0) {
        ok('S2', shape.tag, `uniform ${flaskFace.rect.width.toFixed(1)}×${flaskFace.rect.height.toFixed(1)} faces; zero x-overflow; controls inside`);
      } else {
        bad('S2', shape.tag, `uniform=${uniform} overflow=${arrival.overflow} controlsOutside=${arrival.controlsOutside}`);
      }

      await ev(`document.querySelector('[data-face="shrine:level"]').click(); true`);
      await wait(150);
      const levelOpen = await ev(READ);
      if (levelOpen.open === 'shrine:level' && levelOpen.levelArea && !levelOpen.flaskArea
          && levelOpen.faces.find((face) => face.key === 'shrine:level')?.expanded === 'true') ok('S3', shape.tag, 'Level opens alone and reports expanded');
      else bad('S3', shape.tag, `open=${levelOpen.open} levelArea=${levelOpen.levelArea} flaskArea=${levelOpen.flaskArea}`);
      await ev(`document.querySelector('[data-face="shrine:level"]').click(); true`);
      await wait(150);
      const levelClosed = await ev(READ);
      if (levelClosed.open === null && !levelClosed.levelArea && levelClosed.faces.every((face) => face.expanded === 'false')) ok('S3b', shape.tag, 'pressing the open face collapses it');
      else bad('S3b', shape.tag, `open=${levelClosed.open} levelArea=${levelClosed.levelArea}`);
      await ev(`document.querySelector('[data-face="shrine:level"]').click(); true`);
      await wait(150);
      await resetCaptureState();
      const affordableState = await ev(READ);
      const affordableProblem = captureStateProblem(affordableState);
      if (affordableProblem) bad('S3c', shape.tag, `affordable capture refused: ${affordableProblem}`);
      else {
        ok('S3c', shape.tag, 'affordable capture is at the exact viewport origin with title and reveal inside');
        const affordablePng = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
        await writeFile(join(OUT, `${EVIDENCE_KIND}-shrine-fold-affordable-${shape.tag}.png`), Buffer.from(affordablePng.data, 'base64'));
      }

      await ev(`document.querySelector('[data-face="shrine:flasks"]').click(); true`);
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
        ok('S7', shape.tag, `final ${shape.width}x${shape.height}; title and reveal inside; window/screen scroll 0; controls inside`);
        const lowPng = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
        await writeFile(join(OUT, `${EVIDENCE_KIND}-shrine-fold-low-cinders-${shape.tag}.png`), Buffer.from(lowPng.data, 'base64'));
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
