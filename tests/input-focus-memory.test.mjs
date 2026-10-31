import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/ui/input.js',import.meta.url),'utf8');
// Run the production restoration/eligibility functions with counted layout
// reads; stale focus keys must not measure unrelated combat controls.
const functions=source.slice(source.indexOf('function visible(el) {'),source.indexOf('\nfunction setFocus('));
function control(key,{hidden=false,inert=false,chrome=false,flask=false}={}){
 return {dataset:{instanceId:key},isConnected:true,reads:0,
  getBoundingClientRect(){this.reads++;return{width:20,height:20};},
  closest(selector){return selector.includes('[inert]')?inert:chrome;},
  matches(){return flask;},hidden};
}
function fixture(controls,{modal=null,tooltip=[]}={}){
 const app={id:'app',querySelectorAll:()=>controls,classList:{contains:()=>false}};
 const document={getElementById:()=>app,body:app,querySelectorAll:()=>tooltip};
 return runInNewContext(functions+'\n({keyOf,findByKey,focusables})',{
  document,topVeil:()=>modal,FOCUS_SELECTOR:'controls',CHROME:'chrome',
  getComputedStyle:el=>({visibility:el.hidden?'hidden':'visible',display:'block'}),
 });
}

test('stale focus memory never forces layout for unrelated controls',()=>{
 const controls=Array.from({length:100},(_,i)=>control(`card-${i}`));
 const f=fixture(controls);
 assert.equal(f.findByKey('i:removed-card'),null);
 assert.ok(controls.every(el=>el.reads===0));
 assert.equal(f.findByKey('i:card-53'),controls[53]);
 assert.equal(controls[53].reads,1);
 assert.ok(controls.every((el,i)=>i===53||el.reads===0));
 assert.equal(f.focusables().length,100,'ordinary navigation still checks every eligible control');
});

test('matching keys retain visibility, inert, chrome exclusions and first eligible order',()=>{
 const hidden=control('same',{hidden:true}),inert=control('same',{inert:true}),chrome=control('same',{chrome:true});
 const first=control('same'),second=control('same'),unrelated=control('other');
 const f=fixture([hidden,inert,chrome,first,second,unrelated]);
 assert.equal(f.findByKey('i:same'),first);
 assert.equal(inert.reads,0,'inert controls stay excluded before layout');
 assert.equal(unrelated.reads,0);
 assert.equal(f.findByKey(''),null);
 const flask=control('flask',{chrome:true,flask:true});
 assert.equal(fixture([flask]).findByKey('i:flask'),flask,'the existing flask chrome exception survives');
});

test('restoration stays in the top veil and retains tooltip-dialog eligibility on the app',()=>{
 const appControl=control('same'),modalControl=control('same',{chrome:true});
 const modal={id:'veil',querySelectorAll:()=>[modalControl],classList:{contains:()=>true}};
 assert.equal(fixture([appControl],{modal}).findByKey('i:same'),modalControl);
 assert.equal(appControl.reads,0,'an open veil never measures or restores app controls');
 const tooltipControl=control('tooltip');
 assert.equal(fixture([appControl],{tooltip:[tooltipControl]}).findByKey('i:tooltip'),tooltipControl);
 assert.equal(appControl.reads,0);
});


test('a remounted flask keeps focus by kind when its charge count changes',()=>{
 const before=control('',{chrome:true,flask:true});
 before.dataset.flaskKind='hp'; before.textContent='3';
 const key=fixture([before]).keyOf(before);
 const other=control('',{chrome:true,flask:true});
 other.dataset.flaskKind='mp'; other.textContent='3';
 const after=control('',{chrome:true,flask:true});
 after.dataset.flaskKind='hp'; after.textContent='2';
 assert.equal(fixture([other,after]).findByKey(key),after);
 assert.equal(other.reads,0,'the old count never selects or measures another flask');
 after.textContent='0';
 assert.equal(fixture([other,after]).keyOf(after),key,'identity is independent of charges');
});
