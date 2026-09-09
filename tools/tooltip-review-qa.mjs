import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_URL || 'http://localhost:8317';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'ashenspire-tooltip-review');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless:true, ...(process.env.QA_BROWSER ? {executablePath:process.env.QA_BROWSER} : {channel:'msedge'}) });
const results = [], inventory = [], failures = [], consoleErrors = [];
const check = (value, label) => { assert.ok(value,label);results.push(label); };
const shot = async (page,name) => {
  if(!/keyword|status|tooltip/.test(name)) await page.mouse.move(0,0);
  await page.waitForTimeout(700); await page.screenshot({path:join(output,`${name}.png`)});
};
const route = scene => `${base}/tooltip-review-scene.html?shot=${['combat','coop','reward','shop','customize','map','combat-test'].includes(scene)?scene:'combat'}&tooltipReview=${scene}`;
const open = async(page,scene) => {
  await page.goto(route(scene),{waitUntil:'domcontentloaded'});
  await page.locator('#app > *').first().waitFor();
  if(['potion','equipment','smith','compendium','catalog','lab'].includes(scene)) await page.locator('[data-tooltip-review-ready=true]').waitFor();
};
const attempt = async (label, fn) => {try {await fn();console.log(`PASS ${label}`);} catch(e){failures.push(`${label}: ${e.message}`);console.error(`FAIL ${label}: ${e.message}`);} };
async function sweepHover(page, label) {
  await page.mouse.move(0,0);
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  const probes=await page.evaluate(()=>{
    const modal=[...document.querySelectorAll('[aria-modal=true]')].at(-1);
    return [...document.querySelectorAll('[data-tip-attached], [title], [data-tip]')].filter(el=>
      !el.closest('.as-tip') && (!modal||modal.contains(el)) && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden'
    ).map((el,i)=>{el.dataset.qaTip=String(i);return {id:i,label:el.getAttribute('aria-label')||el.textContent.trim().slice(0,60)};});
  });
  let opened=0;const silent=[];
  for(const probe of probes){
    await page.evaluate(async id=>{
      (await import('/src/ui/components/tooltip.js')).hideTooltip();
      const el=document.querySelector(`[data-qa-tip="${id}"]`);
      el.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse',clientX:-1,clientY:-1}));
      el.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse',clientX:-1,clientY:-1}));
    },probe.id);
    await page.clock.runFor(499);
    check(await page.locator('#tooltip[data-open=true]').count()===0,`${label} ${probe.id} ${probe.label}: no early hover`);
    await page.clock.runFor(1);
    if(await page.locator('#tooltip[data-open=true]').count()) {
      opened++;
      await page.locator(`[data-qa-tip="${probe.id}"]`).dispatchEvent('pointerleave',{pointerType:'mouse'});
      await page.clock.runFor(499);check(await page.locator('#tooltip[data-open=true]').count()===1,`${label} ${probe.id}: close grace`);
      await page.clock.runFor(1);check(await page.locator('#tooltip[data-open=true]').count()===0,`${label} ${probe.id}: closes after grace`);
    } else silent.push(probe);
  }
  inventory.push({label,hoverTargets:probes.length,opened,silent});
  await page.clock.resume();
}
try {
  await attempt('shared timing state machine',async()=>{
    const page=await browser.newPage({viewport:{width:1200,height:900}});
    await open(page,'lab'); await page.clock.install(); await page.clock.pauseAt(new Date(Date.now()+1000));
    const first=page.locator('[data-lab="First target"]'),second=page.locator('[data-lab="Second target"]');
    const shown=()=>page.locator('#tooltip[data-open=true]').count(), nested=()=>page.locator('#tooltip-2[data-open=true]').count();
    const tick=ms=>page.clock.runFor(ms);
    await first.hover();await tick(499);check(!await shown(),'hover remains closed at 499ms');
    await tick(1);check(await shown(),'hover opens at 500ms');
    await tick(10000);check(await shown(),'hover survives 10 seconds and autoHide option');
    await second.hover();await tick(499);check(!await shown() || !(await page.locator('#tooltip').innerText()).includes('Second target'),'handover pays full delay');
    await tick(1);check((await page.locator('#tooltip').innerText()).includes('Second target'),'handover opens at 500ms');
    await page.mouse.move(1195,895);await tick(499);check(await shown(),'close grace lasts 499ms');await tick(1);check(!await shown(),'closes at 500ms');
    await first.hover();await tick(200);await page.mouse.move(1195,895);await tick(1000);check(!await shown(),'brief hover cancels without queued popup');
    await first.hover();await tick(500);await page.locator('#tooltip').hover({position:{x:12,y:12}});await tick(1000);check(await shown(),'crossing into panel keeps it open');
    const term=page.locator('#tooltip [data-tip]').first();await term.hover();await tick(499);check(!await nested(),'nested keyword waits 499ms');await tick(1);check(await nested(),'nested keyword opens at 500ms');
    await page.locator('#tooltip-2').hover();await tick(1000);check(await shown()&&await nested(),'nested panel keeps both levels readable');
    await page.mouse.move(1195,895);await tick(499);check(await nested(),'nested close grace');await tick(1);check(!await shown()&&!await nested(),'both panels close after exit');
    await first.hover();await tick(500);await page.locator('#tooltip [data-tip]').first().hover();await tick(200);await page.locator('#tooltip .tt-title').hover();await tick(800);check(!await nested(),'short nested hover cancels');
    await page.mouse.move(1195,895);await tick(300);await first.hover();await tick(600);check(await shown(),'re-enter owner cancels dismissal');
    await page.keyboard.press('Escape');check(!await shown(),'Escape dismisses hover');
    await first.focus();await tick(499);check(!await shown(),'keyboard focus waits');await tick(1);check(await shown(),'keyboard definitions remain reachable');
    await page.keyboard.press('Escape');await page.evaluate(()=>document.activeElement.blur());await page.mouse.move(1195,895);
    await first.dispatchEvent('pointerenter',{pointerType:'touch'});await tick(1000);check(!await shown(),'touch pointerenter never opens hover');
    await first.hover();await tick(200);await first.evaluate(el=>el.remove());await tick(1000);check(!await shown(),'removed pending anchor cannot reopen');
    const native=page.getByRole('button',{name:'Native title',exact:true});await native.hover();await tick(499);check(!await shown(),'native title adopts delayed clock');await tick(1);check(await shown()&&!await native.getAttribute('title'),'native title removed after adoption');
    await native.evaluate(el=>{el.setAttribute('role','button');el.onclick=()=>el.dataset.activated='true';});
    await native.click();check(await native.getAttribute('data-activated')==='true','adopted title never steals an action button click');
    await page.keyboard.press('Escape');await second.hover();await tick(200);await page.evaluate(()=>{const veil=document.createElement('div');veil.className='modal-veil';document.body.append(veil)});await tick(500);check(!await shown(),'new modal cancels pending tooltip behind it');
    await page.close();
  });
  for(const phone of [false,true]) {
    const shape=phone?'phone':'desktop';
    const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:1000},isMobile:phone,hasTouch:phone});
    const page=await context.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(45000);
    page.on('pageerror',e=>consoleErrors.push(`${shape}: ${e.message}`));
    for(const scene of ['combat','coop','potion','reward','shop','equipment','smith','customize','map','compendium','catalog','lab','combat-test']) await attempt(`${shape} ${scene} screen`,async()=>{
      await open(page,scene);
      check((await page.locator('#app').innerText()).length>30,`${shape} ${scene} meaningful content`);
      check(/^Ashen\s?Spire/.test(await page.title()),`${shape} ${scene} identity`);
      inventory.push({shape,scene,attached:await page.locator('[data-tip-attached]').count(),native:await page.locator('[title]').count(),terms:await page.locator('[data-tip]').count()});
      if(scene==='potion') {
        if(phone)await page.locator('.reward-kind[data-kind=flask]').tap();else await page.locator('.reward-kind[data-kind=flask]').click();
        const detail=page.locator('[data-reward-detail=flask]');await detail.waitFor();
        const text=await detail.locator('.card-inspection-details').innerText();
        check(text.trim()==='This turn, your attacks apply 2 extra Bleed per hit.',`${shape} potion effect once without filler`);
        check(await detail.locator('.card-inspection-art .inspection-tag').count()===3,`${shape} potion three supporting tags below card`);
        await shot(page,`reward-potion-${shape}`);
        check(await detail.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1),`${shape} potion stays inside viewport`);
        const bleed=detail.locator('.tooltip-keyword').filter({hasText:/^Bleed$/});
        if(phone) await bleed.tap();else await bleed.hover();
        await page.waitForFunction(()=>document.querySelector('#tooltip[data-open=true]')?.textContent.includes('At 7'));
        check((await page.locator('#tooltip').innerText()).includes('At 7'),`${shape} Bleed definition uses resolved values`);
        await shot(page,`potion-keyword-${shape}`);
        await page.keyboard.press('Escape');check(await detail.count()===1,`${shape} Escape closes definition before inspection`);
        await page.locator('#reward-back').click();check(await page.locator('[data-reward-detail]').count()===0,`${shape} Back closes inspection`);
        check(await page.evaluate(()=>window.__tooltipReviewRun.flasks.length===0),`${shape} inspection never collects potion`);
      }
      if(scene==='combat') {
        await page.locator('.hand .card').first().waitFor();
        const before=await page.evaluate(()=>JSON.stringify(window.__combat));
        const card=page.locator('.hand .card').first();
        if(phone)await card.tap({position:{x:35,y:70}});else await card.focus();
        await card.locator('.card-info-button').click();await page.locator('.card-inspection-modal').waitFor();
        check(await page.evaluate(()=>JSON.stringify(window.__combat))===before,`${shape} Information never plays card`);
        await shot(page,`playing-card-${shape}`);await page.locator('.card-inspection-modal .modal-close').click();
        await open(page,'combat');
        await page.locator('.hand .card').first().waitFor();
        const enemy=page.locator('.combatant.enemy').first();
        if(phone)await enemy.locator('.resunit').first().tap();else await enemy.locator('.nm').hover();
        await page.waitForFunction(()=>document.querySelector('#tooltip[data-open=true][data-tooltip-variant=combatant-context]')||document.querySelector('.combatant-door'));
        check(await page.locator('#tooltip[data-open=true]').count()===1 || await page.locator('.combatant-door').count()===1,`${shape} enemy inspection reachable`);
        if(!await page.locator('.combatant-door').count()) {
          await shot(page,`enemy-tooltip-${shape}`);
          await page.locator('#tooltip button').click();
        }
        await page.locator('.combatant-door').waitFor();
        await shot(page,`enemy-moves-${shape}`);
        check(await page.locator('.combatant-door .enemy-move-card').count()>0,`${shape} enemy move inspection`);
        await page.locator('.combatant-door .modal-close').click();
        await open(page,'combat');await page.locator('.hand .card').first().waitFor();
        const playBefore=await page.evaluate(()=>({hand:window.__combat.piles.hand.length,hp:window.__combat.enemies[0].hp}));
        const playable=page.locator('.hand .card').first();
        if(phone)await playable.tap({position:{x:35,y:70}});else await playable.focus();
        await playable.locator('.card-info-button').click();await page.locator('.card-inspection-play').click();
        await page.locator('.combatant.enemy .resunit').first().click();await page.waitForTimeout(1500);
        check(await page.evaluate(before=>window.__combat.piles.hand.length===before.hand-1&&window.__combat.enemies[0].hp<before.hp,playBefore),`${shape} deliberate play and target confirmation resolves damage`);
        await page.locator('.end-turn').click();await page.getByRole('button',{name:'END TURN',exact:true}).click();
        await page.waitForFunction(()=>window.__combat.turn===2);
        check(await page.evaluate(()=>window.__combat.turn===2),`${shape} end turn confirmation advances gameplay`);
      }
      if(scene==='coop') {
        const status=page.locator('[data-status-id=bleed]').first();await status.waitFor();
        if(phone)await status.tap();else await status.hover();
        await page.waitForFunction(()=>document.querySelector('#tooltip[data-open=true]')?.textContent.includes('At 7'));
        check(await page.locator('#tooltip[data-open=true]').count()===1,`${shape} co-op status definition reachable`);
        check((await page.locator('#tooltip').innerText()).includes('At 7'),`${shape} co-op status uses resolved mechanics`);
        await shot(page,`coop-status-${shape}`);await page.keyboard.press('Escape');
      }
      if(scene==='catalog') {
        const potion=page.locator('.equipment-poker-card').filter({hasText:'Blood Unction'});
        if(phone){await potion.tap({position:{x:70,y:90}});await potion.locator('.card-info-button').tap();}else await potion.click({position:{x:70,y:90}});
        await page.locator('.card-inspection-modal').waitFor();check(await page.locator('.card-inspection-details .tooltip-keyword').count()>0,`${shape} item gallery keyword definitions`);await page.locator('.card-inspection-modal .modal-close').click();
        for(const category of ['Armaments','Armor','Relics','Statuses','Stances','Keywords','Cards']) {
          await page.getByRole('button',{name:category,exact:true}).click();
          check(await page.locator('.review-grid > *').count()>0,`${shape} ${category} corpus renders`);
          if(['Armaments','Armor','Relics'].includes(category)) {
            const item=page.locator('.review-grid .equipment-poker-card').first();
            if(phone){await item.tap({position:{x:70,y:90}});await item.locator('.card-info-button').tap();}else await item.click({position:{x:70,y:90}});
            await page.locator('.card-inspection-modal').waitFor();await shot(page,`${category.toLowerCase()}-${shape}`);
            await page.locator('.card-inspection-modal .modal-close').click();
          }
          if(category==='Statuses') {
            const status=page.locator('[data-content-id=bleed]');
            if(phone)await status.tap();else await status.hover();await page.waitForTimeout(550);
            check(await page.locator('#tooltip[data-open=true]').count()===1,`${shape} status definition reachable`);await shot(page,`status-${shape}`);await page.keyboard.press('Escape');
          }
        }
      }
      if(!phone && scene!=='catalog') {
        if(scene==='combat') { await open(page,'combat');await page.locator('.hand .card').first().waitFor(); }
        await sweepHover(page,`${shape}/${scene}`);
      }
    });
    await context.close();
  }
  await attempt('entire content inspection corpus',async()=>{
    const page=await browser.newPage();await open(page,'catalog');
    const counts=await page.evaluate(async()=>{
      const {contentBundle}=await import('/src/content/index.js');const {createRegistries}=await import('/src/model/registries.js');
      const {renderEquipmentInspection}=await import('/src/ui/components/equipmentCard.js');const {renderCollectibleInspection}=await import('/src/ui/components/collectibleCard.js');
      const {renderCard}=await import('/src/ui/components/card.js');const {statusTooltipText}=await import('/src/ui/uiContent.js');
      const r=createRegistries(contentBundle), bad=[],counts={equipment:0,potions:0,relics:0,cards:0,statuses:0,stances:0,keywords:0};
      for(const [kind,defs] of [['equipment',[...r.equipment.armaments,...r.equipment.armour]],['potions',r.flasks.all()],['relics',r.relics.all()]]) for(const def of defs){
        const view=kind==='equipment'?renderEquipmentInspection(r,def):renderCollectibleInspection(r,def,kind==='potions'?'Potion':'Relic');
        const text=view.querySelector('.card-inspection-details').textContent;
        if(/authored effect|identity artwork|additional gameplay effect|This is lore/.test(text))bad.push(`${kind}/${def.id}: filler`);
        if(!view.querySelector('.inspection-tags'))bad.push(`${kind}/${def.id}: missing tags`);
        if(kind!=='equipment'&&!text.trim())bad.push(`${kind}/${def.id}: missing effect`);
        counts[kind]++;
      }
      const host=document.createElement('div');document.body.append(host);
      for(const def of r.cards.all())for(const upgraded of def.upgrade?[false,true]:[false]){
        const card=renderCard(r,{cardId:def.id,upgraded},{tooltip:false});host.replaceChildren(card);card.querySelector('.card-info-button').click();
        const modal=document.querySelector('.card-inspection-modal');
        if(!modal?.querySelector('.ctext')?.textContent)bad.push(`card/${def.id}: no effect`);
        if(modal?.querySelector('.tt-kw'))bad.push(`card/${def.id}: expanded glossary`);
        modal?.querySelector('.modal-close, .as-close')?.click();
        if(document.querySelector('.card-inspection-modal'))document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        counts.cards++;
      }
      for(const kind of ['statuses','stances','keywords'])for(const def of r[kind].all()){
        if(/\{[^}]+\}/.test(statusTooltipText(def)))bad.push(`${kind}/${def.id}: unresolved definition`);counts[kind]++;
      }
      host.remove();return {counts,bad};
    });
    check(counts.bad.length===0,counts.bad.join('; '));inventory.push(counts);console.log(JSON.stringify(counts));await page.close();
  });
  // Inventory every source consumer, not just the ones visible in a default run.
  const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
  const consumers=walk(resolve('src/ui')).filter(p=>p.endsWith('.js')).flatMap(path=>{
    const text=readFileSync(path,'utf8');const matches=[...text.matchAll(/\b(attachTooltip|showTooltipFor|showTooltipForRect|showTooltipAt)\(/g)];
    return matches.length?[{path:path.replace(resolve('.')+'\\',''),calls:matches.length}]:[];
  });
  inventory.push({sourceConsumers:consumers});
  check(consoleErrors.length===0,`runtime errors: ${consoleErrors.join('; ')}`);
} catch(e){failures.push(e.stack);} finally {
  await browser.close();
  writeFileSync(join(output,'qa-results.json'),JSON.stringify({passed:results.length,failures,consoleErrors,inventory,checks:results},null,2));
  console.log(`${results.length} checks passed; ${failures.length} failed. Evidence: ${output}`);
  if(failures.length)process.exitCode=1;
}
