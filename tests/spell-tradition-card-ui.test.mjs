import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardModel, staticCardTokens } from '../src/model/playingCard.js';
import { ACTION_SIGILS, TRADITION_SIGILS, cardSigilIdentity } from '../src/content/combatSigils.js';
import { cardSigilsHtml, sigilExplanationHtml } from '../src/ui/components/combatSigilView.js';
import { cardTagRailHtml } from '../src/ui/components/cardTagSymbols.js';
import { illustratedCardHtml } from '../src/ui/components/illustratedCard.js';
import { cardDetailHtml } from '../src/ui/components/card.js';

const reg = createRegistries(contentBundle);
const definition = (school, extras = {}) => ({
  id: 'spell-tradition-probe', name: 'Tradition probe', class: 'colorless', rarity: 'common',
  type: 'attack', kindIds: ['classification.attack'], cost: 1, staminaCost: 1, manaCost: 1, costRule: 'fixed', icon: 'skill', keywords: [],
  tags: ['camp:spell', 'maneuver:casting', ...(school ? ['school:' + school] : [])],
  effects: [{ op: 'damage', target: 'enemy', amount: 10 }], textTemplate: 'Deal {damage} damage.',
  ...extras,
});

test('exclusive and shared spell types use category labels and marks without changing the spell category', () => {
  for (const [school, label, traditions, category] of [
    ['force', 'ARCANE', ['arcane'], 'arcane'], ['illusion', 'ARCANE', ['arcane'], 'arcane'], ['alteration', 'ARCANE', ['arcane'], 'arcane'],
    ['divine', 'DIVINE', ['divine'], 'divine'], ['decay', 'DIVINE', ['divine'], 'divine'],
    ...['fire', 'earth', 'lightning', 'frost'].map(school => [school, 'SPELL', ['arcane', 'divine'], 'shared']),
    [null, 'SPELL', ['arcane', 'divine'], null],
  ]) {
    const def = definition(school);
    const model = playingCardModel(reg, { cardId: def.id }, { definition: def });
    assert.equal(model.cardCategory, 'spell', school);
    assert.equal(model.type.id, 'spell');
    assert.equal(model.type.label, label);
    assert.deepEqual(model.sigils.traditions, traditions);
    assert.equal(model.sigils.category, category, school);
    assert.ok(Object.isFrozen(model.sigils.traditions));
    const html = cardSigilsHtml(model.sigils);
    const marks = [...html.matchAll(/data-sigil="(\w+)"/g)].map(match => match[1]);
    const categoryMarks = category === 'arcane' || category === 'divine' ? [category] : [];
    assert.deepEqual(marks, ['spell', ...categoryMarks], school);
    assert.equal((html.match(/class="combat-sigil combat-sigil-tradition"/g) || []).length, categoryMarks.length);
    for (const id of categoryMarks) assert.ok(html.includes(TRADITION_SIGILS[id].shape));
    assert.match(html, new RegExp('data-spell-category="' + (category || 'spell') + '"'));
    assert.match(html, new RegExp('card-type-name" data-card-layer="8">' + label[0] + label.slice(1).toLowerCase()));
    if (school) assert.equal(model.sigils.school, school);
  }
});

test('shared illustrated faces show the Spell mark alone and retain their school', () => {
  const def = definition('fire');
  const model = playingCardModel(reg, { cardId: def.id }, { definition: def });
  const html = illustratedCardHtml(model, { rules: '10 damage.', painting: null, glyph: '' });
  assert.match(html, /data-traditions="arcane divine"/);
  assert.match(html, /data-spell-category="shared"/);
  assert.match(html, /data-sigil="spell"/);
  assert.doesNotMatch(html, /data-sigil="arcane"|data-sigil="divine"/);
  assert.match(html, /card-type-name" data-card-layer="8">Spell/);
  const explanation = sigilExplanationHtml(model.sigils);
  assert.doesNotMatch(explanation, /Arcane magic scales with Intelligence|Divine magic scales with Wisdom/);
  assert.match(explanation, /data-sigil="spell"[\s\S]*data-sigil="fire"/);
  assert.match(explanation, /Fire magic/);
  const force = definition('force');
  const arcane = sigilExplanationHtml(playingCardModel(reg, { cardId: force.id }, { definition: force }).sigils);
  assert.match(arcane, /data-sigil="spell"[\s\S]*data-sigil="arcane"[\s\S]*data-sigil="force"/);
  assert.match(arcane, /Arcane magic scales with Intelligence/);
  assert.ok(cardTagRailHtml([{ id: 'tradition:arcane', label: 'Arcane' }]).includes(TRADITION_SIGILS.arcane.shape));
  assert.ok(cardTagRailHtml([{ id: 'tradition:divine', label: 'Divine' }]).includes(TRADITION_SIGILS.divine.shape));
});

test('explicit tradition identity and mirrored action metadata survive presentation', () => {
  const def = definition('force', { tags: ['camp:spell', 'school:force', 'tradition:divine'], mirrors: 'counter' });
  const model = playingCardModel(reg, { cardId: def.id }, { definition: def });
  assert.equal(model.type.label, 'DIVINE');
  assert.equal(model.sigils.mirror, 'counter');
  const html = cardSigilsHtml(model.sigils);
  assert.match(html, /data-tradition="divine"/);
  assert.match(html, /data-mirror="counter"/);
  assert.deepEqual([...html.matchAll(/data-sigil="(\w+)"/g)].map(match => match[1]), ['spell', 'divine', 'counter']);
  assert.match(html, /card-type-name" data-card-layer="8">Divine/);
  assert.ok(html.includes(ACTION_SIGILS.counter.shape));
});

test('static card damage follows asymmetric casting attributes and preserves saved scaling', () => {
  const rules = (attributes, active = true) => ({
    faceAttributes: attributes,
    gameProfile: {
      fixCoreRules: active ? { spellTraditionsVersion: 1 } : {},
      modules: { effects: { mode: 'configured', spellTraditionsVersion: active ? 1 : 0, baseDamageMultiplier: 1, playerDamageMultiplier: 1, physicalDamageMultiplier: 1, magicStatWeight: 1 } },
    },
  });
  for (const attrs of [{ intelligence: 3, wisdom: 9 }, { intelligence: 9, wisdom: 3 }]) {
    assert.equal(staticCardTokens(definition('force'), reg, rules(attrs)).damage, 10 + attrs.intelligence);
    assert.equal(staticCardTokens(definition('divine'), reg, rules(attrs)).damage, 10 + attrs.wisdom);
    assert.equal(staticCardTokens(definition('decay'), reg, rules(attrs)).damage, 10 + attrs.wisdom);
    for (const school of ['fire', 'earth', 'frost', 'lightning', null]) {
      assert.equal(staticCardTokens(definition(school), reg, rules(attrs)).damage, 19, school);
    }
    assert.equal(staticCardTokens(definition('force'), reg, rules(attrs, false)).damage, 19, 'old profile retains max(INT,WIS)');
  }
});

test('the generic sigil API remains compatible for callers without a card', () => {
  assert.deepEqual(cardSigilIdentity('Spell', { camp: 'spell', school: 'fire' }), { action: 'spell', school: 'fire' });
  assert.deepEqual(cardSigilIdentity('Attack', { camp: 'physical' }), { action: 'attack', school: null });
  assert.match(cardSigilsHtml({ action: 'spell' }), /card-type-name" data-card-layer="8">Spell/);
  assert.notEqual(TRADITION_SIGILS.arcane.shape, TRADITION_SIGILS.divine.shape);
});

test('a magical Power keeps its lifecycle explanation under its tradition type', () => {
  const def = definition('divine', { type: 'power', kindIds: ['classification.power'] });
  const model = playingCardModel(reg, { cardId: def.id }, { definition: def });
  assert.equal(model.type.label, 'DIVINE');
  assert.equal(model.type.subtype, 'Power');
  assert.equal(model.cardCategory, 'power');
  assert.equal(model.sigils.action, 'power');
  const explanation = sigilExplanationHtml(model.sigils);
  assert.match(explanation, /Divine magic scales with Wisdom/);
  assert.match(explanation, /Cast once/);
  assert.match(explanation, /lasts for this combat/);
});

test('saved profiles without tradition scaling retain truthful generic type and inspection help', () => {
  const def = definition('force');
  for (const marker of [undefined, 0]) {
    const legacy = {
      faceAttributes: { intelligence: 3, wisdom: 9 },
      gameProfile: { modules: { effects: { mode: 'configured', spellTraditionsVersion: marker,
        baseDamageMultiplier: 1, playerDamageMultiplier: 1, physicalDamageMultiplier: 1, magicStatWeight: 1 } } },
    };
    const model = playingCardModel(reg, { cardId: def.id }, { definition: def, rules: legacy });
    assert.equal(model.tokens.damage, 19);
    assert.equal(model.type.label, 'SPELL');
    assert.equal(model.sigils.traditions, undefined);
    const detail = cardDetailHtml(reg, { cardId: def.id }, { definition: def, rules: legacy });
    assert.match(detail, /role="img" aria-label="Spell"/);
    assert.doesNotMatch(detail, /Arcane magic scales with Intelligence/);
    const legacyRegistry = { ...reg, gameProfile: legacy.gameProfile };
    assert.equal(playingCardModel(legacyRegistry, { cardId: def.id }, { definition: def }).type.label, 'SPELL');
    const preview = { resolvedDefinition: def, faceRules: legacy, tokens: { damage: 19 }, cost: 1, manaCost: 1 };
    assert.equal(playingCardModel(reg, { cardId: def.id }, { preview }).type.label, 'SPELL');
  }
  assert.equal(playingCardModel(reg, { cardId: def.id }, { definition: def }).type.label, 'ARCANE',
    'a no-profile catalog continues to present the current authored traditions');
});
