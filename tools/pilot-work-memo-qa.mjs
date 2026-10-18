// Exact Chromium RGBA comparison and work-surface memo counts for pilot Images.
// This measures renderer work, not game latency or GPU time.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const hosted = await serve({ root, port: 0, open: false, quiet: true });
const owner = await launchBrowser({ browser: process.env.CHROME || '/usr/bin/chromium', prefix: 'pilot-work-pixels-' });
let browser;
try {
  browser = await chromium.connectOverCDP(owner.wsUrl);
  const page = await browser.newPage();
  await page.goto(hosted.url + 'pose-studio/stances/class-smash/review/index.html');
  const report = await page.evaluate(async () => {
    const { createAlternativeAuraRenderer } = await import('/src/ui/alternativeAuraRenderer.js');
    const { alternativeCardAnimationFamily } = await import('/src/model/cardAnimationFamily.js');
    const { combatWeaponProfilesFor } = await import('/src/model/combatWeaponPresentation.js');
    const { auraFilter } = await import('/src/ui/combatAura.js');
    const family = alternativeCardAnimationFamily('reaver', combatWeaponProfilesFor({ classId: 'reaver' }));
    const keys = [...new Set(['attack', 'smash', 'sweep'].flatMap(action => family.family.sequences[action].poses))];
    const frames = keys.map(key => [key, family.frames[key === 'origin' ? 'ready' : key]]);
    const images = new Map();
    for (const [, frame] of frames) {
      const image = new Image(); image.src = '/' + frame.path; await image.decode(); images.set(frame, image);
    }
    const width = 932, height = 768;
    function fixture() {
      const counts = { glowDraws: 0, workDraws: 0, clears: 0, materializations: 0 }, surfaces = [];
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const read = context.getImageData.bind(context);
      context.getImageData = (...args) => { counts.materializations++; return read(...args); };
      const renderer = createAlternativeAuraRenderer({ canvasWidth: width, canvasHeight: height, createCanvas() {
        const surface = document.createElement('canvas'); surfaces.push(surface);
        const ctx = surface.getContext('2d');
        const draw = ctx.drawImage.bind(ctx), clear = ctx.clearRect.bind(ctx);
        ctx.drawImage = (...args) => { counts.workDraws++; if (ctx.shadowOffsetX) counts.glowDraws++; return draw(...args); };
        ctx.clearRect = (...args) => { counts.clears++; return clear(...args); };
        return surface;
      } });
      return { renderer, context, counts, surfaces };
    }
    const plain = fixture(), cached = fixture(), rows = [];
    const filters = [auraFilter('pilot-attack-1', 'idle', ['stamina'], true),
      auraFilter('power2', 'idle', ['stamina', 'mana'], true), auraFilter('ready', 'counter', [], false)];
    function compare(key, frame, filter, shift, repeat) {
      const image = images.get(frame), offset = frame.drawOffset || [128, 0], size = frame.size || [512, 512];
      const x = offset[0] + shift, y = offset[1] + 100 - shift;
      const before = [plain, cached].map(target => ({ ...target.counts }));
      for (const [target, reuse] of [[plain, false], [cached, true]]) {
        target.context.clearRect(0, 0, width, height);
        target.renderer.draw(target.context, image, filter, x, y, ...size, { reuseWork: reuse, materialize: true });
      }
      const bytes = [plain, cached].map(target => target.context.getImageData(0, 0, width, height).data);
      let different = 0;
      for (let i = 0; i < bytes[0].length; i++) if (bytes[0][i] !== bytes[1][i]) different++;
      const delta = [plain, cached].map((target, index) => Object.fromEntries(Object.entries(target.counts).map(([name, value]) => [name, value - before[index][name]])));
      rows.push({ key, shift, repeat, filter, different, plain: delta[0], memo: delta[1] });
    }
    // Consecutive repeats hit; frame/filter/geometry transitions miss. Walking
    // distinct frames then revisiting the first proves this is only a last-key memo.
    for (const filter of filters) for (const shift of [0, 5.25]) {
      for (const [key, frame] of [...frames, frames[0]]) for (let repeat = 0; repeat < 2; repeat++) compare(key, frame, filter, shift, repeat);
    }
    const retained = cached.surfaces.filter(surface => surface.width > 0).length;
    const result = { checks: rows.length, rows, plain: plain.counts, cached: cached.counts, retainedSurfaces: retained };
    plain.renderer.dispose(); cached.renderer.dispose();
    result.disposed = [...plain.surfaces, ...cached.surfaces].every(surface => surface.width === 0 && surface.height === 0);
    return result;
  });
  assert.ok(report.checks > 100);
  for (const row of report.rows) {
    assert.equal(row.different, 0, `${row.key}: memo RGBA equals uncached`);
    for (const name of ['glowDraws', 'workDraws', 'clears']) {
      assert.equal(row.memo[name], row.repeat === 0 ? row.plain[name] : 0, `${row.key}: miss work equals baseline, only exact repeats save work`);
    }
  }
  assert.ok(report.cached.glowDraws < report.plain.glowDraws);
  assert.equal(report.cached.glowDraws * 2, report.plain.glowDraws, 'each identical repeat avoids every source-alpha glow pass');
  assert.equal(report.cached.materializations, report.plain.materializations);
  assert.equal(report.retainedSurfaces, 1, 'only the existing work surface; no pilot cache copies');
  assert.equal(report.disposed, true);
  writeFileSync(process.env.QA_PIXEL_RESULT || '/tmp/pilot-work-memo-pixels.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks, allPixelsEqual: true, plain: report.plain, cached: report.cached, retainedSurfaces: report.retainedSurfaces, disposed: report.disposed }));
} finally {
  await browser?.close(); await owner.close(); await new Promise(resolve => hosted.server.close(resolve));
}
