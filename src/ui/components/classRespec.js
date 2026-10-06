import {button,el,openModal,prose,statusText} from '../kit/index.js';
import {markUiComponent,UI_COMPONENTS as UI} from './uiComponents.js';
import {renderCard} from './card.js';
import {createClassRespecDraft,classRespecView,previewClassRespec} from '../../model/classRespec.js';

const KIND={cards:'Cards',feat:'Feats',armory:'Equipment',relic:'Relics',attribute:'Attributes'};
const choiceKey=choice=>`${choice.id}${Number.isInteger(choice.abilityRank)?'@'+choice.abilityRank:''}`;
export function classRespecOptionName(registries,kind,id,rank = null){
  let name=id;
  if(kind==='cards')name=registries.cards.get(id)?.name || id;
  else if(kind==='relic')name=registries.relics.get(id)?.name || id;
  else if(kind==='feat')name=registries.classSkillFeats.find(row=>row.id===id)?.name || id;
  else if(kind==='attribute')name=registries.attributes.get(id)?.name || id[0].toUpperCase()+id.slice(1);
  else if(kind==='armory'){
    const source=registries.masterySource || registries;
    name=id.startsWith('armament/')?source.equipment.armaments.find(row=>row.id===id.slice(9))?.name:source.equipment.armour.find(row=>`armor/${row.classId}/${row.id}`===id)?.name;
  }
  return `${name || id}${Number.isInteger(rank)?` · Rank ${rank}`:''}`;
}
let active=null;
export const isClassRespecOpen=()=>Boolean(active);
export function closeClassRespec({silent=false}={}){
  if(!active)return;
  active.silent=silent;active.shell.close();active=null;
}
// The same Modal, controls and review serve solo and host-owned co-op forms.
// Local edits are drafts; confirmation invokes the save owner once.
export function mountClassRespec({registries,run=null,meta={},view=null,onApply,onPreview=null,onCancel=null,onClose=null,opener=document.activeElement,host=document.body}={}){
  closeClassRespec({silent:true});
  const draft=view?null:createClassRespecDraft(registries,run,{meta});
  if(draft&&!draft.ok)throw new Error(draft.reason);
  let state=view || classRespecView(registries,run,draft),review=false,selections=structuredClone(state.selections),treeNodes=[...state.treeNodes];
  let body,shell,record;
  const cancel=button({label:'Cancel',role:'exit'}),confirm=button({label:'Review changes',weight:'primary'});
  const label=(kind,id,rank=null)=>classRespecOptionName(registries,kind,id,rank);
  const refresh=()=>{
    if(onPreview){confirm.disabled=true;onPreview({selections,treeNodes});return;}
    state=classRespecView(registries,run,draft,{selections,treeNodes});render();
  };
  const render=()=>{
    const focused=document.activeElement?.id;
    body.replaceChildren();
    const budgets=Object.entries(state.draft.budgets).map(([kind,count])=>`${count} ${KIND[kind].toLowerCase()}`).join(' · ');
    body.append(prose(`${budgets}. Tree points: ${treeNodes.length}/${state.draft.treeBudget}.`));
    body.append(prose(`Cost: ${state.draft.cost.label}. Spent rewards remain spent. Current HP, Mana, Actions and flask charges are preserved.`));
    if(review){
      const list=el('ul',{class:'class-respec-changes'});
      for(const change of state.preview.changes)if(change.before!==change.after)list.append(el('li',{text:`${KIND[change.kind]}: ${change.before==='Unassigned'?'Unassigned':label(change.kind,change.before)} → ${label(change.kind,change.after,change.abilityRank)}`}));
      list.append(el('li',{text:`Class tree: ${treeNodes.length} selected points; ${state.draft.treeBudget-treeNodes.length} remain available.`}));
      const treeLabel=ids=>ids.map(id=>state.treeOptions.find(node=>node.nodeId===id)?.label || id).join(', ') || 'Unassigned';
      if(JSON.stringify(state.draft.treeBefore)!==JSON.stringify(treeNodes))list.append(el('li',{text:`Tree choices: ${treeLabel(state.draft.treeBefore || [])} → ${treeLabel(treeNodes)}`}));
      for(const displaced of state.preview.displaced)list.append(el('li',{text:`${label('armory',displaced.ref)} → ${displaced.destination}`}));
      for(const transfer of state.preview.transfers)list.append(el('li',{text:`Retain upgrades and components: ${transfer.from} → ${transfer.to}${transfer.tier?` · Tier ${transfer.tier}`:''}`}));
      body.append(el('h3',{text:'Before → After'}),list);
      const back=button({label:'Edit choices'});back.addEventListener('click',()=>{review=false;render();});body.append(back);
    }else{
      const tree=el('fieldset',{class:'class-respec-tree'},el('legend',{text:'Class tree'}));
      for(const node of state.treeOptions){const input=el('input',{type:'checkbox',id:`respec-tree-${node.nodeId}`,checked:treeNodes.includes(node.nodeId)});
        input.addEventListener('change',()=>{treeNodes=input.checked?[...treeNodes,node.nodeId]:treeNodes.filter(id=>id!==node.nodeId);refresh();});
        tree.append(el('label',{for:input.id},[input,el('span',{text:`Tier ${node.tier} · ${node.label}`})]));
      }
      body.append(tree);
      for(const [kind,title] of Object.entries(KIND)){
        const fieldset=el('fieldset',{class:'class-respec-slots'},el('legend',{text:title}));
        for(const slot of state.draft.slots.filter(slot=>slot.kind===kind)){
          const current=slot.before?label(kind,slot.before.id,slot.before.abilityRank):'Unassigned';
          if(slot.state==='spent'){fieldset.append(statusText(`Level ${slot.level} · ${current} · Spent`));continue;}
          const id=`respec-${slot.receiptId.replace(/[^a-z0-9]/gi,'-')}`,select=el('select',{id,'aria-label':`${title} earned at level ${slot.level}`});
          const options=state.options[slot.receiptId] || [];
          select.append(el('option',{value:'',text:'Keep unassigned'}));
          for(const choice of options)select.append(el('option',{value:choiceKey(choice),text:label(kind,choice.id,choice.abilityRank)}));
          select.value=selections[slot.receiptId]?choiceKey(selections[slot.receiptId]):'';
          select.addEventListener('change',()=>{const selected=options.find(choice=>choiceKey(choice)===select.value);if(selected)selections[slot.receiptId]={...selected,transfer:'retain'};else delete selections[slot.receiptId];refresh();});
          fieldset.append(el('label',{for:id},[el('span',{text:`Level ${slot.level} · ${current} →`}),select]));
          const selected=selections[slot.receiptId];
          if(kind==='feat' && selected){const description=registries.classSkillFeats.find(row=>row.id===selected.id)?.description;if(description)fieldset.append(prose(description));}
          if(kind==='cards' && selected){
            const detail=el('details',{},el('summary',{text:`Inspect ${label(kind,selected.id,selected.abilityRank)}`}));
            detail.addEventListener('toggle',()=>{if(detail.open && detail.childElementCount===1)detail.append(renderCard(registries,{cardId:selected.id,upgraded:false,...(Number.isInteger(selected.abilityRank)?{abilityRank:selected.abilityRank}:{})},{tooltip:false}));});
            fieldset.append(detail);
          }
        }
        if(fieldset.childElementCount>1)body.append(fieldset);
      }
      body.append(prose('Exchanged cards keep their instance and earned rank. Compatible item upgrades, mounted cards and sigils transfer together; incompatible transfers require a different selection.'));
    }
    if(state.preview.problems?.length)body.append(el('div',{role:'status','aria-live':'polite',class:'class-respec-problems'},state.preview.problems.map(problem=>prose(problem))));
    confirm.disabled=!state.preview.ok;confirm.textContent=review?`Apply · ${state.draft.cost.label}`:'Review changes';
    if(focused){const next=document.getElementById(focused);if(next && body.contains(next))next.focus();}
  };
  cancel.addEventListener('click',()=>shell.close());
  confirm.addEventListener('click',()=>{
    if(!review){review=true;render();confirm.focus();return;}
    const preview=draft?previewClassRespec(registries,run,draft,{selections,treeNodes}):{...state.preview,selections,treeNodes};
    confirm.disabled=true;
    const result=onApply?.(preview);
    if(result?.ok){record.silent=true;shell.close();onClose?.();}
    else if(result?.reason){state.preview={...state.preview,ok:false,problems:[result.reason]};render();}
  });
  shell=openModal({size:'xl',title:'Respec class',eyebrow:`${registries.classes.get(state.draft.classId).name} · Mastery ${state.draft.level}`,body:node=>{body=node;render();},bodyClassName:'class-respec-body',secondary:[cancel],primary:confirm,opener,host,
    onClose:()=>{if(!record?.silent){onCancel?.();onClose?.();}active=null;}});
  record={shell,silent:false};active=record;
  markUiComponent(shell.panel,UI.classRespec);
  return shell;
}
