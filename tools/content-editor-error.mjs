// The error the /__content/ API answers with, and the HTTP statuses it uses.
export const CONTENT_STATUS = Object.freeze({
    ok: 200,
    badRequest: 400,
    forbidden: 403,
    notFound: 404,
    conflict: 409,
    tooLarge: 413,
    serverError: 500,
});

/** An error carrying the HTTP status to answer with; `stale` marks a file changed on disk. */
export class ContentError extends Error
{
    constructor(status, message, stale = false)
    {
        super(message);
        this.status = status;
        this.stale = stale;
    }
}
