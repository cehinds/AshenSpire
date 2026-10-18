import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openCombatQa } from './rear-qa-runtime.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.env.COMBAT_QA_OUT || '.codex/attached-details';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
const overlaps=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
try {
 for (const [width,height] of [[650,766],[390,844],[844,390],[1440,900]].filter(([w])=>!process.env.QA_WIDTH || w===Number(process.env.QA_WIDTH))) {
  for(const count of [1,2,3]) {
  const page=await browser.newPage({viewport:{width,height}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openCombatQa(page,process.env.COMBAT_QA_URL || 'http://localhost:8338/','combat');
  await page.evaluate(async()=>{
   const {stageFor}=window.__combatQaRuntime || await import('/src/ui/services/PoseAnimator.js');
   await document.fonts.ready;
   await Promise.all([...document.querySelectorAll('.player .sprite')].map(s=>stageFor(s)?.ready));
  });
  await page.waitForFunction(()=>[...document.images].every(img=>img.complete));
  const seed=await page.evaluate(()=>structuredClone(window.__combat.enemies));
   const instanceId=`attached-${width}-${count}`;
   await page.keyboard.press('Escape');
   await page.evaluate(({seed,count,instanceId})=>{
    const c=window.__combat;
    c.enemies=Array.from({length:count},(_,i)=>({...structuredClone(seed[i%seed.length]),id:`e${i+1}`,hp:200,maxHp:200,alive:true}));
    // Cloned crowd fixtures still need unique authored action serials; the
    // engine correctly refuses a malformed snapshot on a real card command.
    for(const enemy of c.enemies) if(enemy.knowledgeAction) enemy.knowledgeAction.serial=++c.enemyKnowledge.nextSerial;
    c.player.energy=10;c.player.stamina=20;c.player.mana=20;
    c.piles.hand=[{cardId:'strike',instanceId,upgraded:false}];
    window.__renderCombatForShot();
   },{seed,count,instanceId});
   await page.waitForTimeout(900);
   await page.locator('.hand .card').click();
   await page.locator('.enemy-target-picker:not([hidden])').waitFor();
   await page.waitForTimeout(300);
   const geometry=await page.evaluate(()=>{
    const rect=e=>e.getBoundingClientRect().toJSON();
    return {bar:rect(document.querySelector('.player .combatant-mini-hud')),player:rect(document.querySelector('.player .sprite')),
     cards:[...document.querySelectorAll('.hand .card')].map(rect),
     buttons:[...document.querySelectorAll('.enemy-target-button')].map(e=>({id:e.dataset.eid,rect:rect(e),label:e.getAttribute('aria-label'),hit:e.contains(document.elementFromPoint(rect(e).x+rect(e).width/2,rect(e).y+rect(e).height/2))})),
     enemies:[...document.querySelectorAll('.enemy.combatant')].map(e=>({id:e.dataset.eid,sprite:rect(e.querySelector('.sprite')),name:rect(e.querySelector('.nm')),meters:rect(e.querySelector('.meters'))}))};
   });
   results.push({width,height,count,geometry,errors});
   writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
   await page.screenshot({path:`${out}/${width}-${count}.png`});
   assert.equal(geometry.buttons.length,count);
   assert(geometry.buttons.every(b=>b.hit&&b.rect.width>=47.9&&b.rect.height>=47.9&&b.label));
   assert(geometry.buttons.every((b,i)=>!geometry.buttons.slice(i+1).some(other=>overlaps(b.rect,other.rect))));
   assert(geometry.bar.left>=0&&geometry.bar.right<=width);
   assert(geometry.cards.every(card=>!overlaps(geometry.bar,card)),'player details clear the hand');
   assert(geometry.bar.left>=geometry.player.left+geometry.player.width/2-1,'details stay to player right');
   for(const enemy of geometry.enemies) {
    const b=geometry.buttons.find(b=>b.id===enemy.id).rect;
    assert(overlaps(b,enemy.sprite),`${enemy.id} selection touches its own body`);
   }
   await page.locator('.enemy-target-button').last().focus();
   await page.keyboard.press('Enter');
   try { await page.waitForFunction(id=>!window.__combat.piles.hand.some(c=>c.instanceId===id),instanceId,{timeout:10000}); }
   catch(error) {console.log('failed confirm',await page.evaluate(()=>({phase:window.__combat.phase,hand:window.__combat.piles.hand,pending:window.__combat.pendingReaction,modals:[...document.querySelectorAll('.modal-veil')].map(e=>e.textContent),focus:document.activeElement?.outerHTML,cursor:document.querySelector('.gp-focus')?.outerHTML})));throw error;}
   await page.waitForTimeout(2500);
   assert.deepEqual(errors,[]);
   results.at(-1).played = true;
   writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
  await page.close();
  }
 }
} finally {await browser.close();}
console.log(`PASS ${results.length} attached-details layouts and legal keyboard card plays`);
