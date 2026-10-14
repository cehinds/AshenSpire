import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_POSES } from '../src/content/enemyArt.js';
import { act1Enemies } from '../src/content/enemies/act1.js';
import { act2Enemies } from '../src/content/enemies/act2.js';
import { act3Enemies } from '../src/content/enemies/act3.js';
import { enemyExpansion } from '../src/content/enemyExpansion.js';
import { enemyStanceSprites, enemyStanceAssets, ENEMY_STANCE_FAMILIES } from '../src/content/enemyStanceSprites.js';
import { readFileSync } from 'node:fs';
import { enemyStanceCategory } from '../src/model/enemyStancePose.js';
import { concealIntent } from '../src/model/combatIntentVisibility.js';
import { enemyExpansionSprite } from '../src/ui/enemyExpansionStage.js';
import { stageFor } from '../src/ui/services/PoseAnimator.js';
import { projectLanSnapshot } from '../tools/lan-state.mjs';
import { coopEnemyIntent } from '../src/ui/models/CoopIntentModel.js';

test('all 33 enemies have six valid held stance frames without altering action clips', () => {
  const canonical = [...act1Enemies, ...act2Enemies, ...act3Enemies].map(enemy => enemy.id).sort();
  assert.deepEqual(Object.keys(enemyStanceSprites).sort(), canonical, 'new canonical enemies cannot silently lack held stances');
  assert.equal(ENEMY_POSES.length, 33);
  assert.deepEqual(Object.keys(enemyStanceSprites).sort(), [...ENEMY_POSES].sort());
  for (const id of ENEMY_POSES) {
    assert.deepEqual(Object.keys(enemyStanceSprites[id]), ENEMY_STANCE_FAMILIES);
    for (const [category, pose] of Object.entries(enemyStanceSprites[id])) {
      assert.equal(enemyStanceAssets[id][category], `assets/enemy-poses/expansion/${id}/${pose}.webp`);
      if (!pose.startsWith('stance-')) assert.ok(enemyExpansion[id].poses.includes(pose), `${id}: ${pose}`);
      else { assert.equal(pose, `stance-${category}`); assert.ok(!enemyExpansion[id].poses.includes(pose), 'additive hold does not replace a committed frame'); }
    }
    for (const clip of Object.values(enemyExpansion[id].actions)) assert.equal(clip.reduce((sum, frame) => sum + frame.duration, 0), 260);
  }
});

test('every held stance asset is published in both pinned art tiers', () => {
  const manifest = JSON.parse(readFileSync(new URL('../art-manifest.json', import.meta.url), 'utf8'));
  for (const [id, stances] of Object.entries(enemyStanceAssets)) for (const [category, assetId] of Object.entries(stances)) {
    assert.ok(manifest.assets[assetId]?.high, `${id} ${category}: published high asset`);
    assert.ok(manifest.assets[assetId]?.light, `${id} ${category}: published light asset`);
  }
});

test('hidden and visible plans select the same category while exact intent remains concealed', () => {
  for (const [maneuver, expected] of [['smash', 'smash'], ['attack', 'attack'], ['counter', 'counter'], ['sweep', 'sweep'], ['defend', 'defend'], ['ranged', 'attack']]) {
    const intent = { kind: 'attack', moveId: 'privateMove', damage: 99, combatProfile: { camp: 'attack', maneuver } };
    const hidden = concealIntent(intent, intent.combatProfile);
    assert.equal(enemyStanceCategory(intent), expected);
    assert.equal(enemyStanceCategory(hidden), expected);
    assert.equal(hidden.moveId, null);
    assert.equal(hidden.damage, undefined);
    assert.equal(hidden.hidden, true);
  }
  for (const camp of ['skill', 'power', 'spell']) assert.equal(enemyStanceCategory({ kind: 'buff', combatProfile: { camp } }), 'preparing');
  assert.equal(enemyStanceCategory({ kind: 'attack', combatProfile: { camp: 'spell' } }), 'preparing');
  assert.equal(enemyStanceCategory({ kind: 'block', combatProfile: { camp: 'skill', maneuver: 'defend' } }), 'defend');
  assert.equal(enemyStanceCategory({ statuses: { prepared: { stacks: 1 } } }), null);
  assert.equal(enemyStanceCategory({ kind: 'unknown', moveId: null }), null);
  for (const stance of ['__proto__', 'constructor', 'toString', 'assets/private.png']) assert.equal(enemyStanceCategory({ stance }), null);
});

test('new and cleared enemy intents safely retain idle until a plan exists', () => {
  const initialEnemy = { intent: null, hp: 10, maxHp: 10 };
  assert.equal(enemyStanceCategory(initialEnemy.intent), null);
  for (const value of [undefined, false, 1, 'attack', []]) assert.equal(enemyStanceCategory(value), null);
  assert.equal(enemyStanceCategory({ kind: 'unknown', combatProfile: null, profile: null }), null);
  assert.equal(enemyStanceCategory({ kind: 'block', combatProfile: null }), 'defend');
});

test('planned stance persists through status changes and reactions, then follows the next plan; defeat wins', t => {
  const documentBefore = globalThis.document, imageBefore = globalThis.Image;
  class Element { constructor() { this.dataset = {}; this.style = {}; } append() {} addEventListener() {} setAttribute() {} }
  let reducedMotion = false;
  globalThis.document = { createElement: () => new Element(), body: { classList: { contains: () => reducedMotion } } };
  globalThis.Image = Element;
  t.after(() => { globalThis.document = documentBefore; globalThis.Image = imageBefore; });
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const entity = { hp: 2, maxHp: 10, block: 5, statuses: { prepared: { stacks: 1 }, weak: { stacks: 1 } }, presentationStance: 'smash' };
  const el = enemyExpansionSprite({ id: 'stitchedHound' }, entity), stage = stageFor(el);
  assert.equal(el.dataset.pose, enemyStanceSprites.stitchedHound.smash);
  assert.equal(el.dataset.stance, 'smash');
  stage.play('hurt', 200);
  stage.setState({ ...entity, presentationStance: 'defend' });
  assert.equal(el.dataset.pose, 'hit', 'plan update does not interrupt a live reaction');
  t.mock.timers.tick(200);
  assert.equal(el.dataset.pose, enemyStanceSprites.stitchedHound.defend);
  stage.play('attack', 260);
  t.mock.timers.tick(260);
  assert.equal(el.dataset.pose, enemyStanceSprites.stitchedHound.defend);
  stage.setState({ ...entity, presentationStance: 'preparing' });
  assert.equal(el.dataset.pose, enemyStanceSprites.stitchedHound.preparing);
  reducedMotion = true;
  stage.play('attack', 260);
  assert.equal(el.dataset.pose, enemyStanceSprites.stitchedHound.preparing, 'reduced motion keeps the chosen held stance');
  stage.setState({ ...entity, hp: 0, presentationStance: 'attack' });
  assert.equal(el.dataset.pose, 'defeated');
  assert.equal(el.dataset.stance, undefined);
  stage.dispose();
});

test('remote hidden knowledge and legacy snapshots retain only the public body category for every connection', () => {
  for (const knowledge of [false, true]) for (const category of ENEMY_STANCE_FAMILIES) {
    const intent = { kind: category === 'preparing' ? 'buff' : 'attack', moveId: 'privateMove', damage: 99,
      combatProfile: { camp: category === 'preparing' ? 'power' : 'attack', maneuver: category === 'preparing' ? null : category } };
    const enemy = { id: 'e1', enemyId: 'stitchedHound', intent, intentReads: { p1: false, p2: false },
      presentationStance: 'assets/private-arbitrary.png', combatStance: { moveId: 'privateMove' },
      ...(knowledge ? { knowledgeAction: { serial: 3, category: 'privateCategory', reads: {
        p1: { visibility: 'unknown', label: '?' }, p2: { visibility: 'unknown', label: '?' } } } } : {}) };
    const source = { scene: { kind: 'combat', enemies: [enemy], players: [] }, party: [] };
    for (const seat of ['p1', 'p2']) {
      const projected = projectLanSnapshot(source, [seat]).scene.enemies[0];
      assert.equal(projected.presentationStance, category);
      assert.equal(projected.intent.moveId, null);
      assert.equal(projected.intent.damage, undefined);
      assert.equal(coopEnemyIntent(projected, seat).hidden, true);
      if (knowledge) { assert.equal(coopEnemyIntent(projected, seat).label, '?'); assert.equal(projected.knowledgeAction.category, undefined); }
    }
    assert.equal(source.scene.enemies[0].intent.moveId, 'privateMove', 'authority is unchanged');
  }
});
