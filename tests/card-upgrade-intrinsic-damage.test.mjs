import test from 'node:test';
import assert from 'node:assert/strict';
import { registries as customRegistries } from './helpers/upgrade-probe.mjs';
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
import { fresh, fight, registries as contractRegistries, withScoring } from './helpers/drawback-contract.mjs';
import { dispatch } from '../src/engine/combat.js';
import { GetActiveScoring, SetCustomScoring } from '../src/model/activeScoring.js';

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

const NECROTIC_PLATEAU_MULTIPLIER = 0.25;
test('intrinsic elemental rounding skips a damage plateau and retains the effective neighboring rank', () => withScoring(() => {
  const scoring = structuredClone(GetActiveScoring());
  scoring.rank.maxRank = 10; scoring.rank.maxCp = 10000;
  assert.equal(SetCustomScoring(scoring).ok, true);
  const run = fresh();
  run.seed = 1;
  run.gameProfile = structuredClone(run.gameProfile);
  // Owner ruling 2026-11-28: effect scales read 1, so the plateau comes from a quarter Necrotic multiplier alone.
  Object.assign(run.gameProfile.modules.effects, { baseDamageMultiplier: 1, playerDamageMultiplier: 1,
    physicalDamageMultiplier: 1, strengthDamageWeight: 0, magicStatWeight: 0 });
  run.gameProfile.modules.stats.mode = 'disabled';
  run.relics = []; run.loadout = { sets: {}, active: {} };
  run.attributes = { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0 };
  run.fixCoreRules = structuredClone(fixCoreRules(run));
  delete run.fixCoreRules.stanceBenefits;
  run.fixCoreRules.elements = { version: 1,
    fire: { spreadMultiplier: 1, spreadNeedsOtherEnemies: true, poiseIgnorePerPoint: 0, poiseIgnoreAttributes: [], burnAttribute: 'intelligence', burnMin: 0 },
    frost: { chillDamageDealtPerStack: 0, brittleMultiplier: 1 },
    burn: { damageTakenPerStack: 0 }, shock: { lightningTakenPerStack: 0 },
    lightning: { chainMultiplier: 1 }, divine: { undeadMultiplier: 1 },
    necrotic: { damageMultiplier: NECROTIC_PLATEAU_MULTIPLIER, undeadTag: 'fixture.undead', buildupAttribute: 'intelligence', buildupMin: 0 }, force: {} };
  const base = { id: 'fixture.plateau', name: 'Rounding probe', class: 'colorless', rarity: 'common', type: 'attack',
    costRule: 'fixed', cost: 1, staminaCost: 1, manaCost: 0, damageSchool: 'magic',
    tags: ['camp:spell', 'maneuver:casting', 'classification.attack', 'school:decay', 'damage:necrotic'], kindIds: ['classification.attack'], keywords: [],
    textTemplate: 'Deal {damage} damage.', effects: [{ op: 'damage', target: 'enemy', amount: 4 }],
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4 }] } };
  const registries = { ...contractRegistries, cards: { ...contractRegistries.cards,
    get: id => id === base.id ? base : contractRegistries.cards.get(id),
    has: id => id === base.id || contractRegistries.cards.has(id) } };
  const dealt = instance => {
    const combat = fight([instance]);
    combat.registries = { ...combat.registries, cards: registries.cards };
    combat.gameProfile = run.gameProfile;
    delete combat.fixCoreRules.stanceBenefits;
    combat.fixCoreRules.elements = structuredClone(run.fixCoreRules.elements);
    combat.player.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
    combat.player.ratingSources = [];
    const enemy = combat.enemies[0]; enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
    enemy.block = 0; enemy.persistentPoise = { value: 0, max: 0 }; delete enemy.combatStance;
    const hp = enemy.hp;
    dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: enemy.id });
    assert.equal(combat.piles.hand.some(row => row.instanceId === instance.instanceId), false);
    return hp - enemy.hp;
  };
  const lead = [{ k: 'authored' }], step = { k: 'dmg', n: 2 };
  const instance = rank => ({ instanceId: 'probe-1', cardId: base.id, rank, upgraded: true, upgradeSteps: lead });
  const after = rank => ({ ...instance(rank), upgradeSteps: [...lead, step] });
  assert.deepEqual([dealt(instance(4)), dealt(after(4)), dealt(instance(6)), dealt(after(6))], [2, 2, 2, 3],
    'floor(necrotic × 0.25) makes precisely one neighboring rank plateau');
  const options = rank => nextUpgradeOptions(run, instance(rank), base, registries, 40, { noAuthored: true, everyFamily: true });
  const snapshot = structuredClone(run), original = structuredClone(base);
  assert.ok(options(4).every(proposal => proposal.k !== 'dmg' || proposal.n !== 2));
  assert.ok(options(6).some(proposal => proposal.k === 'dmg' && proposal.n === 2), JSON.stringify(options(6)));
  for (const rank of [4, 6]) for (const proposal of options(rank).filter(row => row.k === 'dmg')) {
    const upgraded = { ...instance(rank), rank: proposal.nextRank ?? rank, rarityOverride: proposal.nextRarity,
      upgradeSteps: [...lead, proposal] };
    assert.notEqual(dealt(instance(rank)), dealt(upgraded));
  }
  assert.deepEqual(run, snapshot);
  assert.deepEqual(base, original);
  assert.equal(rankedEffectsCapped(applyUpgradeSteps(base, lead), 3)[0].amount, 7);
}));
