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

async function board(width, height, enemies, seed = 4) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  await page.goto(`${server.url}index.html?shot=combat&gameProfile=core&shotSeed=${seed}${enemies ? `&shotEnemyCount=${enemies}&shotHand=5` : ''}`, { waitUntil: 'load' });
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
    // A status gained mid-fight grows an enemy's panel upward; its Inspect control moves with it and stays inside its top-right corner.
    await click(page, page.locator('.hand .card[data-card-id="core.strike"]').first()); await page.waitForTimeout(1200);
    const inspectInside = () => page.evaluate(() => {
      const shell = document.querySelector('.target-hud-detail[data-role="enemy"].visible'); if (!shell) return null;
      const panel = shell.querySelector('.target-hud-panel').getBoundingClientRect(), info = document.querySelector(`.target-hud-inspect-info[data-eid="${shell.dataset.eid}"]`).getBoundingClientRect();
      return { statuses: shell.querySelectorAll('.status-icon').length, insideX: info.left >= panel.left - 1 && info.right <= panel.right + 1, insideY: info.top >= panel.top - 1 && info.bottom <= panel.bottom + 1, right: panel.right - info.right, top: info.top - panel.top, panelTop: panel.top };
    });
    const bare = await inspectInside();
    assert.ok(bare, `${tag}: an enemy panel is showing before the status`);
    {
      await page.evaluate(() => { const enemy = window.__combat.enemies.find(e => e.alive); enemy.statuses = { ...(enemy.statuses || {}), weak: { stacks: 3 } }; window.__renderCombatForShot?.(); });
      await page.waitForTimeout(1200);
      const grown = await inspectInside();
      assert.ok(grown.statuses > 0, `${tag}: the status shows in the panel`);
      assert.ok(grown.panelTop <= bare.panelTop + 0.5, `${tag}: the enemy's panel grew upward (or stayed against the edge) when the status appeared (${bare.panelTop} -> ${grown.panelTop})`);
      assert.ok(grown.insideX && grown.insideY, `${tag}: the Inspect control stays inside its panel after a status appears (${JSON.stringify(grown)})`);
      assert.ok(Math.abs(grown.top - bare.top) < 2 && Math.abs(grown.right - bare.right) < 2, `${tag}: and in the same corner (${JSON.stringify([bare, grown])})`);
    }
    await page.close();
  }
  // Other seeds stand the player in other cells (PERF1: the back-left one). Every HUD is still exactly as wide as its cell, and each
  // Inspect control stands inside its own panel's top-right corner, whichever cell the figure is in.
  for (const seed of ['PERF1', 'PERF2']) for (const [width, height] of [[390, 844], [1280, 800]]) {
    const page = await board(width, height, null, seed), tag = `${width}x${height} seed ${seed}`;
    await click(page, page.locator('.hand .card[data-card-id="core.strike"]').first()); await page.waitForTimeout(1200);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.combatant')].map(frame => {
      const id = frame.dataset.eid, polygon = JSON.parse(frame.dataset.targetHudCellPolygon || 'null');
      const shell = document.querySelector(`.target-hud-detail[data-eid="${id}"]`), info = document.querySelector(`.target-hud-inspect-info[data-eid="${id}"]`);
      const panel = shell?.querySelector('.target-hud-panel').getBoundingClientRect(), box = info?.getBoundingClientRect();
      return { id, cell: frame.dataset.formationCell, cellWidth: polygon && polygon[2][0] - polygon[3][0], shown: shell?.classList.contains('visible'),
        width: shell?.getBoundingClientRect().width, panel: panel && { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom }, info: box && { left: box.left, right: box.right, top: box.top, bottom: box.bottom } };
    }));
    const player = rows.find(row => row.id === 'player');
    assert.ok(player?.cellWidth > 20, `${tag}: the player's cell width is published (cell ${player?.cell})`);
    // Armed with a Strike, every living enemy is a legal target, so every enemy's panel shows (a row that does not is a failure,
    // not a row to skip). Width is the `.target-hud-detail` shell's, as in the blocks above.
    for (const row of rows.filter(row => row.id !== 'player')) assert.ok(row.shown, `${tag} ${row.id} (${row.cell}): the enemy's panel shows once a Strike is armed`);
    assert.ok(rows.some(row => row.id !== 'player' && row.shown), `${tag}: at least one enemy panel was checked`);
    for (const row of rows.filter(row => row.shown)) {
      const name = `${tag} ${row.id} (${row.cell})`;
      assert.ok(row.panel && row.info, `${name}: its panel and Inspect control exist`);
      assert.ok(Math.abs(row.width - row.cellWidth) <= 2, `${name}: panel ${row.width.toFixed(1)} is as wide as its cell ${row.cellWidth.toFixed(1)}`);
      assert.ok(row.info.left >= row.panel.left - 1 && row.info.right <= row.panel.right + 1 && row.info.top >= row.panel.top - 1 && row.info.bottom <= row.panel.bottom + 1,
        `${name}: Inspect ${JSON.stringify(row.info)} is inside its panel ${JSON.stringify(row.panel)}`);
      assert.ok(row.panel.right - row.info.right <= 7 && row.info.top - row.panel.top <= 7,
        `${name}: Inspect stands in the panel's top-right corner (${(row.panel.right - row.info.right).toFixed(1)} from the right, ${(row.info.top - row.panel.top).toFixed(1)} from the top)`);
    }
    assert.ok(rows.some(row => row.id === 'player' && row.shown), `${tag}: the player's panel is showing`);
    await page.close();
  }
  // A panel already pushed against the top edge keeps its top on screen when a status grows it (short landscape phone).
  {
    const page = await board(844, 390, 3);
    await click(page, page.locator('.hand .card[data-card-id="core.strike"]').first()); await page.waitForTimeout(1200);
    const tops = () => page.evaluate(() => [...document.querySelectorAll('.target-hud-detail[data-role="enemy"].visible')].map(shell => {
      const box = shell.getBoundingClientRect(), info = document.querySelector(`.target-hud-inspect-info[data-eid="${shell.dataset.eid}"]`).getBoundingClientRect();
      return { top: box.top, infoInside: info.top >= box.top - 1 && info.bottom <= box.bottom + 1 };
    }));
    assert.ok((await tops()).length > 0, 'landscape: enemy panels show');
    await page.evaluate(() => { for (const enemy of window.__combat.enemies) if (enemy.alive) enemy.statuses = { ...(enemy.statuses || {}), weak: { stacks: 2 }, vulnerable: { stacks: 2 } }; window.__renderCombatForShot?.(); });
    await page.waitForTimeout(1200);
    for (const { top, infoInside } of await tops()) { assert.ok(top >= -0.5, `landscape: a grown panel's top ${top} stays on screen`); assert.ok(infoInside, 'landscape: Inspect stays inside the grown panel'); }
    await page.close();
  }
  console.log('combat-hud-static ok');
} finally { await browser.close(); server.close?.(); }
process.exit(0);
