import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCombatSprites, combatSpriteRatio } from '../src/ui/models/CombatSpriteScaleModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { statureFor } from '../src/ui/components/stature.js';
import { contentBundle } from '../src/content/index.js';
import { combatSpriteGeometry, visibleArtBox } from '../src/ui/components/combatSpriteGeometry.js';

test('light and full enemy art measure the same figure and floor', () => {
  const previous = globalThis.document;
  let drawn;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    drawImage(img) { drawn = img; },
    getImageData() {
      const size = drawn.naturalHeight, data = new Uint8ClampedArray(size * size * 4);
      for (let y = size / 4; y < size * 3 / 4; y++) for (let x = size / 4; x < size * 3 / 4; x++) data[(y * size + x) * 4 + 3] = 255;
      return { data };
    },
  }) }) };
  try {
    const measured = [384, 120].map(size => {
      const img = { src: `tier-${size}`, complete: true, naturalHeight: size, naturalWidth: size,
        dataset: { artSource: 'enemy-poses' }, closest: () => null,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }) };
      const host = { offsetWidth: 200, offsetHeight: 200,
        getBoundingClientRect: img.getBoundingClientRect,
        querySelector: selector => selector === '.painted-stage' ? null : img };
      return { sprite: combatSpriteGeometry({ firstElementChild: host, offsetWidth: 200, offsetHeight: 200 }, () => {}),
        portrait: visibleArtBox(host, () => {}) };
    });
    assert.deepEqual(measured[1], measured[0]);
    assert.ok(measured[0].sprite.visibleHeight < 200);
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
test('a cached sprite still waits for the new image element to load', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) }) }) }) };
  try {
    let listeners = 0;
    const img = { src: 'test-cached-sprite', complete: true, naturalWidth: 1, naturalHeight: 1, dataset: {}, addEventListener() { listeners++; } };
    const host = { querySelector: selector => selector === '.painted-stage' ? null : img };
    const sprite = { firstElementChild: host, offsetHeight: 100, offsetWidth: 100 };
    combatSpriteGeometry(sprite, () => {});
    img.complete = false; img.naturalWidth = 0; img.naturalHeight = 0;
    const pending = combatSpriteGeometry(sprite, () => {});
    assert.equal(listeners, 2);
    assert(Object.values(pending).every(Number.isFinite));
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
test('unloaded sprite geometry cannot poison the shared formation fit', () => {
  const actor = { slot: { id: 'ready', ground: 300, x: 100, artWidth: 90, depth: 1 }, ratio: 1, leading: 30, visibleHeight: 100, visibleWidth: 50 };
  const sizes = fitCombatSprites({ width: 390, height: 380, actors: [actor, { ...actor, slot: { ...actor.slot, id: 'loading' }, visibleHeight: 0, visibleWidth: 0 }] });
  assert.equal(sizes.length, 1); assert(Number.isFinite(sizes[0].scale));
});
import { createRegistries } from '../src/model/registries.js';

test('the real roster keeps encounter classification and fits every elite/boss ratio', () => {
  const registries = createRegistries(contentBundle);
  for (const row of contentBundle.encounters) for (const id of row.enemies) {
    const ratio = combatSpriteRatio(statureFor(registries, id), id);
    if (row.pool === 'elite') assert.ok(ratio >= 1.5 && ratio <= 2, id);
    else if (row.pool === 'boss') assert.ok(ratio >= 1.5 && ratio <= 3, id);
    else assert.equal(ratio, 1, id);
  }
  assert.equal(combatSpriteRatio('huge', 'stitchedKing'), 2);
  assert.equal(combatSpriteRatio('huge', 'ashheartDragon'), 3);
});

test('cramped screens shrink the shared player reference, preserving ratio and depth', () => {
  for (const width of [320,390,844,1440]) for (const height of [170,380,405]) for (const ratio of [1.5,1.75,2,3]) {
    const plan = combatFormation({width,height,friends:['p'],enemies:['e','e2','e3']});
    const actors = plan.slots.map((slot,i)=>({slot, ratio:i?ratio:1, leading:28,
      boxHeight:i?240:190, visibleHeight:i?170:180, visibleWidth:i?250:120}));
    const sizes=fitCombatSprites({width,height,actors});
    for (let i=0;i<sizes.length;i++) {
      const a=actors[i],s=sizes[i];
      assert.ok(Math.abs(s.visibleHeight/sizes[0].visibleHeight-a.ratio*a.slot.depth/(actors[0].ratio*actors[0].slot.depth))<1e-9);
      assert.ok(s.visibleHeight+a.leading+6<=a.slot.ground+1e-8);
      const half=s.scale*a.visibleWidth/2;
      assert.ok(s.x-half>=6-1e-8 && s.x+half<=width-6+1e-8);
    }
  }
});

test('transparent padding does not consume overhead clearance or erase the visible size ratio',()=>{
  const actors=[
    {slot:{id:'p',ground:300,x:100,artWidth:190,depth:1},ratio:1,leading:28,boxHeight:190,visibleHeight:160,visibleWidth:120},
    {slot:{id:'b',ground:300,x:950,artWidth:400,depth:1},ratio:3,leading:28,boxHeight:384,visibleHeight:240,visibleWidth:300},
  ];
  const [p,b]=fitCombatSprites({width:1000,height:405,actors});
  assert.equal(b.visibleHeight/p.visibleHeight,3);
  assert.equal(b.x,950,'shared fitting preserves the reserved ground anchor');
  assert.ok(b.x + b.scale * actors[1].visibleWidth / 2 <= 994);
  assert.ok(p.visibleHeight<150,'player yields space to the large boss');
  const padded = fitCombatSprites({width:1000,height:405,actors:actors.map(a=>({...a,boxHeight:a.boxHeight*2}))});
  assert.deepEqual(padded.map(a=>a.visibleHeight),[p.visibleHeight,b.visibleHeight]);
});

test('presentation growth is shared so a capped enemy never becomes smaller than the player', () => {
  const slot = (id, x) => ({ id, ground: 300, x, artWidth: 60, depth: 1 });
  const actor = (id, side, x, multiplier) => ({ slot: slot(id, x), side, ratio: 1, leading: 30, visibleHeight: 100, visibleWidth: 150, multiplier });
  const sizes = fitCombatSprites({ width: 360, height: 400, actors: [actor('p', 'player', 90, 1.1), actor('e1', 'enemy', 230, 2.2), actor('e2', 'enemy', 300, 2.2)] });
  const [p, e1, e2] = sizes;
  assert.equal(e1.multiplier, e2.multiplier, 'two of the same foe stay the same size');
  assert.ok(e1.multiplier >= 1 && e1.multiplier < 2.2, 'the edge caps the enemy multiplier');
  assert.ok(e1.visibleHeight >= p.visibleHeight, 'enemy cap cannot invert the requested size order');
  for (const [s, a] of [[p, 90], [e2, 300]]) assert.ok(a + s.scale * 150 / 2 <= 360 - 6 + 1e-8 && a - s.scale * 150 / 2 >= 6 - 1e-8);
  const shrunk = fitCombatSprites({ width: 360, height: 400, actors: [actor('p', 'player', 90, 0.5)] });
  assert.equal(shrunk[0].multiplier, 0.5, 'a multiplier below 1 is never capped');
});

test('a phone cell no longer boxes the figure into a thumbnail', () => {
  const plan = combatFormation({ width: 360, height: 400, friends: ['p'], enemies: ['e'] });
  const actors = plan.slots.map((slot) => ({ slot, ratio: 1, leading: 28, visibleHeight: 180, visibleWidth: 180 }));
  const [player] = fitCombatSprites({ width: 360, height: 400, actors });
  assert.ok(player.visibleHeight >= 80, `player figure ${player.visibleHeight}px`);
});
