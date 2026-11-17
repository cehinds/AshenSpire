// @ts-check
const RECENT_CUE_LIMIT = 32;

/** @returns {import('./contracts.js').FeedbackChannel} */
export function CreateCueChannel()
{
    return {
        sink: null,
        recent: [],
        play(cueId)
        {
            this.recent.push(cueId);

            if (this.recent.length > RECENT_CUE_LIMIT)
            {
                this.recent.shift();
            }

            if (this.sink)
            {
                this.sink(cueId);
            }
        },
    };
}
