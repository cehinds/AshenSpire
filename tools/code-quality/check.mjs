import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { AuditNames, CreateProgram, IsAuthoredSource } from './naming.mjs';
import { FormatSource } from './format.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const readJson = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));

function findSource()
{
    const files = [];
    function walk(directory)
    {
        for (const entry of readdirSync(directory, { withFileTypes: true }))
        {
            const absolute = join(directory, entry.name);
            if (entry.isDirectory())
            {
                walk(absolute);
            }
            else if (entry.isFile())
            {
                const path = relative(root, absolute).replaceAll('\\', '/');
                if (IsAuthoredSource(path))
                {
                    files.push([path, absolute]);
                }
            }
        }
    }
    walk(join(root, 'src'));
    return new Map(files.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

function validatePolicy(policy, files)
{
    for (const key of ['enrolled', 'formatProtected'])
    {
        const paths = policy[key];
        if (
            !Array.isArray(paths) || new Set(paths).size !== paths.length
            || !paths.every(path => files.has(path))
        )
        {
            throw new Error(`policy.json: ${key} must name distinct authored source files`);
        }
    }
    if (policy.enrolled.some(path => policy.formatProtected.includes(path)))
    {
        throw new Error('policy.json: hash-sensitive files cannot be enrolled');
    }
    const keys = new Set();
    if (!Array.isArray(policy.aliases))
    {
        throw new Error('policy.json: aliases must be a list');
    }
    for (const alias of policy.aliases)
    {
        const key = alias?.path + ':' + alias?.name;
        if (
            !alias || !policy.enrolled.includes(alias.path) || keys.has(key)
            || !/^[a-z][A-Za-z0-9]*$/.test(alias.name) || !/^[A-Z][A-Za-z0-9]*$/.test(alias.target)
            || !['binding', 'adapter'].includes(alias.kind) || typeof alias.reason !== 'string'
            || !alias.reason.trim()
        )
        {
            throw new Error(`policy.json: invalid compatibility alias ${key}`);
        }
        keys.add(key);
    }
}

function syntaxProblems(program, files)
{
    const messages = [];
    for (const [path, absolute] of files)
    {
        const source = program.getSourceFile(absolute);
        for (const diagnostic of program.getSyntacticDiagnostics(source))
        {
            const line = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1;
            messages.push(
                `${path}:${line}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`,
            );
        }
    }
    return messages;
}

function formatChanges(files, paths)
{
    const changes = [];
    for (const path of paths)
    {
        const absolute = files.get(path);
        const before = readFileSync(absolute, 'utf8');
        const after = FormatSource(path, before);
        if (after !== before)
        {
            changes.push({ path, absolute, after });
        }
    }
    return changes;
}

function main(mode)
{
    if (!['check', 'naming', 'inventory', 'format --write'].includes(mode))
    {
        throw new Error('Use check, naming, inventory, or format --write');
    }
    const files = findSource();
    const policy = readJson('policy.json');
    validatePolicy(policy, files);
    if (mode === 'format --write')
    {
        const changes = formatChanges(files, policy.enrolled);
        for (const { absolute, after } of changes)
        {
            writeFileSync(absolute, after, 'utf8');
        }
        console.log(`Formatted ${changes.length} of ${policy.enrolled.length} enrolled files`);
        return;
    }

    const program = CreateProgram([...files.values()]);
    const diagnostics = syntaxProblems(program, files);
    if (diagnostics.length)
    {
        throw new Error(diagnostics.join('\n'));
    }
    const legacy = mode === 'inventory' ? {} : readJson('legacy-public.json');
    const result = AuditNames(program, files, policy, legacy);
    if (mode === 'inventory')
    {
        console.log(JSON.stringify(result.inventory, null, 2));
        return;
    }
    diagnostics.push(...result.diagnostics);
    if (mode === 'check')
    {
        for (const { path } of formatChanges(files, policy.enrolled))
        {
            diagnostics.push(`${path}: format with npm run code:format`);
        }
    }
    if (diagnostics.length)
    {
        throw new Error(diagnostics.join('\n'));
    }
    console.log(
        `Checked names in ${files.size} authored files and ${policy.enrolled.length} enrolled owners`,
    );
}

try
{
    main(process.argv.slice(2).join(' ') || 'check');
}
catch (error)
{
    console.error(error.message);
    process.exitCode = 1;
}
