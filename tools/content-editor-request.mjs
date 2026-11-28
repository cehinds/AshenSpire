// /__content/ request plumbing: the localhost gate, the same-origin check, bodies, replies.
import { ApiMessage, CONTENT_API } from './content-editor-config.mjs';
import { CONTENT_STATUS, ContentError } from './content-editor-error.mjs';

const LOOPBACK_ADDRESSES = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
];
const SAFE_HOST = /^(localhost|127\.0\.0\.1):\d+$/;
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;|$)/i;
const TEXT_ENCODING = 'utf8';
const RESPONSE_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
};

export function Reply(res, status, value)
{
    res.writeHead(status, RESPONSE_HEADERS);
    res.end(JSON.stringify(value));
}

/** True for a loopback request on a localhost host header, with --editor-write on. */
export function IsLocalEditorRequest(req, editorWrite)
{
    const local = LOOPBACK_ADDRESSES.includes(req.socket?.remoteAddress || '');
    const safeHost = SAFE_HOST.test(req.headers.host || '');
    return Boolean(editorWrite) && local && safeHost;
}

/** True for a same-origin JSON request, as the Score Studio page sends. */
export function IsFromStudio(req)
{
    const sameOrigin = req.headers.origin === `http://${req.headers.host}`;
    const isJson = JSON_CONTENT_TYPE.test(req.headers['content-type'] || '');
    return sameOrigin && isJson;
}

/** The parsed JSON body, refused past the configured size limit. */
export async function ReadJsonBody(req)
{
    const chunks = [];
    let size = 0;
    for await (const chunk of req)
    {
        size += chunk.length;
        if (size > CONTENT_API.maxBodyBytes)
        {
            throw new ContentError(CONTENT_STATUS.tooLarge, ApiMessage('tooLarge'));
        }
        chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString(TEXT_ENCODING);
    try
    {
        return text
            ? JSON.parse(text)
            : {};
    }
    catch
    {
        throw new ContentError(CONTENT_STATUS.badRequest, ApiMessage('notFromStudio'));
    }
}
