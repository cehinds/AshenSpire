// Run against a built web or standalone game: LAYERED_GAME_URL=http://localhost:8765/build/AshenSpire.html node tests/layered-environment.browser.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=process.env.LAYERED_GAME_URL||'http://127.0.0.1:8765/build/AshenSpire.html';
const out=process.env.LAYERED_SHOTS||path.resolve('docs/preview/features/improve-map-battlefield-art');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const results=[];
const waitArt=async page=>{await page.waitForSelector('.layered-environment');await page.waitForFunction(()=>[...document.querySelectorAll('.layered-environment img')].every(i=>i.complete&&i.naturalWidth>0));};
try{
 for(const [name,width,height,scene]of [['mobile',390,844,'city-street'],['desktop',1440,900,'castle-throne-room'],['wide',1920,900,'city-street-night'],['tablet',768,1024,'forest-path']]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+`?shot=combat&shotLayeredScene=${scene}&shotWeather=${name==='mobile'?'rain':'clear'}`,{waitUntil:'load',timeout:60000});await waitArt(page);
  await page.waitForFunction(()=>document.querySelector('.layered-environment').dataset.sceneFit==='layered');
  const state=await page.evaluate(()=>({scene:document.querySelector('.layered-environment').dataset.scene,effects:getComputedStyle(document.querySelector('.layered-environment-effects')).pointerEvents,particles:[...document.querySelectorAll('.layered-particles')].map(n=>getComputedStyle(n).animationName),cards:document.querySelectorAll('.hand .card').length,loadedLayers:document.querySelectorAll('.layered-environment img').length}));
  assert.equal(state.effects,'none');assert.equal(state.cards,5);assert.ok(state.particles.every(n=>n==='none'));assert.deepEqual(errors,[]);
  // Test paint order with the actual oversized overlay, making only its hit
  // surface observable. Pointer-events:none otherwise hides stacking mistakes.
  const stacking = await page.evaluate(() => {
    const effects = document.querySelector('.combat > .layered-environment-effects');
    effects.style.setProperty('pointer-events','auto','important');
    const rank = selector => {
      const node = document.querySelector(selector), rect = node?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return null;
      const x = Math.max(1,Math.min(innerWidth-1,rect.left+rect.width/2));
      const y = Math.max(1,Math.min(innerHeight-1,rect.top+rect.height/2));
      const previous = node.style.getPropertyValue('pointer-events'), priority = node.style.getPropertyPriority('pointer-events');
      node.style.setProperty('pointer-events','auto','important');
      const stack = document.elementsFromPoint(x,y);
      node.style.removeProperty('pointer-events');
      if(previous) node.style.setProperty('pointer-events',previous,priority);
      return {selector,effect:stack.indexOf(effects),chrome:stack.findIndex(item=>item===node||node.contains(item)),z:getComputedStyle(node).zIndex};
    };
    const combat = effects.parentElement;
    const rows = [];
    const originalComposition = combat.getAttribute('data-composition');
    const originalAppearance = document.documentElement.getAttribute('data-display-appearance');
    const originalCoop = combat.classList.contains('coop');
    for (const variant of ['current','option-c','alternative','coop-wrappers']) {
      if (variant === 'option-c') combat.dataset.composition='option-c';
      if (variant === 'alternative') document.documentElement.dataset.displayAppearance='alternative';
      if (variant === 'coop-wrappers') combat.classList.add('coop');
      const selectors = ['.combat > .combat-hud','.combat .hand-overlay','.combat .hand-area .hand','.combat-action-row'];
      for (const selector of selectors) {
        const row = rank(selector);
        if (!row) throw Error(`Required visible chrome missing: ${variant}/${selector}`);
        rows.push({...row,variant});
      }
    }
    if(originalComposition===null) combat.removeAttribute('data-composition'); else combat.setAttribute('data-composition',originalComposition);
    if(originalAppearance===null) document.documentElement.removeAttribute('data-display-appearance'); else document.documentElement.setAttribute('data-display-appearance',originalAppearance);
    combat.classList.toggle('coop',originalCoop);
    const actor = rank('.combatant.enemy .sprite');
    if(actor) rows.push({...actor,variant:'world-actor',world:true});
    effects.style.removeProperty('pointer-events');
    return rows;
  });
  assert.equal(stacking.filter(row=>!row.world).length,16,'all four required chrome surfaces are checked in every CSS context');
  for (const row of stacking) {
    assert.ok(row.effect>=0,`${name}: oversized effects cover ${row.selector} geometry`);
    assert.ok(row.chrome>=0&&(row.world ? row.chrome>row.effect : row.chrome<row.effect),`${name}/${row.variant}: ${row.selector} must paint ${row.world ? 'below' : 'above'} time/weather: ${JSON.stringify(row)}`);
  }

  await page.screenshot({path:path.join(out,name+'.png')});results.push({name,width,height,state,stacking,errors});await page.close();
 }
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?shot=atlas&shotProfile=wanderer',{waitUntil:'load',timeout:60000});await page.locator('[data-atlas-node="crownfall"]').first().click();
 const before=await page.evaluate(()=>window.__worldJourney().currentNodeId);
 for(const [id,scene,file]of [['crownfall/forge','intro-forge','map-forge'],['crownfall/archive','intro-archive','map-archive']]){
  await page.locator(`[data-local-point="${id}"]`).click();await waitArt(page);
  assert.equal(await page.locator('.atlas-layered-preview .layered-environment').getAttribute('data-scene'),scene);
  assert.equal(await page.evaluate(()=>window.__worldJourney().currentNodeId),before,'inspecting art must not travel');
  await page.screenshot({path:path.join(out,file+'.png')});
 }
 await page.locator('[data-atlas-close]').click();assert.equal(await page.locator('.atlas-layered-preview').count(),0);assert.deepEqual(errors,[]);await page.close();
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({game:base,viewports:results,introMap:{locations:['crownfall/forge','crownfall/archive'],travelUnchanged:true,errors}},null,2)+'\n');
 console.log('PASS: four responsive combat views, reduced motion, loaded layers, chrome above weather across current/option-c/alternative/co-op CSS contexts, world actors below weather, and Crownfall inspection without travel or page errors.');
}finally{await browser.close();}
