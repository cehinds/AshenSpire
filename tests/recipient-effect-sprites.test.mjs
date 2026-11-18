import test from 'node:test';
import assert from 'node:assert/strict';
import { playRecipientEffect, clearRecipientEffects, recipientPlaceholderSvg, prewarmRecipientEffect, recipientEffectView, playRecipientEffectLayers } from '../src/ui/recipientEffectSprites.js';
import { decorateRecipientEffects } from '../src/ui/recipientEffectEvents.js';
import { playTimeline } from '../src/ui/fx.js';
import { withKitDom, rewardDom, installDom } from './helpers/dom.mjs';
import { SETTINGS } from '../src/content/recipientEffectSettings.js';
import { haptic } from '../src/ui/haptics.js';

const box = { left: 30, top: 40, width: 60, height: 100 };
const recipe = { action: 'spell', targetType: 'target', shape: 'spell', color: '#f80', overlay: 'fire', frameCount: 3 };

test('missing art has one static action/target placeholder and skip clears it', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  withKitDom(dom => {
    const layer = dom.document.createElement('div');
    playRecipientEffect(layer, box, recipe, { forcePlaceholder: true, duration: 600 });
    assert.equal(layer.children.length, 1);
    const el = layer.children[0];
    assert.equal(el.dataset.renderer, 'placeholder');
    assert.equal(el.dataset.action, 'spell');
    assert.equal(el.dataset.targetType, 'target');
    const first = el.children[0].src;
    t.mock.timers.tick(450);
    assert.equal(el.dataset.frame, '1');
    assert.equal(el.children[0].src, first);
    clearRecipientEffects(layer);
    assert.equal(layer.children.length, 0);
    t.mock.timers.tick(1000);
    assert.equal(layer.children.length, 0);
  });
});

test('debug marks distinguish all target types without palette variations', () => {
  const values = ['self', 'target', 'aoe'].map(target => recipientPlaceholderSvg('attack', target));
  assert.equal(new Set(values).size, 3);
  assert.notEqual(recipientPlaceholderSvg('attack', 'target'), recipientPlaceholderSvg('spell', 'target'));
});

test('all impact shapes stay flat and unmirrored for both teams', () => {
  const action = { ...recipe, action: 'attack', shape: 'slash' };
  const sourceBox = { left: -150, top: 220, width: 60, height: 100 };
  const front = recipientEffectView(action, { box, sourceBox, targetFacing: 'front' });
  const back = recipientEffectView(action, { box, sourceBox, targetFacing: 'back' });
  assert.equal(front.base.scaleX, 1);
  assert.equal(back.base.scaleX, 1);
  assert.equal(front.base.rotation, 0);
  assert.equal(front.overlay.scaleX, 1, 'flames stay upright despite the slash mirror');
  assert.equal(front.overlay.scaleY, 1);
  for (const shape of ['spell', 'smash']) {
    const radial = recipientEffectView({ ...recipe, shape }, { box, sourceBox, targetFacing: 'front' });
    assert.equal(radial.base.rotation, 0);
    assert.equal(radial.base.scaleX, 1);
    assert.equal(radial.base.scaleY, 1);
  }
});

test('thrust and sweep remain front-on independent of attack direction', () => {
  const target = { left: 100, top: 100, width: 20, height: 20 };
  const thrust = { ...recipe, action: 'attack', shape: 'thrust' };
  assert.equal(recipientEffectView(thrust, { box: target, sourceBox: { left: 0, top: 0, width: 20, height: 20 } }).base.rotation, 0);
  assert.equal(recipientEffectView(thrust, { box: target, sourceBox: { left: 200, top: 0, width: 20, height: 20 } }).base.rotation, 0);
  const sweep = { ...recipe, action: 'sweep', shape: 'sweep', targetType: 'aoe', polarity: 'impact' };
  const front = recipientEffectView(sweep, { box, targetFacing: 'front' });
  const back = recipientEffectView(sweep, { box, targetFacing: 'back' });
  assert.equal(front.base.rotation, 0);
  assert.equal(front.base.scaleY, 1);
  assert.equal(back.base.scaleY, 1);
  assert.equal(front.base.scaleY, back.base.scaleY);
  assert.ok(front.overlay.scaleY > 0, 'element plane may flatten but never inverts');
});

test('Ward and status auras stay upright, recipient bounds control scale, and explicit preview size remains available', () => {
  for (const shape of ['ward', 'buff', 'debuff', 'heal', 'status']) {
    const view = recipientEffectView({ ...recipe, shape }, { box, sourceBox: { left: 500, top: -80, width: 40, height: 80 }, targetFacing: 'front' });
    assert.equal(view.base.rotation, 0);
    assert.equal(view.base.scaleX, 1);
    assert.equal(view.base.scaleY, 1);
  }
  const near = recipientEffectView(recipe, { box: { left: 0, top: 0, width: 100, height: 200 } });
  const far = recipientEffectView(recipe, { box: { left: 0, top: 0, width: 40, height: 80 } });
  assert.ok(far.width < near.width);
  assert.ok(far.height < near.height);
  assert.equal(recipientEffectView(recipe, { box, size: 160 }).size, 160);
  const narrow=recipientEffectView(recipe,{box:{left:0,top:0,width:30,height:110}});
  assert.equal(narrow.size,110*SETTINGS.sizing.impactBodyHeight,'narrow actors retain a readable body-height impact');
});

test('fallback retains the identical static action-target sprite on both teams', () => {
  withKitDom(dom => {
    const layer = dom.document.createElement('div');
    const action = { ...recipe, action: 'attack', shape: 'slash' };
    playRecipientEffect(layer, box, action, { forcePlaceholder: true, targetFacing: 'front' });
    playRecipientEffect(layer, box, action, { forcePlaceholder: true, targetFacing: 'back' });
    const [front, back] = layer.children;
    assert.equal(front.children[0].src, back.children[0].src);
    assert.equal(front.children[0].style.transform, back.children[0].style.transform);
    assert.equal(front.dataset.facing, 'front');
    assert.equal(front.dataset.mirrorX, '1');
    assert.equal(back.dataset.mirrorX, '1');
    assert.equal(front.dataset.frame, '1');
    clearRecipientEffects(layer);
  });
});

test('loaded art animates at most three frames and failed overlays retain the placeholder', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = rewardDom(), restore = installDom(dom), oldImage = globalThis.Image;
  globalThis.Image = class {
    naturalWidth = 768; naturalHeight = 1024;
    set src(value) { value.includes('failed') ? this.onerror() : this.onload(); }
  };
  const layer = dom.document.createElement('div');
  try {
    await prewarmRecipientEffect(recipe, { resolveAsset: path => `ok/${path}` });
    playRecipientEffect(layer, box, { ...recipe, frameCount: 9 }, { resolveAsset: path => `ok/${path}`, duration: 600 });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const el = layer.children[0];
    assert.equal(el.dataset.renderer, 'art');
    assert.equal(el.children.length, 2);
    t.mock.timers.tick(210); assert.equal(el.dataset.frame, '2');
    t.mock.timers.tick(200); assert.equal(el.dataset.frame, '3');
    t.mock.timers.tick(200); assert.equal(layer.children.length, 0);
    playRecipientEffect(layer, box, recipe, { resolveAsset: path => path.includes('/fire.png') ? 'failed/elements' : `ok/${path}` });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(layer.children[0].dataset.renderer, 'placeholder');
    assert.equal(layer.children[0].children.length, 1);
  } finally { clearRecipientEffects(layer); globalThis.Image = oldImage; restore(); }
});

test('cold loads cannot join an active contact late or resurrect it; the next hit starts ready at frame one', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = rewardDom(), restore = installDom(dom), oldImage = globalThis.Image;
  const waiting = [];
  globalThis.Image = class {
    naturalWidth = 768; naturalHeight = 1024;
    set src(value) { waiting.push(this); }
  };
  const layer = dom.document.createElement('div');
  const resolveAsset = path => `delayed/${path}`;
  try {
    const warming = prewarmRecipientEffect(recipe, { resolveAsset });
    assert.equal(waiting.length, 2, 'prewarm queues both atlases before playback');
    playRecipientEffect(layer, box, recipe, { resolveAsset, duration: 300 });
    const cold = layer.children[0];
    t.mock.timers.tick(150);
    waiting.forEach(image => image.onload());
    await warming;
    assert.equal(cold.dataset.renderer, 'placeholder', 'a load at frame two never switches the current hit');
    assert.equal(cold.dataset.frame, '1');
    t.mock.timers.tick(151);
    assert.equal(layer.children.length, 0);
    playRecipientEffect(layer, box, recipe, { resolveAsset, duration: 300 });
    assert.equal(layer.children[0].dataset.renderer, 'art');
    assert.equal(layer.children[0].dataset.frame, '1');
    t.mock.timers.tick(101);
    assert.equal(layer.children[0].dataset.frame, '2');
    clearRecipientEffects(layer);
    const lateAsset = path => `after-expiry/${path}`;
    const late = prewarmRecipientEffect(recipe, { resolveAsset: lateAsset });
    playRecipientEffect(layer, box, recipe, { resolveAsset: lateAsset, duration: 300 });
    t.mock.timers.tick(301);
    waiting.slice(2).forEach(image => image.onload());
    await late;
    assert.equal(layer.children.length, 0, 'late cache completion cannot resurrect an expired effect');
    playRecipientEffect(layer, box, recipe, { resolveAsset: lateAsset });
    assert.equal(layer.children[0].dataset.renderer, 'art');
    assert.equal(layer.children[0].dataset.frame, '1');
  } finally { clearRecipientEffects(layer); globalThis.Image = oldImage; restore(); }
});

test('effects off and reduced motion omit recipient sprites', () => {
  withKitDom(dom => {
    const layer = dom.document.createElement('div');
    dom.document.documentElement = { dataset: { effects: 'off' } };
    playRecipientEffect(layer, box, recipe);
    assert.equal(layer.children.length, 0);
    dom.document.documentElement.dataset.effects = 'on';
    dom.document.body.classList.add('reduced-motion');
    playRecipientEffect(layer, box, recipe);
    assert.equal(layer.children.length, 0);
  });
});

test('receipt decoration keeps actual targets and action scope for player, enemy, and Ward', () => {
  const card = { type: 'spell', tags: ['school:fire'], effects: [{ op: 'damage', target: 'allEnemies' }, { op: 'gainWard', target: 'self' }] };
  const events = [
    { type: 'cardPlayed', playerId: 'seat-a', cardId: 'flame' },
    { type: 'damageDealt', sourceId: 'player', sourcePlayerId: 'seat-a', targetId: 'enemy-1', amount: 5 },
    { type: 'attackEvaded', sourceId: 'player', targetId: 'enemy-2' },
    { type: 'persistentWardChanged', targetId: 'player', playerId: 'seat-a', restored: 2 },
    { type: 'enemyMoveStarted', sourceId: 'enemy-1', enemyId: 'ogre', moveId: 'smash' },
    { type: 'damageDealt', sourceId: 'enemy-1', targetId: 'player', targetPlayerId: 'seat-b', amount: 3 },
  ];
  const out = decorateRecipientEffects(events, { resolveCard: () => card, resolveEnemyMove: () => ({ combatProfile: { maneuver: 'smash' } }) });
  assert.equal(out[1].recipientEffect.palette, 'fire');
  assert.equal(out[1].recipientSourceId, 'seat-a');
  assert.equal(out[1].recipientEffect.targetType, 'aoe');
  assert.equal(out[2].recipientEffect, null);
  assert.equal(out[3].recipientTargetId, 'seat-a');
  assert.equal(out[3].recipientSourceId, 'seat-a');
  assert.equal(out[3].recipientEffect.shape, 'ward');
  assert.equal(out[3].recipientEffect.targetType, 'self');
  assert.equal(out[5].recipientTargetId, 'seat-b');
  assert.equal(out[5].recipientSourceId, 'enemy-1');
  assert.equal(out[5].recipientEffect.shape, 'smash');
  assert.ok(events.every(event => !event.recipientEffect), 'engine receipts remain untouched');
});

test('combat timeline plays confirmed recipient impacts on enemies and players', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  const priorSink = haptic.sink; haptic.sink = () => {};
  try {
    withKitDom(dom => {
      const layer = dom.document.createElement('div'), combatEl = dom.document.createElement('div');
      const player = dom.document.createElement('div'), enemy = dom.document.createElement('div');
      player.className = enemy.className = 'sprite';
      const playerFrame = dom.document.createElement('div'), enemyFrame = dom.document.createElement('div');
      playerFrame.className = 'combatant player'; enemyFrame.className = 'combatant enemy';
      playerFrame.appendChild(player); enemyFrame.appendChild(enemy);
      const seen = new Set();
      const facing = new Map();
      const events = decorateRecipientEffects([
        { type: 'cardPlayed', playerId: 'player', cardId: 'flame', cardType: 'attack' },
        { type: 'damageDealt', sourceId: 'player', targetId: 'enemy', amount: 5 },
        { type: 'enemyMoveStarted', sourceId: 'enemy', enemyId: 'ogre', moveId: 'smash', kind: 'attack' },
        { type: 'damageDealt', sourceId: 'enemy', targetId: 'player', amount: 3 },
      ], { resolveCard: () => ({ type: 'spell', tags: ['school:fire'] }), resolveEnemyMove: () => ({ combatProfile: { maneuver: 'smash' } }) });
      playTimeline(events, { layer, combatEl, anchorFor: id => id === 'player' ? player : enemy,
        animateActor: () => ({ impactMs: 50, totalMs: 300, cancel() {} }), onFlush() {}, onBeatApplied() {}, maxHpFor: () => 50 }, () => {});
      for (let i = 0; i < 6000; i++) {
        t.mock.timers.tick(1);
        for (const el of layer.children) if (el.className === 'recipient-effect') {
          seen.add(el.dataset.action); facing.set(el.dataset.action, el.dataset.facing);
        }
      }
      assert.deepEqual([...seen].sort(), ['smash', 'spell']);
      assert.equal(facing.get('spell'), 'front', 'the player spell strikes a front-facing enemy');
      assert.equal(facing.get('smash'), 'back', 'the enemy smash strikes the rear-facing player');
      assert.equal(layer.querySelectorAll('.recipient-effect').length, 0);
    });
  } finally { haptic.sink = priorSink; }
});

test('fresh continuation batches retain enemy school/range and interleaved counter identity', () => {
  const fire = { combatProfile: { camp: 'spell', school: 'fire', range: 'ranged', maneuver: 'casting' } };
  const resolved = [];
  const resolvers = {
    resolveEnemyMove: event => { resolved.push([event.enemyId, event.moveId]); return fire; },
    resolveCard: () => ({ type: 'attack', tags: ['pierce'] }),
  };
  for (const type of ['combatHitStarted', 'combatContactPrepared']) {
    const out = decorateRecipientEffects([
      { type, sourceId: 'enemy-1', enemyId: 'fire-mage', moveId: 'triple-bolt', contactIndex: 1, contactCount: 3 },
      { type: 'combatCounterTriggered', sourceKind: 'player', sourceId: 'player', cardId: 'counter' },
      { type: 'damageDealt', sourceId: 'player', targetId: 'enemy-1', amount: 2 },
      { type: 'damageDealt', sourceId: 'enemy-1', targetId: 'player', amount: 4 },
    ], resolvers);
    assert.equal(out[2].recipientEffect.action, 'counter');
    assert.equal(out[3].recipientEffect.action, 'spell');
    assert.equal(out[3].recipientEffect.palette, 'fire');
    assert.equal(out[3].recipientEffect.range, 'reach');
  }
  assert.deepEqual(resolved, [['fire-mage', 'triple-bolt'], ['fire-mage', 'triple-bolt']]);
});

test('source-less trailing self grants recover their root action after a counter, while explicit ally grants retain their caster', () => {
  const fire = { type: 'spell', tags: ['school:fire'], effects: [{ op: 'gainWard', target: 'self' }] };
  const start = { type: 'enemyMoveStarted', sourceId: 'enemy-1', enemyId: 'mage', moveId: 'fire-ward' };
  const ward = { type: 'persistentWardChanged', targetId: 'enemy-1', restored: 3 };
  const out = decorateRecipientEffects([
    start,
    { type: 'combatCounterTriggered', sourceKind: 'player', sourceId: 'player', cardId: 'counter' },
    { type: 'damageDealt', sourceId: 'player', targetId: 'enemy-1', amount: 2 },
    ward,
  ], { resolveEnemyMove: () => fire, resolveCard: () => ({ type: 'attack' }) });
  assert.equal(out[3].recipientEffect.action, 'spell');
  assert.equal(out[3].recipientSourceId, 'enemy-1');
  assert.equal(out[3].recipientEffect.palette, 'fire');
  assert.equal(out[3].recipientEffect.shape, 'ward');
  assert.equal(out[3].recipientEffect.targetType, 'self');
  const ally = decorateRecipientEffects([
    start,
    { type: 'cardPlayed', playerId: 'ally', cardId: 'ally-ward' },
    ward,
  ], { resolveEnemyMove: () => fire, resolveCard: () => ({ type: 'spell', tags: ['school:frost'], effects: [{ op: 'gainWard', target: 'ally' }] }) });
  assert.equal(ally[2].recipientEffect.palette, 'frost');
  assert.equal(ally[2].recipientEffect.targetType, 'target');
});


test('buff and debuff use exact card bounds and bottom origin on both teams', () => {
  const cardBox = {left:12,top:24,width:180,height:260};
  withKitDom(dom => {
    const layer=dom.document.createElement('div');
    for (const targetFacing of ['front','back']) for (const shape of ['buff','debuff']) {
      const view=recipientEffectView({...recipe,shape},{box,cardBox,targetFacing});
      for(const key of ['left','top','width','height'])assert.equal(view[key],cardBox[key]);
      playRecipientEffect(layer,box,{...recipe,shape},{cardBox,targetFacing,forcePlaceholder:true});
      const host=layer.children.at(-1);
      assert.equal(host.style.width,'180px');assert.equal(host.style.height,'260px');
      assert.equal(host.style.transformOrigin,'bottom center');assert.equal(host.style.overflow,'hidden');
      assert.equal(host.dataset.anchor,'card-bottom');
    }
    clearRecipientEffects(layer);
  });
});

test('only movement chevrons mirror; group sweep and delayed secondary cancel together', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  assert.equal(recipientEffectView({...recipe,shape:'advance'},{box,targetFacing:'front'}).base.scaleX,-1);
  withKitDom(dom => {
    const layer=dom.document.createElement('div'),a=dom.document.createElement('div'),b=dom.document.createElement('div');
    a.box={left:40,top:20,width:60,height:100};b.box={left:140,top:20,width:60,height:100};
    const anchorFor=id=>id==='a'?a:b;
    playRecipientEffectLayers(layer,[{...recipe,shape:'sweep',mount:'group',groupKey:'one-action',targetIds:['a','b'],durationMs:300},{...recipe,shape:'heal-plus',targetId:'a',delayMs:200,durationMs:300}],{anchorFor,forcePlaceholder:true});
    assert.equal(layer.children.length,1);assert.equal(layer.children[0].dataset.shape,'sweep');
    t.mock.timers.tick(200);assert.equal(layer.children.length,2);
    assert.equal(layer.children[1].dataset.shape,'heal-plus');
    clearRecipientEffects(layer);t.mock.timers.tick(1000);assert.equal(layer.children.length,0);
  });
});


test('runtime tint preserves shading, reads royal-blue/opacity config and leaves physical originals alone', async () => {
  const dom=rewardDom(),restore=installDom(dom),oldImage=globalThis.Image,create=dom.document.createElement.bind(dom.document);
  const draws=[];
  dom.document.createElement=tag=>{
    const node=create(tag);
    if(tag==='canvas')node.getContext=()=>({filter:'none',globalAlpha:1,clearRect(){},save(){},restore(){},
      drawImage(){draws.push({filter:this.filter,alpha:this.globalAlpha,canvas:node});},fillRect(){},
      getImageData(){return {data:new Uint8ClampedArray(256*256*4)};}});
    return node;
  };
  globalThis.Image=class {naturalWidth=768;naturalHeight=256;set src(value){this.onload();}};
  const layer=create('div'),resolveAsset=path=>`tint-check/${path}`;
  try {
    const magic={...recipe,shape:'spell-circle',color:SETTINGS.behavior.palettes.magic,overlay:null,opacity:SETTINGS.layering.opacity.spellCircle};
    await prewarmRecipientEffect(magic,{resolveAsset});playRecipientEffect(layer,box,magic,{resolveAsset,frame:0});
    assert.equal(magic.color,'#4169E1');assert.equal(magic.opacity,.9);
    assert.ok(draws.some(draw=>draw.filter==='grayscale(1)'));
    assert.ok(draws.some(draw=>draw.alpha===SETTINGS.layering.opacity.spellCircle));
    clearRecipientEffects(layer);draws.length=0;
    const physical={...recipe,shape:'slash',color:SETTINGS.behavior.palettes.physical,overlay:null};
    await prewarmRecipientEffect(physical,{resolveAsset});playRecipientEffect(layer,box,physical,{resolveAsset,frame:0});
    assert.ok(draws.every(draw=>draw.filter!=='grayscale(1)'));
  } finally {clearRecipientEffects(layer);globalThis.Image=oldImage;restore();}
});
