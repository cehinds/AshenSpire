// Formats the named files with the pinned dprint settings, for files outside src/ enrollment.
// Usage: node tools/code-quality/format-files.mjs <path> [<path> ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FormatSource } from './format.mjs';

const USAGE = 'Usage: node tools/code-quality/format-files.mjs <path> [<path> ...]';
const EXIT_USAGE = 2;

function formatOneFile(filePath)
{
    const absolutePath = resolve(filePath);
    const original = readFileSync(absolutePath, 'utf8');
    const formatted = FormatSource(absolutePath, original);
    if (formatted === original)
    {
        return false;
    }
    writeFileSync(absolutePath, formatted);
    return true;
}

const filePaths = process.argv.slice(2);
if (!filePaths.length)
{
    console.error(USAGE);
    process.exit(EXIT_USAGE);
}
for (const filePath of filePaths)
{
    const changed = formatOneFile(filePath);
    console.log(`${changed ? 'formatted' : 'unchanged'} ${filePath}`);
}
