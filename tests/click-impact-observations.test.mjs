import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { installImpactObservations, summarizeImpactObservation } from '../tools/click-impact-observations.mjs';
function fixture() {
  let now=0, next=1;
  const queue=new Map(), calls=[], frames=[];
  const context={ window:{__fx:{}}, performance:{now:()=>now,getEntriesByType:()=>[]}, location:{origin:'http://local'}, URL,
    requestAnimationFrame:fn=>frames.push(fn), PerformanceObserver:class {static supportedEntryTypes=[];} };
  const native=function(callback,delay,...args) { const handle=next++; calls.push({receiver:this,callback,delay,args}); queue.set(handle,{callback,delay:Number(delay),args}); return handle; };
  context.window.setTimeout=native;
  context.window.clearTimeout=handle=>queue.delete(handle);
  vm.runInNewContext(`(${installImpactObservations.toString()})()`,context);
  return {context,calls,queue,setNow:n=>{now=n;},fire(handle,receiver) {const t=queue.get(handle);queue.delete(handle);return t?.callback.apply(receiver,t.args);}};
}
test('observed timers retain native receiver, callback args/this, handles and cancellation',()=>{
  const f=fixture(), w=f.context.window, receiver={value:1}, callbackThis={value:7};
  w.__impactObservation.start();
  let seen;
  const handle=w.setTimeout.call(receiver,function timer(...args){seen={receiver:this,args};return 42;},25,'a',2);
  assert.equal(handle,1); assert.equal(f.calls[0].receiver,receiver); assert.equal(f.calls[0].delay,25);
  f.setNow(30); assert.equal(f.fire(handle,callbackThis),42); assert.deepEqual(seen,{receiver:callbackThis,args:['a',2]});
  const cancel=w.setTimeout(()=>assert.fail('cancelled timer fired'),30); w.clearTimeout(cancel); assert.equal(f.queue.has(cancel),false);
  const record=w.__impactObservation.finish(); assert.equal(record.timers.length,1); assert.equal(record.timers[0].fired,30);
});
test('delay objects are coerced only by native timer and short/string callbacks stay untouched',()=>{
  const f=fixture(),w=f.context.window;w.__impactObservation.start();
  let coercions=0; const delay={valueOf(){coercions++;return 25;}};const cb=()=>{};
  w.setTimeout(cb,delay); assert.equal(coercions,1); assert.equal(f.calls[0].callback,cb);assert.equal(f.calls[0].delay,delay);
  w.setTimeout('1+1',30);assert.equal(f.calls[1].callback,'1+1');
  w.setTimeout(cb,5);assert.equal(f.calls[2].callback,cb);
  for(let i=0;i<402;i++)w.setTimeout(cb,30);
  assert.equal(f.calls.at(-1).callback,cb);assert.equal(w.__impactObservation.finish().dropped.timers,2);
});
test('failure formatter separates authored delays from overdue callbacks and bounds output',()=>{
  const data={beats:[{time:10,step:'swing',detail:{impactMs:20,totalMs:50}}],timers:[{scheduled:10,delay:20,fired:45,ended:47}],frames:[0,20,60,80],longtasks:[{start:25,duration:30}],resources:[],dropped:{timers:0}};
  const sample={up:0,contactAt:40,numberAt:80,contact:40,number:80};
  const output=summarizeImpactObservation('core.strike',sample,data), parsed=JSON.parse(output);
  assert.equal(parsed.phases[1].timers[0].due,30);assert.equal(parsed.phases[1].timers[0].overdue,15);assert.equal(parsed.phases[1].timers[0].callbackMs,2);
  assert.equal(parsed.phases[0].longtasks.length,1);assert.equal(parsed.phases[1].longtasks.length,1);assert.ok(Buffer.byteLength(output)<=12*1024);
  const oversized={...data,beats:Array.from({length:30},()=>({time:10,step:'x'.repeat(2000)}))};assert.throws(()=>summarizeImpactObservation('card',sample,oversized),/12KiB/);
});
test('native observation is explicit and cannot change the original verdict or sample clock',()=>{
  const source=readFileSync(new URL('../tools/click-impact-probe.mjs',import.meta.url),'utf8');
  assert.match(source,/const DIAGNOSTICS = args.includes\('--diagnostics'\)/);
  assert.match(source,/const BUDGET_MS = 400;/);assert.match(source,/const NUMBER_BUDGET_MS = 750;/);
  assert.match(source,/contact: Math.round\(c - up\), number: Math.round\(f - up\)/);
  assert.match(source,/process.exitCode = okay \? 0 : 1;\s+if \(DIAGNOSTICS && !okay\)/);
});
