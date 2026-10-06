import { abilityKindForSkill, abilityRankAt, applyAbilityGrade } from './abilityGrades.js';
import { activeIn, HAND_SLOT_IDS } from './zones.js';

export function abilityOfferPool(registries, run, skillId, rank, { classLevel = null } = {}) {
  const rules = registries.balance.progression;
  const lessons = new Set(rules.lessons[skillId] || []);
  const source = registries.masterySource || registries;
  const level = classLevel ?? run.skills?.[`class:${run.class}`]?.level ?? 0;
  const refs = new Set([...source.classes.get(run.class).cardPool, ...lessons]);
  const held = Object.values(HAND_SLOT_IDS).map(slot => activeIn(run.loadout, slot)).filter(Boolean);
  return [...refs].filter(id => {
    if (!source.cards.has(id)) return false;
    const card = source.cards.get(id);
    if (card.abilityKind !== abilityKindForSkill(skillId) || !card.gradeProfiles?.some(row => row.rank === rank)) return false;
    const gates = (source.classMastery || []).filter(row => row.kind === 'cards' && row.ref === id);
    if (!lessons.has(id) && gates.length && !gates.some(row => row.classId === run.class && row.level <= level)) return false;
    const exact = (source.equipment.cardEquipmentExceptions || []).filter(row => row.cardId === id);
    if (exact.length && !exact.some(row => held.includes(row.weaponId))) return false;
    if (card.tags?.includes('source:weapon') && !exact.length) {
      const schools = new Set((source.nodes || []).filter(node => node.parentId === 'card').map(node => node.id));
      if (!held.some(pieceId => source.equipment.armaments.find(piece => piece.id === pieceId)?.tags?.some(tag => schools.has(tag) && card.tags.includes(tag)))) return false;
    }
    const face = applyAbilityGrade(card, rank);
    return Object.entries(face.requirements?.attributes || {}).every(([attribute, minimum]) => (run.attributes?.[attribute] || 0) >= minimum);
  });
}

// An offer is an immutable receipt. Persist it when generated; retries return
// the stored choices without reading INT or advancing any random stream.
export function rollAbilityOffer(registries, rng, run, { skillId, level, gradeLevel = level, offerId, classLevel = null } = {}) {
  run.abilityOffers ||= {};
  if (run.abilityOffers[offerId]) return structuredClone(run.abilityOffers[offerId]);
  if (!offerId) throw new Error('Ability offer requires a stable receipt ID');
  const rules = registries.balance.progression.ability;
  const rank = abilityRankAt(registries, gradeLevel);
  const pool = abilityOfferPool(registries, run, skillId, rank, { classLevel });
  if (pool.length < rules.draftSize) return null;
  const owned = new Set([...(run.deck || []), ...(run.sideboard || [])].map(inst => `${inst.cardId}:${inst.abilityRank ?? 0}`));
  const before = rng.getCounters();
  const source = registries.masterySource || registries;
  const familyPool = [...new Map(pool.map(id => [source.cards.get(id).abilityFamily || id,id])).values()];
  if (familyPool.length < rules.draftSize) return null;
  const fresh = familyPool.filter(id => !owned.has(`${id}:${rank}`));
  const ordered = [...rng.shuffle('cardRewards', fresh), ...rng.shuffle('cardRewards', familyPool.filter(id => !fresh.includes(id)))];
  const cardIds = ordered.slice(0, rules.draftSize), abilityRanks = cardIds.map(() => rank);
  const intelligenceSnapshot = Math.max(0, run.attributes?.intelligence || 0);
  let bonusRank = null;
  if (rank < 5 && rng.float('cardRewards') < Math.min(1, intelligenceSnapshot * rules.intelligenceChance)) {
    const legal = Array.from({ length: Math.min(rules.bonusRankDepth, 5 - rank) }, (_, i) => rank + i + 1)
      .map(grade => ({ grade, pool: abilityOfferPool(registries, run, skillId, grade, { classLevel }) })).filter(row => row.pool.length);
    if (legal.length) {
      const selected = rng.pick('cardRewards', legal);
      bonusRank = selected.grade;
      const others = selected.pool.filter(id => !cardIds.includes(id));
      cardIds.push(rng.pick('cardRewards', others.length ? others : selected.pool));
      abilityRanks.push(bonusRank);
    }
  }
  const choiceIds = cardIds.map((id, index) => `${id}@${abilityRanks[index]}`);
  const offer = { skillId, level, gradeLevel, offerId, cardIds, choiceIds, abilityRanks, intelligenceSnapshot, bonusRank,
    rngBefore: before, rngAfter: rng.getCounters(), copyOptions: cardIds.map((id, i) => owned.has(`${id}:${abilityRanks[i]}`)) };
  run.abilityOffers[offerId] = structuredClone(offer);
  return offer;
}
