import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.COMBAT_QA_URL || 'http://localhost:8212/index.html';
const out = resolve(process.env.COMBAT_QA_OUT || 'outputs/combat-formation');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], results = [];
async function geometry(page, label) {
  const g = await page.evaluate(() => {
    const box = s => document.querySelector(s).getBoundingClientRect();
    const c = box('.combat'), f = box('.field'), h = box('.hand'), rail = box('.combat-action-row');
    return { turn: document.querySelector('.combat').dataset.turn,
      fractions: [box('.topbar').height, f.height, h.height, rail.height].map(n => n / c.height),
      cards: [...document.querySelectorAll('.hand .card')].map(e => {
        const r = e.getBoundingClientRect(), css = getComputedStyle(e);
        return { id: e.dataset.instanceId, x: r.x, y: r.y, w: r.width, h: r.height,
          ratio: parseFloat(css.width) / parseFloat(css.height) };
      }),
      actors: [...document.querySelectorAll('.combatant')].map(e => {
        const s = e.querySelector('.sprite').getBoundingClientRect();
        const n = e.querySelector('.nm').getBoundingClientRect();
        const m = e.querySelector('.meters').getBoundingClientRect();
        return { id: e.dataset.eid, row: e.dataset.formationRow, x: s.x + s.width / 2,
          feet: s.bottom, expectedFeet: f.top + f.height * Number(e.dataset.groundRatio), nameY: n.y, hpY: m.y,
          hpWidth: m.width, bottom: m.bottom };
      }),
      fieldBottom: f.bottom, fieldTop: f.top,
      handLocked: document.querySelector('.hand').inert,
      overflow: document.documentElement.scrollWidth > innerWidth,
      banner: document.querySelector('.turn-ribbon').textContent };
  });
  const fail = msg => { throw Error(`${label}: ${msg}\n${JSON.stringify(g)}`); };
  if (g.fractions.some((n, i) => Math.abs(n - [.1,.45,.3,.15][i]) > .005)) fail('vertical allocation');
  if (g.cards.some(c => Math.abs(c.ratio - 5/7) > .001)) fail('card aspect ratio');
  if (g.actors.some(a => Math.abs(a.feet - a.expectedFeet) > 1 || a.feet < g.fieldTop + (g.fieldBottom-g.fieldTop)*.4)) fail('feet off ground');
  if (g.actors.some(a => a.bottom > g.fieldBottom + 2)) fail('health meters outside field');
  if (g.overflow) fail('horizontal overflow');
  for (const row of new Set(g.actors.map(a => a.row))) {
    const actors = g.actors.filter(a => a.row === row);
    if (Math.max(...actors.map(a=>a.hpY)) - Math.min(...actors.map(a=>a.hpY)) > 1) fail('health bars misaligned');
  }
  results.push({ label, ...g });
  return g;
}
try {
  for (const size of [{width:1440,height:900},{width:794,height:893},{width:390,height:844},{width:844,height:390}]) {
    const page = await browser.newPage({ viewport: size });
    page.on('pageerror', e => errors.push(e.message));
    for (const mode of ['duel','enemies','party']) {
      await page.goto(`${base}?shot=${mode==='party'?'coop':'combat'}&shotScene=cinder-reach-4`, { waitUntil:'domcontentloaded', timeout:60000 });
      await page.waitForSelector('.combatant');
      if (mode === 'duel') await page.evaluate(() => { window.__combat.enemies.splice(1); window.__renderCombatForShot(); });
      if (mode === 'party') await page.evaluate(() => {
        const s = structuredClone(window.__coopSnapshotForShot);
        s.party.push({ ...s.party[1], id:'p3', name:'Aster', classId:'starseer' });
        s.scene.players.push({ ...s.scene.players[1], id:'p3', ended:false });
        window.__coopSnapshotForShot=s; window.__receiveCoopSnapshotForShot(s);
      });
      await page.waitForTimeout(1600);
      const label = `${mode}-${size.width}`;
      const before = await geometry(page, label+'-player');
      await page.screenshot({ path:resolve(out,label+'-player.png') });
      if (mode !== 'party') {
        await page.locator('.end-turn').hover(); await page.mouse.down();
        await page.waitForTimeout(1800); await page.mouse.up();
      } else await page.evaluate(() => {
        const s = structuredClone(window.__coopSnapshotForShot); s.scene.turn++;
        s.scene.events = s.scene.enemies.map(e => ({ type:'enemyMoveStarted', sourceId:e.id, enemyId:e.enemyId, moveId:e.intent.moveId, kind:e.intent.kind }));
        window.__receiveCoopSnapshotForShot(s);
      });
      await page.waitForFunction(()=>document.querySelector('.combat').dataset.turn==='enemy',null,{timeout:7000});
      const during = await geometry(page,label+'-enemy');
      if (!during.handLocked) throw Error(label+': hand accepts enemy-turn input');
      for (let i=0;i<before.cards.length;i++) {
        const a=before.cards[i],b=during.cards[i];
        if (!b || ['x','y','w','h'].some(k=>Math.abs(a[k]-b[k])>1)) throw Error(label+': hand moved between phases');
      }
      await page.screenshot({ path:resolve(out,label+'-enemy.png') });
      await page.waitForFunction(()=>document.querySelector('.combat').dataset.turn==='player',null,{timeout:30000});
      await page.waitForTimeout(700);
      const after = await geometry(page,label+'-next-player');
      for (const a of before.actors) {
        const b=after.actors.find(b=>a.id===b.id);
        if(!b||['x','feet','hpY'].some(k=>Math.abs(a[k]-b[k])>1)) throw Error(label+': actor moved after turn');
      }
      console.log('PASS',label);
    }
    await page.close();
  }
  if(errors.length) throw Error(errors.join('\n'));
  writeFileSync(resolve(out,'checks.json'), JSON.stringify({base,results,errors},null,2));
  console.log(`PASS ${results.length} checks, 24 screenshots, no page errors`);
} finally { await browser.close(); }
