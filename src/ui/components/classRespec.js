import {t} from '../strings.js';
import {button,el,openModal,prose,statusText} from '../kit/index.js';
import {markUiComponent,UI_COMPONENTS as UI} from './uiComponents.js';
import {renderCard} from './card.js';
import {createClassRespecDraft,classRespecView,previewClassRespec} from '../../model/classRespec.js';
import {getFeatDescription} from '../../model/classSkillFeatDescription.js';

const KIND={cards:t('armoury.tab.cards'),feat:t('classRespec.kind.feat'),armory:t('classRespec.kind.armory'),relic:t('classRespec.kind.relic'),attribute:t('classRespec.kind.attribute')};
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
  return `${name || id}${Number.isInteger(rank)?t('classRespec.rankSuffix',{rank}):''}`;
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
  const cancel=button({label:t('common.cancel'),role:'exit'}),confirm=button({label:t('classRespec.review'),weight:'primary'});
  const label=(kind,id,rank=null)=>classRespecOptionName(registries,kind,id,rank);
  const refresh=()=>{
    if(onPreview){confirm.disabled=true;onPreview({selections,treeNodes});return;}
    state=classRespecView(registries,run,draft,{selections,treeNodes});render();
  };
  const render=()=>{
    const focused=document.activeElement?.id;
    body.replaceChildren();
    const budgets=Object.entries(state.draft.budgets).map(([kind,count])=>`${count} ${KIND[kind].toLowerCase()}`).join(' · ');
    body.append(prose(t('classRespec.budgets',{budgets,chosen:treeNodes.length,total:state.draft.treeBudget})));
    body.append(prose(t('classRespec.cost',{cost:state.draft.cost.label})));
    if(review){
      const list=el('ul',{class:'class-respec-changes'});
      for(const change of state.preview.changes)if(change.before!==change.after)list.append(el('li',{text:`${KIND[change.kind]}: ${change.before==='Unassigned'?t('classRespec.unassigned'):label(change.kind,change.before)} → ${label(change.kind,change.after,change.abilityRank)}`}));
      list.append(el('li',{text:t('classRespec.treeSummary',{chosen:treeNodes.length,remaining:state.draft.treeBudget-treeNodes.length})}));
      const treeLabel=ids=>ids.map(id=>state.treeOptions.find(node=>node.nodeId===id)?.label || id).join(', ') || t('classRespec.unassigned');
      if(JSON.stringify(state.draft.treeBefore)!==JSON.stringify(treeNodes))list.append(el('li',{text:t('classRespec.treeChanges',{before:treeLabel(state.draft.treeBefore || []),after:treeLabel(treeNodes)})}));
      for(const displaced of state.preview.displaced)list.append(el('li',{text:`${label('armory',displaced.ref)} → ${displaced.destination}`}));
      for(const slot of state.draft.slots){const selected=selections[slot.receiptId],retained=(state.options[slot.receiptId] || []).find(choice=>choice.retainInSideboard&&selected&&choiceKey(choice)===choiceKey(selected));if(retained)list.append(el('li',{text:t('classRespec.retainedCard',{name:label('cards',retained.id,retained.abilityRank)})}));}
      for(const transfer of state.preview.transfers)list.append(el('li',{text:t('classRespec.transfer',{from:transfer.from,to:transfer.to,tier:transfer.tier?t('classRespec.tierSuffix',{tier:transfer.tier}):''})}));
      body.append(el('h3',{text:t('classRespec.beforeAfter')}),list);
      const back=button({label:t('classRespec.edit')});back.addEventListener('click',()=>{review=false;render();});body.append(back);
    }else{
      const tree=el('fieldset',{class:'class-respec-tree'},el('legend',{text:t('classRespec.tree')}));
      for(const node of state.treeOptions){const input=el('input',{type:'checkbox',id:`respec-tree-${node.nodeId}`,checked:treeNodes.includes(node.nodeId)});
        input.addEventListener('change',()=>{treeNodes=input.checked?[...treeNodes,node.nodeId]:treeNodes.filter(id=>id!==node.nodeId);refresh();});
        tree.append(el('label',{for:input.id},[input,el('span',{text:t('classRespec.tierChoice',{tier:node.tier,name:node.label})})]));
      }
      body.append(tree);
      for(const [kind,title] of Object.entries(KIND)){
        const fieldset=el('fieldset',{class:'class-respec-slots'},el('legend',{text:title}));
        for(const slot of state.draft.slots.filter(slot=>slot.kind===kind)){
          const current=slot.before?label(kind,slot.before.id,slot.before.abilityRank):t('classRespec.unassigned');
          if(slot.state==='spent'){fieldset.append(statusText(t('classRespec.spent',{level:slot.level,name:current})));continue;}
          const id=`respec-${slot.receiptId.replace(/[^a-z0-9]/gi,'-')}`,select=el('select',{id,'aria-label':t('classRespec.slotAria',{kind:title,level:slot.level})});
          const options=state.options[slot.receiptId] || [];
          select.append(el('option',{value:'',text:t('classRespec.keep')}));
          for(const choice of options)select.append(el('option',{value:choiceKey(choice),text:`${label(kind,choice.id,choice.abilityRank)}${choice.retainInSideboard?t('classRespec.retainedSuffix'):''}`}));
          select.value=selections[slot.receiptId]?choiceKey(selections[slot.receiptId]):'';
          select.addEventListener('change',()=>{const selected=options.find(choice=>choiceKey(choice)===select.value);if(selected)selections[slot.receiptId]={...selected,transfer:'retain'};else delete selections[slot.receiptId];refresh();});
          fieldset.append(el('label',{for:id},[el('span',{text:t('classRespec.slotLabel',{level:slot.level,name:current})}),select]));
          const selected=selections[slot.receiptId];
          if(kind==='feat' && selected){const description=getFeatDescription(registries,selected.id);if(description)fieldset.append(prose(description));}
          if(kind==='cards' && selected){
            const detail=el('details',{},el('summary',{text:t('deckEditor.inspectNamed', {name:label(kind,selected.id,selected.abilityRank)})}));
            detail.addEventListener('toggle',()=>{if(detail.open && detail.childElementCount===1)detail.append(renderCard(registries,{cardId:selected.id,upgraded:false,...(Number.isInteger(selected.abilityRank)?{abilityRank:selected.abilityRank}:{})},{tooltip:false}));});
            fieldset.append(detail);
          }
        }
        if(fieldset.childElementCount>1)body.append(fieldset);
      }
      body.append(prose(t('classRespec.preservation')));
    }
    if(state.preview.problems?.length)body.append(el('div',{role:'status','aria-live':'polite',class:'class-respec-problems'},state.preview.problems.map(problem=>prose(problem))));
    confirm.disabled=!state.preview.ok;confirm.textContent=review?t('classRespec.apply',{cost:state.draft.cost.label}):t('classRespec.review');
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
  shell=openModal({size:'xl',title:t('classRespec.title'),eyebrow:t('classRespec.eyebrow',{class:registries.classes.get(state.draft.classId).name,level:state.draft.level}),body:node=>{body=node;render();},bodyClassName:'class-respec-body',secondary:[cancel],primary:confirm,opener,host,
    onClose:()=>{if(!record?.silent){onCancel?.();onClose?.();}active=null;}});
  record={shell,silent:false};active=record;
  markUiComponent(shell.panel,UI.classRespec);
  return shell;
}
