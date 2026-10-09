// Real selection inputs exercise the visual emphasis without changing the
// cached formation fit. Re-rendering while selected catches compounded zoom.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openCombatQa } from './rear-qa-runtime.mjs';
import { pointerTargetExpression } from './pointer-target.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.env.COMBAT_QA_OUT || '.codex/combat-sprite-selection';
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const near = (actual, expected, label) => assert(Math.abs(actual - expected) < .3, `${label}: ${actual} != ${expected}`);
try {
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [], records = [];
    page.on('pageerror', error => errors.push(error.message));
    const snapshot = () => page.evaluate(() => [...document.querySelectorAll('.combatant[data-eid]')].map(frame => {
      const sprite = frame.querySelector('.sprite'), rect = sprite.getBoundingClientRect(), style = getComputedStyle(sprite);
      return { id: frame.dataset.eid, selected: frame.classList.contains('context-selected'),
        x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom,
        center: rect.x + rect.width / 2, depth: Number(style.zIndex), scale: style.scale,
        fit: frame.dataset.baseSpriteScale, zoom: sprite.style.zoom };
    }));
    try {
      const url = new URL(process.env.COMBAT_QA_URL || 'http://localhost:8338/');
      if (url.pathname.endsWith('.html')) await openCombatQa(page, url.href, 'combat');
      else {
        url.searchParams.set('shot', 'combat');
        await page.goto(url.href, { waitUntil: 'commit', timeout: 120000 });
        await page.waitForFunction(() => window.__combat && typeof window.__renderCombatForShot === 'function'
          && document.querySelector('.player .sprite'), null, { timeout: 120000 });
      }
      await page.evaluate(async () => {
        await document.fonts.ready;
        const { stageFor } = window.__combatQaRuntime || await import('/src/ui/services/PoseAnimator.js');
        await Promise.all([...document.querySelectorAll('.player .sprite')].map(sprite => stageFor(sprite)?.ready));
      });
      await page.waitForTimeout(1200);
      await page.keyboard.press('Escape');
      const baseline = await snapshot();
      assert(baseline.length >= 3 && baseline.every(actor => !actor.selected));
      for (const original of baseline) {
        const selector = `.combatant[data-eid="${original.id}"] ${original.id === 'player' ? '.sprite' : '.intent'}`;
        const point = await page.evaluate(pointerTargetExpression(selector));
        await page.mouse.click(point.x, point.y);
        await page.waitForFunction(id => document.querySelector(`.combatant[data-eid="${id}"]`)?.classList.contains('context-selected'), original.id);
        await page.waitForTimeout(900);
        for (const phase of ['selected', 'rerendered']) {
          if (phase === 'rerendered') {
            await page.evaluate(() => window.__renderCombatForShot());
            await page.waitForTimeout(300);
          }
          const actors = await snapshot(), selected = actors.find(actor => actor.id === original.id);
          assert(selected.selected, 'selection survives a card-style combat rerender');
          near(selected.width, original.width * 1.05, `${phase} width`);
          near(selected.height, original.height * 1.05, `${phase} height`);
          near(selected.center, original.center, `${phase} horizontal anchor`);
          near(selected.bottom, original.bottom, `${phase} ground anchor`);
          assert.equal(selected.fit, original.fit, 'selection must not alter the formation cache');
          assert.equal(selected.zoom, original.zoom, 'selection must not compound fitted zoom');
          assert(actors.filter(actor => actor.id !== selected.id).every(actor => selected.depth > actor.depth), 'selected sprite paints above every other sprite');
          for (const other of actors.filter(actor => actor.id !== selected.id)) {
            const before = baseline.find(actor => actor.id === other.id);
            for (const key of ['x', 'y', 'width', 'height', 'depth']) near(other[key], before[key], `unselected ${other.id} ${key}`);
          }
          records.push({ phase, id: original.id, actors });
        }
        await page.screenshot({ path: `${out}/${width}-${original.id}-selected.png` });
        const blank = await page.evaluate(() => {
          const combat = document.querySelector('.combat'), rect = combat.getBoundingClientRect();
          for (let y = rect.top + 90; y < rect.bottom - 80; y += 20) for (let x = rect.left + 8; x < rect.right - 8; x += 20) {
            const target = document.elementFromPoint(x, y);
            if (combat.contains(target) && !target.closest('.combatant,button,.hand,.card,.combat-tools,.combatant-inspector-host,.as-tip,.modal')) return { x, y };
          }
          throw new Error('No uncovered battlefield point for real deselection');
        });
        await page.mouse.click(blank.x, blank.y);
        await page.waitForTimeout(300);
        const restored = await snapshot();
        for (const actor of restored) {
          const before = baseline.find(row => row.id === actor.id);
          assert(!actor.selected);
          for (const key of ['x', 'y', 'width', 'height', 'depth']) near(actor[key], before[key], `restored ${actor.id} ${key}`);
          assert.equal(actor.scale, before.scale);
        }
        records.push({ phase: 'deselected', id: original.id, actors: restored });
      }
      assert.deepEqual(errors, []);
      results.push({ width, height, pass: true, baseline, records, errors });
    } catch (error) {
      results.push({ width, height, pass: false, error: error.stack, records, errors, current: await snapshot() });
      await page.screenshot({ path: `${out}/${width}-failure.png` });
      throw error;
    } finally {
      writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
      await page.close();
    }
  }
  console.log('PASS selected sprites grow to105%, lead sprite depth, survive rerenders, and restore exact base geometry at390/1440');
} finally { await browser.close(); }
