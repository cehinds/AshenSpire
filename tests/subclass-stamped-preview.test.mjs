import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { stampedSubclassDeckPreview } from '../src/model/subclassDeck.js';
import { startingAbilityPlan } from '../src/model/startingAbilities.js';
import { creationHandChoices } from '../src/model/characterCreation.js';
import { productionBundle } from './helpers/production-bundle.mjs';

const registries = createRegistries(contentBundle);
const birth = (def, options = {}) => createRunState({ seed: 42, registries, classId: def.classId, subclassId: def.id, enemyKnowledgeVersion: null, ...options });
const key = card => [card.openingSource, card.openingRole, card.equipmentAttackSlotId || '', card.cardId].join('|');
function parity(r, preview, actual) {
  assert.equal(preview.length, actual.length);
  const groups = new Map();
  for (const card of actual) {
    const group = groups.get(key(card)) || [];
    group.push(card); groups.set(key(card), group);
  }
  for (const ref of preview) {
    const card = groups.get(key(ref))?.shift();
    assert.ok(card, `actual birth contains ${key(ref)}`);
    // Full resolved definition includes all costs, damage/block, hit counts,
    // carrier school, source tags and printed text; no implementation mirror.
    assert.deepEqual(resolveCard(r, ref), resolveCard(r, card));
    for (const field of ['mods','sourceArmamentId','sourceHand','weaponId','smithingLevel','ratingId','ratingValue','ratingCap','profileReceipt','damageSchool','exposureBuildupPerHit','magicShare','physicalDamageType']) {
      assert.deepEqual(ref[field], card[field], `${key(ref)}.${field}`);
    }
  }
}

for (const def of registries.subclasses.all()) test(`${def.name} default and empty draft preview match the stamped birth`, () => {
  const run = birth(def), before = structuredClone(run);
  parity(registries, stampedSubclassDeckPreview(registries, run), run.deck);
  parity(registries, stampedSubclassDeckPreview(registries, run, { startingAbilityIds: [] }), run.deck);
  assert.deepEqual(run, before, 'preview never stamps or reconciles the caller');
});

test('all subclass equipment choices preview actual equipment amounts, hits, sources and ratings', () => {
  for (const def of registries.subclasses.all()) {
    const choices = [...creationHandChoices(registries, def.classId, 'rightHand'), null];
    for (const piece of choices) {
      const options = { startingHands: { rightHand: piece?.id || null, leftHand: null } };
      let run;
      try { run = birth(def, options); }
      catch (error) { if (/requires|handed|does not fit/.test(error.message)) continue; throw error; }
      const snapshot = structuredClone(run);
      parity(registries, stampedSubclassDeckPreview(registries, run), run.deck);
      assert.deepEqual(run, snapshot);
    }
  }
});

test('partial magic drafts keep the same stamped basics and complete picks match actual birth', () => {
  for (const id of ['battleMage','frostMonarch','cleric','monk']) {
    const def = registries.subclasses.get(id), run = birth(def), plan = startingAbilityPlan(registries, run);
    const ids = plan.choices.slice(0, plan.count).map(card => card.id);
    const partial = stampedSubclassDeckPreview(registries, run, { startingAbilityIds: ids.slice(0,1) });
    parity(registries, partial.filter(card => card.openingSource === 'basic'), run.deck.filter(card => card.openingSource === 'basic'));
    const actual = birth(def, { startingAbilityIds: ids });
    parity(registries, stampedSubclassDeckPreview(registries, run, { startingAbilityIds: ids }), actual.deck);
  }
});

test('FrostMonarch physical source receipts and immutable registry match actual birth', () => {
  const def = registries.subclasses.get('frostMonarch');
  const run = birth(def, { startingHands: { rightHand: null, leftHand: null } });
  const cardTable = JSON.stringify(registries.cards.all()), equipment = JSON.stringify(registries.equipment);
  parity(registries, stampedSubclassDeckPreview(registries, run), run.deck);
  assert.equal(JSON.stringify(registries.cards.all()), cardTable);
  assert.equal(JSON.stringify(registries.equipment), equipment);
});

test('real main-initialized production loader resolves and stamps preview helpers safely', () => {
  const require = productionBundle();
  const { contentBundle } = require('src/content/index.js');
  const r = require('src/model/registries.js').createRegistries(contentBundle);
  const state = require('src/model/state.js'), deck = require('src/model/subclassDeck.js');
  for (const def of r.subclasses.all()) {
    const run = state.createRunState({ registries: r, seed: 42, classId: def.classId, subclassId: def.id });
    const preview = deck.stampedSubclassDeckPreview(r, run, { startingAbilityIds: [] });
    assert.equal(preview.length, 11);
    parity(r, preview, run.deck);
  }
});
