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
  // No holder: entity-neutral, so a geared player's bonus never shows on an enemy's pip.
  const gearedPlayer = {id:'player',baseEvasionBonus:2}, enemy = {id:'e1'};
  const neutral = combat.player = gearedPlayer, tip = holder => view.statuses.get('evade',holder).tooltip;
  assert.equal(neutral,gearedPlayer);
  assert.match(view.statuses.get('evade').tooltip,/^Each stack adds 1 plus the holder's gear Evasion and DEX/);
  assert.doesNotMatch(view.statuses.get('evade').tooltip,/gear \+2/);
  assert.match(tip(enemy),/^Each stack adds 1 \(base 1\) plus the holder's DEX/);
  assert.match(tip(gearedPlayer),/^Each stack adds 3 \(base 1, gear \+2\) plus the holder's DEX/);
  assert.match(view.statuses.all()[0].tooltip,/start of the owner's turn/);
  assert.equal(registries.statuses.get('weak'),weak);
  assert.equal(weak.tooltip,'Legacy damage reduction.');
  const legacy = combatStatusPresentationRegistries(registries,{combatExpansionVersion:2,registries});
  assert.equal(legacy.statuses.get('weak'),weak);
});
