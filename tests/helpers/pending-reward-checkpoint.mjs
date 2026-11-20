// The saved shape of the retired legacy reward door's `run.pendingReward` checkpoint. Nothing writes it any more; the
// load door still validates and tolerates it in old saves, and these fixtures build one to prove that.
export function pendingRewardCheckpoint(rewards, { source, after }) {
  return {
    schemaVersion: 1,
    source,
    after,
    rewards: structuredClone(rewards),
    states: rewards.smithingStoneReceipt?.amount > 0 ? { smithingStone: 'taken' } : {},
    chosenCardId: null,
    chosenRelicId: null,
    chosenDraftCardIds: {},
    chosenDraftNodeIds: {},
  };
}
