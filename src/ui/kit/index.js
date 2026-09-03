// src/ui/kit/index.js — THE COMPONENT KIT: every piece a surface may be built
// from, and nothing else.
//
// The vocabulary is the kit artifact's (§03 sub-components, §04 assemblies,
// §05 bodies, §07 menus). Each builder returns an element wearing exactly the
// kit class the stylesheet (styles/kit.css) draws; a surface composes builders
// and never writes a shape, a colour or a radius of its own. The shell's
// assemblies (head, foot, button row, icon button, the door-opener) live in
// components/modalShell.js and are re-exported here so one import serves.
//
// TWO FORMS, ONE ANSWER. Most screens build markup as a string and wire it
// afterwards; some build elements. Every builder returns an element, and
// `html(node)` serialises it for a string-building caller — the same DOM,
// the same classes, so the two forms cannot drift.
//
// BEHAVIOUR HOOKS ARE NOT SKIN. A caller may add its own class (`.qn-row`,
// `.title-slot-pick`) through `className` for its listeners and the tools
// that read the page; kit.css draws nothing for those names.

import {
  buttonRow as shellButtonRow, BUTTON_ROW_SIZES as SHELL_BUTTON_ROW_SIZES, modalHead as shellModalHead,
  modalFooter as shellModalFooter, modalCloseButton as shellModalCloseButton, modalCloseButtonHtml as shellModalCloseButtonHtml,
  openModal as shellOpenModal, MODAL_SIZES as SHELL_MODAL_SIZES, bindModalDismiss as shellBindModalDismiss,
} from '../components/modalShell.js';

// Re-exported one name per line: tools/bundle.mjs reads `export const NAME`
// and `export function NAME` only, so a bare `export { … }` list would fail
// the standalone build by name.
export const buttonRow = shellButtonRow;
export const BUTTON_ROW_SIZES = SHELL_BUTTON_ROW_SIZES;
export const modalHead = shellModalHead;
export const modalFooter = shellModalFooter;
export const modalCloseButton = shellModalCloseButton;
export const modalCloseButtonHtml = shellModalCloseButtonHtml;
export const openModal = shellOpenModal;
export const MODAL_SIZES = SHELL_MODAL_SIZES;
export const bindModalDismiss = shellBindModalDismiss;

// ---- the one element factory ------------------------------------------------
/**
 * el(tag, attrs, children) → element. `attrs` keys: `class`/`className`,
 * `text`, `html` (trusted, caller-escaped), `dataset` {k:v}, `aria` {k:v},
 * anything else is setAttribute. `children` is a node, a string (text), an
 * array of either, or null.
 */
export function el(tag, attrs = {}, children = null) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = String(value);
    else if (key === 'dataset') for (const [k, v] of Object.entries(value)) { if (v != null) node.dataset[k] = String(v); }
    else if (key === 'aria') for (const [k, v] of Object.entries(value)) { if (v != null) node.setAttribute(`aria-${k}`, String(v)); }
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}
function append(node, children) {
  if (children == null) return;
  if (Array.isArray(children)) { for (const child of children) append(node, child); return; }
  if (typeof children === 'string') node.appendChild(document.createTextNode(children));
  else node.appendChild(children);
}
/** html(node | node[]) → the markup, for a string-building caller. */
export function html(nodes) {
  if (Array.isArray(nodes)) return nodes.map(html).join('');
  return nodes ? nodes.outerHTML : '';
}
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const cls = (...parts) => parts.filter(Boolean).join(' ');

// ---- text atoms -------------------------------------------------------------
export const eyebrow = (text, attrs = {}) => el('span', { ...attrs, class: cls('as-eyebrow', attrs.class), text });
export const titleL = (text, attrs = {}) => el(attrs.tag || 'h2', { ...attrs, tag: undefined, class: cls('as-title-l', attrs.class), text });
export const titleM = (text, attrs = {}) => el(attrs.tag || 'h2', { ...attrs, tag: undefined, class: cls('as-title-m', attrs.class), text });
export const titleS = (text, attrs = {}) => el(attrs.tag || 'h2', { ...attrs, tag: undefined, class: cls('as-title-s', attrs.class), text });
export const subtitle = (text, attrs = {}) => el('p', { ...attrs, class: cls('as-subtitle', attrs.class), text });
export const statusText = (text, attrs = {}) => el('span', { ...attrs, class: cls('as-status', attrs.class), text });
export const flavour = (text, attrs = {}) => el('span', { ...attrs, class: cls('as-flavor', attrs.class), text });
export const prose = (text, attrs = {}) => el('p', { ...attrs, class: cls('as-prose', attrs.class), text });
export const hairline = (attrs = {}) => el('hr', { ...attrs, class: cls('as-hairline', attrs.class) });
export const ornament = (attrs = {}) => el('div', { ...attrs, class: cls('as-ornament', attrs.class), 'aria-hidden': 'true' }, el('span', { text: '◆' }));

// ---- control atoms ----------------------------------------------------------
/** iconButton({ glyph, label, id, className, attrs }) → the one square box. */
export function iconButton({ glyph, label, id = '', className = '', attrs = {} } = {}) {
  return el('button', {
    ...attrs, type: 'button', id: id || null,
    class: cls('as-iconbtn modal-iconbtn', className),
    'aria-label': label, title: attrs.title ?? label, text: glyph,
  });
}
/** button({ label, weight: 'secondary'|'primary'|'danger', ... }) — three weights, no fourth. */
export function button({ label, weight = 'secondary', id = '', className = '', disabled = false, attrs = {} } = {}) {
  const node = el('button', {
    ...attrs, type: attrs.type || 'button', id: id || null,
    class: cls('as-btn', weight === 'primary' ? 'primary' : '', weight === 'danger' ? 'danger' : '', className),
    text: label,
  });
  if (disabled) node.disabled = true;
  return node;
}
export function tab({ label, selected = false, member = '', id = '', className = '', attrs = {} } = {}) {
  return el('button', {
    ...attrs, type: 'button', id: id || null, role: 'tab',
    class: cls('as-tab modal-tab', selected ? 'on' : '', className),
    'aria-selected': selected ? 'true' : 'false',
    dataset: { ...(attrs.dataset || {}), ...(member ? { member } : {}) },
    text: label,
  });
}
export function railItem({ label, current = false, member = '', id = '', className = '', attrs = {} } = {}) {
  return el('button', {
    ...attrs, type: 'button', id: id || null, role: attrs.role || 'tab',
    class: cls('as-railitem', current ? 'on' : '', className),
    'aria-current': current ? 'true' : null,
    'aria-selected': current ? 'true' : 'false',
    dataset: { ...(attrs.dataset || {}), ...(member ? { member } : {}) },
    text: label,
  });
}
export const rail = (items, attrs = {}) => el('div', { ...attrs, class: cls('as-rail', attrs.class), role: attrs.role || 'tablist' }, items);
/** segmented({ options: [{ label, value, pressed, attrs }], attrs }) — 2–3 values, all visible. */
export function segmented({ options = [], attrs = {} } = {}) {
  return el('span', { ...attrs, class: cls('as-seg', attrs.class) }, options.map((option) => el('button', {
    ...(option.attrs || {}), type: 'button',
    class: cls(option.pressed ? 'on' : '', option.className),
    'aria-pressed': option.pressed ? 'true' : 'false',
    dataset: { ...((option.attrs || {}).dataset || {}), ...(option.value != null ? { val: option.value } : {}) },
    text: option.label,
  })));
}
export function toggle({ on = false, attrs = {}, className = '' } = {}) {
  return el('button', {
    ...attrs, type: 'button', role: 'switch',
    class: cls('as-toggle toggle', on ? 'on' : '', className),
    'aria-checked': on ? 'true' : 'false',
  }, el('span', { class: 'knob' }));
}
export const pill = ({ label, on = null, round = false, attrs = {} } = {}) => el('span', {
  ...attrs, class: cls('as-pill', round ? 'round' : '', attrs.class), dataset: on == null ? undefined : { on: on ? 'true' : 'false' }, text: label,
});
export const tagChip = ({ label, more = false, attrs = {} } = {}) => el('span', { ...attrs, class: cls('as-tag', more ? 'more' : '', attrs.class), text: label });
export const keycap = (label, attrs = {}) => el('span', { ...attrs, class: cls('as-keycap', attrs.class), text: label });
export const glyph = (char, attrs = {}) => el('span', { ...attrs, class: cls('as-glyph', attrs.class), 'aria-hidden': 'true', text: char });
export function labelStack({ label, hint = '', attrs = {} } = {}) {
  return el('span', { ...attrs, class: cls('as-labelstack', attrs.class) }, [
    el('span', { class: 'ls-label', text: label }),
    hint ? el('span', { class: 'ls-hint', text: hint }) : null,
  ]);
}
export function artWell({ glyph: g = '', src = '', alt = '', small = false, cool = false, attrs = {} } = {}) {
  return el('div', { ...attrs, class: cls('as-artwell', small ? 'sm' : '', cool ? 'cool' : '', attrs.class), 'aria-hidden': src ? null : 'true' },
    src ? el('img', { src, alt }) : g);
}
export function detailCard({ eyebrow: eb = '', name = '', line = '', meta = '', muted = false, attrs = {} } = {}) {
  return el('div', { ...attrs, class: cls('as-detailcard', muted ? 'muted' : '', attrs.class) }, [
    eb ? el('span', { class: 'dc-eyebrow', text: eb }) : null,
    name ? el('p', { class: 'dc-name', text: name }) : null,
    line ? el('div', { class: 'dc-line', text: line }) : null,
    meta ? el('span', { class: 'dc-meta', text: meta }) : null,
  ]);
}

// ---- the two list atoms -----------------------------------------------------
/**
 * row({ glyph, label, status, trail, tone, disabled, setting, tag, attrs, className })
 * Glyph + label + StatusText + trail. `tag` 'button' (default) or 'div'.
 * `setting: true` is the settings variant: hairline, no hover, wraps.
 */
export function row({ glyph: g = '', label = '', labelNode = null, status = '', trail = [], tone = '', disabled = false, setting = false, tag = 'button', attrs = {}, className = '' } = {}) {
  const trailNodes = (Array.isArray(trail) ? trail : [trail]).filter(Boolean);
  const node = el(tag, {
    ...attrs, type: tag === 'button' ? 'button' : null,
    class: cls('as-row', setting ? 'setting' : '', className),
    dataset: { ...(attrs.dataset || {}), ...(tone ? { tone } : {}) },
    'aria-disabled': disabled ? 'true' : null,
  }, [
    g ? glyph(g) : null,
    labelNode || (label ? el('span', { class: 'r-label', text: label }) : null),
    status ? statusText(status) : null,
    trailNodes.length ? el('span', { class: 'r-trail' }, trailNodes) : null,
  ]);
  if (disabled && tag === 'button') node.disabled = true;
  return node;
}
/**
 * optionCard({ glyph, name, badge, description, meta, body, selected, disabled, arrow, attrs, className })
 * Glyph + Title·S + prose. Selection changes colour, never footprint.
 */
export function optionCard({ glyph: g = '', name = '', badge = null, description = '', meta = '', body = null, trail = [], selected = false, disabled = false, arrow = true, tag = 'button', attrs = {}, className = '' } = {}) {
  const trailNodes = (Array.isArray(trail) ? trail : [trail]).filter(Boolean);
  const node = el(tag, {
    ...attrs, type: tag === 'button' ? 'button' : null,
    class: cls('as-option', arrow ? '' : 'noarrow', selected ? 'is-selected' : '', className),
    'aria-pressed': tag === 'button' && attrs.role !== 'radio' ? (selected ? 'true' : 'false') : null,
    'aria-checked': attrs.role === 'radio' ? (selected ? 'true' : 'false') : null,
    'aria-disabled': disabled ? 'true' : null,
  }, [
    g ? el('span', { class: 'og', 'aria-hidden': 'true', text: g }) : null,
    el('span', { class: 'ob' }, [
      name ? el('span', { class: 'on' }, [name, badge]) : null,
      description ? el('span', { class: 'od', text: description }) : null,
      meta ? el('span', { class: 'om', text: meta }) : null,
      body,
    ]),
    trailNodes.length ? el('span', { class: 'r-trail' }, trailNodes) : null,
  ]);
  if (disabled && tag === 'button') node.disabled = true;
  return node;
}
export const options = (cards, attrs = {}) => el('div', { ...attrs, class: cls('as-options', attrs.class) }, cards);
export const optionRow = (card, trailing, attrs = {}) => el('div', { ...attrs, class: cls('as-optionrow', attrs.class) }, [card, trailing]);

// ---- number atoms -----------------------------------------------------------
export const statPair = ({ key, value, attrs = {} } = {}) => el('span', { ...attrs, class: cls('as-statpair', attrs.class) }, [
  el('span', { class: 'sp-k', text: key }), el('span', { class: 'sp-v', text: value }),
]);
export const chip = ({ key, value, tip = '', attrs = {} } = {}) => el('span', { ...attrs, class: cls('as-chip', attrs.class), title: tip || null }, [
  el('span', { class: 'ck', text: key }), el('span', { class: 'cv', text: value }),
]);
export const statStrip = (chips, attrs = {}) => el('span', { ...attrs, class: cls('as-statstrip', attrs.class) }, chips);
export const kitLine = (items, attrs = {}) => el('span', { ...attrs, class: cls('as-kitline', attrs.class) }, items);
export const kitItem = ({ glyph: g = '◆', name, tip = '', attrs = {} } = {}) => el('span', { ...attrs, class: cls('ki', attrs.class), title: tip || null }, [
  el('span', { class: 'kg', 'aria-hidden': 'true', text: g }), el('span', { class: 'kn', text: name }),
]);
export function delta({ from, to, attrs = {} } = {}) {
  const dir = to > from ? 'up' : to < from ? 'down' : 'flat';
  return el('span', { ...attrs, class: cls('as-delta', attrs.class), dataset: { dir } }, [
    el('span', { class: 'd-from', text: from }), el('span', { class: 'd-arrow', text: '→' }), el('span', { class: 'd-to', text: to }),
  ]);
}
export const blocker = (text, { placement = '', attrs = {} } = {}) => el('div', { ...attrs, class: cls('as-blocker', placement, attrs.class), text });

// ---- assemblies -------------------------------------------------------------
/** pane({ eyebrow, title, subtitle, children, attrs }) — Eyebrow + Title·M + Subtitle + Hairline + rows. */
export function pane({ eyebrow: eb = '', title = '', subtitle: sub = '', children = null, attrs = {} } = {}) {
  return el('div', { ...attrs, class: cls('as-pane', attrs.class) }, [
    eb ? eyebrow(eb) : null,
    title ? titleM(title, { tag: 'h3' }) : null,
    sub ? subtitle(sub) : null,
    (eb || title || sub) ? hairline() : null,
    children,
  ]);
}
export const railed = (railNode, paneNode, attrs = {}) => el('div', { ...attrs, class: cls('as-railed', attrs.class) }, [railNode, paneNode]);
/** popover({ caption, groups: [[row, …], …], attrs }) — Eyebrow cap + hairline-grouped rows. */
export function popover({ caption = '', groups = [], attrs = {}, className = '' } = {}) {
  return el('div', { ...attrs, class: cls('as-pop', className) }, [
    caption ? el('div', { class: 'as-pop-cap' }, eyebrow(caption)) : null,
    ...groups.filter((group) => group && group.length).map((group) => el('div', { class: 'as-group' }, group)),
  ]);
}
/** decide({ title, children, prompt }) — body C: Title·L + Ornament + what is at stake + prompt. */
export function decide({ title = '', children = null, prompt = '', attrs = {} } = {}) {
  return el('div', { ...attrs, class: cls('as-decide', attrs.class) }, [
    title ? titleL(title, { tag: 'h3' }) : null,
    title ? ornament() : null,
    children,
    prompt ? el('p', { class: 'prompt', text: prompt }) : null,
  ]);
}
/** titleMenu({ name, subtitle, entries: [{ label, attrs, className, disabled }], foot }) */
export function titleMenu({ name, subtitle: sub = '', entries = [], foot = null, attrs = {} } = {}) {
  return el('div', { ...attrs, class: cls('as-titlemenu', attrs.class) }, [
    el('h1', { class: 'tm-name', text: name, ...(attrs.nameAttrs || {}) }),
    sub ? el('p', { class: 'tm-sub', text: sub, ...(attrs.subAttrs || {}) }) : null,
    ornament(),
    el('ul', {}, entries.map((entry) => el('li', {}, (() => {
      const node = el('button', { ...(entry.attrs || {}), type: 'button', class: cls('tm-entry', entry.className), text: entry.label });
      if (entry.disabled) node.disabled = true;
      return node;
    })()))),
    ornament(),
    foot,
  ]);
}
