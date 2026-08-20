// Focused guard-hit parity gate (#207).
//
// The fast door proves the semantic split, the authoritative co-op session
// receipts, and nine named source mutations. `--browser` adds both real product
// paths: seeded solo combat through its real engine/event/FX pipeline, then two
// LAN clients through lobby, shared map vote, live fight, real Defend cards and
// real End Turn controls. `--standalone` selects the root artifact instead of
// the source page. `--shots DIR` records those measured frames.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession, setCombatStartStateForTools } from './session.mjs';
import { guardHitFloatParts } from '../src/ui/fx.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const standalone = args.includes('--standalone');
const evidenceDoor = standalone ? 'root' : 'source';
const reviewMoment = args.includes('--review-before') ? 'before' : 'after';
const coopOnly = args.includes('--coop-only');
const requestedCase = argOf('--case');

function sourceContract(tree) {
  return [
    /const residual = amount - blocked;/.test(tree.fx),
    /guard: blocked > 0 \? \{ text: String\(blocked\), cls: 'blk small' \}/.test(tree.fx),
    /damage: residual > 0 \? \{ text: `-\$\{residual\}`/.test(tree.fx),
    /\(type === 'damageDealt' \|\| type === 'hpLost'\) && payload\.targetId === 'player'[\s\S]{0,120}playerId: combat\.playerKey/.test(tree.session),
    /\.filter\(\(e\) => \[[^\]]*'damageDealt'/.test(tree.session),
    /e\.type === 'hpLost' && e\.cause !== 'attack'/.test(tree.session),
    /cause: e\.cause/.test(tree.session),
    /ev\.type === 'damageDealt' \|\| \(ev\.type === 'hpLost' && ev\.cause !== 'attack'\)/.test(tree.coop),
    /receiptCounts\.set\(row\.targetKey,[\s\S]{0,500}const stackY = [^;]+ \* 18;/.test(tree.coop),
    /receiptLossByTarget\.set\(targetKey,[\s\S]{0,120}\+ amount\)/.test(tree.coop),
    /receiptLossByTarget\.set\(targetKey,[\s\S]{0,120}\+ parts\.residual\)/.test(tree.coop),
    /const unreceipted = Math\.max\(0, dmg - \(receiptLossByTarget\.get\(`enemy:\$\{e\.id\}`\) \|\| 0\)\)/.test(tree.coop),
    /const unreceipted = Math\.max\(0, dmg - \(receiptLossByTarget\.get\(`player:\$\{p\.id\}`\) \|\| 0\)\)/.test(tree.coop),
  ].every(Boolean);
}

if (args.includes('--artifact-check')) {
  const html = readFileSync(resolve(ROOT, 'AshenSpire.html'), 'utf8');
  // The selected standalone carries the UI seams; its real LAN server still
  // executes tools/session.mjs, so the artifact door binds both exact inputs.
  const session = readFileSync(resolve(ROOT, 'tools/session.mjs'), 'utf8');
  const ok = sourceContract({ fx: html, coop: html, session });
  console.log(`guard-float-parity artifact contract: ${ok ? 'OK' : 'RED'}`);
  process.exit(ok ? 0 : 1);
}

if (args.includes('--selftest') || args.includes('--selftest-source')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const plants = [
    ['solo-collapses-to-preblock-total', 'src/ui/fx.js', 'const residual = amount - blocked;', 'const residual = amount;'],
    ['absorbed-channel-omitted', 'src/ui/fx.js', "guard: blocked > 0 ? { text: String(blocked), cls: 'blk small' } : null", 'guard: null'],
    ['absorbed-mislabeled-as-gain', 'src/ui/fx.js', 'text: String(blocked)', 'text: `+${blocked}`'],
    ['coop-drops-damage-receipt', 'tools/session.mjs', "'enemyMoveStarted', 'damageDealt',", "'enemyMoveStarted',"],
    ['coop-drops-nonattack-hp-loss', 'tools/session.mjs', "|| (e.type === 'hpLost' && e.cause !== 'attack')", ''],
    ['coop-loses-hp-loss-player-owner', 'tools/session.mjs', "(type === 'damageDealt' || type === 'hpLost')", "type === 'damageDealt'"],
    ['coop-drops-receipt-processing', 'src/ui/screens/coop.js', "ev.type === 'damageDealt' || (ev.type === 'hpLost' && ev.cause !== 'attack')", "ev.type === 'damageDealt'"],
    ['coop-suppresses-unreceipted-remainder', 'src/ui/screens/coop.js', 'dmg - (receiptLossByTarget.get(`enemy:${e.id}`) || 0)', 'receiptLossByTarget.has(`enemy:${e.id}`) ? 0 : dmg'],
    ['coop-collapses-same-target-stack', 'src/ui/screens/coop.js', '* 18;', '* 0;'],
  ];
  const sourceStatus = await doorSelftest({
    tool: 'guard-float-parity.mjs', timeoutMs: 300000,
    plants: plants.map(([name, file, find, replace]) => ({ name, file, find, replace, expectRed: /GUARD FLOAT PARITY FAILED/ })),
  });
  if (sourceStatus || args.includes('--selftest-source')) process.exit(sourceStatus);
  const artifactFiles = ['AshenSpire.html', 'AshenSpire.html', 'AshenSpire.html', 'tools/session.mjs', 'tools/session.mjs', 'tools/session.mjs', 'AshenSpire.html', 'AshenSpire.html', 'AshenSpire.html'];
  const artifactStatus = await doorSelftest({
    tool: 'guard-float-parity.mjs', args: ['--artifact-check'], timeoutMs: 300000,
    extraCopy: ['AshenSpire.html'],
    plants: plants.map(([name, , find, replace], index) => ({
      name: `selected-artifact twin: ${name}`, file: artifactFiles[index], find, replace,
      expectRed: /artifact contract: RED/,
    })),
  });
  process.exit(artifactStatus);
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: done, reject } = pending.get(message.id); pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else done(message.result);
  });
  return {
    ready: new Promise((done, reject) => { ws.addEventListener('open', done); ws.addEventListener('error', reject); }),
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

async function browserDoor() {
  const browserArg = argOf('--browser');
  const browsers = [
    browserArg && !browserArg.startsWith('--') ? browserArg : null, process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].filter(Boolean);
  const browserPath = browsers.find((path) => existsSync(path));
  if (!browserPath) throw new Error('no Chrome/Edge found — pass --browser PATH or set CHROME');
  const requestedShape = argOf('--shape');
  const shapes = [
    { tag: '390x844', width: 390, height: 844, dpr: 3 },
    { tag: '1200x730', width: 1200, height: 730, dpr: 1 },
  ].filter((shape) => !requestedShape || shape.tag === requestedShape);
  if (!shapes.length) throw new Error(`unknown --shape ${requestedShape}; use 390x844 or 1200x730`);
  const shots = argOf('--shots');
  const cases = [
    { name: 'full', className: 'Reaver', defend: true, before: { hp: 30, block: 10 }, after: { hp: 30, block: 3 }, blocked: 7, soloTexts: ['7'], coopTexts: ['-7', '7'], review: { cardId: 'gorefireSlash', cardName: 'Gorefire Slash', hp: 2, texts: ['-5', '-8'], cause: 'proc:bleed' } },
    { name: 'partial', className: 'Herald', defend: true, before: { hp: 30, block: 4 }, after: { hp: 27, block: 0 }, blocked: 4, soloTexts: ['-3', '4'], coopTexts: ['-3', '-7', '4'], review: { cardId: 'twinbladeFlurry', cardName: 'Twinblade Flurry', hp: 21, texts: ['-3', '-3', '-3'] } },
    { name: 'unguarded', className: 'Reaver', defend: false, before: { hp: 30, block: 0 }, after: { hp: 23, block: 0 }, blocked: 0, soloTexts: ['-7'], coopTexts: ['-7', '-7'] },
  ].filter((row) => !requestedCase || row.name === requestedCase);
  if (!cases.length) throw new Error(`unknown --case ${requestedCase}; use full, partial or unguarded`);
  const findings = [];
  const check = (condition, label, detail = '') => {
    console.log(`    ${condition ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!condition) findings.push(label);
  };
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'guardfloat-', browser: browserPath,
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const makeTab = async (shape) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: shape.width, height: shape.height, deviceScaleFactor: shape.dpr, mobile: shape.dpr > 1,
    }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: shape.dpr > 1, maxTouchPoints: 5 }, sessionId);
    return { targetId, sessionId };
  };
  const evaluate = async (tab, expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, tab.sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page threw');
    return result.result.value;
  };
  const until = async (tab, expression, label, timeoutMs = 25000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await evaluate(tab, expression).catch(() => false)) return;
      await wait(120);
    }
    throw new Error(`timeout waiting for ${label}`);
  };
  // SVG map nodes do not implement HTMLElement.click() in every Chromium build;
  // the product listens for the bubbling click event, so use that one door for
  // HTML buttons, cards and SVG nodes alike.
  const click = (selector) => `(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)return false; el.dispatchEvent(new MouseEvent('click',{bubbles:true})); return true; })()`;
  const pointOf = async (tab, selector) => evaluate(tab, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return r.width&&r.height?{x:r.left+r.width/2,y:r.top+r.height/2}:null})()`);
  const press = async (tab, shape, selector) => {
    const point = await pointOf(tab, selector);
    if (!point) throw new Error(`${selector} has no pressable box`);
    const holdMs = await evaluate(tab, `Number(document.querySelector(${JSON.stringify(selector)})?.dataset.holdMs||0)`);
    if (shape.dpr > 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] }, tab.sessionId);
      await wait(holdMs + 260);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, tab.sessionId);
    } else {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }, tab.sessionId);
      await wait(holdMs + 260);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 }, tab.sessionId);
    }
  };
  const writeShot = async (tab, name) => {
    if (!shots) return;
    mkdirSync(resolve(shots), { recursive: true });
    await cdp.send('Page.bringToFront', {}, tab.sessionId); await wait(80);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, tab.sessionId);
    writeFileSync(join(resolve(shots), name), Buffer.from(data, 'base64'));
    console.log(`    shot ${name}`);
  };
  const writeContactSheet = async (shape) => {
    if (!shots) return;
    const entries = cases.flatMap((row) => ['solo', 'coop'].map((mode) => {
      const filename = `guard-float-after-${evidenceDoor}-${shape.tag}-${mode}-${row.name}.png`;
      const bytes = readFileSync(join(resolve(shots), filename));
      return { row: row.name, mode, filename, src: `data:image/png;base64,${bytes.toString('base64')}` };
    }));
    const cards = entries.map((entry) => `<figure><figcaption><b>${entry.row.toUpperCase()}</b> · ${entry.mode === 'solo' ? 'SOLO' : 'TWO-CLIENT'}</figcaption><img src="${entry.src}" alt="${entry.row} ${entry.mode} guard-hit evidence"></figure>`).join('');
    const imageHeight = shape.tag === '390x844' ? 760 : 430;
    const html = `<!doctype html><meta charset="utf-8"><title>#207 ${shape.tag} ${evidenceDoor} evidence</title><style>
      *{box-sizing:border-box}body{margin:0;padding:24px;background:#0b0a08;color:#f4e6bd;font:18px/1.3 system-ui,sans-serif}
      h1{margin:0 0 20px;color:#f2c85b;font:800 30px/1.2 system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
      figure{margin:0;padding:10px;border:1px solid #8d7747;background:#15120d;border-radius:8px}figcaption{padding:0 2px 8px;color:#ddd4c2}b{color:#f3c86d}
      img{display:block;width:100%;height:${imageHeight}px;object-fit:contain;object-position:top center;background:#070604;border:1px solid #353029}
    </style><h1>GUARD HIT FLOATS · ${evidenceDoor.toUpperCase()} · ${shape.tag} · AFTER</h1><main class="grid">${cards}</main>`;
    const tab = await makeTab({ width: 1400, height: 900, dpr: 1 });
    try {
      await evaluate(tab, `(()=>{document.open();document.write(${JSON.stringify(html)});document.close();return true})()`);
      await until(tab, `[...document.images].length===6&&[...document.images].every(img=>img.complete&&img.naturalWidth>0)`, 'contact-sheet images', 30000);
      await wait(120);
      const metrics = await cdp.send('Page.getLayoutMetrics', {}, tab.sessionId);
      const size = metrics.cssContentSize || metrics.contentSize;
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
      }, tab.sessionId);
      const name = `guard-float-${evidenceDoor}-contact-${shape.tag === '390x844' ? 'phone' : 'desktop'}.png`;
      writeFileSync(join(resolve(shots), name), Buffer.from(data, 'base64'));
      console.log(`\n    contact sheet ${name}`);
    } finally {
      await cdp.send('Target.closeTarget', { targetId: tab.targetId }).catch(() => {});
    }
  };
  const writeReviewContactSheet = async (shape) => {
    if (!shots) return;
    const reviewCases = cases.filter((row) => row.review);
    const entries = reviewCases.flatMap((row) => ['before', 'after'].map((moment) => {
      const filename = `guard-float-review-${moment}-${evidenceDoor}-${shape.tag}-${row.review.cardId}.png`;
      const path = join(resolve(shots), filename);
      if (!existsSync(path)) return null;
      return { name: row.review.cardName, moment, src: `data:image/png;base64,${readFileSync(path).toString('base64')}` };
    })).filter(Boolean);
    if (entries.length !== reviewCases.length * 2) return;
    const cards = entries.map((entry) => `<figure><figcaption><b>${entry.name}</b> · ${entry.moment.toUpperCase()}</figcaption><img src="${entry.src}" alt="${entry.name} ${entry.moment} receipt evidence"></figure>`).join('');
    const imageHeight = shape.tag === '390x844' ? 760 : 430;
    const html = `<!doctype html><meta charset="utf-8"><title>#207 blocker correction ${shape.tag} ${evidenceDoor}</title><style>
      *{box-sizing:border-box}body{margin:0;padding:24px;background:#0b0a08;color:#f4e6bd;font:18px/1.3 system-ui,sans-serif}
      h1{margin:0 0 20px;color:#f2c85b;font:800 30px/1.2 system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
      figure{margin:0;padding:10px;border:1px solid #8d7747;background:#15120d;border-radius:8px}figcaption{padding:0 2px 8px;color:#ddd4c2}b{color:#f3c86d}
      img{display:block;width:100%;height:${imageHeight}px;object-fit:contain;object-position:top center;background:#070604;border:1px solid #353029}
    </style><h1>CO-OP DAMAGE RECEIPTS · ${evidenceDoor.toUpperCase()} · ${shape.tag} · BEFORE → AFTER</h1><main class="grid">${cards}</main>`;
    const tab = await makeTab({ width: 1400, height: 900, dpr: 1 });
    try {
      await evaluate(tab, `(()=>{document.open();document.write(${JSON.stringify(html)});document.close();return true})()`);
      await until(tab, `[...document.images].length===4&&[...document.images].every(img=>img.complete&&img.naturalWidth>0)`, 'review contact-sheet images', 30000);
      await wait(120);
      const metrics = await cdp.send('Page.getLayoutMetrics', {}, tab.sessionId);
      const size = metrics.cssContentSize || metrics.contentSize;
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
      }, tab.sessionId);
      const name = `guard-float-review-${evidenceDoor}-${shape.tag === '390x844' ? 'phone' : 'desktop'}.png`;
      writeFileSync(join(resolve(shots), name), Buffer.from(data, 'base64'));
      console.log(`\n    review contact sheet ${name}`);
    } finally {
      await cdp.send('Target.closeTarget', { targetId: tab.targetId }).catch(() => {});
    }
  };
  const closeServer = async (server) => {
    // The inlined standalone may retain an HTTP keep-alive connection after
    // its tab closes; drain it so a completed product cell cannot hang the gate.
    server.server.closeAllConnections?.();
    await new Promise((done) => server.server.close(done));
  };

  try {
    let port = 8527;
    if (!coopOnly) for (const shape of shapes) {
      const server = await serve({ root: ROOT, port: port++, open: false, lan: false });
      const base = `http://localhost:${server.port}/${standalone ? 'AshenSpire.html' : 'index.html'}`;
      const solo = await makeTab(shape);
      try {
        for (const row of cases) {
          console.log(`\n  ${shape.tag} ${row.name} — real solo GUARD2 engine/event/FX`);
          const settings = encodeURIComponent(JSON.stringify({ animSpeed: 'slow' }));
          await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSeed=GUARD2&shotSettings=${settings}` }, solo.sessionId);
          await until(solo, `!!window.__combat&&!!document.querySelector('.combat .end-turn')`, 'solo GUARD2 combat');
          const setup = await evaluate(solo, `(()=>{
            const c=window.__combat;
            const intent=c.enemies.find(e=>e.alive)?.intent;
            c.player.hp=${row.before.hp}; c.player.block=${row.before.block};
            window.__guardReceipt=null; window.__guardAfter=null;
            const emit=c.emit.bind(c);
            c.emit=(type,payload)=>{const event=emit(type,payload);if(type==='damageDealt'&&payload.targetId==='player'){
              window.__guardReceipt=structuredClone(event);window.__guardAfter={hp:c.player.hp,block:c.player.block};
            }return event};
            return{hp:c.player.hp,block:c.player.block,intent};
          })()`);
          check(setup.hp === row.before.hp && setup.block === row.before.block,
            `${row.name}: debug establishes only HP${row.before.hp}/B${row.before.block}`,
            `HP${setup.hp}/B${setup.block}`);
          check(setup.intent?.moveId === 'slash' && setup.intent?.damage === 7,
            `${row.name}: GUARD2 opens one real 7-damage slash`, JSON.stringify(setup.intent));
          await press(solo, shape, '.end-turn');
          await until(solo, `!!window.__guardReceipt`, 'solo damageDealt receipt');
          await until(solo, `document.querySelectorAll('.fx-layer .float-num').length>=${row.soloTexts.length}`, 'solo visible float channels', 12000);
          // The number spawns before the same paced beat updates the HUD. Read
          // after that update but before the next beat resets retained Block.
          await wait(170);
          const reading = await evaluate(solo, `(()=>{
            const layer=document.querySelector('.fx-layer'),anchor=document.querySelector('[data-eid="player"] .sprite')||document.querySelector('[data-eid="player"]');
            const lr=layer.getBoundingClientRect(),ar=anchor.getBoundingClientRect();
            const nodes=[...layer.querySelectorAll('.float-num')];
            const floats=nodes.map(n=>{const r=n.getBoundingClientRect();return{text:n.textContent,cls:n.className,color:getComputedStyle(n).color,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}});
            return{receipt:window.__guardReceipt,eventAfter:window.__guardAfter,texts:floats.map(x=>x.text).sort(),floats,layer:{left:lr.left,top:lr.top,right:lr.right,bottom:lr.bottom},anchor:{left:ar.left,top:ar.top,right:ar.right,bottom:ar.bottom},hud:{hp:document.querySelector('[data-eid="player"] [data-res="hp"]')?.textContent?.trim(),block:document.querySelector('[data-eid="player"] .block-badge')?.textContent?.trim()||'0'}};
          })()`);
          check(reading.receipt?.amount === 7 && reading.receipt?.blocked === row.blocked,
            `${row.name}: real solo receipt is amount 7 / blocked ${row.blocked}`, JSON.stringify(reading.receipt));
          check(reading.eventAfter?.hp === row.after.hp && reading.eventAfter?.block === row.after.block,
            `${row.name}: state at authoritative hit is HP${row.after.hp}/B${row.after.block}`, JSON.stringify(reading.eventAfter));
          check(JSON.stringify(reading.texts) === JSON.stringify(row.soloTexts),
            `${row.name}: exact solo channels ${row.soloTexts.join(' + ')}`, reading.texts.join(' + '));
          const guard = reading.floats.find((part) => part.cls.includes('blk'));
          const damage = reading.floats.find((part) => part.cls.includes('dmg'));
          check(row.blocked ? !!guard && !guard.text.startsWith('+') : !guard,
            `${row.name}: guard channel is unsigned block vocabulary`, guard?.text || 'no guard channel');
          check(row.after.hp < row.before.hp ? !!damage : !damage,
            `${row.name}: damage channel exists only for HP loss`, damage?.text || 'no damage channel');
          check(reading.floats.every(({ rect }) => rect.left >= reading.layer.left && rect.right <= reading.layer.right
              && rect.top >= reading.layer.top && rect.bottom <= reading.layer.bottom),
            `${row.name}: solo results stay on-glass`);
          check(reading.floats.length < 2 || reading.floats.every((a, i) => reading.floats.every((b, j) => i >= j
              || a.rect.right <= b.rect.left || b.rect.right <= a.rect.left || a.rect.bottom <= b.rect.top || b.rect.bottom <= a.rect.top)),
            `${row.name}: paired solo results do not overlap`);

          if (shots) {
            await evaluate(solo, `(()=>{document.querySelectorAll('.fx-layer .float-num').forEach(n=>n.style.animation='none');const note=document.createElement('div');note.className='evidence-caption';note.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;max-width:calc(100vw - 32px);padding:6px 9px;background:#090806ee;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';note.textContent=${JSON.stringify(`${evidenceDoor.toUpperCase()} · solo GUARD2 · ${row.name} · before HP${row.before.hp}/B${row.before.block} · receipt {amount:7, blocked:${row.blocked}} · after hit HP${row.after.hp}/B${row.after.block} · observed ${row.soloTexts.join(' + ')} · expected ${row.soloTexts.join(' + ')}`)};document.body.appendChild(note);return true})()`);
            await writeShot(solo, `guard-float-after-${evidenceDoor}-${shape.tag}-solo-${row.name}.png`);
          }
        }
      } finally {
        await cdp.send('Target.closeTarget', { targetId: solo.targetId }).catch(() => {});
        await closeServer(server);
      }
    }
    for (const shape of shapes) for (const row of cases) {
      // A real Defend proves +N guard gain separately; establish only the
      // remainder here so the authoritative hit begins at the story's exact
      // HP/Block state (10, 4 or 0).
      setCombatStartStateForTools({
        name: 'Fenn', hp: row.before.hp,
        block: row.before.block - (row.defend ? row.blocked : 0),
        extraHand: row.review ? [row.review.cardId] : [],
        enemy: row.review?.cause
          ? { hp: 15, statuses: [{ id: 'bleed', stacks: Number(contentBundle.statuses.find((entry) => entry.id === 'bleed')?.proc?.threshold) - 3 }] }
          : row.review ? { hp: 30 } : undefined,
      });
      const server = await serve({ root: ROOT, port: port++, open: false, lan: true });
      const base = `http://localhost:${server.port}/${standalone ? 'AshenSpire.html' : 'index.html'}`;
      const host = await makeTab(shape); const guest = await makeTab(shape);
      console.log(`\n  ${shape.tag} ${row.name} — real two-client GUARD2 fight`);
      try {
        await cdp.send('Page.navigate', { url: base }, host.sessionId);
        await until(host, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'host LAN door');
        await evaluate(host, click('#lan-play'));
        await until(host, `!!document.querySelector('#lb-name')`, 'host lobby');
        await evaluate(host, `(()=>{const n=document.querySelector('#lb-name');n.value='Wren';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
        await evaluate(host, click('#lb-host'));
        await until(host, `document.querySelector('h2')?.textContent==='AT THE FIRE'`, 'host fire');

        await cdp.send('Page.navigate', { url: base }, guest.sessionId);
        await until(guest, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'guest LAN door');
        await evaluate(guest, click('#lan-play'));
        await until(guest, `!!document.querySelector('#lb-name')`, 'guest lobby');
        await evaluate(guest, `(()=>{const n=document.querySelector('#lb-name');n.value='Fenn';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
        await until(guest, `!!document.querySelector('.lb-join')`, 'guest sees fire');
        await evaluate(guest, click('.lb-join'));
        await until(guest, `!!document.querySelector('#lb-ready')`, 'guest room');
        await evaluate(guest, `(()=>{const p=[...document.querySelectorAll('#lb-classes .class-pick')].find(x=>x.querySelector('h3')?.textContent===${JSON.stringify(row.className)});if(!p)return false;p.click();return true})()`);
        await until(host, `document.querySelector('#lb-roster')?.textContent.includes(${JSON.stringify(row.className)})`, 'host sees guest class');
        await evaluate(guest, click('#lb-ready'));
        await until(host, `!document.querySelector('#lb-start')?.disabled`, 'host sees ready');
        await evaluate(host, `(()=>{const n=document.querySelector('#lb-seed');n.value='GUARD2';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
        await evaluate(host, click('#lb-start'));
        await until(host, `!!document.querySelector('.mapscreen')`, 'host map');
        await until(guest, `!!document.querySelector('.mapscreen')`, 'guest map');
        await evaluate(host, click('.map-node.reachable')); await evaluate(guest, click('.map-node.reachable'));
        await until(host, `!!document.querySelector('.combat.coop')`, 'host combat');
        await until(guest, `!!document.querySelector('.combat.coop')`, 'guest combat');
        await until(guest, `!!window.__coopSnapshot?.scene?.players?.length`, 'guest snapshot');
        await until(guest, `document.querySelectorAll('.combat.coop .hand .card').length>0`, 'guest hand');
        if (row.defend) {
          const play = await evaluate(guest, `(()=>{const all=[...document.querySelectorAll('.hand .card')],c=all.find(x=>/defend/i.test(x.textContent));if(c)c.click();return{played:!!c,cards:all.map(x=>({text:x.textContent.trim().replace(/\\s+/g,' '),aria:x.getAttribute('aria-label'),id:x.dataset.instanceId||x.dataset.cardId||null}))}})()`);
          check(play.played, `${row.name}: Fenn plays a real Defend card`, play.played ? '' : JSON.stringify(play.cards));
          if (!play.played) throw new Error(`Defend card not found in guest hand: ${JSON.stringify(play.cards)}`);
          await until(guest, `(()=>{const s=window.__coopSnapshot,id=s.party.find(p=>p.name==='Fenn')?.id;return s.scene.players.find(p=>p.id===id)?.block===${row.before.block}})()`, `Fenn block ${row.before.block}`).catch(async (error) => {
            const debug = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,id=s.party.find(p=>p.name==='Fenn')?.id,p=s.scene.players.find(p=>p.id===id);return{player:p,cards:[...document.querySelectorAll('.hand .card')].map(x=>x.textContent.trim().replace(/\\s+/g,' ')),body:document.body.innerText.slice(-1200)}})()`);
            throw new Error(`${error.message}; snapshot=${JSON.stringify(debug)}`);
          });
          await until(guest, `[...document.querySelectorAll('.fx-layer .float-num.blk')].some(n=>n.textContent===${JSON.stringify(`+${row.blocked}`)})`, 'real guard-gain float');
          const gain = await evaluate(guest, `(()=>{const n=[...document.querySelectorAll('.fx-layer .float-num.blk')].find(x=>x.textContent===${JSON.stringify(`+${row.blocked}`)});return n?{text:n.textContent,color:getComputedStyle(n).color}:null})()`);
          check(gain?.text === `+${row.blocked}`, `${row.name}: guard gain keeps separate +N vocabulary`, JSON.stringify(gain));
          await until(guest, `document.querySelectorAll('.fx-layer .float-num').length===0`, 'guard-gain float expires', 4000);
        }
        if (row.review) {
          console.log(`\n    ${row.review.cardName} review regression — authoritative same-snapshot receipts`);
          const played = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes(${JSON.stringify(row.review.cardName)}));if(c)c.click();return !!c})()`);
          check(played, `${row.review.cardName}: real card is present and played`);
          await until(guest, `(()=>{const s=window.__coopSnapshot;return s.scene.enemies[0]?.hp===${row.review.hp}})()`, `${row.review.cardName} authoritative enemy HP ${row.review.hp}`);
          const minimumVisible = reviewMoment === 'before' ? 1 : row.review.texts.length;
          await until(guest, `document.querySelectorAll('.fx-layer .float-num.dmg').length>=${minimumVisible}`, `${row.review.cardName} visible damage channels`, 4000);
          const review = await evaluate(guest, `(()=>{const s=window.__coopSnapshot.scene,e=s.enemies[0],seat=document.querySelector('[data-eid="'+CSS.escape(e.id)+'"]'),sr=seat.getBoundingClientRect(),layer=document.querySelector('.fx-layer'),lr=layer.getBoundingClientRect(),all=[...layer.querySelectorAll('.float-num.dmg')].map(n=>{const r=n.getBoundingClientRect();return{text:n.textContent,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}}}),target=all.filter(x=>x.rect.left<sr.right&&x.rect.right>sr.left&&x.rect.top<sr.bottom&&x.rect.bottom>sr.top);return{hp:e.hp,events:s.events,target,layer:{left:lr.left,top:lr.top,right:lr.right,bottom:lr.bottom}}})()`);
          check(review.hp === row.review.hp, `${row.review.cardName}: authoritative HP reaches ${row.review.hp}`, `HP${review.hp}`);
          check(JSON.stringify(review.target.map((entry) => entry.text).sort()) === JSON.stringify([...row.review.texts].sort()),
            `${row.review.cardName}: exact visible channels ${row.review.texts.join(' + ')}`, review.target.map((entry) => entry.text).join(' + ') || 'none');
          if (row.review.cause) {
            check(review.events.some((event) => event.type === 'damageDealt' && event.amount === 5)
                && review.events.some((event) => event.type === 'hpLost' && event.amount === 8 && event.cause === row.review.cause),
              `${row.review.cardName}: wire preserves attack 5 and separate ${row.review.cause} HP loss 8`, JSON.stringify(review.events));
          }
          check(review.target.every(({ rect }) => rect.left >= review.layer.left && rect.right <= review.layer.right
              && rect.top >= review.layer.top && rect.bottom <= review.layer.bottom),
            `${row.review.cardName}: every result stays on-glass`);
          check(review.target.length < 2 || review.target.every((a, i) => review.target.every((b, j) => i >= j
              || a.rect.right <= b.rect.left || b.rect.right <= a.rect.left || a.rect.bottom <= b.rect.top || b.rect.bottom <= a.rect.top)),
            `${row.review.cardName}: ordered same-target results never overlap`, JSON.stringify(review.target.map((entry) => entry.rect)));
          if (shots) {
            await evaluate(guest, `(()=>{document.querySelectorAll('.fx-layer .float-num').forEach(n=>n.style.animation='none');const note=document.createElement('div');note.className='evidence-caption';note.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;max-width:calc(100vw - 32px);padding:6px 9px;background:#090806ee;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';note.textContent=${JSON.stringify(`${evidenceDoor.toUpperCase()} · ${reviewMoment.toUpperCase()} · two-client ${row.review.cardName} · enemy HP ${row.review.cardName === 'Gorefire Slash' ? '15→2' : '30→21'} · expected ${row.review.texts.join(' + ')}`)};document.body.appendChild(note);return true})()`);
            await writeShot(guest, `guard-float-review-${reviewMoment}-${evidenceDoor}-${shape.tag}-${row.review.cardId}.png`);
          }
          await evaluate(guest, `(()=>{document.querySelectorAll('.fx-layer .float-num,.evidence-caption').forEach(n=>n.remove());return true})()`);
        }
        const before = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,id=s.party.find(p=>p.name==='Fenn')?.id,p=s.scene.players.find(p=>p.id===id);return{hp:p?.hp,block:p?.block}})()`);
        await evaluate(host, click('#coop-endturn')); await evaluate(guest, click('#coop-endturn'));
        await until(guest, `(()=>{const s=window.__coopSnapshot,id=s.party.find(p=>p.name==='Fenn')?.id;return s.scene.events?.some(e=>e.type==='damageDealt'&&e.playerId===id)})()`, 'authoritative Fenn damage receipt');
        await until(guest, `document.querySelectorAll('.fx-layer .float-num').length>=${row.coopTexts.length}`, 'visible float channels', 12000);
        const reading = await evaluate(guest, `(()=>{const all=window.__coopSnapshot,id=all.party.find(p=>p.name==='Fenn')?.id,s=all.scene,p=s.players.find(x=>x.id===id),e=s.events.find(x=>x.type==='damageDealt'&&x.playerId===id),layer=document.querySelector('.fx-layer'),seat=document.querySelector('[data-seat="'+CSS.escape(id)+'"]'),lr=layer.getBoundingClientRect(),sr=seat.getBoundingClientRect(),floats=[...layer.querySelectorAll('.float-num')].map(n=>{const r=n.getBoundingClientRect();return{text:n.textContent,cls:n.className,color:getComputedStyle(n).color,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},cx:(r.left+r.right)/2,cy:(r.top+r.bottom)/2}}),target=floats.filter(x=>x.cx>=sr.left&&x.cx<=sr.right&&x.cy>=sr.top&&x.cy<=sr.bottom);const probe=document.createElement('span');probe.className='float-num blk';probe.style.display='none';layer.appendChild(probe);const guardColor=getComputedStyle(probe).color;probe.remove();return{hp:p.hp,block:p.block,receipt:e,texts:floats.map(x=>x.text).sort(),targetTexts:target.map(x=>x.text).sort(),target,guard:target.filter(x=>x.cls.includes('blk')).map(x=>x.text),guardColors:target.filter(x=>x.cls.includes('blk')).map(x=>x.color),guardColor,layer:{left:lr.left,top:lr.top,right:lr.right,bottom:lr.bottom}}})()`);
        check(reading.receipt?.amount === 7 && reading.receipt?.blocked === row.blocked,
          `${row.name}: wire receipt is amount 7 / blocked ${row.blocked}`, JSON.stringify(reading.receipt));
        const residual = 7 - row.blocked;
        check(before.hp === row.before.hp && before.block === row.before.block,
          `${row.name}: co-op begins exact HP${row.before.hp}/B${row.before.block}`,
          `HP${before.hp}/B${before.block}`);
        check(reading.hp === row.after.hp && reading.block === 0,
          `${row.name}: authoritative Fenn hit reaches HP${row.after.hp} and next-turn guard clears`, `HP${before.hp}→${reading.hp}/B${reading.block}`);
        check(JSON.stringify(reading.texts) === JSON.stringify(row.coopTexts),
          `${row.name}: exact visible channels ${row.coopTexts.join(' + ')}`, reading.texts.join(' + '));
        check(JSON.stringify(reading.targetTexts) === JSON.stringify(row.soloTexts),
          `${row.name}: Fenn target owns exactly ${row.soloTexts.join(' + ')}`, reading.targetTexts.join(' + '));
        check(!reading.guard.some((text) => text.startsWith('+')),
          `${row.name}: absorbed guard is never mislabeled as gain`, reading.guard.join(', ') || 'no guard channel');
        check(!reading.guardColors.length || reading.guardColors.every((color) => color === reading.guardColor),
          `${row.name}: absorbed guard uses computed block colour`, `${reading.guardColors.join(', ') || 'no guard channel'} / ${reading.guardColor}`);
        check(reading.target.every(({ rect }) => rect.left >= reading.layer.left && rect.right <= reading.layer.right
            && rect.top >= reading.layer.top && rect.bottom <= reading.layer.bottom),
          `${row.name}: Fenn results stay on-glass`);
        check(reading.target.length < 2 || reading.target.every((a, i) => reading.target.every((b, j) => i >= j
            || a.rect.right <= b.rect.left || b.rect.right <= a.rect.left || a.rect.bottom <= b.rect.top || b.rect.bottom <= a.rect.top)),
          `${row.name}: paired Fenn results do not overlap`);

        if (shots) {
          mkdirSync(resolve(shots), { recursive: true });
          const afterHit = { hp: before.hp - residual, block: before.block - row.blocked };
          await evaluate(guest, `(()=>{const layer=document.querySelector('.fx-layer');for(const n of [...layer.querySelectorAll('.float-num')]){const c=n.cloneNode(true);c.style.animation='none';c.dataset.evidenceClone='true';layer.appendChild(c);n.remove()}const note=document.createElement('div');note.className='evidence-caption';note.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;max-width:calc(100vw - 32px);padding:6px 9px;background:#090806ee;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';note.textContent=${JSON.stringify(`${evidenceDoor.toUpperCase()} · two-client GUARD2 · ${row.name} · Fenn before HP${before.hp}/B${before.block} · receipt {amount:7, blocked:${row.blocked}} · after hit HP${afterHit.hp}/B${afterHit.block} · observed ${row.soloTexts.join(' + ')} · expected ${row.soloTexts.join(' + ')}`)};document.body.appendChild(note);return true})()`);
          const name = `guard-float-after-${evidenceDoor}-${shape.tag}-coop-${row.name}.png`;
          await writeShot(guest, name);
        }
        await evaluate(guest, `(()=>{document.querySelectorAll('.fx-layer .float-num').forEach(n=>n.remove());document.querySelector('.combatant.enemy:not(.dead)')?.click();return true})()`);
        await wait(180);
        const replay = await evaluate(guest, `[...document.querySelectorAll('.fx-layer .float-num')].map(x=>x.textContent)`);
        check(replay.length === 0, `${row.name}: local rerender replays zero authoritative receipts`, JSON.stringify(replay));
      } finally {
        setCombatStartStateForTools(null);
        await cdp.send('Target.closeTarget', { targetId: host.targetId }).catch(() => {});
        await cdp.send('Target.closeTarget', { targetId: guest.targetId }).catch(() => {});
        await closeServer(server);
        rmSync(join(ROOT, '.coop-session.json'), { force: true });
      }
    }
    if (!coopOnly) for (const shape of shapes) {
      await writeContactSheet(shape);
      await writeReviewContactSheet(shape);
    }
  } finally {
    cdp.close(); await dropBrowser();
  }
  console.log(`\nGUARD FLOAT BROWSER ${findings.length ? `FAILED (${findings.length})` : 'OK'}`);
  return findings.length ? 1 : 0;
}

if (args.includes('--browser')) {
  try { process.exit(await browserDoor()); }
  catch (error) { console.error(`guard-float-parity browser door: ${error.message}`); process.exit(2); }
}

const REG = createRegistries(contentBundle);
const failures = [];
const pass = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

const expected = new Map([
  ['full', { amount: 7, blocked: 7, guard: '7', damage: null }],
  ['partial', { amount: 7, blocked: 4, guard: '4', damage: '-3' }],
  ['unguarded', { amount: 7, blocked: 0, guard: null, damage: '-7' }],
]);

console.log('\nGUARD FLOAT PARITY — focused source door');
for (const [name, row] of expected) {
  const got = guardHitFloatParts(row);
  pass((got.guard ? got.guard.text : null) === row.guard
      && (got.damage ? got.damage.text : null) === row.damage,
    `semantic ${name}`,
    `guard=${got.guard?.text || 'none'} damage=${got.damage?.text || 'none'}`);
  pass(!got.guard || (!got.guard.text.startsWith('+') && got.guard.cls.includes('blk')),
    `${name} absorbed channel is unsigned guard styling`);
}

function coopReceiptMatrix() {
  const game = createSession({ registries: REG, seedString: 'GUARD2' });
  for (const [id, name] of [['p1', 'Full'], ['p2', 'Partial'], ['p3', 'Unguarded']]) {
    game.addMember({ id, name, classId: 'reaver' });
  }
  game.start();
  const nodeId = game.session.mapGraph.startIds[0];
  for (const id of ['p1', 'p2', 'p3']) game.chooseNode(id, nodeId);
  const combat = game.live.combat;
  const opening = game.snapshot().scene;
  if (opening.enemies.length !== 1 || opening.enemies[0].intent?.moveId !== 'slash'
    || opening.enemies[0].intent?.damage !== 7) {
    throw new Error('GUARD2 no longer opens one authoritative 7-damage slash');
  }
  for (const [id, block] of [['p1', 10], ['p2', 4], ['p3', 0]]) {
    const entity = combat.players.get(id).entity;
    entity.hp = 30;
    entity.block = block;
  }
  const hitStates = [];
  const emit = combat.emit.bind(combat);
  combat.emit = (type, payload) => {
    const event = emit(type, payload);
    if (type === 'damageDealt' && event.playerId) {
      const entity = combat.players.get(event.playerId)?.entity;
      hitStates.push({ event: structuredClone(event), hp: entity?.hp, block: entity?.block });
    }
    return event;
  };
  game.combatEndTurn('p1');
  const before = structuredClone(game.snapshot().scene);
  game.combatEndTurn('p2');
  game.combatEndTurn('p3');
  const after = structuredClone(game.snapshot().scene);
  return { before, after, hitStates };
}

const coop = coopReceiptMatrix();
const receipts = coop.after.events.filter((event) => event.type === 'damageDealt');
pass(receipts.length === 3, 'co-op transports one damageDealt receipt per real hit', `${receipts.length}/3`);
for (const [index, [id, blocked, hp, block]] of [['p1', 7, 30, 3], ['p2', 4, 27, 0], ['p3', 0, 23, 0]].entries()) {
  const event = receipts[index];
  const player = coop.after.players.find((entry) => entry.id === id);
  const hit = coop.hitStates[index];
  pass(event?.playerId === id && event?.amount === 7 && event?.blocked === blocked,
    `co-op ${id} receipt keeps seat/amount/blocked`, JSON.stringify(event));
  pass(hit?.hp === hp && hit?.block === block,
    `co-op ${id} state at real hit remains HP${hp}/B${block}`, `HP${hit?.hp}/B${hit?.block}`);
  pass(player?.hp === hp && player?.block === 0,
    `co-op ${id} next-turn reset emits no extra hit receipt`, `HP${player?.hp}/B${player?.block}`);
}

const paths = {
  fx: resolve(ROOT, 'src/ui/fx.js'),
  coop: resolve(ROOT, 'src/ui/screens/coop.js'),
  session: resolve(ROOT, 'tools/session.mjs'),
};
const source = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path, 'utf8')]));

pass(sourceContract(source), 'source seams form one receipt-driven contract');
const plants = [
  ['solo-collapses-to-preblock-total', 'fx', 'const residual = amount - blocked;', 'const residual = amount;'],
  ['absorbed-channel-omitted', 'fx', 'guard: blocked > 0 ? { text: String(blocked), cls: \'blk small\' }', 'guard: null'],
  ['absorbed-mislabeled-as-gain', 'fx', 'text: String(blocked)', 'text: `+${blocked}`'],
  ['coop-drops-damage-receipt', 'session', "'enemyMoveStarted', 'damageDealt',", "'enemyMoveStarted',"],
  ['coop-drops-nonattack-hp-loss', 'session', "|| (e.type === 'hpLost' && e.cause !== 'attack')", ''],
  ['coop-loses-hp-loss-player-owner', 'session', "(type === 'damageDealt' || type === 'hpLost')", "type === 'damageDealt'"],
  ['coop-drops-receipt-processing', 'coop', "ev.type === 'damageDealt' || (ev.type === 'hpLost' && ev.cause !== 'attack')", "ev.type === 'damageDealt'"],
  ['coop-suppresses-unreceipted-remainder', 'coop', 'dmg - (receiptLossByTarget.get(`enemy:${e.id}`) || 0)', 'receiptLossByTarget.has(`enemy:${e.id}`) ? 0 : dmg'],
  ['coop-collapses-same-target-stack', 'coop', '* 18;', '* 0;'],
];
for (const [name, file, find, replacement] of plants) {
  const planted = { ...source, [file]: source[file].replace(find, replacement) };
  pass(planted[file] !== source[file] && !sourceContract(planted), `plant killed: ${name}`);
}

const crlf = Object.fromEntries(Object.entries(source).map(([key, text]) => [key, text.replace(/\n/g, '\r\n')]));
pass(sourceContract(crlf), 'forced-CRLF source contract remains green');

console.log(failures.length ? `\nGUARD FLOAT PARITY FAILED (${failures.length})` : '\nGUARD FLOAT PARITY OK');
process.exit(failures.length ? 1 : 0);
