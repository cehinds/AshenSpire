import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveActionAnimation as resolve } from '../src/model/actionAnimation.js';
import { ACTION_ANIMATION_ACTORS, ACTION_ANIMATION_TAGS, ACTION_ANIMATION_FAMILIES } from '../src/content/actionAnimations.js';
import { contentBundle } from '../src/content/index.js';
import { POSE_FRAMES, POSE_STRIP } from '../src/content/poseSprites.js';

test('override beats tags, tags beat intent, and tag order is authored', () => {
  assert.equal(resolve({actorId:'rogue',actionId:'dodgeRoll',tags:['blade'],intent:'attack'}).family,'dodge');
  assert.equal(resolve({tags:['blade','guard'],intent:'attack'}).family,'guard');
  assert.deepEqual(resolve({tags:['blade','ranged']}),resolve({tags:[{id:'ranged'},{id:'blade'}]}));
  assert.equal(resolve({tags:['extractable'],intent:'block',type:'attack'}).family,'guard');
  assert.equal(resolve({type:'attack'}).family,'strike');
});
test('unknown content and inherited object keys fall back safely', () => {
  for (const id of ['unknown','toString','constructor','__proto__']) {
    assert.equal(resolve({actorId:id,actionId:id,tags:[id],intent:id,type:id}).family,'neutral');
  }
  assert.equal(resolve({tags:null}).pose,null);
  assert.equal(resolve({type:'attack',availablePoses:['idle']}).pose,'idle');
});
test('live classes and named enemies have authored distinct profiles and valid overrides', () => {
  for(const {id} of contentBundle.classes) assert.ok(ACTION_ANIMATION_ACTORS[id]);
  for(const id of ['wanderingSoldier','blightHound','fellWarden']) {
    const enemy=contentBundle.enemies.find(e=>e.id===id);
    for(const [move,family] of Object.entries(ACTION_ANIMATION_ACTORS[id].actions)) {
      assert.ok(enemy.moves[move]);
      assert.equal(resolve({actorId:id,actionId:move}).family,family);
    }
  }
  assert.notEqual(resolve({actorId:'blightHound',actionId:'bite'}).tempo,resolve({actorId:'fellWarden',actionId:'caneStrike'}).tempo);
});
test('authored tags exist and requested class poses are shipped', () => {
  const tags=new Set(contentBundle.tags.filter(t=>t.domain==='card').map(t=>t.id));
  for(const [tag] of ACTION_ANIMATION_TAGS) assert.ok(tags.has(tag),tag);
  for(const actor of Object.values(ACTION_ANIMATION_ACTORS).filter(a=>a.spriteClass)) {
    for(const {pose} of Object.values(ACTION_ANIMATION_FAMILIES)) {
      assert.ok(POSE_STRIP.includes(pose));
      assert.ok(POSE_FRAMES.has(actor.spriteClass+'_'+pose+'_gold'));
    }
  }
  assert.equal(resolve({tags:['pierce'],availablePoses:POSE_STRIP}).pose,'attack2');
});
test('resolution is immutable, deterministic, and does not mutate inputs', () => {
  const input=Object.freeze({actorId:'reaver',actionId:'strike',tags:Object.freeze(['guard']),availablePoses:Object.freeze(['attack1'])});
  const result=resolve(input);
  assert.deepEqual(result,resolve(input));
  assert.ok(Object.isFrozen(result));
  assert.equal(result.pose,'attack1');
});

test('every authored enemy override names a real move and a valid family', () => {
  const enemies = new Map(contentBundle.enemies.map(def => [def.id, def]));
  const profiles = Object.entries(ACTION_ANIMATION_ACTORS).filter(([, profile]) => profile.spriteClass === null);
  assert.equal(profiles.length, 17);
  for (const [id, profile] of profiles) {
    const def = enemies.get(id);
    assert.ok(def, id);
    assert.ok(profile.tempo >= 0.25 && profile.tempo <= 2, id + ' bounded tempo');
    assert.ok(profile.reach >= 0.25 && profile.reach <= 2, id + ' bounded reach');
    assert.ok(Object.isFrozen(profile.actions));
    for (const [move, family] of Object.entries(profile.actions)) {
      assert.ok(Object.hasOwn(def.moves, move), id + ':' + move);
      assert.ok(Object.hasOwn(ACTION_ANIMATION_FAMILIES, family), id + ':' + family);
      const plan = resolve({ actorId: id, actionId: move, tags: ['guard'], intent: 'block' });
      assert.equal(plan.family, family);
      assert.equal(plan.source, 'override');
      assert.equal(plan.pose, null, 'painted enemy needs no invented pose asset');
    }
    if (!['wanderingSoldier', 'blightHound', 'fellWarden'].includes(id)) {
      assert.deepEqual(Object.keys(profile.actions).sort(), Object.keys(def.moves).sort(), id + ' covers its full move set');
    }
  }
  assert.equal(new Set(profiles.map(([, p]) => p.tempo + ':' + p.reach)).size, profiles.length);
});
