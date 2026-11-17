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
