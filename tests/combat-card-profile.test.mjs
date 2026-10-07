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
import { objectTagIds } from '../src/content/tags.js';
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
  for (const card of [...cards, ...contentBundle.cards]) verifyProfile(combatProfileFor(card), card.id);
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
    ['cinderMantis.foldedBlades', 'courtDuelist.riposte', 'gildedKnight.parry']);
  assert.equal(service.withTag('enemyMove', 'camp:physical').length, 66);
  assert.equal(service.withTag('enemyMove', 'camp:spell').length, 37);
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
    assert.match(card.textTemplate, /Prepare (?:Melee|Ranged|Spell) Counter/, card.id);
    for (const grade of card.gradeProfiles || []) {
      assert.match(grade.textTemplate, /Prepare (?:Melee|Ranged|Spell) Counter/, `${card.id} rank ${grade.rank}`);
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
