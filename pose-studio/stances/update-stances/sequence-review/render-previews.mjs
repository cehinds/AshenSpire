// Compose existing preview assets and labels; no new character artwork or tween frames.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { launchBrowser, serveDir } from '../../../../tools/browser.mjs';
const require = createRequire(import.meta.url);
let chromium;
try { ({chromium}=require('playwright')); } catch { ({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const folder=dirname(fileURLToPath(import.meta.url));
const output=resolve(folder,'renders');await mkdir(output,{recursive:true});
const server=await serveDir(folder);
const launcher=await launchBrowser({prefix:'seq-review-',args:['--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0'],browser:process.env.CHROME});
const browser=await chromium.connectOverCDP(launcher.wsUrl);
const context=await browser.newContext({viewport:{width:1160,height:1100}});
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const manifest={reviewOnly:true,timing:'350 ms per slot at 1×; hard cuts; no tween',outputs:[]};
try {
  await page.goto(server.url('index.html'));await page.waitForFunction(()=>window.__sequenceReview?.ready);
  await page.evaluate(()=>window.__sequenceReview.select('P','guard'));
  await page.screenshot({path:join(output,'player-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,'player-phone.png'),fullPage:true});await page.setViewportSize({width:1160,height:1100});
  const cases = process.env.ONLY_GUARD ? [['P','guard']] : [['P','guard'],['P','counter'],['A','guard'],['A','counter'],['B','guard'],['B','counter'],['P','attack'],['P','smash'],['P','evade']];
  for(const [variant,mode] of cases) {
    await page.evaluate(([v,m])=>window.__sequenceReview.select(v,m),[variant,mode]);
    const steps=await page.evaluate(()=>window.__sequenceReview.steps());
    const key=['attack','smash','evade'].includes(mode)?mode:`${variant.toLowerCase()}-${mode}`;
    const frames=[];
    for(let i=0;i<steps.length;i++){
      await page.evaluate(i=>window.__sequenceReview.seek(i),i);
      const data=await page.evaluate(()=>window.__sequenceReview.canvas.toDataURL('image/png').split(',')[1]);
      const name=`${key}-${String(i+1).padStart(2,'0')}.png`;await writeFile(join(output,name),Buffer.from(data,'base64'));frames.push(name);
    }
    manifest.outputs.push({key,variant,mode,order:steps.map(step=>step.code),durations:steps.map(step=>step.duration),frames,gif:`${key}.gif`,storyboard:`${key}-storyboard.png`});
  }
  if (!process.env.ONLY_GUARD) for (const mode of ['guard','attack','evade','counter']) {
    const origins=['T','S','C','D','E','W'];
    await page.evaluate(m=>{window.__sequenceReview.select('P',m);document.getElementById('context').checked=true;},mode);
    const orders={};const frames=[];
    const count=await page.evaluate(()=>window.__sequenceReview.steps().length);
    for(let i=0;i<count;i++) {
      const tiles=[];
      for(const origin of origins){
        const tile=await page.evaluate(({origin,mode,i})=>{window.__sequenceReview.select('P',mode,origin);document.getElementById('context').checked=true;window.__sequenceReview.seek(i);return {data:window.__sequenceReview.canvas.toDataURL(),order:window.__sequenceReview.steps().map(s=>s.code)};},{origin,mode,i});
        tiles.push({origin,name:({T:'Attack',S:'Smash',C:'Counter',D:'Defend',E:'Evade',W:'Sweep'})[origin],data:tile.data});orders[origin]=tile.order;
      }
      const data=await page.evaluate(async tiles=>{const canvas=document.createElement('canvas');canvas.width=1152;canvas.height=768;const ctx=canvas.getContext('2d');ctx.fillStyle='#192025';ctx.fillRect(0,0,1152,768);for(let i=0;i<tiles.length;i++){const image=new Image();image.src=tiles[i].data;await image.decode();const x=(i%3)*384,y=Math.floor(i/3)*384;ctx.fillStyle='#d1dfba';ctx.font='600 20px system-ui';ctx.fillText(`${tiles[i].name} (${tiles[i].origin}) · returns ${tiles[i].origin}`,x+12,y+26);ctx.drawImage(image,x,y+32,384,352);}return canvas.toDataURL('image/png').split(',')[1];},tiles);
      const name=`all-origins-${mode}-${String(i+1).padStart(2,'0')}.png`;await writeFile(join(output,name),Buffer.from(data,'base64'));frames.push(name);
    }
    manifest.outputs.push({key:`all-origins-${mode}`,mode,origins,orders,durations:Array(count).fill(350),frames,gif:`all-origins-${mode}.gif`,storyboard:null});
  }
  if(errors.length)throw Error(errors.join('\n'));
  await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const result=spawnSync(process.env.PYTHON??'python',['render-portable.py'],{cwd:folder,stdio:'inherit'});if(result.status!==0)throw Error('Portable renderer failed');
  console.log(`Rendered ${manifest.outputs.length} labeled animations and storyboards.`);
}finally{await context.close();await browser.close();await launcher.close();await server.close();}
