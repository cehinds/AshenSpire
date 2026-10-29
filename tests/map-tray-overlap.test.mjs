import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const screen=readFileSync(new URL('../src/ui/screens/map.js',import.meta.url),'utf8');
const component=readFileSync(new URL('../src/ui/components/mapboard.js',import.meta.url),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a,`actual source boundary ${start}`);return text.slice(a,b);}
const traySource=section(screen,'  function trayViewport(', '  function closeTray(');
const centerSource=section(component,'  function centerOnNode(', '  // ⊙');
const holdSource=section(component,'  function holdLook(', '  // Closing a tray');
const refitSource=section(component,'export function refitCamera(', '/**\n * mountMapBoard').replace('export ','');
function fixture({top=152.546875,height=660.140625,clientHeight=733,offsetHeight=733,trayTop=844,revealHeight=139,gutter=0}={}){
 const geometry={top,height,clientHeight,offsetHeight,trayTop,revealHeight};const target={id:'n1_5',x:435,y:820};const calls=[];
 const scroll={clientWidth:433,scrollWidth:1800,scrollHeight:4000,scrollLeft:0,scrollTop:0,
  get clientHeight(){return geometry.clientHeight},get offsetHeight(){return geometry.offsetHeight},
  getBoundingClientRect:()=>({left:0,right:390,top:geometry.top,bottom:geometry.top+geometry.height,height:geometry.height,width:390})};
 const content={x0:0,y0:0};const cameraContext={byId:{n1_5:target},insetBottom:0,look:null,scroll,content,zoom:1.037,freePan:true,
  py:n=>n.y,px:n=>n.x,sizeSvg:()=>{content.y0=-scroll.clientHeight/(2*cameraContext.zoom)},
  glideTo:(to,ms,done)=>{calls.push({to,ms});scroll.scrollTop=to.top;scroll.scrollLeft=to.left;done?.()},emitViewState:()=>{}};
 const camera=runInNewContext(centerSource+holdSource+refitSource+'\n({centerOnNode,holdLook,refitCamera,getLook:()=>look,getInset:()=>insetBottom})',cameraContext);
 const tray={dataset:{open:'false'},getBoundingClientRect:()=>({top:geometry.trayTop})};
 const reveal={get scrollHeight(){return geometry.revealHeight},style:{},inert:true};
 const board={scroll,centerOnNode:camera.centerOnNode,holdLook:camera.holdLook};
 let manualNode=null;
 const physicalCenter=()=>geometry.top+((target.y-content.y0)*cameraContext.zoom-scroll.scrollTop)*geometry.height/geometry.offsetHeight;
 const context={board,tray,trayReveal:reveal,Number,Math,selection:{selectedId:'n1_5'},COMFORT_MARGIN_PX:24,lastPickPointerType:'mouse',
  app:{querySelector:()=>({getBoundingClientRect:()=>manualNode||{left:170,right:215,top:physicalCenter()-20,bottom:physicalCenter()+20}})},
  trayCentred:false,trayTimer:0,clearTimeout:()=>{},wait:(_ms,fn)=>fn(),trayTiming:{openDelayMs:0,slideMs:0},glideMs:()=>0,
  isEngaged:()=>false,enterButton:{disabled:false},focusElement:()=>assert.fail('fixture does not engage focus')};
 const api=runInNewContext(traySource+'\n({trayViewport,openTray,nodeComfortablyVisible})',context);
 const expectedBottom=()=>Math.max(geometry.top,Math.min(geometry.top+geometry.clientHeight*geometry.height/geometry.offsetHeight,geometry.trayTop-geometry.revealHeight*geometry.height/geometry.offsetHeight));
 const expectedCenter=()=>(geometry.top+expectedBottom())/2;
 return {geometry,scroll,target,content,camera,cameraContext,calls,context,api,physicalCenter,expectedCenter,reveal,setNode:r=>manualNode=r,gutter};
}
function near(a,b,tolerance=1e-7){assert.ok(Math.abs(a-b)<=tolerance,`${a} vs ${b}`);}
test('actual openTray and camera center the 390x844 phone above only the overlapping reveal',()=>{
 const f=fixture();f.api.openTray();near(f.physicalCenter(),f.expectedCenter());
 const scale=660.140625/733;near(f.camera.getInset(),139-31.3125/scale);
 assert.equal(typeof f.camera.getLook().inset,'function','look retains current geometry provider, not old footer height');
 // Baseline caller supplied the entire reveal. Keep its physical error visible;
 // do not weaken the real native gate or copy a learned16px offset into production.
 f.camera.centerOnNode('n1_5',{inset:139});near(f.physicalCenter()-f.expectedCenter(),-31.3125/2);
});
test('desktop gap0 retains native scrollbar gutter compensation',()=>{
 const f=fixture({top:146.375,height:697.625,clientHeight:573,offsetHeight:581,trayTop:844,revealHeight:127});
 f.api.openTray();near(f.camera.getInset(),127);near(f.physicalCenter(),f.expectedCenter());
});
test('the same open-tray look refreshes when a flow note hides or the viewport changes',()=>{
 const f=fixture();f.api.openTray();const look=f.camera.getLook();
 f.geometry.height+=31.3125;f.geometry.clientHeight=768;f.geometry.offsetHeight=768;
 f.camera.refitCamera({look,centerOnCurrent:()=>f.cameraContext.sizeSvg(),centerOnNode:f.camera.centerOnNode});
 near(f.camera.getInset(),139);near(f.physicalCenter(),f.expectedCenter());
 f.geometry.top=190;f.geometry.height=530;f.geometry.clientHeight=589;f.geometry.offsetHeight=589;f.geometry.trayTop=751;
 f.camera.refitCamera({look:f.camera.getLook(),centerOnCurrent:()=>f.cameraContext.sizeSvg(),centerOnNode:f.camera.centerOnNode});
 near(f.physicalCenter(),f.expectedCenter());
});
test('physical touch comfort matches the same visible band and keeps a fresh held look',()=>{
 const f=fixture();f.context.lastPickPointerType='touch';const bottom=f.api.trayViewport(139).visibleBottom;
 f.setNode({left:40,right:90,top:bottom-80,bottom:bottom-30});assert.equal(f.api.nodeComfortablyVisible(139),true);
 f.api.openTray();assert.equal(f.calls.length,0,'comfortable touch does not recenter');assert.equal(typeof f.camera.getLook().inset,'function');
 f.setNode({left:40,right:90,top:bottom-40,bottom:bottom-10});assert.equal(f.api.nodeComfortablyVisible(139),false,'footer margin remains required');
 f.context.lastPickPointerType='mouse';assert.equal(f.api.nodeComfortablyVisible(139),false,'mouse retains centering behavior');
});
test('nonoverlapping and oversized reveals clamp safely; missing/zero scale uses1',()=>{
 const f=fixture();f.geometry.trayTop=1200;assert.equal(f.api.trayViewport(139).inset,0);
 f.geometry.trayTop=844;f.geometry.revealHeight=2000;assert.equal(f.api.trayViewport(2000).visibleBottom,f.geometry.top);
 f.geometry.offsetHeight=0;f.geometry.height=0;f.geometry.top=100;f.geometry.trayTop=120;
 near(f.api.trayViewport(50).inset,30);assert.equal(f.api.trayViewport(-5).inset,0);assert.equal(f.api.trayViewport(NaN).inset,0);
});
test('numeric inset callers and unknown-node no-op remain supported',()=>{
 const f=fixture();f.camera.centerOnNode('n1_5',{inset:25});near(f.camera.getInset(),25);f.camera.holdLook('n1_5',{inset:12});near(f.camera.getInset(),12);
 const before=f.camera.getLook();f.camera.centerOnNode('missing',{inset:()=>assert.fail()});assert.equal(f.camera.getLook(),before);
});

// report() can shrink the flex scrollport before its observer is attached.
// Drive the actual mount's startRefitWatch AND actual observer, not a stand-in.
const watchSource=section(component,'export function watchViewport(', '/**\n * refitCamera').replace('export ','');
const startWatchSource=section(component,'  function startRefitWatch(', '  function recenter(');
function watchFixture({beforeReport={width:433,height:768},actual={width:433,height:733}}={}){
 const shape={...actual},timers=new Map(),observers=[],fits=[];let id=0;
 class RO{constructor(callback){this.callback=callback;this.live=true;observers.push(this)}observe(){}disconnect(){this.live=false}}
 const context={solvedViewport:{width:1440,height:900},viewportBeforeReport:{...beforeReport},stopRefitWatch:null,restoreWrite:null,restored:null,scroll:{isConnected:true,get clientWidth(){return shape.width},get clientHeight(){return shape.height}},
  ResizeObserver:RO,setTimeout:(fn)=>{timers.set(++id,fn);return id},clearTimeout:key=>timers.delete(key),
  refit:()=>{context.solvedViewport={...shape};fits.push({...shape})},emitViewState:()=>{}};
 const api=runInNewContext(watchSource+startWatchSource+'\n({startRefitWatch,stop:()=>stopRefitWatch?.()})',context);
 const notify=()=>{for(const o of observers)if(o.live)o.callback()};
 const flush=()=>{for(const [key,fn] of [...timers]){timers.delete(key);fn()}};
 return {shape,api,notify,flush,fits,timers,observers};
}
test('initial watcher compares with pre-report433x768 rather than already-shrunk433x733 box',()=>{
 const f=watchFixture();f.api.startRefitWatch();f.notify();f.flush();
 assert.deepEqual(f.fits,[{width:433,height:733}],'exactly one initial re-fit closes the report-before-observe race');
 f.notify();f.flush();assert.equal(f.fits.length,1,'equal observer delivery after refit cannot reflow-loop');
 f.api.startRefitWatch();assert.equal(f.observers.length,1,'standing watcher is not duplicated');
});
test('equal solved viewport adds no fit; later resizes still debounce and stop cancels work',()=>{
 const f=watchFixture({beforeReport:{width:433,height:733}});f.api.startRefitWatch();f.notify();f.flush();assert.equal(f.fits.length,0);
 f.shape.height=650;f.notify();f.shape.height=600;f.notify();assert.equal(f.timers.size,1);f.flush();assert.deepEqual(f.fits,[{width:433,height:600}]);
 f.shape.height=550;f.notify();f.api.stop();f.flush();assert.equal(f.fits.length,1);assert.equal(f.observers[0].live,false);
});
test('default observer callers still seed from their current box without an extra initial fit',()=>{
 const timers=[],fits=[];let observer;const context={ResizeObserver:class{constructor(fn){observer=fn}observe(){}disconnect(){}},setTimeout:fn=>{timers.push(fn);return 1},clearTimeout:()=>{}};
 const watch=runInNewContext(watchSource+'\nwatchViewport',context);watch({}, {read:()=>({width:390,height:844}),onChange:value=>fits.push(value)});observer();timers.shift()();assert.equal(fits.length,0);
});

const reportSource=section(component,'  function report(box, count)', '  // WHAT A MAP NODE');
const recenterSource=section(component,'  function recenter(onSettled)', '  function teardown(');
function restoredMount({framing='manual',noteShrinks=false,vw=1440,vh=900}={}){
 const shape={width:433,height:noteShrinks?768:733},fits=[],timers=new Map(),observers=[];let id=0;
 class RO{constructor(callback){this.callback=callback;this.live=true;observers.push(this)}observe(){}disconnect(){this.live=false}}
 const scroll={dataset:{},isConnected:true,scrollLeft:0,scrollTop:0,scrollWidth:2000,scrollHeight:3000,get clientWidth(){return shape.width},get clientHeight(){return shape.height}};
 const context={scroll,solvedViewport:{width:1440,height:900},viewportBeforeReport:null,framing,stopRefitWatch:null,restoreWrite:null,restorePending:true,
  restored:{scrollLeft:75,scrollTop:150,viewportWidth:vw,viewportHeight:vh},sizeSvg:()=>{},applyZoom:()=>{},titleEl:null,aimX:0,
  framingNodes:()=>[{}],framingBox:()=>({x0:75,y0:150,x1:175,y1:250,w:100,h:100}),height:2000,content:{x0:0,y0:0},zoom:1,
  clipNote:null,warnedClipped:false,console:{warn:()=>{}},columns:7,ZOOM_MIN:.3,
  run:{mapNodeId:null},map:{nodes:{}},reportEntrance:()=>{},entranceFrame:()=>null,
  reportTapSize:()=>{if(noteShrinks)shape.height=733},emitViewState:()=>{},
  refit:()=>{fits.push({...shape});context.solvedViewport={...shape}},ro:null,backstop:null,
  ResizeObserver:RO,setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:key=>timers.delete(key)};
 const api=runInNewContext(watchSource+startWatchSource+reportSource+recenterSource+'\n({recenter,getBaseline:()=>viewportBeforeReport})',context);
 const notify=()=>{for(const o of observers)if(o.live)o.callback()};
 const flush=()=>{for(const [key,fn] of [...timers]){timers.delete(key);fn()}};
 return {api,context,scroll,shape,fits,notify,flush};
}
for(const framing of ['manual','saved'])test(`actual ${framing} restoration across viewport sizes does not refit or lose persisted pan`,()=>{
 const f=restoredMount({framing});f.api.recenter();f.notify();f.flush();
 assert.equal(f.fits.length,0,'persisted1440x900 metadata is not an actual current-mount resize');
 assert.equal(f.scroll.scrollLeft,75);assert.equal(f.scroll.scrollTop,150);assert.equal(f.context.framing,framing);
 assert.deepEqual(JSON.parse(JSON.stringify(f.api.getBaseline())),{width:433,height:733});
});
test('actual restore report-induced768→733 shrink still triggers one initial fit',()=>{
 const f=restoredMount({noteShrinks:true});f.api.recenter();f.notify();f.flush();
 assert.deepEqual(f.fits,[{width:433,height:733}]);f.notify();f.flush();assert.equal(f.fits.length,1);
});

test('a restore that lands before the saved viewport settles finishes there, not as a refit (#2336 phones)',()=>{
 // Saved at 433x733; restored while the scrollport was still 433x768; the note
 // then shrinks it to the saved shape. The pan is re-applied, never re-fitted.
 const f=restoredMount({noteShrinks:true,vw:433,vh:733});f.api.recenter();f.notify();f.flush();
 assert.equal(f.fits.length,0,'viewport now equals the saved shape: no refit over the pan');
 assert.equal(f.scroll.scrollLeft,75);assert.equal(f.scroll.scrollTop,150);
});
