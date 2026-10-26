import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as policy from '../src/model/autoCombatPolicy.js';
import { resolveCombatAutomation } from '../src/model/autoCombatPolicy.js';
import { settingsRows } from '../src/ui/screens/settings.js';
import { profileKeys } from '../src/model/settingsSync.js';

test('policy defaults are off, ×1.25, offense, 390 ms animation and a half-second delay', () => {
  assert.deepEqual(resolveCombatAutomation(), { enabled: false, speed: 1.25, preference: 'offense', autoSpeed: 1.5, animationMs: 390, delayMs: 500 });
  assert.equal(resolveCombatAutomation({ combatSpeed: NaN }).speed, 1.25);
  assert.equal(resolveCombatAutomation({ combatSpeed: 999 }).speed, 8);
});
const matchups = { attack: ['evade'], evade: ['smash'], smash: ['defend'], defend: ['attack'] };
const card = (id, kind, cost = 1, extra = {}) => ({ id, kind, cost, manaCost: 0, staminaCost: 0, playable: true, ...extra });
const pick = (state, hand) => policy.chooseCardPlay({ energy: 3, mana: 3, stamina: 3, matchups, ...state }, 'player', hand)?.id ?? null;
test('chooseCardPlay prefers offense or defense by the combat preference', () => {
  const hand = [card('guard', 'defend'), card('slash', 'attack'), card('dodge', 'evade')];
  assert.equal(pick({ preference: 'offense' }, hand), 'slash');
  assert.equal(pick({ preference: 'defense' }, hand), 'guard');
});
test('chooseCardPlay then counters the perceived incoming maneuver', () => {
  const hand = [card('slash', 'attack'), card('smash', 'smash')];
  const seats = { player: { intent: { revealed: true, profile: { maneuver: 'defend' } } } };
  assert.equal(pick({ preference: 'offense', seats }, hand), 'smash', 'smash beats defend');
  const hidden = { player: { intent: { hidden: true, profile: { maneuver: 'defend' } } } };
  assert.equal(pick({ preference: 'offense', seats: hidden }, hand), 'slash', 'a hidden intent is unknown: hand order');
});
test('chooseCardPlay takes the highest cost that fits, then hand order', () => {
  assert.equal(pick({ preference: 'offense' }, [card('a', 'attack', 1), card('b', 'attack', 3), card('c', 'attack', 4)]), 'b');
  assert.equal(pick({ preference: 'offense' }, [card('a', 'attack', 2), card('b', 'attack', 2)]), 'a');
});
test('chooseCardPlay returns null when nothing is playable or affordable', () => {
  assert.equal(pick({ preference: 'offense' }, []), null);
  assert.equal(pick({ preference: 'offense' }, [card('a', 'attack', 1, { playable: false })]), null);
  assert.equal(pick({ preference: 'offense', energy: 0 }, [card('a', 'attack', 1)]), null);
  assert.equal(pick({ preference: 'offense' }, [card('a', 'attack', 0, { manaCost: 4 }), card('b', 'attack', 0, { staminaCost: 4 })]), null);
});
test('chooseCardPlay is deterministic and does not mutate its input', () => {
  const state = { preference: 'defense', energy: 3, matchups }; const hand = [card('a', 'defend', 2), card('b', 'evade', 2), card('c', 'attack', 3)];
  const before = JSON.stringify([state, hand]);
  const first = policy.chooseCardPlay(state, 'player', hand);
  for (let i = 0; i < 5; i++) assert.equal(policy.chooseCardPlay(state, 'player', hand), first);
  assert.equal(JSON.stringify([state, hand]), before);
});
test('auto-combat plays cards and ends turns through the manual paths (owner 2026-10-26, overriding D12)', () => {
  assert.equal(policy.chooseAutoCombatAction, undefined);
  const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const reaction = screen.slice(screen.indexOf('function autoReactionChoice'), screen.indexOf('function autoPlayStep'));
  assert.ok(reaction.includes('chooseReaction'));
  for (const call of ['playCard(', 'commitEndTurn(', "type: 'playCard'", "type: 'endTurn'"]) assert.ok(!reaction.includes(call), `reaction chooser: ${call}`);
  const play = screen.slice(screen.indexOf('function autoPlayStep'), screen.indexOf('function scheduleAutoCombat'));
  assert.ok(play.includes('chooseCardPlay') && play.includes('playCard(') && play.includes('commitEndTurn('));
  assert.ok(!play.includes("type: 'playCard'") && !play.includes("type: 'endTurn'"), 'no direct dispatch: the manual paths only');
  assert.ok(play.includes('maxActionsPerTurn'));
});
test('automation settings participate in durable profile export and reset rows', () => {
  const rows = settingsRows();
  const keys = profileKeys(rows);
  for (const key of ['autoCombat', 'combatSpeed', 'combatStepPause']) {
    assert.ok(rows.some(row => row.key === key)); assert.ok(keys.includes(key), key);
  }
});
test('the unused combat preference row is hidden but its key survives', () => {
  const row = settingsRows().find(candidate => candidate.key === 'combatPreference');
  assert.ok(row && row.retired === true);
  assert.equal(resolveCombatAutomation({ combatPreference: 'defense' }).preference, 'defense');
});
test('the auto combat setting says it also plays cards and ends the turn', () => {
  const note = settingsRows().find(row => row.key === 'autoCombat').note;
  assert.match(note, /reaction/i); assert.match(note, /plays your cards/i); assert.doesNotMatch(note, /never plays/i);
});
