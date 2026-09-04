// THE COMBATANT INSPECTOR — the expanded reading of one fighter, in a Folding
// Tray at the field's edge. The tray is components/trayComponents.js (the kit's
// tray assembly); everything INSIDE it is kit pieces and nothing else:
//
//   the subject   a LabelStack (name over what it is)
//   its pools     one Meter per resource, stacked, values on their plates
//   its intent    a Pane heading (Eyebrow + Title·S) over one Row, tone
//                 `current`, whose status line is what the move does
//   its skills    the same Rows, the live one toned `current`
//   its effects   the same Rows, or one disabled Row saying there are none
//
// It owns no shape: the host's edge and width are tokens the model carries.
import { childModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { renderTray } from './trayComponents.js';
import { el, eyebrow, titleS, hairline, labelStack, meter, meters, row, statusText } from '../kit/index.js';

function resourceMeters(resources) {
  return meters((resources || []).map((r) => meter({
    id: String(r.label).toLowerCase(),
    tone: String(r.label).toLowerCase(),
    label: r.label,
    value: r.max == null ? String(r.value) : `${r.value} / ${r.max}`,
    cur: r.value, max: r.max == null ? r.value : r.max,
    pct: r.max ? Math.max(0, Math.min(100, (r.value / r.max) * 100)) : (r.value > 0 ? 100 : 0),
    stack: true,
    attrs: { class: 'combatant-inspector-resource' },
  })), { class: 'combatant-inspector-resources' });
}

function section(title, rows, empty) {
  const list = (rows || []).length
    ? rows.map((r) => row({
      label: r.name, status: r.detail || '', tag: 'div',
      tone: r.active ? 'current' : '', className: 'combatant-inspector-row',
    }))
    : [row({ label: empty, tag: 'div', disabled: true, className: 'combatant-inspector-row' })];
  return el('section', { class: 'combatant-inspector-section' }, [
    eyebrow(title), hairline(), ...list,
  ]);
}

/**
 * combatantDetailBody(subject) → THE FULL READ, as kit pieces. One home for
 * it: the edge tray renders this, and so does the door the combatant's
 * tooltip expands into (Constantine, 2026-09-04: "no way to expand combatant
 * tooltip to see more details"). A second copy of these sections is exactly
 * how the tray and the door would drift.
 */
export function combatantDetailBody(subject, { heading = true } = {}) {
  if (!subject?.name) throw new Error('combatantDetailBody requires a named subject');
  // `heading: false` for a door whose HEAD already names the subject — the
  // tray has no head, so it keeps the LabelStack.
  return [
    el('div', { class: 'combatant-inspector-summary' }, [
      heading ? labelStack({ label: subject.name, hint: subject.subtitle || '' }) : null,
      resourceMeters(subject.resources),
    ]),
    ...(subject.intent ? [section('Current intent', [subject.intent], 'No current intent.')] : []),
    section(subject.skillLabel || 'Skills', subject.skills, 'No active skills.'),
    section('Active effects', subject.statuses, 'No active effects.'),
  ];
}

export function mountCombatantInspector(host, model, { onToggle = null } = {}) {
  if (!host) throw new Error('Combatant inspector requires a host');
  if (!model || model.component !== UI.combatantInspector) throw new Error('Combatant inspector requires its Component Model');
  const tray = childModel(model, UI.foldingTray);
  host.innerHTML = '';
  host.hidden = false;
  host.className = `combatant-inspector-host ${model.properties.edge}`;
  host.style.setProperty('--combatant-inspector-width-rem', String(model.tokens.widthRem));
  host.style.setProperty('--combatant-inspector-mobile-vw', `${model.tokens.mobileWidthViewportPct}vw`);
  host.setAttribute('aria-label', model.accessibility.label);
  markUiComponent(host, model.component, model.variant);

  const rendered = renderTray(tray, {
    onToggle: () => onToggle?.(!model.properties.expanded),
    renderContent: (content) => {
      content.replaceChildren(...combatantDetailBody(model.properties.subject));
    },
  });
  rendered.element.dataset.role = 'context';
  host.appendChild(rendered.element);
  host.addEventListener('click', (event) => event.stopPropagation());
  return rendered;
}
