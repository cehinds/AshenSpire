import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const begin = source.indexOf('  function renderCombatantStage(');
const end = source.indexOf("  if (typeof window !== 'undefined'", begin);
assert.ok(begin >= 0 && end > begin);
const rendering = source.slice(begin, end);

function fixture(code = rendering) {
  const events = [], fits = [], field = { dataset: {} };
  // Exact passive 1209 capture: the tools reserve narrows the hand from the
  // full 390px viewport to 241.953125px before its resting receipt is authored.
  let handWidth = 390, handReceipt, controlsReady = false, toolsReady = false;
  const context = {
    combat: { player: { formationCell: 'A1' }, enemies: [] }, selected: null, selfArm: false,
    selectedFlask: null, selectedCombatantId: null,
    paintedAppearance: 'alternative', displayAppearance: () => 'alternative',
    $: selector => { assert.equal(selector, '.field'); return field; },
    hideTooltip: () => events.push('hide'),
    renderPlayer: () => events.push('player'), renderEnemies: () => events.push('enemies'),
    renderTopbar: () => events.push('topbar'), renderPotionTray: () => events.push('potions'),
    renderControls: () => { controlsReady = true; events.push('controls'); },
    renderCombatTools: () => { toolsReady = true; events.push('tools'); },
    combatTools: { flushGeometry() {
      assert.ok(controlsReady && toolsReady, 'measure the final dock and controls');
      handWidth = 241.953125; events.push('reserve');
    } },
    renderHand: () => { handReceipt = handWidth; events.push('hand'); },
    battlefieldStage: { refresh() { fits.push({ handWidth, handReceipt, controlsReady, toolsReady }); events.push('fit'); } },
    formationMovement: { refresh: () => events.push('formation') },
    applyTargetLayer: () => events.push('targets'), refreshAim: () => events.push('aim'),
    setHintMode: () => events.push('hint'),
  };
  const api = runInNewContext(code + '\n({render, renderCombatantStage})', context);
  return { api, events, fits, field };
}

test('the actual full combat render fits once after final tools reserve and matching hand receipt', () => {
  const probe = fixture(); probe.api.render();
  assert.deepEqual(probe.fits, [{handWidth:241.953125,handReceipt:241.953125,controlsReady:true,toolsReady:true}]);
  assert.deepEqual(probe.events, ['topbar','potions','hide','player','enemies','controls','tools','reserve','hand','fit','formation','targets','aim','hint']);
  assert.equal(probe.field.dataset.playerCell, 'A1');
});

test('action-only combatant updates still fit their replacement frames synchronously', () => {
  const probe = fixture(); probe.api.renderCombatantStage();
  assert.equal(probe.fits.length, 1);
  assert.deepEqual(probe.events, ['hide','player','enemies','fit','formation']);
});

test('the former actual render order is rejected by the first-fit receipt condition', () => {
  const begin=rendering.indexOf('    renderControls();',rendering.indexOf('  function render()'));
  const end=rendering.indexOf('    applyTargetLayer();',begin);
  assert.ok(begin>=0&&end>begin);
  const former = (rendering.slice(0,begin)+'    renderHand();\n    renderControls();\n    renderCombatTools();\n'
    +rendering.slice(end)).replace('renderCombatantStage({ fit: false });','renderCombatantStage();');
  assert.notEqual(former, rendering);
  const probe = fixture(former); probe.api.render();
  assert.equal(probe.fits.length, 1);
  assert.equal(probe.fits[0].handWidth, 390);
  assert.equal(probe.fits[0].handReceipt, undefined, 'the original fit sees no final authored hand receipt');
  assert.equal(probe.fits[0].toolsReady, false);
});

test('the actual tools geometry flush cancels its queued measure and publishes the reserve immediately', () => {
  const tools = readFileSync(new URL('../src/ui/components/combatTools.js', import.meta.url), 'utf8');
  const begin = tools.indexOf('  let frame = 0, entryKey');
  const end = tools.indexOf('  const observer =', begin);
  const callbacks = new Map(), canceled = [], properties = new Map();
  let id = 0;
  const root = {isConnected:true,style:{},dataset:{},getBoundingClientRect:()=>({height:60,top:500})};
  const combatEl = {clientWidth:390/.83,getBoundingClientRect:()=>({width:390}),
    style:{setProperty:(key,value)=>properties.set(key,value)},querySelector:()=>null,querySelectorAll:()=>[]};
  const api = runInNewContext(tools.slice(begin,end)+'\n({schedule,flushGeometry})', {
    root, combatEl, state:{size:'Small'}, panel:{style:{}}, innerHeight:650,
    window:{}, VIEWPORT_ORIGIN:{}, combatLogHeight:()=>125,
    anchorLocalBox:(_host,rect,{zoom})=>({left:rect.left/zoom,top:rect.top/zoom,width:rect.width/zoom,height:rect.height/zoom}),
    getComputedStyle:()=>({getPropertyValue:key=>key==='--combat-tools-gap'?'8':'136'}),
    requestAnimationFrame:fn=>{callbacks.set(++id,fn);return id;},
    cancelAnimationFrame:key=>{canceled.push(key);callbacks.delete(key);},
  });
  api.schedule(); api.flushGeometry();
  assert.deepEqual(canceled,[1]); assert.equal(callbacks.size,0);
  assert.ok(Math.abs(parseFloat(properties.get('--combat-tools-reserve'))*.83-148)<1e-9);
  assert.ok(Math.abs(parseFloat(root.style.width)*.83-136)<1e-9);
  api.schedule(); assert.equal(callbacks.size,1,'ordinary observer updates still schedule normally');
});
