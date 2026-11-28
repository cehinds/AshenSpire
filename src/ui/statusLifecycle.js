import { t, UiFullText } from './strings.js';
import { combatStatusRules as defaultStatusRules } from '../content/combatStatusRules.js';
import { resolveStatusPresentationDefinition, coreStatusLifecycle, statusPresentationContext } from '../model/statusPresentation.js';
import { mechanics } from '../framework/data/mechanics.js';
import { ElementStatusUncapped } from '../model/elementIdentityRules.js';

/** Explain the registered rules without inferring a buff's lifetime from its name. */
export function statusLifecycleText(def, context = {}) {
  context = statusPresentationContext(def, context);
  def = resolveStatusPresentationDefinition(def, context);
  // Stances share the tooltip-token resolver but do not use status decay.
  if (!def.stackMode) return '';
  const { foundation = false, combatExpansionVersion } = context;
  const core = coreStatusLifecycle(def, context);
  // Match the active-grant interpreter's rule selection; v2 handles these
  // before either legacy stackMode or foundation application stacking.
  const rules = context.combatStatusRules || context.combatExpansionRules?.statuses || defaultStatusRules;
  const activeRule = Object.values(rules.statuses).find(rule => rule.activeStatus === def.id);
  if (activeRule && combatExpansionVersion === 2 && !core?.overrides) {
    // Element rules (W25): Burn has no cap, so there is no cap to state.
    return [ElementStatusUncapped(context, def.id) ? UiFullText('status.lifecycle.add', { value: t('status.lifecycle.stackTotal') }) : UiFullText('status.lifecycle.expandedStacking', { cap: activeRule.cap }),
      core ? coreDecayText(def, core, t('status.lifecycle.stackTotal')) : decayText(def, t('status.lifecycle.stackTotal')),
      typeof def.decay === 'object' && Number.isFinite(def.decay?.duration)
        ? UiFullText('status.lifecycle.expandedTimer') : ''].filter(Boolean).join(' ');
  }
  const meter = Boolean(def.meter || def.proc);
  const value = t(meter ? 'status.lifecycle.buildup'
    : def.instancePresentation?.valueToken === 'percent' ? 'status.lifecycle.effectValue' : 'status.lifecycle.stackTotal');
  const rule = foundation && !meter ? def.stacking : null;
  if (rule) {
    const stacking = UiFullText(`status.lifecycle.foundation.${rule.mode}`, { value, cap: rule.cap });
    const duration = rule.duration == null ? UiFullText('status.lifecycle.noDecay')
      : UiFullText('status.lifecycle.applicationTimer', {
        duration: rule.duration,
        clock: t(rule.clock === 'ownerTurnStart' ? 'status.lifecycle.turnStart' : 'status.lifecycle.turnEnd'),
      });
    const timer = rule.duration != null && ['add', 'refresh'].includes(rule.mode)
      ? UiFullText(rule.refresh === false ? 'status.lifecycle.keepTimer' : 'status.lifecycle.resetTimer') : '';
    return [stacking, duration, timer, core ? coreDecayText(def, core, value) : ''].filter(Boolean).join(' ');
  }
  const stacking = UiFullText(`status.lifecycle.${def.stackMode}`, { value });
  const legacy = `${stacking} ${core ? coreDecayText(def, core, value) : decayText(def, value)}`;
  // Definition-only inspection has no fight version. Name both rule sets
  // rather than silently treating a v2 active status as a legacy meter.
  return activeRule && combatExpansionVersion == null
    ? [UiFullText('status.lifecycle.classic', { detail: legacy }),
      UiFullText('status.lifecycle.expanded', { detail: statusLifecycleText(def, { ...context, combatExpansionVersion: 2 }) })].join(' ')
    : legacy;
}

function coreDecayText(def, core, value) {
  if (core.clock === 'precisionOwnerTurnStart') return UiFullText('status.lifecycle.corePrecision', {
    decay: mechanics.accuracy.precisionDecayPerTurn,
  });
  if (core.clock === 'stackOwnerTurnStart') return UiFullText('status.lifecycle.coreDecay', {
    value, amount: core.decayAmount, clock: t('status.lifecycle.turnStart'),
  });
  if (core.clock === 'timerOwnerTurnStart') return UiFullText('status.lifecycle.coreTimer', {
    duration: def.decay.duration, clock: t('status.lifecycle.turnStart'),
  });
  return def.decay === 'onConsume' ? UiFullText('status.lifecycle.onConsume') : UiFullText('status.lifecycle.noDecay');
}

function decayText(def, value) {
  return typeof def.decay === 'object' && Number.isFinite(def.decay?.duration)
    ? UiFullText('status.lifecycle.timer', { duration: def.decay.duration })
    : def.decay === 'perTurnEnd' ? UiFullText('status.lifecycle.perTurnEnd', { value })
      : def.decay === 'onConsume' ? UiFullText('status.lifecycle.onConsume') : UiFullText('status.lifecycle.noDecay');
}
