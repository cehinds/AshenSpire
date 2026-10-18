'use strict';
const catalog = window.STATUS_ART;
const $ = id => document.getElementById(id);
const byId = new Map(catalog.components.map(c => [c.id, c]));
let layers = [];
function current() { return catalog.statuses.find(s => s.id === $('status').value); }
function cssFor(layer) {
  const t = layer.transform;
  return {position:'absolute', left:`${t.x}%`, top:`${t.y}%`, width:`${t.size}%`, height:`${t.size}%`,
    objectFit:'contain', transform:`translate(-50%, -50%) rotate(${t.rotation}deg)`,
    transformOrigin:'50% 50%', opacity:String(t.opacity), zIndex:String(layer.zIndex), display:t.visible?'block':'none'};
}
function selectedLayers(status, object, effect) {
  return catalog.layerOrder.map(role => structuredClone(byId.get(status[`${role}Ids`][role === 'object' ? object : effect])));
}
function paint(stage, components, solo = 'all', raw = false, lazy = false) {
  stage.replaceChildren();
  for (const component of components) {
    if (solo !== 'all' && component.role !== solo) continue;
    const image = new Image();
    image.loading = lazy ? 'lazy' : 'eager';
    image.src = component.src;
    image.alt = component.label;
    const copy = structuredClone(component);
    if (raw) copy.transform = {x:50,y:50,size:100,rotation:0,opacity:1,visible:true};
    Object.assign(image.style, cssFor(copy));
    stage.append(image);
  }
}
function populateVariants() {
  const status = current();
  for (const role of ['object','effect']) {
    const old = $(role).value || '0';
    $(role).replaceChildren(...status[`${role}Ids`].map((id,i) => new Option(`${i} · ${byId.get(id).label}`,i)));
    $(role).value = old;
  }
}
function updateStage() { paint($('stage'), layers); }
function choose() {
  const status = current(), object = $('object').value, effect = $('effect').value;
  if (!status) return;
  layers = selectedLayers(status, object, effect);
  $('selection-label').textContent = `${status.codePrefix}${object}${effect} · ${status.name} · ${status.objectFamily} ${object} / effect ${effect}`;
  $('status-description').textContent = `${status.id} — ${status.tooltip}`;
  $('controls').replaceChildren();
  $('isolated').replaceChildren();
  for (const layer of layers) {
    const fieldset = document.createElement('fieldset'); fieldset.className='layer-controls';
    const legend = document.createElement('legend');
    const visible = document.createElement('input'); visible.type='checkbox'; visible.checked=layer.transform.visible;
    visible.setAttribute('aria-label',`Show ${layer.role}`);
    visible.onchange=()=>{layer.transform.visible=visible.checked;updateStage();};
    legend.append(visible,` ${layer.role === 'effect' ? 'Unlit mark' : layer.role}`);fieldset.append(legend);
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
    const caption=document.createElement('figcaption'),link=document.createElement('a');link.href=layer.src;link.download=layer.src.split('/').at(-1);link.textContent=`${layer.label} · PNG`;
    caption.append(link);figure.append(stage,caption);$('isolated').append(figure);
  }
  history.replaceState(null,'',`#${status.id}/${object}${effect}`);
  updateStage();
}
function option(status, variant, overview = false) {
  const button=document.createElement('button');button.className='option';
  const stage=document.createElement('span');stage.className='stage';
  const mode=overview?'all':$('view').value;if(mode!=='all')stage.classList.add('checker');
  paint(stage,selectedLayers(status,variant,variant),mode,mode!=='all',true);
  const label=document.createElement('span');label.className='label';
  const code=document.createElement('code');code.textContent=`${status.codePrefix}${variant}${variant}`;
  label.append(code,` · ${status.name}`);button.append(stage,label);
  button.onclick=()=>{selectStatus(status.id,variant,variant);$('editor').scrollIntoView({behavior:'smooth'});};
  return button;
}
function gallery() {
  const status=current();
  if (!status) return;
  $('collection-title').textContent=`${status.name} · ten options`;
  $('gallery').replaceChildren(...Array.from({length:10},(_,i)=>option(status,i)));
}
function selectStatus(id, object=0, effect=0) {
  $('search').value='';populateStatuses();$('status').value=id;populateVariants();
  $('object').value=String(object);$('effect').value=String(effect);choose();gallery();
}
function populateStatuses() {
  const old=$('status').value;
  const query=$('search').value.trim().toLowerCase();
  const matches=catalog.statuses.filter(s=>`${s.id} ${s.name} ${s.codePrefix}`.toLowerCase().includes(query));
  $('status').replaceChildren(...matches.map(s=>new Option(`${s.codePrefix} · ${s.name}`,s.id)));
  if(matches.some(s=>s.id===old)) $('status').value=old;
  $('status').disabled=!matches.length;
  return matches.length;
}
$('search').oninput=()=>{if(populateStatuses()){populateVariants();choose();gallery();}};
$('status').onchange=()=>{populateVariants();choose();gallery();};
$('object').onchange=choose;$('effect').onchange=choose;$('reset').onclick=choose;$('view').onchange=gallery;
$('export').onclick=()=>{
  // The layers are the committed selection even when a search has no matches.
  const status=catalog.statuses.find(s=>s.effectIds.includes(layers.find(l=>l.role==='effect').id));
  const object=layers.find(l=>l.role==='object').variant,effect=layers.find(l=>l.role==='effect').variant;
  const code=`${status.codePrefix}${object}${effect}`;
  const composition={format:'ashenspire.status-composition/1',id:code,statusId:status.id,canvas:catalog.canvas,
    assetBase:'docs/design/new-card-art/statuses/',layers:layers.map(l=>({...l,css:cssFor(l)}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(composition,null,2)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`${code.replace('/','-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
for (const volume of [...new Set(catalog.statuses.map(s=>s.volume))]) {
  const link=document.createElement('a');link.href=`statuses-${String(volume).padStart(2,'0')}-png-json.zip`;link.download='';
  link.textContent=`Volume ${volume} · PNGs + JSON + viewer`;
  // A self-contained downloaded volume has no nested ZIP downloads.
  if(!catalog.packageVolume) $('downloads').append(link);
}
$('coverage').textContent=`${catalog.statuses.length} current statuses · ${catalog.presets.length} assembled options · separate object, unlit mark and glow PNGs.`;
$('overview').replaceChildren(...catalog.statuses.map(s=>option(s,0,true)));
const match=location.hash.match(/^#([^/]+)\/(\d)(\d)$/);
selectStatus(match&&catalog.statuses.some(s=>s.id===match[1])?match[1]:catalog.statuses[0].id,match?Number(match[2]):0,match?Number(match[3]):0);
