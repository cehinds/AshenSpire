import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { combatProfileFor, combatProfileTags } from '../src/model/combatCardProfile.js';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';
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
// actual renderer's markup as well, to assert the sigils and damage words.
function withCardDom(fn) {
  return withKitDom(dom => {
    const prototype = Object.getPrototypeOf(dom.document.body);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'innerHTML');
    const markup = new WeakMap();
    Object.defineProperty(prototype, 'innerHTML', { configurable: true,
      set(value) { markup.set(this, value); descriptor.set.call(this, value); },
    });
    return fn(element => markup.get(element) || '');
  });
}

test('all 17 resolved equipment profiles show their sigils and retain tactical inspection tags', () => withCardDom(markupFor => {
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
    const model = playingCardModel(registries, ref), markup = markupFor(card);
    assert.ok(markup.includes(`data-primary-sigil="${model.sigils.action}"`), `${profile.id} primary sigil`);
    assert.match(markup, /class="card-type-name" data-card-layer="8">[^<]+<\/span>/);
    const expectedLabels = expected.filter(Boolean).map(capitalized);
    if (['staffMagicAttack', 'sceptreArcaneAttack'].includes(profile.id)) expectedLabels.push('Force');
    if (profile.id === 'bowTechnique') expectedLabels.push('Ranged'); // Authored legacy weapon tag; no attack maneuver.
    const detail = cardDetailHtml(registries, ref);
    for (const label of expectedLabels) assert.ok(detail.includes(`>${label}</span>`), `${profile.id} inspected ${label}`);
    const damage = model.tags.filter(tag=>tag.id.startsWith('damage:')).map(tag=>tag.label);
    for (const label of damage) assert.ok(detail.includes(label), `${profile.id} inspected damage type`);
  }
}));

test('resolved equipment tags replace even nonempty base tags and explicit empty arrays stay authoritative', () => withCardDom(markupFor => {
  assert.equal(combatProfileFor({ id: 'strike', tags: ['camp:physical', 'maneuver:attack'], cardTags: [] }).camp, null);
  const custom = createRegistries({ ...contentBundle,
    cards: contentBundle.cards.map(card => card.id === 'strike' ? { ...card, cardTags: [] } : card),
  });
  const ref = { cardId: 'strike' };
  assert.deepEqual(playingCardModel(custom, ref).tags, []);
  const card = renderCard(custom, ref, { inspection: false });
  assert.equal(card.dataset.combatCamp, undefined);
  assert.equal(card.dataset.combatManeuver, undefined);
  assert.match(markupFor(card), /data-primary-sigil="attack"/); // The authored type still identifies its action.
  assert.doesNotMatch(markupFor(card), /combat-sigil-school|card-damage-types/);
  assert.doesNotMatch(cardDetailHtml(custom, ref), /class="inspection-tag"/);
}));

test('weapon-art source metadata preserves every authored Counter identity on the rendered face', () => withCardDom(markupFor => {
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
    assert.match(markupFor(card), /data-primary-sigil="counter"/, cardId);
    assert.match(markupFor(card), /role="img" aria-label="Counter"/, cardId);
  }
}));

test('active tactical metadata owns enemy move descriptions, written damage and inspection tooltips', () => withCardDom(markupFor => {
  const renamed = {
    'camp:physical': 'Run Might', 'maneuver:attack': 'Run Jab',
    'maneuver:counter': 'Run Reversal', 'counter:melee': 'Run Melee Reply', 'damage:frost': 'Run Ice',
  };
  const custom = createRegistries({ ...contentBundle,
    tags: contentBundle.tags.map(tag => renamed[tag.id] ? { ...tag, label: renamed[tag.id],
      glyph: 'R', color: 'ABCDEF', blurb: `Active description for ${renamed[tag.id]}.` } : tag),
    // Typed attack identity can add a damage chip even when the base card's
    // junction has no damage tag. That chip must use the same active metadata.
    cards: contentBundle.cards.map(card => card.id === 'strike'
      ? { ...card, attack: { damageType: 'frost' } } : card),
  });
  const ref = { cardId: 'strike' };
  const tags = combatProfileTags(resolveCard(custom, ref), custom);
  for (const tag of tags) {
    assert.equal(tag, custom.tags.find(row => row.id === tag.id), 'the active registry row owns all presentation fields');
    assert.equal(tag.label, renamed[tag.id]);
    assert.equal(tag.glyph, 'R');
    assert.equal(tag.color, 'ABCDEF');
    assert.equal(tag.blurb, `Active description for ${renamed[tag.id]}.`);
  }
  const card = renderCard(custom, ref, { inspection: false });
  assert.match(card.getAttribute('aria-label'), /Run Ice/);
  assert.doesNotMatch(card.getAttribute('aria-label'), /Damage: Cold/);
  const tooltip = cardDetailHtml(custom, ref);
  assert.match(tooltip, /Active description for Run Ice/);
  assert.match(tooltip, />Run Ice<\/span>/);
  assert.match(tooltip, />Run Might<\/span>/);
  assert.match(tooltip, />Run Jab<\/span>/);
  const moves = enemyMoveCards(custom.enemies.get('gildedKnight'), { registries: custom });
  const parry = moves.find(move => move.moveId === 'parry');
  for (const id of ['camp:physical', 'maneuver:counter', 'counter:melee']) {
    const tag = parry.combatTags.find(row => row.id === id);
    assert.equal(tag, custom.tags.find(row => row.id === id));
    assert.ok(parry.meta.includes(renamed[id]));
    assert.ok(parry.detail.includes(`Active description for ${renamed[id]}.`));
  }
  assert.deepEqual(combatProfileTags({ camp: 'physical' }, { tags: [] }), [],
    'a supplied empty active registry does not fall back to shipped metadata');
}));
