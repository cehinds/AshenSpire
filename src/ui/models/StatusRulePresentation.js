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
  switch (statusDef.stackMode) {
    case 'add': return 'Applications add stacks.';
    case 'refresh': {
      const base = 'Keeps the higher stack count.';
      return statusDef.decay && typeof statusDef.decay === 'object' && positiveInteger(statusDef.decay.duration)
        ? `${base} Reapplying resets the duration.`
        : base;
    }
    case 'unique': return 'Remains at 1 stack.';
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

function foundationStackingText(rule) {
  if (!known(rule.mode)) return null;
  const cap = rule.cap === undefined ? 99 : rule.cap;
  if (!positiveInteger(cap)) return null;
  const capText = ` Capped at ${cap}.`;
  switch (rule.mode) {
    case 'add': return `Applications add together.${capText}`;
    case 'refresh': return `Keeps the higher application value.${capText}${rule.refresh === false ? ' Reapplication keeps the existing expiry.' : ' Reapplication resets the expiry.'}`;
    case 'replace': return `Each application replaces the previous one.${capText}`;
    case 'strongest': return `Uses the strongest active application.${capText}`;
    case 'independent': return `Applications remain separate and add together.${capText}`;
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
