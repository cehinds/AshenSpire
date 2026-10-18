// PLAYWRIGHT_MODULE=/path/to/playwright node tests/settings-choice-persistence.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${server.url}index.html?shot=settings`);
  await page.locator('[data-settings-host]').waitFor();
  // Use the actual Settings renderer with a deferred persistence seam so the
  // readout cannot pass merely because storage happened to settle quickly.
  await page.evaluate(async () => {
    const { renderSettings } = await import('./src/ui/screens/settings.js');
    document.body.replaceChildren();
    const host = document.createElement('div');
    host.id = 'choice-probe'; document.body.append(host);
    const settings = { settingsCategory: 'General', settingsGeneralCategory: 'Display', viewPreset: 'desktop', uiScale: 'Auto' };
    document.documentElement.style.setProperty('--ui-zoom', '1.20');
    window.__choiceProbe = { host, settings };
    renderSettings(host, { settings, onChange: () => new Promise(resolve => {
      window.__choiceProbe.settle = (result, zoom) => {
        if (zoom) document.documentElement.style.setProperty('--ui-zoom', zoom);
        resolve(result);
      };
    }) });
  });
  const dropdown = page.locator('.set-choice-select[data-key="viewPreset"]');
  const readout = page.locator('[data-applied="uiScale"]');
  assert.match(await readout.innerText(), /Showing 1\.20×/);
  await dropdown.selectOption('mobile');
  assert.equal(await dropdown.isDisabled(), true);
  assert.match(await readout.innerText(), /Showing 1\.20×/, 'pending persistence has not applied a new zoom');
  await page.evaluate(() => window.__choiceProbe.settle({ ok: true }, '0.90'));
  await page.waitForFunction(() => document.querySelector('[data-applied="uiScale"]').textContent.includes('Showing 0.90×'));
  assert.equal(await dropdown.isEnabled(), true);

  await dropdown.selectOption('desktop');
  await page.evaluate(() => window.__choiceProbe.settle({ ok: false }));
  await page.waitForFunction(() => !document.querySelector('select[data-key="viewPreset"]').disabled);
  assert.equal(await dropdown.inputValue(), 'mobile', 'a refused save restores the previous selection');
  assert.equal(await page.evaluate(() => window.__choiceProbe.settings.viewPreset), 'mobile');
  assert.match(await readout.innerText(), /Showing 0\.90×/);

  await page.locator('.choice[data-key="quickNav"][data-val="switcher"]').click();
  await page.evaluate(() => window.__choiceProbe.settle({ ok: true }, '1.05'));
  await page.waitForFunction(() => document.querySelector('[data-applied="uiScale"]').textContent.includes('Showing 1.05×'));
  assert.equal(await page.locator('.choice[data-key="quickNav"][data-val="switcher"]').getAttribute('aria-pressed'), 'true');

  await dropdown.selectOption('desktop');
  const beforeClose = await readout.textContent();
  await page.evaluate(() => {
    const probe = window.__choiceProbe;
    probe.oldReadout = probe.host.querySelector('[data-applied="uiScale"]');
    probe.host.replaceChildren();
    probe.settle({ ok: true }, '1.20');
  });
  await page.waitForTimeout(0);
  assert.equal(await page.locator('#choice-probe > *').count(), 0, 'settlement does not revive the closed pane');
  assert.equal(await page.evaluate(() => window.__choiceProbe.oldReadout.textContent), beforeClose, 'detached controls are not refreshed');
  assert.deepEqual(errors, []);
  console.log('settings-choice-persistence browser: PASS; dropdown and chip readouts, refused save, closed pane');
} finally {
  await browser.close(); server.server.close();
}
