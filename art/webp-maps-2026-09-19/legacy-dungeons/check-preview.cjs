const {chromium}=require('C:/Users/suprbludude/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/art/webp-maps-2026-09-19/legacy-dungeons/index.html');
 await page.locator('#painting').evaluate(im=>im.decode());
 for(const [id,name] of [['BS','Briar Sanctum'],['HM','Hall of Mirrors'],['FC','Furnace Chapel']]){
  await page.getByRole('button',{name,exact:true}).click();
  await page.locator('#painting').evaluate(im=>im.decode());
  if(await page.locator('.marker').count()!==24)throw Error('Missing nodes');
  await page.screenshot({path:path.join(__dirname,id+'-atlas.png'),fullPage:true});
 }
 await page.getByRole('button',{name:'Briar Sanctum',exact:true}).click();
 await page.getByRole('button',{name:'Explore',exact:true}).click();
 await page.getByRole('button',{name:'Enter the dungeon',exact:true}).click();
 await page.locator('.marker[aria-label^="BS-02"]').click();
 await page.getByRole('button',{name:'Travel here',exact:true}).click();
 await page.getByRole('button',{name:'Record observation',exact:true}).click();
 await page.locator('.marker[aria-label^="BS-03"]').click();
 await page.getByRole('button',{name:'Travel here',exact:true}).click();
 await page.screenshot({path:path.join(__dirname,'BS-dialogue.png'),fullPage:true});
 await page.getByRole('button',{name:'Hear them out · Pass peacefully',exact:true}).click();
 const cleared=await page.evaluate(()=>state().resolved.has('BS-03'));if(!cleared)throw Error('Peaceful resolution failed');
 // Use graph-derived paths to exercise reachability and boss outcome in each dungeon.
 for(const id of ['BS','HM','FC']){
  const report=await page.evaluate(id=>{switchDungeon(id);mode='explore';let s=state();s.resolved.add(s.current);let queue=[[s.current]],found;while(queue.length){const p=queue.shift();if(p.at(-1)===dungeon.bossNode){found=p;break}for(const x of neighbors(p.at(-1)))if(!p.includes(x))queue.push([...p,x]);}for(const x of found.slice(1)){enter(x);if(state().current!==x)throw Error('Travel rejected '+x);if(x!==dungeon.bossNode)state().resolved.add(x)}render();return {id,current:state().current,path:found}},id);
  await page.getByRole('button',{name:/^Confront /}).click();await page.getByRole('button',{name:'Simulate victory',exact:true}).click();
  if(!await page.evaluate(()=>state().cleared))throw Error('Boss clear failed');
  console.log(JSON.stringify(report));
 }
 await page.screenshot({path:path.join(__dirname,'FC-cleared.png'),fullPage:true});
 // Escape math and both roll outcomes, with controlled randomness only in this test.
 await page.evaluate(()=>{switchDungeon('BS');delete states.BS;mode='explore';const s=state();s.current='BS-03';s.previous='BS-02';s.visited.add('BS-02');s.visited.add('BS-03');selected='BS-03';render();});
 const chances=await page.evaluate(()=>{return [1,10,14,40].map(v=>{$('#dex').value=v;return chance()})});
 if(JSON.stringify(chances)!=='[13,40,52,85]')throw Error('Chance math failed');
 await page.evaluate(()=>{$('#dex').value=14;const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>{a[0]=0;return a};flee();crypto.getRandomValues=original;});
 if(await page.evaluate(()=>state().current)!=='BS-02')throw Error('Flee retreat failed');
 await page.evaluate(()=>{state().current='BS-03';selected='BS-03';const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>{a[0]=4294967295;return a};flee();crypto.getRandomValues=original;});
 if(await page.evaluate(()=>combat)!=='BS-03')throw Error('Flee failure did not fight');
 await page.getByRole('button',{name:'Simulate defeat · Return to entrance',exact:true}).click();
 if(await page.evaluate(()=>state().current)!=='BS-01')throw Error('Defeat failed');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'mobile-preview.png'),fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Document overflow');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: atlas counts, dialogue, connected travel, three bosses, clear state, escape success/failure, defeat, mobile overflow, no browser errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
