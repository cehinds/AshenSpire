const fs=require('fs'), path=require('path'), http=require('http'), {chromium}=require('playwright');
const [game,art,out,tier='hd']=process.argv.slice(2);
const mime={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.css':'text/css','.html':'text/html'};
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><meta charset="utf-8"><title>Selected counter and sweep runtime verification</title><body style="background:#dadbdc;color:#222;font:16px sans-serif"><h1>Selected counter and sweep runtime clips</h1><main style="display:grid;grid-template-columns:repeat(2,1fr);gap:32px"></main></body></html>');return;}
  const file=path.resolve(name.startsWith('/assets/')?path.join(art,tier):game,'.'+name);
  if(!file.startsWith(path.resolve(game))&&!file.startsWith(path.resolve(art))){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(8817,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.url())});
  await page.goto('http://127.0.0.1:8817/');
  await page.evaluate(async()=>{
    const {createAlternativeCardStage}=await import('/src/ui/alternativeCardStage.js');
    const {playerCounterSweepSprites}=await import('/src/content/playerCounterSweepSprites.js');
    const {resolveCombatAnimation}=await import('/src/model/combatAnimation.js');
    window.prepareCounter=classId=>resolveCombatAnimation({cardTags:['camp:physical','maneuver:counter']},[],{classId});
    window.stages=[];window.selections=playerCounterSweepSprites;
    for(const actor of ['reaver','starseer','herald','rogue'])for(const action of ['counter','sweep']){
      const panel=document.createElement('section');panel.style.cssText='padding:20px;background:#303943;color:#f4efe6;min-height:300px;overflow:visible';
      const title=document.createElement('h2');title.textContent=actor+' · '+action;title.style.fontSize='16px';panel.append(title);
      const stage=createAlternativeCardStage(actor);panel.append(stage.el);stage.el.style.margin='24px auto';
      const button=document.createElement('button');button.textContent='Play';button.onclick=()=>stage.play(action,520);panel.append(button);
      document.querySelector('main').append(panel);await stage.ready;
      window.stages.push({actor,action,stage});stage.seek(action,70,260);
    }
  });
  await page.screenshot({path:path.join(out,'contact.png'),fullPage:true});
  const evidence=await page.evaluate(async()=>{
    const assert=(ok,message)=>{if(!ok)throw Error(message)};
    for(const {actor,action,stage} of stages){
      assert(!stage.el.dataset.artError,actor+' asset load');
      assert(stage.el.dataset.effect===selections[actor].sequences[action].effects[1],actor+' contact effect');
      assert(stage.currentArt.image.src.includes('/contact.webp'),actor+' selected contact');
      if(action==='sweep')assert(stage.currentArt.left>128,actor+' forward sweep motion');
      stage.seek(action,130,260);assert(stage.el.dataset.effect.endsWith('effect-2'),actor+' recovery');
      stage.seek(action,200,260);assert(stage.pose==='ready'&&!stage.el.dataset.effect,actor+' idle cleanup');
      if(action==='counter'){
        const plan=prepareCounter(actor);assert(plan.rest==='counter',actor+' preparation rest');
        stage.seek(plan.technique,130,260);
        assert(stage.pose===actor+'.counter.stance'&&!stage.el.dataset.effect,actor+' preparation holds without a counterattack');
      }
      stage.setStance(action);stage.settle();assert(stage.pose==='stance-'+action,actor+' held stance');
      stage.setRestPose('defeated');assert(stage.pose==='defeated'&&!stage.el.dataset.effect,actor+' defeat overrides stance');
      stage.setRestPose('idle');stage.setStance(null);
      stage.play(action,260);
    }
    await new Promise(r=>setTimeout(r,400));
    for(const {stage} of stages)assert(stage.pose==='ready'&&!stage.el.dataset.effect,'playback returns original idle');
    document.body.classList.add('reduce-flashes');
    for(const {action,stage} of stages){stage.seek(action,70,260);assert(!stage.el.dataset.effect,'reduced flashes suppress trails');}
    document.body.classList.remove('reduce-flashes');document.body.classList.add('reduced-motion');
    // The explicit settle path used by instant/reduced playback clears both layers.
    for(const {stage} of stages){stage.settle();assert(!stage.el.dataset.effect,'settle clears trails');}
    return {clips:8,contactAndRecoveryEffects:true,originalIdle:true,heldStances:true,counterPreparation:true,sweepTravel:true,defeatPriority:true,reduceFlashes:true};
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{for(const {action,stage} of stages){stage.play(action,260);if(stage.el.dataset.effect||stage.pose!=='ready')throw Error('reduced motion playback');}});
  evidence.reducedMotion=true;
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{document.body.classList.remove('reduced-motion');for(const {action,stage} of stages){stage.setStance(action);stage.settle();}});
  await page.screenshot({path:path.join(out,'stances.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.querySelector('main').style.gridTemplateColumns='1fr';});
  await page.screenshot({path:path.join(out,'phone.png'),fullPage:true});
  evidence.assetTier=tier;evidence.errors=errors;fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(evidence,null,2)+'\n');
  await browser.close();server.close();if(errors.length)throw Error(errors.join('\n'));console.log(evidence);
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
