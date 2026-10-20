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
function fixture() {
  const host = createSession({ registries, seedString: 'RANGEHOST', combatExpansionVersion: 2 });
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
