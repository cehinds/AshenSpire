// Review finding (MEDIUM): the Mail Counter gain bonus is on the face and the quote as well as in play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
const { catalog, authors } = compileGameProfiles();
const profile = resolveGameAuthor(authors.core, catalog);
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const baseRegistries = registries;
const wyrmBundle = { ...contentBundle, enemies: contentBundle.enemies.map(row => row.id === 'wyrmLord' ? { ...row, firstMove: 'tailSweep' } : row) };
const wyrmRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(wyrmBundle, profile)), profile);
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
function world(armor, enemyId = 'wanderingSoldier', registries = baseRegistries) {
  const run = createRunState({ registries, classId: 'reaver', seed: 31, profileMeta: META });
  if (armor) equipPiece(registries, run.loadout, 'armor', 0, armor, { has: () => true }, { inCombat: false, classId: run.class, attributes: run.attributes });
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: [enemyId] });
  dispatch(combat, { type: 'setReactions', enabled: false });
  Object.assign(combat.enemies[0], { hp: 900, maxHp: 900 });
  combat.player.stamina = combat.player.energy = 100;
  combat.piles.hand = [{ instanceId: 'gc', cardId: 'guardCounter' }];
  return combat;
}
for (const [armor, stacks] of [[null, 1], ['wyrmscaleMail', 2]]) test(`guardCounter ${armor ? 'with Mail' : 'bare'}: the quote, the face and live play all say ${stacks} Counter stack(s) granted`, () => {
  const combat = world(armor);
  const preview = previewCard(combat, 'gc');
  assert.equal(preview.counterStackGrant, stacks, 'the quote names the stack grant');
  const html = cardFaceLines(registries.cards.get('guardCounter'), preview, registries, null).map(row => row.html).join('');
  assert.match(html, new RegExp(`>${stacks}</span> Counter stack`));
  dispatch(combat, { type: 'playCard', cardInstanceId: 'gc' });
  assert.equal(combat.player.counterStacks || 0, stacks, 'live play grants the same');
});

// An upgraded Counter (the fx:counter step adds an authored gainCounterStacks) is quoted as every stack op live play runs, each with Mail's bonus.
test('core.counter upgraded with a +1 Counter step and Mail: the quote and the face say 5 and live play grants 5', () => {
  const combat = world('wyrmscaleMail');
  combat.piles.hand = [{ instanceId: 'gc', cardId: 'core.counter', upgraded: true, upgradeSteps: [{ k: 'authored' }, { k: 'fx', fx: 'counter', n: 1 }] }];
  const preview = previewCard(combat, 'gc');
    assert.equal(preview.counterStackGrant, 5, 'base 1 + 1 upgrade + 1 Mail, plus the step 1 + 1 Mail');
  const html = cardFaceLines(registries.cards.get('core.counter'), preview, registries, null).map(row => row.html).join('');
  assert.match(html, />5<\/span> Counter stacks/);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'gc' });
  assert.equal(combat.player.counterStacks || 0, 5, 'live play grants the same');
});

// Delta review: against a revealed attack the Counter does not cover, the stack total is still on the face (the authored row is hidden once the total shows).
test('core.counter upgraded with a +1 Counter step and Mail, vs an uncovered revealed attack: the face still says 5 Counter stacks, as live grants', () => {
  const combat = world('wyrmscaleMail', 'wyrmLord', wyrmRegistries); // its revealed tailSweep is an area attack the Counter does not cover
  combat.piles.hand = [{ instanceId: 'gc', cardId: 'core.counter', upgraded: true, upgradeSteps: [{ k: 'authored' }, { k: 'fx', fx: 'counter', n: 1 }] }];
  const preview = previewCard(combat, 'gc', combat.enemies[0].id);
  assert.equal(preview.counterReturn?.uncovered, true, 'the path under test: an uncovered revealed attack');
  const html = cardFaceLines(registries.cards.get('core.counter'), preview, registries, null).map(row => row.html).join('');
  assert.match(html, />5<\/span> Counter stacks/);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'gc' });
  assert.equal(combat.player.counterStacks || 0, 5);
});
