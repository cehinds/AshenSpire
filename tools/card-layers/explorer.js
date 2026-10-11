import {contentBundle} from '/src/content/index.js';
import {createRegistries} from '/src/model/registries.js';
import {renderCard} from '/src/ui/components/card.js';
import {fitIllustratedCards} from '/src/ui/components/illustratedCard.js';
import {CardLayoutEditor} from './editor.js';

const registry=createRegistries(contentBundle);
const cards=[['shieldBash','Smash'],['strike','Attack'],['guardCounter','Counter'],['ricochet','Ranged'],['cinderSigil','Spell'],['defend','Defend']];
const layers=[
  [9,'Rank','Blue rank bar · Rank X text; hidden at Rank 0'],
  [8,'Text','Name · cost numbers · effect · action name'],
  [7,'Icons','Cost gems · individual primary tags · action symbol'],
  [6,'Text box and card trim','Card frame · text box edge · banner edge'],
  [5,'Banner and text box background','Cost pennant fill · effect backing'],
  [4,'Footer trim','Connected border and corner braces'],
  [3,'Heading and footer background','Title fade · footer backing'],
  [2,'Art','Current card illustration'],
  [1,'Card background','Base material']
];
const names={base:'Card background',art:'Card artwork',panel:'Text box background',flag:'Banner background',title:'Card name',rules:'Effect text','card-trim':'Card trim','panel-trim':'Text box trim','flag-trim':'Banner trim','stamina-icon':'Stamina gem','stamina-value':'Stamina number','mana-icon':'Mana gem','mana-value':'Mana number','energy-icon':'Action gem','energy-value':'Action number','rank-bar':'Blue rank bar','rank-text':'Rank text'};
let selected=4,rank=1,parts=[],source=null;
const visibleLayers=new Set(layers.map(l=>l[0])),hiddenParts=new Set();
const $=s=>document.querySelector(s);
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;};
const editor=new CardLayoutEditor($('#selected-card'),()=>controls());

function describeParts(card){
  const result=[];
  const add=(node,id,name,layer)=>{if(!node)return;node.dataset.explorerPart=id;node.dataset.explorerLayer=layer;result.push({id,name,layer});};
  for(const n of card.querySelectorAll('[data-component]')){
    if(n.dataset.component==='tags')continue; // Its icon and text are separate pieces.
    add(n,n.dataset.component,names[n.dataset.component]||n.dataset.component,Number(n.closest('[data-card-layer]')?.dataset.cardLayer||9));
  }
  add(card.querySelector('.card-title-fade'),'heading-fill','Heading fade',3);
  add(card.querySelector('.card-footer-backdrop'),'footer-fill','Footer background',3);
  add(card.querySelector('.card-base-action-frame'),'footer-trim','Footer trim',4);
  add(card.querySelector('.card-action-icon'),'action-icon','Footer action symbol',7);
  add(card.querySelector('.card-type-name'),'action-text','Footer action name',8);
  card.querySelectorAll('.card-tag-symbol').forEach((n,i)=>add(n,'tag-'+i,'Tag: '+n.getAttribute('aria-label'),7));
  return result.sort((a,b)=>b.layer-a.layer);
}

function presentation(card){
  const shell=el('div','card illustrated-card');
  shell.append(card.querySelector('.illustrated-card-face').cloneNode(true));
  shell.setAttribute('aria-label',card.querySelector('.illustrated-card-face').getAttribute('aria-label'));
  return shell;
}
function clone(keep){
  const card=source.cloneNode(true);
  // Keep every layout box. Hiding a sibling must never recenter footer text.
  for(const n of card.querySelectorAll('[data-explorer-part]'))n.style.visibility=keep(n.dataset.explorerPart,Number(n.dataset.explorerLayer))?'visible':'hidden';
  return card;
}
function tile(title,number,keep,note,id){
  const t=el('article','tile');t.dataset.sourceLayer=number;if(id)t.dataset.partTile=id;
  const head=el('div','tile-head');head.append(el('span','number',String(editor.level(number))),el('h3','',title));
  const body=el('div','tile-body');body.append(clone(keep));t.append(head,body,el('p','',note));return t;
}
function updateStage(){
  $('#selected-name').textContent=source.getAttribute('aria-label')+' · '+(rank?`Rank ${rank}`:'Rank 0 · no rank bar');
  editor.mount(source.cloneNode(true),parts,cards[selected][0]+':rank-'+rank,id=>{const p=parts.find(p=>p.id===id);return p&&visibleLayers.has(p.layer)&&!hiddenParts.has(id);});
}
function controls(){
  $('#controls').replaceChildren();
  for(const n of editor.order){
    const [,title,detail]=layers.find(l=>l[0]===n);
    const row=el('div','layer-control');row.dataset.layerRow=n;
    const grip=el('button','layer-grip','⠿');grip.type='button';grip.dataset.dragLayer=n;grip.setAttribute('aria-label','Drag '+title+' layer; arrow keys reorder');
    const input=el('input');input.type='checkbox';input.checked=visibleLayers.has(n);input.dataset.layerToggle=n;input.setAttribute('aria-label','Show '+title+' layer');
    const choose=el('button','layer-select');choose.type='button';choose.dataset.selectLayer=n;
    const copy=el('span');copy.append(el('strong','',title),el('small','',detail));choose.append(el('span','number',String(editor.level(n))),copy);
    const arrows=el('span','layer-arrows');for(const [delta,label] of [[-1,'↑'],[1,'↓']]){const b=el('button','',label);b.type='button';b.dataset.layerStep=delta;b.dataset.layerId=n;b.disabled=editor.order.indexOf(n)+(delta)<0||editor.order.indexOf(n)+(delta)>8;b.setAttribute('aria-label','Move '+title+(delta<0?' forward':' backward'));arrows.append(b);}
    row.append(grip,input,choose,arrows);$('#controls').append(row);
  }
  $('#part-controls').replaceChildren();
  for(const p of parts){
    const row=el('div','part-row'),input=el('input');input.type='checkbox';input.checked=!hiddenParts.has(p.id);input.dataset.partToggle=p.id;input.setAttribute('aria-label','Show '+p.name);
    const choose=el('button','part-select');choose.type='button';choose.dataset.selectPart=p.id;choose.setAttribute('aria-pressed',String(editor.selection.has(p.id)));choose.append(el('span','number',String(editor.level(p.layer))),el('span','',p.name));
    const solo=el('button','solo','Solo');solo.type='button';solo.dataset.solo=p.id;solo.setAttribute('aria-label','Show only '+p.name);
    row.append(input,choose,solo);$('#part-controls').append(row);
  }
  for(const host of [$('#layers'),$('#components')]){
    const tiles=[...host.children].sort((a,b)=>editor.level(Number(b.dataset.sourceLayer))-editor.level(Number(a.dataset.sourceLayer)));
    for(const t of tiles){const level=editor.level(Number(t.dataset.sourceLayer));t.querySelector('.number').textContent=level;if(t.dataset.partTile)t.querySelector('p').textContent='Source position · layer '+level;host.append(t);}
  }
}
function draw(){
  const native=renderCard(registry,{cardId:cards[selected][0],abilityRank:rank,...(cards[selected][0]==='defend'?{profileId:'sceptreGuard'}:{})},{level:'inspect'});
  source=presentation(native);parts=describeParts(source);
  updateStage();controls();
  $('#layers').replaceChildren(...layers.map(([n,title,detail])=>tile(title,n,(_,layer)=>layer===n,detail)));
  $('#components').replaceChildren(...parts.map(p=>tile(p.name,p.layer,id=>id===p.id,'Original position · layer '+p.layer,p.id)));
  fitIllustratedCards(document.querySelectorAll('#layers .card,#components .card'));
  controls();
  document.querySelectorAll('[data-card]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.card)===selected)));
}
function reset(){layers.forEach(l=>visibleLayers.add(l[0]));hiddenParts.clear();controls();updateStage();}

for(const [i,[cardId,action]] of cards.entries()){
  const button=el('button','example');button.type='button';button.dataset.card=i;button.setAttribute('aria-label','Inspect '+action+' card');
  button.append(presentation(renderCard(registry,{cardId,abilityRank:1,...(cardId==='defend'?{profileId:'sceptreGuard'}:{})},{level:'inspect'})),el('span','',action.toUpperCase()));$('#examples').append(button);
}
$('#examples').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b){selected=Number(b.dataset.card);hiddenParts.clear();draw();}});
$('#controls').addEventListener('change',e=>{const n=Number(e.target.dataset.layerToggle);if(n){e.target.checked?visibleLayers.add(n):visibleLayers.delete(n);updateStage();}});
$('#controls').addEventListener('click',e=>{const choose=e.target.closest('[data-select-layer]'),step=e.target.closest('[data-layer-step]');if(choose){const n=Number(choose.dataset.selectLayer);visibleLayers.add(n);parts.filter(p=>p.layer===n).forEach(p=>hiddenParts.delete(p.id));updateStage();editor.select(parts.filter(p=>p.layer===n).map(p=>p.id),e.shiftKey);editor.canvas.focus({preventScroll:true});}if(step)editor.stepLayer(Number(step.dataset.layerId),Number(step.dataset.layerStep));});
let layerDrag=null;
$('#controls').addEventListener('pointerdown',e=>{const grip=e.target.closest('[data-drag-layer]');if(!grip||e.button!==0)return;e.preventDefault();layerDrag={layer:Number(grip.dataset.dragLayer),grip,pointer:e.pointerId,start:e.clientY};grip.setPointerCapture(e.pointerId);grip.closest('.layer-control').classList.add('dragging');});
$('#controls').addEventListener('pointermove',e=>{if(!layerDrag||e.pointerId!==layerDrag.pointer)return;e.preventDefault();const rows=[...document.querySelectorAll('[data-layer-row]')];rows.forEach(r=>r.classList.remove('drop-before','drop-after'));const target=rows.find(r=>{const b=r.getBoundingClientRect();return e.clientY>=b.top&&e.clientY<=b.bottom;})||rows[e.clientY<rows[0].getBoundingClientRect().top?0:rows.length-1];const b=target.getBoundingClientRect(),before=e.clientY<(b.top+b.bottom)/2;layerDrag.target=Number(target.dataset.layerRow);layerDrag.before=before;target.classList.add(before?'drop-before':'drop-after');if(e.clientY>innerHeight-55)scrollBy(0,12);if(e.clientY<55)scrollBy(0,-12);});
const finishLayerDrag=(e,cancel=false)=>{if(!layerDrag||e.pointerId!==layerDrag.pointer)return;const d=layerDrag;layerDrag=null;if(d.grip.hasPointerCapture(d.pointer))d.grip.releasePointerCapture(d.pointer);document.querySelectorAll('[data-layer-row]').forEach(r=>r.classList.remove('drop-before','drop-after','dragging'));if(!cancel&&d.target&&Math.abs(e.clientY-d.start)>3)editor.reorder(d.layer,d.target,d.before);};
$('#controls').addEventListener('pointerup',e=>finishLayerDrag(e));$('#controls').addEventListener('pointercancel',e=>finishLayerDrag(e,true));
$('#controls').addEventListener('keydown',e=>{const grip=e.target.closest('[data-drag-layer]');if(grip&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const n=Number(grip.dataset.dragLayer);editor.stepLayer(n,e.key==='ArrowUp'?-1:1);document.querySelector(`[data-drag-layer="${n}"]`)?.focus();}});
$('#part-controls').addEventListener('change',e=>{const id=e.target.dataset.partToggle;if(id){e.target.checked?hiddenParts.delete(id):hiddenParts.add(id);updateStage();}});
$('#part-controls').addEventListener('click',e=>{const id=e.target.closest('[data-solo]')?.dataset.solo,choose=e.target.closest('[data-select-part]')?.dataset.selectPart;if(id){layers.forEach(l=>visibleLayers.add(l[0]));hiddenParts.clear();parts.filter(p=>p.id!==id).forEach(p=>hiddenParts.add(p.id));controls();updateStage();}if(choose){const p=parts.find(p=>p.id===choose);visibleLayers.add(p.layer);hiddenParts.delete(choose);updateStage();editor.select([choose],e.shiftKey);editor.canvas.focus({preventScroll:true});}});
$('#reset').addEventListener('click',reset);
$('#rank-choice').addEventListener('change',e=>{rank=Number(e.target.value);draw();});
await document.fonts.ready;
draw();fitIllustratedCards($('#examples').querySelectorAll('.card'));
let timer;addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(()=>{updateStage();fitIllustratedCards(document.querySelectorAll('#examples .card,#layers .card,#components .card'));},120);});
