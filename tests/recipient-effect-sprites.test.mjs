import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayRecipientEffect, ClearRecipientEffects, RecipientPlaceholderSvg, PrewarmRecipientEffect, PrewarmCombatRecipientEffects, RecipientEffectView, PlayRecipientEffectLayers, PlanRecipientEffectLayers, PlayRecipientDelivery } from '../src/ui/recipientEffectSprites.js';
import { DecorateRecipientEffects } from '../src/ui/recipientEffectEvents.js';
import { playTimeline } from '../src/ui/fx.js';
import { withKitDom, rewardDom, installDom } from './helpers/dom.mjs';
import { SETTINGS } from '../src/content/recipientEffectSettings.js';
import { ReadRecipientEffectTiming, ValidateRecipientEffectTiming } from '../src/model/recipientEffectTiming.js';

const timing = ReadRecipientEffectTiming();
import { haptic } from '../src/ui/haptics.js';

const box = { left: 30, top: 40, width: 60, height: 100 };
const recipe = { action: 'spell', targetType: 'target', shape: 'spell', color: '#f80', overlay: 'fire', frameCount: 3 };

test('missing art has one static action/target placeholder and skip clears it', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  withKitDom(dom => {
    const layer = dom.document.createElement('div');
    PlayRecipientEffect(layer, box, recipe, { forcePlaceholder: true, duration: 600 });
    assert.equal(layer.children.length, 1);
    const el = layer.children[0];
    assert.equal(el.dataset.renderer, 'placeholder');
    assert.equal(el.dataset.action, 'spell');
    assert.equal(el.dataset.targetType, 'target');
    const first = el.children[0].src;
    t.mock.timers.tick(450);
    assert.equal(el.dataset.frame, '1');
    assert.equal(el.children[0].src, first);
    ClearRecipientEffects(layer);
    assert.equal(layer.children.length, 0);
    t.mock.timers.tick(1000);
    assert.equal(layer.children.length, 0);
  });
});

test('debug image is capped and centered without changing large or narrow host bounds', () => {
  withKitDom(dom => {
    const layer = dom.document.createElement('div');
    for (const size of [400, 70]) {
      const view = RecipientEffectView(recipe, { box, size });
      PlayRecipientEffect(layer, box, recipe, { forcePlaceholder: true, size });
      const host = layer.children[0], image = host.children[0];
      const footprint = Math.min(SETTINGS.sizing.fallbackPx, view.width, view.height);
      assert.equal(host.style.width, `${view.width}px`);
      assert.equal(host.style.height, `${view.height}px`);
      assert.equal(image.style.width, `${footprint}px`);
      assert.equal(image.style.height, `${footprint}px`);
      assert.equal(image.style.left, `${(view.width - footprint) / 2}px`);
      assert.equal(image.style.top, `${(view.height - footprint) / 2}px`);
      assert.equal(image.style.position, 'absolute');
      ClearRecipientEffects(layer);
    }
  });
});

test('debug marks distinguish all target types without palette variations', () => {
  const values = ['self', 'target', 'aoe'].map(target => RecipientPlaceholderSvg('attack', target));
  assert.equal(new Set(values).size, 3);
  assert.notEqual(RecipientPlaceholderSvg('attack', 'target'), RecipientPlaceholderSvg('spell', 'target'));
});

test('all impact shapes stay flat and unmirrored for both teams', () => {
  const action = { ...recipe, action: 'attack', shape: 'slash' };
  const sourceBox = { left: -150, top: 220, width: 60, height: 100 };
  const front = RecipientEffectView(action, { box, sourceBox, targetFacing: 'front' });
  const back = RecipientEffectView(action, { box, sourceBox, targetFacing: 'back' });
  assert.equal(front.base.scaleX, 1);
  assert.equal(back.base.scaleX, 1);
  assert.equal(front.base.rotation, 0);
  assert.equal(front.overlay.scaleX, 1, 'flames stay upright despite the slash mirror');
  assert.equal(front.overlay.scaleY, 1);
  for (const shape of ['spell', 'smash']) {
    const radial = RecipientEffectView({ ...recipe, shape }, { box, sourceBox, targetFacing: 'front' });
    assert.equal(radial.base.rotation, 0);
    assert.equal(radial.base.scaleX, 1);
    assert.equal(radial.base.scaleY, 1);
  }
});

test('thrust and sweep remain front-on independent of attack direction', () => {
  const target = { left: 100, top: 100, width: 20, height: 20 };
  const thrust = { ...recipe, action: 'attack', shape: 'thrust' };
  assert.equal(RecipientEffectView(thrust, { box: target, sourceBox: { left: 0, top: 0, width: 20, height: 20 } }).base.rotation, 0);
  assert.equal(RecipientEffectView(thrust, { box: target, sourceBox: { left: 200, top: 0, width: 20, height: 20 } }).base.rotation, 0);
  const sweep = { ...recipe, action: 'sweep', shape: 'sweep', targetType: 'aoe', polarity: 'impact' };
  const front = RecipientEffectView(sweep, { box, targetFacing: 'front' });
  const back = RecipientEffectView(sweep, { box, targetFacing: 'back' });
  assert.equal(front.base.rotation, 0);
  assert.equal(front.base.scaleY, 1);
  assert.equal(back.base.scaleY, 1);
  assert.equal(front.base.scaleY, back.base.scaleY);
  assert.ok(front.overlay.scaleY > 0, 'element plane may flatten but never inverts');
});

test('Ward and status auras stay upright, recipient bounds control scale, and explicit preview size remains available', () => {
  for (const shape of ['ward', 'buff', 'debuff', 'heal', 'status']) {
    const view = RecipientEffectView({ ...recipe, shape }, { box, sourceBox: { left: 500, top: -80, width: 40, height: 80 }, targetFacing: 'front' });
    assert.equal(view.base.rotation, 0);
    assert.equal(view.base.scaleX, 1);
    assert.equal(view.base.scaleY, 1);
  }
  const near = RecipientEffectView(recipe, { box: { left: 0, top: 0, width: 100, height: 200 } });
  const far = RecipientEffectView(recipe, { box: { left: 0, top: 0, width: 40, height: 80 } });
  assert.ok(far.width < near.width);
  assert.ok(far.height < near.height);
  assert.equal(RecipientEffectView(recipe, { box, size: 160 }).size, 160);
  const narrow=RecipientEffectView(recipe,{box:{left:0,top:0,width:30,height:110}});
  assert.equal(narrow.size,110*SETTINGS.sizing.impactBodyHeight,'narrow actors retain a readable body-height impact');
});

test('fallback retains the identical static action-target sprite on both teams', () => {
  withKitDom(dom => {
    const layer = dom.document.createElement('div');
    const action = { ...recipe, action: 'attack', shape: 'slash' };
    PlayRecipientEffect(layer, box, action, { forcePlaceholder: true, targetFacing: 'front' });
    PlayRecipientEffect(layer, box, action, { forcePlaceholder: true, targetFacing: 'back' });
    const [front, back] = layer.children;
    assert.equal(front.children[0].src, back.children[0].src);
    assert.equal(front.children[0].style.transform, back.children[0].style.transform);
    assert.equal(front.dataset.facing, 'front');
    assert.equal(front.dataset.mirrorX, '1');
    assert.equal(back.dataset.mirrorX, '1');
    assert.equal(front.dataset.frame, '1');
    ClearRecipientEffects(layer);
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
    await PrewarmRecipientEffect(recipe, { resolveAsset: path => `ok/${path}` });
    PlayRecipientEffect(layer, box, { ...recipe, frameCount: 9 }, { resolveAsset: path => `ok/${path}`, duration: 600 });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const el = layer.children[0];
    assert.equal(el.dataset.renderer, 'art');
    assert.equal(el.children.length, 2);
    t.mock.timers.tick(210); assert.equal(el.dataset.frame, '2');
    t.mock.timers.tick(200); assert.equal(el.dataset.frame, '3');
    t.mock.timers.tick(200); assert.equal(layer.children.length, 0);
    PlayRecipientEffect(layer, box, recipe, { resolveAsset: path => path.includes('/fire.png') ? 'failed/elements' : `ok/${path}` });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(layer.children[0].dataset.renderer, 'placeholder');
    assert.equal(layer.children[0].children.length, 1);
  } finally { ClearRecipientEffects(layer); globalThis.Image = oldImage; restore(); }
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
    const warming = PrewarmRecipientEffect(recipe, { resolveAsset });
    assert.equal(waiting.length, 2, 'prewarm queues both atlases before playback');
    PlayRecipientEffect(layer, box, recipe, { resolveAsset, duration: 300 });
    const cold = layer.children[0];
    t.mock.timers.tick(150);
    waiting.forEach(image => image.onload());
    await warming;
    assert.equal(cold.dataset.renderer, 'placeholder', 'a load at frame two never switches the current hit');
    assert.equal(cold.dataset.frame, '1');
    t.mock.timers.tick(151);
    assert.equal(layer.children.length, 0);
    PlayRecipientEffect(layer, box, recipe, { resolveAsset, duration: 300 });
    assert.equal(layer.children[0].dataset.renderer, 'art');
    assert.equal(layer.children[0].dataset.frame, '1');
    t.mock.timers.tick(101);
    assert.equal(layer.children[0].dataset.frame, '2');
    ClearRecipientEffects(layer);
    const lateAsset = path => `after-expiry/${path}`;
    const late = PrewarmRecipientEffect(recipe, { resolveAsset: lateAsset });
    PlayRecipientEffect(layer, box, recipe, { resolveAsset: lateAsset, duration: 300 });
    t.mock.timers.tick(301);
    waiting.slice(2).forEach(image => image.onload());
    await late;
    assert.equal(layer.children.length, 0, 'late cache completion cannot resurrect an expired effect');
    PlayRecipientEffect(layer, box, recipe, { resolveAsset: lateAsset });
    assert.equal(layer.children[0].dataset.renderer, 'art');
    assert.equal(layer.children[0].dataset.frame, '1');
  } finally { ClearRecipientEffects(layer); globalThis.Image = oldImage; restore(); }
});

// Impact sprites carry combat feedback, not decoration, so the decorative
// Effects toggle no longer hides them; reduced motion and Reduce flashes still do.
test('recipient sprites survive Effects off; reduced motion and reduce flashes omit them', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  withKitDom(dom => {
    dom.document.documentElement = { dataset: { effects: 'off' } };
    const shown = dom.document.createElement('div');
    PlayRecipientEffect(shown, box, recipe);
    assert.ok(shown.children.length > 0, 'Effects off still shows the recipient sprite');
    ClearRecipientEffects(shown);
    dom.document.documentElement.dataset.effects = 'on';
    dom.document.body.classList.add('reduced-motion');
    const still = dom.document.createElement('div');
    PlayRecipientEffect(still, box, recipe);
    assert.equal(still.children.length, 0);
    dom.document.body.classList.remove('reduced-motion');
    dom.document.body.classList.add('reduce-flashes');
    const flashless = dom.document.createElement('div');
    PlayRecipientEffect(flashless, box, recipe);
    assert.equal(flashless.children.length, 0);
  });
});

// Mounting a fight warms every configured contact/caster shape so the first hit
// is not a cold placeholder; it must not wait on decode and must respect the
// reduced-motion switch.
test('combat prewarm requests every configured warm shape and skips under reduced motion', async () => {
  const dom = rewardDom(), restore = installDom(dom), oldImage = globalThis.Image;
  const requested = [];
  globalThis.Image = class {
    naturalWidth = 768; naturalHeight = 256;
    set src(value) { requested.push(value); queueMicrotask(() => this.onload?.()); }
  };
  try {
    const resolveAsset = path => `warm/${path}`;
    const results = await PrewarmCombatRecipientEffects({ resolveAsset });
    assert.equal(results.length, SETTINGS.behavior.warmShapes.length);
    for (const shape of SETTINGS.behavior.warmShapes)
      assert.ok(requested.some(url => url.includes(`/${shape}.png`)), `${shape} is warmed`);
    dom.document.body.classList.add('reduced-motion');
    assert.deepEqual(await PrewarmCombatRecipientEffects({ resolveAsset: path => `cold/${path}` }), []);
  } finally { globalThis.Image = oldImage; restore(); }
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
  const out = DecorateRecipientEffects(events, { resolveCard: () => card, resolveEnemyMove: () => ({ combatProfile: { maneuver: 'smash' } }) });
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
      const events = DecorateRecipientEffects([
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
    const out = DecorateRecipientEffects([
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
  const out = DecorateRecipientEffects([
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
  const ally = DecorateRecipientEffects([
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
      const view=RecipientEffectView({...recipe,shape},{box,cardBox,targetFacing});
      for(const key of ['left','top','width','height'])assert.equal(view[key],cardBox[key]);
      PlayRecipientEffect(layer,box,{...recipe,shape},{cardBox,targetFacing,forcePlaceholder:true});
      const host=layer.children.at(-1);
      assert.equal(host.style.width,'180px');assert.equal(host.style.height,'260px');
      assert.equal(host.style.transformOrigin,'bottom center');assert.equal(host.style.overflow,'hidden');
      assert.equal(host.dataset.anchor,'card-bottom');
    }
    ClearRecipientEffects(layer);
  });
});

test('only movement chevrons mirror; group sweep and delayed secondary cancel together', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  assert.equal(RecipientEffectView({...recipe,shape:'advance'},{box,targetFacing:'front'}).base.scaleX,-1);
  withKitDom(dom => {
    const layer=dom.document.createElement('div'),a=dom.document.createElement('div'),b=dom.document.createElement('div');
    a.box={left:40,top:20,width:60,height:100};b.box={left:140,top:20,width:60,height:100};
    const anchorFor=id=>id==='a'?a:b;
    PlayRecipientEffectLayers(layer,[{...recipe,shape:'sweep',mount:'group',groupKey:'one-action',targetIds:['a','b'],durationMs:300},{...recipe,shape:'heal-plus',targetId:'a',delayMs:200,durationMs:300}],{anchorFor,forcePlaceholder:true});
    assert.equal(layer.children.length,1);assert.equal(layer.children[0].dataset.shape,'sweep');
    const onset=300+timing.gapMs;
    t.mock.timers.tick(onset-1);assert.equal(layer.children.length,0);
    t.mock.timers.tick(1);assert.equal(layer.children.length,1);
    assert.equal(layer.children[0].dataset.shape,'heal-plus');
    ClearRecipientEffects(layer);t.mock.timers.tick(1000);assert.equal(layer.children.length,0);
  });
});


test('runtime tint preserves shading, reads royal-blue/opacity config and leaves physical originals alone', async () => {
  const dom=rewardDom(),restore=installDom(dom),oldImage=globalThis.Image,create=dom.document.createElement.bind(dom.document);
  const draws=[];
  dom.document.createElement=tag=>{
    const node=create(tag);
    if(tag==='canvas')node.getContext=()=>({filter:'none',globalAlpha:1,clearRect(){},save(){},restore(){},
      drawImage(){draws.push({filter:this.filter,alpha:this.globalAlpha,canvas:node});},fillRect(){},
      beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},
      getImageData(){return {data:new Uint8ClampedArray(256*256*4)};}});
    return node;
  };
  globalThis.Image=class {naturalWidth=768;naturalHeight=256;set src(value){this.onload();}};
  const layer=create('div'),resolveAsset=path=>`tint-check/${path}`;
  try {
    const magic={...recipe,shape:'spell-circle',color:SETTINGS.behavior.palettes.magic,overlay:null,opacity:SETTINGS.layering.opacity.spellCircle};
    await PrewarmRecipientEffect(magic,{resolveAsset});PlayRecipientEffect(layer,box,magic,{resolveAsset,frame:0});
    assert.equal(magic.color,'#4169E1');assert.equal(magic.opacity,1);
    assert.equal(Number(layer.children[0].style.opacity),SETTINGS.layering.opacity.global);
    assert.ok(draws.some(draw=>draw.filter==='grayscale(1)'));
    assert.ok(draws.some(draw=>draw.alpha===SETTINGS.layering.opacity.spellCircle));
    ClearRecipientEffects(layer);draws.length=0;
    const physical={...recipe,shape:'slash',color:SETTINGS.behavior.palettes.physical,overlay:null};
    await PrewarmRecipientEffect(physical,{resolveAsset});PlayRecipientEffect(layer,box,physical,{resolveAsset,frame:0});
    assert.ok(draws.every(draw=>draw.filter!=='grayscale(1)'));
    ClearRecipientEffects(layer);draws.length=0;
    const poison={...physical,shape:'poison',color:SETTINGS.behavior.palettes.fire};
    await PrewarmRecipientEffect(poison,{resolveAsset});PlayRecipientEffect(layer,box,poison,{resolveAsset,frame:0,timing:{...timing,opacity:0.35}});
    assert.ok(draws.every(draw=>draw.filter!=='grayscale(1)'), 'native v6 colors survive an unrelated casting school');
    assert.equal(Number(layer.children[0].style.opacity),0.35);
    ClearRecipientEffects(layer);
    draws.length=0;
    const shatter={...poison,shape:'ward-shatter',treatment:'break'};
    await PrewarmRecipientEffect(shatter,{resolveAsset});PlayRecipientEffect(layer,box,shatter,{resolveAsset,frame:0});
    assert.ok(draws.some(draw=>draw.filter==='grayscale(1)'), 'Ward shatter takes the protected actor’s Ward tint');
    const shatterPlane=layer.children[0].children[0];
    assert.ok(draws.some(draw=>draw.canvas===shatterPlane&&draw.alpha===SETTINGS.layering.opacity.primary),
      'shatter art keeps its authored alpha envelope under the shared clip opacity');
    ClearRecipientEffects(layer);
    PlayRecipientDelivery(layer,box,{...box,left:100},{...physical,range:'reach',camp:'physical',
      impactShape:'slash'},{resolveAsset,timing:{...timing,opacity:0.25}});
    assert.equal(layer.children[0].className,'recipient-delivery');
    assert.equal(Number(layer.children[0].style.opacity),0.25);
  } finally {ClearRecipientEffects(layer);globalThis.Image=oldImage;restore();}
});


test('timing exposes the authored defaults and validates panel constraints', () => {
  assert.deepEqual(timing, { scope: 'battlefield', maxConcurrent: 1, gapMs: 30, overlapMs: 0, opacity: 0.8 });
  for (const invalid of [{ scope: 'lane' }, { maxConcurrent: 1.5 }, { maxConcurrent: 5 },
    { gapMs: -1 }, { gapMs: 1001 }, { gapMs: '30' }, { overlapMs: 201 },
    { maxConcurrent: 2, overlapMs: 10 }, { gapMs: 0, overlapMs: 10 }, { opacity: -0.1 }, { opacity: 1.01 }]) {
    assert.throws(() => ValidateRecipientEffectTiming({ ...timing, ...invalid }), RangeError);
  }
  assert.equal(ValidateRecipientEffectTiming({ ...timing, opacity: 0 }).opacity, 0);
});

const onA = { ...recipe, shape: 'slash', targetId: 'a', phase: 'contact', durationMs: 300 };
const onB = { ...onA, shape: 'weak', targetId: 'b', phase: 'status' };

test('battlefield queue serializes independent recipients, preserves duration and groups Sweep', () => {
  const sweep = { ...onA, shape: 'sweep', mount: 'group', targetIds: ['a', 'b'], groupKey: 'sweep' };
  const result = PlanRecipientEffectLayers([onA,
    { ...onA, shape: 'block-hit', phase: 'reaction', delayMs: 60, durationMs: 1 },
    onB, sweep, sweep,
  ]);
  const [slash, block, weak, group] = result;
  assert.equal(result.length, 4);
  assert.equal(slash.recipe.overlay, 'fire');
  assert.equal(slash.end - slash.start, 300);
  assert.equal(block.start - slash.end, timing.gapMs);
  assert.equal(block.end - block.start, 3 * SETTINGS.behavior.minimumFrameMs);
  assert.equal(weak.start - block.end, timing.gapMs);
  assert.deepEqual(group.ids, ['a', 'b']);
  assert.equal(group.start - weak.end, timing.gapMs);
});

test('recipient scope separates targets and battlefield overlap enforces a hard concurrency cap', () => {
  const [slash, weak] = PlanRecipientEffectLayers([onA, onB], { timing: { ...timing, scope: 'recipient' } });
  assert.equal(slash.start, weak.start);
  const clips = PlanRecipientEffectLayers([onA, onB, onA, onB], {
    timing: { ...timing, maxConcurrent: 2, gapMs: 0, overlapMs: 200 },
  });
  assert.deepEqual(clips.map(clip => clip.start), [0, 100, 300, 400]);
  assert.deepEqual(clips.map(clip => clip.durationMs), [300, 300, 300, 300]);
});

test('spell windup, actual delivery duration and impact sequence even on different recipients', () => {
  const actionKey = 'spell-1';
  const [windup, delivery, impact] = PlanRecipientEffectLayers([
    { ...onA, actionKey, shape: 'spell-circle', phase: 'windup' },
    { ...onB, actionKey, shape: null, phase: 'delivery', delivery: { durationMs: 25 } },
    { ...onB, actionKey, phase: 'contact' },
  ], { timing: { ...timing, scope: 'recipient' } });
  assert.equal(windup.start, 0);
  assert.equal(delivery.start, windup.end + timing.gapMs);
  assert.equal(delivery.durationMs, 25);
  assert.equal(impact.start, delivery.end + timing.gapMs);
});

test('live result windows span separate calls and pending schedules cancel without leaking into later effects', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  withKitDom(dom => {
    const layer = dom.document.createElement('div');
    const actor = dom.document.createElement('div');
    actor.box = box;
    const options = { anchorFor: id => id && actor, forcePlaceholder: true, timing: { ...timing, scope: 'recipient' } };
    const play = (shape, targetId) => PlayRecipientEffectLayers(layer, [{
      ...recipe, shape, targetId, durationMs: 300,
    }], options);
    const shapes = () => [...layer.children].map(child => child.dataset.shape);
    play('slash', 'a');
    t.mock.timers.tick(40);
    play('block-hit', 'a');
    play('weak', 'b');
    assert.deepEqual(shapes(), ['slash', 'weak']);
    const toNext = 300 + timing.gapMs - 40;
    t.mock.timers.tick(toNext - 1);
    assert.deepEqual(shapes(), ['weak']);
    t.mock.timers.tick(1);
    assert.deepEqual(shapes(), ['weak', 'block-hit']);
    const cancelPending = play('frail', 'a');
    cancelPending();
    assert.ok(shapes().includes('block-hit'));
    t.mock.timers.tick(400);
    assert.deepEqual(shapes(), []);
    play('ward', 'a');
    play('heal-plus', 'a');
    ClearRecipientEffects(layer);
    play('evade-gain', 'a');
    assert.deepEqual(shapes(), ['evade-gain']);
    t.mock.timers.tick(1000);
    assert.deepEqual(shapes(), []);
    ClearRecipientEffects(layer);
  });
});


test('the battlefield gap remains reserved between separate live calls after the first clip ends', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom(dom => {
    const layer = dom.document.createElement('div'), actor = dom.document.createElement('div');
    actor.box = box;
    const options = { anchorFor: () => actor, forcePlaceholder: true };
    PlayRecipientEffectLayers(layer, [onA], options);
    t.mock.timers.tick(305);
    assert.equal(layer.children.length, 0);
    PlayRecipientEffectLayers(layer, [onB], options);
    t.mock.timers.tick(timing.gapMs - 6);
    assert.equal(layer.children.length, 0);
    t.mock.timers.tick(1);
    assert.equal(layer.children[0].dataset.shape, 'weak');
    ClearRecipientEffects(layer);
  });
});


test('late timer dispatch cannot overlap live clips at the battlefield cap', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom(dom => {
    const layer = dom.document.createElement('div'), actor = dom.document.createElement('div');
    actor.box = box;
    const options = { anchorFor: () => actor, forcePlaceholder: true, timing: { ...timing, gapMs: 0 } };
    PlayRecipientEffectLayers(layer, [onA, onB, { ...onA, shape: 'frail' }], options);
    t.mock.timers.tick(400);
    assert.deepEqual([...layer.children].map(node => node.dataset.shape), ['weak']);
    t.mock.timers.tick(200);
    assert.deepEqual([...layer.children].map(node => node.dataset.shape), ['weak']);
    t.mock.timers.tick(100);
    assert.deepEqual([...layer.children].map(node => node.dataset.shape), ['frail']);
    ClearRecipientEffects(layer);
  });
});


test('live battlefield cap two allows overlap and then waits for a slot to release', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom(dom => {
    const layer = dom.document.createElement('div'), actor = dom.document.createElement('div');
    actor.box = box;
    const options = { anchorFor: () => actor, forcePlaceholder: true,
      timing: { ...timing, maxConcurrent: 2, gapMs: 0, overlapMs: 200 } };
    const shapes = () => [...layer.children].map(node => node.dataset.shape);
    PlayRecipientEffectLayers(layer, [onA], options);
    PlayRecipientEffectLayers(layer, [onB], options);
    PlayRecipientEffectLayers(layer, [{ ...onA, shape: 'frail' }], options);
    assert.deepEqual(shapes(), ['slash']);
    t.mock.timers.tick(100);
    assert.deepEqual(shapes(), ['slash', 'weak']);
    t.mock.timers.tick(199);
    assert.deepEqual(shapes(), ['slash', 'weak']);
    t.mock.timers.tick(1);
    assert.deepEqual(shapes(), ['weak', 'frail']);
    ClearRecipientEffects(layer);
  });
});
