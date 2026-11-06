import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyExpansion } from '../src/content/enemyExpansion.js';
import { ENEMY_POSES } from '../src/content/enemyArt.js';
import { enemyActionPose } from '../src/model/enemyActionPose.js';
import { enemyExpansionSprite } from '../src/ui/enemyExpansionStage.js';
import { stageFor } from '../src/ui/services/PoseAnimator.js';
import { installMockRaf, tickFrames } from './helpers/mock-raf.mjs';

test('enemy expansion covers canonical enemies with complete 260ms sequences', () => {
  assert.deepEqual(Object.keys(enemyExpansion).sort(), [...ENEMY_POSES].sort());
  for (const art of Object.values(enemyExpansion)) {
    assert.equal(art.poses.length, 24);
    assert.equal(Object.keys(art.actions).length, 6);
    for (const sequence of Object.values(art.actions)) {
      assert.equal(sequence.reduce((sum, frame) => sum + frame.duration, 0), 260);
      for (const frame of sequence) assert.ok(art.poses.includes(frame.pose));
    }
  }
});

test('committed spell and physical ranged actions choose separate sequences', () => {
  assert.equal(enemyActionPose('attack', { family: 'projectile', casting: true }), 'magicAttack');
  assert.equal(enemyActionPose('attack', { family: 'projectile' }), 'projectile');
  assert.equal(enemyActionPose('attack', { family: 'sweep' }), 'sweep');
  assert.equal(enemyActionPose('block'), 'guard');
});

test('enemy stage settles reactions, extends holds, and keeps defeat terminal', async t => {
  const oldDocument = globalThis.document, oldImage = globalThis.Image;
  class Element { constructor() { this.dataset = {}; this.style = {}; } append() {} addEventListener() {} setAttribute() {} }
  let reduced = false;
  globalThis.document = { createElement: () => new Element(), body: { classList: { contains: () => reduced } } };
  globalThis.Image = Element;
  t.after(() => { globalThis.document = oldDocument; globalThis.Image = oldImage; });
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  installMockRaf(t);
  const el = enemyExpansionSprite({ id: 'wanderingSoldier', name: 'Soldier' }, { hp: 10, maxHp: 10 });
  const stage = stageFor(el);
  assert.equal(el.dataset.pose, 'idle');
  stage.play('attack', 260);
  assert.equal(el.dataset.pose, 'attack-01');
  // Re-pinned 2026-11-02 (sprite pacing): the four frames are held evenly on a rAF clock, each for the frame hold
  // (125 ms at the default speed and the 550 ms default Animation step, 2026-11-06) instead of the authored 70/60/60/70 weights over 260 ms.
  tickFrames(t, 130);
  assert.equal(el.dataset.pose, 'attack-02');
  stage.hold(100);
  tickFrames(t, 340);
  assert.equal(el.dataset.pose, 'attack-02', 'a hold freezes the frame and pushes the settle out');
  tickFrames(t, 140);
  assert.equal(el.dataset.pose, 'idle');
  stage.setState({ hp: 10, maxHp: 10, block: 4 });
  assert.equal(el.dataset.pose, 'block-01', 'resting guard uses a painted frame, not a sequence asset name');
  stage.setState({ hp: 2, maxHp: 10 });
  stage.play('hit', 220);
  t.mock.timers.tick(220);
  assert.equal(el.dataset.pose, 'wounded');
  reduced = true;
  stage.play('attack');
  assert.equal(el.dataset.pose, 'wounded');
  stage.play('defeated');
  assert.equal(stage.play('attack'), false);
  assert.equal(el.dataset.pose, 'defeated');
  stage.dispose();
});

test('an enemy action holds every frame for the same time, never under the pace frame hold, and reserves that total', async t => {
  const { actionPacing, setAnimSpeed, setCombatPacing } = await import('../src/ui/animationPace.js');
  const oldDocument = globalThis.document, oldImage = globalThis.Image;
  class Element { constructor() { this.dataset = {}; this.style = {}; } append() {} addEventListener() {} setAttribute() {} }
  globalThis.document = { createElement: () => new Element(), body: { classList: { contains: () => false } } };
  globalThis.Image = Element;
  t.after(() => { globalThis.document = oldDocument; globalThis.Image = oldImage; setAnimSpeed('normal'); setCombatPacing(); });
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  installMockRaf(t);
  setAnimSpeed('fast'); setCombatPacing({ combatSpeed: 1.25 }); // the phone default: the 87 ms lunge used to give 22 ms a frame
  const speed = actionPacing().spriteSpeed;
  const el = enemyExpansionSprite({ id: 'wanderingSoldier', name: 'Soldier' }, { hp: 10, maxHp: 10 });
  const stage = stageFor(el);
  const timing = stage.actionTiming('attack', speed);
  assert.equal(timing.totalMs, speed.minFrameMs * 4, 'four frames at the frame hold, not the 87 ms lunge');
  assert.equal(timing.impactMs, Math.round(timing.totalMs * 0.55), 'contact stays at the lunge share of the total');
  assert.equal(stage.actionTiming('ranged', speed).totalMs, speed.minFrameMs * 2);
  assert.equal(stage.actionTiming('nonsense', speed), null);
  const seen = [];
  stage.play('attack', timing.totalMs);
  for (let ms = 0; ms <= timing.totalMs + 32; ms += 4) { if (seen.at(-1)?.[0] !== el.dataset.pose) seen.push([el.dataset.pose, ms]); t.mock.timers.tick(4); }
  assert.deepEqual(seen.map(row => row[0]), ['attack-01', 'attack-02', 'attack-03', 'attack-04', 'idle']);
  const holds = seen.slice(1).map((row, i) => row[1] - seen[i][1]).slice(0, 3);
  assert.ok(holds.every(ms => ms >= speed.minFrameMs - 16 && ms <= speed.minFrameMs + 16), `even holds, got ${holds}`);
  setAnimSpeed('instant');
  assert.equal(stage.actionTiming('attack', actionPacing().spriteSpeed).totalMs, 0, 'Instant plays nothing');
});
