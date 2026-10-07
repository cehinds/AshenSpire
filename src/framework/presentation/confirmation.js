// src/framework/presentation/confirmation.js — the confirmation grammar
// (framework contract: Modal and confirmation grammar).
//
// One destructive transition receives exactly one destructive confirmation.
// The flow is a pure state machine over injected hooks so combat, armoury and
// tests all drive the same code: openConfirmation renders SharedConfirmation,
// focus hooks own preserve/restore, execute owns atomicity.

export class ConfirmationError extends Error {
  constructor(message) { super(`confirmation: ${message}`); this.name = 'ConfirmationError'; }
}

/**
 * requestAction(registries, action, hooks) — action: {id, policyId?, subject,
 * revalidate(), execute()}; hooks: {openConfirmation(policy, subject),
 * preserveFocus(), restoreFocus(token), focusResult()}.
 * Returns {executed, level, confirmations} — confirmations counts opened
 * dialogs so the exactly-one rule is observable by tests and validation.
 */
export async function requestAction(registries, action, hooks) {
  const policy = action.policyId
    ? registries.confirmation.require(action.policyId)
    : registries.confirmation.policyForAction(action.id);

  if (policy.level === 'NONE') {
    await action.execute();
    return { executed: true, level: policy.level, confirmations: 0 };
  }

  const focusToken = hooks.preserveFocus();
  const result = await hooks.openConfirmation(policy, action.subject);
  if (result !== 'CONFIRM') {
    hooks.restoreFocus(focusToken);
    return { executed: false, level: policy.level, confirmations: 1 };
  }
  if (action.revalidate && !(await action.revalidate())) {
    hooks.restoreFocus(focusToken);
    return { executed: false, level: policy.level, confirmations: 1, stale: true };
  }
  await action.execute(); // the action owns executing atomically
  if (hooks.focusResult) hooks.focusResult();
  else hooks.restoreFocus(focusToken);
  return { executed: true, level: policy.level, confirmations: 1 };
}
