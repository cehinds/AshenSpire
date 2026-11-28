// Lists the JavaScript files a branch changed against a base ref, minus generated and exempt paths.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_FLAG = '--base';
const GIT_LIST_FLAGS = [
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
];
const UNTRACKED_FLAGS = [
    'ls-files',
    '--others',
    '--exclude-standard',
];
const ANY_DEPTH = '**';
const ANY_NAME = '*';
const HEAD_REF = 'HEAD';

export const RepoRoot = fileURLToPath(new URL('../..', import.meta.url));

function readToolJson(name)
{
    return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}

function escapeRegExp(text)
{
    return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(pattern)
{
    const parts = pattern.split(ANY_DEPTH).map(part =>
        part.split(ANY_NAME).map(escapeRegExp).join('[^/]*')
    );
    return new RegExp(`^${parts.join('.*')}$`);
}

function gitLines(root, flags)
{
    const output = execFileSync('git', flags, { cwd: root, encoding: 'utf8' });
    return output.split('\n').map(line => line.trim()).filter(Boolean);
}

export const SmellsConfig = readToolJson('smells.json');

export function CreatePathFilter(config, protectedPaths)
{
    const patterns = config.exclude.map(globToRegExp);
    const protectedSet = new Set(protectedPaths);
    return path =>
    {
        if (!config.extensions.includes(extname(path)))
        {
            return false;
        }
        if (protectedSet.has(path))
        {
            return false;
        }
        return !patterns.some(pattern => pattern.test(path));
    };
}

export function ParseBaseArgument(argv, fallbackBase)
{
    const flagIndex = argv.indexOf(BASE_FLAG);
    if (flagIndex === -1)
    {
        return { base: fallbackBase, rest: argv };
    }
    const base = argv[flagIndex + 1];
    if (!base)
    {
        throw new Error(`${BASE_FLAG} needs a ref`);
    }
    const rest = argv.filter((unusedValue, index) =>
        index !== flagIndex && index !== flagIndex + 1
    );
    return { base, rest };
}

export function ListChangedFiles(base, root = RepoRoot)
{
    const committed = gitLines(root, [...GIT_LIST_FLAGS, `${base}...${HEAD_REF}`]);
    const uncommitted = gitLines(root, [...GIT_LIST_FLAGS, HEAD_REF]);
    const untracked = gitLines(root, UNTRACKED_FLAGS);
    const policy = readToolJson('policy.json');
    const keepPath = CreatePathFilter(SmellsConfig, policy.formatProtected);
    const paths = new Set([
        ...committed,
        ...uncommitted,
        ...untracked,
    ]);
    return [...paths]
        .map(path => path.replaceAll('\\', '/'))
        .filter(keepPath)
        .filter(path => existsSync(join(root, path)))
        .sort();
}
