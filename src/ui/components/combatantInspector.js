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
import { decorateKeywords, inspectionTag } from './tooltipGlossary.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { renderTray } from './trayComponents.js';
import { renderEnemyMoveCards } from './enemyMoveCards.js';
import { projectCombatantInspector } from '../models/CombatantInspectorSections.js';
import { attachTooltip, esc } from './tooltip.js';
import { helpText } from '../../model/tooltipSettings.js';
import { el, eyebrow, titleS, hairline, labelStack, meter, meters, row, statusText } from '../kit/index.js';

function resourceMeters(resources) {
  return meters((resources || []).map((r) => {
    const node = meter({
      id: String(r.label).toLowerCase(),
      tone: String(r.label).toLowerCase(),
      label: r.label,
      value: r.max == null ? String(r.value) : `${r.value} / ${r.max}`,
      cur: r.value, max: r.max == null ? r.value : r.max,
      pct: r.max ? Math.max(0, Math.min(100, (r.value / r.max) * 100)) : (r.value > 0 ? 100 : 0),
      stack: true,
      attrs: { class: 'combatant-inspector-resource' },
    });
    node.tabIndex = 0;
    attachTooltip(node, () => `<div class="tt-title">${esc(r.label)}</div>${esc(r.value)}${r.max == null ? '' : ` / ${esc(r.max)}`}. ${r.tooltipHtml || ''}`);
    return node;
  }), { class: 'combatant-inspector-resources' });
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

function abilitySection(abilities) {
  const list = el('details', { class: 'combatant-inspector-section combatant-abilities', open: true }, [
    el('summary', { class: 'as-eyebrow', text: `${helpText('activeListTitle')} (${abilities.length})` }), hairline(),
  ]);
  attachTooltip(list.querySelector('summary'), () => `<div class="tt-title">${esc(helpText('activeListTitle'))}</div>${esc(helpText('activeList', { count: abilities.length, action: helpText(list.open ? 'collapse' : 'expand') }))}`);
  for (const ability of abilities) list.append(el('details', {
    class: 'combatant-ability', open: true, dataset: { abilityId: ability.id, abilityKind: ability.kind },
  }, [
    el('summary', { text: ability.name, 'data-tip': ability.detail }),
    el('p', { class: 'as-prose', text: ability.detail }),
  ]));
  if (!abilities.length) list.append(statusText('No active skills or effects.'));
  return list;
}

/**
 * combatantDetailBody(subject) → THE FULL READ, as kit pieces. One home for
 * it: the edge tray renders this, and so does the door the combatant's
 * tooltip expands into (Constantine, 2026-09-04: "no way to expand combatant
 * tooltip to see more details"). A second copy of these sections is exactly
 * how the tray and the door would drift.
 */
// The two empty states never share wording (W1w: unknown and none are distinct).
const EMPTY_TEXT = Object.freeze({ none: 'None.', unknown: 'Unknown.' });

function factRows(section) {
  if (section.knowledge !== 'known') {
    const empty = row({ label: EMPTY_TEXT[section.knowledge], tag: 'div', disabled: true, className: 'combatant-inspector-row' });
    empty.dataset.knowledge = section.knowledge;
    return [empty];
  }
  return section.rows.map((r) => row({
    label: r.label, status: [r.value, r.detail].filter(Boolean).join(' · '), tag: 'div', className: 'combatant-inspector-row',
  }));
}

function projectedSection(section, content = factRows(section)) {
  return el('section', { class: 'combatant-inspector-section', dataset: { section: section.id, knowledge: section.knowledge } }, [
    eyebrow(section.title), hairline(), ...content,
  ]);
}

export function combatantDetailBody(subject, { heading = true } = {}) {
  if (!subject?.name) throw new Error('combatantDetailBody requires a named subject');
  // `heading: false` for a door whose HEAD already names the subject — the
  // tray has no head, so it keeps the LabelStack.
  const view = projectCombatantInspector(subject);
  const byId = Object.fromEntries(view.sections.map((s) => [s.id, s]));
  let abilities = projectedSection(byId.abilities);
  if (byId.abilities.knowledge === 'known') {
    abilities = subject.abilities ? abilitySection(subject.abilities)
      : subject.moveCards ? renderEnemyMoveCards(subject.moveCards)
        : section(subject.skillLabel || 'Skills', subject.skills, 'No active skills.');
    abilities.dataset.section = 'abilities';
    abilities.dataset.knowledge = 'known';
  }
  return [
    heading ? labelStack({ label: subject.name, hint: subject.subtitle || '' }) : null,
    projectedSection(byId.summary),
    projectedSection(byId.state),
    projectedSection(byId.history),
    abilities,
    projectedSection(byId.traits),
    projectedSection(byId.lore),
  ].filter(Boolean).map(decorateKeywords);
}

/** The W1w preview: only sprite, name and HP, bounded and aspect-preserving. */
export function combatantInspectorPreview({ name, hp = null, sprite = null }) {
  const art = el('div', { class: 'combatant-inspector-art' });
  if (sprite) art.append(sprite);
  return el('div', { class: 'combatant-inspector-preview' }, [
    art, labelStack({ label: name }), hp ? resourceMeters([hp]) : null,
  ]);
}

/** Preview left, details right; only the details pane scrolls. */
export function combatantInspectorLayout(subject, { sprite = null, previewFraction = 0.38 } = {}) {
  const view = projectCombatantInspector(subject);
  const layout = el('div', { class: 'combatant-inspector-layout' }, [
    combatantInspectorPreview({ name: view.preview.name, hp: view.preview.hp, sprite }),
    el('div', { class: 'combatant-inspector-details' }, combatantDetailBody(subject, { heading: false })),
  ]);
  layout.style.setProperty('--inspector-preview-fraction', String(previewFraction));
  return layout;
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
