import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const core = await read('../games/ashenspire/packs/core/cards.json');
const rogue = await read('../content/source/cards/rogueCards.json');
const card = id => core.find(row => row.id === id);

test('weapon Retreat is Ethereal and Exhaust, with uncapped shared fight escalation from zero', () => {
  const retreat = card('core.retreat');
  assert.equal(retreat.cost, 0);
  assert.equal(retreat.staminaCost, 0);
  assert.ok(retreat.keywords.includes('ethereal'));
  assert.ok(retreat.keywords.includes('exhaust'));
  assert.deepEqual(retreat.costGrowth, { stamina: 1, perUse: 1, perCard: true, uncapped: true });
});

test('core Backstep adds self Frail while both base Backsteps and Hit and Run Exhaust', () => {
  const backstep = card('core.backstep');
  assert.ok(backstep.effects.some(effect => effect.op === 'applyStatus' && effect.target === 'self' && effect.status === 'frail' && effect.stacks === 1));
  assert.ok(backstep.upgrade.effects.some(effect => effect.op === 'applyStatus' && effect.target === 'self' && effect.status === 'frail' && effect.stacks === 1), 'the upgrade keeps self Frail');
  assert.ok(backstep.effects.some(effect => effect.op === 'moveEngagement' && effect.target === 'self' && effect.bands === 1));
  for (const definition of [backstep, card('core.hitAndRun'), rogue.find(row => row.id === 'backstep')]) {
    assert.ok(definition.keywords.includes('exhaust'), `${definition.id} base drawback`);
  }
  assert.deepEqual(rogue.find(row => row.id === 'backstep').upgrade.keywords, [], 'the existing rogue upgrade still removes Exhaust');
});

test('Gale Push pays one Mana while Gale Pull keeps its distinct one-SP pull contract', () => {
  assert.equal(card('core.galePush').manaCost, 1);
  assert.equal(card('core.galePush').staminaCost, 1);
  const pull = card('core.galePull');
  assert.equal(pull.staminaCost, 1);
  assert.ok(pull.tags.includes('pullRetreat'));
  assert.ok(pull.effects.some(effect => effect.op === 'pullEnemy'));
});

test('the card rail preserves Pull and enemy-inflicted Retreat as distinct explanations', async () => {
  const { cardSideTags } = await import('../src/ui/components/cardTagSymbols.js');
  const tags = [{ id: 'pullRetreat', label: 'Pull', blurb: 'Removes a Retreat stack.' }, { id: 'retreat', label: 'Retreat', blurb: 'Grants a weapon card.' }];
  const rail = cardSideTags({ tags }, { type: 'skill', effects: [{ op: 'pullEnemy', target: 'enemy' }, { op: 'moveEngagement', target: 'enemy', bands: 1 }] });
  assert.equal(rail.find(row => row.id === 'pullRetreat')?.blurb, tags[0].blurb);
  assert.match(rail.find(row => row.id === 'retreat')?.blurb || '', /Inflicts Retreat/);
  assert.doesNotMatch(rail.find(row => row.id === 'retreat')?.blurb || '', /Grants a weapon card/);
});

test('playing core Backstep applies its self drawback and exhausts the actual copy', async () => {
  const { bandsFight } = await import('./helpers/bands-fight.mjs');
  const { dispatch, previewCard } = await import('../src/engine/combat.js');
  const combat = bandsFight({ hand: ['core.backstep'], stamina: 6 });
  const shown = previewCard(combat, 'qa0');
  const before = combat.player.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
  assert.equal(before - combat.player.stamina, shown.staminaCost);
  assert.equal(combat.player.statuses.frail?.stacks, 1);
  assert.equal(combat.piles.hand.some(row => row.instanceId === 'qa0'), false);
  assert.equal(combat.piles.exhaust.some(row => row.instanceId === 'qa0'), true);
  assert.equal(combat.piles.discard.some(row => row.instanceId === 'qa0'), false);
});

test('Rogue Backstep and Hit and Run exhaust their actual base copies after play', async () => {
  const { bandsFight } = await import('./helpers/bands-fight.mjs');
  const { dispatch, previewCard } = await import('../src/engine/combat.js');
  for (const cardId of ['backstep', 'core.hitAndRun']) {
    const combat = bandsFight({ hand: [cardId], enemyIds: ['wanderingSoldier'], stamina: 6 });
    const targetId = cardId === 'core.hitAndRun' ? combat.enemies[0].id : undefined;
    const shown = previewCard(combat, 'qa0', targetId);
    const before = combat.player.stamina;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId });
    assert.equal(before - combat.player.stamina, shown.staminaCost);
    assert.equal(combat.piles.exhaust.some(row => row.instanceId === 'qa0'), true, cardId);
    assert.equal(combat.piles.discard.some(row => row.instanceId === 'qa0'), false, cardId);
  }
});

test('Gale Push pays exactly 1 SP and 2 MP with the current Reaver loadout', async () => {
  const { bandsFight } = await import('./helpers/bands-fight.mjs');
  const { dispatch, previewCard } = await import('../src/engine/combat.js');
  const combat = bandsFight({ hand: ['core.galePush'], enemyIds: ['wanderingSoldier'], stamina: 6 });
  const enemy = combat.enemies[0];
  const shown = previewCard(combat, 'qa0', enemy.id);
  const before = { stamina: combat.player.stamina, mana: combat.player.mana };
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id });
  assert.equal(shown.staminaCost, 1);
  assert.equal(combat.fixCoreRules.spellCosts.manaSurcharge, 1);
  assert.equal(shown.manaCost, 2, 'authored 1 MP plus the existing spell surcharge once');
  assert.equal(before.stamina - combat.player.stamina, shown.staminaCost);
  assert.equal(before.mana - combat.player.mana, shown.manaCost);
  assert.equal(enemy.row, 'back');
  assert.equal(enemy.statuses.retreat?.stacks, 1);
});

test('armoured and unarmoured Gale Push retain the exact spell surcharge and refuse one Mana below the quote without spending', async () => {
  const { bandsFight } = await import('./helpers/bands-fight.mjs');
  const { dispatch, previewCard } = await import('../src/engine/combat.js');
  const { RefreshGearItemProps } = await import('../src/engine/gearHooks.js');
  const { serializeCombatSnapshot } = await import('../src/engine/combatSnapshot.js');
  for (const unarmoured of [false, true]) {
    const combat = bandsFight({ hand: ['core.galePush'], enemyIds: ['wanderingSoldier'], stamina: 6 });
    if (unarmoured) {
      combat.loadout.sets.armor[0] = null;
      RefreshGearItemProps(combat);
    }
    const enemy = combat.enemies[0];
    const shown = previewCard(combat, 'qa0', enemy.id);
    assert.equal(shown.staminaCost, 1);
    assert.equal(shown.manaCost, 2, 'armour removal does not remove the saved spell-cost rule');
    combat.player.mana = shown.manaCost - 1;
    const beforeReject = JSON.stringify(serializeCombatSnapshot(combat));
    assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id }), /mana/i);
    assert.equal(JSON.stringify(serializeCombatSnapshot(combat)), beforeReject, 'a refused play spends no pool, card, status, counter or RNG');
    combat.player.mana = shown.manaCost;
    const before = combat.player.stamina;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id });
    assert.equal(combat.player.mana, 0);
    assert.equal(before - combat.player.stamina, shown.staminaCost);
  }
});
