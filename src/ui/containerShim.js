// Container queries for a browser without them (Safari before 16, iOS 15's
// Safari 15.6 included). docs/qa/IOS15-COMPAT.md rows 2-4.
//
// src/ui/legacyCss.js rewrites the stylesheets: every `@container` block becomes
// rules gated on `:where([data-cq~="K"])` (K = index into `queries`), every
// `Ncqw` becomes `calc(N * var(--cqw))`, and every `container*` declaration is
// recorded in `containers`. This module is the other half: it finds the
// container elements, measures them with a ResizeObserver, and keeps on each one
//
//   data-cq     "3 7 12"   the queries it currently satisfies
//   data-cq-no  "5"        the unsatisfied queries of the kind that must exclude
//                          their descendants (see below)
//   --cqw/--cqh            1% of its content width/height, for the cq units
//
// What it does not do, and the limits that follow:
//  * Size containment is not emulated (no `contain: inline-size`), so a container
//    whose width used to ignore its content now sizes to it.
//  * "Nearest container" is exact for named queries (the name picks the
//    element). For an unnamed query the attribute sits on EVERY container that
//    satisfies it, so a descendant also sees an outer container that satisfies
//    it. That is right for max-width queries (an inner box is never wider than
//    its outer one) and, for min-width queries, `data-cq-no` on the failing
//    inner container excludes the rule, which is what `exclude` queries emit.
//  * A container's own cq units resolve against its own size (--cqw is set on
//    it), not its parent's. No stylesheet rule depends on the difference.
//  * Width/height are read from computed style (the element's own, zoom-local,
//    CSS pixels), minus padding and border when box-sizing is border-box.

import { ReplaceCqUnits } from './legacyCss.js';

// An element whose own style says it is a container, or that a script marked: a browser without container
// queries drops `container-type` from a CSSOM-written style, so such a script sets data-container too.
const INLINE_STYLE_SELECTOR = '[style*="container"], [data-container]';
const HAS_CQ = /cq(?:w|h|i|b|min|max)\b/i;

const CONTAINING_TYPES = new Set(['size', 'inline-size']);

/** Evaluate a parsed `@container` condition (legacyCss.ParseCondition) against a container's measurements. */
export function EvaluateCondition(node, m) {
  if (!node) return false;
  if (node.t === 'and') return node.a.every((n) => EvaluateCondition(n, m));
  if (node.t === 'or') return node.a.some((n) => EvaluateCondition(n, m));
  if (node.t === 'not') return !EvaluateCondition(node.a, m);
  if (node.t !== 'cmp') return false;
  if (node.f === 'orientation') {
    if (m.type !== 'size') return false;
    return node.v === (m.height >= m.width ? 'portrait' : 'landscape') && node.op === '=';
  }
  // A height feature needs a size container: an inline-size one cannot answer it, so it fails (CSS Containment 3).
  if ((node.f === 'height' || node.f === 'aspect') && m.type !== 'size') return false;
  let actual, wanted;
  if (node.f === 'aspect') { actual = m.width / m.height; wanted = node.v.ratio ?? node.v.n; } else {
    actual = node.f === 'width' ? m.width : m.height;
    const { n, u } = node.v;
    const pixels = { '': 1, px: 1, rem: m.rem, em: m.em, vw: m.vw / 100, vh: m.vh / 100, vmin: Math.min(m.vw, m.vh) / 100, vmax: Math.max(m.vw, m.vh) / 100 }[u];
    if (pixels === undefined || n === undefined) return false;
    wanted = n * pixels;
  }
  if (!Number.isFinite(actual) || !Number.isFinite(wanted)) return false;
  switch (node.op) {
    case '<': return actual < wanted;
    case '<=': return actual <= wanted;
    case '>': return actual > wanted;
    case '>=': return actual >= wanted;
    default: return Math.abs(actual - wanted) < 0.01;
  }
}

/** The tokens a measured container earns: { cq: [keys satisfied], no: [keys unsatisfied that exclude] }. */
export function TokensFor(queries, names, m) {
  const cq = [], no = [];
  queries.forEach((query, key) => {
    if (query.name && !names.includes(query.name)) return;
    if (EvaluateCondition(query.condition, m)) cq.push(key); else if (query.exclude) no.push(key);
  });
  return { cq, no };
}

/** What the rules and the inline style say a given element is: { type, names } or null when it is no container. */
export function ContainerOf(element, containers) {
  let type, names = [];
  for (const rule of containers) {
    let hit = false;
    try { hit = element.matches(rule.selector); } catch { hit = false; }
    if (!hit) continue;
    if (rule.type !== undefined) type = rule.type;
    if (rule.names !== undefined) names = rule.names;
  }
  const marker = element.getAttribute?.('data-container');
  if (marker) type = marker.toLowerCase();
  const inline = element.getAttribute?.('style');
  if (inline && inline.includes('container')) {
    const shorthand = /(?:^|;)\s*container\s*:\s*([^;/]*)(?:\/\s*([\w-]+))?/i.exec(inline);
    const longType = /container-type\s*:\s*([\w-]+)/i.exec(inline), longName = /container-name\s*:\s*([^;]+)/i.exec(inline);
    if (shorthand) { names = shorthand[1].trim().split(/\s+/).filter(Boolean); type = shorthand[2]?.trim().toLowerCase() || 'normal'; }
    if (longType) type = longType[1].toLowerCase();
    if (longName) names = longName[1].trim().split(/\s+/).filter(Boolean);
  }
  return CONTAINING_TYPES.has(type) ? { type, names } : null;
}

/**
 * Start tracking containers on `win`'s document. `queries` and `containers` are the registry legacyCss filled.
 * Returns { refresh, stop, tracked }.
 */
export function StartContainerShim({ win = globalThis.window, queries, containers }) {
  const doc = win.document;
  const valid = [];
  for (const rule of containers) {
    try { doc.documentElement.matches(rule.selector); valid.push(rule); } catch { /* an invalid selector names nothing here */ }
  }
  const union = [...new Set(valid.filter((r) => r.type !== undefined && r.type !== 'normal').map((r) => r.selector)), INLINE_STYLE_SELECTOR].join(', ');
  const tracked = new Map();            // element -> { type, names, written: { cq, no, w, h } }
  const observer = new win.ResizeObserver((entries) => {
    // Shallow first: a change to an outer container's tokens can resize an inner one, which the
    // observer then delivers in the same frame; the other order raises "loop completed with undelivered notifications".
    const depth = (el) => { let d = 0; for (let n = el; n; n = n.parentElement) d += 1; return d; };
    entries.map((e) => e.target).sort((a, b) => depth(a) - depth(b)).forEach(update);
  });

  const px = (value) => parseFloat(value) || 0;
  function measure(element, info) {
    const cs = win.getComputedStyle(element);
    let width = parseFloat(cs.width), height = parseFloat(cs.height);
    if (Number.isNaN(width) || Number.isNaN(height)) return null;
    if (cs.boxSizing === 'border-box') {
      width -= px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
      height -= px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
    }
    const root = element === doc.documentElement ? cs : win.getComputedStyle(doc.documentElement);
    return { type: info.type, width: Math.max(0, width), height: Math.max(0, height), rem: px(root.fontSize) || 16, em: px(cs.fontSize) || 16, vw: win.innerWidth, vh: win.innerHeight };
  }
  function update(element) {
    const info = tracked.get(element);
    if (!info || !element.isConnected) return;
    const m = measure(element, info);
    if (!m) return;
    const { cq, no } = TokensFor(queries, info.names, m);
    const next = { cq: cq.join(' '), no: no.join(' '), w: `${Math.round(m.width * 100) / 10000}px`, h: `${Math.round(m.height * 100) / 10000}px` };
    const was = info.written;
    // Only write what changed: a write is a mutation, and the page watches mutations.
    if (was.cq !== next.cq) { if (next.cq) element.setAttribute('data-cq', next.cq); else element.removeAttribute('data-cq'); }
    if (was.no !== next.no) { if (next.no) element.setAttribute('data-cq-no', next.no); else element.removeAttribute('data-cq-no'); }
    if (was.w !== next.w) element.style.setProperty('--cqw', next.w);
    if (info.type === 'size' && was.h !== next.h) element.style.setProperty('--cqh', next.h);
    info.written = next;
  }
  function track(element) {
    const found = ContainerOf(element, valid);
    const current = tracked.get(element);
    if (!found) { if (current) untrack(element); return; }
    if (current) return;                // already measured: a moved node keeps its container, and its tokens
    if (!element.hasAttribute('data-container') && /container/i.test(element.getAttribute('style') || '')) element.setAttribute('data-container', found.type);
    tracked.set(element, { ...found, written: { cq: '', no: '', w: '', h: '' } });
    observer.observe(element);
  }
  function untrack(element) {
    if (!tracked.delete(element)) return;
    observer.unobserve(element);
  }
  // `style="font-size:7.8cqw"` text is kept by the parser even where the unit is not understood, so it can be
  // rewritten in place; this runs in the mutation callback, a microtask before the next paint.
  function repairInlineStyle(element) {
    const text = element.getAttribute('style');
    if (text && HAS_CQ.test(text)) element.setAttribute('style', ReplaceCqUnits(text));
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    // Containers first: once style.setProperty rewrites a style attribute, its container-type text is gone.
    if (root.matches(union)) track(root);
    root.querySelectorAll(union).forEach(track);
    if (root.matches('[style*="cq"]')) repairInlineStyle(root);
    root.querySelectorAll('[style*="cq"]').forEach(repairInlineStyle);
  }
  function forget(root) {
    if (root.nodeType !== 1 || root.isConnected) return;
    if (tracked.has(root)) untrack(root);
    root.querySelectorAll(union).forEach((el) => { if (!el.isConnected) untrack(el); });
  }

  const mutations = new win.MutationObserver((records) => {
    for (const record of records) record.removedNodes.forEach(forget);
    for (const record of records) record.addedNodes.forEach(scan);
  });
  let refreshing = 0;
  function refresh() {
    if (refreshing) return;
    refreshing = win.requestAnimationFrame(() => { refreshing = 0; tracked.forEach((_, element) => update(element)); });
  }
  // The root's font size and layout attributes change the rem/viewport answers without resizing the container.
  const rootWatch = new win.MutationObserver(refresh);
  win.addEventListener('resize', refresh);

  scan(doc.documentElement);
  mutations.observe(doc.documentElement, { childList: true, subtree: true });
  rootWatch.observe(doc.documentElement, { attributes: true, attributeFilter: ['class', 'data-layout', 'data-view-preset', 'data-text-size', 'lang'] });
  return {
    refresh,
    tracked,
    stop() { observer.disconnect(); mutations.disconnect(); rootWatch.disconnect(); win.removeEventListener('resize', refresh); tracked.clear(); },
  };
}
