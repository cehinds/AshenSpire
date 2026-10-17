import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const dir=fileURLToPath(new URL('.',import.meta.url));
const config=JSON.parse(readFileSync(resolve(dir,'atmosphere.example.json')));
const base=JSON.parse(readFileSync(resolve(dir,'../batch-03/composition.example.json'))).presets.find(p=>p.id==='misty-clearing');
const files=new Map();
function url(file){const path=resolve(dir,file);if(!files.has(path))files.set(path,'/asset/'+files.size);return files.get(path);}
function scene(presetId,w,h){
 const p=config.presets[presetId],s=Math.max(w/1672,h/941),side=2*Math.max(w,h),textureScale=w/2048;
 const art=base.layersBackToFront.map((l,i)=>{
  const q=l.placement;
  const img=`<img class="art" src="${url('../batch-03/'+l.file)}" style="left:${q.left}px;top:${q.top}px;width:${q.width}px;height:${q.height}px">`;
  return img+(i===0&&p.lightning?config.lightning.frames.map((f,n)=>`<img class="art bolt" data-frame="${n}" src="${url(f.file)}" style="inset:0;width:1672px;height:941px;opacity:0">`).join(''):'');
 }).join('');
 const filters=(p.filters||[]).map(id=>`<img class="field" src="${url(config.filters[id].editableSource)}" style="width:${side}px;height:${side}px;left:${(w-side)/2}px;top:${(h-side)/2}px;opacity:${config.filters[id].opacity}">`).join('');
 const fog=p.fog?`<img class="field fog" data-width="${w}" data-height="${h}" src="${url(config.fog.editableSource)}" style="width:${side}px;height:${side}px;left:${(w-side)/2}px;top:${(h-side)/2}px;opacity:${config.fog.opacity}">`:'';
 const particles=(p.particles||[]).map(id=>{const a=config.particles[id];return `<div class="particles" data-dx="${a.motion.deltaSourcePixels.x*textureScale}" data-dy="${a.motion.deltaSourcePixels.y*textureScale}" data-duration="${a.motion.durationMs}" style="position:absolute;inset:0;background-image:url(${url(a.file)});background-repeat:repeat;background-size:${a.tileSizeSourcePixels*textureScale}px ${a.tileSizeSourcePixels*textureScale}px;opacity:${a.opacity}"></div>`;}).join('');
 return `<div class="scene" style="width:${w}px;height:${h}px"><div class="stage" style="width:1672px;height:941px;left:${(w-1672*s)/2}px;top:${(h-941*s)/2}px;transform:scale(${s})">${art}</div>${filters}${fog}${particles}</div>`;
}
const style='<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#162126;color:#e6e5dc;font:17px sans-serif}h1{font-size:25px;margin:0 0 18px}main{display:grid;gap:16px}article{background:#243338}p{margin:10px}.scene{position:relative;overflow:hidden;background:#222}.stage{position:absolute;transform-origin:0 0}.art,.field{position:absolute;pointer-events:none}.bolt{mix-blend-mode:screen}</style>';
const labels={clearDay:'Day',night:'Night',foggy:'Fog',storm:'Storm + rain + distant lightning',swamp:'Swamp',hot:'Hot + falling ash',rain:'Rain',cold:'Cold + snow'};
const script=`<script>
const motionConfig=${JSON.stringify({fog:config.fog.motion,lightning:config.lightning})};
window.setPreviewTime=ms=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 for(const e of document.querySelectorAll('.particles')){const f=reduced?0:(ms%Number(e.dataset.duration))/Number(e.dataset.duration);e.style.backgroundPosition=(Number(e.dataset.dx)*f)+'px '+(Number(e.dataset.dy)*f)+'px';}
 for(const e of document.querySelectorAll('.fog')){const f=reduced?0:Math.sin(ms/motionConfig.fog.durationMs*Math.PI*2);e.style.transform='translate('+f*Number(e.dataset.width)*motionConfig.fog.amplitudeViewportUnits.x+'px,'+f*Number(e.dataset.height)*motionConfig.fog.amplitudeViewportUnits.y+'px)';}
 const lightning=motionConfig.lightning,total=lightning.frames.reduce((n,f)=>n+f.durationMs,0);
 let start=lightning.initialHiddenIntervalMs,cycle=0;
 for(;;){const random=((Math.imul(cycle+1,1664525)+1013904223)>>>0)/4294967296;const gap=lightning.hiddenIntervalMs.min+random*(lightning.hiddenIntervalMs.max-lightning.hiddenIntervalMs.min);if(ms<start+total+gap)break;start+=total+gap;cycle++;}
 for(const e of document.querySelectorAll('.bolt')){const index=Number(e.dataset.frame),before=lightning.frames.slice(0,index).reduce((n,f)=>n+f.durationMs,0),frame=lightning.frames[index],elapsed=ms-start;e.style.opacity=!reduced&&elapsed>=before&&elapsed<before+frame.durationMs?frame.opacity:0;}
};
window.setPreviewTime(0);
</script>`;
const all=style+'<h1>Translucent atmosphere presets · same scene underneath</h1><main style="grid-template-columns:repeat(2,600px)">'+Object.keys(labels).map(id=>'<article>'+scene(id,600,338)+'<p>'+labels[id]+'</p></article>').join('')+'</main>'+script;
const motion=style+'<h1>Weather motion · distant strike after 12 seconds</h1><main style="grid-template-columns:repeat(2,600px)">'+['storm','cold','hot','foggy'].map(id=>'<article>'+scene(id,600,338)+'<p>'+labels[id]+'</p></article>').join('')+'</main>'+script;
const crops=style+'<h1>Overscan coverage · portrait / widescreen / ultrawide</h1><p>Fog + swamp tint. Scene composition is cropped for illustration; gameplay camera framing remains separate.</p><main style="grid-template-columns:260px 1fr"><article>'+scene('swamp',260,462)+'<p>9:16 portrait</p></article><div><article>'+scene('swamp',800,450)+'<p>16:9 widescreen</p></article><article style="margin-top:16px">'+scene('swamp',800,338)+'<p>21:9 ultrawide</p></article></div></main>'+script;
const pages=new Map([['/',all],['/motion',motion],['/crops',crops]]),byUrl=new Map([...files].map(([path,u])=>[u,path]));
const server=createServer((req,res)=>{if(pages.has(req.url)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(pages.get(req.url));}else if(byUrl.has(req.url)){const p=byUrl.get(req.url);res.setHeader('Content-Type',p.endsWith('.svg')?'image/svg+xml':'image/png');res.end(readFileSync(p));}else{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1264,height:900},deviceScaleFactor:1});
 for(const [route,file] of [['/','preview-atmospheres.png'],['/crops','preview-resolution-crops.png']]){
  await page.goto('http://127.0.0.1:'+server.address().port+route);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.evaluate(()=>window.setPreviewTime(12090));await page.screenshot({path:resolve(dir,file),fullPage:true});
 }
 await page.close();
 if(process.argv.includes('--video')){
  const temp=mkdtempSync('/tmp/ashen-atmosphere-frames-');
  const videoPage=await browser.newPage({viewport:{width:1264,height:854},deviceScaleFactor:1});
  await videoPage.goto('http://127.0.0.1:'+server.address().port+'/motion');
  await videoPage.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  const fps=25,frames=400;
  for(let frame=0;frame<frames;frame++){
   await videoPage.evaluate(ms=>window.setPreviewTime(ms),frame*1000/fps);
   await videoPage.screenshot({path:resolve(temp,String(frame).padStart(4,'0')+'.jpg'),type:'jpeg',quality:88});
   if(frame%100===0)console.log('Motion preview frame '+frame+'/'+frames);
  }
  await videoPage.close();
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',resolve(temp,'%04d.jpg'),'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',resolve(dir,'preview-weather-motion.mp4')]);
  rmSync(temp,{recursive:true,force:true});
 }
 console.log('Rendered atmosphere and resolution sheets'+(process.argv.includes('--video')?' plus16-second weather video.':'.'));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
