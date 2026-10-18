#!/usr/bin/env node
// tools/style-lint.mjs — a ratchet on raw sizes, layers and colours in styles/*.css.
//
//   node tools/style-lint.mjs --check             fail when any count RISES above
//                                                 tools/style-lint-baseline.json
//   node tools/style-lint.mjs --write-baseline    rewrite the baseline from the tree
//   node tools/style-lint.mjs                     report the counts (no verdict)
//
// Three rules, counted per file (design tokens: content/config/ui/tokens.json):
//   font-size-below-min  `font-size` written as a px literal below type.minimum.textPx
//   z-index-bare         `z-index` of 100 or more that is not var(--layer-*)
//   hex-colour-bare      a #rgb / #rrggbb / #rrggbbaa colour in a declaration, outside the
//                        token homes: base.css :root blocks, combat-symbol-colors.css,
//                        tokens.generated.css
//
// This only COUNTS. Nothing here changes a stylesheet. A count that rises fails
// --check, naming the file, the rule and old → new. A count that falls passes:
// lower the baseline in the same change (--write-baseline) so the gain cannot be
// spent again. Migration of the consumers is done one surface at a time, each
// with screenshots. Never raise the baseline to make --check green.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = 'tools/style-lint-baseline.json';
export const TOKENS_JSON = 'content/config/ui/tokens.json';
export const STYLES_DIR = 'styles';
export const RULES = ['font-size-below-min', 'z-index-bare', 'hex-colour-bare'];
/** Where raw hex colours live on purpose. base.css is exempt only inside :root blocks. */
export const HEX_HOMES = ['styles/base.css', 'styles/combat-symbol-colors.css', 'styles/tokens.generated.css'];

const NOTE = 'Ratchet baseline for tools/style-lint.mjs: per-file counts of raw font sizes below the text minimum, bare z-index of 100 or more, and bare hex colours. --check fails when a count rises; lower a count and run --write-baseline in the same change. Never raise it to go green.';

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Declarations as [property, value]. A value must end at `;` or `}` (a selector ends at `{`). */
function declarations(css) {
  const out = [];
  for (const m of css.matchAll(/([A-Za-z-][A-Za-z0-9_-]*)\s*:\s*([^;{}]*)(?=[;}])/g)) out.push([m[1].toLowerCase(), m[2]]);
  return out;
}

/**
 * lintCss(text, file, { textPx }) → { 'font-size-below-min': n, 'z-index-bare': n, 'hex-colour-bare': n }.
 * Pure: no filesystem.
 */
export function lintCss(text, file, { textPx }) {
  let css = stripComments(text);
  const counts = { 'font-size-below-min': 0, 'z-index-bare': 0, 'hex-colour-bare': 0 };
  for (const [prop, value] of declarations(css)) {
    if (prop === 'font-size') {
      const px = /^\s*(\d*\.?\d+)px\b/i.exec(value);
      if (px && Number(px[1]) < textPx) counts['font-size-below-min']++;
    } else if (prop === 'font') {
      // The shorthand's size is its first px length (`font: italic 700 10px/1.2 serif`);
      // a line-height after `/` is not a size.
      const px = /(?:^|\s)(\d*\.?\d+)px(?=[\s/]|$)/i.exec(value);
      if (px && Number(px[1]) < textPx) counts['font-size-below-min']++;
    } else if (prop === 'z-index') {
      const z = /^\s*([-+]?\d+)\s*(?:!important)?\s*$/i.exec(value); // `+100` is a valid signed integer too
      if (z && Number(z[1]) >= 100) counts['z-index-bare']++;
    }
  }
  if (file !== 'styles/combat-symbol-colors.css' && file !== 'styles/tokens.generated.css') {
    if (file === 'styles/base.css') css = css.replace(/:root\s*\{[^}]*\}/g, (m) => m.replace(/[^\n]/g, ' '));
    for (const [, value] of declarations(css)) {
      // A # inside url(#id) or a quoted string (content: '#') is not a colour.
      const colourText = value.replace(/url\([^)]*\)/g, ' ').replace(/'[^']*'|"[^"]*"/g, ' ');
      counts['hex-colour-bare'] += (colourText.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9A-Za-z_-])/g) || []).length;
    }
  }
  return counts;
}

/** The text-size floor, from tokens.json. */
export function readTextPx(root = ROOT) {
  const path = resolve(root, TOKENS_JSON);
  if (!existsSync(path)) throw new Error(`${TOKENS_JSON}: missing`);
  const px = JSON.parse(readFileSync(path, 'utf8'))?.type?.minimum?.textPx;
  if (typeof px !== 'number' || !(px > 0)) throw new Error(`${TOKENS_JSON}: type.minimum.textPx must be a positive number`);
  return px;
}

/** lintTree(root) → { rule: { 'styles/x.css': n } }, zero counts omitted, files in name order. */
export function lintTree(root = ROOT) {
  const textPx = readTextPx(root);
  const result = Object.fromEntries(RULES.map((rule) => [rule, {}]));
  const dir = resolve(root, STYLES_DIR);
  for (const name of existsSync(dir) ? readdirSync(dir).sort() : []) {
    if (!name.endsWith('.css')) continue;
    const file = `${STYLES_DIR}/${name}`;
    const counts = lintCss(readFileSync(resolve(dir, name), 'utf8'), file, { textPx });
    for (const rule of RULES) if (counts[rule] > 0) result[rule][file] = counts[rule];
  }
  return result;
}

/** compareToBaseline(baseline, current) → { rises: [string], falls: [string] }. */
export function compareToBaseline(baseline, current) {
  const rises = [], falls = [];
  for (const rule of RULES) {
    const was = baseline?.rules?.[rule] ?? {}, now = current[rule] ?? {};
    for (const file of [...new Set([...Object.keys(was), ...Object.keys(now)])].sort()) {
      const before = was[file] ?? 0, after = now[file] ?? 0;
      if (after > before) rises.push(`${file}: ${rule} ${before} → ${after}`);
      else if (after < before) falls.push(`${file}: ${rule} ${before} → ${after}`);
    }
  }
  return { rises, falls };
}

export function baselineText(current) {
  return JSON.stringify({ note: NOTE, rules: current }, null, 2) + '\n';
}

function main(argv) {
  const known = ['--check', '--write-baseline'];
  const unknown = argv.filter((arg) => !known.includes(arg));
  if (unknown.length) { console.error(`style-lint: unknown argument(s) ${unknown.join(' ')}`); return 2; }
  let current;
  try { current = lintTree(ROOT); } catch (error) { console.error(`style-lint: ${error.message}`); return 1; }
  const totals = RULES.map((rule) => `${rule} ${Object.values(current[rule]).reduce((a, b) => a + b, 0)}`).join(', ');
  if (argv.includes('--write-baseline')) {
    writeFileSync(resolve(ROOT, BASELINE), baselineText(current));
    console.log(`style-lint: wrote ${BASELINE} (${totals})`);
    return 0;
  }
  if (argv.includes('--check')) {
    const path = resolve(ROOT, BASELINE);
    if (!existsSync(path)) { console.error(`style-lint: ${BASELINE} is missing — run node tools/style-lint.mjs --write-baseline`); return 1; }
    let baseline;
    try { baseline = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { console.error(`style-lint: ${BASELINE} is not valid JSON — ${error.message}`); return 1; }
    const { rises, falls } = compareToBaseline(baseline, current);
    if (rises.length) {
      console.error(`style-lint: FAIL — ${rises.length} count(s) rose above ${BASELINE}:\n  ${rises.join('\n  ')}\n` +
        'Use a token (var(--layer-*), a --t-* size, a palette variable) instead of a raw value. Do not raise the baseline.');
      return 1;
    }
    console.log(`style-lint: ok (${totals})` + (falls.length ? `\nstyle-lint: ${falls.length} count(s) fell — lock the gain in: node tools/style-lint.mjs --write-baseline\n  ${falls.join('\n  ')}` : ''));
    return 0;
  }
  console.log(`style-lint: ${totals}`);
  for (const rule of RULES) {
    console.log(`  ${rule}`);
    for (const [file, n] of Object.entries(current[rule])) console.log(`    ${file}  ${n}`);
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exit(main(process.argv.slice(2)));
