import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/reward-dom.mjs';
import { createAlternativeCardStage } from '../src/ui/alternativeCardStage.js';
import { setAnimSpeed } from '../src/ui/fx.js';
import { applyDisplayAppearance } from '../src/ui/displayAppearance.js';

test('Classic appearance leaves its upstream stage in charge without allocating an alternative canvas', () => {
  try {
    applyDisplayAppearance({ classicAppearance: true });
    assert.equal(createAlternativeCardStage('reaver'), null);
  } finally { applyDisplayAppearance({}); }
});

test('class stage owns travel, hit flashing, interruption, pause and disposal', async () => {
  const dom=rewardDom(), raf=new Map(), paints=[], contexts=[], readbacks=[];
  let time=1000, wallTime=1000, serial=0, reduced=false, failArt=false, materializeMs=0, deferArt=false;
  const pendingArt=[];
  const create=dom.document.createElement.bind(dom.document);
  dom.document.createElement=tag=>{
    const node=create(tag);
    if(tag==='canvas')node.getContext=(kind,options)=>{contexts.push({node,kind,options});return {
      clearRect(){},save(){},restore(){},
      drawImage(...args){paints.push({args,alpha:this.globalAlpha,filter:this.filter});},
      fillRect(){paints.push({fill:this.fillStyle,mode:this.globalCompositeOperation});},
      getImageData(){readbacks.push(node);time+=materializeMs;wallTime+=materializeMs;return {data:new Uint8ClampedArray(4)};},
    };};
    return node;
  };
  const NativeDate=Date;
  const globals={...dom, performance:{now:()=>time}, Date:class extends NativeDate {static now(){return wallTime;}},
    Image:class {set src(value){this.url=value;const finish=()=>failArt?this.onerror?.():this.onload?.();if(deferArt)pendingArt.push(finish);else queueMicrotask(finish);}},
    matchMedia:query=>({matches:query.includes('reduced-motion')&&reduced}),
    requestAnimationFrame:fn=>{raf.set(++serial,fn);return serial;},
    cancelAnimationFrame:id=>raf.delete(id),
  };
  const saved=Object.fromEntries(Object.keys(globals).map(key=>[key,globalThis[key]]));
  Object.assign(globalThis,globals);
  let stage;
  const step=ms=>{time+=ms;wallTime+=ms;const callbacks=[...raf.values()];raf.clear();callbacks.forEach(fn=>fn(time));};
  try {
    setAnimSpeed('normal');
    stage=createAlternativeCardStage('reaver');await stage.ready;
    const visible=stage.el.querySelector('canvas');
    assert.deepEqual(contexts.find(c=>c.node===visible),{node:visible,kind:'2d',options:{willReadFrequently:true}});
    assert.equal(contexts[1].options,undefined,'the flash mask keeps its existing context backend');
    assert.equal(stage.pose,'ready');assert.equal(raf.size,0);
    stage.setStance('offensive');assert.equal(stage.pose,'stance-offensive');
    stage.play('attack',260);step(115);
    stage.setStance('casting');assert.equal(stage.pose,'attack-contact','receipt selection must not interrupt the action');
    step(145);assert.equal(stage.pose,'stance-casting');
    assert.match(paints.at(-1).args[0].url,/stances\/reaver\/casting\.webp$/);
    stage.setRestPose('defeated');assert.equal(stage.pose,'defeated','death overrides selected art');
    stage.setRestPose('idle');assert.equal(stage.pose,'stance-casting');
    stage.setStance(null);stage.setRestPose('counter');assert.equal(stage.pose,'guard-brace','counter remains unchanged');
    stage.setRestPose('idle');
    stage.play('attack',260,['stamina']);step(115);
    assert.equal(stage.pose,'attack-contact');
    assert.ok(paints.some(p=>p.args[0]?.url?.includes('attack-contact')&&p.args[1]===208&&p.args[2]===16),'the source figure advances 80 pixels at the authored floor anchor');
    stage.hold(60);step(50);assert.equal(stage.presentation.elapsed,115);
    step(155);assert.equal(stage.pose,'ready');assert.equal(raf.size,0);
    assert.equal(paints.at(-1).args[1],128,'unfiltered rest returns to the original floor anchor');
    stage.play('hit');
    assert.equal(raf.size,1,'an earlier hurt effect already owns a queued frame');
    const beforeWarm=time;
    materializeMs=400;
    stage.play('counter',260,['stamina','mana']);
    assert.equal(readbacks.at(-1),visible,'action preparation still materializes the visible stage');
    assert.ok(time>beforeWarm,'the first aura is materialized before the action clock');
    assert.equal(stage.presentation.elapsed,0,'cold aura work is outside the action clock');
    const staleCallbacks=[...raf.values()];raf.clear();
    materializeMs=0;staleCallbacks.forEach(fn=>fn(time-300));
    assert.equal(stage.presentation.elapsed,0,'a pre-materialization RAF timestamp cannot move the fresh clock backwards');
    materializeMs=0;step(60);
    assert.equal(stage.pose,'counter-load','queued hurt RAF does not skip Counter preparation after cold filter work');
    stage.setRestPose('defend');materializeMs=300;
    const resume=()=>({rest:'defend',action:'counter',elapsed:60,duration:260,resources:['hp','mana','stamina'],savedAt:wallTime});
    const beforeResumeReads=readbacks.length;
    stage.setRestPose('defend',{resume:resume()});
    assert.equal(readbacks.length,beforeResumeReads+1,'restoration also materializes before checking wall-clock expiry');
    assert.equal(stage.presentation.action,undefined,'cold restore work does not extend a stale wall-clock action');
    assert.equal(stage.pose,'guard-brace');
    materializeMs=0;stage.setRestPose('defend',{resume:resume()});
    assert.equal(stage.presentation.elapsed,60,'a valid restoration keeps its saved elapsed time');
    step(30);assert.equal(stage.pose,'counter-parry');
    stage.setRestPose('idle');
    stage.play('smash');step(60);stage.setRestPose('defend');
    assert.equal(stage.pose,'guard-brace','a rest change cancels the prior action');
    step(300);assert.equal(stage.pose,'guard-brace');
    stage.play('hit');step(10);
    assert.ok(paints.some(p=>p.fill==='#ff2424'&&p.mode==='source-in'),'red mask follows sprite alpha');
    step(150);assert.equal(raf.size,0,'hit flash terminates');
    stage.seek('sweep',115);assert.equal(stage.pose,'sweep-contact');assert.equal(raf.size,0);
    stage.setRestPose('idle');
    reduced=true;stage.play('attack');assert.equal(stage.pose,'ready');assert.equal(stage.play('hit'),false);
    stage.setStance('defensive');stage.play('defend');assert.equal(stage.pose,'stance-defensive','reduced motion retains the readable selected pose');
    stage.setStance(null);
    reduced=false;setAnimSpeed('instant');assert.equal(stage.play('hit'),false);
    stage.play('attack',0);assert.equal(raf.size,0);
    setAnimSpeed('normal');stage.play('attack');assert.equal(raf.size,1);
    stage.dispose();assert.equal(raf.size,0);assert.equal(stage.play('attack'),false);
    failArt=true;stage=createAlternativeCardStage('herald');
    assert.equal(await stage.ready,false);
    assert.ok(stage.el.hasAttribute('data-art-placeholder'));
    assert.equal(stage.el.querySelector('span').hidden,false,'failed art retains a visible character marker');
    failArt=false;await stage.el.ashenRestoreArt();
    assert.equal(stage.el.hasAttribute('data-art-placeholder'),false);
    assert.equal(stage.el.querySelector('span').hidden,true,'Retry restores the class art');
    assert.equal(stage.pose,'ready');
    stage.dispose();deferArt=true;stage=createAlternativeCardStage('rogue');
    stage.dispose();const beforeLate=paints.length;
    pendingArt.splice(0).forEach(finish=>finish());
    assert.equal(await stage.ready,false,'a disposed stage ignores late artwork');
    assert.equal(paints.length,beforeLate,'late image loads cannot repaint a disposed canvas');
  } finally {
    stage?.dispose();setAnimSpeed('normal');
    for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }
});
