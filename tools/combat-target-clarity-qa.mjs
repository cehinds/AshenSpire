// Real combat targeting and stature regression; uses production renderer, art and input.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright` : 'playwright'));
const root = resolve(process.env.COMBAT_TARGET_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const baseline = process.argv.includes('--baseline');
const out = resolve(process.env.COMBAT_TARGET_OUT || 'outputs/combat-target-clarity');
mkdirSync(out, { recursive: true });
const executable = resolveBrowser([chromium.executablePath()]);
assert(executable, 'Set CHROME to Chromium');
const { server, port } = await serve({ root, port: 0, open: false, quiet: true });
const launched = await launchBrowser({ browser: executable, prefix: 'targetqa-', timeoutMs: 30000 });
let browser;
const results = [], failures = [];
try {
  browser = await chromium.connectOverCDP(launched.wsUrl);
  for (const [width, height] of [[320,568],[375,667],[390,844],[1440,900]].filter(([w]) => !process.env.QA_WIDTH || w === Number(process.env.QA_WIDTH))) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/?shot=combat`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__combat && window.__renderCombatForShot);
    await page.waitForTimeout(2200);
    const seed = await page.evaluate(() => JSON.parse(JSON.stringify(window.__combat.enemies)));
    for (const count of [2,3]) {
      await page.keyboard.press('Escape');
      await page.evaluate(({ seed, count }) => {
        const c = window.__combat;
        c.enemies = Array.from({ length: count }, (_, i) => ({ ...structuredClone(seed[i % seed.length]), id: `e${i + 1}`, alive: true, hp: 200, maxHp: 200 }));
        c.player.energy = 10; c.player.stamina = Math.max(c.player.stamina, 20); c.player.mana = Math.max(c.player.mana, 20);
        window.__renderCombatForShot();
      }, { seed, count });
      await page.waitForTimeout(800);
      const geometry = await page.locator('.combatant').evaluateAll(es => es.map(e => {
        const rect = el => el?.getBoundingClientRect().toJSON() || null;
        const s=e.querySelector('.sprite').getBoundingClientRect();
        return { id:e.dataset.eid, visibleHeight:Number(e.dataset.spriteVisibleHeight), sprite:rect(e.querySelector('.sprite')), visibleTop:s.bottom-Number(e.dataset.spriteVisibleHeight), intent:rect(e.querySelector('.intent')), leading:rect(e.querySelector('.combatant-leading')), meters:rect(e.querySelector('.meters')), hand:rect(document.querySelector('.hand')) };
      }));
      const images = await page.locator('.combatant img[src]').evaluateAll(es => es.map(e => ({ src:e.currentSrc,loaded:e.complete&&e.naturalWidth>0 })));
      const record = { viewport:{width,height},count,geometry,images,errors:[...errors] };
      results.push(record);
      writeFileSync(resolve(out,baseline?'baseline.json':'results.json'),JSON.stringify(results,null,2));
      console.log('Measured',width,height,count);
      await page.screenshot({ path:resolve(out,`${baseline?'baseline':'combat'}-${width}x${height}-${count}-enemies.png`) });
      if (baseline) continue;
      const check = async (name, fn) => { try { await fn(); record[name]=true; } catch (error) { record[name]=error.message; failures.push(`${width}x${height}/${count}: ${name}: ${error.message}`); } };
      await check('artLoaded', () => assert(images.length>0 && images.every(e=>e.loaded),'real combat art loads'));
      await check('enemyStature', () => {
        const player=geometry.find(e=>e.id==='player');
        assert(player,'player exists');
        geometry.filter(e=>e.id!=='player').forEach(e=>assert(e.visibleHeight>=player.visibleHeight-1,`${e.id} ${e.visibleHeight} < player ${player.visibleHeight}`));
      });
      const previousFile=resolve(out,'baseline.json');
      if(existsSync(previousFile)) await check('noSpriteShrink', () => {
        const old=JSON.parse(readFileSync(previousFile,'utf8')).find(r=>r.viewport.width===width&&r.count===count);
        assert(old,'matching baseline');
        geometry.forEach(e=>assert(e.visibleHeight>=old.geometry.find(a=>a.id===e.id).visibleHeight-1,`${e.id} ${e.visibleHeight} below baseline`));
      });
      const attack = await page.evaluate(async () => {
        const { previewCard } = await import('/src/engine/combat.js');
        const c=window.__combat;
        return c.piles.hand.find(i=>previewCard(c,i.instanceId).needsTarget)?.instanceId;
      });
      await check('enemyTargeting',async()=>{
        assert(attack,'fixture has attack');
        const card=page.locator(`.hand .card[data-instance-id="${attack}"]`);
        const slot = await page.locator('.hand .card').evaluateAll((es,id)=>es.findIndex(e=>e.dataset.instanceId===id),attack);
        assert(slot >= 0 && slot < 9,'attack has positional shortcut');
        await page.keyboard.press(String(slot+1));
        const picker=page.locator('.enemy-target-picker');
        await picker.waitFor({state:'visible'});
        record.picker=await picker.boundingBox();
        const buttons=page.locator('.enemy-target-button[data-eid]');
        assert.equal(await buttons.count(),count,'one button per living enemy');
        const hit=await buttons.evaluateAll(es=>es.map(e=>{ const r=e.getBoundingClientRect();return {id:e.dataset.eid,rect:r.toJSON(),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
        record.targetButtons=hit;
        assert(hit.every(e=>e.hit&&e.rect.width>=44&&e.rect.height>=44),'buttons exposed with 44px tap area');
        await page.screenshot({path:resolve(out,`targeting-${width}x${height}-${count}-enemies.png`)});
        const before=await page.evaluate(()=>JSON.stringify({piles:window.__combat.piles,player:window.__combat.player,enemies:window.__combat.enemies}));
        await page.locator('.combatant.player .sprite').click({force:true});
        assert.equal(await page.evaluate(()=>JSON.stringify({piles:window.__combat.piles,player:window.__combat.player,enemies:window.__combat.enemies})),before,'enemy card ignores player');
        await page.keyboard.press('Escape');
        await page.keyboard.press(String(slot+1));
        await buttons.last().click();
        await page.waitForTimeout(1800);
        const played=await page.evaluate(id=>!window.__combat.piles.hand.some(c=>c.instanceId===id),attack);
        assert(played,'selected foe button commits real card');
      });
      writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2));
    }
    await context.close();
  }
} finally {
  writeFileSync(resolve(out,baseline?'baseline.json':'results.json'),JSON.stringify(results,null,2));
  await browser?.close(); await launched.close(); await new Promise(done=>server.close(done));
}
if(failures.length){console.error(failures.join('\n')); process.exitCode=1;} else console.log(`${baseline?'Baseline captured':'PASS combat target clarity'}: ${results.length} combat layouts; screenshots and measured geometry in ${out}`);
