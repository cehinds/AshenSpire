import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard, previewCoopCard } from '../src/engine/coopCombat.js';
import { armCombatCounter } from '../src/engine/combatMatchups.js';
import { playingCardModel, combatCardSummary } from '../src/model/playingCard.js';

function fight(coop, { split = false, smash = false } = {}) {
  const registries = createRegistries({ ...contentBundle,
    tagging: contentBundle.tagging.map(row => smash && row.family === 'card' && row.objectId === 'twinbladeFlurry'
      && row.tagId === 'maneuver:attack' ? { ...row, tagId: 'maneuver:smash' } : row),
    cards: contentBundle.cards.map(card => card.id === 'twinbladeFlurry' ? { ...card,
      ...(smash ? { tags: ['camp:physical', 'maneuver:smash', 'damage:slashing', 'source:weapon', 'delivery:melee'] } : {}),
      effects: split ? [1, 2].map(hits => ({ op: 'damage', target: 'enemy', amount: 3, hits }))
        : [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }],
      textTemplate: split ? 'Deal {damage} damage {hits} times. Deal {damage.2} damage {hits.2} times.'
        : 'Deal {damage} damage {hits} times.',
    } : card),
  });
  const actor = { classId: 'reaver', hp: 500, maxHp: 500, energyMax: 3, drawPerTurn: 1,
    deck: [{ instanceId: 'flurry', cardId: 'twinbladeFlurry' }], relicIds: [] };
  const options = { registries, rng: createRng(50), enemyIds: ['wanderingSoldier'], ratingsRules: null };
  const combat = coop ? createCoopCombat({ ...options, players: [{ id: 'p1', ...actor }] })
    : createCombat({ ...options, player: actor });
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 1000;
  enemy.block = smash ? 1 : 10;
  enemy.poiseMeter = { value: 0, max: 1000 };
  if (!smash) armCombatCounter(combat, enemy, { combatProfile: { camp: 'physical', maneuver: 'counter' } }, { damage: 6 });
  return { combat, enemy, registries,
    preview: () => coop ? previewCoopCard(combat, 'p1', 'flurry', enemy.id) : previewCard(combat, 'flurry', enemy.id),
    resolve: () => coop ? playCard(combat, 'p1', 'flurry', enemy.id)
      : dispatch(combat, { type: 'playCard', cardInstanceId: 'flurry', targetId: enemy.id }),
  };
}

for (const coop of [false, true]) for (const split of [false, true]) for (const smash of [false, true]) {
  test(`${coop ? 'co-op' : 'solo'} card preview evolves ${smash ? 'Guard' : 'Counter'} across ${split ? 'effects' : 'hits'}`, () => {
    const f = fight(coop, { split, smash });
    const before = JSON.stringify({ enemy: f.enemy, queue: f.combat.queue, events: f.combat.eventLog, rng: f.combat.rng.getCounters() });
    const shown = f.preview();
    const values = shown.values.filter(value => value.op === 'damage');
    const hits = values.flatMap(value => value.hitDamages);
    assert.deepEqual(hits, smash ? [4, 3, 3] : [1, 3, 3]);
    if (!split) {
      const summary = combatCardSummary(shown.resolvedDefinition, shown, f.registries);
      assert.ok(summary.includes(`${hits.join(' + ')} damage (${hits.reduce((sum, amount) => sum + amount, 0)} total across 3 hits)`), summary);
    }
    for (const value of values) {
      assert.equal(value.totalDamage, value.hitDamages.reduce((sum, amount) => sum + amount, 0));
      assert.deepEqual(value.perTargetHitDamages[f.enemy.id], value.hitDamages);
    }
    assert.equal(JSON.stringify({ enemy: f.enemy, queue: f.combat.queue, events: f.combat.eventLog, rng: f.combat.rng.getCounters() }), before);
    if (!split) assert.deepEqual(playingCardModel(f.registries, { cardId: 'twinbladeFlurry' }, { preview: shown }).damageSequences[0].hitDamages, hits);
    f.resolve();
    assert.deepEqual(f.combat.eventLog.filter(event => event.type === 'damageDealt' && event.targetId === f.enemy.id)
      .map(event => event.amount), hits);
  });
}
