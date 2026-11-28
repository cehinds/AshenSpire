// PLAYWRIGHT_MODULE=/path/to/playwright BASE_URL=http://localhost:4470/index.html node tests/mobile-centered-formation.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { TOOLS_ON_PROFILE } from './helpers/combat-tools-on.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
// The grid starts off (owner, 2026-11-19); this test counts cells, so it turns the grid on.
const GRID_ON = encodeURIComponent(JSON.stringify({ 'gameConfig.presentation.showFormationGrid': true }));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' });
  await page.goto(`${process.env.BASE_URL || 'http://localhost:4470/index.html'}?shot=combat&gameProfile=${TOOLS_ON_PROFILE}&shotSeed=3&shotEnemyCount=3&shotSettings=${GRID_ON}`);
  await page.locator('.end-turn').waitFor();
  await page.locator('#combat-menu').click();
  if (!await page.locator('[data-settings-host]').count()) await page.locator('.qn-row[data-tab="settings"]').click();
  await page.locator('[data-general-select]').selectOption('Display');
  await page.locator('select[data-key="viewPreset"]').selectOption('mobile');
  await page.waitForFunction(() => document.documentElement.dataset.formFactor === 'mobile');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  // Observe settled placement rather than assigning coordinates or simulation state.
  await page.waitForFunction(() => {
    const root = document.querySelector('.combat').getBoundingClientRect();
    return [...document.querySelectorAll('.combatant .sprite')].every(node => {
      const box = node.getBoundingClientRect();
      return box.left >= root.left - 1 && box.right <= root.right + 1;
    });
  });
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('.combat').getBoundingClientRect();
    return { left: root.left, right: root.right,
      actors: [...document.querySelectorAll('.combatant .sprite')].map(node => node.getBoundingClientRect().toJSON()),
      cells: [...document.querySelectorAll('.formation-grid-cell')].filter(node => node.getClientRects().length).map(node => node.getBoundingClientRect().toJSON()) };
  });
  assert(geometry.left > 100, 'Mobile preset actually centres a narrower battlefield');
  assert.equal(geometry.actors.length, 4);
  assert(geometry.cells.length >= 12);
  for (const box of [...geometry.actors, ...geometry.cells]) {
    assert(box.left >= geometry.left - 1 && box.right <= geometry.right + 1, 'field-local geometry stays in the centred combat root');
  }
  console.log('PASS real Settings Mobile landscape preset keeps actors and grid in centred battlefield');
} finally { await browser.close(); }
