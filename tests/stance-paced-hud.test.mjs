import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { core2Registries, core2Run } from './helpers/core2.mjs';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
import { effectiveEvasion } from '../src/engine/stanceHit.js';
import { CaptureCombatDisplay } from '../src/ui/models/CombatPlaybackModel.js';
import { createFollowMemo } from '../src/ui/models/IntentFollowUpModel.js';

const registries = createRegistries({ ...contentBundle,
  enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, evasion: 11 } : enemy) });
const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const displayedCall = screen.match(/evasion: (combat\.combatExpansionVersion[^\n]*?), precision: /)[1];

test('paced HUD displays beat-local Evasion stacks, independent of canonical armour, attributes and enemy AC', () => {
  const slots = registries.equipment.slots;
  const armour = slots.find(slot => slot.kinds.includes('armor'));
  const shield = slots.find(slot => slot.kinds.includes('shield'));
  const loadout = { sets: Object.fromEntries(slots.map(slot => [slot.id, [null]])), active: {} };
  loadout.sets[armour.id] = ['default']; loadout.sets[shield.id] = ['buckler'];
  const combat = createCombat({ registries, rng: createRng(801), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', hp: 100, maxHp: 100,
      mana: 20, maxMana: 20, stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 0, deck: [], loadout,
      attributes: { dexterity: 20, wisdom: 10, intelligence: 10, strength: 10, constitution: 10 } } });
  const capture = () => CaptureCombatDisplay(combat, {
    registries, projectCombatIntent, previewCard, followMemo: createFollowMemo(), upcastRanksByCard: new Map(),
  });
  for (const entity of [combat.player, combat.enemies[0]]) {
    entity.statuses.evade = { stacks: 1 };
    const v = capture().ents[entity.id], expected = effectiveEvasion(combat, entity);
    assert.ok(expected > 1, 'fixture has additional base or equipment Evasion');
    entity.statuses.evade.stacks = 3;
    const shown = () => vm.runInNewContext(displayedCall, { combat, entity, v, effectiveEvasion });
    assert.equal(shown(), 1, 'the displayed count belongs to the earlier paced beat');
    assert.equal(effectiveEvasion(combat, entity), expected + 6, 'later live stacks do not leak into the beat');
    v.statuses.evade.stacks = 2;
    assert.equal(shown(), 2, 'the displayed count changes with the next beat');
  }
  const v = capture().ents.player;
  const withShield = vm.runInNewContext(displayedCall, { combat, entity: combat.player, v, effectiveEvasion });
  loadout.sets[shield.id] = [null];
  const withoutShield = vm.runInNewContext(displayedCall, { combat, entity: combat.player, v, effectiveEvasion });
  assert.equal(withShield, 3, 'the live three-stack snapshot is used');
  assert.equal(withShield, withoutShield, 'equipment AC is not printed as Evasion stacks');
});

test('a paused display capture retains the painted quote and ordered hand instances', () => {
  const registries = core2Registries();
  const run = core2Run({ seed: 511, registries, runId: 'paced-capture' });
  const encounter = registries.encounters.get('a2_knight');
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), encounter, enemyIds: encounter.enemies });
  combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
  const strike = combat.piles.hand.find(card => card.cardId === 'core.strike');
  assert.ok(strike);
  const options = {
    registries, projectCombatIntent, previewCard, followMemo: createFollowMemo(),
    paintedHandQuotes: new Map(), upcastRanksByCard: new Map(),
  };
  const before = CaptureCombatDisplay(combat, options);
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: combat.enemies[0].id });
  assert.ok(combat.pendingReaction);
  const held = combat.piles.hand[0];
  const quote = before.handPreviews.get(held.instanceId);
  assert.ok(quote);
  options.paintedHandQuotes.set(held.instanceId, { plain: { pv: quote } });
  const priced = [];
  options.previewCard = (ctx, id, ...args) => { priced.push(id); return previewCard(ctx, id, ...args); };
  const paused = CaptureCombatDisplay(combat, options);
  assert.equal(paused.hand[0], held);
  assert.equal(paused.handPreviews.get(held.instanceId), quote);
  assert.deepEqual(priced, combat.piles.hand.slice(1).map(card => card.instanceId));
  assert.notEqual(paused.ents.player.statuses, combat.player.statuses);
});
