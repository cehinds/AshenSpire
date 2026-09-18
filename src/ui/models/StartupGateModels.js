import { behaviorModel } from './BehaviorModel.js';
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';
import { uiConfig } from '../../config/generated/ui.js';
import { thaw } from '../../config/authored.js';

const GATE = uiConfig.presentation.startupGate;

const DEFAULT_PROMPTS = Object.freeze(thaw(GATE.components.prompts));

export const TITLE_ENTRANCE_TIMING = Object.freeze({
  ...thaw(GATE.motion.entrance),
  holdDurations: Object.freeze(thaw(GATE.motion.entrance.holdDurations)),
});

function particles(count = GATE.motion.particles.defaultCount) {
  const p = GATE.motion.particles;
  const total = Math.max(0, Math.min(p.maxCount, Math.floor(Number(count) || 0)));
  return Array.from({ length: total }, (_, index) => Object.freeze({
    id: `${p.idPrefix}${index + 1}`,
    leftPct: p.leftPct.base + ((index * p.leftPct.step) % p.leftPct.span),
    delayMs: (index * p.delayMs.step) % p.delayMs.cycle,
    durationMs: p.durationMs.base + (index % p.durationMs.cycle) * p.durationMs.step,
    sizePx: p.sizePx.base + (index % p.sizePx.cycle),
  }));
}
export function startupGateModel({
  inputFamily = 'keyboard',
  wordmark = 'ASHEN SPIRE',
  subtitle = 'A ROGUELIKE DECKBUILDER',
  overline = '',
  prompts = DEFAULT_PROMPTS,
  particleCount = GATE.motion.particles.defaultCount,
  settings = {},
} = {}) {
  const family = Object.hasOwn(prompts, inputFamily) ? inputFamily : 'keyboard';
  return componentModel(UI.startupGate, {
    variant: family,
    properties: {
      wordmark,
      subtitle,
      overline,
      inputFamily: family,
      prompts: { ...DEFAULT_PROMPTS, ...prompts },
      particles: particles(particleCount),
      entrance: {
        lightUpMs: TITLE_ENTRANCE_TIMING.lightUpMs,
        fadeMs: TITLE_ENTRANCE_TIMING.fadeMs,
        holdMs: Object.hasOwn(TITLE_ENTRANCE_TIMING.holdDurations, settings.titleCityHold)
          ? TITLE_ENTRANCE_TIMING.holdDurations[settings.titleCityHold]
          : TITLE_ENTRANCE_TIMING.holdDurations[TITLE_ENTRANCE_TIMING.holdDefault],
      },
    },
    accessibility: {
      role: 'button',
      label: 'Continue to the Ashen Spire title menu',
      promptLive: 'polite',
    },
    behaviors: [behaviorModel('reveal-title', {
      event: 'input',
      command: 'reveal-title',
      policy: 'consume-first-press',
    })],
  });
}
