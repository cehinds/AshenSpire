import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { validateContent } from '../src/model/validate.js';
import { createRng } from '../src/engine/rng.js';
import { cardRewardRarityWeights, rollCardRewardIds, rollSkillDraftIds } from '../src/engine/encounters.js';
const r = createRegistries(contentBundle);
const legacy = { ...r, balance: { ...r.balance, rewards: { ...r.balance.rewards, rarityWeightsByClass: undefined } } };
const rarity = id => r.cards.get(id).rarity;
const casterLoadout = classId => {
  const run = createRunState({ registries: r, classId, seed: 5 });
  run.loadout.sets.rightHand[0] = classId === 'herald' ? 'boneSceptre' : 'starstoneStaff';
  run.loadout.sets.leftHand[0] = null;
  run.loadout.active.rightHand = 0;
  run.loadout.active.leftHand = 0;
  return run.loadout;
};

test('caster reward pools retain schools without adding caster schools to martial rewards', () => {
  const schools = new Set(r.nodes.filter(node => node.parentId === 'card').map(node => node.id));
  for (const classId of ['herald', 'starseer']) {
    for (const id of r.classes.get(classId).cardPool) {
      assert.ok(r.cards.get(id).tags.some(tag => schools.has(tag)), `${classId}/${id}: reward has a draft school`);
    }
  }
  for (const classId of ['reaver', 'rogue']) {
    assert.equal(r.balance.rewards.rarityWeightsByClass[classId], undefined);
    for (const id of r.classes.get(classId).cardPool) {
      assert.ok(!r.cards.get(id).tags.includes('starstone') && !r.cards.get(id).tags.includes('ritual'), `${classId}/${id}: no caster school leaked`);
    }
  }
});

test('authored caster odds reach each rarity at exact interval boundaries', () => {
  for (const classId of ['herald', 'starseer']) for (const [pool, values] of Object.entries({ normal: [35,50,15], elite: [25,50,25], boss: [20,45,35] })) {
    assert.deepEqual(Object.values(cardRewardRarityWeights(r, { classId, pool })), values);
    for (const [roll, expected] of [[0,'common'],[values[0]/100,'uncommon'],[(values[0]+values[1])/100,'rare']]) {
      const rng = { float: () => roll, pick: (_stream, items) => items[0] };
      assert.equal(rarity(rollCardRewardIds(r, rng, { classId, pool })[0]), expected);
    }
  }
});

test('class defaults, missing pools and Chaos retain their intended precedence', () => {
  for (const classId of ['reaver', 'rogue']) for (const pool of ['normal','elite','boss']) {
    assert.deepEqual(rollCardRewardIds(r, createRng(17), {classId,pool}), rollCardRewardIds(legacy, createRng(17), {classId,pool}));
  }
  for (const classId of ['herald','starseer']) {
    assert.deepEqual(cardRewardRarityWeights(r, {classId,pool:'unknown'}), r.balance.rewards.rarityWeightsByClass[classId].normal);
    const args = {classId,pool:'boss',flatRarity:true};
    assert.deepEqual(cardRewardRarityWeights(r,args), {common:1,uncommon:1,rare:1});
    assert.deepEqual(rollCardRewardIds(r,createRng(17),args), rollCardRewardIds(legacy,createRng(17),args));
    const draftArgs = {...args, loadout:casterLoadout(classId), skillId:'item:magic-focus', level:7};
    assert.deepEqual(rollSkillDraftIds(r,createRng(17),draftArgs), rollSkillDraftIds(legacy,createRng(17),draftArgs));
  }
});

test('caster skill gates remain closed until earned and normal unlocked offers favor higher rarity', () => {
  for (const classId of ['herald','starseer']) {
    const loadout = casterLoadout(classId);
    const counts = { common:0, uncommon:0, rare:0 };
    let middleUncommon = 0;
    const drafts = { common:0, uncommon:0, rare:0 };
    for (let seed=1; seed<=600; seed++) {
      const args = {classId,loadout,skillId:'item:magic-focus',pool:'normal'};
      const low = rollSkillDraftIds(r,createRng(seed),{...args,level:1});
      assert.ok(low.length && low.every(id=>rarity(id)==='common'));
      const middle = rollSkillDraftIds(r,createRng(seed),{...args,level:4});
      assert.ok(middle.length && middle.every(id=>rarity(id)!=='rare'));
      middleUncommon += middle.some(id=>rarity(id)==='uncommon') ? 1 : 0;
      counts[rarity(rollCardRewardIds(r,createRng(seed),args)[0])]++;
      drafts[rarity(rollSkillDraftIds(r,createRng(seed),{...args,level:7})[0])]++;
    }
    assert.ok(middleUncommon > 0, `${classId}: level four reaches uncommon cards`);
    assert.ok(drafts.rare > 0, `${classId}: level seven reaches rare cards`);
    assert.ok(counts.rare > 0, `${classId}: full reward pool retains rare reachability`);
    for (const tally of [counts,drafts]) {
      assert.ok(tally.uncommon+tally.rare > 300, `${classId}: a clear majority higher rarity: ${JSON.stringify(tally)}`);
      assert.ok(tally.common > 0 && tally.uncommon > 0);
    }
  }
});

test('class reward override validation rejects bad references, shapes and weights', () => {
  assert.ok(validateContent(contentBundle).ok);
  for (const override of [null, [], {missingClass:{}}, {herald:[]}, {herald:{shop:{common:1,uncommon:1,rare:1}}}, {herald:{normal:[]}}, {herald:{normal:{common:1,uncommon:1,rare:1,mythic:1}}}, {herald:{normal:{common:-1,uncommon:1,rare:1}}}, {herald:{normal:{common:Infinity,uncommon:1,rare:1}}}, {herald:{normal:{common:1,uncommon:1}}}, {herald:{normal:{common:0,uncommon:0,rare:0}}}]) {
    const result=validateContent({...contentBundle,balance:{...contentBundle.balance,rewards:{...contentBundle.balance.rewards,rarityWeightsByClass:override}}});
    assert.ok(!result.ok && JSON.stringify(result.errors).includes('rarityWeightsByClass'), JSON.stringify(override));
  }
});
