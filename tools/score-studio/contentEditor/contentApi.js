// Calls the /__content/ API that `npm run play` serves.
// Routes and messages come from contentApi.json.
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
            throw new Error(body.error || this.noServer);
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

    /** Writes one repo file; the server checks the path and the JSON. */
    SaveFile(path, text)
    {
        return this.Request(this.routes.file, {
            method: METHOD_PUT,
            headers: JSON_HEADERS,
            body: JSON.stringify({ path, text }),
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
