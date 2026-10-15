// Bounded compiled adaptation of upstream player-hud-clearance-qa.mjs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser.mjs';
const url = process.env.QA_BUILD_URL, expected = process.env.QA_EXPECT_HTML_SHA256;
assert.ok(url && expected && process.env.QA_EXPECT_SOURCE && process.env.QA_EXPECT_ORDINAL, 'immutable compiled build identity required');
const out = resolve(process.env.QA_OUTPUT); mkdirSync(out, { recursive: true });
const html = await (await fetch(url)).text();
const report = { url, started: new Date().toISOString(), htmlSha256: createHash('sha256').update(html).digest('hex'),
  source: html.match(/const SOURCE = '([^']+)'/)?.[1], ordinal: html.match(/const ORDINAL = '([^']+)'/)?.[1],
  fixture: 'Production compiled screenshot route and renderer; deterministic protection values and moving the existing canonical Star Spark instance into hand are data fixtures; selected-player and paid spell input are actual mouse/touch. Not an earned campaign.',
  views: [], errors: [], passed: false };
assert.equal(report.htmlSha256, expected); assert.equal(report.source, process.env.QA_EXPECT_SOURCE); assert.equal(report.ordinal, process.env.QA_EXPECT_ORDINAL);
assert.ok(html.includes('--hp-value-line:'), 'compiled CSS contains the upstream selected HP reservation');
const { chromium } = createRequire(import.meta.url)('playwright');
const owner = await launchBrowser({ prefix: 'hc-' });
const browser = await chromium.connectOverCDP(owner.wsUrl);
try {
  for (const [name, width, height] of [['small',320,740], ['phone',390,844], ['desktop',1440,900]]) {
    const device = name === 'desktop' ? 'mouse' : 'touch';
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: device === 'touch' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ name, message: error.message }));
    const tap = locator => device === 'touch' ? locator.tap() : locator.click();
    const row = { name, width, height, device }; report.views.push(row);
    try {
      await page.goto(`${url}?shot=combat&shotClass=starseer&shotExpansion=ward`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('.end-turn:not([disabled])').waitFor({ timeout: 60000 });
      await page.evaluate(() => {
        const c = window.__combat, p = c.player;
        // Move an existing canonical instance; do not invent a card or play it
        // through a function. This check measures selected-HUD input geometry.
        if (!c.piles.hand.some(card => card.cardId === 'starSpark')) {
          const pile = ['draw', 'discard'].find(pile => c.piles[pile].some(card => card.cardId === 'starSpark'));
          if (!pile) throw Error('canonical shot deck lacks Star Spark');
          const index = c.piles[pile].findIndex(card => card.cardId === 'starSpark');
          c.piles.hand.push(c.piles[pile].splice(index, 1)[0]);
        }
        p.block = 12; p.wardBlock = 3; p.barrier = 4;
        p.persistentWard = { value: 5, max: 5 }; p.persistentPoise = { value: 4, max: 20 }; p.poiseMeter = { value: 4, max: 20 };
        p.statuses = { ...p.statuses, evade: { stacks: 2 } };
        window.__renderCombatForShot();
      });
      await tap(page.locator('.combatant.player .sprite').first());
      const panel = page.locator('.player.context-selected .combatant-mini-hud').first(); await panel.waitFor();
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(i => { const b=i.getBoundingClientRect();return b.width>0 && b.height>0 && b.bottom>0 && b.top<innerHeight; }).map(i=>i.decode())); });
      await panel.evaluate(async panel => {
        let previous = '', stable = 0;
        for (let frame = 0; frame < 180 && stable < 8; frame++) {
          await new Promise(requestAnimationFrame); const r = panel.getBoundingClientRect();
          const current = [r.x,r.y,r.width,r.height].map(n=>n.toFixed(2)).join(',');
          stable = current === previous ? stable + 1 : 0; previous = current;
        }
        if (stable < 8) throw Error('selected player panel did not settle');
      });
      const g = row.geometry = await panel.evaluate(panel => {
        const box = e => { const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
        const hp=panel.querySelector('.combat-health-meter .m-value');
        return { panel:box(panel), hp:box(hp), hpText:hp.textContent,
          labels:[...panel.querySelectorAll('[data-meter-row="resource"] .m-label')].map(e=>e.textContent.trim().toLowerCase()),
          text:[...panel.querySelectorAll('[data-meter-row="resource"] :is(.m-label,.m-value)')].filter(e=>e.getBoundingClientRect().width).map(e=>({text:e.textContent,box:box(e)})),
          order:[...panel.querySelector('.combat-health-row').children].map(e=>e.dataset.defenseKind||e.dataset.res), barrier:panel.querySelector('[data-defense-kind="ward"]')?.dataset.barrier,
          reservation: getComputedStyle(panel.querySelector('.combat-health-row')).paddingBottom };
      });
      assert.match(g.hpText,/\d/);assert.ok(g.labels.includes('poise')&&g.labels.includes('ward'));assert.ok(g.text.length>=4);
      for(const text of g.text)assert.ok(g.hp.bottom+1<=text.box.top||g.hp.right<=text.box.left||text.box.right<=g.hp.left,`${name}: HP overlaps ${text.text}`);
      assert.ok(g.hp.left>=g.panel.left&&g.hp.right<=g.panel.right,`${name}: HP fits panel`);
      assert.ok(g.panel.left>=0&&g.panel.right<=width&&g.panel.top>=0&&g.panel.bottom<=height,`${name}: panel fits viewport`);
      assert.equal(g.barrier,'4');assert.deepEqual(g.order,['evade','poise','ward','shield','hp']);assert.ok(parseFloat(g.reservation)>0,'new compiled HP reservation takes effect');
      await page.screenshot({path:resolve(out,`${name}-selected-player.png`)});
      const inst = await page.evaluate(() => {
        const c=window.__combat, card=c.piles.hand.find(i=>i.cardId==='starSpark');
        if (!card) throw Error('canonical shot hand lacks Star Spark');
        return { ...card, before:c.eventLog.length };
      });
      await tap(page.locator(`.hand .card[data-instance-id="${inst.instanceId}"]`));
      const point = await page.evaluate(() => {
        const enemy=document.querySelector('.combatant.enemy[data-eid="e1"]'), b=enemy.querySelector('.sprite').getBoundingClientRect();
        for(let yi=1;yi<10;yi++)for(let xi=1;xi<10;xi++) { const x=b.left+b.width*xi/10,y=b.top+b.height*yi/10,hit=document.elementFromPoint(x,y);
          if(hit?.closest('.combatant.enemy')===enemy||hit?.closest('.enemy-target-button')?.dataset.eid==='e1')return{x,y}; }
        return null;
      });
      assert.ok(point,`${name}: enemy figure remains reachable after selected-player details`);
      if(device==='touch')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
      await page.waitForFunction(({id,before})=>window.__combat.eventLog.slice(before).some(e=>e.type==='cardPlayed'&&e.cardInstanceId===id),{id:inst.instanceId,before:inst.before},{timeout:15000});
      await page.locator('.end-turn:not([disabled])').waitFor({timeout:30000});
      row.played = await page.evaluate(({id,before})=>({receipts:window.__combat.eventLog.slice(before).filter(e=>e.type==='cardPlayed'&&e.cardInstanceId===id).length,
        pending:!!(window.__combat.pendingReaction||window.__combat.reactionResume||window.__combat.pendingAbilityDiscard),queue:window.__combat.queue.length}),{id:inst.instanceId,before:inst.before});
      assert.equal(row.played.receipts,1);assert.equal(row.played.pending,false);assert.equal(row.played.queue,0);row.passed=true;
    } catch(error) { row.error=error.stack;await page.screenshot({path:resolve(out,`${name}-failure.png`)});throw error; }
    finally { await context.close(); }
  }
  assert.equal(report.errors.length,0);report.passed=true;
} catch(error) { report.error=error.stack;process.exitCode=1; }
finally {report.finished=new Date().toISOString();writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await owner.close();}
console.log(JSON.stringify({passed:report.passed,views:report.views.map(v=>({name:v.name,passed:v.passed,error:v.error})),out}));
