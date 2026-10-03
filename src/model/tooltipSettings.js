import { tooltipHelp } from '../content/tooltipHelp.js';

export function resolveTooltipSettings(settings = {}, policy = tooltipHelp) {
  const value = key => {
    const row = policy.settings.find(row => row.key === key);
    const stored = settings[key];
    return row.type === 'choice' ? (Object.hasOwn(policy.delays, stored) ? stored : row.def)
      : (typeof stored === 'boolean' ? stored : row.def);
  };
  const delay = policy.delays[value('tooltipDelay')];
  return { hoverEnabled: value('hoverTooltips'), open: delay, handover: delay, focus: policy.focusMs ?? delay,
    close: policy.delays[value('tooltipCloseDelay')], hold: policy.holdMs, doubleTap: policy.doubleTapMs, fade: policy.fadeMs, step: policy.stepMs ?? 0, textLengths: policy.textLengths };
}

export function tooltipSettingsRows(policy = tooltipHelp) {
  return policy.settings.map(row => ({ cat: 'Accessibility', ...row,
    ...(row.type === 'choice' ? { choices: Object.keys(policy.delays) } : {}) }));
}

export function helpText(id, values = {}, messages = tooltipHelp.messages) {
  if (!Object.hasOwn(messages, id)) throw new Error(`Unknown help message: ${id}`);
  return messages[id].replace(/\{(\w+)\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`Missing help value: ${id}.${key}`);
    return String(values[key]);
  });
}
