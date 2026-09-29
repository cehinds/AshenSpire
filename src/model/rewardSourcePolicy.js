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
