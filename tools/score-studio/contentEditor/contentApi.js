// Calls the /__content/ API that `npm run play` serves; routes come from contentApi.json.
import { TextHash } from './textHash.js';

const JSON_HEADERS = {
    'Content-Type': 'application/json',
};
const METHOD_PUT = 'PUT';
const METHOD_POST = 'POST';
const EMPTY_BODY = '{}';

export class ContentApi
{
    constructor(apiConfig)
    {
        this.routes = apiConfig.routes;
        this.hashAlgorithm = apiConfig.hash.web;
        this.noServer = apiConfig.messages.noServer;
    }

    async Request(url, options = {})
    {
        let response;
        try
        {
            response = await fetch(url, options);
        }
        catch
        {
            throw new Error(this.noServer);
        }
        const body = await response.json().catch(() => ({ error: this.noServer }));
        if (!response.ok)
        {
            const error = new Error(body.error || this.noServer);
            error.stale = Boolean(body.stale);
            throw error;
        }
        return body;
    }

    /** The text of one repo file. */
    async ReadFile(path)
    {
        const body = await this.Request(`${this.routes.file}?path=${encodeURIComponent(path)}`);
        return body.text;
    }

    /** The editable *.json names in one repo folder. */
    async ListFolder(folder)
    {
        const body = await this.Request(`${this.routes.list}?folder=${encodeURIComponent(folder)}`);
        return body.files;
    }

    /** The hash the server compares against, of the text a file was opened from. */
    Hash(text)
    {
        return TextHash(text, this.hashAlgorithm);
    }

    /** Writes one repo file; refused with `stale` when the file changed since `baseText`. */
    async SaveFile(path, text, baseText)
    {
        const baseHash = await this.Hash(baseText);
        return this.Request(this.routes.file, {
            method: METHOD_PUT,
            headers: JSON_HEADERS,
            body: JSON.stringify({ path, text, baseHash }),
        });
    }

    /** Runs the owner build and checks; resolves to { ok, lines }. */
    RunCheck()
    {
        return this.Request(this.routes.check, {
            method: METHOD_POST,
            headers: JSON_HEADERS,
            body: EMPTY_BODY,
        });
    }
}
