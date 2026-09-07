import {SETUPS,WEAPONS} from './catalog.mjs';
import {referenceKeys} from './reference-poses.mjs';
import {loadTextures,render} from './renderer.mjs';
const $=id=>document.getElementById(id),select=$('setup');
for(const [id,s]of Object.entries(SETUPS)){const o=new Option(s.name,id);select.add(o)}
select.value='greatsword';
let textures,request=0,playing=false,referenceVersion=0;
function draw(){if(!textures)return;let max=0,scene;for(const id of ['reaver','starseer']){const s=render($(id),textures,id,select.value,$('action').value,Number($('time').value)/100,{debug:$('debug').checked,effects:$('effects').checked});max=Math.max(max,s.right.error,s.left.error,s.nearLeg.error,s.farLeg.error);scene=s;}$('phase').value=$('time').value+'%';$('status').textContent=`${scene.pose.from.label} → ${scene.pose.to.label} · Hand/foot target error: ${max.toFixed(1)} px · Front foot: ${scene.pose.front.planted?'planted':'stepping'}`;for(const card of document.querySelectorAll('.reference-card'))card.classList.toggle('active',Number(card.dataset.time)===Number($('time').value));}
function stop(){cancelAnimationFrame(request);playing=false;$('play').textContent='Play animation';}
// Crop transparent canvas margins only for the side-by-side silhouette guide.
// Main stages retain one fixed camera and floor throughout playback.
function fit(source,target){const tmp=document.createElement('canvas');tmp.width=source.width;tmp.height=source.height;const c=tmp.getContext('2d');c.drawImage(source,0,0);const {data}=c.getImageData(0,0,tmp.width,tmp.height);let x0=tmp.width,y0=tmp.height,x1=0,y1=0;for(let y=0;y<tmp.height;y++)for(let x=0;x<tmp.width;x++)if(data[(y*tmp.width+x)*4+3]>20){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}const w=x1-x0+1,h=y1-y0+1,scale=Math.min(190/w,190/h);target.width=210;target.height=210;target.getContext('2d').drawImage(tmp,x0,y0,w,h,(210-w*scale)/2,200-h*scale,w*scale,h*scale);}
async function showReferences(){if(!textures)return;const version=++referenceVersion;const setupId=select.value,action=$('action').value,keys=referenceKeys('reaver',WEAPONS[SETUPS[setupId].main].family,action).filter(k=>[.22,.46,.69].includes(k.t));$('references').replaceChildren();$('referenceTitle').textContent=keys[0].referenceClass==='starseer'?'Starseer casting pose guides':'Reaver pose guides';
 const cards=await Promise.all(keys.map(async k=>{
  const section=document.createElement('article');section.className='reference-card';section.dataset.time=Math.round(k.t*100);const button=document.createElement('button');button.textContent=`${Math.round(k.t*100)}% · ${k.label}`;button.onclick=()=>{stop();$('time').value=Math.round(k.t*100);draw()};section.append(button);const pair=document.createElement('div');pair.className='reference-pair';section.append(pair);
  const source=new Image();source.src=`assets/painted-outfits/${k.referenceClass}/${k.referencePose}.webp`;await source.decode();const rigCanvas=document.createElement('canvas');rigCanvas.width=600;rigCanvas.height=600;render(rigCanvas,textures,k.referenceClass,setupId,action,k.t,{effects:false});
  for(const [img,label]of [[source,'Painted reference'],[rigCanvas,'Rig key pose']]){const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');canvas.setAttribute('aria-label',label+' '+k.label);fit(img,canvas);caption.textContent=label;figure.append(canvas,caption);pair.append(figure)}return section;
 }));if(version===referenceVersion){$('references').replaceChildren(...cards);draw()}
}
function choose(){stop();$('action').value=SETUPS[select.value].action;$('time').value=0;draw();showReferences().catch(report)}
select.onchange=choose;
$('action').oninput=()=>{stop();draw();showReferences().catch(report)};
for(const id of ['time','debug','effects'])$(id).addEventListener('input',()=>{stop();draw()});
$('reaverPreset').onclick=()=>{select.value='greatsword';choose()};$('casterPreset').onclick=()=>{select.value='focus';choose()};
$('play').onclick=()=>{if(playing){stop();return}playing=true;$('play').textContent='Pause';const start=performance.now(),duration=2200;const tick=now=>{$('time').value=Math.min(100,(now-start)/duration*100);draw();if(now-start<duration)request=requestAnimationFrame(tick);else stop()};request=requestAnimationFrame(tick)};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
function report(e){$('error').textContent='The prototype assets could not load: '+e.message;console.error(e)}
try{textures=await loadTextures();draw();await showReferences();window.rigPreview={render:(id,setup,action,t,opts)=>render($(id),textures,id,setup,action,t,opts),ready:true}}catch(e){report(e)}
