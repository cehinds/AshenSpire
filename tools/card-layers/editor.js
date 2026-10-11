import {bounds,edges,nearest,moveSnapped,resizeBox,transformGroup} from './layout-math.js';
import {fitIllustratedCards} from '/src/ui/components/illustratedCard.js';
import {cardLayoutDocument,cardLayoutReferences} from '/src/ui/components/cardLayout.js';
import {cardLayoutDocumentWithChanges} from '/src/model/cardLayoutDocument.js';
import {applyCardAppearance} from '/src/ui/components/cardAppearance.js';
import {validateCardAppearance} from '/src/model/cardAppearance.js';
const WIDTH=360,HEIGHT=540,STORAGE='ashen-card-layer-editor-v1';
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
const copy=x=>JSON.parse(JSON.stringify(x));
const defaults=cardLayoutDocument(),originalOrder=defaults.order||[9,8,7,6,5,4,3,2,1];

export class CardLayoutEditor{
  constructor(host,onChange){
    this.host=host;this.onChange=onChange;this.selection=new Set();this.history=[];this.future=[];
    this.data={version:1,order:[...originalOrder],layouts:{}};
    try{const saved=JSON.parse(localStorage.getItem(STORAGE));if(saved?.version===1&&saved.order?.length===9&&new Set(saved.order).size===9&&saved.order.every(n=>originalOrder.includes(n))&&saved.layouts&&typeof saved.layouts==='object')this.data=saved;}catch{}
    this.toolbar=make('div','edit-toolbar');host.before(this.toolbar);
    this.toolbar.innerHTML='<div class="edit-options"><label><input type="checkbox" id="edit-grid" checked> Grid</label><label><input type="checkbox" id="edit-snap" checked> Snap</label><label><input type="checkbox" id="edit-aspect" checked> Keep ratio</label></div><div class="edit-actions"><button type="button" data-edit="undo" disabled>Undo</button><button type="button" data-edit="redo" disabled>Redo</button><button type="button" data-edit="reset">Reset layout</button><button type="button" data-edit="export">Export JSON</button></div><p class="edit-help">Select a part, then drag or resize. Shift-click adds parts. Arrow keys nudge; Shift nudges 10. Hold Alt to bypass snapping.</p><p class="edit-selection" aria-live="polite">Select a component</p>';
    this.toolbar.addEventListener('change',()=>{this.canvas?.classList.toggle('show-grid',this.grid);});
    this.toolbar.addEventListener('click',e=>{const action=e.target.dataset.edit;if(action==='undo')this.undo();if(action==='redo')this.redo();if(action==='reset'){this.checkpoint();this.data.layouts[this.key]={};this.data.order=[...originalOrder];this.changed();}if(action==='export')this.download();});
    const save=make('button','','Save to game');save.type='button';save.dataset.edit='save-game';save.addEventListener('click',()=>this.saveGame());this.toolbar.querySelector('.edit-actions').prepend(save);
    this.status=make('p','edit-save','Connecting to game JSON…');this.toolbar.append(this.status);
    this.ready=this.connect();
    this.appearance=make('details','edit-appearance');this.appearance.open=true;
    this.appearance.innerHTML='<summary>Component appearance</summary><label>Component <select data-visual-part></select></label><label>Image path <input data-visual-href placeholder="assets/card-components/example.png"></label><p>Leave empty to use its template image or symbol. Text stays bound to card data.</p><label>Appearance JSON <textarea data-visual-json rows="9" spellcheck="false"></textarea></label><button type="button" data-visual-apply>Apply to draft</button><p data-visual-status aria-live="polite"></p>';
    document.querySelector('#controls').parentElement.prepend(this.appearance);
    this.appearance.querySelector('[data-visual-part]').addEventListener('change',()=>this.showAppearance());
    this.appearance.querySelector('[data-visual-apply]').addEventListener('click',()=>this.editAppearance());
  }
  async connect(){try{const response=await fetch('/__editor/card-layout'),result=await response.json();if(!response.ok)throw Error(result.error);this.revision=result.revision;this.gameDocument=result.document;this.status.textContent='Connected to game JSON · Save to game applies this shared layout to every card.';}catch{this.status.textContent='Game save unavailable on this server. Start it with --editor-write; browser drafts remain available.';}}
  get order(){return this.data.order;}
  get grid(){return this.toolbar.querySelector('#edit-grid').checked;}
  get snap(){return this.toolbar.querySelector('#edit-snap').checked;}
  get aspect(){return this.toolbar.querySelector('#edit-aspect').checked;}
  get layout(){return this.data.layouts[this.key]??={};}
  level(layer){return 9-this.order.indexOf(layer);}
  checkpoint(){this.history.push(copy(this.data));if(this.history.length>50)this.history.shift();this.future=[];this.buttons();}
  buttons(){this.toolbar.querySelector('[data-edit="undo"]').disabled=!this.history.length;this.toolbar.querySelector('[data-edit="redo"]').disabled=!this.future.length;}
  save(){try{localStorage.setItem(STORAGE,JSON.stringify(this.data));this.status.textContent='Draft saved in this browser · Save to game or Export JSON to apply it to every card.';}catch{this.status.textContent='Browser draft storage unavailable. Save to game to keep your layout.';}this.buttons();}
  undo(){if(!this.history.length)return;this.future.push(copy(this.data));this.data=this.history.pop();this.mount(this.originalReference.cloneNode(true),this.parts,this.key,this.isVisible);this.changed();}
  redo(){if(!this.future.length)return;this.history.push(copy(this.data));this.data=this.future.pop();this.mount(this.originalReference.cloneNode(true),this.parts,this.key,this.isVisible);this.changed();}
  changed(){this.save();this.apply();this.onChange?.();}
  reorder(layer,target,before=true){if(layer===target)return;this.checkpoint();const order=this.order.filter(n=>n!==layer);order.splice(order.indexOf(target)+(before?0:1),0,layer);this.data.order=order;this.changed();}
  stepLayer(layer,delta){const at=this.order.indexOf(layer),next=at+delta;if(next<0||next>=9)return;this.reorder(layer,this.order[next],delta<0);}
  document(){return {version:1,order:this.order,coordinateSpace:{width:WIDTH,height:HEIGHT},currentCard:this.key,defaultLayout:'shared',groups:defaults.groups,components:this.data.components||defaults.components,symbols:this.data.symbols||defaults.symbols,referenceRects:this.referenceRects,layouts:{shared:Object.fromEntries(this.parts.map(p=>[p.id,{...this.rect(p.id)}]))}};}
  appearanceTarget(){const id=this.appearance.querySelector('[data-visual-part]').value;if(id.startsWith('symbol:')){const [,catalog,key]=id.split(':');return {catalog,key};}return {id};}
  showAppearance(){
    const {id,catalog,key}=this.appearanceTarget(),v=id?(this.data.components||defaults.components)?.[id]:(this.data.symbols||defaults.symbols)?.[catalog]?.[key];
    const value=copy(v||{}),href=this.appearance.querySelector('[data-visual-href]');href.value=value.href||'';href.disabled=!!id&&/^(title|rules|rank-text|action-text|.*-value|rank-group|tag-rail|footer-band)$/.test(id);delete value.href;this.appearance.querySelector('[data-visual-json]').value=JSON.stringify(value,null,2);
  }
  editAppearance(){
    const status=this.appearance.querySelector('[data-visual-status]');
    try{const value=JSON.parse(this.appearance.querySelector('[data-visual-json]').value),href=this.appearance.querySelector('[data-visual-href]').value.trim();value.href=href||null;validateCardAppearance({components:{draft:value}});
      const {id,catalog,key}=this.appearanceTarget();this.checkpoint();this.data.components??=copy(defaults.components||{});this.data.symbols??=copy(defaults.symbols||{});if(id)this.data.components[id]=value;else this.data.symbols[catalog][key]=value;
      this.save();this.mount(this.originalReference.cloneNode(true),this.parts,this.key,this.isVisible);this.onChange?.();status.textContent='Applied to draft. Save to game to update all cards.';
    }catch(error){status.textContent=error.message;}
  }
  async saveGame(download=false){
    if(this.saving)return;this.saving=true;this.status.textContent='Saving the shared game layout…';
    try{await this.ready;if(!this.revision)throw Error('Game save is unavailable. Run the local server with --editor-write.');
      const response=await fetch('/__editor/card-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:this.revision,document:this.document()})}),result=await response.json();if(!response.ok)throw Error(result.error||'Save failed');
      this.revision=result.revision;this.gameDocument=result.document;
      this.status.textContent=download?'Saved to game JSON and exported. Reloading the game preview…':'Saved to game JSON. Reloading the renderer…';
      delete this.data.layouts[this.key];delete this.data.components;delete this.data.symbols;localStorage.setItem(STORAGE,JSON.stringify(this.data));setTimeout(()=>location.reload(),150);
    }catch(error){this.status.textContent='Not saved to game: '+error.message;}finally{this.saving=false;}
  }
  download(){
    if(!this.gameDocument||this.saving){this.status.textContent='Wait for the game connection before exporting.';return;}
    // Start the download in the button's activation event, before the async save.
    const data=cardLayoutDocumentWithChanges(this.gameDocument,this.document()),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'})),a=make('a');a.href=url;a.download='ashen-card-layout.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    return this.saveGame(true);
  }
  mount(reference,parts,key,isVisible){
    if(this.drag)this.cancel();
    if(this.key!==key)this.selection.clear();this.key=key;this.parts=parts;this.isVisible=isVisible;
    this.originalReference=reference.cloneNode(true);
    applyCardAppearance(reference.querySelector('.illustrated-card-face'),{...defaults,components:this.data.components||defaults.components,symbols:this.data.symbols||defaults.symbols});
    this.host.replaceChildren();this.canvas=make('div','edit-canvas'+(this.grid?' show-grid':''));this.canvas.tabIndex=0;this.canvas.setAttribute('role','group');this.canvas.setAttribute('aria-label','Card layout canvas. Select components and use arrow keys to move them.');this.host.append(this.canvas);
    reference.classList.add('editor-reference');reference.setAttribute('aria-hidden','true');reference.querySelector('.illustrated-card-face').dataset.layoutMeasure='true';this.canvas.append(reference);fitIllustratedCards([reference]);
    this.referenceRects=cardLayoutReferences(reference.querySelector('.illustrated-card-face'));
    const face=reference.querySelector('.illustrated-card-face'),fr=face.getBoundingClientRect(),scale=fr.width/WIDTH;
    this.base=new Map();this.planes=new Map();
    for(const p of parts){
      const node=reference.querySelector(`[data-explorer-part="${p.id}"]`);let b=node.getBoundingClientRect();
      // The footer SVG covers the canvas, but its selectable artwork is only the footer.
      if(p.id==='footer-trim'){const box=node.getBBox();b={left:b.left+box.x*scale,top:b.top+box.y*scale,width:box.width*scale,height:box.height*scale};}
      this.base.set(p.id,{x:(b.left-fr.left)/scale,y:(b.top-fr.top)/scale,w:Math.max(1,b.width/scale),h:Math.max(1,b.height/scale)});
      const plane=make('div','edit-plane');plane.dataset.editPart=p.id;plane.dataset.editLayer=p.layer;plane.setAttribute('aria-hidden','true');
      const card=reference.cloneNode(true);card.classList.remove('editor-reference');
      for(const n of card.querySelectorAll('[data-explorer-part]'))n.style.visibility=n.dataset.explorerPart===p.id?'visible':'hidden';
      plane.append(card);this.canvas.append(plane);this.planes.set(p.id,plane);
    }
    this.overlay=make('div','edit-overlay');this.canvas.append(this.overlay);
    this.guideHost=make('div','edit-guides');this.canvas.append(this.guideHost);
    this.canvas.addEventListener('pointerdown',e=>this.start(e));this.canvas.addEventListener('pointermove',e=>this.move(e));this.canvas.addEventListener('pointerup',e=>this.end(e));this.canvas.addEventListener('pointercancel',()=>this.cancel());
    this.canvas.addEventListener('keydown',e=>this.keydown(e));this.canvas.addEventListener('lostpointercapture',()=>{if(this.drag)this.cancel();});
    for(const id of this.selection)if(!this.base.has(id))this.selection.delete(id);
    const chooser=this.appearance.querySelector('[data-visual-part]'),chosen=chooser.value;chooser.replaceChildren();
    for(const p of parts){const option=make('option','',p.name);option.value=p.id;chooser.append(option);}
    for(const id of ['tag-rail','rank-group','footer-band']){const option=make('option','',id+' styling');option.value=id;chooser.append(option);}
    for(const [catalog,items] of Object.entries(this.data.symbols||defaults.symbols||{}))for(const key of Object.keys(items)){const option=make('option','',catalog+' symbol: '+key);option.value='symbol:'+catalog+':'+key;chooser.append(option);}
    if([...chooser.options].some(o=>o.value===chosen))chooser.value=chosen;this.showAppearance();
    this.apply();
  }
  rect(id){const saved=this.layout[id];return saved&&['x','y','w','h'].every(k=>Number.isFinite(saved[k]))&&saved.w>0&&saved.h>0?saved:this.base.get(id);}
  select(ids,add=false){
    const expanded=new Set(ids);for(const group of Object.values(defaults.groups||{}))if(group.members.some(id=>expanded.has(id)))group.members.forEach(id=>{if(this.base?.has(id))expanded.add(id);});
    const remove=add&&[...expanded].every(id=>this.selection.has(id));if(!add)this.selection.clear();for(const id of expanded)if(this.base?.has(id)){if(remove)this.selection.delete(id);else this.selection.add(id);}this.apply();this.onChange?.();
    if(ids[0]){this.appearance.querySelector('[data-visual-part]').value=ids[0];this.showAppearance();}
  }
  apply(){
    if(!this.canvas)return;
    const scale=this.canvas.clientWidth/WIDTH;
    for(const p of this.parts){const plane=this.planes.get(p.id),base=this.base.get(p.id),r=this.rect(p.id);plane.style.display=this.isVisible(p.id)?'block':'none';plane.style.zIndex=this.level(p.layer);plane.style.transformOrigin=`${base.x/WIDTH*100}% ${base.y/HEIGHT*100}%`;plane.style.transform=`translate(${(r.x-base.x)*scale}px,${(r.y-base.y)*scale}px) scale(${r.w/base.w},${r.h/base.h})`;}
    this.overlay.replaceChildren();
    const selected=[...this.selection].filter(id=>this.base.has(id));
    if(selected.length){
      const r=bounds(selected.map(id=>this.rect(id))),box=make('div','edit-selection-box');this.position(box,r);this.overlay.append(box);
      for(const h of ['nw','n','ne','e','se','s','sw','w']){const handle=make('button','edit-handle handle-'+h);handle.type='button';handle.dataset.resize=h;handle.setAttribute('aria-label','Resize '+h.toUpperCase());box.append(handle);}
      this.toolbar.querySelector('.edit-selection').textContent=(selected.length===1?this.parts.find(p=>p.id===selected[0]).name:`${selected.length} components`)+` · X ${Math.round(r.x)} · Y ${Math.round(r.y)} · ${Math.round(r.w)} × ${Math.round(r.h)}`;
    }else this.toolbar.querySelector('.edit-selection').textContent='Select a component';
    this.buttons();
  }
  position(node,r){Object.assign(node.style,{left:r.x/WIDTH*100+'%',top:r.y/HEIGHT*100+'%',width:r.w/WIDTH*100+'%',height:r.h/HEIGHT*100+'%'});}
  point(e){const r=this.canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*WIDTH/r.width,y:(e.clientY-r.top)*HEIGHT/r.height};}
  targets(){
    const out={x:[],y:[]};
    const add=(r,name)=>{for(const axis of ['x','y'])edges(r,axis).forEach((value,i)=>out[axis].push({value,label:name+' '+(['left','center','right'][i]),kind:'edge'}));};
    add({x:0,y:0,w:WIDTH,h:HEIGHT},'Card');
    for(const p of this.parts)if(!this.selection.has(p.id)&&this.isVisible(p.id))add(this.rect(p.id),p.name);
    if(this.grid)for(const axis of ['x','y'])for(let v=0;v<=(axis==='x'?WIDTH:HEIGHT);v+=12)out[axis].push({value:v,label:'Grid',kind:'grid'});
    return out;
  }
  start(e){
    if(e.button!==0)return;const point=this.point(e),handle=e.target.dataset.resize;
    if(!handle){
      const contains=r=>point.x>=r.x&&point.x<=r.x+r.w&&point.y>=r.y&&point.y<=r.y+r.h;
      const selected=[...this.selection].filter(id=>this.isVisible(id));
      const inSelection=selected.length&&contains(bounds(selected.map(id=>this.rect(id))));
      if(!inSelection||e.shiftKey){
        const hit=this.parts.filter(p=>{
          const r=this.rect(p.id);if(!this.isVisible(p.id)||!contains(r))return false;
          // Transparent frame interiors must not steal clicks from the artwork.
          const inset={'card-trim':[.065,.055],'panel-trim':[.055,.13],'flag-trim':[.13,.08],'footer-trim':[.08,.12]}[p.id];
          if(inset&&point.x>r.x+r.w*inset[0]&&point.x<r.x+r.w*(1-inset[0])&&point.y>r.y+r.h*inset[1]&&point.y<r.y+r.h*(1-inset[1]))return false;
          return true;
        }).sort((a,b)=>this.level(b.layer)-this.level(a.layer)||(this.rect(a.id).w*this.rect(a.id).h-this.rect(b.id).w*this.rect(b.id).h))[0];
        if(!hit){this.select([]);return;}this.select([hit.id],e.shiftKey);
      }
    }
    if(!this.selection.size)return;e.preventDefault();this.canvas.focus({preventScroll:true});
    this.drag={pointer:e.pointerId,start:point,handle,rects:Object.fromEntries([...this.selection].map(id=>[id,{...this.rect(id)}])),previous:copy(this.data),moved:false};
    this.drag.box=bounds(Object.values(this.drag.rects));this.drag.targets=this.targets();this.canvas.setPointerCapture(e.pointerId);
  }
  move(e){
    const d=this.drag;if(!d||e.pointerId!==d.pointer)return;e.preventDefault();const p=this.point(e),dx=p.x-d.start.x,dy=p.y-d.start.y;
    if(!d.moved&&Math.hypot(dx,dy)<.5)return;d.moved=true;
    let r=d.handle?resizeBox(d.box,d.handle,dx,dy,this.aspect):{...d.box,x:d.box.x+dx,y:d.box.y+dy},guides={};
    if(this.snap&&!e.altKey){
      const tolerance=6*WIDTH/this.canvas.clientWidth;
      if(!d.handle){const snapped=moveSnapped(d.box,dx,dy,d.targets,tolerance);r=snapped.rect;guides=snapped.guides;}
      else{
        const hx=d.handle.includes('w')?'w':d.handle.includes('e')?'e':null,hy=d.handle.includes('n')?'n':d.handle.includes('s')?'s':null;
        const sx=hx?nearest([hx==='w'?r.x:r.x+r.w],d.targets.x,tolerance):null,sy=hy?nearest([hy==='n'?r.y:r.y+r.h],d.targets.y,tolerance):null;
        if(this.aspect){
          const useX=sx&&(!sy||Math.abs(sx.delta)<=Math.abs(sy.delta));
          if(useX){const w=r.w+(hx==='w'?-sx.delta:sx.delta),h=w*d.box.h/d.box.w;r={x:hx==='w'?d.box.x+d.box.w-w:d.box.x,y:hy==='n'?d.box.y+d.box.h-h:hy==='s'?d.box.y:d.box.y+(d.box.h-h)/2,w,h};guides.x=sx;}
          else if(sy){const h=r.h+(hy==='n'?-sy.delta:sy.delta),w=h*d.box.w/d.box.h;r={x:hx==='w'?d.box.x+d.box.w-w:hx==='e'?d.box.x:d.box.x+(d.box.w-w)/2,y:hy==='n'?d.box.y+d.box.h-h:d.box.y,w,h};guides.y=sy;}
        }else{if(sx){if(hx==='w'){r.x+=sx.delta;r.w-=sx.delta;}else r.w+=sx.delta;guides.x=sx;}if(sy){if(hy==='n'){r.y+=sy.delta;r.h-=sy.delta;}else r.h+=sy.delta;guides.y=sy;}}
      }
    }
    if(r.w<4||r.h<4)return;
    for(const [id,original] of Object.entries(d.rects))this.layout[id]=transformGroup(original,d.box,r);
    this.apply();this.guides(guides);
  }
  guides(items){this.guideHost.replaceChildren();for(const axis of ['x','y']){const guide=items[axis];if(!guide)continue;const line=make('div','snap-guide guide-'+axis);line.style[axis==='x'?'left':'top']=guide.value/(axis==='x'?WIDTH:HEIGHT)*100+'%';line.dataset.snapValue=guide.value;this.guideHost.append(line);}}
  end(e){const d=this.drag;if(!d||d.pointer!==e.pointerId)return;this.drag=null;if(d.moved){this.history.push(d.previous);if(this.history.length>50)this.history.shift();this.future=[];this.changed();}this.guides({});if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);}
  cancel(){if(!this.drag)return;const d=this.drag;this.drag=null;this.data=d.previous;this.apply();this.guides({});if(this.canvas.hasPointerCapture(d.pointer))this.canvas.releasePointerCapture(d.pointer);}
  keydown(e){
    if(e.key==='Escape'){if(this.drag)this.cancel();else this.select([]);return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?this.redo():this.undo();return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta||!this.selection.size)return;e.preventDefault();this.checkpoint();for(const id of this.selection){const r=this.rect(id);this.layout[id]={...r,x:r.x+delta[0]*(e.shiftKey?10:1),y:r.y+delta[1]*(e.shiftKey?10:1)};}this.changed();
  }
}
