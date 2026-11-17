// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/partial-updates-settings.browser.mjs
//
// Settings updates the part that changed (CLEAN-CODE-PROMPT §3). A topic tab draws only its own
// panel and empties the one it leaves; a one-key Reset swaps only the row it changed. Each check
// holds the nodes that must survive, proves they are the same objects, and compares the result
// with what a full render of the same settings draws.
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
  await page.evaluate(async () => {
    const { renderSettings } = await import('./src/ui/screens/settings.js');
    document.body.replaceChildren();
    const host = document.createElement('div');
    host.id = 'partial-probe';
    document.body.append(host);
    const settings = { settingsCategory: 'Advanced' };
    const render = () => renderSettings(host, { settings, onChange: () => ({ ok: true }) });
    window.__probe = { host, settings, render };
    render();
    // Open the first Advanced section that has more than one topic.
    for (const subtab of host.querySelectorAll('.set-subtab')) {
      subtab.click();
      if (host.querySelectorAll('.set-advanced-group:not([hidden]) [data-topic]').length > 1) break;
    }
  });

  // ---- a topic tab -----------------------------------------------------------
  const topic = await page.evaluate(() => {
    const { host } = window.__probe;
    const section = host.querySelector('.set-advanced-group:not([hidden])');
    const tabs = [...section.querySelectorAll('[data-topic]')];
    const leaving = section.querySelector('.set-topic-panel:not([hidden])');
    const target = tabs.find(tab => tab.getAttribute('aria-selected') !== 'true');
    const kept = { pane: host.querySelector('.set-panel'), section, tabs, leaving, rail: host.querySelector('.set-tabs') };
    target.click();
    const entering = section.querySelector(`.set-topic-panel[data-topic-panel="${CSS.escape(target.dataset.topic)}"]`);
    return {
      sameNodes: host.querySelector('.set-panel') === kept.pane && host.querySelector('.set-advanced-group:not([hidden])') === kept.section
        && host.querySelector('.set-tabs') === kept.rail && [...section.querySelectorAll('[data-topic]')].every((tab, index) => tab === kept.tabs[index]),
      leavingEmptied: kept.leaving.hidden && kept.leaving.hasAttribute('data-lazy') && kept.leaving.childElementCount === 0,
      enteringDrawn: !entering.hidden && !entering.hasAttribute('data-lazy') && entering.querySelectorAll('.set-row').length > 0,
      selected: target.getAttribute('aria-selected') === 'true' && target.classList.contains('on'),
      // In the selector layout the tabs are hidden behind the topic picker and cannot take focus.
      focused: target.offsetParent === null || document.activeElement === target,
      partial: section.outerHTML,
    };
  });
  assert.ok(topic.sameNodes, 'the pane, the section, the rail and every topic tab are the same nodes');
  assert.ok(topic.leavingEmptied, 'the panel left behind is a lazy shell again');
  assert.ok(topic.enteringDrawn, 'the chosen panel is drawn');
  assert.ok(topic.selected, 'the tab is marked selected');
  assert.ok(topic.focused, 'focus stays on the tab');
  const topicFull = await page.evaluate(() => {
    window.__probe.render();
    return window.__probe.host.querySelector('.set-advanced-group:not([hidden])').outerHTML;
  });
  assert.equal(topic.partial, topicFull, 'the same DOM a full render draws');

  // ---- a one-key Reset -------------------------------------------------------
  const reset = await page.evaluate(async () => {
    const { host } = window.__probe;
    // The first control in the open topic that moves a setting off its default: a switch, a choice not yet chosen, or a number.
    const toggle = host.querySelector('.set-advanced-group:not([hidden]) .set-topic-panel:not([hidden]) .set-row :is(.toggle[data-key], .choice[data-key][aria-pressed="false"], .set-num[data-key]):not(:disabled)');
    if (!toggle) return { skipped: true };
    const key = toggle.dataset.key;
    if (toggle.matches('.set-num')) { toggle.value = String(Number(toggle.value) + 1); toggle.dispatchEvent(new Event('change')); } else toggle.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    const row = host.querySelector(`[data-row-key="${CSS.escape(key)}"]`);
    const others = [...host.querySelectorAll('.set-row')].filter(other => other !== row);
    const kept = { pane: host.querySelector('.set-panel'), section: host.querySelector('.set-advanced-group:not([hidden])'), others };
    const wasModified = row.dataset.modified === 'true';
    row.querySelector('[data-reset-key]').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    const fresh = host.querySelector(`[data-row-key="${CSS.escape(key)}"]`);
    return {
      key,
      wasModified,
      replaced: fresh !== row && fresh.isConnected,
      clean: fresh.dataset.modified !== 'true',
      sameNodes: host.querySelector('.set-panel') === kept.pane && host.querySelector('.set-advanced-group:not([hidden])') === kept.section
        && kept.others.every(other => other.isConnected),
      focused: fresh.contains(document.activeElement),
      partial: host.querySelector('.set-advanced-group:not([hidden])').outerHTML,
    };
  });
  assert.ok(!reset.skipped, 'the open topic has a toggle to reset');
  assert.ok(reset.wasModified, `${reset.key} was changed first`);
  assert.ok(reset.replaced, 'the reset row was redrawn');
  assert.ok(reset.clean, 'and reads the default again');
  assert.ok(reset.sameNodes, 'the pane, the section and every other row are the same nodes');
  assert.ok(reset.focused, 'focus is on the reset row\'s control');
  const resetFull = await page.evaluate(() => {
    window.__probe.render();
    return window.__probe.host.querySelector('.set-advanced-group:not([hidden])').outerHTML;
  });
  assert.equal(reset.partial, resetFull, 'the same DOM a full render draws');
  assert.deepEqual(errors, []);
  console.log('partial-updates-settings browser: PASS; topic tab draws one panel, one-key Reset swaps one row');
} finally {
  await browser.close();
  server.server.close();
}
