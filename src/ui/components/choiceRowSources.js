import { playingCardArt } from '../cardArtwork.js';

export function SummarizeOrNull(subject, summarize)
{
    try
    {
        return summarize?.(subject) ?? null;
    }
    catch
    {
        return null;
    }
}

export function PlayingCardArtworkOrNull(cardId, definition, registries)
{
    try
    {
        const artwork = playingCardArt(
            { cardId },
            {
                definition,
                registries,
            },
        );
        return artwork || null;
    }
    catch
    {
        return null;
    }
}
