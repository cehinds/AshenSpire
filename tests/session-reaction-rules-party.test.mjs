import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession } from '../tools/session.mjs';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';

const registries = createRegistries(contentBundle);

test('a fight takes the reaction-rules version of the whole party, not only its connected seats', () => {
  const host = createSession({ registries, seedString: 'REACTIONPARTY1' });
  host.addMember({ id: 'p1', name: 'p1', classId: 'reaver' });
  host.addMember({ id: 'p2', name: 'p2', classId: 'reaver' });
  host.start();
  for (const member of host.session.members.values()) while (member.run.classMasteryState?.initialTreeTiers.length) {
    const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
    assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
  }
  // p2 is an older save with v1 reaction rules; it is disconnected when the fight starts.
  const older = host.session.members.get('p2').run;
  older.reactionRulesVersion = 1; delete older.reactionRules;
  host.setConnected('p2', false);
  assert.equal(host.chooseNode('p1', host.session.mapGraph.startIds[0]).ok, true);
  assert.equal(host.scene.kind, 'combat');
  assert.equal(host.live.combat.reactionRulesVersion, 1);
  assert.equal(host.live.combat.reactionRules, undefined);
});

test('a dead seat on an older reaction-rules version does not hold the living party back', () => {
  const host = createSession({ registries, seedString: 'REACTIONPARTY2' });
  host.addMember({ id: 'p1', name: 'p1', classId: 'reaver' });
  host.addMember({ id: 'p2', name: 'p2', classId: 'reaver' });
  host.start();
  for (const member of host.session.members.values()) while (member.run.classMasteryState?.initialTreeTiers.length) {
    const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
    assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
  }
  // p2 is dead on an older v1 save; p1 is connected and on v2. p2 can never rejoin.
  const dead = host.session.members.get('p2');
  dead.run.reactionRulesVersion = 1; delete dead.run.reactionRules;
  dead.alive = false;
  assert.equal(host.chooseNode('p1', host.session.mapGraph.startIds[0]).ok, true);
  assert.equal(host.scene.kind, 'combat');
  assert.equal(host.live.combat.reactionRulesVersion, 2);
});
