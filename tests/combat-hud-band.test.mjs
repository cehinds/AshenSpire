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
