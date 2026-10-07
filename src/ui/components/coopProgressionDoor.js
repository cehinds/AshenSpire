import {mountCoopXpProgression} from './coopXpProgression.js';

const rowsOf=member=>{
  const progression=member.pendingProgression || {};
  return ['skillDrafts','classMilestoneRewards','levelCards'].flatMap(kind=>(progression[kind] || []).map(row=>({kind,row,key:row.offerId || row.receiptId || row.key})));
};
const levelOf=(member,id)=>id==='character'?member.level?.level:member.skills?.[id]?.level;

/** Keeps a host-owned level claim and its choice popup ahead of residual XP. */
export function mountCoopProgressionDoor(host,{registries,member,onClaim,onReadyChange=()=>{},onChoices,settings}){
  let current=member,claim=null,popup=null,disposed=false;
  const presentation=mountCoopXpProgression(host,{registries,member,settings,onReadyChange,onClaim:id=>{
    claim={id,level:levelOf(current,id),existing:new Set(rowsOf(current).map(row=>row.key))};
    try{const result=onClaim(id);if(result===false)claim=null;return result;}catch(error){claim=null;throw error;}
  }});
  function resume(){
    if(disposed||!popup)return;
    const old=popup;popup=null;old?.close?.();presentation.update(current);
  }
  function update(next){
    if(disposed)return;current=next;
    if(popup){popup.update?.(rowsOf(current).filter(row=>popup.keys.has(row.key)));return;}
    if(claim&&levelOf(current,claim.id)!==claim.level){
      const choices=rowsOf(current).filter(row=>!claim.existing.has(row.key));claim=null;
      if(choices.length&&onChoices){
        // Leave the presenter waiting at its old level until the player
        // closes the funded-choice dialog. No snapshot can replay this claim.
        popup={keys:new Set(choices.map(row=>row.key))};
        const view=onChoices(choices,resume) || {};
        if(popup)Object.assign(popup,view);
        return;
      }
    }
    presentation.update(current);
  }
  function rejectClaim(reason){claim=null;popup?.rejectClaim?.(reason);presentation.rejectClaim(reason);}
  return {update,rejectClaim,get ready(){return presentation.ready&&!popup;},get choosing(){return !!popup;},dispose(){disposed=true;popup?.close?.();popup=null;presentation.dispose();}};
}

/** Preserve original affordability while the shared XP gate owns activation. */
export function gateCoopProgressionControls(host,ready){
  for(const control of host.querySelectorAll('[data-take], [data-cu], [data-cu-go], [data-cu-ev], .coop-progression-choice, .reward-row .card')){
    if(control.dataset.xpOriginalDisabled===undefined)control.dataset.xpOriginalDisabled=String(!!control.disabled||control.getAttribute('aria-disabled')==='true');
    const disabled=!ready||control.dataset.xpOriginalDisabled==='true';
    if('disabled' in control)control.disabled=disabled;
    control.setAttribute('aria-disabled',String(disabled));
    if(control.dataset.take==='skip'||control.dataset.cu==='skip'){
      control.classList.toggle('primary',ready);control.dataset.confirmReady=String(ready);
    }
  }
}
