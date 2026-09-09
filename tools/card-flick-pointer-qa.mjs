// Native browser pointer streams: no supplied timestamps or DOM-dispatched events.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PREVIEW_URL || 'http://localhost:4357';
const route = process.env.QA_ROUTE || '/AshenSpire.html?shot=combat';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'ashen-flick-pointer-qa');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
const check = (ok, label) => { assert.ok(ok, label); results.push(label); console.log('PASS', label); };
try {
  for (const input of ['mouse', 'touch', 'pen']) {
    const context = await browser.newContext({ viewport: { width: 963, height: 731 }, hasTouch: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let scenario = 'enabled';
    const load = async (settings = {}) => {
      scenario = settings.touchFlickPlay === false ? 'disabled' : settings.touchFlickDistance ? 'long-distance' : 'enabled';
      await page.goto(base + route + '&shotSettings=' + encodeURIComponent(JSON.stringify(settings)));
      await page.locator('.hand .card').first().waitFor();
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        window.flickEvidence = [];
        for (const name of ['pointerdown', 'pointermove', 'pointerup']) {
          window.addEventListener(name, event => {
            queueMicrotask(() => window.flickEvidence.push({
              event: name, input: event.pointerType, x: event.clientX, y: event.clientY,
              time: event.timeStamp, preview: document.querySelector('.drop-verdict')?.textContent,
            }));
          });
        }
      });
    };
    const state = () => page.evaluate(() => ({
      hand: window.__combat.piles.hand.length, energy: window.__combat.player.energy,
      hp: window.__combat.enemies.map(enemy => enemy.hp),
    }));
    const gesture = async (distance, finish = 'release') => {
      const b = await page.locator('.hand .card').first().boundingBox();
      const x = b.x + b.width / 2, y = b.y + b.height * .65;
      const send = (phase, px, py) => input === 'touch'
        ? cdp.send('Input.dispatchTouchEvent', {
          type: phase === 'start' ? 'touchStart' : phase === 'move' ? 'touchMove' : 'touchEnd',
          touchPoints: phase === 'end' ? [] : [{ x: px, y: py }],
        })
        : cdp.send('Input.dispatchMouseEvent', {
          type: phase === 'start' ? 'mousePressed' : phase === 'move' ? 'mouseMoved' : 'mouseReleased',
          x: px, y: py, button: 'left', buttons: phase === 'end' ? 0 : 1,
          clickCount: 1, pointerType: input,
        });
      await send('start', x, y);
      // Queue at normal input cadence without serial round trips turning a quick
      // physical motion into a slow drag on a busy browser. Chromium supplies time.
      const pending = [];
      for (let n = 1; n <= 5; n++) {
        pending.push(send('move', x, y - distance * n / 5));
        await new Promise(resolve => setTimeout(resolve, 12));
      }
      if (finish === 'release') pending.push(send('end', x, y - distance));
      await Promise.all(pending);
      if (finish === 'blur') {
        await page.screenshot({ path: join(output, input + '-nearest-preview.png') });
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await send('end', x, y - distance);
      }
      if (finish === 'pause') {
        await page.waitForTimeout(220);
        await send('end', x, y - distance);
      }
      await page.waitForTimeout(1400);
      const evidence = await page.evaluate(() => window.flickEvidence);
      writeFileSync(join(output, input + '-' + scenario + '-' + finish + '-' + distance + '.json'), JSON.stringify(evidence, null, 2));
      return evidence;
    };
    await load();
    const before = await state();
    const card = page.locator('.hand .card').first();
    if (input === 'touch') await card.tap({ position: { x: 30, y: 60 } });
    else await card.click({ position: { x: 30, y: 60 } });
    check(JSON.stringify(await state()) === JSON.stringify(before) && await card.evaluate(el => el.classList.contains('selected')), input + ': ordinary selection spends nothing');
    await card.locator('.card-info-button').click();
    await page.locator('.card-inspection-modal').waitFor();
    check(JSON.stringify(await state()) === JSON.stringify(before), input + ': Information spends nothing');
    await page.keyboard.press('Escape');
    await gesture(140, 'blur');
    check(JSON.stringify(await state()) === JSON.stringify(before), input + ': cancelled preview spends nothing');
    await gesture(140, 'pause');
    check(JSON.stringify(await state()) === JSON.stringify(before), input + ': paused drag spends nothing');
    await gesture(25);
    check(JSON.stringify(await state()) === JSON.stringify(before), input + ': short motion spends nothing');
    const evidence = await gesture(140);
    const after = await state();
    const up = evidence.filter(e => e.event === 'pointerup').at(-1);
    check(up.input === input, input + ': native pointer type reaches combat');
    const overEnemy = await page.evaluate(p => !!document.elementFromPoint(p.x, p.y)?.closest('.enemy'), up);
    check(!overEnemy, input + ': release is outside every enemy');
    check(after.hand === before.hand - 1 && after.energy === before.energy - 1, input + ': flick plays exactly once');
    check(after.hp[0] < before.hp[0] && after.hp.slice(1).every((hp, i) => hp === before.hp[i + 1]), input + ': nearest legal enemy takes damage');
    await load({ touchFlickDistance: 160 });
    const longBefore = await state(); await gesture(100);
    check(JSON.stringify(await state()) === JSON.stringify(longBefore), input + ': saved distance setting applies');
    await load({ touchFlickPlay: false });
    const offBefore = await state(); await gesture(140);
    check(JSON.stringify(await state()) === JSON.stringify(offBefore), input + ': disabled flick stays disabled');
    check(errors.length === 0, input + ': no browser errors');
    await context.close();
  }
  writeFileSync(join(output, 'checks.json'), JSON.stringify(results, null, 2));
  console.log(`${results.length} native pointer checks passed; ${output}`);
} finally { await browser.close(); }
