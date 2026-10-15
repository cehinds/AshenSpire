import { t, tFull } from './strings.js';

/** Explain the registered rules without inferring a buff's lifetime from its name. */
export function statusLifecycleText(def, { foundation = false } = {}) {
  // Stances share the tooltip-token resolver but do not use status decay.
  if (!def.stackMode) return '';
  const meter = Boolean(def.meter || def.proc);
  const value = t(meter ? 'status.lifecycle.buildup'
    : def.instancePresentation?.valueToken === 'percent' ? 'status.lifecycle.effectValue' : 'status.lifecycle.stackTotal');
  const rule = foundation && !meter ? def.stacking : null;
  if (rule) {
    const stacking = tFull(`status.lifecycle.foundation.${rule.mode}`, { value, cap: rule.cap });
    const duration = rule.duration == null ? tFull('status.lifecycle.noDecay')
      : tFull('status.lifecycle.applicationTimer', {
        duration: rule.duration,
        clock: t(rule.clock === 'ownerTurnStart' ? 'status.lifecycle.turnStart' : 'status.lifecycle.turnEnd'),
      });
    const timer = rule.duration != null && ['add', 'refresh'].includes(rule.mode)
      ? tFull(rule.refresh === false ? 'status.lifecycle.keepTimer' : 'status.lifecycle.resetTimer') : '';
    return [stacking, duration, timer].filter(Boolean).join(' ');
  }
  const stacking = tFull(`status.lifecycle.${def.stackMode}`, { value });
  const duration = typeof def.decay === 'object' && Number.isFinite(def.decay?.duration)
    ? tFull('status.lifecycle.timer', { duration: def.decay.duration })
    : def.decay === 'perTurnEnd' ? tFull('status.lifecycle.perTurnEnd', { value })
      : def.decay === 'onConsume' ? tFull('status.lifecycle.onConsume') : tFull('status.lifecycle.noDecay');
  return `${stacking} ${duration}`;
}
