import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { combatHudBandHeight } from '../src/ui/components/combatLayout.js';

test('captured375 and390 absolute captions occupy the header grid band at physical zoom', () => withKitDom(({document}) => {
  const header=document.createElement('header'),row=document.createElement('div');row.className='hud-info-row';header.append(row);document.body.append(header);
  header.getBoundingClientRect=()=>({top:0});
  for(const [zoom,bottom] of [[.85,89.09375],[.9,89.390625]]){
    row.getBoundingClientRect=()=>({height:bottom-72,bottom});
    const band=combatHudBandHeight(header,72/zoom,zoom);
    assert.equal(band*zoom,bottom+4,'field begins below caption plus physical gap');
    assert.equal(combatHudBandHeight(header,band,zoom),band,'repeated layout cannot accumulate extra height');
    row.hidden=true;assert.equal(combatHudBandHeight(header,72/zoom,zoom),72/zoom);row.hidden=false;
  }
}));

test('an unchanged size key returns the cached band with no layout read', () => withKitDom(({document}) => {
  const header=document.createElement('header'),row=document.createElement('div');row.className='hud-info-row';row.textContent='Intent';header.append(row);document.body.append(header);
  let reads=0;
  header.getBoundingClientRect=()=>{reads++;return {top:0};};
  row.getBoundingClientRect=()=>{reads++;return {height:20,bottom:40};};
  const memo={width:390,height:844,fontSize:'16px'};
  const first=combatHudBandHeight(header,10,1,memo);
  const afterFirst=reads;
  assert.equal(first,44);
  assert.equal(combatHudBandHeight(header,10,1,memo),first);
  assert.equal(reads,afterFirst,'cache hit reads no rect');
  memo.width=400;combatHudBandHeight(header,10,1,memo);
  assert.ok(reads>afterFirst,'a changed width measures again');
  row.hidden=true;
  assert.equal(combatHudBandHeight(header,10,1,memo),10);
}));
