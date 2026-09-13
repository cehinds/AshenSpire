import { behaviorModel } from './BehaviorModel.js';
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const DEFAULT_PROMPTS = Object.freeze({
  pointer: 'CLICK TO CONTINUE',
  touch: 'TAP TO CONTINUE',
  keyboard: 'PRESS ENTER OR SPACE',
  controller: 'PRESS A / CROSS OR START / MENU',
});

export const TITLE_ENTRANCE_TIMING = Object.freeze({
  lightUpMs: 560,
  fadeMs: 880,
  holdDefault: '0.5s',
  holdDurations: Object.freeze({ '0s': 0, '0.3s': 300, '0.5s': 500, '1s': 1000, '2s': 2000 }),
});

function particles(count = 7) {
  const total = Math.max(0, Math.min(12, Math.floor(Number(count) || 0)));
  return Array.from({ length: total }, (_, index) => Object.freeze({
    id: `ash-${index + 1}`,
    leftPct: 9 + ((index * 17) % 82),
    delayMs: (index * 1130) % 6200,
    durationMs: 7600 + (index % 4) * 1400,
    sizePx: 1 + (index % 3),
  }));
}
export function startupGateModel({
  inputFamily = 'keyboard',
  wordmark = 'ASHEN SPIRE',
  subtitle = 'A ROGUELIKE DECKBUILDER',
  overline = '',
  prompts = DEFAULT_PROMPTS,
  particleCount = 7,
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
