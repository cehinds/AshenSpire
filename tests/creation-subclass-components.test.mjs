import { subclassDeckPreview } from '../src/model/subclassDeck.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { subclassOptions } from '../src/model/subclasses.js';
import { startingAbilityPlan } from '../src/model/startingAbilities.js';
import { creationAbilitySelection, creationFlowCategories } from '../src/ui/models/CreationWorkspaceModel.js';
import { createCreationSubclassSelector, createCreationStartingDeck } from '../src/ui/components/creationSubclass.js';
import { creationSubclassSelection, creationStartingDeckModel, creationDraftStartingDeck, CREATION_CARD_RULES } from '../src/ui/models/CreationSubclassModel.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = createRegistries(contentBundle);
const choices = [
  { id: 'a', name: 'First path', glyph: '⚔', description: 'Complete first path description.', default: true },
  { id: 'b', name: 'Second path', glyph: '❄', description: 'Complete second path description.' },
];
const refs = [
  ...['Smash', 'Counter', 'Power', 'Skill', 'Sweep'].map(openingRole => ({ cardId: 'strike', openingRole, openingSource: 'subclass' })),
  { cardId: 'strike', openingRole: 'Class', openingSource: 'class' },
  { cardId: 'strike', openingRole: 'Weapon Art', openingSource: 'weaponArt' },
  ...['Strike', 'Strike', 'Defend', 'Defend'].map(openingRole => ({ cardId: openingRole.toLowerCase(), openingRole, openingSource: 'basic' })),
];

test('creation chooses an explicit legal subclass and replaces stale cross-class selections', () => {
  assert.equal(creationSubclassSelection(choices, 'b'), 'b');
  assert.equal(creationSubclassSelection(choices, 'previous-class'), 'a');
  assert.equal(creationSubclassSelection([], 'a'), null);
});

test('subclass choices select on a single native activation and keep full authored detail', () => withKitDom(dom => {
  let picked;
  const selector = createCreationSubclassSelector({ options: choices, onChoose: id => { picked = id; } });
  dom.document.body.append(selector);
  const second = selector.querySelector('[data-subclass="b"]');
  second.focus(); second.click();
  assert.equal(picked, 'b');
  assert.equal(selector.dataset.subclass, 'b');
  assert.equal(second.getAttribute('aria-pressed'), 'true');
  assert.equal(selector.querySelector('[data-subclass="a"]').getAttribute('aria-pressed'), 'false');
  assert.equal(selector.querySelector('.cc-subclass-description').textContent, choices[1].description);
  assert.equal(dom.document.activeElement, second, 'selection retains its native focus target');
  selector.setOptions([{ ...choices[0], id: 'new-class-path' }]);
  assert.equal(selector.dataset.subclass, 'new-class-path');
  assert.equal(selector.querySelectorAll('button').length, 1, 'stale choices are removed');
}));

test('deck receipt preserves all eleven copies, source counts, and roles', () => {
  const model = creationStartingDeckModel(registries, refs);
  assert.deepEqual(model.map(group => group.cards.length), [5, 1, 1, 4]);
  assert.equal(model[0].cards[0].roleStringId, 'creation.subclass.role.smash');
  assert.equal(model[3].cards[0].definition.name, 'Strike');
  assert.equal(model[3].cards[1].definition.name, 'Strike');
  assert.notEqual(model[3].cards[0].key, model[3].cards[1].key);
});

test('all eight authored choices preview their real eleven-card run deck and preserve Feats before tagged Spells', () => {
  let count = 0;
  for (const cls of registries.classes.all()) {
    const options = subclassOptions(registries, cls.id);
    assert.equal(options.length, 2);
    for (const subclass of options) {
      const run = createRunState({ registries, classId: cls.id, subclassId: subclass.id, seed: 42 });
      const preview = subclassDeckPreview(registries, run);
      const groups = creationStartingDeckModel(registries, preview);
      assert.deepEqual(groups.map(group => group.cards.length), [5, 1, 1, 4], subclass.id);
      assert.deepEqual(preview.map(ref => ref.cardId).sort(), run.deck.map(ref => ref.cardId).sort(), `${subclass.id} shows every dealt copy`);
      const flow = creationFlowCategories(registries, cls.id);
      if (flow.includes('spells')) assert.equal(flow[flow.indexOf('feats') + 1], 'spells');
      count += 1;
    }
  }
  assert.equal(count, 8);
});

test('subclass change revalidates the starting spell count without retaining a hidden invalid pick', () => {
  const cleric = createRunState({ registries, classId: 'herald', subclassId: 'cleric', seed: 42 });
  const monk = createRunState({ registries, classId: 'herald', subclassId: 'monk', seed: 42 });
  const clericPlan = startingAbilityPlan(registries, cleric);
  const monkPlan = startingAbilityPlan(registries, monk);
  assert.equal(clericPlan.count, 2);
  assert.equal(monkPlan.count, 1);
  const clericIds = creationAbilitySelection(clericPlan.choices.map(card => card.id), clericPlan);
  const monkIds = creationAbilitySelection(clericIds, monkPlan);
  assert.ok(monkIds.length <= 1);
  assert.ok(monkIds.every(id => monkPlan.choices.some(card => card.id === id)));
  assert.equal(subclassDeckPreview(registries, monk, { startingAbilityIds: monkIds }).length, 11);
});

test('draft preview handles no picks, one caster pick, and stale retained picks without relaxing birth validation', () => {
  const run = createRunState({ registries, classId: 'starseer', subclassId: 'battleMage', seed: 42 });
  const plan = startingAbilityPlan(registries, run);
  const chosen = plan.choices[0].id;
  assert.equal(creationDraftStartingDeck(registries, run, []).length, 11);
  assert.ok(creationDraftStartingDeck(registries, run, [chosen]).some(ref => ref.cardId === chosen && ref.abilityRank === plan.rank));
  const stale = ['not-an-eligible-ability'];
  assert.deepEqual(creationDraftStartingDeck(registries, run, stale), creationDraftStartingDeck(registries, run, []));
  assert.deepEqual(stale, ['not-an-eligible-ability'], 'preview never mutates point-buy Cancel state');
  assert.throws(() => createRunState({ registries, classId: 'starseer', subclassId: 'battleMage', seed: 42, startingAbilityIds: [chosen] }), /Choose 2/);
});

test('starting-card inspection shows current Crystal Barrier Ward rules', () => withKitDom(dom => {
  dom.document.getSelection = () => null;
  dom.document.documentElement = dom.document.body;
  const proto = Object.getPrototypeOf(dom.document.body);
  const markup = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
  Object.defineProperty(proto, 'innerHTML', { ...markup, set(value) { this.inspectionMarkup = value; markup.set.call(this, value); } });
  try {
    const ref = { cardId: 'crystalBarrier', abilityRank: 1, openingRole: 'Skill', openingSource: 'subclass' };
    const model = creationStartingDeckModel(registries, [ref])[0].cards[0];
    assert.deepEqual(model.definition, resolveCombatCard({ registries, ...CREATION_CARD_RULES }, ref));
    const deck = createCreationStartingDeck({ registries, refs: [ref] });
    dom.document.body.append(deck);
    deck.querySelector('.cc-subclass-deck-card').click();
    const face = dom.document.querySelector('[data-ui-component="creation-starting-card-inspector"]');
    const text = face.inspectionMarkup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    assert.match(text, /Gain\s+4\s+Ward/);
    assert.doesNotMatch(text, /Gain\s+4\s+Block/);
    dom.document.querySelector('.modal-close').click();
  } finally { Object.defineProperty(proto, 'innerHTML', markup); }
}));

test('stamped preview definitions, costs, rules and sources match birth basics and chosen abilities without mutating the run', () => {
  const sourceFields = ['mods', 'damageSchool', 'sourceArmamentId', 'sourceHand', 'weaponId', 'profileId', 'equipmentAttackSlotId', 'grantedBy', 'grantSource', 'abilityRank', 'exposureBuildupPerHit', 'magicShare', 'physicalDamageType'];
  for (const subclass of registries.subclasses.all()) {
    const config = { registries, classId: subclass.classId, subclassId: subclass.id, seed: 42 };
    const base = createRunState(config);
    const plan = startingAbilityPlan(registries, base);
    const chosen = creationAbilitySelection(plan.choices.map(card => card.id), plan);
    for (const ids of [undefined, chosen]) {
      const run = createRunState({ ...config, startingAbilityIds: ids });
      const before = structuredClone(run);
      const preview = creationDraftStartingDeck(registries, run, ids || []);
      assert.deepEqual(run, before, `${subclass.id}: disposable preview leaves the run unchanged`);
      const cards = creationStartingDeckModel(registries, preview).flatMap(group => group.cards);
      const actual = [...run.deck];
      for (const card of cards) {
        const at = actual.findIndex(ref => ref.cardId === card.ref.cardId && ref.equipmentAttackSlotId === card.ref.equipmentAttackSlotId && ref.openingRole === card.ref.openingRole && ref.openingSource === card.ref.openingSource);
        assert.ok(at >= 0, `${subclass.id}: each preview copy has a birth counterpart`);
        const [birth] = actual.splice(at, 1);
        assert.deepEqual(card.definition, resolveCombatCard({ ...run, registries }, birth), `${subclass.id}: full definition and cost`);
        assert.equal(cardPlainText(registries, card.ref, { rules: CREATION_CARD_RULES }), cardPlainText(registries, birth, { rules: CREATION_CARD_RULES }), `${subclass.id}: rules text and numbers`);
        assert.deepEqual(Object.fromEntries(sourceFields.map(key => [key, card.ref[key]])), Object.fromEntries(sourceFields.map(key => [key, birth[key]])), `${subclass.id}: equipment source and stamped modifiers`);
      }
      assert.equal(actual.length, 0);
    }
  }
});

test('every visible starting card opens full inspection and returns focus', () => withKitDom(dom => {
  dom.document.getSelection = () => null;
  dom.document.documentElement = dom.document.body;
  const deck = createCreationStartingDeck({ registries, refs });
  dom.document.body.append(deck);
  assert.equal(deck.dataset.deckCount, '11');
  const controls = deck.querySelectorAll('.cc-subclass-deck-card');
  assert.equal(controls.length, 11);
  assert.match(deck.querySelector('.cc-panel-heading .as-subtitle').textContent, /5 subclass \+ 1 class \+ 1 weapon art \+ 4 basics/);
  for (const control of controls) {
    assert.equal(control.getAttribute('type'), 'button');
    assert.equal(control.getAttribute('aria-haspopup'), 'dialog');
    control.focus(); control.click();
    assert.ok(dom.document.querySelector('[data-ui-component="creation-starting-card-inspector"]'));
    dom.document.querySelector('.modal-close').click();
    assert.equal(dom.document.activeElement, control);
  }
}));
