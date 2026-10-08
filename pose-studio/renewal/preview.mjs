import { cardActionFor } from '../../src/model/alternativeCardAnimation.js';
import { ANIM_SPEEDS } from '../../src/ui/animationPace.js';
import { auraFilter } from '../../src/ui/combatAura.js';
import { COMBAT_EFFECT_ART } from '../../src/content/combatEffectArt.js';
import { durationFor, sampleSequence, hitFlashOpacity, defaultFamily } from './model.mjs';

const $=s=>document.querySelector(s), canvas=$('#preview'), ctx=canvas.getContext('2d');
const flashCanvas=document.createElement('canvas');flashCanvas.width=flashCanvas.height=512;
const flashContext=flashCanvas.getContext('2d');
const response=await fetch('./cards/registry.json');
if(!response.ok)throw Error('Cannot load renewal manifest');
const manifest=await response.json(), images=new Map(), families=new Map();
for(const [key,entry] of Object.entries(manifest.families)){const r=await fetch('./'+entry.manifest);if(!r.ok)throw Error('Cannot load family: '+key);families.set(key,await r.json());}
let action='attack', time=0, playing=false, last=0, ready=false, cyclePause=0, hitAt=null;
const family=()=>families.get($('#actor').value);
const available=()=>!!defaultFamily(manifest,$('#actor').value);
const seq=()=>family().sequences[action];
const duration=()=>durationFor(seq(),ANIM_SPEEDS[$('#pace').value]);
const hitProgress=now=>hitAt===null?1:(now-hitAt)*($('#slowmo').checked?.25:1)/260;
const message=t=>$('#message').textContent=t;
async function image(url){
 if(!images.has(url))images.set(url,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Missing image: '+url));img.src=url;}));
 return images.get(url);
}
let decoded=new Map();
async function preload(){
 const urls=[...families.values()].flatMap(m=>Object.values(m.frames).flatMap(f=>[f.path,f.lite]));
 const effects=new Set(['slash','ward','starbolt','shieldBash',...[...families.values()].flatMap(m=>Object.values(m.sequences).map(s=>s.effect).filter(Boolean))]);
 effects.delete('arrow');effects.add('thrust');
 urls.push(...[...effects].flatMap(e=>COMBAT_EFFECT_ART[e].map(p=>'../../'+p.replace('assets/','assets-mobile/'))));
 await Promise.all(urls.map(async u=>decoded.set(u,await image(u))));
 ready=true;render();message('4 classes · 8 card motions each · base weapons, independent of equipment.');
}
$('#actor').innerHTML=manifest.classes.map(c=>`<option value="${c}">${c[0].toUpperCase()+c.slice(1)}</option>`).join('');
$('#actions').innerHTML=manifest.actions.map(id=>`<button data-action="${id}">${family().sequences[id].label}</button>`).join('');
function stop(){playing=false;$('#play').textContent='▶ Play';}
function reset(){time=0;cyclePause=0;hitAt=null;render();}
function selection(){
 stop();reset();
 const drafted=available();
 const entry=defaultFamily(manifest,$('#actor').value);
 $('#workshop-project').hidden=!drafted;$('#workshop-project').href=entry.rig;
 document.querySelectorAll('[data-action]').forEach(b=>b.textContent=b.dataset.action==='ranged'&&['starseer','herald'].includes($('#actor').value)?'Ranged · class default':family().sequences[b.dataset.action].label);
 $('#coverage').textContent='Base armour · '+family().referenceWeapon;
 $('#play').disabled=$('#restart').disabled=$('#scrub').disabled=!drafted||!ready;
 $('#hit').disabled=!ready||$('#reduced').checked||!duration();
 document.querySelectorAll('[data-action]').forEach(b=>{b.disabled=!drafted;b.classList.toggle('active',b.dataset.action===action);});
 $('#stage-label').textContent=`${$('#actor').value.toUpperCase()} · BASE ARMOUR · ${seq().label.toUpperCase()}`;
 const notes={attack:'Load, dash into contact, and recover.',smash:'Raise for a heavy overhead blow, then return.',sweep:'Coil low and sweep across the target.',counter:'Deflect, riposte, and recover.',defend:'Raise guard, brace, and recover.',spell:'Gather, invoke, and recover.',ranged:'Aim, release, and recover. Uses the class’s base ranged weapon.',rangedMagic:'Cast toward the target. Staff points upward and spellbooks remain open.'};
 $('#action-note').textContent=notes[action];
 $('#edit').hidden=!drafted;
 $('#edit').href='../index.html?renewal='+action+'&family='+$('#actor').value+'&study=cards';
 $('#board').innerHTML=manifest.classes.map(c=>`<div class="card draft">${c[0].toUpperCase()+c.slice(1)}<span>Attack · Smash · Sweep · Counter<br>Defend · Spell · Ranged</span></div>`).join('');
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
 $('#metrics').textContent=available()?`${seq().poses.length} poses · ${Math.round(d)} ms · ${Math.max(...seq().travel.map(Math.abs))} px maximum travel · ${Math.round(family().bytes[$('#quality').value==='lite'?'lite':'webp']/1024)} KB for all ${Object.keys(family().frames).length} poses`:"No animation artwork for this class / loadout yet";
 document.querySelectorAll('[data-frame]').forEach(b=>b.classList.toggle('active',Number(b.dataset.frame)===sampled.index));
 const grad=ctx.createLinearGradient(0,0,0,580);grad.addColorStop(0,'#121d19');grad.addColorStop(1,'#29392b');ctx.fillStyle=grad;ctx.fillRect(0,0,1000,580);
 ctx.strokeStyle='#a8bd9d12';ctx.lineWidth=1;for(let x=0;x<1000;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,580);ctx.stroke();}for(let y=30;y<580;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke();}
 ctx.strokeStyle='#859b6755';ctx.beginPath();ctx.moveTo(120,486);ctx.lineTo(880,486);ctx.stroke();
 if(!ready)return;
 const reduce=$('#reduced').checked, instant=!d;
 const pose=(instant||reduce)?seq().poses[seq().impact]:seq().poses[sampled.index];
 const frame=family().frames[pose],img=decoded.get($('#quality').value==='lite'?frame.lite:frame.path);
 const aura=$('#aura').value, filter=aura==='none'?'none':auraFilter(action==='power'?'power2':'idle',aura==='guard'?'guard':'idle',aura==='guard'?[]:[aura],aura!=='guard');
 const size=320*512/(464-family().frames.ready.bounds[1]);
 const x=410+(reduce?0:sampled.x)*size/512, floor=486+48*size/512;
 drawFigure(img,x,floor,size,filter);
 const flash=hitFlashOpacity('hurt',hitProgress(performance.now()),{reduced:reduce||instant});
 if(flash){
   flashContext.clearRect(0,0,512,512);
   flashContext.globalCompositeOperation='source-over';flashContext.drawImage(img,0,0,512,512);
   flashContext.globalCompositeOperation='source-in';flashContext.fillStyle='#ff2424';flashContext.fillRect(0,0,512,512);
   ctx.save();ctx.globalAlpha=flash;drawFigure(flashCanvas,x,floor,size);ctx.restore();
 }
 const selectedEffect=$('#effect').value==='auto'?seq().effect:$('#effect').value;
 const effect=selectedEffect==='arrow'?'thrust':selectedEffect;
 const progress=sampled.progress;
 const contact=seq().durations.slice(0,seq().impact).reduce((a,b)=>a+b,0)/260;
 if(effect&&effect!=='none'&&!reduce&&!instant&&progress>=contact&&progress<.98){
   const t=(progress-contact)/(1-contact),index=Math.min(5,Math.floor(t*6)),url='../../'+COMBAT_EFFECT_ART[effect][index].replace('assets/','assets-mobile/');
   const fx=decoded.get(url),projectile=['starbolt','sacredbolt'].includes(effect)||(action==='ranged'&&effect==='thrust'),shield=effect==='shieldBash'||effect==='ward';
   ctx.save();ctx.globalAlpha=effect==='slash'?.52:.7;
   const fxX=projectile?x+120+t*270:shield?x+95:x+150,fxY=shield?310:280,fxSize=shield?190:220;
   ctx.drawImage(fx,fxX-fxSize/2,fxY-fxSize/2,fxSize,fxSize);ctx.restore();
 }
 ctx.fillStyle='#84947d';ctx.textAlign='center';ctx.font='10px system-ui';ctx.fillText('SHARED FLOOR ANCHOR',410,552);
}
$('#actor').onchange=selection;
$('#actions').onclick=e=>{const button=e.target.closest('[data-action]');if(button){const requested=button.dataset.action;const spell=requested==='spell'||requested==='rangedMagic';const maneuver=requested==='spell'?'attack':requested==='rangedMagic'?'ranged':requested;action=cardActionFor({cardTags:['camp:'+(spell?'spell':'physical'),'maneuver:'+maneuver]},$('#actor').value);selection();}};
$('#play').onclick=()=>{if(!ready||!available())return;if($('#reduced').checked||!duration()){time=duration();stop();render();return;}playing=!playing;if(time>=duration())reset();$('#play').textContent=playing?'Ⅱ Pause':'▶ Play';last=performance.now();};
$('#restart').onclick=()=>{stop();reset();};
$('#hit').onclick=()=>{hitAt=performance.now();render();};
$('#scrub').oninput=e=>{stop();time=Number(e.target.value);render();};
$('#timeline').onclick=e=>{const button=e.target.closest('[data-frame]');if(button){stop();time=seq().durations.slice(0,Number(button.dataset.frame)).reduce((a,b)=>a+b,0)/260*duration();render();}};
$('#pace').onchange=selection;
for(const id of ['aura','quality','effect'])$('#'+id).onchange=render;
$('#reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('#reduced').onchange=selection;
function tick(now){
 if(hitAt!==null){if(hitProgress(now)>=.55)hitAt=null;render();}
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
