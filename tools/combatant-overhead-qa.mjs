import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.COMBAT_QA_URL || 'http://localhost:8337/';
const out = resolve(process.env.COMBAT_QA_OUT || 'outputs/combatant-overhead');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  for (const [width, height] of [[1440,900],[390,844],[320,640],[844,390]].filter(([w]) => !process.env.QA_WIDTH || w === Number(process.env.QA_WIDTH))) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}?shot=combat`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__renderCombatForShot);
    await page.waitForTimeout(1800);
    assert(await page.locator('.overhead-control').evaluateAll(es => es.every(e => {
      const r=e.getBoundingClientRect();
      return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    })), 'every overhead control has an unobstructed press target');
    const info = page.locator('.enemy .combatant-info').first();
    const intent = page.locator('.enemy .intent').first();
    const isOpen = () => page.locator('#tooltip').evaluateAll(es => es.some(e => e.dataset.open === 'true'));
    await page.evaluate(async () => (await import('./src/ui/components/tooltip.js')).configureTooltipSettings({ tooltipDelay: '1s' }));
    await info.tap();
    assert(await info.evaluate(e => e.classList.contains('tooltip-selected')), 'tap must select immediately');
    assert.equal(await isOpen(), false, 'tap must wait');
    await page.waitForTimeout(250);
    assert.equal(await isOpen(), false, 'configured delay must be honored');
    await page.waitForTimeout(900);
    assert.equal(await isOpen(), true, 'selected touch control opens after delay');
    await info.tap();
    await page.locator('.combatant-door').waitFor();
    await page.keyboard.press('Escape');
    await page.mouse.move(0, height - 1);
    await page.evaluate(async () => (await import('./src/ui/components/tooltip.js')).hideTooltip());
    await intent.hover();
    assert(await intent.evaluate(e => e.classList.contains('tooltip-selected')), 'hover selects');
    await page.waitForTimeout(150);
    assert.equal(await isOpen(), false);
    await info.hover();
    assert.equal(await intent.evaluate(e => e.classList.contains('tooltip-selected')), false);
    await page.waitForTimeout(150);
    await page.mouse.move(0, height - 1);
    await page.waitForTimeout(1050);
    assert.equal(await isOpen(), false, 'leaving cancels pending tooltip');
    await intent.focus();
    await intent.dispatchEvent('gpfocus');
    await page.waitForTimeout(1100);
    assert.equal(await isOpen(), true, 'focus delay');
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(), false);
    await page.mouse.move(0, height - 1);
    await page.screenshot({ path: resolve(out, `combat-${width}.png`) });
    // Info must remain a reading action while a combat card is armed.
    await page.evaluate(() => window.__renderCombatForShot());
    const card = page.locator('.hand .card').first();
    await card.focus();
    await card.locator('.card-info-button').click();
    await page.getByRole('button', { name: 'Play card', exact: true }).click();
    assert(await page.locator('.enemy.targetable').count(), 'card is armed for a target');
    const before = await page.evaluate(() => JSON.stringify(window.__combat.piles));
    await info.click();
    await page.locator('.combatant-door').waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify(window.__combat.piles)), before);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.mouse.move(0, height - 1);
    const rows = await page.locator('.combatant').evaluateAll(es => es.map(e => {
      const b=e.querySelector('.combatant-leading').getBoundingClientRect();
      const s=e.querySelector('.sprite').getBoundingClientRect();
      const m=e.querySelector('.meters').getBoundingClientRect();
      return { top:b.top, bottom:b.bottom, spriteTop:s.bottom-Number(e.dataset.spriteVisibleHeight), feet:s.bottom, hp:m.top, row:e.dataset.formationRow };
    }));
    for (const row of rows) {
      assert(row.top >= 0, 'overhead stays onscreen');
      assert(Math.abs(row.spriteTop-row.bottom-6)<2, 'overhead follows visible idle top');
      const peer=rows.find(r=>r.row===row.row);
      assert(Math.abs(peer.feet-row.feet)<1 && Math.abs(peer.hp-row.hp)<1, 'feet and bars stay aligned');
    }
    await page.screenshot({ path: resolve(out, `targeting-${width}.png`) });
    console.log('PASS overhead input and geometry', width, height);
    await page.goto(`${base}?shot=coop`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__coopSnapshotForShot);
    await page.waitForTimeout(1200);
    for (const role of ['player','enemy']) {
      await page.locator(`.${role} .combatant-info`).first().click();
      await page.locator('.combatant-door').waitFor();
      await page.keyboard.press('Escape');
    }
    await page.screenshot({ path: resolve(out, `coop-${width}.png`) });
    console.log('PASS co-op inspection', width, height);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
