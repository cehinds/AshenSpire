import test from 'node:test';
import assert from 'node:assert/strict';
import { combatStatusPresentationRegistries } from '../src/ui/models/CombatStatusPresentationModel.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';

const weak = {id:'weak',name:'Weak',tooltip:'Legacy damage reduction.',modifiers:{damageDealtMult:.75}};
const vulnerable = {id:'vulnerable',name:'Vulnerable',tooltip:'Legacy 25% extra damage.'};
const evade = {id:'evade',name:'Evasion',tooltip:'Legacy 3 Evasion per stack.'};
const registries = {statuses:{get:id=>[weak,vulnerable,evade].find(row=>row.id===id),all:()=>[weak,vulnerable,evade]}};
test('Core 2 PIPs and card glossary share effective status tooltips without mutating legacy definitions', () => {
  const combat = {combatExpansionVersion:2,fixCoreRules:fixCoreMechanics,registries};
  const view = combatStatusPresentationRegistries(registries,combat);
  assert.match(view.statuses.get('weak').tooltip,/Attack rating.*0\.75/);
  assert.match(view.statuses.get('vulnerable').tooltip,/1\.25/);
  assert.match(view.statuses.get('evade').tooltip,/Evasion \+1 per stack/);
  assert.match(view.statuses.all()[0].tooltip,/start of the owner's turn/);
  assert.equal(registries.statuses.get('weak'),weak);
  assert.equal(weak.tooltip,'Legacy damage reduction.');
  const legacy = combatStatusPresentationRegistries(registries,{combatExpansionVersion:2,registries});
  assert.equal(legacy.statuses.get('weak'),weak);
});
