import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openCombatQa } from './rear-qa-runtime.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = resolve(process.env.COMBAT_QA_OUT || '.codex/rear-player-actions');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 650, height: 766 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const runtime = await openCombatQa(page, process.env.COMBAT_QA_URL || 'http://localhost:8338/', 'combat');
  await page.locator('.player .alternative-card-stage').waitFor();
  const results = await page.evaluate(async () => {
    const createAlternativeCardStage = window.__combatQaRuntime?.createStage
      || (await import('/src/ui/alternativeCardStage.js')).createAlternativeCardStage;
    const alternativeCardAnimations = window.__combatQaRuntime?.catalog
      || (await import('/src/content/alternativeCardAnimations.js')).alternativeCardAnimations;
    const results = [];
    const host = document.createElement('div');
    host.className = 'combatant player';
    host.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden';
    const sprite = document.createElement('div');
    sprite.className = 'sprite';
    host.append(sprite);
    document.body.append(host);
    for (const classId of Object.keys(alternativeCardAnimations.classes)) {
      const stage = createAlternativeCardStage(classId);
      sprite.append(stage.el);
      if (!await stage.ready) throw new Error(classId + ' artwork did not load');
      const canvas = stage.el.querySelector('canvas');
      const context = canvas.getContext('2d');
      const originalDraw = context.drawImage.bind(context);
      let drawing;
      context.drawImage = (...args) => { drawing = args.slice(1); return originalDraw(...args); };
      const geometry = () => {
        const box = stage.el.getBoundingClientRect();
        return [box.x, box.y, box.width, box.height, canvas.width, canvas.height];
      };
      const baseline = geometry();
      const poses = [];
      for (const stance of ['offensive', 'defensive', 'casting']) {
        stage.setStance(stance);
        poses.push({ pose: stage.pose, geometry: geometry(), drawing });
      }
      const actions = [];
      for (const action of Object.keys(alternativeCardAnimations.classes[classId].sequences)) {
        const samples = [];
        for (const fraction of [0, .2, .4, .6, .8, 1]) {
          stage.seek(action, fraction * 260);
          samples.push({ fraction, geometry: geometry(), drawing });
        }
        stage.settle();
        actions.push({ action, samples, settled: drawing });
      }
      const reactions = [];
      for (const classes of ['hitflash', 'hitflash hit-heavy', 'wobble', 'hitflash hit-heavy wobble', 'hitflash hit-heavy hit-stop']) {
        sprite.className = 'sprite ' + classes;
        const animation = stage.el.getAnimations().find(animation => animation.effect.target === stage.el);
        if (!animation) throw new Error(classId + ' missing reaction feedback: ' + classes);
        animation.pause();
        const duration = animation.effect.getTiming().duration;
        const samples = [];
        for (const fraction of [0, .2, .3, .5, .6, .8, 1]) {
          animation.currentTime = duration * fraction;
          const style = getComputedStyle(stage.el);
          samples.push({ fraction, geometry: geometry(), filter: style.filter, transform: style.transform });
        }
        reactions.push({ classes, samples });
        animation.cancel(); sprite.className = 'sprite';
        void sprite.offsetWidth; // Commit removal before the same animation name restarts.
      }
      results.push({ classId, baseline, poses, actions, reactions });
      stage.dispose(); stage.el.remove();
    }
    host.remove();
    return results;
  });
  for (const result of results) {
    for (const pose of result.poses) {
      assert.deepEqual(pose.geometry, result.baseline);
      assert.deepEqual(pose.drawing, [128, 16, 512, 512]);
    }
    for (const { action, samples, settled } of result.actions) {
      const melee = ['attack', 'smash', 'sweep'].includes(action);
      for (const sample of samples) {
        assert.deepEqual(sample.geometry, result.baseline, `${result.classId} ${action}: fixed stage`);
        assert.deepEqual(sample.drawing.slice(1), [16, 512, 512], 'body frame scale and ground stay fixed');
        if (!melee) assert.equal(sample.drawing[0], 128, `${action} must not translate`);
      }
      if (melee) assert(samples.some(sample => sample.drawing[0] > 128), `${action} must advance`);
      assert.equal(samples.at(-1).drawing[0], 128, 'melee must return');
      assert.deepEqual(settled, [128, 16, 512, 512]);
    }
    for (const { classes, samples } of result.reactions) {
      for (const sample of samples) {
        assert.deepEqual(sample.geometry, result.baseline, `${result.classId} ${classes}: fixed reaction stage`);
        assert.equal(sample.transform, 'none', `${classes} must not move the canvas root`);
      }
      assert(samples.some(sample => sample.filter !== 'none'), `${classes} retains visible feedback`);
    }
  }
  assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(out, 'combat.png'), animations: 'disabled' });
  writeFileSync(resolve(out, 'checks.json'), JSON.stringify({ runtime, results, errors }, null, 2));
  console.log(`Passed ${results.length} classes, 32 actions, 12 held stances and 20 wrapped reaction checks. Evidence: ${out}`);
} finally { await browser.close(); }
