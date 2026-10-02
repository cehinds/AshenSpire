// Decide which already-rolled reward types a source presents. The caller
// checkpoints this result, so changing Settings cannot rewrite an open offer.
export function configuredRewardOffer(rewards, source, enabled) {
  const offer = { ...rewards };
  const removeWhenOff = (key, fields) => {
    if (enabled(key)) return;
    for (const field of fields) delete offer[field];
  };
  if (['normal', 'elite', 'boss'].includes(source)) {
    removeWhenOff('rewardBattleCinders', ['cinders']);
    removeWhenOff('rewardBattleCards', ['cardIds', 'cardMissed']);
    removeWhenOff('rewardBattleSkillDrafts', ['skillDrafts']);
    removeWhenOff('rewardBattleClassDrafts', ['classDrafts']);
    removeWhenOff('rewardBattleFlasks', ['flaskId']);
    removeWhenOff('rewardBattleRelics', ['relicId']);
    removeWhenOff('rewardBattleArmaments', ['armamentId']);
    removeWhenOff('rewardLevelCards', ['levelCards']);
  } else if (source === 'treasure') {
    removeWhenOff('rewardTreasureRelics', ['relicId']);
    removeWhenOff('rewardTreasureArmaments', ['armamentId']);
  }
  return offer;
}

/**
 * pendingRewardCheckpoint(rewards, { source, after }) → the `run.pendingReward`
 * a reward door saves before it shows its menu, so a reload remounts the same
 * offer (main.js beginPendingReward). A Smithing Stone receipt was paid when
 * it was rolled, so its row starts Taken.
 */
export function pendingRewardCheckpoint(rewards, { source, after }) {
  return {
    schemaVersion: 1,
    source,
    after,
    rewards: structuredClone(rewards),
    states: rewards.smithingStoneReceipt?.amount > 0 ? { smithingStone: 'taken' } : {},
    chosenCardId: null,
    chosenDraftCardIds: {},
    chosenDraftNodeIds: {},
  };
}

/**
 * settleTreasureNode(run, completeJourneyNode) — a map treasure's node is done
 * the moment its chest opens. On a World Journey its atlas point is completed
 * HERE, before the door checkpoints its offer (SPEC §15.4): the checkpoint's
 * Continue only persists and returns to the map, so a node left open now
 * would stay open after a reload. A classic map has no journey node.
 */
export function settleTreasureNode(run, completeJourneyNode) {
  if (run.journey) completeJourneyNode(run.journey);
}
