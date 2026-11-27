// Fake requests and responses for the /__content/ API handler; routes come from contentApi.json.
import { CONTENT_API } from '../../tools/content-editor-config.mjs';

export const LOCAL_HOST = 'localhost:8094';
const LOOPBACK = '127.0.0.1';
const STUDIO_HEADERS = {
    origin: `http://${LOCAL_HOST}`,
    'content-type': 'application/json',
};
const EMPTY_BODY = '{}';

export function FakeRequest({ method, url, body = '', headers = {}, remoteAddress = LOOPBACK })
{
    return {
        method,
        url,
        socket: { remoteAddress },
        headers: {
            host: LOCAL_HOST,
            ...headers,
        },
        async *[Symbol.asyncIterator]()
        {
            yield Buffer.from(body);
        },
    };
}

/** Records the status and parsed JSON body the handler replies with. */
export function FakeResponse()
{
    return {
        status: 0,
        body: null,
        writeHead(status)
        {
            this.status = status;
        },
        end(text)
        {
            this.body = JSON.parse(text);
        },
    };
}

/** A GET of one file, as the Studio page reads it. */
export function StudioRead(path, options = {})
{
    return FakeRequest({
        method: 'GET',
        url: `${CONTENT_API.routes.file}?path=${encodeURIComponent(path)}`,
        ...options,
    });
}

/** A same-origin JSON save, as the Studio page sends it. */
export function StudioPut(value, body = JSON.stringify(value))
{
    return FakeRequest({
        method: 'PUT',
        url: CONTENT_API.routes.file,
        body,
        headers: STUDIO_HEADERS,
    });
}

export function StudioCheck()
{
    return FakeRequest({
        method: 'POST',
        url: CONTENT_API.routes.check,
        body: EMPTY_BODY,
        headers: STUDIO_HEADERS,
    });
}
