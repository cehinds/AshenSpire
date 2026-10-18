// tests/style-lint.test.mjs — tools/style-lint.mjs, the ratchet on raw font sizes,
// bare z-index and bare hex colours in styles/*.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { lintCss, lintTree, compareToBaseline, baselineText, BASELINE, RULES } from '../tools/style-lint.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOOL = join(ROOT, 'tools', 'style-lint.mjs');
const FIXTURE_TOKENS = JSON.stringify({ type: { minimum: { bodyPx: 14, captionPx: 12, textPx: 11 } } });

/** A temp tree: tokens.json, a styles/ folder of { name: css }, and a copy of the tool. */
function tree(sheets) {
  const root = mkdtempSync(join(tmpdir(), 'style-lint-'));
  mkdirSync(join(root, 'content', 'config', 'ui'), { recursive: true });
  mkdirSync(join(root, 'styles'), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  writeFileSync(join(root, 'content', 'config', 'ui', 'tokens.json'), FIXTURE_TOKENS);
  cpSync(TOOL, join(root, 'tools', 'style-lint.mjs'));
  for (const [name, css] of Object.entries(sheets)) writeFileSync(join(root, 'styles', name), css);
  return root;
}
const run = (root, ...args) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, ['tools/style-lint.mjs', ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' }), err: '' };
  } catch (error) {
    return { code: error.status, out: String(error.stdout), err: String(error.stderr) };
  }
};
const lint = (css, file = 'styles/x.css') => lintCss(css, file, { textPx: 11 });

test('font-size counts only px literals below the text minimum', () => {
  assert.equal(lint('.a{font-size:10px}.b{font-size: 10.5px !important}.c{font-size:11px}.d{font-size:12px}.e{font-size:1rem}.f{font-size:var(--t-1)}.g{font-size:calc(9px + 1px)}')['font-size-below-min'], 2);
  assert.equal(lint('/* .a{font-size:8px} */ .b{font-size:12px}')['font-size-below-min'], 0, 'comments are not code');
});

test('z-index counts bare values of 100 or more, not layers, small values or expressions', () => {
  const css = '.a{z-index:100}.b{z-index:99}.c{z-index:var(--layer-sheet)}.d{z-index: 2147483647 !important}.e{z-index:700!important}.f{z-index:-1}.g{z-index:calc(var(--layer-hud) + 1)}';
  assert.equal(lint(css)['z-index-bare'], 3);
});

test('hex colours count in declarations, not in selectors, and not inside the token homes', () => {
  const css = '#fab { color: #abc; background: linear-gradient(#112233, #44556677); border-color: #ABCD; } .x:not(#bad) { margin: 0 } /* #fff */ .y { color: var(--gold); width: 12px }';
  assert.equal(lint(css)['hex-colour-bare'], 4);
  assert.equal(lint('a{color:#abc}', 'styles/combat-symbol-colors.css')['hex-colour-bare'], 0);
  assert.equal(lint('a{color:#abc}', 'styles/tokens.generated.css')['hex-colour-bare'], 0);
  const base = ':root { --bg: #0d0b08; --gold: #c9a227; }\n.k { color: #fff; }\n:root { --x: #123; }';
  assert.equal(lint(base, 'styles/base.css')['hex-colour-bare'], 1, 'base.css :root blocks are the palette home; the rest of base.css counts');
  assert.equal(lint(base, 'styles/kit.css')['hex-colour-bare'], 4, 'any other file counts its :root blocks too');
  assert.equal(lint(".m { mask: url(#abc); content: '#fff'; quotes: \"#\"; color: #abc }")['hex-colour-bare'], 1, 'a # in url() or a string is not a colour');
});

test('a rise fails and names file, rule and old → new; a fall passes; the baseline round-trips', () => {
  const root = tree({ 'a.css': '.x{z-index:200}.y{color:#abc}', 'b.css': '.x{font-size:9px}' });
  try {
    assert.equal(run(root, '--check').code, 1, 'no baseline yet');
    assert.equal(run(root, '--write-baseline').code, 0);
    const text = readFileSync(join(root, BASELINE), 'utf8');
    const written = JSON.parse(text);
    assert.deepEqual(written.rules, { 'font-size-below-min': { 'styles/b.css': 1 }, 'z-index-bare': { 'styles/a.css': 1 }, 'hex-colour-bare': { 'styles/a.css': 1 } });
    assert.equal(text, baselineText(lintTree(root)), 'round-trip: the file is exactly the tree\'s counts');
    assert.equal(run(root, '--check').code, 0, 'unchanged tree passes');

    writeFileSync(join(root, 'styles', 'a.css'), '.x{z-index:200}.y{color:#abc}.z{z-index:300}');
    const rise = run(root, '--check');
    assert.equal(rise.code, 1);
    assert.match(rise.err, /styles\/a\.css: z-index-bare 1 → 2/);

    writeFileSync(join(root, 'styles', 'a.css'), '.y{color:var(--gold)}');
    writeFileSync(join(root, 'styles', 'c.css'), '.n{color:#fff}');
    const fresh = run(root, '--check');
    assert.equal(fresh.code, 1, 'a new file with a raw colour is a rise from zero');
    assert.match(fresh.err, /styles\/c\.css: hex-colour-bare 0 → 1/);
    rmSync(join(root, 'styles', 'c.css'));

    const fall = run(root, '--check');
    assert.equal(fall.code, 0, 'falling is fine and needs no baseline write');
    assert.match(fall.out, /styles\/a\.css: z-index-bare 1 → 0/);
    assert.equal(run(root, '--write-baseline').code, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(root, BASELINE), 'utf8')).rules['z-index-bare'], {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('compareToBaseline reports rises and falls separately', () => {
  const baseline = { rules: { 'z-index-bare': { 'styles/a.css': 3, 'styles/b.css': 2 } } };
  const current = { 'font-size-below-min': {}, 'z-index-bare': { 'styles/a.css': 4, 'styles/b.css': 1 }, 'hex-colour-bare': {} };
  assert.deepEqual(compareToBaseline(baseline, current), { rises: ['styles/a.css: z-index-bare 3 → 4'], falls: ['styles/b.css: z-index-bare 2 → 1'] });
  assert.deepEqual(RULES, ['font-size-below-min', 'z-index-bare', 'hex-colour-bare']);
});

test('the real tree is within the committed baseline', () => {
  const baseline = JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'));
  const { rises } = compareToBaseline(baseline, lintTree(ROOT));
  assert.deepEqual(rises, [], 'a raw size, layer or colour was added; use a token (or run --write-baseline only if the count fell)');
});
