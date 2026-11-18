// Run with PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/usr/bin/chromium.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { server, url } = await serve({ port: 0, open: false, quiet: true, host: 'localhost' });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${url}index.html?shot=customize&gameProfile=core`);
    await page.locator('#cz-next').click();
    await page.getByRole('button', { name: 'Starting cards', exact: true }).click();

    const strike = page.locator('.starting-cards-row[data-card="core.strike"]');
    const increase = strike.getByRole('button', { name: 'Add a Strike', exact: true });
    const decrease = strike.getByRole('button', { name: 'Remove a Strike', exact: true });
    const copies = strike.locator('.starting-cards-count');
    const focused = (control) => control.evaluate((element) => element === document.activeElement);
    const initial = Number(await copies.textContent());

    await increase.focus();
    await page.keyboard.press('Space');
    assert.equal(await focused(increase), true, 'increasing keeps keyboard focus on the same stepper');
    await page.keyboard.press('Space');
    assert.equal(Number(await copies.textContent()), initial + 2, 'repeated keyboard activation adds copies');

    await decrease.focus();
    for (let remaining = initial + 1; remaining >= 0; remaining -= 1) {
      await page.keyboard.press('Space');
      assert.equal(Number(await copies.textContent()), remaining, 'repeated keyboard activation removes copies');
      assert.equal(await focused(remaining ? decrease : increase), true, 'focus stays on an enabled stepper');
    }
    assert.equal(await decrease.isDisabled(), true, 'no copy can be removed at zero');
    await page.keyboard.press('Space');
    assert.equal(Number(await copies.textContent()), 1, 'the keyboard can add a copy from zero');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('starting-cards-focus browser: ok');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
