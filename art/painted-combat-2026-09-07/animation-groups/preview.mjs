import { createAnimator, sequences } from './controller.mjs';
import { auraFilter } from '../../../src/ui/combatAura.js';
const id = document.body.dataset.class;
const pathsFor=outfit=>Object.fromEntries(Object.values(sequences).flat().map(pose => [pose,
  /^(shieldGuard|shieldBash|parry)/.test(pose) ? `frames/${outfit}/${pose}.png` : `../combat/${outfit}/${pose.startsWith('power') ? 'idle' : pose}.png`]));
let paths=pathsFor(id);
const warm=paths=>Promise.all(Object.values(paths).map(src => new Promise((resolve, reject) => {
  const img = new Image(); img.onload = resolve; img.onerror = () => reject(new Error(`Missing frame: ${src}`)); img.src = src;
})));
await warm(paths);
const actor = document.querySelector('#actor');
const labels = { idle:'default idle', cast:'cast (idle pose)', guard:'guard', shieldGuard:'shield guard', parry:'parry' };
const animator = createAnimator({ actorId:id, frames:new Set(Object.keys(paths)), draw({ pose, rest, active, aura }) {
  actor.style.filter = auraFilter(pose, rest, aura, !!active);
  actor.src = paths[pose]; actor.dataset.pose = pose; actor.dataset.rest = rest;
  document.querySelector('#rest').textContent = `Resting: ${labels[rest]}`;
  document.querySelector('#action').textContent = active ? `Playing ${active} · ${pose}` : `Holding ${labels[rest]} · ${pose}`;
}});
const cards = {
  attack: { type:'attack', tags:id === 'reaver' ? ['guard','blade'] : ['starstone'] },
  skill:{ type:'skill', tags:[] }, power:{ type:'power', tags:[] },
  guard:{ type:'skill', tags:['guard'] },
  shieldGuard:{ type:'skill', tags:['guard'], equipmentProfileId:'shieldGuard' },
  parry:{ type:'skill', tags:['guard'], equipmentProfileId:'shieldGuard' },
  shieldBash:{ type:'attack', tags:['guard'], equipmentProfileId:'shieldAttack' },
};
const gear = action => action === 'parry' ? [{ id:'parryDagger',kind:'shield' }]
  : ['shieldGuard','shieldBash'].includes(action) ? [{id:id === 'reaver' ? 'kiteShield' : 'roundShield',kind:'shield',geom:id === 'reaver'?'kite':'round'}] : [];
const duration = () => Number(document.querySelector('#speed').value);
let scenarioTimers = [];
const stopScenario = () => { scenarioTimers.forEach(clearTimeout); scenarioTimers=[]; document.querySelector('#scenario-status').textContent=''; };
const payment = () => { const value=document.querySelector('#resource').value; return { staminaCost:value.includes('stamina')?1:0, manaCost:value.includes('mana')?1:0, hpCost:value==='hp'?1:0 }; };
const play = action => { animator.card({...cards[action],...payment()},gear(action),duration()); };
document.querySelectorAll('[data-action]').forEach(button => button.onclick = () => { stopScenario(); play(button.dataset.action); });
document.querySelector('#hit').onclick = () => { stopScenario(); animator.hit(duration()/2); };
document.querySelector('#other-turn').onclick = () => { stopScenario(); animator.nextTurn('other'); };
document.querySelector('#next-turn').onclick = () => { stopScenario(); animator.nextTurn(id); };
document.querySelector('#skip').onclick = () => { stopScenario(); animator.skip(); };
const reduced = document.querySelector('#reduced');
reduced.checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
reduced.onchange = () => animator.reducedMotion(reduced.checked);
animator.reducedMotion(reduced.checked);
document.querySelector('#scenario').onclick = () => {
  stopScenario(); animator.nextTurn(id); play('shieldGuard');
  const step = duration()+500;
  document.querySelector('#scenario-status').textContent='1 / 4 · Guard becomes the resting stance';
  const steps = [
    () => { play('attack'); return '2 / 4 · Attack returns to held guard'; },
    () => { animator.hit(duration()/2); return '3 / 4 · Hit returns to held guard'; },
    () => { animator.nextTurn(id); return '4 / 4 · Owner turn restores default idle'; },
  ];
  steps.forEach((fn,i) => scenarioTimers.push(setTimeout(() => document.querySelector('#scenario-status').textContent=fn(),step*(i+1))));
};
const sequence = document.querySelector('#sequence');
const captions = { attack1:'Anticipation',attack2:'Windup',attack3:'Release / cleave',attack4:'Recovery',shieldGuard1:'Raise',shieldGuard2:'Brace',shieldGuard3:'Hold',parry1:'Ready',parry2:'Deflect',parry3:'Hold',shieldBash1:'Windup',shieldBash2:'Impact',shieldBash3:'Recovery',power1:'Gather glow',power2:'Power flare',power3:'Settle glow',idle:'Combat idle / cast',guard:'Guard' };
function renderFrames() {
  document.querySelector('#frames').replaceChildren(...sequences[sequence.value].map(pose => {
    const figure = document.createElement('figure'); figure.className='frame';
    const img = new Image(); img.src=paths[pose]; img.alt=`${id} ${pose}`;
    const value=document.querySelector('#resource').value;
    img.style.filter=auraFilter(pose,'idle',value==='none'?[]:value.split('+'),true);
    const caption=document.createElement('figcaption');caption.textContent=`${pose} · ${captions[pose]}`;
    figure.append(img,caption); return figure;
  }));
}
document.querySelector('#resource').onchange=renderFrames;
sequence.onchange=renderFrames;renderFrames();animator.nextTurn(id);
const outfits=await (await fetch('../requirements.json')).json();
const outfitSelect=document.querySelector('#outfit');
for(const outfit of outfits.outfits.filter(outfit=>outfit.id===id||outfit.id.startsWith(id+'-'))) {
  const option=document.createElement('option');option.value=outfit.id;option.textContent=outfit.name;outfitSelect.append(option);
}
outfitSelect.value=id;
let selectionEpoch=0;
outfitSelect.onchange=async()=>{
  const token=++selectionEpoch,next=pathsFor(outfitSelect.value);
  stopScenario();animator.skip();await warm(next);
  if(token!==selectionEpoch)return;
  paths=next;animator.nextTurn(id);renderFrames();
};
addEventListener('pagehide',()=>{stopScenario();animator.dispose();});
