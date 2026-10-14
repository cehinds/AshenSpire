import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { statProjection } from '../src/model/statProjection.js';
import { equippedIn } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { counterBaseEvasion } from '../src/engine/counterReturn.js';
import { creationClassTileSummary } from '../src/ui/models/CreationClassTileModel.js';
import { createCreationClassSpecimen } from '../src/ui/catalog/creationSpecimens.js';
import { classChoiceCard, classUnfold } from '../src/ui/components/creationCards.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance, combatRatings: resolveCombatRatings({}, contentBundle) } });
const birth = classId => createRunState({ registries, classId, seed: 7, combatExpansionVersion: 2, enemyKnowledgeVersion: null,
  subclassId: registries.subclasses.all().find(row => row.classId === classId).id });

test('all four Class summaries use canonical short lore, actual gear and combat ratings without mutation', () => {
  for (const cls of registries.classes.all()) {
    const run = birth(cls.id), before = structuredClone(run);
    const summary = creationClassTileSummary(registries, run, statProjection(registries, run));
    const words = summary.lore.split(/\s+/).length;
    assert(words >= 5 && words <= 12, `${cls.id} lore is ${words} words`);
    assert.equal(summary.armament, ['rightHand', 'leftHand'].map(slot => equippedIn(registries, run.loadout, cls.id, slot)).filter(Boolean).map(piece => piece.name).join(' + '));
    const combat = createRunCombat({ registries, run: structuredClone(run), rng: createRng(7), enemyIds: [] });
    const values = Object.fromEntries(summary.ratings.map(row => [row.id, row.value]));
    for (const id of ['ar', 'pr', 'dr', 'poise', 'ward']) assert.equal(values[id], combat.player.ratings[id], `${cls.id} ${id}`);
    assert.equal(values.evasion, counterBaseEvasion(combat, combat.player));
    assert.equal(values.hp, combat.player.maxHp);
    assert.equal(values.stamina, combat.player.maxStamina);
    assert.equal(values.mana, combat.player.maxMana);
    assert.equal(summary.stance, 'Neutral'); assert.equal(combat.player.stanceId, null);
    assert.equal(summary.art, registries.cards.get(run.deck.find(ref => ref.openingRole === 'Weapon Art').cardId).name);
    assert.deepEqual(run, before);
  }
});

test('gear summary reads the current draft refs and both actual hands, including empty hands', () => {
  const run = birth('reaver');
  const refs = [{ cardId: 'twinFang', openingRole: 'Weapon Art' }];
  const summary = creationClassTileSummary(registries, run, statProjection(registries, run), refs);
  assert.equal(summary.art, registries.cards.get('twinFang').name);
  assert.match(summary.armament, /Straight Sword \+ Round Shield/);
  const empty = createRunState({ registries, classId: 'reaver', subclassId: 'heavyKnight', seed: 7,
    startingHands: { rightHand: null, leftHand: null } });
  assert.equal(creationClassTileSummary(registries, empty, statProjection(registries, empty)).armament, 'Bare hands');
});

test('concise unfolded tile has four body rows, all nine ratings and a native relic inspection control', () => withKitDom(dom => {
  const run = birth('reaver'), cls = registries.classes.get(run.class);
  const summary = creationClassTileSummary(registries, run, statProjection(registries, run));
  let inspected = 0;
  const relic = registries.relics.get(cls.startingRelic);
  const face = classUnfold({ cls, relic, summary, onRelicInspect: () => inspected++ });
  dom.document.body.append(face);
  assert.equal(face.querySelector('.cc-unfold-summary').children.length, 5, 'title plus four body rows');
  assert.equal(face.querySelectorAll('[data-stat]').length, 9);
  assert.equal(face.querySelector('.cc-unfold-mastery'), null);
  assert.equal(face.querySelector('.cc-unfold-relic').getAttribute('aria-haspopup'), 'dialog');
  face.querySelector('.cc-unfold-relic').click(); assert.equal(inspected, 1);
  const folded = classChoiceCard(cls, { mastery: 'Mastery and upcoming nodes must not appear' });
  assert.equal(folded.querySelector('.od').textContent, summary.lore);
  assert.equal(folded.querySelector('.om').textContent, summary.playstyle);
  assert.doesNotMatch(folded.querySelector('.om').textContent, /Mastery|upcoming/);
}));

test('production main loader initializes the concise Class model without a dependency cycle', async () => {
  const { productionBundle } = await import('./helpers/production-bundle.mjs');
  const require = productionBundle();
  const r = require('src/model/registries.js').createRegistries(require('src/content/index.js').contentBundle);
  const run = require('src/model/state.js').createRunState({ registries: r, classId: 'reaver', subclassId: 'heavyKnight', seed: 7 });
  const projection = require('src/model/statProjection.js').statProjection(r, run);
  const summary = require('src/ui/models/CreationClassTileModel.js').creationClassTileSummary(r, run, projection);
  assert.equal(summary.ratings.length, 9);
  assert.equal(summary.armament, 'Straight Sword + Round Shield');
});


test('catalog Class miniatures use each actual draft and the concise production summary', () => withKitDom(() => {
  for (const cls of registries.classes.all()) {
    const run = birth(cls.id), before = structuredClone(run);
    const specimen = createCreationClassSpecimen({ registries, classId: cls.id, run });
    assert.equal(specimen.tagName, 'ARTICLE');
    assert(specimen.classList.contains('unfolded'));
    const face = specimen.querySelector('.cc-concise-class');
    assert.equal(face.querySelector('.cc-unfold-summary').children.length, 5);
    assert.equal(face.querySelector('[data-stat="mana"]').textContent, `MP ${run.maxMana}`);
    assert.equal(face.querySelector('.cc-unfold-relic-name').textContent, registries.relics.get(run.relics[0]).name);
    assert.equal(face.querySelector('.cc-unfold-mastery'), null);
    assert.deepEqual(run, before);
  }
}));
