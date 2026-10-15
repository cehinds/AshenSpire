import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import {serve} from './serve.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {server,port}=await serve({root:path.resolve('.'),port:0,open:false,quiet:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME ? {executablePath:process.env.CHROME} : {}),args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); await page.route('**/ui-probe.html', route => route.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'})); await page.goto(`http://127.0.0.1:${port}/ui-probe.html`);
 const result=await page.evaluate(async()=>{
 const [{contentBundle},{createRegistries},{resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries,gameContent},{mountCustomize},{gameProfileClassAvailable},{createRunState},{mountConfiguredShop},{createRng},{gameProfileShopStock,gameProfileRewardOffers,claimGameProfileReward},{mountGameProfileOffers}]=await Promise.all([import('/src/content/index.js'),import('/src/model/registries.js'),import('/src/model/gameProfile.js'),import('/src/ui/screens/customize.js'),import('/src/model/gameProfileRun.js'),import('/src/model/state.js'),import('/src/ui/screens/shop.js'),import('/src/engine/rng.js'),import('/src/model/gameProfileRewards.js'),import('/src/ui/components/gameProfileOffers.js')]);
 const profile=resolveGameProfile('core'),reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
 document.body.replaceChildren();const app=document.createElement('main');document.body.append(app);
 let started; mountCustomize(app,{registries:reg,gameProfile:profile,fixedClasses:gameContent(profile,'classes'),classAvailable:id=>gameProfileClassAvailable(profile,{},id),defaultSeedString:'TEST',onBack(){},onStart(config){started=config;}});
 const classStage=app.querySelector('.cz-railed').dataset.creationStage, count=app.querySelector('.cz-railed').dataset.creationStepCount;
 const locked=app.querySelectorAll('.cz-class.locked').length;
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
 mountGameProfileOffers(app,{registries:reg,run,offer:rewards,title:'Victory rewards',onTake(index){claims++;claimGameProfileReward(reg,run,'qa-reward',index);},onContinue(){}});
 const disabledBefore=app.querySelector('#reward-card-confirm').disabled;
 app.querySelector('.reward-choice-button').click();
 const selected=app.querySelectorAll('.reward-choice-button.is-chosen').length;
 app.querySelector('#reward-card-confirm').click();
 const preservesUnderlying=app.contains(underlying);
 const rewardDoor=!!app.querySelector('.reward-door'), deckUnchanged=before===JSON.stringify(run.deck), claimed=run.gameProfileRewardOffers['qa-reward'].taken.length;
 return {preservesUnderlying,rewardDoor,disabledBefore,selected,claims,claimed,deckUnchanged,classStage,count,review,deckCount,strengths,locked,startedKeys:Object.keys(started).sort(),shop,offers};
 });
 assert.equal(result.classStage,'class'); assert.equal(result.count,'2'); assert.equal(result.review,'review'); assert.equal(result.deckCount,10); assert.match(result.strengths,/2/); assert.equal(result.locked,3); assert.deepEqual(result.startedKeys,['classId','gameProfile','seedString']); assert.equal(result.shop,true); assert.equal(result.offers,3); assert.equal(result.preservesUnderlying,true); assert.equal(result.rewardDoor,true); assert.equal(result.disabledBefore,true); assert.equal(result.selected,1); assert.equal(result.claims,1); assert.equal(result.claimed,1); assert.equal(result.deckUnchanged,true); console.log('Configured creation, merchant and reward UI contracts passed.');
} finally {await browser.close();server.close();}
