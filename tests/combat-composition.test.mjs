import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeCombatComposition, stableHandAnchor, combatArtworkKey, stableCombatArtwork, HandAnchorLayoutKey } from '../src/ui/models/CombatCompositionModel.js';
import { fitCombatSprites } from '../src/ui/models/CombatSpriteScaleModel.js';

test('taller intent and Inspect controls cannot change settled artwork; explicit layout changes can', () => {
  const actor = { slot: { id: 'p', cell: 'A1', x: 100, ground: 160, fitGround: 160, depth: 1, artWidth: 140 },
    side: 'player', ratio: 1, multiplier: 1, leading: 35, visibleWidth: 60, visibleHeight: 100, boxHeight: 100, footOffset: 0, art: ['painted', 'reaver'] };
  const layout = { width: 500, height: 220, zoom: 1, presentation: { playerSpriteScale: 1 }, actors: [actor] };
  const first = stableCombatArtwork(null, combatArtworkKey(layout), fitCombatSprites(layout));
  const rounded = { ...layout, height: 220.00003,
    actors: [{ ...actor, slot: { ...actor.slot, ground: 160.00003, fitGround: 160.00003 } }] };
  assert.equal(combatArtworkKey(rounded), first.key, 'subpixel DOM rounding must not invalidate a remounted fit');
  const tall = { ...layout, actors: [{ ...actor, leading: 120, leadingHeight: 100, leadingWidth: 180 }] };
  assert.notDeepEqual(fitCombatSprites(tall), first.sizes, 'the regression fixture really would resize under fresh headroom');
  assert.deepEqual(stableCombatArtwork(first, combatArtworkKey(tall), fitCombatSprites(tall)).sizes, first.sizes);
  for (const changed of [
    { ...layout, width: 390 }, { ...layout, zoom: 1.2 }, { ...layout, wide: true },
    { ...layout, presentation: { playerSpriteScale: 1.3 } },
    { ...layout, actors: [{ ...actor, slot: { ...actor.slot, cell: 'B1', ground: 190 } }] },
    { ...layout, actors: [{ ...actor, visibleWidth: 90, art: ['painted', 'rogue'] }] },
  ]) {
    const key = combatArtworkKey(changed);
    assert.notEqual(key, first.key);
    assert.notStrictEqual(stableCombatArtwork(first, key, fitCombatSprites(changed)), first);
  }
});

test('changed visible header keepout invalidates consecutive fits without field or artwork changes', () => {
  const actor = { slot: { id: 'enemy', cell: 'A1', x: 100, ground: 180, fitGround: 180, depth: 1, artWidth: 140 },
    side: 'enemy', ratio: 1, multiplier: 1, visibleWidth: 60, visibleHeight: 100, boxHeight: 100, footOffset: 0 };
  const layout = { width: 375, height: 240, zoom: 1, actors: [actor] };
  const fit = (previous, ceiling) => {
    const current = { ...layout, ceiling, actors: [{ ...actor, leading: ceiling + 40 }] };
    return stableCombatArtwork(previous, combatArtworkKey(current), fitCombatSprites(current));
  };
  const before = fit(null, 72);
  const captionShown = fit(before, 89.094);
  assert.notEqual(captionShown.key, before.key);
  assert.notDeepEqual(captionShown.sizes, before.sizes, 'new caption headroom must actually constrain artwork');
  const captionHidden = fit(captionShown, 72);
  assert.notStrictEqual(captionHidden, captionShown);
  assert.deepEqual(captionHidden.sizes, before.sizes, 'removing caption restores the available body fit');
});

test('playing, hovering and emptying the hand do not move the initial composition anchor', () => {
  const anchor = stableHandAnchor(null, 'desktop', { left: 400, top: 540 });
  const actors = [{ side: 'player', visibleWidth: 60, leading: 40, slot: { id: 'p', x: 150, ground: 600 } }];
  const compose = hand => alternativeCombatComposition({ perspectiveGrid: true, actors, sizes: [{ id: 'p', x: 150, visibleHeight: 150, scale: 1.5, multiplier: 1 }], width: 1440, height: 600, handLeft: hand.left, handTop: hand.top });
  const before = compose(anchor);
  for (const left of [380, 480, 560, 640, Infinity]) {
    const next = stableHandAnchor(anchor, 'desktop', { left, top: 600 });
    assert.deepEqual(compose(next), before, 'hand changes preserve position, ground and scale');
  }
  const empty = stableHandAnchor(null, 'desktop', { left: Infinity, top: 540 });
  assert.deepEqual(empty, { key: 'desktop', left: 0, top: 540 }, 'empty hands still anchor to their mounted top');
  assert.strictEqual(stableHandAnchor(empty, 'desktop', { left: 400, top: 600 }), empty, 'drawing after an empty-hand resize must not move the body');
  assert.equal(stableHandAnchor(null, 'desktop', { left: Infinity, top: null }), null, 'wait for the hand host to mount');
  const resized = stableHandAnchor(anchor, 'phone', { left: 10, top: 440 });
  assert.deepEqual(resized, { key: 'phone', left: 10, top: 440 }, 'responsive resize gets a fresh anchor');
  assert.notDeepEqual(compose(resized), before);
});

test('solo player stands on the hand top and enemies keep their grid cells', () => {
  const actors = ['p','a','b'].map((id,i) => ({side:i?'enemy':'player', visibleWidth:60, visibleHeight:100,
    leading:40, slot:{id,x:[80,270,340][i],ground:[500,300,300][i]}}));
  const sizes = actors.map((a,i) => ({id:a.slot.id,x:[80,270,340][i],visibleHeight:150,scale:1.5,multiplier:1}));
  const before=structuredClone(sizes);
  const result=alternativeCombatComposition({perspectiveGrid:true,actors,sizes,width:390,height:400,handTop:440});
  assert.deepEqual(sizes,before);
  // Composition only places; sizes pass through. The feet never stand inside the hand area.
  assert.equal(result[0].visibleHeight,150);
  assert.equal(result[0].ground,440);
  assert.equal(result[1].visibleHeight,150);
  assert.equal(result[1].ground,300);
  assert.equal(result[1].x,270);
});

test('co-op does not push players beneath the hand and every painted figure stays in bounds', () => {
  for(const width of [320,390,844,1440]) {
    const actors=[{side:'player',visibleWidth:80,visibleHeight:100,leading:30,slot:{id:'p',x:25,ground:250}}];
    const [r]=alternativeCombatComposition({perspectiveGrid:true,actors,sizes:[{id:'p',x:25,visibleHeight:100,scale:1,multiplier:1}],width,height:300,handTop:290,solo:false});
    assert.equal(r.ground,250); assert.equal(r.visibleHeight,100);
    assert(r.x-r.scale*40>=6); assert(r.x+r.scale*40<=width-6);
  }
});

test('the hand anchor key holds the resting cards\' top, so an anchor read before the cards settled is not reused', () => {
  // Owner 2026-11-20: a lone player's feet stand at the resting cards' top. At 360x800 the hand published
  // --hand-rest-top 58.3 then 68.3 under one geometry key; the stale anchor stood the feet 8 px above the cards.
  const base = { fieldWidth: 360, fieldHeight: 426.5468, pageZoom: 0.8307, handKey: '433:319:0.83100004:10px:0' };
  const early = HandAnchorLayoutKey({ ...base, restTop: 58.3244 }), settled = HandAnchorLayoutKey({ ...base, restTop: 68.2591 });
  assert.notEqual(early, settled, 'a new rest top is a new key');
  const anchor = stableHandAnchor(null, early, { left: 0, top: 418.4 });
  assert.equal(stableHandAnchor(anchor, settled, { left: 0, top: 426.7 }).top, 426.7, 'the settled cards replace the stale anchor');
  assert.equal(HandAnchorLayoutKey({ ...base, restTop: 68.25908 }), HandAnchorLayoutKey({ ...base, restTop: 68.25911 }), 'subpixel noise keeps the key');
  assert.equal(HandAnchorLayoutKey({ ...base, handKey: '433:319:0.83100004:10px:0' }), HandAnchorLayoutKey({ ...base, handKey: '433:319:0.83099998:10px:0' }), 'the hand key is rounded too');
});
