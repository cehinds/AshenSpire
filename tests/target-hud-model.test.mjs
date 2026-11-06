import test from 'node:test';
import assert from 'node:assert/strict';
import { targetHudMatchup, TARGET_HUD_AURA, targetHudConfig, targetHudEnabled, createTargetHudDwell, miniHudScale, enemyHudPlacement, playerHudPlacement } from '../src/ui/models/TargetHudModel.js';

// Owner 2026-11-06: "keep enemy mini HUDs above them in a fixed position; keep the player hud anchored to the right and
// fixed". The avoidance and packing contract (placeTargetHudPanels, placeEnemyPanelRows, targetHudEnemyRowWidth,
// targetHudSide, targetHudPinnedWidth, targetHudIntentObstacle, targetHudPanelSizing) is gone with its code; its sixteen
// tests (player right in every lane, narrowing to fit, own-sprite and player-only obstacles, lone/crowded sides, rows under
// their enemies, tight top inset, intent obstacles, hand clearance) are replaced by the fixed-placement tests below.

test('target details support every alternative formation form factor', () => {
  const config = JSON.parse(readFileSync(new URL('../content/config/ui/components/combatTargetHud.json', import.meta.url)));
  for (const formFactor of ['mobile', 'tablet', 'desktop', 'widescreen']) assert.equal(targetHudEnabled({ formFactor }, config), true);
  assert.equal(targetHudEnabled({ formFactor: 'desktop', layout: 'cards' }), false);
});
function clock() {
  let now = 0, serial = 0; const jobs = new Map();
  return { schedule(fn, delay) { const id = ++serial; jobs.set(id, { fn, at: now + delay }); return id; }, cancel(id) { jobs.delete(id); },
    advance(ms) { now += ms; for (const [id, job] of jobs) if (job.at <= now) { jobs.delete(id); job.fn(); } }, get pending() { return jobs.size; } };
}
test('enter, exit, and stable switch each use one 500ms clock, content updates do not restart it', () => {
  const time = clock(), changes = [], dwell = createTargetHudDwell({ onChange: ids => changes.push(ids), schedule: time.schedule, cancel: time.cancel });
  dwell.request(['left']); time.advance(499); assert.deepEqual(changes, []);
  dwell.request(['left']); time.advance(1); assert.deepEqual(changes, [['left']]);
  dwell.request(['middle']); time.advance(250); dwell.request(['right']); time.advance(499);
  assert.deepEqual(dwell.current, ['left']); time.advance(1); assert.deepEqual(dwell.current, ['right']);
  dwell.request([]); time.advance(499); assert.deepEqual(dwell.current, ['right']);
  dwell.request(['right']); time.advance(1); assert.deepEqual(dwell.current, ['right'], 'returning across the pointer corridor cancels leave');
  dwell.request([]); time.advance(500); assert.deepEqual(dwell.current, []);
  dwell.request(['enemy1', 'enemy2', 'enemy3']); time.advance(500); assert.deepEqual(dwell.current, ['enemy1', 'enemy2', 'enemy3']);
  dwell.request(['player']); assert.equal(time.pending, 1); dwell.dispose(); time.advance(500);
  assert.deepEqual(changes.at(-1), ['enemy1', 'enemy2', 'enemy3']); assert.equal(time.pending, 0);
});
test('selected-card matchup follows authored stances and never reads hidden amounts or profiles', () => {
  const rules = { matchups: { attack: ['smash', 'prepared'], counter: ['attack'] } };
  const action = { maneuver: 'attack' };
  assert.equal(targetHudMatchup(action, { profile: { maneuver: 'smash' } }, rules), 'advantage');
  assert.equal(targetHudMatchup(action, { profile: { maneuver: 'counter' } }, rules), 'disadvantage');
  assert.equal(targetHudMatchup(action, { profile: { maneuver: 'defend' } }, rules), 'neutral');
  assert.equal(targetHudMatchup(action, { profile: { maneuver: 'casting' } }, rules), 'advantage');
  assert.equal(targetHudMatchup(action, { hidden: true, get profile() { throw new Error('private intent accessed'); } }, rules), 'neutral');
  assert.equal(targetHudMatchup(action, { revealed: false, get profile() { throw new Error('private intent accessed'); } }, rules), 'neutral');
  assert.equal(targetHudMatchup(action, { stance: 'smashing' }, rules), 'advantage');
  assert.equal(targetHudMatchup(action, { profile: { maneuver: 'smash' } }, null), 'neutral');
  assert.equal(targetHudMatchup(null, { profile: { maneuver: 'smash' } }, rules), 'neutral');
  assert.deepEqual(Object.keys(TARGET_HUD_AURA), ['advantage','neutral','disadvantage']);
});

// Owner 2026-11-06: fixed mini HUDs. Each is placed from its own figure alone; no avoidance, no packing.
test('miniHudScale fits the HUD to its cell and never drops the font below the readable minimum', () => {
  const config = { designWidthPx: 140, baseFontPx: 13, minFontPx: 9, maxScale: 1.4 };
  assert.deepEqual(miniHudScale({ cellWidth: 140, config }), { scale: 1, fontPx: 13 });
  assert.equal(miniHudScale({ cellWidth: 280, config }).scale, 1.4, 'a wide cell stops at the maximum scale');
  const narrow = miniHudScale({ cellWidth: 40, config });
  assert.ok(Math.abs(narrow.fontPx - 9) < 1e-9, 'a narrow cell stops at the 9px minimum font');
  assert.ok(miniHudScale({ cellWidth: 100, config }).fontPx < 13);
});

test('an enemy HUD is centred on its figure with its bottom at the head, and only the screen edge moves it', () => {
  const bounds = { left: 0, top: 0, width: 390, height: 600 };
  assert.deepEqual(enemyHudPlacement({ centerX: 200, bottom: 300, width: 100, height: 60, bounds }), { left: 150, top: 240 });
  // Neighbours are never consulted: the same input gives the same answer, overlap accepted.
  assert.deepEqual(enemyHudPlacement({ centerX: 230, bottom: 300, width: 100, height: 60, bounds }), { left: 180, top: 240 });
  assert.equal(enemyHudPlacement({ centerX: 10, bottom: 300, width: 100, height: 60, bounds }).left, 0, 'left screen edge');
  assert.equal(enemyHudPlacement({ centerX: 385, bottom: 300, width: 100, height: 60, bounds }).left, 290, 'right screen edge');
  assert.equal(enemyHudPlacement({ centerX: 200, bottom: 20, width: 100, height: 60, bounds }).top, 0, 'top screen edge');
});

test('the player HUD stands right of the body at its top and is not moved by anything but the screen edge', () => {
  const bounds = { left: 0, top: 0, width: 390, height: 600 };
  const anchor = { left: 40, width: 60, top: 320 };
  assert.deepEqual(playerHudPlacement({ anchor, width: 110, height: 70, gap: 6, bounds }), { left: 106, top: 320 });
  assert.equal(playerHudPlacement({ anchor: { ...anchor, left: 300 }, width: 110, height: 70, gap: 6, bounds }).left, 280, 'right screen edge');
  assert.equal(playerHudPlacement({ anchor: { ...anchor, top: 590 }, width: 110, height: 70, gap: 6, bounds }).top, 530, 'bottom screen edge');
});

import { playerMarginPlacement } from '../src/ui/models/TargetHudModel.js';
test('the player margin placement takes the margin, caps it, and refuses one too narrow to clear the board', () => {
  assert.deepEqual(playerMarginPlacement({ right: 1000, edge: 1350, gap: 10, top: 50 }), { width: 340, left: 1010, top: 50 });
  assert.equal(playerMarginPlacement({ right: 1000, edge: 1900, gap: 10, top: 50 }).width, 420, 'capped');
  assert.equal(playerMarginPlacement({ right: 1000, edge: 1185, gap: 10, top: 50 }), null, '175 px of room is under the 180 px floor: no overlap, fall back');
  assert.deepEqual(playerMarginPlacement({ right: 1000, edge: 1190, gap: 10, top: 50 }), { width: 180, left: 1010, top: 50 });
});

test('an enemy panel keeps its name slot (now holding the intent) as the targeting and full-read click target', () => {
  const src = readFileSync(new URL('../src/ui/components/combatTargetHud.js', import.meta.url), 'utf8');
  assert.match(src, /node\('div', 'target-hud-name target-hud-name-intent'\)/);
  assert.match(src, /event\.target\.closest\('\.target-hud-name, \.target-hud-meters'\)/, 'the name slot still confirms a target');
  assert.match(src, /inspect\(id, shell\)/, 'a plain tap on the panel opens the full read');
});
