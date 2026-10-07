import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resourceAura, auraFilter, POWER_FRAMES } from '../src/ui/combatAura.js';
test('actual payments override nominal resource costs and keep mixed colors',()=>{
 assert.deepEqual(resourceAura({manaCost:3,staminaCost:2},{manaSpent:0,staminaSpent:1}),['stamina']);
 assert.deepEqual(resourceAura({effects:[{op:'loseHp',target:'self',amount:2}]},{manaSpent:1,staminaSpent:1,hpSpent:2}),['stamina','mana','hp']);
 assert.deepEqual(resourceAura({effects:[{op:'loseHp',target:'enemy',amount:2}]},{hpSpent:2}),[]);
 assert.deepEqual(resourceAura({effects:[{op:'loseHp',target:'self',amount:2}]},{hpSpent:0}),[]);
});
test('Power phases are distinct silhouette filters; guard fades and idle clears',()=>{
 assert.equal(new Set(Object.keys(POWER_FRAMES).map(p=>auraFilter(p,'cast',['mana'],true))).size,3);
 for(const rest of ['guard','shieldGuard','parry'])assert.match(auraFilter('idle',rest),/91,165,255,0.26/);
 assert.equal(auraFilter('idle','cast'),'none');assert.equal(auraFilter('idle','idle'),'none');
 for(const pose of ['attack1','shieldBash2','parry2','hit','idle'])assert.match(auraFilter(pose,'idle',['hp'],true),/255,91,102/);
});
