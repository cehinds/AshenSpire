import test from 'node:test';
import assert from 'node:assert/strict';
import { detailLevel, visibleTiles } from '../src/ui/models/MapDetailModel.js';
import { MAP_ART } from '../src/content/mapArt.generated.js';
import { MAP_PRESENTATION } from '../src/content/mapPresentation.js';
import { existsSync } from 'node:fs';

const levels = [512,1024,2048,4096].map(edge=>({edge,width:edge,height:edge}));
test('detail adapts to displayed pixels, caps mobile density and resists boundary chatter',()=>{
  assert.equal(detailLevel(levels,400,400).edge,512);
  assert.equal(detailLevel(levels,600,600).edge,1024);
  assert.equal(detailLevel(levels,900,900,3).edge,2048);
  assert.equal(detailLevel(levels,1030,1030,1,levels[1]).edge,1024);
  assert.equal(detailLevel(levels,1250,1250,1,levels[1]).edge,2048);
  assert.equal(detailLevel(levels,10000,10000).edge,4096);
  const native = [512,1024,1254].map(edge=>({edge,width:edge,height:edge}));
  assert.equal(detailLevel(native,792,792,1,native[2]).edge,1024, 'Fit drops below an irregular native tier');
});
test('tile selection clips to a visible region and preserves partial edge geometry',()=>{
  const level={edge:1254,width:1254,height:1254};
  const tiles=visibleTiles(level,{x0:.8,y0:.8,x1:1.4,y1:1.4});
  assert.equal(tiles.length,4);
  assert.ok(tiles.every(t=>t.x>=512/1254&&t.x+t.width<=1&&t.y+t.height<=1));
  assert.deepEqual(visibleTiles(level,{x0:2,y0:2,x1:3,y1:3}),[]);
});
test('every derived tile address in each manifest resolves to a shipped external file',()=>{
  for(const art of Object.values(MAP_ART)) for(const level of art.levels) {
    for(const tile of visibleTiles(level,{x0:0,y0:0,x1:1,y1:1})) assert.ok(existsSync(`map-detail/${art.assetHash}/${tile.key}.webp`));
  }
  assert.ok(MAP_PRESENTATION.concurrentLoads<=4);
});
