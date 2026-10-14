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
  assert.deepEqual(childModel(model, UI.reactionToggle).properties, { enabled: false, disabled: true });
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
