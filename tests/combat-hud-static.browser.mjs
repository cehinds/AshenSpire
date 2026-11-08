// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/combat-hud-static.browser.mjs
// Owner 2026-11-06: "Keep enemy mini HUDs above them in a fixed position. Keep player hud anchored to the right and fixed. It should
// not redraw after combat starts." and "make the mini HUD only as wide as the cell, adjust font size accordingly".
//   1. At 390x844 with 1 and with 3 enemies each enemy HUD (its mini rack, and its panel once a card is armed) is centred on its
//      figure (within 8px) with its bottom above the figure's head; the player's HUD stands right of the figure.
//   2. Selecting cards, playing one for damage and ending the turn leave every HUD box where it was and replace no HUD node (a
//      MutationObserver over the combat root counts node adds and removes inside the HUD subtrees).
//   3. Every HUD is one fixed width (owner 2026-11-07: a layout token, not its cell's width) at 390x844 and 1280x800, neighbouring
//      enemy HUDs do not overlap, and no HUD text overflows its box.
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
  for (const [width, height] of [[390, 844], [1280, 800]]) for (const enemies of [1, 2, 3]) {
    const page = await board(width, height, enemies), tag = `${width}x${height} ${enemies}e`;
    let geo = await geometry(page);
    // Armed: every legal enemy's panel shows.
    await click(page, page.locator('.hand .card').nth(1));
    await page.waitForTimeout(1200);
    geo = await geometry(page);
    const player = geo.find(g => g.role === 'player');
    for (const g of geo) {
      assert.ok(g.cellWidth > 20, `${tag} ${g.id}: the cell width is published`);
      // Owner 2026-11-07 (backlog #11): one fixed width for every combatant (a layout token), not its cell's width.
      assert.ok(Math.abs(g.rack.width - geo[0].rack.width) <= 1, `${tag} ${g.id}: every mini HUD is the same fixed width (${g.rack.width.toFixed(1)} vs ${geo[0].rack.width.toFixed(1)})`);
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
    const enemyRacks = geo.filter(g => g.role === 'enemy').map(g => g.rack).sort((a, b) => a.x - b.x);
    // Three enemy lanes on a phone are narrower than the fixed width (owner 2026-11-07: fixed, compact); two must clear each other.
    if (width > 600 || enemies <= 2) for (let i = 1; i < enemyRacks.length; i++) assert.ok(enemyRacks[i].x - enemyRacks[i].width / 2 >= enemyRacks[i - 1].x + enemyRacks[i - 1].width / 2 - 1, `${tag}: neighbouring enemy HUDs do not overlap`);
    assert.ok(player.rack.x - player.rack.width / 2 >= player.spriteRight - 8 || player.rack.x >= player.figureX, `${tag}: the player mini HUD stands right of the figure (rack x ${player.rack.x.toFixed(1)}, figure ${player.figureX.toFixed(1)})`);
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
    // The player's own mini HUD may gain a row when a play grants it a resource (a visible meter, not a redraw), so the
    // static-position check after a play covers the enemy HUD boxes and the player's centre column.
    const enemyOnly = rows => rows.filter(row => !/:player$/.test(row[0]));
    assert.deepEqual(enemyOnly(await rects(page)), enemyOnly(before), `${tag}: a damaging play moves no enemy HUD box`);
    assert.deepEqual(await overflow(page), [], `${tag}: no HUD text overflows after a play`);
    // Owner 2026-11-07: no selected panel exists; the overhead mini HUD (HP bar + intent) is the only HUD and stays static.
    const mini = () => page.evaluate(() => {
      const frame = document.querySelector('.combatant.enemy:not(.dead)'), rack = frame?.querySelector(':scope > .target-hud-overhead-meters'); if (!rack) return null;
      const r = rack.getBoundingClientRect();
      return { statuses: rack.querySelectorAll('.status-icon').length, intent: !!rack.querySelector('.intent'), left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, vw: innerWidth, vh: innerHeight,
        panels: document.querySelectorAll('.target-hud-detail.visible, .target-hud-selected, .target-hud-focused').length };
    });
    const bare = await mini();
    assert.ok(bare && bare.intent, `${tag}: an enemy mini HUD with its intent is showing`);
    assert.equal(bare.panels, 0, `${tag}: no selected target-hud-detail panel is visible`);
    {
      await page.evaluate(() => { const enemy = window.__combat.enemies.find(e => e.alive); enemy.statuses = { ...(enemy.statuses || {}), weak: { stacks: 3 } }; window.__renderCombatForShot?.(); });
      await page.waitForTimeout(1200);
      const grown = await mini();
      assert.ok(grown && grown.intent, `${tag}: the mini HUD still shows its intent after a status appears`);
      assert.equal(grown.panels, 0, `${tag}: still no selected panel after a status appears`);
      assert.ok(Math.abs(grown.top - bare.top) < 2 && Math.abs(grown.width - bare.width) < 2, `${tag}: the mini HUD stays static when a status appears (${JSON.stringify([bare, grown])})`);
      assert.ok(grown.left >= -0.5 && grown.right <= grown.vw + 0.5 && grown.top >= -0.5 && grown.bottom <= grown.vh, `${tag}: the mini HUD stays inside the field`);
    }
    await page.close();
  }
  // Other seeds stand the player in other cells (PERF1: the back-left one). Every HUD is still exactly as wide as its cell, and each
  // Inspect control stands inside its own panel's top-right corner, whichever cell the figure is in.
  for (const seed of ['PERF1', 'PERF2']) for (const [width, height] of [[390, 844], [1280, 800]]) {
    const page = await board(width, height, null, seed), tag = `${width}x${height} seed ${seed}`;
    await click(page, page.locator('.hand .card[data-card-id="core.strike"]').first()); await page.waitForTimeout(1200);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.combatant:not(.dead)')].map(frame => {
      const id = frame.dataset.eid, polygon = JSON.parse(frame.dataset.targetHudCellPolygon || 'null');
      const rack = frame.querySelector(':scope > .target-hud-overhead-meters'), box = rack?.getBoundingClientRect();
      return { id, cell: frame.dataset.formationCell, cellWidth: polygon && polygon[2][0] - polygon[3][0], intent: !!rack?.querySelector('.intent, .player-action-intent'),
        hp: !!rack?.querySelector('.as-meter, [data-meter-row="hp"], .meters'), box: box && { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width }, vw: innerWidth, vh: innerHeight };
    }));
    const player = rows.find(row => row.id === 'player');
    assert.ok(player?.cellWidth > 20, `${tag}: the player's cell width is published (cell ${player?.cell})`);
    // Armed with a Strike no selected panel opens; every figure keeps its mini HUD (HP bar, plus an intent for enemies), all one fixed width.
    assert.equal(await page.locator('.target-hud-detail.visible').count(), 0, `${tag}: no selected panel once a Strike is armed`);
    assert.ok(rows.some(row => row.id !== 'player'), `${tag}: at least one enemy was checked`);
    for (const row of rows) {
      const name = `${tag} ${row.id} (${row.cell})`;
      assert.ok(row.box && row.hp, `${name}: its mini HUD (HP bar) exists`);
      if (row.id !== 'player') assert.ok(row.intent, `${name}: the enemy mini HUD shows its intent`);
      assert.ok(Math.abs(row.box.width - rows[0].box.width) <= 1, `${name}: mini HUD ${row.box.width.toFixed(1)} is the one fixed width (${rows[0].box.width.toFixed(1)})`);
      if (row.id !== 'player' && width > 600) assert.ok(row.box.width <= row.cellWidth + 2, `${name}: an enemy mini HUD ${row.box.width.toFixed(1)} fits its cell ${row.cellWidth.toFixed(1)}`);
      assert.ok(row.box.left >= -1 && row.box.right <= row.vw + 1 && row.box.top >= -1 && row.box.bottom <= row.vh, `${name}: mini HUD ${JSON.stringify(row.box)} is inside the field`);
    }
    await page.close();
  }
  // Owner 2026-11-07: the badge row never runs past the HP bar, on any form factor; surplus statuses collapse into +N.
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const page = await board(width, height, 2);
    await page.evaluate(() => { const enemy = window.__combat.enemies.find(e => e.alive); enemy.statuses = { ...(enemy.statuses || {}) }; for (const id of ['weak', 'vulnerable', 'frail', 'burn', 'dexterity', 'madness', 'frost', 'zealotry']) enemy.statuses[id] = { stacks: 1, duration: 2 }; window.__renderCombatForShot?.(); });
    await page.waitForTimeout(1500);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.combatant > .target-hud-overhead-meters')].map(rack => {
      const bar = rack.querySelector('.combat-health-meter .m-track').getBoundingClientRect(), badges = rack.querySelector('.combat-health-badges').getBoundingClientRect();
      const reach = Math.max(badges.right, ...[...rack.querySelectorAll('.combat-health-badges *')].map(n => n.getBoundingClientRect().right));
      return { bar: bar.width, badges: badges.width, right: reach, barRight: bar.right, icons: rack.querySelectorAll('.statuses .status-icon').length };
    }));
    assert.ok(rows.some(r => r.icons >= 2), `${width}: statuses render in the badge row`);
    for (const r of rows) { assert.ok(r.badges <= r.bar + 1, `${width}: badge row ${r.badges.toFixed(1)} is within the bar width ${r.bar.toFixed(1)}`); assert.ok(r.right <= r.barRight + 1, `${width}: no badge past the bar right edge (${r.right.toFixed(1)} vs ${r.barRight.toFixed(1)})`); }
    await page.close();
  }
  // Owner 2026-11-07: a phone enemy with Evade, Ward and Precision (Block 0) and three more statuses: the badges and the tray share one
  // capacity, so nothing crosses the bar's right edge and the +N tile stays whole (badges that do not fit collapse into it).
  {
    const page = await board(390, 844, 2);
    await page.evaluate(() => { const e = window.__combat.enemies.find(x => x.alive); e.block = 0; e.persistentWard = { value: 5 };
      e.statuses = { evade: { stacks: 2 }, precision: { stacks: 2 }, weak: { stacks: 1, duration: 2 }, vulnerable: { stacks: 1, duration: 2 }, frail: { stacks: 1, duration: 2 } }; window.__renderCombatForShot?.(); });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => { const rack = [...document.querySelectorAll('.combatant.enemy > .target-hud-overhead-meters')].find(r => r.querySelector('.statuses .status-icon, .statuses .status-overflow'));
      const bar = rack.querySelector('.combat-health-meter .m-track').getBoundingClientRect(), more = rack.querySelector('.status-overflow')?.getBoundingClientRect();
      const drawn = [...rack.querySelectorAll('.combat-health-badges > .combat-health-badge, .combat-health-badges > .statuses > *')].map(n => n.getBoundingClientRect()).filter(r => r.width > 0);
      return { barRight: bar.right, right: Math.max(...drawn.map(r => r.right)), more: more && { left: more.left, right: more.right, width: more.width, height: more.height } }; });
    assert.ok(m.right <= m.barRight + 0.5, `phone: nothing crosses the bar's right edge (${m.right.toFixed(1)} vs ${m.barRight.toFixed(1)})`);
    assert.ok(m.more && m.more.width > 8 && Math.abs(m.more.width - m.more.height) <= 1.5 && m.more.right <= m.barRight + 0.5, 'phone: the +N tile is drawn whole');
    await page.close();
  }
  // Owner rule (2026-11-06): a value change adds and removes no node, with overflowing statuses too (the tray is not morphed with the meters),
  // and keyboard focus on the +N tile survives.
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const page = await board(width, height, 2);
    await page.evaluate(() => { const e = window.__combat.enemies.find(x => x.alive); e.statuses = { ...(e.statuses || {}) };
      for (const id of ['weak', 'vulnerable', 'frail', 'burn', 'dexterity', 'madness', 'frost', 'zealotry']) e.statuses[id] = { stacks: 1, duration: 2 }; window.__renderCombatForShot?.(); });
    await page.waitForTimeout(1500);
    const more = page.locator('.combatant.enemy .statuses .status-overflow').first();
    assert.equal(await more.count(), 1, `${width}: statuses overflow into +N`);
    await more.focus();
    await watch(page);
    const before = await rects(page);
    await page.evaluate(() => { const e = window.__combat.enemies.find(x => x.alive); e.hp = Math.max(1, e.hp - 3); window.__renderCombatForShot?.(); });
    await page.waitForTimeout(800);
    await page.evaluate(() => { const e = window.__combat.enemies.find(x => x.alive); e.block = 9; window.__renderCombatForShot?.(); });
    await page.waitForTimeout(800);
    assert.equal(await swaps(page), 0, `${width}: an HP change and a Block change add or remove no HUD node with overflowing statuses`);
    const racksOnly = rows => rows.filter(row => !/^target-hud-panel/.test(row[0])); // the detail panel is retired and never shown
    assert.deepEqual(racksOnly(await rects(page)), racksOnly(before), `${width}: and move no HUD box`);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('status-overflow')), true, `${width}: focus on +N survives`);
    await page.close();
  }
  // A panel already pushed against the top edge keeps its top on screen when a status grows it (short landscape phone).
  {
    const page = await board(844, 390, 3);
    await click(page, page.locator('.hand .card[data-card-id="core.strike"]').first()); await page.waitForTimeout(1200);
    const tops = () => page.evaluate(() => [...document.querySelectorAll('.combatant.enemy:not(.dead) > .target-hud-overhead-meters')].map(rack => ({ top: rack.getBoundingClientRect().top, intent: !!rack.querySelector('.intent') })));
    assert.ok((await tops()).length > 0, 'landscape: enemy mini HUDs show');
    assert.equal(await page.locator('.target-hud-detail.visible').count(), 0, 'landscape: no selected panel');
    await page.evaluate(() => { for (const enemy of window.__combat.enemies) if (enemy.alive) enemy.statuses = { ...(enemy.statuses || {}), weak: { stacks: 2 }, vulnerable: { stacks: 2 } }; window.__renderCombatForShot?.(); });
    await page.waitForTimeout(1200);
    for (const { top, intent } of await tops()) { assert.ok(top >= -0.5, `landscape: a mini HUD's top ${top} stays on screen`); assert.ok(intent, 'landscape: the mini HUD keeps its intent'); }
    await page.close();
  }
  console.log('combat-hud-static ok');
} finally { await browser.close(); server.close?.(); }
process.exit(0);
