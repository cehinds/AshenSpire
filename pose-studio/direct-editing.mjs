import {clone, sample, startTime} from './model.mjs';
import {effectFrames} from './catalog.mjs';

const $ = s => document.querySelector(s);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// View transforms never enter the portable project or its undo history.
export function createDirectEditor(api) {
  const canvas = $('#stage'), tracks = $('#tracks');
  const camera = {zoom:1, x:500, y:300};
  let gesture = null, sizeBefore = null, suppressClick = false;
  $('#timeline-detail').onchange=e=>tracks.classList.toggle('detailed',e.target.checked);
  const state = api.state;
  const chosen = () => state().project.clips.find(c => c.id === state().selected);
  const facing = () => $('#direction').value === 'left';
  const screenPoint = e => {
    const box = canvas.getBoundingClientRect();
    return [(e.clientX-box.left)*1000/box.width, (e.clientY-box.top)*600/box.height];
  };
  function point(e) {
    const [sx, sy] = screenPoint(e);
    let x = (sx-500)/camera.zoom+camera.x;
    if (facing()) x = 1000-x;
    return [x/1000, ((sy-300)/camera.zoom+camera.y)/600];
  }
  function zoom(value) {
    camera.zoom = clamp(Number(value), .5, 3);
    $('#preview-zoom').value = Math.round(camera.zoom*100);
    $('#zoom-value').textContent = Math.round(camera.zoom*100)+'%';
    api.draw();
  }
  $('#preview-zoom').oninput = e => zoom(e.target.value/100);
  $('#zoom-in').onclick = () => zoom(camera.zoom+.25);
  $('#zoom-out').onclick = () => zoom(camera.zoom-.25);
  $('#zoom-fit').onclick = () => {camera.x=500;camera.y=300;zoom(1);};
  $('#zoom-character').onclick = () => {camera.x=facing()?700:300;camera.y=340;zoom(1.5);};
  $('#pan-preview').onclick = e => e.currentTarget.setAttribute('aria-pressed', String(e.currentTarget.getAttribute('aria-pressed')!=='true'));
  $('#show-target').onchange = api.draw;

  function remove(id=state().selected) {
    if (!id) return;
    api.stop();
    api.change(p => {p.clips=p.clips.filter(c=>c.id!==id);}, 'Effect removed. Undo restores it.');
  }
  function duplicate() {
    const c = chosen(); if (!c) return;
    const next = {...clone(c), id:'clip.'+crypto.randomUUID(), offset:c.offset+50};
    api.change(p=>p.clips.push(next), 'Effect duplicated.');
    api.select(next.id);
  }
  $('#quick-remove').onclick = () => remove();
  $('#quick-duplicate').onclick = duplicate;
  $('#quick-hide').onclick = () => {
    const c=chosen();if(c)api.change(p=>{p.clips.find(x=>x.id===c.id).muted=!c.muted;}, c.muted?'Effect shown.':'Effect hidden. Show restores it.');
  };
  const sizeInputs = ['#effect-size','#effect-size-number'];
  function previewSize(value) {
    if (!chosen() || !Number.isFinite(value)) return;
    api.stop();
    sizeBefore ||= clone(state().project);
    const p=clone(state().project);p.clips.find(c=>c.id===state().selected).size=clamp(Math.round(value),20,800);
    api.preview(p);sync();
  }
  function commitSize() {
    if(!sizeBefore)return;
    const next=clone(state().project),before=sizeBefore;sizeBefore=null;
    api.preview(before);api.change(p=>Object.assign(p,next),'Effect size updated.');
  }
  for(const selector of sizeInputs){
    $(selector).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid)previewSize(Number(e.target.value));};
    $(selector).onchange=()=>{commitSize();sync();};
  }
  for(const [selector,key] of [['#effect-start','start'],['#effect-length','duration'],['#effect-layer','layer']]){
    $(selector).onchange=e=>{
      const c=chosen();if(!c)return;
      const value=key==='layer'?e.target.value:Number(e.target.value);
      api.stop();
      api.change(p=>{const clip=p.clips.find(x=>x.id===c.id);if(key==='start'){clip.cue='anticipation';clip.offset=value;}else clip[key]=value;},'Effect timing updated.');
      api.select(c.id);
    };
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(gesture){cancelGesture();e.preventDefault();}
      if(sizeBefore){api.preview(sizeBefore);sizeBefore=null;sync();}
    }
    if(!$('#compose').hidden&&!$('#tool-dialog').open&&!e.target.closest('input,textarea,select,[contenteditable="true"]')&&['Delete','Backspace'].includes(e.key)&&chosen()){
      e.preventDefault();remove();
    }
  });

  function sync() {
    const c=chosen();
    for(const id of ['effect-size','effect-size-number','quick-remove','quick-duplicate','quick-hide','effect-start','effect-length','effect-layer'])$('#'+id).disabled=!c;
    $('#selected-effect').textContent=c?api.name(c.effect):'No effect selected';
    $('#selected-thumbnail').hidden=!c;
    if(c){
      $('#selected-thumbnail').src=state().project.assets[effectFrames[c.effect][2]]||'../'+effectFrames[c.effect][2];
      for(const selector of sizeInputs)if(document.activeElement!==$(selector))$(selector).value=c.size;
      $('#effect-start').value=Math.round(startTime(c,state().project));
      $('#effect-length').value=c.duration;$('#effect-layer').value=c.layer;
      $('#quick-hide').textContent=c.muted?'Show':'Hide';$('#quick-hide').setAttribute('aria-pressed',String(c.muted));
    }
    $('#selection-hint').textContent=!c?'Add an effect, or choose a sprite strip below.':c.muted?'Hidden in preview and playback. Choose Show to restore it.':!sample(state().project,state().time).effects.some(x=>x.id===c.id)?'Outside this effect’s time. Select its strip to see it.':'Drag to move · drag a corner to resize · Delete to remove';
  }
  function updateTime() {
    tracks.style.setProperty('--playhead',state().time/state().project.duration*100+'%');
    const c=chosen();if(c)$('#selection-hint').textContent=c.muted?'Hidden in preview and playback. Choose Show to restore it.':!sample(state().project,state().time).effects.some(x=>x.id===c.id)?'Outside this effect’s time. Select its strip to see it.':'Drag to move · drag a corner to resize · Delete to remove';
  }
  function renderTimeline() {
    const {project,selected}=state(), seconds=n=>(n/1000).toFixed(2)+' s';
    const rail = c => {
      const start=startTime(c,project),left=clamp(start/project.duration*100,0,100),end=clamp((start+c.duration)/project.duration*100,0,100);
      return `<div class="time-rail" data-rail="${esc(c.layer)}"><div role="button" tabindex="0" class="clip ${c.id===selected?'selected':''} ${c.muted?'muted-clip':''}" data-clip="${esc(c.id)}" aria-label="${esc(api.name(c.effect))}, ${seconds(start)}, ${c.duration} milliseconds. Arrow keys move; Shift plus arrows changes duration." aria-pressed="${c.id===selected}" style="left:${left}%;width:${Math.max(1,end-left)}%"><button class="trim start" data-trim="start" aria-label="Change start of ${esc(api.name(c.effect))}">‹</button><span class="clip-film">${effectFrames[c.effect].map(src=>`<img alt="" draggable="false" src="${project.assets[src]||'../'+src}">`).join('')}</span><span class="clip-caption">${esc(api.name(c.effect))}</span><button class="trim end" data-trim="end" aria-label="Change end of ${esc(api.name(c.effect))}">›</button></div><i class="playhead"></i></div>`;
    };
    tracks.innerHTML=`<div class="timeline-scroll"><div class="timeline-content"><div class="time-ruler"><span>Effects · ${project.clips.length}</span><div>${[0,.25,.5,.75,1].map(f=>`<span style="left:${f*100}%">${seconds(project.duration*f)}</span>`).join('')}</div></div>${['behind','front','aura'].map(layer=>`<section class="track"><h3>${{behind:'Behind character',front:'In front',aura:'Aura'}[layer]}</h3><div class="track-lane" data-layer="${layer}">${project.clips.filter(c=>c.layer===layer).map(c=>`<div class="effect-row"><div class="row-heading"><button class="row-select" data-select="${esc(c.id)}" title="Select ${esc(api.name(c.effect))}">${esc(api.name(c.effect))}</button><button class="row-remove" data-remove="${esc(c.id)}" aria-label="Remove ${esc(api.name(c.effect))}">×</button></div>${rail(c)}</div>`).join('')}<div class="effect-row drop-row"><span class="row-heading">＋ Add here</span><div class="time-rail drop-rail" data-rail="${layer}" tabindex="0" role="button" aria-label="Choose an effect for ${layer} at the playhead"><span>Drop an effect here</span><i class="playhead"></i></div></div></div></section>`).join('')}</div></div>`;
    sync();updateTime();
  }
  function railAt(e) {
    return document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-rail]');
  }
  const railTime=(e,rail)=>clamp((e.clientX-rail.getBoundingClientRect().left)/rail.getBoundingClientRect().width,0,1)*state().project.duration;
  function dropEffect(effect,e,target=e.target) {
    const rail=target.closest('[data-rail]'),slot=target.closest('[data-pose-slot]'),cue=target.closest('[data-cue]');
    if(rail){api.add(effect,null,null,{layer:rail.dataset.rail,start:Math.round(railTime(e,rail))});return true;}
    if(slot){api.add(effect,null,null,{start:Math.round(Number(slot.dataset.poseSlot)*state().project.duration/state().project.poses.length)});return true;}
    if(cue){api.add(effect,null,cue.dataset.cue);return true;}
    if(target===canvas){api.add(effect,point(e));return true;}
    return false;
  }
  for(const element of [canvas,$('#poses'),tracks,$('#cues')]){
    element.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';};
    element.ondrop=e=>{e.preventDefault();const effect=e.dataTransfer.getData('application/x-pose-effect');if(effectFrames[effect])dropEffect(effect,e);};
  }
  tracks.ondragstart=e=>e.preventDefault();
  tracks.onclick=e=>{
    if(suppressClick){suppressClick=false;return;}
    const removeButton=e.target.closest('[data-remove]');if(removeButton){remove(removeButton.dataset.remove);return;}
    const select=e.target.closest('[data-select]');if(select){api.select(select.dataset.select);return;}
    const clip=e.target.closest('[data-clip]');if(clip){api.select(clip.dataset.clip);return;}
    const rail=e.target.closest('[data-rail]');if(rail){api.stop();api.time(railTime(e,rail));api.status('Playhead moved. Choose an effect in the library to add it here.');$('#insert-layer').value=rail.dataset.rail;}
  };
  tracks.onkeydown=e=>{
    const el=e.target.closest('[data-clip]');
    if(el&&['ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();const id=el.dataset.clip,delta=(e.key==='ArrowRight'?1:-1)*10;
      api.change(p=>{const c=p.clips.find(x=>x.id===id);if(e.shiftKey)c.duration=clamp(c.duration+delta,60,30000);else c.offset=clamp(c.offset+delta,-30000,30000);},e.shiftKey?'Duration updated.':'Timing updated.');
      tracks.querySelector(`[data-clip="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
    }else if(['Enter',' '].includes(e.key)&&e.target.matches('[data-clip]')){e.preventDefault();api.select(el.dataset.clip);}
    else if(['Enter',' '].includes(e.key)&&e.target.matches('[data-rail]')){e.preventDefault();$('#insert-layer').value=e.target.dataset.rail;$('#add-effect').click();}
  };
  tracks.onpointerdown=e=>{
    const el=e.target.closest('[data-clip]');if(!el||e.button!==0)return;
    api.stop();const id=el.dataset.clip;
    api.select(id,false); // Keep the pointer's DOM node alive until release.
    const c=chosen(),rail=el.closest('[data-rail]');
    gesture={type:'timeline',id,before:clone(state().project),x:e.clientX,y:e.clientY,rail,el,edge:e.target.closest('[data-trim]')?.dataset.trim,start:startTime(c,state().project),moved:false};
    tracks.setPointerCapture(e.pointerId);e.preventDefault();
  };
  function moveTimeline(e) {
    if(e.clientY>innerHeight-40)window.scrollBy(0,12);else if(e.clientY<40)window.scrollBy(0,-12);
    const g=gesture,p=clone(g.before),c=p.clips.find(x=>x.id===g.id);
    const delta=Math.round((e.clientX-g.x)/g.rail.getBoundingClientRect().width*p.duration);
    g.moved ||= Math.hypot(e.clientX-g.x,e.clientY-g.y)>3;
    if(!g.moved)return;
    let start=g.start,end=g.start+c.duration;
    if(g.edge==='start')start=clamp(start+delta,0,end-60);
    else if(g.edge==='end')end=clamp(end+delta,Math.max(0,start)+60,p.duration);
    else{
      start=clamp(start+delta,0,Math.max(0,p.duration-60));end=start+c.duration;
      const rail=railAt(e);if(rail)c.layer=rail.dataset.rail;
    }
    c.cue='anticipation';c.offset=Math.round(start);c.duration=Math.round(end-start);
    api.preview(p);
    g.el.style.left=clamp(start/p.duration*100,0,100)+'%';g.el.style.width=Math.max(1,clamp(end/p.duration*100,0,100)-clamp(start/p.duration*100,0,100))+'%';
    api.status(`${api.name(c.effect)} · ${(start/1000).toFixed(2)} s · ${c.duration} ms · ${c.layer}`);
    highlight(railAt(e));sync();
  }
  function highlight(el){document.querySelectorAll('.drop-active').forEach(x=>x.classList.remove('drop-active'));el?.classList.add('drop-active');}
  function cancelGesture(){if(!gesture)return;const before=gesture.before;gesture.ghost?.remove();gesture=null;highlight(null);if(before)api.preview(before);api.render();}
  function finishGesture(e){
    if(!gesture)return;
    const g=gesture,next=clone(state().project);gesture=null;highlight(null);
    if(g.type==='library'){
      g.ghost.remove();suppressClick=true;setTimeout(()=>suppressClick=false,0);
      const target=document.elementFromPoint(e.clientX,e.clientY);
      if(!target||!dropEffect(g.effect,e,target))api.status('Drop on the preview, a pose, or a timeline layer. You can also tap an effect to add it.');
      return;
    }
    if(g.type==='pan')return;
    api.preview(g.before);
    if(g.moved){suppressClick=true;setTimeout(()=>suppressClick=false,0);api.change(p=>Object.assign(p,next),g.type==='timeline'?'Effect timing updated. Undo restores it.':'Effect transformed. Undo restores it.');}
    else api.render();
    if(g.type==='timeline'){api.select(g.id);tracks.querySelector(`[data-clip="${CSS.escape(g.id)}"]`)?.focus({preventScroll:true});}
  }
  tracks.onpointermove=e=>{if(gesture?.type==='timeline')moveTimeline(e);};
  tracks.onpointerup=finishGesture;tracks.onpointercancel=cancelGesture;

  // Library grips use Pointer Events so dragging works with a finger as well as a mouse.
  $('#effects').addEventListener('click',e=>{if(e.target.closest('.effect-grip')||suppressClick){e.stopImmediatePropagation();e.preventDefault();} },true);
  $('#effects').addEventListener('pointerdown',e=>{
    const grip=e.target.closest('.effect-grip');if(!grip||e.button!==0)return;
    const effect=grip.closest('[data-effect]').dataset.effect;
    const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=api.name(effect);document.body.append(ghost);
    gesture={type:'library',effect,ghost};grip.setPointerCapture(e.pointerId);e.preventDefault();
    moveLibrary(e);
  });
  function moveLibrary(e){
    const g=gesture;g.ghost.style.left=e.clientX+12+'px';g.ghost.style.top=e.clientY+12+'px';
    highlight(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-rail],.pose-cell,.stage-wrap'));
    if(e.clientY>innerHeight-55)window.scrollBy(0,18);else if(e.clientY<55)window.scrollBy(0,-18);
  }
  $('#effects').addEventListener('pointermove',e=>{if(gesture?.type==='library')moveLibrary(e);});
  $('#effects').addEventListener('pointerup',e=>{if(gesture?.type==='library')finishGesture(e);});
  $('#effects').addEventListener('pointercancel',()=>{if(gesture?.type==='library')cancelGesture();});
  function localPoint(pt,c){const dx=pt[0]*1000-c.x*1000,dy=pt[1]*600-c.y*600,r=-c.rotation*Math.PI/180;return [dx*Math.cos(r)-dy*Math.sin(r),dx*Math.sin(r)+dy*Math.cos(r)];}
  function activeEffects(){const effects=sample(state().project,state().time).effects;return [...effects.filter(c=>c.layer!=='front'),...effects.filter(c=>c.layer==='front')];}
  canvas.onpointerdown=e=>{
    if(e.button!==0)return;api.stop();
    if($('#pan-preview').getAttribute('aria-pressed')==='true'){
      gesture={type:'pan',pt:screenPoint(e),camera:{...camera}};
    }else{
      const pt=point(e),active=activeEffects(),current=active.find(c=>c.id===state().selected);
      const tolerance=Math.min(18*1000/canvas.getBoundingClientRect().width/camera.zoom,(current?.size||800)/3);
      const local=current&&localPoint(pt,current);
      const corner=local&&Math.abs(Math.abs(local[0])-current.size/2)<tolerance&&Math.abs(Math.abs(local[1])-current.size/2)<tolerance;
      const hit=corner?current:[...active].reverse().find(c=>localPoint(pt,c).every(n=>Math.abs(n)<=c.size/2));
      if(hit){
        api.select(hit.id,false);gesture={type:corner?'scale':'effect',id:hit.id,before:clone(state().project),pt,center:[hit.x,hit.y],moved:false};
      }else if($('#anchors').checked){
        const anchor=Object.keys(state().project.anchors).find(k=>Math.hypot((state().project.anchors[k][0]-pt[0])*1000,(state().project.anchors[k][1]-pt[1])*600)<16/camera.zoom);
        if(anchor)gesture={type:'anchor',key:anchor,before:clone(state().project),pt,moved:false};
      }
    }
    if(gesture){canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});sync();api.draw();}
  };
  canvas.onpointermove=e=>{
    const g=gesture;if(!g)return;
    if(g.type==='pan'){const pt=screenPoint(e);camera.x=g.camera.x-(pt[0]-g.pt[0])/camera.zoom;camera.y=g.camera.y-(pt[1]-g.pt[1])/camera.zoom;api.draw();return;}
    if(!['scale','effect','anchor'].includes(g.type))return;
    const pt=point(e),p=clone(g.before),c=p.clips.find(x=>x.id===g.id);g.moved=true;
    if(g.type==='scale'){
      const before=Math.hypot((g.pt[0]-g.center[0])*1000,(g.pt[1]-g.center[1])*600);
      const after=Math.hypot((pt[0]-g.center[0])*1000,(pt[1]-g.center[1])*600);
      c.size=clamp(Math.round(c.size*after/Math.max(1,before)),20,800);
    }else if(g.type==='anchor')p.anchors[g.key]=[clamp(pt[0],0,1),clamp(pt[1],0,1)];
    else {c.x=clamp(Math.round(c.x+(pt[0]-g.pt[0])*1000),-1000,1000);c.y=clamp(Math.round(c.y+(pt[1]-g.pt[1])*600),-600,600);}
    api.preview(p);sync();
  };
  canvas.onpointerup=finishGesture;canvas.onpointercancel=cancelGesture;
  return {
    render:renderTimeline, sync, time:updateTime, point,
    begin(ctx){ctx.save();ctx.translate(500,300);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);},
    end(ctx){ctx.restore();},
    selection(ctx,effects){
      const c=effects.find(x=>x.id===state().selected);if(!c)return;
      ctx.save();ctx.translate(c.x*1000,c.y*600);ctx.rotate(c.rotation*Math.PI/180);ctx.strokeStyle='#e1f4be';ctx.fillStyle='#e1f4be';ctx.lineWidth=2/camera.zoom;ctx.setLineDash([5/camera.zoom,4/camera.zoom]);ctx.strokeRect(-c.size/2,-c.size/2,c.size,c.size);ctx.setLineDash([]);
      const handle=12*1000/canvas.getBoundingClientRect().width/camera.zoom;
      for(const x of [-c.size/2,c.size/2])for(const y of [-c.size/2,c.size/2]){ctx.fillRect(x-handle/2,y-handle/2,handle,handle);ctx.strokeStyle='#1a2920';ctx.strokeRect(x-handle/2,y-handle/2,handle,handle);}
      ctx.restore();
    }
  };
}
