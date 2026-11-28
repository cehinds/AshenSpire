// Formats, or checks the formatting of, the JavaScript files changed against a base ref.
// Usage: node tools/code-quality/format-changed.mjs --write|--check [--base <ref>] [<path> ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    ListChangedFiles,
    ParseBaseArgument,
    RepoRelative,
    RepoRoot,
    SmellsConfig,
} from './changed-files.mjs';
import { FormatSource } from './format.mjs';

const WRITE_FLAG = '--write';
const CHECK_FLAG = '--check';
const USAGE = 'Usage: format-changed.mjs --write|--check [--base <ref>] [<path> ...]';
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

function readMode(argv)
{
    const modes = argv.filter(argument => argument === WRITE_FLAG || argument === CHECK_FLAG);
    if (modes.length !== 1)
    {
        return null;
    }
    return modes[0];
}

function isFormattable(path, formatExclude)
{
    return !formatExclude.some(prefix => path.startsWith(prefix));
}

export function FindUnformatted(paths, root = RepoRoot)
{
    const unformatted = [];
    for (const path of paths)
    {
        const absolutePath = join(root, path);
        const original = readFileSync(absolutePath, 'utf8');
        const formatted = FormatSource(absolutePath, original);
        if (formatted !== original)
        {
            unformatted.push({ path, absolutePath, formatted });
        }
    }
    return unformatted;
}

export function RunFormatChanged(argv, root = RepoRoot)
{
    const mode = readMode(argv);
    if (!mode)
    {
        console.error(USAGE);
        return EXIT_USAGE;
    }
    const { base, rest } = ParseBaseArgument(argv, SmellsConfig.defaultBase);
    const named = rest.filter(argument => argument !== mode);
    const candidates = named.length
        ? named.map(path => RepoRelative(path, root))
        : ListChangedFiles(base, root);
    const paths = candidates.filter(path => isFormattable(path, SmellsConfig.formatExclude));
    const unformatted = FindUnformatted(paths, root);
    if (mode === CHECK_FLAG)
    {
        for (const { path } of unformatted)
        {
            console.log(`${path}: format with npm run format:changed`);
        }
        console.log(
            `format:changed checked ${paths.length} files, ${unformatted.length} need formatting`,
        );
        return unformatted.length
            ? EXIT_FAILURE
            : 0;
    }
    for (const { path, absolutePath, formatted } of unformatted)
    {
        writeFileSync(absolutePath, formatted);
        console.log(`formatted ${path}`);
    }
    console.log(`format:changed formatted ${unformatted.length} of ${paths.length} files`);
    return 0;
}

const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url)
{
    process.exitCode = RunFormatChanged(process.argv.slice(2));
}
