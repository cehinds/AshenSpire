import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { CreateSourceFormatter, FormatSource } from './format.mjs';
import { AuditNames, CreateProgram, IsAuthoredSource } from './naming.mjs';

function fixtures(t, source)
{
    const root = mkdtempSync(join(tmpdir(), 'ashenspire-code-quality-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const files = new Map();
    for (const [path, text] of Object.entries(source))
    {
        const absolute = join(root, path);
        mkdirSync(dirname(absolute), { recursive: true });
        writeFileSync(absolute, text);
        files.set(path, absolute);
    }
    return { files, program: CreateProgram([...files.values()]) };
}

test('new callable exports are checked even outside enrolled modules', t =>
{
    const { files, program } = fixtures(t, {
        'src/legacy.js': [
            'export function oldName() {}',
            'export const newArrow = () => 1;',
            'export class newClass {}',
            'export const NEW_CALLABLE = () => 1;',
            'export const DATA_CONSTANT = 1;',
        ].join('\n'),
        'src/public.js': 'export function Open() {}',
        'src/reexport.js': "export { Open as newAlias } from './public.js';",
    });
    const { diagnostics, inventory } = AuditNames(
        program,
        files,
        { enrolled: [], aliases: [] },
        { 'src/legacy.js': ['oldName'] },
    );
    assert.deepEqual(inventory, {
        'src/legacy.js': ['NEW_CALLABLE', 'newArrow', 'newClass', 'oldName'],
        'src/reexport.js': ['newAlias'],
    });
    assert.equal(diagnostics.length, 4);
    for (const name of ['NEW_CALLABLE', 'newArrow', 'newClass', 'newAlias'])
    {
        assert.ok(
            diagnostics.some(problem =>
                problem.includes(`public export '${name}' must be PascalCase`)
            ),
        );
    }
});

test('enrolled owners check private helpers and exposed methods while keeping data keys', t =>
{
    const { files, program } = fixtures(t, {
        'src/owner.js': [
            'function PrivateHelper() {}',
            'const PRIVATE_CALLABLE = (() => 1);',
            'const PRIVATE_DATA = 1;',
            'export class Owner { method() {} #Hidden() {} "quoted"() {} ["computed"]() {} }',
            'class Box { open() {} #privateMethod() {} }',
            'export function CreateBox() { return new Box(); }',
            'export function Assign() { const box = {}; box.assigned = () => 1; return box; }',
            'export function CreateTransfer() { return { read() {}, count: 1 }; }',
        ].join('\n'),
    });
    const { diagnostics } = AuditNames(program, files, { enrolled: ['src/owner.js'], aliases: [] });
    assert.equal(diagnostics.length, 9, diagnostics.join('\n'));
    for (
        const name of [
            'PrivateHelper',
            'PRIVATE_CALLABLE',
            'method',
            'Hidden',
            'quoted',
            'computed',
            'open',
            'read',
            'assigned',
        ]
    )
    {
        assert.ok(
            diagnostics.some(problem => problem.includes(`'${name}'`)),
            diagnostics.join('\n'),
        );
    }
});

test('only exact live aliases or deprecated forwarding adapters are accepted', t =>
{
    const path = 'src/owner.js';
    const { files, program } = fixtures(t, {
        [path]: [
            'export function CreateTransfer() { return { Restore() {} }; }',
            'export const makeTransfer = CreateTransfer;',
            'export function Other() {}',
            'export const wrongTarget = Other;',
            '/** @deprecated Legacy caller shape. */',
            'export function createTransfer() { const api = CreateTransfer(); return { restore: api.Restore }; }',
            'export function wrongAdapter() { return CreateTransfer(); }',
            '/** @deprecated Not a live call. */',
            'export function deadAdapter() { if (false) CreateTransfer(); return {}; }',
            '/** @deprecated Discards the new transfer. */',
            'export function unusedAdapter() { const api = CreateTransfer(); return { restore: () => {} }; }',
        ].join('\n'),
    });
    const alias = (name, kind) => ({ path, name, target: 'CreateTransfer', kind });
    const { diagnostics } = AuditNames(
        program,
        files,
        {
            enrolled: [path],
            aliases: [
                alias('makeTransfer', 'binding'),
                alias('createTransfer', 'adapter'),
                alias('wrongTarget', 'binding'),
                alias('wrongAdapter', 'adapter'),
                alias('deadAdapter', 'adapter'),
                alias('unusedAdapter', 'adapter'),
                alias('missing', 'binding'),
            ],
        },
        { 'src/old.js': ['gone'] },
    );
    assert.equal(diagnostics.length, 10, diagnostics.join('\n'));
    assert.ok(diagnostics.some(problem => problem.includes("public export 'wrongTarget'")));
    assert.ok(diagnostics.some(problem => problem.includes("public export 'wrongAdapter'")));
    assert.ok(diagnostics.some(problem => problem.includes("public export 'deadAdapter'")));
    assert.ok(diagnostics.some(problem => problem.includes("public export 'unusedAdapter'")));
    assert.ok(
        diagnostics.some(problem =>
            problem.includes(':missing: unused or invalid compatibility alias')
        ),
    );
    assert.ok(diagnostics.some(problem => problem.includes("stale legacy export 'gone'")));
    assert.ok(!diagnostics.some(problem => /makeTransfer|createTransfer|'restore'/.test(problem)));
});

test('the format check can spot bad formatting and preserves import and export order', () =>
{
    const input = [
        'import { z, a } from "./z.js"',
        'import { q, b } from "./a.js"',
        'export function Start(){if(true) return z; else return q}',
        'export { b, a };',
    ].join('\r\n');
    const output = FormatSource('src/fixture.js', input);
    assert.notEqual(output, input);
    assert.match(output, /function Start\(\)\n\{\n {4}if \(true\)\n {4}\{\n {8}return z;/);
    assert.match(output, /\n {4}else\n {4}\{/);
    assert.ok(!output.includes('\r'));
    assert.ok(
        output.indexOf("import { z, a } from './z.js';")
            < output.indexOf("import { q, b } from './a.js';"),
    );
    assert.ok(output.includes("import { z, a } from './z.js';"));
    assert.ok(output.includes('export { b, a };'));
    assert.equal(FormatSource('src/fixture.js', output), output);
});

test('generated sources and declaration files are outside the authored scan', () =>
{
    assert.ok(IsAuthoredSource('src/model/a.js'));
    for (
        const path of [
            'src/framework/data/mechanics.js',
            'src/content/generated/baseCards.js',
            'src/content/art.generated.js',
            'src/model/types.d.ts',
            'engine/runtime/evaluator.mjs',
        ]
    )
    {
        assert.equal(IsAuthoredSource(path), false, path);
    }
});

test('invalid formatter configuration is refused by the pinned plugin', () =>
{
    assert.throws(
        () => CreateSourceFormatter({ indentWidth: 'bad' }),
        /formatting\.json\.indentWidth/,
    );
    assert.throws(
        () => CreateSourceFormatter({ misspelledOption: true }),
        /formatting\.json\.misspelledOption/,
    );
});
