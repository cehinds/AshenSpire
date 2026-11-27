// The /__content/ API behind the Score Studio "Game content" tab: read, list, save, check.
// It answers only on localhost when serve runs with --editor-write; routes live in contentApi.json.
import { RunContentCheck } from './content-editor-check.mjs';
import { ApiMessage, CONTENT_API } from './content-editor-config.mjs';
import { CONTENT_STATUS, ContentError } from './content-editor-error.mjs';
import { ListContentFolder, ReadContentFile, SaveContentFile } from './content-editor-files.mjs';
import { CheckGate } from './content-editor-gate.mjs';
import {
    IsFromStudio,
    IsLocalEditorRequest,
    ReadJsonBody,
    Reply,
} from './content-editor-request.mjs';

export const CONTENT_API_PREFIX = CONTENT_API.prefix;

const METHOD_GET = 'GET';
const METHOD_PUT = 'PUT';
const METHOD_POST = 'POST';
const MISSING_FILE_CODE = 'ENOENT';
const { routes } = CONTENT_API;
const CHECK_GATE = new CheckGate();

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
        const body = await ReadJsonBody(req);
        CHECK_GATE.RefuseWhileRunning('checkRunning');
        return SaveContentFile(root, body.path, body.text, body.baseHash);
    },
    [`${METHOD_POST} ${routes.check}`]: async (req, root, query, runCheck) =>
    {
        await ReadJsonBody(req);
        return CHECK_GATE.Run(() => runCheck(root), 'checkBusy');
    },
};

function errorStatus(error)
{
    if (error instanceof ContentError)
    {
        return error.status;
    }
    return error.code === MISSING_FILE_CODE
        ? CONTENT_STATUS.notFound
        : CONTENT_STATUS.serverError;
}

function refusal(req, editorWrite)
{
    if (!IsLocalEditorRequest(req, editorWrite))
    {
        return 'notLocal';
    }
    return req.method !== METHOD_GET && !IsFromStudio(req)
        ? 'notFromStudio'
        : null;
}

/** Answers one /__content/ request; `runCheck` is replaceable so tests need no real build. */
export async function HandleContentRequest(req, res, options)
{
    const {
        root,
        editorWrite,
        runCheck = RunContentCheck,
    } = options;
    const refused = refusal(req, editorWrite);
    if (refused)
    {
        Reply(res, CONTENT_STATUS.forbidden, { ok: false, error: ApiMessage(refused) });
        return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = ROUTES[`${req.method} ${url.pathname}`];
    if (!route)
    {
        Reply(res, CONTENT_STATUS.notFound, { ok: false, error: ApiMessage('noSuchRoute') });
        return;
    }
    try
    {
        const result = await route(req, root, url.searchParams, runCheck);
        Reply(res, CONTENT_STATUS.ok, { ok: true, ...result });
    }
    catch (error)
    {
        const failure = {
            ok: false,
            error: error.message,
            stale: Boolean(error.stale),
        };
        Reply(res, errorStatus(error), failure);
    }
}
