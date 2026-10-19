import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/reward-dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';

// Core deck edits happen at the Armoury; the other profiles still rest at Strategize.
function rewardNote(profileId, options) {
  const profile = resolveGameProfile(profileId);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const dom = rewardDom();
  const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    const run = { class: 'reaver', gameProfile: profile, cinders: 0, deck: [] };
    const offer = { id: `note-${profileId}`, options: options.map(id => ({ kind: 'combatCards', id })), taken: [], claimed: null, takeCount: 1 };
    mountGameProfileOffers(app, { registries, run, offer, title: 'Reward', onTake() {}, onContinue() {} });
    const text = app.querySelector('.reward-note').textContent;
    app.remove();
    return text;
  } finally {
    for (const [key, value] of Object.entries(before)) globalThis[key] = value;
  }
}

test('a Core reward names the Armoury for deck edits and Current keeps Strategize', () => {
  const core = rewardNote('core', ['core.strike', 'core.defend']);
  assert.equal(core, 'Choose 1. Cards join your collection; edit your deck at the Armoury.');
  assert.doesNotMatch(core, /Strategize/);
  const current = rewardNote('current', ['frostNova', 'scholarsInsight']);
  assert.equal(current, 'Choose 1. Cards join your collection; edit your deck at Strategize.');
});
