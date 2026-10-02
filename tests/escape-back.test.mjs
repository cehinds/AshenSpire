// tests/escape-back.test.mjs — Escape and pad B back out of a screen, once
// (docs/FINISH.md §9, "Escape or pad B backs out of every screen").
//
// The production input layer (src/ui/input.js: initInput, its pad poller and
// the `[data-back]` rule) over the kit DOM fixture, with a window and a
// document that deliver a key the way a browser does: window capture, document
// capture, the target and its ancestors, document bubble, window bubble. Each
// case presses ONE Escape and ONE pad B (button 1 of a stubbed gamepad, read by
// the real poller) and counts the screen's Back handler.
//
// Per-screen coverage in a real browser, over every `?shot=` state, is
// tools/escape-back.mjs; this file is the part that runs in the suite.
//   node --test tests/escape-back.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withKitDom } from './helpers/kit-dom.mjs';

// ---- the fixture: a browser's keydown path over the kit DOM -----------------
let dom = null;
withKitDom((d, win) => {
  dom = d;
  // Keep the kit globals for the whole file (withKitDom restores on return).
  queueMicrotask(() => {
    Object.assign(globalThis, win, overrides());
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => (pad.connected ? [pad] : []) } });
  });
});
await new Promise((done) => setTimeout(done, 0));

function overrides() {
  const { document } = dom;
  const winListeners = [];
  const docListeners = [];
  const on = (list) => (type, fn, opt) => list.push({ type, fn, capture: opt === true || !!opt?.capture });
  const off = (list) => (type, fn) => { const i = list.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) list.splice(i, 1); };
  const run = (event, list, capture) => {
    for (const l of list.filter((x) => x.type === event.type && x.capture === capture)) {
      if (event.immediatePropagationStopped) return;
      l.fn(event);
    }
  };
  const windowTarget = { tagName: undefined };
  function deliver(target, event) {
    event.target = target;
    const chain = [];
    for (let at = target?.parentNode !== undefined ? target : null; at; at = at.parentNode) chain.push(at);
    run(event, winListeners, true);
    if (target !== windowTarget && !event.propagationStopped) run(event, docListeners, true);
    for (const node of chain) {
      if (event.propagationStopped) break;
      for (const fn of [...(node.listeners.get(event.type) || [])]) { if (event.immediatePropagationStopped) break; fn(event); }
    }
    if (target !== windowTarget && !event.propagationStopped) run(event, docListeners, false);
    if (!event.propagationStopped) run(event, winListeners, false);
    return !event.defaultPrevented;
  }
  document.addEventListener = on(docListeners);
  document.removeEventListener = off(docListeners);
  document.dispatchEvent = (event) => deliver(document, event);
  // The act map draws SVG; the fixture's elements stand in for it.
  document.createElementNS = (_ns, tag) => document.createElement(tag);
  const proto = Object.getPrototypeOf(document.body);
  Object.defineProperty(proto, 'ownerSVGElement', { configurable: true, get() { for (let at = this.parentNode; at; at = at.parentNode) if (at.tagName === 'SVG') return at; return null; } });
  proto.getScreenCTM = () => null;
  // `hidden` reflects its attribute, as in a browser (the map legend toggles it).
  Object.defineProperty(proto, 'hidden', { configurable: true, get() { return this.hasAttribute('hidden'); }, set(on) { if (on) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); } });
  const app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);
  return {
    window: globalThis,
    addEventListener: on(winListeners),
    removeEventListener: off(winListeners),
    dispatchEvent: (event) => deliver(windowTarget, event),
    getComputedStyle: () => ({ visibility: 'visible', display: 'block', getPropertyValue: () => '', zIndex: '0' }),
    CSS: { escape: (s) => String(s) },
    location: { search: '', hash: '', href: 'http://localhost/', pathname: '/', protocol: 'http:' },
    devicePixelRatio: 1,
    requestAnimationFrame: (fn) => setTimeout(() => fn(0), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    __deliver: deliver,
  };
}

const pad = { connected: false, index: 0, id: 'escape-back-test-pad', mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const input = await import('../src/ui/input.js');
input.setKeyBindings(null);
// A pad already connected at load: initInput's own branch starts the poller.
pad.connected = true;
input.initInput({ getSettings: () => ({}) });
await wait(40);

const app = () => dom.document.getElementById('app');
const PRESSES = {
  /** One physical Escape, at the focused element (or the body). The Back
   *  rule decides after the whole dispatch (a task), so the press waits one. */
  async Escape() {
    const event = new dom.Event('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'isTrusted', { value: true });
    globalThis.__deliver(dom.document.activeElement || dom.document.body, event);
    await wait(10);
  },
  /** One pad B: press and release button 1 through the real poller. */
  async 'pad B'() {
    pad.buttons[1] = { pressed: true, value: 1 };
    await wait(40);
    pad.buttons[1] = { pressed: false, value: 0 };
    await wait(40);
  },
};

function resetDom() {
  for (const node of [...dom.document.body.children]) if (node.id !== 'app') node.remove();
  app().innerHTML = '';
  dom.document.activeElement = dom.document.body;
}

// ---- the screens ------------------------------------------------------------

for (const [name, press] of Object.entries(PRESSES)) {
  test(`${name}: Run history's Back runs exactly once`, async () => {
    resetDom();
    const { mountHistory } = await import('../src/ui/screens/history.js');
    let backs = 0;
    mountHistory(app(), { meta: { results: [] }, onBack: () => { backs += 1; } });
    assert.ok(app().querySelector('#hx-back[data-back]'), 'the Back is marked');
    await press();
    assert.equal(backs, 1);
  });

  test(`${name}: the quest board's Leave (back to the place) runs exactly once`, async () => {
    resetDom();
    const { contentBundle } = await import('../src/content/index.js');
    const { createRegistries } = await import('../src/model/registries.js');
    const { createRunState } = await import('../src/model/state.js');
    const { mountQuestBoard } = await import('../src/ui/screens/questBoard.js');
    const registries = createRegistries(contentBundle);
    const { ATLAS, generateJourney } = await import('../src/model/worldAtlas.js');
    const run = createRunState({ seed: 123, classId: 'reaver', registries });
    run.journey = generateJourney('BOARD0');
    const row = ATLAS.data.node_quests[0];
    const point = ATLAS.data.local_map_nodes.find((p) => p.nodeId === row.nodeId);
    const ownerNodeId = point ? ATLAS.localMaps[point.mapId].ownerNodeId : row.nodeId;
    app().innerHTML = '<div class="quest-board-screen"></div>';
    let leaves = 0;
    let opened = 0;
    mountQuestBoard(app(), { registries, run, meta: {}, ownerNodeId, onOpen: () => { opened += 1; }, onDone: () => { leaves += 1; } });
    await press();
    assert.equal(leaves, 1);
    assert.equal(opened, 0);
  });

  test(`${name}: a dialog over a screen closes, and the screen's Back does not run`, async () => {
    resetDom();
    const { mountHistory } = await import('../src/ui/screens/history.js');
    const { openModal } = await import('../src/ui/components/modalShell.js');
    let backs = 0;
    let closes = 0;
    mountHistory(app(), { meta: { results: [] }, onBack: () => { backs += 1; } });
    const door = openModal({ title: 'Settings', body: dom.document.createElement('p'), onClose: () => { closes += 1; } });
    door.veil.classList.add('modal-veil');
    await press();
    assert.equal(closes, 1, 'the dialog closed once');
    assert.equal(backs, 0, 'the screen under it stayed');
  });

  test(`${name}: a screen that answers Escape itself is not backed out as well`, async () => {
    resetDom();
    let backs = 0;
    let own = 0;
    const back = dom.document.createElement('button');
    back.setAttribute('data-back', '');
    back.addEventListener('click', () => { backs += 1; });
    app().appendChild(back);
    const mine = (event) => { if (event.key === 'Escape') { own += 1; event.preventDefault(); } };
    dom.document.addEventListener('keydown', mine, true);
    try {
      await press();
    } finally {
      dom.document.removeEventListener('keydown', mine, true);
    }
    assert.equal(own, 1);
    assert.equal(backs, 0);
  });

  // Review of #1463 (Codex PRRT_kwDOTLMIe86oSP_w): the Armoury answers Escape
  // on the document and removes its veil without preventDefault. The press was
  // aimed at the Armoury, so the screen under it must not back out as well.
  test(`${name}: a layer that closes itself without consuming the press does not take the screen's Back with it`, async () => {
    resetDom();
    const { mountHistory } = await import('../src/ui/screens/history.js');
    let backs = 0;
    mountHistory(app(), { meta: { results: [] }, onBack: () => { backs += 1; } });
    const veil = dom.document.createElement('div');
    veil.classList.add('modal-veil');
    veil.setAttribute('aria-modal', 'true');
    dom.document.body.appendChild(veil);
    const armoury = (event) => { if (event.key === 'Escape') veil.remove(); };
    dom.document.addEventListener('keydown', armoury);
    try {
      await press();
    } finally {
      dom.document.removeEventListener('keydown', armoury);
    }
    assert.equal(veil.isConnected, false, 'the layer closed');
    assert.equal(backs, 0, 'the screen under it stayed');
  });

  // Review of #1463 (Codex PRRT_kwDOTLMIe86oTFEI, PRRT_kwDOTLMIe86oTXgQ,
  // PRRT_kwDOTLMIe86oUwG6): the flask menu's Cancel listens on the window,
  // registered AFTER input.js's rule, and calls preventDefault. One press
  // closes the menu only. This is the REAL mountFlaskActionMenu; pad B used to
  // back out as well, because its synthesized key was not cancelable.
  test(`${name}: the flask menu over the quest board takes the press alone`, async () => {
    resetDom();
    const { mountFlaskActionMenu } = await import('../src/ui/components/flask.js');
    const { contentBundle } = await import('../src/content/index.js');
    const { createRegistries } = await import('../src/model/registries.js');
    const { createRunState } = await import('../src/model/state.js');
    const { ATLAS, generateJourney } = await import('../src/model/worldAtlas.js');
    const { mountQuestBoard } = await import('../src/ui/screens/questBoard.js');
    const registries = createRegistries(contentBundle);
    const run = createRunState({ seed: 123, classId: 'reaver', registries });
    run.journey = generateJourney('BOARD0');
    const row = ATLAS.data.node_quests[0];
    const point = ATLAS.data.local_map_nodes.find((p) => p.nodeId === row.nodeId);
    const ownerNodeId = point ? ATLAS.localMaps[point.mapId].ownerNodeId : row.nodeId;
    app().innerHTML = '<div class="quest-board-screen"></div>';
    let leaves = 0;
    let menuCancels = 0;
    mountQuestBoard(app(), { registries, run, meta: {}, ownerNodeId, onOpen: () => {}, onDone: () => { leaves += 1; } });
    const anchor = dom.document.createElement('button');
    dom.document.body.appendChild(anchor);
    const menu = mountFlaskActionMenu(anchor, {
      def: { id: 'test-flask', name: 'Test Flask' },
      plan: { actions: [{ id: 'use', label: 'Use', enabled: true }] },
      onAction: () => {},
      onCancel: () => { menuCancels += 1; },
    });
    assert.ok(menu, 'the menu mounted');
    await press();
    assert.equal(menuCancels, 1, 'the menu closed once');
    assert.equal(leaves, 0, 'the quest board stayed');
  });

  // A hold-to-confirm dropped by Escape (a dialogue response held with pad A
  // or Enter, then B or Escape) is the whole of that press: the dialogue's
  // Back under it does not rewind a beat as well. The REAL armHold.
  test(`${name}: a hold dropped by the press does not take the screen's Back with it`, async () => {
    resetDom();
    const { armHold } = await import('../src/ui/components/holdconfirm.js');
    const { PRESS_EVENT } = await import('../src/ui/gesture.js');
    let backs = 0;
    let confirms = 0;
    const back = dom.document.createElement('button');
    back.setAttribute('data-back', '');
    back.addEventListener('click', () => { backs += 1; });
    const hold = dom.document.createElement('button');
    app().append(hold, back);
    const disarm = armHold(hold, { ms: 60000, onConfirm: () => { confirms += 1; } });
    try {
      // The press door input.js opens for a held key or pad A.
      const took = !hold.dispatchEvent(new dom.Event(PRESS_EVENT, { cancelable: true, detail: { source: name === 'pad B' ? 'pad' : 'key' } }));
      assert.ok(took, 'the hold took the press');
      assert.equal(hold.dataset.hold, 'holding');
      await press();
      assert.notEqual(hold.dataset.hold, 'holding', 'the hold dropped');
    } finally {
      disarm();
    }
    assert.equal(confirms, 0);
    assert.equal(backs, 0, 'the screen under it stayed');
  });

  // Review of #1463 (Codex PRRT_kwDOTLMIe86oTXgN): character creation's menu
  // is a native popover, not a .modal-veil. The press is the popover's: the
  // browser closes it on a real Escape, and the rule closes it for pad B (a
  // synthetic key the browser ignores). The creation step's Back never runs.
  test(`${name}: an open native popover takes the press, not the screen's Back`, async () => {
    resetDom();
    let backs = 0;
    const back = dom.document.createElement('button');
    back.setAttribute('data-back', '');
    back.addEventListener('click', () => { backs += 1; });
    app().appendChild(back);
    // The fixture reads `[popover]:popover-open` as "has a popover attribute",
    // so an element carrying one stands for a popover the browser shows.
    const menu = dom.document.createElement('div');
    menu.setAttribute('popover', 'auto');
    let hidden = 0;
    menu.hidePopover = () => { hidden += 1; menu.remove(); };
    app().appendChild(menu);
    await press();
    assert.equal(backs, 0, 'the creation step stayed');
    assert.equal(hidden, name === 'pad B' ? 1 : 0, 'pad B closes the popover; the browser closes it on a real Escape');
  });

  // Review of #1463 (Codex, input.js ~836): character creation's Equipment
  // stage paints its card-info button in the top layer with popover="manual"
  // (components/creationInfoLayer.js). A manual popover is presentation, not a
  // layer the press can close: the browser never closes one on Escape, so
  // stepping aside for it swallowed every physical Escape, and pad B hid the
  // info button. Only a light-dismiss popover takes the press; Back runs.
  test(`${name}: a manual popover (a control painted in the top layer) does not take the press`, async () => {
    resetDom();
    let backs = 0;
    const back = dom.document.createElement('button');
    back.setAttribute('data-back', '');
    back.addEventListener('click', () => { backs += 1; });
    app().appendChild(back);
    const info = dom.document.createElement('button');
    info.setAttribute('popover', 'manual');
    info.classList.add('creation-info-popover');
    let hidden = 0;
    info.hidePopover = () => { hidden += 1; };
    app().appendChild(info);
    await press();
    assert.equal(backs, 1, 'the creation step\'s Back ran once');
    assert.equal(hidden, 0, 'the info button stayed painted');
  });

  // Review of #1463 (Codex, input.js ~832): the map legend is the kit's
  // popover toggled by `hidden` (screens/map.js), not a native popover. With a
  // node selected and the legend open, one press peels the legend only; the
  // tray's Back (#map-back) does not run. The REAL mountMap.
  test(`${name}: the map legend over the node tray takes the press alone`, async () => {
    resetDom();
    const { contentBundle } = await import('../src/content/index.js');
    const { createRegistries } = await import('../src/model/registries.js');
    const { createRunState } = await import('../src/model/state.js');
    const { generateJourney, journeyGraph } = await import('../src/model/worldAtlas.js');
    const { mountMap, releaseMapScreen } = await import('../src/ui/screens/map.js');
    const registries = createRegistries(contentBundle);
    const run = createRunState({ seed: 123, classId: 'reaver', registries });
    run.journey = generateJourney('BOARD0');
    run.mapGraph = journeyGraph(run.journey);
    mountMap(app(), { registries, run, meta: { settings: {} }, onPick: () => {} });
    try {
      const back = app().querySelector('#map-back');
      const legendBtn = app().querySelector('#map-legend');
      const legend = app().querySelector('.map-legend-pop');
      assert.ok(back && legendBtn && legend, 'the map drew its Back, its ? and its legend');
      let backs = 0;
      back.addEventListener('click', () => { backs += 1; });
      legendBtn.click();
      assert.equal(legend.hidden, false, 'the legend opened');
      await press();
      assert.equal(legend.hidden, true, 'the press closed the legend');
      assert.equal(backs, 0, 'the tray\'s Back did not run');
      await press();
      assert.equal(backs, 1, 'the next press is the tray\'s Back');
    } finally {
      releaseMapScreen?.();
    }
  });

  test(`${name}: a disabled Back, or none at all, does nothing`, async () => {
    resetDom();
    let backs = 0;
    const back = dom.document.createElement('button');
    back.setAttribute('data-back', '');
    back.disabled = true;
    back.addEventListener('click', () => { backs += 1; });
    app().appendChild(back);
    await press();
    resetDom();
    await press();
    assert.equal(backs, 0);
  });
}

test('Escape typed in a text field stays the field\'s; pad B still backs out', async () => {
  resetDom();
  let backs = 0;
  const back = dom.document.createElement('button');
  back.setAttribute('data-back', '');
  back.addEventListener('click', () => { backs += 1; });
  const field = dom.document.createElement('input');
  app().append(field, back);
  dom.document.activeElement = field;
  await PRESSES.Escape();
  assert.equal(backs, 0);
  await PRESSES['pad B']();
  assert.equal(backs, 1);
});

test('pad B reaches a document listener, as the keyboard\'s Escape does', async () => {
  resetDom();
  const heard = [];
  const listen = (event) => heard.push(event.key);
  dom.document.addEventListener('keydown', listen, true);
  try {
    await PRESSES['pad B']();
  } finally {
    dom.document.removeEventListener('keydown', listen, true);
  }
  assert.deepEqual(heard, ['Escape']);
});

test('the inventory: every screen with a plain Back marks it, and each row of the browser tool names its reason', async () => {
  const { readFileSync } = await import('node:fs');
  const marked = {
    'src/ui/screens/history.js': '#hx-back',
    'src/ui/screens/compendium.js': '#cp-back',
    'src/ui/screens/customRun.js': '#cr-back',
    'src/ui/screens/customize.js': '#cz-back',
    'src/ui/screens/lobby.js': '#lb-back',
    'src/ui/screens/dialogue.js': '#dialogue-back',
    'src/ui/screens/reward.js': '#reward-back',
    'src/ui/screens/questBoard.js': '#quest-board-leave',
    'src/ui/screens/map.js': '#map-back',
  };
  for (const [file, id] of Object.entries(marked)) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const lines = source.split('\n').filter((line) => line.includes(`id: '${id.slice(1)}'`));
    assert.ok(lines.length, `${file} builds ${id}`);
    for (const line of lines) assert.match(line, /'data-back': ''/, `${file}: ${id} is marked data-back`);
  }
  const { SCREENS, NOT_DRIVEN, READY } = await import('../tools/escape-back.mjs');
  for (const row of SCREENS) {
    assert.ok(READY[row.shot], `${row.id}: ?shot=${row.shot} names the landmark it must show`);
    assert.ok(['back', 'peel', 'leave', 'none', 'popover', 'layer'].includes(row.expect), row.id);
    if (row.expect === 'none') assert.ok(row.why, `${row.id} documents why it has no Back`);
    if (row.expect === 'layer') assert.ok(row.mount && row.back, `${row.id} names its layer and the Back under it`);
    if (row.expect === 'back') assert.ok([...Object.values(marked), '#farewell-back'].includes(row.back), `${row.id}: ${row.back} is a marked Back`);
  }
  assert.ok(SCREENS.some((row) => row.id === 'title' && row.why), 'the title documents its Back');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /id="farewell-back" data-back/, 'the farewell screen marks Return to title');
  assert.ok(SCREENS.some((row) => row.back === '#farewell-back'), 'the farewell screen is a row');
  assert.ok(NOT_DRIVEN.every(([name, how]) => name && how));
});

test.after(async () => {
  // No pad: the poller stops itself, so the process can exit.
  pad.connected = false;
  await wait(40);
});
