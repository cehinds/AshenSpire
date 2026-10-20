import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent } from '../src/model/gameProfile.js';
import { unlimitedCardIds, addBasicCard, moveToSideboard, moveFromSideboard, deckCopyLimit } from '../src/model/deckRules.js';
const profile = resolveGameAuthor(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))), loadGameProfileCatalog());
const reg = createRegistries(applyGameProfileToContent(contentBundle, profile));
for (const classId of ['reaver','rogue','starseer','herald']) test(`${classId} editor offers no unowned basics and keeps owned cards`, () => {
  const run = { gameProfile: profile, class: classId, deck: [], sideboard: [] };
  // Owner ruling 2026-10-19 (SPEC §14.1): Core's collection is only what the run owns.
  assert.deepEqual(unlimitedCardIds(run), []);
  assert.throws(() => addBasicCard(reg, run, 'core.strike', { plain: true }), /not an unlimited card id/);
  assert.equal(run.deck.length, 0);
  if (!['starseer','herald'].includes(classId)) assert.equal(deckCopyLimit(reg, 'core.strike', {}, run), Infinity);
  const special = profile.content.classes.find(c=>c.id===classId).specialCardId;
  run.sideboard.push({instanceId:'owned',cardId:special,rank:2});
  assert.equal(moveFromSideboard(reg,run,'owned'),true);
  assert.equal(deckCopyLimit(reg,special,{},run),1);
  assert.equal(moveToSideboard(reg,run,'owned'),true);
  assert.equal(run.sideboard[0].rank,2);
});

test('creation groups equivalent cards and preserves rank/enhancement identity', async () => {
  const { groupCardVariants } = await import('../src/model/cardGroups.js');
  const refs = [
    {instanceId:'1',cardId:'strike'}, {instanceId:'2',cardId:'strike'},
    {instanceId:'3',cardId:'strike',rank:2}, {instanceId:'4',cardId:'strike',upgraded:true},
    {instanceId:'5',cardId:'strike',mods:['strike.damage=+1']},
  ];
  assert.deepEqual(groupCardVariants(refs).map(group=>group.count),[2,1,1,1]);
});

test('draft commits preserve owned enhancements and reject forged carrier fields', async () => {
  const {commitDeckEditDraft}=await import('../src/model/deckRules.js');
  const run={gameProfile:profile,class:'reaver',deck:[{instanceId:'old',cardId:'core.strike',upgraded:true}],sideboard:[]};
  const edited=structuredClone(run);edited.deck=[];
  assert.throws(()=>commitDeckEditDraft(reg,run,edited,{deckMinUnlimited:true}),/delete an owned/);
  edited.deck=[...run.deck,{instanceId:'forged',cardId:'core.strike',magicShare:1}];
  assert.throws(()=>commitDeckEditDraft(reg,run,edited,{deckMinUnlimited:true}),/invent/);
});
