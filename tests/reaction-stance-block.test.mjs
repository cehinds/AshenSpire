// Owner, 2026-11-14 (batch 2): the defensive-reaction prompt shows the Block a card will gain with the stance's own bonus (Counter +25%, Defend +50%),
// and the HP the player then loses, so shown = gained = what the fight takes.
//   node --test tests/reaction-stance-block.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { withoutWeaknesses } from './withoutWeaknesses.mjs';
import { summarizeCardOption } from '../src/ui/models/CardOptionSummaryModel.js';
import { withoutStanceBenefits } from './legacyStanceRules.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

/** The first reaction prompt of a fight where the hand's first card is `cardId`; seeds are searched because the fight is deterministic. */
function prompt(cardId, { benefits = true } = {}) {
  for (let seed = 1; seed < 120; seed++) {
    const run = createRunState({ registries: reg, classId: 'rogue', seed, profileMeta: META });
    let combat = withoutWeaknesses(createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] }));
    if (!benefits) combat = withoutStanceBenefits(combat);
    for (let turn = 0; turn < 3 && !combat.pendingReaction && !combat.result; turn++) {
      const card = combat.piles.hand[0]; card.cardId = cardId; card.upgraded = false;
      dispatch(combat, { type: 'endTurn' });
    }
    if (combat.pendingReaction?.options?.some(option => option.cardId === cardId)) return combat;
  }
  assert.fail(`no prompt offered ${cardId}`);
}
const defOf = (combat, option) => summarizeCardOption(reg, combat, option, {
  defOf: o => combat.piles.hand.find(card => card.instanceId === o.play.cardInstanceId) && reg.cards.get(o.cardId),
  previewOf: o => previewCard(combat, o.play.cardInstanceId, o.play.targetId ?? o.sourceId ?? combat.pendingReaction.sourceId, o.play.upcastTier, { rangeRoute: o.play.rangeRoute ?? 'advance' }),
}).line?.find(part => /def/i.test(part.label || ''))?.value;

test('the reaction prompt shows the Block the card gains with its stance bonus, and that is the Block it gains', () => {
  const live = prompt('core.counter'), old = prompt('core.counter', { benefits: false });
  for (const combat of [live, old]) {
    const offer = combat.pendingReaction;
    const option = offer.options.find(row => row.cardId === 'core.counter');
    const shown = defOf(combat, option);
    const blockBefore = combat.player.block;
    const start = combat.eventLog.length, hp = combat.player.hp;
    dispatch(combat, { type: 'chooseReaction', offerId: offer.id, optionId: option.id });
    // The Counter's own bonus Block arrives as a separate grant (no card id); the card's Block is the figure its row shows.
    const gained = combat.eventLog.slice(start).filter(event => event.type === 'blockGained' && event.targetId === 'player' && event.cardId === 'core.counter').reduce((sum, event) => sum + event.amount, 0);
    if (Number.isFinite(shown)) assert.equal(shown, gained, `the prompt's Block (${shown}) is the Block gained (${gained})`);
    while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    assert.equal(hp - combat.player.hp, option.incomingHp, 'and the HP lost is what the prompt said');
    combat.__gained = gained; combat.__blockBefore = blockBefore;
  }
  assert.ok(live.__gained > old.__gained, `the Counter stance's +25% is in the Block (${live.__gained} against ${old.__gained})`);
});
