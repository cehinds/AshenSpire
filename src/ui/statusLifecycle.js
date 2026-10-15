import { t, tFull } from './strings.js';
import { combatStatusRules as defaultStatusRules } from '../content/combatStatusRules.js';

/** Explain the registered rules without inferring a buff's lifetime from its name. */
export function statusLifecycleText(def, context = {}) {
  // Stances share the tooltip-token resolver but do not use status decay.
  if (!def.stackMode) return '';
  const { foundation = false, combatExpansionVersion } = context;
  // Match the active-grant interpreter's rule selection; v2 handles these
  // before either legacy stackMode or foundation application stacking.
  const rules = context.combatStatusRules || context.combatExpansionRules?.statuses || defaultStatusRules;
  const activeRule = Object.values(rules.statuses).find(rule => rule.activeStatus === def.id);
  if (activeRule && combatExpansionVersion === 2) {
    return [tFull('status.lifecycle.expandedStacking', { cap: activeRule.cap }),
      decayText(def, t('status.lifecycle.stackTotal')),
      typeof def.decay === 'object' && Number.isFinite(def.decay?.duration)
        ? tFull('status.lifecycle.expandedTimer') : ''].filter(Boolean).join(' ');
  }
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
  const legacy = `${stacking} ${decayText(def, value)}`;
  // Definition-only inspection has no fight version. Name both rule sets
  // rather than silently treating a v2 active status as a legacy meter.
  return activeRule && combatExpansionVersion == null
    ? [tFull('status.lifecycle.classic', { detail: legacy }),
      tFull('status.lifecycle.expanded', { detail: statusLifecycleText(def, { ...context, combatExpansionVersion: 2 }) })].join(' ')
    : legacy;
}

function decayText(def, value) {
  return typeof def.decay === 'object' && Number.isFinite(def.decay?.duration)
    ? tFull('status.lifecycle.timer', { duration: def.decay.duration })
    : def.decay === 'perTurnEnd' ? tFull('status.lifecycle.perTurnEnd', { value })
      : def.decay === 'onConsume' ? tFull('status.lifecycle.onConsume') : tFull('status.lifecycle.noDecay');
}
