import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodePng,encodePng,contentBox,resample} from '../../tools/concept-cutout.mjs';
const here=dirname(fileURLToPath(import.meta.url)),repo=join(here,'../..');
const jobs=JSON.parse(readFileSync(join(here,'generation.json'))).enemies;
const out=join(repo,'assets/enemy-poses');mkdirSync(out,{recursive:true});
const entries=[];
for(const job of jobs){
 const dir=join(here,'frames',job.id);mkdirSync(dir,{recursive:true});
 const log=execFileSync(process.execPath,['tools/painted-poses.mjs','--sheet',join(here,'sheets',job.id+'.png'),'--class',job.id,'--poses',job.old?'idle,attack':'attack','--out',dir,'--canvas','1800x1800','--grounded'],{cwd:repo,encoding:'utf8'});
 writeFileSync(join(dir,'extraction.log'),log);
 const manifest=JSON.parse(readFileSync(join(dir,'lowpoly-renders.manifest.json')));
 const frames=manifest.renders.map(r=>{const img=decodePng(readFileSync(join(dir,r.file)));return {r,img,box:contentBox(img)};});
 // Preserve the relative scale between poses extracted from one sheet.
 const scale=Math.min(...frames.map(({box:b})=>Math.min(348/(b.x1-b.x0+1),344/(b.y1-b.y0+1))));
 for(const {r,img,box:b} of frames){
  const w=b.x1-b.x0+1,h=b.y1-b.y0+1,dw=Math.max(1,Math.round(w*scale)),dh=Math.max(1,Math.round(h*scale));
  const small=resample(img,b.x0,b.y0,w,h,dw,dh),rgba=Buffer.alloc(384*384*4);
  const x=Math.round((384-dw)/2),y=364-dh+1;
  for(let row=0;row<dh;row++)small.px.copy(rgba,((y+row)*384+x)*4,row*dw*4,(row+1)*dw*4);
  writeFileSync(join(out,r.file),encodePng(384,384,rgba));
 }
 if(!job.old)copyFileSync(join(repo,job.ref),join(out,job.id+'_idle.png'));
 entries.push({id:job.id,name:job.name,legacy:job.old,idle:job.id+'_idle.png',attack:job.id+'_attack.png',source:job.ref});
 console.log(job.id+' ready');
}
writeFileSync(join(out,'manifest.json'),JSON.stringify({schema:'ashenspire/enemy-poses/v1',canvas:[384,384],ground:364,facing:'left',entries},null,2)+'\n');
const cards=entries.map(e=>`<article data-name="${e.name.toLowerCase()}"><h2>${e.name}</h2><p>${e.legacy?'New painted idle + attack':'Existing painted idle + new attack'}</p><div class="pair"><figure><img src="../../assets/enemy-poses/${e.idle}" alt="${e.name} idle"><figcaption>Idle</figcaption></figure><figure><img src="../../assets/enemy-poses/${e.attack}" alt="${e.name} attack"><figcaption>Attack</figcaption></figure></div><details><summary>Compare original / play attack</summary><div class="pair"><figure><img src="../../${e.source}" alt="${e.name} original"><figcaption>Original</figcaption></figure><figure><img class="play" data-idle="../../assets/enemy-poses/${e.idle}" data-attack="../../assets/enemy-poses/${e.attack}" src="../../assets/enemy-poses/${e.idle}" alt="${e.name} playback"><figcaption><button type="button">Play attack</button></figcaption></figure></div></details><a href="sheets/${e.id}.png">Full-resolution source</a></article>`).join('\n');
writeFileSync(join(here,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire — Enemy poses</title><style>*{box-sizing:border-box}body{margin:0;background:#141210;color:#eee4d1;font:16px system-ui;padding:28px}header{max-width:1000px;margin:auto auto 28px}h1{font:36px Georgia;color:#dfb966}input,button{font:inherit;padding:10px;background:#302a21;color:inherit;border:1px solid #79603d;border-radius:6px}input{width:100%}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:20px}article{padding:20px;background:#201c18;border:1px solid #4e4030;border-radius:12px}h2{margin:0;color:#e5c984;font:25px Georgia}p,figcaption{color:#bcb09b}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}figure{margin:0;text-align:center}img{width:100%;height:auto;aspect-ratio:1;object-fit:contain;background:radial-gradient(ellipse,#42392a,#171510 72%)}img[src$="_attack.png"]{transform:scale(1.05);transform-origin:50% 94.791667%}.play.playing{animation:gallery-attack 650ms ease-out;transform-origin:50% 94.791667%}@keyframes gallery-attack{0%,100%{transform:none}24%{transform:translateX(6px) rotate(3deg)}55%{transform:translateX(-12px) rotate(-3deg) scale(1.05)}}@media(prefers-reduced-motion:reduce){.play.playing{animation:none}}figcaption{padding:8px}a{color:#dfb966}details{margin:15px 0}summary{cursor:pointer}article[hidden]{display:none}</style><header><h1>AshenSpire · Enemy poses</h1><p>33 enemies · 7 painted replacements · 33 individual attack poses. Compare each idle and attack, inspect its original design, or play the two-frame transition.</p><input aria-label="Find enemy" placeholder="Find an enemy…"></header><main>${cards}</main><script>document.querySelector('input').addEventListener('input',e=>document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.name.includes(e.target.value.toLowerCase())));document.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const img=b.closest('figure').querySelector('img');b.disabled=true;img.classList.add("playing");setTimeout(()=>{img.src=img.dataset.attack},163);setTimeout(()=>{img.src=img.dataset.idle},520);setTimeout(()=>{img.classList.remove("playing");b.disabled=false},650)}));</script></html>`);
