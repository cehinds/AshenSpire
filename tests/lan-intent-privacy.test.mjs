import test from 'node:test';
import assert from 'node:assert/strict';
import { broadcastLanSnapshot, lanMemberIds, projectLanSnapshot } from '../tools/lan-state.mjs';
import { coopEnemyIntent, publicCounterIntent } from '../src/ui/models/CoopIntentModel.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { createSession } from '../tools/session.mjs';

function snapshot() {
  return {
    scene: { kind: 'combat', combatMatchupRules: { counterDamageMultiplier: 1.5 },
      events: [{ type: 'enemyMoveStarted', moveId: 'alreadyResolved' }],
      enemies: [{ id: 'enemy:1', enemyId: 'caster', alive: true, hp: 40,
        intent: { kind: 'attack', moveId: 'secretBolt', damage: 99, hits: 2,
          totalDamage: 198, pending: true, privateFutureField: 'unpublished selected payload',
          combatProfile: { camp: 'spell', maneuver: 'ranged', school: 'lightning', damageType: 'lightning' } },
        intentReads: { warrior: false, scout: true, couch: false },
        intentPreviews: {
          warrior: { kind: 'unknown', hidden: true, moveId: null },
          scout: { kind: 'attack', moveId: 'secretBolt', damage: 72, hits: 2,
            hitDamages: [72, 71], totalDamage: 143, revealed: true,
            profile: { camp: 'spell', maneuver: 'ranged', school: 'lightning', damageType: 'lightning' } },
          couch: { kind: 'unknown', hidden: true, moveId: null },
        },
        performedMoves: ['alreadyResolved'], damageMult: 1.5,
      }], players: [{ id: 'warrior' }, { id: 'scout' }] },
    party: [{ id: 'warrior' }, { id: 'scout' }],
  };
}

test('local Counter playback shows its public carrier while retaining the concealed next action', () => {
  const enemy = { id: 'e1', intent: { kind: 'unknown', moveId: null },
    knowledgeAction: { serial: 4, reads: { p1: { visibility: 'unknown' } } } };
  const before = structuredClone(enemy);
  enemy.executingCounterIntent = publicCounterIntent({ moveId: 'publicReturn', amount: 8, poiseDamage: 2,
    wardDamage: 0, combatProfile: { camp: 'physical', maneuver: 'counter' } });
  const view = coopEnemyIntent(enemy, 'p1');
  assert.equal(view.moveId, 'publicReturn'); assert.equal(view.counterDamage, 8);
  assert.equal(view.hidden, false); assert.equal(view.stance, 'countering');
  assert.deepEqual(enemy.knowledgeAction, before.knowledgeAction);
  delete enemy.executingCounterIntent;
  assert.equal(coopEnemyIntent(enemy, 'p1').hidden, true);
  assert.equal(coopEnemyIntent(enemy, 'p1').moveId, null);
});

function wire(clients, source) {
  const received = new Map();
  const sockets = new Map(clients.map(client => [{
    write(bytes) { received.set(client.id, JSON.parse(bytes.toString('utf8'))); },
  }, client]));
  broadcastLanSnapshot(sockets, source, text => Buffer.from(text));
  return received;
}

test('state wire sends each device only its own reads and seat-priced previews', () => {
  const source = snapshot(), before = structuredClone(source);
  const messages = wire([{ id: 'warrior' }, { id: 'scout' }], source);
  const hidden = messages.get('warrior'), shown = messages.get('scout');
  assert.equal(hidden.t, 'state');
  const secret = hidden.snapshot.scene.enemies[0];
  assert.deepEqual(secret.intentReads, { warrior: false });
  assert.deepEqual(Object.keys(secret.intentPreviews), ['warrior']);
  assert.deepEqual(secret.intent, { kind: 'unknown', moveId: null, stance: 'casting',
    hidden: true, revealed: false, profile: { camp: 'spell', maneuver: 'ranged' } });
  const bytes = JSON.stringify(hidden);
  assert.doesNotMatch(bytes, /secretBolt|unpublished selected payload|"hits"|"hitDamages"|"totalDamage"|"school"|"damageType"/);
  const read = shown.snapshot.scene.enemies[0];
  assert.deepEqual(read.intentReads, { scout: true });
  assert.deepEqual(Object.keys(read.intentPreviews), ['scout']);
  assert.equal(coopEnemyIntent(read, 'scout').totalDamage, 143);
  assert.deepEqual(source, before, 'outbound redaction must not mutate authoritative state');
});

test('resync and reconnect reproduce the committed hidden read without leaking another device', () => {
  const source = snapshot();
  const initial = wire([{ id: 'warrior' }, { id: 'scout' }], source).get('warrior');
  const resync = wire([{ id: 'warrior' }, { id: 'scout' }], source).get('warrior');
  const rejoined = wire([{ id: 'reconnectedSocket', ownedIds: ['warrior'] }, { id: 'scout' }], source).get('reconnectedSocket');
  assert.deepEqual(resync, initial);
  assert.deepEqual(rejoined, initial);
  assert.equal(source.scene.enemies[0].intentReads.warrior, false);
});

test('action broadcasts re-project changed reads rather than retaining prior revealed payload', () => {
  const source = snapshot();
  assert.equal(wire([{ id: 'scout' }], source).get('scout').snapshot.scene.enemies[0].intent.moveId, 'secretBolt');
  source.scene.enemies[0].intentReads.scout = false;
  const after = wire([{ id: 'scout' }], source).get('scout');
  assert.doesNotMatch(JSON.stringify(after), /secretBolt|"damage"|"hitDamages"|"totalDamage"/);
});

test('couch device receives only owned-seat union and UI still conceals its failed-reading character', () => {
  const projected = projectLanSnapshot(snapshot(), ['scout', 'couch']);
  const enemy = projected.scene.enemies[0];
  assert.equal(enemy.intent.moveId, 'secretBolt');
  assert.deepEqual(enemy.intentReads, { scout: true, couch: false });
  assert.deepEqual(Object.keys(enemy.intentPreviews), ['scout', 'couch']);
  assert.equal(coopEnemyIntent(enemy, 'scout').totalDamage, 143);
  assert.equal(coopEnemyIntent(enemy, 'couch').hidden, true);
  assert.equal(coopEnemyIntent(enemy, 'couch').damage, undefined);
  assert.equal(coopEnemyIntent(enemy, 'warrior').hidden, true);
});

test('all hidden couch seats receive no selected move even when a remote seat read succeeds', () => {
  const enemy = projectLanSnapshot(snapshot(), ['warrior', 'couch']).scene.enemies[0];
  assert.equal(enemy.intent.hidden, true);
  assert.doesNotMatch(JSON.stringify(enemy), /secretBolt|"damage"|"totalDamage"/);
});

test('missing profiled read fails closed, including stale revealed previews', () => {
  const source = snapshot();
  delete source.scene.enemies[0].intentReads;
  const enemy = projectLanSnapshot(source, ['scout']).scene.enemies[0];
  assert.equal(enemy.intent.hidden, true);
  assert.equal(enemy.intentPreviews.scout.hidden, true);
  assert.equal(enemy.intentPreviews.scout.hitDamages, undefined);
});

test('unassigned connection cannot receive exact intent', () => {
  const enemy = projectLanSnapshot(snapshot(), ['unknownSocket']).scene.enemies[0];
  assert.equal(enemy.intent.hidden, true);
  assert.deepEqual(enemy.intentPreviews, {});
});

test('public stance, enemy identity, resolved history and balance rules survive redaction', () => {
  const source = snapshot(), view = projectLanSnapshot(source, ['warrior']);
  assert.equal(view.scene.enemies[0].enemyId, 'caster');
  assert.equal(view.scene.enemies[0].intent.stance, 'casting');
  assert.deepEqual(view.scene.enemies[0].performedMoves, ['alreadyResolved']);
  assert.deepEqual(view.scene.events, source.scene.events);
  assert.deepEqual(view.scene.combatMatchupRules, source.scene.combatMatchupRules);
  assert.equal(view.scene.enemies[0].damageMult, 1.5);
});

test('staggered intent and legacy unprofiled intent remain readable', () => {
  const source = snapshot(), enemy = source.scene.enemies[0];
  enemy.intent = { kind: 'staggered', moveId: null };
  enemy.intentPreviews = { warrior: { kind: 'staggered', moveId: null } };
  assert.equal(coopEnemyIntent(projectLanSnapshot(source, ['warrior']).scene.enemies[0], 'warrior').stance, 'staggered');
  delete enemy.intentReads;
  delete enemy.intentPreviews;
  enemy.intent = { kind: 'buff', moveId: 'legacySupport' };
  assert.equal(projectLanSnapshot(source, ['warrior']).scene.enemies[0].intent.moveId, 'legacySupport');
});

test('main/couch ownership and explicit disk-resume ownership use the same delivery boundary', () => {
  assert.deepEqual(lanMemberIds({ id: 'p1', locals: [{}, {}] }), ['p1', 'p1L1', 'p1L2']);
  assert.deepEqual(lanMemberIds({ id: 'newSocket', locals: [{}], ownedIds: ['warrior', 'couch'] }), ['warrior', 'couch']);
  const resumed = wire([{ id: 'newSocket', ownedIds: ['warrior', 'couch'] }], snapshot()).get('newSocket');
  assert.equal(resumed.snapshot.scene.enemies[0].intent.hidden, true);
  assert.deepEqual(resumed.snapshot.scene.enemies[0].intentReads, { warrior: false, couch: false });
});

test('non-combat snapshots retain shared party state without mutating host save data', () => {
  const source = { scene: { kind: 'map', votes: { warrior: 'a' } }, party: [{ id: 'warrior' }] };
  const view = projectLanSnapshot(source, ['warrior']);
  assert.deepEqual(view, source);
  view.scene.votes.warrior = 'b';
  assert.equal(source.scene.votes.warrior, 'a');
});

for (const combatExpansionVersion of [1, 2]) test(`version ${combatExpansionVersion} actual next-turn Counter priming receipts expose defense gain without next selected move metadata`, () => {
  const registries = createRegistries({ ...legacyContentBundle,
    balance: { ...legacyContentBundle.balance,
      combatIntent: { ...legacyContentBundle.balance.combatIntent,
        baseHiddenChance: 1, minimumHiddenChance: 1, maximumHiddenChance: 1,
        wisdomReduction: 0, intelligenceReduction: 0 } },
    enemyMoves: legacyContentBundle.enemyMoves.map(move => ({ ...move,
      tags: ['camp:physical', 'maneuver:counter', 'damage:slashing'],
      damage: 6, block: 3, effects: [] })),
  });
  const host = createSession({ registries, seedString: 'GUARD2', combatExpansionVersion });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  // Historical expanded saves did not carry optional reaction rules; this
  // fixture specifically verifies their next-turn defense priming lifecycle.
  for (const member of host.session.members.values()) delete member.run.reactionRulesVersion;
  for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
  assert.equal(host.snapshot().scene.kind, 'combat');
  assert.equal(host.combatEndTurn('p1').ok, true);
  assert.equal(host.combatEndTurn('p2').ok, true);
  const authoritative = host.snapshot();
  assert.equal(authoritative.scene.turn, 2);
  const before = JSON.stringify({ source: authoritative, counters: host.live.combat.rng.getCounters() });
  const message = wire([{ id: 'p1' }], authoritative).get('p1');
  const gains = message.snapshot.scene.events.filter(event => event.type === 'blockGained');
  assert.ok(gains.length, 'selected Counter stances really prime defense before the player phase');
  for (const event of gains) {
    for (const field of ['moveId', 'cardId', 'cardInstanceId', 'profileId', 'school']) assert.equal(event[field], undefined, field);
  }
  for (const enemy of message.snapshot.scene.enemies) {
    assert.equal(enemy.intent.hidden, true);
    assert.equal(enemy.intent.moveId, null);
    assert.deepEqual(Object.keys(enemy.intentPreviews), ['p1']);
    assert.equal(enemy.intentPreviews.p1.damage, undefined);
    assert.equal(enemy.pendingMove, undefined);
    assert.equal(enemy.movesHistory, undefined);
    assert.equal(enemy.combatCounter, undefined);
  }
  assert.ok(message.snapshot.scene.events.some(event => event.type === 'enemyMoveStarted' && event.moveId),
    'already performed move receipts remain public');
  assert.equal(JSON.stringify({ source: authoritative, counters: host.live.combat.rng.getCounters() }), before);
  if (combatExpansionVersion === 1) assert.equal(host.serialize(), null, 'legacy active fights retain their original save boundary');
  else assert.ok(host.serialize()?.liveCombat, 'expanded active fights retain their durable snapshot without exposing it on the wire');
});
