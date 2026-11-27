// The /__content/ API behind the Score Studio "Game content" tab.
// Answers only on localhost when serve runs with --editor-write.
import {
    ContentError,
    ListContentFolder,
    ReadContentFile,
    SaveContentFile,
} from './content-editor-files.mjs';
import { RunContentCheck } from './content-editor-check.mjs';

export const CONTENT_API_PREFIX = '/__content/';

const FILE_ROUTE = '/__content/file';
const LIST_ROUTE = '/__content/list';
const CHECK_ROUTE = '/__content/check';
const METHOD_GET = 'GET';
const METHOD_PUT = 'PUT';
const METHOD_POST = 'POST';
const LOOPBACK_ADDRESSES = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
];
const SAFE_HOST = /^(localhost|127\.0\.0\.1):\d+$/;
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;|$)/i;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_TOO_LARGE = 413;
const STATUS_SERVER_ERROR = 500;
const NOT_LOCAL = 'Game content editing needs `npm run play` on this computer.';
const NOT_FROM_STUDIO = 'Save from the local Score Studio.';
const NO_SUCH_ROUTE = 'Unknown content request.';
const TOO_LARGE = 'The file is too large to save.';
const MISSING_FILE_CODE = 'ENOENT';

function reply(res, status, value)
{
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(value));
}

function isAllowed(req, editorWrite)
{
    const local = LOOPBACK_ADDRESSES.includes(req.socket?.remoteAddress || '');
    const safeHost = SAFE_HOST.test(req.headers.host || '');
    return Boolean(editorWrite) && local && safeHost;
}

function isFromStudio(req)
{
    const sameOrigin = req.headers.origin === `http://${req.headers.host}`;
    const isJson = JSON_CONTENT_TYPE.test(req.headers['content-type'] || '');
    return sameOrigin && isJson;
}

async function readJsonBody(req)
{
    const chunks = [];
    let size = 0;
    for await (const chunk of req)
    {
        size += chunk.length;
        if (size > MAX_BODY_BYTES)
        {
            throw new ContentError(STATUS_TOO_LARGE, TOO_LARGE);
        }
        chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    try
    {
        return text
            ? JSON.parse(text)
            : {};
    }
    catch
    {
        throw new ContentError(STATUS_BAD_REQUEST, NOT_FROM_STUDIO);
    }
}

const ROUTES = {
    [`${METHOD_GET} ${FILE_ROUTE}`]: async (req, root, query) =>
    {
        return { text: await ReadContentFile(root, query.get('path')) };
    },
    [`${METHOD_GET} ${LIST_ROUTE}`]: async (req, root, query) =>
    {
        return { files: await ListContentFolder(root, query.get('folder')) };
    },
    [`${METHOD_PUT} ${FILE_ROUTE}`]: async (req, root) =>
    {
        const body = await readJsonBody(req);
        return SaveContentFile(root, body.path, body.text);
    },
    [`${METHOD_POST} ${CHECK_ROUTE}`]: async (req, root) =>
    {
        await readJsonBody(req);
        return RunContentCheck(root);
    },
};

function errorStatus(error)
{
    if (error instanceof ContentError)
    {
        return error.status;
    }
    return error.code === MISSING_FILE_CODE
        ? STATUS_NOT_FOUND
        : STATUS_SERVER_ERROR;
}

/** Answers one /__content/ request: read, list, save or check game JSON. */
export async function HandleContentRequest(req, res, { root, editorWrite })
{
    if (!isAllowed(req, editorWrite))
    {
        reply(res, STATUS_FORBIDDEN, { ok: false, error: NOT_LOCAL });
        return;
    }
    if (req.method !== METHOD_GET && !isFromStudio(req))
    {
        reply(res, STATUS_FORBIDDEN, { ok: false, error: NOT_FROM_STUDIO });
        return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = ROUTES[`${req.method} ${url.pathname}`];
    if (!route)
    {
        reply(res, STATUS_NOT_FOUND, { ok: false, error: NO_SUCH_ROUTE });
        return;
    }
    try
    {
        const result = await route(req, root, url.searchParams);
        reply(res, STATUS_OK, { ok: true, ...result });
    }
    catch (error)
    {
        reply(res, errorStatus(error), { ok: false, error: error.message });
    }
}
