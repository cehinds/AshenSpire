// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/combat-feet-in-cell.browser.mjs
// Owner 2026-11-06: every combatant's feet (its shadow's centre, the sprite's bottom) stand INSIDE the drawn formation
// cell, about footInCellFraction of the cell's height above its bottom line, never on a line.
// Owner 2026-11-20: the cards' top rule wins for a lone player: its feet stand at the resting hand cards' top (within
// 2 px), never inside the cards, and it is exempt from the cell checks (the cards' top, not its cell, places it). A back-row enemy's lift and
// shrink are part of the layout, so its drawn feet stand in its cell too, and it is drawn backRowEnemyScale of the size
// the same enemy has in the front row (a three-enemy shot whose enemies start in the back row; the row is flipped live).
// Its HUD plates shrink with it, so on a phone neighbouring back-row plates never overlap.
// A ?shot=combat boot, real layout, the visible .formation-grid-cell rectangles.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
import { uiConfig } from '../src/config/generated/ui.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
// The grid starts off (owner, 2026-11-19); this test measures cells, so it turns the grid on.
const GRID_ON = encodeURIComponent(JSON.stringify({ 'gameConfig.presentation.showFormationGrid': true }));
const { footInCellFraction: fraction, backRowEnemyScale } = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
const SCENES = [{ name: 'one enemy', query: '' }, { name: 'back row', query: '&shotEnemyCount=3', backRow: true }];
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  for (const scene of SCENES) for (const [w, h] of [[390, 844], [360, 800], [1280, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await p.goto(`${server.url}index.html?shot=combat&shotSeed=PERF1${scene.query}&shotSettings=${GRID_ON}`, { waitUntil: 'load' });
    await p.waitForSelector('.combatant .sprite');
    await p.waitForTimeout(2500);
    const m = await p.evaluate(() => ({
      // The resting cards' top, as the stage reads it: the hand strip's top plus its published --hand-rest-top.
      cardsTop: (() => { const hand = document.querySelector('.hand'), r = hand?.getBoundingClientRect(), rest = parseFloat(hand?.style.getPropertyValue('--hand-rest-top'));
        return r && Number.isFinite(rest) ? r.top + rest * (r.height / (hand.clientHeight || r.height || 1)) : NaN; })(),
      cardTop: Math.min(...[...document.querySelectorAll('.hand .card')].map(c => c.getBoundingClientRect().top)),
      cells: [...document.querySelectorAll('.formation-grid-cell:not([hidden])')].map(t => {
        const r = t.getBoundingClientRect(); return { cell: t.dataset.cell, side: t.dataset.side, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }),
      figures: [...document.querySelectorAll('.combatant')].map(f => {
        const r = f.querySelector('.sprite').getBoundingClientRect(), rack = f.querySelector(':scope > .target-hud-overhead-meters')?.getBoundingClientRect();
        return { plates: rack && rack.width > 0 ? { left: rack.left, right: rack.right, height: rack.height } : null, side: f.classList.contains('enemy') ? 'enemy' : 'player', foot: r.bottom, x: r.left + r.width / 2, height: r.height,
          cell: f.dataset.formationCell, row: f.dataset.bandRow };
      }),
    }));
    assert.ok(m.figures.length >= 2, `${w}x${h} ${scene.name}: the shot has a player and an enemy`);
    if (scene.backRow) assert.ok(m.figures.some(f => f.side === 'enemy' && f.row === 'back'), `${w}x${h} ${scene.name}: the shot has a back-row enemy`);
    const lonePlayer = m.figures.filter(f => f.side === 'player').length === 1;
    for (const fig of m.figures) {
      const at = `${w}x${h} ${scene.name} ${fig.side}${fig.row ? ` (${fig.row} row)` : ''}`;
      // The cards' top places a lone player's feet, not its cell (on a 360px phone they stand a pixel above it).
      if (lonePlayer && fig.side === 'player') {
        assert.ok(Number.isFinite(m.cardsTop), `${at}: the hand publishes its resting cards' top`);
        assert.ok(Math.abs(fig.foot - m.cardsTop) <= 2, `${at}: lone player's feet ${fig.foot.toFixed(1)} are not at the cards' top ${m.cardsTop.toFixed(1)}`);
        assert.ok(fig.foot <= m.cardTop + 1, `${at}: lone player's feet ${fig.foot.toFixed(1)} stand inside the hand cards (top ${m.cardTop.toFixed(1)})`);
        continue;
      }
      // The figure's own drawn cell, or (no cell named) the one holding the foot: same side, foot between its lines, x near its sheared span.
      const cell = fig.cell ? m.cells.find(c => c.cell === fig.cell && fig.foot > c.top && fig.foot < c.bottom)
        : m.cells.find(c => c.side === fig.side && fig.foot > c.top && fig.foot < c.bottom && fig.x > c.left - 40 && fig.x < c.right + 40);
      assert.ok(cell, `${at}: foot y ${fig.foot.toFixed(1)} is inside no drawn cell (cells ${m.cells.filter(c => c.side === fig.side).map(c => `${c.cell} ${c.top.toFixed(1)}..${c.bottom.toFixed(1)}`)})`);
      const height = cell.bottom - cell.top, above = (cell.bottom - fig.foot) / height;
      assert.ok(fig.foot - cell.top >= Math.min(1, height / 4) && cell.bottom - fig.foot >= Math.min(1, height / 4), `${at}: foot ${fig.foot.toFixed(1)} touches a line of cell ${cell.cell} ${cell.top.toFixed(1)}..${cell.bottom.toFixed(1)}`);
      if (height >= 20) assert.ok(Math.abs(above - fraction) <= 0.05, `${at}: foot stands ${(above * 100).toFixed(0)}% above cell ${cell.cell}'s bottom, expected ${fraction * 100}%`);
    }
    if (scene.backRow && w < 600) {
      const plates = m.figures.filter(f => f.side === 'enemy' && f.row === 'back' && f.plates).map(f => f.plates).sort((a, b) => a.left - b.left);
      assert.ok(plates.length >= 2, `${w}x${h} ${scene.name}: the back-row enemies show their plates`);
      for (let i = 1; i < plates.length; i++) assert.ok(plates[i].left >= plates[i - 1].right,
        `${w}x${h} ${scene.name}: back-row plates overlap (${plates[i - 1].right.toFixed(1)} > ${plates[i].left.toFixed(1)})`);
    }
    if (scene.backRow) {
      // The same enemies moved to the front row refit once (the stage observes data-band-row): back / front = backRowEnemyScale.
      await p.evaluate(() => { for (const f of document.querySelectorAll('.combatant.enemy[data-band-row="back"]')) f.dataset.bandRow = 'front'; });
      await p.waitForTimeout(1500);
      const front = await p.evaluate(() => [...document.querySelectorAll('.combatant')].map(f => ({ height: f.querySelector('.sprite').getBoundingClientRect().height,
        plates: f.querySelector(':scope > .target-hud-overhead-meters')?.getBoundingClientRect().height })));
      m.figures.forEach((fig, i) => {
        if (fig.row !== 'back') return;
        const ratio = fig.height / front[i].height;
        assert.ok(Math.abs(ratio - backRowEnemyScale) <= 0.01, `${w}x${h} ${scene.name}: a back-row enemy is drawn ${ratio.toFixed(3)} of its front-row size, expected ${backRowEnemyScale}`);
        const plateRatio = fig.plates?.height / front[i].plates;
        assert.ok(Math.abs(plateRatio - backRowEnemyScale) <= 0.01, `${w}x${h} ${scene.name}: a back-row enemy's plates are ${plateRatio.toFixed(3)} of their front-row height, expected ${backRowEnemyScale}`);
      });
    }
    await p.close();
  }
  console.log('combat-feet-in-cell ok');
} finally { await b.close(); server.close?.(); }
process.exit(0);
