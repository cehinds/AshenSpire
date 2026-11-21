// Dexterity status adds Block (owner, 2026-11-20; SPEC status table "Dexterity"). Each stack adds +1 Block to every Block card played after it;
// Block already held does not change. Example from the owner: hold 5 Block, gain 1 Dexterity (still 5), play the 5-Block card again: +6, total 11.
// Profiles are pinned: the dev profile saved before this change (71c50c95) has no `statusBlockWeight`, so its Dexterity status still adds nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, validateGameProfileSnapshot } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { computeBlockGain, gainBlock } from '../src/engine/actions.js';

const registriesFor = profile => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const current = resolveGameProfile('default');
const saved = validateGameProfileSnapshot(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-71c50c95.json.gz', import.meta.url)))));

function fight(profile) {
  const reg = registriesFor(profile);
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 433, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(433), enemyIds: ['wanderingSoldier'] });
  delete combat.reactionRules.contactPolicy;
  Object.assign(combat.player, { hp: 999, maxHp: 999, stamina: 99, maxStamina: 99, mana: 99, maxMana: 99, block: 0, statuses: {} });
  dispatch(combat, { type: 'setReactions', enabled: false });
  play(combat, 'core.defend'); // the first Defend enters Defend stance; later ones take the held-stance bonus, so measure from the second
  return combat;
}
let n = 0;
function play(combat, cardId) {
  const card = { instanceId: `probe-${n++}`, cardId };
  combat.piles.hand.push(card);
  const before = combat.player.block || 0;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
  return (combat.player.block || 0) - before;
}
const giveDexterity = (combat, stacks) => { combat.player.statuses.dexterity = { id: 'dexterity', stacks }; };

test('the Core profile turns the Dexterity status on; the saved profile does not carry it', () => {
  assert.equal(current.modules.effects.statusBlockWeight, 1);
  assert.equal(saved.hash, 'sha256:71c50c95263d9fc671863a691fb6ffb7e4f621531e73eb4d98b0c1866a426bdf');
  assert.equal(saved.modules.effects.statusBlockWeight, undefined);
});

test('each Dexterity stack adds 1 Block to every later Block card and leaves Block already held alone', () => {
  const combat = fight(current);
  const plain = play(combat, 'core.defend');
  assert.ok(plain > 0);
  const held = combat.player.block;
  giveDexterity(combat, 1);
  assert.equal(combat.player.block, held, 'gaining Dexterity does not change Block already held');
  assert.equal(play(combat, 'core.defend'), plain + 1, 'the next Defend gives one more');
  assert.equal(combat.player.block, held + plain + 1);
  giveDexterity(combat, 3);
  assert.equal(play(combat, 'core.defend'), plain + 3, 'three stacks, three more');
  play(combat, 'core.counter'); // enter Counter stance first, as above
  const counter = play(combat, 'core.counter');
  delete combat.player.statuses.dexterity;
  assert.equal(counter - play(combat, 'core.counter'), 3, 'every Block card, not only Defend');
});

test('protection that is not a played card gets no Dexterity Block (Defend stance, the Dodge Roll guard, a power or status block)', () => {
  const combat = fight(current);
  const p = combat.player;
  const sources = {
    'Defend-stance turn protection': { skipRatingBonus: true, logSource: 'defendStance' },
    'the Dodge Roll guard or a power/status block (no card)': null,
    'a synthetic stance-entry guard': { cardId: null, syntheticDefense: true },
  };
  const plain = Object.fromEntries(Object.entries(sources).map(([name, card]) => [name, computeBlockGain(combat, p, 8, card)]));
  giveDexterity(combat, 3);
  for (const [name, card] of Object.entries(sources)) assert.equal(computeBlockGain(combat, p, 8, card), plain[name], name);
  const held = p.block;
  assert.equal(gainBlock(combat, p, 8, { skipRatingBonus: true, logSource: 'defendStance' }), plain['Defend-stance turn protection'], 'the stance grant itself');
  assert.equal(p.block, held + plain['Defend-stance turn protection']);
  assert.equal(computeBlockGain(combat, p, 8, { cardId: 'core.defend' }) - computeBlockGain(combat, p, 8, { cardId: 'core.defend', syntheticDefense: true }), 3, 'a played card still gets it');
});

test('a run on the saved profile keeps the old rule: the Dexterity status adds no Block', () => {
  const combat = fight(saved);
  const plain = play(combat, 'core.defend');
  giveDexterity(combat, 3);
  assert.equal(play(combat, 'core.defend'), plain);
});
