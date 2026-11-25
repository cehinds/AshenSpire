import { alternativeArtCatalog as art } from '../src/ui/alternativeArtCatalog.js';
import * as renderer from '../src/ui/recipientEffectSprites.js';
import * as model from '../src/model/recipientEffects.js';
import { SETTINGS } from '../src/content/recipientEffectSettings.js';
import { ReadRecipientEffectTiming, ValidateRecipientEffectTiming } from '../src/model/recipientEffectTiming.js';
import { RECIPIENT_EFFECT_ATLAS } from '../src/content/recipientEffectAtlas.js';
import { setBuiltInSource, assetUrl } from '../src/ui/assetmap.js';
const stage=document.querySelector('#stage'),layer=document.querySelector('#effect-layer'),scene=stage.querySelector('.scene');
const image=url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>resolve(null);i.src=url});
const path=p=>new URL('../'+p,import.meta.url).href;
for(const item of art.scenes['ashen-crown-1'].devices.desktop.layers){const im=await image(path(art.sceneLayers[item.id].path));if(im)scene.getContext('2d').drawImage(im,item.x,item.y,item.width,item.height)}
const definitions=[['player','reaver-default',330,913,318],['enemy-1','fellWarden',825,625,252],['enemy-2','wanderingSoldier',1080,605,226],['enemy-3','blightHound',1335,628,182]];
const actors={};
for(const[id,key,cx,foot,height]of definitions){const def=art.sprites[key],b=def.bounds,width=height*(b[2]-b[0])/(b[3]-b[1]);const host=document.createElement('div');host.className='combatant '+(id==='player'?'player':'enemy');host.style.cssText=`left:${cx-width/2}px;top:${foot-height}px;width:${width}px;height:${height}px`;host.innerHTML='<div class="combatant-card"></div><div class="sprite"><canvas></canvas></div><span class="actor-label">'+id+' · actual game art</span>';stage.insertBefore(host,layer);const sprite=host.querySelector('.sprite'),c=sprite.querySelector('canvas');c.width=Math.ceil(width);c.height=height;const im=await image(path(def.path));if(!im)host.querySelector('.actor-label').textContent=id+' / actor art unavailable';if(im)c.getContext('2d').drawImage(im,b[0]*im.width/def.size[0],b[1]*im.height/def.size[1],(b[2]-b[0])*im.width/def.size[0],(b[3]-b[1])*im.height/def.size[1],0,0,c.width,c.height);actors[id]={sprite,host,box:{left:cx-width/2,top:foot-height,width,height},source:def.path};}
function resize(){const scale=Math.min(1,document.querySelector('#viewport').clientWidth/1536);stage.style.transform=`scale(${scale})`;document.querySelector('#viewport').style.height=1024*scale+'px'}new ResizeObserver(resize).observe(document.querySelector('.preview'));resize();
function artMode(present=true){const map=new Map([['qa/sentinel','data:,art-pack-active']]),artRoot=new URLSearchParams(location.search).get('artRoot');if(present)for(const a of Object.values(RECIPIENT_EFFECT_ATLAS))map.set(a.asset,artRoot?new URL(a.asset,new URL(artRoot,location.href)).href:path(a.asset));setBuiltInSource(map);return present?(artRoot?'explicit local staged art':'pinned/cache art via source server'):'static debug fallback';}
function cardBox(id){const b=actors[id].box;return{left:b.left-12,top:b.top-12,width:b.width+24,height:b.height+24}}
async function show(recipe,{id='enemy-1',frame=1,art=true,label=recipe.shape,duration=10000}={}){renderer.ClearRecipientEffects(layer);artMode(art);if(art)await renderer.PrewarmRecipientEffect(recipe);const a=actors[id];document.querySelector('#case').textContent=label+' · '+artMode(art);renderer.PlayRecipientEffect(layer,a.box,recipe,{actor:a.sprite,cardBox:cardBox(id),targetFacing:id==='player'?'back':'front',sourceBox:actors[recipe.sourceId||document.querySelector('#invoker').value]?.box,frame,duration});return snapshot();}
function snapshot(){return{settings:SETTINGS,actors:Object.fromEntries(Object.entries(actors).map(([id,a])=>[id,{box:a.box,cardBox:cardBox(id),source:a.source}])),effects:[...layer.querySelectorAll('.recipient-effect')].map(n=>({dataset:{...n.dataset},opacity:Number(n.style.opacity),left:parseFloat(n.style.left),top:parseFloat(n.style.top),width:parseFloat(n.style.width),height:parseFloat(n.style.height),planes:[...n.querySelectorAll('canvas')].map(c=>({dataset:{...c.dataset},width:c.width,height:c.height,pixels:(()=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0,y=0;for(let i=3;i<d.length;i+=4)if(d[i]>0){count++;y+=Math.floor(i/4/c.width)}return{count,centerY:count?y/count:null}})()}))}))};}
async function playLayers(recipes,{art=true}={}){renderer.ClearRecipientEffects(layer);artMode(art);if(art)await Promise.all(recipes.map(r=>renderer.PrewarmRecipientEffect(r)));renderer.PlayRecipientEffectLayers(layer,recipes,{anchorFor:id=>actors[id]?.sprite,sourceId:document.querySelector('#invoker').value,targetId:document.querySelector('#recipient').value});}
window.integrationQA={ready:true,model,renderer,SETTINGS,show,snapshot,playLayers,artMode,layer,actors};artMode();document.querySelector('#case').textContent='Ready · actual art + production modules';

const control = id => document.getElementById(id);
const endpoint = '/__editor/recipient-effects';
const editorWritable = document.documentElement.dataset.editorWrite === 'on';
const fieldIds = {
  scope: 'timing-scope',
  maxConcurrent: 'timing-cap',
  gapMs: 'timing-gap',
  overlapMs: 'timing-overlap',
  opacity: 'timing-opacity',
};
const singleIds = ['action', 'camp', 'school', 'range', 'invoker', 'recipient', 'outcome'];
let saved = { revision: null, timing: ReadRecipientEffectTiming() };
let timing = saved.timing;
let invalid = '';
let busy = false;
let plan = [];
let reviewTime = 0;
let reviewEnd = 0;
let playing = false;
let animation = 0;
let previousMount = null;
let refreshVersion = 0;
let timelineRows = [];

function selectedAction(sourceId) {
  const school = control('school').value;
  const tags = [
    'camp:' + control('camp').value,
    'maneuver:' + control('action').value,
    'range:' + control('range').value,
  ];
  if (school !== 'none') tags.push('school:' + school);
  return { sourceId, tags };
}

function singleEvent(sourceId, targetId, outcome) {
  const target = { sourceId, targetId };
  const damage = { ...target, type: 'damageDealt', amount: 8, hpRemoved: 8 };
  const statuses = { 'evade-gain': 'base.evade', 'counter-gain': 'base.auto-counter', reflect: 'base.reflect' };
  const events = {
    hit: damage,
    ward: { ...target, type: 'persistentWardChanged', restored: 5 },
    'ward-shatter': { ...target, type: 'wardBroken' },
    evade: { ...target, type: 'combatAvoidanceResolved', avoided: true },
    heal: { ...target, type: 'healed', amount: 5 },
    stamina: { ...target, type: 'staminaRecovered', amount: 3 },
    mana: { ...target, type: 'manaRestored', amount: 3 },
    'block-break': { ...target, type: 'blockBroken' },
    'poise-break': { ...target, type: 'poiseBroken' },
    'block-hit': { ...damage, hpRemoved: 0, blocked: 8 },
    'poise-hit': { ...damage, hpRemoved: 0, poiseAbsorbed: 8 },
  };
  return events[outcome] || { ...target, type: 'statusApplied', status: statuses[outcome] || outcome, stacks: 2 };
}

function reviewRecipes() {
  const sourceId = control('invoker').value;
  const targetId = control('recipient').value;
  const demo = control('demo').value;
  if (demo === 'single') {
    const action = selectedAction(sourceId);
    const outcome = control('outcome').value;
    const event = singleEvent(sourceId, targetId, outcome);
    const actionKey = 'preview-single-action';
    let clips = model.RecipientEffectsForEvent(action, event).map(recipe => ({ ...recipe, actionKey, delivery: null }));
    if (control('action').value === 'sweep' && outcome === 'hit' && targetId !== 'player') {
      clips = clips.map(recipe => ({ ...recipe, mount: 'group', targetType: 'aoe', targetIds: ['enemy-1', 'enemy-2', 'enemy-3'], groupKey: 'preview-sweep' }));
    }
    const prelude = [];
    const windup = model.RecipientWindupFor(action, event);
    if (windup) prelude.push({ ...windup, actionKey });
    const delivery = model.RecipientDeliveryFor(action, event);
    if (delivery.mode === 'reach-extension' && sourceId !== targetId) {
      const base = model.ResolveRecipientEffect(action, event);
      prelude.push({ ...base, impactShape: base.shape, shape: null, phase: 'delivery',
        mount: 'target', sourceId, targetId, actionKey, claimsDamage: false, delivery });
    }
    return [...prelude, ...clips];
  }

  const attack = { sourceId: 'player', tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'school:fire'] };
  const primary = demo === 'sequence' ? targetId : 'enemy-1';
  const elsewhere = demo === 'sequence' ? primary : 'enemy-2';
  const caster = demo === 'sequence' ? primary : 'player';
  const receipt = [
    singleEvent('player', primary, 'hit'),
    singleEvent('player', primary, 'ward-shatter'),
    singleEvent('player', elsewhere, 'poison'),
    singleEvent('player', caster, 'wisdom'),
    singleEvent('player', caster, 'counter-gain'),
    singleEvent('player', elsewhere, 'evade-gain'),
  ];
  return receipt.flatMap(event => model.RecipientEffectsForEvent(attack, event));
}

function pause() {
  playing = false;
  cancelAnimationFrame(animation);
  control('pause').disabled = true;
  control('play').textContent = 'Play';
}

function timelineNode(entry) {
  const { recipe, ids, start, end } = entry;
  const row = document.createElement('li');
  row.className = 'timeline-row';
  const shape = recipe.shape || recipe.phase;
  Object.assign(row.dataset, { shape, phase: recipe.phase || 'contact', start, end });
  const label = document.createElement('span');
  label.className = 'clip-label';
  label.textContent = [shape.replaceAll('-', ' '), ...ids].join(' · ');
  const range = document.createElement('span');
  range.className = 'clip-time';
  range.textContent = start + '–' + end + ' ms';
  const track = document.createElement('div');
  track.className = 'clip-track';
  track.setAttribute('aria-hidden', 'true');
  const bar = document.createElement('div');
  bar.className = 'clip-bar';
  bar.style.left = start / reviewEnd * 100 + '%';
  bar.style.width = (end - start) / reviewEnd * 100 + '%';
  const playhead = document.createElement('div');
  playhead.className = 'playhead';
  track.append(bar, playhead);
  row.append(label, range, track);
  return { row, playhead, start, end };
}

function scrub(ms) {
  reviewTime = Math.min(reviewEnd, Math.max(0, Number(ms) || 0));
  const activeEntries = [];
  for (const [index, entry] of plan.entries()) {
    if (reviewTime < entry.start || reviewTime >= entry.end) continue;
    const count = Math.min(3, Math.max(1, Math.round(entry.recipe.frameCount || SETTINGS.behavior.frameCount)));
    const frame = Math.min(count - 1, Math.floor((reviewTime - entry.start) * count / (entry.end - entry.start)));
    activeEntries.push({ index, frame, recipe: entry.recipe });
  }
  const mountKey = activeEntries.map(({ index, frame }) => index + ':' + frame).join('|');
  if (mountKey !== previousMount) {
    previousMount = mountKey;
    renderer.ClearRecipientEffects(layer);
    // The timeline supplies the exact production frame and interval. Keep the
    // displayed frame mounted while the transport is paused.
    const frozenFrameLifetime = 2_147_000_000;
    for (const { recipe, frame } of activeEntries) {
      const frozen = { ...recipe, delayMs: 0, durationMs: frozenFrameLifetime };
      if (recipe.delivery) frozen.delivery = { ...recipe.delivery, durationMs: frozenFrameLifetime };
      renderer.PlayRecipientEffectLayers(layer, [frozen], {
        anchorFor: id => actors[id]?.sprite,
        sourceId: recipe.sourceId,
        targetId: recipe.targetId,
        frame,
        timing,
        forcePlaceholder: control('fallback').checked,
      });
    }
  }
  control('scrub').value = String(Math.round(reviewTime));
  control('clock').value = Math.round(reviewTime) + ' / ' + Math.round(reviewEnd) + ' ms';
  for (const { row, playhead, start, end } of timelineRows) {
    row.dataset.active = String(start <= reviewTime && reviewTime < end);
    playhead.style.left = reviewTime / reviewEnd * 100 + '%';
  }
}

async function refresh({ preserveTime = false } = {}) {
  pause();
  const request = ++refreshVersion;
  const time = reviewTime;
  const recipes = reviewRecipes();
  const names = artMode(!control('fallback').checked);
  if (!control('fallback').checked) await Promise.all(recipes.map(recipe => renderer.PrewarmRecipientEffect(recipe.phase === 'delivery' ? { ...recipe, shape: recipe.impactShape } : recipe)));
  if (request !== refreshVersion) return;
  plan = renderer.PlanRecipientEffectLayers(recipes, { timing });
  reviewEnd = Math.max(1, ...plan.map(entry => entry.end));
  timelineRows = plan.map(timelineNode);
  control('result-timeline').replaceChildren(...timelineRows.map(entry => entry.row));
  control('scrub').max = String(Math.ceil(reviewEnd));
  control('case').textContent = names;
  previousMount = null;
  scrub(preserveTime ? time : Math.min(100, reviewEnd));
}

function play() {
  const from = playing || reviewTime >= reviewEnd ? 0 : reviewTime;
  pause();
  const started = performance.now();
  playing = true;
  control('pause').disabled = false;
  control('play').textContent = 'Replay';
  function tick(now) {
    scrub(from + Math.max(0, now - started));
    if (playing && reviewTime < reviewEnd) animation = requestAnimationFrame(tick);
    else pause();
  }
  animation = requestAnimationFrame(tick);
}

function dirty() { return JSON.stringify(timing) !== JSON.stringify(saved.timing); }

function status(message, state) {
  const note = control('timing-status');
  note.dataset.state = state;
  note.textContent = message;
  control('save-timing').disabled = busy || invalid !== '' || !saved.revision || !dirty();
  control('reset-timing').disabled = busy;
  control('download-timing').disabled = invalid !== '';
}

function showTimingStatus() {
  if (invalid) { status(invalid, 'error'); return; }
  if (!saved.revision) {
    const note = dirty() ? 'Unsaved changes. ' : '';
    status(note + 'Read-only preview. Start the local server with --editor-write to save, or download your values.', dirty() ? 'dirty' : 'ready');
    return;
  }
  if (dirty()) status('Unsaved changes. The preview is using your current values.', 'dirty');
  else status('Saved to ' + saved.file, 'saved');
}

function syncFields() {
  for (const [key, id] of Object.entries(fieldIds)) control(id).value = String(timing[key]);
  control('timing-overlap').disabled = timing.maxConcurrent === 1;
  control('opacity-value').value = Math.round(timing.opacity * 100) + '%';
}

async function editTiming(event) {
  const input = Object.fromEntries(Object.entries(fieldIds).map(([field, id]) => [
    field,
    field === 'scope' ? control(id).value : control(id).valueAsNumber,
  ]));
  if (input.maxConcurrent === 1) input.overlapMs = 0;
  if (event.target.id === fieldIds.overlapMs && input.overlapMs > 0) input.gapMs = 0;
  if (event.target.id === fieldIds.gapMs && input.gapMs > 0) input.overlapMs = 0;
  try {
    timing = ValidateRecipientEffectTiming(input);
    invalid = '';
  } catch (error) {
    invalid = error.message;
  }
  if (!invalid) syncFields();
  showTimingStatus();
  if (!invalid) await refresh({ preserveTime: true });
}

async function editorRequest(options) {
  const response = await fetch(endpoint, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not access saved timing.');
  return { ...data, timing: ValidateRecipientEffectTiming(data.timing) };
}

async function restoreSaved() {
  busy = true;
  status('Reading saved timing…', 'ready');
  try {
    if (editorWritable) saved = await editorRequest();
    timing = saved.timing;
    invalid = '';
    syncFields();
    await refresh({ preserveTime: true });
  } catch (error) {
    busy = false;
    status(error.message, 'error');
    return;
  }
  busy = false;
  showTimingStatus();
}

async function save() {
  if (busy || invalid || !saved.revision || !dirty()) return;
  busy = true;
  status('Saving timing…', 'ready');
  try {
    const outgoing = timing;
    saved = await editorRequest({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: saved.revision, timing: outgoing }),
    });
  } catch (error) {
    busy = false;
    status(error.message, 'error');
    return;
  }
  busy = false;
  showTimingStatus();
}

function downloadTiming() {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(timing, null, 2) + '\n'], { type: 'application/json' }));
  link.href = url;
  link.download = 'recipient-effect-timing.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function setDemo() { control('single-controls').hidden = control('demo').value !== 'single'; }

async function configure({ timing: override, ...values } = {}) {
  if (override !== undefined) {
    timing = ValidateRecipientEffectTiming(override);
    invalid = '';
    syncFields();
    showTimingStatus();
  }
  if (!Object.hasOwn(values, 'demo') && Object.keys(values).some(id => singleIds.includes(id))) control('demo').value = 'single';
  for (const [id, value] of Object.entries(values)) {
    const node = control(id);
    if (!node) throw new Error('Unknown preview control: ' + id);
    if (node.type === 'checkbox') node.checked = Boolean(value);
    else node.value = String(value);
  }
  setDemo();
  await refresh();
  return { invoker: control('invoker').value, recipient: control('recipient').value, recipes: scheduledRecipes(), durationMs: reviewEnd };
}

const scheduledRecipes = () => plan.map(({ recipe, delayMs }) => ({ ...recipe, delayMs }));
for (const id of Object.values(fieldIds)) control(id).addEventListener('input', editTiming);
for (const id of [...singleIds, 'fallback']) control(id).addEventListener('change', () => refresh());
control('demo').addEventListener('change', () => { setDemo(); refresh(); });
control('scrub').addEventListener('input', event => { pause(); scrub(event.target.value); });
control('play').addEventListener('click', play);
control('pause').addEventListener('click', pause);
control('save-timing').addEventListener('click', save);
control('reset-timing').addEventListener('click', restoreSaved);
control('download-timing').addEventListener('click', downloadTiming);
syncFields();
if (editorWritable) await restoreSaved();
else { showTimingStatus(); await refresh(); }
window.recipientRuntimePreview = {
  refresh, scrub, configure, pause,
  get invoker() { return control('invoker').value; },
  get recipient() { return control('recipient').value; },
  get recipes() { return scheduledRecipes(); },
  get durationMs() { return reviewEnd; },
  get timing() { return { ...timing }; },
  get plan() { return structuredClone(plan); },
};
