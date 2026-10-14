import { startingAbilityPlan, startingAbilityRef } from './startingAbilities.js';
import { classTreeRows } from './classTree.js';
import { buildEquippedWeaponCardPlan, equipmentKitPlan, openingWeaponArtRef } from './loadout.js';
import { resolveCard } from './registries.js';
import { applyCombatExpansionMartial } from '../content/combatExpansionMartial.js';
import { combatProfileFor } from './combatCardProfile.js';

const all = source => source?.subclasses?.all ? source.subclasses.all() : (source?.subclasses || []);
const classRows = source => source?.classes?.all ? source.classes.all() : (source?.classes || []);
const cardRows = source => source?.cards?.all ? source.cards.all() : (source?.cards || []);

export function subclassOptions(registries, classId) {
  return all(registries).filter(row => row.classId === classId);
}

export function subclassSelectionProblem(registries, classId, subclassId) {
  if (subclassId === undefined) return null; // historical API/save
  if (typeof subclassId !== 'string' || !subclassId) return 'Choose an opening subclass.';
  const row = all(registries).find(row => row.id === subclassId);
  if (!row) return `Unknown opening subclass '${subclassId}'.`;
  if (row.classId !== classId) return `Opening subclass '${subclassId}' belongs to '${row.classId}', not '${classId}'.`;
  return null;
}

/** Opening identity wins; historical earned node identity is never renamed. */
export function effectiveSubclassId(registries, run) {
  if (run?.classUnequipped) return null;
  const classId = run?.class || run?.classId;
  if (run?.subclassId !== undefined) {
    return subclassSelectionProblem(registries, classId, run.subclassId) ? null : run.subclassId;
  }
  const tree = classTreeRows(registries, classId);
  const ladder = registries.balance?.skill?.class?.tierAt;
  const tier = ladder?.length || Math.max(0, ...tree.map(row => row.tier));
  return (run?.coreTags || []).find(id => tree.some(row => row.nodeId === id && row.tier === tier && tier > 0)) || null;
}

export function subclassContentProblems(source) {
  if (source.subclasses === undefined) return [];
  if (!Array.isArray(source.subclasses) && typeof source.subclasses?.all !== 'function') return ['subclasses: must be an array of definitions'];
  const out = [], seen = new Set(), classes = classRows(source), cards = cardRows(source);
  const legal = new Set(['Smash', 'Counter', 'Power', 'Skill', 'Sweep', 'Spell']);
  for (const row of all(source)) {
    const path = row?.id || '?';
    if (!row || typeof row.id !== 'string' || !row.id || seen.has(row.id)) { out.push(`${path}: identity must be unique and non-empty`); continue; }
    seen.add(row.id);
    for (const key of Object.keys(row)) if (!['id','classId','name','glyph','default','description','roles','startingAbility','weaponInfusion','progressionNodeIds'].includes(key)) out.push(`${path}.${key}: unknown field`);
    if (!classes.some(cls => cls.id === row.classId)) out.push(`${path}.classId: unknown class '${row.classId}'`);
    for (const key of ['name','glyph','description']) if (typeof row[key] !== 'string' || !row[key]) out.push(`${path}.${key}: must be non-empty`);
    if (row.default !== undefined && typeof row.default !== 'boolean') out.push(`${path}.default: must be boolean`);
    if (!Array.isArray(row.progressionNodeIds) || !row.progressionNodeIds.length || row.progressionNodeIds.some(id => !(source.classTree || []).some(node => node.classId === row.classId && node.nodeId === id && Number(node.tier) === 3))) out.push(`${path}.progressionNodeIds: requires this class's historical top-tier nodes`);
    const roles = Array.isArray(row.roles) ? row.roles : [];
    const ids = roles.map(slot => slot?.role);
    if (roles.length !== 5 || new Set(ids).size !== 5 || !['Smash','Counter','Power','Skill'].every(role => ids.includes(role)) || ids.filter(role => ['Sweep','Spell'].includes(role)).length !== 1) out.push(`${path}.roles: requires Smash, Counter, Power, Skill and Sweep or Spell exactly once`);
    for (const slot of roles) {
      if (!legal.has(slot?.role)) out.push(`${path}.roles: unknown role '${slot?.role}'`);
      if (!Array.isArray(slot?.cardIds) || !slot.cardIds.length || new Set(slot.cardIds).size !== slot.cardIds.length) out.push(`${path}.${slot?.role}: requires distinct ordered card ids`);
      for (const id of Array.isArray(slot?.cardIds) ? slot.cardIds : []) if (!cards.some(card => card.id === id)) out.push(`${path}.${slot.role}: unknown card '${id}'`);
      else if (slot.role === 'Power' && cards.find(card => card.id === id).type !== 'power') out.push(`${path}.Power: '${id}' must be a Power`);
    }
    if (row.startingAbility && (!Number.isInteger(row.startingAbility.count) || row.startingAbility.count < 1 || row.startingAbility.count > 2 || !Array.isArray(row.startingAbility.roles) || row.startingAbility.roles.length !== row.startingAbility.count || new Set(row.startingAbility.roles).size !== row.startingAbility.count || row.startingAbility.roles.some(role => !ids.includes(role)))) out.push(`${path}.startingAbility: count must match distinct recipe slots`);
    if (row.weaponInfusion) {
      const rule = row.weaponInfusion;
      if (!Array.isArray(rule.tags) || rule.tags.some(tag => !(source.nodes || []).some(node => node.id === tag))) out.push(`${path}.weaponInfusion.tags: must name registered tags`);
      if (!Array.isArray(rule.components) || !rule.components.length || rule.components.some(part => !['frost'].includes(part?.type) || !Number.isFinite(part.amount) || part.amount < 0)) out.push(`${path}.weaponInfusion.components: requires non-negative Cold amounts`);
      if (!Array.isArray(rule.buildup) || rule.buildup.some(part => part?.status !== 'frost' || !Number.isFinite(part.amount) || part.amount < 0)) out.push(`${path}.weaponInfusion.buildup: requires non-negative Frost amounts`);
    }
  }
  for (const cls of classes) {
    const choices = subclassOptions(source, cls.id);
    if (choices.length !== 2) out.push(`${cls.id}: requires exactly two opening subclasses`);
    if (choices.filter(row => row.default === true).length !== 1) out.push(`${cls.id}: requires one default opening subclass`);
  }
  const cfg = source.subclassOpeningRules;
  if (!cfg || cfg.basicAttackCount + cfg.basicGuardCount !== 4 || !Number.isInteger(cfg.basicAttackCount) || cfg.basicAttackCount < 0 || !Number.isInteger(cfg.basicGuardCount) || cfg.basicGuardCount < 0 || !['abilityCard','startingSignatureCard'].includes(cfg.baseClassCard)) out.push('subclassOpeningRules: requires four basics and an explicit base-class card field');
  return out;
}

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
  const face = resolveCard(registries, { cardId, abilityRank });
  return Object.entries(face.requirements?.attributes || {}).every(([attribute, minimum]) => (run.attributes?.[attribute] || 0) >= minimum);
}

export function subclassAbilityRole(registries, cardId) {
  const card = applyCombatExpansionMartial(resolveCard(registries, { cardId, abilityRank: 1 }));
  const profile = combatProfileFor(card);
  return { smash: 'Smash', counter: 'Counter', sweep: 'Sweep' }[profile.maneuver] || (card.type === 'skill' ? 'Skill' : null);
}

/** Full instance-ready birth recipe; never mutates the preview or live run. */
export function subclassDeckPreview(registries, run, { startingAbilityRefs = [], startingAbilityIds = undefined, settings = {} } = {}) {
  if (startingAbilityIds !== undefined) {
    const plan = startingAbilityPlan(registries, run, settings);
    if (!Array.isArray(startingAbilityIds) || startingAbilityIds.length > (plan?.count || 0)) throw new Error('Choose abilities that fit the opening subclass slots.');
    const choices = new Map((plan?.choices || []).map(card => [card.id, card]));
    if (startingAbilityIds.some(id => !choices.has(id)) || new Set(startingAbilityIds.map(id => choices.get(id).abilityFamily || id)).size !== startingAbilityIds.length) throw new Error('Choose distinct abilities available for this loadout.');
    if (startingAbilityIds.filter(id => plan.elementIds.includes(id)).length > plan.maxElementPicks) throw new Error(`Choose at most ${plan.maxElementPicks} element spell.`);
    startingAbilityRefs = startingAbilityIds.map(id => startingAbilityRef(plan, id));
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
  add(openingWeaponArtRef(registries, run), 'Weapon Art', 'weaponArt');
  const attackPlan = buildEquippedWeaponCardPlan(registries, run.loadout, run.class, { attackSlotCount: cfg.basicAttackCount });
  for (const slot of attackPlan.slots) add({ cardId: slot.cardId, equipmentRole: 'attack', profileId: slot.profileId,
    equipmentAttackSlotId: slot.equipmentAttackSlotId, equipmentPlanFingerprint: attackPlan.fingerprint,
    ...(slot.sourceHand ? { sourceHand: slot.sourceHand } : {}), ...(slot.weaponId ? { weaponId: slot.weaponId } : {}) }, 'Strike', 'basic');
  const guard = equipmentKitPlan(registries, run.loadout, run.class).find(row => row.role === 'guard');
  for (let i = 0; i < cfg.basicGuardCount; i++) add({ cardId: guard.profile.baseCardId, equipmentRole: 'guard', profileId: guard.profile.id }, 'Defend', 'basic');
  if (refs.length !== 11) throw new Error('Opening subclass recipe must deal exactly eleven cards.');
  return refs;
}
