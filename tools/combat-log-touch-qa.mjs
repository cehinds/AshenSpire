// Exercise the log with browser-native taps/drags. No app state injection.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.env.COMBAT_QA_OUT || '.codex/combat-log-touch';
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [width, height] of [[288, 513], [320, 568], [390, 844], [844, 390]].filter(([w]) => !process.env.QA_WIDTH || w === Number(process.env.QA_WIDTH))) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
    const cdp = await page.context().newCDPSession(page);
    const result = { width, height, steps: [], errors: [] }; results.push(result);
    page.on('pageerror', error => result.errors.push(error.message));
    const save = () => writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
    const log = page.locator('[data-combat-tool="log"]');
    let dragScale = 1;
    const snapshot = () => page.evaluate(() => {
      const root = document.querySelector('.combat-tools'), panel = document.querySelector('#combat-log');
      return { size: root.dataset.logSize, open: !panel.hidden, rect: panel.getBoundingClientRect().toJSON(),
        tools: root.getBoundingClientRect().toJSON(), hand: document.querySelector('.hand').getBoundingClientRect().toJSON(),
        menuBottom: Math.max(...[...document.querySelectorAll('.topbar button')].map(node => node.getBoundingClientRect().bottom)) };
    });
    const drag = async (delta, cancel = false) => {
      const r = await log.boundingBox(); assert(r);
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      assert(y - delta / dragScale >= 1 && y - delta / dragScale < height - 1, 'native drag stays inside viewport');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 10; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - delta / dragScale * step / 10 }] });
        await page.waitForTimeout(18);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(250);
      return snapshot();
    };
    try {
      const url = new URL(process.env.COMBAT_QA_URL || 'http://localhost:8338/?preview=rear-player');
      url.searchParams.set('shot', 'combat');
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
      result.url = page.url(); result.title = await page.title();
      await log.waitFor({ state: 'visible', timeout: 120000 });
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        window.__qaLogEvents = [];
        for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) document.addEventListener(type, event => {
          window.__qaLogEvents.push({ type, target: event.target.closest?.('[data-combat-tool]')?.dataset.combatTool || event.target.className,
            button: event.button, pointer: event.pointerId, x: event.clientX, y: event.clientY,
            open: !document.querySelector('#combat-log').hidden, size: document.querySelector('.combat-tools').dataset.logSize });
        }, true);
      });
      assert.equal(await page.locator('#combat-log button[data-log-size]').count(), 0, 'no inner size buttons');
      await log.tap(); await page.waitForTimeout(250);
      const small = await snapshot(); assert(small.open && small.size === 'Small');
      assert(Math.abs(small.hand.right - small.tools.right - 6) < 1, 'toolbar aligned to hand right');
      assert(Math.abs(small.tools.top - small.hand.top) < 1, 'toolbar occupies the reserved top row of the card band');
      const maxDelta = small.tools.top - 6 - small.menuBottom - 8 - small.rect.height;
      dragScale = Math.max(1, maxDelta / Math.max(24, Math.min(120, height - small.tools.bottom - 8)));
      const large = await drag(maxDelta);
      assert(large.open && large.size === 'Large', 'upward touch drag opens Large and trailing click does not close');
      assert(large.rect.top >= large.menuBottom - 1, 'drawer clears menu');
      assert(large.rect.left >= -1 && large.rect.right <= width + 1, 'drawer remains in viewport');
      const mediumHeight = (small.rect.height + large.rect.height) / 2;
      const medium = await drag(mediumHeight - large.rect.height);
      assert(medium.open && medium.size === 'Medium', 'downward touch drag snaps Medium');
      assert(small.rect.height < medium.rect.height && medium.rect.height < large.rect.height, 'three distinct visible heights');
      const cancelled = await drag(medium.rect.height - small.rect.height, true);
      assert(cancelled.open && cancelled.size === 'Medium', 'cancel restores prior size');
      const smallAgain = await drag(small.rect.height - medium.rect.height);
      assert(smallAgain.open && smallAgain.size === 'Small', 'downward touch drag snaps Small');
      result.steps.push({ route: 'touch-snaps', small, medium, large, cancelled, smallAgain });
      await log.tap(); await page.waitForTimeout(200);
      assert(!(await snapshot()).open, 'fresh tap closes after completed drag');
      await log.tap(); await page.waitForTimeout(200);
      await log.focus(); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
      assert.equal((await snapshot()).size, 'Medium', 'keyboard Up resizes');
      await page.keyboard.press('End'); await page.waitForTimeout(200);
      assert.equal((await snapshot()).size, 'Large', 'keyboard End resizes');
      await log.tap(); await page.waitForTimeout(200);
      assert(!(await snapshot()).open);
      const dragOpened = await drag(large.rect.height - small.rect.height);
      assert(dragOpened.open && dragOpened.size === 'Large', 'dragging a closed handle opens and sizes the drawer');
      result.steps.push({ route: 'tap-touch-drag-cancel-keyboard', small, medium, large });
      assert.deepEqual(result.errors, []);
      await page.screenshot({ path: `${out}/${width}-large.png` });
      result.pass = true; save();
    } catch (error) {
      result.error = error.stack; result.gestureTrace = await page.evaluate(() => window.__qaLogEvents);
      result.last = await snapshot(); save();
      await page.screenshot({ path: `${out}/${width}-failure.png` });
      throw error;
    } finally { await page.close(); }
  }
  assert(results.length > 0, 'QA_WIDTH must select a supported viewport');
  console.log(`PASS native combat log tap/drag/cancel/keyboard at ${results.map(row => row.width).join(', ')}`);
} finally { await browser.close(); }
