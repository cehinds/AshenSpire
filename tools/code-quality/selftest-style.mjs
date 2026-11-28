import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { CreatePathFilter, ParseBaseArgument, SmellsConfig } from './changed-files.mjs';
import { FindUnformatted } from './format-changed.mjs';
import { FindSmells, FormatFinding } from './smells.mjs';

const FIXTURES = fileURLToPath(new URL('fixtures/', import.meta.url));
const SMELL_ROOT = `${FIXTURES}smells`;
const FORMAT_ROOT = `${FIXTURES}format`;
const SMELL_FILES = [
    'duplicate-a.js',
    'duplicate-b.js',
    'literals.js',
    'structure.js',
    'tests/sample.test.js',
];
const SHORT_FUNCTION_LINES = 10;
const EXPECTED_SMELLS = [
    'duplicate-a.js:1 duplicate 85 tokens to line 7, also at duplicate-b.js:1',
    'duplicate-b.js:1 duplicate 85 tokens to line 7, also at duplicate-a.js:1',
    'literals.js:1 long-function Literals 22 lines (max 10)',
    'literals.js:4 magic-number 7',
    'literals.js:5 magic-number -3',
    'literals.js:8 magic-string "ready" comparison',
    'literals.js:10 magic-string "twice" repeated 2 times',
    'literals.js:14 magic-string "open" switch case',
    'literals.js:17 magic-string "marker" includes() argument',
    'literals.js:19 magic-string "key" object key',
    'structure.js:1 deep-nesting Nested depth 4 (max 3)',
    'structure.js:1 long-function Nested 21 lines (max 10)',
    'tests/sample.test.js:5 magic-string "expected" repeated 2 times',
];

test('smells reports each kind once, sorted, and skips allowed values and test messages', () =>
{
    const config = { ...SmellsConfig, maxFunctionLines: SHORT_FUNCTION_LINES };
    const findings = FindSmells(SMELL_FILES, config, SMELL_ROOT).map(FormatFinding);
    assert.deepEqual(findings, EXPECTED_SMELLS);
});

test('smells is stable across runs and input order', () =>
{
    const forward = FindSmells(SMELL_FILES, SmellsConfig, SMELL_ROOT);
    const backward = FindSmells(SMELL_FILES.slice().reverse(), SmellsConfig, SMELL_ROOT);
    assert.deepEqual(backward, forward);
});

test('format-changed lists only the files the formatter would rewrite', () =>
{
    const unformatted = FindUnformatted(['formatted.js', 'unformatted.js'], FORMAT_ROOT);
    assert.deepEqual(unformatted.map(entry => entry.path), ['unformatted.js']);
    assert.match(unformatted[0].formatted, /^export function Unformatted\(value\)\n\{\n/);
});

test('changed-file filter keeps authored JavaScript and drops generated or protected paths', () =>
{
    const keepPath = CreatePathFilter(SmellsConfig, ['src/model/formulas.js']);
    const paths = [
        'src/engine/combat.js',
        'tools/code-quality/smells.mjs',
        'src/content/generated/balanceUi.js',
        'src/config/generated/ui.js',
        'src/framework/data/table.js',
        'tools/attic/old.mjs',
        'src/model/formulas.js',
        'docs/readme.md',
    ];
    assert.deepEqual(paths.filter(keepPath), [
        'src/engine/combat.js',
        'tools/code-quality/smells.mjs',
    ]);
});

test('the base flag takes the next argument and leaves the rest', () =>
{
    const parsed = ParseBaseArgument(['--check', '--base', 'origin/test', 'a.js'], 'origin/dev');
    assert.deepEqual(parsed, { base: 'origin/test', rest: ['--check', 'a.js'] });
    assert.equal(ParseBaseArgument([], 'origin/dev').base, 'origin/dev');
    assert.throws(() => ParseBaseArgument(['--base'], 'origin/dev'), /needs a ref/);
});
