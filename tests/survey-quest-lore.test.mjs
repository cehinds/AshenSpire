import test from 'node:test';
import assert from 'node:assert/strict';
import { surveyQuestPresentation } from '../src/ui/models/SurveyQuestModel.js';
import { surveyQuestLore } from '../src/content/surveyQuestLore.js';
import { ATLAS, generateJourney, questAction, completeJourneyNode } from '../src/model/worldAtlas.js';

test('survey reports appear only after claiming and cannot change a saved journey or reward', () => {
  const revision = ATLAS.revision;
  for (const id of Object.keys(surveyQuestLore)) {
    const q = ATLAS.quests[id];
    assert.ok(q, `writing resolves a real quest: ${id}`);
    let j;
    for (let seed = 0; seed < 100; seed++) {
      const candidate = generateJourney('LORE-' + seed);
      if (candidate.activeNodeIds.includes(q.objectiveNodeId)) { j = candidate; break; }
    }
    assert.ok(j, `objective reachable: ${id}`);
    const prior = JSON.stringify(j);
    const offered = surveyQuestPresentation(q, j);
    assert.equal(JSON.stringify(j), prior);
    assert.equal(questAction(j, id).next, 'accepted');
    j.questStates[id] = 'accepted';
    completeJourneyNode(j, q.objectiveNodeId);
    assert.deepEqual(surveyQuestPresentation(q, j), offered, 'a visit is not a report yet');
    const reward = questAction(j, id);
    assert.equal(reward.next, 'claimed');
    assert.equal(reward.reward, 25);
    j.questStates[id] = 'claimed';
    const saved = JSON.stringify(j);
    const reported = surveyQuestPresentation(q, JSON.parse(saved));
    assert.equal(reported.title, offered.title);
    assert.notEqual(reported.text, offered.text);
    assert.equal(JSON.stringify(j), saved);
    assert.equal(questAction(j, id).allowed, false, 'report cannot enable a second reward');
  }
  assert.equal(ATLAS.revision, revision);
});

test('rewriting presentation leaves route generation and authored atlas rows untouched', () => {
  const before = JSON.stringify(ATLAS.data);
  const journey = generateJourney('LORE-COMPATIBILITY');
  const oldRevision = ATLAS.revision;
  for (const q of Object.values(ATLAS.quests)) {
    surveyQuestPresentation(q, journey, { [q.questId]: { title: 'Revised title', description: 'Revised offer', report: 'Revised report' } });
  }
  assert.equal(JSON.stringify(ATLAS.data), before);
  assert.equal(ATLAS.revision, oldRevision);
  assert.deepEqual(generateJourney('LORE-COMPATIBILITY'), journey);
  const custom = { questId: 'custom', displayName: 'A custom quest', description: 'Its own words.' };
  assert.deepEqual(surveyQuestPresentation(custom, { questStates: { custom: 'claimed' } }), { title: custom.displayName, text: custom.description });
});
