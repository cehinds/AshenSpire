// Pure, content-driven summary of a status's lifetime and stacking rules.
// This is explanatory UI copy only; execution remains in engine/statuses.js.

const known = (value) => typeof value === 'string' && value.length > 0;
const positiveInteger = (value) => Number.isInteger(value) && value > 0;

function standardDurationText(decay) {
  if (decay === 'none') return 'No timed expiry; may be consumed or removed.';
  if (decay === 'perTurnEnd') return 'Loses 1 stack at the end of its owner’s turn.';
  if (decay === 'onConsume') return 'Lasts until consumed.';
  if (decay && typeof decay === 'object' && positiveInteger(decay.duration)) {
    return `Expires after ${decay.duration} owner turns; stacks stay until expiry.`;
  }
  return null;
}

function standardStackingText(statusDef) {
  const timedExpiry = statusDef.decay && typeof statusDef.decay === 'object'
    && positiveInteger(statusDef.decay.duration);
  const reapplyText = timedExpiry ? ' Reapplying resets the duration.' : '';
  switch (statusDef.stackMode) {
    case 'add': return `Applications add stacks.${reapplyText}`;
    case 'refresh': return `Keeps the higher stack count.${reapplyText}`;
    case 'unique': return `Remains at 1 stack.${reapplyText}`;
    default: return null;
  }
}

function foundationDurationText(rule) {
  if (rule.duration === undefined || rule.duration === null) return 'No timed expiry is defined.';
  if (!positiveInteger(rule.duration)) return null;
  const clock = rule.clock || 'ownerTurnEnd';
  if (!['ownerTurnStart', 'ownerTurnEnd'].includes(clock)) return null;
  const point = clock === 'ownerTurnStart' ? 'start' : 'end';
  return `Applications expire after ${rule.duration} turns at the ${point} of their owner’s turn.`;
}

function hasFoundationTimedExpiry(rule) {
  const clock = rule.clock || 'ownerTurnEnd';
  return positiveInteger(rule.duration) && ['ownerTurnStart', 'ownerTurnEnd'].includes(clock);
}

function foundationStackingText(rule) {
  if (!known(rule.mode)) return null;
  const cap = rule.cap === undefined ? 99 : rule.cap;
  if (!positiveInteger(cap)) return null;
  const timedExpiry = hasFoundationTimedExpiry(rule);
  const capText = ` Capped at ${cap}.`;
  switch (rule.mode) {
    case 'add': return `Applications add together.${capText}${timedExpiry ? (rule.refresh === false ? ' Reapplication keeps the existing expiry.' : ' Reapplication resets the expiry.') : ''}`;
    case 'refresh': return `Keeps the existing value on reapplication.${capText}${timedExpiry ? (rule.refresh === false ? ' Reapplication keeps the existing expiry.' : ' Reapplication resets the expiry.') : ''}`;
    case 'replace': return `Replaces prior applications with the latest value.${capText}${timedExpiry ? ' Reapplication starts a fresh expiry.' : ''}`;
    case 'strongest': return `Uses the strongest application, with each source replacing its own prior value.${capText}${timedExpiry ? ' A source’s reapplication starts a fresh expiry.' : ''}`;
    case 'independent': return `Adds values across sources; each source’s reapplication replaces its prior value.${capText}${timedExpiry ? ' A source’s reapplication starts a fresh expiry.' : ''}`;
    case 'unique': return 'Keeps one application.';
    default: return null;
  }
}

/**
 * Derive concise lifetime and stacking copy from the same rule record the
 * status engine reads. `foundation` selects the optional per-application
 * policy only for foundation combat; it never conflates that policy with the
 * ordinary status `stackMode`.
 *
 * @returns {{ durationText: string|null, stackingText: string|null }}
 */
export function statusRulePresentation(statusDef, { foundation = false } = {}) {
  if (!statusDef || typeof statusDef !== 'object') return { durationText: null, stackingText: null };

  if (foundation && statusDef.stacking && typeof statusDef.stacking === 'object') {
    return {
      durationText: foundationDurationText(statusDef.stacking),
      stackingText: foundationStackingText(statusDef.stacking),
    };
  }

  return {
    durationText: standardDurationText(statusDef.decay),
    stackingText: standardStackingText(statusDef),
  };
}
