// src/ui/legacyCss.js: the stylesheet rewriter for Safari before 16 (iOS 15). docs/qa/IOS15-COMPAT.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CollectVars, ColorToCss, CreateContext, DetectFlags, DownlevelCss, FLAGS, GateSelector, MixColors, ParseColor, ParseCondition,
  ParseContainerPrelude, ReplaceColorMix, ReplaceCqUnits, SplitTop,
} from '../src/ui/legacyCss.js';

const ALL = Object.fromEntries(FLAGS.map((name) => [name, true]));
const NONE = Object.fromEntries(FLAGS.map((name) => [name, false]));
const only = (...names) => ({ ...NONE, ...Object.fromEntries(names.map((n) => [n, true])) });
const squash = (css) => css.replace(/\s+/g, ' ').trim();
const withVars = (css = ':root { --gold: #c9a227; --panel: #241d15; --bg: #0d0b08; }') => { const c = CreateContext(); CollectVars(css, c); return c; };

test('DetectFlags asks CSS.supports and flags what is missing', () => {
  const modern = () => true, ios15 = (prop, value) => {
    const text = value === undefined ? prop : `${prop}: ${value}`;
    return !/color-mix|cqw|container-type|clip|user-select|backdrop-filter|popover-open/.test(text);
  };
  assert.deepEqual(Object.values(DetectFlags(modern)).filter(Boolean), []);
  assert.deepEqual(DetectFlags(ios15), { colorMix: true, cqUnits: true, containers: true, overflowClip: true, userSelect: true, backdropFilter: true, popover: true });
  // Prefix gaps alone (every modern Safari) start nothing; with a real gap they ride along.
  const prefixOnly = (prop) => !/^(user-select|backdrop-filter)$/.test(prop);
  assert.deepEqual(Object.values(DetectFlags(prefixOnly)).filter(Boolean), []);
  assert.equal(DetectFlags((prop) => prop !== 'width').userSelect, true);
  assert.equal(DetectFlags(() => { throw new Error('no'); }).colorMix, false, 'a throwing probe means "do not touch"');
});

test('with no flag set, the stylesheet comes back as the very same string', () => {
  const css = '.a{color:color-mix(in srgb,red,blue)} @container (max-width:1px){.b{width:3cqw}}';
  assert.equal(DownlevelCss(css, NONE), css);
});

test('colours: hex, rgb, hsl and the premultiplied srgb mix', () => {
  assert.deepEqual(ParseColor('#c9a227'), { r: 201, g: 162, b: 39, a: 1 });
  assert.deepEqual(ParseColor('#fff8'), { r: 255, g: 255, b: 255, a: 0x88 / 255 });
  assert.deepEqual(ParseColor('rgb(10 20 30 / 50%)'), { r: 10, g: 20, b: 30, a: 0.5 });
  assert.deepEqual(ParseColor('rgba(1,2,3,.25)'), { r: 1, g: 2, b: 3, a: 0.25 });
  const hsl = ParseColor('hsl(120 100% 25%)');
  assert.deepEqual([Math.round(hsl.r), Math.round(hsl.g), Math.round(hsl.b)], [0, 128, 0]);
  assert.equal(ParseColor('currentcolor'), null);
  // Equal parts of black and white is mid grey (127.5 rounds to 128), as the spec's example.
  assert.equal(ColorToCss(MixColors('color-mix(in srgb, black, white)')), 'rgba(128, 128, 128, 1)');
  // A mix with transparent keeps the colour and scales the alpha: premultiplied, not a dark smear.
  assert.equal(ColorToCss(MixColors('color-mix(in srgb, #c9a227 55%, transparent)')), 'rgba(201, 162, 39, 0.55)');
  // Percentages that do not sum to 100 scale the alpha down (CSS Color 5 sec. 3.1).
  assert.equal(ColorToCss(MixColors('color-mix(in srgb, red 20%, blue 20%)')), 'rgba(128, 0, 128, 0.4)');
  assert.equal(ColorToCss(MixColors('color-mix(in srgb, #c9a227 20%, #241d15)')), 'rgba(' + [0.2 * 201 + 0.8 * 0x24, 0.2 * 162 + 0.8 * 0x1d, 0.2 * 39 + 0.8 * 0x15].map(Math.round).join(', ') + ', 1)');
  assert.equal(MixColors('color-mix(in oklab, red, blue)'), null, 'only srgb is computed');
});

test('color-mix resolves var() through the :root table, var fallbacks and the loose table', () => {
  const ctx = withVars(':root { --gold: #c9a227; --panel: #241d15; --alias: var(--gold) }\n.reward { --ready: #75bfff; }');
  assert.equal(ReplaceColorMix('color-mix(in srgb, var(--gold) 50%, transparent)', ctx), 'rgba(201, 162, 39, 0.5)');
  assert.equal(ReplaceColorMix('color-mix(in srgb, var(--alias) 50%, transparent)', ctx), 'rgba(201, 162, 39, 0.5)', 'a token that is another token');
  assert.equal(ReplaceColorMix('color-mix(in srgb, var(--missing, #fff) 100%, black)', ctx), 'rgba(255, 255, 255, 1)', 'the var() fallback');
  assert.equal(ReplaceColorMix('color-mix(in srgb, var(--ready) 100%, black)', ctx), 'rgba(117, 191, 255, 1)', 'a component-only token still resolves');
  assert.equal(ReplaceColorMix('0 0 4px color-mix(in srgb, var(--gold) 50%, transparent), 0 0 1px color-mix(in srgb, white, black)', ctx), '0 0 4px rgba(201, 162, 39, 0.5), 0 0 1px rgba(128, 128, 128, 1)');
  // A mix whose one operand only a script knows takes the other: the nearest static colour.
  const approx = withVars();
  assert.equal(ReplaceColorMix('color-mix(in srgb, var(--tint) 20%, #111)', approx), 'rgba(17, 17, 17, 1)');
  assert.equal(approx.approximatedColorMix.length, 1);
  assert.equal(ReplaceColorMix('color-mix(in srgb, var(--tint) 20%, var(--other))', approx), null, 'both unknown: no value');
});

test('color-mix declarations are replaced, or dropped when nothing can be known', () => {
  const ctx = withVars();
  const out = DownlevelCss('.a{ border:1px solid color-mix(in srgb, var(--gold) 50%, transparent); background:color-mix(in srgb, var(--x) 5%, var(--y)); color:red }', only('colorMix'), ctx);
  assert.equal(squash(out), '.a{ border:1px solid rgba(201, 162, 39, 0.5); color:red }');
  assert.equal(ctx.unresolvedColorMix.length, 1);
});

test('cq units become calc() over --cqw/--cqh, signs and nesting included', () => {
  assert.equal(ReplaceCqUnits('font-size:7.8cqw'), 'font-size:calc(7.8 * var(--cqw, 1%))');
  assert.equal(ReplaceCqUnits('0 .6cqw .8cqw #000'), '0 calc(.6 * var(--cqw, 1%)) calc(.8 * var(--cqw, 1%)) #000');
  assert.equal(ReplaceCqUnits('-.5cqh'), 'calc(-.5 * var(--cqh, 1%))');
  assert.equal(ReplaceCqUnits('min(100cqw,80cqh)'), 'min(calc(100 * var(--cqw, 1%)),calc(80 * var(--cqh, 1%)))');
  assert.equal(ReplaceCqUnits('calc(var(--p, 18) * 1cqh)'), 'calc(var(--p, 18) * calc(1 * var(--cqh, 1%)))');
  assert.equal(ReplaceCqUnits('10cqi 10cqb'), 'calc(10 * var(--cqw, 1%)) calc(10 * var(--cqh, 1%))');
  assert.equal(ReplaceCqUnits('1.2cqmin'), 'calc(1.2 * min(var(--cqw, 1%), var(--cqh, 1%)))');
  assert.equal(ReplaceCqUnits('width: 10px; --cqw-gap: 3px'), 'width: 10px; --cqw-gap: 3px', 'a custom property named cqw is not a unit');
});

test('overflow clip, user-select and backdrop-filter get Safari 15 spellings', () => {
  const css = '.a{overflow:clip;overflow-x:clip hidden}.b{user-select:none}.c{-webkit-user-select:none;user-select:none}.d{backdrop-filter:blur(4px)}';
  const out = DownlevelCss(css, only('overflowClip', 'userSelect', 'backdropFilter'));
  assert.equal(out, '.a{overflow:hidden;overflow-x:hidden hidden}.b{-webkit-user-select:none;user-select:none}.c{-webkit-user-select:none;user-select:none}.d{-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}');
});

test(':popover-open becomes the polyfill marker', () => {
  assert.equal(DownlevelCss('.m:popover-open{display:grid} :is(:popover-open, dialog:modal){zoom:2}', only('popover')), '.m[data-popover-open]{display:grid} :is([data-popover-open], dialog:modal){zoom:2}');
});

test('the scanner survives strings, comments, url(data:;) and nested at-rules', () => {
  const css = '/* } { */ .a{background:url("data:image/svg+xml;utf8,<svg>{}</svg>") ; content:"a;b}"}\n@media (min-width:1px){ .b{ overflow:clip } }\n@keyframes k{ from{color:color-mix(in srgb,red,blue)} to{color:blue} }';
  const out = DownlevelCss(css, only('overflowClip', 'colorMix'), CreateContext());
  assert.equal(out, '/* } { */ .a{background:url("data:image/svg+xml;utf8,<svg>{}</svg>") ; content:"a;b}"}\n@media (min-width:1px){ .b{ overflow:hidden } }\n@keyframes k{ from{color:rgba(128, 0, 128, 1)} to{color:blue} }');
  assert.deepEqual(SplitTop('a, b(c, d), [e,f], "g,h"', ','), ['a', ' b(c, d)', ' [e,f]', ' "g,h"']);
});

test('container declarations are recorded and removed', () => {
  const ctx = CreateContext();
  const out = DownlevelCss('html{container: game-viewport / size; color:red}.a{container-type:inline-size;container-name:foo bar}.b{container-type:normal}.c{container:x}', only('containers'), ctx);
  assert.equal(out, 'html{ color:red}.a{}.b{}.c{}');
  assert.deepEqual(ctx.containers, [
    { selector: 'html', names: ['game-viewport'], type: 'size' },
    { selector: '.a', type: 'inline-size', names: ['foo', 'bar'] },
    { selector: '.b', type: 'normal' },
    { selector: '.c', names: ['x'], type: 'normal' },
  ]);
});

test('container conditions parse, including range syntax, not, and, or', () => {
  const cmp = (f, op, n, u = 'px') => ({ t: 'cmp', f, op, v: { n, u } });
  assert.deepEqual(ParseCondition('(max-width: 600px)'), cmp('width', '<=', 600));
  assert.deepEqual(ParseCondition('(min-width:601px)'), cmp('width', '>=', 601));
  assert.deepEqual(ParseCondition('(width > 64rem)'), cmp('width', '>', 64, 'rem'));
  assert.deepEqual(ParseCondition('(64rem < width)'), cmp('width', '>', 64, 'rem'));
  assert.deepEqual(ParseCondition('(max-width: 480.0px)'), cmp('width', '<=', 480));
  assert.deepEqual(ParseCondition('(orientation: portrait)'), { t: 'cmp', f: 'orientation', op: '=', v: 'portrait' });
  assert.deepEqual(ParseCondition('(max-width: 760px) and (orientation: portrait)'), { t: 'and', a: [cmp('width', '<=', 760), { t: 'cmp', f: 'orientation', op: '=', v: 'portrait' }] });
  assert.deepEqual(ParseCondition('(max-height: 480px) or (max-width: 1px)'), { t: 'or', a: [cmp('height', '<=', 480), cmp('width', '<=', 1)] });
  assert.deepEqual(ParseCondition('not (max-width: 4em)'), { t: 'not', a: cmp('width', '<=', 4, 'em') });
  assert.deepEqual(ParseCondition('(400px <= width <= 700px)'), { t: 'and', a: [cmp('width', '>=', 400), cmp('width', '<=', 700)] });
  assert.equal(ParseCondition('style(--x: 1)'), null, 'style queries are not supported');
  assert.deepEqual(ParseContainerPrelude('@container game-viewport (max-width:600px)'), { name: 'game-viewport', condition: cmp('width', '<=', 600) });
  assert.deepEqual(ParseContainerPrelude('@container (min-width: 651px)'), { name: null, condition: cmp('width', '>=', 651) });
});

test('selectors are gated on the container token without changing specificity', () => {
  assert.equal(GateSelector('.a .b', 3, false), ':where([data-cq~="3"]) .a .b');
  assert.equal(GateSelector(':root[data-layout="wide"] .dialogue-foot > button', 3, false), ':root:where([data-cq~="3"])[data-layout="wide"] .dialogue-foot > button');
  assert.equal(GateSelector('html .x', 3, false), 'html:where([data-cq~="3"]) .x');
  assert.equal(GateSelector(':root[data-layout]', 3, false), null, 'the container itself is never matched by its own query');
  assert.equal(GateSelector('.a', 5, true), ':where([data-cq~="5"]) .a:not(:where([data-cq-no~="5"]) *)');
  assert.equal(GateSelector('.a::before', 5, true), ':where([data-cq~="5"]) .a:not(:where([data-cq-no~="5"]) *)::before', 'the exclusion goes before a pseudo-element');
});

test('@container blocks are replaced in place by gated rules, nested at-rules kept', () => {
  const ctx = CreateContext();
  const css = '.x{a:1}@container game-viewport (max-width: 600px){ .a, :root .b{ color:red } @media (hover:hover){ .c{ color:blue } } }.y{b:2}@container game-viewport (max-width:600px){.d{e:1}}@container (min-width: 10px){.f{g:1}}';
  const out = DownlevelCss(css, only('containers'), ctx);
  assert.equal(squash(out), '.x{a:1}:where([data-cq~="0"]) .a, :root:where([data-cq~="0"]) .b{ color:red } @media (hover:hover){:where([data-cq~="0"]) .c{ color:blue } } .y{b:2}:where([data-cq~="0"]) .d{e:1}:where([data-cq~="1"]) .f:not(:where([data-cq-no~="1"]) *){g:1}');
  assert.equal(ctx.queries.length, 2, 'the same name and condition share one key');
  assert.equal(ctx.queries[1].exclude, true, 'an unnamed min-width query excludes descendants of a container that fails it');
  assert.equal(ctx.queries[0].exclude, false);
});

test('a query the shim cannot read matches nothing instead of everything', () => {
  assert.equal(DownlevelCss('@container style(--x:1){.a{b:1}}', only('containers')), '');
});

test('every repair together on the real stylesheets: no color-mix, no cq units, no @container left, nothing unresolved', () => {
  const dir = fileURLToPath(new URL('../styles/', import.meta.url));
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const hrefs = [...index.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(styles\/[^"]+)"/g)].map((m) => m[1].replace('styles/', ''));
  assert.ok(hrefs.length > 5, 'index.html lists the stylesheets');
  const ctx = CreateContext();
  const sheets = hrefs.map((name) => readFileSync(dir + name, 'utf8'));
  sheets.forEach((css) => CollectVars(css, ctx));
  const outs = sheets.map((css) => DownlevelCss(css, ALL, ctx));
  const all = outs.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  // The one color-mix left is inside @starting-style, an at-rule the browser skips whole.
  const left = [...all.matchAll(/color-mix\(/g)].length;
  assert.ok(left <= 1, `color-mix left: ${left}`);
  assert.equal([...all.matchAll(/[\d.]cq(?:w|h|i|b|min|max)\b/g)].length, 0, 'cq units');
  assert.equal([...all.matchAll(/@container/g)].length, 0, '@container');
  assert.equal([...all.matchAll(/(?:^|[;{\s])container(?:-type|-name)?\s*:/g)].length, 0, 'container declarations');
  assert.equal([...all.matchAll(/(?:^|[;{\s])overflow(?:-[xy])?\s*:[^;}]*\bclip\b/g)].length, 0, 'overflow: clip');
  assert.deepEqual(ctx.unresolvedColorMix, [], 'every color-mix resolves to a static colour');
  assert.ok(ctx.queries.length >= 40 && ctx.queries.length <= 60, `${ctx.queries.length} distinct container queries`);
  const viewport = ctx.containers.find((c) => c.selector === 'html');
  assert.deepEqual(viewport && viewport.names, ['game-viewport']);
  assert.equal(ctx.queries.filter((q) => !q.name && q.exclude).length >= 1, true, 'the unnamed min-width queries are the excluding kind');
  // Braces still balance in every rewritten sheet.
  for (const [i, out] of outs.entries()) {
    const strip = out.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    assert.equal(strip.split('{').length, strip.split('}').length, `${hrefs[i]} braces balance`);
  }
});
