import test from 'node:test';
import assert from 'node:assert/strict';
import { layeredEnvironmentGeometry, layeredEnvironmentHtml, fitLayeredEnvironment } from '../src/ui/components/layeredEnvironment.js';
import { LAYERED_SCENES, LAYERED_SOURCES } from '../src/content/layeredEnvironments.js';

const bounds = box => {
  const source = LAYERED_SOURCES[box.layer.asset];
  const s = box.width / source.width;
  const [l,t,r,b] = source.visibleBoundsAt32;
  return { left:box.x+l*s, top:box.y+t*s, right:box.x+r*s, bottom:box.y+b*s };
};
for (const [width,height] of [[320,720],[1000,600],[1800,480]]) {
  test(`authored props remain grounded and floor decorations contained at ${width}x${height}`, () => {
    for (const scene of Object.values(LAYERED_SCENES)) {
      const groundY = height * .64;
      const geometry = layeredEnvironmentGeometry(scene, { width,height,groundY });
      for (const box of geometry) {
        assert.ok([box.x,box.y,box.width,box.height].every(Number.isFinite), scene.id);
        assert.ok(box.width > 0 && box.height > 0, scene.id);
        if (box.layer.role !== 'prop') continue;
        const b = bounds(box), p = box.layer.placement;
        if (!p.intentionalViewportCrop) {
          assert.ok(b.left >= -.01 && b.right <= width+.01, scene.id);
          assert.ok(b.top >= -.01 && b.bottom <= height+.01, scene.id);
        }
        if (p.mode === 'floor-surface') assert.ok(b.top >= groundY-.01, `${scene.id}: rug floating above ground`);
        if (p.mode === 'side-framing') assert.ok(p.side === 'left' ? b.right <= width*.4 : b.left >= width*.6, `${scene.id}: central fighting space blocked`);
      }
    }
  });
}
test('rear art and actor effects are separate decorative siblings', () => {
  const scene = Object.values(LAYERED_SCENES).find(s => s.layers.some(l => l.role === 'filter'));
  const html = layeredEnvironmentHtml(scene);
  const [rear, effects] = html.split('<div class="layered-environment-effects"');
  assert.ok(rear.includes('aria-hidden="true"'));
  assert.ok(effects.includes('aria-hidden="true"'));
  assert.ok(!rear.includes('data-role="filter"'));
  assert.ok(effects.includes('data-role="filter"'));
  assert.ok(!effects.includes('data-role="ground"'));
});
test('fit writes finite geometry without requiring a resize observer', () => {
  const scene = Object.values(LAYERED_SCENES)[0];
  const nodes = scene.layers.map((_, i) => ({dataset:{layerIndex:String(i)},style:{}}));
  const backdrop = { layeredRecipe:scene,dataset:{},querySelectorAll:()=>nodes };
  fitLayeredEnvironment(backdrop,{width:360,height:700,groundY:420});
  assert.equal(backdrop.dataset.floorTop,'420');
  assert.ok(nodes.every(n => /^-?[\d.]+px$/.test(n.style.width)));
});

test('rain and ash retain authored duration, direction and tile period', () => {
  const scene = { layers: [
    { role:'particles',asset:'rain',tileSizeSourcePixels:1024,motion:{durationMs:4000,deltaSourcePixels:{x:256,y:1024}} },
    { role:'particles',asset:'ash',tileSizeSourcePixels:512,motion:{durationMs:32000,deltaSourcePixels:{x:-512,y:256}} },
  ] };
  const nodes = scene.layers.map((_,i) => ({dataset:{layerIndex:String(i)},style:{setProperty(k,v){this[k]=v;}}}));
  fitLayeredEnvironment({layeredRecipe:scene,dataset:{},querySelectorAll:()=>nodes},{width:360,height:700,groundY:420});
  assert.equal(nodes[0].style['--layered-weather-duration'],'4000ms');
  assert.equal(nodes[1].style['--layered-weather-duration'],'32000ms');
  assert.equal(nodes[1].style['--layered-weather-dx'],'-512px');
  assert.equal(nodes[1].style['--layered-weather-tile'],'512px');
});

test('both accessibility inputs update a mounted overlay and listeners release', async () => {
  const {wireLayeredEnvironment} = await import('../src/ui/components/layeredEnvironment.js');
  const old = Object.fromEntries(['document','matchMedia','MutationObserver'].map(key => [key,globalThis[key]]));
  let app = false, mediaChanged, bodyChanged, disconnected = false, removed = false;
  const media = {matches:false,addEventListener(type,fn){mediaChanged=fn;},removeEventListener(type,fn){removed=fn===mediaChanged;}};
  globalThis.document = {body:{classList:{contains:()=>app}},addEventListener(){},removeEventListener(){}};
  globalThis.matchMedia = () => media;
  globalThis.MutationObserver = class {constructor(fn){bodyChanged=fn;}observe(){}disconnect(){disconnected=true;}};
  try {
    const effects = {dataset:{},querySelectorAll:()=>[]};
    const release = wireLayeredEnvironment({querySelector:()=>effects});
    assert.equal(effects.dataset.reducedMotion,'false');
    app = true; bodyChanged();
    assert.equal(effects.dataset.reducedMotion,'true');
    app = false; media.matches=true; mediaChanged();
    assert.equal(effects.dataset.reducedMotion,'true');
    media.matches=false; mediaChanged();
    assert.equal(effects.dataset.reducedMotion,'false');
    release();
    assert.ok(disconnected && removed);
  } finally {
    for (const [key,value] of Object.entries(old)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key]=value;
    }
  }
});

test('particle markup retains its asset identity for pack recovery', () => {
  const scene = {id:'rain',layers:[{role:'particles',asset:'assets-display/layered/rain.webp'}]};
  assert.ok(layeredEnvironmentHtml(scene).includes('data-layer-asset="assets-display/layered/rain.webp"'));
});

test('mounted weather repoints after pack recovery and releases its source listener', async () => {
  const {wireLayeredEnvironment} = await import('../src/ui/components/layeredEnvironment.js');
  const {setBuiltInSource} = await import('../src/ui/assetmap.js');
  const {builtInArtArrived,resetHighResArt} = await import('../src/ui/highResArt.js');
  const old = Object.fromEntries(['document','matchMedia','MutationObserver'].map(key => [key,globalThis[key]]));
  const id='assets-display/layered/rain.webp',node={dataset:{layerAsset:id},style:{backgroundImage:`url("${id}")`}};
  const effects={dataset:{},querySelectorAll:()=>[node]};
  const doc=new EventTarget();
  doc.body={classList:{contains:()=>false}};
  doc.querySelectorAll=()=>[];
  globalThis.document=doc;
  globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  globalThis.MutationObserver=class{observe(){}disconnect(){}};
  let release=()=>{};
  try {
    setBuiltInSource(null);
    release=wireLayeredEnvironment({querySelector:()=>effects});
    const map=new Map([[id,'./objects/aa/recovered.webp']]);
    setBuiltInSource(map);builtInArtArrived(map);
    assert.equal(node.style.backgroundImage,'url("./objects/aa/recovered.webp")');
    release();
    const later=new Map([[id,'./objects/bb/later.webp']]);
    setBuiltInSource(later);builtInArtArrived(later);
    assert.equal(node.style.backgroundImage,'url("./objects/aa/recovered.webp")','disposed overlays must not be repointed');
  } finally {
    release();setBuiltInSource(null);resetHighResArt();
    for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
  }
});

test('dialogue window fitting exposes the shared floor-line receipt', async () => {
  const {fitSceneBackdrop} = await import('../src/ui/components/sceneBackdrop.js');
  const scene = Object.values(LAYERED_SCENES)[0];
  const backdrop = {layeredRecipe:scene,dataset:{},classList:{contains:()=>true},querySelectorAll:()=>[]};
  const receipt = fitSceneBackdrop(backdrop,{width:1000,height:800,windowTop:100,windowHeight:400,zoom:1.5,config:{skyline:true,floor:true,floorFraction:.3}});
  assert.equal(receipt.frame.floorLine,380);
  assert.equal(receipt.floor.top,380);
  assert.equal(backdrop.dataset.floorTop,'570');
});

test('both dialogue plates recover art sources and release on stage replacement and disposal', async () => {
  const {wireDialogueStage}=await import('../src/ui/components/dialogueStage.js');
  const {setBuiltInSource}=await import('../src/ui/assetmap.js');
  const {builtInArtArrived,resetHighResArt}=await import('../src/ui/highResArt.js');
  const keys=['document','window','matchMedia','MutationObserver','ResizeObserver','getComputedStyle'];
  const old=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const id='assets-display/layered/rain.webp';
  const mount=()=>{
    const nodes=Array.from({length:2},()=>({dataset:{layerAsset:id},style:{}}));
    const plates=nodes.map(node=>({querySelector:()=>({dataset:{},querySelectorAll:()=>[node]})}));
    const root={isConnected:true,clientWidth:0,clientHeight:0,getBoundingClientRect:()=>({width:0}),querySelector:()=>null,
      querySelectorAll:selector=>selector===':scope > .dialogue-plate-layer'?plates:[]};
    return {root,nodes};
  };
  const doc=new EventTarget();doc.body={classList:{contains:()=>false}};doc.documentElement={};doc.querySelectorAll=()=>[];
  globalThis.document=doc;globalThis.window=new EventTarget();
  globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  globalThis.MutationObserver=class{observe(){}disconnect(){}};
  delete globalThis.ResizeObserver;
  globalThis.getComputedStyle=()=>({fontSize:'16px'});
  const config={layout:{sizing:{floorPercent:60}},parent:{},scene:{}};
  const recover=url=>{const map=new Map([[id,url]]);setBuiltInSource(map);builtInArtArrived(map);};
  let first,second;
  try {
    setBuiltInSource(null);
    const a=mount();first=wireDialogueStage(a.root,config);
    recover('./objects/aa/recovered.webp');
    assert.ok(a.nodes.every(node=>node.style.backgroundImage==='url("./objects/aa/recovered.webp")'),'both mounted copies recover');
    const b=mount();second=wireDialogueStage(b.root,config);
    recover('./objects/bb/replacement.webp');
    assert.ok(a.nodes.every(node=>node.style.backgroundImage==='url("./objects/aa/recovered.webp")'),'replacement releases old plates');
    assert.ok(b.nodes.every(node=>node.style.backgroundImage==='url("./objects/bb/replacement.webp")'));
    second.release();recover('./objects/cc/disposed.webp');
    assert.ok(b.nodes.every(node=>node.style.backgroundImage==='url("./objects/bb/replacement.webp")'),'disposal releases both plates');
  } finally {
    first?.release();second?.release();setBuiltInSource(null);resetHighResArt();
    for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
  }
});
