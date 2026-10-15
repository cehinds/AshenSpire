#!/usr/bin/env node
// Geometry and screenshots from the real screenshot route and mountCombat.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
const { chromium } = await import('playwright');
const out = resolve(process.env.HUD_QA_OUT || 'outputs/player-hud');
mkdirSync(out, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), fixtureBoundary: 'Production screenshot route and renderer; authored combat with deterministic protection values, not a recorded playthrough.', views: [], failures: [] };
try {
  for (const [name, width, height] of [['mobile',390,844],['desktop',1440,900],['wide',2560,1080],['tablet',820,1180],['small',320,740]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:' + server.server.address().port + '/?shot=combat&shotClass=starseer&shotExpansion=ward', { timeout: 60000 });
    await page.locator('.combatant.player .sprite').first().waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      const p = window.__combat.player;
      p.block = 12; p.wardBlock = 3;
      p.persistentWard = { value: 5, max: 5 };
      p.persistentPoise = { value: 4, max: 20 };
      p.poiseMeter = { value: 4, max: 20 };
      p.statuses = { ...p.statuses, evade: { stacks: 2 } };
      window.__renderCombatForShot();
    });
    await page.locator('.combatant.player .sprite').first().click();
    await page.locator('.player.context-selected .combatant-mini-hud').waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
    await page.locator('.player.context-selected .combatant-mini-hud').first().evaluate(async panel => {
      let previous = '', stable = 0;
      for (let frame = 0; frame < 180 && stable < 8; frame++) {
        await new Promise(requestAnimationFrame);
        const rect = panel.getBoundingClientRect();
        const current = [rect.x, rect.y, rect.width, rect.height].map(n => n.toFixed(2)).join(',');
        stable = current === previous ? stable + 1 : 0;
        previous = current;
      }
      if (stable < 8) throw new Error('selected player panel did not settle');
    });
    const geometry = await page.locator('.player.context-selected .combatant-mini-hud').first().evaluate(panel => {
      const box = e => { const r=e.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height }; };
      const hp = panel.querySelector('.combat-health-meter .m-value');
      const text = [...panel.querySelectorAll('[data-meter-row="resource"] :is(.m-label,.m-value)')].filter(e => e.getBoundingClientRect().width);
      return { panel:box(panel), hp:box(hp), hpText:hp.textContent, labels:[...panel.querySelectorAll('[data-meter-row="resource"] .m-label')].map(e=>e.textContent.trim().toLowerCase()), text:text.map(e=>({text:e.textContent,box:box(e)})), order:[...panel.querySelector('.combat-health-row').children].map(e=>e.dataset.defenseKind || e.dataset.res), viewport:{width:innerWidth,height:innerHeight} };
    });
    await page.screenshot({path:resolve(out,name+'.png')});
    await page.screenshot({path:resolve(out,name+'.jpg'),type:'jpeg',quality:85});
    report.views.push({name,width,height,geometry});
    try {
      assert.match(geometry.hpText, /\d/, name+': HP number is rendered');
      assert.ok(geometry.labels.includes('poise') && geometry.labels.includes('ward'), name+': Poise and Ward labels are rendered');
      assert.ok(geometry.text.length >= 4, name+': selected Poise/Ward text is visible');
      for (const t of geometry.text) assert.ok(geometry.hp.bottom + 1 <= t.box.top || geometry.hp.right <= t.box.left || t.box.right <= geometry.hp.left, name+': HP value overlaps '+t.text);
      assert.ok(geometry.hp.left >= geometry.panel.left && geometry.hp.right <= geometry.panel.right, name+': HP value fits panel');
      assert.ok(geometry.panel.left >= 0 && geometry.panel.right <= width && geometry.panel.top >= 0 && geometry.panel.bottom <= height, name+': panel fits viewport');
      assert.deepEqual(geometry.order, ['evade','poise','ward','shield','hp'], name+': defense order');
    } catch(error) { report.failures.push(error.message); }
    await page.close();
  }
  writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('HUD_REPORT '+JSON.stringify(report));
  assert.equal(report.failures.length,0,report.failures.join('\n'));
} finally {
  await browser.close();
  server.server.closeAllConnections?.();
  await new Promise(r=>server.server.close(r));
}
