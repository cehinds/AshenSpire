// Real pointer inputs through overlapping HUD padding, at desktop and phone sizes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = resolve(process.env.QA_OUT || 'scratch/qa/combat-hud-hitbox');
mkdirSync(out, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true, host: '127.0.0.1' });
const browser = await chromium.launch(), results = [];
async function hold(page, point, touch) {
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, radiusX: 1, radiusY: 1 }] });
      await page.waitForTimeout(800);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
  } else {
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
  }
}
try {
  for (const [width, height] of [[1280, 800], [390, 844], [1920, 1080], [768, 1024]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 900, reducedMotion: 'reduce' });
    await page.goto(`${server.url}index.html?shot=combat&gameProfile=core&shotSeed=4&shotEnemies=wanderingSoldier,wyrmAspirant,fellWarden&shotHand=5`);
    await page.waitForFunction(() => !!window.__combat);
    await page.waitForTimeout(1600);
    const point = await page.evaluate(() => {
      const enemy = document.querySelector('.combatant[data-eid="e2"] .sprite').getBoundingClientRect();
      const row = document.querySelector('.combatant.player > .target-hud-overhead-meters .combat-health-row');
      const gap = row.getBoundingClientRect();
      const painted = [...row.querySelectorAll('.m-track,.m-value,.combat-health-badge')].map(n => n.getBoundingClientRect());
      const x = enemy.x + enemy.width / 2;
      const candidates = [];
      for (let y = Math.max(gap.top, enemy.top) + 1; y < Math.min(gap.bottom, enemy.bottom) - 1; y++) {
        if (x > gap.left && x < gap.right && !painted.some(r => r.width && r.height && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) candidates.push({ x, y });
      }
      return candidates[Math.floor(candidates.length / 2)] || null;
    });
    assert.ok(point, `${width}: fixture has transparent player HUD padding over the enemy`);
    const hit = await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.closest('.combatant')?.dataset.eid, point);
    await page.screenshot({ path: `${out}/${width}-combat.png` });
    assert.equal(hit, 'e2', `${width}: transparent player HUD padding must not steal the enemy's body`);
    await hold(page, point, width < 900);
    const door = page.locator('.combatant-door'); await door.waitFor();
    assert.match(await door.innerText(), /Wyrm Aspirant/);
    await page.screenshot({ path: `${out}/${width}-enemy-inspector.png` });
    await door.getByRole('button', { name: 'Close', exact: true }).click();
    await door.waitFor({ state: 'detached' });
    // The painted HP track remains a real player control, even while its gaps pass through.
    const track = page.locator('.combatant.player > .target-hud-overhead-meters .combat-health-meter .m-track');
    const bar = await track.boundingBox();
    const playerHit = await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.closest('.combatant')?.dataset.eid,
      { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 });
    assert.equal(playerHit, 'player', `${width}: the player's visible HP track remains interactive`);
    await hold(page, { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 }, width < 900);
    await door.waitFor(); assert.match(await door.innerText(), /FORSAKEN/);
    await door.getByRole('button', { name: 'Close', exact: true }).click();
    await door.waitFor({ state: 'detached' });
    const strike = page.locator('.hand .card[data-card-id="core.strike"]').first();
    if (width < 900) await strike.tap(); else await strike.click();
    await page.waitForTimeout(400);
    if (width < 900) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.__combat.eventLog.some(e => e.type === 'cardResolved' && e.cardId === 'core.strike' && e.targetId === 'e2'));
    results.push({ width, height, input: width < 900 ? 'touch' : 'mouse', enemyBody: hit, playerTrack: playerHit, inspections: 'PASS', attackTarget: 'e2' });
    await page.close();
  }
  console.log(`PASS: ${results.length} viewports preserve enemy and player pointer ownership`);
} finally {
  writeFileSync(`${out}/checks.json`, JSON.stringify(results, null, 2));
  await browser.close(); server.server.close();
}
