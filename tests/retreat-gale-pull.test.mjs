// Owner, 2026-11-18 section 22: Gale Pull (new card) is the opposite of Gale Push. It carries the Force tag and removes 1 Retreat stack from
// its target, bringing it forward to the front row when none are left.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { SetEnemyRow } from '../src/engine/bandRows.js';
import { applyStatus } from '../src/engine/statuses.js';
import { bandsFight, registries } from './helpers/bands-fight.mjs';

const stacks = enemy => enemy.statuses?.retreat?.stacks || 0;
const retreated = (combat, enemy, n) => { SetEnemyRow(combat, enemy, 'back', 'push'); applyStatus(combat, enemy, 'retreat', n, null); };

test('Gale Pull mirrors Gale Push: Force-tagged, 1 SP, the same damage tier and upgrade', () => {
  const pull = registries.cards.get('core.galePull'), push = registries.cards.get('core.galePush');
  assert.equal(pull.staminaCost, push.staminaCost);
  assert.equal(pull.cost, 1);
  assert.ok(pull.tags.includes('school:force'), 'the Force tag');
  assert.ok(pull.tags.includes('pullRetreat'), 'the Pull tag');
  const dmg = def => def.effects.find(e => e.op === 'damage').amount;
  assert.equal(dmg(pull), dmg(push));
  assert.equal(dmg({ effects: pull.upgrade.effects }), dmg({ effects: push.upgrade.effects }));
});

test('its face and tag rail say it pulls', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { cardSideTags } = await import('../src/ui/components/cardTagSymbols.js');
  const card = registries.cards.get('core.galePull');
  const face = (cardFaceLines(card, null, registries) || []).map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
  assert.match(face, /Pull Retreat/, face);
  const rowTags = card.tags.map(id => registries.tags.find(tag => tag.id === id)).filter(Boolean);
  const rail = cardSideTags({ tags: rowTags }, card, registries);
  assert.ok(rail.some(tag => tag.id === 'pullRetreat'), 'the Pull tag shows: ' + rail.map(tag => tag.id).join(','));
});

test('a target holding 2 stacks loses one and stays in the back row', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.galePull'] });
  const enemy = combat.enemies[0];
  retreated(combat, enemy, 2);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id });
  assert.equal(stacks(enemy), 1);
  assert.equal(enemy.row, 'back');
});

test('a target whose last stack the pull removes comes forward to the front row', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.galePull'] });
  const enemy = combat.enemies[0];
  retreated(combat, enemy, 1);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id });
  assert.equal(stacks(enemy), 0);
  assert.equal(enemy.row, 'front');
  assert.equal(combat.rangeState.engagements['["enemy:' + enemy.id + '","player:player"]'] ?? 0, 0);
});

test('shown cost equals paid cost', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.galePull'] });
  const enemy = combat.enemies[0];
  retreated(combat, enemy, 1);
  const shown = previewCard(combat, 'qa0', enemy.id).cost;
  const before = combat.player.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id });
  assert.equal(before - combat.player.stamina, shown);
});
