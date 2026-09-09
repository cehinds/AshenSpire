import { createPaintedStage } from '../../src/ui/paintedOutfits.js';
import { resolveCombatPose } from '../../src/model/combatPose.js';
import { COMBAT_POSE_STATES } from '../../src/content/combatPoseStates.js';
const groups=[['rogue','Prepared','A coiled opening, marked by a pale-violet diamond.','prepared',['default','duelist','nightveil','shadow']],['starseer','Starstone Charge','A raised casting stance beneath a blue-violet constellation.','starstoneCharge',['default','astral','eclipse','starlit']],['herald','Blood Rite','A ritual stance with a blood-red and broken-gold halo.','stigmata',['default','emberhabit','ossuary','pilgrim']]];
const entries=[];
for(const [classId,title,description,statusId,outfits] of groups){
  const card=document.createElement('article');card.className='card';card.dataset.class=classId;
  card.innerHTML=`<div class="arena"><div class="actor"></div></div><div class="copy"><h2>${title}</h2><p>${description}</p><label>Outfit<select>${outfits.map(id=>`<option value="${id}">${id==='default'?'Original outfit':id[0].toUpperCase()+id.slice(1)}</option>`).join('')}</select></label><div class="controls"><button data-action="ready">Ready</button><button data-action="attack">Attack</button><button data-action="cast">Cast</button><button data-action="hit">Hit</button><button data-action="guard">Guard</button><button data-action="clear">Clear effect</button>${classId==='herald'?'<button data-action="hp">Spend HP</button><button data-action="heal">Heal</button>':''}</div><div class="state" aria-live="polite"></div></div>`;
  document.querySelector('#gallery').append(card);
  const entity={hp:30,statuses:{[statusId]:{stacks:1}}};let rest='idle',stage;
  const settle=()=>{stage.setRestPose(resolveCombatPose(entity,rest));const name=COMBAT_POSE_STATES[stage.rest]?.name || stage.rest[0].toUpperCase()+stage.rest.slice(1);card.querySelector('.state').textContent=`Resting pose: ${name}`;};
  const mount=()=>{stage?.dispose();stage=createPaintedStage(classId,card.querySelector('select').value);card.querySelector('.actor').replaceChildren(stage.el);settle();};
  card.querySelector('select').onchange=mount;mount();
  card.querySelector('.controls').onclick=e=>{const action=e.target.dataset.action;if(!action)return;
    if(action==='ready'){entity.statuses[statusId]={stacks:1};settle();}
    else if(action==='clear'){delete entity.statuses[statusId];settle();}
    else if(action==='guard'){rest='guard';settle();stage.play('guard',800);}
    else if(['hp','heal'].includes(action))stage.react(action);
    else stage.play(action,900,action==='cast'?['mana']:[]);
  };
  entries.push({classId,get stage(){return stage;},entity,settle,mount});
}
document.querySelector('#motion').onclick=e=>{const on=document.body.classList.toggle('reduced-motion');e.target.textContent=`Reduced motion: ${on?'on':'off'}`;e.target.setAttribute('aria-pressed',on);entries.forEach(e=>e.stage.settle());};
document.querySelector('#stop').onclick=()=>entries.forEach(e=>e.stage.settle());
window.readinessPreview=entries;
