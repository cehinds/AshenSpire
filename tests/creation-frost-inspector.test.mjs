import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { previewCard, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { playingCardDefinition, combatCardSummary } from '../src/model/playingCard.js';
import { creationDraftStartingDeck, creationStartingDeckModel, CREATION_CARD_RULES } from '../src/ui/models/CreationSubclassModel.js';
import { createCreationStartingDeck } from '../src/ui/components/creationSubclass.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { productionBundle } from './helpers/production-bundle.mjs';

// The shipped Starseer creation list offers focuses only. This authored fixture
// admits the existing sword, exercising a legal Sword/Staff birth without
// altering production choice lists or smuggling source bonuses into refs.
const registries = createRegistries({ ...contentBundle, characterCreation: {
  ...contentBundle.characterCreation, classes: { ...contentBundle.characterCreation.classes,
    starseer: { ...contentBundle.characterCreation.classes.starseer,
      handIds: [...contentBundle.characterCreation.classes.starseer.handIds, 'straightSword'] } },
} });
const birth = (extra = {}) => createRunState({ registries, seed: 42, classId: 'starseer', subclassId: 'frostMonarch',
  enemyKnowledgeVersion: null, startingHands: { rightHand: 'straightSword', leftHand: 'ashStaff' }, ...extra });
const rows = (run, refs) => creationStartingDeckModel(registries, refs, { run }).flatMap(group => group.cards);
const stored = () => JSON.stringify({ cards: registries.cards.all(), equipment: registries.equipment });

function encounter(run, ref) {
  const candidate = structuredClone(run);
  candidate.deck = [structuredClone(ref)]; candidate.drawPerTurn = 1;
  const combat = createRunCombat({ registries, run: candidate, rng: createRng(42), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0]; enemy.hp = enemy.maxHp = 1000; enemy.block = enemy.barrier = 0;
  enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {}; enemy.combatTraits = {};
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
  enemy.persistentWard = { value: 0, max: 0 }; enemy.persistentPoise = { value: 0, max: 0 };
  delete enemy.combatCounter; delete enemy.combatStance; delete enemy.combatEvade;
  return { combat, enemy };
}

test('full starting-card inspector renders inherited Cold and HP-gated Frost matching an actual sword hit', () => withKitDom(dom => {
  dom.document.getSelection = () => null; dom.document.documentElement = dom.document.body;
  const proto = Object.getPrototypeOf(dom.document.body), markup = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
  Object.defineProperty(proto, 'innerHTML', { ...markup, set(value) { this.inspectionMarkup = value; markup.set.call(this, value); } });
  try {
    const run = birth(), before = structuredClone(run), registryBefore = stored();
    const refs = creationDraftStartingDeck(registries, run), refsBefore = structuredClone(refs);
    const cards = rows(run, refs), sword = cards.find(card => card.ref.openingRole === 'Strike' && card.ref.weaponId === 'straightSword');
    assert(sword.preview, 'actual weapon source gains a disposable display receipt');
    const damage = sword.preview.values.find(value => value.sourceInfusion);
    assert.equal(damage.infusionComponents[0].amount, 2);
    assert(damage.tags.includes('damage:frost')); assert.equal(damage.sourceName, 'Straight Sword');
    const deck = createCreationStartingDeck({ registries, refs, run }); dom.document.body.append(deck);
    const strikes = [...deck.querySelectorAll('[data-deck-role="Strike"]')];
    strikes[0].click();
    const face = dom.document.querySelector('[data-ui-component="creation-starting-card-inspector"]');
    const text = face.inspectionMarkup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    assert.match(text, /2 Cold/); assert.match(text, /1 Frost buildup after each hit causes HP loss/);
    const domText = node => [node.textContent || '', ...(node.children || []).map(domText)].join(' ');
    assert.match(domText(dom.document.querySelector('.card-inspection-details')), /Weapon source: Straight Sword/);
    const { combat, enemy } = encounter(run, sword.ref), hp = enemy.hp;
    const result = dispatch(combat, { type: 'playCard', cardInstanceId: sword.ref.instanceId, targetId: enemy.id });
    assert.equal(hp - enemy.hp, damage.faceValue);
    assert.equal(result.events.find(event => event.type === 'damageDealt').magicAmount, 2);
    assert.equal(enemy.statusControl.gauges.frost.value, 1);
    assert.deepEqual(run, before); assert.deepEqual(refs, refsBefore); assert.equal(stored(), registryBefore);
    assert.equal(sword.ref.sourceInfusion, undefined, 'birth refs remain source-independent');
    dom.document.querySelector('.modal-close').click();
  } finally { Object.defineProperty(proto, 'innerHTML', markup); }
}));

test('chosen weapon Counter art prints the same potential reply plus Cold as the engine', () => {
  const run = birth(), refs = creationDraftStartingDeck(registries, run);
  const art = rows(run, refs).find(card => card.ref.openingRole === 'Weapon Art');
  assert.equal(art.ref.cardId, 'guardCounter'); assert(art.preview);
  const summary = combatCardSummary(art.definition, art.preview, registries);
  assert.match(summary, /Return.*2 Cold/); assert.match(summary, /1 Frost buildup after each hit causes HP loss/);
  assert.match(summary, /Slashing/);
  const { combat } = encounter(run, art.ref);
  const actual = previewCard(combat, art.ref.instanceId);
  const projected = art.preview.values.find(value => value.sourceInfusion);
  assert.equal(projected.value, actual.values.find(value => value.sourceInfusion).value);
  assert.equal(projected.infusionComponents[0].amount, 2);
});

test('real stamped staff Strike previews and plays without weapon parsing or Frost leakage', () => {
  const run = birth(), refs = creationDraftStartingDeck(registries, run);
  const staff = rows(run, refs).find(card => card.ref.openingRole === 'Strike' && card.ref.weaponId === 'ashStaff');
  assert.equal(staff.preview, null);
  const { combat, enemy } = encounter(run, staff.ref);
  const actual = previewCard(combat, staff.ref.instanceId, enemy.id);
  assert(actual.values.every(value => !value.sourceInfusion));
  const before = enemy.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: staff.ref.instanceId, targetId: enemy.id });
  assert.equal(before - enemy.hp, actual.values.find(value => value.op === 'damage').totalDamage);
  assert.equal(enemy.statusControl.gauges.frost, undefined);
});

test('pure casts, bare hands, classless and legacy contexts retain static creation definitions', () => {
  const run = birth(), refs = creationDraftStartingDeck(registries, run);
  const spell = rows(run, refs).find(card => card.ref.openingRole === 'Spell');
  assert.equal(spell.preview, null);
  const empty = birth({ startingHands: { rightHand: null, leftHand: null } });
  assert(rows(empty, creationDraftStartingDeck(registries, empty)).every(card => card.preview === null));
  for (const candidate of [{ ...run, classUnequipped: true }, { ...run, subclassId: undefined }, { ...run, subclassId: 'battleMage' }]) {
    for (const card of rows(candidate, refs)) {
      assert.equal(card.preview, null);
      assert.deepEqual(card.definition, playingCardDefinition(registries, card.ref, { rules: CREATION_CARD_RULES }));
    }
  }
});

test('real main production loader safely initializes UI preview engine dependencies', () => {
  const require = productionBundle();
  const r = require('src/model/registries.js').createRegistries(require('src/content/index.js').contentBundle);
  const run = require('src/model/state.js').createRunState({ registries: r, seed: 42, classId: 'starseer', subclassId: 'frostMonarch', enemyKnowledgeVersion: null });
  run.loadout.sets.rightHand[0] = 'straightSword'; run.loadout.sets.leftHand[0] = 'ashStaff';
  const model = require('src/ui/models/CreationSubclassModel.js'), refs = model.creationDraftStartingDeck(r, run);
  const cards = model.creationStartingDeckModel(r, refs, { run }).flatMap(group => group.cards);
  assert.equal(cards.length, 11);
  const sword = cards.find(card => card.ref.openingRole === 'Strike' && card.ref.weaponId === 'straightSword');
  assert.equal(sword.preview.values.find(value => value.sourceInfusion).infusionComponents[0].amount, 2);
});
