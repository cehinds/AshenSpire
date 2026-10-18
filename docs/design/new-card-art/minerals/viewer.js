'use strict';
const catalog = window.MINERAL_ART;
const $ = id => document.getElementById(id);
const byId = new Map(catalog.components.map(c => [c.id, c]));
let layers = [];
const roles = catalog.layerOrder;
function cssFor(layer) {
  const t = layer.transform;
  return {position:'absolute', left:`${t.x}%`, top:`${t.y}%`, width:`${t.size}%`, height:`${t.size}%`,
    objectFit:'contain', transform:`translate(-50%, -50%) rotate(${t.rotation}deg)`,
    transformOrigin:'50% 50%', opacity:String(t.opacity), zIndex:String(layer.zIndex), display:t.visible?'block':'none'};
}
function selectedLayers(category, object, effect) {
  return roles.map(role => structuredClone(byId.get(`minerals.${category}.${role}.${role === 'object' ? object : effect}`)));
}
function paint(stage, components, solo = 'all', raw = false) {
  stage.replaceChildren();
  for (const component of components) {
    if (solo !== 'all' && component.role !== solo) continue;
    const image = new Image();
    image.src = component.src;
    image.alt = component.label;
    const copy = structuredClone(component);
    if (raw) copy.transform = {x:50,y:50,size:100,rotation:0,opacity:1,visible:true};
    Object.assign(image.style, cssFor(copy));
    stage.append(image);
  }
}
function populate() {
  const family = catalog.families.find(f => f.code === $('family').value);
  for (const id of ['object','effect']) {
    const old = $(id).value || '0';
    $(id).replaceChildren(...family.names.map((name,i) => new Option(`${i} · ${name}`,i)));
    $(id).value = old;
  }
}
function updateStage() { paint($('stage'), layers); }
function choose() {
  const category = $('family').value, object = $('object').value, effect = $('effect').value;
  layers = selectedLayers(category, object, effect);
  const family = catalog.families.find(f => f.code === category);
  $('selection-label').textContent = `minerals/${category}${object}${effect} · ${family.names[Number(object)]} / effect pair ${effect}`;
  $('controls').replaceChildren();
  $('isolated').replaceChildren();
  for (const layer of layers) {
    const fieldset = document.createElement('fieldset'); fieldset.className='layer-controls';
    const legend = document.createElement('legend');
    const visible = document.createElement('input'); visible.type='checkbox'; visible.checked=true;
    visible.setAttribute('aria-label',`Show ${layer.role}`);
    visible.onchange=()=>{layer.transform.visible=visible.checked;updateStage();};
    legend.append(visible,` ${layer.role}`);fieldset.append(legend);
    const fields=document.createElement('div');fields.className='fields';
    for (const [key,title,min,max,step] of [['x','X %',-100,200,1],['y','Y %',-100,200,1],['size','Size %',1,300,1],['rotation','Rotation °',-360,360,1],['opacity','Opacity',0,1,.01]]) {
      const label=document.createElement('label');label.append(title);
      const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.value=layer.transform[key];
      input.setAttribute('aria-label',`${layer.role} ${title}`);
      input.oninput=()=>{if(input.value===''||!Number.isFinite(input.valueAsNumber))return;layer.transform[key]=Math.min(max,Math.max(min,input.valueAsNumber));updateStage();};
      label.append(input);fields.append(label);
    }
    fieldset.append(fields);$('controls').append(fieldset);
    const figure=document.createElement('figure'),stage=document.createElement('div');stage.className='stage checker';
    paint(stage,[layer],'all',true);
    const caption=document.createElement('figcaption'),link=document.createElement('a');link.href=layer.src;link.download=layer.src.split('/').at(-1);link.textContent=`${category}${layer.variant} · ${layer.role} PNG`;
    caption.append(link);figure.append(stage,caption);$('isolated').append(figure);
  }
  updateStage();
}
function gallery() {
  $('gallery').replaceChildren();
  for (const family of catalog.families) {
    const section=document.createElement('div');section.className='family';section.id=`family-${family.code}`;
    const heading=document.createElement('h3');heading.textContent=`${family.code} · ${family.name[0].toUpperCase()+family.name.slice(1)}`;
    const grid=document.createElement('div');grid.className='grid';
    for(let i=0;i<10;i++){
      const button=document.createElement('button');button.className='option';
      const stage=document.createElement('span');stage.className='stage';
      const mode=$('view').value;if(mode!=='all')stage.classList.add('checker');
      paint(stage,selectedLayers(family.code,i,i),mode,mode!=='all');
      const label=document.createElement('span');label.className='label';
      const code=document.createElement('code');code.textContent=`${family.code}${i}${i}`;
      label.append(code,` · ${family.names[i]}`);button.append(stage,label);
      button.onclick=()=>{$('family').value=family.code;populate();$('object').value=String(i);$('effect').value=String(i);choose();$('editor').scrollIntoView({behavior:'smooth'});};
      grid.append(button);
    }
    section.append(heading,grid);$('gallery').append(section);
  }
}
$('family').append(...catalog.families.map(f=>new Option(`${f.code} · ${f.name}`,f.code)));
$('family').onchange=()=>{populate();choose();};
$('object').onchange=choose;$('effect').onchange=choose;$('reset').onclick=choose;$('view').onchange=gallery;
$('export').onclick=()=>{
  const code=`${$('family').value}${$('object').value}${$('effect').value}`;
  const composition={format:'ashenspire.mineral-composition/1',id:`minerals/${code}`,canvas:catalog.canvas,
    assetBase:'docs/design/new-card-art/minerals/',layers:layers.map(l=>({...l,css:cssFor(l)}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(composition,null,2)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`minerals-${code}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
populate();choose();gallery();
