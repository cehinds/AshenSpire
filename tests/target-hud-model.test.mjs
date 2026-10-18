import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { targetHudMatchup, targetHudPanelSizing, TARGET_HUD_AURA, targetHudConfig, targetHudEnabled, targetHudSide, placeTargetHudPanels, targetHudOverlaps, createTargetHudDwell } from '../src/ui/models/TargetHudModel.js';

test('target details support every alternative formation form factor', () => {
  const config = JSON.parse(readFileSync(new URL('../content/config/ui/components/combatTargetHud.json', import.meta.url)));
  for (const formFactor of ['mobile', 'tablet', 'desktop', 'widescreen']) assert.equal(targetHudEnabled({ formFactor, classic: false }, config), true);
  assert.equal(targetHudEnabled({ formFactor: 'desktop', classic: true }), false);
  assert.equal(targetHudEnabled({ formFactor: 'desktop', classic: false, layout: 'cards' }), false);
  assert.deepEqual([0, 1, 2].map(lane => targetHudSide('enemy', lane)), ['left', 'below', 'right']);
  assert.deepEqual([0, 1, 2].map(lane => targetHudSide('player', lane)), ['right', 'right', 'right']);
});
test('player panel stays right of the player in every lane, even when enemies crowd that side', () => {
  for (const lane of [0, 1, 2]) {
    const bounds = { left: 0, top: 0, width: 390, height: 500 };
    const player = { id: 'p', role: 'player', lane, anchor: { left: 120, top: 260, width: 90, height: 140 }, width: 145, height: 100 };
    const enemies = [0, 1, 2].map(i => ({ id: `e${i}`, role: 'enemy', lane: i, anchor: { left: 20 + i * 120, top: 60, width: 90, height: 120 }, width: 145, height: 100 }));
    const obstacles = [{ left: 215, top: 250, width: 60, height: 60 }];
    const placed = placeTargetHudPanels({ bounds, panels: [...enemies, player], obstacles }).find(row => row.id === 'p');
    assert.ok(placed.left >= player.anchor.left + player.anchor.width - 1, `lane ${lane}: player HUD at ${placed.left} left of the player`);
  }
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
test('six crowded enemy panels remain visible, distinct and above the hand at desktop sizes', () => {
  for (const width of [1366, 1440, 1920]) {
    const bounds = { left: 0, top: 80, width, height: width === 1366 ? 430 : 500 };
    const panels = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, role: 'enemy', lane: i % 3,
      anchor: { left: width * (.32 + i % 3 * .22), top: 125 + Math.floor(i / 3) * 130, width: 105, height: 135 },
      width: width < 1400 ? 198 : 224, height: 125 }));
    const result = placeTargetHudPanels({ bounds, panels });
    assert.equal(new Set(result.map(row => row.id)).size, 6);
    for (const panel of result) {
      assert.ok(panel.left >= bounds.left && panel.top >= bounds.top);
      assert.ok(panel.left + panel.width <= bounds.left + bounds.width);
      assert.ok(panel.top + panel.height <= bounds.top + bounds.height);
      for (const other of result) if (panel !== other) assert.equal(targetHudOverlaps(panel, other), false, `${width}: ${panel.id}/${other.id}`);
    }
  }
  assert.equal(targetHudConfig().motion.dwellMs, 500);
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

test('three mobile detail groups fit at 390x844 without covering sprites or the hand', () => {
  const config = JSON.parse(readFileSync(new URL('../content/config/ui/components/combatTargetHud.json', import.meta.url)));
  const sizing = targetHudPanelSizing({ viewportWidth: 390, count: 3 }, config);
  assert.equal(sizing.width, 145); assert.equal(sizing.font, 11);
  assert.equal(targetHudPanelSizing({ viewportWidth: 390, count: 1 }, config).width, 198);
  const sprites = [{ left: 22, top: 349, width: 90, height: 95 },
    ...[66, 180, 294].map(left => ({ left, top: 148, width: 66, height: 81 }))];
  const panels = sprites.slice(1).map((anchor, index) => ({ id: `e${index}`, role: 'enemy', lane: index, anchor, width: sizing.width + 25, height: 98 }));
  const result = placeTargetHudPanels({ bounds: { left: 0, top: 100, width: 390, height: 460 }, panels, obstacles: sprites, config });
  assert.equal(result.length, 3);
  for (const panel of result) {
    assert.ok(panel.left >= 0 && panel.left + panel.width <= 390);
    assert.ok(panel.top >= 100 && panel.top + panel.height <= 560, 'detail stays above hand at 600px');
    for (const sprite of sprites) assert.equal(targetHudOverlaps(panel, sprite), false, `${panel.id} covers sprite`);
    for (const other of result) if (other !== panel) assert.equal(targetHudOverlaps(panel, other), false, `${panel.id}/${other.id}`);
  }
});

test('empty legacy leading hosts do not block otherwise clear panel space', () => {
  assert.equal(targetHudOverlaps({ left: 12, top: 267, width: 170, height: 80 }, { left: 2, top: 325, width: 130, height: 0 }), false);
  assert.equal(targetHudOverlaps({ left: 12, top: 267, width: 170, height: 80 }, { left: 20, top: 290, width: 0, height: 100 }), false);
});
