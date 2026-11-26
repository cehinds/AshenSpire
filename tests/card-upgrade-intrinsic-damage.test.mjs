import test from 'node:test';
import assert from 'node:assert/strict';
import { registries as customRegistries, play, outcome } from './helpers/upgrade-probe.mjs';
import { createRunState } from '../src/model/state.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { rankedEffectsCapped } from '../src/model/cardRank.js';
import { CardScoreReferenceContext } from '../src/model/cardMechanicalProjection.js';
import { gameProfileRatingReceipt, gameProfileEffectiveAttributes } from '../src/model/gameProfileRun.js';
import { GearSummary, GearItemProps, GearAlwaysOn, ApplyGearCardRules } from '../src/model/gearEffects.js';
import { ItemPropertySummary } from '../src/model/itemProperties.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { ResolveCarrierDamageType } from '../src/model/carrierDamageType.js';
import { stanceOf } from '../src/model/stanceRules.js';
import { fixCoreRules } from '../src/model/fixCoreRulesCache.js';
import { ProfileDamageOffense } from '../src/model/profileDamageOffense.js';
import * as StanceRead from '../src/model/stanceBenefitsRead.js';
import * as ElementRead from '../src/model/elementReceiptStages.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';

const neutralReaders = {
  getAdd: () => 0, FluxMultiplier: () => 1, defensiveCombatStance: () => undefined,
        hitWeaknessTriggers: () => [], matchingHitWeaknesses: () => [], weaknessLabel: () => '',
  AttackDamageMultiplier: StanceRead.AttackDamageMultiplier,
  StanceWeaknessMultiplier: StanceRead.StanceWeaknessMultiplier,
  ElementReceiptStages: (...args) => ElementRead.ElementReceiptStages(...args,
    { stacksOf: () => 0, hasTag: () => false, opponents: () => [], bandsActive: () => false }),
};

function fixture(registries, classId) {
  const run = createRunState({ registries, classId, seed: 511,
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const ratings = gameProfileRatingReceipt(registries, run), attributes = gameProfileEffectiveAttributes(registries, run);
  const source = { id: 'player', kind: 'player', classId, attributes, statuses: {}, alive: true,
    ratings: ratings.totals, ratingSources: ratings.sources,
    itemProps: { ...ItemPropertySummary(run), ...GearItemProps(GearSummary(registries, run.loadout, classId, run)) } };
  return { run, source, gear: GearAlwaysOn(registries, run),
    ctx: { ...run, registries, fixCoreRules: fixCoreRules(run), attributes, enemies: [], phase: 'player', elementFlux: null } };
}

test('first-play offense equals the canonical whole incoming receipt for default/custom profiles and packet channels', () => {
  const canonical = CardScoreReferenceContext({ class: 'reaver' }).registries;
  let packets = 0;
  for (const registries of [canonical, customRegistries]) for (const classId of ['reaver', 'rogue', 'starseer', 'herald']) {
    const { run, source, gear, ctx } = fixture(registries, classId), snapshot = structuredClone(run);
    const strike = registries.cards.get('core.strike');
    const packet = { ...strike, magicShare: .5, tags: [...strike.tags, 'school:fire'],
      effects: [{ op: 'damage', target: 'enemy', amount: 16 }] };
    for (const base of [strike, registries.cards.get('core.venomSpray'), packet]) for (const amount of [7, 9, 11]) {
      const def = ApplyGearCardRules(gear.rules, { ...base, effects: [{ op: 'damage', target: 'enemy', amount }] }, gear.state);
      const carrier = ResolveCarrierDamageType({ ...def, cardId: def.id, combatProfile: { ...combatProfileFor(def) }, fixCoreSameStance: false }, registries, run.loadout, classId);
      const attacker = { ...source, combatStance: stanceOf(carrier, source) }, context = { ...ctx, player: attacker };
      for (const version of [2, 1]) {
        const rules = { ...context, combatExpansionVersion: version };
        const offense = ProfileDamageOffense(rules, attacker, null, amount, carrier, neutralReaders);
        const receipt = profileDamageReceipt(rules, attacker, null, amount, carrier, { proposal: false });
        assert.equal(offense.rawHit, receipt.rawHit, `${classId}/${base.id}/${amount}/v${version}`);
        assert.deepEqual(receipt.damageReceipt.hits[0].sources.slice(0, offense.sources.length), offense.sources);
        if (offense.packetHit && offense.packetPower > 0) packets++;
      }
    }
    assert.deepEqual(run, snapshot, 'pure receipt reads leave the source run untouched');
  }
  assert.ok(packets > 0, 'the shared offense includes both packet channels');
});

test('Venom Spray skips an intrinsic elemental rounding plateau and retains the effective neighboring rank', () => {
  const { run } = fixture(customRegistries, 'reaver'), base = customRegistries.cards.get('core.venomSpray');
  const lead = [{ k: 'authored' }], step = { k: 'dmg', n: 2 };
  const instance = rank => ({ instanceId: 'probe-1', cardId: base.id, rank, upgraded: true, upgradeSteps: lead });
  const after = rank => ({ ...instance(rank), upgradeSteps: [...lead, step] });
  assert.equal(outcome(play(base.id, instance(4))), outcome(play(base.id, after(4))));
  assert.notEqual(outcome(play(base.id, instance(6))), outcome(play(base.id, after(6))));
  const options = rank => nextUpgradeOptions(run, instance(rank), base, customRegistries, 40, { noAuthored: true, everyFamily: true });
  const snapshot = structuredClone(run), original = structuredClone(base);
  assert.ok(options(4).every(proposal => proposal.k !== 'dmg' || proposal.n !== 2));
  assert.ok(options(6).some(proposal => proposal.k === 'dmg' && proposal.n === 2));
  for (const rank of [4, 6]) for (const proposal of options(rank).filter(row => row.k === 'dmg')) {
    const upgraded = { ...instance(rank), rank: proposal.nextRank ?? rank, rarityOverride: proposal.nextRarity,
      upgradeSteps: [...lead, proposal] };
    assert.notEqual(outcome(play(base.id, instance(rank))), outcome(play(base.id, upgraded)));
  }
  assert.deepEqual(run, snapshot);
  assert.deepEqual(base, original);
  assert.equal(rankedEffectsCapped(applyUpgradeSteps(base, lead), 3)[0].amount, 7);
});
