import { rederivePools } from './levelup.js';
import { syncFlaskGrowth } from './flaskgrowth.js';
import { pendingClassMilestones, finishClassMilestone, expandedProgression, milestoneReceiptId, capRunClassGrants, classRewardBudget, runGrantsTaken, RUN_BUDGET_KINDS } from './classMilestones.js';
import { abilityRankAt } from './abilityGrades.js';
import { abilityOfferPool } from './abilityOffers.js';
import { equipmentRequirementReceipt, carriedIds } from './loadout.js';
import { createCardInstance } from './state.js';

export function classMilestoneOptions(registries, run, kind, level, meta = {}) {
  const source = registries.masterySource || registries;
  const open = (ref, kinds) => {
    const rows = (source.classMastery || []).filter(row => row.ref === ref && kinds.includes(row.kind));
    return !rows.length || rows.some(row => row.classId === run.class && row.level <= level);
  };
  if (kind === 'attribute') return source.balance.progression.classAttributes[run.class] || [];
  if (kind === 'feat') return source.classSkillFeats.filter(feat => feat.skillId === `class:${run.class}` && feat.minLevel <= level && open(feat.id, ['feat']) && !(run.skillFeats || []).includes(feat.id)).map(feat => feat.id);
  if (kind === 'cards') return source.classes.get(run.class).cardPool.filter(id => open(id, ['cards']));
  if (kind === 'relic') return source.relics.all().filter(relic => open(relic.id, ['relic']) && !(run.relics || []).includes(relic.id) && !['cursed','starter'].includes(relic.rarity)).map(relic => relic.id);
  if (kind === 'armory') {
    const carried = new Set(carriedIds(run.loadout));
    const known = new Set(meta.discoveredArmaments || []), unlocked = new Set(meta.unlocked || []);
    return [...source.equipment.armaments.map(piece => ({ piece, ref: `armament/${piece.id}` })),
      ...source.equipment.armour.filter(piece => piece.classId === run.class || piece.sharedSet).map(piece => ({ piece, ref: `armor/${piece.classId}/${piece.id}` }))]
      .filter(({piece,ref}) => (!ref.startsWith('armament/') || !carried.has(piece.id)) && (!ref.startsWith('armor/') || !(run.loadout.boughtArmour || []).some(row => row.classId === piece.classId && row.id === piece.id)) && open(ref, ['weapon','armament']) && (!piece.unlock || unlocked.has(piece.unlock))
        && equipmentRequirementReceipt(source, piece, run.attributes || {}).ok
        && (ref.startsWith('armor/') || piece.unlock || known.has(piece.id) || (piece.tags || []).includes('basic') || !piece.discoveryRequired))
      .map(row => row.ref);
  }
  return [];
}

export function rollClassMilestoneRewards(registries, rng, run, { banked = 0, meta = {} } = {}) {
  if (!expandedProgression(run) || run.classUnequipped) return [];
  const current = run.skills?.[`class:${run.class}`]?.level || 0;
  capRunClassGrants(registries, run, run.class);
  const waiting = pendingClassMilestones(run);
  for (let level = current + 1; level <= current + banked; level++) for (const [kind, levels] of Object.entries(registries.balance.progression.cadence)) if (levels.includes(level)) waiting.push({ id: milestoneReceiptId(run.class,level,kind), kind, classId: run.class, level });
  run.classMilestoneOffers ||= {};
  return waiting.flatMap(grant => {
    if (run.classMilestoneOffers[grant.id]) return [structuredClone(run.classMilestoneOffers[grant.id])];
    let options = classMilestoneOptions(registries,run,grant.kind,grant.level,meta), abilityRanks;
    if (!options.length) return [];
    if (grant.kind === 'cards') {
      // A class grant stays in the class catalogue. School lesson libraries
      // remain exclusive to the ability-skill reward.
      const source = registries.masterySource || registries;
      options = options.filter(id => {
        const card = source.cards.get(id);
        if (!card.abilityKind) return true;
        const skill = card.abilityKind === 'spell' ? 'item:magic-focus' : 'combatManeuvers';
        return abilityOfferPool(registries,run,skill,abilityRankAt(registries,run.skills?.[skill]?.level || 1),{classLevel:grant.level}).includes(id);
      });
      if (!options.length) return [];
      const normalPool = options;
      options = rng.shuffle('cardRewards', normalPool).slice(0,3);
      abilityRanks = options.map(id => {
        const card = source.cards.get(id), skill = card.abilityKind === 'spell' ? 'item:magic-focus' : 'combatManeuvers';
        return card.gradeProfiles ? abilityRankAt(registries,run.skills?.[skill]?.level || 1) : null;
      });
      const skill = registries.balance.progression.classSkills[run.class].find(id => ['item:magic-focus','combatManeuvers'].includes(id));
      const grade = abilityRankAt(registries,run.skills?.[skill]?.level || 1);
      const intel = Math.max(0,run.attributes?.intelligence || 0);
      if (grade < 5 && rng.float('cardRewards') < Math.min(1,intel * registries.balance.progression.ability.intelligenceChance)) {
        const legal = Array.from({length:Math.min(3,5-grade)},(_,i)=>grade+i+1).map(rank=>({rank,ids:abilityOfferPool(registries,run,skill,rank,{classLevel:grant.level}).filter(id=>normalPool.includes(id))})).filter(row=>row.ids.length);
        if (legal.length) { const chosen = rng.pick('cardRewards',legal); const other = chosen.ids.filter(id=>!options.includes(id)); options.push(rng.pick('cardRewards',other.length?other:chosen.ids)); abilityRanks.push(chosen.rank); }
      }
    } else options = grant.kind === 'attribute' ? options : rng.shuffle('cardRewards',options).slice(0,3);
    const offer = { intelligenceSnapshot: Math.max(0,run.attributes?.intelligence || 0), rngAfter:rng.getCounters(), receiptId: grant.id, classId: run.class, skillId: `class:${run.class}`, level: grant.level, requiredLevel: grant.level, rewardKind: grant.kind, options, ...(abilityRanks ? { abilityRanks, choiceIds:options.map((id,index) => Number.isInteger(abilityRanks[index]) ? `${id}@${abilityRanks[index]}` : id) } : {}) };
    run.classMilestoneOffers[grant.id] = structuredClone(offer);
    return [offer];
  });
}

// Commit only a generated choice whose original grant remains pending. The
// caller supplies equipment collection so its existing capacity rules apply.
export function claimClassMilestoneReward(registries, run, receiptId, selection, { collectEquipment = null, meta = {} } = {}) {
  const offer = run.classMilestoneOffers?.[receiptId];
  const index = (offer?.choiceIds || offer?.options || []).indexOf(selection);
  const selectedId = offer?.options?.[index];
  if (!offer || index < 0 || offer.classId !== run.class || (run.skills?.[offer.skillId]?.level || 0) < offer.requiredLevel || !pendingClassMilestones(run).some(grant => grant.id === receiptId)) return false;
  if (!classMilestoneOptions(registries,run,offer.rewardKind,offer.level,meta).includes(selectedId)) return false;
  if (RUN_BUDGET_KINDS.includes(offer.rewardKind) && runGrantsTaken(run,offer.rewardKind) >= (classRewardBudget(registries,run.skills?.[offer.skillId]?.level || 0)[offer.rewardKind] || 0)) return false;
  let instanceId = null;
  if (offer.rewardKind === 'armory') {
    if (!collectEquipment || collectEquipment(selectedId) === false) return false;
  } else if (offer.rewardKind === 'cards') {
    const inst = createCardInstance(selectedId); instanceId = inst.instanceId;
    const rank = offer.abilityRanks?.[index];
    if (Number.isInteger(rank)) inst.abilityRank = rank;
    inst.rewardReceiptId = receiptId;
    run.deck.push(inst);
  } else if (offer.rewardKind === 'relic') {
    run.relics.push(selectedId);
    syncFlaskGrowth(registries,run);
  } else if (offer.rewardKind === 'feat') {
    run.skillFeats = [...(run.skillFeats || []), selectedId];
  } else if (offer.rewardKind === 'attribute') {
    run.attributes[selectedId] += 1;
    run.skillAttributePoints = (run.skillAttributePoints || 0) + 1;
    rederivePools(registries,run,'class milestone attribute');
  }
  return finishClassMilestone(run,receiptId,{ id: selectedId, choiceId: selection, ...(instanceId ? { instanceId } : {}), abilityRank: offer.abilityRanks?.[index] ?? null });
}
