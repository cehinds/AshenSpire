// Playtest 2026-11-17 item 41: event rewards use the shop's receive modal. ReceivedItems lists what a choice handed
// over (cards, armaments, relics), never a curse, and never what the player already had.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/engine/runCombat.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { snapshotRunForDiff } from '../src/model/runChangeReceipt.js';
import { ReceivedItems } from '../src/model/receivedItems.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 504, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const anyRelic = () => registries.relics.all().find((relic) => relic.id)?.id;
const curseId = () => registries.cards.all().find((card) => card.type === 'curse')?.id;
const armamentId = () => (registries.equipment.armaments || []).find((row) => row.id)?.id;

test('nothing new: nothing received', () => {
  const run = newRun();
  const before = snapshotRunForDiff(run);
  assert.deepEqual(ReceivedItems(registries, before, run), []);
});

test('a new card, armament and relic are listed in deck, library, armament, relic order; a curse is not', () => {
  const run = newRun();
  const before = snapshotRunForDiff(run);
  run.deck.push({ instanceId: 'event:deck', cardId: 'core.strike' });
  run.sideboard.push({ instanceId: 'event:library', cardId: 'core.defend' });
  if (curseId()) run.deck.push({ instanceId: 'event:curse', cardId: curseId() });
  const armament = armamentId();
  run.loadout.storage.push(armament);
  const relic = registries.relics.all().map((row) => row.id).find((id) => !run.relics.includes(id));
  run.relics.push(relic);
  const items = ReceivedItems(registries, before, run);
  assert.deepEqual(items.map((item) => [item.kind, item.zone || item.id]), [['card', 'deck'], ['card', 'sideboard'], ['armament', armament], ['relic', relic]]);
  assert.ok(items.every((item) => typeof item.name === 'string' && item.name), 'every item is named');
  assert.ok(anyRelic());
});
