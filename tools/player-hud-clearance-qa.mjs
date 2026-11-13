#!/usr/bin/env node
// Geometry and screenshots from the real screenshot route and mountCombat.
// Measures the player's overhead mini HUD (owner, 2026-11-07: Block as tall as HP and Poise, matching HP/Poise bars, then badges; no AC): its bars, defense
// badges and the clearance between the rack's bottom edge and the top of the player's visible artwork (SPEC: fixed 10 px gap).
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = playwright.chromium || playwright.default.chromium;
const out = resolve(process.env.HUD_QA_OUT || 'outputs/player-hud');
mkdirSync(out, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), fixtureBoundary: 'Production screenshot route and renderer; authored Core 2 with fixed Block, Evasion, Ward and Precision values, measured on the overhead mini HUD of the player (Block as tall as the HP and Poise bars, matching HP/Poise bars, then badges; no selected panel or AC). Not a recorded playthrough.', views: [], failures: [] };
const views = [['mobile',390,844],['desktop',1440,900],['wide',2560,1080],['tablet',820,1180],['small',320,740]];
// Expected values are independent fixture facts, not the UI protection model.
const fixtures = [
  { profile:'core', fixCore:true, views, wardBlock:0, barrier:0,
    // Block occupies the tall left slot; Evade and +2 sit below the HP/Poise bars. The overflow lists Ward and Precision.
    expected:[['shield','12'],['evade','2'],['overflow','+2']], hidden:['Arcane Ward 5','Precision 3'], ac:false },
  // The legacy (`current`) Ward case was dropped with the retired profile (owner, 2026-11-04: Core 2 only).
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
      p.statuses = { ...p.statuses, evade: { stacks: 2 }, precision: { stacks: 3 } };
      window.__renderCombatForShot();
      return { fixCore:fixCoreEnabled(combat), version:combat.combatExpansionVersion,
        hp:`${p.hp}/${p.maxHp}`, block:p.block, wardBlock:p.wardBlock, barrier:p.barrier,
        ward:p.persistentWard.value,
        evasionStacks:p.statuses.evade.stacks };
    }, fixture);
    // Owner 2026-11-07: the player shows only the overhead mini HUD, never a selected panel, so nothing is clicked.
    const rackRow = '.combatant.player .target-hud-overhead-meters .combat-health-row';
    await page.locator(rackRow).first().waitFor({ timeout: 60000 });
    await page.locator(rackRow + ' .combat-health-meter .m-value').first().waitFor({ state: 'visible', timeout: 60000 });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
    await page.locator('.combatant.player .target-hud-overhead-meters').first().evaluate(async rack => {
      let previous = '', stable = 0;
      for (let frame = 0; frame < 180 && stable < 8; frame++) {
        await new Promise(requestAnimationFrame);
        const rect = rack.getBoundingClientRect();
        const current = [rect.x, rect.y, rect.width, rect.height].map(n => n.toFixed(2)).join(',');
        stable = current === previous ? stable + 1 : 0;
        previous = current;
      }
      if (stable < 8) throw new Error('player overhead HUD did not settle');
    });
    const geometry = await page.locator('.combatant.player .target-hud-overhead-meters').first().evaluate(rack => {
      const box = e => { const r=e.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height }; };
      const frame = rack.closest('.combatant.player');
      const meters = rack.querySelector(':scope > .meters');
      const hp = rack.querySelector('.combat-health-meter .m-value');
      const text = [...rack.querySelectorAll('[data-meter-row="resource"] :is(.m-label,.m-value)')].filter(e => e !== hp && e.getBoundingClientRect().width);
      const hpRow = rack.querySelector('.combat-health-row');
      const hpTrack = hpRow.querySelector('.combat-health-meter .m-track');
      const poiseTrack = hpRow.querySelector('.combat-health-poise-bar .m-track');
      const badgeRow = hpRow.querySelector('.combat-health-badges');
      const badges = [...hpRow.querySelectorAll('[data-defense-kind]:not([hidden])')].map(node => {
        const value = node.querySelector('.combat-health-badge-value');
        return { kind:node.dataset.defenseKind, value:value.textContent, label:node.getAttribute('aria-label'),
          box:box(node), valueBox:box(value), barrier:node.dataset.barrier || null };
      });
      // The visible artwork: the battlefield publishes its ground line and visible height in screen px; the sprite box is a cross-check.
      const groundY = Number(frame.dataset.groundY), visibleHeight = Number(frame.dataset.spriteVisibleHeight);
      const sprite = frame.querySelector('.sprite');
      const art = { groundY, visibleHeight, top:groundY - visibleHeight, spriteBox:sprite ? box(sprite) : null };
      return { panel:box(meters), rack:box(rack), art, hp:box(hp), hpText:hp.textContent, badges, acCaptions:hpRow.querySelectorAll('[data-ac-caption]').length,
        hpTrack:box(hpTrack), poiseTrack:box(poiseTrack), badgeRow:box(badgeRow),
        resourceKinds:[...rack.querySelectorAll('[data-meter-row="resource"]')].map(e=>e.dataset.res),
        statusTrayIds:[...document.querySelectorAll('.combatant.player .statuses [data-status-id], .combatant.player .statuses [data-status]')].map(e=>e.dataset.statusId||e.dataset.status), hasAc:!!hpRow.querySelector('.combat-health-ac'),
        text:text.map(e=>({text:e.textContent,box:box(e)})),
        order:[...hpRow.children].filter(e => !e.hidden).map(e=>e.dataset.defenseKind || e.dataset.res).filter(Boolean), viewport:{width:innerWidth,height:innerHeight} };
    });
    await page.screenshot({path:resolve(out,name+'.png')});
    await page.screenshot({path:resolve(out,name+'.jpg'),type:'jpeg',quality:85});
    report.views.push({name,width,height,profile:fixture.profile,facts,geometry,errors});
    try {
      assert.equal(facts.fixCore, fixture.fixCore, name+': the authored ruleset is active');
      assert.equal(facts.version, 2, name+': expanded protection is active');
      assert.equal(geometry.hpText.replace(/\s/g,''), facts.hp, name+': HP remains its exact health fraction');
      const seen = geometry.badges.map(({kind,value})=>[kind, value]);
      assert.deepEqual(seen, fixture.expected, name+': Block, Evade and the +N overflow, in the owner order');
      const overflow = geometry.badges.find(badge=>badge.kind==='overflow');
      assert.equal(overflow.label, fixture.hidden.join(', '), name+': the overflow lists exact Ward and Precision');
      assert.equal(geometry.hasAc, fixture.ac, name+': the player AC badge is not drawn');
      assert.equal(geometry.acCaptions, 0, name+': no AC caption is drawn');
      assert.deepEqual(geometry.resourceKinds.filter(kind=>kind!=='hp'), [], name+': no extra resource row replaces the dedicated Poise bar');
      const { hpTrack, poiseTrack, badgeRow } = geometry;
      assert.ok(hpTrack.width > 0 && hpTrack.height > 0, name+': HP bar is visible');
      assert.ok(Math.abs(hpTrack.width-poiseTrack.width) < 1 && Math.abs(hpTrack.height-poiseTrack.height) < 1, name+': HP and Poise bars share width and height');
      assert.ok(Math.abs(hpTrack.left-poiseTrack.left) < 1 && Math.abs(hpTrack.left-badgeRow.left) < 1, name+': HP, Poise and badges align');
      assert.ok(hpTrack.bottom <= poiseTrack.top && poiseTrack.bottom <= badgeRow.top, name+': HP, Poise and badges stack without overlap');
      assert.ok(geometry.hp.left >= hpTrack.right, name+': HP fraction sits to the right of its bar');
      assert.ok(Math.abs(geometry.hp.left-hpTrack.right-3) < 1, name+': the HP value uses only the budgeted 3px gap');
      assert.ok(Math.abs(badgeRow.width-hpTrack.width) < 1, name+': badges stay within the fixed bar width');
      for (const badge of geometry.badges) {
        assert.ok(badge.label?.toLowerCase().includes({ shield:'block', overflow:'ward' }[badge.kind] || badge.kind), name+': accessible defense label '+badge.kind);
        assert.ok(badge.valueBox.width > 0 && badge.valueBox.height > 0, name+': '+badge.kind+' value is visible');
        if (badge.kind === 'shield') {
          // Owner 2026-11-12: the shield is as tall as the HP and Poise bars, left of them, with the badge row below the bars.
          assert.ok(Math.abs(badge.box.top-hpTrack.top) <= 1 && Math.abs(badge.box.bottom-poiseTrack.bottom) <= 1, name+': Block is as tall as the HP and Poise bars');
          assert.ok(badge.box.right <= hpTrack.left, name+': Block sits left of the bars');
          assert.ok(badgeRow.top >= poiseTrack.bottom, name+': the badge row sits below the bars');
          const v = badge.valueBox, b = badge.box;
          assert.ok(v.top >= b.top-0.5 && v.bottom <= b.bottom+0.5 && v.left >= b.left-0.5 && v.right <= b.right+0.5, name+': the Block value sits inside the shield');
        } else {
          assert.ok(Math.abs(badge.box.width-badge.box.height) < 1, name+': '+badge.kind+' retains its round badge bounds');
          assert.ok(badge.box.left >= badgeRow.left && badge.box.right <= badgeRow.right && badge.box.top >= badgeRow.top && badge.box.bottom <= badgeRow.bottom, name+': '+badge.kind+' fits the badge row');
        }
        assert.ok(badge.box.left >= geometry.panel.left && badge.box.right <= geometry.panel.right && badge.box.top >= geometry.panel.top && badge.box.bottom <= geometry.panel.bottom, name+': '+badge.kind+' fits the overhead HUD');
      }
      const text = [...geometry.text, ...geometry.badges.map(badge=>({text:badge.label,box:badge.valueBox}))];
      for (const t of text) assert.ok(geometry.hp.bottom + 1 <= t.box.top || geometry.hp.right <= t.box.left || t.box.right <= geometry.hp.left, name+': HP value overlaps '+t.text);
      assert.ok(geometry.hp.left >= geometry.panel.left && geometry.hp.right <= geometry.panel.right, name+': HP value fits the overhead HUD');
      assert.ok(geometry.rack.left >= 0 && geometry.rack.right <= width && geometry.rack.top >= 0 && geometry.rack.bottom <= height, name+': overhead HUD fits viewport');
      // SPEC: the mini HUD sits above the visible artwork with a fixed 10 screen-pixel bottom-to-art-top gap.
      assert.ok(Number.isFinite(geometry.art.top), name+': the battlefield publishes the player art top');
      assert.ok(geometry.art.top - geometry.rack.bottom >= 10 - 0.5, name+': overhead HUD bottom sits at least 10px above the art top (gap '+(geometry.art.top - geometry.rack.bottom).toFixed(2)+')');
      // Ward sits behind the +N now, so Barrier provenance is pinned on the badge itself in tests/combat-health.test.mjs.
      assert.equal(geometry.badges.some(badge=>badge.barrier), false, name+': no visible badge claims Barrier provenance');
      assert.deepEqual(geometry.order, ['shield','hp','poise'], name+': Block precedes the HP and Poise bars');
      assert.ok(!geometry.statusTrayIds.some(id=>['evade','precision'].includes(id)), name+': Evade and Precision live only in the defense badges, not the status tray');
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
