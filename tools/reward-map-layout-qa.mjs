// Production reward/map mounts: column containment and touch response budget.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve(process.env.UI_FIX_QA_OUT || 'scratch/reward-map-layout');
mkdirSync(output, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'msedge' }), headless: true });
console.log('Browser ready');
const results = [];
const baseline = !!process.env.UI_FIX_BASELINE;
try {
  for (const width of [833, 1440, 390]) {
    const phone = width === 390;
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: phone, hasTouch: phone });
    const page = await context.newPage();
    console.log(`Checking ${width}px`);
    // Source UI fixture; skip the development server's whole-tree build stamp.
    await page.route('**/src/buildversion.js', route => route.fulfill({ contentType: 'text/javascript', body: readFileSync('src/buildversion.js', 'utf8') }));
    if (baseline) for (const path of ['styles/kit.css', 'styles/map.css', 'src/ui/screens/map.js']) {
      await page.route(`**/${path}`, route => route.fulfill({ contentType: path.endsWith('.css') ? 'text/css' : 'text/javascript', body: execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' }) }));
    }
    const errors = [], failedRequests = [], expectedAudioFallbacks = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => {
      if (r.status() < 400) return;
      const detail = `${r.status()} ${r.url()}`;
      if (r.status() === 404 && /\/assets\/sfx\/(victory|nodeTravel)\.ogg$/.test(r.url())) expectedAudioFallbacks.push(detail);
      else failedRequests.push(detail);
    });
    await page.goto(`${server.url}index.html?shot=reward`, { waitUntil: 'domcontentloaded' });
    console.log('Reward document ready');
    await page.locator('.reward-kind').first().waitFor();
    await page.evaluate(async () => {
      const { mountRewards } = await import('/src/ui/screens/reward.js');
      const { contentBundle } = await import('/src/content/index.js');
      const { createRegistries } = await import('/src/model/registries.js');
      const registries = createRegistries(contentBundle);
      const run = { class: 'herald', cinders: 70, deck: [], flasks: [], relics: [], coreTags: [], loadout: { storage: [] }, level: { level: 1, xp: 34, unspentPoints: 0 }, skills: {
        'class:herald': { level: 0, xp: 10 }, 'item:magic-focus': { level: 1, xp: 7, pendingDrafts: 1 }, 'combatManeuvers': { level: 1, xp: 26, pendingDrafts: 1 },
      } };
      const rewards = { title: 'VICTORY', cinders: 56, flaskId: 'flaskOfFerocity', skillDrafts: [
        { skillId: 'item:magic-focus', level: 1, cardIds: ['spark', 'spark', 'spark'] },
        { skillId: 'combatManeuvers', level: 1, cardIds: ['strike', 'strike', 'strike'] },
      ], xpGains: { level: 34, tracks: { 'class:herald': 10, 'item:magic-focus': 7, combatManeuvers: 26 } } };
      mountRewards(document.querySelector('#app'), { registries, run, rewards, checkpoint: { rewards, expanded: true }, saves: { loadMeta: () => ({ settings: { optionDecision: { rewardContinue: 'instant' } } }) }, onDone() {} });
    });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.querySelector('.reward-door').getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
    });
    const layout = await page.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
      return { menu: box(document.querySelector('.reward-menu')), side: box(document.querySelector('.reward-side')), rows: [...document.querySelectorAll('.reward-menu > .reward-kind')].map(box) };
    });
    await page.screenshot({ path: resolve(output, `reward-${width}.png`) });
    console.log(`Reward containment checked at ${width}px`);
    if (!process.env.UI_FIX_BASELINE) {
      for (const row of layout.rows) assert.ok(row.left >= layout.menu.left - 1 && row.right <= layout.menu.right + 1, `reward row stays inside ${width}px column`);
      if (!phone) assert.ok(layout.rows.every(row => row.right < layout.side.left), 'reward choices do not cover progression');
    }
    let map = null;
    if (phone) {
      await page.goto(`${server.url}index.html?shot=map&shotAt=floor:1`, { waitUntil: 'domcontentloaded' });
      console.log('Map document ready');
      await page.locator('.map-node.reachable').first().waitFor();
      await page.waitForTimeout(350);
      await page.evaluate(() => {
        window.mapTapAt = 0;
        document.querySelector('.map-scroll').addEventListener('pointerup', () => { window.mapTapAt = performance.now(); }, { once: true });
      });
      // The pulsing halo changes the group's bounds; tap the fixed node face.
      // Its text is a legitimate event target and bubbles to the node handler.
      const tapReachable = async () => {
        const target = await page.evaluate(() => [...document.querySelectorAll('.map-node.reachable')].map(node => {
          const face = node.querySelector('circle:not(.node-halo)').getBoundingClientRect();
          const x = face.left + face.width / 2, y = face.top + face.height / 2;
          return document.elementFromPoint(x, y)?.closest('.map-node') === node ? { x, y } : null;
        }).find(Boolean));
        assert.ok(target, 'a reachable node has an unobstructed touch target');
        await page.touchscreen.tap(target.x, target.y);
      };
      await tapReachable();
      console.log('Map tapped');
      await page.waitForFunction(() => document.querySelector('.map-tray').dataset.shown === 'true');
      map = await page.evaluate(() => ({ readyMs: performance.now() - window.mapTapAt, inert: document.querySelector('.map-tray-reveal').inert, enterDisabled: document.querySelector('.map-tray-pair button:last-child').disabled }));
      console.log(JSON.stringify(map));
      if (!process.env.UI_FIX_BASELINE) assert.ok(map.readyMs < 150 && !map.inert && !map.enterDisabled, `mobile map responds within 150ms: ${JSON.stringify(map)}`);
      await page.waitForTimeout(350);
      await page.screenshot({ path: resolve(output, 'map-phone.png') });
      await page.locator('.map-tray-pair button').first().tap();
      await page.waitForFunction(() => document.querySelector('.map-tray').dataset.open === 'false');
      await tapReachable();
      await page.locator('.map-tray-pair button:last-child').tap();
      await page.waitForFunction(() => !document.querySelector('.mapscreen'));
    }
    assert.deepEqual(errors, [], 'no JavaScript errors');
    assert.deepEqual(failedRequests, [], 'no unexpected failed requests');
    results.push({ width, layout, map, errors, failedRequests, expectedAudioFallbacks });
    await context.close();
  }
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(results, null, 2));
  console.log(`${baseline ? 'Baseline measured' : 'PASS reward containment and map touch flow'}; evidence: ${output}`);
} catch (error) { console.error(error); throw error; }
finally { await browser.close(); server.server.close(); }
