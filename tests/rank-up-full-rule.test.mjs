// Owner 2026-11-23: "Rank-up needs a fully upgraded card" (on by default) reaches every rank-up door. A card short of its
// upgrades is shown but disabled with a short reason; an event that ranks a random card needs a ready one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { RankUpCandidates } from '../src/model/rankUpService.js';
import { ChoiceUnmetRequirement } from '../src/engine/quests.js';
import { RankUpUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { resolveCard } from '../src/model/registries.js';
import { FillUpgradeSlots } from './helpers/rank-up-ready.mjs';

const REASON = 'Upgrade this card to its limit first.';
const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const smithChoice = () => registries.events.get('sleepingSmith').choices.find((row) => row.effects.some((e) => e.op === 'rankUpCard'));

test('the rank-up pick shows a card short of its upgrades, disabled, with the reason', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  await withKitDom(async () => {
    const { RankUpCardRows } = await import('../src/ui/components/rankUpCardModal.js');
    const run = newRun();
    const [ready, short] = RankUpCandidates(registries, run);
    FillUpgradeSlots(run, [ready]);
    const rows = RankUpCardRows(registries, run);
    const row = (card) => rows.find((r) => r.id === card.instanceId);
    assert.equal(row(short).disabled, true);
    assert.equal(row(short).text, REASON);
    assert.equal(row(ready).disabled, false);
  });
});

test('a skill rank-up row is disabled with the reason until the card is full', () => {
  const run = newRun();
  run.skills['item:blade'] = { ...(run.skills['item:blade'] || {}), xp: 0, level: 3, pendingDrafts: 0, pendingRankUps: 1 };
  const faceOf = (instance) => resolveCard(registries, instance);
  const strike = run.deck.find((card) => card.cardId === 'core.strike');
  const model = RankUpUpgradeModel(registries, run, 'item:blade', strike.instanceId, { faceOf });
  const row = model.rows.find((r) => r.instanceId === strike.instanceId);
  if (!row) return assert.fail('the Strike is a blade candidate');
  assert.deepEqual([row.disabled, row.blockedReason, model.canConfirm], [true, REASON, false]);
  FillUpgradeSlots(run, [strike]);
  const full = RankUpUpgradeModel(registries, run, 'item:blade', strike.instanceId, { faceOf });
  assert.equal(full.rows.find((r) => r.instanceId === strike.instanceId).disabled, false);
});

test('an event that ranks up a random card needs a ready card', () => {
  const run = newRun(); run.cinders = 500;
  assert.equal(ChoiceUnmetRequirement(smithChoice(), run, registries), 'rankableCard');
  FillUpgradeSlots(run, [run.deck[0]]);
  assert.equal(ChoiceUnmetRequirement(smithChoice(), run, registries), null);
});
