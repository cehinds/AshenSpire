import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openCombatQa } from './rear-qa-runtime.mjs';
import { pointerTargetExpression } from './pointer-target.mjs';
import { assertCombatLayerOrder } from './combat-layer-contract.mjs';
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
    // Ground shadows are each sprite's ::before (combat.css / kit.css); the
    // separate shadow layer was removed with combatGroundShadows.js.
    await page.waitForFunction(() => document.querySelectorAll('.combatant .sprite').length >= 1);
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
      const z = (selector, pseudo) => {
        const node = [...document.querySelectorAll(selector)].find(node => paints(node, pseudo));
        return node ? Number(getComputedStyle(node, pseudo).zIndex) : null;
      };
      const paints = (node, pseudo) => {
        for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        }
        const style = getComputedStyle(node, pseudo);
        return style.display !== 'none' && !['hidden', 'collapse'].includes(style.visibility)
          && (!pseudo || !['none', 'normal'].includes(style.content));
      };
      const sprites = [...document.querySelectorAll('.combatant .sprite')].filter(sprite => paints(sprite)).flatMap(sprite => {
        const actor = sprite.closest('.combatant');
        const selected = actor.classList.contains('context-selected');
        const actual = Number(getComputedStyle(sprite).zIndex);
        // Sample the real selected cascade for every role, including co-op's
        // other players. Restore synchronously; no gameplay event is dispatched.
        try {
          actor.classList.add('context-selected');
          return [actual, Number(getComputedStyle(sprite).zIndex)];
        } finally { actor.classList.toggle('context-selected', selected); }
      });
      const selectionSurfaces = [], hudSurfaces = [], selectionCategories = [];
      for (const node of document.querySelectorAll(
        '.enemy-target-picker,.combatant-leading,.combatant :is(.nm,.meters,.statuses),.combatant-inspector-host,.formation-move-controls,.position-guides,.combat-expansion-controls,.coop-arm-host')) {
        if (!paints(node)) continue;
        const playerHud = node.closest('.player .combatant-leading');
        // The player's leading HUD owns a700 stacking context. Its children's
        // local501 values do not put those children back into the ordinary plane.
        if (playerHud) {
          if (node === playerHud) hudSurfaces.push(Number(getComputedStyle(node).zIndex));
          continue;
        }
        selectionSurfaces.push(Number(getComputedStyle(node).zIndex));
        if (node.matches('.enemy .combatant-leading')) selectionCategories.push('enemy-leading');
        if (node.matches('.enemy :is(.nm,.meters,.statuses)')) selectionCategories.push('enemy-reading');
      }
      for (const actor of document.querySelectorAll('.combatant:is(.enemy-target-hitbox,.player-target-hitbox)')) {
        for (const pseudo of ['::before', '::after']) {
          if (!paints(actor, pseudo)) continue;
          selectionSurfaces.push(Number(getComputedStyle(actor, pseudo).zIndex));
          if (pseudo === '::before') selectionCategories.push('target-proxy');
        }
      }
      const ancestors = [...document.querySelectorAll('.combatant .sprite,.combatant-leading')].flatMap(node => {
        const bad = [];
        for (let parent = node.parentElement; parent && parent !== combat; parent = parent.parentElement) {
          const s = getComputedStyle(parent);
          if (s.zIndex !== 'auto' || s.transform !== 'none' || s.filter !== 'none' || s.isolation === 'isolate' || Number(s.opacity) !== 1) bad.push(parent.className);
        }
        return bad;
      });
      return {
        scenery: z('.backdrop'), sprites, selectionSurfaces, hudSurfaces, selectionCategories,
        enemies: [...document.querySelectorAll('.enemy .sprite')].map(el => Number(getComputedStyle(el).zIndex)),
        player: z('.player .sprite'), fade: document.querySelector('.alternative-card-fade') ? z('.alternative-card-fade') : z('.combat', '::before'),
        selection: z('.enemy .combatant-leading'), cards: z('.hand-overlay, .hand-area > .hand'),
        targetPlate: document.querySelector('.enemy.enemy-target-hitbox') ? z('.enemy.enemy-target-hitbox', '::after') : null, targetHealth: z('.enemy .meters'),
        hud: z('.combat-hud'), footer: z('.combat-action-row'), ancestors,
        railsBackground: combat.dataset.combatArrangement === 'rails'
          ? getComputedStyle(document.querySelector('.combat-action-row')).backgroundImage : 'none',
        // A pseudo-element has no box of its own: read its used size from computed style.
        shadowBoxes: [...document.querySelectorAll('.combatant .sprite')].map(el => {
          const s = getComputedStyle(el, '::before');
          return { content: s.content, width: parseFloat(s.width), height: parseFloat(s.height) };
        }),
        entityTargets: [...document.querySelectorAll('.combatant .sprite')].every(el =>
          getComputedStyle(el, '::before').pointerEvents === 'none'),
        missingArt: [...document.querySelectorAll('.combatant .enemy-pose-idle, .combatant .pose-frame[src]:not(.pose-previous)')].filter(img => !img.complete || !img.naturalWidth).map(img => img.src),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assertCombatLayerOrder(layers);
    assert((layers.targetPlate === null || layers.targetPlate < layers.targetHealth) && layers.targetHealth < layers.selection,
      'target plate must stay behind its health and intent controls');
    assert.deepEqual(layers.ancestors, [], 'shared wrappers must not trap artwork or selection controls');
    assert.equal(layers.railsBackground, 'none', 'footer rails must not paint an opaque sheet over cards');
    assert(layers.shadowBoxes.length > 0 && layers.shadowBoxes.every(box => box.content !== 'none' && box.width > 0 && box.height > 0));
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
