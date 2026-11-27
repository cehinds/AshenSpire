import test from 'node:test';
import assert from 'node:assert/strict';
import { combatProfileFor, combatProfileTags } from '../src/model/combatCardProfile.js';

test('missing combat carrier has no identity or tag rows', () => {
  for (const carrier of [null, undefined]) {
    assert.deepEqual(combatProfileFor(carrier), {
      camp: null, maneuver: null, school: null, damageType: null, counterMode: null,
    });
    assert.deepEqual(combatProfileTags(carrier), []);
  }
});
import { objectTagIds, TAGGING } from '../src/content/tags.js';
import { progressionCards } from '../src/content/progression/cards.js';
import { basicCardProfiles } from '../src/content/generated/basicCardProfiles.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { tagService } from '../src/model/tagService.js';

const cardModules = await Promise.all(['reaver', 'starseer', 'herald', 'rogue', 'colorless', 'coop', 'armaments']
  .map(name => import(`../src/content/cards/${name}.js`)));
const cards = [...cardModules.flatMap(module => Object.values(module).find(value => Array.isArray(value) && value[0]?.id)), ...progressionCards];
const enemyModules = await Promise.all(['act1', 'act2', 'act3'].map(name => import(`../src/content/enemies/${name}.js`)));
const enemies = enemyModules.flatMap(module => Object.values(module).find(value => Array.isArray(value) && value[0]?.id));

function verifyProfile(profile, name) {
  assert.ok(['physical', 'spell'].includes(profile.camp), `${name}: missing camp`);
  if (profile.camp === 'spell') assert.ok(profile.school, `${name}: missing school`);
  else assert.equal(profile.school, null, `${name}: physical card carries spell school`);
  if (profile.maneuver === 'counter') assert.ok(profile.counterMode, `${name}: missing counter reach`);
  else assert.equal(profile.counterMode, null, `${name}: counter reach on non-counter`);
}

test('every current card, progression family, and equipment kit profile carries canonical combat identity', () => {
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  const materialized = createRegistries(contentBundle);
  for (const card of [...cards, ...contentBundle.cards]) {
    const definition = materialized.cards.get(card.id);
    if (definition.burden) {
      assert.equal(definition.type, 'status', `${card.id}: burdens are status carriers`);
      assert.ok(definition.keywords.includes('unplayable'), `${card.id}: a non-action burden cannot be played`);
    } else verifyProfile(combatProfileFor(definition), card.id);
  }
  for (const profile of basicCardProfiles) {
    verifyProfile(combatProfileFor({ id: profile.id, tags: objectTagIds('basicCardProfile', profile.id) }), profile.id);
  }
});

test('every enemy action carries independent scoped combat identity', () => {
  for (const enemy of enemies) {
    for (const [moveId, move] of Object.entries(enemy.moves)) {
      const profile = combatProfileFor({ enemyId: enemy.id, moveId });
      verifyProfile(profile, `${enemy.id}.${moveId}`);
      if (move.damage) assert.ok(profile.damageType, `${enemy.id}.${moveId}: missing damage type`);
    }
  }
  assert.equal(combatProfileFor({ enemyId: 'blightHound', moveId: 'lunge' }).damageType, 'piercing');
  assert.equal(combatProfileFor({ enemyId: 'courtDuelist', moveId: 'riposte' }).counterMode, 'melee');
  assert.equal(combatProfileFor({ enemyId: 'mirrorScribe', moveId: 'polishedWard' }).counterMode, 'spell');
  assert.equal(combatProfileFor({ enemyId: 'chainScavenger', moveId: 'chainSnare' }).counterMode, 'ranged');
});

test('scoped enemy moves resolve through both the tag service and nested combat registry', () => {
  const registries = createRegistries(contentBundle);
  const service = tagService(registries);
  const meleeCounters = service.withTag('enemyMove', 'counter:melee');
  assert.deepEqual(meleeCounters.map(move => `${move.enemyId}.${move.id}`).sort(),
    ['cinderMantis.foldedBlades', 'courtDuelist.riposte', 'gildedKnight.parry', 'mirrorFanAbbess.mirrorRiposte']);
  // Codex roster (2026-11-18) added 95 physical and 37 spell moves to the 68 and 37 before it.
  assert.equal(service.withTag('enemyMove', 'camp:physical').length, 163);
  assert.equal(service.withTag('enemyMove', 'camp:spell').length, 74);
  for (const move of registries.enemyMoves) {
    const nested = registries.enemies.get(move.enemyId).moves[move.id];
    assert.equal(nested, move, `${move.enemyId}.${move.id}: combat and tag queries share the stamped action`);
    assert.deepEqual(service.idsOf('enemyMove', move), nested.tags);
  }
});

test('counter faces describe deferred replies while keeping immediate support visible', () => {
  const counterCards = contentBundle.cards.filter(card => combatProfileFor(card).maneuver === 'counter');
  assert.ok(counterCards.length > 0);
  for (const card of counterCards) {
    const preparation = /(?:Prepare (?:(?:Melee|Ranged|Spell)|a (?:frost|fire|lightning|force|alteration|illusion|divine|decay)) Counter|Counter Melee attacks for)/;
    assert.match(card.textTemplate, preparation, card.id);
    if (card.minCombatExpansionVersion === 2) {
      assert.ok(card.counterCoverage, `${card.id}: explicit coverage`);
      assert.ok(card.counterPayload, `${card.id}: explicit deferred payload`);
    }
    for (const grade of card.gradeProfiles || []) {
      assert.match(grade.textTemplate, preparation, `${card.id} rank ${grade.rank}`);
    }
  }
  const parry = contentBundle.cards.find(card => card.id === 'bindingParry');
  assert.match(parry.textTemplate, /Gain \{block\} Block/);
  assert.match(parry.textTemplate, /Draw \{draw\} card/);
});

test('counter reach, spell school, utility identity, and requested labels stay separate', () => {
  assert.equal(combatProfileFor('nockAndWait').counterMode, 'ranged');
  assert.equal(combatProfileFor('wardingStar').counterMode, 'spell');
  assert.equal(combatProfileFor('masterOfStrategy').maneuver, null);
  assert.equal(combatProfileFor('frostNova').school, 'frost');
  assert.equal(combatProfileFor('frostNova').damageType, 'frost');
  assert.equal(combatProfileTags('frostNova').find(tag => tag.id === 'damage:frost').label, 'Cold');
  assert.equal(combatProfileTags({ camp: 'spell', school: 'force', damageType: 'arcane' }).find(tag => tag.id === 'damage:arcane').label, 'Force');
});

test('resolved equipment identity overrides source card lookup without guessing from names', () => {
  const profile = combatProfileFor({ id: 'strike', tags: ['camp:physical', 'maneuver:ranged', 'damage:piercing'] });
  assert.equal(profile.maneuver, 'ranged');
  assert.equal(profile.damageType, 'piercing');
  assert.equal(combatProfileFor({ id: 'guardCounter', tags: ['blade'] }).counterMode, null);
  assert.equal(combatProfileFor({ id: 'strike', tags: [] }).camp, null);
  assert.equal(combatProfileFor({ name: 'Fire Smash Counter' }).camp, null);
  assert.throws(() => combatProfileFor({ id: 'fixture', tags: ['camp:physical', 'camp:spell'] }), /conflicting/);
});

const explicitProfileTags = ['camp:spell', 'maneuver:casting', 'school:fire', 'damage:fire', 'range:ranged', 'targeting:area', 'trait:impact'];
const explicitProfile = { camp: 'spell', maneuver: 'casting', school: 'fire', damageType: 'fire', counterMode: null,
  range: 'ranged', targeting: 'area', traits: ['impact'] };

test('explicit cardTags and tags remain authoritative, including empty replacements and nullish fallthrough', () => {
  for (const carrier of [
    { id: 'fixture.explicit', cardTags: explicitProfileTags, tags: ['camp:physical'] },
    { cardId: 'fixture.explicit', tags: explicitProfileTags },
    { abilityFamily: 'fixture.explicit', cardTags: null, tags: explicitProfileTags },
  ]) {
    const before = structuredClone(carrier);
    assert.deepEqual(combatProfileFor(carrier), explicitProfile);
    assert.deepEqual(carrier, before);
  }
  for (const carrier of [{ id: 'fixture.explicit', cardTags: [], tags: explicitProfileTags },
    { id: 'fixture.explicit', tags: [] }]) {
    assert.deepEqual(combatProfileFor(carrier), { camp: null, maneuver: null, school: null, damageType: null, counterMode: null });
  }
});

test('nullish tags still resolve current source card and scoped enemy rows through the same junction', () => {
  const card = TAGGING.find(row => row.family === 'card');
  const move = TAGGING.find(row => row.family === 'enemyMove');
  const expectedCard = combatProfileFor({ id: card.objectId, tags: objectTagIds('card', card.objectId) });
  for (const carrier of [card.objectId, { id: card.objectId }, { cardId: card.objectId, tags: null },
    { abilityFamily: card.objectId, cardTags: null, tags: undefined }]) assert.deepEqual(combatProfileFor(carrier), expectedCard);
  const expectedMove = combatProfileFor({ enemyId: move.scope, moveId: move.objectId, tags: objectTagIds('enemyMove', move.objectId, move.scope) });
  for (const carrier of [{ enemyId: move.scope, moveId: move.objectId },
    { enemyDefinitionId: move.scope, id: move.objectId, cardTags: null, tags: null }]) assert.deepEqual(combatProfileFor(carrier), expectedMove);
  const missing = { enemyId: 'fixture.absent-scope', moveId: move.objectId };
  assert.deepEqual(combatProfileFor(missing), combatProfileFor({ ...missing, tags: objectTagIds('enemyMove', move.objectId, missing.enemyId) }));
});

test('tag getters are evaluated at most once per call and still follow the nullish precedence', () => {
  const reads = [];
  let selected = explicitProfileTags;
  const carrier = { id: 'fixture.getters', get cardTags() { reads.push('cardTags'); return selected; },
    get tags() { reads.push('tags'); return explicitProfileTags; } };
  assert.deepEqual(combatProfileFor(carrier), explicitProfile);
  assert.deepEqual(reads, ['cardTags']);
  reads.length = 0; selected = null;
  assert.deepEqual(combatProfileFor(carrier), explicitProfile);
  assert.deepEqual(reads, ['cardTags', 'tags']);
  reads.length = 0; selected = [];
  assert.equal(combatProfileFor(carrier).camp, null);
  assert.deepEqual(reads, ['cardTags']);
});

test('malformed id and enemy scope retain eager lookup coercion and error precedence', () => {
  for (const field of ['id', 'enemyId']) {
    const reads = [], key = { toString() { reads.push(field); return 'fixture.coerced'; } };
    const carrier = { id: 'fixture.move', [field]: key, get cardTags() { reads.push('cardTags'); return explicitProfileTags; } };
    assert.deepEqual(combatProfileFor(carrier), explicitProfile);
    assert.deepEqual(reads, [field, 'cardTags']);
    const error = new Error('lookup coercion before tag getter');
    const broken = { id: 'fixture.move', [field]: { toString() { throw error; } },
      get cardTags() { throw new Error('tag getter ran first'); } };
    assert.throws(() => combatProfileFor(broken), candidate => candidate === error);
    let tagReads = 0;
    assert.throws(() => combatProfileFor({ id: 'fixture.move', [field]: Symbol('invalid key'),
      get tags() { tagReads++; return ['camp:physical', 'camp:spell']; } }), TypeError);
    assert.equal(tagReads, 0);
  }
});

test('resolved tags retain strict identity validation and existing family error order', () => {
  assert.throws(() => combatProfileFor({ id: 'fixture.invalid', cardTags: ['camp:physical', 'camp:spell'], tags: [] }),
    /fixture.invalid carries conflicting camp: tags/);
  assert.throws(() => combatProfileFor({ id: 'fixture.invalid', tags: ['camp:unknown', 'school:unknown'] }),
    /fixture.invalid carries unknown camp: tag 'unknown'/);
  assert.throws(() => combatProfileFor({ id: 'fixture.invalid', tags: ['camp:spell', 'school:unknown'] }),
    /fixture.invalid carries unknown school: tag 'unknown'/);
  assert.throws(() => combatProfileFor({ id: 'fixture.invalid', cardTags: [null], tags: explicitProfileTags }), TypeError);
});
