import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allocateCombatBands } from '../src/ui/models/CombatLayout.js';
import { handLayout } from '../src/ui/models/HandLayout.js';

const css = readFileSync(new URL('../styles/combat-profiles.css', import.meta.url), 'utf8');
for (const [factor, width, height, zoom] of [['mobile',390,844,.9],['tablet',1024,768,.85],['desktop',1440,900,1.2],['widescreen',2560,1080,1.48]]) {
  test(`${factor}: physical bands and readable card floor survive hand count and UI zoom`, () => {
    const block = css.match(new RegExp(`data-form-factor='${factor}'[^}]+`))[0];
    const value = name => Number(block.match(new RegExp(`--combat-profile-${name}-px: (\\d+)`))[1]);
    const profile = { hud:value('hud'), hand:value('hand'), footer:value('footer') };
    const input = {width:width/zoom,height:height/zoom,zoom,rem:16/zoom,profile};
    const bands = allocateCombatBands(input);
    assert.equal(Math.round(bands.hud * zoom), profile.hud);
    assert.equal(Math.round(bands.hand * zoom), profile.hand);
    assert.equal(Math.round(bands.footer * zoom), profile.footer);
    assert.equal(bands.supported,true);
    const cards = [2,4,8,10].map(count => handLayout({width:input.width-100/zoom,height:bands.hand-48/zoom,zoom,rem:16/zoom,count,compact:factor==='mobile',profile:{min:value('card-min'),max:value('card-max')}}));
    assert.equal(new Set(cards.map(plan=>plan.cardWidth)).size,1, 'hand count cannot shrink the face');
    for (const plan of cards) {
      assert.ok(plan.cardWidth*zoom >= value('card-min'));
      assert.ok(plan.step*zoom >= 43.99, 'every exposed card keeps a physical touch lane');
    }
  });
}
