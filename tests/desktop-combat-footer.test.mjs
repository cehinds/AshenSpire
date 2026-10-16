import test from 'node:test';
import assert from 'node:assert/strict';
import { uiConfig } from '../src/config/generated/ui.js';
import { desktopFooterEnabled, desktopFooterLayout, desktopHandLayout } from '../src/ui/models/DesktopCombatFooter.js';

test('approved footer follows the chosen wide preset and alternative appearance only', () => {
  for (const formFactor of ['desktop', 'widescreen']) assert.equal(desktopFooterEnabled({formFactor,appearance:'alternative',layout:'formation'}),true);
  for (const formFactor of ['mobile', 'tablet']) assert.equal(desktopFooterEnabled({formFactor,appearance:'alternative',layout:'formation'}),false);
  assert.equal(desktopFooterEnabled({formFactor:'desktop',appearance:'classic',layout:'formation'}),false);
});
for (const [width,height,zoom] of [[1440,900,1.2],[1920,1080,1.48]]) test(`desktop ${width}: fixed footer, larger proportional cards, and variable fan`, () => {
  const footer=desktopFooterLayout({width:width/zoom,height:height/zoom,zoom});
  const first=footer.controls.sp,last=footer.controls.potions,end=footer.controls.end;
  assert.ok(first.x*zoom>=19);
  assert.ok((last.x+last.w)*zoom<=width-19);
  assert.ok(Math.abs((end.x+end.w/2)*zoom-width/2)<.001);
  assert.ok(Math.abs((end.y+end.h)*zoom-(height-6*footer.unit*zoom))<.001);
  for(const count of [1,3,5,7,10]){
    const hand=desktopHandLayout({width:width/zoom,height:footer.handHeight,count,zoom});
    assert.ok(hand.cardWidth*zoom>=204);
    assert.ok(Math.abs(hand.cardWidth/hand.cardHeight-2/3)<1e-9);
    assert.ok(hand.cards[0].x>=0);
    assert.ok(hand.cards.at(-1).x+hand.cardWidth<=width/zoom);
    assert.ok((footer.handTop+hand.restTop)*zoom>height*.56, 'fan clears player feet at the approved desktop reference');
    const centerBottom=(footer.handTop+hand.top+hand.cardHeight)*zoom;
    assert.ok(centerBottom<(end.y+end.h-footer.endArtHeight)*zoom, 'center cards leave room for the lower End Turn plate');
  }
  assert.ok(Math.abs(footer.backgroundTop*zoom-(height-(900-700)*footer.unit*zoom))<1e-8);
});


test('approved B fade changes only the desktop backing, preserving all layout geometry', () => {
  const config=uiConfig.scenes.w4a.sizing.desktopFooter;
  for(const [width,height,zoom] of [[1440,900,1.2],[1920,1080,1.48]]) {
    const input={width:width/zoom,height:height/zoom,zoom};
    const before=desktopFooterLayout(input,{...config,backgroundTopPx:600});
    const after=desktopFooterLayout(input);
    const {backgroundTop:oldTop,...oldGeometry}=before;
    const {backgroundTop:newTop,...newGeometry}=after;
    assert.deepEqual(newGeometry,oldGeometry,'only the backing position changes');
    assert.equal(after.backgroundFadeHeight*zoom,90*after.unit*zoom);
    assert.ok(newTop>oldTop);
    if(width===1440) {
      assert.ok(Math.abs(newTop*zoom-700)<.001);
      assert.ok(Math.abs((newTop+after.backgroundFadeHeight)*zoom-790)<.001);
    }
  }
});
