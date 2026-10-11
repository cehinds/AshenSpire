// workbench/modules/placeholder.mjs — the empty state a module shows until its
// work lands in this branch. Each module's index.mjs calls it with what it will
// do and which legacy tools it replaces.
import { icon } from '../ui/icons.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function placeholderModule({ label, will, replaces = [] }) {
  return {
    mount(el) {
      el.innerHTML = `<div class="empty fill-empty is-wait"><div class="empty-icon">${icon('info')}</div><h3>${esc(label)}</h3><p>Coming in this branch: ${esc(will)}</p>${replaces.length ? `<p class="faint">Replaces ${replaces.map(esc).join(', ')}. The old tools stay in the Library under Legacy.</p>` : ''}</div>`;
      return {};
    },
  };
}
