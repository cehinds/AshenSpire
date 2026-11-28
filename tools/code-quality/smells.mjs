// Reports magic values, duplicated code, long functions and deep nesting in changed files.
// Usage: node tools/code-quality/smells.mjs [--strict] [--base <ref>] [<path> ...]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ListChangedFiles, ParseBaseArgument, RepoRoot, SmellsConfig } from './changed-files.mjs';
import { ParseSource } from './smells-ast.mjs';
import { FindDuplicateSmells } from './smells-duplicates.mjs';
import { FindLiteralSmells } from './smells-literals.mjs';
import { FindStructureSmells } from './smells-structure.mjs';

const STRICT_FLAG = '--strict';
const EXIT_FAILURE = 1;

function compareText(left, right)
{
    if (left === right)
    {
        return 0;
    }
    return left < right
        ? -1
        : 1;
}

function compareFindings(left, right)
{
    return compareText(left.path, right.path) || left.line - right.line
        || compareText(left.kind, right.kind) || compareText(left.detail, right.detail);
}

function isTestPath(path, config)
{
    return config.testPathPrefixes.some(prefix => path.startsWith(prefix));
}

function fileFindings({ path, sourceFile }, config)
{
    const findings = [
        ...FindLiteralSmells(sourceFile, isTestPath(path, config), config),
        ...FindStructureSmells(sourceFile, config),
    ];
    return findings.map(finding => ({ path, ...finding }));
}

export function FindSmells(paths, config = SmellsConfig, root = RepoRoot)
{
    const sourceFiles = paths.map(path =>
    {
        const text = readFileSync(join(root, path), 'utf8');
        return { path, sourceFile: ParseSource(path, text) };
    });
    const findings = [
        ...sourceFiles.flatMap(file => fileFindings(file, config)),
        ...FindDuplicateSmells(sourceFiles, config),
    ];
    return findings.sort(compareFindings);
}

export function FormatFinding(finding)
{
    return `${finding.path}:${finding.line} ${finding.kind} ${finding.detail}`;
}

export function RunSmells(argv, root = RepoRoot)
{
    const { base, rest } = ParseBaseArgument(argv, SmellsConfig.defaultBase);
    const strict = rest.includes(STRICT_FLAG);
    const named = rest.filter(argument => argument !== STRICT_FLAG);
    const paths = named.length
        ? named.map(path => path.replaceAll('\\', '/'))
        : ListChangedFiles(base, root);
    const findings = FindSmells(paths, SmellsConfig, root);
    for (const finding of findings)
    {
        console.log(FormatFinding(finding));
    }
    console.log(`code:smells scanned ${paths.length} files, ${findings.length} findings`);
    return strict && findings.length
        ? EXIT_FAILURE
        : 0;
}

const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url)
{
    process.exitCode = RunSmells(process.argv.slice(2));
}
