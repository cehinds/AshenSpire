import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_URL || 'http://127.0.0.1:8381';
const out = resolve(process.env.QA_OUTPUT || 'docs/preview/armament-kits'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], checks = [];
const check = (ok, name) => { assert.ok(ok, name); checks.push(name); };
try {
  for (const [name, width, height] of [['desktop',1440,1000],['tablet',1024,1000],['phone',390,844]]) {
    const page = await browser.newPage({ viewport: { width, height } }); page.setDefaultTimeout(8000);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/armament-kits-preview.html`);
    await page.locator('#kits .card').first().waitFor();
    check(await page.locator('#kits .card').count() === 6, `${name}: both full kits visible`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: no horizontal overflow`);
    await page.screenshot({ path: join(out, `${name}-sword-and-shield.png`) });
    if (name === 'desktop') {
      const ids = await page.locator('#left option').evaluateAll(es => es.map(e => e.value).filter(Boolean));
      check(ids.length === 25, 'all 25 armaments offered');
      for (const id of ids) {
        await page.selectOption('#right', ''); await page.selectOption('#left', id);
        await page.locator('#controls button').click();
        check(await page.locator(`.kit[data-item="${id}"] .card`).count() === 3, `${id}: Strike Guard and Art review`);
        if (['roundShield','buckler','kiteShield','towerShield','spikedShield','starstoneStaff'].includes(id)) await page.screenshot({ path: join(out, `${id}-kit.png`) });
      }
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/index.html?shot=combat&shotKit=1&shotClass=rogue&shotMainHand=straightSword&shotOffHand=kiteShield`);
  await page.locator('.hand .card').first().waitFor();
  check(await page.locator('.hand .card').count() === 6, 'actual combat opens with six kit cards');
  check(await page.locator('.hand').innerText().then(s => s.includes('Shield Strike')), 'shield Strike reaches the real hand');
  await page.screenshot({ path: join(out, 'combat-six-card-kit.png') });
  async function hold(id) {
    await page.mouse.move(0,0); await page.waitForTimeout(600);
    const box = await page.locator(`.hand .card[data-card-id="${id}"]`).boundingBox(); assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(2000); await page.mouse.up();
    await page.mouse.move(0,0); await page.waitForTimeout(1800);
  }
  await hold('shieldGuardian');
  check(await page.locator('.hand .card[data-card-id=guardianBulwark]').count() === 1, 'Guardian generates Bulwark through real input');
  await page.screenshot({ path: join(out, 'guardian-generates-bulwark.png') });
  await hold('guardianBulwark');
  await page.locator('.stance-chip.bulwark').waitFor({ timeout: 30000 }).catch(async error => {
    await page.screenshot({ path: join(out, 'stance-check-failure.png') });
    console.error(await page.locator('body').innerText()); throw error;
  });
  check(await page.locator('.hand .card[data-card-id=guardianBulwark]').count() === 0, 'generated Bulwark leaves hand after play');
  check(await page.locator('.stance-chip.bulwark').isVisible(), 'Rogue can enter Bulwark stance');
  await page.screenshot({ path: join(out, 'rogue-bulwark-stance.png') });
  await page.close();
  check(errors.length === 0, `no browser errors: ${errors.join('; ')}`);
  console.log(`PASS ${checks.length} armament browser checks`);
} finally {
  writeFileSync(join(out, 'qa-results.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
