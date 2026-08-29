import { childModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { renderTray } from './trayComponents.js';
import { esc } from './tooltip.js';

function resourceRows(resources) {
  return (resources || []).map((row) => `
    <div class="combatant-inspector-resource">
      <span>${esc(row.label)}</span>
      <strong>${esc(row.value)}${row.max == null ? '' : ` / ${esc(row.max)}`}</strong>
    </div>`).join('');
}

function detailRows(title, rows, empty) {
  const body = (rows || []).length
    ? rows.map((row) => `
      <li${row.active ? ' class="active"' : ''}>
        <strong>${esc(row.name)}</strong>
        ${row.detail ? `<span>${esc(row.detail)}</span>` : ''}
      </li>`).join('')
    : `<li class="empty">${esc(empty)}</li>`;
  return `<section class="combatant-inspector-section"><h4>${esc(title)}</h4><ul>${body}</ul></section>`;
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
      const subject = model.properties.subject;
      content.innerHTML = `
        <div class="combatant-inspector-summary">
          <div>
            <strong>${esc(subject.name)}</strong>
            <span>${esc(subject.subtitle || '')}</span>
          </div>
          <div class="combatant-inspector-resources">${resourceRows(subject.resources)}</div>
        </div>
        ${subject.intent ? detailRows('Current intent', [subject.intent], 'No current intent.') : ''}
        ${detailRows(subject.skillLabel || 'Skills', subject.skills, 'No active skills.')}
        ${detailRows('Active effects', subject.statuses, 'No active effects.')}`;
    },
  });
  rendered.element.dataset.role = 'context';
  host.appendChild(rendered.element);
  host.addEventListener('click', (event) => event.stopPropagation());
  return rendered;
}
