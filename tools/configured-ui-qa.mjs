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
 const [{contentBundle},{createRegistries},{resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries,gameContent},{mountCustomize},{gameProfileClassAvailable},{createRunState},{mountConfiguredShop},{createRng},{gameProfileShopStock}]=await Promise.all([import('/src/content/index.js'),import('/src/model/registries.js'),import('/src/model/gameProfile.js'),import('/src/ui/screens/customize.js'),import('/src/model/gameProfileRun.js'),import('/src/model/state.js'),import('/src/ui/screens/shop.js'),import('/src/engine/rng.js'),import('/src/model/gameProfileRewards.js')]);
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
 return {classStage,count,review,deckCount,strengths,locked,startedKeys:Object.keys(started).sort(),shop:!!app.querySelector('.merchant-workspace'),offers:app.querySelectorAll('.merchant-offer').length};
 });
 assert.equal(result.classStage,'class'); assert.equal(result.count,'2'); assert.equal(result.review,'review'); assert.equal(result.deckCount,10); assert.match(result.strengths,/2/); assert.equal(result.locked,3); assert.deepEqual(result.startedKeys,['classId','gameProfile','seedString']); assert.equal(result.shop,true); assert.equal(result.offers,3); console.log('Configured creation and merchant UI contracts passed.');
} finally {await browser.close();server.close();}
