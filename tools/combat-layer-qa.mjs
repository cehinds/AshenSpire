import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openCombatQa } from './rear-qa-runtime.mjs';
import { pointerTargetExpression } from './pointer-target.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.COMBAT_QA_URL || 'http://localhost:8338/';
const out = resolve(process.env.COMBAT_QA_OUT || '.codex/combat-layers');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  for (const [width, height, shot = 'combat'] of [[650, 766], [1440, 900], [390, 844], [844, 390], [1440, 900, 'coop']]
    .filter(([, , shot = 'combat']) => !process.env.QA_SHOT || shot === process.env.QA_SHOT)) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    const runtime = await openCombatQa(page, base, shot);
    await page.waitForFunction(() => document.querySelectorAll('.combat-ground-shadow').length >= 3);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      const { stageFor } = window.__combatQaRuntime || await import('/src/ui/services/PoseAnimator.js');
      const stages = [...document.querySelectorAll('.player .alternative-card-stage')];
      if (!stages.length) throw new Error('Combat player must use rear artwork');
      if ((await Promise.all(stages.map(el => stageFor(el).ready))).some(ready => !ready)) throw new Error('Rear artwork failed to load');
    });
    await page.waitForFunction(() => [...document.querySelectorAll('.combatant .enemy-pose-idle, .combatant .pose-frame[src]:not(.pose-previous)')]
      .every(img => img.complete && img.naturalWidth > 0), null, { timeout: 60000 });
    const layers = await page.evaluate(() => {
      const combat = document.querySelector('.combat');
      const z = (selector, pseudo) => Number(getComputedStyle(document.querySelector(selector), pseudo).zIndex);
      const ancestors = [...document.querySelectorAll('.combatant .sprite,.combatant-leading')].flatMap(node => {
        const bad = [];
        for (let parent = node.parentElement; parent && parent !== combat; parent = parent.parentElement) {
          const s = getComputedStyle(parent);
          if (s.zIndex !== 'auto' || s.transform !== 'none' || s.filter !== 'none' || s.isolation === 'isolate' || Number(s.opacity) !== 1) bad.push(parent.className);
        }
        return bad;
      });
      return {
        scenery: z('.backdrop'), shadows: z('.combat-ground-shadows'),
        enemies: [...document.querySelectorAll('.enemy .sprite')].map(el => Number(getComputedStyle(el).zIndex)),
        player: z('.player .sprite'), fade: document.querySelector('.alternative-card-fade') ? z('.alternative-card-fade') : z('.combat', '::before'),
        selection: z('.enemy .combatant-leading'), cards: z('.hand-overlay, .hand-area > .hand'),
        targetPlate: document.querySelector('.enemy.enemy-target-hitbox') ? z('.enemy.enemy-target-hitbox', '::after') : null, targetHealth: z('.enemy .meters'),
        hud: z('.combat-hud'), footer: z('.combat-action-row'), ancestors,
        railsBackground: combat.dataset.combatArrangement === 'rails'
          ? getComputedStyle(document.querySelector('.combat-action-row')).backgroundImage : 'none',
        shadowBoxes: [...document.querySelectorAll('.combat-ground-shadow')].map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
        entityTargets: [...document.querySelectorAll('.combat-ground-shadow')].every(el =>
          !el.hasAttribute('data-eid') && document.querySelector(`[data-eid="${CSS.escape(el.dataset.shadowFor)}"]`)?.classList.contains('combatant')),
        missingArt: [...document.querySelectorAll('.combatant .enemy-pose-idle, .combatant .pose-frame[src]:not(.pose-previous)')].filter(img => !img.complete || !img.naturalWidth).map(img => img.src),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert(layers.scenery < layers.shadows && layers.shadows < Math.min(...layers.enemies));
    assert(layers.shadows < layers.fade && layers.fade < Math.min(...layers.enemies));
    assert(Math.max(...layers.enemies) < layers.player && layers.player < layers.selection);
    assert(layers.selection < layers.cards);
    assert((layers.targetPlate === null || layers.targetPlate < layers.targetHealth) && layers.targetHealth < layers.selection,
      'target plate must stay behind its health and intent controls');
    assert(layers.cards < layers.hud && layers.cards < layers.footer);
    assert.deepEqual(layers.ancestors, [], 'shared wrappers must not trap artwork or selection controls');
    assert.equal(layers.railsBackground, 'none', 'footer rails must not paint an opaque sheet over cards');
    assert(layers.shadowBoxes.every(box => box.width > 0 && box.height > 0));
    assert(layers.entityTargets, 'decorative shadows must never intercept combatant lookup');
    assert.deepEqual(layers.missingArt, []);
    assert.equal(layers.overflow, false);
    let receiptStability = null;
    if (shot === 'coop') {
      await page.waitForTimeout(900);
      receiptStability = await page.evaluate(async () => {
        const measure = () => [...document.querySelectorAll('.combatant .sprite')].map(node => {
          const r = node.getBoundingClientRect();
          return { id: node.closest('.combatant').dataset.eid, x: r.x, y: r.y, width: r.width, height: r.height };
        });
        const before = measure();
        const oldField = document.querySelector('.field');
        const style = document.createElement('style');
        style.textContent = '.coop .combatant-leading { min-height: 150px !important; }';
        document.head.append(style);
        const next = structuredClone(window.__coopSnapshotForShot);
        next.scene.players[0].hand.pop();
        window.__receiveCoopSnapshotForShot(next);
        await new Promise(resolve => setTimeout(resolve, 900));
        const result = { before, after: measure(), replacedField: oldField !== document.querySelector('.field') };
        style.remove();
        return result;
      });
      writeFileSync(resolve(out, 'coop-receipt.json'), JSON.stringify(receiptStability, null, 2));
      assert(receiptStability.replacedField, 'snapshot must exercise a real field remount');
      for (const before of receiptStability.before) {
        const after = receiptStability.after.find(actor => actor.id === before.id);
        for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(after[key] - before[key]) < .25,
          `co-op receipt changed ${before.id} ${key}`);
      }
    }
    const clickCard = async card => {
      await card.evaluate(node => node.dataset.layerQaCard = 'true');
      const point = await page.evaluate(pointerTargetExpression('[data-layer-qa-card="true"]'));
      await page.mouse.click(point.x, point.y);
      await card.evaluate(node => delete node.dataset.layerQaCard);
    };
    await clickCard(page.locator('.hand .card').first());
    if (shot === 'coop') {
      assert(await page.evaluate(() => window.__coopSentForShot.some(message => message.t === 'playCard')),
        'co-op card clicks reach the local snapshot stub above the fade');
    } else {
      assert(await page.locator('.hand .card.selected').count() > 0, 'cards remain selectable above the fade');
    }
    const attack = page.locator('.hand .card.type-attack').first();
    if (await attack.count()) await clickCard(attack);
    await page.screenshot({ path: resolve(out, `${shot}-${width}.png`), animations: 'disabled' });
    assert.deepEqual(errors, []);
    results.push({ shot, viewport: [width, height], runtime, layers, receiptStability, errors, failedRequests: failures });
    await page.close();
  }
  writeFileSync(resolve(out, 'checks.json'), JSON.stringify({ base, results }, null, 2));
  console.log(JSON.stringify({ passed: results.length, out, results }, null, 2));
} finally { await browser.close(); }
