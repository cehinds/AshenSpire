// Design-only geometry. No game assets, content or combat state are mutated.
const S = {
 sword:'<path d="M45 67V25l5-12 5 12v42ZM35 68h30v5H35Zm11 5h8v15h-8Z"/>',
 hammer:'<path d="M46 43h8v44h-8ZM25 20h50v26H25Z"/>',
 shield:'<path d="m50 15 28 12v23q0 23-28 37-28-14-28-37V27Z"/><path d="M50 24v52M30 34h40" fill="none"/>',
 scimitar:'<path d="M24 73Q65 66 79 16q10 54-47 64ZM17 73l20 10-3 5-20-10ZM20 81l5 3-8 10-5-3Z"/>',
 feather:'<path d="M29 80Q18 29 75 14q8 48-46 66ZM23 89 68 24M34 65l-5-15m17-2 13 1"/>',
 cards:'<rect x="25" y="20" width="37" height="52" rx="2" transform="rotate(-14 45 46)"/><rect x="40" y="28" width="37" height="52" rx="2" transform="rotate(12 58 54)"/>',
 spiral:'<path d="M74 73c-37 30-72-16-48-46 22-28 61-7 48 19-9 20-40 12-30-5 5-9 18-4 15 4" fill="none" stroke-width="5"/>',
 bow:'<path d="M37 16q45 34 0 68M37 16v68M22 50h57m-12-8 12 8-12 8" fill="none" stroke-width="4"/>',
 orb:'<circle cx="50" cy="50" r="22"/><path d="M18 61q-8-35 31-43M82 39q8 35-31 43" fill="none"/>',
 flame:'<path d="M51 14q7 22 19 32 21 29-14 38-40 5-27-29 5-13 12-19-3 21 8 18 9-9 2-40Z"/>',
 crystal:'<path d="m50 13 24 26-12 42H38L26 39Zm0 0L40 39l10 42 11-42ZM26 39h48"/>',
 bolt:'<path d="M54 13 27 55h22l-5 32 30-47H53Z"/>',
 stone:'<path d="m23 67 9-35 30-12 18 36-15 23H38Z"/><path d="m32 32 19 23 29 1M51 55l-13 24" fill="none"/>',
 eye:'<path d="M13 50q37-42 74 0-37 42-74 0Z"/><circle cx="50" cy="50" r="13"/>',
 sun:'<circle cx="50" cy="50" r="19"/><path d="M50 10v13m0 54v13M10 50h13m54 0h13M22 22l10 10m36 36 10 10m0-56L68 32M32 68 22 78" fill="none"/>',
 leaf:'<path d="M25 77Q12 21 78 18q6 65-53 59ZM22 85l46-55M35 64l-3-20m14 9 17 1"/>',
 drop:'<path d="M50 15Q20 49 25 66q7 29 33 19 35-10-8-70Z"/>',
 vial:'<path d="M41 15h18v20l14 25v23H27V60l14-25Zm-14 47h46"/>',
 chain:'<rect x="27" y="16" width="30" height="45" rx="15" fill="none" stroke-width="6"/><rect x="44" y="40" width="30" height="45" rx="15" fill="none" stroke-width="6"/>',
 star:'<path d="m50 12 10 27 28 11-28 10-10 28-10-28-28-10 28-11Z"/>',
 moon:'<path d="M64 15C8 6 7 91 66 85 30 69 29 31 64 15Z"/>',
 banner:'<path d="M30 88V14m0 6h46L62 38l14 19H30"/>',
 heart:'<path d="M50 82 19 50C-3 18 38 8 50 30c12-22 53-12 31 20Z"/>',
 hourglass:'<path d="M29 15h42M29 85h42M34 15q0 22 16 35-16 13-16 35m32-70q0 22-16 35 16 13 16 35" fill="none" stroke-width="4"/>',
 mask:'<path d="M23 24q27-17 54 0v29q0 25-27 33-27-8-27-33Z"/><path d="m32 43 10 3m16 0 10-3M41 64h18" fill="none" stroke-width="4"/>',
 fist:'<path d="M28 74 20 54l7-11V28h11V21h12v3h12v7h12v30L62 79H34Z"/><path d="M38 29v21m12-23v21m12-15v20M27 50h24v13" fill="none"/>',
 mirror:'<ellipse cx="50" cy="39" rx="23" ry="29"/><path d="M46 68h8v22h-8ZM39 43l18-18"/>',
 bell:'<path d="M24 70q10-14 10-31 0-24 16-24t16 24q0 17 10 31ZM43 78q7 13 14 0"/>',
 candle:'<path d="M39 42h22v44H39ZM50 8q-20 24 0 28 17-3 0-28Z"/>',
 hand:'<path d="M30 78 18 53q0-10 10-4l8 10V25q6-10 10 0v27-35q8-10 11 0v35-29q9-8 10 2v33-17q10-7 10 5v22L62 84H38Z"/>',
 tomb:'<path d="M26 85V36q0-25 24-25t24 25v49ZM40 36h20M50 26v32"/>',
 fang:'<path d="M24 20q38-10 54 16-1 35-48 50 30-33-6-66Z"/>',
 ring:'<path d="M74 23a36 36 0 1 0 9 48M85 37l-1 14" fill="none" stroke-width="5"/>',
 smoke:'<path d="M27 85q55-22 23-39-27-13 15-33M38 80q29-19 7-29" fill="none" stroke-width="6"/>'
};
S.shieldSword=`<g transform="translate(20 -3) scale(.85)">${S.sword}</g><g transform="translate(-6 12) scale(.85)">${S.shield}</g>`;
S.crossedSwords=`<g transform="rotate(-30 50 50)">${S.sword}</g><g transform="rotate(30 50 50)">${S.sword}</g>`;
S.doubleShield=`<g transform="translate(20 0) scale(.8)">${S.shield}</g><g transform="translate(0 20) scale(.8)">${S.shield}</g>`;
S.brokenSword=S.sword+'<path d="m35 44 26 7-26 8" stroke="#101923" stroke-width="7" fill="none"/>';
S.crackedShield=S.shield+'<path d="m53 18-9 24 13 10-14 25" stroke="#101923" stroke-width="5" fill="none"/>';
const accents={tip:'<path d="M50 15v6m-3-3h6"/>',impact:'<path d="m22 28-8-6m63 11 9-7"/>',return:'<path d="M77 68Q41 99 20 65m-1 12 1-12 12 2"/>',sweep:'<path d="M15 72q45 32 73-30"/>',rim:'<path d="M24 31v21q0 17 13 26"/>',trail:'<path d="m15 71 25-10M20 86l32-19"/>',lift:'<path d="M78 77V44m-5 5 5-5 5 5"/>',orbit:'<path d="M18 55q-5-20 15-30m50 20q5 20-15 30"/>',none:''};
const el=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, actionSymbols, serial=0;
const enabled=()=>new Set([...document.querySelectorAll('input:checked')].map(x=>x.value));
function svg(recipeId,secondary=[],visible=enabled(),label=recipeId){
 const r=data.recipes[recipeId], p=data.collections.backgrounds[r.background], id=`gradient-${serial++}`;
 const object=S[data.collections.objects[r.object].wireframeShape];
 if(!object)throw new Error(`Missing wireframe ${r.object}`);
 const shape=k=>S[data.collections.objects[data.recipes[k].object].wireframeShape];
 const slots=data.composition.secondarySlots;
 function cues(layer){return secondary.slice(0,3).map((k,i)=>{const slot=slots[i];if(slot.layer!==layer)return '';const [x,y]=slot.anchor,scale=slot.scale;return `<g data-cue="${esc(k)}" transform="translate(${x-50*scale} ${y-50*scale}) scale(${scale})" fill="none" stroke="${p.accent}" stroke-width="5" opacity="${slot.opacity}">${shape(k)}</g>`;}).join('');}
 const action=data.collections.backEffects[r.backEffect].sourceActionSymbol;
 const sigil=actionSymbols[action]?.svg;
 const back=sigil?`<svg x="12" y="12" width="76" height="76" viewBox="${sigil.viewBox}" fill="${sigil.fill || 'none'}" stroke="${sigil.stroke || 'none'}" stroke-width="${sigil['stroke-width'] || 0}" style="color:#000">${sigil.body}</svg>`:'<circle cx="50" cy="50" r="37" fill="none" stroke="#000" stroke-width="4" stroke-dasharray="40 14"/>';
 return `<svg class="art" viewBox="-16 0 132 100" role="img" aria-label="${esc(label)}"><defs><radialGradient id="${id}" r="70%"><stop stop-color="${p.center}"/><stop offset="1" stop-color="${p.edge}"/></radialGradient></defs>${visible.has('background')?`<g data-layer="background"><path fill="url(#${id})" d="M-16 0h132v100H-16Z"/></g>`:''}${visible.has('backEffect')?`<g data-layer="backEffect"><g opacity="${data.collections.backEffects[r.backEffect].opacity}">${back}</g>${cues('backEffect')}</g>`:''}${visible.has('object')?`<g data-layer="object" transform="translate(14 10) scale(.72)" fill="#9ca8b5" stroke="#e3e7e8" stroke-width="1.4" stroke-linejoin="round">${object}</g>`:''}${visible.has('foreground')?`<g data-layer="foreground"><g fill="none" stroke="${p.accent}" stroke-width="1.5" opacity="${data.collections.foregroundEffects[r.foreground].opacity}">${accents[r.foreground]}</g>${cues('foreground')}</g>`:''}</svg>`;
}
function render(){
 el('examples').innerHTML=data.examples.map(e=>`<article class="tile">${svg(e.primaryRecipe,e.secondaryRecipes,enabled(),e.label)}<h3>${esc(e.label)}</h3><p>${e.identityCount} ${e.identityCount===1?'identity':'identities'} · ${esc([...e.input.tags,...e.input.operations.map(x=>`op:${x}`),...e.input.statuses.map(x=>`status ID: ${x}`)].join(' / '))}</p></article>`).join('');
 el('layers').innerHTML=data.composition.layerOrder.map((layer,i)=>`<article class="tile">${svg('attack',[],new Set([layer]),`Attack ${layer} layer`)}<h3>${i+1}. ${esc(layer)}</h3></article>`).join('');
 const key=el('recipe').value;el('selected').innerHTML=svg(key);el('recipe-json').textContent=JSON.stringify({recipe:key,...data.recipes[key]},null,2);
}
try{
 const responses=await Promise.all([fetch('./art-catalog.json'),fetch('../../../src/content/card-layout.json')]);
 if(responses.some(r=>!r.ok))throw new Error('Serve this folder from the repository root so the catalog and existing action sigils can load.');
 [data,{symbols:{actions:actionSymbols}}]=await Promise.all(responses.map(r=>r.json()));
 el('recipe').innerHTML=Object.keys(data.recipes).map(k=>`<option>${esc(k)}</option>`).join('');
 el('coverage').textContent=`${Object.keys(data.bindings.tags).length} tag bindings · ${Object.keys(data.bindings.statuses).length} status bindings.`;
 document.querySelectorAll('input').forEach(x=>x.addEventListener('change',render));el('recipe').addEventListener('change',render);
 el('reset').addEventListener('click',()=>{document.querySelectorAll('input').forEach(x=>x.checked=true);render();});render();
}catch(error){el('error').textContent=error.message;console.error(error);}
