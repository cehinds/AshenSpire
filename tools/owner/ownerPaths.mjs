// Which repo paths the owner edits, which the build writes, and text comparison.
import { OWNER_TOOLS } from './ownerConfig.mjs';

const BACKSLASH = /\\/g;
const SLASH = '/';
const LINE_ENDING_RETURN = /\r\n/g;
const NEWLINE = '\n';

function normalPath(relativePath)
{
    return relativePath.replace(BACKSLASH, SLASH);
}

function normalText(text)
{
    return (text || '')
        .replace(LINE_ENDING_RETURN, NEWLINE)
        .trim();
}

/** True when a repo path is an owner-editable content file rather than a generated one. */
export function IsEditableContentPath(relativePath, settings = OWNER_TOOLS)
{
    const path = normalPath(relativePath);
    const fileName = path.split(SLASH).pop();
    const inRoot = settings.editableRoots.some((root) => path.startsWith(root));
    const hasExtension = settings.editableExtensions.some((extension) => path.endsWith(extension));
    const isGenerated = settings.generatedNames.includes(fileName);
    return inRoot && hasExtension && !isGenerated;
}

/** True when a path must never be committed by the owner tools (built HTML, the build box). */
export function IsNeverCommitPath(relativePath, settings = OWNER_TOOLS)
{
    const path = normalPath(relativePath);
    return settings.neverCommit.some((rule) => path === rule || path.endsWith(rule));
}

/** True for a file the build writes, which is safe to restore and rebuild. */
export function IsDerivedPath(relativePath, settings = OWNER_TOOLS)
{
    const path = normalPath(relativePath);
    const inLocation = settings.generatedLocations.some((location) => path.startsWith(location));
    const hasSuffix = settings.generatedSuffixes.some((suffix) => path.endsWith(suffix));
    return inLocation || hasSuffix;
}

/** True for an editable file the build also rewrites, such as characters.json. */
export function IsRebuiltPath(relativePath, settings = OWNER_TOOLS)
{
    return settings.rebuiltContentFiles.includes(normalPath(relativePath));
}

/** True when two texts match once line endings and edge whitespace are ignored. */
export function SameText(left, right)
{
    return normalText(left) === normalText(right);
}
