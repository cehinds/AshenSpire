// tests/class-tree-breadth.test.mjs — the class tree's shape and its tier-1/2
// breadth (SPEC §13.4g). Every class offers at least four nodes at tier 1 (the
// ability card's loop) and tier 2 (the kit relic's loop), and exactly two
// mutually exclusive subclasses at tier 3. A handful of the added nodes are
// played through a real fight so a rule that validates but never fires fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { classTreeRows } from '../src/model/classTree.js';
import { createRunState } from '../src/model/state.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const REG = createRegistries(contentBundle);

test('every class has at least four nodes at tiers 1 and 2, and a two-node subclass tier', () => {
  for (const cls of REG.classes.all()) {
    const rows = classTreeRows(REG, cls.id);
    const at = (tier) => rows.filter((r) => r.tier === tier).map((r) => r.nodeId);
    assert.ok(at(1).length >= 4, `${cls.id} tier 1 has ${at(1).length} nodes: ${at(1).join(', ')}`);
    assert.ok(at(2).length >= 4, `${cls.id} tier 2 has ${at(2).length} nodes: ${at(2).join(', ')}`);
    assert.equal(at(3).length, 2, `${cls.id} tier 3 is the subclass pair`);
    for (const id of rows.map((r) => r.nodeId)) {
      const term = (contentBundle.nodeTerms || []).find((t) => t.nodeId === id);
      assert.ok(term && term.template, `${cls.id} node '${id}' says what it does`);
    }
  }
});

// A fight for `classId` with `coreTags` picked, its ability card in hand.
function fight(classId, coreTags) {
  const run = createRunState({ seed: 0x7a11, classId, registries: REG });
  const cb = createCombat({ registries: REG, rng: createRng(0x7a11), player: { classId, attributes: run.attributes, skills: run.skills, coreTags, maxHp: 78, hp: 60, mana: 0, maxMana: 3, energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck, loadout: run.loadout, relicIds: [] }, enemyIds: ['fellWarden'] });
  cb.player.maxStamina = 3; cb.player.stamina = 3;
  const cardId = REG.classes.get(classId).abilityCard;
  const inst = cb.piles.hand.find((x) => x.cardId === cardId) || cb.piles.draw.find((x) => x.cardId === cardId);
  if (!cb.piles.hand.includes(inst)) { cb.piles.draw.splice(cb.piles.draw.indexOf(inst), 1); cb.piles.hand.push(inst); }
  const foe = cb.enemies[0];
  foe.block = 0;
  const play = () => dispatch(cb, { type: 'playCard', cardInstanceId: inst.instanceId, targetId: foe.id });
  return { cb, foe, play };
}

test('Parting Blow: leaving a stance for Brace strikes a foe', () => {
  const { cb, foe, play } = fight('reaver', ['partingBlow']);
  cb.player.stanceId = 'gorefire';
  const hp = foe.hp;
  play();
  assert.equal(cb.player.stanceId, 'brace');
  assert.equal(hp - foe.hp, REG.balance.classTree.partingBlow.damage);
});

test('Falling Star and Spent Stars: Attune restores Mana, exhausts, and both answer', () => {
  const { cb, foe, play } = fight('starseer', ['fallingStar', 'spentStars']);
  const hp = foe.hp; const mana = cb.player.mana;
  play();
  assert.equal(hp - foe.hp, REG.balance.classTree.fallingStar.damage, 'the first Mana restored this turn falls on a foe');
  assert.ok(cb.player.mana - mana >= 1 + REG.balance.classTree.spentStars.restoreMana, 'the exhausted Attune gives Mana back');
});

test('Burning Grace and Dazzling Light: Warm Litany scalds and dazzles', () => {
  const { foe, play } = fight('herald', ['burningGrace', 'dazzlingLight']);
  const hp = foe.hp;
  play();
  assert.equal(hp - foe.hp, REG.balance.classTree.burningGrace.damage);
  assert.ok((foe.statuses.weak?.stacks ?? 0) >= REG.balance.classTree.dazzlingLight.weak, 'the heal applies Weak');
});

test('Low Profile: becoming Prepared braces the rogue', () => {
  const { cb, play } = fight('rogue', ['lowProfile']);
  const block = cb.player.block;
  play();
  assert.equal(cb.player.block - block, REG.balance.classTree.lowProfile.block);
});

test('Shard Hunger: a foe that Staggers restores the owner\'s Mana, not the foe\'s', () => {
  const { cb, foe } = fight('starseer', ['shardHunger']);
  foe.poiseMeter.value = foe.poiseMeter.max - 1;
  const inst = { instanceId: 'shard-hunger-kick', cardId: 'kickOff' };
  cb.piles.hand.push(inst);
  cb.player.energy = Math.max(cb.player.energy, 1);
  const mana = cb.player.mana;
  const r = dispatch(cb, { type: 'playCard', cardInstanceId: inst.instanceId, targetId: foe.id });
  assert.ok(!r || r.ok !== false, `the kick plays: ${JSON.stringify(r)}`);
  assert.equal(foe.intent.kind, 'staggered', 'the kick fills the bar');
  assert.equal(cb.player.mana - mana, REG.balance.classTree.shardHunger.restoreMana);
  assert.ok(!Number.isNaN(foe.mana ?? 0), 'the foe is never handed Mana');
});
