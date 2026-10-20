import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formationOccupancy } from '../src/model/formationOccupancy.js';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const begin = source.indexOf('  function renderCombatantStage(');
const end = source.indexOf("  if (typeof window !== 'undefined'", begin);
assert.ok(begin >= 0 && end > begin);
const rendering = source.slice(begin, end);
const beatBegin = source.indexOf('        onBeatApplied: (beat) => {', source.indexOf('timelinePlayback = playTimeline('));
const beatEnd = source.indexOf('        onFlush: () => {', beatBegin);
assert.ok(beatBegin >= 0 && beatEnd > beatBegin);
const beatRendering = source.slice(beatBegin + '        onBeatApplied: '.length, beatEnd).trim().replace(/,$/, '');

function fixture(code = rendering, beatCode = beatRendering) {
  const events = [], fits = [], field = { dataset: {} };
  // A requested tools raise must inspect the incoming card rectangles before
  // the one board fit. The dock itself belongs to the current footer row.
  const handWidth = 390, footerTop = 744;
  let handReceipt, toolsTop, controlsReady = false, toolsReady = false;
  const context = {
    formationOccupancy, combat: { player: { id: 'player', formationCell: 'A1' }, enemies: [] }, selected: null, selfArm: false,
    selectedFlask: null, selectedCombatantId: null,
    paintedAppearance: 'alternative', displayAppearance: () => 'alternative',
    $: selector => { assert.equal(selector, '.field'); return field; },
    hideTooltip: () => events.push('hide'),
    renderPlayer: () => events.push('player'), renderEnemies: () => events.push('enemies'),
    renderTopbar: () => events.push('topbar'), syncEditLock: () => {}, renderPotionTray: () => events.push('potions'),
    renderControls: () => { controlsReady = true; events.push('controls'); },
    renderCombatTools: () => { toolsReady = true; events.push('tools'); },
    combatTools: { flushGeometry() {
      assert.ok(controlsReady && toolsReady, 'measure the final dock and controls');
      assert.equal(handReceipt,handWidth,'raised toolbar collision checks must measure current card geometry');
      toolsTop=footerTop; events.push('measure-tools');
    } },
    renderHand: () => { handReceipt = handWidth; events.push('hand'); },
    battlefieldStage: { refresh() { fits.push({ handWidth, handReceipt, toolsTop, controlsReady, toolsReady }); events.push('fit'); } },
    formationMovement: { refresh: () => events.push('formation') },
    applyTargetLayer: () => events.push('targets'), refreshAim: () => events.push('aim'),
    // The Combat Rounds Preview's screen layer (SPEC 4.11). It only adds marks and changes no layout, so it is a
    // no-op here and leaves the recorded order above unchanged.
    decorateRoundsScreen: () => {}, decorateCombatRoundsScreen: () => {}, targetedEnemyId: () => null, lastTargetId: null, combatEl: null,
    setHintMode: () => events.push('hint'),
    scheduleAutoCombat: () => events.push('automation'),
    applyVisualEvents: () => events.push('visual-events'), applyBeatToDisp: () => events.push('display-receipt'),
    HAND_BEAT_EVENTS: new Set(['cardPlayed']), dv: entity => entity, bloodRiteReaction: () => null,
    showPileFeedback: () => events.push('pile-feedback'),
  };
  const api = runInNewContext(code + '\nconst onBeatApplied = ' + beatCode + ';\n({render, renderCombatantStage, onBeatApplied})', context);
  return { api, events, fits, field, resetForBeat(handChanges) {
    events.length = 0; fits.length = 0; toolsTop = undefined; controlsReady = false; toolsReady = false;
    if (handChanges) handReceipt = undefined;
  } };
}

test('the actual full combat render fits once after hand layout and measured incoming footer tools', () => {
  const probe = fixture(); probe.api.render();
  assert.deepEqual(probe.fits, [{handWidth:390,handReceipt:390,toolsTop:744,controlsReady:true,toolsReady:true}]);
  assert.deepEqual(probe.events, ['topbar','potions','hide','player','enemies','controls','tools','hand','measure-tools','fit','formation','targets','aim','hint','automation']);
  assert.equal(probe.field.dataset.playerCell, 'A1');
  assert.deepEqual(JSON.parse(probe.field.dataset.formationOccupancy),[{id:'player',cell:'A1',side:'player'}]);
});

test('action-only combatant updates still fit their replacement frames synchronously', () => {
  const probe = fixture(); probe.api.renderCombatantStage();
  assert.equal(probe.fits.length, 1);
  assert.deepEqual(probe.events, ['hide','player','enemies','fit','formation']);
});

const settledBeatFit = probe => assert.deepEqual(probe.fits,
  [{handWidth:390,handReceipt:390,toolsTop:744,controlsReady:true,toolsReady:true}],
  'one synchronous fit sees the final hand, controls and measured tools');

test('the actual card beat writes the incoming hand and feedback before its single geometry fit', () => {
  const probe = fixture(); probe.api.render(); probe.resetForBeat(true);
  probe.api.onBeatApplied({ events: [{ type: 'cardPlayed' }] });
  settledBeatFit(probe);
  assert.deepEqual(probe.events, ['visual-events','display-receipt','topbar','hide','player','enemies','hand','controls','tools','pile-feedback','measure-tools','fit','formation']);
});

test('a non-hand beat keeps the existing hand while fitting its updated HUD synchronously', () => {
  const probe = fixture(); probe.api.render(); probe.resetForBeat(false);
  probe.api.onBeatApplied({ events: [{ type: 'damageDealt' }] });
  settledBeatFit(probe);
  assert.equal(probe.events.includes('hand'), false, 'unchanged hand cards are not rebuilt');
  assert.ok(probe.events.indexOf('pile-feedback') < probe.events.indexOf('fit'));
});

test('early, missing and duplicate beat geometry work is rejected by the real callback fixture', () => {
  const mutations = [
    code => code.replace('renderCombatantStage({ fit: false });', 'renderCombatantStage();'),
    code => code.replace('combatTools.flushGeometry();', ''),
    code => code.replace('battlefieldStage.refresh();', ''),
    code => code.replace('battlefieldStage.refresh();', 'battlefieldStage.refresh(); battlefieldStage.refresh();'),
  ];
  for (const mutate of mutations) {
    const changed = mutate(beatRendering); assert.notEqual(changed, beatRendering);
    assert.throws(() => {
      const probe = fixture(rendering, changed); probe.api.render(); probe.resetForBeat(true);
      probe.api.onBeatApplied({ events: [{ type: 'cardPlayed' }] }); settledBeatFit(probe);
    }, /one synchronous fit/);
  }
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

test('the actual tools geometry flush cancels its queued measure and publishes zero width reserve and the measured footer dock', () => {
  const tools = readFileSync(new URL('../src/ui/components/combatTools.js', import.meta.url), 'utf8');
  const begin = tools.indexOf('  let frame = 0, entryKey');
  const end = tools.indexOf('  const observer =', begin);
  const callbacks = new Map(), canceled = [], properties = new Map();
  let id = 0;
  const hand={getBoundingClientRect:()=>({width:390,right:390,top:356.5775146484375})};
  const root = {isConnected:true,style:{setProperty:(key,value)=>properties.set(key,value)},dataset:{},getBoundingClientRect:()=>({height:60,top:500})};
  const combatEl = {dataset:{desktopFooter:'false'},clientWidth:390/.83,getBoundingClientRect:()=>({left:0,top:0,bottom:844,width:390}),
    style:{setProperty:(key,value)=>properties.set(key,value)},querySelector:selector=>selector==='.hand'?hand:selector==='.combat-action-row'?{getBoundingClientRect:()=>({top:820})}:null,querySelectorAll:()=>[]};
  const api = runInNewContext(tools.slice(begin,end)+'\n({schedule,flushGeometry})', {
    // HUD layout tokens at their defaults: span field, no offset (the old geometry).
    combatToolsTokens:()=>({ span:'field', dy:0 }), cardBand:()=>null, TOOLS_MIN_WIDTH:240, CORNER_INSET:16,
    root, combatEl, logButton:{getBoundingClientRect:()=>({width:83})}, state:{size:'Small'}, panel:{style:{}}, innerHeight:650,
    window:{}, innerWidth:390, drag:null, snapHeights:()=>({Small:125}), VIEWPORT_ORIGIN:{},
    anchorLocalBox:(_host,rect,{zoom})=>({left:rect.left/zoom,top:rect.top/zoom,width:rect.width/zoom,height:rect.height/zoom}),
    getComputedStyle:()=>({getPropertyValue:key=>key==='--combat-tools-gap'?'8':'136'}),
    requestAnimationFrame:fn=>{callbacks.set(++id,fn);return id;},
    cancelAnimationFrame:key=>{canceled.push(key);callbacks.delete(key);},
  });
  api.schedule(); api.flushGeometry();
  assert.deepEqual(canceled,[1]); assert.equal(callbacks.size,0);
  assert.equal(properties.get('--combat-tools-reserve'),'0px');
  assert.equal(properties.get('--combat-log-button-width'),'100px','Deck placement reads the log width in local layout units');
  assert.equal(root.style.width,'auto','corners follow the combat screen rather than current fan width');
  assert.equal(root.style.left,'16px'); assert.equal(root.style.right,'16px');
  assert.ok(Math.abs(parseFloat(root.style.top)*.83-(820-60-4/.83))<1e-9, 'row clears the measured footer controls');
  api.schedule(); assert.equal(callbacks.size,1,'ordinary observer updates still schedule normally');
});

test('tools-first ordering cannot inspect the incoming card obstacle receipt',()=>{
  const wrong=rendering.replace(/    renderHand\(\);([\s\S]*?)    combatTools.flushGeometry\(\);/,
    (_all,between)=>between+'    combatTools.flushGeometry();\n    renderHand();');
  assert.notEqual(wrong,rendering);
  assert.throws(()=>fixture(wrong).api.render(),/raised toolbar collision checks must measure current card geometry/);
});
