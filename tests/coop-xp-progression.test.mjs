import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState} from '../src/model/state.js';
import {openRunClassMastery,registriesForClassMastery} from '../src/model/classMasteryRun.js';
import {mountCoopXpProgression} from '../src/ui/components/coopXpProgression.js';
import {rewardDom} from './helpers/reward-dom.mjs';
const reg=createRegistries(contentBundle);
function harness(){
  const dom=rewardDom(),previous=Object.fromEntries(Object.keys(dom).map(key=>[key,globalThis[key]]));Object.assign(globalThis,dom);
  let now=0,seq=0;const frames=new Map();globalThis.requestAnimationFrame=callback=>{frames.set(++seq,callback);return seq;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  const host=document.createElement('div');document.body.append(host);
  return {host,advance(ms){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(now));},restore(){for(const[key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}};
}
function member(){
  const run=createRunState({registries:reg,classId:'reaver',seed:3});openRunClassMastery(reg,run,{}, {receiptId:'coop-presentation'});
  run.skills['class:reaver']={level:0,xp:100,pendingDrafts:0};run.level={level:1,xp:300,unspentPoints:0};
  run.skills['item:blade']={level:3,xp:10,pendingDrafts:0};run.skills['item:shield']={level:1,xp:20,pendingDrafts:0};
  return {...run,classId:run.class,pendingLevels:[{skillId:'character',count:1},{skillId:'class:reaver',count:2}],xpProgression:{id:'fight:1',xpBefore:{character:{level:1,xp:0},tracks:{}},xpGains:{level:300,tracks:{'class:reaver':100,'item:shield':20,'item:blade':10}}}};
}
const widths=host=>host.querySelectorAll('.rp-under').map(node=>Number.parseFloat(node.style.width));
test('co-op fills only gained tracks in shared order at normalized velocity, then reveals all buttons together',()=>{
  const h=harness();try{
    const m=member(),ready=[],claims=[],view=mountCoopXpProgression(h.host,{registries:reg,member:m,onClaim:id=>claims.push(id),onReadyChange:value=>ready.push(value),settings:{xpFillSeconds:1}});
    assert.deepEqual(h.host.querySelectorAll('.reward-progress-row').map(row=>row.dataset.track),['class:reaver','character','item:blade','item:shield']);
    assert.equal(view.ready,false);assert.equal(h.host.querySelectorAll('button').length,0);
    h.advance(0);h.advance(250);assert.deepEqual(widths(h.host).slice(0,2),[25,0]);
    view.update(structuredClone(m));h.advance(250);assert.deepEqual(widths(h.host).slice(0,2),[50,0],'equivalent broadcast preserves the running fill');
    h.advance(500);assert.equal(h.host.querySelectorAll('button').length,0,'first full bar stays noninteractive while other bars fill');
    assert.ok(h.host.querySelectorAll('.rp-bar')[0].classList.contains('rp-bar-ready'));
    h.advance(250);assert.deepEqual(widths(h.host).slice(0,2),[100,25],'Character covers the same fraction per second');
    h.advance(3000);assert.equal(view.ready,true);assert.equal(h.host.querySelectorAll('button').length,2);assert.deepEqual(ready,[false,true]);assert.deepEqual(claims,[]);
    const button=h.host.querySelector('button');view.update(structuredClone(m));assert.equal(h.host.querySelector('button'),button,'equivalent snapshots preserve focused button identity');
    view.dispose();assert.equal(h.host.querySelector('.coop-xp-progression'),null);
  }finally{h.restore();}
});

test('host class claims refill only residual and supplemental gains, preserve unrelated full rows, and can be refused safely',()=>{
  const h=harness();try{
    const m=member(),claims=[],view=mountCoopXpProgression(h.host,{registries:reg,member:m,onClaim:id=>claims.push(id),settings:{xpFillSeconds:.01,levelUpRefillSeconds:.4}});
    h.advance(0);h.advance(1000);const beforeCharacter=widths(h.host)[1];
    h.host.querySelector('button[data-track="class:reaver"]').click();assert.deepEqual(claims,['class:reaver']);assert.equal(view.ready,false);assert.equal(h.host.querySelectorAll('button').length,0);
    const updated=structuredClone(m);updated.skills['class:reaver']={level:1,xp:50,pendingDrafts:0};
    updated.skills['item:blade'].xp+=25;updated.xpProgression={id:'class-bonus:1',history:[m.xpProgression],xpBefore:{tracks:{'item:blade':{level:3,xp:10}}},xpGains:{level:0,tracks:{'item:blade':25}}};
    view.update(updated);assert.equal(widths(h.host)[0],0);assert.equal(widths(h.host)[1],beforeCharacter);assert.equal(view.ready,false);
    h.advance(0);h.advance(1000);assert.equal(view.ready,true);assert.equal(widths(h.host)[1],beforeCharacter);
    assert.ok(h.host.querySelectorAll('.rp-gain')[2].textContent.includes('35'),'supplemental payment accumulates exactly once');
    const gain=h.host.querySelectorAll('.rp-gain')[2].textContent;view.update(structuredClone(updated));assert.equal(h.host.querySelectorAll('.rp-gain')[2].textContent,gain);
    h.host.querySelector('button[data-track="class:reaver"]').click();view.rejectClaim('Host refused');assert.equal(view.ready,true);assert.equal(h.host.querySelector('[role="alert"]').textContent,'Host refused');
    view.dispose();
    const reload=mountCoopXpProgression(h.host,{registries:reg,member:structuredClone(updated),onClaim(){},settings:{reducedMotion:true}});
    assert.equal(reload.ready,true);assert.ok(h.host.querySelector('button[data-track="class:reaver"]'),'saved receipt history preserves residual class claims on reload');
    assert.ok(h.host.querySelectorAll('.rp-gain')[2].textContent.includes('35'),'history reconstructs paid gains once');reload.dispose();
  }finally{h.restore();}
});

test('empty gains, standing deferred claims, capped rows and reduced motion never block Continue or auto-claim',()=>{
  const h=harness();try{
    const m=member(),calls=[];m.skills['item:shield']={level:10,xp:999999,pendingDrafts:0};
    const view=mountCoopXpProgression(h.host,{registries:reg,member:m,onClaim:id=>calls.push(id),settings:{reducedMotion:true}});
    assert.equal(view.ready,true);assert.deepEqual(calls,[]);assert.equal(h.host.querySelector('button[data-track="item:shield"]'),null);
    assert.ok(h.host.querySelector('.rp-bar[data-track="item:shield"]').classList.contains('rp-bar-ready'));
    view.dispose();const empty=member();empty.xpProgression={id:'empty',xpGains:{level:0,tracks:{}}};
    const blank=mountCoopXpProgression(h.host,{registries:reg,member:empty,onClaim(){}});assert.equal(blank.ready,true);assert.equal(h.host.querySelectorAll('.reward-progress-row').length,0);blank.dispose();
    const standing=member();delete standing.xpProgression;const deferred=mountCoopXpProgression(h.host,{registries:reg,member:standing,onClaim(){}});
    assert.equal(deferred.ready,true);assert.deepEqual(h.host.querySelectorAll('.reward-progress-row').map(row=>row.dataset.track),['class:reaver','character']);deferred.dispose();
  }finally{h.restore();}
});
