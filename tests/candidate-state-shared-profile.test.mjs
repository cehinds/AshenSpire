import assert from 'node:assert/strict';
import { candidateState } from '../src/engine/combatRules.js';
import { createRng } from '../src/engine/rng.js';
import { freezeProfile } from '../src/engine/gameProfileCombat.js';

const profile = freezeProfile({ foundation: { mode: 'configured' }, modules: { cards: { handBase: 4, list: [{ id: 'a' }] } } });
const ctx = { gameProfile: profile, enemies: [{ id: 'e1', hp: 10 }], eventLog: [], queue: [], _idCounter: 0,
  registries: {}, rng: createRng('seed'), _emitEvent() {}, player: { id: 'p', hp: 5 } };
const before = JSON.stringify(profile);
const c = candidateState(ctx, { detached: true });
assert.equal(c.gameProfile, profile, 'frozen profile shared by reference');
assert.notEqual(c.enemies, ctx.enemies, 'mutable state still cloned');
c.enemies[0].hp = 1; c.player.hp = 1;
assert.equal(ctx.enemies[0].hp, 10); assert.equal(ctx.player.hp, 5);
assert.throws(() => { c.gameProfile.modules.cards.handBase = 9; }, TypeError);
assert.equal(JSON.stringify(profile), before);
assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.modules.cards));
const loose = { ...ctx, gameProfile: { x: { y: 1 } } };
assert.notEqual(candidateState(loose, { detached: true }).gameProfile, loose.gameProfile);
assert.notEqual(c.rng, ctx.rng);
console.log('candidate-state-shared-profile ok');
