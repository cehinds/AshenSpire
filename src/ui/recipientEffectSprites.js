import { assetUrl, assetsAreInlined, builtInSource } from './assetmap.js';
import { reducedMotionRequested } from './motion.js';
import { SETTINGS } from '../content/recipientEffectSettings.js';
import { ReadRecipientEffectTiming, ValidateRecipientEffectTiming } from '../model/recipientEffectTiming.js';
import { NextCategoryQueueEntry, RecipientEffectCategory } from '../model/recipientEffectCategoryQueue.js';
import { RecipientEffectAtlasEntry } from '../content/recipientEffectAtlas.js';
import { currentSpriteBodyBounds } from './components/combatSpriteGeometry.js';
import { stageFor } from './services/PoseAnimator.js';

const active = new WeakMap(), loaded = new Map(), groups = new WeakMap();
const resultWindows = new WeakMap(), categoryQueues = new WeakMap();
const defaultTiming = ReadRecipientEffectTiming();
const timingFor = timing => timing == null ? defaultTiming : ValidateRecipientEffectTiming(timing);
const S = SETTINGS.sizing, O = SETTINGS.layering.opacity, M = SETTINGS.motion;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const disabled = () => !SETTINGS.behavior.enabled || reducedMotionRequested() || document.body.classList.contains('reduce-flashes');
export const RecipientAtlas = shape => RecipientEffectAtlasEntry(shape) || RecipientEffectAtlasEntry('skill');
const transform = (scaleX = 1) => ({rotation:0, scaleX, scaleY:1, transform:`scale(${scaleX}, 1)`});

/** Impacts stay front-on. Only movement chevrons reverse with the moving actor. */
export function RecipientEffectView(recipe, {box, cardBox, targetFacing = 'back', size} = {}) {
  const facing = targetFacing === 'front' ? 'front' : 'back';
  const unit = size || clamp(Math.max(box.width * S.impactBodyWidth, box.height * S.impactBodyHeight), S.impactMinPx, S.impactMaxPx);
  let width = unit, height = unit, cy = box.top + box.height * S.centerY;
  const cx = box.left + box.width / 2;
  if (['evade', 'evade-gain'].includes(recipe.shape)) { width = box.width * S.evadeWidth; height = box.height * S.evadeHeight; cy = box.top + box.height / 2; }
  if (['ward', 'ward-shatter'].includes(recipe.shape)) { width = box.width * S.wardWidth; height = box.height * S.wardHeight; }
  if (recipe.shape === 'spell-circle') { width = height = box.height * S.circleBodyHeight; cy = box.top + box.height * S.circleCenterY; }
  if (recipe.shape.startsWith('status')) width = height = box.height * S.statusBodyHeight;
  if (recipe.shape === 'sweep') { width = recipe.mount === 'group' ? box.width : unit * S.sweepWidth; height = unit * S.sweepHeight; }
  const card = S.cardBoundShapes.includes(recipe.shape) && cardBox;
  const bounds = card || {left:cx-width/2,top:cy-height/2,width,height};
  const movement = ['advance','retreat'].includes(recipe.shape);
  return {...bounds,size:unit,facing,cardAnchored:!!card,base:transform(movement && facing === 'front' ? -1 : 1),sweep:transform(),overlay:transform(),placeholder:transform()};
}

// Exactly one neutral static diagnostic mark per action and target type.
const MARKS = {
  attack: '<path d="M35 76L75 35M43 80L80 43"/>',
  smash: '<path d="M60 27L67 47L89 42L77 61L91 77L68 73L60 95L52 73L29 77L43 61L31 42L53 47Z"/>',
  sweep: '<path d="M27 71Q51 31 94 45Q56 43 27 71Z"/>',
  counter: '<path d="M35 36L83 84M35 84L83 36M32 51V33H50"/>',
  defend: '<path d="M38 34L60 26L82 34V60Q80 80 60 92Q40 80 38 60Z"/>',
  spell: '<path d="M60 27L68 51L93 60L68 69L60 93L52 69L27 60L52 51Z"/>',
  casting: '<path d="M60 27L68 51L93 60L68 69L60 93L52 69L27 60L52 51Z"/>',
  skill: '<path d="M60 32L84 60L60 88L36 60Z"/>',
};
export function RecipientPlaceholderSvg(action = 'skill', targetType = 'target') {
  const mark = Object.hasOwn(MARKS, action) ? MARKS[action] : MARKS.skill;
  const target = targetType === 'self'
    ? '<circle cx="60" cy="60" r="51"/>'
    : targetType === 'aoe'
      ? '<path d="M8 18V8H112V18M8 102V112H112V102"/><circle cx="22" cy="100" r="3"/><circle cx="60" cy="100" r="3"/><circle cx="98" cy="100" r="3"/>'
      : '<path d="M7 37V7H37M83 7H113V37M113 83V113H83M37 113H7V83"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${target}${mark}</g></svg>`;
}

function load(url) {
  if (loaded.has(url)) return loaded.get(url).promise;
  if (typeof Image !== 'function') return Promise.resolve(false);
  const entry = {ready:false,image:null,promise:null}; loaded.set(url,entry);
  entry.promise = new Promise(resolve => {
    const image = new Image(); entry.image = image;
    const done = ok => {entry.ready=ok; resolve(ok);};
    image.onload = () => {
      if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) return done(false);
      if (image.decode) image.decode().then(()=>done(true),()=>done(false)); else done(true);
    };
    image.onerror = () => done(false); image.src=url;
  });
  return entry.promise;
}
function sourcesFor(recipe, resolveAsset) {
  return [{shape:recipe.shape,tinted:true}, ...(recipe.overlay ? [{shape:recipe.overlay,tinted:false}] : [])].map(source => {
    const atlas=RecipientAtlas(source.shape),url=resolveAsset(atlas.path);
    return {...source,atlas,url,absent:!url || (resolveAsset===assetUrl && url===atlas.path && (assetsAreInlined() || builtInSource()))};
  });
}
export function PrewarmRecipientEffect(recipe,{resolveAsset=assetUrl}={}) {
  if (!recipe || !SETTINGS.behavior.enabled) return Promise.resolve(false);
  return Promise.all(sourcesFor(recipe,resolveAsset).map(s=>s.absent ? false : load(s.url))).then(r=>r.every(Boolean));
}
/** Start decoding the common contact and caster layers before play is possible. */
export function PrewarmCombatRecipientEffects({resolveAsset=assetUrl}={}) {
  if (disabled()) return Promise.resolve([]);
  return Promise.all(SETTINGS.behavior.warmShapes.map(shape => PrewarmRecipientEffect({ shape }, { resolveAsset })));
}
function canvas(width,height) {
  const c=document.createElement('canvas'); c.width=Math.max(1,Math.ceil(width)); c.height=Math.max(1,Math.ceil(height)); return c;
}
function context(c) { return c.getContext?.('2d') || null; }
// One union crop for all frames prevents pulsing anchors or frame-specific scale.
function crop(entry, atlas) {
  const w=entry.image.naturalWidth/atlas.columns,h=entry.image.naturalHeight/atlas.rows;
  if (entry.bounds) return entry.bounds;
  const c=canvas(w,h),ctx=context(c); let x0=w,y0=h,x1=-1,y1=-1;
  if (ctx) try {
    for(let f=0;f<atlas.columns;f++) {
      ctx.clearRect(0,0,w,h);ctx.drawImage(entry.image,f*w,atlas.row*h,w,h,0,0,w,h);
      const pixels=ctx.getImageData(0,0,w,h).data;
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(pixels[(y*w+x)*4+3]>SETTINGS.behavior.alphaBoundsThreshold) {x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    }
  } catch { /* Cross-origin art may display without readable alpha. */ }
  return entry.bounds=x1<0 ? {x:0,y:0,width:w,height:h} : {x:x0,y:y0,width:x1-x0+1,height:y1-y0+1};
}
function frameCanvas(source,index,color,cropContent=false) {
  const entry=loaded.get(source.url),{image}=entry,a=source.atlas;
  const w=image.naturalWidth/a.columns,h=image.naturalHeight/a.rows;
  const b=cropContent?crop(entry,a):{x:0,y:0,width:w,height:h};
  const c=canvas(b.width,b.height),ctx=context(c);
  if (!ctx) return c;
  const neutral=SETTINGS.behavior.neutralPalettes.some(key=>SETTINGS.behavior.palettes[key]===color);
  if(color && !neutral && SETTINGS.layering.grayscaleBeforeTint)ctx.filter='grayscale(1)';
  ctx.drawImage(image,index*w+b.x,a.row*h+b.y,b.width,b.height,0,0,c.width,c.height);ctx.filter='none';
  if(color && !neutral) {ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=SETTINGS.layering.tintStrengthByShape?.[source.shape] ?? SETTINGS.layering.tintStrength;ctx.fillStyle=color;ctx.fillRect(0,0,c.width,c.height);}
  return c;
}
function localBox(layer,rect) {
  const r=rect.getBoundingClientRect?.() || rect,l=layer.getBoundingClientRect();
  const scale=layer.offsetWidth && l.width ? layer.offsetWidth/l.width : 1;
  return {left:(r.left-l.left)*scale,top:(r.top-l.top)*scale,width:r.width*scale,height:r.height*scale};
}
function bodyBox(layer,actor) {
  const b=currentSpriteBodyBounds(actor);
  const rect={left:b.left,top:b.headY??b.top,width:b.width??b.right-b.left,height:b.bodyHeight??b.height??b.bottom-b.top};
  return localBox(layer,rect.width>0&&rect.height>0?rect:actor);
}
/** Capture only this actor's currently painted pixels, including the actual pose. */
function actorSnapshot(actor,layer,box) {
  if(!actor)return null;
  const c=canvas(box.width,box.height),ctx=context(c);if(!ctx)return null;
  const stage=stageFor(actor),painted=stage?.currentArt;
  const nodes=painted?.canvas?[painted.canvas]:[...actor.querySelectorAll('canvas, img')];
  for(const node of nodes) {
    let hidden=false;
    for(let element=node;element && element!==actor;element=element.parentElement){
      const style=typeof getComputedStyle==='function'?getComputedStyle(element):null;
      if(element.hidden||style?.display==='none'||style?.visibility==='hidden'||style?.opacity==='0'){hidden=true;break;}
    }
    if(hidden)continue;
    const r=localBox(layer,node);if(!r.width||!r.height)continue;
    const style=typeof getComputedStyle==='function'?getComputedStyle(node):null;
    if(node.tagName==='IMG' && style?.objectFit==='contain' && node.naturalWidth && node.naturalHeight){
      const factor=Math.min(r.width/node.naturalWidth,r.height/node.naturalHeight);
      const width=node.naturalWidth*factor,height=node.naturalHeight*factor;
      r.left+=(r.width-width)/2;r.top+=(r.height-height)/2;r.width=width;r.height=height;
    }
    try {ctx.drawImage(node,r.left-box.left,r.top-box.top,r.width,r.height);}catch { /* Unloaded art has no afterimage. */ }
  }
  return c;
}
function register(layer,stop){const set=active.get(layer)||new Set();active.set(layer,set);set.add(stop);return set;}

/** Three-frame flat composition; a cold clip stays the same placeholder to its end. */
export function PlayRecipientEffect(layer,box,recipe,{size,sourceBox,targetFacing,cardBox,actor,duration=recipe?.durationMs||M.clipMs,resolveAsset=assetUrl,forcePlaceholder=false,onStop,frame=null,timing}={}) {
  if(!layer||!box||!recipe||disabled())return ()=>{};
  const count=frameCount(recipe);
  const ms=clipDuration(recipe, duration);
  const view=RecipientEffectView(recipe,{box,cardBox,targetFacing,size});
  const host=document.createElement('div');host.className='recipient-effect';host.setAttribute('aria-hidden','true');
  Object.assign(host.dataset,{action:recipe.action||'skill',targetType:recipe.targetType||'target',shape:recipe.shape,category:RecipientEffectCategory(recipe),phase:recipe.phase||'contact',frame:'1',renderer:'placeholder',facing:view.facing,mirrorX:String(view.base.scaleX),mirrorY:'1',rotation:'0',scaleY:'1',anchor:view.cardAnchored?'card-bottom':'body'});
  Object.assign(host.style,{position:'absolute',pointerEvents:'none',zIndex:'4',opacity:String(timingFor(timing).opacity),left:`${view.left}px`,top:`${view.top}px`,width:`${view.width}px`,height:`${view.height}px`,transformOrigin:'bottom center',overflow:view.cardAnchored?'hidden':'visible'});
  const placeholder=document.createElement('img');placeholder.alt='';placeholder.src=`data:image/svg+xml,${encodeURIComponent(RecipientPlaceholderSvg(recipe.action,recipe.targetType))}`;
  const placeholderSize=Math.min(S.fallbackPx,view.width,view.height);
  Object.assign(placeholder.style,{position:'absolute',left:`${(view.width-placeholderSize)/2}px`,top:`${(view.height-placeholderSize)/2}px`,width:`${placeholderSize}px`,height:`${placeholderSize}px`,objectFit:'contain',transform:view.placeholder.transform});placeholder.style.opacity=String(recipe.opacity??(recipe.shape==='spell-circle'?O.spellCircle:O.primary));host.appendChild(placeholder);layer.appendChild(host);
  let stopped=false,currentFrame=frame==null?0:clamp(frame,0,count-1),art=false;const timers=[],planes=[];
  const stop=()=>{if(stopped)return;stopped=true;timers.forEach(clearTimeout);host.remove();set.delete(stop);onStop?.();};const set=register(layer,stop);
  const snapshot=recipe.silhouette?actorSnapshot(actor,layer,box):null;
  function show(index) {
    currentFrame=index;if(disabled()){stop();return;}if(!art)return;host.dataset.frame=String(index+1);
    for(const {node,source,ghost} of planes) {
      const ctx=context(node);if(!ctx)continue;ctx.clearRect(0,0,node.width,node.height);
      if(ghost) {
        if(!snapshot)continue;const x=box.left-view.left,y=box.top-view.top;
        if(recipe.silhouette==='ward') {
          const mask=canvas(snapshot.width,snapshot.height),mc=context(mask);mc.drawImage(snapshot,0,0);mc.globalCompositeOperation='source-in';mc.fillStyle=recipe.color;mc.fillRect(0,0,mask.width,mask.height);
          const values=recipe.treatment==='break'?O.wardBreakGhost:recipe.treatment==='absorb'?O.wardAbsorbGhost:O.wardGhost;
          ctx.globalAlpha=values[index];ctx.drawImage(mask,x,y,box.width,box.height);
        } else {
          ctx.globalAlpha=O.evadeGhost[index];ctx.drawImage(snapshot,x+box.width*M.evadeOffsetFractions[index],y,box.width,box.height);
          if(index===2){ctx.globalAlpha=O.evadeSecondary;ctx.drawImage(snapshot,x+box.width*M.evadeSecondaryOffsetFraction,y,box.width,box.height);}
        }
        ctx.globalAlpha=1;continue;
      }
      const overlay=!source.tinted,slash=['slash','multi-slash','thrust'].includes(recipe.shape);
      const scale=overlay?(recipe.overlayScale??(slash?S.slashElementOverlay:recipe.shape==='sweep'?S.sweepElementOverlay:S.elementOverlay)):(M.secondaryOffsetY?.[recipe.shape]?S.secondaryOverlay:1);
      let opacity=recipe.opacity??(recipe.shape==='spell-circle'?O.spellCircle:O.primary);
      if(overlay)opacity*=slash?O.elementOverSlash:O.elementOverlay;
      if(recipe.shape==='ward')opacity*=O.wardRim;
      if(recipe.shape==='evade')opacity*=O.evadeLines;
      if(overlay&&recipe.overlayTreatment==='fade-out')opacity*=O.statusFade[index];
      if(overlay&&recipe.overlayTreatment==='deflect')opacity*=O.statusDeflect[index];
      const intensity=clamp(recipe.intensity||1,1,SETTINGS.layering.statusStack.maxIntensity);
      const layerScale=(recipe.scale??1)*(recipe.shape==='spell-circle'?M.spellCircleScale[index]:1);
      const w=node.width*scale*intensity*layerScale,h=node.height*scale*intensity*layerScale;
      let x=(node.width-w)/2+(overlay?(recipe.overlayOffset?.x||0)*node.width:0),y=(node.height-h)/2+(overlay?(recipe.overlayOffset?.y||0)*node.height:0);
      if(overlay&&recipe.overlayTreatment==='deflect'){x+=M.statusDeflectFractions[index]*node.width;y+=M.statusDeflectFractions[index]*node.height*SETTINGS.layering.statusDeflectY;}
      x += (recipe.offset?.x || 0) * node.width; y += (recipe.offset?.y || 0) * node.height;
      if(!overlay && recipe.shape==='bleed-drops' && recipe.treatment==='fade-out')opacity*=O.statusFade[index];
      if(!overlay && recipe.shape==='bleed-drops' && recipe.treatment==='deflect'){opacity*=O.statusDeflect[index];x+=M.statusDeflectFractions[index]*node.width;y+=M.statusDeflectFractions[index]*node.height*SETTINGS.layering.statusDeflectY;}
      if(!['fade-out','deflect'].includes(recipe.treatment)) y += (M.secondaryOffsetY?.[recipe.shape]?.[index] || 0) * node.height;
      if(view.cardAnchored) y -= node.height * M.auraRiseFractions[index];
      const image=frameCanvas(source,index,source.atlas.authoredColor?null:overlay?recipe.overlayColor:recipe.color,SETTINGS.behavior.cropToContent.includes(source.shape));
      ctx.save();ctx.globalAlpha=opacity;
      if(view.cardAnchored){const reveal=SETTINGS.layering.auraReveal[index];ctx.beginPath();ctx.rect(0,node.height*(1-reveal),node.width,node.height*reveal);ctx.clip();}
      if(view.base.scaleX<0&&!overlay){ctx.translate(node.width,0);ctx.scale(-1,1);}
      ctx.drawImage(image,x,y,w,h);ctx.restore();
    }
  }
  const sources=sourcesFor(recipe,resolveAsset);
  const mount=()=>{if(stopped)return;art=true;placeholder.remove();host.dataset.renderer='art';
    const add=(source,ghost=false)=>{const node=canvas(view.width,view.height);Object.assign(node.style,{position:'absolute',inset:'0',width:'100%',height:'100%',overflow:'visible'});Object.assign(node.dataset,{shape:ghost?'actor-silhouette':source.shape,overlay:String(ghost||!source.tinted),actualActorMask:String(ghost)});host.appendChild(node);planes.push({node,source,ghost});};
    if(snapshot)add(null,true);sources.filter(s=>!s.tinted).forEach(s=>add(s));sources.filter(s=>s.tinted).forEach(s=>add(s));show(currentFrame);};
  if(!forcePlaceholder){if(sources.every(s=>!s.absent&&loaded.get(s.url)?.ready))mount();else{const warming=PrewarmRecipientEffect(recipe,{resolveAsset});if(frame!=null)warming.then(ok=>{if(ok)mount();});}}
  if(frame==null)for(let i=1;i<count;i++)timers.push(setTimeout(()=>show(i),ms*i/count));
  timers.push(setTimeout(stop,ms));return stop;
}

export function PlayRecipientDelivery(layer,from,to,recipe,{resolveAsset=assetUrl,forcePlaceholder=false,timing,duration,onStop}={}) {
  if(recipe.range!=='reach'||!from||disabled()||forcePlaceholder)return ()=>{};
  const sources=sourcesFor({...recipe,shape:recipe.impactShape||'skill'},resolveAsset);
  if(!sources.every(source=>!source.absent&&loaded.get(source.url)?.ready))return ()=>{};
  const c=canvas(layer.clientWidth||layer.offsetWidth||layer.getBoundingClientRect().width,layer.clientHeight||layer.offsetHeight||layer.getBoundingClientRect().height),ctx=context(c);
  if(!ctx)return ()=>{};c.className='recipient-delivery';Object.assign(c.dataset,{phase:'delivery',category:RecipientEffectCategory(recipe),style:recipe.camp==='spell'?'spell-link':'weapon-extension',sourceId:recipe.sourceId||'',targetId:recipe.targetId||recipe.targetIds?.join(',')||''});c.setAttribute('aria-hidden','true');Object.assign(c.style,{position:'absolute',inset:'0',pointerEvents:'none',opacity:String(timingFor(timing).opacity)});layer.appendChild(c);
  const ax=from.left+from.width/2,ay=from.top+from.height/2,bx=to.left+to.width/2,by=to.top+to.height/2;
  const distance=Math.hypot(bx-ax,by-ay),fraction=Math.min(S.deliveryLengthFraction,S.deliveryMaxLengthPx/Math.max(1,distance));
  const sx=bx-(bx-ax)*fraction,sy=by-(by-ay)*fraction;
  ctx.strokeStyle=recipe.color;ctx.fillStyle=recipe.color;ctx.globalAlpha=O.delivery;
  if(recipe.camp==='spell'){ctx.lineWidth=S.spellLinkWidthPx;ctx.setLineDash(S.spellLinkDash);ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(bx,by);ctx.stroke();ctx.setLineDash([]);for(let i=0;i<S.spellLinkParticles;i++){const f=i/S.spellLinkParticles;ctx.beginPath();ctx.arc(sx+(bx-sx)*f,sy+(by-sy)*f,S.spellLinkWidthPx,0,Math.PI*2);ctx.fill();}}
  else{const nx=-(by-sy)/Math.max(1,distance*fraction)*S.deliveryWidthPx,ny=(bx-sx)/Math.max(1,distance*fraction)*S.deliveryWidthPx;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+(bx-sx)*S.deliveryTipStart+nx,sy+(by-sy)*S.deliveryTipStart+ny);ctx.lineTo(bx,by);ctx.lineTo(sx+(bx-sx)*S.deliveryTipStart-nx,sy+(by-sy)*S.deliveryTipStart-ny);ctx.closePath();ctx.fill();}
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    c.remove();
    set.delete(stop);
    onStop?.();
  };
  const set = register(layer, stop);
  const timer = setTimeout(stop, clipDuration({ ...recipe, phase: 'delivery' }, duration));
  return stop;
}

function frameCount(recipe) {
  return clamp(Math.round(recipe.frameCount || SETTINGS.behavior.frameCount), 1, 3);
}

function clipDuration(recipe, duration) {
  if (recipe.phase === 'delivery') return Math.max(0, duration ?? recipe.delivery?.durationMs ?? recipe.durationMs ?? M.reachDeliveryMs);
  return Math.max(SETTINGS.behavior.minimumFrameMs * frameCount(recipe), Number(duration ?? recipe.durationMs) || M.clipMs);
}

const preludePhases = new Set(['windup', 'delivery']);

function earliestStart(entry, previous, timing, now) {
  const { scope, maxConcurrent, gapMs, overlapMs } = timing;
  let start = now;
  const lanes = scope === 'battlefield' ? [previous] : entry.ids.map(id => previous.filter(clip => clip.ids.includes(id)));
  const overlap = maxConcurrent > 1 ? Math.min(overlapMs, entry.durationMs) : 0;
  for (const lane of lanes) {
    const releases = [];
    for (const clip of lane) {
      start = Math.max(start, clip.start, clip.end + gapMs - overlap);
      releases.push(clip.end);
    }
    if (releases.length >= maxConcurrent) {
      releases.sort((a, b) => b - a);
      start = Math.max(start, releases[maxConcurrent - 1]);
    }
  }
  // A spell's windup and approach precede its own impact even when caster
  // and recipient occupy separate lanes or a user permits result overlap.
  if (entry.recipe.actionKey) {
    for (const clip of previous) {
      if (clip.recipe.actionKey === entry.recipe.actionKey && clip.recipe.phase !== entry.recipe.phase
        && preludePhases.has(clip.recipe.phase)) start = Math.max(start, clip.end + gapMs);
    }
  }
  return start;
}

function effectEntries(recipes, { sourceId, targetId, now, seenGroups, windows, duration, sequence }) {
  const entries = [];
  const groupKeys = new Set(seenGroups);
  const implicitAction = Symbol('recipient effect batch');
  for (const { recipe } of windows) if (recipe.groupKey && recipe.phase !== 'delivery') groupKeys.add(recipe.groupKey);
  for (const recipe of recipes || []) {
    const groupKey = recipe.mount === 'group' && recipe.phase !== 'delivery' && recipe.groupKey;
    if (groupKey && groupKeys.has(groupKey)) continue;
    if (groupKey) groupKeys.add(groupKey);
    const ids = [...new Set((recipe.targetIds?.length ? recipe.targetIds
      : [recipe.targetId || targetId || recipe.sourceId || sourceId]).filter(Boolean))];
    entries.push({ recipe, ids, result: sequence, durationMs: clipDuration(recipe, duration),
      category: RecipientEffectCategory(recipe), action: recipe.actionKey ?? implicitAction,
      readyAt: now + Math.max(0, recipe.delayMs || 0) });
  }
  return entries;
}

function reserveClip(entry, start, now) {
  const frames = entry.recipe.phase === 'delivery' ? 1 : frameCount(entry.recipe);
  Object.assign(entry, { start, end: start + entry.durationMs, delayMs: start - now,
    lastFrameAt: start + entry.durationMs * (frames - 1) / frames });
}

/** Lay out effect clips under the selected queue policy. */
export function PlanRecipientEffectLayers(recipes, {
  sourceId, targetId, now = 0, windows = new Set(), seenGroups = new Set(), sequence = true, duration, timing,
} = {}) {
  const settings = timingFor(timing);
  const planned = [];
  const results = [...windows];
  const entries = effectEntries(recipes, { sourceId, targetId, now, seenGroups, windows, duration, sequence });
  if (sequence && settings.categoryQueues?.enabled) {
    while (entries.length) {
      const next = NextCategoryQueueEntry(entries, results, settings.categoryQueues, now);
      if (!next) throw new Error('Recipient effect dependencies form a cycle.');
      const { entry, start } = next;
      reserveClip(entry, start, now);
      entries.splice(entries.indexOf(entry), 1);
      planned.push(entry);
      results.push(entry);
    }
    return planned;
  }
  for (const entry of entries) {
    const start = sequence ? earliestStart(entry, results, settings, entry.readyAt) : entry.readyAt;
    reserveClip(entry, start, now);
    planned.push(entry);
    if (sequence) results.push(entry);
  }
  return planned;
}

function mountEffectEntry(layer, entry, { anchorFor, sourceId, options, timing, onStop, stops }) {
  const { recipe, ids, durationMs } = entry;
  const actors = ids.map(id => anchorFor(id)).filter(Boolean);
  if (!actors.length) return null;
  const actor = actors[0];
  const boxes = actors.map(node => bodyBox(layer, node));
  let box = boxes[0];
  if (recipe.mount === 'group') {
    if (recipe.phase !== 'delivery' && recipe.groupKey) {
      const seen = groups.get(layer) || new Set();
      if (seen.has(recipe.groupKey)) return null;
      groups.set(layer, seen);
      seen.add(recipe.groupKey);
      stops.push(() => seen.delete(recipe.groupKey));
    }
    const left = Math.min(...boxes.map(b => b.left)) - S.sweepGroupPaddingPx;
    const top = Math.min(...boxes.map(b => b.top));
    box = { left, top, width: Math.max(...boxes.map(b => b.left + b.width)) - left + S.sweepGroupPaddingPx,
      height: Math.max(...boxes.map(b => b.top + b.height)) - top };
  }
  const source = anchorFor(recipe.sourceId || sourceId);
  const sourceBox = source ? bodyBox(layer, source) : null;
  const playback = { ...options, duration: durationMs, timing, onStop };
  if (recipe.phase === 'delivery') return PlayRecipientDelivery(layer, sourceBox, box, recipe, playback);

  const combatant = actor.closest('.combatant');
  const card = combatant?.querySelector('.combatant-card');
  const targetFacing = combatant?.classList.contains('enemy') ? 'front' : 'back';
  return PlayRecipientEffect(layer, box, recipe, { ...playback, actor, sourceBox,
    targetFacing, cardBox: card ? localBox(layer, card) : null });
}

function categoryState(layer) {
  const existing = categoryQueues.get(layer);
  if (existing) return existing;
  const state = { pending: [], previous: [], timer: null, closed: false };
  function clear() {
    state.closed = true;
    clearTimeout(state.timer);
    state.pending.length = 0;
    state.previous.length = 0;
    categoryQueues.delete(layer);
  }
  const activeSet = register(layer, clear);
  state.wake = (delay = 0) => {
    if (state.closed) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(pump, delay);
  };
  function pump() {
    const now = Date.now();
    for (const clip of state.previous) if (clip.finish && clip.end <= now) clip.finish();
    if (disabled()) {
      const batches = new Set([...state.pending, ...state.previous].map(clip => clip.cancelBatch));
      for (const cancel of batches) cancel();
    }
    const neededActions = new Set([...state.pending, ...state.previous.filter(clip => clip.finish)].map(clip => clip.action));
    const stagger = Math.max(0, ...state.pending.map(clip => clip.policy.staggerMs));
    state.previous = state.previous.filter(clip => clip.finish || neededActions.has(clip.action) || clip.start + stagger > now);
    if (!state.pending.length) {
      if (!state.previous.some(clip => clip.finish)) {
        clear();
        activeSet.delete(clear);
      } else {
        state.wake(Math.max(0, Math.min(...state.previous.filter(clip => clip.finish).map(clip => clip.end)) - now));
      }
      return;
    }
    const next = NextCategoryQueueEntry(state.pending, state.previous, null, now);
    if (!next) {
      // A malformed cyclic recipe set must not strand this layer's future work.
      const { cancelBatch } = state.pending[0];
      cancelBatch();
      return;
    }
    if (next.start > now) { state.wake(Math.ceil(next.start - now)); return; }
    const { entry } = next;
    state.pending.splice(state.pending.indexOf(entry), 1);
    state.previous.push(entry);
    entry.mount();
    state.wake();
  }
  categoryQueues.set(layer, state);
  return state;
}

function playCategoryQueue(layer, recipes, { anchorFor, sourceId, targetId, options, timing }) {
  const state = categoryState(layer);
  const entries = effectEntries(recipes, { sourceId, targetId, now: Date.now(),
    seenGroups: groups.get(layer), windows: [...state.pending, ...state.previous.filter(clip => clip.finish)],
    duration: options.duration, sequence: true });
  const stops = [];
  let remaining = entries.length;
  const cancelBatch = () => {
    state.pending = state.pending.filter(clip => !entries.includes(clip));
    for (const clip of entries) clip.finish?.();
    state.previous = state.previous.filter(clip => !entries.includes(clip));
    closeBatch();
    state.wake();
  };
  const activeSet = register(layer, cancelBatch);
  function closeBatch() {
    for (const cleanup of stops.splice(0)) cleanup();
    activeSet.delete(cancelBatch);
  }
  for (const entry of entries) {
    Object.assign(entry, { policy: timing.categoryQueues, cancelBatch, mount: () => {
      const onStop = () => {
        if (!entry.finish) return;
        delete entry.finish;
        entry.end = Date.now();
        options.onStop?.();
        if (--remaining === 0) closeBatch();
        state.wake();
      };
      const finish = mountEffectEntry(layer, entry, { anchorFor, sourceId, options, timing, onStop, stops });
      reserveClip(entry, Date.now(), Date.now());
      entry.finish = () => { finish?.(); onStop(); };
      if (!finish) entry.finish();
    } });
    state.pending.push(entry);
  }
  if (!entries.length) closeBatch();
  // Calls made together can contribute to one ordered action before its first clip starts.
  state.wake();
  return cancelBatch;
}

/** Schedules presentation independently of combat resolution and actor motion. */
export function PlayRecipientEffectLayers(layer, recipes, { anchorFor, sourceId, targetId, ...options } = {}) {
  if (!layer || !anchorFor || disabled()) return () => {};
  const timing = timingFor(options.timing);
  if (options.frame == null && timing.categoryQueues?.enabled) {
    return playCategoryQueue(layer, recipes, { anchorFor, sourceId, targetId, options, timing });
  }
  const windows = resultWindows.get(layer) || new Set();
  const schedule = PlanRecipientEffectLayers(recipes, {
    sourceId, targetId, now: Date.now(), windows, seenGroups: groups.get(layer),
    sequence: options.frame == null, duration: options.duration, timing,
  });
  if (!schedule.length) return () => {};
  resultWindows.set(layer, windows);

  const stops = [], timers = [];
  let remaining = schedule.length;
  let cancelled = false;
  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    timers.forEach(clearTimeout);
    stops.forEach(fn => fn());
    for (const entry of schedule) windows.delete(entry);
    activeSet.delete(stop);
  };
  const activeSet = register(layer, stop);
  const retire = entry => {
    windows.delete(entry);
    if (--remaining === 0) stop();
  };

  for (const entry of schedule) {
    const { delayMs, result, durationMs } = entry;
    if (result) windows.add(entry);
    const play = () => {
      if (cancelled) return;
      if (disabled()) { retire(entry); return; }
      if (result) {
        // A late browser timer can make the actual start differ from its planned
        // one. Recheck older reservations so the live cap still holds.
        const earlier = [];
        for (const clip of windows) {
          if (clip === entry) break;
          earlier.push(clip);
        }
        const now = Date.now();
        // A delayed renderer teardown can share this timer turn with the next
        // clip. Stop elapsed canvases before admitting a successor.
        for (const clip of earlier) if (clip.finish && clip.end <= now) clip.finish();
        entry.start = earliestStart(entry, earlier, timing, now);
        entry.end = entry.start + durationMs;
        if (entry.start > now) {
          timers.push(setTimeout(play, entry.start - now));
          return;
        }
      }
      const onStop = () => {
        entry.end = Date.now();
        delete entry.finish;
        options.onStop?.();
      };
      const finish = mountEffectEntry(layer, entry, { anchorFor, sourceId, options, timing, onStop, stops });
      if (!finish) { retire(entry); return; }
      entry.finish = () => {
        delete entry.finish;
        finish();
      };
      stops.push(entry.finish);
      // Initial drawing precedes the renderer's duration timer. Keep the full
      // clip duration after mounting, then update the reservation on teardown.
      entry.end = Date.now() + durationMs;
      const release = () => {
        const waitMs = entry.end + (result ? timing.gapMs : 0) + M.cleanupSlackMs - Date.now();
        if (waitMs > 0) timers.push(setTimeout(release, waitMs));
        else retire(entry);
      };
      release();
    };
    if (delayMs > 0) timers.push(setTimeout(play, delayMs));
    else play();
  }
  return stop;
}

export function ClearRecipientEffects(layer) {
  for (const stop of [...(active.get(layer) || [])]) stop();
  groups.delete(layer);
  resultWindows.delete(layer);
}
