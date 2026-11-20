// Owner 2026-11-15: "evade is a defense card" / "evade stances were removed". A card that prepares an Evade shows the
// Defense label and footer icon; Evade stays a tag and a status. Legacy saved Evade stance rows are covered by
// tests/evade-stance-save-migration.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { combatCardType, playingCardModel } from '../src/model/playingCard.js';
import { cardSigilsHtml } from '../src/ui/components/combatSigilView.js';
import { cardClassification } from '../src/model/cardClassification.js';
import { live } from './helpers/fixcore-combat-rules.mjs';

const registries = createRegistries(contentBundle);
const EVADE_CARDS = ['evasiveGuard', 'dodgeRoll', 'quickstep', 'backstep', 'acrobaticsRogue', 'shadowstep', 'crawlingShot'];

test('Quickstep and every card that prepares Evade wear the Defense label and icon', () => {
  for (const cardId of EVADE_CARDS) for (const upgraded of [false, true]) {
    const def = applyCombatExpansionCard(resolveCard(registries, { cardId, upgraded }));
    // W25-EvadeCards (intended by the design): these cards grant Evade stacks with their own applyStatus effect, not a `def.evade` tag.
    assert.ok(def.evade !== undefined || def.effects.some(effect => effect.op === 'applyStatus' && effect.status === 'evade' && effect.target === 'self'), cardId + ' still grants Evade');
    assert.equal(combatCardType(def), 'Defense', cardId);
    assert.equal(cardClassification(def).stanceType, 'defense', cardId);
    const model = playingCardModel(registries, { cardId, upgraded }, { definition: def });
    assert.equal(model.sigils.action, 'defense', cardId);
    assert.equal(model.type.subtype, 'Defense', cardId);
    const footer = cardSigilsHtml(model.sigils);
    assert.match(footer, /data-primary-sigil="defense"/);
    assert.match(footer, /card-type-name[^>]*>Defense</);
    assert.doesNotMatch(footer, /Evade|data-sigil="evade"/);
  }
});

test('no stance list offers Evade', () => {
  for (const stance of contentBundle.stances || []) assert.notEqual(stance.maneuver ?? stance.id, 'evade', stance.id);
});

test('the configured stances module lists no Evade stance', () => {
  const stances = live().gameProfile.modules.stances;
  assert.ok(stances.include.length > 0, 'a stances module is configured');
  assert.equal(stances.include.includes('evade'), false);
});
