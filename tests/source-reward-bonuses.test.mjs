import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyContentBundle as contentBundle } from './helpers/legacy-progression-content.mjs';
import { SETTINGS_DEFAULTS } from '../src/content/settingsDefaults.js';
import { configuredContentBundle, presentationConfig } from '../src/model/advancedConfig.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { rollSourceRewardBonuses, appendSourceRewardBonuses, rollGuaranteedSkillDraftIds, runSourceRewardOffer } from '../src/engine/sourceRewardBonuses.js';
import { rollCombatCardOffer } from '../src/engine/encounters.js';
import { pendingRewardCheckpoint } from './helpers/pending-reward-checkpoint.mjs';
import { formationSpawn } from '../src/model/formationLayout.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { bankSkillXp, claimBankedSkillLevel, xpToNext, skillTracks } from '../src/model/skills.js';
import { rewardDom } from './helpers/reward-dom.mjs';

const registries = createRegistries(configuredContentBundle(contentBundle, SETTINGS_DEFAULTS.values));
const args = { classId: 'reaver', pool: 'normal' };
const withChances = changes => ({ ...registries, balance: { ...registries.balance, rewards: {
  ...registries.balance.rewards, sourceBonuses: { ...registries.balance.rewards.sourceBonuses, ...changes },
} } });

test('class levels claimed outside combat receive their bonus once; legacy levels are not granted retroactively', () => {
  const reg = withChances({ combatFeatChancePct: 0, classCardChancePct: 100 });
  const run = createRunState({ seed: 19, classId: 'reaver', registries: reg });
  bankSkillXp(reg, run, 'class:reaver', xpToNext(reg, 'class', 0));
  claimBankedSkillLevel(reg, run, 'class:reaver');
  const first = runSourceRewardOffer(reg, createRng(19), run, {}, { pool: 'normal' });
  assert.equal(first.levelChoices.length, 1);
  assert.equal(first.levelCards.length, 1);
  const restored = deserializeRun(serializeRun(run));
  const second = runSourceRewardOffer(reg, createRng(20), restored, {}, { pool: 'normal' });
  assert.equal(second.levelChoices.length, 0);
  assert.equal(second.levelCards.length, 0);
  delete restored.classRewardLevels;
  assert.equal(runSourceRewardOffer(reg, createRng(20), restored, {}, { pool: 'normal' }).levelChoices.length, 0);
});

test('every non-class skill has a guaranteed card offer, including armour and unequipped weapon tracks', () => {
  for (const cls of registries.classes.all()) {
    const run = createRunState({ seed: 6, classId: cls.id, registries });
    for (const track of skillTracks(registries)) {
      const rng = createRng(6);
      const ids = rollGuaranteedSkillDraftIds(registries, rng, { classId: cls.id, loadout: run.loadout, skillId: track.id, level: 1 });
      if (track.kind === 'class') assert.deepEqual(ids, []);
      else {
        assert.ok(ids.length, `${cls.id} / ${track.id}`);
        assert.ok(ids.every(id => registries.cards.get(id).rarity === 'common'), 'level-one rarity gate remains');
        assert.equal(rng.getCounters().rewardRolls, 0, 'guaranteed skill rewards never roll a chance');
      }
    }
  }
});

test('promoted defaults produce opposite bottom spawns and 10% combat cards in every pool', () => {
  const presentation = presentationConfig(SETTINGS_DEFAULTS.values);
  assert.equal(formationSpawn(presentation, 'player'), 'B1');
  assert.equal(formationSpawn(presentation, 'enemy'), 'B4');
  for (const pool of ['normal', 'elite', 'boss']) {
    const rng = createRng(32);
    const chances = [];
    rng.chance = (stream, pct) => { chances.push([stream, pct]); return true; };
    assert.ok(rollCombatCardOffer(registries, rng, { ...args, pool }).cardIds.length > 0);
    assert.deepEqual(chances, [['rewardRolls', 10]]);
  }
});

test('combat feat and class technique use independent 5% and 25% rolls; every class level grants a feat', () => {
  const rng = createRng(123);
  const chances = [];
  rng.chance = (stream, pct) => { chances.push([stream, pct]); return false; };
  const miss = rollSourceRewardBonuses(registries, rng, { ...args, classLevels: 2 });
  assert.deepEqual(chances, [['rewardRolls', 5], ['rewardRolls', 25], ['rewardRolls', 25]]);
  assert.equal(miss.levelChoices.length, 2);
  assert.ok(miss.levelChoices.every(row => row.source === 'class' && row.options.length === 3));
  assert.deepEqual(miss.levelCards, []);
  rng.chance = () => true;
  const hit = rollSourceRewardBonuses(registries, rng, { ...args, classLevels: 2, bankedLevels: 2 });
  assert.equal(hit.levelChoices.length, 5);
  assert.equal(hit.levelCards.length, 4);
  assert.deepEqual(hit.levelCards.map(row => row.claimOrdinal), [0, 0, 1, 2]);
  assert.ok(hit.levelCards.every(row => row.cardIds.every(id => registries.classes.get('reaver').cardPool.includes(id))));
});

test('bonus offers retain distinct keys and survive saving alongside character rewards and class-tree drafts', () => {
  const reg = withChances({ combatFeatChancePct: 100, classCardChancePct: 100 });
  const bonuses = rollSourceRewardBonuses(reg, createRng(23), { ...args, bankedLevels: 2 });
  const run = createRunState({ seed: 23, classId: 'reaver', registries: reg });
  const offer = appendSourceRewardBonuses({
    levelChoices: [{ ordinal: 0, options: [{ kind: 'feat', id: 'fieldStudy' }] }],
    levelCards: [{ ordinal: 0, cardIds: ['rend'] }],
    classDrafts: [{ classId: 'reaver', level: 1, nodeIds: ['ironFooting'], claimOrdinal: 1 }],
  }, bonuses);
  run.pendingReward = pendingRewardCheckpoint(offer, { source: 'normal', after: 'map' });
  assert.deepEqual(validateRunShape(run), []);
  assert.deepEqual(deserializeRun(serializeRun(run)).pendingReward, run.pendingReward);
  assert.deepEqual(offer.levelChoices.map(row => row.ordinal), [0, 1, 2, 3]);
});

