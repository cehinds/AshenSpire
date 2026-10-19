#!/usr/bin/env node
// Geometry and screenshots from the real screenshot route and mountCombat.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = resolve(process.env.HUD_QA_OUT || 'outputs/player-hud');
mkdirSync(out, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), fixtureBoundary: 'Production screenshot route and renderer; authored Core 2 with deterministic remaining protection and Evasion stacks, plus a separate legacy Ward provenance case. Not a recorded playthrough.', views: [], failures: [] };
const views = [['mobile',390,844],['desktop',1440,900],['wide',2560,1080],['tablet',820,1180],['small',320,740]];
// Expected values are independent fixture facts, not the UI protection model.
// Pressure deliberately differs from remaining Poise so the old bar cannot pass.
const fixtures = [
  { profile:'core', fixCore:true, views, wardBlock:0, barrier:0,
    expected:[['shield','12'],['evade','2'],['poise','4'],['ward','5']] },
  { profile:'current', fixCore:false, views:[['legacy-desktop',1440,900]], wardBlock:3, barrier:4,
    expected:[['shield','9'],['evade','2'],['poise','4'],['ward','12']] },
];
try {
  for (const fixture of fixtures) for (const [name, width, height] of fixture.views) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // The fresh source profile unlocks Reaver, while Starseer is locked there.
    await page.goto('http://127.0.0.1:' + server.server.address().port + '/?shot=combat&shotClass=reaver&shotExpansion=ward&gameProfile=' + fixture.profile, { timeout: 60000 });
    await page.waitForFunction(() => !!window.__combat);
    await page.locator('.combatant.player .sprite').first().waitFor({ timeout: 60000 });
    const facts = await page.evaluate(async fixture => {
      const combat = window.__combat, p = combat.player;
      const { fixCoreEnabled } = await import('/src/model/fixCoreMechanics.js');
      p.block = 12; p.wardBlock = fixture.wardBlock; p.barrier = fixture.barrier;
      p.persistentWard = { value: 5, max: 5 };
      p.persistentPoise = { value: 4, max: 20 };
      p.poiseMeter = { value: 17, max: 31 };
      p.statuses = { ...p.statuses, evade: { stacks: 2 } };
      window.__renderCombatForShot();
      return { fixCore:fixCoreEnabled(combat), version:combat.combatExpansionVersion,
        hp:`${p.hp}/${p.maxHp}`, block:p.block, wardBlock:p.wardBlock, barrier:p.barrier,
        ward:p.persistentWard.value, poise:p.persistentPoise.value, pressure:p.poiseMeter.value,
        evasionStacks:p.statuses.evade.stacks };
    }, fixture);
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
      const text = [...panel.querySelectorAll('[data-meter-row="resource"] :is(.m-label,.m-value)')].filter(e => e !== hp && e.getBoundingClientRect().width);
      const hpRow = panel.querySelector('.combat-health-row');
      const badges = [...hpRow.querySelectorAll('[data-defense-kind]')].map(node => {
        const value = node.querySelector('.combat-health-badge-value');
        return { kind:node.dataset.defenseKind, value:value.textContent, label:node.getAttribute('aria-label'),
          box:box(node), valueBox:box(value), barrier:node.dataset.barrier || null };
      });
      return { panel:box(detail), hp:box(hp), hpText:hp.textContent, badges,
        resourceKinds:[...panel.querySelectorAll('[data-meter-row="resource"]')].map(e=>e.dataset.res),
        hasAc:/\bAC\b|armou?r class/i.test(detail.textContent),
        text:text.map(e=>({text:e.textContent,box:box(e)})),
        order:[...hpRow.children].map(e=>e.dataset.defenseKind || e.dataset.res), viewport:{width:innerWidth,height:innerHeight} };
    });
    await page.screenshot({path:resolve(out,name+'.png')});
    await page.screenshot({path:resolve(out,name+'.jpg'),type:'jpeg',quality:85});
    report.views.push({name,width,height,profile:fixture.profile,facts,geometry,errors});
    try {
      assert.equal(facts.fixCore, fixture.fixCore, name+': the authored ruleset is active');
      assert.equal(facts.version, 2, name+': expanded protection is active');
      assert.equal(geometry.hpText.replace(/\s/g,''), facts.hp, name+': HP remains its exact health fraction');
      assert.deepEqual(geometry.badges.map(({kind,value})=>[kind,value]), fixture.expected, name+': exact Evasion stacks, remaining Poise, Ward and Block');
      assert.equal(geometry.hasAc, false, name+': the selected panel contains no AC');
      assert.deepEqual(geometry.resourceKinds.filter(kind=>kind!=='hp'), [], name+': no extra pressure/resource bar replaces a defense badge');
      for (const badge of geometry.badges) {
        assert.ok(badge.label?.toLowerCase().includes(badge.kind === 'shield' ? 'block' : badge.kind === 'evade' ? 'evade' : badge.kind), name+': accessible defense label '+badge.kind);
        assert.ok(badge.valueBox.width > 0 && badge.valueBox.height > 0, name+': selected '+badge.kind+' value is visible');
        assert.ok(Math.abs(badge.box.width-badge.box.height) < 1, name+': '+badge.kind+' retains its square aspect');
        assert.ok(badge.box.left >= geometry.panel.left && badge.box.right <= geometry.panel.right && badge.box.top >= geometry.panel.top && badge.box.bottom <= geometry.panel.bottom, name+': '+badge.kind+' fits panel');
      }
      const text = [...geometry.text, ...geometry.badges.map(badge=>({text:badge.label,box:badge.valueBox}))];
      for (const t of text) assert.ok(geometry.hp.bottom + 1 <= t.box.top || geometry.hp.right <= t.box.left || t.box.right <= geometry.hp.left, name+': HP value overlaps '+t.text);
      assert.ok(geometry.hp.left >= geometry.panel.left && geometry.hp.right <= geometry.panel.right, name+': HP value fits panel');
      assert.ok(geometry.panel.left >= 0 && geometry.panel.right <= width && geometry.panel.top >= 0 && geometry.panel.bottom <= height, name+': panel fits viewport');
      assert.equal(geometry.badges.find(badge=>badge.kind==='ward').barrier, fixture.barrier ? '4' : null, name+': Barrier provenance stays on the legacy Ward badge only');
      assert.deepEqual(geometry.order, ['shield','evade','poise','ward','hp'], name+': defense order');
      assert.deepEqual(errors, [], name+': no browser errors');
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
