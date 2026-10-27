import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileFloorLayer, mobileFloorShadowTop, holdFloorShadowTop } from '../src/ui/models/MobileFloorModel.js';
import { uiConfig } from '../src/config/generated/ui.js';
import { alternativeArtCatalog } from '../src/ui/alternativeArtCatalog.js';

test('mobile floor moves only ground art uniformly and keeps its lower edge covered', () => {
  const layer={id:'ground',x:-562,y:-41,width:1892,height:1065,depth:.7};
  const before=structuredClone(layer);
  for(const top of [400,300,200]) {
    const result=mobileFloorLayer(layer,{paintStart:82/144,maximumPaintTop:top});
    assert(Math.abs(result.y+result.height*82/144-top)<1e-8);
    assert.equal(result.y+result.height,layer.y+layer.height);
    assert(Math.abs(result.width/result.height-layer.width/layer.height)<1e-9);
    assert.equal(result.x+result.width/2,layer.x+layer.width/2);
  }
  assert.deepEqual(layer,before,'resize derives from authored geometry without feedback');
  assert.deepEqual(mobileFloorLayer(layer,{paintStart:82/144,maximumPaintTop:1000}),layer,'already clear art remains unchanged');
});
test('floor shadow anchor ignores HUD and foreground bands, with nearest occupied fallback',()=>{
  assert.equal(mobileFloorShadowTop([{band:'A',top:200},{band:'A',top:190},{band:'B',top:170},{band:'D',top:100}]),190);
  assert.equal(mobileFloorShadowTop([{band:'B',top:230},{band:'C',top:200}]),230);
  assert.equal(mobileFloorShadowTop([{band:'D',top:200}]),undefined);
});
test('every reviewed ground layer has an authored full-width painted boundary and physical clearance',()=>{
  const floor=uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.scene.mobileFloor;
  assert.equal(floor.shadowClearancePx,10);assert.equal(floor.paintAlphaThreshold,128);
  for(const [id,layer] of Object.entries(alternativeArtCatalog.sceneLayers).filter(([,layer])=>layer.kind==='ground')) {
    assert(floor.paintStarts[id]>0 && floor.paintStarts[id]<1,id);
  }
});


test('ground extends beneath the hand without lowering its painted horizon', () => {
  const layer = { x: 0, y: 0, width: 390, height: 520 };
  const result = mobileFloorLayer(layer, { paintStart: .5, maximumPaintTop: 210, minimumBottom: 844 });
  assert(Math.abs(result.y + result.height * .5 - 210) < 1e-6);
  assert(Math.abs(result.y + result.height - 844) < 1e-6);
  assert(Math.abs(result.width / result.height - layer.width / layer.height) < 1e-6, 'ground keeps its authored aspect ratio');
  assert.deepEqual(mobileFloorLayer(result, { paintStart: .5, maximumPaintTop: 210, minimumBottom: 844 }), result, 'fitting is stable');
});

test('the floor anchor holds its last measure once no enemy is left alive, across a re-wire', () => {
  const layoutState = {}; // co-op passes the same state to every freshly wired stage
  assert.equal(holdFloorShadowTop(layoutState, undefined), undefined, 'nothing measured yet');
  assert.equal(holdFloorShadowTop(layoutState, 212), 212);
  assert.equal(holdFloorShadowTop(layoutState, 190), 190, 'a new measure replaces the held one');
  // The kill snapshot re-renders: a new stage is wired with the same layoutState.
  assert.equal(holdFloorShadowTop(layoutState, undefined), 190, 'the last enemy died: the anchor stays');
  assert.equal(holdFloorShadowTop(layoutState, NaN), 190);
  assert.equal(holdFloorShadowTop({}, undefined), undefined, 'a new fight starts with no anchor');
});
