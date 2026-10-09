import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pointerTargetExpression } from './pointer-target.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out=process.env.COMBAT_QA_OUT || '.codex/alternative-hud';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try {
  for (const [width,height] of [[390,844],[1440,900]]) {
    const page=await browser.newPage({viewport:{width,height}}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const url=new URL(process.env.COMBAT_QA_URL || 'http://localhost:8344/');url.searchParams.set('shot','coop');
    await page.goto(url.href,{waitUntil:'commit',timeout:120000});
    await page.waitForFunction(()=>typeof window.__receiveCoopSnapshotForShot==='function' && document.querySelectorAll('.combatant .sprite').length>=3,null,{timeout:120000});
    await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1500);
    for (const selector of ['.player .sprite','.enemy .intent']) {
      const original = await page.locator(selector).first().evaluate(node => getComputedStyle(node.closest('.combatant').querySelector('.sprite')).filter);
      const point=await page.evaluate(pointerTargetExpression(selector));await page.mouse.click(point.x,point.y);
      await page.waitForTimeout(400);
      const selected=await page.locator(selector).first().evaluate(node=>{
        const frame=node.closest('.combatant'),style=getComputedStyle(frame.querySelector('.sprite'));
        return {selected:frame.classList.contains('context-selected'),filter:style.filter,player:frame.classList.contains('player')};
      });
      assert(selected.selected,'real pointer selects the co-op combatant');
      assert(selected.filter.includes(selected.player?'101, 223, 104':'239, 73, 73'),'selected outline overrides seat and target tint');
      await page.keyboard.press('Escape');await page.waitForTimeout(200);
      if (selected.player) assert.equal(await page.locator(selector).first().evaluate(node=>getComputedStyle(node).filter),original,'deselection restores the co-op seat tint');
    }
    await page.screenshot({path:`${out}/${width}-coop.png`});
    const receipt=await page.evaluate(async()=>{
      const measure=()=>[...document.querySelectorAll('.combatant .sprite')].map(node=>{
        const r=node.getBoundingClientRect();return{id:node.closest('.combatant').dataset.eid,x:r.x,y:r.y,width:r.width,height:r.height};
      });
      const before=measure(),oldField=document.querySelector('.field'),style=document.createElement('style');
      style.textContent='.coop .combatant-leading { min-height:150px !important; }';document.head.append(style);
      const next=structuredClone(window.__coopSnapshotForShot);next.scene.players[0].hand.pop();window.__receiveCoopSnapshotForShot(next);
      await new Promise(resolve=>setTimeout(resolve,1200));
      const result={before,after:measure(),replacedField:oldField!==document.querySelector('.field')};style.remove();return result;
    });
    results.push({width,height,receipt,errors});writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
    assert(receipt.replacedField,'exercise an actual co-op DOM remount');
    for(const before of receipt.before){const after=receipt.after.find(row=>row.id===before.id);for(const key of ['x','y','width','height'])assert(Math.abs(after[key]-before[key])<.25,`${width}: ${before.id} ${key} drift ${after[key]-before[key]}`);}
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS alternative co-op holds its own artwork geometry through changed controls and hand remounts at390/1440');
} finally {await browser.close();}
