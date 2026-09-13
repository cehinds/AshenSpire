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
    const tapCombatant = async frame => {
      // Transparent sprite padding can extend behind its own intent badge.
      // Find an exposed body point, avoiding overlapping rear-row controls.
      await page.locator('.combatant-door').waitFor({ state: 'hidden' });
      const point = await frame.evaluate(e => {
        const sprite=e.querySelector('.sprite'), r=sprite.getBoundingClientRect();
        for (const height of [0.2,0.4,0.6,0.8]) for (const width of [0.5,0.3,0.7]) {
          const point={ x:r.x+r.width*width, y:r.bottom-Number(e.dataset.spriteVisibleHeight)*height };
          if (document.elementFromPoint(point.x,point.y)?.closest('.sprite') === sprite) return point;
        }
        return null;
      });
      assert(point, `combatant has an exposed body target: ${JSON.stringify(await frame.evaluate(e=> {
        const r=e.querySelector('.sprite').getBoundingClientRect();
        const p={x:r.x+r.width/2,y:r.bottom-Number(e.dataset.spriteVisibleHeight)*0.2};
        return {id:e.dataset.eid,rect:r.toJSON(),height:e.dataset.spriteVisibleHeight,hit:document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,500)};
      }))}`);
      await page.touchscreen.tap(point.x, point.y);
    };
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}?shot=combat`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__renderCombatForShot);
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('.combatant-info:visible').count(), 0, 'Information starts collapsed');
    const geometry = () => page.locator('.combatant').evaluateAll(es => es.map(e => ({
      id:e.dataset.eid, height:e.dataset.spriteVisibleHeight,
      feet:e.querySelector('.sprite').getBoundingClientRect().bottom,
      hp:e.querySelector('.meters').getBoundingClientRect().top,
    })));
    const initialGeometry = await geometry();
    const enemy = page.locator('.combatant.enemy').first();
    await tapCombatant(enemy);
    assert.equal(await page.locator('.combatant-info:visible').count(), 1, 'only selected combatant shows Information');
    await page.evaluate(() => window.__renderCombatForShot());
    await page.waitForTimeout(400);
    assert.deepEqual(await geometry(), initialGeometry, 'selection and rerender preserve sprite size and ground');
    assert(await page.locator('.overhead-control:visible').evaluateAll(es => es.every(e => {
      const r=e.getBoundingClientRect();
      return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    })), JSON.stringify(await page.locator('.overhead-control:visible').evaluateAll(es => es.map(e => {
      const r=e.getBoundingClientRect(); return { text:e.textContent, rect:r.toJSON(), hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,250) };
    }))));
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
    await tapCombatant(enemy);
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
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.combatant-info:visible').count(), 0, 'Escape clears reading selection');
    await page.mouse.move(0, height - 1);
    await tapCombatant(enemy);
    await page.screenshot({ path: resolve(out, `combat-${width}.png`) });
    await tapCombatant(page.locator('.combatant.player').first());
    assert.equal(await page.locator('.combatant-info:visible').count(), 1);
    assert(await page.locator('.player .combatant-info').isVisible(), 'player selection uses the same Information control');
    assert.equal(await page.locator('.enemy .combatant-info:visible').count(), 0);
    await enemy.focus();
    await enemy.dispatchEvent('gpfocus');
    assert(await info.isVisible(), 'keyboard/controller selection reveals Information');
    // Info must remain a reading action while a combat card is armed.
    await page.evaluate(() => window.__renderCombatForShot());
    const attackId = await page.evaluate(async () => {
      const { previewCard } = await import('./src/engine/combat.js');
      return window.__combat.piles.hand.find(c => previewCard(window.__combat, c.instanceId).needsTarget)?.instanceId;
    });
    assert(attackId, 'fixture provides an enemy-targeted card');
    const card = page.locator(`.hand .card[data-instance-id="${attackId}"]`);
    await page.keyboard.press('Tab');
    await card.focus();
    assert.equal(await page.locator('.combatant-info:visible').count(), 0, 'card selection dismisses combatant Information');
    const motif = el => {
      const s=getComputedStyle(el);
      // CSS zoom can round computed lengths by a fraction of a pixel.
      const px = value => Math.round(parseFloat(value) * 10) / 10;
      let zoom = 1;
      for (let node=el; node; node=node.parentElement) zoom *= Number(getComputedStyle(node).zoom) || 1;
      return [px(s.width),px(s.height),s.borderTopColor,px(parseFloat(s.borderTopWidth)*zoom),s.backgroundColor,s.color,s.fontFamily,s.fontStyle,s.fontWeight,s.fontSize];
    };
    assert.deepEqual(await info.evaluate(motif), await card.locator('.card-info-button').evaluate(motif), 'card and combatant Information share the same motif');
    await card.locator('.card-info-button').click();
    await page.getByRole('button', { name: 'Play card', exact: true }).click();
    assert(await page.locator('.enemy.targetable').count(), 'card is armed for a target');
    const before = await page.evaluate(() => JSON.stringify(window.__combat.piles));
    await enemy.focus();
    await enemy.dispatchEvent('gpfocus');
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
    assert.equal(await page.locator('.combatant-info:visible').count(), 0, 'default co-op attack target is not a reading selection');
    for (const role of ['player','enemy']) {
      await tapCombatant(page.locator(`.combatant.${role}`).first());
      assert.equal(await page.locator('.combatant-info:visible').count(), 1, `co-op ${role} Information is selected-only: ${JSON.stringify(await page.locator('.combatant').evaluateAll(es => es.map(e=>({id:e.dataset.eid,cls:e.className,selected:e.getAttribute('aria-pressed')}))))}`);
      assert(await page.locator(`.${role} .combatant-info`).first().isVisible(), 'the tapped combatant owns Information');
      await page.locator(`.${role} .combatant-info`).first().click();
      await page.locator('.combatant-door').waitFor();
      await page.keyboard.press('Escape');
    }
    await tapCombatant(page.locator('.combatant.enemy').first());
    await page.screenshot({ path: resolve(out, `coop-${width}.png`) });
    console.log('PASS co-op inspection', width, height);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
