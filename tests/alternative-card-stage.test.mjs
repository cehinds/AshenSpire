import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/reward-dom.mjs';
import { createAlternativeCardStage } from '../src/ui/alternativeCardStage.js';
import { setAnimSpeed } from '../src/ui/fx.js';

test('class stage owns travel, hit flashing, interruption, pause and disposal', async () => {
  const dom=rewardDom(), raf=new Map(), paints=[];
  let time=1000, serial=0, reduced=false;
  const create=dom.document.createElement.bind(dom.document);
  dom.document.createElement=tag=>{
    const node=create(tag);
    if(tag==='canvas')node.getContext=()=>({
      clearRect(){},save(){},restore(){},
      drawImage(...args){paints.push({args,alpha:this.globalAlpha,filter:this.filter});},
      fillRect(){paints.push({fill:this.fillStyle,mode:this.globalCompositeOperation});},
    });
    return node;
  };
  const globals={...dom, performance:{now:()=>time},
    Image:class {set src(value){this.url=value;queueMicrotask(()=>this.onload?.());}},
    matchMedia:query=>({matches:query.includes('reduced-motion')&&reduced}),
    requestAnimationFrame:fn=>{raf.set(++serial,fn);return serial;},
    cancelAnimationFrame:id=>raf.delete(id),
  };
  const saved=Object.fromEntries(Object.keys(globals).map(key=>[key,globalThis[key]]));
  Object.assign(globalThis,globals);
  let stage;
  const step=ms=>{time+=ms;const callbacks=[...raf.values()];raf.clear();callbacks.forEach(fn=>fn(time));};
  try {
    setAnimSpeed('normal');
    stage=createAlternativeCardStage('reaver');await stage.ready;
    assert.equal(stage.pose,'ready');assert.equal(raf.size,0);
    stage.play('attack',260,['stamina']);step(115);
    assert.equal(stage.pose,'attack-contact');
    assert.equal(paints.at(-1).args[1],208,'the figure has advanced 80 pixels');
    stage.hold(60);step(50);assert.equal(stage.presentation.elapsed,115);
    step(155);assert.equal(stage.pose,'ready');assert.equal(raf.size,0);
    assert.equal(paints.at(-1).args[1],128,'return to the original floor anchor');
    stage.play('smash');step(60);stage.setRestPose('defend');
    assert.equal(stage.pose,'guard-brace','a rest change cancels the prior action');
    step(300);assert.equal(stage.pose,'guard-brace');
    stage.play('hit');step(10);
    assert.ok(paints.some(p=>p.fill==='#ff2424'&&p.mode==='source-in'),'red mask follows sprite alpha');
    step(150);assert.equal(raf.size,0,'hit flash terminates');
    stage.seek('sweep',115);assert.equal(stage.pose,'sweep-contact');assert.equal(raf.size,0);
    stage.setRestPose('idle');
    reduced=true;stage.play('attack');assert.equal(stage.pose,'ready');assert.equal(stage.play('hit'),false);
    reduced=false;setAnimSpeed('instant');assert.equal(stage.play('hit'),false);
    stage.play('attack',0);assert.equal(raf.size,0);
    setAnimSpeed('normal');stage.play('attack');assert.equal(raf.size,1);
    stage.dispose();assert.equal(raf.size,0);assert.equal(stage.play('attack'),false);
  } finally {
    stage?.dispose();setAnimSpeed('normal');
    for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }
});
