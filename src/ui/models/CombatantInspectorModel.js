import { componentModel } from './ComponentModel.js';
import { trayModel } from './TrayModels.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';
import { t } from '../strings.js';

export function combatantInspectorModel({
  role,
  expanded = true,
  subject,
  presentation = {},
} = {}) {
  if (role !== 'player' && role !== 'enemy') throw new Error(`Unknown combatant inspector role: ${role}`);
  if (!subject?.name) throw new Error('Combatant inspector requires a named subject');
  const edge = role === 'player' ? 'left' : 'right';
  const tray = trayModel({
    id: `combatant-inspector-${role}`,
    name: subject.name,
    summary: expanded ? (subject.subtitle || t(role === 'player' ? 'combat.log.role.player' : 'combat.log.role.enemy')) : '',
    edge,
    expanded,
    resizable: false,
    items: [],
  });
  return componentModel(UI.combatantInspector, {
    variant: edge,
    properties: {
      role,
      edge,
      expanded,
      subject,
    },
    tokens: {
      widthRem: Number.isFinite(presentation.widthRem) ? presentation.widthRem : 20,
      mobileWidthViewportPct: Number.isFinite(presentation.mobileWidthViewportPct)
        ? presentation.mobileWidthViewportPct : 62,
    },
    accessibility: {
      label: `${subject.name} details`,
    },
    children: [tray],
  });
}
