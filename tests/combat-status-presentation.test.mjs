import test from 'node:test';
import assert from 'node:assert/strict';
import { combatStatusPresentationRegistries } from '../src/ui/models/CombatStatusPresentationModel.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { createEntityTermOverlay } from '../src/framework/termOverlay.js';
import { activeCombatAbilities } from '../src/ui/components/combatAbilities.js';

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
  // The holder's own resolved rules (a scoped baseAC) feed its tooltip, not the global block.
  const scoped = {id:'e2',mechanicBindings:[{tag:'combat:accuracy',parameters:{baseAC:3}}]};
  assert.match(tip(scoped),/^Each stack adds 2 Evasion/); // Rule: Evade adds 2 Evasion per stack from mechanics.json accuracy.evadePerStack, not the holder's baseAC (owner, 2026-10-31)
  assert.match(view.statuses.get('evade').tooltip,/^Each stack adds 2 Evasion\. Only attacks roll\./);
  assert.doesNotMatch(view.statuses.get('evade').tooltip,/gear \+2/);
  assert.match(tip(enemy),/^Each stack adds 2 Evasion/);
  assert.match(tip(gearedPlayer),/^Each stack adds 2 Evasion/);
  assert.match(view.statuses.all()[0].tooltip,/start of the owner's turn/);
  assert.equal(registries.statuses.get('weak'),weak);
  assert.equal(weak.tooltip,'Legacy damage reduction.');
  const legacy = combatStatusPresentationRegistries(registries,{combatExpansionVersion:2,registries});
  assert.equal(legacy.statuses.get('weak'),weak);
});

test('player and enemy inspectors retain Core Evade wording after the real terminology overlay', () => {
  const terms = createEntityTermOverlay({statuses:[evade]});
  const source = {...registries,frameworkTerms:terms};
  const combat = {combatExpansionVersion:2,fixCoreRules:fixCoreMechanics,registries:source};
  const view = combatStatusPresentationRegistries(source,combat);
  const player = {id:'player',attributes:{dexterity:7},statuses:{evade:{stacks:1}}};
  const enemy = {id:'e1',attributes:{dexterity:5},statuses:{evade:{stacks:2}},
    mechanicBindings:[{tag:'combat:accuracy',parameters:{baseAC:3}}]};
  const playerRow = activeCombatAbilities(view,player).find(row=>row.id==='evade');
  assert.match(playerRow.detail,/Each stack adds 2 Evasion/);
  // The enemy inspector uses this same get(holder) -> terminology sequence.
  const enemyDef = view.frameworkTerms.withStatusWords(view.statuses.get('evade',enemy));
  assert.match(enemyDef.tooltip,/Each stack adds 2 Evasion/);
  assert.match(activeCombatAbilities(view,enemy).find(row=>row.id==='evade').detail,/2 Evasion/);
  assert.doesNotMatch(playerRow.detail,/Legacy 3|Evasion roll/);
  assert.equal(enemyDef.name,'Evasion','terminology still owns the status name');
  assert.equal(terms.withStatusWords(evade).tooltip,evade.tooltip,'the shared overlay remains unchanged');
  const legacy = combatStatusPresentationRegistries(source,{combatExpansionVersion:2,registries:source});
  assert.equal(legacy.frameworkTerms.withStatusWords(legacy.statuses.get('evade',enemy)).tooltip,evade.tooltip);
});
