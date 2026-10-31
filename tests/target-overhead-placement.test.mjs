import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { combatHeaderKeepoutBottom, targetOverheadPlacement } from '../src/ui/components/battlefieldStage.js';

test('compact overhead stays centred and visible below header without touching artwork geometry', () => {
  const art={left:100,right:250,top:140,bottom:300};
  const box={left:120,right:220,top:74,height:52};
  const before=structuredClone({art,box});
  const move=targetOverheadPlacement({art,box,headerBottom:100,zoom:1.2});
  assert.equal(box.top+move.dy*1.2,104);
  assert.equal((box.left+box.right)/2+move.dx*1.2,(art.left+art.right)/2);
  assert.deepEqual({art,box},before);
  const spacious=targetOverheadPlacement({art:{...art,top:240},box,headerBottom:100});
  assert.equal(box.top+spacious.dy,240-14-52,'available overhead keeps its above-head gap');
  const noHeader=targetOverheadPlacement({art,box});
  assert.equal(noHeader.dy,0,'missing header never forces a lower placement');
});


test('formation header keepout includes the captured absolute Cinders row without changing its layout', () => withKitDom(({ document }) => {
  const header = document.createElement('header');
  header.getBoundingClientRect = () => ({ top: 0, bottom: 72, width: 375, height: 72 });
  const caption = document.createElement('div'); caption.className = 'hud-info-row hud-cinders-strip';
  caption.getBoundingClientRect = () => ({ left: 242.78125, top: 72, bottom: 89.09375, width: 116.21875, height: 17.09375 });
  header.append(caption);
  assert.equal(combatHeaderKeepoutBottom(header), 89.09375, 'reserve the actually painted row instead of the 72px border box');
  assert.equal(header.style.height, undefined, 'the keepout does not resize the header or steal hand space');
  caption.hidden = true;
  assert.equal(combatHeaderKeepoutBottom(header), 72, 'a disabled purse leaves no invisible reservation');
  caption.hidden = false;
  caption.getBoundingClientRect = () => ({ top: 72, bottom: 89, width: 0, height: 0 });
  assert.equal(combatHeaderKeepoutBottom(header), 72, 'display:none rows do not consume formation headroom');
  assert.equal(combatHeaderKeepoutBottom(null), null);
}));
