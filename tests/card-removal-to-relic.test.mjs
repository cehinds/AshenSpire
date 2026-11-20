// Owner rule 2026-11-20 (SPEC §5.6, *No card removal as a reward*): no card effect, event
// choice or reward removes a card from the deck as a benefit. The choices that used to do so
// grant a deck-reduction relic (`deckSlot1`) instead. The Merchant's paid removal is a service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { createRng } from '../src/engine/rng.js';

const RELIC_BY_CHOICE = [
  { eventId: 'goldboughAvatar', label: 'Offer a card', relicId: 'asceticsCord' },
  { eventId: 'wanderingPhysician', label: 'Let him cut', relicId: 'threadbareSatchel' },
  { eventId: 'stakeOfTheMartyr', label: 'Pay its price', relicId: 'pruningHook' },
];

const jsonFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return jsonFiles(path);
  return name.endsWith('.json') ? [path] : [];
});

test('no authored content grants removeCardFromDeck', () => {
  const offenders = [...jsonFiles('content/source'), ...jsonFiles('games/ashenspire/packs')]
    .filter((path) => /"op"\s*:\s*"removeCardFromDeck"/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('each former removal choice grants its deck-reduction relic and keeps the deck', () => {
  const events = JSON.parse(readFileSync('content/source/events.json', 'utf8'));
  for (const { eventId, label, relicId } of RELIC_BY_CHOICE) {
    const choice = events.find((event) => event.id === eventId).choices.find((row) => row.label.startsWith(label));
    assert.ok(registries.relics.get(relicId).properties.includes('deckSlot1'), `${relicId} lowers the deck minimum`);
    const run = createRunState({ registries, classId: 'reaver', seed: 511 });
    const deckSize = run.deck.length;
    executeRunEffects({ run, registries, rng: createRng(run.seed) }, choice.effects);
    assert.ok(run.relics.includes(relicId), `${eventId} grants ${relicId}`);
    assert.equal(run.deck.length, deckSize, `${eventId} removes no card`);
  }
});

test('a held deck relic is not granted twice', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  const grant = [{ op: 'addRelic', id: 'asceticsCord' }];
  executeRunEffects({ run, registries, rng: createRng(run.seed) }, grant);
  executeRunEffects({ run, registries, rng: createRng(run.seed) }, grant);
  assert.equal(run.relics.filter((id) => id === 'asceticsCord').length, 1);
});
