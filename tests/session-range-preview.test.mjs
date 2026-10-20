import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { createSession } from '../tools/session.mjs';
import { previewCoopCard } from '../src/engine/coopCombat.js';
import { projectLanSnapshot } from '../tools/lan-state.mjs';
const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture({ enemyCount = 1 } = {}) {
  const sessionRegistries = enemyCount === 1 ? registries : { ...registries, encounters: { ...registries.encounters, get: id => {
    const encounter = registries.encounters.get(id);
    return { ...encounter, enemies: Array.from({ length: enemyCount }, (_, index) => encounter.enemies[index % encounter.enemies.length]) };
  } } };
  const host = createSession({ registries: sessionRegistries, seedString: 'RANGEHOST', combatExpansionVersion: 2 });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver', playInDeckOrder: true });
  host.start();
  for (const member of host.session.members.values()) while (member.run.classMasteryState?.initialTreeTiers.length) {
    const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
    assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
  }
  for (const id of ['p1', 'p2']) { const result = host.chooseNode(id, host.session.mapGraph.startIds[0]); assert.equal(result.ok, true, JSON.stringify(result)); }
  assert.equal(host.scene.kind, 'combat');
  return host;
}
test('actual Core session publishes owner/target/tier route quotes from the canonical host', () => {
  const host = fixture();
  const combat = host.live.combat;
  assert.equal(combat.gameProfile.hash, profile.hash);
  assert.ok(combat.rangeState);
  const stateBefore = JSON.stringify({ rng: combat.rng.getCounters(), players: [...combat.players].map(([id, row]) => [id, row.entity, row.piles]), range: combat.rangeState });
  const snapshot = host.snapshot();
  assert.deepEqual(snapshot.scene.rangeState, combat.rangeState);
  for (const seat of snapshot.scene.players) {
    assert.equal(seat.rangeActorKey, `player:${seat.id}`);
    const attacks = seat.hand.filter(card => card.combatPreview?.range?.targets?.length);
    assert.ok(attacks.length, 'authored Core opening includes a real attack');
    for (const card of attacks) {
      for (const enemy of combat.enemies.filter(row => row.alive)) assert.deepEqual(card.combatPreview.rangeByTarget[enemy.id], previewCoopCard(combat, seat.id, card.instanceId, enemy.id).range);
      for (const [tier, preview] of Object.entries(card.upcastPreviews || {})) for (const enemy of combat.enemies.filter(row => row.alive)) assert.deepEqual(preview.rangeByTarget[enemy.id], previewCoopCard(combat, seat.id, card.instanceId, enemy.id, Number(tier)).range);
    }
  }
  const wire = projectLanSnapshot(snapshot, ['p1']);
  assert.ok(wire.scene.players.find(seat => seat.id === 'p1').hand.some(card => card.combatPreview?.rangeByTarget));
  for (const card of wire.scene.players.find(seat => seat.id === 'p2').hand) assert.equal(card.combatPreview, undefined, 'a different seat never receives private hand odds');
  assert.equal(JSON.stringify({ rng: combat.rng.getCounters(), players: [...combat.players].map(([id, row]) => [id, row.entity, row.piles]), range: combat.rangeState }), stateBefore, 'snapshot pricing never spends or rolls live combat');
});


test('bounded two-seat three-enemy host rebuild benchmark retains all target quotes', t => {
  const host = fixture({ enemyCount: 3 });
  assert.equal(host.live.combat.enemies.length, 3);
  const times = [];
  for (const connected of [false, true, false, true]) {
    const start = performance.now(); host.setConnected('p2', connected); times.push(performance.now() - start);
  }
  const snapshot = host.snapshot();
  const targetIds = snapshot.scene.enemies.filter(enemy => enemy.alive).map(enemy => enemy.id);
  let quotedCards = 0;
  for (const seat of snapshot.scene.players) for (const card of seat.hand) if (card.combatPreview?.range?.targets?.length) {
    quotedCards += 1;
    assert.deepEqual(Object.keys(card.combatPreview.rangeByTarget), targetIds);
  }
  assert.ok(quotedCards > 0);
  t.diagnostic(JSON.stringify({ seats: 2, enemies: 3, quotedCards, rebuildMs: times.map(ms => Number(ms.toFixed(1))), wireBytes: Buffer.byteLength(JSON.stringify(projectLanSnapshot(snapshot, ['p1']))) }));
});
