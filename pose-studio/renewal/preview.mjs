import { ANIM_SPEEDS } from '../../src/ui/fx.js';
import { auraFilter } from '../../src/ui/combatAura.js';
import { COMBAT_EFFECT_ART } from '../../src/content/combatEffectArt.js';
import { alternativeArtCatalog } from '../../src/ui/alternativeArtCatalog.js';
import { durationFor, sampleSequence, hitFlashOpacity } from './model.mjs';

const $=s=>document.querySelector(s), canvas=$('#preview'), ctx=canvas.getContext('2d');
const flashCanvas=document.createElement('canvas');flashCanvas.width=flashCanvas.height=512;
const flashContext=flashCanvas.getContext('2d');
const response=await fetch('./manifest.json');
if(!response.ok)throw Error('Cannot load renewal manifest');
const manifest=await response.json(), images=new Map(), families=new Map([['reaver/sword',manifest]]);
for(const [key,entry] of Object.entries(manifest.families||{})){if(entry.manifest){const r=await fetch('./'+entry.manifest);if(!r.ok)throw Error('Cannot load family: '+key);families.set(key,await r.json());}}
let action='attack', time=0, playing=false, last=0, ready=false, cyclePause=0;
const familyKey=()=>$('#actor').value+'/'+$('#loadout').value;
const family=()=>families.get(familyKey())||manifest;
const available=()=>families.has(familyKey());
const seq=()=>family().sequences[action];
const duration=()=>durationFor(seq(),ANIM_SPEEDS[$('#pace').value]);
const message=t=>$('#message').textContent=t;
async function image(url){
 if(!images.has(url))images.set(url,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Missing image: '+url));img.src=url;}));
 return images.get(url);
}
let decoded=new Map();
async function preload(){
 const urls=[...families.values()].flatMap(m=>Object.values(m.frames).flatMap(f=>[f.path,f.lite]));
 urls.push(...['slash','ward','starbolt','shieldBash'].flatMap(e=>COMBAT_EFFECT_ART[e].map(p=>'../../'+p.replace('assets/','assets-mobile/'))));
 urls.push(...manifest.classes.map(c=>'../../'+alternativeArtCatalog.sprites[c+'-default'].path));
 await Promise.all(urls.map(async u=>decoded.set(u,await image(u))));
 ready=true;render();message('Reaver / sword and Rogue / twin daggers are drafted; 38 base combinations remain pending.');
}
$('#actor').innerHTML=manifest.classes.map(c=>`<option value="${c}">${c[0].toUpperCase()+c.slice(1)}</option>`).join('');
$('#loadout').innerHTML=manifest.loadouts.map(l=>`<option value="${l.id}">${l.label}</option>`).join('');
$('#actions').innerHTML=Object.entries(manifest.sequences).map(([id,s])=>`<button data-action="${id}">${s.label}</button>`).join('');
function stop(){playing=false;$('#play').textContent='▶ Play';}
function reset(){time=0;cyclePause=0;render();}
function selection(){
 stop();reset();
 const drafted=available();
 const entry=manifest.families?.[familyKey()];
 $('#workshop-project').hidden=!drafted;$('#workshop-project').href=entry?.rig||'reaver-sword.rig.json';
 document.querySelector('[data-action=attack]').textContent=family().sequences.attack.label;
 $('#coverage').textContent=drafted?'Draft · 5 actions to inspect':'Pending · base reference only';
 $('#play').disabled=$('#restart').disabled=$('#scrub').disabled=!drafted||!ready;
 document.querySelectorAll('[data-action]').forEach(b=>{b.disabled=!drafted;b.classList.toggle('active',b.dataset.action===action);});
 $('#stage-label').textContent=`${$('#actor').value.toUpperCase()} · BASE ARMOUR · ${$('#loadout').selectedOptions[0].textContent.toUpperCase()}`;
 $('#action-note').textContent=action==='down'?'Down holds its final pose until Restart.':action==='power'||action==='spell'?'Weapons are sheathed while casting. Draw / sheath transitions still need review.':'Forward travel returns to the same stance anchor.';
 $('#edit').hidden=!drafted||!['attack','power','spell'].includes(action);
 $('#edit').href='../index.html?renewal='+action+'&family='+$('#actor').value;
 $('#board').innerHTML=manifest.coverage.filter(r=>r.classId===$('#actor').value).map(r=>`<div class="card ${r.status}">${manifest.loadouts.find(l=>l.id===r.loadout).label}<span>${r.status==='draft'?'Draft · attack / hurt / down / casts':'Pending artwork'}</span></div>`).join('');
 $('#timeline').innerHTML=drafted?seq().poses.map((p,i)=>`<button class="frame" data-frame="${i}" aria-label="Inspect ${p}"><img src="${family().frames[p].path}" alt="${p}"><span>${String(i+1).padStart(2,'0')} · ${p}</span></button>`).join(''):'';
 render();
}
function drawFigure(img,x,y,size,filter='none'){
 ctx.save();ctx.filter=filter;ctx.drawImage(img,x-size/2,y-size,size,size);ctx.restore();
}
function render(){
 const d=duration(), sampled=sampleSequence(seq(),time,d,{reduced:$('#reduced').checked});
 $('#scrub').max=d||1;$('#scrub').value=Math.min(time,d);
 $('#clock').textContent=`${Math.round(Math.min(time,d))} / ${Math.round(d)} ms`;
 $('#metrics').textContent=available()?`${seq().poses.length} poses · ${Math.round(d)} ms · ${Math.max(...seq().travel.map(Math.abs))} px maximum travel · ${Math.round(family().bytes[$('#quality').value==='lite'?'lite':'webp']/1024)} KB for all 12 poses`:"No animation artwork for this class / loadout yet";
 document.querySelectorAll('[data-frame]').forEach(b=>b.classList.toggle('active',Number(b.dataset.frame)===sampled.index));
 const grad=ctx.createLinearGradient(0,0,0,580);grad.addColorStop(0,'#121d19');grad.addColorStop(1,'#29392b');ctx.fillStyle=grad;ctx.fillRect(0,0,1000,580);
 ctx.strokeStyle='#a8bd9d12';ctx.lineWidth=1;for(let x=0;x<1000;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,580);ctx.stroke();}for(let y=30;y<580;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke();}
 ctx.strokeStyle='#859b6755';ctx.beginPath();ctx.moveTo(120,486);ctx.lineTo(880,486);ctx.stroke();
 if(!ready)return;
 if(!available()){
   const art=alternativeArtCatalog.sprites[$('#actor').value+'-default'],img=decoded.get('../../'+art.path),[x,y,x1,y1]=art.bounds;
   const scale=365/(y1-y);ctx.drawImage(img,x,y,x1-x,y1-y,500-(x1-x)*scale/2,486-365,(x1-x)*scale,365);
   ctx.fillStyle='#d6c49b';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('Base reference · selected weapon animation pending',500,540);return;
 }
 const reduce=$('#reduced').checked, instant=!d;
 const pose=(instant||reduce)&&!seq().hold?(action==='power'||action==='spell'?'power':'ready'):seq().poses[sampled.index];
 const frame=family().frames[pose],img=decoded.get($('#quality').value==='lite'?frame.lite:frame.path);
 const aura=$('#aura').value, filter=aura==='none'?'none':auraFilter(action==='power'?'power2':'idle',aura==='guard'?'guard':'idle',aura==='guard'?[]:[aura],aura!=='guard');
 const x=410+(reduce?0:sampled.x),size=470;
 drawFigure(img,x,530,size,filter);
 const flash=hitFlashOpacity(action,sampled.progress,{reduced:reduce||instant});
 if(flash){
   flashContext.clearRect(0,0,512,512);
   flashContext.globalCompositeOperation='source-over';flashContext.drawImage(img,0,0,512,512);
   flashContext.globalCompositeOperation='source-in';flashContext.fillStyle='#ff2424';flashContext.fillRect(0,0,512,512);
   ctx.save();ctx.globalAlpha=flash;drawFigure(flashCanvas,x,530,size);ctx.restore();
 }
 const effect=$('#effect').value==='auto'?seq().effect:$('#effect').value;
 const progress=sampled.progress;
 if(effect&&effect!=='none'&&!reduce&&!instant&&progress>=.4&&progress<.9){
   const t=(progress-.4)/.5,index=Math.min(5,Math.floor(t*6)),url='../../'+COMBAT_EFFECT_ART[effect][index].replace('assets/','assets-mobile/');
   const fx=decoded.get(url),projectile=effect==='starbolt',shield=effect==='shieldBash'||effect==='ward';
   ctx.save();ctx.globalAlpha=effect==='slash'?.52:.7;
   const fxX=projectile?x+120+t*270:shield?x+95:x+150,fxY=shield?310:280,fxSize=shield?190:220;
   ctx.drawImage(fx,fxX-fxSize/2,fxY-fxSize/2,fxSize,fxSize);ctx.restore();
 }
 ctx.fillStyle='#84947d';ctx.textAlign='center';ctx.font='10px system-ui';ctx.fillText('SHARED FLOOR ANCHOR',410,552);
}
$('#actor').onchange=$('#loadout').onchange=selection;
$('#actions').onclick=e=>{const button=e.target.closest('[data-action]');if(button){action=button.dataset.action;selection();}};
$('#play').onclick=()=>{if(!ready||!available())return;if($('#reduced').checked||!duration()){time=duration();stop();render();return;}playing=!playing;if(time>=duration())reset();$('#play').textContent=playing?'Ⅱ Pause':'▶ Play';last=performance.now();};
$('#restart').onclick=()=>{stop();reset();};
$('#scrub').oninput=e=>{stop();time=Number(e.target.value);render();};
$('#timeline').onclick=e=>{const button=e.target.closest('[data-frame]');if(button){stop();time=seq().durations.slice(0,Number(button.dataset.frame)).reduce((a,b)=>a+b,0)/260*duration();render();}};
$('#pace').onchange=()=>{stop();reset();};
for(const id of ['aura','quality','effect'])$('#'+id).onchange=render;
$('#reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('#reduced').onchange=()=>{stop();reset();};
function tick(now){
 if(playing&&document.visibilityState==='visible'){
  const dt=Math.min(80,now-last)*($('#slowmo').checked?.25:1);
  if(time<duration())time=Math.min(duration(),time+dt);
  else if(seq().hold||!$('#loop').checked)stop();
  else{cyclePause+=dt;if(cyclePause>=450){time=0;cyclePause=0;}}
  render();
 }
 last=now;requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
selection();preload().then(selection).catch(e=>message(e.message));requestAnimationFrame(tick);
