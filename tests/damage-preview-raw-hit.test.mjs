import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, previewIntent } from '../src/engine/combat.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
import { combatIntentPresentation } from '../src/ui/models/CombatIntentModel.js';

// Owner, 2026-11-03: a damage preview shows the actual hit. Only stances, statuses (Strength, Weak, Vulnerable) and
// damage-type weakness/resistance may change it; the defender's Block, Poise, Ward, Barrier, Counter, Reflect,
// defensive stance, Evade/AC never do. Display only: real HP loss is unchanged.
function fixture() {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const combat = createCombat({ registries, rng: createRng(71), gameProfile: profile, combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', hp: 100, maxHp: 100, maxMana: 5, mana: 5, maxStamina: 5, stamina: 5, energyMax: 5, drawPerTurn: 1, deck: [] } });
  const enemy = combat.enemies[0];
  enemy.intent = { kind: 'attack', moveId: 'slash', damage: 13, hits: 1, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee', damageType: 'slashing' } };
  enemy.intentRevealed = true; enemy.proposalIntentRevealedUntil = 99;
  delete combat.player.persistentPoise; delete combat.player.persistentWard; delete combat.player.combatStance;
  combat.player.block = 0;
  return { combat, enemy };
}
const shown = ({ combat, enemy }) => {
  const intent = projectCombatIntent(combat, enemy.id);
  return { intent, label: intent.projectedDamage.label, part: combatIntentPresentation(intent).parts[0] };
};

test('intent shows the raw hit whatever the player defends with', () => {
  const f = fixture();
  const base = shown(f);
  assert.equal(base.intent.projectedDamage.max, base.intent.projectedDamage.min);
  const raw = base.intent.projectedDamage.max;
  assert.ok(raw > 0);
  const { combat } = f;
  combat.player.block = 400;
  assert.equal(shown(f).label, String(raw), 'Block');
  combat.player.block = 0;
  combat.player.persistentPoise = { value: 400, max: 400 };
  assert.equal(shown(f).label, String(raw), 'Poise');
  combat.player.persistentWard = { value: 400, max: 400 };
  combat.player.statuses = { ...combat.player.statuses, ward: { stacks: 5 } };
  assert.equal(shown(f).label, String(raw), 'Ward');
  delete combat.player.persistentWard; delete combat.player.persistentPoise; delete combat.player.statuses.ward;
  combat.player.reflectStacks = 3;
  assert.equal(shown(f).label, String(raw), 'Reflect');
  delete combat.player.reflectStacks;
  combat.player.combatStance = { camp: 'physical', maneuver: 'defend', range: 'melee' };
  assert.equal(shown(f).label, String(raw), 'Defend stance');
  combat.player.combatStance = { camp: 'physical', maneuver: 'counter', range: 'melee' };
  combat.player.block = 20;
  assert.equal(shown(f).label, String(raw), 'Counter stance with Block');
  assert.equal(previewIntent(combat, f.enemy.id).hitDamages[0], raw, 'previewIntent quotes the same raw hit');
});

test('intent still changes with the attacker\'s statuses and the defender\'s Vulnerable', () => {
  const f = fixture();
  const raw = Number(shown(f).label);
  f.combat.player.statuses = { ...f.combat.player.statuses, vulnerable: { stacks: 2 } };
  assert.ok(Number(shown(f).label) > raw, 'Vulnerable raises the shown hit');
  delete f.combat.player.statuses.vulnerable;
  f.enemy.statuses = { ...f.enemy.statuses, weak: { stacks: 2 } };
  assert.ok(Number(shown(f).label) < raw, 'Weak on the attacker lowers the shown hit');
});

test('the raw hit is display only: real HP loss still honours Block', () => {
  const f = fixture();
  const raw = Number(shown(f).label);
  f.combat.player.block = 400;
  const read = previewIntent(f.combat, f.enemy.id);
  assert.equal(read.hitDamages[0], raw);
  assert.equal(read.hpLoss, 0, 'resolution is unchanged');
});

test('rawHit on the receipt carries damage-type weakness but not Block or Poise', async () => {
  const { profileDamageReceipt } = await import('../src/engine/gameProfileCombat.js');
  const { combat, enemy } = fixture();
  const target = combat.enemies[0];
  const blunt = { combatProfile: { camp: 'physical', damageType: 'blunt' } };
  const slashing = { combatProfile: { camp: 'physical', damageType: 'slashing' } };
  const hit = (carrier, t) => profileDamageReceipt(combat, combat.player, t, 10, { ...carrier, skipRatingBonus: true }, { roll: 0 });
  target.weaknesses = [{ trigger: 'blunt', effect: 'damage', amount: 25, to: 'blunt' }];
  const plain = hit(slashing, target), weak = hit(blunt, target);
  assert.equal(weak.rawHit > plain.rawHit, true, 'type weakness raises the shown hit');
  target.block = 400; target.persistentPoise = { value: 400, max: 400 };
  assert.equal(hit(blunt, target).rawHit, weak.rawHit, 'Block and Poise leave it alone');
  assert.equal(hit(blunt, target).hpLoss < weak.rawHit, true, 'while real HP loss is reduced');
  void enemy;
});
