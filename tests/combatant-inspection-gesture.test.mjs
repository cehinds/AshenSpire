import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/kit-dom.mjs';
import { bindCombatantInspectionGesture, isCombatBlankPress, markCombatantInspectionSurfaces } from '../src/ui/components/combatantInspectionGesture.js';

function fixture(t, { selected = true, selection = null } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = globalThis.window;
  const win = new EventTarget(); globalThis.window = win;
  t.after(() => { gesture.release(); globalThis.window = previous; t.mock.timers.reset(); });
  const frame = new EventTarget(); frame.isConnected = true;
  frame.closest = () => null;
  let plays = 0, inspections = 0, hud = false, live = true;
  frame.closest = selector => hud && selector.includes('.nm') ? frame : null;
  const gesture = bindCombatantInspectionGesture(frame, {
    isSelected: () => selection ? selection() : selected, canInspect: () => live, canActivate: () => live,
    open: () => inspections++, activate: () => plays++, holdMs: 600, movePx: 8,
  });
  function emit(target, type, attrs = {}) {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({ pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0, button: 0, detail: 1, ...attrs })) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event); return event;
  }
  return { frame, win, emit, gesture, hud: value => { hud = value; }, live: value => { live = value; },
    selected: value => { selected = value; }, counts: () => ({ plays, inspections }), tick: ms => t.mock.timers.tick(ms) };
}

test('selected armed double click inspects without dispatching a play', t => {
  const f = fixture(t);
  assert.equal(f.emit(f.frame, 'click').defaultPrevented, true);
  f.tick(100);
  f.emit(f.frame, 'click', { detail: 2 }); f.emit(f.frame, 'dblclick', { detail: 2 });
  f.tick(500);
  assert.deepEqual(f.counts(), { plays: 0, inspections: 1 });
});
test('selected genuine single click activates exactly once after the bounded window', t => {
  const f = fixture(t); f.emit(f.frame, 'click'); f.tick(499);
  assert.equal(f.counts().plays, 0); f.tick(1); f.tick(400);
  assert.equal(f.counts().plays, 1);
});
test('HUD click and keyboard inspection cancel pending activation', t => {
  const f = fixture(t); f.emit(f.frame, 'click'); f.hud(true);
  f.emit(f.frame, 'click'); f.emit(f.frame, 'keydown', { key: 'Enter' }); f.tick(700);
  assert.deepEqual(f.counts(), { plays: 0, inspections: 2 });
});
test('stationary hold inspects and consumes its trailing click', t => {
  const f = fixture(t); f.emit(f.frame, 'pointerdown'); f.tick(600);
  f.emit(f.win, 'pointerup'); f.emit(f.frame, 'click'); f.tick(500);
  assert.deepEqual(f.counts(), { plays: 0, inspections: 1 });
});
for (const reason of ['movement', 'pointercancel', 'scroll', 'blur', 'second touch', 'release']) {
  test(`hold cancels on ${reason} and never opens later`, t => {
    const f = fixture(t); f.emit(f.frame, 'pointerdown'); f.tick(200);
    if (reason === 'movement') f.emit(f.win, 'pointermove', { clientX: 20 });
    if (reason === 'pointercancel') f.emit(f.win, 'pointercancel');
    if (reason === 'scroll') f.emit(f.win, 'scroll');
    if (reason === 'blur') f.emit(f.win, 'blur');
    if (reason === 'second touch') f.emit(f.win, 'pointerdown', { pointerId: 2 });
    if (reason === 'release') f.gesture.release();
    f.tick(1000); assert.deepEqual(f.counts(), { plays: 0, inspections: 0 });
  });
}
test('deferred activation rechecks live state and cancel invalidates it', t => {
  const f = fixture(t); f.emit(f.frame, 'click'); f.live(false); f.tick(500);
  assert.equal(f.counts().plays, 0); f.live(true); f.emit(f.frame, 'click'); f.gesture.cancel(); f.tick(500);
  assert.equal(f.counts().plays, 0);
});
test('unselected single click remains immediate through existing target handler', t => {
  const f = fixture(t, { selected: false });
  assert.equal(f.emit(f.frame, 'click').defaultPrevented, false);
  f.tick(500); assert.deepEqual(f.counts(), { plays: 0, inspections: 0 });
});


test('a second press cancels pending single activation before a hold completes', t => {
  const f = fixture(t); f.emit(f.frame, 'click'); f.tick(300);
  f.emit(f.frame, 'pointerdown'); f.tick(600); f.emit(f.win, 'pointerup'); f.emit(f.frame, 'click'); f.tick(700);
  assert.deepEqual(f.counts(), { plays: 0, inspections: 1 });
});


for (const screen of ['combat', 'coop']) {
  test(`${screen}: actual selection writer retains inspection identity through card arming`, t => {
    const source = readFileSync(new URL(`../src/ui/screens/${screen}.js`, import.meta.url), 'utf8');
    const writer = source.match(/function selectCombatant\(id,[\s\S]*?\n  }/)[0];
    const arming = screen === 'combat'
      ? source.match(/cardinspectionselect', event => \{\s*(selectCombatant\([^;]+;)/)[1]
      : source.match(/const inspectCard = \(\) => (selectCombatant\([^;]+;)/)[1];
    const state = new Function(`
      let selectedCombatantId=null,lastReadingSelection=null,armedFriendlyCard=null;
      const inspectionGestures=new Map(),pickerInspectionGestures=new Map(), combatEl={}, app={}, snap=null;
      const getEntity=()=>({alive:true}),combat={},selectCombatantInfo=()=>{};
      ${writer}
      return { select:selectCombatant, arm:()=>{${arming}}, selected:()=>selectedCombatantId,
        inspectionSelected:()=> (selectedCombatantId||lastReadingSelection)==='enemy' };
    `)();
    state.select('enemy'); state.arm();
    assert.equal(state.selected(), null, 'arming still dismisses expanded reading presentation');
    assert.equal(state.inspectionSelected(), true, 'the inspected enemy remains eligible for double-click arbitration');
    const f = fixture(t, { selection: state.inspectionSelected });
    f.emit(f.frame, 'click'); f.tick(100); f.emit(f.frame, 'click', { detail: 2 }); f.tick(700);
    assert.deepEqual(f.counts(), { plays: 0, inspections: 1 });
    state.select(null); assert.equal(state.inspectionSelected(), false, 'an explicit blank/Escape dismisses the remembered identity');
    assert.match(source, /isSelected: \(\) => \(selectedCombatantId \|\| lastReadingSelection\) ===/);
  });
}


test('a bubbling hand-card activation preserves enemy inspection identity; actual blank clears it', () => withKitDom(({ document, Event }) => {
  const combat = document.createElement('div'), hand = document.createElement('div'), card = document.createElement('button'), blank = document.createElement('div');
  hand.className = 'hand'; card.className = 'card'; hand.append(card); combat.append(hand, blank); document.body.append(combat);
  let reading = 'enemy', remembered = 'enemy';
  card.addEventListener('click', () => { reading = null; });
  combat.addEventListener('click', event => { if (isCombatBlankPress(event)) { reading = null; remembered = null; } });
  card.dispatchEvent(new Event('click', { bubbles: true }));
  assert.equal(reading, null); assert.equal(remembered, 'enemy');
  blank.dispatchEvent(new Event('click', { bubbles: true })); assert.equal(remembered, null);
  for (const screen of ['combat', 'coop']) assert.match(readFileSync(new URL(`../src/ui/screens/${screen}.js`, import.meta.url), 'utf8'), /isCombatBlankPress\(event\)/);
}));

test('HUD read-only markers reach the timeline skip guard while a blank stage remains skippable', () => withKitDom(({ document }) => {
  const frame = document.createElement('article'); frame.innerHTML = '<div class="sprite"></div><button class="intent">Intent</button><div class="nm">Enemy</div><div class="resbars">HP</div><div class="statuses">Effects</div><button class="combatant-info">i</button>';
  document.body.append(frame); markCombatantInspectionSurfaces(frame, { playback: true });
  const source = readFileSync(new URL('../src/ui/fx.js', import.meta.url), 'utf8');
  const actualGuard = source.slice(source.indexOf('export function playTimeline')).match(/const skip = event => \{\s*(if \(event\?\.target[\s\S]*?return;)/)[1];
  const wouldFlush = new Function('event', `${actualGuard} return true;`);
  for (const surface of frame.children) assert.equal(wouldFlush({ target: surface }), undefined, `${surface.className}: reading must not skip playback`);
  const blank = document.createElement('div'); assert.equal(wouldFlush({ target: blank }), true);
  markCombatantInspectionSurfaces(frame); assert.equal(frame.querySelector('.sprite').attributes.has('data-combat-read-only'), false);
}));

test('overlay first click cannot activate after a second frame click or hold inspects the same enemy', t => {
  const f = fixture(t);
  const frame = new EventTarget(); frame.isConnected = true; frame.closest = () => null;
  const overlay = new EventTarget(); overlay.isConnected = true; overlay.closest = () => null;
  const gestures = new Map(); let plays = 0, inspections = 0;
  const cancelBoth = () => { for (const gesture of gestures.values()) gesture.cancel(); };
  for (const surface of [overlay, frame]) gestures.set(surface, bindCombatantInspectionGesture(surface, {
    isSelected: () => true, canInspect: () => true, activate: () => plays++, onPress: cancelBoth,
    open: () => { cancelBoth(); inspections++; },
  }));
  f.emit(overlay, 'click'); f.tick(100); f.emit(frame, 'click', { detail: 2 }); f.tick(700);
  assert.deepEqual({ plays, inspections }, { plays: 0, inspections: 1 });
  f.emit(overlay, 'click'); f.tick(100); f.emit(frame, 'pointerdown'); f.tick(600); f.emit(f.win, 'pointerup'); f.emit(frame, 'click'); f.tick(700);
  assert.deepEqual({ plays, inspections }, { plays: 0, inspections: 2 });
  for (const gesture of gestures.values()) gesture.release();
});


test('keyboard target activation keeps its existing immediate button behavior', t => {
  const f = fixture(t); assert.equal(f.emit(f.frame, 'click', { detail: 0 }).defaultPrevented, false);
  f.tick(700); assert.deepEqual(f.counts(), { plays: 0, inspections: 0 });
});
