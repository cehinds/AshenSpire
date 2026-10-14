// One tap used to ask the engine for 27 to 30 card previews of one unchanged
// fight (each a whole-fight clone), enough to stall a phone. The screen now
// keeps each preview until the fight next changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createPreviewMemo } from '../src/ui/models/PreviewMemoModel.js';

const registries = createRegistries(contentBundle);
function fight() {
  const deck = Array.from({ length: 10 }, (_, i) => ({ instanceId: `c${i}`, cardId: i % 2 ? 'strike' : 'defend', upcastTier: 0, upgraded: false }));
  return createCombat({ registries, rng: createRng(7), enemyIds: ['wanderingSoldier'],
    player: { id: 'p', classId: 'reaver', hp: 400, maxHp: 400, energyMax: 20, maxStamina: 20, stamina: 20, drawPerTurn: 5, relicIds: [], deck } });
}
function counted(combat) {
  const calls = { preview: 0, dispatch: 0 };
  const memo = createPreviewMemo({ combat,
    preview: (...args) => { calls.preview += 1; return previewCard(...args); },
    dispatch: (...args) => { calls.dispatch += 1; return dispatch(...args); } });
  return { memo, calls };
}

test('thirty asks for one card on an unchanged fight cost one engine preview', () => {
  const combat = fight();
  const { memo, calls } = counted(combat);
  const id = combat.piles.hand[0].instanceId;
  const first = memo.previewCard(combat, id, undefined, undefined);
  for (let i = 0; i < 29; i += 1) assert.equal(memo.previewCard(combat, id, undefined, undefined), first);
  assert.equal(calls.preview, 1);
  assert.deepEqual(first, previewCard(combat, id), 'the numbers are the engine\'s own');
});

test('a different card, target or upcast rank is a different preview', () => {
  const combat = fight();
  const calls = { preview: 0 };
  const memo = createPreviewMemo({ combat, preview: () => { calls.preview += 1; return {}; }, dispatch });
  const [a, b] = combat.piles.hand;
  memo.previewCard(combat, a.instanceId);
  memo.previewCard(combat, b.instanceId);
  memo.previewCard(combat, a.instanceId, combat.enemies[0].id);
  memo.previewCard(combat, a.instanceId, undefined, { x: 1 });
  memo.previewCard(combat, a.instanceId, undefined, { x: 2 });
  assert.equal(calls.preview, 5);
});

test('a dispatch drops every kept preview, and the next ask shows the changed fight', () => {
  const combat = fight();
  const { memo, calls } = counted(combat);
  const id = combat.piles.hand[0].instanceId;
  const before = memo.previewCard(combat, id);
  const energyBefore = combat.player.energy;
  const play = combat.piles.hand.find(card => card.instanceId !== id);
  memo.dispatch(combat, { type: 'playCard', cardInstanceId: play.instanceId, targetId: combat.enemies[0].id });
  assert.equal(memo.size, 0);
  assert.ok(combat.player.energy < energyBefore, 'the play spent energy');
  const after = memo.previewCard(combat, id);
  assert.equal(calls.preview, 2);
  assert.deepEqual(after, previewCard(combat, id));
  assert.notEqual(after, before);
});

test('a refused dispatch also drops the kept previews, and a throwing preview is not kept', () => {
  const combat = fight();
  const { memo } = counted(combat);
  const id = combat.piles.hand[0].instanceId;
  memo.previewCard(combat, id);
  assert.equal(memo.size, 1);
  assert.throws(() => memo.dispatch(combat, { type: 'playCard', cardInstanceId: 'no-such-card' }));
  assert.equal(memo.size, 0);
  assert.throws(() => memo.previewCard(combat, 'no-such-card'));
  assert.equal(memo.size, 0);
});

test('the combat screen reads previews and dispatches through the memo', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(source, /createPreviewMemo\(\{ combat, preview: enginePreviewCard, dispatch: engineDispatch \}\)/);
  assert.doesNotMatch(source, /import \{[^}]*(?:^|[{,]\s*)(?:previewCard|dispatch)\s*[,}][^}]*\} from '\.\.\/\.\.\/engine\/combat\.js'/, 'the engine functions are imported only under their own names');
  assert.doesNotMatch(source, /[^.\w]engineDispatch\(/, 'every dispatch goes through the memo');
});
