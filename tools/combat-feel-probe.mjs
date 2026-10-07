// Real-browser hit-stop check: production CSS and painted stages, desktop and phone.
// PLAYWRIGHT_MODULE points to an existing Playwright installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const executable = [process.env.CHROME, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync);
assert.ok(executable, 'Set CHROME to a Chromium browser');
const out = resolve(process.env.COMBAT_FEEL_OUT || 'scratch/combat-feel');
mkdirSync(out, { recursive: true });
const { server, port } = await serve({ port: 8264, open: false });
const launched = await launchBrowser({ prefix: 'combatfeel-', browser: executable, timeoutMs: 30000 });
let browser;
try {
  browser = await chromium.connectOverCDP(launched.wsUrl);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/combat-feel-check.html', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><link rel="stylesheet" href="/styles/base.css"><link rel="stylesheet" href="/styles/combat.css"><link rel="stylesheet" href="/styles/combat-poses.css"><body style="background:#181714;color:#eee"><h1>Combat hit-stop</h1><p>Attacker and target hold; idle movement keeps its clock.</p></body>' }));
    await page.goto(`http://localhost:${port}/combat-feel-check.html`);
    const result = await page.evaluate(async () => {
      const { playTimeline, setAnimSpeed } = await import('/src/ui/fx.js');
      const { registerStage } = await import('/src/ui/services/PoseAnimator.js');
      const { createPaintedStage } = await import('/src/ui/paintedOutfits.js');
      const { selectEquipmentAnimation } = await import('/src/model/equipmentAnimation.js');
      const combat = document.createElement('div'); combat.className = 'combat';
      combat.style.cssText = 'position:relative;display:flex;gap:20px;height:360px';
      const hosts = [];
      for (const side of ['enemy', 'player']) {
        const wrapper = document.createElement('div'); wrapper.className = side;
        const host = document.createElement('div'); host.className = 'sprite';
        host.style.cssText = 'position:relative;width:140px;height:240px';
        const animation = selectEquipmentAnimation({ classId: 'reaver', rightId: 'greatsword' });
        const stage = createPaintedStage('reaver', 'default', { animation });
        assertStage(stage);
        stage.el.classList.add('class-sprite');
        host.append(stage.el); wrapper.append(host); combat.append(wrapper);
        registerStage(host, stage); hosts.push({ host, stage });
      }
      function assertStage(stage) { if (!stage) throw new Error('painted stage missing'); }
      document.body.append(combat);
      const layer = document.createElement('div'); layer.className = 'fx-layer'; combat.append(layer);
      await Promise.all([...combat.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
      const [actor, target] = hosts;
      const ctx = { layer, combatEl: combat, anchorFor: (id) => id === 'enemy' ? actor.host : target.host,
        animateActor: () => {
          actor.stage.play('attack', 500);
          return { impactMs: 40, totalMs: 500, hold: (ms) => actor.stage.hold(ms), cancel: () => actor.stage.settle() };
        }, onBeatApplied() {} };
      let holds = 0, lastPose = null, recoilPaused = false, extendedTarget = false;
      const mutations = [];
      const observer = new MutationObserver(() => {
        if (!target.host.classList.contains('hit-stop')) return;
        if (lastPose === null) {
          lastPose = target.stage.pose;
          recoilPaused = getComputedStyle(target.stage.el).animationPlayState === 'paused';
          setTimeout(() => { extendedTarget = target.stage.pose === lastPose; }, 250);
          holds++;
        } else if (target.stage.pose !== lastPose) mutations.push(target.stage.pose);
      });
      observer.observe(target.host, { subtree: true, attributes: true });
      setAnimSpeed('normal');
      const finished = new Promise((done) => playTimeline([
        { type: 'enemyMoveStarted', sourceId: 'enemy', kind: 'attack' },
        { type: 'damageDealt', sourceId: 'enemy', targetId: 'player', amount: 6 },
      ], ctx, done));
      await finished; observer.disconnect();
      const images = [...combat.querySelectorAll('img[src]')];
      await Promise.all(images.map((img) => img.decode().catch(() => {})));
      return { holds, recoilPaused, mutations, extendedTarget, targetPose: target.stage.pose,
        loaded: images.every((img) => img.complete && img.naturalWidth > 0) };
    });
    assert.equal(result.holds, 1, 'a real held impact was observed');
    assert.equal(result.recoilPaused, true, 'production recoil CSS is paused');
    assert.deepEqual(result.mutations, [], 'painted target frames stay fixed during stop');
    assert.equal(result.extendedTarget, true, 'target pose lasts beyond its original 220 ms deadline');
    assert.equal(result.loaded, true, 'painted art loaded');
    assert.deepEqual(errors, [], 'no browser exceptions');
    await page.screenshot({ path: resolve(out, `${viewport.width}x${viewport.height}.png`) });
    console.log(`PASS ${viewport.width}x${viewport.height}: target recoil and painted frames held; art loaded; no browser exceptions`);
    await context.close();
  }
  console.log('2 passed, 0 failed. Boundary: staged production figures; no physical-phone or subjective visual acceptance.');
} finally {
  await browser?.close();
  await launched.close();
  await new Promise((done) => server.close(done));
}
