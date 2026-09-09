import { localMapPolicy } from '../../content/localMapPresentation.js';
import { localCamera, cameraSize, anchoredZoom, panCamera, inspectionCamera } from '../models/LocalMapCameraModel.js';
import { mountMapDetail } from './mapDetail.js';

export function mountLocalMapCamera(root, { mapId, source, points, saved, onSelect, onSave }) {
  const policy = localMapPolicy(mapId), port = root.querySelector('.atlas-local-port');
  const world = root.querySelector('.atlas-local-map'), output = root.querySelector('[data-local-zoom-value]');
  const picker = root.querySelector('[data-local-picker]'), pointers = new Map();
  let view = localCamera(saved, policy), selectedId = saved?.selectedId || null;
  let inspectionZoom = saved?.inspectionZoom || null, animation = 0, targetView = null, drag = false, suppressClick = false, gesture = null;
  const abort = new AbortController(), signal = abort.signal;
  let saveTimer = 0;
  const flush = () => { clearTimeout(saveTimer); onSave?.({ ...view, selectedId, inspectionZoom }); };
  const save = () => { clearTimeout(saveTimer); saveTimer=setTimeout(flush,200); };
  const dimensions = () => [port.clientWidth, port.clientHeight];
  function paint() {
    const [w,h] = dimensions(), size = cameraSize(view,w,h);
    world.style.cssText = `width:${size}px;height:${size}px;left:${w/2-view.x*size}px;top:${h/2-view.y*size}px`;
    port.dataset.zoom = String(view.zoom); port.dataset.centerX = String(view.x); port.dataset.centerY = String(view.y);
    port.dataset.labels = view.zoom >= 2 ? 'all' : 'selected';
    output.textContent = `${Math.round(view.zoom*100)}%`;
    for (const b of root.querySelectorAll('[data-local-zoom]')) {
      b.disabled = b.dataset.localZoom === 'in' ? view.zoom >= policy.maxZoom : b.dataset.localZoom === 'out' ? view.zoom <= policy.minZoom : false;
    }
  }
  const stop = () => { cancelAnimationFrame(animation); animation = 0; };
  function move(next, smooth = false) {
    stop();
    targetView = next;
    if (!smooth || matchMedia('(prefers-reduced-motion: reduce)').matches) { view=next; paint(); return; }
    const from = {...view}, start = performance.now();
    const tick = now => {
      const t = Math.min(1,(now-start)/policy.focusDuration), eased = 1-(1-t)**3;
      view = Object.fromEntries(['x','y','zoom'].map(key=>[key,from[key]+(next[key]-from[key])*eased])); paint();
      if (t<1) animation=requestAnimationFrame(tick); else { animation=0; save(); }
    };
    animation=requestAnimationFrame(tick);
  }
  function select(id, smooth = true) {
    const point=points.find(p=>p.nodeId===id); if (!point) return;
    selectedId=id; picker.value=id;
    const next=inspectionCamera(view,point,inspectionZoom,policy); inspectionZoom=next.zoom;
    onSelect(id); move(next,smooth); if (!animation) save();
  }
  function zoom(factor, anchor) {
    stop(); const [w,h]=dimensions();
    // Keyboard/buttons favor the selected site; wheel/pinch pass their own anchor.
    const point=points.find(p=>p.nodeId===selectedId), size=cameraSize(view,w,h);
    anchor ||= point ? {x:w/2+(point.x-view.x)*size,y:h/2+(point.y-view.y)*size} : {x:w/2,y:h/2};
    move(anchoredZoom(view,view.zoom*factor,anchor,w,h,policy)); inspectionZoom=null; save();
  }
  function pan(dx,dy) { stop(); move(panCamera(view,dx,dy,...dimensions(),policy)); save(); }
  root.querySelectorAll('[data-local-zoom]').forEach(b=>b.addEventListener('click',()=>{
    const kind=b.dataset.localZoom;
    if(kind==='fit') { inspectionZoom=null; move({x:.5,y:.5,zoom:policy.minZoom}); save(); }
    else zoom(kind==='in'?policy.zoomStep:1/policy.zoomStep);
  },{signal}));
  root.querySelectorAll('[data-local-pan]').forEach(b=>b.addEventListener('click',()=>{
    const [w,h]=dimensions(), d=b.dataset.localPan;
    pan(d==='left'?w*policy.panFraction:d==='right'?-w*policy.panFraction:0,d==='up'?h*policy.panFraction:d==='down'?-h*policy.panFraction:0);
  },{signal}));
  picker.addEventListener('change',()=>select(picker.value),{signal});
  port.addEventListener('wheel',e=>{
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); e.stopPropagation();
    const units=e.deltaMode===1?16:e.deltaMode===2?port.clientHeight:1;
    zoom(Math.exp(-Math.max(-240,Math.min(240,e.deltaY*units))*policy.wheelSensitivity),relative(e));
  },{passive:false,signal});
  port.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const plus=['+','='].includes(e.key)||e.code==='NumpadAdd', minus=e.key==='-'||e.code==='NumpadSubtract';
    if(!plus&&!minus&&!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if(plus||minus) zoom(plus?policy.zoomStep:1/policy.zoomStep);
    else { const [w,h]=dimensions(); pan(e.key==='ArrowLeft'?w*policy.panFraction:e.key==='ArrowRight'?-w*policy.panFraction:0,e.key==='ArrowUp'?h*policy.panFraction:e.key==='ArrowDown'?-h*policy.panFraction:0); }
  },{signal});
  // CSS UI zoom changes rendered pixels; camera math stays in layout pixels.
  const relative=e=>{const r=port.getBoundingClientRect();return {x:(e.clientX-r.left)*port.clientWidth/r.width,y:(e.clientY-r.top)*port.clientHeight/r.height};};
  function resetGesture() {
    const ps=[...pointers.values()], a=ps[0], b=ps[1];
    gesture=a?{view:{...view},anchor:b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a,distance:b?Math.hypot(a.x-b.x,a.y-b.y):0}:null;
  }
  port.addEventListener('pointerdown',e=>{
    if(e.button!==0 || pointers.size>=2) return;
    stop(); if(!pointers.size) {drag=false;suppressClick=false;}
    // Keep native click targeting for a tap; capture starts only after movement.
    pointers.set(e.pointerId,relative(e)); resetGesture();
    if(pointers.size===2) {drag=true;suppressClick=true;}
    if(!e.target.closest('button')) port.focus({preventScroll:true});
  },{signal});
  port.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!gesture) return;
    pointers.set(e.pointerId,relative(e)); const ps=[...pointers.values()], a=ps[0], b=ps[1];
    const anchor=b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a;
    const dx=anchor.x-gesture.anchor.x, dy=anchor.y-gesture.anchor.y;
    if(!drag&&Math.hypot(dx,dy)*port.getBoundingClientRect().width/port.clientWidth<policy.dragThreshold) return;
    drag=true; suppressClick=true; port.dataset.dragging='true';
    for(const id of pointers.keys()) if(!port.hasPointerCapture(id)) port.setPointerCapture(id);
    let next=gesture.view;
    if(b&&gesture.distance) next=anchoredZoom(next,next.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,gesture.anchor,...dimensions(),policy);
    view=panCamera(next,dx,dy,...dimensions(),policy); if(b) inspectionZoom=null; paint();
  },{signal});
  function end(e) {
    if(!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId); if(port.hasPointerCapture(e.pointerId)) port.releasePointerCapture(e.pointerId);
    if(e.type==='pointercancel') suppressClick=true;
    resetGesture(); if(!pointers.size) {delete port.dataset.dragging;save();}
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture']) port.addEventListener(type,end,{signal});
  // Also end a sub-threshold mouse gesture released outside the viewport.
  window.addEventListener('pointerup',end,{signal});
  port.addEventListener('click',e=>{
    if(suppressClick && e.detail !== 0) {e.preventDefault();e.stopPropagation();suppressClick=false;return;}
    const b=e.target.closest('[data-local-point]'); if(b) select(b.dataset.localPoint);
  },{signal});
  const resize=new ResizeObserver(()=>{
    // A service pane can change available geometry during the focus animation.
    // Finish at its intended center instead of freezing an intermediate frame.
    if(animation && targetView) { view=targetView; save(); }
    stop();paint();
  });resize.observe(port);
  paint(); const disposeDetail=mountMapDetail(port,world.querySelector('.map-detail-surface'),source);
  if(points.some(p=>p.nodeId===selectedId)) {picker.value=selectedId;onSelect(selectedId);}
  return () => {stop();flush();abort.abort();resize.disconnect();disposeDetail();};
}
