import {CLASS_IDS,WEAPONS,OUTFIT_ROWS,FRAME_NAMES,FRAME_MS,frameNamesFor} from './catalog.mjs';
import {ACTIONS,resolveAction} from './action-resolver.mjs';
import {loadImages,drawPose} from './renderer.mjs';
const $=id=>document.getElementById(id),manifest=await fetch('art/attack-library/manifest.json').then(r=>r.json());
const title=s=>s.replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
let cls=new URLSearchParams(location.search).get('class')||'reaver';if(!CLASS_IDS.includes(cls))cls='reaver';
let images={},resolved,sequence,frame=0,playing=false,elapsed=0,previous=performance.now(),revision=0;
const option=(value,label)=>Object.assign(document.createElement('option'),{value,textContent:label});
$('main').append(...WEAPONS.map(w=>option(w.id,w.name)));$('off').append(option('','Empty hand'),...WEAPONS.map(w=>option(w.id,w.name)));
$('action').append(...Object.entries(ACTIONS).map(([id,a])=>option(id,a.name)));
$('main').value='straightSword';
for(const id of CLASS_IDS){const b=document.createElement('button');b.type='button';b.textContent=title(id);b.dataset.class=id;b.onclick=()=>{cls=id;updateOutfits();select()};$('classes').append(b)}
function updateOutfits(){const old=$('outfit').value;$('outfit').replaceChildren(...OUTFIT_ROWS.filter(x=>x.classId===cls).map(x=>option(x.id,x.name)));if([...$('outfit').options].some(o=>o.value===old))$('outfit').value=old;for(const b of $('classes').children)b.setAttribute('aria-pressed',String(b.dataset.class===cls));history.replaceState(null,'',`?class=${cls}`)}
function loadout(outfit=$('outfit').value){return {classId:cls,outfit,main:$('main').value,off:$('off').value||null,handsRequired:$('grip').value==='two'?2:$('grip').value==='one'?1:undefined,oneHandAllowed:$('grip').value==='one'};}
function options(){return {debug:$('anchors').checked,layer:$('layer').value};}
function paint(){
 const success=sequence&&drawPose($('stage'),images,sequence,frame,loadout(),options());
 if(!success){const c=$('stage').getContext('2d');c.fillStyle='#17130f';c.fillRect(0,0,640,640);}
 $('frame').value=frame;$('frame-label').value=`${frame+1} / 7 · ${frameNamesFor($('action').value,resolved?.clip||'empty')[frame]}`;
 window.attackLibrary={classId:cls,frame,playing,resolved,available:!!sequence,sequenceId:sequence?`${sequence.outfit}/${sequence.clip}`:null};
}
function stop(){playing=false;$('play').textContent='Play';}
async function select(){
 const rev=++revision;stop();frame=0;sequence=null;resolved=resolveAction(loadout(),$('action').value);$('outfit-sheets').replaceChildren();paint();
 $('sequence-name').textContent=resolved.allowed?title(resolved.clip):'Equipment conflict';
 $('tags').replaceChildren(...(resolved.tags||[]).map(t=>Object.assign(document.createElement('span'),{textContent:t})));
 if(!resolved.allowed){$('notice').textContent=resolved.reason;$('play').disabled=true;$('description').textContent='Choose a compatible hand configuration.';return;}
 const visible=OUTFIT_ROWS.filter(o=>o.classId===cls).map(outfit=>({outfit,seq:manifest.sequences[`${outfit.key}/${resolved.clip}`]}));
 const subset={sequences:Object.fromEntries(visible.filter(x=>x.seq).map(x=>[x.outfit.key,x.seq]))};
 const decoded=await loadImages(subset);if(rev!==revision)return;images=decoded;
 sequence=manifest.sequences[`${resolved.outfit}/${resolved.clip}`];
 $('play').disabled=!sequence||sequence.frames.some(x=>!x);
 $('notice').textContent=!sequence?'This equipment/action sequence still needs artwork.':sequence.frames.some(x=>!x)?'Incomplete hand registration · playback held for correction.':'Review draft · grip edges and hand angles still need cleanup';
 $('description').textContent=!sequence?'No substitute sprite is shown for this combination.':`${title(cls)} · ${OUTFIT_ROWS.find(o=>o.key===resolved.outfit).name}. Seven timed frames, complete body artwork, separate equipment and foreground hand layers.`;
 for(const {outfit,seq}of visible){const row=document.createElement('article');row.className='outfit-sheet';row.append(Object.assign(document.createElement('h3'),{textContent:outfit.name}));
  if(!seq)row.append(Object.assign(document.createElement('p'),{textContent:'Awaiting this pose set.'}));
  else {const grid=document.createElement('div');grid.className='sheet-grid';for(let i=0;i<7;i++){
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`${outfit.name}, frame ${i+1}`);const canvas=document.createElement('canvas');canvas.width=canvas.height=640;
   drawPose(canvas,images,seq,i,loadout(outfit.id),options());button.append(canvas,Object.assign(document.createElement('span'),{textContent:`${i+1} · ${frameNamesFor($('action').value,seq.clip)[i]}`}));
   button.onclick=async()=>{if($('outfit').value!==outfit.id){$('outfit').value=outfit.id;await select()}stop();frame=i;paint()};grid.append(button)
  }row.append(grid)}$('outfit-sheets').append(row);
 }
 paint();
}
for(const id of ['outfit','main','off','action','grip'])$(id).onchange=()=>select().catch(fail);
for(const id of ['anchors','layer'])$(id).onchange=()=>select().catch(fail);
$('frame').oninput=()=>{stop();frame=Number($('frame').value);paint()};
$('play').onclick=()=>{if(!sequence)return;playing=!playing;$('play').textContent=playing?'Pause':'Play';if(playing){frame=0;elapsed=0;previous=performance.now()}paint()};
function tick(now){if(playing&&sequence){elapsed+=(now-previous)*Number($('speed').value);while(elapsed>=FRAME_MS[frame]){elapsed-=FRAME_MS[frame];frame=(frame+1)%7}paint()}previous=now;requestAnimationFrame(tick)}requestAnimationFrame(tick);
const examples=[['Sword + shield','reaver','straightSword','kiteShield','attack','auto'],['Twin blades','reaver','straightSword','katana','attack','auto'],['Greatsword','reaver','greatsword','','attack','auto'],['Staff cast','starseer','starstoneStaff','','cast','one'],['Two-hand cast','starseer','starstoneStaff','','cast','two'],['Shield impact','reaver','straightSword','kiteShield','block','auto'],['Dodge','rogue','dagger','','dodge','auto'],['Buff','herald','boneSceptre','','buff','auto'],['Hurt','reaver','straightSword','','hurt','auto']];
for(const [label,classId,main,off,action,grip]of examples){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{cls=classId;updateOutfits();$('main').value=main;$('off').value=off;$('action').value=action;$('grip').value=grip;select().catch(fail)};$('examples').append(b)}
const seqs=Object.values(manifest.sequences),valid=seqs.filter(s=>s.frames.every(Boolean));
$('coverage').textContent=`${WEAPONS.length} armaments · ${OUTFIT_ROWS.length} outfits · ${valid.length} sequences registered / ${seqs.length} drawn · none approved`;
const table=document.createElement('table');table.innerHTML='<thead><tr><th>Action</th><th>Equipment variants</th></tr></thead>';const tbody=document.createElement('tbody');
for(const [id,a]of Object.entries(ACTIONS)){const tr=document.createElement('tr');const names=id==='attack'?'One hand, shield cover, offhand focus, twin, two hands, bow, bash':id==='cast'?'One hand, occupied offhand, two hands, dual focus':id==='defend'||id==='block'?'Shield, weapon, two hands, parrying dagger':'Free hand, occupied offhand, two hands';tr.append(Object.assign(document.createElement('td'),{textContent:a.name}),Object.assign(document.createElement('td'),{textContent:names}));tbody.append(tr)}table.append(tbody);$('roadmap').append(table,Object.assign(document.createElement('p'),{className:'small',textContent:'This table is the target coverage, not an assertion that every pose has been drawn. Dice, status and spell effects will be separate layers. All studies still require visual approval.'}));
function fail(error){stop();$('notice').textContent=`Preview error: ${error.message}`;console.error(error)}
updateOutfits();await select().catch(fail);
