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
    // The fresh source profile unlocks Reaver, while Starseer is locked there.
    await page.goto('http://127.0.0.1:' + server.server.address().port + '/?shot=combat&shotClass=reaver&shotExpansion=ward', { timeout: 60000 });
    await page.locator('.combatant.player .sprite').first().waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      const p = window.__combat.player;
      p.block = 12; p.wardBlock = 3; p.barrier = 4;
      p.persistentWard = { value: 5, max: 5 };
      p.persistentPoise = { value: 4, max: 20 };
      p.poiseMeter = { value: 4, max: 20 };
      p.statuses = { ...p.statuses, evade: { stacks: 2 } };
      window.__renderCombatForShot();
    });
    await page.locator('.combatant.player .sprite').first().click();
    await page.locator('.combatant.player.target-hud-selected').waitFor();
    await page.locator('.target-hud-detail[data-role="player"] .target-hud-panel').waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
    await page.locator('.target-hud-detail[data-role="player"]').first().evaluate(async panel => {
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
    const geometry = await page.locator('.target-hud-detail[data-role="player"]').first().evaluate(panel => {
      const box = e => { const r=e.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height }; };
      const detail = panel.querySelector('.target-hud-panel');
      const hp = panel.querySelector('.combat-health-meter .m-value');
      const text = [...panel.querySelectorAll('[data-meter-row="resource"] :is(.m-label,.m-value)')].filter(e => e.getBoundingClientRect().width);
      const hpRow = panel.querySelector('.combat-health-row');
      return { panel:box(detail), hp:box(hp), hpText:hp.textContent, labels:[...panel.querySelectorAll('[data-meter-row="resource"] .m-label')].map(e=>e.textContent.trim().toLowerCase()), text:text.map(e=>({text:e.textContent,box:box(e)})), ward:hpRow?.querySelector('[data-defense-kind="ward"] .combat-health-badge-value')?.textContent, barrier:hpRow?.querySelector('[data-defense-kind="ward"]')?.dataset.barrier, order:[...hpRow.children].map(e=>e.dataset.defenseKind || e.dataset.res), viewport:{width:innerWidth,height:innerHeight} };
    });
    await page.screenshot({path:resolve(out,name+'.png')});
    await page.screenshot({path:resolve(out,name+'.jpg'),type:'jpeg',quality:85});
    report.views.push({name,width,height,geometry});
    try {
      assert.match(geometry.hpText, /\d/, name+': HP number is rendered');
      assert.ok(geometry.labels.includes('poise'), name+': selected Poise label is rendered');
      assert.ok(geometry.text.some(t => /\d/.test(t.text)), name+': selected Poise value is visible');
      for (const t of geometry.text) assert.ok(geometry.hp.bottom + 1 <= t.box.top || geometry.hp.right <= t.box.left || t.box.right <= geometry.hp.left, name+': HP value overlaps '+t.text);
      assert.ok(geometry.hp.left >= geometry.panel.left && geometry.hp.right <= geometry.panel.right, name+': HP value fits panel');
      assert.ok(geometry.panel.left >= 0 && geometry.panel.right <= width && geometry.panel.top >= 0 && geometry.panel.bottom <= height, name+': panel fits viewport');
      assert.equal(geometry.ward, '12', name+': Ward remains visible on the HP row');
      assert.equal(geometry.barrier, '4', name+': Barrier remains on the Ward badge');
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
