import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameContent, projectGameCard } from '../src/model/gameProfile.js';
import { validateContent } from '../src/model/validate.js';
import { CardSpellTraditions, SpellPoolRole, SpellPoolWeights } from '../src/model/spellTraditions.js';
import { gameProfileRewardPools } from '../src/model/gameProfileRewards.js';

const sourceCards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const profile = resolveGameProfile('core');
const bundle = applyGameProfileToContent(contentBundle, profile);
const registries = bindGameProfileRegistries(createRegistries(bundle), profile);
const isSpell = card => card.tags?.includes('camp:spell');
const countRoles = cards => cards.reduce((counts, card) => {
  counts[SpellPoolRole(card)]++;
  return counts;
}, { offense: 0, support: 0 });

test('every new spell has an authored playable variant for each resource combination', () => {
  const ids = ['core.purifyingLight', 'core.mindLance', 'core.cleansingEmbers', 'core.rootedShelter', 'core.stormBlessing', 'core.rimeVeil'];
  for (const include of [['hp', 'sp', 'mp'], ['hp', 'sp'], ['hp', 'mp'], ['hp']]) {
    const configured = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { resources: { include } } });
    for (const id of ids) {
      const card = projectGameCard(configured, id);
      assert.equal(card.staminaCost, include.includes('sp') ? 1 : 0, `${id}: ${include}`);
      assert.equal(card.manaCost, include.includes('mp') ? 1 : 0, `${id}: ${include}`);
    }
  }
});

test('exclusive Core catalogs embody the Arcane 2:1 and Divine 3:1 identities with real effects', () => {
  const exclusive = tradition => sourceCards.filter(card => isSpell(card)
    && card.tags.includes(`tradition:${tradition}`)
    && card.tags.filter(tag => tag.startsWith('tradition:')).length === 1);
  assert.deepEqual(countRoles(exclusive('arcane')), { offense: 10, support: 5 });
  assert.deepEqual(countRoles(exclusive('divine')), { offense: 5, support: 15 });
});

test('each shared natural school includes an authored support choice with both tags', () => {
  const expected = {
    fire: 'core.cleansingEmbers', earth: 'core.rootedShelter',
    lightning: 'core.stormBlessing', frost: 'core.rimeVeil',
  };
  for (const [school, id] of Object.entries(expected)) {
    const card = sourceCards.find(card => card.id === id);
    assert.ok(card.tags.includes(`school:${school}`), id);
    assert.deepEqual(card.tags.filter(tag => tag.startsWith('tradition:')).sort(), ['tradition:arcane', 'tradition:divine']);
    assert.equal(SpellPoolRole(card), 'support', id);
    assert.ok(!card.effects.some(effect => effect.op === 'damage'), id);
  }
});

test('Divine support includes cleansing, regeneration, Poise restoration and suppression', () => {
  const get = id => sourceCards.find(card => card.id === id);
  for (const id of ['core.censure', 'core.rendingHex', 'core.acidSplash', 'core.witherDraught', 'core.graveToll']) {
    const card = get(id);
    assert.equal(SpellPoolRole(card), 'support', id);
    for (const effects of [card.effects, card.upgrade.effects]) assert.ok(!effects.some(effect => effect.op === 'damage'), id);
  }
  assert.ok(get('core.purifyingLight').effects.some(effect => effect.op === 'heal'));
  assert.deepEqual(get('core.purifyingLight').effects.filter(effect => effect.op === 'removeStatus').map(effect => effect.status), ['weak', 'frail']);
  assert.ok(get('core.graveToll').effects.some(effect => effect.op === 'restorePoise'));
  assert.ok(get('core.guidingWhisper').effects.some(effect => effect.op === 'applyStatus' && effect.status === 'regen'));
  assert.ok(!gameContent(profile, 'rewards').eligibility.excludeCardIds.includes('core.guidingWhisper'));
});

test('resolved Core content has valid effect references, tokens and canonical spell tradition tags', () => {
  const validation = validateContent(bundle);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));
  const spells = registries.cards.all().filter(isSpell);
  assert.ok(spells.length > sourceCards.filter(isSpell).length, 'audit includes base, legacy and enemy-projected spells');
  for (const card of spells) {
    const actual = card.tags.filter(tag => tag.startsWith('tradition:')).map(tag => tag.slice(10)).sort();
    assert.deepEqual(actual, [...CardSpellTraditions(card)].sort(), card.id);
  }
});

test('resolved class reward pools retain both roles and normalize to the intended tradition ratio', t => {
  const profileMeta = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['qa-1', 'qa-2', 'qa-3'] } } };
  for (const [classId, tradition, ratio] of [['starseer', 'arcane', 2], ['herald', 'divine', 1 / 3]]) {
    const run = createRunState({ registries, classId, seed: 7, profileMeta });
    // Audit the complete role pool before affordability narrows it early in a climb.
    run.maxMana = 99;
    const eligible = gameProfileRewardPools(registries, run).combatCards.map(id => registries.cards.get(id)).filter(isSpell);
    const cards = eligible.filter(card => CardSpellTraditions(card).includes(tradition));
    const counts = countRoles(cards);
    assert.ok(counts.offense > 0 && counts.support > 0, classId);
    const weights = SpellPoolWeights(cards, tradition);
    const totals = cards.reduce((out, card) => { out[SpellPoolRole(card)] += weights[card.id]; return out; }, { offense: 0, support: 0 });
    assert.ok(Math.abs(totals.offense / totals.support - ratio) < 1e-9, JSON.stringify(totals));
    t.diagnostic(`${classId} resolved ${tradition} pool: ${counts.offense} offense, ${counts.support} support; normalized role ratio ${ratio}`);
  }
});


test('switching casting focus filters exclusive spells while keeping shared, martial and owned pool entries', () => {
  const profileMeta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
  const run = createRunState({ registries, classId: 'rogue', seed: 7, profileMeta });
  run.maxMana = 99;
  const pool = (intelligence, wisdom) => {
    run.attributes.intelligence = intelligence;
    run.attributes.wisdom = wisdom;
    return new Set(gameProfileRewardPools(registries, run).combatCards);
  };
  const arcane = pool(10, 1), divine = pool(1, 10);
  assert.ok(arcane.has('core.manaLash') && !divine.has('core.manaLash'));
  assert.ok(divine.has('core.hexmark') && !arcane.has('core.hexmark'));
  assert.ok(run.deck.some(card => card.cardId === 'core.venomedEdge'), 'owned martial fixture');
  for (const id of ['core.rootedShelter', 'core.rimeVeil', 'core.smokeVeil', 'core.venomedEdge']) {
    assert.ok(arcane.has(id) && divine.has(id), `${id}: shared magic, martial and owned eligibility survives the focus change`);
  }
});
