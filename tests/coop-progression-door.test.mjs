import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState} from '../src/model/state.js';
import {openRunClassMastery} from '../src/model/classMasteryRun.js';
import {mountCoopProgressionDoor,gateCoopProgressionControls} from '../src/ui/components/coopProgressionDoor.js';
import {rewardDom} from './helpers/reward-dom.mjs';

const registries=createRegistries(contentBundle);
function fixture(){
  const dom=rewardDom(),before=Object.fromEntries(Object.keys(dom).map(key=>[key,globalThis[key]]));Object.assign(globalThis,dom);
  const savedFrames=[globalThis.requestAnimationFrame,globalThis.cancelAnimationFrame];
  let now=0,sequence=0;const frames=new Map();globalThis.requestAnimationFrame=fn=>{frames.set(++sequence,fn);return sequence;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  const host=document.createElement('div');document.body.append(host);
  const run=createRunState({registries,classId:'reaver',seed:17});openRunClassMastery(registries,run,{}, {receiptId:'door'});
  run.skills['class:reaver']={level:0,xp:100,pendingDrafts:0};
  const member={...run,classId:run.class,pendingLevels:[{skillId:'class:reaver',count:2}],pendingProgression:{skillDrafts:[{offerId:'ability:combatManeuvers:1',level:1}]},xpProgression:{id:'victory:1',xpBefore:{tracks:{'class:reaver':{level:0,xp:0}}},xpGains:{level:0,tracks:{'class:reaver':100}}}};
  return {host,member,advance(ms){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));},restore(){for(const[key,value]of Object.entries(before)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}[globalThis.requestAnimationFrame,globalThis.cancelAnimationFrame]=savedFrames;}};
}

test('manual host claim shows only newly funded choices and waits for popup close before residual and class-bonus refill',()=>{
  const f=fixture();let popup,updates=[],closeCount=0;
  try{
    const before=structuredClone(f.member),claims=[];
    const view=mountCoopProgressionDoor(f.host,{registries,member:f.member,onClaim:id=>claims.push(id),settings:{xpFillSeconds:.1,levelUpRefillSeconds:1},onChoices:(rows,resume)=>{popup={rows,resume};return {update:rows=>updates.push(rows),close:()=>closeCount++};}});
    f.advance(0);f.advance(1000);assert.equal(view.ready,true);
    f.host.querySelector('button[data-track="class:reaver"]').click();assert.equal(view.ready,false);assert.deepEqual(claims,['class:reaver']);
    const next=structuredClone(f.member);next.skills['class:reaver']={level:1,xp:50,pendingDrafts:0};next.skills['item:blade']={level:0,xp:25,pendingDrafts:0};
    next.pendingProgression.classMilestoneRewards=[{receiptId:'class:reaver:1:feat',level:1,rewardKind:'feat',options:['test-feat']}];
    next.xpProgression={id:'class-bonus:1',xpBefore:{tracks:{'item:blade':{level:0,xp:0}}},xpGains:{level:0,tracks:{'item:blade':25}}};
    view.update(next);assert.equal(view.choosing,true);assert.deepEqual(popup.rows.map(row=>row.key),['class:reaver:1:feat']);
    assert.equal(f.host.querySelector('.rp-under').style.width,'100%','old full bar remains while new choices are open');
    f.advance(2000);assert.equal(view.ready,false);assert.equal(f.host.querySelector('.rp-under').style.width,'100%');
    const taken=structuredClone(next);taken.pendingProgression.classMilestoneRewards=[];view.update(taken);assert.deepEqual(updates.at(-1),[]);
    popup.resume();assert.equal(view.choosing,false);assert.equal(closeCount,1);assert.equal(f.host.querySelector('.rp-under').style.width,'0%');
    assert.equal(view.ready,false);f.advance(0);f.advance(2000);assert.equal(view.ready,true);
    assert.ok(f.host.querySelector('[data-track="item:blade"]'));assert.deepEqual(f.member,before,'presentation never changes XP or claim receipts');
    view.dispose();
  }finally{f.restore();}
});

test('refused host claims and later unrelated snapshots cannot open a stale reward popup',()=>{
  const f=fixture();let opened=0;
  try{
    const view=mountCoopProgressionDoor(f.host,{registries,member:f.member,onClaim:()=>undefined,onChoices:()=>{opened++;},settings:{reducedMotion:true}});
    f.host.querySelector('button').click();view.rejectClaim('Host save failed');assert.equal(view.ready,true);
    const next=structuredClone(f.member);next.skills['class:reaver'].level=1;next.pendingProgression.classMilestoneRewards=[{receiptId:'independent',level:1}];view.update(next);
    assert.equal(opened,0);assert.equal(view.ready,true);view.dispose();
  }finally{f.restore();}
});

test('XP gate disables all reward paths and restores original affordability with a green Continue',()=>{
  const f=fixture();try{
    const continueButton=document.createElement('button');continueButton.dataset.take='skip';
    const affordable=document.createElement('button');affordable.className='coop-progression-choice';
    const denied=document.createElement('button');denied.dataset.cu='relic';denied.disabled=true;denied.setAttribute('aria-disabled','true');
    const row=document.createElement('div');row.className='reward-row';const card=document.createElement('div');card.className='card';row.append(card);f.host.append(continueButton,affordable,denied,row);
    gateCoopProgressionControls(f.host,false);assert.equal(continueButton.disabled,true);assert.equal(affordable.disabled,true);assert.equal(card.getAttribute('aria-disabled'),'true');
    gateCoopProgressionControls(f.host,true);assert.equal(continueButton.disabled,false);assert.equal(continueButton.classList.contains('primary'),true);assert.equal(continueButton.dataset.confirmReady,'true');assert.equal(affordable.disabled,false);assert.equal(denied.disabled,true);assert.equal(card.getAttribute('aria-disabled'),'false');
  }finally{f.restore();}
});
