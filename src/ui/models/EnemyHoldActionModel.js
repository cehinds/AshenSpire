const FLOW_STATES = Object.freeze(['battle', 'chooser', 'inspector', 'closed']);

/** enemyHoldActionStep(state, action, options) keeps the modal flow explicit. */
export function enemyHoldActionStep(state, action, { hasCard = true, playAllowed = true } = {}) {
  if (!FLOW_STATES.includes(state)) throw new Error(`Unknown enemy hold state '${state}'`);
  const stay = () => Object.freeze({ state, effect: null });
  if (state === 'closed') return stay();
  if (state === 'battle' && action === 'hold') {
    return Object.freeze({ state: hasCard ? 'chooser' : 'inspector', effect: hasCard ? 'open-chooser' : 'inspect' });
  }
  if (state === 'chooser' && action === 'inspect') return Object.freeze({ state: 'inspector', effect: 'inspect' });
  if (state === 'inspector' && action === 'back') return Object.freeze({ state: 'chooser', effect: 'open-chooser' });
  if (state === 'chooser' && action === 'play') {
    return playAllowed ? Object.freeze({ state: 'closed', effect: 'play' }) : stay();
  }
  if ((state === 'chooser' || state === 'inspector') && ['back', 'exit', 'close'].includes(action)) {
    return Object.freeze({ state: 'closed', effect: 'close-flow' });
  }
  return stay();
}

/** A fresh, ordered reason for refusing Play from the chooser. */
export function enemyHoldPlayReason(state) {
  if (!state.active || state.combatEnded) return 'Combat has ended.';
  if (state.busy || state.phase !== 'player') return 'Wait for your turn.';
  if (state.selectedInstanceId !== state.instanceId || state.flaskSelected) return 'The selected card changed.';
  if (state.queued) return 'Queued cards cannot be played from this action.';
  if (state.pendingDiscard) return 'Resolve the pending discard first.';
  if (!state.enemyAlive) return 'That enemy is no longer alive.';
  if (!state.actionEnabled) return state.actionReason || 'This card cannot be played right now.';
  if (!state.legalTarget) return 'This card cannot target that enemy.';
  return '';
}

/** Restore only the captured card that is still the active, playable selection. */
export function canRestoreEnemyHoldCard(state) {
  const currentInstanceId = state.selectedInstanceId || state.selfArmInstanceId || null;
  return Boolean(state.instanceId)
    && !state.superseded && !state.busy && !state.combatEnded && state.phase === 'player'
    && !state.flaskSelected
    && (!currentInstanceId || currentInstanceId === state.instanceId)
    && !state.queued && state.inHand;
}
