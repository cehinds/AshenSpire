// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/combat-feet-in-cell.browser.mjs
// Owner 2026-11-06: every combatant's feet (its shadow's centre, the sprite's bottom) stand INSIDE the drawn formation
// cell, about footInCellFraction of the cell's height above its bottom line, never on a line, and the player's feet
// never stand inside the hand. A ?shot=combat boot, real layout, the visible .formation-grid-cell rectangles.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
import { uiConfig } from '../src/config/generated/ui.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fraction = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.footInCellFraction;
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  for (const [w, h] of [[390, 844], [360, 800], [844, 390], [1280, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await p.goto(`${server.url}index.html?shot=combat&shotSeed=PERF1`, { waitUntil: 'load' });
    await p.waitForSelector('.combatant .sprite');
    await p.waitForTimeout(2500);
    const m = await p.evaluate(() => ({
      handTop: document.querySelector('.hand')?.getBoundingClientRect().top ?? Infinity,
      cells: [...document.querySelectorAll('.formation-grid-cell:not([hidden])')].map(t => {
        const r = t.getBoundingClientRect(); return { cell: t.dataset.cell, side: t.dataset.side, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }),
      figures: [...document.querySelectorAll('.combatant')].map(f => {
        const r = f.querySelector('.sprite').getBoundingClientRect();
        return { side: f.classList.contains('enemy') ? 'enemy' : 'player', foot: r.bottom, x: r.left + r.width / 2 };
      }),
    }));
    assert.ok(m.figures.length >= 2, `${w}x${h}: the shot has a player and an enemy`);
    for (const fig of m.figures) {
      const at = `${w}x${h} ${fig.side}`;
      // The drawn cell holding the foot: same side, foot between its top and bottom lines, x within its sheared span.
      const cell = m.cells.find(c => c.side === fig.side && fig.foot > c.top && fig.foot < c.bottom && fig.x > c.left - 40 && fig.x < c.right + 40);
      assert.ok(cell, `${at}: foot y ${fig.foot.toFixed(1)} is inside no drawn cell (cells ${m.cells.filter(c => c.side === fig.side).map(c => `${c.cell} ${c.top.toFixed(1)}..${c.bottom.toFixed(1)}`)})`);
      const height = cell.bottom - cell.top, above = (cell.bottom - fig.foot) / height;
      assert.ok(fig.foot - cell.top >= Math.min(1, height / 4) && cell.bottom - fig.foot >= Math.min(1, height / 4), `${at}: foot ${fig.foot.toFixed(1)} touches a line of cell ${cell.cell} ${cell.top.toFixed(1)}..${cell.bottom.toFixed(1)}`);
      // A landscape phone's strip is under 10px: only "inside, not on a line" can hold there.
      if (height >= 20) assert.ok(Math.abs(above - fraction) <= 0.05, `${at}: foot stands ${(above * 100).toFixed(0)}% above cell ${cell.cell}'s bottom, expected ${fraction * 100}%`);
      if (fig.side === 'player') assert.ok(fig.foot <= m.handTop + 1, `${at}: feet ${fig.foot.toFixed(1)} stand inside the hand (top ${m.handTop.toFixed(1)})`);
    }
    await p.close();
  }
  console.log('combat-feet-in-cell ok');
} finally { await b.close(); server.close?.(); }
process.exit(0);
