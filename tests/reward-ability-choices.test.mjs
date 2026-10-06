import test from 'node:test';
import assert from 'node:assert/strict';
import { mountRewards } from '../src/ui/screens/reward.js';
import { renderCard } from '../src/ui/components/card.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { rewardDom } from './helpers/reward-dom.mjs';

const registries = createRegistries(contentBundle);
const cardId = 'progression-ember-hew';
const identities = [`${cardId}@0`, `${cardId}@5`];
const runState = () => ({ class: 'reaver', attributes: {}, cinders: 0, deck: [], flasks: [], relics: [], coreTags: [], loadout: { storage: [] },
  skills: { 'class:reaver': { level: 1, xp: 0 }, 'item:blade': { level: 1, xp: 0, pendingDrafts: 1 } } });

for (const kind of ['skillDraft', 'classMilestone']) test(`${kind} keeps two grades of the same family distinct through preview, Back, save retry and reload`, () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    document.body.classList.add('reduced-motion');
    const app = document.createElement('main'); document.body.append(app);
    const run = runState(), checkpoint = { states: {} };
    const rewards = kind === 'skillDraft'
      ? { skillDrafts: [{ skillId: 'item:blade', offerId: 'ability:item:blade:1', level: 1, requiredLevel: 1,
        cardIds: [cardId, cardId], abilityRanks: [0, 5], choiceIds: identities }] }
      : { classMilestoneRewards: [{ receiptId: 'class:reaver:1:cards', classId: 'reaver', skillId: 'class:reaver', level: 1,
        requiredLevel: 1, rewardKind: 'cards', options: [cardId, cardId], abilityRanks: [0, 5], choiceIds: identities }] };
    const key = kind === 'skillDraft' ? 'skillDraft:ability:item:blade:1' : 'classMilestone:class:reaver:1:cards';
    let refuse = true, persisted = 0, called = [];
    const args = { registries, run, checkpoint, rewards, onDone() {},
      onPersist() { if (refuse) return false; persisted++; },
      onClaimClassReward(receiptId, selected) {
        called.push([receiptId, selected]);
        run.deck.push({ instanceId: 'milestone-card', cardId, abilityRank: selected === identities[1] ? 5 : 0 });
        return true;
      } };
    const open = () => app.querySelector(`[data-kind="${kind}"]`).click();
    mountRewards(app, args); open();
    let faces = app.querySelectorAll('.reward-row .reward-pick');
    assert.deepEqual(faces.map(face => face.dataset.pickId), identities);
    assert.deepEqual(faces.map(face => face.dataset.cardId), [cardId, cardId]);
    for (const [index, rank] of [0, 5].entries()) {
      const expected = renderCard(registries, { cardId, abilityRank: rank }, { surface: 'reward', owned: 0 });
      assert.equal(faces[index].innerHTML, expected.innerHTML, `preview uses grade ${rank}`);
    }
    faces[1].click();
    assert.equal(app.querySelectorAll('.reward-selected').length, 1);
    assert.equal(run.deck.length, 0);
    app.querySelector('#reward-back').click(); open();
    assert.equal(app.querySelector('.reward-selected').dataset.pickId, identities[1]);
    const confirm = app.querySelector('#reward-card-confirm'); confirm.click();
    assert.equal(run.deck.length, 0, 'failed persistence rolls the selected grant back');
    assert.equal(run.skills['item:blade'].pendingDrafts, 1);
    assert.equal(confirm.disabled, false);
    refuse = false; confirm.click(); confirm.click();
    assert.equal(run.deck.length, 1);
    assert.equal(run.deck[0].cardId, cardId);
    assert.equal(run.deck[0].abilityRank, 5);
    assert.equal(checkpoint.chosenDraftCardIds[key], identities[1]);
    assert.equal(checkpoint.states[key], 'taken');
    assert.equal(persisted, 1);
    if (kind === 'classMilestone') assert.equal(called.at(-1)[1], identities[1]);
    else assert.equal(run.skills['item:blade'].pendingDrafts, 0);
    mountRewards(app, args);
    assert.equal(run.deck.length, 1, 'reload does not grant the offer twice');
    assert.equal(app.querySelector('[data-state="taken"]').dataset.kind, kind);
    app.remove();
  } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});

test('legacy skill drafts keep their raw card identity and rank overlay', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]])); Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    const run = runState(), checkpoint = { states: {} };
    mountRewards(app, { registries, run, checkpoint, rewards: { skillDrafts: [{ skillId: 'item:blade', level: 1, cardIds: ['strike'], ranks: [2] }] }, onDone() {} });
    app.querySelector('[data-kind="skillDraft"]').click();
    app.querySelector('.reward-pick').click(); app.querySelector('#reward-card-confirm').click();
    assert.equal(run.deck[0].cardId, 'strike'); assert.equal(run.deck[0].rank, 2);
    assert.equal(run.deck[0].abilityRank, undefined);
    assert.equal(checkpoint.chosenDraftCardIds['skillDraft:item:blade:0'], 'strike');
    app.remove();
  } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});

test('expanded ability receipt rolls back with a refused save and retries the exact grade once', () => {
  const dom = rewardDom(), saved = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]])); Object.assign(globalThis, dom);
  try {
    document.body.classList.add('reduced-motion');
    const app = document.createElement('main'); document.body.append(app);
    const skillId = 'combatManeuvers', offerId = `ability:${skillId}:1`, key = `skillDraft:${offerId}`;
    const ids = registries.cards.all().filter(card => card.gradeProfiles && card.abilityKind === 'maneuver').slice(0, 3).map(card => card.id);
    const offer = { skillId, offerId, level: 1, requiredLevel: 1, cardIds: [...ids, ids[0]], abilityRanks: [0, 0, 0, 5], choiceIds: [...ids.map(id => `${id}@0`), `${ids[0]}@5`], intelligenceSnapshot: 20 };
    const checkpoint = { states: {}, rewards: { skillDrafts: [offer] } };
    const run = { ...runState(), progressionRulesVersion: 1, abilityOffers: { [offerId]: offer }, skills: { [skillId]: { level: 1, xp: 0, pendingDrafts: 1 } }, pendingReward: checkpoint };
    let refuse = true, saves = 0;
    const args = { registries, run, checkpoint, rewards: checkpoint.rewards, onDone() {}, onPersist() { if (refuse) return false; saves++; } };
    mountRewards(app, args); app.querySelector('[data-kind="skillDraft"]').click(); app.querySelectorAll('.reward-row .reward-pick')[3].click();
    const confirm = app.querySelector('#reward-card-confirm'); confirm.click();
    assert.equal(run.abilityDraftClaims, undefined, 'refused save restores an absent receipt ledger');
    assert.equal(run.skills[skillId].pendingDrafts, 1); assert.equal(run.deck.length, 0); assert.equal(checkpoint.states[key], undefined);
    assert.equal(run.pendingReward, checkpoint, 'rollback preserves the live persistence checkpoint');
    refuse = false; confirm.click(); confirm.click();
    assert.equal(saves, 1); assert.equal(run.skills[skillId].pendingDrafts, 0);
    assert.equal(run.abilityDraftClaims[skillId][offerId].choiceId, offer.choiceIds[3]);
    assert.equal(run.deck.length, 1); assert.equal(run.deck[0].abilityRank, 5); assert.equal(run.deck[0].abilityOfferId, offerId);
    mountRewards(app, args); assert.equal(run.deck.length, 1); assert.equal(app.querySelector('[data-state="taken"]').dataset.kind, 'skillDraft');
    app.remove();
  } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
