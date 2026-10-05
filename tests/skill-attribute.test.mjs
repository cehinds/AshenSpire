// tests/skill-attribute.test.mjs — SPEC §13.4o: every `balance.skill.attributeEvery`
// (4) levels of a track with a linked attribute set queues a pick; the reward
// door offers it beside the level's draft, and taking it raises one linked
// attribute by 1, recorded so the load door's allocation check still balances.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { awardSkillXp, xpToNext, linkedAttributes } from '../src/model/skills.js';
import { applySkillAttribute } from '../src/model/levelup.js';
import { grantedAttributePoints } from '../src/model/attributes.js';
import { rewardPlan } from '../src/model/rewardplan.js';
import { mergeProgressionRewards, unclaimedProgressionRewards } from '../src/model/deferredProgression.js';

const registries = createRegistries(contentBundle);
const BLADE = 'item:blade';
const toLevel = (run, id, kind, level) => awardSkillXp(registries, run, id, Array.from({ length: level }, (_, l) => xpToNext(registries, kind, l)).reduce((a, b) => a + b, 0));

test('the linked sets are the owner\'s, and every 4th level queues one pick', () => {
  assert.deepEqual(linkedAttributes(registries, BLADE), ['strength', 'dexterity']);
  assert.deepEqual(linkedAttributes(registries, 'item:shield'), ['strength', 'dexterity', 'constitution', 'wisdom']);
  assert.deepEqual(linkedAttributes(registries, 'item:magic-focus'), ['dexterity', 'constitution', 'wisdom', 'intelligence']);
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  toLevel(run, BLADE, 'weapon', 8);
  assert.equal(run.skills[BLADE].pendingAttributePicks, 2, 'levels 4 and 8');
  toLevel(run, 'armour:heavy', 'armour', 8);
  assert.equal(run.skills['armour:heavy'].pendingAttributePicks, undefined, 'a track with no linked set queues none');
});

test('a pick raises a linked attribute, spends the queue, and the save still loads', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  toLevel(run, BLADE, 'weapon', 4);
  const before = { ...run.attributes };
  const maxHp = run.maxHp;
  assert.equal(applySkillAttribute(registries, run, BLADE, 'wisdom'), null, 'wisdom is not a Blade attribute');
  assert.equal(applySkillAttribute(registries, run, BLADE, 'strength'), before.strength + 1);
  assert.equal(run.skills[BLADE].pendingAttributePicks, 0);
  assert.equal(run.skillAttributePoints, 1);
  assert.equal(grantedAttributePoints(run), (run.levelPoints || 0) + 1);
  assert.equal(applySkillAttribute(registries, run, BLADE, 'strength'), null, 'an empty queue raises nothing');
  assert.ok(run.maxHp >= maxHp, 'the pools were re-derived');
  const back = deserializeRun(serializeRun(run));
  assert.equal(back.attributes.strength, before.strength + 1, 'the allocation check accepts the granted point');
  assert.deepEqual(validateRunShape(back).filter((p) => /skillAttribute|pendingAttribute/.test(p)), []);
});

test('picks are keyed choice rows that defer without multiplying', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  toLevel(run, BLADE, 'weapon', 4);
  const offer = { skillAttributes: [{ skillId: BLADE, level: 4, claimOrdinal: 0, attributeIds: ['strength', 'dexterity'] }] };
  const [row] = rewardPlan(offer).rows;
  assert.equal(row.key, `skillAttribute:${BLADE}:0`);
  assert.deepEqual(row.options, [{ kind: 'attribute', id: 'strength' }, { kind: 'attribute', id: 'dexterity' }]);
  const deferred = unclaimedProgressionRewards({ rewards: mergeProgressionRewards({}, offer, run), states: {} });
  assert.equal(mergeProgressionRewards(deferred, offer, run).skillAttributes.length, 1, 'the saved pick reserves the re-offer');
  run.pendingReward = { schemaVersion: 1, source: 'normal', after: 'map', rewards: offer, states: { [row.key]: 'taken' }, chosenDraftCardIds: { [row.key]: 'attribute:strength' } };
  assert.deepEqual(validateRunShape(run).filter((p) => /pendingReward/.test(p)), []);
  run.pendingReward.chosenDraftCardIds[row.key] = 'attribute:wisdom';
  assert.ok(validateRunShape(run).some((p) => /chosenDraftCardIds/.test(p)), 'a pick outside the offer is refused');
});

test('the reward door raises the chosen attribute', async () => {
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const { rewardDom } = await import('./helpers/reward-dom.mjs');
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    const run = createRunState({ seed: 3, classId: 'reaver', registries });
    toLevel(run, BLADE, 'weapon', 4);
    const dex = run.attributes.dexterity;
    mountRewards(app, { registries, run, onDone() {}, onPersist() {},
      saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
      rewards: { xpGains: { level: 0, tracks: {} }, skillAttributes: [{ skillId: BLADE, level: 4, claimOrdinal: 0, attributeIds: ['strength', 'dexterity'] }] } });
    app.querySelector('.reward-kind[data-kind="skillAttribute"]').click();
    const tile = [...app.querySelectorAll('.reward-row .reward-pick')].find((n) => n.dataset.pickId === 'attribute:dexterity');
    assert.ok(tile, 'the linked attribute is offered');
    tile.click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(run.attributes.dexterity, dex + 1);
    assert.equal(app.querySelector('.reward-kind[data-kind="skillAttribute"]').dataset.state, 'taken');
  } finally { Object.assign(globalThis, saved); }
});
