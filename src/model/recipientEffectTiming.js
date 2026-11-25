import { SETTINGS } from '../content/recipientEffectSettings.js';

/** Validate everything that can be changed through the effects timing panel. */
export function ValidateRecipientEffectTiming(input) {
  const { scope, maxConcurrent, gapMs, overlapMs, opacity } = input || {};
  if (scope !== 'battlefield' && scope !== 'recipient') throw new RangeError('Scope must be battlefield or recipient.');
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 4) {
    throw new RangeError('Maximum concurrent effects must be an integer between 1 and 4.');
  }
  if (!Number.isFinite(gapMs) || gapMs < 0 || gapMs > 1000) throw new RangeError('Gap must be between 0 and 1000 ms.');
  if (!Number.isFinite(overlapMs) || overlapMs < 0 || overlapMs > 200) throw new RangeError('Overlap must be between 0 and 200 ms.');
  if (gapMs > 0 && overlapMs > 0) throw new RangeError('Use a gap or an overlap, with the other set to zero.');
  if (maxConcurrent === 1 && overlapMs > 0) throw new RangeError('Overlap requires at least two concurrent effects.');
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new RangeError('Opacity must be between 0 and 1.');
  return { scope, maxConcurrent, gapMs, overlapMs, opacity };
}

export function ReadRecipientEffectTiming(settings = SETTINGS) {
  const { motion, layering } = settings;
  return ValidateRecipientEffectTiming({
    scope: motion.resultQueueScope,
    maxConcurrent: motion.resultMaxConcurrent,
    gapMs: motion.resultGapMs,
    overlapMs: motion.resultOverlapMs,
    opacity: layering.opacity.global,
  });
}
