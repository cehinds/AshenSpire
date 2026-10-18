import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileBindings, evaluateModifiers, validateModifiers } from '../engine/runtime/bindings.mjs';
import { createRuntime, loadMechanics, loadOps, runCases } from '../engine/runtime/interpreter.mjs';
import { createRuntime as browserRuntime } from '../engine/runtime/evaluator.mjs';
const mechanics = loadMechanics();
const ward = 'defense.wardProtection', tag = 'defense:wardProtection';
const attachment = (extra = {}) => ({ ownerId: 'target', sourceInstanceId: 'armor-a', kind: 'gear', tags: [tag], ...extra });
const calculate = (bindings, extra = {}) => evaluateModifiers({ bindings, phase: 'damage.mitigation', subjectId: 'target', context: { owner: { persistentWard: { value: 1 } }, damageKind: 'magical' }, amount: 20, quantity: true, ...extra });

test('authored percentage mechanics execute their JSON conformance cases', () => {
  for (const id of [ward, 'defense.poiseProtection']) for (const row of runCases(mechanics.get(id), createRuntime({mechanics}))) assert.equal(row.ok, true, `${id}/${row.name}: ${row.error}`);
});
test('binding parameters are immutable, independently scoped, and layered', () => {
  const bindings = compileBindings({mechanics, moduleParameters:{[ward]:{multiplier:0.8}}, attachments:[attachment(),attachment({sourceInstanceId:'armor-b', mechanicBindings:[{tag,parameters:{multiplier:0.7},upgradeParameters:{multiplier:0.6}}]})]});
  assert.deepEqual(bindings.map(b=>b.config.multiplier),[0.8,0.6]);
  assert.throws(()=>{bindings[0].config.multiplier=0;},TypeError);
  assert.equal(calculate(bindings).amount,12);
  assert.equal(calculate([bindings[0]]).amount,16);
  assert.notEqual(bindings[0].id,bindings[1].id);
});
test('module disable, source unmount, explicit disable and missing behavior tag remove activation', () => {
  for(const opts of [{attachments:[]},{attachments:[attachment({active:false})]},{attachments:[attachment({mechanicBindings:[{tag,enabled:false}]})]},{attachments:[attachment()],enabledMechanics:new Set()},{attachments:[attachment({tags:['fx:ward']})]}]) assert.equal(calculate(compileBindings({mechanics,...opts})).amount,20);
});
test('target scope, active pool and damage selector prevent unrelated mitigation', () => {
  const bindings=compileBindings({mechanics,attachments:[attachment()]});
  assert.equal(calculate(bindings,{subjectId:'other'}).amount,20);
  assert.equal(calculate(bindings,{context:{owner:{persistentWard:{value:0}},damageKind:'magical'}}).amount,20);
  assert.equal(calculate(bindings,{context:{owner:{persistentWard:{value:1}},damageKind:'physical'}}).amount,20);
  assert.equal(calculate(bindings).amount,15);
});
test('JSON tuning changes the same receipt and scalar formulas retain fractions',()=>{
  const copies=structuredClone(mechanics); copies.get(ward).manifest.parameters.properties.multiplier.default=0.6;
  const bindings=compileBindings({mechanics:copies,attachments:[attachment()]});
  const receipt=calculate(bindings);assert.equal(receipt.amount,12);assert.equal(receipt.sources[0].value,0.6);assert.equal(receipt.sources[0].effective,12);assert.equal(receipt.sources[0].sourceInstanceId,'armor-a');
  const fractional=structuredClone(mechanics);fractional.get(ward).service.modifiers[0].value={f:'mul',args:[0.75,1]};
  const result=calculate(compileBindings({mechanics:fractional,attachments:[attachment()]}),{amount:3});
  assert.equal(result.unrounded,2.25);assert.equal(result.amount,2);assert.equal(result.rounding,-0.25);
});
test('bad parameters, duplicate sources, unknown behavior bindings and invalid kinds fail with paths',()=>{
  for(const [source,match] of [
    [attachment({mechanicBindings:[{tag,parameters:{mulitplier:0.6}}]}),/attachments\[0\].*mulitplier/],
    [attachment({mechanicBindings:[{tag,parameters:{multiplier:Infinity}}]}),/finite number/],
    [attachment({mechanicBindings:[{tag,parameters:{multiplier:1.1}}]}),/<= 1/],
    [attachment({mechanicBindings:[{tag:'defense:typo'}]}),/unknown behavior tag/],
    [attachment({mechanicBindings:[{tag},{tag}]}),/duplicate binding/],
    [attachment({kind:'map'}),/cannot attach/],
  ])assert.throws(()=>compileBindings({mechanics,attachments:[source]}),match);
  assert.throws(()=>compileBindings({mechanics,attachments:[attachment(),attachment()]}),/duplicate attachment/);
});
test('modifier dependencies, unknown operation and stacking policy fail explicitly',()=>{
  const row=mechanics.get(ward).service.modifiers[0];
  assert.throws(()=>validateModifiers([{...row,operation:'multiplyTypo'}]),/unknown operation/);
  assert.throws(()=>validateModifiers([{...row,after:[row.id]}]),/dependency cycle/);
  assert.throws(()=>validateModifiers([{...row,after:['missing']}]),/unknown modifier dependency/);
  assert.throws(()=>validateModifiers([{...row,ignoredParameter:1}]),/unknown modifier field/);
});
test('scoped events isolate instance state and gate each owner/source once per round',()=>{
  const id='counter',t='test:counter';
  const m={manifest:{id,tag:t,attaches:['gear'],portability:'portable',parameters:{type:'object',properties:{amount:{type:'number',default:1}},required:['amount']}},model:{},interface:{},service:{handlers:[{id:'tick',on:'event.tick',oncePer:'round',do:[{set:'last',value:'$config.amount'},{op:'block',target:'$owner',amount:'$config.amount'}]}]}};
  const registry=new Map([[id,m]]), attachments=[attachment({tags:[t],mechanicBindings:[{tag:t,parameters:{amount:2}}]}),attachment({ownerId:'other',tags:[t]})];
  const bindings=compileBindings({mechanics:registry,attachments});
  const runtime=createRuntime({mechanics:registry,bindings});
  const state={entities:{target:{hp:10},other:{hp:10}}};
  const first=runtime.emit(state,'tick',{ownerId:'target',roundId:1});
  assert.equal(first.state.entities.target.block,2);assert.equal(first.state.entities.other.block,0);
  assert.equal(first.state.bindingState[bindings.find(b=>b.ownerId==='target').id].last,2);
  const again=runtime.emit(first.state,'tick',{ownerId:'target',roundId:1});assert.equal(again.state.entities.target.block,2);
  const other=runtime.emit(again.state,'tick',{ownerId:'other',roundId:1});assert.equal(other.state.entities.other.block,1);
  const restored=runtime.emit(JSON.parse(JSON.stringify(other.state)),'tick',{ownerId:'target',roundId:2});assert.equal(restored.state.entities.target.block,4);
  assert.throws(()=>runtime.emit({...state,bindingStateVersion:2},'tick',{}),/Unsupported binding state version/);
});
test('browser runtime requires injected catalog and keeps legacy quantity formulas compatible',()=>{
  const m={manifest:{id:'q'},model:{},interface:{queries:{scalar:{value:{f:'mul',args:[0.75,1],numeric:'scalar'}},quantity:{value:{f:'mul',args:[0.75,1]}}}},service:{handlers:[]}};
  const registry=new Map([['q',m]]);assert.throws(()=>browserRuntime({mechanics:registry}),/compiled op catalog/);
  const runtime=browserRuntime({mechanics:registry,ops:loadOps()});assert.equal(runtime.query({},'q.scalar'),0.75);assert.equal(runtime.query({},'q.quantity'),0);
  for(const file of ['evaluator.mjs','bindings.mjs'])assert.doesNotMatch(readFileSync(new URL('../engine/runtime/'+file,import.meta.url),'utf8'),/from ['"]node:/);
});

test('browser generation detects canonical JSON tuning drift and regenerates it',async()=>{
  const {mkdtempSync,cpSync,writeFileSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const {compileBrowserMechanics}=await import('../tools/mechanics-browser.mjs');
  const root=mkdtempSync(join(tmpdir(),'mechanic-generation-'));
  try {
    cpSync(new URL('../engine/mechanics/'+ward,import.meta.url),join(root,ward),{recursive:true});
    const outputFile=join(root,'browser.js');
    assert.equal(compileBrowserMechanics({rootDir:root,outputFile}),true);
    assert.equal(compileBrowserMechanics({rootDir:root,outputFile,check:true}),false);
    const manifest=join(root,ward,'mechanic.json'),changed=JSON.parse(readFileSync(manifest));
    changed.parameters.properties.multiplier.default=0.6;writeFileSync(manifest,JSON.stringify(changed));
    assert.throws(()=>compileBrowserMechanics({rootDir:root,outputFile,check:true}),/is stale/);
    compileBrowserMechanics({rootDir:root,outputFile});assert.match(readFileSync(outputFile,'utf8'),/"default": 0.6/);
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('owner-subject modifiers apply only to the explicitly queried owner',()=>{
  const registry=structuredClone(mechanics);registry.get(ward).service.modifiers[0].subject='owner';
  const bindings=compileBindings({mechanics:registry,attachments:[attachment({ownerId:'someone-else'})]});
  assert.equal(calculate(bindings).amount,20);
  assert.equal(calculate(bindings,{context:{ownerId:'someone-else',owner:{persistentWard:{value:1}},damageKind:'magical'}}).amount,15);
});
