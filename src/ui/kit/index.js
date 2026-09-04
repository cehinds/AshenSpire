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
//
// AS FUNCTIONS, NOT CONSTS, and the reason is the import graph: the kit is
// reached from a leaf (ui/debuglog.js, which fx.js and tooltip.js sit above),
// so `modalShell → tooltip → fx → debuglog → kit → modalShell` is a cycle. A
// module that enters the cycle from modalShell's side evaluates this file
// BEFORE modalShell.js, and `export const x = shellX` would read a binding in
// its temporal dead zone (tools/modal-shell-contract.mjs met exactly that).
// A function body reads the binding when it is CALLED, by which time every
// module has evaluated — so the wrappers are cycle-proof at no cost. The two
// size lists are frozen arrays the shell owns; they are exposed as getters
// of the same names for the same reason.
export function buttonRow(options) { return shellButtonRow(options); }
export function modalHead(options) { return shellModalHead(options); }
export function modalFooter(options) { return shellModalFooter(options); }
export function modalCloseButton(options) { return shellModalCloseButton(options); }
export function modalCloseButtonHtml(options) { return shellModalCloseButtonHtml(options); }
export function openModal(options) { return shellOpenModal(options); }
export function bindModalDismiss(options) { return shellBindModalDismiss(options); }
export function BUTTON_ROW_SIZES() { return SHELL_BUTTON_ROW_SIZES; }
export function MODAL_SIZES() { return SHELL_MODAL_SIZES; }

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
    else if (key === 'style' && typeof value === 'object') {
      // Custom properties (`--tone`) need setProperty; Object.assign ignores them.
      for (const [prop, v] of Object.entries(value)) {
        if (v == null) continue;
        if (prop.startsWith('--')) node.style.setProperty(prop, String(v));
        else node.style[prop] = v;
      }
    }
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
export function detailCard({ eyebrow: eb = '', name = '', line = '', meta = '', muted = false, children = null, tag = 'div', attrs = {} } = {}) {
  return el(tag, { ...attrs, class: cls('as-detailcard', muted ? 'muted' : '', attrs.class) }, [
    eb ? el('span', { class: 'dc-eyebrow', text: eb }) : null,
    name ? el('p', { class: 'dc-name', text: name }) : null,
    line ? el('div', { class: 'dc-line', text: line }) : null,
    meta ? el('span', { class: 'dc-meta', text: meta }) : null,
    children,
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
export function optionCard({ glyph: g = '', art = null, name = '', badge = null, description = '', meta = '', body = null, trail = [], selected = false, disabled = false, arrow = true, tag = 'button', attrs = {}, className = '' } = {}) {
  const trailNodes = (Array.isArray(trail) ? trail : [trail]).filter(Boolean);
  const node = el(tag, {
    ...attrs, type: tag === 'button' ? 'button' : null,
    class: cls('as-option', arrow ? '' : 'noarrow', selected ? 'is-selected' : '', className),
    'aria-pressed': tag === 'button' && attrs.role !== 'radio' ? (selected ? 'true' : 'false') : null,
    'aria-checked': attrs.role === 'radio' ? (selected ? 'true' : 'false') : null,
    'aria-disabled': disabled ? 'true' : null,
  }, [
    art || (g ? el('span', { class: 'og', 'aria-hidden': 'true', text: g }) : null),
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
/** optionGrid(cards) — OptionCards in as many columns as fit (`--opt-min` is the column floor). */
export const optionGrid = (cards, attrs = {}) => el('div', { ...attrs, class: cls('as-options grid', attrs.class) }, cards);
/**
 * face({ name, badge, description, meta, trail, attrs, className }) — the CONTENT of an option
 * card as its own element, for a card whose host (a disclosure button, a hold
 * target) must stay bare so the face can paint the whole surface. Hang it on
 * an `.as-option.hosts-face`.
 */
export function face({ name = '', nameNode = null, badge = null, description = '', meta = '', body = null, trail = [], art = null, tag = 'span', attrs = {}, className = '' } = {}) {
  const trailNodes = (Array.isArray(trail) ? trail : [trail]).filter(Boolean);
  return el(tag, { ...attrs, class: cls('as-face', className) }, [
    art,
    el('span', { class: 'ob' }, [
      nameNode || (name ? el('span', { class: 'on' }, [name, badge]) : null),
      description ? el('span', { class: 'od', text: description }) : null,
      meta ? el('span', { class: 'om', text: meta }) : null,
      body,
    ]),
    trailNodes.length ? el('span', { class: 'r-trail' }, trailNodes) : null,
  ]);
}

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
/** statRow({ name, hint, values, drill, flat, tag, attrs }) — body E's row: the group's name and kind left, its StatPairs / deltas right. */
export function statRow({ name = '', nameNode = null, hint = '', hintNode = null, values = [], drill = false, flat = false, tag = 'div', attrs = {}, className = '' } = {}) {
  const valueNodes = (Array.isArray(values) ? values : [values]).filter(Boolean);
  return el(tag, { ...attrs, class: cls('as-statrow', drill ? 'drill' : '', flat ? 'flat' : '', className) }, [
    el('span', { class: 'sr-id' }, [
      nameNode || (name ? el('span', { class: 'sr-name', text: name }) : null),
      hintNode || (hint ? el('span', { class: 'sr-hint', text: hint }) : null),
    ]),
    valueNodes.length ? el('span', { class: 'sr-vals' }, valueNodes) : null,
  ]);
}
/**
 * stepper({ value, dec, inc, attrs }) — a −/count/+ unit of two tap-floor buttons.
 * `dec`/`inc`: { label, disabled, attrs }. Disabled is `aria-disabled`, never
 * `disabled`: a disabled button fires no pointer events, so its tooltip could
 * never say why it will not move.
 */
export function stepper({ value, dec = {}, inc = {}, valueClass = '', valueAttrs = {}, attrs = {}, className = '' } = {}) {
  const step = (glyphChar, spec) => el('button', {
    ...(spec.attrs || {}), type: 'button', class: cls('as-btn', spec.className), 'aria-label': spec.label || null,
    'aria-disabled': spec.disabled ? 'true' : 'false', text: glyphChar,
  });
  return el('span', { ...attrs, class: cls('as-stepper', className) }, [
    step('−', dec),
    el('b', { ...valueAttrs, class: cls('st-value', valueClass), text: String(value) }),
    step('+', inc),
  ]);
}
/**
 * tray({ edge, collapsed, sized, head, body, tag, attrs }) — the Folding Tray's
 * frame: a docked region that folds to its header. `head` is a Row (caret
 * Glyph + Title·S + StatusText) beside an IconButton; `body` is a Pane.
 */
export function tray({ edge = 'bottom', collapsed = false, sized = false, head = null, body = null, tag = 'section', attrs = {}, className = '' } = {}) {
  return el(tag, {
    ...attrs, class: cls('as-tray', className),
    dataset: { ...(attrs.dataset || {}), trayEdge: edge, collapsed: collapsed ? '1' : '0', sized: sized ? '1' : '0' },
  }, [head, body]);
}

// ---- the meter, the slot, the pip -------------------------------------------
/**
 * meter({ label, value, cur, max, pct, lengthPct, tone, skinny, inset, pulse,
 *         id, attrs, trackAttrs }) → `.as-meter`.
 * `pct` is the FILL (cur ÷ max, 0..100); `lengthPct` is the TRACK's own length
 * (max ÷ reference), so a bigger pool is a longer bar — the surface derives
 * both; the atom draws them. The track carries the machine-readable facts
 * (data-cur / data-max, role=img) so an instrument never reads the label.
 */
export function meter({ label = '', value = '', cur = null, max = null, pct = 100, lengthPct = 100, tone = '', skinny = false, inset = false, stack = false, pulse = false, id = '', attrs = {}, trackAttrs = {}, ariaLabel = '' } = {}) {
  const track = el('span', {
    ...trackAttrs, class: cls('m-track', trackAttrs.class), role: 'img',
    'aria-label': ariaLabel || (label ? `${label} ${cur ?? value} of ${max ?? ''}`.trim() : null),
    dataset: { ...(trackAttrs.dataset || {}), ...(id ? { res: id } : {}), ...(cur != null ? { cur: String(cur) } : {}), ...(max != null ? { max: String(max) } : {}) },
    style: { width: `${Number(lengthPct).toFixed(3)}%` },
  }, el('i', { class: 'm-fill fill', style: { width: `${Math.max(0, Math.min(100, Number(pct))).toFixed(2)}%` } }));
  return el('div', {
    ...attrs, class: cls('as-meter', skinny ? 'skinny' : '', inset ? 'inset' : '', stack ? 'stack' : '', pulse ? 'pulse' : '', attrs.class),
    dataset: { ...(attrs.dataset || {}), ...(tone ? { tone } : {}), ...(id ? { res: id } : {}) },
  }, [
    (label || (value !== '' && value != null)) ? el('span', { class: 'm-plate' }, [
      label ? el('span', { class: 'm-label', text: label }) : null,
      value !== '' && value != null ? el('span', { class: 'm-value', text: value }) : null,
    ]) : null,
    el('span', { class: 'm-well' }, track),
  ]);
}
export const meters = (items, attrs = {}) => el('div', { ...attrs, class: cls('as-meters', attrs.class) }, items);
/**
 * slot({ art, count, key, label, small, static, selected, disabled, tag, attrs, className })
 * → `.as-slot`: a square that holds one thing. `art` is a node or a glyph string.
 */
export function slot({ art = '', count = null, key = '', label = '', small = false, static: isStatic = false, selected = false, disabled = false, tag = 'button', id = '', attrs = {}, className = '' } = {}) {
  const node = el(tag, {
    ...attrs, type: tag === 'button' ? 'button' : null, id: id || null,
    class: cls('as-slot', small ? 'sm' : '', isStatic ? 'static' : '', selected ? 'is-selected' : '', className),
    'aria-label': label || attrs['aria-label'] || null,
    'aria-disabled': disabled ? 'true' : (attrs['aria-disabled'] ?? null),
  }, [
    typeof art === 'string' ? el('span', { class: 'sl-art', 'aria-hidden': 'true', text: art }) : art,
    count != null ? pill({ label: String(count), round: true, attrs: { class: 'sl-count' } }) : null,
    key ? keycap(key, { class: 'sl-key' }) : null,
  ]);
  return node;
}
/** pip({ glyph, count, tone, ring, attrs }) → a round status badge with a count. */
export function pip({ glyph: g = '?', count = null, tone = '', ring = false, attrs = {} } = {}) {
  return el('div', { ...attrs, class: cls('as-pip', ring ? 'ring' : '', attrs.class), style: { ...(attrs.style || {}), ...(tone ? { '--pip-tone': tone } : {}) } }, [
    document.createTextNode(String(g)),
    count != null && count !== '' ? pill({ label: String(count), round: true, attrs: { class: 'stk' } }) : null,
  ]);
}
export const pips = (items, attrs = {}) => el('div', { ...attrs, class: cls('as-pips', attrs.class) }, items);

// ---- bands: page-level chrome ----------------------------------------------
/** band({ foot, stack, quiet, tag, attrs, children }) → `.as-band`, a chrome strip. */
export function band({ foot = false, stack = false, quiet = false, tag = 'div', attrs = {}, children = null } = {}) {
  return el(tag, { ...attrs, class: cls('as-band', foot ? 'foot' : '', stack ? 'stack' : '', quiet ? 'quiet' : '', attrs.class) }, children);
}
export const bandRow = (children, attrs = {}) => el('div', { ...attrs, class: cls('as-band-row', attrs.class) }, children);
export const cluster = (children, attrs = {}) => el('div', { ...attrs, class: cls('as-cluster', attrs.class) }, children);
export const cardGrid = (children, attrs = {}) => el('div', { ...attrs, class: cls('as-cardgrid', attrs.class) }, children);

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

// ---- banners, docks, folds, logs ------------------------------------------
// (METER lives once, above: the HUD's anatomy — a plate beside a well — is the
//  one home. An inline meter is that atom with `inset`.)
/** swatch({ color, label, on, attrs, className }) — a colour you can pick; `swatches(list)` is the row. */
export function swatch({ color = '', label = '', on = false, attrs = {}, className = '' } = {}) {
  return el('button', {
    ...attrs, type: 'button', class: cls('as-swatch', on ? 'on' : '', className),
    'aria-label': label || null, 'aria-pressed': on ? 'true' : 'false',
    style: { ...(typeof attrs.style === 'object' ? attrs.style : {}), '--swatch': color },
  });
}
export const swatches = (items, attrs = {}) => el('div', { ...attrs, class: cls('as-swatches', attrs.class), role: attrs.role || 'group' }, items);
/** banner(text, { small }) — a transient announcement; the caller removes it. */
export const banner = (text, { small = false, attrs = {} } = {}) => el('div', { ...attrs, class: cls('as-banner', small ? 'small' : '', attrs.class), role: 'status', text });
/** dock(tabs, { trail }) — a floating strip of Tabs with a trailing Keycap or Pill. */
export const dock = (tabs, { trail = [], attrs = {} } = {}) => el('div', { ...attrs, class: cls('as-dock', attrs.class) }, [
  el('div', { class: 'as-tabs', role: 'tablist' }, tabs),
  ...(Array.isArray(trail) ? trail : [trail]).filter(Boolean),
]);
/** fold({ label, status, children, open, attrs }) — a <details> whose summary is a Row. */
export function fold({ label = '', status = '', children = null, open = false, attrs = {}, className = '' } = {}) {
  const node = el('details', { ...attrs, class: cls('as-fold', className) }, [
    row({ glyph: '›', label, status, tag: 'summary', attrs: { 'aria-expanded': open ? 'true' : 'false' } }),
    el('div', { class: 'fold-body' }, children),
  ]);
  if (open) node.open = true;
  node.addEventListener('toggle', () => node.querySelector(':scope > summary')?.setAttribute('aria-expanded', node.open ? 'true' : 'false'));
  return node;
}
/** logBox(text) — a monospace scroll box. */
export const logBox = (text = '', attrs = {}) => el('pre', { ...attrs, class: cls('as-log', attrs.class), text });
/**
 * pageDoor({ eyebrow, title, size, body, note, secondary, primary, footSize, onClose, closeLabel, className, attrs })
 * A door standing ON the page (no veil): the same head, body and foot as
 * openModal, in the `.screen` frame. Without `onClose` the head has no way
 * out — a decision is answered, not dismissed.
 */
export function pageDoor({ eyebrow: eb = '', title = '', size = 'md', body = null, bodyClassName = '', note = '', secondary = [], primary = null, footSize = 'medium', onClose = null, closeLabel = '', className = '', attrs = {} } = {}) {
  const head = modalHead({ eyebrow: eb, title, closeLabel: closeLabel || (title ? `Close ${title}` : 'Close'), onClose: onClose || undefined });
  if (!onClose) head.querySelector('.modal-close').hidden = true;
  const bodyEl = el('div', { class: cls('modal-body', bodyClassName) }, body);
  const ways = (Array.isArray(secondary) ? secondary : [secondary]).filter(Boolean);
  const foot = (note || ways.length || primary) ? modalFooter({ note, secondary: ways, primary, size: footSize }) : null;
  if (foot) foot.querySelector('.modal-foot-actions')?.classList.add('modal-btnrow');
  const door = el('section', {
    ...attrs, class: cls('modal as-pagedoor', className), dataset: { ...(attrs.dataset || {}), size },
    role: attrs.role || 'region', 'aria-label': attrs['aria-label'] || title || null,
  }, [head, bodyEl, foot]);
  return Object.assign(door, { head, body: bodyEl, foot });
}

// ---- the tooltip's `full` tier ----------------------------------------------
// A tooltip that outgrows `expanded`, or a click on an expandable target,
// opens the same content as body B at the md rung — through the one
// door-opener, so it has a head, a foot, a way out and a scroll container.
import { registerTooltipExpander } from '../components/tooltip.js';
// Registered on the next microtask, not at evaluation: on the cycle named
// above this file can evaluate before tooltip.js, whose `expander` slot would
// still be in its dead zone. By the microtask every module has run.
queueMicrotask(() => registerTooltipExpander((markup, { title = '', eyebrow = 'Detail' } = {}) => {
  const body = el('div', { class: 'as-detailbody' }, el('div', { class: 'lines', html: markup }));
  const done = button({ label: 'Close', weight: 'primary' });
  const door = openModal({ size: 'md', eyebrow, title: title || 'Detail', body, primary: done, footSize: 'short' });
  done.addEventListener('click', door.close);
  return door;
}));
