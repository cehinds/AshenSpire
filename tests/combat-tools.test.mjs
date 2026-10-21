import test from 'node:test';
import assert from 'node:assert/strict';
import { combatLogEntries } from '../src/model/combatLog.js';
import { withModalDom } from './helpers/modal-dom.mjs';
import { resetModalState, modalOpen } from '../src/ui/modalState.js';
import { mountCombatTools, closeCombatFullLog } from '../src/ui/components/combatTools.js';
import { readFileSync } from 'node:fs';
import { combatLogHeight, combatLogSnapSize, combatLogDragScale, combatToolsModel, COMBAT_LOG_SIZES, COMBAT_LOG_DEFAULT_SIZE } from '../src/ui/models/CombatToolsModel.js';
import { childModel } from '../src/ui/models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../src/ui/models/UiComponentId.js';

test('log contains executed public receipts by round, never predictions or unstarted intent', () => {
  const registries = { cards: new Map([['guardCounter', { name: 'Guard Counter' }]]), enemies: new Map([['soldier', { name: 'Soldier' }]]), statuses: new Map() };
  const events = [{ type: 'enemyActorTurnStarted', sourceId: 'e1', moveId: 'privateFuture' },
    { type: 'enemyIntentPrediction', maneuver: 'secretGuess' },
    { type: 'cardPlayed', playerId: 'p1', cardId: 'guardCounter', staminaSpent: 2, manaSpent: 3, upcastTier: 2 },
    { type: 'enemyMoveStarted', sourceId: 'e1', moveId: 'slash' },
    { type: 'damageDealt', sourceId: 'e1', targetId: 'player', targetPlayerId: 'p1', amount: 7, blocked: 7 },
    { type: 'hpLost', targetPlayerId: 'p1', amount: 7, cause: 'attack' },
    { type: 'playerTurnStart', turn: 2 },
    { type: 'combatReactionChosen', ownerId: 'p1' },
    { type: 'damageDealt', sourceId: 'player', sourcePlayerId: 'p1', targetId: 'e1', amount: 10, blocked: 1 }];
  const rows = combatLogEntries(events, { registries, players: [{ id: 'p1', name: 'Reaver' }], enemies: [{ id: 'e1', enemyId: 'soldier' }] });
  assert.deepEqual(rows.map(row => [row.id, row.round]), [[2, 1], [3, 1], [4, 1], [7, 2], [8, 2]]);
  assert.match(rows[0].text, /Reaver played Guard Counter \(Upcast 2\).*2 SP, 3 MP/);
  assert.equal(rows[2].text, "Soldier's Slash hit Reaver for 7: Block absorbed 7 (7 → 0); 0 HP dealt.");
  assert.equal(rows[4].text, "Reaver's attack hit Soldier for 10: Block absorbed 1 (1 → 0); 9 HP dealt.");
  assert.doesNotMatch(JSON.stringify(rows), /privateFuture|secretGuess|hpLost/);
  assert.deepEqual(combatLogEntries(JSON.parse(JSON.stringify(events)), { registries, players: [{ id: 'p1', name: 'Reaver' }], enemies: [{ id: 'e1', enemyId: 'soldier' }] }), rows);
});

test('log says why no reaction was offered and when a Smash breaks Guard', () => {
  const registries = { cards: new Map([['guardCounter', { name: 'Guard Counter', cardTags: ['maneuver:counter'] }]]),
    enemies: new Map([['soldier', { name: 'Soldier' }]]), statuses: new Map() };
  const why = (reason, extra = {}) => ({ type: 'combatReactionUnavailable', ownerId: 'player', sourceId: 'e1', reason,
    cardIds: ['guardCounter'], attackKind: 'attack', ...extra });
  const events = [why('notCovered', { attackKind: 'sweep' }), why('cost', { resource: 'stamina', need: 1, have: 0 }),
    why('switchOff'), why('attackerStaggered'), why('alreadyAnswered'),
    { type: 'combatGuardBroken', targetId: 'e1', sourceId: 'player', poise: 3 }];
  const rows = combatLogEntries(events, { registries, players: [{ id: 'player', name: 'Reaver' }], enemies: [{ id: 'e1', enemyId: 'soldier' }] });
  assert.deepEqual(rows.map(row => row.text), [
    "No reaction: Counter can't answer a Sweep.",
    'Not enough SP to Counter (need 1, have 0).',
    'No reaction: Reactions are off.',
    'No reaction: Soldier is staggered.',
    "One reaction per attack: the rest of this attack can't be answered.",
    "Reaver's attack broke Soldier's Guard! (+3 Poise pressure)"]);
  const coopRows = combatLogEntries([{ ...why('switchOff'), ownerId: 'p1' }],
    { registries, players: [{ id: 'p1', name: 'Reaver' }, { id: 'p2', name: 'Herald' }] });
  assert.equal(coopRows[0].text, 'Reaver: No reaction: Reactions are off.');
});

test('three log heights use physical card, visible viewport and actual menu clearance', () => {
  const space = { cardHeight: 250, viewportHeight: 900, dockTop: 700, menuBottom: 60, gap: 8 };
  assert.equal(combatLogHeight({ ...space, size: 'Small' }), 125);
  assert.equal(combatLogHeight({ ...space, size: 'Medium' }), 450);
  assert.equal(combatLogHeight({ ...space, size: 'Large' }), 632);
  assert.equal(combatLogHeight({ ...space, size: 'Medium', dockTop: 120 }), (52 / 3 + 52) / 2);
  assert.equal(combatLogHeight({ ...space, size: 'Large', dockTop: 20 }), 0);
});

test('compressed log has distinct ordered stops and gestures snap to the nearest stop', () => {
  const space = { cardHeight: 110, viewportHeight: 513, dockTop: 270, menuBottom: 62, gap: 8 };
  const heights = Object.fromEntries(COMBAT_LOG_SIZES.map(size => [size, combatLogHeight({ ...space, size })]));
  assert(heights.Small < heights.Medium && heights.Medium < heights.Large);
  assert.equal(heights.Large, 200);
  for (const size of COMBAT_LOG_SIZES) assert.equal(combatLogSnapSize(heights[size], heights), size);
  assert.equal(combatLogSnapSize((heights.Small + heights.Medium) / 2 - 1, heights), 'Small');
  assert.equal(combatLogSnapSize((heights.Small + heights.Medium) / 2 + 1, heights), 'Medium');
  assert.equal(combatLogSnapSize((heights.Medium + heights.Large) / 2 + 1, heights), 'Large');
  assert.equal(combatLogSnapSize(-100, heights), 'Small');
  assert.equal(combatLogSnapSize(1000, heights), 'Large');
});

test('log drag can traverse every size without leaving the physical viewport', () => {
  const heights = { Small: 60, Medium: 260, Large: 460 };
  const scale = combatLogDragScale({ heights, viewportHeight: 844, handleBottom: 606 });
  assert.equal(scale, 400 / 120);
  assert.equal((heights.Large - heights.Small) / scale, 120);
  const short = combatLogDragScale({ heights, viewportHeight: 390, handleBottom: 340 });
  assert.equal(short, 400 / 42);
  assert.equal((heights.Large - heights.Small) / short, 42);
  assert.equal(combatLogDragScale({ heights: { Small: 20, Large: 50 }, viewportHeight: 844, handleBottom: 606 }), 1);
  assert.equal(combatLogDragScale({ heights, viewportHeight: 390, handleBottom: 380 }), 400 / 24);
});

test('unsupported historical combat has a disabled switch and immutable public log model', () => {
  const entries = [{ id: 2, round: 1, text: 'A public action.' }];
  const model = combatToolsModel({ supported: false, enabled: true, open: true, size: 'Large', entries });
  assert.deepEqual(childModel(model, UI.reactionToggle).properties, { enabled: false, disabled: true, supported: false });
  assert.equal(childModel(model, UI.combatLogDrawer).properties.open, true);
  entries[0].text = 'Mutated';
  assert.equal(childModel(model, UI.combatLogDrawer).properties.entries[0].text, 'A public action.');
});

test('the combat log opens at Medium, and both screens start from that default', () => {
  assert.equal(COMBAT_LOG_DEFAULT_SIZE, 'Medium');
  assert.equal(childModel(combatToolsModel({ supported: true, enabled: true }), UI.combatLogDrawer).properties.size, 'Medium');
  for (const file of ['src/ui/screens/combat.js', 'src/ui/screens/coop.js']) {
    assert.match(readFileSync(file, 'utf8'), /combatToolsState = \{ open: false, size: COMBAT_LOG_DEFAULT_SIZE, followLatest: true \}/, file);
  }
});

test('both combat screens close the full log when the fight ends or the screen leaves', () => {
  const coop = readFileSync('src/ui/screens/coop.js', 'utf8');
  assert.match(coop, /closeCombatFullLog\(combatToolsState\);\s*if \(combatTools\) \{ combatTools\.release\(\)/, 'coop teardown closes it before release');
  assert.match(coop, /combatLayoutState = \{\};\s*\/\/[^\n]*\n\s*closeCombatFullLog\(combatToolsState\);/, 'coop closes it when the scene leaves combat');
  const solo = readFileSync('src/ui/screens/combat.js', 'utf8');
  assert.match(solo, /closeCombatFullLog\(combatToolsState\);\s*combatTools\.release\(\);/, 'solo leave closes it before release');
});

// A remount rebuilds the tools row, so the screen's state must carry the open
// Full log across it. The layout observers are stubbed: no geometry is read.
function withToolsDom(fn) {
  return withModalDom((dom, win) => {
    const saved = { ResizeObserver: globalThis.ResizeObserver, MutationObserver: globalThis.MutationObserver, innerHeight: globalThis.innerHeight };
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    globalThis.MutationObserver = class { observe() {} disconnect() {} };
    globalThis.innerHeight = 800;
    try { return fn(dom, win); } finally {
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
    }
  });
}

const logRows = [{ id: 1, round: 1, text: 'Reaver played Guard Counter.' }];
const logRowsMore = [...logRows, { id: 2, round: 1, text: 'Soldier used Slash.' }];
const fullLogButton = (combatEl) => combatEl.querySelector('[data-combat-tool="full-log"]');
const closeDoor = (door) => [...door.panel.querySelectorAll('button')].find(node => node.textContent === 'Close').click();

test('a remount keeps the open full log, refreshes its entries and Close returns focus to the new button', () => {
  withToolsDom((dom) => {
    resetModalState();
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    const state = { open: false, size: 'Medium', followLatest: true };
    const first = mountCombatTools(combatEl, { state, onViewChange() {}, onToggle() {} });
    first.update(combatToolsModel({ supported: true, enabled: true, entries: logRows }));
    fullLogButton(combatEl).click();
    const door = state.fullLog;
    assert.ok(door, 'the door opened');
    assert.equal(modalOpen(), true);

    first.release();
    assert.equal(door.panel.isConnected, true, 'release() on a remount leaves the door open');
    assert.equal(state.fullLog, door);

    const second = mountCombatTools(combatEl, { state, onViewChange() {}, onToggle() {} });
    const newButton = fullLogButton(combatEl);
    second.update(combatToolsModel({ supported: true, enabled: true, entries: logRowsMore }));
    assert.equal(state.fullLog, door, 'the same door, not a new one');
    assert.equal(door.panel.querySelectorAll('li').length, logRowsMore.length, 'entries refreshed');

    closeDoor(door);
    assert.equal(door.panel.isConnected, false);
    assert.equal(state.fullLog, null, 'closing clears the handle');
    assert.equal(dom.document.activeElement, newButton, 'focus returns to the new Full log button');
    assert.equal(modalOpen(), false);
    second.release();
  });
});

test('leaving combat closes an open full log for good', () => {
  withToolsDom((dom) => {
    resetModalState();
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    const state = { open: false, size: 'Medium', followLatest: true };
    const tools = mountCombatTools(combatEl, { state, onViewChange() {}, onToggle() {} });
    tools.update(combatToolsModel({ supported: true, enabled: true, entries: logRows }));
    fullLogButton(combatEl).click();
    const door = state.fullLog;
    closeCombatFullLog(state);
    assert.equal(door.panel.isConnected, false, 'the door is gone');
    assert.equal(state.fullLog, null);
    assert.equal(modalOpen(), false);
    tools.release();
  });
});

test('after the reader closes the full log, Full log opens a new one', () => {
  withToolsDom((dom) => {
    resetModalState();
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    const state = { open: false, size: 'Medium', followLatest: true };
    const tools = mountCombatTools(combatEl, { state, onViewChange() {}, onToggle() {} });
    tools.update(combatToolsModel({ supported: true, enabled: true, entries: logRows }));
    fullLogButton(combatEl).click();
    const first = state.fullLog;
    closeDoor(first);
    fullLogButton(combatEl).click();
    assert.ok(state.fullLog && state.fullLog !== first, 'a fresh door opened');
    closeCombatFullLog(state);
    tools.release();
  });
});

test('Full log reads as a text link in the log header, keeping its 44px tap target', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, /\.combat-log-full \{[^}]*min-height:max\(44px/, 'the tap target stays');
  const link = css.match(/\.combat-log-head > \.combat-log-full \{([^}]*)\}/)?.[1] || '';
  for (const rule of [/background:transparent/, /border:0/, /box-shadow:none/, /color:var\(--gold\)/, /font-size:inherit/]) assert.match(link, rule);
  assert.match(css, /\.combat-log-head > \.combat-log-full:is\(:hover, :focus-visible[^)]*\) \{[^}]*text-decoration:underline/);
  assert.match(css, /\.combat-log-head > \.combat-log-full:focus-visible \{[^}]*outline:2px solid/);
});

test('live Grid checkbox waits for persistence and rolls back a refused preference', async () => {
  for (const accepted of [true,false]) {
    let checkbox, settle, root;
    withToolsDom(dom => {
      dom.document.documentElement = {dataset:{formationGrid:'true'}};
      root = dom.document.documentElement;
      const combatEl=dom.document.createElement('section');
      dom.document.body.appendChild(combatEl);
      mountCombatTools(combatEl,{state:{},onViewChange(){},onToggle(){},
        onGridToggle:enabled=>new Promise(resolve=>{settle=()=>{
          if(accepted) root.dataset.formationGrid=String(enabled);
          resolve({ok:accepted});
        };})});
      checkbox=combatEl.querySelector('input[data-combat-tool="grid"]');
      assert.equal(checkbox.getAttribute('aria-label'),'Show battlefield grid');
      assert.equal(checkbox.checked,true);
      checkbox.checked=false;
      checkbox.dispatchEvent(new dom.Event('change'));
      assert.equal(checkbox.disabled,true,'another write cannot race the pending save');
      assert.equal(root.dataset.formationGrid,'true','no optimistic visual-grid change');
      settle();
    });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(checkbox.disabled,false);
    assert.equal(checkbox.checked,!accepted,'control reflects the actually persisted root value');
  }
});

test('Auto switch mirrors the Reaction switch and follows the autoCombat setting', () => {
  withToolsDom((dom) => {
    resetModalState();
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    const settings = { autoCombat: false };
    const writes = [];
    const tools = mountCombatTools(combatEl, { state: {}, onViewChange() {}, onToggle() {},
      onAutoToggle: enabled => { writes.push(enabled); settings.autoCombat = enabled; } });
    const paint = (supported = true) => tools.update(combatToolsModel({ supported, enabled: true, entries: logRows }), { auto: settings.autoCombat });
    paint();
    const auto = combatEl.querySelector('[data-combat-tool="auto"]');
    const reaction = combatEl.querySelector('[data-combat-tool="reaction"]');
    assert.equal(auto.getAttribute('role'), 'switch');
    assert.equal(auto.className.includes('reaction-switch'), true, 'same component style as Reaction');
    assert.equal(auto.nextElementSibling === reaction.nextElementSibling || reaction.nextElementSibling === auto, true, 'sits beside Reaction');
    assert.equal(auto.getAttribute('aria-checked'), 'false');
    assert.equal(auto.getAttribute('aria-label'), 'Auto combat disabled');
    auto.click();
    assert.deepEqual(writes, [true]);
    paint();
    assert.equal(auto.getAttribute('aria-checked'), 'true');
    assert.equal(auto.getAttribute('aria-label'), 'Auto combat enabled');
    settings.autoCombat = false; // the Settings screen turns it off: the next paint follows
    paint();
    assert.equal(auto.getAttribute('aria-checked'), 'false');
    paint(false);
    assert.equal(auto.disabled, true, 'unavailable where reactions are unsupported');
    tools.release();
  });
});

test('Auto switch waits for the write, blocks overlapping toggles and repaints after a rollback', async () => {
  let auto, tools, settle, calls = 0;
  const settings = { autoCombat: false };
  withToolsDom((dom) => {
    resetModalState();
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    tools = mountCombatTools(combatEl, { state: {}, onViewChange() {}, onToggle() {},
      onAutoToggle: enabled => new Promise(resolve => { calls++; settle = () => { resolve({ ok: false }); }; }) });
    tools.update(combatToolsModel({ supported: true, enabled: true, entries: logRows }), { auto: settings.autoCombat });
    auto = combatEl.querySelector('[data-combat-tool="auto"]');
    auto.click();
    assert.equal(auto.disabled, true, 'a pending write blocks another toggle');
    auto.click();
    assert.equal(calls, 1);
    tools.update(combatToolsModel({ supported: true, enabled: true, entries: logRows }), { auto: settings.autoCombat });
    assert.equal(auto.disabled, true, 'a repaint does not re-enable a pending switch');
    settle();
  });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(auto.disabled, false);
  assert.equal(auto.getAttribute('aria-checked'), 'false', 'refused write: still shows the persisted value');
});

test('Auto switch toggles from the live setting after Settings changed it behind the footer', () => {
  withToolsDom((dom) => {
    resetModalState();
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    const settings = { autoCombat: false };
    const writes = [];
    const tools = mountCombatTools(combatEl, { state: {}, onViewChange() {}, onToggle() {},
      readAuto: () => settings.autoCombat,
      onAutoToggle: enabled => { writes.push(enabled); settings.autoCombat = enabled; } });
    const paint = () => tools.update(combatToolsModel({ supported: true, enabled: true, entries: logRows }), { auto: settings.autoCombat });
    paint();
    const auto = combatEl.querySelector('[data-combat-tool="auto"]');
    assert.equal(auto.getAttribute('aria-checked'), 'false');
    settings.autoCombat = true; // Menu > Settings turned it on; the footer has not repainted yet
    auto.click();
    assert.deepEqual(writes, [false], 'a stale switch still toggles the live value off, not a no-op write of true');
    paint();
    assert.equal(auto.getAttribute('aria-checked'), 'false');
    tools.release();
  });
});

test('closing the overlay repaints the combat footer: closeOverlay announces it and combat listens', () => {
  const overlay = readFileSync(new URL('../src/ui/components/overlay.js', import.meta.url), 'utf8');
  const combat = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(overlay, /dispatchEvent\(new CustomEvent\(OVERLAY_CLOSED_EVENT\)\)/);
  assert.match(combat, /addEventListener\(OVERLAY_CLOSED_EVENT, repaintAutoSwitch\)/);
  assert.match(combat, /repaintAutoSwitch = \(\) => \{[^}]*renderCombatTools\(\)/);
  assert.match(combat, /removeEventListener\(OVERLAY_CLOSED_EVENT, repaintAutoSwitch\)/);
  assert.match(combat, /readAuto: \(\) => resolveCombatAutomation\(readSettings\(\)\)\.enabled/);
});

test('a settings save that settles (saved or rolled back) announces it and combat repaints from the settled value', () => {
  const veil = readFileSync(new URL('../src/ui/components/veil.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const combat = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const persist = main.slice(main.indexOf('async function persistSettingsChange'), main.indexOf('const quickMenuControls'));
  // Rollback path: announce sits in a finally after the run restore, so it runs even if the restore throws; then the early return.
  assert.match(persist, /activeSettings = settingsBefore;[\s\S]*finally \{[\s\S]*showSettingsNotice\(QUARANTINE_NOTICE\);\s*announceSettingsSettled\(\);\s*\}\s*return res;/);
  // Success path: announce comes last.
  assert.match(persist, /announceSettingsSettled\(\);\s*return res;\s*}\s*$/);
  assert.equal((persist.match(/announceSettingsSettled\(\)/g) || []).length, 2);
  assert.match(veil, /SETTINGS_SETTLED_EVENT = 'ashenspire:settings-settled'/);
  assert.match(combat, /addEventListener\(SETTINGS_SETTLED_EVENT, repaintAutoSwitch\)/);
  assert.match(combat, /removeEventListener\(SETTINGS_SETTLED_EVENT, repaintAutoSwitch\)/);
});

test('announceSettingsSettled dispatches on window, and combat repaints the footer from the rolled-back value', async () => {
  const { announceSettingsSettled, SETTINGS_SETTLED_EVENT } = await import('../src/ui/components/veil.js');
  const had = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const target = new EventTarget();
  Object.defineProperty(globalThis, 'window', { value: target, configurable: true, writable: true });
  try {
    const settings = { autoCombat: false };
    let painted = null;
    const repaint = () => { painted = settings.autoCombat; };
    target.addEventListener(SETTINGS_SETTLED_EVENT, repaint);
    // Menu toggled Auto on, closed, the footer repainted "on"; then the save failed and rolled back.
    settings.autoCombat = true; repaint();
    assert.equal(painted, true);
    settings.autoCombat = false; // persistSettingsChange rollback
    assert.equal(painted, true, 'no repaint yet: the stale switch is the bug');
    announceSettingsSettled();
    assert.equal(painted, false, 'the settled event repaints from the rolled-back value');
    target.removeEventListener(SETTINGS_SETTLED_EVENT, repaint);
  } finally {
    if (had) Object.defineProperty(globalThis, 'window', had); else delete globalThis.window;
  }
  assert.doesNotThrow(() => announceSettingsSettled(), 'no window: a no-op, not a throw');
});

test('co-op mounts the tools without an Auto switch', () => {
  withToolsDom((dom) => {
    resetModalState();
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    const tools = mountCombatTools(combatEl, { state: {}, onViewChange() {}, onToggle() {} });
    tools.update(combatToolsModel({ supported: true, enabled: true, entries: logRows }));
    assert.equal(combatEl.querySelector('[data-combat-tool="auto"]'), null);
    assert.ok(combatEl.querySelector('[data-combat-tool="reaction"]'));
    tools.release();
  });
});

test('the log palette follows saved settings and refreshes while the modal is open', () => {
  withToolsDom((dom) => {
    resetModalState();
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    let settings = { combatLogPlayerColor: '#73bdff', combatLogEnemyColor: '#ffaaa0' };
    const state = {};
    const tools = mountCombatTools(combatEl, { state, readSettings: () => settings, onViewChange() {}, onToggle() {} });
    const model = combatToolsModel({ supported: true, enabled: true, entries: logRows });
    tools.update(model);
    fullLogButton(combatEl).click();
    const list = state.fullLog.panel.querySelector('.combat-log-modal-entries');
    assert.equal(list.getAttribute('style'), '--combat-log-player-color:#73bdff;--combat-log-enemy-color:#ffaaa0');
    settings = { combatLogPlayerColor: '#84caff', combatLogEnemyColor: '#ff9f96' };
    tools.update(model);
    assert.equal(list.getAttribute('style'), '--combat-log-player-color:#84caff;--combat-log-enemy-color:#ff9f96');
    closeCombatFullLog(state);
    tools.release();
  });
});

test('hidden legacy log stays empty while current receipts and palette reach both readers', () => {
  withToolsDom((dom) => {
    resetModalState();
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    const state = { open: false, size: 'Medium', followLatest: true };
    let settings = { combatLogPlayerColor: '#73bdff', combatLogEnemyColor: '#ffaaa0' };
    const tools = mountCombatTools(combatEl, { state, readSettings: () => settings, onViewChange() {}, onToggle() {} });
    const update = (entries, open = false) => tools.update(combatToolsModel({ supported: true, enabled: true, entries, open }));
    const legacy = combatEl.querySelector('[data-combat-tool="entries"]');
    update(logRows);
    update(logRowsMore);
    assert.equal(combatEl.querySelector('#combat-log').hidden, true);
    assert.equal(legacy.children.length, 0, 'closed readers do not build a second hidden copy of every receipt');

    fullLogButton(combatEl).click();
    const full = state.fullLog;
    assert.deepEqual([...full.panel.querySelectorAll('li')].map(row => row.textContent), logRowsMore.map(row => row.text), 'opening reads the latest receipts, including changes made while closed');
    state.open = true;
    update(logRowsMore, true);
    const drawer = state.drawerLog;
    assert.ok(drawer);
    for (const reader of [full, drawer]) {
      assert.equal(reader.panel.getAttribute('aria-modal'), 'true');
      assert.equal(reader.panel.querySelector('.combat-log-modal-entries').getAttribute('role'), 'region');
    }

    settings = { combatLogPlayerColor: '#84caff', combatLogEnemyColor: '#ff9f96' };
    const newest = [...logRowsMore, { id: 3, round: 2, text: 'Reaver dealt 9 damage.' }];
    update(newest, true);
    for (const reader of [full, drawer]) {
      assert.deepEqual([...reader.panel.querySelectorAll('li')].map(row => row.textContent), newest.map(row => row.text));
      assert.equal(reader.panel.querySelector('.combat-log-modal-entries').getAttribute('style'), '--combat-log-player-color:#84caff;--combat-log-enemy-color:#ff9f96');
    }
    assert.equal(legacy.children.length, 0, 'live readers do not repopulate the unused legacy region');

    update([], true);
    for (const reader of [full, drawer]) assert.equal(reader.panel.querySelectorAll('li').length, 0, 'clearing receipts refreshes every open reader');
    closeCombatFullLog(state);
    fullLogButton(combatEl).click();
    assert.equal(state.fullLog.panel.querySelectorAll('li').length, 0, 'reopening after clear cannot revive stale receipts');
    assert.equal(logRowsMore.length, 2, 'reading and clearing do not mutate the supplied receipt history');
    closeCombatFullLog(state);
    tools.release();
  });
});
