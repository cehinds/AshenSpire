// Co-op callouts and reaction notes ride the session digest (tools/session.mjs
// combatScene): the receipts and the fields fx.js calloutForEvent and
// model/combatLog.js reactionUnavailableNote read must survive projection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { reactionUnavailableNote } from '../src/model/combatLog.js';
import { createSession } from '../tools/session.mjs';
import { calloutForEvent } from '../src/ui/fx.js';
import { coopCallouts } from '../src/ui/screens/coop.js';

const registries = createRegistries(contentBundle);

function fight() {
  const host = createSession({ registries, seedString: 'CALLOUT' });
  host.addMember({ id: 'p1', name: 'One', classId: 'rogue' });
  host.addMember({ id: 'p2', name: 'Two', classId: 'reaver' });
  host.start();
  for (const member of host.session.members.values()) {
    while (member.run.classMasteryState?.initialTreeTiers.length) {
      const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
      assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
    }
  }
  for (const id of ['p1', 'p2']) assert.equal(host.chooseNode(id, host.session.mapGraph.startIds[0]).ok, true);
  return host;
}

// Receipts as the engine writes them, pushed onto the live log; the next host
// action builds the digest that carries them.
function digestWith(host, receipts) {
  host.live.combat.eventLog.push(...receipts.map(event => structuredClone(event)));
  assert.equal(host.combatEndTurn('p1').ok, true);
  return host.snapshot().scene.events;
}

const enemyId = host => host.live.combat.enemies[0].id;

test('the co-op digest keeps reaction-unavailable, crit and guard-break receipts with their fields', () => {
  const host = fight();
  const e1 = enemyId(host);
  const events = digestWith(host, [
    { type: 'combatReactionUnavailable', ownerId: 'p2', sourceId: e1, reason: 'cost', cardId: 'guardCounter', cardIds: ['guardCounter'],
      attackKind: 'attack', resource: 'stamina', need: 2, have: 1 },
    { type: 'critHit', sourceId: 'player', targetId: e1, sourcePlayerId: 'p1', targetPlayerId: null, multiplier: 1.5, amount: 9 },
    { type: 'combatGuardBroken', sourceId: 'player', targetId: e1, sourcePlayerId: 'p1', targetPlayerId: null, poise: 3 },
    { type: 'combatGuardBroken', sourceId: e1, targetId: 'player', sourcePlayerId: null, targetPlayerId: 'p2', poise: 2 },
    { type: 'combatAvoidanceResolved', sourceId: e1, targetId: 'player', targetPlayerId: 'p2', avoided: true,
      evade: { roll: 15, total: 17, difficulty: 10, success: true } },
  ]);
  const why = events.find(event => event.type === 'combatReactionUnavailable');
  assert.ok(why, 'reaction-unavailable receipt is in the digest');
  for (const [key, value] of Object.entries({ ownerId: 'p2', reason: 'cost', attackKind: 'attack', need: 2, have: 1, resource: 'stamina' }))
    assert.equal(why[key], value, key);
  assert.deepEqual(why.cardIds, ['guardCounter']);
  assert.match(reactionUnavailableNote(why, { registries }), /need 2, have 1/);
  assert.ok(events.some(event => event.type === 'critHit'), 'critHit in the digest');
  assert.equal(events.filter(event => event.type === 'combatGuardBroken').length, 2, 'combatGuardBroken in the digest');
  const broken = events.find(event => event.type === 'combatGuardBroken' && event.targetPlayerId === 'p2');
  assert.equal(broken.poise, 2);
  assert.equal(events.find(event => event.type === 'combatAvoidanceResolved').evade.success, true);
});

test('calloutForEvent still calls out digest-projected receipts; co-op names the player seat', () => {
  const host = fight();
  const e1 = enemyId(host);
  const events = digestWith(host, [
    { type: 'critHit', sourceId: 'player', targetId: e1, sourcePlayerId: 'p1', multiplier: 1.5, amount: 9 },
    { type: 'combatGuardBroken', sourceId: e1, targetId: 'player', targetPlayerId: 'p2', poise: 2 },
    { type: 'ratingImpact', sourceId: 'player', targetId: e1, sourcePlayerId: 'p1', meter: 'ward', amount: 4, breaks: 1, label: 'Disruption' },
    { type: 'combatAvoidanceResolved', sourceId: e1, targetId: 'player', targetPlayerId: 'p1', avoided: true, evade: { success: true } },
  ]);
  assert.deepEqual(calloutForEvent(events.find(event => event.type === 'critHit')), { kind: 'critical', targetId: e1 });
  assert.equal(calloutForEvent(events.find(event => event.type === 'combatGuardBroken'))?.kind, 'guardBreak');
  const said = coopCallouts(events).filter(row => ['critical', 'guardBreak', 'disrupted', 'evaded'].includes(row.kind));
  assert.deepEqual(said, [
    { kind: 'critical', targetId: e1 },
    { kind: 'guardBreak', targetId: 'p2' },
    { kind: 'disrupted', targetId: e1 },
    { kind: 'evaded', targetId: 'p1' },
  ]);
});
