// The /__content/ API behind the Score Studio "Game content" tab.
// Answers only on localhost when serve runs with --editor-write; routes live in contentApi.json.
import { ApiMessage, CONTENT_API } from './content-editor-config.mjs';
import {
    ContentError,
    ListContentFolder,
    ReadContentFile,
    SaveContentFile,
} from './content-editor-files.mjs';
import { RunContentCheck } from './content-editor-check.mjs';

export const CONTENT_API_PREFIX = CONTENT_API.prefix;

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
const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_CONFLICT = 409;
const STATUS_TOO_LARGE = 413;
const STATUS_SERVER_ERROR = 500;
const MISSING_FILE_CODE = 'ENOENT';
const RESPONSE_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
};

function reply(res, status, value)
{
    res.writeHead(status, RESPONSE_HEADERS);
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
        if (size > CONTENT_API.maxBodyBytes)
        {
            throw new ContentError(STATUS_TOO_LARGE, ApiMessage('tooLarge'));
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
        throw new ContentError(STATUS_BAD_REQUEST, ApiMessage('notFromStudio'));
    }
}

const { routes } = CONTENT_API;
let checkRunning = false;

function refuseWhileChecking(messageName)
{
    if (checkRunning)
    {
        throw new ContentError(STATUS_CONFLICT, ApiMessage(messageName));
    }
}

/** One check at a time; saves wait until it ends so a build cannot overwrite them. */
async function runExclusiveCheck(root, runCheck)
{
    refuseWhileChecking('checkBusy');
    checkRunning = true;
    try
    {
        return await runCheck(root);
    }
    finally
    {
        checkRunning = false;
    }
}

const ROUTES = {
    [`${METHOD_GET} ${routes.file}`]: async (req, root, query) =>
    {
        return { text: await ReadContentFile(root, query.get('path')) };
    },
    [`${METHOD_GET} ${routes.list}`]: async (req, root, query) =>
    {
        return { files: await ListContentFolder(root, query.get('folder')) };
    },
    [`${METHOD_PUT} ${routes.file}`]: async (req, root) =>
    {
        const body = await readJsonBody(req);
        refuseWhileChecking('checkRunning');
        return SaveContentFile(root, body.path, body.text, body.baseHash);
    },
    [`${METHOD_POST} ${routes.check}`]: async (req, root, query, runCheck) =>
    {
        await readJsonBody(req);
        return runExclusiveCheck(root, runCheck);
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

/** Answers one /__content/ request; `runCheck` is replaceable so tests need no real build. */
export async function HandleContentRequest(req, res, options)
{
    const {
        root,
        editorWrite,
        runCheck = RunContentCheck,
    } = options;
    if (!isAllowed(req, editorWrite))
    {
        reply(res, STATUS_FORBIDDEN, { ok: false, error: ApiMessage('notLocal') });
        return;
    }
    if (req.method !== METHOD_GET && !isFromStudio(req))
    {
        reply(res, STATUS_FORBIDDEN, { ok: false, error: ApiMessage('notFromStudio') });
        return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = ROUTES[`${req.method} ${url.pathname}`];
    if (!route)
    {
        reply(res, STATUS_NOT_FOUND, { ok: false, error: ApiMessage('noSuchRoute') });
        return;
    }
    try
    {
        const result = await route(req, root, url.searchParams, runCheck);
        reply(res, STATUS_OK, { ok: true, ...result });
    }
    catch (error)
    {
        const failure = {
            ok: false,
            error: error.message,
            stale: Boolean(error.stale),
        };
        reply(res, errorStatus(error), failure);
    }
}
