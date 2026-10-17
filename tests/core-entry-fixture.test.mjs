import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE_ENTRY_SEED, CORE_INPUT_BUDGET, CORE_INPUT_ALLOWANCE } from '../tools/core-entry-fixture.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRng } from '../src/engine/rng.js';
import { buildActMap, drawSeatOrder } from '../src/engine/actmap.js';
import { seedFromString } from '../src/engine/rng.js';
test('the real-input Core fixture reaches a fight immediately after its initial shrine',()=>{
 const profile=resolveGameProfile('core');const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
 const rng=createRng(seedFromString(CORE_ENTRY_SEED));const seats=drawSeatOrder(reg,rng,{});const map=buildActMap(reg,rng,seats[0],1);
 const shrine=map.nodes[map.startIds[0]];assert.equal(shrine.type,'shrine');assert.equal(map.nodes[shrine.next[0]].resolved.kind,'fight');
 assert.equal(CORE_INPUT_BUDGET,18);assert.equal(CORE_INPUT_ALLOWANCE.seedEntry,2+CORE_ENTRY_SEED.length);
});
