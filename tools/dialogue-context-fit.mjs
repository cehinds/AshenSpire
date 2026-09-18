// tools/dialogue-context-fit.mjs — the W4c context band holds its responses.
//
// Owner, 2026-09-15: up to four responses show in the quest dialogue's context
// band without scrolling; the band scrolls only when there are five or more.
// That is a fact about laid-out text and buttons, so no node test can see it.
// This tool serves the SOURCE tree, drives its own headless Chrome, mounts the
// real dialogue screen (src/ui/screens/dialogue.js) on a real quest step at
// each host size, brings its response grid to four and then five responses,
// and asserts:
//   · four responses: the band's scrollHeight <= clientHeight, every response
//     inside the band and at least the 44 px touch target tall;
//   · five responses: none is lost. The band scrolls to reach them, or all
//     five fit inside it. The owner's rule is that the band may scroll only
//     from five responses on, not that it must; whether five fit depends on
//     the host and the scene config.
// A mount that renders anything other than the expected responses throws
// (exit 2): a band with nothing in it proves nothing, so it cannot pass.
//
//   node tools/dialogue-context-fit.mjs              → verdict, exit 0 / 1
//   node tools/dialogue-context-fit.mjs --out DIR    → also a PNG per case
// Exit 2 when no browser is available: unknown is not a pass.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const { uiConfig } = await import(new URL('../src/config/generated/ui.js', import.meta.url));
const MIN_GAP_PX = uiConfig.scenes.w4c.positioning.portraits.minGapPx;
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = oi >= 0 && args[oi + 1] ? resolve(args[oi + 1]) : null;
const HOSTS = [[1280, 800], [740, 372], [390, 844], [844, 390]];
const TOUCH_TARGET_PX = 44;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// THE FOURTH AND FIFTH RESPONSES ARE CLONES, and on purpose. No shipped event
// can show more than three responses at once: the most choices any event has
// is four (namelessKeeper, namelessRest), and history gates them so a run
// that answered the Grave one way sees three. Adding test-only choices to the
// game to reach four and five would ship a seam for a probe. So this mounts
// the real screen on a real quest step with a real history (namelessKeeper
// after digging at the Grave: its three reachable responses, real labels),
// then copies real response buttons up to the case's count and lets the
// stage refit through its own resize path. What is under test is the band:
// the real CSS and the real fit routine, on the screen's own buttons.
const PROBE_EVENT = 'namelessKeeper';
const PROBE_HISTORY = { eventId: 'graveOfTheNameless', choiceId: 'digForCinders' };
const REAL_RESPONSES = 3;

const browserPath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p));
if (!browserPath) {
  console.error('dialogue-context-fit: UNKNOWN — no Chrome/Chromium found (set $CHROME).');
  process.exit(2);
}

// Mounts the real dialogue screen over the booted app on the probe's quest
// step, at its answering beat, then brings the grid to `count` responses.
const mountProbe = (count) => `(async () => {
  const [{ mountDialogue }, { contentBundle }, { createRegistries }, { createRunState }, { createRng }, { recordEventChoice }] = await Promise.all([
    import('/src/ui/screens/dialogue.js'), import('/src/content/index.js'), import('/src/model/registries.js'),
    import('/src/model/state.js'), import('/src/engine/rng.js'), import('/src/model/quests.js'),
  ]);
  const frames = (n) => new Promise((done) => { const step = () => (n-- > 0 ? requestAnimationFrame(step) : done()); step(); });
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 123, classId: 'reaver', registries });
  recordEventChoice(run, ${JSON.stringify(PROBE_HISTORY)});
  document.getElementById('fit-probe')?.remove();
  const host = document.createElement('div');
  host.id = 'fit-probe';
  host.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;background:#17130f;';
  document.body.appendChild(host);
  // The model clamps the beat to the last one, so the step opens on the beat
  // that offers its responses.
  mountDialogue(host, {
    registries, run, meta: { settings: {} }, rng: createRng(7), eventId: ${JSON.stringify(PROBE_EVENT)}, onDone() {},
    hud: null, entrancePlayed: true,
    dialogueState: { beat: Number.MAX_SAFE_INTEGER, generation: 0, resolved: false, choiceId: null, resultText: '' },
  });
  if (document.fonts?.ready) await document.fonts.ready;
  await frames(2);
  const box = host.querySelector('.dialogue-responses');
  const real = box ? box.querySelectorAll('.dialogue-response').length : 0;
  if (real !== ${REAL_RESPONSES}) throw new Error('the screen rendered ' + real + ' responses for ${PROBE_EVENT}; expected ${REAL_RESPONSES}');
  const template = box.querySelector('.dialogue-response:not([disabled])') || box.lastElementChild;
  while (box.children.length < ${count}) box.appendChild(template.cloneNode(true));
  // The stage refits on resize (its own path), exactly as a live host would.
  window.dispatchEvent(new Event('resize'));
  await frames(3);
  const rendered = box.querySelectorAll('.dialogue-response').length;
  if (rendered !== ${count}) throw new Error('the grid holds ' + rendered + ' responses; expected ${count}');
  const region = host.querySelector('.dialogue-region');
  const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const band = region.getBoundingClientRect();
  const buttons = [...region.querySelectorAll('.dialogue-response')].map((b) => {
    const r = b.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, right: r.right };
  });
  // THE TITLE'S OWN LINE BOX, against the panel's padding box. A display face
  // has taller ascenders than a line of 1.2 leaves room for, and the panel
  // clips what overflows (its ellipsis needs overflow: hidden) — so the quest's
  // name lost its top edge on a phone (owner, 2026-09-18).
  const titleEl = region.querySelector('.dialogue-title');
  const titleStyle = titleEl && getComputedStyle(titleEl);
  const regionStyle = getComputedStyle(region);
  // Rects come back in PAINTED px and computed padding in CSS px, and the app
  // scales the whole frame by --ui-zoom: comparing the two directly made the
  // title look 5.5px out of its own padding box when it sat exactly on it.
  const paint = band.width / region.clientWidth || 1;
  const pad = {
    top: band.top + (parseFloat(regionStyle.paddingTop) + parseFloat(regionStyle.borderTopWidth)) * paint,
    bottom: band.bottom - (parseFloat(regionStyle.paddingBottom) + parseFloat(regionStyle.borderBottomWidth)) * paint,
  };
  let title = null;
  if (titleEl) {
    const r = titleEl.getBoundingClientRect();
    const size = parseFloat(titleStyle.fontSize);
    const canvas = document.createElement('canvas').getContext('2d');
    canvas.font = titleStyle.fontWeight + ' ' + size + 'px ' + titleStyle.fontFamily;
    const m = canvas.measureText(titleEl.textContent || '');
    // The face's own box, which is what the browser paints inside the line box.
    const needs = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    title = {
      top: r.top, bottom: r.bottom, height: r.height,
      lineHeight: parseFloat(titleStyle.lineHeight), fontSize: size, faceNeeds: needs,
      inkAscent: m.actualBoundingBoxAscent, inkDescent: m.actualBoundingBoxDescent,
      displayFontLoaded: document.fonts ? document.fonts.check(titleStyle.fontWeight + ' ' + titleStyle.fontSize + ' Cinzel') : null,
      family: titleStyle.fontFamily.slice(0, 20),
      text: (titleEl.textContent || '').slice(0, 40),
    };
  }
  // The two figures' visible boxes, as the stage publishes them.
  const figures = [...host.querySelectorAll('.dialogue-portrait')].map((el) => ({
    side: el.dataset.side, fit: el.dataset.figureFit,
    box: (el.dataset.figureBox || '').split(',').map(Number),
  }));
  return {
    count: ${count}, zoom, layout: region.dataset.responseLayout, fits: region.dataset.responseFits,
    scrollHeight: region.scrollHeight, clientHeight: region.clientHeight,
    band: { top: band.top, bottom: band.bottom, height: band.height, width: band.width },
    buttons, bandCss: getComputedStyle(host.querySelector('.dialogue-context')).height,
    pad, title, figures, frameWidth: host.clientWidth,
    scrollTop: region.scrollTop, regionPadTop: parseFloat(regionStyle.paddingTop), regionBorderTop: parseFloat(regionStyle.borderTopWidth),
    titleMarginTop: titleStyle ? parseFloat(titleStyle.marginTop) : null, regionAlign: regionStyle.alignContent,
  };
})()`;

// serve() reports the port it was given, so port 0 would never be the one
// the OS assigned: this probe owns a fixed port, like the other capture tools.
const { server, port } = await serve({ root: ROOT, port: 8319, open: false });
const { wsUrl, close } = await launchBrowser({ prefix: 'dialogue-fit-', browser: browserPath, headless: '--headless=new', timeoutMs: 30000 });
let exitCode = 0;
try {
  const cdpPort = Number(new URL(wsUrl.replace(/^ws:/, 'http:')).port);
  let list;
  for (let i = 0; i < 100; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json(); if (list.length) break; } catch { /* retry */ }
    await sleep(100);
  }
  const sock = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { sock.onopen = ok; sock.onerror = no; });
  let id = 0; const waiting = new Map();
  sock.onmessage = (m) => { const g = JSON.parse(m.data); if (g.id != null && waiting.has(g.id)) { const { ok, no } = waiting.get(g.id); waiting.delete(g.id); g.error ? no(new Error(g.error.message)) : ok(g.result); } };
  const send = (method, params = {}) => { const n = ++id; sock.send(JSON.stringify({ id: n, method, params })); return new Promise((ok, no) => waiting.set(n, { ok, no })); };
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  if (OUT) mkdirSync(OUT, { recursive: true });

  const failures = [];
  for (const [width, height] of HOSTS) {
    const tag = `${width}x${height}`;
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?host=${tag}` });
    let ready = false;
    for (let i = 0; i < 300 && !ready; i++) {
      ready = await ev(`location.search.includes('host=${tag}') && document.readyState === 'complete' && !!document.getElementById('app')?.children.length`).catch(() => false);
      if (!ready) await sleep(100);
    }
    // A page that never came up is not a verdict about the band.
    if (!ready) throw new Error(`the game never loaded at ${tag} (http://127.0.0.1:${port}/)`);
    for (const count of [4, 5]) {
      const facts = await ev(mountProbe(count));
      const scrolls = facts.scrollHeight > facts.clientHeight;
      const short = facts.buttons.filter((b) => b.height < TOUCH_TARGET_PX - 0.5);
      const outside = facts.buttons.slice(0, 4).filter((b) => b.top < facts.band.top - 0.5 || b.bottom > facts.band.bottom + 0.5);
      const problems = [];
      // The quest's name is drawn whole, inside the panel's padding box.
      const title = facts.title;
      const titleFits = title
        && title.top >= facts.pad.top - 0.5
        && title.bottom <= facts.pad.bottom + 0.5
        && title.lineHeight >= title.faceNeeds - 0.01;
      if (!title) problems.push('no quest title drawn');
      else if (!titleFits) {
        problems.push(title.lineHeight < title.faceNeeds - 0.01
          ? `the title's line (${title.lineHeight.toFixed(1)}px) is shorter than its face needs (${title.faceNeeds.toFixed(1)}px)`
          : `the title is outside the panel's padding box (top ${(title.top - facts.pad.top).toFixed(1)}px; fromRegionTop ${(title.top - facts.band.top).toFixed(1)}, pad ${facts.regionPadTop}, border ${facts.regionBorderTop}, scrollTop ${facts.scrollTop}, align ${facts.regionAlign}, marginTop ${facts.titleMarginTop})`);
      }
      // Two figures, never closer than the configured floor.
      const boxes = facts.figures.filter((f) => f.box.length === 4);
      const gap = boxes.length === 2 ? boxes[1].box[0] - boxes[0].box[2] : null;
      if (boxes.length !== 2) problems.push(`${boxes.length} figure(s) placed, expected 2`);
      else if (!(gap >= MIN_GAP_PX - 0.5)) problems.push(`the figures are ${gap.toFixed(1)}px apart, under the ${MIN_GAP_PX}px floor`);
      if (count <= 4 && scrolls) problems.push(`scrolls (${facts.scrollHeight} > ${facts.clientHeight})`);
      if (count <= 4 && outside.length) problems.push(`${outside.length} response(s) outside the band`);
      const lost = facts.buttons.filter((b) => b.top < facts.band.top - 0.5 || b.bottom > facts.band.bottom + 0.5);
      if (count > 4 && !scrolls && lost.length) problems.push(`${lost.length} response(s) outside a band that does not scroll`);
      if (short.length) problems.push(`${short.length} response(s) under the ${TOUCH_TARGET_PX}px target`);
      const verdict = problems.length ? 'FAIL' : 'PASS';
      console.log(`  ${verdict}  ${tag} · ${count} responses · layout ${facts.layout} · ${scrolls ? 'scrolls' : 'no scroll'} · band ${facts.clientHeight}/${facts.scrollHeight}px · title ${title ? title.lineHeight.toFixed(1) + '/' + title.faceNeeds.toFixed(1) + 'px ink' + title.inkAscent.toFixed(1) + ' font:' + (title.displayFontLoaded ? 'loaded' : 'FALLBACK') : 'none'} · gap ${gap == null ? 'n/a' : gap.toFixed(1) + 'px'} · buttons ${facts.buttons.map((b) => Math.round(b.height)).join('/')}px${problems.length ? ` — ${problems.join('; ')}` : ''}`);
      if (problems.length) failures.push(`${tag} ${count}: ${problems.join('; ')}`);
      if (OUT) {
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(resolve(OUT, `w4c-${tag}-${count}-responses.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  }
  if (failures.length) {
    console.log(`dialogue-context-fit: FAIL — ${failures.length} case(s)`);
    exitCode = 1;
  } else {
    console.log(`dialogue-context-fit: OK — ${HOSTS.length * 2} cases (4 responses never scroll; with 5, none is lost)`);
  }
} catch (error) {
  console.error(`dialogue-context-fit: ${error.stack || error}`);
  exitCode = 2;
} finally {
  close();
  try { server.close(); } catch { /* already closed */ }
}
process.exit(exitCode);
