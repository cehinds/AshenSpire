import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE_ENTRY_SEED, CORE_INPUT_BUDGET, CORE_INPUT_ALLOWANCE } from '../tools/core-entry-fixture.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRng } from '../src/engine/rng.js';
import { buildActMap, drawSeatOrder } from '../src/engine/actmap.js';
import { seedFromString } from '../src/engine/rng.js';
test('the real-input Core fixture starts on a fight at depth 1, with no entry shrine step',()=>{
 const profile=resolveGameProfile('core');const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
 const rng=createRng(seedFromString(CORE_ENTRY_SEED));const seats=drawSeatOrder(reg,rng,{});const map=buildActMap(reg,rng,seats[0],1);
 const start=map.nodes[map.startIds[0]];assert.equal(start.floor,1);assert.equal(start.actualType,'fight');assert.equal(start.type,'monster');
 assert.equal(CORE_INPUT_ALLOWANCE.entryRest,0);assert.equal(CORE_INPUT_BUDGET,15);assert.equal(CORE_INPUT_ALLOWANCE.seedEntry,2+CORE_ENTRY_SEED.length);
});
