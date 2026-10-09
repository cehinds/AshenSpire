import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { combatCardDamageLabel, combatCardSummary } from '../src/model/playingCard.js';
import { renderCard } from '../src/ui/components/card.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const reg = createRegistries(contentBundle);
const card = id => applyCombatExpansionCard(reg.cards.get(id));

test('damage words describe actual types rather than the spell school', () => {
  for (const [id, label] of [['emberDart', 'Fire'], ['rimeNeedle', 'Cold'],
    ['staticNeedle', 'Piercing'], ['forceNudge', 'Blunt']]) {
    assert.equal(combatCardDamageLabel(card(id), null, reg), label, id);
    assert.match(combatCardSummary(card(id), null, reg), new RegExp(`\\d+ ${label} damage`), id);
  }
});

test('active renamed and absent metadata never fall back to shipped damage labels', () => {
  const renamed = createRegistries({ ...contentBundle,
    tags: contentBundle.tags.map(tag => tag.id === 'damage:fire' ? { ...tag, label: 'Ember' } : tag) });
  assert.match(combatCardSummary(card('emberDart'), null, renamed), /5 Ember damage/);
  const absent = { ...reg, tags: reg.tags.filter(tag => tag.id !== 'damage:fire') };
  assert.equal(combatCardDamageLabel(card('emberDart'), null, absent), '');
  assert.match(combatCardSummary(card('emberDart'), null, absent), /5 damage/);
  assert.equal(combatCardDamageLabel({ ...card('emberDart'), attack: undefined, cardTags: [], tags: [] }, null, reg), '');
});

test('mixed contacts retain ordered types and unequal live hit numbers without mutation', () => {
  const def = { ...card('staticNeedle'), attack: { source: 'spell',
    components: [{ type: 'blunt', weight: 1 }, { type: 'fire', weight: 1 }] },
    cardTags: ['camp:spell', 'maneuver:casting', 'school:lightning', 'damage:blunt', 'damage:fire'] };
  const preview = { tokens: { damage: 4 }, values: [{ op: 'damage', value: 4,
    hits: 2, hitDamages: [4, 2], totalDamage: 6 }] };
  const before = JSON.stringify({ def, preview });
  assert.match(combatCardSummary(def, preview, reg), /4 \+ 2 Blunt\/Fire damage \(6 total across 2 hits\)/);
  assert.equal(JSON.stringify({ def, preview }), before);
});

test('each contact follows its resolved preview, including explicitly empty tags', () => {
  const def = { ...card('emberDart'), effects: [
    { op: 'damage', target: 'enemy', amount: 5, attack: { damageType: 'blunt' } },
    { op: 'damage', target: 'enemy', amount: 2, attack: { damageType: 'frost' } }] };
  const preview = { tokens: { damage: 7, 'damage.2': 3 }, values: [
    { op: 'damage', value: 7, tags: ['damage:piercing'] },
    { op: 'damage', value: 3, tags: [] }] };
  assert.equal(combatCardSummary(def, preview, reg), 'Deal 7 Piercing damage. Deal 3 damage.');
  assert.equal(combatCardDamageLabel(def, preview, reg), 'Piercing');
  const partial = { ...preview, values: [preview.values[0], { op: 'damage', value: 3 }] };
  assert.equal(combatCardDamageLabel(def, partial, reg), 'Piercing/Cold');
  assert.equal(combatCardSummary(def, null, reg), 'Deal 5 Blunt damage. Deal 2 Cold damage.');
  assert.equal(combatCardDamageLabel(def, null, reg), 'Blunt/Cold');
});

test('paid-tier Counter HP keeps its type while Poise and Ward remain distinct', () => {
  const def = { type: 'skill', tags: ['camp:spell', 'maneuver:counter', 'damage:blunt'],
    effects: [], counterPayload: { hp: 9, poise: 3, ward: 2 } };
  const preview = { upcastTier: 2, values: [
    { op: 'damage', value: 17, tags: ['damage:piercing'] },
    { op: 'poiseDamage', value: 5 }, { op: 'wardDamage', value: 7 }] };
  assert.equal(combatCardSummary(def, preview, reg), 'Return 17 Piercing damage + 5 Poise + 7 Ward.');
});

test('expanded complex card faces expose damage words and preserve v1 authored text', () => withKitDom(dom => {
  const prototype = Object.getPrototypeOf(dom.document.body);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'innerHTML');
  const markup = new WeakMap();
  Object.defineProperty(prototype, 'innerHTML', { configurable: true,
    set(value) { markup.set(this, value); descriptor.set.call(this, value); } });
  const ref = { cardId: 'strike' }, legacy = reg.cards.get('strike');
  const def = { ...applyCombatExpansionCard(legacy), attack: { damageType: 'slashing' },
    comboHook: { fixture: true } }; // A complex effect keeps its authored template.
  const preview = { combatExpansionVersion: 2, resolvedDefinition: def,
    cost: 1, manaCost: 0, tokens: {}, values: [] };
  const expanded = renderCard(reg, ref, { preview, inspection: false });
  assert.match(markup.get(expanded), /Slashing: /);
  assert.match(markup.get(expanded), /card-type-name">Attack/);
  const v1 = renderCard(reg, ref, { inspection: false });
  assert.doesNotMatch(markup.get(v1), /Slashing: /);
  assert.equal(reg.cards.get('strike'), legacy);
}));
