import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import {serve} from '../serve.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {server,port}=await serve({root:path.resolve('.'),port:0,open:false,quiet:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME ? {executablePath:process.env.CHROME} : {}),args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); await page.route('**/ui-probe.html', route => route.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'})); await page.goto(`http://127.0.0.1:${port}/ui-probe.html`);
 const result=await page.evaluate(async()=>{
 const [{contentBundle},{createRegistries},{resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries,gameContent},{mountCustomize},{gameProfileClassAvailable},{createRunState},{mountConfiguredShop},{createRng},{gameProfileShopStock,gameProfileRewardOffers,claimGameProfileReward},{mountGameProfileOffers}]=await Promise.all([import('/src/content/index.js'),import('/src/model/registries.js'),import('/src/model/gameProfile.js'),import('/src/ui/screens/customize.js'),import('/src/model/gameProfileRun.js'),import('/src/model/state.js'),import('/src/ui/screens/shop.js'),import('/src/engine/rng.js'),import('/src/model/gameProfileRewards.js'),import('/src/ui/components/gameProfileOffers.js')]);
 const profile=resolveGameProfile('core'),reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
 document.body.replaceChildren();const app=document.createElement('main');document.body.append(app);
 const classChoicesByCompletedRuns=[];
 for(let completedRuns=0;completedRuns<=3;completedRuns++){
  const state={gameProfileUnlocks:{[profile.id]:{completedRunIds:Array.from({length:completedRuns},(_,i)=>`completed-${i}`)}}};
  mountCustomize(app,{registries:reg,gameProfile:profile,fixedClasses:gameContent(profile,'classes'),profileClassUnlocks:true,meta:state,classAvailable:id=>gameProfileClassAvailable(profile,state,id),defaultSeedString:'TEST',onBack(){},onStart(){}});
  const visible=[...app.querySelectorAll('#cz-classes .cz-class')].map(card=>card.dataset.class);
  const lockedCard=app.querySelector('#cz-classes .cz-class.locked');
  const selectedBefore=app.querySelector('#cz-classes .is-selected')?.dataset.class||null;
  if(lockedCard){lockedCard.focus();lockedCard.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));lockedCard.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));lockedCard.click();}
  classChoicesByCompletedRuns.push({visible,locked:lockedCard?.dataset.class||null,note:lockedCard?.textContent.includes('Play 1 game to unlock.')||false,lock:!!lockedCard?.querySelector('[data-engraved-icon="lock"]'),focusable:lockedCard?lockedCard.tabIndex===0:null,disabled:lockedCard?.getAttribute('aria-disabled')==='true'||false,selectionUnchanged:!lockedCard||app.querySelector('#cz-classes .is-selected')?.dataset.class===selectedBefore});
 }
 const freshState={};
 let started; mountCustomize(app,{registries:reg,gameProfile:profile,fixedClasses:gameContent(profile,'classes'),profileClassUnlocks:true,meta:freshState,classAvailable:id=>gameProfileClassAvailable(profile,freshState,id),defaultSeedString:'TEST',onBack(){},onStart(config){started=config;}});
 const classStage=app.querySelector('.cz-railed').dataset.creationStage, count=app.querySelector('.cz-railed').dataset.creationStepCount;
 const locked=app.querySelectorAll('.cz-class.locked').length;
 const classText=app.querySelector('#cz-classes').textContent;
 const legacyClassCopy=reg.classes.all().filter(row => gameContent(profile,'classes').some(cls => cls.id===row.id)).some(row => !gameContent(profile,'classes').find(cls => cls.id===row.id).description || row.description !== gameContent(profile,'classes').find(cls => cls.id===row.id).description);
 app.querySelector('#cz-next').click(); const review=app.querySelector('.cz-railed').dataset.creationStage;
 const deckCount=app.querySelectorAll('.cc-starter-deck .card').length;
 const strengths=app.querySelector('.cc-summary-character [data-stat=strength]').textContent;
 app.querySelector('#cz-start').click();
 const run=createRunState({seed:1,registries:reg,...started});run.cinders=999;
 const offer=gameProfileShopStock(reg,run,createRng(1),{shopId:'test'});mountConfiguredShop(app,{registries:reg,run,offer,meta:{settings:{}},onTake(){},onLeave(){}});
 const shop=!!app.querySelector('.merchant-workspace'), offers=app.querySelectorAll('.merchant-offer').length;
 const rewards=gameProfileRewardOffers(reg,run,createRng(6),{offerId:'qa-reward'});
 const before=JSON.stringify(run.deck); let claims=0;
 const underlying=app.firstElementChild;
 const rewardOptions={registries:reg,run,offer:rewards,title:'Victory rewards',onTake(index){claims++;claimGameProfileReward(reg,run,'qa-reward',index);},onContinue(){}};
 mountGameProfileOffers(app,rewardOptions);
 const firstDoor=app.querySelector('.reward-door');
 mountGameProfileOffers(app,{...rewardOptions,offer:structuredClone(rewards)});
 const sameDoor=firstDoor===app.querySelector('.reward-door');
 const disabledBefore=app.querySelector('#reward-card-confirm').disabled;
 app.querySelector('.reward-choice-button').click();
 const selected=app.querySelectorAll('.reward-choice-button.is-chosen').length;
 app.querySelector('#reward-card-confirm').click();
 const preservesUnderlying=app.contains(underlying);
 const rewardDoor=!!app.querySelector('.reward-door'), deckUnchanged=before===JSON.stringify(run.deck), claimed=run.gameProfileRewardOffers['qa-reward'].taken.length;
 mountGameProfileOffers(app,{...rewardOptions,offer:{...rewards,id:'another-reward'}});
 const differentDoor=firstDoor!==app.querySelector('.reward-door');
 const serializable=JSON.stringify(run).includes('rewardDoorOwner')===false;
 return {classChoicesByCompletedRuns,classText,legacyClassCopy,sameDoor,differentDoor,serializable,preservesUnderlying,rewardDoor,disabledBefore,selected,claims,claimed,deckUnchanged,classStage,count,review,deckCount,strengths,locked,startedKeys:Object.keys(started).sort(),shop,offers};
 });
 assert.deepEqual(result.classChoicesByCompletedRuns,[
  {visible:['reaver','starseer'],locked:'starseer',note:true,lock:true,focusable:true,disabled:true,selectionUnchanged:true},
  {visible:['reaver','starseer','rogue'],locked:'rogue',note:true,lock:true,focusable:true,disabled:true,selectionUnchanged:true},
  {visible:['reaver','starseer','rogue','herald'],locked:'herald',note:true,lock:true,focusable:true,disabled:true,selectionUnchanged:true},
  {visible:['reaver','starseer','rogue','herald'],locked:null,note:false,lock:false,focusable:null,disabled:false,selectionUnchanged:true},
 ],'the configured creation chooser exposes only the next authored class lock');
 assert.equal(result.legacyClassCopy,false); assert.doesNotMatch(result.classText,/Mastery|bleed|rot that|second spell|poison|feats/i); assert.equal(result.classStage,'class'); assert.equal(result.count,'2'); assert.equal(result.review,'review'); assert.equal(result.deckCount,10); assert.match(result.strengths,/2/); assert.equal(result.locked,1); assert.deepEqual(result.startedKeys,['classId','gameProfile','seedString']); assert.equal(result.shop,true); assert.equal(result.offers,3); assert.equal(result.sameDoor,true); assert.equal(result.differentDoor,true); assert.equal(result.serializable,true); assert.equal(result.preservesUnderlying,true); assert.equal(result.rewardDoor,true); assert.equal(result.disabledBefore,true); assert.equal(result.selected,1); assert.equal(result.claims,1); assert.equal(result.claimed,1); assert.equal(result.deckUnchanged,true); console.log('Configured creation, merchant and reward UI contracts passed.');
} finally {await browser.close();server.close();}
