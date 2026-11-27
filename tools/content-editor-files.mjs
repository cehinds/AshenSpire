// Reads, lists and writes the owner's game JSON for the Score Studio "Game content" tab.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { ApiMessage, CONTENT_API } from './content-editor-config.mjs';
import { IsEditableContentPath, OWNER_TOOLS } from './owner/ownerSteps.mjs';

const BACKSLASH = /\\/g;
const FORWARD_SLASH = '/';
const PARENT_SEGMENT = '..';
const CARRIAGE_RETURN_LINE = /\r\n?/g;
const NEWLINE = '\n';
const TEXT_ENCODING = 'utf8';
const STATUS_BAD_REQUEST = 400;
const STATUS_FORBIDDEN = 403;

/** An error with the HTTP status the handler should answer with. */
export class ContentError extends Error
{
    constructor(status, message)
    {
        super(message);
        this.status = status;
    }
}

function slashPath(path)
{
    return String(path || '').replace(BACKSLASH, FORWARD_SLASH);
}

function insideRoot(root, absolutePath)
{
    const fromRoot = relative(root, absolutePath);
    const leavesRoot = fromRoot.startsWith(PARENT_SEGMENT) || isAbsolute(fromRoot);
    return fromRoot !== '' && !leavesRoot;
}

function rejectUnsafe(path)
{
    if (!path || isAbsolute(path) || path.split(FORWARD_SLASH).includes(PARENT_SEGMENT))
    {
        throw new ContentError(STATUS_FORBIDDEN, ApiMessage('notRepoPath', { path }));
    }
}

function isEditableFolder(folder)
{
    const withSlash = folder.endsWith(FORWARD_SLASH)
        ? folder
        : `${folder}${FORWARD_SLASH}`;
    return OWNER_TOOLS.editableRoots.some((editableRoot) => withSlash.startsWith(editableRoot));
}

/** The absolute path of an owner-editable file; throws ContentError for anything else. */
export function ResolveEditablePath(root, requestedPath)
{
    const path = slashPath(requestedPath);
    rejectUnsafe(path);
    if (!IsEditableContentPath(path))
    {
        throw new ContentError(STATUS_FORBIDDEN, ApiMessage('notEditable', { path }));
    }
    const absolutePath = resolve(root, path);
    if (!insideRoot(root, absolutePath))
    {
        throw new ContentError(STATUS_FORBIDDEN, ApiMessage('notRepoPath', { path }));
    }
    return absolutePath;
}

/** The text to write: LF line endings, one trailing newline; throws when it is not JSON. */
export function PrepareContentText(text)
{
    const withLineFeeds = String(text).replace(CARRIAGE_RETURN_LINE, NEWLINE);
    const normalized = `${withLineFeeds.trimEnd()}${NEWLINE}`;
    try
    {
        JSON.parse(normalized);
    }
    catch (error)
    {
        const message = ApiMessage('notJson', { error: error.message });
        throw new ContentError(STATUS_BAD_REQUEST, message);
    }
    return normalized;
}

export async function ReadContentFile(root, path)
{
    return readFile(ResolveEditablePath(root, path), TEXT_ENCODING);
}

export async function SaveContentFile(root, path, text)
{
    const absolutePath = ResolveEditablePath(root, path);
    await writeFile(absolutePath, PrepareContentText(text), TEXT_ENCODING);
    return { path: slashPath(path) };
}

/** The editable *.json names in one folder, skipping generated `_` files. */
export async function ListContentFolder(root, requestedFolder)
{
    const folder = slashPath(requestedFolder);
    rejectUnsafe(folder);
    if (!isEditableFolder(folder) || !insideRoot(root, resolve(root, folder)))
    {
        throw new ContentError(STATUS_FORBIDDEN, ApiMessage('notListable', { path: folder }));
    }
    const { listExtension, hiddenPrefix } = CONTENT_API;
    const names = await readdir(resolve(root, folder));
    return names
        .filter((name) => name.endsWith(listExtension) && !name.startsWith(hiddenPrefix))
        .sort();
}
