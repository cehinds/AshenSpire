// Runtime composition reads cyclic services through their module objects.
// The production loader publishes exports after each factory returns; a named
// import here can capture undefined while loadout/registries construct state.
import * as Loadout from './loadout.js';
import * as CardRegistry from './registries.js';
import * as StartingAbilities from './startingAbilities.js';
import { subclassSelectionProblem, subclassAbilityRole } from './subclasses.js';
import { applyCombatExpansionMartial } from '../content/combatExpansionMartial.js';
import { combatProfileFor } from './combatCardProfile.js';

/** Selection legality uses actual equipment exceptions and rank-zero requirements. */
export function subclassCardLegal(registries, run, cardId, abilityRank = 0) {
  if (!registries.cards.has(cardId)) return false;
  const held = ['rightHand','leftHand'].map(slot => run.loadout?.sets?.[slot]?.[run.loadout?.active?.[slot] || 0]).filter(Boolean);
  const exact = (registries.equipment.cardEquipmentExceptions || []).filter(row => row.cardId === cardId);
  if (exact.length && !exact.some(row => held.includes(row.weaponId))) return false;
  const def = registries.cards.get(cardId);
  const schools = new Set((registries.nodes || []).filter(node => node.parentId === 'card').map(node => node.id));
  const cardSchools = (def.tags || []).filter(tag => schools.has(tag));
  const needsWeapon = def.type === 'attack' || combatProfileFor(applyCombatExpansionMartial(def)).maneuver === 'counter';
  if (needsWeapon && def.tags?.includes('source:weapon') && cardSchools.length && !exact.length && !held.some(id => (registries.equipment.armaments || []).find(piece => piece.id === id)?.tags?.some(tag => cardSchools.includes(tag)))) return false;
  const face = CardRegistry.resolveCard(registries, { cardId, abilityRank });
  return Object.entries(face.requirements?.attributes || {}).every(([attribute, minimum]) => (run.attributes?.[attribute] || 0) >= minimum);
}

/** Full instance-ready birth recipe; never mutates the preview or live run. */
export function subclassDeckPreview(registries, run, { startingAbilityRefs = [], startingAbilityIds = undefined, settings = {} } = {}) {
  if (startingAbilityIds !== undefined) {
    const plan = StartingAbilities.startingAbilityPlan(registries, run, settings);
    if (!Array.isArray(startingAbilityIds) || startingAbilityIds.length > (plan?.count || 0)) throw new Error('Choose abilities that fit the opening subclass slots.');
    const choices = new Map((plan?.choices || []).map(card => [card.id, card]));
    if (startingAbilityIds.some(id => !choices.has(id)) || new Set(startingAbilityIds.map(id => choices.get(id).abilityFamily || id)).size !== startingAbilityIds.length) throw new Error('Choose distinct abilities available for this loadout.');
    if (startingAbilityIds.filter(id => plan.elementIds.includes(id)).length > plan.maxElementPicks) throw new Error(`Choose at most ${plan.maxElementPicks} element spell.`);
    startingAbilityRefs = startingAbilityIds.map(id => StartingAbilities.startingAbilityRef(plan, id));
  }
  const problem = subclassSelectionProblem(registries, run.class, run.subclassId);
  if (problem || run.subclassId === undefined) throw new Error(problem || 'Choose an opening subclass.');
  const def = registries.subclasses.get(run.subclassId), refs = [];
  const add = (ref, openingRole, openingSource) => refs.push({ ...ref, openingRole, openingSource });
  const replacements = new Map();
  for (const [index, ref] of startingAbilityRefs.entries()) {
    const role = def.startingAbility?.roles?.[index] || subclassAbilityRole(registries, ref.cardId);
    if (!role || replacements.has(role) || !def.roles.some(slot => slot.role === role)) throw new Error('Choose a starting ability that fits an opening subclass slot.');
    replacements.set(role, ref);
  }
  for (const slot of def.roles) {
    const chosen = replacements.get(slot.role);
    const cardId = chosen?.cardId || slot.cardIds.find(id => subclassCardLegal(registries, run, id));
    if (!cardId || !subclassCardLegal(registries, run, cardId, chosen?.abilityRank ?? 0)) throw new Error(`No legal ${slot.role} card for '${def.name}' with this loadout.`);
    add({ ...(chosen || { cardId }), ...(registries.cards.get(cardId).gradeProfiles && !chosen ? { abilityRank: 0 } : {}), grantSource: 'from:class' }, slot.role, 'subclass');
  }
  const cfg = registries.subclassOpeningRules;
  add({ cardId: registries.classes.get(run.class)[cfg.baseClassCard], grantSource: 'from:class' }, 'Class', 'class');
  add(Loadout.openingWeaponArtRef(registries, run), 'Weapon Art', 'weaponArt');
  const attackPlan = Loadout.buildEquippedWeaponCardPlan(registries, run.loadout, run.class, { attackSlotCount: cfg.basicAttackCount });
  for (const slot of attackPlan.slots) add({ cardId: slot.cardId, equipmentRole: 'attack', profileId: slot.profileId,
    equipmentAttackSlotId: slot.equipmentAttackSlotId, equipmentPlanFingerprint: attackPlan.fingerprint,
    ...(slot.sourceHand ? { sourceHand: slot.sourceHand } : {}), ...(slot.weaponId ? { weaponId: slot.weaponId } : {}) }, 'Strike', 'basic');
  const guard = Loadout.equipmentKitPlan(registries, run.loadout, run.class).find(row => row.role === 'guard');
  for (let i = 0; i < cfg.basicGuardCount; i++) add({ cardId: guard.profile.baseCardId, equipmentRole: 'guard', profileId: guard.profile.id }, 'Defend', 'basic');
  if (refs.length !== 11) throw new Error('Opening subclass recipe must deal exactly eleven cards.');
  return refs;
}

/** Disposable display receipt using the same equipment stamping as real birth. */
export function stampedSubclassDeckPreview(registries, run, options = {}) {
  const candidate = structuredClone(run);
  candidate.deck = subclassDeckPreview(registries, candidate, options).map((ref, index) => ({
    instanceId: `creation-preview:${index}`, upgraded: false, ...ref,
  }));
  // Birth weakens default graded starters before any selected-ability rebuild.
  // Selected recipes already carry their explicit grades, as the birth path does.
  if (candidate.progressionRulesVersion === 1 && !(options.startingAbilityRefs?.length || options.startingAbilityIds?.length)) {
    for (const card of candidate.deck) if (registries.cards.get(card.cardId).gradeProfiles) card.abilityRank = 0;
  }
  candidate.equipmentAttackSlotCount = candidate.deck.filter(card => card.equipmentRole === 'attack').length;
  Loadout.stampDeck(registries, candidate, undefined, {
    adoptEquipmentBonuses: false, reconcileEquipmentPools: false,
  });
  Loadout.orderStartingDeck(registries, candidate);
  return candidate.deck;
}
