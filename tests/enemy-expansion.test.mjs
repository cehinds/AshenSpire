import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyExpansion } from '../src/content/enemyExpansion.js';
import { ENEMY_POSES } from '../src/content/enemyArt.js';
import { enemyActionPose } from '../src/model/enemyActionPose.js';
import { enemyExpansionSprite } from '../src/ui/enemyExpansionStage.js';
import { stageFor } from '../src/ui/services/PoseAnimator.js';

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
  const el = enemyExpansionSprite({ id: 'wanderingSoldier', name: 'Soldier' }, { hp: 10, maxHp: 10 });
  const stage = stageFor(el);
  assert.equal(el.dataset.pose, 'idle');
  stage.play('attack', 260);
  assert.equal(el.dataset.pose, 'attack-01');
  t.mock.timers.tick(71);
  assert.equal(el.dataset.pose, 'attack-02');
  stage.hold(100);
  t.mock.timers.tick(190);
  assert.equal(el.dataset.pose, 'attack-02');
  t.mock.timers.tick(100);
  assert.equal(el.dataset.pose, 'idle');
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
