import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { rewardDom } from './helpers/reward-dom.mjs';
import { alternativeSprite } from '../src/ui/alternativeArt.js';
import { uiConfig } from '../src/config/generated/ui.js';

const source = readFileSync(new URL('../tools/motion-probe.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
const idleSource = source.slice(source.indexOf('async function idle('), source.indexOf('\nconst server ='));

// Exercise the production browser predicate on the real alternative figure
// tree, with observed Web Animations, frame bounds and painted pixel samples.
async function inspect({ moving = false, imageMotion = false, duplicate = false, flat = false, opacityOnly = false,
  scriptMove = false, scale = false, unloaded = false, transparent = false, canvas = false,
  blank = false, lateBlank = false, pixelChange = false } = {}) {
  const dom=rewardDom(),oldDocument=globalThis.document,oldImage=globalThis.Image;
  globalThis.document=dom.document;globalThis.Image=function Image(){return dom.document.createElement('img');};
  let frames=0,reads=0;
  try {
    const figure=alternativeSprite('reaver-default','player');
    if(canvas){
      figure.className='pose-stage painted-stage alternative-card-stage';
      const painted=dom.document.createElement('canvas');painted.width=painted.height=2;
      painted.getContext=()=>({getImageData(){reads++;return {data:new Uint8ClampedArray([pixelChange&&frames>8?120:0,0,0,blank||lateBlank&&frames>8?0:255])};}});
      figure.replaceChildren(painted);
    }
    const frame=dom.document.createElement('div');frame.className='combatant player';
    const sprite=dom.document.createElement('div');sprite.className='sprite';sprite.appendChild(figure);frame.appendChild(sprite);dom.document.body.appendChild(frame);
    const name=dom.document.createElement('span');name.className='nm';name.textContent='Reaver';frame.appendChild(name);
    const stage=canvas?figure:figure.querySelector('.alternative-silhouette'),image=figure.querySelector(canvas?'canvas':'img');
    const walk=node=>[node,...node.children.flatMap(walk)];
    for(const node of walk(dom.document.body)){
      Object.defineProperty(node,'parentElement',{get(){return this.parentNode;}});
      node.classList[Symbol.iterator]=function*(){yield*node.className.split(/\s+/).filter(Boolean);};
      node.getBoundingClientRect=()=>({left:20+(scriptMove&&node===image&&frames>8?4:0),top:30,width:100+(scale&&node===image&&frames>8?8:0),height:190});
      node.getAnimations=()=>[];
    }
    image.complete=true;image.naturalWidth=unloaded?0:1024;
    const animation={playState:'running',effect:{getKeyframes:()=>opacityOnly?[{opacity:1},{opacity:.5}]:[{translate:'0 0'},{translate:flat?'0 0':'0 -4px'}]}};
    for(const carrier of duplicate?[stage,image]:imageMotion?[image]:moving||flat||opacityOnly?[stage]:[])carrier.getAnimations=()=>[animation];
    const browser={document:dom.document,requestAnimationFrame(callback){frames++;callback(frames*16);},
      getComputedStyle:node=>({visibility:'visible',display:'block',opacity:transparent&&node===figure?'0':'1'})};
    const verdicts=[];const idle=runInNewContext(`${idleSource}\nidle`,{check:(ok,label,detail)=>verdicts.push({ok,label,detail})});
    await idle({evaluate:expression=>runInNewContext(expression,browser)},'IDLE');
    return {verdicts,frames,reads};
  }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldImage===undefined)delete globalThis.Image;else globalThis.Image=oldImage;}
}

test('every figure style holds still without a shared idle clock; bounded action CSS remains',async()=>{
  assert.doesNotMatch(css,/@keyframes sprite-idle|animation:\s*sprite-idle/);
  assert.match(css,/\.enemy \.sprite\.act-attack \{ animation: lunge-left/);
  assert.match(css,/\.sprite\.hitflash > :first-child \{ animation: hitflash/);
  const assets=readFileSync(new URL('../src/ui/assets.js',import.meta.url),'utf8');
  assert.doesNotMatch(assets,/holdIdlePhase|IDLE_ANIMATION/);
  const result=await inspect();assert.equal(result.verdicts.length,1);
  assert.equal(result.verdicts[0].ok,true,result.verdicts[0].detail);
  assert.equal(result.frames,22,'two settling frames plus twenty actual frame observations');
});

test('stationary-rest predicate rejects moving layers/images, late script motion, resizing and missing artwork',async()=>{
  for(const [fault,reason] of [[{moving:true},/moves while resting/],[{imageMotion:true},/moves while resting/],
    [{duplicate:true},/moves while resting/],[{scriptMove:true},/moves while resting/],[{scale:true},/moves while resting/],
    [{unloaded:true},/image did not load/],[{transparent:true},/no visible figure image/]]){
    const {verdicts:[verdict]}=await inspect(fault);assert.equal(verdict.ok,false,JSON.stringify(fault));assert.match(verdict.detail,reason);
  }
});

test('painted canvas rest requires nonblank stable content, not just a stationary wrapper',async()=>{
  const result=await inspect({canvas:true});assert.equal(result.verdicts[0].ok,true,result.verdicts[0].detail);
  assert.equal(result.reads,2,'first and last rest samples materialize pixels');
  for(const fault of [{blank:true},{lateBlank:true},{pixelChange:true},{moving:true},{imageMotion:true},{scriptMove:true},{scale:true},{transparent:true}]){
    const {verdicts:[bad]}=await inspect({canvas:true,...fault});assert.equal(bad.ok,false,JSON.stringify(fault));
  }
});

test('non-displacing aura feedback and a static animation do not count as a fighter bob',async()=>{
  for(const options of [{opacityOnly:true},{flat:true}]){
    const {verdicts:[clean]}=await inspect(options);assert.equal(clean.ok,true,clean.detail);
  }
});

test('the alternative flipbook plant opens the actual production fallback and schedules its six src frames', () => {
  const plantStart = source.indexOf("name: 'the combatant effect flipbook runs under reduced motion'");
  const plantSource = source.slice(plantStart, source.indexOf('\n      },', plantStart));
  const plant = runInNewContext(`({ ${plantSource} })`, { ALTERNATIVE: true });
  assert.equal(plant.edits.length, 2, 'both independent reduced-motion gates must be planted');
  assert.equal(plant.edits[0].file, 'src/ui/fx.js');
  const edit = plant.edits[1];
  assert.equal(edit.file, 'src/ui/combatEffectSprites.js');
  const sprites = readFileSync(new URL('../src/ui/combatEffectSprites.js', import.meta.url), 'utf8');
  const playSource = sprites.slice(sprites.indexOf('export function playCombatEffect(')).replace('export function', 'function');
  assert.equal(playSource.split(edit.find).length, 2, 'the real fallback guard must be planted exactly once');

  const dom = rewardDom(), layer = dom.document.createElement('div'), tickets = [];
  const createElement = dom.document.createElement.bind(dom.document);
  dom.document.createElement = tag => {
    const node = createElement(tag);
    node.animate = () => ({ cancel() {} });
    return node;
  };
  const context = {
    document: dom.document, M: uiConfig.presentation.combatEffectPlayback.motion,
    SZ: uiConfig.presentation.combatEffectPlayback.sizing, active: new WeakMap(),
    reducedMotionRequested: () => true, effectsOff: () => false, combatEffectFrames: () => Array.from({ length: 6 }, (_, i) => `frame-${i + 1}.webp`),
    combatEffectPresentation: () => ({ sizeScale: 1, startScale: 1, endScale: 1, opacity: 1 }),
    warmEffectFrames() {}, hintImage: image => image, currentArtUrl: url => url,
    combatEffectAngle: () => 0, combatEffectOrientation: () => '',
    setTimeout(callback, delay) { tickets.push({ callback, delay }); return tickets.length; }, clearTimeout() {},
  };
  const load = text => runInNewContext(`${text}\nplayCombatEffect`, context);
  const from = { left: 0, top: 0, width: 100, height: 190 };
  load(playSource)(layer, from, 'slash');
  assert.equal(layer.children.length, 0, 'production reduced-motion guard mounts no overlay');
  assert.equal(tickets.length, 0, 'production reduced-motion guard schedules no flipbook');

  const stop = load(playSource.replace(edit.find, edit.replace))(layer, from, 'slash');
  const image = layer.querySelector('.painted-combat-effect');
  assert.ok(image, 'the armed plant must mount the actual fallback image');
  assert.equal(tickets.length, 6, 'five later frames and final cleanup are scheduled');
  const frames = [image.src];
  for (const ticket of tickets.slice(0, 5)) { ticket.callback(); frames.push(image.src); }
  assert.deepEqual(frames, Array.from({ length: 6 }, (_, i) => `frame-${i + 1}.webp`));
  assert.ok(plant.expectRed.test('RED REDUCED-SCRIPT setting+os — img.painted-combat-effect (src changed 6 times within 1000 ms)'));
  assert.equal(plant.expectRed.test('RED REDUCED setting+os — unrelated CSSAnimation'), false);
  stop();
});

test('the primary branch retains the attached-layer flipbook plant and exact script-motion predicate', () => {
  const start = source.indexOf("name: 'the combatant effect flipbook runs under reduced motion'");
  const plant = runInNewContext(`({ ${source.slice(start, source.indexOf('\n      },', start))} })`, { ALTERNATIVE: false });
  assert.equal(plant.edits[1].file, 'src/ui/combatantEffectLayers.js');
  assert.ok(plant.expectRed.test('RED REDUCED-SCRIPT setting+os — img.combatant-effect-layer (src changed 6 times within 1000 ms)'));
  assert.equal(plant.expectRed.test('RED REDUCED-SCRIPT setting+os — img.painted-combat-effect'), false);
});

test('same-door stationary-rest and reduced-motion negatives still mutate real source',async()=>{
  let corpus;
  const selftest=source.slice(source.indexOf("if (argv.includes('--selftest')) {"),source.indexOf('\nconst ROOT =')).replace("await import('./doorplant.mjs')",'await harness()');
  await runInNewContext(`(async()=>{${selftest}})()`,{
    argv:['--selftest'],ALTERNATIVE:true,CANVAS_IDLE:'anchored',process:{exit(){}},console:{log(){},error(){},info(){}},
    harness:async()=>({resolveShard:()=>null,doorSelftest:async options=>{corpus=options;return 0;}}),
  });
  assert.equal(corpus.plants.length,20,'eleven obsolete bob-positive negatives are replaced, not skipped; action and canvas negatives remain');
  assert.equal(corpus.timeoutMs,240000,'same-door deadline is unchanged');
  for(const name of ['a resting facing layer bobs','the Rendered figure bobs','the hidden Rendered rest layer bobs',
    'a figure image bobs inside a stationary stage','a resting figure scales','the idle carriers are made transparent',
    'the combatants are made transparent','a resting actor wrapper translates','a resting figure rotates',
    'a companion shake moves resting art','the resting figure artwork is hidden','the class canvas paints no character pixels',
    'the class canvas ignores reduced motion','the fixed rear stage gains an idle translation','the fixed rear stage changes scale while resting',
    'the Reduced motion setting stops shortening CSS animations','the OS preference stops shortening CSS animations',
    'the OS preference shortens CSS animations to 11 ms, not 0.01 ms','the card-play flight (Element.animate) ignores reduced motion',
    'the combatant effect flipbook runs under reduced motion'])assert.equal(corpus.plants.filter(p=>p.name===name).length,1,name);
  assert.ok(corpus.extraCopy.includes('assets-display'));
  for(const plant of corpus.plants)for(const edit of plant.edits||[plant]){
    const current=readFileSync(new URL(`../${edit.file}`,import.meta.url),'utf8').replace(/\r\n/g,'\n');
    assert.equal(current.split(edit.find).length,2,`${plant.name}: mutation must match actual source exactly once`);
    assert.notEqual(edit.find,edit.replace,`${plant.name}: mutation is not a no-op`);
  }
});
