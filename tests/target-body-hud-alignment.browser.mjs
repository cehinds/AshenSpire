// Requires real artwork: BASE_URL=http://127.0.0.1:4460/ HUD_ENTRY=AshenSpire.html PLAYWRIGHT_MODULE=/path/to/playwright node tests/target-body-hud-alignment.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const [width, height] of [[390, 844], [820, 1180], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.BASE_URL || server.url}${process.env.HUD_ENTRY || 'index.html'}?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=3`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.combatant.player .pose-stage')?.__poseStage?.currentArt?.body);
    const poses = new Set();
    for (const stance of ['offensive', 'defensive', 'casting', 'counter', 'smash']) {
      const receipt = await page.evaluate(async stance => {
        const frame = document.querySelector('.combatant.player');
        const controller = frame.querySelector('.pose-stage').__poseStage;
        await controller.ready;
        const accepted = controller.setStance(stance);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const art = controller.currentArt, canvas = art.canvas.getBoundingClientRect();
        const head = canvas.top + art.body.headY * canvas.height / art.canvas.height;
        const rack = frame.querySelector(':scope > .target-hud-overhead-meters').getBoundingClientRect();
        const hp = frame.querySelector('.target-hud-overhead-meters [data-res="hp"].m-track').getBoundingClientRect();
        return { accepted, pose: controller.pose, source: art.body.source, gap: head - rack.bottom,
          width: hp.width, expectedWidth: Number(frame.dataset.miniHudWidth) };
      }, stance);
      assert.equal(receipt.accepted, true, `${width}: ${stance} uses a real stance frame`);
      assert.equal(receipt.source, 'authored', 'body head must come from semantic metadata');
      poses.add(receipt.pose);
      assert.ok(Math.abs(receipt.gap - 5) <= 1.5, `${width}/${stance}: mini HUD/body-head gap ${receipt.gap}`);
      assert.ok(Math.abs(receipt.width - receipt.expectedWidth) <= 1.5, 'pose keeps cell-sized HP width');
    }
    assert.ok(poses.size >= 4, 'test changed actual painted pose, rather than relabeling one bitmap');
    await page.locator('.combatant.player .sprite').click();
    await page.locator('.target-hud-detail[data-eid="player"].visible').waitFor({ state: 'visible' });
    const selectedGap = await page.evaluate(() => {
      const frame = document.querySelector('.combatant.player'), art = frame.querySelector('.pose-stage').__poseStage.currentArt;
      const canvas = art.canvas.getBoundingClientRect();
      const head = canvas.top + art.body.headY * canvas.height / art.canvas.height;
      return head - frame.querySelector(':scope > .target-hud-overhead-meters').getBoundingClientRect().bottom;
    });
    assert.ok(Math.abs(selectedGap - 5) <= 1.5, `${width}: selected intent/body-head gap ${selectedGap}`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Body-head HUD alignment passes real stance changes at mobile, tablet, and desktop sizes.');
} finally { await browser.close(); await server?.close(); }
