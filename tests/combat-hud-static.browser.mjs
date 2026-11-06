// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/combat-hud-static.browser.mjs
// Owner 2026-11-06: "Keep enemy mini HUDs above them in a fixed position. Keep player hud anchored to the right and fixed. It should
// not redraw after combat starts." and "make the mini HUD only as wide as the cell, adjust font size accordingly".
//   1. At 390x844 with 1 and with 3 enemies each enemy HUD (its mini rack, and its panel once a card is armed) is centred on its
//      figure (within 8px) with its bottom above the figure's head; the player's HUD stands right of the figure.
//   2. Selecting cards, playing one for damage and ending the turn leave every HUD box where it was and replace no HUD node (a
//      MutationObserver over the combat root counts node adds and removes inside the HUD subtrees).
//   3. Every HUD is as wide as its cell (within 2px) at 390x844 and 1280x800, and no HUD text overflows its box.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const HUD = '.target-hud-layer, .target-hud-detail, .target-hud-overhead-meters, .target-hud-inspect-info, .intent, .player-action-intent, .combatant-leading, .meters, .combat-health-row, .statuses, .nm, .enemy-key';

async function board(width, height, enemies) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  await page.goto(`${server.url}index.html?shot=combat&gameProfile=core&shotSeed=4&shotEnemyCount=${enemies}&shotHand=5`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__combat);
  await page.waitForSelector('.combatant.player .sprite');
  await page.waitForTimeout(2500);
  return page;
}
const click = async (page, locator, fy = 0.5) => { const box = await locator.boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height * fy); };

// Where every HUD box stands now (bounding rects) and how many HUD nodes were added or removed since `watch`.
const watch = page => page.evaluate(sel => {
  window.__hudSwaps = 0;
  const inHud = node => node.nodeType === 1 && (node.matches(sel) || node.closest(sel) || node.querySelector(sel));
  window.__hudWatch?.disconnect();
  window.__hudWatch = new MutationObserver(list => { for (const m of list) for (const node of [...m.addedNodes, ...m.removedNodes]) if (inHud(node) || (m.target.nodeType === 1 && m.target.closest(sel))) window.__hudSwaps++; });
  window.__hudWatch.observe(document.body, { childList: true, subtree: true });
}, HUD);
const rects = page => page.evaluate(() => [...document.querySelectorAll('.target-hud-detail .target-hud-panel, .target-hud-overhead-meters, .target-hud-overhead-meters > .intent, .target-hud-overhead-meters > .player-action-intent')]
  .map(node => { const r = node.getBoundingClientRect(), id = node.closest('.combatant')?.dataset.eid || node.closest('.target-hud-detail')?.dataset.eid; return [`${node.className.split(' ')[0]}:${id}`, Math.round((r.left + r.width / 2) * 2) / 2, Math.round(r.top * 2) / 2, Math.round(r.height * 2) / 2]; })); // centre x: an intent's width follows its content
const swaps = page => page.evaluate(() => window.__hudSwaps);

// Geometry of each combatant against its HUD boxes.
const geometry = page => page.evaluate(() => [...document.querySelectorAll('.combatant')].filter(frame => !frame.classList.contains('dead')).map(frame => {
  const sprite = frame.querySelector('.sprite').getBoundingClientRect(), id = frame.dataset.eid, role = frame.classList.contains('player') ? 'player' : 'enemy';
  const polygon = JSON.parse(frame.dataset.targetHudCellPolygon || 'null');
  const cellWidth = polygon ? polygon[2][0] - polygon[3][0] : null;
  const rack = frame.querySelector(':scope > .target-hud-overhead-meters')?.getBoundingClientRect();
  const shell = document.querySelector(`.target-hud-detail[data-eid="${id}"]`), panel = shell?.querySelector('.target-hud-panel').getBoundingClientRect();
  const box = shell?.getBoundingClientRect();
  return { id, role, cellWidth, head: Number(frame.dataset.miniHudHeadY), figureX: sprite.left + sprite.width / 2, spriteRight: sprite.right,
    rack: rack && { x: rack.left + rack.width / 2, width: rack.width, bottom: rack.bottom },
    panel: panel && { x: panel.left + panel.width / 2, left: panel.left, width: box.width, bottom: panel.bottom, top: panel.top, visible: shell.classList.contains('visible') } };
}));

// No HUD text may be wider than its box, and no HUD descendant may stand outside its HUD's width.
const overflow = page => page.evaluate(() => {
  const bad = [];
  for (const host of document.querySelectorAll('.target-hud-detail.visible, .combatant > .target-hud-overhead-meters')) {
    const box = host.getBoundingClientRect();
    for (const el of [host, ...host.querySelectorAll('*')]) {
      const r = el.getBoundingClientRect();
      if (!r.width || el.closest('[hidden]') || getComputedStyle(el).visibility === 'hidden') continue;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && getComputedStyle(el).overflowX === 'visible' && el.children.length === 0)
        bad.push(`${el.className || el.tagName} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
      if (r.left < box.left - 1.5 || r.right > box.right + 1.5) bad.push(`${el.className || el.tagName} [${r.left.toFixed(1)},${r.right.toFixed(1)}] outside HUD [${box.left.toFixed(1)},${box.right.toFixed(1)}]`);
    }
  }
  return bad;
});

try {
  for (const [width, height] of [[390, 844], [1280, 800]]) for (const enemies of [1, 3]) {
    const page = await board(width, height, enemies), tag = `${width}x${height} ${enemies}e`;
    let geo = await geometry(page);
    // Armed: every legal enemy's panel shows.
    await click(page, page.locator('.hand .card').nth(1));
    await page.waitForTimeout(1200);
    geo = await geometry(page);
    const player = geo.find(g => g.role === 'player');
    for (const g of geo) {
      assert.ok(g.cellWidth > 20, `${tag} ${g.id}: the cell width is published`);
      assert.ok(Math.abs(g.rack.width - g.cellWidth) <= 2, `${tag} ${g.id}: the mini HUD is as wide as its cell (${g.rack.width.toFixed(1)} vs ${g.cellWidth.toFixed(1)})`);
      if (g.panel?.visible) assert.ok(Math.abs(g.panel.width - g.cellWidth) <= 2, `${tag} ${g.id}: the panel is as wide as its cell (${g.panel.width.toFixed(1)} vs ${g.cellWidth.toFixed(1)})`);
      if (g.role === 'enemy') {
        assert.ok(Math.abs(g.rack.x - g.figureX) <= 8, `${tag} ${g.id}: the rack is centred on its figure (${g.rack.x.toFixed(1)} vs ${g.figureX.toFixed(1)})`);
        assert.ok(g.rack.bottom <= g.head + 1, `${tag} ${g.id}: the rack's bottom ${g.rack.bottom.toFixed(1)} is above the head ${g.head}`);
        if (g.panel?.visible) {
          assert.ok(Math.abs(g.panel.x - g.figureX) <= 8 || g.panel.left <= 1 || g.panel.left + g.panel.width >= width - 1, `${tag} ${g.id}: the panel is centred on its figure or against the screen edge`);
          assert.ok(g.panel.bottom <= g.head + 1, `${tag} ${g.id}: the panel's bottom ${g.panel.bottom.toFixed(1)} is above the head ${g.head}`);
        }
      }
    }
    assert.ok(player.panel.left >= player.spriteRight - 8 || player.panel.left >= player.figureX, `${tag}: the player HUD stands right of the figure`);
    assert.deepEqual(await overflow(page), [], `${tag}: no HUD text overflows`);
    // Select, play and (phone only, to bound the run) end the turn: nothing moves, nothing is replaced.
    await watch(page);
    const before = await rects(page);
    await click(page, page.locator('.hand .card').nth(2)); await page.waitForTimeout(600);
    await click(page, page.locator('.hand .card').nth(3)); await page.waitForTimeout(600);
    await click(page, page.locator('.hand .card').nth(0)); await page.waitForTimeout(600);
    assert.equal(await swaps(page), 0, `${tag}: selecting three cards replaces no HUD node`);
    assert.deepEqual(await rects(page), before, `${tag}: selecting three cards moves no HUD box`);
    const hpBefore = await page.evaluate(() => window.__combat.enemies.map(enemy => enemy.hp));
    await click(page, page.locator('.hand .card[data-card-id="core.strike"]').first()); await page.waitForTimeout(600);
    await click(page, page.locator('.combatant.enemy .sprite').first(), 0.6); await page.waitForTimeout(2500);
    const hp = await page.evaluate(() => window.__combat.enemies.map(enemy => enemy.hp));
    assert.ok(hp.reduce((a, b) => a + b, 0) < hpBefore.reduce((a, b) => a + b, 0), `${tag}: the card dealt damage (${hpBefore} -> ${hp})`);
    assert.equal(await swaps(page), 0, `${tag}: a damaging play replaces no HUD node`);
    assert.deepEqual(await rects(page), before, `${tag}: a damaging play moves no HUD box`);
    assert.deepEqual(await overflow(page), [], `${tag}: no HUD text overflows after a play`);
    await page.close();
  }
  console.log('combat-hud-static ok');
} finally { await browser.close(); server.close?.(); }
process.exit(0);
