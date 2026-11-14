// The Action timeline and Reaction timeline editors (Settings > Combat). One row per event: move earlier / later, the
// event's name, a Timing choice (After previous / Same time as <an earlier event>) and an offset slider. The saved value is
// settings.combatTimeline = { shared, reaction }; every edit goes through the model (model/combatTimelinePolicy.js), which
// repairs anchors, so the editor can never save a cycle or a forward reference.
import { t, tFull } from '../strings.js';
import { esc } from '../components/tooltip.js';
import {
  TIMELINE_OFFSET, defaultTimeline, resolveTimelineSetting, moveTimelineEvent, setTimelineEvent,
} from '../../model/combatTimelinePolicy.js';

const eventName = id => t(`settings.timeline.event.${id}`);

function sectionHtml(key, list) {
  const rows = list.map((row, index) => {
    const earlier = list.slice(0, index);
    const options = [`<option value="previous"${row.with === 'previous' ? ' selected' : ''}>${esc(t('settings.timeline.after'))}</option>`,
      ...earlier.map(other => `<option value="${esc(other.id)}"${row.with === other.id ? ' selected' : ''}>${esc(t('settings.timeline.same', { event: eventName(other.id) }))}</option>`)].join('');
    const name = esc(eventName(row.id));
    return `<li class="set-tl-row" data-tl-id="${esc(row.id)}" title="${esc(tFull(`settings.timeline.event.${row.id}`))}">
      <span class="set-tl-move">
        <button type="button" class="as-btn" data-tl-move="-1" data-tl-section="${key}" data-tl-id="${esc(row.id)}" aria-label="${esc(t('settings.timeline.up'))}: ${name}"${index === 0 ? ' disabled' : ''}>▲</button>
        <button type="button" class="as-btn" data-tl-move="1" data-tl-section="${key}" data-tl-id="${esc(row.id)}" aria-label="${esc(t('settings.timeline.down'))}: ${name}"${index === list.length - 1 ? ' disabled' : ''}>▼</button>
      </span>
      <span class="set-tl-name">${name}</span>
      <select class="set-choice-select" data-tl-with data-tl-section="${key}" data-tl-id="${esc(row.id)}" aria-label="${esc(t('settings.timeline.timing'))}: ${name}">${options}</select>
      <input type="range" data-tl-offset data-tl-section="${key}" data-tl-id="${esc(row.id)}" min="${TIMELINE_OFFSET.min}" max="${TIMELINE_OFFSET.max}" step="${TIMELINE_OFFSET.step}" value="${row.offsetMs}" aria-label="${esc(t('settings.timeline.offset'))}: ${name}">
      <output class="set-tl-out">${row.offsetMs} ms</output>
    </li>`;
  }).join('');
  return `<ol class="set-tl-list" data-tl-list="${key}">${rows}</ol>`;
}

/** timelineEditorHtml(settings) -> the markup of both sections. */
export function timelineEditorHtml(settings) {
  const { shared, reaction } = resolveTimelineSetting(settings?.combatTimeline);
  const separate = reaction !== null;
  return `<div class="set-timeline" data-timeline>
    <div class="set-tl-head"><strong>${esc(t('settings.timeline.action'))}</strong>
      <button type="button" class="as-btn" data-tl-reset="shared">${esc(t('settings.timeline.reset'))}</button></div>
    ${sectionHtml('shared', shared)}
    <div class="set-tl-head"><strong>${esc(t('settings.timeline.reaction'))}</strong>
      <label class="set-tl-toggle"><input type="checkbox" data-tl-separate${separate ? ' checked' : ''}> ${esc(t('settings.timeline.useReaction'))}</label>
      ${separate ? `<button type="button" class="as-btn" data-tl-reset="reaction">${esc(t('settings.timeline.reset'))}</button>` : ''}</div>
    ${separate ? sectionHtml('reaction', reaction) : ''}
  </div>`;
}

/**
 * bindTimelineEditor(container, { settings, apply }): wires the controls. apply(nextValue) saves
 * settings.combatTimeline = nextValue and redraws (the caller owns persistence).
 */
export function bindTimelineEditor(container, { settings, apply }) {
  const root = container.querySelector('[data-timeline]');
  if (!root) return;
  const current = () => resolveTimelineSetting(settings.combatTimeline);
  const commit = (section, list) => {
    const value = current();
    apply({ ...value, [section]: list });
  };
  const listOf = section => current()[section] ?? defaultTimeline();
  root.querySelectorAll('[data-tl-move]').forEach(button => button.addEventListener('click', () => {
    const section = button.dataset.tlSection;
    commit(section, moveTimelineEvent(listOf(section), button.dataset.tlId, Number(button.dataset.tlMove)));
  }));
  root.querySelectorAll('[data-tl-with]').forEach(select => select.addEventListener('change', () => {
    const section = select.dataset.tlSection;
    commit(section, setTimelineEvent(listOf(section), select.dataset.tlId, { with: select.value }));
  }));
  root.querySelectorAll('[data-tl-offset]').forEach(input => {
    const out = input.parentElement?.querySelector('.set-tl-out');
    input.addEventListener('input', () => { if (out) out.textContent = `${input.value} ms`; });
    input.addEventListener('change', () => {
      const section = input.dataset.tlSection;
      commit(section, setTimelineEvent(listOf(section), input.dataset.tlId, { offsetMs: Number(input.value) }));
    });
  });
  root.querySelectorAll('[data-tl-reset]').forEach(button => button.addEventListener('click', () => {
    const section = button.dataset.tlReset;
    commit(section, section === 'shared' ? defaultTimeline() : defaultTimeline());
  }));
  root.querySelector('[data-tl-separate]')?.addEventListener('change', event => {
    // Switching it on starts the override as a copy of the shared timeline; off drops it.
    apply({ ...current(), reaction: event.target.checked ? current().shared.map(row => ({ ...row })) : null });
  });
}
