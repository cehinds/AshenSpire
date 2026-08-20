#!/usr/bin/env node
// tools/hand-pager-threshold.mjs — focused browser acceptance for #208.
//
// The real combat shot door poses exact hand sizes. This instrument reads the
// real DOM, accessibility tree, hit-test surface, unified cursor, and geometry
// at the source page (or a deliberately selected standalone artifact). It does
// not call a pager helper directly.
//
// Usage:
//   node tools/hand-pager-threshold.mjs
//   node tools/hand-pager-threshold.mjs --only 390x844 --text XL
//   node tools/hand-pager-threshold.mjs --hand 7
//   node tools/hand-pager-threshold.mjs --standalone   # only after artifacts move
//   node tools/hand-pager-threshold.mjs --shots docs/preview/hand-pager-source
//   node tools/hand-pager-threshold.mjs --selftest-source

// Exit 0 = every measured cell held; 1 = a product finding; 2 = no cell ran or
// the browser/fixture failed.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
if (process.argv.includes('--selftest') || process.argv.includes('--selftest-source')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const sourceStatus = await doorSelftest({
    tool: 'hand-pager-threshold.mjs',
    args: ['--only', '390x844', '--text', 'XL'],
    timeoutMs: 600000,
    plants: [{
      name: 'short hand keeps the pager visible',
      file: 'src/ui/screens/combat.js',
      find: 'const paging = handList.length > HAND_PAGE_THRESHOLD;',
      replace: 'const paging = handList.length >= HAND_PAGE_THRESHOLD;',
      expectRed: /FAIL 0-7 cards expose no visible pager/,
    }, {
      name: 'long hand hides the pager',
      file: 'src/ui/screens/combat.js',
      find: 'const paging = handList.length > HAND_PAGE_THRESHOLD;',
      replace: 'const paging = handList.length > HAND_PAGE_THRESHOLD + 1;',
      expectRed: /FAIL 8\+ cards expose exactly two named pager controls/,
    }, {
      name: 'pager escapes the hand overlay boundary',
      file: 'styles/combat.css',
      find: '.hand-prev { grid-area: prev; }',
      replace: '.hand-prev { grid-area: prev; transform: translateX(-0.5rem); }',
      expectRed: /FAIL pager stays contained by the hand overlay boundary/,
    }, {
      name: 'hidden pager retains AX focus after 8-to-7',
      file: 'src/ui/screens/combat.js',
      find: '    handPages.forEach((page) => { page.hidden = !paging; });',
      replace: "    handPages.forEach((page) => { page.hidden = !paging; });\n    if (!paging) handPages[0].classList.add('gp-focus');",
      expectRed: /FAIL dynamic 8-to-7 returns pager focus to the remembered surviving card/,
    }],
  });
  if (sourceStatus) process.exit(sourceStatus);
  if (process.argv.includes('--selftest-source')) process.exit(0);

  // Plant five enters at the standalone's real door. A root bundle can lag the
  // authored threshold even while every source-page cell is green, so this
  // copied artifact must independently go red and the clean artifact green.
  process.exit(await doorSelftest({
    tool: 'hand-pager-threshold.mjs',
    args: ['--standalone', '--only', '390x844', '--text', 'XL'],
    timeoutMs: 600000,
    extraCopy: ['AshenSpire.html'],
    plants: [{
      name: 'standalone root is stale at the seven-card threshold',
      file: 'AshenSpire.html',
      find: 'const paging = handList.length > HAND_PAGE_THRESHOLD;',
      replace: 'const paging = handList.length >= HAND_PAGE_THRESHOLD;',
      expectRed: /FAIL 0-7 cards expose no visible pager/,
    }],
  }));
}

const args = process.argv.slice(2);
const argOf = (flag) => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : null; };
const only = argOf('--only');
const onlyText = argOf('--text');
const onlyHand = argOf('--hand');
const standalone = args.includes('--standalone');
const shots = argOf('--shots');

if (onlyText && !['M', 'XL'].includes(onlyText)) throw new Error(`--text must be M or XL (got ${onlyText})`);
if (onlyHand && ![1, 7, 8, 10].includes(Number(onlyHand))) throw new Error(`--hand must be 1, 7, 8, or 10 (got ${onlyHand})`);

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
const browserPath = argOf('--browser') || BROWSERS.find((candidate) => existsSync(candidate));
const CELLS = [
  { width: 320, height: 640, text: 'M' },
  { width: 320, height: 640, text: 'XL' },
  { width: 390, height: 844, text: 'M' },
  { width: 390, height: 844, text: 'XL' },
  { width: 1200, height: 730, text: 'M' },
].filter((cell) => (!only || `${cell.width}x${cell.height}` === only) && (!onlyText || cell.text === onlyText));
const HANDS = [1, 7, 8, 10].filter((hand) => !onlyHand || hand === Number(onlyHand));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: pass, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else pass(message.result);
  });
  return {
    ready: new Promise((pass, reject) => {
      ws.addEventListener('open', pass);
      ws.addEventListener('error', reject);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((pass, reject) => {
        pending.set(id, { resolve: pass, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function main() {
  if (!browserPath) throw new Error('no Chrome/Edge found; pass --browser or set CHROME');
  if (!CELLS.length || !HANDS.length) throw new Error('the requested filters selected no acceptance cell');

  const served = standalone ? null : await serve({ root: ROOT, port: 8308, open: false });
  const base = standalone
    ? pathToFileURL(resolve(ROOT, 'AshenSpire.html')).href
    : `http://localhost:${served.port}/index.html`;
  const browser = await launchBrowser({ prefix: 'hand-pager-', browser: browserPath, timeoutMs: 15000 });
  const cdp = connectCdp(browser.wsUrl);
  await cdp.ready;
  if (shots) mkdirSync(resolve(ROOT, shots), { recursive: true });

  let sessionId;
  let failures = 0;
  let ran = 0;
  const check = (value, label, detail = '') => {
    console.log(`    ${value ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!value) failures++;
  };

  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Accessibility.enable', {}, sessionId);

    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'page evaluation failed');
      return result.result.value;
    };
    const waitFor = async (expression, label) => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await new Promise((pass) => setTimeout(pass, 50));
      }
      throw new Error(`timed out waiting for ${label}`);
    };
    const tap = async (selector) => {
      const point = await evaluate(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        node.scrollIntoView({ block:'nearest', inline:'center' });
        const rect = node.getBoundingClientRect();
        const x=(rect.left+rect.right)/2, y=(rect.top+rect.bottom)/2;
        const hit=document.elementFromPoint(x,y);
        return { x, y, hit: !!(hit && (hit === node || node.contains(hit))) };
      })()`);
      if (!point) throw new Error(`tap target missing: ${selector}`);
      if (!point.hit) throw new Error(`tap target center is covered: ${selector}`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      await new Promise((pass) => setTimeout(pass, 120));
    };

    for (const cell of CELLS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: cell.width,
        height: cell.height,
        deviceScaleFactor: 1,
        mobile: false,
      }, sessionId);
      for (const hand of HANDS) {
        ran++;
        const settings = encodeURIComponent(JSON.stringify({ textSize: cell.text }));
        const url = `${base}?shot=combat&shotHand=${hand}&shotSettings=${settings}`;
        await cdp.send('Page.navigate', { url }, sessionId);
        await waitFor(`document.querySelectorAll('.combat .hand .card').length === ${hand}`, `${hand}-card combat`);
        await new Promise((pass) => setTimeout(pass, 250));

        const reading = await evaluate(`(() => {
          const visible = (node) => {
            if (!node || node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
            const style = getComputedStyle(node), rect = node.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          };
          const rect = (node) => {
            const r = node.getBoundingClientRect();
            return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
          };
          const contains = (outer, inner) => inner.left >= outer.left - 0.5 && inner.top >= outer.top - 0.5
            && inner.right <= outer.right + 0.5 && inner.bottom <= outer.bottom + 0.5;
          const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const buttons = [...document.querySelectorAll('.hand-page')];
          const shown = buttons.filter(visible);
          const overlayNode = document.querySelector('.hand-overlay') || document.querySelector('.hand');
          const overlay = overlayNode ? rect(overlayNode) : null;
          const pagerRects = shown.map((button) => ({ ...rect(button), label: button.getAttribute('aria-label') || '' }));
          const fixed = [...document.querySelectorAll('.energy-orb,.end-turn,.pile,.statuses')]
            .filter(visible).map((node) => ({ name: node.className, ...rect(node) }));
          const handNode = document.querySelector('.hand');
          const handRect = handNode ? rect(handNode) : null;
          const cardCenters = [...document.querySelectorAll('.hand .card')].filter(visible).map((node) => {
            const r = rect(node), x=(r.left+r.right)/2, y=(r.top+r.bottom)/2;
            const hit = document.elementFromPoint(x, y);
            const exposed = !!handRect && x >= handRect.left && x <= handRect.right
              && y >= handRect.top && y <= handRect.bottom && !!hit && (hit === node || node.contains(hit));
            return { x, y, exposed };
          }).filter((center) => center.exposed);
          const centersClear = pagerRects.every((page) => cardCenters.every((center) =>
            !(center.x >= page.left && center.x <= page.right && center.y >= page.top && center.y <= page.bottom)));
          const chromeCollisions = pagerRects.flatMap((page) => fixed
            .filter((item) => intersects(page, item)).map((item) => ({ page:page.label, item })));
          const centerHits = shown.map((button) => {
            const r = rect(button), hit = document.elementFromPoint((r.left+r.right)/2, (r.top+r.bottom)/2);
            return !!(hit && (hit === button || button.contains(hit)));
          });
          const grid = getComputedStyle(overlayNode || document.body).gridTemplateColumns;
          return {
            hand: document.querySelectorAll('.hand .card').length,
            cards: [...document.querySelectorAll('.hand .card')].map((card) => ({
              id: card.dataset.instanceId || '',
              name: (card.querySelector('.cname')?.textContent || '').trim(),
            })),
            buttonCount: buttons.length,
            visibleCount: shown.length,
            labels: shown.map((button) => button.getAttribute('aria-label') || ''),
            hiddenFlags: buttons.map((button) => button.hidden),
            focusableVisible: shown.filter((button) => button.matches('[data-focusable]') && button.tabIndex >= 0).length,
            pagerFocused: buttons.some((button) => button.classList.contains('gp-focus') || document.activeElement === button),
            hasOverlay: !!document.querySelector('.hand-overlay'),
            pagingState: overlayNode?.dataset?.paging || null,
            gridColumns: grid,
            oneGridColumn: grid === 'none' || grid.trim().split(/\\s+/).length === 1,
            minimumTap: pagerRects.length ? Math.min(...pagerRects.map((r) => Math.min(r.width, r.height))) : null,
            onGlass: pagerRects.every((r) => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight),
            centerHits,
            contained: !!overlay && pagerRects.every((r) => contains(overlay, r)),
            chromeClear: chromeCollisions.length === 0,
            chromeCollisions,
            centersClear,
            overlay,
            pagerRects,
          };
        })()`);
        const ax = await cdp.send('Accessibility.getFullAXTree', {}, sessionId);
        const pagerAx = ax.nodes.filter((node) => node.role?.value === 'button'
          && ['Previous card', 'Next card'].includes(node.name?.value)).map((node) => node.name.value);

        if (shots) {
          const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
          const file = `combat-${cell.width}x${cell.height}-text-${cell.text.toLowerCase()}-hand-${hand}.png`;
          writeFileSync(resolve(ROOT, shots, file), Buffer.from(data, 'base64'));
        }

        const tag = `${cell.width}x${cell.height} Text ${cell.text}, hand ${hand}, ${standalone ? 'standalone' : 'source'}`;
        console.log(`\n  ${tag}`);
        if (hand <= 7) {
          check(reading.visibleCount === 0, '0-7 cards expose no visible pager', JSON.stringify(reading));
          check(pagerAx.length === 0, '0-7 cards expose no pager AX nodes', JSON.stringify(pagerAx));
          check(reading.focusableVisible === 0 && !reading.pagerFocused, '0-7 cards expose no pager focus stop', JSON.stringify(reading));
          check(reading.pagingState === 'false' && reading.oneGridColumn,
            '0-7 cards reserve no pager columns or hand width', JSON.stringify({ state: reading.pagingState, columns: reading.gridColumns }));
        } else {
          check(reading.visibleCount === 2 && JSON.stringify(reading.labels.sort()) === JSON.stringify(['Next card', 'Previous card']),
            '8+ cards expose exactly two named pager controls', JSON.stringify(reading));
          check(pagerAx.length === 2, '8+ cards expose exactly two pager AX nodes', JSON.stringify(pagerAx));
          check(reading.minimumTap >= 44 && reading.onGlass && reading.centerHits.every(Boolean),
            '8+ pager controls are at least 44px, on-glass, and center-hittable', JSON.stringify(reading));
          check(reading.hasOverlay && reading.pagingState === 'true' && reading.contained,
            'pager stays contained by the hand overlay boundary', JSON.stringify(reading));
          check(reading.chromeClear && reading.centersClear,
            'pager intersects no combat chrome or card center', JSON.stringify(reading));
        }
      }

      // One continuous real combat proves both threshold edges and the cursor
      // teardown. Previous seeds the remembered pager cursor; a trusted Shield
      // click plays 8 -> 7 while Next owns focus. Then a donor card is posed as
      // the real Transmute + Ivory Comb draw doors, whose trusted play moves
      // 7 -> 8 on the same mount. The pager must return with no stale cursor.
      if (!onlyHand) {
        const settings = encodeURIComponent(JSON.stringify({ textSize: cell.text }));
        const zeroUrl = `${base}?shot=combat&shotHand=1&shotSettings=${settings}`;
        await cdp.send('Page.navigate', { url: zeroUrl }, sessionId);
        await waitFor(`document.querySelectorAll('.combat .hand .card').length === 1`, 'dynamic 1-card combat');
        await new Promise((pass) => setTimeout(pass, 250));
        await tap('.hand .card');
        await waitFor(`document.querySelectorAll('.combat .hand .card').length === 0`, 'dynamic empty hand');
        await new Promise((pass) => setTimeout(pass, 700));
        const empty = await evaluate(`(() => {
          const overlay=document.querySelector('.hand-overlay');
          return {
            cards:document.querySelectorAll('.hand .card').length,
            visiblePager:[...document.querySelectorAll('.hand-page')].filter((page)=>!page.hidden).length,
            pagerFocus:!!document.querySelector('.hand-page.gp-focus'),
            state:overlay?.dataset.paging || null,
            columns:overlay ? getComputedStyle(overlay).gridTemplateColumns : null,
          };
        })()`);
        const emptyAxTree = await cdp.send('Accessibility.getFullAXTree', {}, sessionId);
        const emptyAx = emptyAxTree.nodes.filter((node) => node.role?.value === 'button'
          && ['Previous card', 'Next card'].includes(node.name?.value));
        console.log(`\n  ${cell.width}x${cell.height} Text ${cell.text}, dynamic 1→0, ${standalone ? 'standalone' : 'source'}`);
        check(empty.cards === 0 && empty.visiblePager === 0 && emptyAx.length === 0 && !empty.pagerFocus,
          'empty hand exposes no paint, AX, or focus pager', JSON.stringify(empty));
        check(empty.state === 'false' && empty.columns?.trim().split(/\s+/).length === 1,
          'empty hand reserves no pager columns', JSON.stringify(empty));

        const url = `${base}?shot=combat&shotHand=8&shotSettings=${settings}`;
        await cdp.send('Page.navigate', { url }, sessionId);
        await waitFor(`document.querySelectorAll('.combat .hand .card').length === 8`, 'dynamic 8-card combat');
        await new Promise((pass) => setTimeout(pass, 250));

        await tap('.hand-prev'); // trusted pointer focus + remembered last card
        const seeded = await evaluate(`(() => ({
          focus: document.querySelector('.gp-focus')?.dataset.instanceId || null,
          ids: [...document.querySelectorAll('.hand .card')].map((card) => card.dataset.instanceId),
        }))()`);
        const pagerStanding = await evaluate(`document.activeElement?.matches?.('.hand-prev') || false`);
        const shieldId = await evaluate(`[...document.querySelectorAll('.hand .card')]
          .find((card) => /Shield Defend/.test(card.textContent) && card.dataset.instanceId !== ${JSON.stringify(seeded.focus)})?.dataset.instanceId || null`);
        if (!shieldId) throw new Error('dynamic fixture has no non-cursor Shield Defend');
        await tap(`.hand .card[data-instance-id="${shieldId}"]`);
        await waitFor(`document.querySelectorAll('.hand .card').length === 7 && document.querySelector('.hand-overlay')?.dataset.paging === 'false'`, 'dynamic 8-to-7 teardown');
        await new Promise((pass) => setTimeout(pass, 700));
        const hidden = await evaluate(`(() => ({
          hand: document.querySelectorAll('.hand .card').length,
          visiblePager: [...document.querySelectorAll('.hand-page')].filter((page) => !page.hidden).length,
          pagerFocus: !!document.querySelector('.hand-page.gp-focus'),
          cardFocus: document.querySelector('.hand .card.gp-focus')?.dataset.instanceId || null,
          hiddenActive: document.activeElement?.matches?.('.hand-page[hidden]') || false,
        }))()`);
        const hiddenAxTree = await cdp.send('Accessibility.getFullAXTree', {}, sessionId);
        const hiddenAx = hiddenAxTree.nodes.filter((node) => node.role?.value === 'button'
          && ['Previous card', 'Next card'].includes(node.name?.value));

        console.log(`\n  ${cell.width}x${cell.height} Text ${cell.text}, dynamic 8→7→8, ${standalone ? 'standalone' : 'source'}`);
        check(pagerStanding, 'dynamic fixture gives trusted pointer focus to Previous');
        check(hidden.hand === 7 && hidden.visiblePager === 0 && hiddenAx.length === 0,
          'dynamic 8-to-7 hides paint and AX pager', JSON.stringify(hidden));
        check(!hidden.pagerFocus && !hidden.hiddenActive && hidden.cardFocus === seeded.focus,
          'dynamic 8-to-7 returns pager focus to the remembered surviving card', JSON.stringify({ seeded, hidden }));

        const donorId = await evaluate(`(() => {
          const focus = document.querySelector('.hand .card.gp-focus')?.dataset.instanceId;
          const donorNode = [...document.querySelectorAll('.hand .card')]
            .find((card) => /Shield Defend/.test(card.textContent) && card.dataset.instanceId !== focus);
          const donor = window.__combat.piles.hand.find((card) => card.instanceId === donorNode?.dataset.instanceId);
          if (!donor) return null;
          donor.cardId = 'transmute'; donor.upgraded = false;
          if (!window.__combat.player.relicIds.includes('ivoryComb')) window.__combat.player.relicIds.push('ivoryComb');
          window.__combat.player.counters.cardsPlayedThisCombat = 7;
          return donor.instanceId;
        })()`);
        if (!donorId) throw new Error('dynamic fixture has no draw donor');
        await tap(`.hand .card[data-instance-id="${donorId}"]`);
        await waitFor(`document.querySelectorAll('.hand .card').length === 8 && document.querySelector('.hand-overlay')?.dataset.paging === 'true'`, 'dynamic 7-to-8 reveal');
        await new Promise((pass) => setTimeout(pass, 700));
        const revealed = await evaluate(`(() => ({
          ids: [...document.querySelectorAll('.hand .card')].map((card) => card.dataset.instanceId),
          visiblePager: [...document.querySelectorAll('.hand-page')].filter((page) => !page.hidden).length,
          pagerFocus: !!document.querySelector('.hand-page.gp-focus'),
          cardFocus: document.querySelector('.hand .card.gp-focus')?.dataset.instanceId || null,
        }))()`);
        const at = revealed.ids.indexOf(revealed.cardFocus);
        const expectedNext = at >= 0 ? revealed.ids[(at + 1) % revealed.ids.length] : null;
        await tap('.hand-next');
        const stepped = await evaluate(`document.querySelector('.hand .card.gp-focus')?.dataset.instanceId || null`);
        check(revealed.visiblePager === 2 && !revealed.pagerFocus && !!revealed.cardFocus,
          'dynamic 7-to-8 reveals two controls without stale pager focus', JSON.stringify(revealed));
        check(!!expectedNext && stepped === expectedNext,
          'revealed Next advances from the current card rather than a stale cursor', JSON.stringify({ revealed, expectedNext, stepped }));
      }
    }
  } finally {
    cdp.close();
    await browser.close();
    if (served) await new Promise((pass, reject) => served.server.close((error) => error ? reject(error) : pass()));
  }

  console.log(`\n${failures ? 'RED' : 'GREEN'} hand pager threshold — ${ran} cell(s), ${failures} finding(s)`);
  return failures ? 1 : 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`UNKNOWN hand pager threshold — ${error.stack || error.message}`);
  process.exitCode = 2;
}
