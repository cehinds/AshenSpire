import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCombatDisplayReceipt } from '../src/ui/models/CombatDisplayReceiptModel.js';

test('partial stack removal updates paced PIPs without reading future live state', () => {
  const entities = { foe: {statuses:{weak:{stacks:3},bleed:{stacks:0,meter:{value:8,max:10}}}} };
  applyCombatDisplayReceipt(entities,{type:'statusRemoved',targetId:'foe',status:'weak',amount:1,reason:'ownerTurnStart'});
  assert.equal(entities.foe.statuses.weak.stacks,2);
  applyCombatDisplayReceipt(entities,{type:'statusRemoved',targetId:'foe',status:'weak',amount:1,total:0});
  assert.equal(entities.foe.statuses.weak,undefined,'authoritative total wins over a guessed decrement');
  applyCombatDisplayReceipt(entities,{type:'statusRemoved',targetId:'foe',status:'bleed',amount:3});
  assert.equal(entities.foe.statuses.bleed.meter.value,5);
});
test('configured targetId and legacy sourceId stance receipts preserve known posture fields', () => {
  const entities = { player:{combatStance:{maneuver:'attack',camp:'spell',range:'ranged'}} };
  applyCombatDisplayReceipt(entities,{type:'combatStanceChanged',targetId:'player',maneuver:'prepared'});
  assert.deepEqual(entities.player.combatStance,{maneuver:'prepared',camp:'spell',range:'ranged'});
  applyCombatDisplayReceipt(entities,{type:'combatStanceChanged',sourceId:'player',maneuver:'defend',camp:'physical'});
  assert.equal(entities.player.combatStance.maneuver,'defend');
  assert.equal(entities.player.combatStance.camp,'physical');
  assert.equal(applyCombatDisplayReceipt(entities,{type:'healed',targetId:'player'}),false);
});
