import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, previewIntent } from '../src/engine/combat.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
import { combatIntentPresentation } from '../src/ui/models/CombatIntentModel.js';

// Owner, 2026-11-14 (supersedes 2026-11-03): an enemy intent shows the HP the player will lose if the move resolved now, after the
// player's Block, Poise, Ward, Reflect, stance and Evade; it moves as that state moves. The receipt still carries `rawHit` (the pre-defence hit).
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

test('intent shows the HP the player will lose, and follows the player\'s defences', () => {
  const f = fixture();
  const base = shown(f);
  assert.equal(base.intent.projectedDamage.max, base.intent.projectedDamage.min);
  const open = base.intent.projectedDamage.max;
  assert.ok(open > 0);
  const { combat } = f;
  assert.equal(previewIntent(combat, f.enemy.id).hitDamages[0], open, 'previewIntent quotes the same figure');
  assert.equal(previewIntent(combat, f.enemy.id).hpLoss, open, 'and it is the HP lost');
  combat.player.block = 5;
  assert.equal(shown(f).label, String(open - 5), 'Block 5 takes 5 off');
  assert.equal(previewIntent(combat, f.enemy.id).hitDamages[0], open - 5);
  combat.player.block = 400;
  assert.equal(shown(f).label, '0', 'Block soaks the whole hit');
  combat.player.block = 0;
  combat.player.persistentPoise = { value: 400, max: 400 };
  assert.ok(Number(shown(f).label) < open, 'Poise absorbs part of it');
  delete combat.player.persistentPoise;
  combat.player.reflectStacks = 3;
  assert.ok(Number(shown(f).label) < open, 'Reflect cuts it');
  delete combat.player.reflectStacks;
  combat.player.combatStance = { camp: 'physical', maneuver: 'defend', range: 'melee' };
  assert.ok(Number(shown(f).label) <= open, 'a Defend stance never raises it');
  combat.player.combatStance = { camp: 'physical', maneuver: 'neutral', range: 'melee' };
  combat.player.statuses = { ...combat.player.statuses, evade: { stacks: 1 } };
  assert.equal(shown(f).label, '0', 'one Evade stack cancels the single hit');
});

test('Evade is spent one stack per hit across a multi-hit intent', () => {
  const f = fixture();
  f.enemy.intent = { ...f.enemy.intent, hits: 3 };
  const open = shown(f).intent.projectedDamage.max;
  f.combat.player.statuses = { ...f.combat.player.statuses, evade: { stacks: 1 } };
  const one = shown(f).intent.projectedDamage.max;
  assert.equal(one, open * 2 / 3, 'one hit of three is evaded');
  f.combat.player.statuses = { ...f.combat.player.statuses, evade: { stacks: 3 } };
  assert.equal(shown(f).intent.projectedDamage.max, 0, 'three stacks cancel all three hits');
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

test('the shown figure is the real HP loss', () => {
  const f = fixture();
  f.combat.player.block = 400;
  const read = previewIntent(f.combat, f.enemy.id);
  assert.equal(read.hitDamages[0], 0);
  assert.equal(read.hpLoss, 0);
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

test('an ally\'s Guard is a defense: rawHit ignores the interception while the resolved amount is still reduced', async () => {
  const { profileDamageReceipt } = await import('../src/engine/gameProfileCombat.js');
  const { combat } = fixture();
  // Guard's status rule requires the multiplayer capability; grant it to this combat's profile view only.
  combat.gameProfile = { ...combat.gameProfile, modules: { ...combat.gameProfile.modules, multiplayer: true } };
  const target = combat.enemies[0];
  const guard = { ...structuredClone(target), id: 'guardian', hp: 40, statuses: { 'base.guard-allies': { stacks: 2 } } };
  const strike = { combatProfile: { camp: 'physical', damageType: 'slashing' } };
  const hit = () => profileDamageReceipt(combat, combat.player, target, 10, { ...strike, skipRatingBonus: true }, { roll: 0 });
  const plain = hit();
  combat.enemies.push(guard);
  const guarded = hit();
  assert.equal(guarded.rawHit, plain.rawHit, 'Guard leaves the shown raw hit alone');
  assert.ok(guarded.amount < plain.amount, 'while the resolved amount is reduced by the interception');
});
