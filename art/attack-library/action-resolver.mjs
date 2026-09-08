import {resolveAttack,WEAPONS} from './catalog.mjs';

export const ACTIONS={
 attack:{name:'Attack',frames:7,equipment:true},
 cast:{name:'Cast',frames:7,equipment:true},
 defend:{name:'Guard stance',frames:7,equipment:true,hold:true},
 block:{name:'Block impact',frames:7,equipment:true},
 parry:{name:'Parry',frames:7,equipment:true},
 dodge:{name:'Dodge',frames:7,equipment:true},
 hurt:{name:'Hurt',frames:7,equipment:true},
 stagger:{name:'Heavy hurt / stagger',frames:7,equipment:true},
 debuff:{name:'Negative status onset',frames:7,equipment:true,overlay:'debuff'},
 buff:{name:'Buff activation',frames:7,equipment:true,overlay:'buff'},
 dice:{name:'Dice roll gesture',frames:7,equipment:true,overlay:'dice'},
};
export function resolveAction(loadout,action='attack'){
 if(!ACTIONS[action])throw new Error(`Unknown action: ${action}`);
 const attack=resolveAttack(loadout);if(!attack.allowed)return attack;
 if(action==='attack')return {...attack,action};
 const main=WEAPONS.find(w=>w.id===loadout.main),off=WEAPONS.find(w=>w.id===loadout.off);
 const hands=attack.clip==='two-hand'||attack.clip==='bow'?'two-hand':off?'occupied':'free';
 let clip;
 if(action==='cast')clip=hands==='two-hand'?'cast-two-hand':main.family==='focus'&&off?.family==='focus'?'cast-dual-focus':off?'cast-occupied':'cast-one-hand';
 else if(action==='defend'||action==='block')clip=`${action}-${off?.family==='shield'||main.family==='shield'?'shield':off?.id==='parryDagger'?'parry':hands==='two-hand'?'two-hand':'weapon'}`;
 else if(action==='parry')clip=off?.id==='parryDagger'?'parry-dagger':'parry-weapon';
 else clip=`${action}-${hands}`;
 if(clip==='cast-one-hand')clip='focus';
 return {...attack,action,clip,frames:ACTIONS[action].frames,overlay:ACTIONS[action].overlay||null,tags:[...attack.tags.filter(t=>t!=='attack'),action,hands]};
}
export function actionForCard(card){
 const tags=(card.tags||[]).map(t=>String(t).toLowerCase().split(':').pop());
 if(String(card.type).toLowerCase()==='attack')return 'attack';
 if(tags.some(t=>['guard','block','shield','parry'].includes(t)))return 'defend';
 return 'cast';
}
// Retained stance belongs to the acting character. It is reset only by that
// character's turn start, not an opponent turn or a temporary hurt reaction.
export function createAnimationState(){return {held:'combat-idle',active:null};}
export function reduceAnimation(state,event){
 if(event.type==='turn-start'&&event.actor==='self')return {held:'combat-idle',active:null};
 if(event.type==='complete')return {...state,active:null};
 if(event.type==='card'){
  const action=actionForCard(event.card),hold=action==='defend'||String(event.card.type).toLowerCase()==='power';
  return {held:hold?(action==='defend'?'guard':'cast'):state.held,active:action};
 }
 if(event.type==='reaction')return {...state,active:event.action};
 return state;
}
