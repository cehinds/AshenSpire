import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { renderCard, cardDetailHtml } from '../src/ui/components/card.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = createRegistries(contentBundle);
const identities = {
  unarmedAttack: ['physical', 'attack', null], shieldAttack: ['physical', 'attack', null],
  bladeAttack: ['physical', 'attack', null], twinbladeAttack: ['physical', 'attack', null],
  daggerPierceAttack: ['physical', 'attack', null], bowPierceAttack: ['physical', 'ranged', null],
  staffMagicAttack: ['spell', null, 'force'], sceptreArcaneAttack: ['spell', null, 'decay'],
  unarmedGuard: ['physical', 'defend', null], weaponGuard: ['physical', 'defend', null],
  shieldGuard: ['physical', 'defend', null], staffGuard: ['spell', 'defend', 'alteration'],
  sceptreGuard: ['spell', 'defend', 'divine'], unarmedTechnique: ['physical', null, null],
  weaponTechnique: ['physical', null, null], bowTechnique: ['physical', null, null],
  staffTechnique: ['spell', null, 'alteration'],
};
const capitalized = value => value[0].toUpperCase() + value.slice(1);
const tacticalLabels = new Set(['Physical', 'Spell', 'Attack', 'Defend', 'Counter', 'Sweep', 'Ranged', 'Smash',
  'Frost', 'Fire', 'Lightning', 'Force', 'Alteration', 'Illusion', 'Divine', 'Decay']);

// The DOM fixture models structure, but does not parse text nodes. Capture the
// actual renderer's markup as well, to assert the visible tag strip's words.
function withCardDom(fn) {
  return withKitDom(dom => {
    const prototype = Object.getPrototypeOf(dom.document.body);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'innerHTML');
    const markup = new WeakMap();
    Object.defineProperty(prototype, 'innerHTML', { configurable: true,
      set(value) { markup.set(this, value); descriptor.set.call(this, value); },
    });
    return fn(element => markup.get(element)?.match(/data-card-binding="tags"[^>]*>(.*?)<\/div>/s)?.[1].split(' · ').filter(Boolean) || []);
  });
}

test('all 17 resolved equipment profiles show their own tactical tags and data attributes', () => withCardDom(labelsFor => {
  assert.deepEqual(registries.equipment.basicCardProfiles.map(profile => profile.id).sort(), Object.keys(identities).sort());
  for (const profile of registries.equipment.basicCardProfiles) {
    const ref = { cardId: profile.baseCardId, profileId: profile.id };
    const def = resolveCard(registries, ref);
    const expected = identities[profile.id];
    const actual = combatProfileFor(def);
    assert.deepEqual([actual.camp, actual.maneuver, actual.school], expected, profile.id);
    const card = renderCard(registries, ref, { inspection: false });
    assert.deepEqual([card.dataset.combatCamp || null, card.dataset.combatManeuver || null,
      card.dataset.combatSchool || null], expected, `${profile.id} attributes`);
    const labels = labelsFor(card).filter(label => tacticalLabels.has(label));
    const expectedLabels = expected.filter(Boolean).map(capitalized);
    if (['staffMagicAttack', 'sceptreArcaneAttack'].includes(profile.id)) expectedLabels.push('Force');
    if (profile.id === 'bowTechnique') expectedLabels.push('Ranged'); // Authored legacy weapon tag; no attack maneuver.
    // Force may describe both the school and damage type, but one visible word
    // must not conceal an extra stale Physical/Attack classification.
    assert.deepEqual([...new Set(labels)].sort(), [...new Set(expectedLabels)].sort(), `${profile.id} visible tag identity`);
  }
}));

test('resolved equipment tags replace even nonempty base tags and explicit empty arrays stay authoritative', () => withCardDom(labelsFor => {
  assert.equal(combatProfileFor({ id: 'strike', tags: ['camp:physical', 'maneuver:attack'], cardTags: [] }).camp, null);
  const custom = createRegistries({ ...contentBundle,
    cards: contentBundle.cards.map(card => card.id === 'strike' ? { ...card, cardTags: [] } : card),
  });
  const ref = { cardId: 'strike' };
  assert.deepEqual(playingCardModel(custom, ref).tags, []);
  const card = renderCard(custom, ref, { inspection: false });
  assert.equal(card.dataset.combatCamp, undefined);
  assert.equal(card.dataset.combatManeuver, undefined);
  assert.deepEqual(labelsFor(card), []);
  assert.doesNotMatch(cardDetailHtml(custom, ref), /class="inspection-tag"/);
}));

test('weapon-art source metadata preserves every authored Counter identity on the rendered face', () => withCardDom(labelsFor => {
  const counters = {
    guardCounter: 'melee', riposte: 'melee', rondelParry: 'melee', bindingParry: 'melee',
    spikedReprisal: 'melee', 'progression-crimson-reprisal': 'melee', nockAndWait: 'ranged',
    umbralWard: 'spell', wardingStar: 'spell', 'progression-rime-mirror': 'spell',
  };
  for (const [cardId, mode] of Object.entries(counters)) {
    const source = registries.equipment.armaments.find(piece => piece.tags.includes(mode === 'spell' ? 'source:spell' : 'source:weapon'));
    assert.ok(source);
    const ref = { cardId, sourceArmamentId: source.id, upgraded: true };
    const profile = combatProfileFor(resolveCard(registries, ref));
    assert.equal(profile.maneuver, 'counter', cardId);
    assert.equal(profile.counterMode, mode, cardId);
    const card = renderCard(registries, ref, { inspection: false });
    assert.equal(card.dataset.combatManeuver, 'counter', cardId);
    assert.ok(labelsFor(card).includes('Counter'), cardId);
  }
}));
