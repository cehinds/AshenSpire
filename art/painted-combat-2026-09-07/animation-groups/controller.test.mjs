import assert from 'node:assert/strict';
import { routeCard, createAnimator, sequences } from './controller.mjs';
const shield = [{ id: 'kiteShield', kind: 'shield', geom: 'kite' }];
const dagger = [{ id: 'parryDagger', kind: 'shield' }];
const defend = { type: 'skill', tags: ['guard'], equipmentProfileId: 'shieldGuard' };
assert.equal(routeCard({ type: 'attack', tags: ['guard', 'shield'] }, dagger).technique, 'attack');
assert.equal(routeCard({ type: 'power', tags: ['guard'] }, shield).rest, 'cast');
assert.equal(routeCard(defend, shield).technique, 'shieldGuard');
assert.equal(routeCard(defend, dagger).technique, 'parry');
assert.equal(routeCard(defend, []).technique, 'guard');
assert.equal(routeCard({ type: 'skill', tags: ['block'] }, dagger).technique, 'guard');
assert.equal(routeCard({ type: 'skill', tags: ['guard', 'shield'] }, shield).technique, 'shieldGuard');
let jobs = [], now = 0;
const advance = ms => {
  const until = now + ms;
  while (jobs.some(job => job.at <= until)) {
    jobs.sort((a, b) => a.at - b.at);
    const job = jobs.shift(); now = job.at; job.fn();
  }
  now = until;
};
const animator = createAnimator({ actorId: 'reaver', frames: new Set(Object.values(sequences).flat()), draw() {},
  schedule(fn, ms) { const job = { fn, at: now + ms }; jobs.push(job); return job; },
  cancel(job) { jobs = jobs.filter(candidate => candidate !== job); },
});
animator.card(defend, shield, 900); advance(900);
assert.equal(animator.state.pose, 'shieldGuard3');
animator.card({ type: 'attack' }, shield, 900); advance(300);
assert.equal(animator.state.pose, 'attack2'); advance(600);
assert.equal(animator.state.pose, 'shieldGuard3');
animator.hit(200); advance(200); assert.equal(animator.state.pose, 'shieldGuard3');
animator.nextTurn('starseer'); assert.equal(animator.state.rest, 'shieldGuard');
animator.card({ type: 'skill', tags: [] }, shield); advance(900);
assert.equal(animator.state.pose, 'shieldGuard3');
animator.card({ type: 'power' }, shield); animator.skip();
assert.deepEqual(animator.state, { pose: 'idle', rest: 'cast', active: null });
animator.card(defend, dagger); advance(300); animator.nextTurn('reaver'); advance(2000);
assert.deepEqual(animator.state, { pose: 'idle', rest: 'idle', active: null });
animator.reducedMotion(true); animator.card(defend, dagger);
assert.equal(animator.state.pose, 'parry3'); assert.equal(jobs.length, 0);
let rebound; animator.bind(state => rebound = state); assert.equal(rebound.rest, 'parry');
animator.reducedMotion(false); animator.card(defend, shield); animator.card(defend, dagger);
advance(900); assert.equal(animator.state.pose, 'parry3');
animator.dispose(); assert.equal(jobs.length, 0);
console.log('PASS: routing, persistent stance, hit/attack/cast interactions, owner turn, interrupt, skip, reduced motion, rebind and disposal.');
