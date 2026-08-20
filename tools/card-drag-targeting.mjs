// tools/card-drag-targeting.mjs — browser acceptance for #150 + #198.
//
// The same real page and pointer door checks the approved hand paging controls,
// drag start, nearest-only single target switching, all-target multi aim,
// non-targeting silence, one legal commit, zero illegal commits, cleanup on
// both endings, and Text XL pager geometry. `--selftest` plants each accepted
// defect back through this same browser door.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// A Windows checkout may materialize source files as CRLF while this tool's JS
// string literals use LF. Derive each multiline plant's separator from the file
// it will edit, so the same known-bad corpus remains armed in both checkout
// forms instead of reporting PLANT SITE DRIFTED before the browser ever runs.
const lines = (file, ...rows) => {
  const bytes = readFileSync(join(ROOT, file), 'utf8');
  // Some long-lived Windows worktrees are mixed-EOL after generated-file
  // normalization. Match the actual block first; only use the file-wide style
  // as the fallback for replacement text that does not yet exist.
  for (const eol of ['\r\n', '\n']) {
    const candidate = rows.join(eol);
    if (bytes.includes(candidate)) return candidate;
  }
  return rows.join(bytes.includes('\r\n') ? '\r\n' : '\n');
};

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'card-drag-targeting.mjs',
    args: ['--text', 'XL'],
    timeoutMs: 600000,
    plants: [{
      name: 'illegal-drop cleanup is removed, leaving the targeting state armed',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', '          clearDragTargeting();', '          if (dragGhost)'),
      replace: lines('src/ui/screens/combat.js', '          /* planted: #198 cleanup omitted */', '          if (dragGhost)'),
      expectRed: /FAIL illegal drop clears every drag marker/,
    }, {
      name: 'single-target drag lights every enemy instead of only the nearest',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', '        const nearest = inField ? nearestEnemy(x, y) : null;', '        showDragAims(nearest ? [nearest] : []);', '        legal = !!nearest;'),
      replace: lines('src/ui/screens/combat.js', '        const nearest = inField ? nearestEnemy(x, y) : null;', '        showDragAims(inField ? livingEnemyEls() : []);', '        legal = !!nearest;'),
      expectRed: /FAIL single-target sweep keeps exactly one nearest red aim and switches across enemies/,
    }, {
      name: 'multi-target drag lights only one enemy instead of every legal enemy',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', '        showDragAims(enemies);', '        legal = enemies.length > 0;'),
      replace: lines('src/ui/screens/combat.js', '        showDragAims(enemies.slice(0, 1));', '        legal = enemies.length > 0;'),
      expectRed: /FAIL multi-target drag reuses red aim on every living enemy/,
    }, {
      name: 'non-targeting drag incorrectly paints enemy aim silhouettes',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', '      } else {', '        showDragAims([]);', '      }', "      const state = legal ? 'legal' : 'illegal';"),
      replace: lines('src/ui/screens/combat.js', '      } else {', '        showDragAims(inField ? livingEnemyEls() : []);', '      }', "      const state = legal ? 'legal' : 'illegal';"),
      expectRed: /FAIL non-targeting drag produces no enemy aim/,
    }, {
      name: 'pager escapes the hand overlay at Text XL',
      file: 'styles/combat.css',
      find: lines('styles/combat.css', ".hand-overlay[data-paging='true'] {", '  grid-template-columns: var(--tap-floor) minmax(0, 1fr) var(--tap-floor);', '  grid-template-areas: "prev hand next";', '}'),
      replace: lines('styles/combat.css', ".hand-overlay[data-paging='true'] {", '  width: calc(100% + 40rem); margin-left: -20rem;', '  grid-template-columns: var(--tap-floor) minmax(0, 1fr) var(--tap-floor);', '  grid-template-areas: "prev hand next";', '}'),
      expectRed: /FAIL hand paging controls stay inside the viewport/,
    }, {
      name: 'pager is dropped onto the combat footer',
      file: 'styles/combat.css',
      find: lines('styles/combat.css', '.hand-page {', '  position: static; align-self: center; z-index: 70;'),
      replace: lines('styles/combat.css', '.hand-page {', '  position: relative; top: 20rem; align-self: center; z-index: 70;'),
      expectRed: /FAIL paging controls overlap neither cards nor combat controls/,
    }, {
      name: 'narrow combat chrome is pushed below the viewport',
      file: 'styles/combat.css',
      find: ":root[data-short='false'] .field { min-height: 0; }",
      replace: ":root[data-short='false'] .field { /* planted: fitting field cannot yield */ }",
      expectRed: /FAIL combat chrome stays inside the viewport/,
    }],
  }));
}

const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const SHAPES = [[320, 640], [390, 844], [768, 1024], [1200, 730]];
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const only = argOf('--only');
const screenshots = args.includes('--screenshots');
const useDist = args.includes('--dist');
const textSize = argOf('--text') || 'M';
if (!['S', 'M', 'L', 'XL'].includes(textSize)) throw new Error(`--text must be S, M, L, or XL (got ${textSize})`);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function main() {
  if (!browserPath) throw new Error('no Chrome/Edge found; pass --browser or set CHROME');
  const served = useDist ? null : await serve({ root: ROOT, port: 8298, open: false });
  const base = useDist ? pathToFileURL(resolve(ROOT, 'dist', 'AshenSpire.html')).href : `http://localhost:${served.port}/`;
  const browser = await launchBrowser({ prefix: 'carddrag-', browser: browserPath, timeoutMs: 15000 });
  const cdp = connectCdp(browser.wsUrl); await cdp.ready;
  let fails = 0; let ran = 0;
  const ok = (value, label, detail = '') => {
    console.log(`    ${value ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!value) fails++;
  };

  try {
    for (const [W, H] of SHAPES) {
      const shape = `${W}x${H}`;
      if (only && only !== shape) continue;
      ran++;
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }, S);
      const ev = async (expression) => {
        const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page evaluation threw');
        return r.result.value;
      };
      const until = async (expression, label, ms = 20000) => {
        const started = Date.now();
        while (Date.now() - started < ms) {
          if (await ev(expression).catch(() => false)) return;
          await wait(120);
        }
        throw new Error(`timeout waiting for ${label}`);
      };
      const mouse = (type, x, y, down = false) => cdp.send('Input.dispatchMouseEvent', {
        type, x, y, button: 'left', buttons: down ? 1 : 0, clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0,
      }, S);
      const point = (selector) => ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const state = () => ev(`(() => ({
        discard:+document.querySelector('.pile.discard .n').textContent,
        energy:document.querySelector('.energy-orb').textContent.trim(),
        mode:document.querySelector('.combat').classList.contains('drag-targeting'),
        drop:document.querySelector('.combat').dataset.dropState || null,
        dropAttrs:document.querySelectorAll('[data-drop-state]').length,
        aimed:[...document.querySelectorAll('.enemy.aiming.aim-enemy')].map(x=>x.dataset.eid),
        silhouettes:document.querySelectorAll('.enemy.aiming.aim-enemy .aim-silho').length,
        labeledEnemies:document.querySelectorAll('.enemy[data-drop-state],.enemy .drop-verdict').length,
        ghosts:document.querySelectorAll('.card-drag-ghost').length
      }))()`);

      const shotSettings = encodeURIComponent(JSON.stringify({ textSize }));
      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotHand=8&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat'); await wait(350);
      console.log(`\n  ${shape} · Text ${textSize}`);
      const controls = await ev(`(() => { const hs=[...document.querySelectorAll('.hand-page')]; return {n:hs.length, labels:hs.map(x=>x.getAttribute('aria-label')), rects:hs.map(x=>{const r=x.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}), on:hs.every(x=>{const r=x.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})}; })()`);
      ok(controls.n === 2 && controls.labels.every(Boolean), 'approved previous/next controls exist and are named', JSON.stringify(controls));
      ok(controls.on, 'hand paging controls stay inside the viewport');
      const containment = await ev(`(() => {
        const box=x=>{const r=x.getBoundingClientRect();return {name:x.className,left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
        const named=[...document.querySelectorAll('.hand-page,.energy-orb,.end-turn,.pile')]
          .filter(x=>getComputedStyle(x).display!=='none').map(box);
        const handArea=box(document.querySelector('.hand-area'));
        const hand=box(document.querySelector('.hand'));
        const cards=[...document.querySelectorAll('.hand .card')].map(box);
        const inside=r=>r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;
        const verticallyInside=r=>r.top>=0&&r.bottom<=innerHeight;
        const failures=[...named.filter(r=>!inside(r)),
          ...[handArea,hand].filter(r=>!inside(r)), ...cards.filter(r=>!verticallyInside(r))];
        return {ok:failures.length===0, viewport:{width:innerWidth,height:innerHeight}, failures, named, handArea, hand,
          cards:cards.map(({name,top,bottom})=>({name,top,bottom}))};
      })()`);
      ok(containment.ok, 'combat chrome stays inside the viewport', JSON.stringify(containment));
      const overlap = await ev(`(() => {
        const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        const box=x=>{const r=x.getBoundingClientRect();return {name:x.className,left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
        const pages=[...document.querySelectorAll('.hand-page')].map(box);
        const fixed=[...document.querySelectorAll('.end-turn,.energy-orb,.pile')].filter(x=>getComputedStyle(x).display!=='none').map(box);
        const handArea=document.querySelector('.hand-area').getBoundingClientRect();
        const hand=document.querySelector('.hand').getBoundingClientRect();
        const cards=[...document.querySelectorAll('.hand .card')].map(box).map(r=>({...r,
          left:Math.max(r.left,hand.left),right:Math.min(r.right,hand.right),
          top:Math.max(r.top,hand.top),bottom:Math.min(r.bottom,hand.bottom)}))
          .filter(r=>r.right>Math.max(0,r.left)&&r.bottom>r.top&&r.left<innerWidth);
        const pairs=(bs)=>pages.flatMap(a=>bs.filter(b=>hit(a,b)).map(b=>[a,b]));
        const chromePairs=pairs(fixed), cardPairs=pairs(cards);
        return {
          chrome:chromePairs.length>0, cards:cardPairs.length>0,
          chromePairs, cardPairs,
          handArea:{left:handArea.left,top:handArea.top,right:handArea.right,bottom:handArea.bottom},
          hand:{left:hand.left,top:hand.top,right:hand.right,bottom:hand.bottom},
          fixed
        };
      })()`);
      ok(!overlap.chrome && !overlap.cards, 'paging controls overlap neither cards nor combat controls', JSON.stringify(overlap));
      if (controls.n === 2) {
        await ev(`document.querySelector('.hand-next').click()`); await wait(100);
        ok(await ev(`!!document.querySelector('.hand .card.gp-focus')`), 'paging moves focus through the real hand');
      }

      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'five-card combat for drag coverage'); await wait(350);

      const card = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Slashing Strike/.test(x.textContent)); if(!c)return null; c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const enemies = await ev(`[...document.querySelectorAll('.enemy:not(.dead)')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.eid,x:r.left+r.width/2,y:r.top+r.height/2}})`);
      if (!card || enemies.length < 2) throw new Error(`${shape}: nearest-target proof needs one targetable card and at least two enemies`);
      const before = await state();
      await mouse('mousePressed', card.x, card.y, true);
      await mouse('mouseMoved', card.x, card.y - 30, true);
      const sweep = [];
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const at = {
          x: enemies[0].x + (enemies.at(-1).x - enemies[0].x) * t,
          y: enemies[0].y + (enemies.at(-1).y - enemies[0].y) * t,
        };
        await mouse('mouseMoved', at.x, at.y, true); await wait(70);
        const observed = await state();
        const expected = enemies.reduce((best, enemy) => {
          const distance = Math.hypot(at.x - enemy.x, at.y - enemy.y);
          return !best || distance < best.distance ? { id: enemy.id, distance } : best;
        }, null).id;
        sweep.push({ t, expected, aimed: observed.aimed, silhouettes: observed.silhouettes });
      }
      const exactNearest = sweep.every((row) => row.aimed.length === 1
        && row.aimed[0] === row.expected && row.silhouettes === 1);
      ok(exactNearest && new Set(sweep.map((row) => row.aimed[0])).size >= 2,
        'single-target sweep keeps exactly one nearest red aim and switches across enemies', JSON.stringify(sweep));
      const armed = await state();
      ok(armed.mode && armed.drop === 'legal' && armed.aimed.length === 1
        && armed.silhouettes === 1 && armed.labeledEnemies === 0 && armed.ghosts === 1,
      'single-target drag reuses the click-selected red silhouette without enemy drop labels', JSON.stringify(armed));
      if (screenshots) {
        const dir = join(ROOT, 'docs', 'preview'); mkdirSync(dir, { recursive: true });
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, S);
        const textSuffix = textSize === 'M' ? '' : `-text-${textSize.toLowerCase()}`;
        writeFileSync(join(dir, `combat-ui-drag-${shape}${textSuffix}.png`), Buffer.from(shot.data, 'base64'));
      }
      await mouse('mouseReleased', enemies.at(-1).x, enemies.at(-1).y, false); await wait(700);
      const legalEnd = await state();
      ok(legalEnd.discard === before.discard + 1, 'legal drop plays exactly once', `${before.discard} -> ${legalEnd.discard}`);
      ok(!legalEnd.mode && legalEnd.dropAttrs === 0 && legalEnd.aimed.length === 0
        && legalEnd.silhouettes === 0 && legalEnd.ghosts === 0,
      'legal drop clears every drag marker', JSON.stringify(legalEnd));

      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat reset'); await wait(350);
      const card2 = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Shield Defend/.test(x.textContent)); c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const enemy2 = await point('.enemy:not(.dead)');
      // The invalid edge is defined against the drop surface itself, not another
      // component's centre. The final viewport pixel is always in the reserved
      // hand/footer band and therefore outside `.field`, at every measured
      // composition; that remains true even when the battlefield yields height.
      const bad = await ev(`({x:Math.max(1,innerWidth/2),y:Math.max(1,innerHeight-2)})`);
      const beforeBad = await state();
      await mouse('mousePressed', card2.x, card2.y, true);
      await mouse('mouseMoved', card2.x, card2.y - 30, true);
      await mouse('mouseMoved', enemy2.x, enemy2.y, true); await wait(120);
      const noTargetAim = await state();
      ok(noTargetAim.aimed.length === 0 && noTargetAim.silhouettes === 0 && noTargetAim.labeledEnemies === 0,
        'non-targeting drag produces no enemy aim', JSON.stringify(noTargetAim));
      await mouse('mouseMoved', bad.x, bad.y, true); await wait(120);
      const rejected = await state();
      ok(rejected.mode && rejected.drop === 'illegal' && rejected.aimed.length === 0
        && rejected.silhouettes === 0 && rejected.ghosts === 1,
      'invalid point has no persisted enemy aim', JSON.stringify(rejected));
      await mouse('mouseReleased', bad.x, bad.y, false); await wait(350);
      const illegalEnd = await state();
      ok(illegalEnd.discard === beforeBad.discard && illegalEnd.energy === beforeBad.energy, 'illegal drop spends and plays nothing');
      ok(!illegalEnd.mode && illegalEnd.dropAttrs === 0 && illegalEnd.aimed.length === 0
        && illegalEnd.silhouettes === 0 && illegalEnd.ghosts === 0,
      'illegal drop clears every drag marker', JSON.stringify(illegalEnd));

      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat multi-target reset'); await wait(350);
      const multiPose = await ev(`(() => {
        const donor=window.__combat.piles.hand[0];
        const trigger=[...document.querySelectorAll('.hand .card')].find(x=>/Slashing Strike/.test(x.textContent));
        if(!donor||!trigger)return {id:null,reason:'missing donor or render trigger'};
        donor.cardId='crimsonCleave'; donor.upgraded=false;
        delete donor.profileId; delete donor.mods;
        delete donor.damageSchool; delete donor.exposureBuildupPerHit;
        trigger.click();
        const deselect=[...document.querySelectorAll('.hand .card')].find(x=>/Slashing Strike/.test(x.textContent));
        if(deselect)deselect.click();
        return {id:donor.instanceId,cardId:donor.cardId,trigger:trigger.textContent.trim()};
      })()`);
      await wait(150);
      const multiNames = await ev(`[...document.querySelectorAll('.hand .card')].map(x=>x.textContent.trim())`);
      if (!multiPose.id || !multiNames.some((name) => /Crimson Cleave/.test(name))) {
        throw new Error(`${shape}: real multi-target pose failed ${JSON.stringify({ multiPose, multiNames })}`);
      }
      const multiCard = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Crimson Cleave/.test(x.textContent)); c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const multiEnemies = await ev(`[...document.querySelectorAll('.enemy:not(.dead)')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.eid,x:r.left+r.width/2,y:r.top+r.height/2}})`);
      if (!multiCard || multiEnemies.length < 2) throw new Error(`${shape}: could not pose the real Crimson Cleave multi-target state`);
      const multiAt = {
        x: (multiEnemies[0].x + multiEnemies.at(-1).x) / 2,
        y: (multiEnemies[0].y + multiEnemies.at(-1).y) / 2,
      };
      const beforeMulti = await state();
      await mouse('mousePressed', multiCard.x, multiCard.y, true);
      await mouse('mouseMoved', multiCard.x, multiCard.y - 30, true);
      await mouse('mouseMoved', multiAt.x, multiAt.y, true); await wait(120);
      const multiArmed = await state();
      const wantMulti = multiEnemies.map((enemy) => enemy.id).sort();
      ok(multiArmed.drop === 'legal' && multiArmed.silhouettes === wantMulti.length
        && JSON.stringify([...multiArmed.aimed].sort()) === JSON.stringify(wantMulti)
        && multiArmed.labeledEnemies === 0,
      'multi-target drag reuses red aim on every living enemy', JSON.stringify(multiArmed));
      if (screenshots) {
        const dir = join(ROOT, 'docs', 'preview'); mkdirSync(dir, { recursive: true });
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, S);
        const textSuffix = textSize === 'M' ? '' : `-text-${textSize.toLowerCase()}`;
        writeFileSync(join(dir, `combat-ui-drag-multi-${shape}${textSuffix}.png`), Buffer.from(shot.data, 'base64'));
      }
      await mouse('mouseReleased', multiAt.x, multiAt.y, false); await wait(700);
      const multiEnd = await state();
      ok(multiEnd.discard === beforeMulti.discard + 1, 'multi-target legal drop plays exactly once', `${beforeMulti.discard} -> ${multiEnd.discard}`);
      ok(!multiEnd.mode && multiEnd.dropAttrs === 0 && multiEnd.aimed.length === 0
        && multiEnd.silhouettes === 0 && multiEnd.ghosts === 0,
      'multi-target drop clears every drag marker', JSON.stringify(multiEnd));
      await cdp.send('Target.closeTarget', { targetId });
    }
    if (!ran) throw new Error(`--only ${only} matched no shape`);
    console.log(`\n${fails ? `FAIL — ${fails} finding(s)` : 'PASS — card drag targeting and approved hand paging hold at every measured shape'}`);
    process.exitCode = fails ? 1 : 0;
  } finally {
    cdp.close(); await browser.close(); if (served) served.server.close();
  }
}

main().catch((e) => { console.error(`card-drag-targeting: ${e.message}`); process.exitCode = 2; });
