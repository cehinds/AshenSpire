import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/reward-dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';

// Core deck edits happen at the Armoury; the other profiles still rest at Strategize.
function rewardNote(profileId, options, { editorWhere, servicesPerVisit, editorEnabled, settings } = {}) {
  const profile = resolveGameProfile(profileId);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const dom = rewardDom();
  const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    // Only the run's copy is edited: the snapshot digest guards the registry profile.
    const policy = structuredClone(profile);
    if (editorWhere) policy.modules.cards.editorWhere = editorWhere;
    if (editorEnabled !== undefined) policy.modules.cards.editorEnabled = editorEnabled;
    if (servicesPerVisit) policy.content.rests.servicesPerVisit = servicesPerVisit;
    const run = { class: 'reaver', gameProfile: policy, cinders: 0, deck: [] };
    const offer = { id: `note-${profileId}`, options: options.map(id => ({ kind: 'combatCards', id })), taken: [], claimed: null, takeCount: 1 };
    mountGameProfileOffers(app, { registries, run, offer, title: 'Reward', settings, onTake() {}, onContinue() {} });
    const text = app.querySelector('.reward-note').textContent;
    app.remove();
    return text;
  } finally {
    for (const [key, value] of Object.entries(before)) globalThis[key] = value;
  }
}

test('a Core reward names the Armoury for deck edits and Current keeps Strategize', () => {
  const core = rewardNote('core', ['core.strike', 'core.defend']);
  assert.equal(core, 'Choose 1. Add the card to your deck or edit your deck now; the rest stays in your collection.');
  assert.doesNotMatch(core, /Strategize/);
  const current = rewardNote('current', ['frostNova', 'scholarsInsight']);
  assert.equal(current, 'Choose 1. Add the card to your deck or keep it in your collection; edit your deck at Strategize.');
});

// The note follows cards.editorWhere, independent of the rest servicesPerVisit.
test('the reward note follows editorWhere, not rest servicesPerVisit', () => {
  const armoury = 'Choose 1. Add the card to your deck or edit your deck now; the rest stays in your collection.';
  const strategize = 'Choose 1. Add the card to your deck or keep it in your collection; edit your deck at Strategize.';
  const ids = ['core.strike', 'core.defend'];
  assert.equal(rewardNote('core', ids, { editorWhere: 'noncombat', servicesPerVisit: 'one' }), armoury);
  assert.equal(rewardNote('core', ids, { editorWhere: 'strategize', servicesPerVisit: 'all' }), strategize);
  assert.equal(rewardNote('core', ids, { editorWhere: 'noncombat', servicesPerVisit: 'all' }), armoury);
  assert.equal(rewardNote('core', ids, { editorWhere: 'strategize', servicesPerVisit: 'one' }), strategize);
});

test('a Core reward promises no editing when the deck editor is disabled', () => {
  const ids = ['core.strike', 'core.defend'];
  assert.equal(rewardNote('core', ids, { editorEnabled: false }), 'Choose 1. Add the card to your deck or keep it in your collection.');
  assert.equal(rewardNote('core', ids, { editorEnabled: true }), 'Choose 1. Add the card to your deck or edit your deck now; the rest stays in your collection.');
});

test('a Core reward promises no editing when the player turns Deck editing off', () => {
  const ids = ['core.strike', 'core.defend'];
  assert.equal(rewardNote('core', ids, { settings: { deckEditing: false } }), 'Choose 1. Add the card to your deck or keep it in your collection.');
  assert.equal(rewardNote('core', ids, { settings: { deckEditing: true } }), 'Choose 1. Add the card to your deck or edit your deck now; the rest stays in your collection.');
});
