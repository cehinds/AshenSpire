import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameModule } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { awardLevelXp, xpToNext, allocateAttributePoint, rederivePools } from '../src/model/levelup.js';
import { equipPiece, reconcileRunLoadoutHp } from '../src/model/loadout.js';
import { statProjection } from '../src/model/statProjection.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';
import { effectiveAshenBlightAttributes } from '../src/model/ashenBlight.js';
import { progressionStats } from '../src/ui/models/ProgressionInspectionModel.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import { DeckAttributeBonuses } from '../src/model/cardUpgrade.js';

function world(profile = resolveGameProfile('core'), classId = 'reaver', gearFixture = null) {
  const content = applyGameProfileToContent(contentBundle, profile);
  if (gearFixture) {
    content.equipment.armaments = content.equipment.armaments.map(piece => piece.id === gearFixture.id
      ? { ...piece, mods: [...piece.mods, gearFixture.signature] } : piece);
  }
  const registries = bindGameProfileRegistries(createRegistries(content), profile);
  const run = createRunState({ registries, classId, seed: 31, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  return { registries, run };
}

function poolsAgree({ registries, run }) {
  const before = JSON.stringify(run), projection = statProjection(registries, run);
  const progression = progressionStats(registries, run);
  for (const [id, field] of [['hp', 'maxHp'], ['mana', 'maxMana'], ['stamina', 'maxStamina']]) {
    assert.equal(projection.derived.find(row => row.id === id).value, run[field], `${id}: sheet agrees with the actual run maximum`);
    assert.equal(progression.rows.find(row => row.id === id).value, run[field], `${id}: progression agrees with the actual run maximum`);
  }
  assert.equal(JSON.stringify(run), before, 'projecting pool receipts never changes the run');
  return projection;
}

function earnPoint({ registries, run }) {
  for (const from of [1, 2, 3]) {
    awardLevelXp(registries, run, xpToNext(registries, from), {
      pointsPerLevel: gameModule(run, 'progression')?.attributePointsPerLevel || 0,
      grantStats: !!gameModule(run, 'stats'),
    });
  }
  assert.equal(run.level.unspentPoints, 1);
}

function wear({ registries, run }, id) {
  equipPiece(registries, run.loadout, 'armor', 0, id, { has: () => true }, { inCombat: false, classId: run.class, attributes: run.attributes });
  reconcileRunLoadoutHp(registries, run, { adoptEquipmentBonuses: true });
}

test('a real current run keeps HP receipts aligned through XP, Wisdom allocation and armour removal', () => {
  const state = world(), { registries, run } = state;
  assert.equal(run.attributes.constitution, 1);
  wear(state, 'cinderforgedPlate');
  assert.equal(gameProfileEffectiveAttributes(registries, run).constitution, 2, 'the rare Cinderforged Plate grants one Constitution');
  assert.equal(run.maxHp, 55);
  assert.equal(poolsAgree(state).attributes.find(row => row.id === 'constitution').value, 1, 'attribute rows still display allocated points');
  earnPoint(state);
  assert.equal(run.maxHp, 70);
  poolsAgree(state);
  allocateAttributePoint(registries, run, 'wisdom');
  assert.equal(run.maxHp, 70, 'Wisdom does not grant Health');
  assert.equal(run.level.unspentPoints, 0);
  poolsAgree(state);
  run.loadout.sets.armor = [];
  reconcileRunLoadoutHp(registries, run, { adoptEquipmentBonuses: true });
  assert.equal(run.maxHp, 65, 'removing the real +1 Constitution removes five maximum HP');
  poolsAgree(state);
});

test('flat equipment Mana and Stamina addends and permanent HP adjustments are each displayed once', () => {
  const robe = world(undefined, 'starseer');
  wear(robe, 'sagesRobe');
  assert.equal(robe.run.equipmentPoolBonuses.maxMana, 0, 'the current robe has no flat Mana bonus');
  poolsAgree(robe);

  const carrier = world(undefined, 'starseer', { id: 'buckler', signature: 'self.maxMana=+1' });
  carrier.run.loadout.sets.leftHand[0] = 'buckler';
  reconcileRunLoadoutHp(carrier.registries, carrier.run, { adoptEquipmentBonuses: true });
  assert.equal(carrier.run.equipmentPoolBonuses.maxMana, 1, 'a flat signature adds Mana if its item has no Wisdom');
  poolsAgree(carrier);
  const leathers = world();
  wear(leathers, 'gutterLeathers');
  // Owner, 2026-11-20: Gutter Leathers' own +1 max Stamina is dropped because its +1 Dexterity already feeds Stamina (derivedStatRules.json), so it is not counted twice.
  assert.equal(leathers.run.equipmentPoolBonuses.maxStamina, 0, 'the leather +1 Stamina line is dropped: its Dexterity point already feeds the pool');
  leathers.run.maxHpAdjustment = 7;
  reconcileRunLoadoutHp(leathers.registries, leathers.run);
  const hp = poolsAgree(leathers).derived.find(row => row.id === 'hp');
  assert.equal(hp.adjustment, 7);
  assert.match(hp.formula, /\+ 7 permanent/);
});

test('deck upgrades and Ashen Blight affect pool receipts once while allocated attribute rows stay raw', () => {
  const state = world(), { registries, run } = state;
  const originalConstitution = gameProfileEffectiveAttributes(registries, run).constitution;
  run.ashenBlight = { milestones: [{ path: 'survivor', tier: 2 }, { path: 'spell', tier: 1 }] };
  run.deck[0] = { ...run.deck[0], upgraded: true, upgradeSteps: [{ k: 'attr', stat: 'wisdom', n: 4 }] };
  assert.equal(DeckAttributeBonuses(run.deck).wisdom, 4, 'the real run-long upgrade is active');
  rederivePools(registries, run, 'pool projection integration');
  assert.equal(gameProfileEffectiveAttributes(registries, run, effectiveAshenBlightAttributes(run)).constitution, originalConstitution + 2);
  const projection = poolsAgree(state);
  assert.equal(projection.attributes.find(row => row.id === 'constitution').value, run.attributes.constitution);
});

for (const name of ['dev-profile-73ef.json.gz', 'dev-profile-6727a255.json.gz']) test(`a genuine ${name} retains its own pool and equipment rules`, () => {
  const saved = JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}`, import.meta.url))));
  const profileBefore = JSON.stringify(saved), state = world(resolveGameProfile(saved));
  assert.equal(state.run.gameProfile.modules.gear.typeEffectsVersion, undefined);
  delete state.run.levelRewardRuleSnapshot; // Model the archived run shape around these saved profile bytes.
  poolsAgree(state);
  earnPoint(state);
  poolsAgree(state);
  allocateAttributePoint(state.registries, state.run, 'wisdom');
  poolsAgree(state);
  assert.equal(JSON.stringify(saved), profileBefore, 'the immutable historical profile is untouched');
});

test('reading the new pool receipts leaves the separate current Poise owner unchanged', () => {
  const state = world(), { registries, run } = state;
  const before = gameProfileRatingReceipt(registries, run).totals.poise;
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  assert.equal(before, combat.player.persistentPoise.max);
  poolsAgree(state);
  assert.equal(gameProfileRatingReceipt(registries, run).totals.poise, before);
});
