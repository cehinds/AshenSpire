// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/combat-player-hud-right.browser.mjs
// Owner 2026-11-06: "keep it fixed right of player". At 390x844 the player's target-HUD panel (name, HP, AC) stands directly right of
// the figure (left edge at or past the figure's art right edge, a few px of slack) and level with its upper body
// (vertical centre inside the top 60% of the figure), and a card select leaves it exactly where it was.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await p.goto(`${server.url}index.html?shot=combat&shotSeed=PERF1`, { waitUntil: 'load' });
  await p.waitForSelector('.combatant.player .sprite');
  await p.waitForTimeout(2500);
  const read = () => p.evaluate(() => {
    const hud = document.querySelector('.target-hud-detail[data-role="player"] .target-hud-panel').getBoundingClientRect();
    const sprite = document.querySelector('.combatant.player .sprite').getBoundingClientRect();
    return { hud: { left: hud.left, top: hud.top, bottom: hud.bottom }, sprite: { left: sprite.left, right: sprite.right, top: sprite.top, bottom: sprite.bottom },
      art: Number(document.querySelector('.combatant.player').dataset.spriteArtTop) };
  });
  const m = await read();
  const centre = (m.hud.top + m.hud.bottom) / 2;
  assert.ok(m.hud.left >= m.sprite.right - 6, `HUD left ${m.hud.left.toFixed(1)} is right of the sprite's right edge ${m.sprite.right.toFixed(1)}`);
  assert.ok(centre >= m.sprite.top && centre <= m.sprite.top + 0.6 * (m.sprite.bottom - m.sprite.top), `HUD centre ${centre.toFixed(1)} is in the sprite's top 60% (${m.sprite.top.toFixed(1)}..${m.sprite.bottom.toFixed(1)})`);
  await p.click('.hand .card');
  await p.waitForTimeout(600);
  const after = await read();
  assert.deepEqual(after.hud, m.hud, 'a card select does not move the HUD');
  console.log('combat-player-hud-right ok');
} finally { await b.close(); server.close?.(); }
process.exit(0);
