// Rewrites the game's stylesheets for a browser that lacks a CSS feature the
// game uses, so an iPhone SE 1st gen (iOS 15.8 = Safari 15.6) lays out like a
// current one. Pure text in, text out, no DOM: tests/ios15-legacy-css.test.mjs
// runs it under node, src/ui/legacyBrowser.js runs it in the page.
// docs/qa/IOS15-COMPAT.md is the audit this answers.
//
// THIS FILE RUNS ONLY IN THE BROWSERS IT REPAIRS. It must itself parse in
// Safari 15.6: no RegExp lookbehind, no .toSorted, no static blocks.
//
// Every repair is gated by a flag the caller got from CSS.supports(), so a
// browser that has the feature gets its stylesheets untouched, byte for byte.
// A repair REPLACES the declaration (the browser would have dropped it anyway),
// which is also what lets Chromium, forced to take this path, show what iOS 15
// shows.
//
//   colorMix       color-mix(in srgb, A p%, B q%) -> a static rgba(), computed
//                  (premultiplied sRGB, as CSS Color 5) from the `:root` token
//                  table. A mix that cannot be resolved drops its declaration.
//   cqUnits        1.5cqw -> calc(1.5 * var(--cqw, 1%)); the container tracker
//                  (containerShim.js) publishes --cqw/--cqh on each container.
//   containers     `container*` declarations are removed and recorded, and each
//                  `@container` block is replaced IN PLACE by its rules gated on
//                  `data-cq` tokens the tracker keeps on the container element.
//   overflowClip   overflow: clip -> hidden (Safari 16).
//   userSelect     adds -webkit-user-select (Safari still needs the prefix).
//   backdropFilter adds -webkit-backdrop-filter.
//   popover        :popover-open -> [data-popover-open] (popoverPolyfill.js).

export const FLAGS = ['colorMix', 'cqUnits', 'containers', 'overflowClip', 'userSelect', 'backdropFilter', 'popover'];

/** Which repairs this browser needs, from CSS.supports (a function (prop, value) or (condition)). */
export function DetectFlags(supports) {
  const ok = (...args) => { try { return !!supports(...args); } catch { return true; } };
  const gaps = {
    colorMix: !ok('color', 'color-mix(in srgb, red 50%, blue)'),
    cqUnits: !ok('width', '1cqw'),
    containers: !ok('container-type', 'inline-size'),
    overflowClip: !ok('overflow', 'clip'),
    popover: !ok('selector(:popover-open)'),
  };
  // The -webkit- prefixes are NOT probed: unprefixed user-select and backdrop-filter are missing from Safari well past
  // 17, so probing them would run the full rewrite (and switch text selection off) on current iPhones. They ride along
  // only when a real Safari 15/16 gap already starts the rewrite.
  const rewriting = Object.values(gaps).some(Boolean);
  return { ...gaps, userSelect: rewriting, backdropFilter: rewriting };
}

export const AnyFlag = (flags) => FLAGS.some((name) => flags[name]);

/** State shared by every stylesheet of one page: the token table, the container queries and the containers found. */
export function CreateContext() {
  return { vars: new Map(), loose: new Map(), queries: [], queryKeys: new Map(), containers: [], unresolvedColorMix: [], approximatedColorMix: [] };
}

// ---------------------------------------------------------------------------
// A small CSS scanner: just enough to tell a rule from its body without being
// fooled by strings, comments, url(data:...;base64,...) or calc() parentheses.
// ---------------------------------------------------------------------------

function skipComment(s, i) { const end = s.indexOf('*/', i + 2); return end < 0 ? s.length : end + 2; }
function skipString(s, i) {
  const quote = s[i];
  for (let j = i + 1; j < s.length; j += 1) { if (s[j] === '\\') j += 1; else if (s[j] === quote) return j + 1; }
  return s.length;
}
function skipParens(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j += 1) {
    const c = s[j];
    if (c === '"' || c === "'") j = skipString(s, j) - 1;
    else if (c === '/' && s[j + 1] === '*') j = skipComment(s, j) - 1;
    else if (c === '(') depth += 1;
    else if (c === ')') { depth -= 1; if (depth === 0) return j + 1; }
  }
  return s.length;
}
function matchBrace(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j += 1) {
    const c = s[j];
    if (c === '"' || c === "'") j = skipString(s, j) - 1;
    else if (c === '/' && s[j + 1] === '*') j = skipComment(s, j) - 1;
    else if (c === '(') j = skipParens(s, j) - 1;
    else if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return j; }
  }
  return s.length;
}

/** Split `text` at top-level occurrences of `sep` (outside strings, comments, parentheses, brackets, braces). */
export function SplitTop(text, sep) {
  const parts = [];
  let start = 0, square = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'") i = skipString(text, i) - 1;
    else if (c === '/' && text[i + 1] === '*') i = skipComment(text, i) - 1;
    else if (c === '(') i = skipParens(text, i) - 1;
    else if (c === '[') square += 1;
    else if (c === ']') square -= 1;
    else if (c === '{') i = matchBrace(text, i);
    else if (c === sep && square === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** A stylesheet (or a block body) as a list of `{ prelude, body }` blocks and `{ raw }` statements. */
export function ParseBlocks(css) {
  const out = [];
  let start = 0;
  for (let i = 0; i < css.length; i += 1) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') i = skipComment(css, i) - 1;
    else if (c === '"' || c === "'") i = skipString(css, i) - 1;
    else if (c === '(') i = skipParens(css, i) - 1;
    else if (c === ';') { out.push({ raw: css.slice(start, i + 1) }); start = i + 1; }
    else if (c === '{') {
      const end = matchBrace(css, i);
      out.push({ prelude: css.slice(start, i), body: css.slice(i + 1, end) });
      i = end; start = end + 1;
    }
  }
  if (start < css.length) out.push({ raw: css.slice(start) });
  return out;
}

const emit = (blocks) => blocks.map((b) => (b.raw !== undefined ? b.raw : `${b.prelude}{${b.body}}`)).join('');

// ---------------------------------------------------------------------------
// Colours: enough of CSS Color to evaluate the mixes the game writes.
// ---------------------------------------------------------------------------

const NAMED = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], lime: [0, 255, 0], blue: [0, 0, 255], yellow: [255, 255, 0],
  cyan: [0, 255, 255], aqua: [0, 255, 255], magenta: [255, 0, 255], fuchsia: [255, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128],
  silver: [192, 192, 192], maroon: [128, 0, 0], olive: [128, 128, 0], green: [0, 128, 0], purple: [128, 0, 128], teal: [0, 128, 128],
  navy: [0, 0, 128], orange: [255, 165, 0], gold: [255, 215, 0],
};

function number(text, scale = 1) {
  const t = String(text).trim();
  if (t.endsWith('%')) return (parseFloat(t) / 100) * scale;
  return parseFloat(t);
}

/** A colour string -> { r, g, b, a } (0-255, 0-1), or null when it is not a constant colour. */
export function ParseColor(text, ctx, depth = 0) {
  const t = stripComments(String(text)).trim();
  if (!t || depth > 8) return null;
  const lower = t.toLowerCase();
  if (lower === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (NAMED[lower]) { const [r, g, b] = NAMED[lower]; return { r, g, b, a: 1 }; }
  let m = /^#([0-9a-f]{3,8})$/i.exec(t);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^(rgba?|hsla?)\(([\s\S]*)\)$/i.exec(t);
  if (m) {
    const parts = m[2].replace('/', ',').split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const a = parts.length > 3 ? Math.max(0, Math.min(1, number(parts[3]))) : 1;
    if (Number.isNaN(a)) return null;
    if (m[1].toLowerCase().startsWith('rgb')) {
      const c = parts.slice(0, 3).map((p) => (p.endsWith('%') ? number(p, 255) : number(p)));
      return c.some(Number.isNaN) ? null : { r: c[0], g: c[1], b: c[2], a };
    }
    const hue = (((parseFloat(parts[0]) % 360) + 360) % 360) / 360, s = number(parts[1], 1), l = number(parts[2], 1);
    if ([hue, s, l].some(Number.isNaN)) return null;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const channel = (tt) => { const u = (tt + 1) % 1; return 255 * (u < 1 / 6 ? p + (q - p) * 6 * u : u < 0.5 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p); };
    return { r: channel(hue + 1 / 3), g: channel(hue), b: channel(hue - 1 / 3), a };
  }
  m = /^var\(([\s\S]*)\)$/i.exec(t);
  if (m) {
    const [name, ...fallback] = SplitTop(m[1], ',');
    const known = ctx?.vars.get(name.trim()) ?? ctx?.loose.get(name.trim());
    const own = known !== undefined ? ParseColor(known, ctx, depth + 1) : null;
    if (own) return own;
    return fallback.length ? ParseColor(fallback.join(','), ctx, depth + 1) : null;
  }
  if (/^color-mix\(/i.test(t)) return MixColors(t, ctx, depth + 1);
  return null;
}

/** `color-mix(in srgb, A p%, B q%)` -> { r, g, b, a } using premultiplied sRGB, or null. */
export function MixColors(text, ctx, depth = 0) {
  const m = /^color-mix\(([\s\S]*)\)$/i.exec(stripComments(text).trim());
  if (!m) return null;
  const args = SplitTop(m[1], ',').map((a) => a.trim());
  if (args.length !== 3 || !/^in\s+srgb$/i.test(args[0])) return null;
  const operand = (arg) => {
    let mm = /^([\s\S]*?)\s+(-?[\d.]+)%$/.exec(arg);
    if (mm) return { color: ParseColor(mm[1], ctx, depth + 1), pct: parseFloat(mm[2]) };
    mm = /^(-?[\d.]+)%\s+([\s\S]*)$/.exec(arg);
    if (mm) return { color: ParseColor(mm[2], ctx, depth + 1), pct: parseFloat(mm[1]) };
    return { color: ParseColor(arg, ctx, depth + 1), pct: null };
  };
  const one = operand(args[1]), two = operand(args[2]);
  // A runtime-only operand (a custom property a script sets inline) has no static value: the nearest static colour is
  // the other operand, which is what a mostly-that-colour mix looks like.
  if (!one.color && !two.color) return null;
  if (!one.color || !two.color) { if (ctx) ctx.approximatedColorMix.push(text.trim()); return one.color || two.color; }
  let p1 = one.pct, p2 = two.pct;
  if (p1 === null && p2 === null) { p1 = 50; p2 = 50; } else if (p1 === null) p1 = 100 - p2; else if (p2 === null) p2 = 100 - p1;
  const sum = p1 + p2;
  if (!(sum > 0) || p1 < 0 || p2 < 0) return null;
  const w1 = p1 / sum, w2 = p2 / sum, scale = Math.min(sum, 100) / 100;
  const a = one.color.a * w1 + two.color.a * w2;
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (k) => (one.color[k] * one.color.a * w1 + two.color[k] * two.color.a * w2) / a;
  return { r: mix('r'), g: mix('g'), b: mix('b'), a: a * scale };
}

export function ColorToCss({ r, g, b, a }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const alpha = Math.round(Math.max(0, Math.min(1, a)) * 1000) / 1000;
  return `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${alpha})`;
}

/** Every `color-mix(...)` in `value` replaced by its static colour; null when any one cannot be resolved. */
export function ReplaceColorMix(value, ctx) {
  let out = '', i = 0;
  const lower = value.toLowerCase();
  for (;;) {
    const at = lower.indexOf('color-mix(', i);
    if (at < 0) return out + value.slice(i);
    const end = skipParens(value, at + 'color-mix'.length);
    const color = MixColors(value.slice(at, end), ctx);
    if (!color) return null;
    out += value.slice(i, at) + ColorToCss(color);
    i = end;
  }
}

// ---------------------------------------------------------------------------
// Container query units and container queries.
// ---------------------------------------------------------------------------

const CQ_UNIT = /(-?)(\d*\.?\d+)(cqw|cqh|cqi|cqb|cqmin|cqmax)(?![\w-])/gi;
const CQ_VARIABLE = { cqw: '--cqw', cqi: '--cqw', cqh: '--cqh', cqb: '--cqh' };

/** `1.5cqw` -> `calc(1.5 * var(--cqw, 1%))`, `-.5cqw` -> `calc(-.5 * var(--cqw, 1%))`. */
export function ReplaceCqUnits(value) {
  return value.replace(CQ_UNIT, (whole, sign, n, unit) => {
    const u = unit.toLowerCase();
    const one = (name) => `var(${name}, 1%)`;
    const unitExpr = u === 'cqmin' ? `min(${one('--cqw')}, ${one('--cqh')})` : u === 'cqmax' ? `max(${one('--cqw')}, ${one('--cqh')})` : one(CQ_VARIABLE[u]);
    return `calc(${sign}${n} * ${unitExpr})`;
  });
}

const LENGTH = /^(-?\d*\.?\d+)(px|rem|em|vw|vh|vmin|vmax)?$/i;
function parseValue(text) {
  const t = text.trim().toLowerCase();
  if (t === 'portrait' || t === 'landscape') return t;
  const ratio = /^(\d*\.?\d+)\s*\/\s*(\d*\.?\d+)$/.exec(t);
  if (ratio) return { ratio: parseFloat(ratio[1]) / parseFloat(ratio[2]) };
  const m = LENGTH.exec(t);
  return m ? { n: parseFloat(m[1]), u: (m[2] || '').toLowerCase() } : null;
}
const FEATURE = { width: 'width', 'inline-size': 'width', height: 'height', 'block-size': 'height', 'aspect-ratio': 'aspect', orientation: 'orientation' };
const FLIP = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '=': '=' };

function parseFeature(text) {
  const t = text.trim();
  let m = /^(min-|max-)?([a-z-]+)\s*:\s*([\s\S]+)$/i.exec(t);
  if (m && FEATURE[m[2].toLowerCase()]) {
    const v = parseValue(m[3]);
    if (!v) return null;
    return { t: 'cmp', f: FEATURE[m[2].toLowerCase()], op: m[1] ? (m[1].toLowerCase() === 'min-' ? '>=' : '<=') : '=', v };
  }
  const parts = t.split(/(<=|>=|<|>|=)/).map((p) => p.trim());
  if (parts.length === 3) {
    const [a, op, b] = parts;
    if (FEATURE[a.toLowerCase()]) { const v = parseValue(b); return v ? { t: 'cmp', f: FEATURE[a.toLowerCase()], op, v } : null; }
    if (FEATURE[b.toLowerCase()]) { const v = parseValue(a); return v ? { t: 'cmp', f: FEATURE[b.toLowerCase()], op: FLIP[op], v } : null; }
  }
  if (parts.length === 5 && FEATURE[parts[2].toLowerCase()]) {
    const lo = parseValue(parts[0]), hi = parseValue(parts[4]), f = FEATURE[parts[2].toLowerCase()];
    if (lo && hi) return { t: 'and', a: [{ t: 'cmp', f, op: FLIP[parts[1]], v: lo }, { t: 'cmp', f, op: parts[3], v: hi }] };
  }
  return null;
}

/** The condition of an `@container` prelude as a small tree, or null when it uses something unsupported (style(), scroll-state()). */
export function ParseCondition(text) {
  const src = stripComments(text).trim();
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i += 1; };
  const word = () => { const m = /^[a-z-]+/i.exec(src.slice(i)); return m ? m[0].toLowerCase() : ''; };
  function term() {
    ws();
    if (word() === 'not') { i += 3; const inner = term(); return inner && { t: 'not', a: inner }; }
    if (src[i] !== '(') return null;
    const end = skipParens(src, i), inside = src.slice(i + 1, end - 1);
    i = end;
    if (/^\s*\(/.test(inside) || /^\s*not\b/i.test(inside)) { const sub = ParseCondition(inside); return sub; }
    return parseFeature(inside);
  }
  function expr() {
    const first = term();
    if (!first) return null;
    const items = [first];
    let op = null;
    for (;;) {
      ws();
      const w = word();
      if (w !== 'and' && w !== 'or') break;
      if (op && op !== w) return null;
      op = w; i += w.length;
      const next = term();
      if (!next) return null;
      items.push(next);
    }
    return items.length === 1 ? first : { t: op, a: items };
  }
  const tree = expr();
  ws();
  return tree && i >= src.length ? tree : null;
}

const asksForMinimum = (node) => (node.t === 'cmp' ? node.op === '>' || node.op === '>=' : node.t === 'not' ? false : (node.a || []).some(asksForMinimum));

/** `@container` prelude -> { name, condition } or null. */
export function ParseContainerPrelude(prelude) {
  const text = stripComments(prelude).replace(/^\s*@container\b/i, '').trim();
  let name = null, rest = text;
  const m = /^([a-z_][\w-]*)\s*(?=\(|$)/i.exec(text);
  if (m && !/^(not|and|or|style)$/i.test(m[1])) { name = m[1]; rest = text.slice(m[0].length); }
  const condition = ParseCondition(rest);
  return condition ? { name, condition } : null;
}

function registerQuery(ctx, name, condition) {
  const id = `${name || ''}|${JSON.stringify(condition)}`;
  let key = ctx.queryKeys.get(id);
  if (key === undefined) {
    key = ctx.queries.length;
    ctx.queries.push({ name, condition, exclude: !name && asksForMinimum(condition) });
    ctx.queryKeys.set(id, key);
  }
  return key;
}

// Where the last compound of a complex selector ends, before a trailing pseudo-element.
function subjectEnd(selector) {
  let square = 0;
  let lastPseudo = -1;
  for (let i = 0; i < selector.length; i += 1) {
    const c = selector[i];
    if (c === '(') i = skipParens(selector, i) - 1;
    else if (c === '[') square += 1;
    else if (c === ']') square -= 1;
    else if (c === ':' && square === 0 && selector[i + 1] === ':') { lastPseudo = i; i += 1; }
    else if ((c === ' ' || c === '>' || c === '+' || c === '~') && square === 0) lastPseudo = -1;
  }
  return lastPseudo < 0 ? selector.length : lastPseudo;
}

const ROOT_COMPOUND = /^(:root|html)(?![\w-])/i;

/** One selector gated on container-query token `key`; null when it could never match (it names the container itself). */
export function GateSelector(selector, key, exclude) {
  const s = selector.trim();
  if (!s) return null;
  const token = `:where([data-cq~="${key}"])`;
  const block = exclude ? `:not(:where([data-cq-no~="${key}"]) *)` : '';
  const withBlock = (text) => { const at = subjectEnd(text); return text.slice(0, at) + block + text.slice(at); };
  const root = ROOT_COMPOUND.exec(s);
  if (root) {
    // :root is the container itself for the viewport queries. A native container query never matches its own
    // container, so a selector that ends at the root compound is dead; one that goes on to descendants gates on it.
    let i = root[0].length, square = 0, descends = false;
    for (; i < s.length; i += 1) {
      const c = s[i];
      if (c === '(') i = skipParens(s, i) - 1;
      else if (c === '[') square += 1;
      else if (c === ']') square -= 1;
      else if (square === 0 && /[\s>+~]/.test(c)) { descends = true; break; }
    }
    if (!descends) return null;
    return withBlock(root[0] + token + s.slice(root[0].length));
  }
  return withBlock(`${token} ${s}`);
}

// ---------------------------------------------------------------------------
// The rewrite
// ---------------------------------------------------------------------------

const NESTS_RULES = /^@(?:media|supports|layer|document|scope|keyframes|-webkit-keyframes)\b/i;

function containerDeclaration(prop, value) {
  if (prop === 'container-type') return { type: /^(size|inline-size)$/i.test(value.trim()) ? value.trim().toLowerCase() : 'normal' };
  if (prop === 'container-name') return { names: value.trim().toLowerCase() === 'none' ? [] : value.trim().split(/\s+/) };
  if (prop === 'container') {
    const [names, type] = value.split('/');
    const list = names.trim().toLowerCase() === 'none' ? [] : names.trim().split(/\s+/).filter(Boolean);
    return { names: list, type: type && /^(size|inline-size)$/i.test(type.trim()) ? type.trim().toLowerCase() : 'normal' };
  }
  return null;
}

function rewriteDeclarations(body, selector, flags, ctx) {
  const pieces = SplitTop(body, ';');
  const hasPrefixed = (prop) => pieces.some((p) => stripComments(p).trim().toLowerCase().startsWith(`${prop}:`));
  const declared = {};
  const out = [];
  for (const piece of pieces) {
    const clean = stripComments(piece);
    const colon = clean.indexOf(':');
    if (colon < 0) { out.push(piece); continue; }
    const prop = clean.slice(0, colon).trim().toLowerCase();
    let value = clean.slice(colon + 1);
    const lead = /^\s*/.exec(piece)[0];
    const pre = (text) => `${lead}${prop}:${text}`;
    if (flags.containers && (prop === 'container-type' || prop === 'container-name' || prop === 'container')) {
      Object.assign(declared, containerDeclaration(prop, value));
      continue;
    }
    let changed = false;
    if (flags.colorMix && /color-mix\(/i.test(value)) {
      const replaced = ReplaceColorMix(value, ctx);
      if (replaced === null) { ctx.unresolvedColorMix.push(`${selector.trim()} { ${prop}:${value.trim()} }`); continue; }
      value = replaced; changed = true;
    }
    if (flags.cqUnits && /cq(?:w|h|i|b|min|max)\b/i.test(value)) { value = ReplaceCqUnits(value); changed = true; }
    if (flags.overflowClip && (prop === 'overflow' || prop === 'overflow-x' || prop === 'overflow-y') && /\bclip\b/i.test(value)) { value = value.replace(/\bclip\b/gi, 'hidden'); changed = true; }
    if (flags.userSelect && prop === 'user-select' && !hasPrefixed('-webkit-user-select')) out.push(`${lead}-webkit-user-select:${value}`);
    if (flags.backdropFilter && prop === 'backdrop-filter' && !hasPrefixed('-webkit-backdrop-filter')) out.push(`${lead}-webkit-backdrop-filter:${value}`);
    out.push(changed ? pre(value) : piece);
  }
  if (flags.containers && Object.keys(declared).length) ctx.containers.push({ selector: selector.trim(), ...declared });
  // The declaration list keeps its original separators: a piece that was dropped leaves no dangling ";".
  return out.join(';');
}

function rewriteSelector(prelude, flags) {
  return flags.popover && /:popover-open/.test(prelude) ? prelude.replace(/:popover-open/g, '[data-popover-open]') : prelude;
}

function rewriteBlocks(blocks, flags, ctx, gates) {
  const out = [];
  for (const block of blocks) {
    if (block.raw !== undefined) { out.push(block); continue; }
    const head = stripComments(block.prelude).trim();
    if (head.startsWith('@')) {
      if (/^@container\b/i.test(head) && flags.containers) {
        const parsed = ParseContainerPrelude(head);
        if (!parsed) continue;                                    // a query this shim does not understand matches nothing
        const key = registerQuery(ctx, parsed.name, parsed.condition);
        const inner = rewriteBlocks(ParseBlocks(block.body), flags, ctx, [...gates, { key, exclude: ctx.queries[key].exclude }]);
        out.push(...inner);
      } else if (NESTS_RULES.test(head) || /^@container\b/i.test(head)) {
        out.push({ prelude: block.prelude, body: emit(rewriteBlocks(ParseBlocks(block.body), flags, ctx, gates)) });
      } else {
        out.push(block);
      }
      continue;
    }
    let selectors = rewriteSelector(block.prelude, flags);
    if (gates.length) {
      const gated = [];
      for (const sel of SplitTop(stripComments(selectors), ',')) {
        let current = sel;
        for (const gate of gates) { current = current === null ? null : GateSelector(current, gate.key, gate.exclude); }
        if (current !== null) gated.push(current);
      }
      if (!gated.length) continue;
      selectors = gated.join(', ');
    }
    out.push({ prelude: selectors, body: rewriteDeclarations(block.body, stripComments(block.prelude), flags, ctx) });
  }
  return out;
}

/** Read the `:root { --token: colour }` table (last declaration wins) so color-mix can resolve var(--token). */
export function CollectVars(css, ctx) {
  const visit = (blocks) => {
    for (const block of blocks) {
      if (block.raw !== undefined) continue;
      const head = stripComments(block.prelude).trim();
      if (head.startsWith('@')) { if (NESTS_RULES.test(head)) visit(ParseBlocks(block.body)); continue; }
      const root = /^(?::root|html)$/i.test(head);
      for (const piece of SplitTop(block.body, ';')) {
        const clean = stripComments(piece), colon = clean.indexOf(':');
        if (colon < 0) continue;
        const prop = clean.slice(0, colon).trim();
        if (!prop.startsWith('--')) continue;
        const value = clean.slice(colon + 1).trim();
        // The :root table is the theme. A token defined only on some component (--level-ready-blue on .reward-door)
        // still gets its first value as a fallback so a mix on that component resolves.
        if (root) ctx.vars.set(prop, value);
        else if (!ctx.loose.has(prop) && ParseColor(value, ctx)) ctx.loose.set(prop, value);
      }
    }
  };
  visit(ParseBlocks(css));
}

/** One stylesheet's text, repaired for the flags that are set. Unchanged text comes back as the same string. */
export function DownlevelCss(css, flags, ctx = CreateContext()) {
  if (!AnyFlag(flags)) return css;
  return emit(rewriteBlocks(ParseBlocks(css), flags, ctx, []));
}
