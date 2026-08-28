#!/usr/bin/env node
// tools/scroll-cue-bleed.mjs — issue #29: painted bleed and visible scroll cues.
//
// This is deliberately narrower than axisfit, screenreach, or actionreach. It
// opens the real customize, map, and shop shot doors, inventories painted leaf
// boxes, and qualifies every off-screen box against the scrollport that can
// actually recover it. A cue is a camera result: two endpoint captures of the
// scrollport edge must differ above same-position noise and contain a connected
// moving component. Horizontal and vertical witnesses are separate; the paging
// hand is the horizontal control and the map is the vertical control.
//
//   node tools/scroll-cue-bleed.mjs
//   node tools/scroll-cue-bleed.mjs --artifact AshenSpire.html
//   node tools/scroll-cue-bleed.mjs --shots docs/preview/scroll-cue-bleed-source
//
// BOUNDARY: headless Chromium, 360x640 / 390x844 / 412x915 plus 1200x730,
// Text M/XL and UI size S/XL. It does not claim a real OS thumb, WebKit,
// Firefox, a physical gesture, or screen-reader announcement.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { balance } from '../src/content/balance.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const artifactArg = argOf('--artifact');
const artifact = artifactArg ? resolve(ROOT, artifactArg) : null;
const shots = argOf('--shots');
const onlyShape = argOf('--only');
const onlySurface = argOf('--surface');
const historicalRoot = argOf('--historical-root');
const selftest = args.includes('--selftest');
const selftestSource = args.includes('--selftest-source');
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const browserPath = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p));

const PHONES = [[360, 640], [390, 844], [412, 915]];
const SHAPES = [...PHONES, [1200, 730]];
const TEXTS = ['M', 'XL'];
const UI_SIZES = ['s', 'xl'];
const SURFACES = [
  { name: 'customize', shot: 'customize', ready: '.cz-scroll', port: '.cz-scroll', axis: 'y' },
  { name: 'map', shot: 'map', extra: { shotSeed: 'SHOWCASE' }, ready: '.map-scroll .map-node', port: '.map-scroll', axis: 'y' },
  { name: 'shop', shot: 'shop', ready: '#leave-shop', port: '.screen', axis: 'y' },
];

async function runSelftest() {
  const { doorSelftest } = await import('./doorplant.mjs');
  const common = {
    tool: 'scroll-cue-bleed.mjs',
    args: ['--only', '360x640', '--surface', 'shop'],
    timeoutMs: 180000,
    plants: [
      {
        name: 'travel keeps moving while the product thumb paint disappears',
        file: 'styles/ui.css',
        find: '  scrollbar-width: thin; scrollbar-color: var(--line) transparent;',
        replace: '  scrollbar-width: thin; scrollbar-color: transparent transparent;',
        expectRed: /vertical travel without a visible right-edge cue/,
      },
      {
        name: 'a forced cue stands after shop content is made to fit',
        file: 'styles/ui.css',
        append: `#shop-cards, #shop-items, #remove-opt, #leave-shop { display: none !important; }
.screen::after { content: ''; position: fixed; right: 0; top: 160px; width: 8px; height: 48px; background: var(--line); }`,
        expectRed: /cue stands with no scroll/,
      },
      {
        name: 'the retired inner shop scrollport traps the terminal cost tag again',
        file: 'styles/ui.css',
        find: ":root[data-layout='narrow'] #shop-cards.reward-row { max-width: 100%; }",
        replace: ":root[data-layout='narrow'] #shop-cards.reward-row { overflow-x: auto; max-width: 100%; }",
        expectRed: /span\.mini leaf remains beyond y max endpoint/,
      },
    ],
  };
  const source = await doorSelftest(common);
  if (source || selftestSource) return source;
  const rootArtifact = resolve(ROOT, 'AshenSpire.html');
  if (!existsSync(rootArtifact) || !readFileSync(rootArtifact, 'utf8').includes("#shop-cards.reward-row { max-width: 100%; }")) {
    console.error('scroll-cue-bleed --selftest: UNKNOWN — AshenSpire.html does not contain the current #29 seam; regenerate the standalone once after the artifact lane clears.');
    return 2;
  }
  return doorSelftest({ ...common, args: ['--artifact', 'AshenSpire.html', ...common.args], extraCopy: ['AshenSpire.html'], plants: common.plants.map((p) => ({ ...p, file: 'AshenSpire.html' })) });
}

if (selftest || selftestSource) process.exit(await runSelftest());

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

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; colour = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG depth/interlace ${depth}/${interlace}`);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
  if (!ch) throw new Error(`unsupported PNG colour ${colour}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, ch, px: out };
}

function pixelDiff(aBuf, bBuf, threshold = 18) {
  const a = decodePng(aBuf), b = decodePng(bBuf);
  if (a.w !== b.w || a.h !== b.h || a.ch !== b.ch) throw new Error('cue crops changed geometry');
  const mask = new Uint8Array(a.w * a.h);
  let changed = 0, delta = 0;
  for (let i = 0; i < mask.length; i++) {
    const ao = i * a.ch, bo = i * b.ch;
    const d = Math.max(
      Math.abs(a.px[ao] - b.px[bo]),
      Math.abs(a.px[ao + Math.min(1, a.ch - 1)] - b.px[bo + Math.min(1, b.ch - 1)]),
      Math.abs(a.px[ao + Math.min(2, a.ch - 1)] - b.px[bo + Math.min(2, b.ch - 1)]),
    );
    delta += d;
    if (d > threshold) { mask[i] = 1; changed++; }
  }
  let largest = 0;
  const seen = new Uint8Array(mask.length);
  const stack = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    seen[i] = 1; stack.push(i); let n = 0;
    while (stack.length) {
      const at = stack.pop(); n++;
      const x = at % a.w, y = Math.floor(at / a.w);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= a.w || ny >= a.h) continue;
        const ni = ny * a.w + nx;
        if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
      }
    }
    largest = Math.max(largest, n);
  }
  return { pixels: mask.length, changed, largest, mean: +(delta / mask.length).toFixed(3) };
}

const FREEZE = `(() => {
  let s=document.getElementById('__scroll_cue_freeze');
  if (!s) { s=document.createElement('style'); s.id='__scroll_cue_freeze'; document.head.appendChild(s); }
  s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
  return true;
})()`;

const BLEED_PROBE = `(() => {
  const tol=0.75, vw=innerWidth, vh=innerHeight;
  const visible=(e)=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity!==0&&r.width>0.5&&r.height>0.5};
  const leaves=[...document.querySelectorAll('#app *')].filter(e=>visible(e)&&![...e.children].some(visible));
  const directText=[...document.querySelectorAll('#app *')].flatMap(e=>[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>{const q=document.createRange();q.selectNodeContents(n);return {e,r:q.getBoundingClientRect(),kind:'text'}}));
  const boxes=leaves.map(e=>({e,r:e.getBoundingClientRect(),kind:'leaf'})).concat(directText).filter(x=>x.r.width>0.5&&x.r.height>0.5);
  const failures=[];
  const path=e=>{const id=e.id?'#'+e.id:'';const c=typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\\s+/).slice(0,2).join('.'):'';return e.tagName.toLowerCase()+id+c};
  for (const item of boxes) {
    const {e,kind}=item; let r={left:item.r.left,top:item.r.top,right:item.r.right,bottom:item.r.bottom};
    // Judge painted pixels, not an element's pre-clip layout box. Internal SVG
    // viewports and intentional overflow:hidden masks remove paint; they do not
    // create viewport bleed. Scrollports are handled below because their hidden
    // endpoint content remains reachable.
    for (let p=e.parentElement;p&&p!==document.body;p=p.parentElement) {
      const cs=getComputedStyle(p),pr=p.getBoundingClientRect();
      if (['hidden','clip'].includes(cs.overflowX)) {r.left=Math.max(r.left,pr.left);r.right=Math.min(r.right,pr.right)}
      if (['hidden','clip'].includes(cs.overflowY)) {r.top=Math.max(r.top,pr.top);r.bottom=Math.min(r.bottom,pr.bottom)}
    }
    if (r.right-r.left<=0.5||r.bottom-r.top<=0.5) continue;
    for (const axis of ['x','y']) {
      const low=axis==='x'?r.left:r.top, high=axis==='x'?r.right:r.bottom, limit=axis==='x'?vw:vh;
      if (low>=-tol&&high<=limit+tol) continue;
      let port=null;
      for (let p=e.parentElement;p&&p!==document.body;p=p.parentElement) {
        const cs=getComputedStyle(p),ov=axis==='x'?cs.overflowX:cs.overflowY,pr=p.getBoundingClientRect();
        const travel=axis==='x'?p.scrollWidth-p.clientWidth:p.scrollHeight-p.clientHeight;
        if (['auto','scroll'].includes(ov)&&travel>tol) {port=p;break;}
      }
      if (!port) { failures.push(path(e)+' '+kind+' outside viewport on '+axis+' with no traveling scrollport'); continue; }
      const pr=port.getBoundingClientRect(), travel=axis==='x'?port.scrollWidth-port.clientWidth:port.scrollHeight-port.clientHeight;
      const scale=axis==='x'?(port.clientWidth?pr.width/port.clientWidth:1):(port.clientHeight?pr.height/port.clientHeight:1);
      const visualTravel=travel*scale;
      const pl=axis==='x'?pr.left:pr.top, ph=axis==='x'?pr.right:pr.bottom;
      const start=(axis==='x'?port.scrollLeft:port.scrollTop)*scale;
      if (low<pl-tol&&start<tol) failures.push(path(e)+' '+kind+' lies before '+axis+' origin');
      if (high-start-visualTravel>ph+tol) failures.push(path(e)+' '+kind+' remains beyond '+axis+' max endpoint'
        +' (edge '+high.toFixed(1)+' - travel '+visualTravel.toFixed(1)+' > port '+ph.toFixed(1)+'; '+path(port)+')');
    }
  }
  return { boxes:boxes.length, failures, viewport:[vw,vh] };
})()`;

async function historicalReplay() {
  const oldRoot = resolve(historicalRoot);
  if (!existsSync(resolve(oldRoot, 'index.html'))) {
    console.error(`scroll-cue-bleed historical: UNKNOWN — no index.html in ${oldRoot}`); return 2;
  }
  if (!browserPath) { console.error('scroll-cue-bleed historical: UNKNOWN — no Chromium found'); return 2; }
  const served = await serve({ root: oldRoot, port: 8287, open: false });
  let cdp, dropBrowser = async () => {};
  try {
    const launched = await launchBrowser({
      prefix: 'scroll-history-', browser: browserPath,
      args: ['--disable-background-timer-throttling', '--disable-features=OverlayScrollbar'], timeoutMs: 15000,
    });
    dropBrowser = launched.close;
    cdp = connect(launched.wsUrl); await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    const ev = async (expression) => {
      const out = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
      if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description || 'historical page evaluation failed');
      return out.result.value;
    };
    const until = async (expression, label) => {
      const start = Date.now();
      while (Date.now() - start < 12000) { if (await ev(expression).catch(() => false)) return; await wait(120); }
      throw new Error(`historical timeout waiting for ${label}`);
    };
    const captureOld = async (name) => {
      if (!shots) return;
      const png = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, S);
      const out = resolve(ROOT, `${shots}-${name}.png`); mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, Buffer.from(png.data, 'base64'));
    };
    const rows = [];
    for (const [width, height] of [[360, 640], [1200, 730]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, S);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: width < 700, maxTouchPoints: 5 }, S);

      // 2c40fdb predates ?shot=customize. Use the actual empty-slot "BEGIN A
      // CLIMB" action that mounted mountCustomize at that ref; inventing
      // today's shot door would not replay it.
      await cdp.send('Page.navigate', { url: `http://localhost:${served.port}/` }, S);
      await until(`!!document.querySelector('.slot-new')`, `${width}x${height} historical Begin a Climb action`);
      await ev(`document.querySelector('.slot-new').click(); true`);
      await until(`!!document.querySelector('.screen.customize')`, `${width}x${height} historical customize`);
      await ev(FREEZE); await wait(350);
      const custom = await ev(BLEED_PROBE);
      rows.push({ shape: `${width}x${height}`, surface: 'customize', failures: custom.failures });
      await captureOld(`customize-${width}x${height}`);

      await cdp.send('Page.navigate', { url: `http://localhost:${served.port}/?shot=map` }, S);
      await until(`!!document.querySelector('.map-scroll') && !!document.querySelector('.map-node')`, `${width}x${height} historical map`);
      await ev(FREEZE); await wait(350);
      const map = await ev(BLEED_PROBE);
      rows.push({ shape: `${width}x${height}`, surface: 'map', failures: map.failures });
      await captureOld(`map-${width}x${height}`);
    }
    let bad = 0;
    console.log(`\nscroll-cue-bleed historical replay — ${oldRoot}`);
    for (const row of rows) {
      const phone = row.shape === '360x640';
      // The recorded map had horizontal travel, but the current removal rule
      // permits content inside a real traveling/cued port. Report that old cell
      // without manufacturing a red. The historical product red this replay
      // must preserve is Customize's negative-origin content.
      const expected = phone && row.surface === 'customize'
        ? row.failures.length > 0
        : row.failures.length === 0;
      const note = phone && row.surface === 'map' ? ' (informational under the current recoverable-scroll rule)' : '';
      console.log(`  ${expected ? '✓' : '✗'} ${row.shape} ${row.surface}: ${row.failures.length} unrecoverable painted box(es)${row.failures[0] ? ` — ${row.failures[0]}` : ''}${note}`);
      if (!expected) bad++;
    }
    console.log('EXPECTED: historical 360x640 Customize RED and same-ref 1200x730 zero-bleed GREEN; map is classified by today\'s recoverable-scroll rule.');
    return bad ? 1 : 0;
  } finally {
    if (cdp) cdp.close(); await dropBrowser(); served.server.close();
  }
}

if (historicalRoot) process.exit(await historicalReplay());

async function main() {
  if (!browserPath) { console.error('scroll-cue-bleed: UNKNOWN — no Chromium found'); return 2; }
  if (artifact && !existsSync(artifact)) { console.error(`scroll-cue-bleed: UNKNOWN — artifact absent: ${artifact}`); return 2; }
  if (!balance?.ui?.textSize?.M || !balance?.ui?.textSize?.XL) {
    console.error('scroll-cue-bleed: UNKNOWN — Text M/XL not readable from balance.ui.textSize'); return 2;
  }
  let server = null;
  let base;
  if (artifact) base = pathToFileURL(artifact).href;
  else { const served = await serve({ root: ROOT, port: 8282, open: false }); server = served.server; base = `http://localhost:${served.port}/`; }
  let dropBrowser = async () => {};
  let cdp;
  try {
    const launched = await launchBrowser({
      prefix: 'scroll-cue-', browser: browserPath,
      args: ['--allow-file-access-from-files', '--disable-background-timer-throttling', '--disable-features=OverlayScrollbar'], timeoutMs: 15000,
    });
    dropBrowser = launched.close;
    cdp = connect(launched.wsUrl); await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    const ev = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page evaluation failed');
      return result.result.value;
    };
    const until = async (expression, label) => {
      const start = Date.now();
      while (Date.now() - start < 12000) { if (await ev(expression).catch(() => false)) return; await wait(120); }
      throw new Error(`timed out waiting for ${label}`);
    };
    const urlFor = (shot, settings, extra = {}) => {
      const u = new URL(base); u.searchParams.set('shot', shot);
      for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
      u.searchParams.set('shotSettings', JSON.stringify(settings)); return u.href;
    };
    const capture = async (clip) => Buffer.from((await cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false, clip,
    }, S)).data, 'base64');
    const fullShot = async (name) => {
      if (!shots) return;
      const png = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, S);
      const out = resolve(ROOT, `${shots}-${name}.png`); mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, Buffer.from(png.data, 'base64'));
    };
    const cue = async (selector, axis, cueOff = false) => {
      if (cueOff) await ev(`(() => { let s=document.getElementById('__cue_off'); if(!s){s=document.createElement('style');s.id='__cue_off';document.head.appendChild(s)} s.textContent=${JSON.stringify(`${selector}{scrollbar-color:transparent transparent!important}${selector}::-webkit-scrollbar-thumb{background:transparent!important;border-color:transparent!important;box-shadow:none!important}${selector}::after{display:none!important}`)}; return true })()`);
      else await ev(`document.getElementById('__cue_off')?.remove(); true`);
      const meta = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); const r=e.getBoundingClientRect(); const axis=${JSON.stringify(axis)}; e.scrollLeft=0;e.scrollTop=0; return {x:r.left,y:r.top,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight,travel:axis==='x'?e.scrollWidth-e.clientWidth:e.scrollHeight-e.clientHeight}; })()`);
      const band = 12;
      const clip = axis === 'x'
        ? { x: Math.max(0, meta.x), y: Math.max(0, meta.y + meta.h - band), width: Math.max(1, Math.min(meta.vw - Math.max(0, meta.x), meta.w)), height: Math.min(band, meta.h), scale: 1 }
        : { x: Math.max(0, meta.x + meta.w - band), y: Math.max(0, meta.y), width: Math.min(band, meta.w), height: Math.max(1, meta.h), scale: 1 };
      // CDP clips must remain in the viewport; geometry is CSS pixels.
      clip.width = Math.max(1, Math.min(clip.width, (axis === 'x' ? meta.x + meta.w : meta.x + meta.w) - clip.x));
      clip.height = Math.max(1, Math.min(clip.height, meta.vh - clip.y, meta.y + meta.h - clip.y));
      await wait(100); const sameA = await capture(clip); await wait(100); const sameB = await capture(clip);
      if (meta.travel < 1) return { travel: meta.travel, start: sameA, noise: pixelDiff(sameA, sameB), endpoint: null };
      await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(${JSON.stringify(axis)}==='x') e.scrollLeft=e.scrollWidth-e.clientWidth; else e.scrollTop=e.scrollHeight-e.clientHeight; return true })()`);
      await wait(100); const end = await capture(clip);
      return { travel: meta.travel, start: sameA, end, noise: pixelDiff(sameA, sameB), endpoint: pixelDiff(sameA, end) };
    };

    const failures = [], rows = [];
    for (const [width, height] of SHAPES) {
      if (onlyShape && onlyShape !== `${width}x${height}`) continue;
      const phone = width < 700;
      // Keep desktop scrollbar painting while using a phone-shaped viewport.
      // `mobile:true` makes Chromium substitute an OS overlay scrollbar that
      // headless capture does not paint, which would make the camera incapable
      // of satisfying its required paging-hand positive control. Touch remains
      // enabled below; layout selection is the app's width/height decider.
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, S);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: phone, maxTouchPoints: 5 }, S);
      for (const textSize of TEXTS) {
        for (const uiScale of UI_SIZES) {
          // The wide control needs one supported profile, not four duplicate cells.
          if (!phone && (textSize !== 'M' || uiScale !== 's')) continue;
          for (const surface of SURFACES) {
            if (onlySurface && onlySurface !== surface.name) continue;
            const appliedUi = phone ? uiScale : 'auto';
            const settings = { textSize, uiScale: appliedUi };
            await cdp.send('Page.navigate', { url: urlFor(surface.shot, settings, surface.extra) }, S);
            await until(`!!document.querySelector(${JSON.stringify(surface.ready)})`, `${surface.name} ${width}x${height}`);
            await ev(FREEZE); await wait(450);
            const bleed = await ev(BLEED_PROBE);
            const vertical = await cue(surface.port, 'y');
            const verticalOff = await cue(surface.port, 'y', true);
            await ev(`document.getElementById('__cue_off')?.remove(); true`);
            const hasTravel = vertical.travel > 0.75;
            const noise = vertical.noise?.largest || 0;
            const component = vertical.endpoint?.largest || 0;
            const offComponent = verticalOff.endpoint?.largest || 0;
            const standing = pixelDiff(vertical.start, verticalOff.start).largest;
            const cueGreen = hasTravel
              ? (!phone || component > Math.max(8, noise * 2 + 2, offComponent + 4))
              : standing <= Math.max(4, noise * 2 + 2);
            const label = `${surface.name} ${width}x${height} Text ${textSize} UI ${appliedUi}`;
            rows.push({ label, boxes: bleed.boxes, bleed: bleed.failures.length, travel: +vertical.travel.toFixed(1), component, noise, offComponent, standing, cueGreen });
            if (bleed.failures.length) failures.push(`${label}: ${bleed.failures[0]}`);
            if (hasTravel && !cueGreen) failures.push(`${label}: ${vertical.travel.toFixed(1)}px vertical travel without a visible right-edge cue (${component} component px, cue-off ${offComponent}, noise ${noise})`);
            if (!hasTravel && standing > Math.max(4, noise * 2 + 2)) failures.push(`${label}: cue stands with no scroll (${standing} changed px, noise ${noise})`);
            if ((phone && textSize === 'XL' && uiScale === 'xl') || (!phone && textSize === 'M')) {
              await fullShot(`${surface.name}-${width}x${height}-text-${textSize.toLowerCase()}-ui-${appliedUi}`);
              if (shots && surface.name === 'map' && width === 390 && textSize === 'XL' && uiScale === 'xl') {
                const stem = resolve(ROOT, `${shots}-cue-map`); mkdirSync(dirname(stem), { recursive: true });
                writeFileSync(`${stem}-start.png`, vertical.start); writeFileSync(`${stem}-end.png`, vertical.end); writeFileSync(`${stem}-off.png`, verticalOff.start);
              }
            }
          }

          // Horizontal calibration: the paging hand must show a moving bottom cue.
          if (onlySurface && onlySurface !== 'hand') continue;
          const appliedUi = phone ? uiScale : 'auto';
          const handMax = balance?.handMax || balance?.combat?.handMax || 10;
          await cdp.send('Page.navigate', { url: urlFor('combat', { textSize, uiScale: appliedUi, handLayout: 'paging' }, { shotHand: String(handMax) }) }, S);
          await until(`!!document.querySelector('.hand .card')`, `paging hand ${width}x${height}`);
          await ev(FREEZE); await wait(350);
          const hand = await cue('.hand', 'x');
          const handOff = await cue('.hand', 'x', true);
          await ev(`document.getElementById('__cue_off')?.remove(); true`);
          const handNoise = hand.noise?.largest || 0, handComponent = hand.endpoint?.largest || 0;
          const handOffComponent = handOff.endpoint?.largest || 0;
          const handStanding = pixelDiff(hand.start, handOff.start).largest;
          const handGreen = !phone || (hand.travel > 0.75 && handComponent > Math.max(8, handNoise * 2 + 2, handOffComponent + 4));
          rows.push({ label: `hand-control ${width}x${height} Text ${textSize} UI ${appliedUi}`, boxes: '-', bleed: '-', travel: +hand.travel.toFixed(1), component: handComponent, noise: handNoise, offComponent: handOffComponent, standing: handStanding, cueGreen: handGreen });
          if (!handGreen) failures.push(`hand-control ${width}x${height} Text ${textSize} UI ${appliedUi}: paging hand did not produce a thumb-specific bottom-band cue (${handComponent} component px, cue-off ${handOffComponent}, noise ${handNoise})`);
          if (width === 390 && textSize === 'XL' && uiScale === 'xl') {
            await fullShot(`hand-control-${width}x${height}-text-${textSize.toLowerCase()}-ui-${appliedUi}`);
            if (shots) {
              const stem = resolve(ROOT, `${shots}-cue-hand`); mkdirSync(dirname(stem), { recursive: true });
              writeFileSync(`${stem}-start.png`, hand.start); writeFileSync(`${stem}-end.png`, hand.end); writeFileSync(`${stem}-off.png`, handOff.start);
            }
          }
        }
      }
    }

    console.log(`\nscroll-cue-bleed — ${artifact ? artifact : 'source tree'}`);
    for (const r of rows) console.log(`  ${(r.bleed === 0 || r.bleed === '-') && r.cueGreen ? '✓' : '✗'} ${r.label} · boxes ${r.boxes} · bleed ${r.bleed} · travel ${r.travel}px · cue on/off/noise/standing ${r.component}/${r.offComponent || 0}/${r.noise}/${r.standing || 0}`);
    if (failures.length) {
      console.error(`\nRED — ${failures.length} focused failure(s)`); for (const f of failures) console.error(`  - ${f}`);
    } else console.log('\nGREEN — every painted box is recoverable and every traveling port has a measured cue.');
    console.log('\nBOUNDARY: Chromium only; UI size S/XL, Text M/XL, three portrait shapes plus 1200x730 Auto control.');
    console.log('          .hand qualifies horizontal/bottom-band only; map qualifies vertical/right-edge.');
    return failures.length ? 1 : 0;
  } finally {
    if (cdp) cdp.close(); await dropBrowser(); if (server) server.close();
  }
}

process.exitCode = await main().catch((error) => { console.error(`scroll-cue-bleed: UNKNOWN — ${error.stack || error.message}`); return 2; });
