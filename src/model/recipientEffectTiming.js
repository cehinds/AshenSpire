import { SETTINGS } from '../content/recipientEffectSettings.js';
import { RECIPIENT_EFFECT_CATEGORIES } from './recipientEffectCategoryQueue.js';

function integerBetween(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function validateCategoryQueues(config) {
  const fields = ['enabled', 'order', 'staggerMs', 'overlapMs', 'maxPerCategory', 'maxGlobal', 'maxPerActor'];
  if (!config || typeof config !== 'object' || Object.keys(config).length !== fields.length
    || !fields.every(field => Object.hasOwn(config, field))) {
    throw new RangeError('Category queues require exactly the supported settings.');
  }
  const { enabled, order, staggerMs, overlapMs, maxPerCategory, maxGlobal, maxPerActor } = config;
  if (typeof enabled !== 'boolean') throw new RangeError('Category queue enabled must be true or false.');
  if (!Array.isArray(order) || order.length !== RECIPIENT_EFFECT_CATEGORIES.length
    || !RECIPIENT_EFFECT_CATEGORIES.every(category => order.includes(category))) {
    throw new RangeError('Category order must contain each effect category once.');
  }
  if (!maxPerCategory || Object.keys(maxPerCategory).length !== RECIPIENT_EFFECT_CATEGORIES.length) {
    throw new RangeError('Category queue capacity must be set for each effect category.');
  }
  return {
    enabled,
    order: [...order],
    staggerMs: integerBetween(staggerMs, 0, 1000, 'Category start stagger'),
    overlapMs: integerBetween(overlapMs, 0, 200, 'Category transition overlap'),
    maxPerCategory: Object.fromEntries(RECIPIENT_EFFECT_CATEGORIES.map(category => [
      category, integerBetween(maxPerCategory[category], 1, 12, `Capacity for ${category}`),
    ])),
    maxGlobal: integerBetween(maxGlobal, 1, 12, 'Global category capacity'),
    maxPerActor: integerBetween(maxPerActor, 1, 12, 'Actor category capacity'),
  };
}

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
  const timing = { scope, maxConcurrent, gapMs, overlapMs, opacity };
  if (input.categoryQueues !== undefined) timing.categoryQueues = validateCategoryQueues(input.categoryQueues);
  return timing;
}

export function ReadRecipientEffectTiming(settings = SETTINGS) {
  const { motion, layering } = settings;
  return ValidateRecipientEffectTiming({
    scope: motion.resultQueueScope,
    maxConcurrent: motion.resultMaxConcurrent,
    gapMs: motion.resultGapMs,
    overlapMs: motion.resultOverlapMs,
    opacity: layering.opacity.global,
    categoryQueues: motion.categoryQueues,
  });
}
