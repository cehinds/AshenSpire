import { staminaOrb } from '../../../src/content/staminaOrb.js';
const $ = s => document.querySelector(s);
const componentUrl = id => `../../../${staminaOrb.assets[id]}`;
const names = { frame: 'Circular harness', orb: 'Stamina inner orb', sigil: 'Action sigil', diamond: 'Sapphire diamond', spent: 'Spent diamond', number: 'SP number', label: 'SP label' };
const isText = id => id === 'number' || id === 'label';
const defaults = { version: 2, ring: true, maxMana: 12, mana: 8, stamina: 3, radius: 37.5, gemSize: 16, rotation: 0,
  layers: JSON.parse(JSON.stringify(staminaOrb.layers)),
  stats: { level: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 } };
const KEY = 'ashenspire.sp-atelier.v1';
const clone = x => JSON.parse(JSON.stringify(x));
const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
function normalize(raw) {
  if (!raw || ![1, 2].includes(raw.version)) throw new Error('Choose an SP Atelier version 1 or 2 layout.');
  const s = clone(defaults);
  const num = (v,f,a,b) => Number.isFinite(v) ? clamp(v,a,b) : f;
  for (const [k,a,b] of [['maxMana',0,48],['mana',0,48],['stamina',0,99],['radius',20,48],['gemSize',4,25],['rotation',0,360]]) s[k] = num(raw[k],s[k],a,b);
  s.maxMana = Math.round(s.maxMana); s.mana = Math.min(s.maxMana,Math.round(s.mana)); s.stamina = Math.round(s.stamina);
  s.ring = raw.ring !== false;
  // Split older combined typography into independent copies without moving it.
  for (const id of Object.keys(names)) { const v = raw.layers?.[id] || (isText(id) ? raw.layers?.text : null) || {}; const l = s.layers[id]; l.visible = v.visible !== false;
    for (const [k,a,b] of [['x',-45,45],['y',-45,45],['size',5,150],['opacity',0,100],['hue',-180,180]]) l[k] = num(v[k],l[k],a,b);
  }
  for(const k of Object.keys(s.stats)) s.stats[k] = Math.round(num(raw.stats?.[k],s.stats[k],1,99));
  return s;
}
let state = clone(defaults), selected = 'frame', isolated = false;
try { const saved = localStorage.getItem(KEY); if(saved) state = normalize(JSON.parse(saved)); } catch { /* New draft if storage is unavailable or stale. */ }
const canvas = $('#canvas'), ctx = canvas.getContext('2d'), assets = {};
function persist() { try { localStorage.setItem(KEY,JSON.stringify(state)); $('#saveState').textContent = 'Draft saved locally'; } catch { $('#saveState').textContent = 'Export to save this draft'; } }
function bounds(img) {
  const c = document.createElement('canvas'); c.width=img.naturalWidth;c.height=img.naturalHeight;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
  const {data}=g.getImageData(0,0,c.width,c.height);let x0=c.width,y0=c.height,x1=0,y1=0;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>20){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  return {x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
function art(id,x,y,height,g=ctx) {
  const l=state.layers[id], a=assets[id];if(!a||!l.visible)return;
  const b=a.bounds,w=height*b.w/b.h;
  g.save();g.globalAlpha=l.opacity/100;g.filter=`hue-rotate(${l.hue}deg)`;
  g.drawImage(a.img,b.x,b.y,b.w,b.h,x+l.x*9-w/2,y+l.y*9-height/2,w,height);g.restore();
}
function draw(g=ctx) {
  g.clearRect(0,0,900,900);
  const show=id=>!isolated||selected===id;
  if(show('orb'))art('orb',450,450,state.layers.orb.size*9,g);
  if(show('frame'))art('frame',450,450,state.layers.frame.size*9,g);
  if(show('sigil'))art('sigil',450,450,state.layers.sigil.size*9,g);
  if(state.ring)for(let i=0;i<state.maxMana;i++){
    const id=i<state.mana?'diamond':'spent';if(!show(id))continue;
    const theta=(-90-i*360/state.maxMana+state.rotation)*Math.PI/180;
    const r=state.radius*9;
    // Fit even large mana pools without overlapping neighbouring gems.
    const size=Math.min(state.gemSize*9,Math.max(12,2*Math.PI*r/Math.max(1,state.maxMana)*1.02));
    art(id,450+Math.cos(theta)*r,450+Math.sin(theta)*r,size*state.layers[id].size/100,g);
  }
  for (const [id, text, fontSize, baseline] of [['number', state.stamina, 145, 430], ['label', 'SP', 68, 540]]) {
    const l = state.layers[id];
    if (!show(id) || !l.visible) continue;
    g.save();g.globalAlpha=l.opacity/100;g.fillStyle='#f1f1dc';g.shadowColor='#061506';g.shadowBlur=9;g.textAlign='center';g.textBaseline='middle';
    g.font=`${fontSize*l.size/100}px Georgia`;g.fillText(text,450+l.x*9,baseline+l.y*9);g.restore();
  }
  $('#readout').textContent=`${state.stamina} SP · ${state.mana} / ${state.maxMana} MP${state.ring?'':' · Ring hidden'}`;
}
function range(host,label,value,min,max,step,onchange){
  const node=document.createElement('label');node.className='control';
  const cap=document.createElement('span'),word=document.createElement('span'),out=document.createElement('output');word.textContent=label;out.textContent=value;cap.append(word,out);
  const input=document.createElement('input');Object.assign(input,{type:'range',min,max,step,value});input.setAttribute('aria-label',label);
  input.oninput=()=>{out.textContent=input.value;onchange(Number(input.value));persist();draw();};node.append(cap,input);host.append(node);
}
function controls(){
  $('#selectedTitle').textContent=names[selected];const host=$('#layerControls');host.replaceChildren();const l=state.layers[selected];
  const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.checked=l.visible;input.onchange=()=>{l.visible=input.checked;persist();draw();};label.append(input,'Show component');host.append(label);
  for(const [key,title,min,max,step] of [['size','Size',5,150,1],['x','Horizontal position',-45,45,.5],['y','Vertical position',-45,45,.5],['opacity','Opacity',0,100,1],['hue','Color shift',-180,180,1]]){
    if(isText(selected)&&key==='hue')continue;range(host,title,l[key],min,max,step,v=>l[key]=v);
  }
  document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.layer===selected));
  $('#viewTitle').textContent=isolated?names[selected]:'The complete harness';
}
function resources(){
  const host=$('#resources');host.replaceChildren();$('#ring').checked=state.ring;
  for(const [key,title,min,max,step] of [['maxMana','Maximum MP',0,48,1],['mana','Available MP',0,state.maxMana,1],['stamina','Current SP',0,99,1],['radius','Mana ring radius',20,48,.5],['gemSize','Mana diamond size',4,25,.5],['rotation','Ring rotation',0,360,1]]) range(host,title,state[key],min,max,step,v=>{state[key]=v;if(key==='maxMana'){state.mana=Math.min(state.mana,v);resources();}});
}
function stats(){const host=$('#stats');host.replaceChildren();for(const key of Object.keys(state.stats)){const label=document.createElement('label');label.className='stat-row';label.textContent=key[0].toUpperCase()+key.slice(1);const input=document.createElement('input');Object.assign(input,{type:'number',min:1,max:99,value:state.stats[key]});input.onchange=()=>{state.stats[key]=clamp(Math.round(Number(input.value)||1),1,99);input.value=state.stats[key];total();persist();};label.append(input);host.append(label);}total();}
function total(){const s=state.stats;const value=3+Math.floor(s.dexterity*.25)+Math.floor(s.constitution*.25)+Math.floor(s.wisdom*.2)+Math.floor(s.intelligence*.2)+Math.floor((s.level-1)*.1);$('#statTotal').textContent=`Calculated maximum: ${value} SP`;return value;}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();$('#saveState').textContent=`Export requested: ${name}`;setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
for(const [id,name] of Object.entries(names)){
  const b=document.createElement('button');b.className='layer';b.dataset.layer=id;
  b.innerHTML=(isText(id)?`<div class="text-icon">${id==='number'?'3':'SP'}</div>`:`<img src="${componentUrl(id)}" alt="">`)+`<span>${name}<small>${isText(id)?'Live typography':'Transparent artwork'}</small></span>`;
  b.onclick=()=>{selected=id;controls();draw();};$('#layers').append(b);
  if(!isText(id)){const tile=document.createElement('button');tile.className='tile';tile.innerHTML=`<img src="${componentUrl(id)}" alt="${name}"><span>${name}</span>`;tile.onclick=()=>{selected=id;isolated=true;setMode();};$('#gallery').append(tile);}
}
function setMode(){$('#assembled').setAttribute('aria-pressed',!isolated);$('#isolated').setAttribute('aria-pressed',isolated);controls();draw();}
$('#assembled').onclick=()=>{isolated=false;setMode();};$('#isolated').onclick=()=>{isolated=true;setMode();};
$('#ring').onchange=e=>{state.ring=e.target.checked;persist();draw();};
document.querySelectorAll('[data-mana]').forEach(b=>b.onclick=()=>{state.maxMana=state.mana=Number(b.dataset.mana);resources();persist();draw();});
$('#reset').onclick=()=>{state=clone(defaults);controls();resources();stats();persist();draw();};
$('#applyStats').onclick=()=>{state.stamina=total();resources();persist();draw();};
$('#export').onclick=()=>download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'ashenspire-sp-layout.json');
$('#import').onclick=()=>$('#file').click();$('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{state=normalize(JSON.parse(await file.text()));controls();resources();stats();persist();draw();}catch(error){$('#saveState').textContent=error.message;}e.target.value='';};
$('#png').onclick=()=>{const c=document.createElement('canvas');c.width=c.height=900;draw(c.getContext('2d'));c.toBlob(blob=>download(blob,'ashenspire-sp-orb.png'));};
let drag=null;canvas.onpointerdown=e=>{const l=state.layers[selected];drag={x:e.clientX,y:e.clientY,lx:l.x,ly:l.y};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!drag)return;const scale=100/canvas.getBoundingClientRect().width,l=state.layers[selected];l.x=clamp(drag.lx+(e.clientX-drag.x)*scale,-45,45);l.y=clamp(drag.ly+(e.clientY-drag.y)*scale,-45,45);draw();};
canvas.onpointerup=()=>{if(drag){drag=null;controls();persist();}};canvas.onpointercancel=()=>{drag=null;};
controls();resources();stats();
try { await Promise.all(Object.keys(names).filter(id=>!isText(id)).map(async id=>{const img=new Image();img.src=componentUrl(id);await img.decode();assets[id]={img,bounds:bounds(img)};}));draw();$('#saveState').textContent='Ready · Local draft'; } catch { $('#saveState').textContent='Component art could not load. Fetch the pinned art packs, then reload.'; }
