// Focused production-preview caster/recipient contract; requires staged effect art.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// Same optional installed-tool seam as the other browser suites.
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, relative, sep } from 'node:path';
import { artPath, packTreeOf } from '../tools/art-source.mjs';
const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'scratch/recipient-effects/caster-review');await mkdir(out,{recursive:true});
// Read-only source serving: this focused test does not restamp a game build.
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(root, '.' + path);
  if (relative(root, file).startsWith('..' + sep)) { res.writeHead(403).end(); return; }
  try {
    const content = await readFile(packTreeOf(path.slice(1)) ? artPath(path.slice(1), { root }) : file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg' })[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:1100}});
const report={cases:[],errors:[]};page.on('pageerror',error=>report.errors.push(error.message));
const cases=[
  {name:'player-self-buff',label:'Player → self buff',invoker:'player',recipient:'player',outcome:'wisdom'},
  {name:'player-enemy-spell',label:'Player → enemy spell',invoker:'player',recipient:'enemy-1',outcome:'hit'},
  {name:'enemy-self-buff',label:'Enemy → self buff',invoker:'enemy-1',recipient:'enemy-1',outcome:'wisdom'},
  {name:'enemy-player-spell',label:'Enemy → player spell',invoker:'enemy-1',recipient:'player',outcome:'hit'},
];
try {
  await page.goto(baseUrl+'/tools/recipient-effects-runtime-preview.html?artRoot=/scratch/recipient-effects/integration-art/hd/');
  await page.waitForFunction(()=>window.recipientRuntimePreview);
  assert.equal(await page.locator('#invoker').inputValue(),'player');
  for(const item of cases){
    const state=await page.evaluate(async item=>recipientRuntimePreview.configure({invoker:item.invoker,recipient:item.recipient,outcome:item.outcome,camp:'spell',action:'casting',school:'none',range:'melee'}),item);
    const circle=state.recipes.find(r=>r.shape==='spell-circle');
    const followup=state.recipes.find(r=>r.shape!=='spell-circle');
    assert.equal(circle.sourceId,item.invoker);assert.equal(circle.targetId,item.invoker);assert.deepEqual(circle.targetIds,[item.invoker]);assert.equal(circle.targetType,'self');
    assert.equal(followup.sourceId,item.invoker);assert.equal(followup.targetId,item.recipient);
    const frames=[];
    for(const [phase,clip,id] of [['circle',circle,item.invoker],['followup',followup,item.recipient]]){
      await page.evaluate(ms=>recipientRuntimePreview.scrub(ms),(clip.delayMs||0)+clip.durationMs/2);
      const snapshot=await page.evaluate(()=>integrationQA.snapshot());
      const effect=snapshot.effects.find(e=>e.dataset.shape===clip.shape);assert.ok(effect,phase+' is visible');assert.equal(effect.dataset.renderer,'art');
      const target=snapshot.actors[id].box;
      assert.ok(Math.abs(effect.left+effect.width/2-(target.left+target.width/2))<2,phase+' is centered on '+id);
      if(phase==='followup')assert.ok(snapshot.effects.every(e=>e.dataset.shape!=='spell-circle'),'circle ends before follow-up');
      const file=resolve(out,item.name+'-'+phase+'.png');await page.locator('#viewport').screenshot({path:file});frames.push({phase,file,effect});
    }
    report.cases.push({...item,recipes:state.recipes,frames});
  }
  // Changing the recipient must not silently reverse the invoker.
  await page.locator('#recipient').selectOption('enemy-1');assert.equal(await page.locator('#invoker').inputValue(),'enemy-1');
  const ward=await page.evaluate(()=>recipientRuntimePreview.configure({invoker:'enemy-1',recipient:'player',outcome:'ward'}));
  assert.equal(ward.recipes.find(r=>r.shape==='ward').sourceId,'enemy-1');
  assert.equal(ward.recipes.find(r=>r.shape==='ward').targetId,'player');
  assert.equal(ward.recipes.find(r=>r.shape==='spell-circle').targetId,'enemy-1');
  const circleState=await page.evaluate(()=>recipientRuntimePreview.configure({invoker:'player',recipient:'enemy-1',outcome:'hit',camp:'spell',action:'casting',school:'none'}));
  const expanding=circleState.recipes.find(r=>r.shape==='spell-circle');report.circleFrames=[];
  for(let frame=0;frame<3;frame++){
    await page.evaluate(ms=>recipientRuntimePreview.scrub(ms),expanding.durationMs*(frame+.5)/3);
    const painted=await page.evaluate(()=>{
      const host=document.querySelector('.recipient-effect[data-shape="spell-circle"]'),canvas=host.querySelector('canvas');
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      return{png:canvas.toDataURL(),bounds:{left,top,right,bottom,width:right-left+1,height:bottom-top+1},host:{left:host.style.left,top:host.style.top,width:host.style.width,height:host.style.height}};
    });
    await writeFile(resolve(out,'circle-expansion-'+(frame+1)+'.png'),Buffer.from(painted.png.split(',')[1],'base64'));delete painted.png;
    report.circleFrames.push(painted);
  }
  for(let i=1;i<3;i++){
    assert.deepEqual(report.circleFrames[i].host,report.circleFrames[0].host,'expansion keeps one fixed caster anchor');
    assert.ok(report.circleFrames[i].bounds.width>report.circleFrames[i-1].bounds.width,'painted width grows');
    assert.ok(report.circleFrames[i].bounds.height>report.circleFrames[i-1].bounds.height,'painted height grows');
  }
  assert.deepEqual(report.errors,[]);report.pass=true;
  console.log('PASS four independent invoker/recipient cases, Ward source identity and expanding three-frame circle.');
} finally {
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));
}
